import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import "../../../../community/community.css";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { adminModeratePost, adminPickWinner } from "@/lib/actions/community";
import { challengeEntries, getChallenge } from "../../../../community/_lib/data";
import { ChallengeForm } from "../ChallengeForm";

export const metadata: Metadata = { title: "Challenge · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminChallenge({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const sb = await createClient();
  const c = await getChallenge(sb, id);
  if (!c) notFound();
  const { entries } = await challengeEntries(sb, c.id, admin.id);
  const { data: people } = entries.length ? await sb.from("profiles").select("id, email, full_name").in("id", entries.map(e => e.user_id)) : { data: [] };
  const who = new Map((people || []).map(p => [p.id as string, `${p.full_name || "(no name)"} <${p.email}>`]));
  const back = `/admin/community/challenges/${c.id}`;
  return (
    <div className="stack">
      <div>
        <p className="eyebrow">Admin · <Link href="/admin/community/challenges">Challenges</Link></p>
        <h1>{c.title}</h1>
        <p className="muted">Status: <b>{c.status}</b>. {entries.length} {entries.length === 1 ? "entry" : "entries"}.</p>
      </div>
      {sp.msg && <p className={`alert ${sp.msg.startsWith("Failed") || sp.msg.startsWith("Check") ? "bad" : "ok"}`} role="status">{sp.msg}</p>}

      <section className="stack" aria-labelledby="ent-h">
        <h2 id="ent-h" style={{ fontSize: "1.3rem" }}>Entries and votes</h2>
        {entries.length === 0 ? <p className="empty">No entries yet.</p> : (
          <div className="scroll card">
            <table className="dt">
              <thead><tr><th>Votes</th><th>Entry</th><th>Learner</th><th>Actions</th></tr></thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id}>
                    <td><b>{e.votes}</b></td>
                    <td style={{ maxWidth: 420 }}>
                      {c.winner_post_id === e.id && <span className="pill ok">Winner</span>}{e.hidden && <span className="pill bad">Hidden</span>}
                      <p className="post-body clamp">{e.body}</p>
                      {e.link && <a className="note" href={e.link} target="_blank" rel="nofollow ugc noopener noreferrer">Open entry</a>}{" · "}<Link className="note" href={`/community/post/${e.id}`}>Post</Link>
                    </td>
                    <td className="note">{who.get(e.user_id) || e.author.name}</td>
                    <td>
                      <div className="row">
                        {c.winner_post_id !== e.id && !e.hidden && (
                          <form action={adminPickWinner}><input type="hidden" name="challengeId" value={c.id} /><input type="hidden" name="postId" value={e.id} /><input type="hidden" name="back" value={back} />
                            <button className="btn sm" type="submit">Pick as winner</button></form>
                        )}
                        <form action={adminModeratePost}><input type="hidden" name="postId" value={e.id} /><input type="hidden" name="op" value={e.hidden ? "unhide" : "hide"} /><input type="hidden" name="back" value={back} />
                          <button className="btn alt sm" type="submit">{e.hidden ? "Unhide" : "Hide"}</button></form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="note">Picking a winner sets the challenge to Closed and shows the winner on the challenges page. Any prize (XP, membership) is given manually; nothing is awarded automatically.</p>
      </section>

      <section className="card stack">
        <h2 style={{ fontSize: "1.3rem" }}>Edit challenge</h2>
        <ChallengeForm c={c} />
      </section>
    </div>
  );
}
