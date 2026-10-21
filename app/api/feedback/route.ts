import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ITEM_IDS } from "@/lib/course";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS = ["import", "step", "instructions", "other"];
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const SECRET = /sk_(test|live)_[A-Za-z0-9]{6,}|sk-[A-Za-z0-9-]{10,}/g;

/** POST /api/feedback  body {itemId, kind, file?, message} → {id}. A learner reports a problem with a lesson template. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Sign in first." }, 401);

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
  const itemId = String(body.itemId ?? "");
  const kind = String(body.kind ?? "");
  const file = String(body.file ?? "").slice(0, 200);
  const message = String(body.message ?? "").trim().replace(SECRET, "[removed key]").slice(0, 2000);
  if (!ITEM_IDS.includes(itemId)) return json({ error: "Unknown lesson." }, 400);
  if (!KINDS.includes(kind)) return json({ error: "Unknown kind." }, 400);
  if (!message) return json({ error: "Describe the problem." }, 400);

  // Light rate limit: 10 reports per learner per hour.
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await supabase.from("feedback").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since);
  if ((count ?? 0) >= 10) return json({ error: "Too many reports in the last hour. Try again later." }, 429);

  const { data, error } = await supabase.from("feedback").insert({ user_id: user.id, item_id: itemId, kind, file: file || null, message }).select("id").single();
  if (error || !data) { console.error("[feedback] insert failed", error?.message); return json({ error: "Couldn't save the report." }, 500); }
  return json({ id: data.id });
}
