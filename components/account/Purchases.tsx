import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { REFERRAL, product } from "@/lib/pricing";
import { fmtDate } from "@/lib/format";
import { moneyText, refundDeadline, withinRefundWindow, type Currency } from "@/lib/money";
import { requestRefund } from "@/lib/actions/payments";

/**
 * The learner's payments, receipts, access and refund requests. Server component; reads with the learner's own
 * session (RLS). Usage on /account: <Purchases refund={searchParams.refund} /> inside an element with id="purchases".
 */
const STATUS: Record<string, string> = { success: "ok", refunded: "bad", partially_refunded: "warn", failed: "bad", initialized: "warn" };
const LABEL: Record<string, string> = { success: "Paid", refunded: "Refunded", partially_refunded: "Part refunded", failed: "Failed", initialized: "Not completed" };

export default async function Purchases({ refund }: { refund?: string }) {
  const user = await requireUser("/account");
  const db = await createClient();
  const [{ data: pays }, { data: ens }, { data: reqs }] = await Promise.all([
    db.from("payments").select("id, product, reference, amount_kobo, currency, status, installment_no, installments_total, discount_kobo, referral_code, paid_at, created_at")
      .eq("user_id", user.id).in("status", ["success", "refunded", "partially_refunded"]).order("created_at", { ascending: false }),
    db.from("enrollments").select("id, product, status, source, started_at, expires_at").eq("user_id", user.id).order("started_at", { ascending: false }),
    db.from("refund_requests").select("id, payment_id, status, reason, admin_note, created_at, decided_at").eq("user_id", user.id).order("created_at", { ascending: false })
  ]);
  const payments = pays || [], enrollments = ens || [], requests = reqs || [];
  const now = Date.now();
  const reqFor = (pid: string) => requests.find(r => r.payment_id === pid);
  const name = (id: string) => product(id)?.name || id;
  // One row per product: the latest expiry among active enrollments
  const access = new Map<string, { expires: string | null; active: boolean; source: string }>();
  for (const e of enrollments) {
    const live = e.status === "active" && (!e.expires_at || new Date(e.expires_at).getTime() > now);
    const cur = access.get(e.product);
    const later = !cur || (cur.expires && (!e.expires_at || e.expires_at > cur.expires));
    if (!cur || (live && (!cur.active || later))) access.set(e.product, { expires: e.expires_at, active: live, source: e.source });
  }

  return (
    <div className="stack" aria-labelledby="purchases-h">
      <h2 id="purchases-h" style={{ fontSize: "1.5rem" }}>Purchases and access</h2>
      {refund === "requested" && <p className="alert ok" role="status">Refund request sent. We reply within 3 working days.</p>}
      {refund === "not-eligible" && <p className="alert bad" role="alert">That payment can't be refunded online: refunds must be requested within {REFERRAL.refundWindowDays} days of paying, with a short reason.</p>}

      <div className="card">
        <h3>Your access</h3>
        {access.size === 0 ? <p className="muted">Base Camp is free. <Link href="/pricing">See plans</Link> to unlock the full course.</p> : (
          <div className="scroll"><table className="dt">
            <thead><tr><th>Product</th><th>Status</th><th>Until</th></tr></thead>
            <tbody>{[...access.entries()].map(([pid, a]) => (
              <tr key={pid}><td>{name(pid)}</td>
                <td><span className={`pill ${a.active ? "ok" : "bad"}`}>{a.active ? "Active" : "Ended"}</span>{a.source === "admin" ? <span className="note"> · granted by admin</span> : null}</td>
                <td>{a.expires ? fmtDate(a.expires) : "No expiry"}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </div>

      <div className="card">
        <h3>Payments and receipts</h3>
        {payments.length === 0 ? <p className="muted">No payments yet.</p> : payments.map(p => {
          const req = reqFor(p.id);
          const canRefund = p.status === "success" && withinRefundWindow(p.paid_at) && !req;
          const cur = p.currency as Currency;
          return (
            <details key={p.id} className="card" style={{ padding: 12 }}>
              <summary className="row" style={{ cursor: "pointer", justifyContent: "space-between" }}>
                <span><b>{name(p.product)}</b>{p.installments_total > 1 ? ` · instalment ${p.installment_no} of ${p.installments_total}` : ""} · {moneyText(p.amount_kobo, cur)}</span>
                <span className="row" style={{ gap: 6 }}>
                  <span className={`pill ${STATUS[p.status] || ""}`}>{LABEL[p.status] || p.status}</span>
                  {req && <span className={`pill ${req.status === "declined" ? "bad" : "warn"}`}>Refund {req.status}</span>}
                </span>
              </summary>
              <table className="dt"><tbody>
                <tr><th scope="row">Date</th><td>{p.paid_at ? fmtDate(p.paid_at) : "-"}</td></tr>
                <tr><th scope="row">Reference</th><td><code>{p.reference}</code></td></tr>
                {p.discount_kobo > 0 && <tr><th scope="row">Referral discount</th><td>{moneyText(p.discount_kobo, cur)}{p.referral_code ? ` (code ${p.referral_code})` : ""}</td></tr>}
                <tr><th scope="row">Amount paid</th><td>{moneyText(p.amount_kobo, cur)}</td></tr>
              </tbody></table>
              {req && (
                <p className="note">Refund request {fmtDate(req.created_at)}: {req.status}{req.admin_note ? `. Note from us: ${req.admin_note}` : ""}</p>
              )}
              {canRefund ? (
                <form action={requestRefund} className="stack" style={{ gap: 8 }}>
                  <input type="hidden" name="payment_id" value={p.id} />
                  <label className="fld">Request a refund (until {fmtDate(refundDeadline(p.paid_at!))})
                    <textarea name="reason" required minLength={5} maxLength={2000} placeholder="Tell us briefly why. It helps us improve." style={{ minHeight: 80 }} />
                  </label>
                  <button className="btn alt sm" type="submit">Request a refund</button>
                </form>
              ) : p.status === "success" && !req ? <p className="note">The {REFERRAL.refundWindowDays}-day refund window for this payment has closed.</p> : null}
            </details>
          );
        })}
        <p className="note">Refund policy: you can ask for a full refund within {REFERRAL.refundWindowDays} days of a payment. Refunding ends the access that payment gave (for Pay in 3, the whole plan). Money goes back to the card or account you paid with, usually within 5 to 10 working days.</p>
      </div>
    </div>
  );
}
