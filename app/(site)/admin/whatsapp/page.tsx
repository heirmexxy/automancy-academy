import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { COURSE } from "@/lib/course";
import { fmtDate } from "@/lib/format";
import { canSend, hasWhatsApp, reminderTemplate } from "@/lib/whatsapp/api";
import { lagosDate, maskPhone } from "@/lib/whatsapp/core";
import { loadScript } from "@/lib/whatsapp/lessons";
import { sendTestMessage } from "./actions";

export const metadata: Metadata = { title: "WhatsApp · Admin" };
export const dynamic = "force-dynamic";

type Sess = { phone: string; user_id: string | null; item_id: string | null; card_index: number; awaiting: string; paused: boolean; last_inbound_at: string | null };
type Msg = { direction: string; status: string | null; cost_category: string | null; kind: string; created_at: string };

const DAYS = 14;

export default async function WhatsAppAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const db = createAdminClient();
  const now = Date.now();
  const since = new Date(now - DAYS * 86_400_000).toISOString();
  const dayStart = new Date(Date.parse(lagosDate() + "T00:00:00Z") - 3_600_000).toISOString();
  const weekAgo = new Date(now - 7 * 86_400_000).toISOString();

  const [linked, optedIn, today, week, sessQ, msgQ, failQ, optQ, recentQ] = await Promise.all([
    db.from("wa_links").select("user_id", { count: "exact", head: true }),
    db.from("wa_links").select("user_id", { count: "exact", head: true }).eq("opted_in", true),
    db.from("wa_sessions").select("phone", { count: "exact", head: true }).gte("last_inbound_at", dayStart),
    db.from("wa_sessions").select("phone", { count: "exact", head: true }).gte("last_inbound_at", weekAgo),
    db.from("wa_sessions").select("phone, user_id, item_id, card_index, awaiting, paused, last_inbound_at").not("user_id", "is", null).limit(10000),
    db.from("wa_messages").select("direction, status, cost_category, kind, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(50000),
    db.from("wa_messages").select("phone, kind, error, created_at, body_excerpt").eq("status", "failed").order("created_at", { ascending: false }).limit(30),
    db.from("wa_links").select("user_id, phone_e164, stopped_at").eq("opted_in", false).order("stopped_at", { ascending: false }).limit(30),
    db.from("wa_links").select("user_id, phone_e164, linked_at, opted_in, reminders").order("linked_at", { ascending: false }).limit(50)
  ]);
  const dbError = sessQ.error || msgQ.error || linked.error;

  // Where learners are: per item, how many sessions sit on each card (stuck = no message for 3+ days).
  const sessions = (sessQ.data || []) as Sess[];
  const stuckBefore = now - 3 * 86_400_000;
  const byItem = new Map<string, { total: number; stuck: number; cards: Map<number, number> }>();
  for (const x of sessions) {
    if (!x.item_id) continue;
    const e = byItem.get(x.item_id) || { total: 0, stuck: 0, cards: new Map() };
    e.total++;
    if (!x.last_inbound_at || new Date(x.last_inbound_at).getTime() < stuckBefore) e.stuck++;
    e.cards.set(x.card_index, (e.cards.get(x.card_index) || 0) + 1);
    byItem.set(x.item_id, e);
  }
  const order = new Map(COURSE.items.map((it, i) => [it.id, i]));
  const items = [...byItem.entries()].sort((a, b) => (order.get(a[0]) ?? 99) - (order.get(b[0]) ?? 99));

  // Messages per Lagos day
  const days = new Map<string, { in: number; out: number; reminders: number; failed: number }>();
  for (let i = 0; i < DAYS; i++) days.set(lagosDate(new Date(now - i * 86_400_000)), { in: 0, out: 0, reminders: 0, failed: 0 });
  for (const m of (msgQ.data || []) as Msg[]) {
    const d = days.get(lagosDate(new Date(m.created_at)));
    if (!d) continue;
    if (m.direction === "in") d.in++; else d.out++;
    if (m.direction === "out" && m.kind.startsWith("template:")) d.reminders++;
    if (m.status === "failed") d.failed++;
  }
  const totals = [...days.values()].reduce((a, d) => ({ in: a.in + d.in, out: a.out + d.out, reminders: a.reminders + d.reminders, failed: a.failed + d.failed }), { in: 0, out: 0, reminders: 0, failed: 0 });

  const ids = [...new Set([...(recentQ.data || []).map(r => r.user_id as string), ...(optQ.data || []).map(r => r.user_id as string)])];
  const { data: profs } = ids.length ? await db.from("profiles").select("id, email, full_name").in("id", ids) : { data: [] as { id: string; email: string; full_name: string | null }[] };
  const who = new Map((profs || []).map(p => [p.id as string, (p.full_name as string) || (p.email as string)]));
  const sessByUser = new Map(sessions.map(x => [x.user_id as string, x]));

  return (
    <div className="stack">
      <h1 style={{ fontSize: "2rem" }}>WhatsApp learning</h1>
      {!hasWhatsApp() && <p className="alert warn">WhatsApp isn&apos;t configured yet: set the WHATSAPP_* variables (see README → Going live with WhatsApp). The account page shows &ldquo;coming soon&rdquo; and the webhook returns 503 until then.</p>}
      {dbError && <p className="alert warn">Couldn&apos;t read WhatsApp data: {dbError.message}. Has migration 0009_whatsapp.sql been run?</p>}
      {sp.sent && <p className="alert ok" role="status">Test message sent.</p>}
      {sp.error && <p className="alert bad" role="alert">{sp.error}</p>}

      <div className="grid4">
        <div className="kpi"><b>{linked.count ?? 0}</b><span>linked numbers</span></div>
        <div className="kpi"><b>{optedIn.count ?? 0}</b><span>opted in</span></div>
        <div className="kpi"><b>{today.count ?? 0}</b><span>active today</span></div>
        <div className="kpi"><b>{week.count ?? 0}</b><span>active in 7 days</span></div>
      </div>
      <div className="grid4">
        <div className="kpi"><b>{totals.in}</b><span>messages in ({DAYS} days)</span></div>
        <div className="kpi"><b>{totals.out}</b><span>messages out</span></div>
        <div className="kpi"><b>{totals.reminders}</b><span>reminders ({reminderTemplate()})</span></div>
        <div className="kpi"><b>{totals.failed}</b><span>failed</span></div>
      </div>

      <div className="card">
        <h2 style={{ fontSize: "1.3rem" }}>Where learners are</h2>
        <p className="note">Sessions per lesson and the cards they sit on (most common first). &ldquo;Quiet 3+ days&rdquo; flags where people may be stuck.</p>
        {items.length === 0 ? <p className="empty">No one is learning on WhatsApp yet.</p> : (
          <div className="scroll"><table className="dt">
            <thead><tr><th>Item</th><th className="n">Learners</th><th className="n">Quiet 3+ days</th><th>Cards (card: learners)</th><th>Script</th></tr></thead>
            <tbody>{items.map(([id, e]) => {
              const sc = loadScript(id);
              const cards = [...e.cards.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([c, n]) => `${c + 1}${sc?.cards[c] ? ` (${sc.cards[c].t})` : ""}: ${n}`).join(" · ");
              return <tr key={id}><td>{id}</td><td className="n">{e.total}</td><td className="n">{e.stuck ? <span className="pill warn">{e.stuck}</span> : 0}</td><td>{cards}</td><td>{sc ? `${sc.cards.length} cards` : <span className="pill bad">missing</span>}</td></tr>;
            })}</tbody>
          </table></div>
        )}
      </div>

      <div className="card">
        <h2 style={{ fontSize: "1.3rem" }}>Messages per day</h2>
        <div className="scroll"><table className="dt">
          <thead><tr><th>Day (Lagos)</th><th className="n">In</th><th className="n">Out</th><th className="n">Reminders</th><th className="n">Failed</th></tr></thead>
          <tbody>{[...days.entries()].map(([d, v]) => <tr key={d}><td>{d}</td><td className="n">{v.in}</td><td className="n">{v.out}</td><td className="n">{v.reminders}</td><td className="n">{v.failed}</td></tr>)}</tbody>
        </table></div>
        <p className="note">Pricing: free-form replies inside the 24-hour window and templates are billed differently by Meta. Check WhatsApp Manager → Insights for actual charges.</p>
      </div>

      <div className="card">
        <h2 style={{ fontSize: "1.3rem" }}>Recent failures</h2>
        {(failQ.data || []).length === 0 ? <p className="empty">No failed messages.</p> : (
          <div className="scroll"><table className="dt">
            <thead><tr><th>When</th><th>Number</th><th>Kind</th><th>Error</th></tr></thead>
            <tbody>{(failQ.data || []).map((f, i) => <tr key={i}><td>{fmtDate(f.created_at as string)}</td><td>{maskPhone(f.phone as string)}</td><td>{f.kind as string}</td><td>{(f.error as string) || ""}</td></tr>)}</tbody>
          </table></div>
        )}
      </div>

      <div className="card">
        <h2 style={{ fontSize: "1.3rem" }}>Linked learners (latest 50)</h2>
        {(recentQ.data || []).length === 0 ? <p className="empty">No linked numbers yet.</p> : (
          <div className="scroll"><table className="dt">
            <thead><tr><th>Learner</th><th>Number</th><th>Linked</th><th>Status</th><th>Reminders</th><th>On</th><th>Last message</th></tr></thead>
            <tbody>{(recentQ.data || []).map(r => {
              const x = sessByUser.get(r.user_id as string);
              return <tr key={r.user_id as string}>
                <td><Link href={`/admin/learners/${r.user_id}`}>{who.get(r.user_id as string) || "learner"}</Link></td>
                <td>{maskPhone(r.phone_e164 as string)}</td>
                <td>{fmtDate(r.linked_at as string)}</td>
                <td>{r.opted_in ? (x?.paused ? <span className="pill warn">paused</span> : <span className="pill ok">active</span>) : <span className="pill bad">stopped</span>}</td>
                <td>{r.reminders ? "on" : "off"}</td>
                <td>{x?.item_id ? `${x.item_id} · card ${x.card_index + 1}${x.awaiting === "task" ? " (task)" : ""}` : ""}</td>
                <td>{x?.last_inbound_at ? fmtDate(x.last_inbound_at) : ""}</td>
              </tr>;
            })}</tbody>
          </table></div>
        )}
      </div>

      <div className="card">
        <h2 style={{ fontSize: "1.3rem" }}>Opt-outs (STOP)</h2>
        {(optQ.data || []).length === 0 ? <p className="empty">No opt-outs.</p> : (
          <ul>{(optQ.data || []).map(r => <li key={r.user_id as string}>{who.get(r.user_id as string) || "learner"} · {maskPhone(r.phone_e164 as string)}{r.stopped_at ? ` · ${fmtDate(r.stopped_at as string)}` : ""}</li>)}</ul>
        )}
      </div>

      <div className="card">
        <h2 style={{ fontSize: "1.3rem" }}>Send a test message</h2>
        <p className="note">Sends a text to <b>your own</b> linked number. WhatsApp only allows free-form messages within 24 hours of your last message to the business number, so message it first (e.g. MENU).</p>
        <form action={sendTestMessage} className="stack">
          <label className="fld">Message<textarea name="text" maxLength={1000} required defaultValue="Hello from Automancy Academy admin." /></label>
          <div className="row"><button className="btn" type="submit" disabled={!canSend()}>Send test</button></div>
        </form>
      </div>
    </div>
  );
}
