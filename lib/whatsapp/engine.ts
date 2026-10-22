import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL, hasAnthropic } from "@/lib/config";
import { COURSE, itemById, percentDone, type CourseItem } from "@/lib/course";
import { LIMITS, redactSecrets } from "@/lib/reviewer-core";
import { markRead, sendOut } from "@/lib/whatsapp/api";
import {
  MENU_BTN, NEXT_BTN, WA, appAnchor, awaitingFor, btn, clip, cleanInbound, driveFileId, driveViewUrl, footerFor, itemLabel, parseCommand,
  parseQuizAnswer, quizFeedback, renderCard, toWhatsAppText, withButtons,
  type Card, type Command, type Out, type Row
} from "@/lib/whatsapp/core";
import { firstUndone, loadMedia, loadScript, nextItem, titleOf } from "@/lib/whatsapp/lessons";
import { mediaIdFor } from "@/lib/whatsapp/media";
import { askSageFor, canOpen, loadLearner, loadProgress, markItemDone, submitWork, type Learner } from "@/lib/whatsapp/learner";

/**
 * The WhatsApp conversation state machine. Called from the webhook (after the 200 is sent).
 * One card per message; at most 2 outgoing messages per inbound message. We only ever reply to an inbound message
 * (inside the 24-hour customer-service window); proactive messages are templates (app/api/whatsapp/reminders).
 */

/* ── Webhook payload → inbound messages and status updates ─────────────── */
export type Inbound = {
  id: string; from: string; phone: string; timestamp: number; name: string;
  type: string; text: string; replyId: string; mediaId: string; mediaKind: "" | "image" | "document";
};
export type StatusUpdate = { id: string; status: string; error: string; category: string };

type Obj = Record<string, unknown>;
const o = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const s = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

export function parseWebhook(payload: unknown): { messages: Inbound[]; statuses: StatusUpdate[] } {
  const messages: Inbound[] = [], statuses: StatusUpdate[] = [];
  const ourNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
  for (const entry of arr(o(payload).entry)) {
    for (const change of arr(o(entry).changes)) {
      const v = o(o(change).value);
      if (ourNumberId && s(o(v.metadata).phone_number_id) && s(o(v.metadata).phone_number_id) !== ourNumberId) continue;
      const names = new Map(arr(v.contacts).map(c => [s(o(c).wa_id), s(o(o(c).profile).name)]));
      for (const raw of arr(v.messages)) {
        const m = o(raw);
        const from = s(m.from).replace(/\D/g, "");
        const id = s(m.id);
        if (!from || !id) continue;
        const type = s(m.type);
        let text = "", replyId = "", mediaId = "", mediaKind: Inbound["mediaKind"] = "";
        if (type === "text") text = s(o(m.text).body);
        else if (type === "interactive") {
          const i = o(m.interactive);
          const r = o(i.button_reply).id ? o(i.button_reply) : o(i.list_reply);
          replyId = s(r.id); text = s(r.title);
        } else if (type === "button") { // quick-reply button on a template
          replyId = s(o(m.button).payload); text = s(o(m.button).text);
        } else if (type === "image" || type === "document") {
          const md = o(m[type]); mediaId = s(md.id); mediaKind = type; text = s(md.caption);
        }
        messages.push({ id, from, phone: "+" + from, timestamp: Number(m.timestamp) * 1000 || Date.now(), name: names.get(from) || "", type, text: cleanInbound(text), replyId: cleanInbound(replyId, 256), mediaId, mediaKind });
      }
      for (const raw of arr(v.statuses)) {
        const st = o(raw);
        const err = o(arr(st.errors)[0]);
        const error = err.code ? clip(`${s(err.code)} ${s(err.title) || s(err.message)}${s(o(err.error_data).details) ? ": " + s(o(err.error_data).details) : ""}`, 500) : "";
        statuses.push({ id: s(st.id), status: s(st.status), error, category: s(o(st.pricing).category) });
      }
    }
  }
  return { messages, statuses };
}

export async function processWebhook(payload: unknown) {
  const { messages, statuses } = parseWebhook(payload);
  for (const st of statuses) { try { await applyStatus(st); } catch (e) { console.error("[whatsapp] status", e); } }
  for (const m of messages) { try { await handleInbound(m); } catch (e) { console.error("[whatsapp] inbound", e); } }
}

