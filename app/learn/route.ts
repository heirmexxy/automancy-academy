import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { SITE_URL } from "@/lib/config";
import { assembleLearnPage } from "@/lib/learn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /learn · the full-screen course, assembled for the signed-in learner (lessons they may open, their progress, their accepted reviews). */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login?next=/learn", request.url), { status: 303 });

  const [profileRes, ent, progressRes, settings, reviews] = await Promise.all([
    supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle(),
    getEntitlements(user.id),
    supabase.from("progress").select("done, state, xp").eq("user_id", user.id).maybeSingle(),
    getSettings(),
    acceptedReviews(supabase, user.id)
  ]);

  const email = (profileRes.data?.email as string | undefined) || user.email || "";
  const name = ((profileRes.data?.full_name as string | null) || "").trim() || email.split("@")[0] || "Learner";
  const p = progressRes.data as { done: Record<string, unknown> | null; state: Record<string, unknown> | null; xp: number | null } | null;

  let html: string;
  try {
    html = assembleLearnPage({
      user: { id: user.id, name, email },
      ent: { course: ent.course, member: ent.member, story: ent.story, templates: ent.templates, crmspec: ent.crmspec },
      progress: p ? { done: p.done || {}, state: p.state || {}, xp: p.xp || 0 } : null,
      reviews,
      settings,
      siteUrl: SITE_URL
    });
  } catch (e) {
    console.error("[learn] course-build missing or unreadable; run `npm run course:sync`", e);
    return new NextResponse("The course is being updated. Please try again in a minute.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  }

  return new NextResponse(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } });
}

/** Accepted submissions → missions done in the course. The `submissions` table (writer C, 0003) may not exist yet. */
async function acceptedReviews(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  try {
    const { data, error } = await supabase.from("submissions").select("item_id, tier").eq("user_id", userId).eq("status", "accepted");
    if (error || !data) return [];
    const seen = new Set<string>();
    return data.filter(r => { const k = `${r.item_id}:${r.tier}`; if (seen.has(k)) return false; seen.add(k); return true; })
      .map(r => ({ itemId: String(r.item_id), tier: String(r.tier) }));
  } catch { return []; }
}
