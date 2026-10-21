import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { hasAzureSpeech, hasSupabase } from "@/lib/config";
import { cachedUrl, chargeTts, clampRate, isVoiceKey, speakable, synthesize, ttsHash } from "@/lib/tts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_TEXT = 1200;
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** GET → {ready}: lets the course's voice hook decide whether to use natural voices without spending anything. */
export async function GET() {
  const ready = hasAzureSpeech() && hasSupabase() && !!(await getUser().catch(() => null));
  return json({ ready });
}

/** POST {text ≤ 1200 chars, voice: "male"|"female", rate?} → {url}. 503 {fallback:true} means "use browser voices". */
export async function POST(req: Request) {
  if (!hasAzureSpeech() || !hasSupabase()) return json({ error: "Natural voices are not set up yet.", fallback: true }, 503);
  const user = await getUser();
  if (!user) return json({ error: "Sign in to use natural voices.", fallback: true }, 401);

  let body: { text?: unknown; voice?: unknown; rate?: unknown };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  if (typeof body.text !== "string" || !body.text.trim()) return json({ error: "text is required" }, 400);
  if (body.text.length > MAX_TEXT) return json({ error: `text must be at most ${MAX_TEXT} characters` }, 413);
  if (!isVoiceKey(body.voice)) return json({ error: "voice must be male or female" }, 400);
  const voice = body.voice;
  const rate = clampRate(body.rate ?? 1);
  const text = speakable(body.text);
  if (!text) return json({ error: "Nothing to read" }, 400);

  try {
    // Cached clips are free: they don't count towards the daily budget.
    const hit = await cachedUrl(ttsHash(voice, rate, text));
    if (hit) return json({ url: hit, cached: true });

    if (!(await chargeTts(user.id, text.length))) {
      return json({ error: "You've reached today's natural-voice limit. Browser voices still work, and the limit resets tomorrow.", fallback: true }, 429);
    }
    try {
      const r = await synthesize(text, voice, rate, { kind: "clip" });
      return json({ url: r.url, cached: r.cached });
    } catch (e) {
      await chargeTts(user.id, -text.length).catch(() => {});
      throw e;
    }
  } catch (e) {
    console.error("[tts]", e instanceof Error ? e.message : e);
    return json({ error: "Natural voice is unavailable right now.", fallback: true }, 502);
  }
}
