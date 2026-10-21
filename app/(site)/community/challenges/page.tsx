import Link from "next/link";
import type { Metadata } from "next";
import "../community.css";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { castVote } from "@/lib/actions/community";
import { ActionForm } from "../_components/ActionForm";
import { Avatar } from "../_components/PostCard";
import { ChallengeBanner } from "../_components/ChallengeBanner";
import { challengeEntries, currentChallenge, fmtWhen, memberNames, pastChallenges } from "../_lib/data";
import { fmtDate } from "@/lib/format";

export const metadata: Metadata = { title: "Weekly challenges" };
export const dynamic = "force-dynamic";

export default async function Challenges() {
  const user = await requireUser("/community/challenges");
  const sb = await createClient();
  const [challenge, past] = await Promise.all([currentChallenge(sb), pastChallenges(sb)]);
  const { entries, myVote } = challenge ? await challengeEntries(sb, challenge.id, user.id) : { entries: [], myVote: null };
  const canVote = !!challenge && (challenge.status === "open" || challenge.status === "judging");

  // Winners of past challenges
  const winnerIds = past.map(c => c.winner_post_id).filter(Boolean) as string[];
  const { data: winPosts } = winnerIds.length ? await sb.from("posts").select("id, user_id, body, link").in("id", winnerIds) : { data: [] };
  const winNames = await memberNames(sb, (winPosts || []).map(p => p.user_id as string));

  return (
    <div className="wrap community stack" style={{ paddingBlock: 24 }}>
      <header className="stack">
        <span className="eyebrow">Community</span>
        <h1>Weekly challenges</h1>
        <p className="lede">A short brief every week. Build it with any tool, submit a link and a write-up, and vote for the entry you&apos;d hire. The team picks the winner.</p>
        <p className="note"><Link href="/community">← Back to the community</Link></p>
      </header>

      {challenge ? <>
        <ChallengeBanner challenge={challenge} entered={entries.some(e => e.mine)} entries={entries.length} full />
        <section className="stack" aria-labelledby="entries-h">
          <h2 id="entries-h">Entries</h2>
          <p className="note">{canVote ? (myVote ? "You've voted. One vote per learner per challenge." : "One vote per learner. You can't vote for your own entry.") : "Voting has closed."}</p>
          {entries.length ? (
            <div className="scroll">
              <table className="dt entries">
                <thead><tr><th>#</th><th>Entry</th><th>Votes</th><th><span className="sr">Vote</span></th></tr></thead>
                <tbody>
                  {entries.map((e, i) => (
                    <tr key={e.id} className={e.mine ? "you" : undefined}>
                      <td>{i + 1}</td>
                      <td>
                        <div className="who"><Avatar m={e.author} /><div><b>{e.author.name}</b>{e.mine && " (you)"}{e.author.city && <small className="muted"> · {e.author.city}</small>}</div></div>
                        <p className="post-body clamp">{e.body}</p>
                        {e.link && <a className="note" href={e.link} target="_blank" rel="nofollow ugc noopener noreferrer">Open the entry</a>}
                        {" · "}<Link className="note" href={`/community/post/${e.id}`}>Discuss</Link>
                      </td>
                      <td><b>{e.votes}</b></td>
                      <td>
                        {myVote === e.id ? <span className="pill ok">Your vote</span>
                          : canVote && !myVote && !e.mine ? (
                            <ActionForm action={castVote} label="Vote">
                              <input type="hidden" name="challengeId" value={challenge.id} />
                              <input type="hidden" name="postId" value={e.id} />
                              <button className="btn alt sm" type="submit">Vote</button>
                            </ActionForm>
                          ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="empty">No entries yet. {challenge.status === "open" ? "Yours could be the first." : ""}</div>}
        </section>
      </> : (
        <div className="empty">No challenge is running right now. New challenges are announced in the community; check back soon.</div>
      )}

      <section className="stack" aria-labelledby="past-h">
        <h2 id="past-h">Past challenges</h2>
        {past.length ? (
          <div className="grid3">
            {past.map(c => {
              const wp = (winPosts || []).find(p => p.id === c.winner_post_id);
              const wn = wp ? winNames.get(wp.user_id as string) : null;
              return (
                <div className="card" key={c.id}>
                  <span className="eyebrow">Closed {fmtDate(c.ends_at)}</span>
                  <h3>{c.title}</h3>
                  <p>{wp ? <><b>Winner:</b> {wn?.name || "A learner"}{wn?.city ? `, ${wn.city}` : ""}</> : <span className="muted">No winner announced</span>}</p>
                  {wp && <Link className="note" href={`/community/post/${wp.id}`}>See the winning entry</Link>}
                </div>
              );
            })}
          </div>
        ) : <div className="empty">Finished challenges and their winners will appear here.</div>}
      </section>
      {challenge && <p className="note">Times are West Africa Time. This challenge closed or closes {fmtWhen(challenge.ends_at)}.</p>}
    </div>
  );
}
