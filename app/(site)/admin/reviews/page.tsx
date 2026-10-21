import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { fmtDate } from "@/lib/format";
import { hasAnthropic } from "@/lib/config";
import { getSettings } from "@/lib/settings";
import { TIER_LABEL, type Tier } from "@/lib/reviewer-core";

export const metadata: Metadata = { title: "AI reviews · Admin" };
export const dynamic = "force-dynamic";

type Row = { id: string; user_id: string; item_id: string; tier: string; status: string; score: number | null; needs_human: boolean; created_at: string; reviewed_by: string | null; ai_result: { human_reason?: string; flags?: string[]; queued?: string } | null };
const PILL: Record<string, string> = { accepted: "ok", revise: "warn", rejected: "bad", pending: "" };

export default async function AdminReviews({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const view = sp.view || "flagged"; // flagged | all
  const status = sp.status || "";
  const item = (sp.item || "").trim();
  const tier = sp.tier || "";
  const email = (sp.email || "").trim().toLowerCase();
  const db = createAdminClient();

  let userFilter: string[] | null = null;
  if (email) {
    const { data: ps } = await db.from("profiles").select("id").ilike("email", `%${email.replace(/[%_]/g, "")}%`).limit(50);
    userFilter = (ps || []).map(p => p.id as string);
  }
  let query = db.from("submissions")
    .select("id, user_id, item_id, tier, status, score, needs_human, created_at, reviewed_by, ai_result")
    .order("needs_human", { ascending: false }).order("created_at", { ascending: false }).limit(150);
  if (view === "flagged") query = query.eq("needs_human", true);
  if (status) query = query.eq("status", status);
  if (item) query = query.eq("item_id", item);
  if (tier) query = query.eq("tier", tier);
  if (userFilter) query = query.in("user_id", userFilter.length ? userFilter : ["00000000-0000-0000-0000-000000000000"]);
  const [{ data }, { count: flagged }, settings] = await Promise.all([
    query,
    db.from("submissions").select("id", { count: "exact", head: true }).eq("needs_human", true),
    getSettings()
  ]);
  const rows = (data || []) as Row[];
  const ids = [...new Set(rows.map(r => r.user_id))];
  const { data: profiles } = ids.length ? await db.from("profiles").select("id, email, full_name").in("id", ids) : { data: [] };
  const who = new Map((profiles || []).map(p => [p.id as string, p as { email: string; full_name: string | null }]));

  return (
    <div className="stack">
      <div>
        <p className="eyebrow">Admin</p>
        <h1>AI reviews</h1>
        <p className="muted">The AI reviewer marks every mission and boss submission. You only need to look at what it flags ({flagged || 0} waiting). Overrides and re-runs are logged.</p>
      </div>
      {sp.error && <p className="alert bad">{sp.error}</p>}
      {sp.notice && <p className="alert ok">{sp.notice}</p>}
      {(!hasAnthropic() || !settings.ai_review_auto) && (
        <p className="alert warn">{!hasAnthropic() ? "ANTHROPIC_API_KEY is not set, so every submission waits here for a person." : "Automatic AI review is switched off in Settings, so every submission waits here for a person."}</p>
      )}
      <form className="row" method="get" style={{ flexWrap: "wrap", alignItems: "end", gap: 8 }}>
        <label className="fld">Show
          <select name="view" defaultValue={view}><option value="flagged">Needs a person</option><option value="all">All submissions</option></select>
        </label>
        <label className="fld">Status
          <select name="status" defaultValue={status}><option value="">Any</option><option value="pending">Pending</option><option value="accepted">Accepted</option><option value="revise">Revise</option><option value="rejected">Rejected</option></select>
        </label>
        <label className="fld">Item<input name="item" defaultValue={item} placeholder="1.3, B2, 6.4" size={8} /></label>
        <label className="fld">Tier
          <select name="tier" defaultValue={tier}><option value="">Any</option>{(["b", "s", "g", "boss", "capstone"] as Tier[]).map(t => <option key={t} value={t}>{TIER_LABEL[t]}</option>)}</select>
        </label>
        <label className="fld">Learner email<input name="email" defaultValue={sp.email || ""} placeholder="name@" /></label>
        <button className="btn sm" type="submit">Filter</button>
      </form>
      {rows.length === 0 ? <p className="empty">{view === "flagged" ? "Nothing needs a person right now." : "No submissions match."}</p> : (
        <div className="scroll">
          <table className="dt">
            <thead><tr><th>Submitted</th><th>Learner</th><th>Item</th><th>Tier</th><th>Status</th><th className="n">Score</th><th>Why flagged</th><th></th></tr></thead>
            <tbody>
              {rows.map(r => {
                const p = who.get(r.user_id);
                const why = r.needs_human ? (r.ai_result?.human_reason || (r.ai_result?.queued ? `Queued: ${r.ai_result.queued.replace(/_/g, " ")}` : "") || (r.ai_result?.flags || []).join("; ") || "Flagged") : "";
                return (
                  <tr key={r.id}>
                    <td>{fmtDate(r.created_at)}</td>
                    <td>{p?.full_name || "—"}<br /><small className="muted">{p?.email}</small></td>
                    <td>{r.item_id}</td>
                    <td>{TIER_LABEL[r.tier as Tier] || r.tier}</td>
                    <td><span className={`pill ${PILL[r.status] || ""}`}>{r.status}</span>{r.needs_human && <> <span className="pill bad">needs a person</span></>}{r.reviewed_by && <> <span className="pill">overridden</span></>}</td>
                    <td className="n">{r.score ?? "—"}</td>
                    <td><small>{why}</small></td>
                    <td><Link className="btn sm alt" href={`/admin/reviews/${r.id}`}>Open</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
