import Link from "next/link";
import type { Metadata } from "next";
import { COMPANY, SUPPORT_EMAIL } from "@/lib/config";
import { MARKET } from "../../courses/_lib/core";
import "../../courses/marketplace.css";

export const metadata: Metadata = { title: "Creator terms", description: "The agreement between Automancy Academy and the creators who sell courses on it, in plain English." };

const n = (x: number) => x.toLocaleString("en-NG");

export default function CreatorTerms() {
  const share = Math.round(MARKET.revenueShare * 100);
  return (
    <section className="narrow stack">
      <p className="eyebrow">Creator agreement</p>
      <h1 style={{ fontSize: "clamp(2rem,5vw,2.8rem)" }}>Creator terms</h1>
      {/* PLACEHOLDER: have a Nigerian lawyer review this agreement before launch (docs/placeholders/marketplace.md). */}
      <p className="alert warn"><span className="placeholder">Draft pending legal review.</span> Last updated October 2026.</p>
      <div className="prose">
        <p>This agreement is between you (the creator) and {COMPANY.legalName} ("Automancy", "we"). By applying to teach you accept it. We've written it in plain English; if anything is unclear, email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>

        <h2>1. You keep ownership</h2>
        <p>Your course stays yours. You give us a non-exclusive, worldwide licence to host, show, promote and sell it on Automancy, and to let buyers use it for as long as the course is available to them. You can sell the same material elsewhere.</p>

        <h2>2. What you promise</h2>
        <ul>
          <li>The course is your original work, or you have every right needed to sell it (including music, images, video and templates in it).</li>
          <li>It doesn't break anyone's copyright, trademark, privacy or other rights, or any law.</li>
          <li>It doesn't promise guaranteed income, and it doesn't teach learners to break the rules of WhatsApp, Meta, Google, LinkedIn or any other platform.</li>
          <li>It never asks learners for passwords, API keys, one-time codes or bank details.</li>
          <li>The information you give us about yourself is true.</li>
        </ul>
        <p>If someone makes a claim against us because one of these promises wasn't true, you agree to cover the reasonable costs that result.</p>

        <h2>3. Review and takedown</h2>
        <p>We review every course before it goes live, and again when you change a live course. We may ask for changes, decline a course, or remove (unlist) a live course at any time if it breaks these terms, receives a valid complaint (for example a copyright notice), or puts learners at risk. We'll tell you why. Learners who already bought a removed course normally keep access unless the content is unlawful.</p>

        <h2>4. Prices</h2>
        <p>You set the price between <b>₦{n(MARKET.minPriceNgn)}</b> and <b>₦{n(MARKET.maxPriceNgn)}</b> (and optionally a dollar price between ${MARKET.minPriceUsd} and ${MARKET.maxPriceUsd}). Price changes to a live course go through review. We may run platform-wide promotions; we'll ask before discounting your course.</p>

        <h2>5. Revenue share and payouts</h2>
        <p>For every sale you earn <b>{share}%</b> of the amount paid after the payment processor's fee; we keep {100 - share}%. Your earning is "pending" for {MARKET.refundWindowDays} days (the learner's refund window), then "available". We pay available earnings to the Nigerian bank account you give us, normally once a month. You can see every sale and payout in the creator studio.</p>

        <h2>6. Refunds</h2>
        <p>Learners can ask for a refund within {MARKET.refundWindowDays} days of buying under our <Link href="/legal/terms">terms of service</Link>. Refunds are shared pro rata: when we refund a sale, your earning on that sale is cancelled, and if it was already paid we deduct it from future earnings.</p>

        <h2>7. Taxes</h2>
        <p>You are responsible for declaring and paying tax on your earnings. We may ask for your tax details (for example a TIN) and may deduct tax where the law requires us to.</p>

        <h2>8. Ending the agreement</h2>
        <p>You can stop selling at any time by asking us to unlist your courses; existing buyers keep access. We can suspend or end your creator account if you seriously or repeatedly break these terms. Earnings already available for sales that weren't refunded will still be paid, minus any amounts you owe us.</p>

        <h2>9. Changes</h2>
        <p>We may update these terms. We'll email you at least 14 days before a change that affects your earnings. Nigerian law governs this agreement.</p>
      </div>
      <div className="row"><Link className="btn" href="/teach/apply">Apply to teach</Link><Link className="btn alt" href="/teach">Back</Link></div>
    </section>
  );
}
