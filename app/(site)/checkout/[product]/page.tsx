import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getProfile, getEntitlements, requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { SUPPORT_EMAIL } from "@/lib/config";
import { REFERRAL, product } from "@/lib/pricing";
import { ngn, usd, fmtDate } from "@/lib/format";
import { discountApplies, moneyText, normaliseCode, referralApplies } from "@/lib/money";
import { openInstalmentPlan } from "@/lib/paystack";
import { joinWaitlist, startCheckout } from "@/lib/actions/payments";
import "../checkout.css";

export const metadata: Metadata = { title: "Checkout" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ product: string }>; searchParams: Promise<Record<string, string | undefined>> };

function Waitlist({ pid, title, children, done }: { pid: string; title: string; children: React.ReactNode; done: boolean }) {
  return (
    <div className="card bold">
      <h2 style={{ fontSize: "1.4rem" }}>{title}</h2>
      {children}
      {done
        ? <p className="alert ok" role="status">You're on the list. We'll email you as soon as it opens.</p>
        : <form action={joinWaitlist}><input type="hidden" name="product" value={pid} /><button className="btn" type="submit">Join the waitlist</button></form>}
    </div>
  );
}

export default async function Checkout({ params, searchParams }: Props) {
  const { product: pid } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/checkout/${pid}`);
  const p = product(pid);
  if (!p || p.ngn <= 0) notFound();

  const [profile, settings, ent] = await Promise.all([getProfile(), getSettings(), getEntitlements(user.id)]);
  const waitlisted = sp.waitlisted === "1";
  const head = (
    <header className="stack" style={{ gap: 6 }}>
      <p className="eyebrow">Checkout</p>
      <h1 style={{ fontSize: "clamp(1.8rem,5vw,2.6rem)" }}>{p.name}</h1>
      <p className="lede">{p.blurb}</p>
    </header>
  );
  const features = p.features.length > 0 && <ul>{p.features.map(f => <li key={f}>{f}</li>)}</ul>;

  if (p.id === "team") {
    return (
      <section className="narrow stack">{head}
        <div className="card bold">
          <p>Team seats are {ngn(p.ngn)} per seat for 5 or more staff, with a progress report for your team lead.</p>
          {features}
          <p>Email <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Team seats")}`}>{SUPPORT_EMAIL}</a> with your company name and number of seats and we'll send an invoice.</p>
        </div>
      </section>
    );
  }
  if (p.hiddenUnlessCohortOpen && !settings.cohort_open) {
    return (
      <section className="narrow stack">{head}
        <Waitlist pid={p.id} title="Cohort enrolment is closed" done={waitlisted}>
          <p>The next cohort isn't open yet{settings.next_cohort_date ? `; it starts ${fmtDate(settings.next_cohort_date)}` : ""}. Join the waitlist to hear first. Meanwhile, <Link href="/checkout/self">Self-paced</Link> gives you the whole course today.</p>
        </Waitlist>
      </section>
    );
  }
  if (p.comingSoon) {
    return (
      <section className="narrow stack">{head}
        <Waitlist pid={p.id} title="Coming soon" done={waitlisted}><p>This isn't on sale yet. Join the waitlist and we'll email {user.email} when it is.</p></Waitlist>
      </section>
    );
  }
  // Checkout (works as soon as the Paystack keys are set; startCheckout handles a missing key gracefully)
  const plan = await openInstalmentPlan(user.id, p.id);
  let isRenewal = false;
  if (p.id === "member") {
    const { count } = await createAdminClient().from("payments").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("product", "member").eq("status", "success");
    isRenewal = (count ?? 0) > 0;
  }
  const own = profile?.referral_code?.toUpperCase() || "";
  const cookieRef = normaliseCode((await cookies()).get("am_ref")?.value);
  const prefill = normaliseCode(sp.ref) || (cookieRef && cookieRef !== own ? cookieRef : "");
  const canRefer = referralApplies(p, isRenewal);
  const discount = discountApplies(p, isRenewal);
  const already = ent.products.includes(p.id);

  return (
    <section className="wrap stack">
      {head}
      {sp.error && <p className="alert bad" role="alert">{sp.error}</p>}
      {already && p.id !== "member" && !plan && <p className="alert warn">You already have active {p.name} access. Paying again adds a new period; you don't need to unless it's about to expire. <Link href="/account#purchases">See your purchases</Link>.</p>}
      <div className="co">
        <div className="card">
          <p className="co-price">{ngn(p.ngn)} <small>{p.period === "one-time" ? "one-time" : p.period}</small></p>
          <p className="muted">or {usd(p.usd)} by card in US dollars</p>
          {features}
          {p.accessDays && <p className="note">Access lasts {p.accessDays} days from payment{p.id === "member" ? ", added on to any time you have left" : ""}.</p>}
          <p className="note">Refunds: ask within {REFERRAL.refundWindowDays} days of paying, from your account page.</p>
        </div>

        <form action={startCheckout} className="card bold">
          <input type="hidden" name="product" value={p.id} />
          {plan ? (
            <>
              <h2 style={{ fontSize: "1.3rem" }}>Instalment {plan.nextNo} of {plan.total}</h2>
              <p>You're paying for {p.name} in {plan.total} parts. This payment is <b>{moneyText(plan.amountKobo, "NGN")}</b>.</p>
              <p className="note">{plan.nextNo < plan.total ? `Each instalment keeps your access open for 35 days.` : `After this final instalment you have the full 12 months, counted from your first payment.`}</p>
              <input type="hidden" name="plan" value="3" />
              <input type="hidden" name="currency" value="NGN" />
            </>
          ) : (
            <>
              <fieldset className="co-opt">
                <legend>How do you want to pay?</legend>
                <label><input type="radio" name="plan" value="1" defaultChecked={sp.plan !== "3"} /> <span>Pay in full</span></label>
                {p.installments && (
                  <label><input type="radio" name="plan" value="3" defaultChecked={sp.plan === "3"} />
                    <span>Pay in {p.installments.count}: {ngn(p.installments.ngn)} now and {p.installments.count - 1} more payments of {ngn(p.installments.ngn)} about a month apart ({ngn(p.installments.ngn * p.installments.count)} in total). Naira only. Each instalment unlocks 35 days; the last one completes your 12 months.</span></label>
                )}
              </fieldset>
              <fieldset className="co-opt">
                <legend>Currency</legend>
                <label><input type="radio" name="currency" value="NGN" defaultChecked /> <span>Naira (card, bank transfer, USSD) · {ngn(p.ngn)}</span></label>
                <label><input type="radio" name="currency" value="USD" /> <span>US dollars (card) · {usd(p.usd)}</span></label>
              </fieldset>
              {canRefer ? (
                <label className="fld">Referral code (optional)
                  <input name="ref" defaultValue={prefill} maxLength={32} autoComplete="off" />
                  <span className="note">{discount ? `A friend's code takes ${Math.round(REFERRAL.friendDiscount * 100)}% off.` : "No discount on this item, but your friend still earns a reward."} You can't use your own code.</span>
                </label>
              ) : isRenewal ? <p className="note">Referral discounts apply to your first month only, not renewals.</p> : null}
            </>
          )}
          <button className="btn" type="submit">Continue to Paystack</button>
          <p className="note">You'll pay securely on Paystack and come straight back here. We never see your card details.</p>
        </form>
      </div>
    </section>
  );
}
