import { adminSaveChallenge } from "@/lib/actions/community";
import type { Challenge } from "../../../community/_lib/data";

/** datetime-local value in WAT (UTC+1) */
const wat = (iso: string | null | undefined) => iso ? new Date(new Date(iso).getTime() + 3600e3).toISOString().slice(0, 16) : "";

function nextSunday() {
  const now = new Date(Date.now() + 3600e3); // WAT
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + ((7 - now.getUTCDay()) % 7 || 7), 23, 59) - 3600e3);
  return d.toISOString();
}

export function ChallengeForm({ c }: { c?: Challenge | null }) {
  return (
    <form action={adminSaveChallenge} className="stack">
      {c && <input type="hidden" name="challengeId" value={c.id} />}
      <input type="hidden" name="back" value={c ? `/admin/community/challenges/${c.id}` : "/admin/community/challenges"} />
      <label className="fld">Title<input name="title" required minLength={3} maxLength={140} defaultValue={c?.title || ""} placeholder="e.g. The Refill Reminder" /></label>
      <label className="fld">Brief (plain text: the client, what to build, rules, what to deliver)
        <textarea name="brief" required rows={10} maxLength={8000} defaultValue={c?.brief || ""} /></label>
      <label className="fld">Prize (optional)<input name="prize" maxLength={400} defaultValue={c?.prize || ""} placeholder="Only promise what you will actually give" /></label>
      <div className="grid3">
        <label className="fld">Opens (WAT)<input name="starts_at" type="datetime-local" required defaultValue={wat(c?.starts_at || new Date().toISOString())} /></label>
        <label className="fld">Closes (WAT)<input name="ends_at" type="datetime-local" required defaultValue={wat(c?.ends_at || nextSunday())} /></label>
        <label className="fld">Status
          <select name="status" defaultValue={c?.status || "draft"}>
            <option value="draft">Draft (only admins see it)</option>
            <option value="open">Open (entries and voting)</option>
            <option value="judging">Judging (voting only)</option>
            <option value="closed">Closed</option>
          </select>
        </label>
      </div>
      <div className="row"><button className="btn" type="submit">{c ? "Save changes" : "Create challenge"}</button></div>
    </form>
  );
}
