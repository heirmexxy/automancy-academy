import Link from "next/link";
import { addComment, deleteComment, deletePost, reportContent, toggleClap } from "@/lib/actions/community";
import { ActionForm } from "./ActionForm";
import { itemLabel, roomLabel, type FeedPost, type Member } from "../_lib/data";
import { TYPE_LABEL, timeAgo } from "../_lib/rules";

export function Avatar({ m }: { m: Member }) {
  const initials = m.name === "A learner" ? "?" : m.name.slice(0, 1).toUpperCase();
  return <span className={`av${m.staff ? " staff" : ""}`} aria-hidden="true">{initials}</span>;
}

function Who({ m, at, extra }: { m: Member; at: string; extra?: string }) {
  return (
    <div className="who">
      <Avatar m={m} />
      <div>
        <b>{m.name}</b>{m.staff && <span className="pill tag-team">Team</span>}
        <br /><small className="muted">{[m.city, timeAgo(at), extra].filter(Boolean).join(" · ")}</small>
      </div>
    </div>
  );
}

function Report({ postId, commentId }: { postId?: string; commentId?: string }) {
  return (
    <details className="rep">
      <summary>Report</summary>
      <ActionForm action={reportContent} reset className="stack" label="Report">
        {postId && <input type="hidden" name="postId" value={postId} />}
        {commentId && <input type="hidden" name="commentId" value={commentId} />}
        <label className="fld">What&apos;s wrong?<input name="reason" required minLength={3} maxLength={600} placeholder="Spam, a leaked key, unkind, off-topic…" /></label>
        <button className="btn alt sm" type="submit">Send report</button>
      </ActionForm>
    </details>
  );
}

export function PostCard({ post, viewerId, full = false }: { post: FeedPost; viewerId: string; full?: boolean }) {
  const parts = post.type === "journal" && post.parts && post.parts.review ? post.parts : null;
  const comments = full ? post.comments : post.comments.slice(-3);
  const hiddenComments = post.comments.length - comments.length;
  return (
    <article className={`card post t-${post.type}${post.pinned ? " pinned" : ""}`} id={`p-${post.id}`}>
      <header className="post-h">
        <Who m={post.author} at={post.created_at} extra={post.item_id ? itemLabel(post.item_id) : undefined} />
        <div className="row post-tags">
          {post.pinned && <span className="pill warn">Pinned</span>}
          <span className={`pill${post.type === "help" ? " warn" : post.type === "win" ? " ok" : ""}`}>{TYPE_LABEL[post.type]}</span>
          <Link className="pill room" href={`/community?room=${post.room}`}>{roomLabel(post.room).split(" · ")[0]}</Link>
        </div>
      </header>
      {post.hidden && <p className="alert warn">Hidden from the community{post.hidden_reason ? `: ${post.hidden_reason}` : ""}. Only you{post.mine ? "" : " and moderators"} can see it.</p>}
      {post.title && <h3><Link href={`/community/post/${post.id}`}>{post.title}</Link></h3>}
      {parts ? (
        <div className="rrr">
          <div><h4>Review</h4><p>{parts.review}</p></div>
          <div><h4>Reflect</h4><p>{parts.reflect || "–"}</p></div>
          <div><h4>Recommend</h4><p>{parts.recommend || "–"}</p></div>
          {parts.saved && <p className="note rrr-saved">Time or money saved: <b>{parts.saved}</b></p>}
        </div>
      ) : <p className="post-body">{post.body}</p>}
      {post.link && <p className="note"><a href={post.link} target="_blank" rel="nofollow ugc noopener noreferrer">{post.link.replace(/^https:\/\//, "").slice(0, 70)}</a></p>}
      <div className="row post-acts">
        <ActionForm action={toggleClap} quiet label="Applaud">
          <input type="hidden" name="postId" value={post.id} />
          <button type="submit" className={`clap${post.clapped ? " on" : ""}`} aria-pressed={post.clapped} disabled={post.mine}
            title={post.mine ? "You can't applaud your own post" : undefined}>
            Applaud · {post.claps}
          </button>
        </ActionForm>
        <Link className="note" href={`/community/post/${post.id}`}>{post.comments.length} {post.comments.length === 1 ? "reply" : "replies"}</Link>
        <span className="post-acts-end row">
          {post.mine
            ? <ActionForm action={deletePost} label="Delete post"><input type="hidden" name="postId" value={post.id} /><button className="linkish" type="submit">Delete</button></ActionForm>
            : <Report postId={post.id} />}
        </span>
      </div>
      {(comments.length > 0 || !post.hidden) && (
        <div className="replies">
          {hiddenComments > 0 && <Link className="note" href={`/community/post/${post.id}`}>See {hiddenComments} earlier {hiddenComments === 1 ? "reply" : "replies"}</Link>}
          {comments.map(c => (
            <div className={`reply${c.hidden ? " hidden" : ""}`} key={c.id}>
              <Who m={c.author} at={c.created_at} />
              <p className="post-body">{c.body}</p>
              {c.hidden && <p className="note">Hidden by moderators.</p>}
              <div className="row">
                {c.user_id === viewerId
                  ? <ActionForm action={deleteComment} label="Delete reply"><input type="hidden" name="commentId" value={c.id} /><button className="linkish" type="submit">Delete</button></ActionForm>
                  : <Report commentId={c.id} />}
              </div>
            </div>
          ))}
          {!post.hidden && (
            <ActionForm action={addComment} reset className="reply-f" label="Reply">
              <input type="hidden" name="postId" value={post.id} />
              <textarea name="body" required maxLength={2000} rows={2} placeholder={post.type === "help" ? "Reply with a hint: what to check, what fixed it for you" : "Reply"} aria-label="Reply" />
              <button className="btn sm" type="submit">Reply</button>
            </ActionForm>
          )}
        </div>
      )}
    </article>
  );
}
