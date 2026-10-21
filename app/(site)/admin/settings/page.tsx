import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { fmtDate } from "@/lib/format";
import { saveSettings } from "@/lib/actions/settings";

export const metadata: Metadata = { title: "Settings · Admin" };
export const dynamic = "force-dynamic";

type Audit = { id: number; actor: string | null; detail: { changed?: string[]; before?: Record<string, unknown>; after?: Record<string, unknown> } | null; at: string };

export default async function AdminSettings({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const s = await getSettings();
  let log: Audit[] = [];
  const names: Record<string, string> = {};
  try {
    const db = createAdminClient();
    const { data } = await db.from("audit_log").select("id, actor, detail, at").eq("action", "settings.update").order("at", { ascending: false }).limit(10);
    log = (data || []) as Audit[];
    const ids = [...new Set(log.map(l => l.actor).filter((x): x is string => !!x))];
    if (ids.length) {
      const { data: ps } = await db.from("profiles").select("id, full_name, email").in("id", ids);
      (ps || []).forEach(p => { names[p.id] = p.full_name || p.email; });
    }
  } catch { /* no database yet */ }

  return (
    <>
      <h1 style={{ fontSize: "2rem" }}>Settings</h1>
      {sp.saved && <p className="alert ok" role="status">Settings saved. Public pages update within a few minutes.</p>}
      {sp.error && <p className="alert bad" role="alert">{sp.error}</p>}
      <form action={saveSettings} className="card stack">
        <label className="check"><input type="checkbox" name="cohort_open" defaultChecked={!!s.cohort_open} />
          <span><b>Cohort open.</b> Shows the Cohort plan on the landing and pricing pages and lets people buy a seat. When off, they can only join the waitlist.</span></label>
        <label className="fld" style={{ maxWidth: 260 }}>Next cohort start date
          <input type="date" name="next_cohort_date" defaultValue={s.next_cohort_date || ""} />
          <span className="note">Shown on the pricing page. Leave empty for &ldquo;join the waitlist&rdquo;.</span></label>
        <label className="check"><input type="checkbox" name="live_calls_visible" defaultChecked={!!s.live_calls_visible} />
          <span><b>Live calls visible.</b> Shows live-call links and schedules to cohort learners in the course.</span></label>
        <label className="check"><input type="checkbox" name="ai_review_auto" defaultChecked={!!s.ai_review_auto} />
          <span><b>AI review decides automatically.</b> When off, every AI review waits for a person in Admin → AI reviews before the learner sees the result.</span></label>
        <div className="row"><button className="btn" type="submit">Save settings</button></div>
      </form>

      <h2 style={{ fontSize: "1.3rem", marginTop: 10 }}>Recent changes</h2>
      {log.length === 0 ? <p className="empty">No changes recorded yet.</p> : (
        <div className="scroll"><table className="dt">
          <thead><tr><th>When</th><th>Who</th><th>Changed</th></tr></thead>
          <tbody>{log.map(l => (
            <tr key={l.id}>
              <td>{fmtDate(l.at)}</td>
              <td>{(l.actor && names[l.actor]) || "Admin"}</td>
              <td>{(l.detail?.changed || []).map(k => <div key={k}><code>{k}</code>: {String(l.detail?.before?.[k] ?? "–")} → {String(l.detail?.after?.[k] ?? "–")}</div>)}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </>
  );
}
