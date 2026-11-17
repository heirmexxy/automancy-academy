import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { fmtDate } from "@/lib/format";
import { closeTicket, replyTicket } from "@/lib/actions/agents";
import { TICKET_TOPICS } from "@/lib/agents/support";

export const metadata: Metadata = { title: "Support · Admin" };
export const dynamic = "force-dynamic";

type T = { id: string; name: string; email: string; topic: string; subject: string; message: string; status: string; draft: string | null; draft_confidence: number | null; reply: string | null; replied_by: string | null; replied_at: string | null; created_at: string };

export default async function AdminSupport({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const tab = sp.tab === "done" ? "done" : "open";
  let rows: T[] = [], missing = false;
  try {
    let q = createAdminClient().from("support_tickets").select("*").order("created_at", { ascending: tab === "open" }).limit(200);
    q = tab === "open" ? q.in("status", ["open", "waiting"]) : q.in("status", ["answered", "closed"]);
    const { data, error } = await q; if (error) missing = true; rows = (data || []) as T[];
  } catch { missing = true; }
  const topic = (k: string) => TICKET_TOPICS.find(t => t.key === k)?.label || k;
  return (
    <div className="stack" style={{ gap: 16 }}>
      <h1 style={{ fontSize: "2rem" }}>Support</h1>
      <p className="muted">Messages from the <a href="/support">Contact support</a> form. The Support Agent drafts an answer for each one (and sends the ones it&apos;s sure about when it&apos;s set to act in Admin → Agents). Edit the draft and send, or close the ticket.</p>
      {missing && <p className="alert bad">Run the database update <code>0015_agents.sql</code> in Supabase first.</p>}
      {sp.sent && <p className="alert ok" role="status">Reply sent.</p>}
      {sp.error && <p className="alert bad" role="alert">{sp.error}</p>}
      <div className="row"><a className={`btn sm ${tab === "open" ? "" : "alt"}`} href="/admin/support">Open</a><a className={`btn sm ${tab === "done" ? "" : "alt"}`} href="/admin/support?tab=done">Answered and closed</a></div>
      {rows.length === 0 ? <p className="empty">{tab === "open" ? "No open tickets." : "Nothing here yet."}</p> : rows.map(t => (
        <div key={t.id} className="card stack" style={{ gap: 8 }}>
          <div className="row" style={{ justifyContent: "space-between" }}><b>{t.subject}</b><span className="note">{fmtDate(t.created_at)} · {topic(t.topic)}</span></div>
          <p className="note">{t.name} · <a href={`mailto:${t.email}`}>{t.email}</a></p>
          <p style={{ whiteSpace: "pre-wrap" }}>{t.message}</p>
          {tab === "open" ? (<>
            <form action={replyTicket} className="stack" style={{ gap: 6 }}>
              <input type="hidden" name="id" value={t.id} />
              <label className="fld">Reply{t.draft ? <span className="note">Drafted by the Support Agent{t.draft_confidence != null ? ` (confidence ${Math.round(Number(t.draft_confidence) * 100)}%)` : ""}: check it before sending.</span> : null}
                <textarea name="reply" defaultValue={t.draft || `Hi ${t.name.split(/\s+/)[0]},\n\n\n\nAutomancy Academy support`} style={{ minHeight: 160 }} /></label>
              <div className="row" style={{ gap: 8 }}><button className="btn sm" type="submit">Send reply</button></div>
            </form>
            <form action={closeTicket}><input type="hidden" name="id" value={t.id} /><button className="btn alt sm" type="submit">Close without replying</button></form>
          </>) : t.reply ? <div className="note" style={{ whiteSpace: "pre-wrap" }}><b>Replied {t.replied_at ? fmtDate(t.replied_at) : ""} by {t.replied_by === "agent" ? "the Support Agent" : "an admin"}:</b>{"\n"}{t.reply}</div> : <p className="note">Closed.</p>}
        </div>
      ))}
    </div>
  );
}
