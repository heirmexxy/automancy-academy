import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { SUPPORT_EMAIL } from "@/lib/config";
import { product } from "@/lib/pricing";
import { fmtDate } from "@/lib/format";
import { moneyText } from "@/lib/money";
import { fulfilPayment } from "@/lib/paystack";
import { handleCoursePayment } from "@/lib/marketplace";
import "../checkout.css";

export const metadata: Metadata = { title: "Payment" };
export const dynamic = "force-dynamic";

/** Paystack sends the learner back here with ?reference= (and ?trxref=). We verify server-side before showing anything. */
export default async function Callback({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const reference = (sp.reference || sp.trxref || "").slice(0, 100);
  const user = await requireUser(`/checkout/callback${reference ? `?reference=${encodeURIComponent(reference)}` : ""}`);

  const fail = (title: string, msg: string, pid?: string) => (
    <section className="narrow stack">
      <div className="card bold">
        <p className="eyebrow">Payment</p>
        <h1 style={{ fontSize: "2rem" }}>{title}</h1>
        <p role="alert">{msg}</p>
        <div className="row">
          {pid && <Link className="btn" href={`/checkout/${pid}`}>Try again</Link>}
          <Link className="btn alt" href="/account#purchases">Your purchases</Link>
        </div>
        <p className="note">If money left your account and this page doesn't update within an hour, email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with the reference {reference || "from your bank alert"}.</p>
      </div>
    </section>
  );

  if (!reference) return fail("No payment to check", "We didn't receive a payment reference from Paystack.");
  // Verify first (idempotent; marketplace course payments may only get their row here), then check ownership before showing anything.
  const r = await fulfilPayment(reference, { onCourse: handleCoursePayment });
  const { data: own } = await createAdminClient().from("payments").select("user_id, product").eq("reference", reference).maybeSingle();
  if (!own || own.user_id !== user.id) return fail("Payment not found", "We couldn't find that payment on your account.");

  const p = r.payment;
  const pid = String(own.product);
  const isCourse = pid.startsWith("course:");
  const name = product(pid)?.name || (isCourse ? "your course" : pid);
  if (!r.ok || !p) return fail("Payment not completed", r.message, isCourse ? undefined : pid);

  return (
    <section className="narrow stack">
      <div className="card bold">
        <p className="eyebrow">Payment confirmed</p>
        <h1 style={{ fontSize: "2rem" }}>You're in. Welcome to {name}.</h1>
        <table className="dt">
          <tbody>
            <tr><th scope="row">Product</th><td>{name}{p.installments_total > 1 ? ` · instalment ${p.installment_no} of ${p.installments_total}` : ""}</td></tr>
            {p.discount_kobo > 0 && <tr><th scope="row">Referral discount</th><td>{moneyText(p.discount_kobo, p.currency)}</td></tr>}
            <tr><th scope="row">Paid</th><td>{moneyText(p.amount_kobo, p.currency)}</td></tr>
            <tr><th scope="row">Date</th><td>{fmtDate(p.paid_at || new Date())}</td></tr>
            <tr><th scope="row">Reference</th><td><code>{p.reference}</code></td></tr>
          </tbody>
        </table>
        <p className="muted">A receipt is on its way to {user.email}. You can also find it in your account.</p>
        <div className="row"><Link className="btn" href="/learn">Start learning</Link><Link className="btn alt" href="/account#purchases">Your purchases</Link></div>
      </div>
    </section>
  );
}
