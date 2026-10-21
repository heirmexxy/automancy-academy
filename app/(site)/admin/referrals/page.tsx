import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { fmtDate } from "@/lib/format";
import { moneyText } from "@/lib/money";
import { adminApproveEarnings, adminSetPayout } from "@/lib/actions/payments";

export const metadata: Metadata = { title: "Referrals · Admin" };
export const dynamic = "force-dynamic";

type Agg = { pending: number; available: number; approved: number; inPayout: number; paid: number; reversed: number; buyers: Set<string>; count: number };

export default async function AdminReferrals({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const db = createAdminClient();
  const [{ data: earnings }, { data: payouts }] = await Promise.all([
    db.from("referral_earnings").select("referrer_id, buyer_id, amount_kobo, status, available_at, payout_id").order("created_at", { ascending: false }).limit(5000),
    db.from("payouts").select("id, user_id, amount_kobo, status, paystack_transfer_code, created_at, paid_at").order("created_at", { ascending: false }).limit(300)
  ]);
  const now = Date.now();
  const by = new Map<string, Agg>();
  for (const e of earnings || []) {
    const a = by.get(e.referrer_id as string) || { pending: 0, available: 0, approved: 0, inPayout: 0, paid: 0, reversed: 0, buyers: new Set<string>(), count: 0 };
    const amt = e.amount_kobo as number;
    if (e.status === "pending") { a.pending += amt; if (new Date(e.available_at as string).getTime() <= now) a.available += amt; }
    else if (e.status === "approved") { if (e.payout_id) a.inPayout += amt; else a.approved += amt; }
    else if (e.status === "paid") a.paid += amt;
    else if (e.status === "reversed") a.reversed += amt;
    if (e.status !== "reversed") { a.buyers.add(e.buyer_id as string); a.count++; }
    by.set(e.referrer_id as string, a);
  }
  const ids = [...new Set([...by.keys(), ...(payouts || []).map(p => p.user_id as string)])];
  const [{ data: profs }, { data: accts }] = ids.length ? await Promise.all([
    db.from("profiles").select("id, email, full_name, referral_code").in("id", ids),
    db.from("payout_accounts").select("user_id, bank_name, account_last4, account_name, paystack_recipient_code").in("user_id", ids)
  ]) : [{ data: [] as never[] }, { data: [] as never[] }];
  const who = new Map((profs || []).map(p => [p.id as string, p]));
  const acct = new Map((accts || []).map(a => [a.user_id as string, a]));
  const totalAvailable = [...by.values()].reduce((s, a) => s + a.available, 0);
  const rows = [...by.entries()].sort((x, y) => (y[1].pending + y[1].approved + y[1].paid) - (x[1].pending + x[1].approved + x[1].paid));
  const requested = (payouts || []).filter(p => p.status === "requested");

  return (
    <div className="stack">
      <header className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ fontSize: "2rem" }}>Referrals</h1>
        <form action={adminApproveEarnings}><button className="btn sm" type="submit" disabled={!totalAvailable}>Approve all available ({moneyText(totalAvailable)})</button></form>
      </header>
      {sp.approved && <p className="alert ok" role="status">{sp.approved} earning{sp.approved === "1" ? "" : "s"} approved.</p>}
      {sp.done && <p className="alert ok" role="status">Payout updated.</p>}
      {sp.error && <p className="alert bad" role="alert">{sp.error}</p>}
      <p className="note">Earnings are pending until the buyer's refund window closes ("available"), then you approve them. Learners request payouts once approved earnings reach the minimum; pay them by bank transfer (Paystack Transfers or your bank) and mark them paid here.</p>

      <div className="card">
        <h2 style={{ fontSize: "1.3rem" }}>Payouts to make ({requested.length})</h2>
        {requested.length === 0 ? <p className="muted">No payout requests.</p> : (
          <div className="scroll"><table className="dt">
            <thead><tr><th>Requested</th><th>Referrer</th><th>Amount</th><th>Bank</th><th>Mark</th></tr></thead>
            <tbody>{requested.map(p => {
              const u = who.get(p.user_id as string); const a = acct.get(p.user_id as string);
              return (
                <tr key={p.id}>
                  <td>{fmtDate(p.created_at)}</td>
                  <td><Link href={`/admin/learners/${p.user_id}`}>{u?.full_name || u?.email}</Link><div className="note">{u?.email}</div></td>
                  <td><b>{moneyText(p.amount_kobo)}</b></td>
                  <td>{a ? <>{a.account_name || "(name unverified)"} · {a.bank_name} ····{a.account_last4}<div className="note">{a.paystack_recipient_code ? `Recipient ${a.paystack_recipient_code}` : "Not verified with Paystack: confirm the full number with the learner"}</div></> : <span className="pill bad">no account</span>}</td>
                  <td>
                    <form action={adminSetPayout} className="row" style={{ gap: 6 }}>
                      <input type="hidden" name="id" value={p.id} />
                      <input name="transfer_code" placeholder="Transfer code / ref" aria-label="Transfer code" style={{ maxWidth: 160, padding: "6px 8px" }} />
                      <button className="btn sm" type="submit" name="status" value="paid">Paid</button>
                      <button className="btn alt sm" type="submit" name="status" value="failed">Failed</button>
                    </form>
                  </td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </div>

      <div className="card">
        <h2 style={{ fontSize: "1.3rem" }}>Earnings by referrer</h2>
        {rows.length === 0 ? <p className="empty">No referral earnings yet.</p> : (
          <div className="scroll"><table className="dt">
            <thead><tr><th>Referrer</th><th>Paying referrals</th><th>Pending</th><th>Available now</th><th>Approved</th><th>In payout</th><th>Paid</th><th>Reversed</th><th></th></tr></thead>
            <tbody>{rows.map(([id, a]) => {
              const u = who.get(id);
              return (
                <tr key={id}>
                  <td><Link href={`/admin/learners/${id}`}>{u?.full_name || u?.email || id.slice(0, 8)}</Link><div className="note">{u?.referral_code}</div></td>
                  <td>{a.buyers.size} ({a.count} payments)</td>
                  <td>{moneyText(a.pending)}</td><td>{moneyText(a.available)}</td><td>{moneyText(a.approved)}</td>
                  <td>{moneyText(a.inPayout)}</td><td>{moneyText(a.paid)}</td><td>{moneyText(a.reversed)}</td>
                  <td>{a.available > 0 && <form action={adminApproveEarnings}><input type="hidden" name="referrer_id" value={id} /><button className="btn alt sm" type="submit">Approve</button></form>}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </div>

      {(payouts || []).some(p => p.status !== "requested") && (
        <div className="card">
          <h2 style={{ fontSize: "1.3rem" }}>Payout history</h2>
          <div className="scroll"><table className="dt">
            <thead><tr><th>Requested</th><th>Referrer</th><th>Amount</th><th>Status</th><th>Paid</th><th>Transfer</th></tr></thead>
            <tbody>{(payouts || []).filter(p => p.status !== "requested").map(p => (
              <tr key={p.id}><td>{fmtDate(p.created_at)}</td><td>{who.get(p.user_id as string)?.email}</td><td>{moneyText(p.amount_kobo)}</td>
                <td><span className={`pill ${p.status === "paid" ? "ok" : "bad"}`}>{p.status}</span></td><td>{p.paid_at ? fmtDate(p.paid_at) : "-"}</td><td>{p.paystack_transfer_code || ""}</td></tr>
            ))}</tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}
