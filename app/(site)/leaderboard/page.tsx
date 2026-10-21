import Link from "next/link";
import type { Metadata } from "next";
import "../community/community.css";
import { createClient } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/config";

export const metadata: Metadata = { title: "Leaderboard" };
export const dynamic = "force-dynamic";

type Row = { name: string; city: string | null; xp: number; week_xp: number; items_done: number };
type Me = { rank: number; xp: number; items_done: number; is_public: boolean; total: number };

export default async function Leaderboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const scope = sp.scope === "week" ? "week" : "all";
  const col = scope === "week" ? "week_xp" : "xp";
  let rows: Row[] = [];
  let me: Me | null = null;
  let signedIn = false;
  if (hasSupabase()) {
    const sb = await createClient();
    const [{ data }, { data: { user } }] = await Promise.all([
      sb.from("leaderboard").select("name, city, xp, week_xp, items_done").gt(col, 0).order(col, { ascending: false }).order("items_done", { ascending: false }).limit(50),
      sb.auth.getUser()
    ]);
    rows = (data || []) as Row[];
    if (user) {
      signedIn = true;
      const { data: m } = await sb.rpc("leaderboard_me", { scope });
      const r = Array.isArray(m) ? m[0] : m;
      if (r) me = { rank: Number(r.rank), xp: Number(r.xp), items_done: Number(r.items_done), is_public: !!r.is_public, total: Number(r.total) };
    }
  }
  const score = (r: Row) => scope === "week" ? r.week_xp : r.xp;

  return (
    <div className="wrap community stack">
      <header className="stack">
        <span className="eyebrow">Leaderboard</span>
        <h1>Who&apos;s building the most</h1>
        <p className="lede">Top 50 learners by XP. Only learners who chose a public profile appear here, by first name and city.</p>
      </header>

      <nav className="lb-tabs" aria-label="Period">
        <Link className={`chip${scope === "week" ? " on" : ""}`} href="/leaderboard?scope=week" aria-current={scope === "week" ? "page" : undefined}>This week</Link>
        <Link className={`chip${scope === "all" ? " on" : ""}`} href="/leaderboard" aria-current={scope === "all" ? "page" : undefined}>All time</Link>
      </nav>

      {me && (
        <div className="card me-card">
          <span className="eyebrow">Your standing · {scope === "week" ? "this week" : "all time"}</span>
          {me.xp > 0
            ? <p><b>#{me.rank}</b> of {Math.max(me.total, me.rank).toLocaleString()} with <b>{me.xp.toLocaleString()} XP</b> and {me.items_done} {me.items_done === 1 ? "item" : "items"} done.</p>
            : <p>No XP {scope === "week" ? "this week" : "yet"}. Finish a lesson to get on the board.</p>}
          {!me.is_public && <p className="note">Only you can see this. Your profile is private, so you aren&apos;t listed. To appear on the leaderboard, switch on your public profile in <Link href="/account">Account</Link>.</p>}
        </div>
      )}
      {!signedIn && <p className="note"><Link href="/login?next=/leaderboard">Log in</Link> to see your own rank.</p>}

      {rows.length ? (
        <div className="card scroll">
          <table className="dt lb">
            <thead><tr><th>Rank</th><th>Learner</th><th className="n">XP</th><th className="n">Items done</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={i < 3 ? `top${i + 1}` : undefined}>
                  <td className="rank">{i + 1}</td>
                  <td><b>{r.name}</b>{r.city && <span className="muted"> · {r.city}</span>}</td>
                  <td className="n">{score(r).toLocaleString()}</td>
                  <td className="n">{r.items_done}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">
          {scope === "week" ? "No public learners have earned XP this week yet. " : "The leaderboard is empty so far. "}
          The first learners to finish lessons with a public profile will show up here.
        </div>
      )}

      <section className="card stack" aria-labelledby="xp-h">
        <h2 id="xp-h" style={{ fontSize: "1.3rem" }}>How XP works</h2>
        <ul className="prose" style={{ margin: 0 }}>
          <li>Finishing a lesson earns <b>100 XP</b>, a boss project <b>300 XP</b> and the capstone <b>400 XP</b>. Quizzes, missions and labs inside lessons add more.</li>
          <li>XP is worked out by the course and saved to your account, so it&apos;s the same on every device.</li>
          <li><b>This week</b> counts XP earned in the current course week; <b>All time</b> is your total.</li>
          <li>Ties are broken by items done. Only learners with a public profile are listed; your own rank is always visible to you.</li>
        </ul>
      </section>
    </div>
  );
}
