import Link from "next/link";
import type { Metadata } from "next";
import "../../community/community.css";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";
import { adminModerateComment, adminModeratePost, adminPostAnnouncement, adminResolveReport } from "@/lib/actions/community";
import { TRACKS, itemLabel, roomLabel } from "../../community/_lib/data";
import { TYPE_LABEL, timeAgo, type PostType } from "../../community/_lib/rules";

export const metadata: Metadata = { title: "Community · Admin" };
export const dynamic = "force-dynamic";

type P = { id: string; user_id: string; type: PostType; room: string; item_id: string | null; title: string | null; body: string; hidden: boolean; hidden_reason: string | null; pinned: boolean; created_at: string };
type R = { id: string; reporter_id: string; post_id: string | null; comment_id: string | null; reason: string; status: string; created_at: string };
type C = { id: string; post_id: string; user_id: string; body: string; hidden: boolean };

const BACK = "/admin/community";

function PostOps({ p, back }: { p: P; back: string }) {
  const op = (name: string, label: string) => (
    <form action={adminModeratePost}><input type="hidden" name="postId" value={p.id} /><input type="hidden" name="op" value={name} /><input type="hidden" name="back" value={back} />
      <button className="btn alt sm" type="submit">{label}</button></form>
  );
  return (
    <div className="row">
      {p.hidden ? op("unhide", "Unhide") : op("hide", "Hide")}
      {p.pinned ? op("unpin", "Unpin") : op("pin", "Pin")}
      <details><summary className="note">Delete</summary>{op("delete", "Delete permanently")}</details>
    </div>
  );
}

