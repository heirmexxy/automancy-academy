import { prepareVideos } from "@/lib/whatsapp/media";
import { loadMedia } from "@/lib/whatsapp/lessons";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabase } from "@/lib/config";
import { FREE_IDS, itemById } from "@/lib/course";
import { canSend, reminderTemplate, sendTemplate } from "@/lib/whatsapp/api";
import { clip, courseAccessFrom, decodeEntities, itemLabel, reminderDue } from "@/lib/whatsapp/core";
import { firstUndone } from "@/lib/whatsapp/lessons";

/**
 * Daily WhatsApp reminders (Vercel Cron, see vercel.json; Vercel sends `Authorization: Bearer ${CRON_SECRET}`).
 * Sends the approved utility template WHATSAPP_TEMPLATE_REMINDER (default "lesson_reminder", language en, one body
 * variable: the next lesson) to linked, opted-in learners with reminders on who've been inactive ≥ 2 days, at most
 * one per 3 days, never after STOP or while paused, and only for a lesson they can open. Max 500 per run.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_PER_RUN = 500;
const CHUNK = 200;

function authorised(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const a = Buffer.from(req.headers.get("authorization") || "");
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

type LinkRow = { user_id: string; phone_e164: string; linked_at: string };
type SessRow = { phone: string; user_id: string | null; item_id: string | null; paused: boolean; last_inbound_at: string | null; last_reminder_at: string | null };
type ProgRow = { user_id: string; done: Record<string, unknown> | null; updated_at: string | null };
type EnrRow = { user_id: string; product: string; status: string; expires_at: string | null };

async function inChunks<T>(ids: string[], fetch: (part: string[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) out.push(...(await fetch(ids.slice(i, i + CHUNK))));
  return out;
}

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "CRON_SECRET is not set." }, { status: 503 });
  if (!authorised(req)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!canSend() || !hasSupabase()) return NextResponse.json({ error: "WhatsApp is not set up yet." }, { status: 503 });

  const db = createAdminClient();
  const { data: links, error } = await db.from("wa_links").select("user_id, phone_e164, linked_at")
    .eq("opted_in", true).eq("reminders", true).is("stopped_at", null).limit(20000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = (links || []) as LinkRow[];
  const users = rows.map(r => r.user_id), phones = rows.map(r => r.phone_e164);

  const [sessions, progress, enrollments] = await Promise.all([
    inChunks<SessRow>(phones, async p => ((await db.from("wa_sessions").select("phone, user_id, item_id, paused, last_inbound_at, last_reminder_at").in("phone", p)).data || []) as SessRow[]),
    inChunks<ProgRow>(users, async u => ((await db.from("progress").select("user_id, done, updated_at").in("user_id", u)).data || []) as ProgRow[]),
    inChunks<EnrRow>(users, async u => ((await db.from("enrollments").select("user_id, product, status, expires_at").in("user_id", u).eq("status", "active")).data || []) as EnrRow[])
  ]);
  const sessBy = new Map(sessions.map(x => [x.phone, x]));
  const progBy = new Map(progress.map(x => [x.user_id, x]));
  const enrBy = new Map<string, EnrRow[]>();
  for (const e of enrollments) enrBy.set(e.user_id, [...(enrBy.get(e.user_id) || []), e]);

  const now = Date.now();
  const due: { link: LinkRow; title: string; itemId: string }[] = [];
  for (const link of rows) {
    const sess = sessBy.get(link.phone_e164);
    if (sess?.paused) continue;
    const prog = progBy.get(link.user_id);
    const lastActive = [sess?.last_inbound_at, prog?.updated_at].filter(Boolean).sort().pop() || null;
    if (!reminderDue({ lastActive, lastReminder: sess?.last_reminder_at || null, linkedAt: link.linked_at }, now)) continue;
    const done = (prog?.done || {}) as Record<string, unknown>;
    const course = courseAccessFrom(enrBy.get(link.user_id) || [], now);
    const open = (id: string) => course || FREE_IDS.has(id);
    const current = sess?.user_id === link.user_id && sess.item_id && done[sess.item_id] !== true && open(sess.item_id) ? itemById(sess.item_id) : null;
    const next = current || firstUndone(done, i => open(i.id));
    if (!next) continue; // finished, or only paid lessons left (a reminder would be promotional)
    due.push({ link, itemId: next.id, title: clip(`${itemLabel(next.id)}: ${decodeEntities(next.title)}`, 200) });
    if (due.length >= MAX_PER_RUN) break;
  }

  const template = reminderTemplate();
  let sent = 0, failed = 0;
  for (let i = 0; i < due.length; i += 10) {
    await Promise.all(due.slice(i, i + 10).map(async d => {
      const res = await sendTemplate(d.link.phone_e164, template, "en", [{ type: "body", parameters: [{ type: "text", text: d.title }] }]);
      const at = new Date().toISOString();
      await db.from("wa_messages").insert({
        direction: "out", phone: d.link.phone_e164, user_id: d.link.user_id, wa_message_id: res.ok && res.id !== "ok" ? res.id : null,
        kind: `template:${template}`.slice(0, 60), body_excerpt: clip(d.title, 160), item_id: d.itemId,
        status: res.ok ? "sent" : "failed", error: res.ok ? null : res.error, cost_category: "utility"
      });
      if (res.ok) sent++; else failed++;
      // A failed send also waits 3 days (a blocked or invalid number shouldn't be retried every morning).
      const patch = res.ok ? { last_reminder_at: at, last_outbound_at: at } : { last_reminder_at: at };
      if (sessBy.has(d.link.phone_e164)) await db.from("wa_sessions").update(patch).eq("phone", d.link.phone_e164);
      else await db.from("wa_sessions").upsert({ phone: d.link.phone_e164, user_id: d.link.user_id, ...patch, updated_at: at }, { onConflict: "phone" });
    }));
  }
  // Keep lesson videos ready: upload new or soon-to-expire ones to WhatsApp's media store (a few per run).
  let videos: Awaited<ReturnType<typeof prepareVideos>> | { error: string } | null = null;
  try { videos = await prepareVideos(loadMedia(), 15); } catch (e) { videos = { error: e instanceof Error ? e.message : "failed" }; }
  return NextResponse.json({ ok: true, candidates: rows.length, due: due.length, sent, failed, videos });
}
