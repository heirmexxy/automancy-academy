import { NextResponse } from "next/server";
import { getEntitlements, getProfile } from "@/lib/auth";
import { hasAnthropic, hasSupabase } from "@/lib/config";
import { itemById } from "@/lib/course";
import { askSage, chargeQuestion, DAILY_QUESTIONS, MAX_QUESTION } from "@/lib/assistant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** GET → {available, limit}: the "Ask Sage" button hides itself when this is false. */
export async function GET() {
  const profile = hasSupabase() ? await getProfile().catch(() => null) : null;
  return json({ available: hasAnthropic() && !!profile, limit: DAILY_QUESTIONS() });
}

/** POST {itemId, question, history?} → {answer, warning?, remaining}. */
export async function POST(req: Request) {
  if (!hasAnthropic() || !hasSupabase()) return json({ error: "Sage is not available right now.", unavailable: true }, 503);
  const profile = await getProfile();
  if (!profile) return json({ error: "Sign in to ask Sage." }, 401);

  let body: { itemId?: unknown; question?: unknown; history?: unknown };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const itemId = typeof body.itemId === "string" ? body.itemId : "";
  const question = typeof body.question === "string" ? body.question.trim() : "";
  const item = itemById(itemId);
  if (!item) return json({ error: "Unknown lesson." }, 400);
  if (!question) return json({ error: "Type a question first." }, 400);
  if (question.length > MAX_QUESTION) return json({ error: `Keep questions under ${MAX_QUESTION} characters.` }, 413);

  if (!item.free && profile.role === "learner") {
    const ent = await getEntitlements(profile.id);
    if (!ent.course) return json({ error: "Sage helps on Base Camp lessons for free. Enrol in the course to ask about this lesson." }, 403);
  }

  try {
    const used = await chargeQuestion(profile.id);
    if (used === null) return json({ error: `You've asked ${DAILY_QUESTIONS()} questions today, the daily limit. Try the community help board, or come back tomorrow.` }, 429);
    try {
      const r = await askSage({ itemId, question, history: body.history });
      return json({ answer: r.answer, warning: r.warning, remaining: Math.max(0, DAILY_QUESTIONS() - used) });
    } catch (e) {
      await chargeQuestion(profile.id, -1).catch(() => {});
      throw e;
    }
  } catch (e) {
    console.error("[assistant]", e instanceof Error ? e.message : e);
    return json({ error: "Sage couldn't answer just now. Please try again in a minute." }, 502);
  }
}
