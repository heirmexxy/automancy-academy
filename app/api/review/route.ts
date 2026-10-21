import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEntitlements } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { hasAnthropic } from "@/lib/config";
import { itemById, FREE_IDS } from "@/lib/course";
import { getTierSpec, reviewSubmission } from "@/lib/reviewer";
import { LIMITS, isTier, lagosDay, lagosDayStartIso, normaliseLinks, publicSubmission, redactSecrets, tiersFor, type SubmissionRow } from "@/lib/reviewer-core";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // seconds (Vercel): the AI review can take up to a minute

const err = (status: number, error: string) => NextResponse.json({ error }, { status });

/** POST /api/review {itemId, tier, content, links} → {id, status, score, feedback, strengths[], fixes[], criteria[]} */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err(401, "Log in to submit work for review.");

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return err(400, "Send JSON."); }
  const itemId = String(body.itemId || "");
  const tier = body.tier;
  const item = itemById(itemId);
  if (!item) return err(400, "Unknown lesson or project.");
  if (!isTier(tier) || !tiersFor(item.kind).includes(tier) || !getTierSpec(itemId, tier)) return err(400, "That mission tier doesn't exist for this item.");
  const raw = typeof body.content === "string" ? body.content.replace(/\r\n/g, "\n").trim() : "";
  if (raw.length < LIMITS.minContent) return err(400, "Paste your evidence first: your log, test results or outputs, and a short description of what you built.");
  if (raw.length > LIMITS.maxContent) return err(400, `That's too long. Keep it under ${LIMITS.maxContent.toLocaleString()} characters: paste the key evidence and link to the rest.`);
  const links = normaliseLinks(body.links);

  if (!FREE_IDS.has(itemId)) {
    const ent = await getEntitlements(user.id);
    if (!ent.course) return err(403, "Reviews for this lesson come with the full course. Base Camp reviews are free.");
  }

  const admin = createAdminClient();
  const day = lagosDay();
  // Already accepted? No need to spend a review.
  const { data: accepted } = await admin.from("submissions").select("id").eq("user_id", user.id).eq("item_id", itemId).eq("tier", tier).eq("status", "accepted").limit(1);
  if (accepted && accepted.length) return err(409, "This mission is already accepted. Nice work.");
  // Per item and tier: 5 a day.
  const { count: todayForItem } = await admin.from("submissions").select("id", { count: "exact", head: true })
    .eq("user_id", user.id).eq("item_id", itemId).eq("tier", tier).gte("created_at", lagosDayStartIso(day));
  if ((todayForItem || 0) >= LIMITS.perItemTierPerDay) return err(429, `You've submitted this mission ${LIMITS.perItemTierPerDay} times today. Work through the fixes and try again tomorrow.`);
  // Per learner: 20 a day (atomic counter).
  const { data: allowed, error: qErr } = await admin.rpc("take_review_quota", { p_user: user.id, p_day: day, p_limit: LIMITS.perUserPerDay });
  if (qErr) return err(500, "Couldn't check your review allowance. Try again in a minute.");
  if (!allowed) return err(429, `You've used today's ${LIMITS.perUserPerDay} reviews. Your allowance resets at midnight (Lagos time).`);

  // Store the submission (as the learner, so RLS applies), with secrets already redacted.
  const red = redactSecrets(raw);
  const { data: row, error: insErr } = await supabase.from("submissions")
    .insert({ user_id: user.id, item_id: itemId, tier, content: red.text, links })
    .select("id").single();
  if (insErr || !row) return err(500, "Couldn't save your submission. Try again.");

  const settings = await getSettings();
  const queue = async (reason: string, extra: Record<string, unknown> = {}) => {
    const ai = { queued: reason, flags: red.found.length ? [`secrets redacted: ${red.found.join(", ")}`] : [], ...extra };
    await admin.from("submissions").update({ needs_human: true, ai_result: ai }).eq("id", row.id);
    return NextResponse.json({
      id: row.id, status: "pending", score: null,
      feedback: "Thanks. Your work is in the review queue and a reviewer will mark it soon. You'll see the result here.",
      strengths: [], fixes: red.found.length ? ["Remove keys, passwords and card numbers from your evidence next time: we've hidden them for you."] : [], criteria: [], needsHuman: true
    });
  };
  if (!hasAnthropic() || settings.ai_review_auto === false) return queue(!hasAnthropic() ? "no_api_key" : "auto_review_off");

  try {
    const { result, status, meta } = await reviewSubmission({ itemId, tier, content: red.text, links });
    if (red.found.length && !result.flags.some(f => f.startsWith("secrets"))) { result.flags.push(`secrets redacted: ${red.found.join(", ")}`); result.needs_human = true; }
    const finalStatus = result.needs_human && result.verdict === "accept" ? "pending" : status;
    await admin.from("submissions").update({
      status: finalStatus, score: result.score, ai_result: { ...result, meta }, needs_human: result.needs_human,
      reviewed_at: finalStatus === "pending" ? null : new Date().toISOString()
    }).eq("id", row.id);
    const out = publicSubmission({ id: row.id, item_id: itemId, tier, status: finalStatus, score: result.score, ai_result: result, needs_human: result.needs_human, reviewer_note: null, created_at: new Date().toISOString(), reviewed_at: null });
    return NextResponse.json({ id: row.id, status: finalStatus, score: result.score, feedback: finalStatus === "pending" ? `${result.feedback} A reviewer will confirm this before it counts.` : result.feedback, strengths: out.strengths, fixes: out.fixes, criteria: out.criteria, rubric: out.rubric, needsHuman: result.needs_human });
  } catch (e) {
    console.error("[review] AI review failed", e);
    return queue("ai_error", { error: e instanceof Error ? e.message.slice(0, 300) : "unknown" });
  }
}

/** GET /api/review?itemId=1.3 → the learner's submissions for that item, newest first. */
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err(401, "Log in to see your reviews.");
  const itemId = new URL(req.url).searchParams.get("itemId") || "";
  if (!itemById(itemId)) return err(400, "Unknown lesson or project.");
  const { data, error } = await supabase.from("submissions")
    .select("id, item_id, tier, status, score, content, links, ai_result, needs_human, reviewer_note, created_at, reviewed_at")
    .eq("user_id", user.id).eq("item_id", itemId).order("created_at", { ascending: false }).limit(30);
  if (error) return err(500, "Couldn't load your submissions.");
  return NextResponse.json((data as SubmissionRow[] || []).map(publicSubmission), { headers: { "cache-control": "no-store" } });
}
