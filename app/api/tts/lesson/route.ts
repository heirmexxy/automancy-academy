import { NextResponse } from "next/server";
import { getEntitlements, getProfile } from "@/lib/auth";
import { hasAzureSpeech, hasSupabase } from "@/lib/config";
import { itemById } from "@/lib/course";
import { lessonAudio } from "@/lib/tts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // a first, uncached lesson can take a minute or two to synthesise

const text = (msg: string, status: number) => new NextResponse(msg, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

/**
 * GET /api/tts/lesson?id=1.3[&inline=1] → redirect to the lesson's narration MP3 (Story Mode).
 * Requires Story Mode, plus the course for anything beyond Base Camp. Admins always pass.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id") || "";
  const item = itemById(id);
  if (!item) return text("Unknown lesson.", 404);

  const profile = await getProfile();
  if (!profile) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent("/audio")}`, url));
  if (profile.role !== "admin") {
    const ent = await getEntitlements(profile.id);
    if (!ent.story) return NextResponse.redirect(new URL("/audio", url));
    if (!item.free && !ent.course) return text("This lesson's audio comes with the full course. Enrol to unlock it.", 403);
  }
  if (!hasAzureSpeech() || !hasSupabase()) return text("Lesson audio isn't available yet. Please try again later.", 503);

  try {
    const r = await lessonAudio(id);
    const dest = new URL(r.url);
    if (url.searchParams.get("inline") !== "1") dest.searchParams.set("download", `automancy-${id.replace(".", "-")}.mp3`);
    return NextResponse.redirect(dest.toString(), 302);
  } catch (e) {
    console.error("[tts/lesson]", id, e instanceof Error ? e.message : e);
    return text("We couldn't prepare this lesson's audio right now. Please try again in a few minutes.", 503);
  }
}