const RANK: Record<string, number> = { received: 0, sent: 1, delivered: 2, read: 3 };
async function applyStatus(st: StatusUpdate) {
  if (!st.id || !["sent", "delivered", "read", "failed"].includes(st.status)) return;
  const db = createAdminClient();
  const { data: row } = await db.from("wa_messages").select("id, status").eq("wa_message_id", st.id).maybeSingle();
  if (!row) return;
  const patch: Obj = { updated_at: new Date().toISOString() };
  if (st.status === "failed") { patch.status = "failed"; patch.error = st.error || "failed"; }
  else if (row.status !== "failed" && (RANK[st.status] ?? 0) > (RANK[String(row.status)] ?? 0)) patch.status = st.status;
  if (st.category) patch.cost_category = st.category;
  if (Object.keys(patch).length > 1) await db.from("wa_messages").update(patch).eq("id", row.id);
}

/* ── Session and sending ───────────────────────────────────────────────── */
type Awaiting = "none" | "next" | "quiz" | "reveal" | "task";
type Session = {
  phone: string; user_id: string | null; item_id: string | null; card_index: number; awaiting: Awaiting; paused: boolean;
  evidence: string[]; last_inbound_at: string | null;
};
type Link = { user_id: string; phone_e164: string; opted_in: boolean; reminders: boolean };

const MAX_PER_INBOUND = 2;

class Conv {
  sent = 0;
  db = createAdminClient();
  constructor(public phone: string, public userId: string | null, public session: Session | null = null) {}

  async save(patch: Partial<Session>) {
    if (!this.session) return;
    Object.assign(this.session, patch);
    await this.db.from("wa_sessions").update({ ...patch, updated_at: new Date().toISOString() }).eq("phone", this.phone);
  }

  /** Sends up to the per-inbound limit, logging each message (and its failure) in wa_messages. */
  async send(outs: Out[]) {
    for (let m of outs) {
      if (this.sent >= MAX_PER_INBOUND) { console.warn("[whatsapp] dropped an extra message", m.type); break; }
      this.sent++;
      let mediaId: string | undefined;
      if (m.type === "video" && m.mediaKey) {
        // Upload once to WhatsApp and reuse the media id (works for Google Drive and any other host).
        mediaId = (await mediaIdFor(m.mediaKey, m.link)).id || undefined;
        const drive = driveFileId(m.link);
        // A Drive link can't be sent as a video link: if the upload failed, send Drive's player link instead.
        if (!mediaId && drive) m = { type: "text", body: clip(`${m.caption ? m.caption + "\n\n" : ""}Watch the video: ${driveViewUrl(drive)}`, WA.textMax), previewUrl: true };
      }
      const res = await sendOut(this.phone, m, mediaId);
      const body = m.type === "video" ? `[video] ${m.caption || ""}` : m.body;
      await this.db.from("wa_messages").insert({
        direction: "out", phone: this.phone, user_id: this.userId, wa_message_id: res.ok && res.id && res.id !== "ok" ? res.id : null,
        kind: m.type, body_excerpt: clip(redactSecrets(body).text, 160), item_id: this.session?.item_id ?? null,
        status: res.ok ? "sent" : "failed", error: res.ok ? null : res.error, cost_category: "service"
      });
      if (!res.ok) { console.error("[whatsapp] send failed", res.error); if (m.type !== "video") break; }
    }
    if (this.session && this.sent) await this.db.from("wa_sessions").update({ last_outbound_at: new Date().toISOString() }).eq("phone", this.phone);
  }
  say(body: string, buttons = [NEXT_BTN, MENU_BTN]) { return this.send(withButtons(body, buttons)); }
}

