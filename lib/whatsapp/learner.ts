import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/settings";
import { hasAnthropic } from "@/lib/config";
import { itemById, FREE_IDS } from "@/lib/course";
import { cleanProgress, type PrevProgress } from "@/lib/learn";
import { getTierSpec, reviewSubmission } from "@/lib/reviewer";
import { LIMITS, TIER_LABEL, isTier, lagosDay, lagosDayStartIso, normaliseLinks, redactSecrets, tiersFor } from "@/lib/reviewer-core";
import { askSage, chargeQuestion, DAILY_QUESTIONS, MAX_QUESTION } from "@/lib/assistant";
import { MISSION_XP, courseAccessFrom, itemXp, lagosDate, projectTier } from "@/lib/whatsapp/core";

/**
 * Learner-side work for the WhatsApp bot. The webhook has no browser session, so these run with the service role
 * after the bot has matched the sender's number to a linked learner. The rules are the web app's:
 * entitlements as lib/auth.ts getEntitlements, progress through lib/learn.ts cleanProgress (as PUT /api/progress),
 * reviews with the same checks, limits and storage as POST /api/review, Sage with the same limits as /api/assistant.
 */
type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);

export type Learner = { id: string; name: string; email: string; role: string; course: boolean };

/** Profile + course access (the getEntitlements rule, read with the service role). */
export async function loadLearner(userId: string): Promise<Learner | null> {
  const db = createAdminClient();
  const [{ data: p }, { data: ens }] = await Promise.all([
    db.from("profiles").select("id, email, full_name, role").eq("id", userId).maybeSingle(),
    db.from("enrollments").select("product, status, expires_at").eq("user_id", userId).eq("status", "active")
  ]);
  if (!p) return null;
  return {
    id: p.id as string, email: (p.email as string) || "", role: (p.role as string) || "learner",
    name: String(p.full_name || "").trim().split(/\s+/)[0] || "",
    course: courseAccessFrom((ens || []) as { product: string; status: string; expires_at: string | null }[])
  };
}
/** May this learner open the item? Base Camp is free; staff can open everything (as in /api/assistant). */
export const canOpen = (l: Pick<Learner, "course" | "role">, itemId: string) => FREE_IDS.has(itemId) || l.course || l.role === "admin" || l.role === "reviewer";

export type ProgressRow = { done: Record<string, unknown>; state: Json; xp: number; week_xp: number | null; week_start: string | null };
export async function loadProgress(userId: string): Promise<ProgressRow> {
  const { data } = await createAdminClient().from("progress").select("done, state, xp, week_xp, week_start").eq("user_id", userId).maybeSingle();
  return {
    done: isObj(data?.done) ? (data!.done as Json) : {}, state: isObj(data?.state) ? (data!.state as Json) : {},
    xp: Number(data?.xp || 0), week_xp: (data?.week_xp as number) ?? null, week_start: (data?.week_start as string) ?? null
  };
}

/**
 * Adds XP (and optionally marks an item done) in the same shape the course saves: done map, state.days (streak) and
 * state.events (activity feed and the course's "XP this week"), then validated by cleanProgress exactly like PUT /api/progress.
 */
