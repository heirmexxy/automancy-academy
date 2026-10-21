import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Contract (D): GET /api/community/leaderboard?scope=week|all → [{name, city, xp, items}]
 * Public-profile learners only (first name and city; never emails). Top 50. For scope=week, xp is this week's XP.
 */
export async function GET(req: NextRequest) {
  const scope = req.nextUrl.searchParams.get("scope") === "week" ? "week" : "all";
  const col = scope === "week" ? "week_xp" : "xp";
  const sb = await createClient();
  const { data, error } = await sb.from("leaderboard").select("name, city, xp, week_xp, items_done").gt(col, 0).order(col, { ascending: false }).order("items_done", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: "Leaderboard unavailable" }, { status: 503 });
  const rows = (data || []).map(r => ({ name: r.name as string, city: (r.city as string) || null, xp: Number(scope === "week" ? r.week_xp : r.xp) || 0, items: Number(r.items_done) || 0 }));
  return NextResponse.json(rows, { headers: { "Cache-Control": "private, max-age=60" } });
}