/* ── Inbound ───────────────────────────────────────────────────────────── */
export async function handleInbound(msg: Inbound) {
  const db = createAdminClient();
  const input = msg.replyId || msg.text;
  const pre = parseCommand(input);
  const isLink = pre?.cmd === "link";
  const excerpt = isLink ? "LINK ******" : msg.mediaKind ? `[${msg.mediaKind}] ${msg.text}` : input || `[${msg.type}]`;

  // Idempotent on Meta's message id: retries and duplicate deliveries stop here.
  const { error: dup } = await db.from("wa_messages").insert({
    direction: "in", phone: msg.phone, wa_message_id: msg.id, kind: isLink ? "link" : msg.replyId ? "reply" : msg.type || "text",
    body_excerpt: clip(redactSecrets(excerpt).text, 160), media_id: msg.mediaId || null, status: "received"
  });
  if (dup) { if (dup.code === "23505") return; console.error("[whatsapp] couldn't log inbound", dup.message); }

  // Outside the 24-hour window (a very late retry) or a reaction: nothing to say.
  if (Date.now() - msg.timestamp > 23 * 3_600_000) return;
  if (["reaction", "system", "ephemeral", "unsupported", "request_welcome"].includes(msg.type)) return;

  // Flood control: more than 15 messages a minute from one number get no replies.
  const { count: recent } = await db.from("wa_messages").select("id", { count: "exact", head: true })
    .eq("phone", msg.phone).eq("direction", "in").gte("created_at", new Date(Date.now() - 60_000).toISOString());
  if ((recent || 0) > 15) return;

  markRead(msg.id).catch(() => {});

  const { data: linkRow } = await db.from("wa_links").select("user_id, phone_e164, opted_in, reminders").eq("phone_e164", msg.phone).maybeSingle();
  const link = linkRow as Link | null;

  if (pre?.cmd === "link") return handleLink(msg, pre.code);
  if (!link) return welcomeUnlinked(msg, pre);

  const learner = await loadLearner(link.user_id);
  if (!learner) return;
  const session = await loadSession(msg.phone, link.user_id);
  const conv = new Conv(msg.phone, link.user_id, session);
  await db.from("wa_sessions").update({ last_inbound_at: new Date().toISOString() }).eq("phone", msg.phone);
  await db.from("wa_messages").update({ user_id: link.user_id, item_id: session.item_id }).eq("wa_message_id", msg.id);

  // Opted out: only START (or LINK) brings them back.
  if (!link.opted_in) {
    if (pre?.cmd === "start" || pre?.cmd === "resume") {
      await db.from("wa_links").update({ opted_in: true, reminders: true, stopped_at: null }).eq("user_id", link.user_id);
      await conv.save({ paused: false });
      return welcome(conv, learner, true);
    }
    if (pre?.cmd === "stop") return;
    return conv.send([{ type: "text", body: "You've stopped Automancy Academy messages. Reply START to carry on learning here." }]);
  }

  const cmd = parseCommand(input, { strict: session.awaiting === "task" });
  return dispatch(conv, learner, link, msg, cmd);
}

async function loadSession(phone: string, userId: string): Promise<Session> {
  const db = createAdminClient();
  const { data } = await db.from("wa_sessions").select("phone, user_id, item_id, card_index, awaiting, paused, evidence, last_inbound_at").eq("phone", phone).maybeSingle();
  if (data && data.user_id === userId) {
    return { ...(data as Session), evidence: Array.isArray(data.evidence) ? (data.evidence as string[]) : [] };
  }
  const fresh: Session = { phone, user_id: userId, item_id: null, card_index: 0, awaiting: "none", paused: false, evidence: [], last_inbound_at: null };
  await db.from("wa_sessions").upsert({ ...fresh, updated_at: new Date().toISOString() }, { onConflict: "phone" });
  return fresh;
}

async function welcomeUnlinked(msg: Inbound, cmd: Command | null) {
  const db = createAdminClient();
  // One welcome per 10 minutes per number, so an unlinked number can't make us send a stream of replies.
  const { count } = await db.from("wa_messages").select("id", { count: "exact", head: true })
    .eq("phone", msg.phone).eq("direction", "out").gte("created_at", new Date(Date.now() - 10 * 60_000).toISOString());
  if ((count || 0) > 0) return;
  const conv = new Conv(msg.phone, null);
  if (cmd?.cmd === "stop") return conv.send([{ type: "text", body: "OK. This number isn't linked to an Automancy Academy account, and we won't message you." }]);
  return conv.send([{ type: "text", previewUrl: false, body:
    `Hi${msg.name ? " " + clip(msg.name, 40) : ""}! This is Automancy Academy.\n\nTo learn on WhatsApp, link this number to your account: sign in at ${SITE_URL}/account#whatsapp, tap *Get my link code* and send us the LINK message it shows.\n\nNew here? Start free at ${SITE_URL}/signup` }]);
}

