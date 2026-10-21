import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fmtWhen, type Challenge } from "../../../community/_lib/data";
import { ChallengeForm } from "./ChallengeForm";

export const metadata: Metadata = { title: "Challenges · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminChallenges({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const sb = await createClient();
  const { data } = await sb.from("challenges").select("id, title, brief, prize, starts_at, ends_at, status, winner_post_id, created_at").order("starts_at", { ascending: false }).limit(100);
  const list = (data || []) as Challenge[];
  const { data: entryRows } = list.length ? await sb.from("posts").select("challenge_id").eq("type", "challenge_entry").in("challenge_id", list.map(c => c.id)) : { data: [] };
  const count = (id: string) => (entryRows || []).filter(r => r.challenge_id === id).length;
  return (
    <div className="stack">
      <div>
        <p className="eyebrow">Admin · <Link href="/admin/community">Community</Link></p>
        <h1>Weekly challenges</h1>
        <p className="muted">Learners see the open challenge closing soonest on the community page. Entries are accepted while a challenge is Open and inside its dates; votes while Open or Judging. Picking a winner closes it.</p>
      </div>
      {sp.msg && <p className={`alert ${sp.msg.startsWith("Failed") ? "bad" : "ok"}`} role="status">{sp.msg}</p>}
      {list.length === 0 ? <p className="empty">No challenges yet. Create the first one below.</p> : (
        <div className="scroll card">
          <table className="dt">
            <thead><tr><th>Challenge</th><th>Status</th><th>Window</th><th>Entries</th></tr></thead>
            <tbody>
              {list.map(c => (
                <tr key={c.id}>
                  <td><Link href={`/admin/community/challenges/${c.id}`}>{c.title}</Link>{c.winner_post_id && <> <span className="pill ok">Winner picked</span></>}</td>
                  <td><span className={`pill${c.status === "open" ? " ok" : c.status === "judging" ? " warn" : ""}`}>{c.status}</span></td>
                  <td className="note">{fmtWhen(c.starts_at)} → {fmtWhen(c.ends_at)}</td>
                  <td>{count(c.id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <section className="card stack">
        <h2 style={{ fontSize: "1.3rem" }}>New challenge</h2>
        <ChallengeForm />
      </section>
    </div>
  );
}
