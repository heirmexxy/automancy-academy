import Link from "next/link";
import type { Metadata } from "next";
import "@/components/landing/landing.css";
import "./pricing.css";
import { getSettings } from "@/lib/settings";
import { product, REFERRAL, type Product } from "@/lib/pricing";
import { SUPPORT_EMAIL } from "@/lib/config";
import { fmtDate } from "@/lib/format";
import { PlanCard, WaitlistForm } from "@/components/landing/PlanCard";
import { SecHead } from "@/components/landing/SecHead";
import { plans, addons, business, curOf, priceText, periodText, LESSONS, BOSSES, FREE_LESSONS, type Cur } from "@/components/landing/data";

export const metadata: Metadata = { title: "Pricing", description: "Start free. Self-paced course, Membership, add-ons and team options, in naira or US dollars." };

type Cell = boolean | string;
type Row = { label: string; cells: Record<string, Cell> };

function compareRows(): Row[] {
  return [
    { label: `Base Camp (${FREE_LESSONS} lessons and Boss 0)`, cells: { free: true, self: true, cohort: true, member: false } },
    { label: `All ${LESSONS} lessons, ${BOSSES.length} boss projects and the capstone`, cells: { free: false, self: true, cohort: true, member: false } },
    { label: "Animated walkthroughs and natural-voice Listen", cells: { free: "Base Camp", self: true, cohort: true, member: false } },
    { label: "AI review of missions and projects", cells: { free: "Base Camp", self: true, cohort: true, member: "Challenge entries" } },
    { label: "Templates for n8n, Make and Zapier", cells: { free: false, self: true, cohort: true, member: "New each month" } },
    { label: "Certificate with verification page", cells: { free: false, self: true, cohort: true, member: false } },
    { label: "Community", cells: { free: true, self: true, cohort: true, member: "Members' room" } },
    { label: "Leaderboard and Hire talent profile", cells: { free: false, self: true, cohort: true, member: false } },
    { label: "Weekly live build calls", cells: { free: false, self: false, cohort: true, member: false } },
    { label: "Mentor review of every boss project", cells: { free: false, self: false, cohort: true, member: false } },
    { label: "Story Mode and the template bundle", cells: { free: false, self: "Add-on", cohort: true, member: false } },
    { label: "Weekly challenges and new lessons", cells: { free: false, self: false, cohort: "3 months", member: true } }
  ];
}

const cell = (v: Cell | undefined) =>
  v === true ? <span aria-label="Included" className="yes">✓</span>
  : !v ? <span aria-label="Not included" className="no">–</span>
  : <span>{v}</span>;

function CurrencyToggle({ cur }: { cur: Cur }) {
  return (
    <div className="cur" role="group" aria-label="Currency">
      <Link href="/pricing" aria-current={cur === "ngn" ? "true" : undefined} scroll={false}>₦ Naira</Link>
      <Link href="/pricing?cur=usd" aria-current={cur === "usd" ? "true" : undefined} scroll={false}>$ US dollar</Link>
    </div>
  );
}