async function handleLink(msg: Inbound, code: string) {
  const db = createAdminClient();
  const conv = new Conv(msg.phone, null);
  const { count: tries } = await db.from("wa_messages").select("id", { count: "exact", head: true })
    .eq("phone", msg.phone).eq("direction", "in").eq("kind", "link").gte("created_at", new Date(Date.now() - 3_600_000).toISOString());
  if ((tries || 0) > 10) return conv.send([{ type: "text", body: "Too many link attempts from this number. Please try again in an hour." }]);

  const now = new Date().toISOString();
  const { data: claimed } = await db.from("wa_link_codes").update({ used: true, used_at: now, used_by_phone: msg.phone })
    .eq("code", code).eq("used", false).gt("expires_at", now).select("user_id");
  const userId = claimed && claimed.length ? String(claimed[0].user_id) : "";
  if (!userId) {
    return conv.send([{ type: "text", previewUrl: false, body: `That code didn't work. Codes last 15 minutes and work once. Get a new one at ${SITE_URL}/account#whatsapp and send the LINK message again.` }]);
  }
  // The number moves to this account (whoever holds the phone proves it); one number per learner.
  await db.from("wa_links").delete().eq("phone_e164", msg.phone).neq("user_id", userId);
  const { error } = await db.from("wa_links").upsert({ user_id: userId, phone_e164: msg.phone, linked_at: now, opted_in: true, reminders: true, stopped_at: null }, { onConflict: "user_id" });
  if (error) { console.error("[whatsapp] link failed", error.message); return conv.send([{ type: "text", body: "Sorry, linking failed. Please try again in a minute." }]); }
  await db.from("wa_sessions").delete().eq("user_id", userId).neq("phone", msg.phone);
  await db.from("audit_log").insert({ actor: userId, action: "whatsapp.linked", target: userId, detail: { phone_last4: msg.phone.slice(-4) } });

  const learner = await loadLearner(userId);
  if (!learner) return;
  const session = await loadSession(msg.phone, userId);
  conv.userId = userId; conv.session = session;
  await db.from("wa_messages").update({ user_id: userId }).eq("wa_message_id", msg.id);
  await db.from("wa_sessions").update({ last_inbound_at: now }).eq("phone", msg.phone);
  return conv.say(
    `*Linked.* Welcome${learner.name ? ", " + learner.name : ""}! This number now gets your Automancy Academy lessons, one card at a time. Your progress is shared with the web course.\n\n` +
    `Tap a button or type: NEXT, MENU, PROGRESS, LESSON 0.3, HELP <your question>. Reply STOP anytime to stop messages.`,
    [btn("CONTINUE", "Start learning"), MENU_BTN]
  );
}

