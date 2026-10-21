import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanProgress, STATE_MAX_BYTES, type PrevProgress, lagosWeekStart } from "@/lib/learn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

/** GET /api/progress → {done, state, xp, weekXp} for the signed-in learner. */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Sign in first." }, 401);
  const { data } = await supabase.from("progress").select("done, state, xp, week_xp, week_start").eq("user_id", user.id).maybeSingle();
  const thisWeek = data?.week_start && String(data.week_start).slice(0, 10) === lagosWeekStart();
  return json({ done: data?.done ?? {}, state: data?.state ?? {}, xp: data?.xp ?? 0, weekXp: thisWeek ? data?.week_xp ?? 0 : 0 });
}

/**
 * PUT /api/progress  body {done, state, xp, weekXp}
 * Keeps only known course ids in `done`, computes items_done, week_xp and week_start (Monday, Africa/Lagos) here,
 * clamps XP, caps `state` at 200 KB.
 * Written with the service role after the session check: learners can only read their row under RLS (migration 0008),
 * so XP can't be set past these caps by writing to the table directly.
 */
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Sign in first." }, 401);

  const raw = await request.text();
  if (raw.length > STATE_MAX_BYTES + 64 * 1024) return json({ error: "Progress is too large." }, 413);
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return json({ error: "Invalid JSON." }, 400); }

  const db = createAdminClient();
  const { data: prev } = await db.from("progress").select("xp, week_xp, week_start").eq("user_id", user.id).maybeSingle();
  const res = cleanProgress(body, prev as PrevProgress);
  if ("error" in res) return json({ error: res.error }, res.error.includes("200 KB") ? 413 : 400);

  const { error } = await db.from("progress").upsert({ user_id: user.id, ...res.row, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) { console.error("[progress] upsert failed", error.message); return json({ error: "Couldn't save progress." }, 500); }
  return json({ ok: true, items_done: res.row.items_done, xp: res.row.xp });
}