async function addProgress(userId: string, o: { markDone?: string; gain: number; text: string }): Promise<{ ok: boolean; already?: boolean; xp?: number; error?: string }> {
  const db = createAdminClient();
  const prev = await loadProgress(userId);
  const done: Json = { ...prev.done };
  if (o.markDone) {
    if (done[o.markDone] === true) return { ok: true, already: true, xp: prev.xp };
    done[o.markDone] = true;
  }
  const state: Json = { ...prev.state };
  const today = lagosDate();
  const days = Array.isArray(state.days) ? (state.days as unknown[]).filter(d => typeof d === "string") as string[] : [];
  if (!days.includes(today)) days.push(today);
  state.days = days;
  if (o.gain > 0) {
    const events = Array.isArray(state.events) ? [...(state.events as unknown[])] : [];
    events.unshift({ t: Date.now(), xp: o.gain, text: o.text });
    state.events = events.slice(0, 300);
  }
  const prevRow: PrevProgress = { xp: prev.xp, week_xp: prev.week_xp, week_start: prev.week_start };
  const res = cleanProgress({ done, state, xp: Math.max(0, prev.xp) + o.gain, weekXp: o.gain }, prevRow);
  if ("error" in res) return { ok: false, error: res.error };
  const { error } = await db.from("progress").upsert({ user_id: userId, ...res.row, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) { console.error("[whatsapp] progress upsert failed", error.message); return { ok: false, error: "Couldn't save progress." }; }
  return { ok: true, xp: res.row.xp };
}

export type DoneResult =
  | { ok: true; already: boolean; xp: number; gained: number }
  | { ok: false; reason: "needs_review" | "error"; error?: string };

/** Marks an item done (lesson 100 XP, boss 300, capstone 400). Bosses and the capstone need an accepted project submission. */
export async function markItemDone(userId: string, itemId: string): Promise<DoneResult> {
  const item = itemById(itemId);
  if (!item) return { ok: false, reason: "error", error: "Unknown item" };
  if (item.kind === "boss" || item.kind === "capstone") {
    const { data } = await createAdminClient().from("submissions").select("id").eq("user_id", userId).eq("item_id", itemId)
      .eq("tier", projectTier(itemId)).eq("status", "accepted").limit(1);
    if (!data || !data.length) return { ok: false, reason: "needs_review" };
  }
  const gain = itemXp(itemId);
  const label = item.kind === "boss" ? `Boss ${itemId.slice(1)}` : `Lesson ${itemId}`;
  const r = await addProgress(userId, { markDone: itemId, gain, text: `${label} complete` });
  if (!r.ok) return { ok: false, reason: "error", error: r.error };
  return { ok: true, already: !!r.already, xp: r.xp || 0, gained: r.already ? 0 : gain };
}

/* ── Reviews (same checks, limits and storage as POST /api/review) ─────── */
export type ReviewReply = {
  ok: boolean; status?: "accepted" | "revise" | "pending"; score?: number | null; feedback: string;
  fixes: string[]; strengths: string[]; xpGained?: number; retry?: boolean;
};

export async function submitWork(learner: Learner, input: { itemId: string; tier: string; content: string; mediaIds: string[] }): Promise<ReviewReply> {
  const fail = (feedback: string, retry = true): ReviewReply => ({ ok: false, feedback, fixes: [], strengths: [], retry });
  const { itemId, tier } = input;
  const item = itemById(itemId);
  if (!item) return fail("Unknown lesson or project.", false);
  if (!isTier(tier) || !tiersFor(item.kind).includes(tier) || !getTierSpec(itemId, tier)) return fail("This mission can't be reviewed here. Submit it in the app instead.", false);
  const raw = input.content.replace(/\r\n/g, "\n").trim();
  if (raw.length < LIMITS.minContent) return fail("Send your evidence as a message: your log, test results or outputs, and a short description of what you built. (Or reply SKIP.)");
  if (raw.length > LIMITS.maxContent) return fail(`That's too long. Keep it under ${LIMITS.maxContent.toLocaleString()} characters: paste the key evidence and link to the rest.`);
  const links = normaliseLinks(raw.match(/https?:\/\/[^\s<>"')]+/g) || []);

  if (!FREE_IDS.has(itemId) && !learner.course) return fail("Reviews for this lesson come with the full course. Base Camp reviews are free.", false);

  const admin = createAdminClient();
  const day = lagosDay();
  const { data: accepted } = await admin.from("submissions").select("id").eq("user_id", learner.id).eq("item_id", itemId).eq("tier", tier).eq("status", "accepted").limit(1);
  if (accepted && accepted.length) return fail("This mission is already accepted. Nice work.", false);
  const { count: todayForItem } = await admin.from("submissions").select("id", { count: "exact", head: true })
    .eq("user_id", learner.id).eq("item_id", itemId).eq("tier", tier).gte("created_at", lagosDayStartIso(day));
  if ((todayForItem || 0) >= LIMITS.perItemTierPerDay) return fail(`You've submitted this mission ${LIMITS.perItemTierPerDay} times today. Work through the fixes and try again tomorrow.`, false);
  const { data: allowed, error: qErr } = await admin.rpc("take_review_quota", { p_user: learner.id, p_day: day, p_limit: LIMITS.perUserPerDay });
  if (qErr) return fail("Couldn't check your review allowance. Try again in a minute.");
  if (!allowed) return fail(`You've used today's ${LIMITS.perUserPerDay} reviews. Your allowance resets at midnight (Lagos time).`, false);

  // Images and documents sent on WhatsApp are kept as Meta media ids for a person to spot-check (not downloaded).
  const media = input.mediaIds.slice(0, 10);
  const note = media.length ? `\n\n[Sent on WhatsApp with ${media.length} attachment${media.length === 1 ? "" : "s"} (images or documents) kept for a reviewer to spot-check.]` : "";
  const red = redactSecrets(raw.slice(0, LIMITS.maxContent - note.length) + note);
  const wa = { source: "whatsapp", media };
  const { data: row, error: insErr } = await admin.from("submissions")
    .insert({ user_id: learner.id, item_id: itemId, tier, content: red.text, links, ai_result: { whatsapp: wa } })
    .select("id").single();
  if (insErr || !row) return fail("Couldn't save your submission. Try again.");

  const settings = await getSettings();
  const queue = async (reason: string, extra: Json = {}): Promise<ReviewReply> => {
    const ai = { queued: reason, flags: red.found.length ? [`secrets redacted: ${red.found.join(", ")}`] : [], whatsapp: wa, ...extra };
    await admin.from("submissions").update({ needs_human: true, ai_result: ai }).eq("id", row.id);
    return {
      ok: true, status: "pending", score: null,
      feedback: "Thanks. Your work is in the review queue and a reviewer will mark it soon. You'll see the result in the app.",
      strengths: [], fixes: red.found.length ? ["Remove keys, passwords and card numbers from your evidence next time: we've hidden them for you."] : []
    };
  };
  if (!hasAnthropic() || settings.ai_review_auto === false) return queue(!hasAnthropic() ? "no_api_key" : "auto_review_off");

  try {
    const { result, status, meta } = await reviewSubmission({ itemId, tier, content: red.text, links });
    if (red.found.length && !result.flags.some(f => f.startsWith("secrets"))) { result.flags.push(`secrets redacted: ${red.found.join(", ")}`); result.needs_human = true; }
    if (media.length && !result.flags.some(f => f.startsWith("whatsapp"))) result.flags.push(`whatsapp attachments: ${media.length}`);
    const finalStatus = result.needs_human && result.verdict === "accept" ? "pending" : status;
    await admin.from("submissions").update({
      status: finalStatus, score: result.score, ai_result: { ...result, meta, whatsapp: wa }, needs_human: result.needs_human,
      reviewed_at: finalStatus === "pending" ? null : new Date().toISOString()
    }).eq("id", row.id);
    let xpGained = 0;
    if (finalStatus === "accepted" && MISSION_XP[tier]) {
      const r = await addProgress(learner.id, { gain: MISSION_XP[tier], text: `${TIER_LABEL[tier]} mission done on ${itemId}` });
      if (r.ok) xpGained = MISSION_XP[tier];
    }
    return {
      ok: true, status: finalStatus, score: result.score, xpGained,
      feedback: finalStatus === "pending" ? `${result.feedback} A reviewer will confirm this before it counts.` : result.feedback,
      strengths: result.strengths, fixes: result.fixes
    };
  } catch (e) {
    console.error("[whatsapp] AI review failed", e);
    return queue("ai_error", { error: e instanceof Error ? e.message.slice(0, 300) : "unknown" });
  }
}

/* ── Sage (same access rule and daily limit as /api/assistant) ─────────── */
export async function askSageFor(learner: Learner, itemId: string, question: string): Promise<string> {
  if (!hasAnthropic()) return "Sage isn't available right now. Try the community help board in the app.";
  const item = itemById(itemId);
  if (!item) return "Open a lesson first (reply LESSON 0.1), then ask your question.";
  if (question.length > MAX_QUESTION) return `Keep questions under ${MAX_QUESTION} characters.`;
  if (!item.free && learner.role === "learner" && !learner.course) return "Sage helps on Base Camp lessons for free. Enrol in the course to ask about this lesson.";
  try {
    const used = await chargeQuestion(learner.id);
    if (used === null) return `You've asked ${DAILY_QUESTIONS()} questions today, the daily limit. Try the community help board, or come back tomorrow.`;
    try {
      const r = await askSage({ itemId, question });
      return (r.warning ? r.warning + "\n\n" : "") + r.answer;
    } catch (e) {
      await chargeQuestion(learner.id, -1).catch(() => {});
      throw e;
    }
  } catch (e) {
    console.error("[whatsapp] Sage", e instanceof Error ? e.message : e);
    return "Sage couldn't answer just now. Please try again in a minute.";
  }
}