/* ── Commands and answers for a linked learner ─────────────────────────── */
async function dispatch(conv: Conv, learner: Learner, link: Link, msg: Inbound, cmd: Command | null) {
  const sess = conv.session!;
  const db = conv.db;

  if (cmd) {
    if (sess.paused && !["resume", "start", "continue", "lesson", "lessons", "tracks", "menu", "progress", "help", "reminders", "stop", "pause"].includes(cmd.cmd)) {
      return conv.say("Lessons are paused. Reply RESUME when you're ready.", [btn("RESUME", "Resume"), MENU_BTN]);
    }
    if (sess.paused && ["resume", "start", "continue", "lesson"].includes(cmd.cmd)) await conv.save({ paused: false });
    switch (cmd.cmd) {
      case "link": return; // handled earlier
      case "start": return welcome(conv, learner, false);
      case "continue": case "resume": case "repeat": return resume(conv, learner);
      case "next": return advance(conv, learner);
      case "back": return sess.item_id ? deliver(conv, learner, sess.item_id, Math.max(0, sess.card_index - 1)) : resume(conv, learner);
      case "lesson": {
        const item = itemById(cmd.id);
        if (!item) return conv.say(`There's no ${itemLabel(cmd.id)}. Try LESSON 0.1, LESSON 3.4 or BOSS 1.`, [btn("LESSONS", "Choose lesson"), MENU_BTN]);
        return deliver(conv, learner, item.id, 0);
      }
      case "lessons": return lessonsList(conv, learner, cmd.track);
      case "tracks": return tracksList(conv, learner);
      case "menu": return menu(conv, learner, link);
      case "progress": return progress(conv, learner);
      case "help": return help(conv, learner, cmd.question);
      case "pause":
        await conv.save({ paused: true });
        return conv.say("Paused. No lesson messages or reminders until you reply RESUME. Your progress is saved.", [btn("RESUME", "Resume"), MENU_BTN]);
      case "reminders":
        await db.from("wa_links").update({ reminders: cmd.on }).eq("user_id", learner.id);
        return conv.say(cmd.on ? "Reminders are on: if you haven't learned for a couple of days, we'll send one nudge (at most every 3 days)." : "Reminders are off. Reply REMINDERS ON to turn them back on.", [btn("CONTINUE", "Continue"), MENU_BTN]);
      case "stop":
        await db.from("wa_links").update({ opted_in: false, reminders: false, stopped_at: new Date().toISOString() }).eq("user_id", learner.id);
        await conv.save({ paused: true });
        await db.from("audit_log").insert({ actor: learner.id, action: "whatsapp.stop", target: learner.id });
        return conv.send([{ type: "text", body: "Done. You won't get any more messages from Automancy Academy here. Your progress is saved. Reply START anytime to come back." }]);
      case "skip":
        if (sess.awaiting === "task") { await conv.save({ evidence: [] }); return advance(conv, learner); }
        return advance(conv, learner);
      case "reveal": return reveal(conv, learner);
      case "answer": return answer(conv, learner, cmd.card, cmd.option);
    }
  }

  if (sess.paused) return conv.say("Lessons are paused. Reply RESUME when you're ready.", [btn("RESUME", "Resume"), MENU_BTN]);

  // Free text, images and documents: depends on what the current card is waiting for.
  if (sess.awaiting === "task") return taskReply(conv, learner, msg);
  if (msg.mediaKind) return conv.say("Thanks. Images and documents are used as evidence when a task asks for your work. Tap Next to carry on.");
  if (!msg.text) return conv.say("I can read text messages (and images or documents as evidence for a task). Type your message, or tap Menu.", [btn("CONTINUE", "Continue"), MENU_BTN]);
  if (sess.awaiting === "quiz") {
    const card = currentCard(sess);
    if (card?.t === "quiz") {
      const i = parseQuizAnswer(msg.text, card.options.length);
      if (i !== null) return answer(conv, learner, sess.card_index, i);
      return conv.say(`Reply with a letter from A to ${"ABCDEFGHIJ"[card.options.length - 1]}, or tap one of the options.`, [btn("REPEAT", "Show question"), MENU_BTN]);
    }
  }
  if (sess.awaiting === "reveal") return reveal(conv, learner);
  return conv.say("Tap Next to carry on, Menu for options, or send HELP followed by your question to ask Sage, the course assistant.");
}

function currentCard(sess: Session): Card | undefined {
  if (!sess.item_id) return undefined;
  return loadScript(sess.item_id)?.cards[sess.card_index];
}

async function welcome(conv: Conv, learner: Learner, back: boolean) {
  const sess = conv.session!;
  const name = learner.name ? `, ${learner.name}` : "";
  if (sess.item_id) {
    const it = itemById(sess.item_id);
    const total = loadScript(sess.item_id)?.cards.length || 0;
    return conv.say(`Welcome back${name}.${back ? " Messages are on again." : ""} You're on ${itemLabel(sess.item_id)} · ${titleOf(it)}${total ? ` (card ${Math.min(sess.card_index + 1, total)} of ${total})` : ""}.`,
      [btn("CONTINUE", "Continue"), MENU_BTN, btn("PROGRESS", "My progress")]);
  }
  return conv.say(`Welcome to Automancy Academy on WhatsApp${name}.${back ? " Messages are on again." : ""}\n\nYou'll get one card at a time: tap Next to move on, Menu for options, or send HELP and your question to ask Sage. Reply STOP anytime.`,
    [btn("CONTINUE", "Start learning"), MENU_BTN]);
}

async function resume(conv: Conv, learner: Learner) {
  const sess = conv.session!;
  if (sess.item_id) return deliver(conv, learner, sess.item_id, sess.card_index);
  const p = await loadProgress(learner.id);
  const open = firstUndone(p.done, i => canOpen(learner, i.id));
  if (open) return deliver(conv, learner, open.id, 0);
  const any = firstUndone(p.done);
  if (any) return pricing(conv, any);
  return finished(conv);
}

async function advance(conv: Conv, learner: Learner) {
  const sess = conv.session!;
  if (!sess.item_id) return resume(conv, learner);
  const script = loadScript(sess.item_id);
  if (script && sess.card_index < script.cards.length - 1) return deliver(conv, learner, sess.item_id, sess.card_index + 1);
  const n = nextItem(sess.item_id);
  if (!n) return finished(conv);
  return deliver(conv, learner, n.id, 0);
}

