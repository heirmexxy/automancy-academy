import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { COURSE, percentDone } from "@/lib/course";
import { PRODUCTS, product } from "@/lib/pricing";
import { fmtDate } from "@/lib/format";
import { moneyText, type Currency } from "@/lib/money";
import { adminGrantAccess, adminRevokeAccess } from "@/lib/actions/payments";

export const metadata: Metadata = { title: "Learner · Admin" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> };

export default async function LearnerDetail({ params, searchParams }: Props) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = createAdminClient();
  const [{ data: prof }, { data: prog }, { data: pays }, { data: ens }, { data: log }] = await Promise.all([
    db.from("profiles").select("*").eq("id", id).maybeSingle(),
    db.from("progress").select("done, xp, items_done, updated_at").eq("user_id", id).maybeSingle(),
    db.from("payments").select("id, product, reference, amount_kobo, currency, status, installment_no, installments_total, discount_kobo, referral_code, paid_at, created_at").eq("user_id", id).order("created_at", { ascending: false }),
    db.from("enrollments").select("id, product, status, source, started_at, expires_at, note").eq("user_id", id).order("started_at", { ascending: false }),
    db.from("audit_log").select("action, detail, at").eq("target", id).order("at", { ascending: false }).limit(20)
  ]);
  if (!prof) notFound();
  const done = (prog?.done || {}) as Record<string, boolean>;
  const tracks = new Map<number, { name: string; total: number; done: number }>();
  for (const it of COURSE.items) {
    const t = tracks.get(it.track) || { name: it.trackName, total: 0, done: 0 };
    t.total++; if (done[it.id]) t.done++; tracks.set(it.track, t);
  }
  const now = Date.now();
  const live = (e: { status: string; expires_at: string | null }) => e.status === "active" && (!e.expires_at || new Date(e.expires_at).getTime() > now);

  return (
    <div className="stack">
      <p className="note"><Link href="/admin/learners">← Learners</Link></p>
      <header className="stack" style={{ gap: 4 }}>
        <h1 style={{ fontSize: "2rem" }}>{prof.full_name || prof.email}</h1>
        <p className="muted">{prof.email}{prof.city ? ` · ${prof.city}` : ""} · joined {fmtDate(prof.created_at)} · role {prof.role} · referral code {prof.referral_code || "-"}{prof.marketing_consent ? " · marketing OK" : ""}</p>
      </header>
      {sp.done === "granted" && <p className="alert ok" role="status">Access granted.</p>}
      {sp.done === "revoked" && <p className="alert ok" role="status">Access revoked.</p>}
      {sp.error && <p className="alert bad" role="alert">{sp.error}</p>}

      <div className="grid4">
        <div className="kpi"><b>{percentDone(done)}%</b><span>course done</span></div>
        <div className="kpi"><b>{prog?.items_done ?? 0}</b><span>items done</span></div>
        <div className="kpi"><b>{prog?.xp ?? 0}</b><span>XP</span></div>
        <div className="kpi"><b>{prog?.updated_at ? fmtDate(prog.updated_at) : "-"}</b><span>last progress</span></div>
      </div>

      <div className="card">
        <h2 style={{ fontSize: "1.3rem" }}>Progress by track</h2>
        <div className="scroll"><table className="dt">
          <thead><tr><th>Track</th><th>Done</th><th>%</th></tr></thead>
          <tbody>{[...tracks.entries()].sort((a, b) => a[0] - b[0]).map(([n, t]) => (
            <tr key={n}><td>{n}. {t.name}</td><td>{t.done} / {t.total}</td><td>{Math.round(100 * t.done / t.total)}%</td></tr>
          ))}</tbody>
        </table></div>
      </div>

      <div className="card">
        <h2 style={{ fontSize: "1.3rem" }}>Access</h2>
        {(ens || []).length === 0 ? <p className="muted">No enrollments.</p> : (
          <div className="scroll"><table className="dt">
            <thead><tr><th>Product</th><th>Status</th><th>Source</th><th>Started</th><th>Expires</th><th>Note</th><th></th></tr></thead>
            <tbody>{(ens || []).map(e => (
              <tr key={e.id}>
                <td>{product(e.product)?.name || e.product}</td>
                <td><span className={`pill ${live(e) ? "ok" : "bad"}`}>{live(e) ? "active" : e.status === "active" ? "expired" : e.status}</span></td>
                <td>{e.source}</td><td>{fmtDate(e.started_at)}</td><td>{e.expires_at ? fmtDate(e.expires_at) : "never"}</td><td>{e.note || ""}</td>
                <td>{e.status === "active" && (
                  <form action={adminRevokeAccess} className="row" style={{ gap: 6 }}>
                    <input type="hidden" name="enrollment_id" value={e.id} /><input type="hidden" name="user_id" value={id} />
                    <input name="note" placeholder="Reason" aria-label="Reason for revoking" style={{ maxWidth: 140, padding: "6px 8px" }} />
                    <button className="btn alt sm" type="submit">Revoke</button>
                  </form>
                )}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        <form action={adminGrantAccess} className="row" style={{ alignItems: "end" }}>
          <input type="hidden" name="user_id" value={id} />
          <label className="fld" style={{ minWidth: 180 }}>Product
            <select name="product" required defaultValue="self">
              {PRODUCTS.filter(p => p.id !== "free").map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="fld" style={{ width: 120 }}>Days<input name="days" type="number" min={1} max={3650} placeholder="default" /></label>
          <label className="fld" style={{ flex: 1, minWidth: 200 }}>Note<input name="note" maxLength={500} placeholder="e.g. paid by bank transfer, ref …" /></label>
          <button className="btn sm" type="submit">Grant access</button>
        </form>
        <p className="note">Leave days empty to use the product's normal length. Granting a cohort here gives only the cohort row; add Story Mode, bundle or Membership separately if needed.</p>
      </div>

      <div className="card">
        <h2 style={{ fontSize: "1.3rem" }}>Payments</h2>
        {(pays || []).length === 0 ? <p className="muted">No payments.</p> : (
          <div className="scroll"><table className="dt">
            <thead><tr><th>Date</th><th>Product</th><th>Amount</th><th>Status</th><th>Referral</th><th>Reference</th></tr></thead>
            <tbody>{(pays || []).map(p => (
              <tr key={p.id}>
                <td>{fmtDate(p.paid_at || p.created_at)}</td>
                <td>{product(p.product)?.name || p.product}{p.installments_total > 1 ? ` (${p.installment_no}/${p.installments_total})` : ""}</td>
                <td>{moneyText(p.amount_kobo, p.currency as Currency)}{p.discount_kobo ? <span className="note"> −{moneyText(p.discount_kobo, p.currency as Currency)}</span> : null}</td>
                <td>{p.status}</td><td>{p.referral_code || ""}</td><td><code>{p.reference}</code></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>

      {(log || []).length > 0 && (
        <div className="card">
          <h2 style={{ fontSize: "1.3rem" }}>Admin history</h2>
          <ul className="note" style={{ margin: 0, paddingLeft: 18 }}>{(log || []).map((l, i) => <li key={i}>{fmtDate(l.at)} · {l.action} · {JSON.stringify(l.detail)}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
