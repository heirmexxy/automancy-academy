import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPaystack } from "@/lib/config";
import { REFERRAL, product } from "@/lib/pricing";
import { fmtDate } from "@/lib/format";
import { moneyText, refundDeadline, type Currency } from "@/lib/money";
import { adminApproveRefund, adminDeclineRefund } from "@/lib/actions/payments";

export const metadata: Metadata = { title: "Refunds · Admin" };
export const dynamic = "force-dynamic";

export default async function Refunds({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const show = sp.show === "all" ? "all" : "open";
  const db = createAdminClient();
  let q = db.from("refund_requests").select("id, user_id, payment_id, reason, status, admin_note, created_at, decided_at").order("created_at", { ascending: false }).limit(300);
  if (show === "open") q = q.in("status", ["open", "approved"]);
  const { data } = await q;
  const reqs = data || [];
  const payIds = [...new Set(reqs.map(r => r.payment_id as string))];
  const userIds = [...new Set(reqs.map(r => r.user_id as string))];
  const [{ data: pays }, { data: profs }] = await Promise.all([
    payIds.length ? db.from("payments").select("id, product, reference, amount_kobo, currency, status, paid_at, installment_no, installments_total").in("id", payIds) : Promise.resolve({ data: [] as never[] }),
    userIds.length ? db.from("profiles").select("id, email, full_name").in("id", userIds) : Promise.resolve({ data: [] as never[] })
  ]);
  const payMap = new Map((pays || []).map(p => [p.id as string, p]));
  const who = new Map((profs || []).map(p => [p.id as string, p]));
  const live = hasPaystack();

  return (
    <div className="stack">
      <header className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ fontSize: "2rem" }}>Refund requests</h1>
        <div className="row"><Link className={`btn sm ${show === "open" ? "" : "alt"}`} href="/admin/refunds">Open</Link><Link className={`btn sm ${show === "all" ? "" : "alt"}`} href="/admin/refunds?show=all">All</Link></div>
      </header>
      {sp.done && <p className="alert ok" role="status">Saved.</p>}
      {sp.error && <p className="alert bad" role="alert">{sp.error}</p>}
      <p className="note">Policy: learners may ask within {REFERRAL.refundWindowDays} days of payment. Approving ends the access from that payment (whole plan for Pay in 3) and reverses the referral earning. {live ? "Approve refunds through Paystack; the request becomes \"refunded\" when Paystack confirms." : "Paystack isn't configured: refund the learner yourself, then mark it refunded manually."}</p>
      {reqs.length === 0 ? <p className="empty">No {show === "open" ? "open " : ""}refund requests.</p> : reqs.map(r => {
        const p = payMap.get(r.payment_id as string);
        const u = who.get(r.user_id as string);
        const inWindow = p?.paid_at ? new Date(r.created_at).getTime() <= refundDeadline(p.paid_at).getTime() : false;
        return (
          <div key={r.id} className="card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <b><Link href={`/admin/learners/${r.user_id}`}>{u?.full_name || u?.email || "learner"}</Link> · {p ? `${product(p.product)?.name || p.product} · ${moneyText(p.amount_kobo, p.currency as Currency)}` : "payment missing"}</b>
              <span className={`pill ${r.status === "open" ? "warn" : r.status === "declined" ? "bad" : "ok"}`}>{r.status}</span>
            </div>
            <p className="note">{u?.email} · requested {fmtDate(r.created_at)} · paid {p?.paid_at ? fmtDate(p.paid_at) : "-"} · {inWindow ? "within the refund window" : "OUTSIDE the refund window"}{p ? ` · payment ${p.status} · ${p.reference}` : ""}{p && p.installments_total > 1 ? ` · instalment ${p.installment_no}/${p.installments_total}` : ""}</p>
            <p style={{ whiteSpace: "pre-wrap" }}>{r.reason}</p>
            {r.admin_note && <p className="note">Note: {r.admin_note}{r.decided_at ? ` (${fmtDate(r.decided_at)})` : ""}</p>}
            {r.status === "open" && p?.status === "success" && (
              <div className="grid2">
                <form action={adminApproveRefund} className="stack" style={{ gap: 8 }}>
                  <input type="hidden" name="id" value={r.id} />
                  <input name="note" maxLength={1000} placeholder="Note to learner (optional)" aria-label="Note to learner" />
                  <div className="row">
                    {live && <button className="btn sm" type="submit" name="mode" value="paystack">Approve and refund via Paystack</button>}
                    <button className="btn alt sm" type="submit" name="mode" value="manual">Mark refunded manually</button>
                  </div>
                </form>
                <form action={adminDeclineRefund} className="stack" style={{ gap: 8 }}>
                  <input type="hidden" name="id" value={r.id} />
                  <input name="note" required maxLength={1000} placeholder="Reason for declining (the learner sees this)" aria-label="Reason for declining" />
                  <div className="row"><button className="btn alt sm" type="submit">Decline</button></div>
                </form>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
