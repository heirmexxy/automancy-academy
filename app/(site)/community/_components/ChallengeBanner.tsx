import Link from "next/link";
import { createPost } from "@/lib/actions/community";
import { ActionForm } from "./ActionForm";
import { acceptingEntries, fmtWhen, type Challenge } from "../_lib/data";

/** This week's challenge, with the entry form when it's open and the learner hasn't entered yet. */
export function ChallengeBanner({ challenge, entered, entries, full = false }: { challenge: Challenge; entered: boolean; entries: number; full?: boolean }) {
  const open = acceptingEntries(challenge);
  const brief = full || challenge.brief.length <= 420 ? challenge.brief : challenge.brief.slice(0, 400).replace(/\s+\S*$/, "") + "…";
  return (
    <section className="card bold chal" aria-labelledby={`ch-${challenge.id}`}>
      <div className="chal-main stack">
        <span className="eyebrow">{challenge.status === "judging" ? "Judging now" : "This week's challenge"}</span>
        <h2 id={`ch-${challenge.id}`}>{challenge.title}</h2>
        <p className="post-body">{brief}</p>
        {!full && <p><Link href="/community/challenges">Full brief, entries and voting</Link></p>}
      </div>
      <div className="chal-side stack">
        <p className="eyebrow">{open ? `Closes ${fmtWhen(challenge.ends_at)}` : challenge.status === "judging" ? "Entries closed · winner announced soon" : "Entries closed"}</p>
        {challenge.prize && <p><b>Prize:</b> {challenge.prize}</p>}
        <p className="note">{entries} {entries === 1 ? "entry" : "entries"} so far</p>
        {entered ? <p className="pill ok">You&apos;ve entered. Good luck!</p> : open ? (
          <ActionForm action={createPost} reset className="stack" label="Challenge entry">
            <input type="hidden" name="type" value="challenge_entry" />
            <input type="hidden" name="challengeId" value={challenge.id} />
            <input type="hidden" name="title" value={challenge.title} />
            <input type="hidden" name="room" value="general" />
            <label className="fld">Link to your workflow or video<input name="link" type="url" required maxLength={500} placeholder="https://" /></label>
            <label className="fld">Short write-up<textarea name="body" required maxLength={1500} placeholder="What you built and how you tested it (sample data only)" /></label>
            <button className="btn" type="submit">Submit entry</button>
          </ActionForm>
        ) : null}
      </div>
    </section>
  );
}
