import Link from "next/link";
import { REFERRAL } from "@/lib/pricing";
import { SecHead } from "./SecHead";
import { WEEKS, TOTAL_SESSIONS, SESSIONS_PER_WEEK, LESSONS, BOSSES } from "./data";

export function Faq() {
  return (
    <section className="wrap" aria-labelledby="faq-h">
      <SecHead id="faq-h" eyebrow="Questions" title="Before you start" />
      <div className="faq">
        <details><summary>Do I need to know how to code?</summary><p>No. Tracks 0–2 need no code at all. Later lessons introduce small pieces of JavaScript and Python step by step, with labs that check your work.</p></details>
        <details><summary>How much time does it take?</summary><p>The course is about {TOTAL_SESSIONS} sessions of 60–120 minutes: {LESSONS} lessons plus {BOSSES.length} boss projects and the capstone. At the standard pace of {SESSIONS_PER_WEEK} sessions a week, that's about {WEEKS} weeks. You can set your own pace; your schedule adjusts.</p></details>
        <details><summary>Will I have to pay for Zapier, Make or n8n?</summary><p>Not to learn. Zapier, Make and n8n all have free plans, and n8n can also be self-hosted for free. Some AI services charge per use once their free credits run out; you choose what to sign up for, and you stay in control of any spending. We never charge you for third-party tools.</p></details>
        <details><summary>Do I need a laptop, or will a phone do?</summary><p>You need a laptop or desktop with an internet connection for the building parts. Lessons, Listen, quizzes and the community work on a phone, so you can read and listen on the move and build when you're at a computer.</p></details>
        <details><summary>Is the certificate accredited?</summary><p>It's a Certificate in AI Automation from Automancy Academy, earned by passing practical projects. It is not a university or government qualification or a professional licence. Anyone can verify it online. <Link href="/legal/certificate">How the certificate works</Link>.</p></details>
        <details><summary>Can I get a refund?</summary><p>Yes, within {REFERRAL.refundWindowDays} days of payment if you've completed less than 30% of the paid lessons and haven't claimed a certificate. <Link href="/legal/refunds">Read the refund policy</Link>.</p></details>
        <details><summary>How do I pay? Can I pay in instalments?</summary><p>Pay in naira or US dollars by card, bank transfer or USSD through Paystack. Some plans can be paid in three instalments in naira. See <Link href="/pricing">Pricing</Link>.</p></details>
        <details><summary>Can my company train our team?</summary><p>Yes. We offer team seats for 5 or more staff and private workshops. See <Link href="/pricing#business">For business</Link>.</p></details>
      </div>
    </section>
  );
}