function pricing(conv: Conv, item: CourseItem) {
  return conv.say(`${itemLabel(item.id)} · ${titleOf(item)} is part of the full course. Base Camp (lessons 0.1 to 0.6 and Boss 0) is free.\n\nEnrol to unlock every lesson, project and review: ${SITE_URL}/pricing`,
    [btn("LESSONS 0", "Base Camp"), MENU_BTN]);
}

function finished(conv: Conv) {
  return conv.say(`You've reached the end of the course. Brilliant work.\n\nCheck your certificate progress at ${SITE_URL}/account#certificate`, [btn("PROGRESS", "My progress"), MENU_BTN]);
}

/** Sends one card of an item (and records where the learner is). */
async function deliver(conv: Conv, learner: Learner, itemId: string, index: number) {
  const item = itemById(itemId);
  if (!item) return;
  if (!canOpen(learner, itemId)) return pricing(conv, item);
  const title = titleOf(item);
  const script = loadScript(itemId);
  const appUrl = `${SITE_URL}/learn${appAnchor(itemId)}`;
  if (!script) {
    await conv.save({ item_id: itemId, card_index: 0, awaiting: "none", evidence: [] });
    return conv.say(`*${itemLabel(itemId)} · ${title}*\n\nThis one isn't on WhatsApp yet. Open it in the app: ${appUrl}\n\nTap Next for the next lesson when you're done.`,
      [btn("NEXT", "Next lesson"), MENU_BTN]);
  }
  const idx = Math.max(0, Math.min(index, script.cards.length - 1));
  const card = script.cards[idx];
  const moved = conv.session!.item_id !== itemId || conv.session!.card_index !== idx;
  await conv.save({ item_id: itemId, card_index: idx, awaiting: awaitingFor(card), ...(moved ? { evidence: [] } : {}) });
  const ctx = { itemId, title, index: idx, total: script.cards.length, media: loadMedia(), appUrl };
  if (card.t === "done") return conv.send(await doneMessage(learner, item, card.body, ctx));
  return conv.send(renderCard(card, ctx));
}

async function doneMessage(learner: Learner, item: CourseItem, body: string, ctx: { itemId: string; index: number; total: number; appUrl: string }): Promise<Out[]> {
  const footer = footerFor(ctx);
  const label = itemLabel(item.id);
  const r = await markItemDone(learner.id, item.id);
  const n = nextItem(item.id);
  const nextLine = n ? `\n\nNext up: ${itemLabel(n.id)} · ${titleOf(n)}${canOpen(learner, n.id) ? "" : " (full course)"}` : "\n\nThat was the last item in the course.";
  if (!r.ok && r.reason === "needs_review") {
    return withButtons(`${body}\n\nThis project counts as done once your submission is accepted. Tap Back to return to the task, or submit it in the app: ${ctx.appUrl}${nextLine}`,
      [btn("BACK", "Back to task"), btn("NEXT", n ? "Next lesson" : "Finish"), MENU_BTN], footer);
  }
  const head = r.ok ? (r.already ? `*${label} complete.*` : `*${label} complete.* +${r.gained} XP`) : `*${label} complete.*`;
  const warn = r.ok ? "" : "\n\n(I couldn't save your progress just now. It will be saved when you reach this card again.)";
  return withButtons(`${head}\n\n${body}${warn}${nextLine}`, n ? [btn("NEXT", "Next lesson"), MENU_BTN, btn("PROGRESS", "My progress")] : [btn("PROGRESS", "My progress"), MENU_BTN], footer);
}

async function answer(conv: Conv, learner: Learner, cardIdx: number | null, option: number) {
  const sess = conv.session!;
  const card = currentCard(sess);
  if (sess.awaiting !== "quiz" || card?.t !== "quiz" || (cardIdx !== null && cardIdx !== sess.card_index)) {
    return conv.say("That answer was for an earlier question.", [btn("CONTINUE", "Continue"), MENU_BTN]);
  }
  if (option < 0 || option >= card.options.length) return conv.say("Please pick one of the options.", [btn("REPEAT", "Show question"), MENU_BTN]);
  const fb = quizFeedback(card, option);
  await conv.save({ awaiting: "next" });
  const script = loadScript(sess.item_id!)!;
  return conv.send(withButtons(fb.body, [NEXT_BTN, MENU_BTN], footerFor({ itemId: sess.item_id!, index: sess.card_index, total: script.cards.length })));
}

