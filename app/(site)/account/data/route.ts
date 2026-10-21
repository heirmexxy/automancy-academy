import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * "Download my data": a JSON file of the signed-in learner's own rows, read with their session (RLS applies, so
 * only rows they may see are returned). Tables owned by other writers may not exist yet: errors are skipped.
 * Add new user-owned tables here as features ship.
 */
const SOURCES: { table: string; column: string }[] = [
  { table: "profiles", column: "id" },
  { table: "enrollments", column: "user_id" },
  { table: "progress", column: "user_id" },
  { table: "payments", column: "user_id" },
  { table: "refund_requests", column: "user_id" },
  { table: "referral_earnings", column: "referrer_id" },
  { table: "payouts", column: "user_id" },
  { table: "payout_accounts", column: "user_id" },
  { table: "submissions", column: "user_id" },
  { table: "certificates", column: "user_id" },
  { table: "posts", column: "user_id" },
  { table: "comments", column: "user_id" },
  { table: "claps", column: "user_id" },
  { table: "votes", column: "user_id" },
  { table: "reports", column: "reporter_id" },
  { table: "hire_profiles", column: "user_id" },
  { table: "review_usage", column: "user_id" },
  { table: "assistant_usage", column: "user_id" },
  { table: "tts_usage", column: "user_id" },
  { table: "course_enrollments", column: "user_id" },
  { table: "creators", column: "user_id" }
];

export async function GET() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  const out: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    account: { id: user.id, email: user.email, created_at: user.created_at, last_sign_in_at: user.last_sign_in_at }
  };
  const results = await Promise.all(SOURCES.map(async s => {
    try {
      const { data, error } = await db.from(s.table).select("*").eq(s.column, user.id).limit(5000);
      return error ? null : [s.table, data ?? []] as const;
    } catch { return null; }
  }));
  for (const r of results) if (r) out[r[0]] = r[1];

  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="automancy-my-data-${day}.json"`,
      "Cache-Control": "no-store"
    }
  });
}