export default async function Pricing({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const cur = curOf(sp.cur);
  const settings = await getSettings();
  const cohortOpen = !!settings.cohort_open;
  const back = cur === "usd" ? "/pricing?cur=usd" : "/pricing";
  const visiblePlans = plans().filter(p => cohortOpen || !p.hiddenUnlessCohortOpen);
  const cohort = product("cohort");
  const cols = visiblePlans.map(p => p.id as string);
  const pct = Math.round(REFERRAL.friendDiscount * 100);
  const wl = sp.waitlisted ? product(sp.waitlisted) : undefined;

  return (
    <div className="wrap pricing">
      <header className="sec-head" style={{ paddingTop: 36 }}>
        <span className="eyebrow">Pricing</span>
        <h1>Start free. Pay when you're sure.</h1>
        <p className="lede">Prices in naira or US dollars. Pay by card, bank transfer or USSD through Paystack. The price you pay is locked when you pay.</p>
        <CurrencyToggle cur={cur} />
      </header>

      {wl && <p className="alert ok" role="status">You're on the waitlist for {wl.name}. We'll email you when it opens.</p>}
      {sp.error && <p className="alert bad" role="alert">{sp.error}</p>}

      <section aria-labelledby="plans-h" style={{ paddingTop: 12 }}>
        <h2 id="plans-h" className="sr-only">Plans</h2>
        <div className="plans">{visiblePlans.map(p => <PlanCard key={p.id} p={p} cur={cur} back={back} />)}</div>
        {!cohortOpen && cohort && (
          <div className="card" id="cohort" style={{ marginTop: 16 }}>
            <h3>Prefer to learn with a group? {cohort.name}</h3>
            <p>{cohort.blurb} {settings.next_cohort_date ? <>Next cohort: <b>{fmtDate(settings.next_cohort_date)}</b>.</> : <>Next cohort: join the waitlist and we'll email you when dates are set.</>}</p>
            <WaitlistForm productId="cohort" back={back} />
          </div>
        )}
        <p className="note refnote">Got a friend's referral link? You get {pct}% off a plan when you use it (not on Membership renewals or add-ons). <Link href="/earn">How referrals work</Link></p>
      </section>

      <section aria-labelledby="addon-h">
        <SecHead id="addon-h" title="Add-ons" lede="Extras you can add to any plan, now or later." />
        <div className="plans">{addons().map(p => <PlanCard key={p.id} p={p} cur={cur} back={back} />)}</div>
      </section>

      <section aria-labelledby="cmp-h">
        <SecHead id="cmp-h" title="Compare plans" />
        <div className="scroll">
          <table className="dt cmp">
            <caption className="sr-only">What each plan includes</caption>
            <thead><tr><th scope="col">Feature</th>{visiblePlans.map(p => <th scope="col" key={p.id}>{p.name}</th>)}</tr></thead>
            <tbody>
              <tr><th scope="row">Price</th>{visiblePlans.map(p => <td key={p.id}><b>{priceText(p, cur)}</b> <span className="muted">{periodText(p)}</span></td>)}</tr>
              {compareRows().map(r => (
                <tr key={r.label}><th scope="row">{r.label}</th>{cols.map(c => <td key={c}>{cell(r.cells[c])}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="business" aria-labelledby="biz-h" style={{ scrollMarginTop: 70 }}>
        <SecHead id="biz-h" eyebrow="For business" title="Train your team, or hire a graduate" />
        <div className="plans">
          {business().map((p: Product) => <PlanCard key={p.id} p={p} cur={cur} back={back} />)}
          <article className="card plan">
            <h3>Private team workshop</h3>
            <p className="price">Quote</p>
            <p>Day 1: Base Camp (automation thinking, APIs, data, AI, safety). Day 2: one platform of your choice (Zapier, Make or n8n), building one of your real processes live.</p>
            <a className="btn alt" href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Team workshop enquiry")}`}>Email us</a>
          </article>
        </div>
        <p className="note" style={{ marginTop: 12 }}>Want to see graduates first? <Link href="/hire">Browse Hire talent</Link>.</p>
      </section>

      <section aria-labelledby="pf-h">
        <SecHead id="pf-h" title="Payment questions" />
        <div className="faq">
          <details><summary>Which payment methods can I use?</summary><p>In naira: cards, bank transfer and USSD through Paystack. In US dollars: international Visa and Mastercard through Paystack. We never see or store your card details.</p></details>
          <details><summary>How does paying in instalments work?</summary><p>Where a plan shows &ldquo;3 payments&rdquo;, you pay the first instalment now and the others a month apart, in naira. Each payment unlocks the course until the next one is due; after the last payment, your full access period counts from your first payment. Details are in the <Link href="/legal/terms#payments">terms</Link>.</p></details>
          <details><summary>Can I get a refund?</summary><p>Yes: a full refund within {REFERRAL.refundWindowDays} days of payment if you've completed less than 30% of the paid lessons and haven't claimed a certificate. Cohort seats are refundable until the first live call. Add-ons can't be refunded once downloaded or used, and Membership can be cancelled any time without partial refunds. <Link href="/legal/refunds">Full refund policy</Link>.</p></details>
          <details><summary>Do prices change with the exchange rate?</summary><p>Naira and dollar prices are set separately. The price you pay is locked when you pay.</p></details>
          <details><summary>Can my employer pay?</summary><p>Yes. For 5 or more people, use team seats; for anything else, email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we'll send an invoice.</p></details>
        </div>
      </section>
    </div>
  );
}