export default async function AdminCommunity({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const show = sp.show === "hidden" ? "hidden" : sp.show === "pinned" ? "pinned" : "all";
  const sb = await createClient(); // admin RLS policies apply (is_admin)
  let pq = sb.from("posts").select("id, user_id, type, room, item_id, title, body, hidden, hidden_reason, pinned, created_at").order("created_at", { ascending: false }).limit(60);
  if (show === "hidden") pq = pq.eq("hidden", true);
  if (show === "pinned") pq = pq.eq("pinned", true);
  const [{ data: reportData }, { data: postData }, { count: openChallenges }] = await Promise.all([
    sb.from("reports").select("id, reporter_id, post_id, comment_id, reason, status, created_at").eq("status", "open").order("created_at", { ascending: true }).limit(100),
    pq,
    sb.from("challenges").select("id", { count: "exact", head: true }).in("status", ["open", "judging"])
  ]);
  const reports = (reportData || []) as R[];
  const posts = (postData || []) as P[];

  // Content behind the reports
  const rPostIds = [...new Set(reports.map(r => r.post_id).filter(Boolean) as string[])];
  const rCommentIds = [...new Set(reports.map(r => r.comment_id).filter(Boolean) as string[])];
  const [{ data: rPosts }, { data: rComments }] = await Promise.all([
    rPostIds.length ? sb.from("posts").select("id, user_id, type, room, item_id, title, body, hidden, hidden_reason, pinned, created_at").in("id", rPostIds) : Promise.resolve({ data: [] as P[] }),
    rCommentIds.length ? sb.from("comments").select("id, post_id, user_id, body, hidden").in("id", rCommentIds) : Promise.resolve({ data: [] as C[] })
  ]);
  const uids = [...new Set([...posts.map(p => p.user_id), ...reports.map(r => r.reporter_id), ...((rPosts || []) as P[]).map(p => p.user_id), ...((rComments || []) as C[]).map(c => c.user_id)])];
  const { data: people } = uids.length ? await sb.from("profiles").select("id, email, full_name").in("id", uids) : { data: [] };
  const who = new Map((people || []).map(p => [p.id as string, `${p.full_name || "(no name)"} <${p.email}>`]));

  // Group reports by target
  const groups = new Map<string, R[]>();
  for (const r of reports) { const k = r.post_id ? `p:${r.post_id}` : `c:${r.comment_id}`; groups.set(k, [...(groups.get(k) || []), r]); }

  return (
    <div className="stack">
      <div>
        <p className="eyebrow">Admin</p>
        <h1>Community</h1>
        <p className="muted">Moderate posts, answer reports and post announcements. Content with 3 open reports is hidden automatically until you review it. <Link href="/admin/community/challenges">Weekly challenges</Link> ({openChallenges || 0} running).</p>
      </div>
      {sp.msg && <p className={`alert ${/^(Failed|Unknown|Invalid|Missing|Add|Links|Keep|Write)/.test(sp.msg) ? "bad" : "ok"}`} role="status">{sp.msg}</p>}

      <section className="card stack" aria-labelledby="rep-h">
        <h2 id="rep-h" style={{ fontSize: "1.3rem" }}>Reports queue ({groups.size})</h2>
        {groups.size === 0 ? <p className="empty">No open reports.</p> : [...groups.entries()].map(([k, rs]) => {
          const isPost = k.startsWith("p:");
          const target = isPost ? ((rPosts || []) as P[]).find(p => p.id === rs[0].post_id) : ((rComments || []) as C[]).find(c => c.id === rs[0].comment_id);
          const link = isPost ? `/community/post/${rs[0].post_id}` : target ? `/community/post/${(target as C).post_id}` : null;
          return (
            <div className="card" key={k}>
              <p className="eyebrow">{isPost ? "Post" : "Comment"} · {rs.length} report{rs.length === 1 ? "" : "s"}{target?.hidden ? " · currently hidden" : ""}</p>
              {target ? <>
                <p className="note">By {who.get(target.user_id) || "unknown"}{link && <> · <Link href={link}>open</Link></>}</p>
                <p className="post-body clamp">{isPost && (target as P).title ? <b>{(target as P).title}: </b> : null}{target.body}</p>
              </> : <p className="muted">Content already deleted.</p>}
              <ul className="prose" style={{ margin: 0 }}>
                {rs.map(r => <li key={r.id}><span className="note">{who.get(r.reporter_id) || "unknown"}, {timeAgo(r.created_at)}:</span> {r.reason}</li>)}
              </ul>
              <div className="row">
                <form action={adminResolveReport}><input type="hidden" name="reportId" value={rs[0].id} /><input type="hidden" name="status" value="actioned" /><input type="hidden" name="back" value={BACK} />
                  <button className="btn sm" type="submit">Hide content and close</button></form>
                <form action={adminResolveReport}><input type="hidden" name="reportId" value={rs[0].id} /><input type="hidden" name="status" value="dismissed" /><input type="hidden" name="back" value={BACK} />
                  <button className="btn alt sm" type="submit">Dismiss{target?.hidden ? " (stays hidden)" : ""}</button></form>
                {!isPost && target && (
                  <form action={adminModerateComment}><input type="hidden" name="commentId" value={target.id} /><input type="hidden" name="op" value={target.hidden ? "unhide" : "delete"} /><input type="hidden" name="back" value={BACK} />
                    <button className="btn alt sm" type="submit">{target.hidden ? "Unhide comment" : "Delete comment"}</button></form>
                )}
                {isPost && target && target.hidden && (
                  <form action={adminModeratePost}><input type="hidden" name="postId" value={target.id} /><input type="hidden" name="op" value="unhide" /><input type="hidden" name="back" value={BACK} />
                    <button className="btn alt sm" type="submit">Unhide post</button></form>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <section className="card stack" aria-labelledby="ann-h">
        <h2 id="ann-h" style={{ fontSize: "1.3rem" }}>Post an announcement</h2>
        <form action={adminPostAnnouncement} className="stack">
          <input type="hidden" name="back" value={BACK} />
          <div className="grid2">
            <label className="fld">Title<input name="title" required maxLength={140} /></label>
            <label className="fld">Room<select name="room" defaultValue="general"><option value="general">General</option>{TRACKS.map(t => <option key={t.room} value={t.room}>Track {t.room} · {t.name}</option>)}</select></label>
          </div>
          <label className="fld">Message<textarea name="body" required maxLength={4000} /></label>
          <label className="fld">Link (optional)<input name="link" type="url" placeholder="https://" /></label>
          <label className="check"><input type="checkbox" name="pinned" defaultChecked /> Pin to the top of the feed</label>
          <div className="row"><button className="btn" type="submit">Post announcement</button></div>
        </form>
      </section>

      <section className="stack" aria-labelledby="posts-h">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 id="posts-h" style={{ fontSize: "1.3rem" }}>Recent posts</h2>
          <div className="row chips">
            {(["all", "hidden", "pinned"] as const).map(s => <Link key={s} className={`chip${show === s ? " on" : ""}`} href={s === "all" ? BACK : `${BACK}?show=${s}`}>{s[0].toUpperCase() + s.slice(1)}</Link>)}
          </div>
        </div>
        {posts.length === 0 ? <p className="empty">No posts{show !== "all" ? ` (${show})` : ""} yet.</p> : (
          <div className="scroll card">
            <table className="dt">
              <thead><tr><th>Post</th><th>Author</th><th>When</th><th>Actions</th></tr></thead>
              <tbody>
                {posts.map(p => (
                  <tr key={p.id}>
                    <td style={{ maxWidth: 420 }}>
                      <span className="pill">{TYPE_LABEL[p.type]}</span> <span className="note">{roomLabel(p.room).split(" · ")[0]}{p.item_id ? ` · ${itemLabel(p.item_id)}` : ""}</span>
                      {p.pinned && <> <span className="pill warn">Pinned</span></>}{p.hidden && <> <span className="pill bad">Hidden{p.hidden_reason ? `: ${p.hidden_reason}` : ""}</span></>}
                      <p className="post-body clamp"><Link href={`/community/post/${p.id}`}>{p.title || p.body.slice(0, 80)}</Link></p>
                    </td>
                    <td className="note">{who.get(p.user_id) || "unknown"}</td>
                    <td className="note">{fmtDate(p.created_at)}</td>
                    <td><PostOps p={p} back={show === "all" ? BACK : `${BACK}?show=${show}`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
