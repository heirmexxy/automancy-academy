import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { fmtDate } from "@/lib/format";
import { AGENTS } from "@/lib/agents/registry";
import { getAgentSettings } from "@/lib/agents/run";
import { closeFlag, runAgentNow, saveAgents } from "@/lib/actions/agents";

export const metadata: Metadata = { title: "Agents · Admin" };
export const dynamic = "force-dynamic";

type Run = { id: string; agent: string; trigger: string; status: string; summary: string; actions: number; started_at: string };
type FlagRow = { id: string; agent: string; kind: string; target_type: string | null; target_id: string | null; severity: string; message: string; created_at: string };
const WHEN: Record<string, string> = { event: "When something happens", hourly: "Every hour", daily: "Every day, 08:00 Lagos", weekly: "Mondays, 08:00 Lagos" };
const LINK: Record<string, (id: string) => string> = {
  refund_request: () => "/admin/refunds", payment: () => "/admin/payments", user: id => `/admin/learners/${id}`,
  hire_request: () => "/admin/hire", post: id => `/community/post/${id}`, comment: () => "/admin/community", course: id => `/admin/courses/${id}`
};

export default async function AgentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const settings = await getAgentSettings();
  let runs: Run[] = [], flags: FlagRow[] = [], tableMissing = false;
  try {
    const db = createAdminClient();
    const [r, f] = await Promise.all([
      db.from("agent_runs").select("id, agent, trigger, status, summary, actions, started_at").order("started_at", { ascending: false }).limit(300),
      db.from("agent_flags").select("id, agent, kind, target_type, target_id, severity, message, created_at").eq("status", "open").order("created_at", { ascending: false }).limit(200)
    ]);
    if (r.error) tableMissing = true;
    runs = (r.data || []) as Run[]; flags = (f.data || []) as FlagRow[];
  } catch { tableMissing = true; }
  const last = (k: string) => runs.find(r => r.agent === k);
  const name = (k: string) => AGENTS.find(a => a.key === k)?.name || k;

  return (
    <div className="stack" style={{ gap: 18 }}>
      <h1 style={{ fontSize: "2rem" }}>Agents</h1>
      <p className="muted">Automancy&apos;s agents do the routine work: reviewing courses, refunds, payments, support, nudges, fraud checks, payouts, hiring introductions, moderation and the weekly report. Each one can <b>act</b> (do the work itself, within strict rules) or <b>recommend</b> (prepare it for you). Everything they do is logged below, and anything they aren&apos;t sure about lands in &ldquo;Needs you&rdquo;.</p>
      {tableMissing && <p className="alert bad" role="alert">Run the database update <code>0015_agents.sql</code> in Supabase to turn the agents on.</p>}
      {sp.saved && <p className="alert ok" role="status">Saved.</p>}
      {sp.result && <p className={`alert ${sp.result.startsWith("ok") ? "ok" : "bad"}`} role="status">{name(sp.ran || "")}: {sp.result}</p>}

      <section id="flags" className="stack">
        <h2 style={{ fontSize: "1.3rem" }}>Needs you ({flags.length})</h2>
        {flags.length === 0 ? <p className="empty">Nothing waiting. The agents will put things here when they need a person.</p> : (
          <div className="scroll"><table className="dt">
            <thead><tr><th>When</th><th>Agent</th><th>What</th><th></th></tr></thead>
            <tbody>{flags.map(f => (
              <tr key={f.id}>
                <td className="note">{fmtDate(f.created_at)}</td>
                <td>{name(f.agent)}<div className="note"><span className={`pill ${f.severity === "high" ? "bad" : f.severity === "medium" ? "warn" : ""}`}>{f.severity}</span></div></td>
                <td>{f.message}{f.target_type && f.target_id && LINK[f.target_type] ? <div><a href={LINK[f.target_type](f.target_id)}>Open</a></div> : null}</td>
                <td><div className="row" style={{ gap: 6 }}>
                  <form action={closeFlag}><input type="hidden" name="id" value={f.id} /><input type="hidden" name="status" value="resolved" /><button className="btn sm" type="submit">Done</button></form>
                  <form action={closeFlag}><input type="hidden" name="id" value={f.id} /><input type="hidden" name="status" value="dismissed" /><button className="btn alt sm" type="submit">Dismiss</button></form>
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      <form action={saveAgents} className="stack">
        <h2 style={{ fontSize: "1.3rem" }}>The agents</h2>
        <div className="stack" style={{ gap: 12 }}>{AGENTS.map(a => { const l = last(a.key); const s = settings[a.key]; return (
          <div key={a.key} id={a.key} className="card stack" style={{ gap: 8 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
              <h3 style={{ fontSize: "1.1rem" }}>{a.name}</h3>
              <span className="note">{WHEN[a.schedule]}</span>
            </div>
            <p>{a.does}</p>
            <p className="note"><b>When it acts:</b> {a.acts}{a.canAct ? <> <b>Recommend only:</b> {a.recommends}</> : null}</p>
            <div className="row" style={{ gap: 16 }}>
              <label className="check"><input type="checkbox" name={`${a.key}_enabled`} defaultChecked={s.enabled} /> <span>On</span></label>
              {a.canAct && <label className="check"><input type="checkbox" name={`${a.key}_auto`} defaultChecked={s.auto} /> <span>Acts by itself</span></label>}
            </div>
            <p className="note">{l ? <>Last run {fmtDate(l.started_at)} ({l.trigger}): <span className={l.status === "error" ? "bad" : ""}>{l.summary}</span></> : a.schedule === "event" ? "Runs when a creator submits a course; see each course's review page." : "Hasn't run yet."}</p>
          </div>
        ); })}</div>
        <div className="row"><button className="btn" type="submit">Save agent settings</button></div>
      </form>

      <section className="stack">
        <h2 style={{ fontSize: "1.3rem" }}>Run one now</h2>
        <p className="note">Runs the agent straight away with its current setting (acting or recommending).</p>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>{AGENTS.filter(a => a.schedule !== "event").map(a => (
          <form key={a.key} action={runAgentNow}><input type="hidden" name="agent" value={a.key} /><button className="btn alt sm" type="submit">{a.name}</button></form>
        ))}</div>
      </section>

      <section className="stack">
        <h2 style={{ fontSize: "1.3rem" }}>Activity</h2>
        {runs.length === 0 ? <p className="empty">No runs yet.</p> : (
          <div className="scroll"><table className="dt">
            <thead><tr><th>When</th><th>Agent</th><th>Result</th><th>Actions</th></tr></thead>
            <tbody>{runs.slice(0, 100).map(r => (
              <tr key={r.id}><td className="note">{fmtDate(r.started_at)}<div>{r.trigger}</div></td><td>{name(r.agent)}</td><td className={r.status === "error" ? "bad" : ""}>{r.summary}</td><td>{r.actions}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </div>
  );
}