async function reveal(conv: Conv, learner: Learner) {
  const sess = conv.session!;
  const card = currentCard(sess);
  if (card?.t !== "reveal") return conv.say("There's nothing to reveal right now.", [btn("CONTINUE", "Continue"), MENU_BTN]);
  await conv.save({ awaiting: "next" });
  return conv.send(withButtons(`*Answer*\n\n${card.answer}`, [NEXT_BTN, MENU_BTN]));
}

/** The learner's work for a task card → the AI reviewer (same rules as /api/review). */
async function taskReply(conv: Conv, learner: Learner, msg: Inbound) {
  const sess = conv.session!;
  const card = currentCard(sess);
  if (card?.t !== "task" || !sess.item_id) { await conv.save({ awaiting: "next" }); return conv.say("Tap Next to carry on, or Menu for options."); }
  const evidence = [...sess.evidence];
  if (msg.mediaId) evidence.push(msg.mediaId);
  if (!msg.text) {
    if (!msg.mediaId) return conv.say("Send your work as a text message, or reply SKIP.", [btn("SKIP", "Skip"), MENU_BTN]);
    await conv.save({ evidence: evidence.slice(-10) });
    return conv.say(`Got it (${evidence.length} file${evidence.length === 1 ? "" : "s"}). Now send a message with your log, test results or outputs and a short description of what you built, and I'll submit everything for review.`, [btn("SKIP", "Skip"), MENU_BTN]);
  }
  if (msg.text.length < LIMITS.minContent) {
    return conv.say("Send your evidence as one message: your log, test results or outputs, and a short description of what you built. Or reply SKIP.", [btn("SKIP", "Skip"), MENU_BTN]);
  }
  if (hasAnthropic()) await conv.send([{ type: "text", body: "Got it. Reviewing your work now; this can take up to a minute." }]);
  const r = await submitWork(learner, { itemId: sess.item_id, tier: card.tier, content: msg.text, mediaIds: evidence });
  if (!r.ok) {
    if (!r.retry) await conv.save({ awaiting: "next", evidence: [] });
    return conv.send([{ type: "buttons", body: clip(r.feedback, WA.interactiveBody), buttons: r.retry ? [btn("SKIP", "Skip"), MENU_BTN] : [NEXT_BTN, MENU_BTN] }]);
  }
  const head = r.status === "accepted" ? `*Accepted* · ${r.score}/100${r.xpGained ? ` · +${r.xpGained} XP` : ""}`
    : r.status === "revise" ? `*Not yet* · ${r.score}/100` : "*In the review queue*";
  const fixes = r.fixes.slice(0, 3).map(f => `- ${clip(f, 220)}`).join("\n");
  const tail = r.status === "revise" ? "\n\nSend an improved version while you're on this step, or tap Next to move on." : "";
  const room = WA.interactiveBody - head.length - tail.length - (fixes ? fixes.length + 12 : 0) - 4;
  const body = `${head}\n\n${clip(r.feedback, Math.max(200, room))}${fixes ? `\n\n*Fixes*\n${fixes}` : ""}${tail}`;
  await conv.save({ awaiting: r.status === "revise" ? "task" : "next", evidence: [] });
  return conv.send([{ type: "buttons", body: clip(body, WA.interactiveBody), buttons: [NEXT_BTN, MENU_BTN] }]);
}

/* ── Menus ─────────────────────────────────────────────────────────────── */
async function menu(conv: Conv, learner: Learner, link: Link) {
  const sess = conv.session!;
  const where = sess.item_id ? `${itemLabel(sess.item_id)} · ${titleOf(itemById(sess.item_id))}` : "Start from your next lesson";
  const rows: Row[] = [
    { id: "CONTINUE", title: "Continue", description: where },
    { id: "LESSONS", title: "Choose lesson", description: "Pick any lesson or project" },
    { id: "PROGRESS", title: "My progress", description: "Lessons done, XP and what's next" },
    { id: "HELP", title: "Help", description: "Commands, and how to ask Sage" },
    sess.paused ? { id: "RESUME", title: "Resume", description: "Carry on learning" } : { id: "PAUSE", title: "Pause", description: "No messages or reminders until you resume" },
    link.reminders ? { id: "REMINDERS OFF", title: "Reminders: on", description: "Tap to turn reminders off" } : { id: "REMINDERS ON", title: "Reminders: off", description: "Tap to turn reminders on" }
  ];
  return conv.send([{ type: "list", body: "What would you like to do?", button: "Menu", rows, sectionTitle: "Automancy Academy" }]);
}

