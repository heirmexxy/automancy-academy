import Link from "next/link";
import type { Metadata } from "next";
import { getUser } from "@/lib/auth";
import { hasSupabase } from "@/lib/config";
import { getCreator } from "@/lib/marketplace";
import { MARKET } from "../courses/_lib/core";
import "../courses/marketplace.css";

export const metadata: Metadata = { title: "Teach on Automancy", description: "Create a practical course, we review it, and you keep 70% of every sale after payment fees." };
export const dynamic = "force-dynamic";

const pct = (n: number) => `${Math.round(n * 100)}%`;

export default async function Teach() {
  const user = hasSupabase() ? await getUser().catch(() => null) : null;
  const creator = user ? await getCreator(user.id) : null;
  const cta = creator?.status === "approved" ? { href: "/teach/studio", label: "Open the creator studio" }
    : creator?.status === "applied" ? { href: "/teach/apply", label: "View your application" }
    : { href: user ? "/teach/apply" : "/signup?next=/teach/apply", label: "Apply to teach" };
  const share = MARKET.revenueShare;

  return (
    <div className="wrap stack" style={{ gap: 8 }}>
      <section className="mk-hero">
        <p className="eyebrow">Teach on Automancy</p>
        <h1>Teach what you've actually built.</h1>
        <p className="lede">Thousands of Nigerian and African learners want practical skills from people who use them every day. Turn your know-how into a course, and we handle hosting, payments, refunds and support.</p>
        <div className="row"><Link className="btn" href={cta.href}>{cta.label}</Link><Link className="btn alt" href="/teach/terms">Read the creator terms</Link></div>
      </section>

      <section className="stack">
        <h2>Why teach here</h2>
        <div className="grid3">
          <div className="card"><h3>Learners who want to do the work</h3><p>Our learners come to build automations, agents and businesses. They're looking for focused, hands-on courses.</p></div>
          <div className="card"><h3>Payments sorted</h3><p>Naira and dollar checkout through Paystack, receipts, refunds and payouts to your Nigerian bank account.</p></div>
          <div className="card"><h3>Simple tools</h3><p>Write lessons in plain text, embed YouTube, Vimeo or Loom videos, add quizzes and hands-on tasks, and preview everything as a learner.</p></div>
        </div>
      </section>

      <section className="stack">
        <h2>How it works</h2>
        <ol className="mk-steps" style={{ padding: 0 }}>
          <li className="card"><h3>Apply</h3><p>Tell us who you are and what you want to teach. We approve creators by hand.</p></li>
          <li className="card"><h3>Create</h3><p>Build your course in the studio: sections, lessons, videos, quizzes and tasks. Set your price.</p></li>
          <li className="card"><h3>Submit</h3><p>When it's ready, submit it. We review every lesson in about {MARKET.reviewDays} working days.</p></li>
          <li className="card"><h3>Go live</h3><p>Approved courses appear in the catalogue. We'll tell you about every sale.</p></li>
        </ol>
      </section>

      <section className="stack">
        <h2>Revenue share</h2>
        <div className="card">
          <div className="mk-split" aria-hidden="true">
            <span style={{ flex: share, background: "var(--volt)" }}>You {pct(share)}</span>
            <span style={{ flex: 1 - share, background: "var(--grape)" }}>Platform {pct(1 - share)}</span>
          </div>
          <p>You get <b>{pct(share)}</b> of every sale after the payment processor's fee; we keep {pct(1 - share)} to run the platform, marketing, support and refunds.</p>
          <p className="muted">Example: a ₦10,000 sale with a Paystack fee of about ₦250 earns you ₦{Math.floor((10000 - 250) * share).toLocaleString("en-NG")}.</p>
          <p>Earnings become available after the {MARKET.refundWindowDays}-day refund window, and we pay them to your bank account. Prices range from ₦{MARKET.minPriceNgn.toLocaleString("en-NG")} to ₦{MARKET.maxPriceNgn.toLocaleString("en-NG")}; you choose.</p>
        </div>
      </section>

      <section className="stack">
        <h2>Our quality bar and content rules</h2>
        <div className="grid2">
          <div className="card">
            <h3>Every course must</h3>
            <ul>
              <li>Be your original work, or material you have the right to sell.</li>
              <li>Teach something a learner can do by the end, with at least {MARKET.minLessons} lessons.</li>
              <li>Have a clear description (at least {MARKET.minDescription} characters), an honest title and a cover image.</li>
              <li>Use automation that follows each platform's rules (WhatsApp, Meta, Google, LinkedIn and so on) and the law, including data protection.</li>
            </ul>
          </div>
          <div className="card">
            <h3>We don't accept</h3>
            <ul>
              <li>Copyrighted material you don't own: other people's videos, paid courses, books or templates.</li>
              <li>Get-rich-quick claims, guaranteed income, or "make ₦1m in a week" promises.</li>
              <li>Spam, scraping that breaks terms of service, fake engagement, or ways around platform limits.</li>
              <li>Lessons that ask learners for passwords, API keys, OTPs or bank details, or to send them to you.</li>
              <li>Hateful, misleading, adult or dangerous content.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="stack" style={{ paddingBottom: 24 }}>
        <div className="card bold row" style={{ justifyContent: "space-between" }}>
          <div className="stack" style={{ gap: 4 }}><h3>Ready to share what you know?</h3><p className="muted">Applying takes five minutes.</p></div>
          <Link className="btn" href={cta.href}>{cta.label}</Link>
        </div>
      </section>
    </div>
  );
}