async function lessonsList(conv: Conv, learner: Learner, track: number | null) {
  const p = await loadProgress(learner.id);
  const sess = conv.session!;
  const t = track ?? (sess.item_id ? itemById(sess.item_id)?.track : firstUndone(p.done)?.track) ?? 0;
  const items = COURSE.items.filter(i => i.track === t);
  if (!items.length) return tracksList(conv, learner);
  const rows: Row[] = items.slice(0, items.length <= 9 ? 9 : 10).map(i => ({
    id: `LESSON ${i.id}`, title: `${i.id} ${titleOf(i)}`,
    description: `${p.done[i.id] === true ? "✓ Done · " : ""}${canOpen(learner, i.id) ? "" : "Full course · "}${titleOf(i)}`
  }));
  if (items.length <= 9) rows.push({ id: "TRACKS", title: "Other tracks", description: "Choose a different track" });
  return conv.send([{ type: "list", body: `*Track ${t}: ${items[0].trackName}*\nChoose a lesson.`, button: "Lessons", rows, sectionTitle: `Track ${t}`, footer: "Or type LESSON 3.4 · TRACKS" }]);
}

async function tracksList(conv: Conv, learner: Learner) {
  const p = await loadProgress(learner.id);
  const tracks = [...new Set(COURSE.items.map(i => i.track))].slice(0, 10);
  const rows: Row[] = tracks.map(t => {
    const items = COURSE.items.filter(i => i.track === t);
    const done = items.filter(i => p.done[i.id] === true).length;
    return { id: `LESSONS ${t}`, title: `${t}. ${items[0].trackName}`, description: `${done}/${items.length} done${items.every(i => canOpen(learner, i.id)) ? "" : " · full course"}` };
  });
  return conv.send([{ type: "list", body: "Choose a track.", button: "Tracks", rows, sectionTitle: "Tracks" }]);
}

async function progress(conv: Conv, learner: Learner) {
  const p = await loadProgress(learner.id);
  const doneN = COURSE.items.filter(i => p.done[i.id] === true).length;
  const next = firstUndone(p.done);
  const sess = conv.session!;
  const lines = [
    `*Your progress*`,
    `${doneN} of ${COURSE.total} lessons and projects done (${percentDone(p.done as Record<string, boolean>)}%)`,
    `${p.xp.toLocaleString("en-NG")} XP`,
    next ? `Next: ${itemLabel(next.id)} · ${titleOf(next)}${canOpen(learner, next.id) ? "" : " (full course)"}` : "Every lesson and project is done.",
    sess.item_id ? `On WhatsApp you're on ${itemLabel(sess.item_id)}.` : ""
  ].filter(Boolean);
  return conv.say(lines.join("\n"), [btn("CONTINUE", "Continue"), MENU_BTN]);
}

async function help(conv: Conv, learner: Learner, question: string) {
  const sess = conv.session!;
  if (!question) {
    return conv.say([
      "*How this works*",
      "One card at a time. Tap the buttons, or type:",
      "- NEXT, BACK, REPEAT",
      "- MENU, PROGRESS, LESSONS",
      "- LESSON 3.4 or BOSS 1 to jump",
      "- HELP followed by your question to ask Sage, the course assistant (about the lesson you're on)",
      "- PAUSE / RESUME",
      "- REMINDERS ON / OFF",
      "- STOP to stop all messages (START to come back)",
      "",
      "At a task, send your work as a message (images and documents are kept as evidence) and the AI reviewer marks it."
    ].join("\n"), [btn("CONTINUE", "Continue"), MENU_BTN]);
  }
  let itemId = sess.item_id;
  if (!itemId) { const p = await loadProgress(learner.id); itemId = (firstUndone(p.done, i => canOpen(learner, i.id)) || COURSE.items[0]).id; }
  const answerText = toWhatsAppText(await askSageFor(learner, itemId, question));
  return conv.send(withButtons(clip(answerText, WA.textMax - 10), [btn("CONTINUE", "Back to lesson"), MENU_BTN]));
}
