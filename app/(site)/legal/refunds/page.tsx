import Link from "next/link";
import type { Metadata } from "next";
import { COMPANY, SUPPORT_EMAIL } from "@/lib/config";
import { REFERRAL } from "@/lib/pricing";
import { LegalPage } from "../LegalPage";

export const metadata: Metadata = { title: "Refund policy", description: "When and how you can get a refund from Automancy Academy." };

/** Share of paid lessons a learner may complete and still get a refund. Keep in step with A's refund checks. */
const MAX_DONE = "30%";

export default function Refunds() {
  const days = REFERRAL.refundWindowDays;
  return (
    <LegalPage title="Refund policy" current="/legal/refunds" summary={<ul>
      <li>Course plans: full refund within {days} days of payment if you&rsquo;ve completed less than {MAX_DONE} of the paid lessons and haven&rsquo;t claimed a certificate.</li>
      <li>Cohort seats: full refund if you ask before the first live call. No refunds once it has started.</li>
      <li>Add-ons: refundable within {days} days only if you haven&rsquo;t downloaded or used them.</li>
      <li>Membership: cancel any time. No partial refunds.</li>
      <li>Ask from <Link href="/account#purchases">Account → Purchases</Link>. Approved refunds go back to your original payment method through Paystack.</li>
    </ul>}>
      <p>Try Base Camp for free before you buy: it&rsquo;s there so you can be sure the course suits you. If it still doesn&rsquo;t work out, here is when we refund. This policy is part of our <Link href="/legal/terms">terms</Link> and doesn&rsquo;t affect your rights under the Federal Competition and Consumer Protection Act 2018 or other consumer laws that apply to you, including refunds when something we sold you doesn&rsquo;t work as described.</p>

      <h2 id="course">1. Self-paced course and team seats</h2>
      <p>You get a full refund if you ask within <b>{days} days of your payment</b> and both of these are true:</p>
      <ul>
        <li>you have completed less than {MAX_DONE} of the paid lessons (lessons outside the free Base Camp), and</li>
        <li>you have not claimed a certificate.</li>
      </ul>
      <p>After {days} days, or once you&rsquo;ve completed {MAX_DONE} or more of the paid lessons, the course isn&rsquo;t refundable. Team seats follow the same rules for each seat; seats that have never been assigned to a person can be refunded within {days} days.</p>

      <h2 id="instalments">2. Paying in instalments</h2>
      <ul>
        <li>The {days} days count from your <b>first</b> instalment. If you qualify, we refund every instalment you&rsquo;ve paid and cancel the rest.</li>
        <li>After that, you can stop paying at any time. Your access ends when the period covered by your last payment ends. Instalments already paid aren&rsquo;t refunded.</li>
      </ul>

      <h2 id="cohort">3. Cohort seats</h2>
      <p>You get a full refund if you ask <b>before the first live call</b> of your cohort starts. Once the first live call has started, cohort fees aren&rsquo;t refundable, and we don&rsquo;t give partial (pro-rata) refunds for calls you miss. If we cancel or postpone a cohort, you can choose a full refund or a seat in a later cohort.</p>

      <h2 id="addons">4. Add-ons</h2>
      <p>Story Mode, the template bundle and the CRM specialisation can be refunded within {days} days of payment only if you haven&rsquo;t downloaded or used them: no audio downloaded, no template pack downloaded, no specialisation lesson opened. Once you&rsquo;ve downloaded or used an add-on, it isn&rsquo;t refundable, because the content can&rsquo;t be returned.</p>

      <h2 id="membership">5. Membership</h2>
      <p>Membership is paid one month at a time. You can cancel or stop renewing whenever you like; your access continues to the end of the month you&rsquo;ve paid for. We don&rsquo;t give partial refunds for the rest of a month.</p>

      <h2 id="business">6. Job posts</h2>
      <p>A paid job post can be refunded until it goes live. Once it is published, it isn&rsquo;t refundable.</p>

      <h2 id="creators">7. Courses by other creators</h2>
      <p>Courses you buy from other creators in the <Link href="/courses">course catalogue</Link> follow the same rules as section 1: a full refund within {days} days of payment if you&rsquo;ve completed less than {MAX_DONE} of the course. We handle these refunds, not the creator.</p>

      <h2 id="how">8. How to ask for a refund</h2>
      <ol>
        <li>Go to <Link href="/account#purchases">Account → Purchases</Link> and choose <b>Request a refund</b> next to the payment. Tell us briefly why; it helps us improve.</li>
        <li>If you can&rsquo;t use your account, email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> from the email address on your account, with the payment reference from your receipt.</li>
      </ol>
      <p>We reply within 5 working days. Approved refunds are sent back to your original payment method through Paystack. Banks usually take 5 to 10 working days to show the money in your account, sometimes longer for international cards. We refund the amount you actually paid, in the currency you paid in; we can&rsquo;t cover exchange-rate differences or fees your bank charged.</p>

      <h2 id="after">9. What happens after a refund</h2>
      <ul>
        <li>Access to the refunded product ends, and you can&rsquo;t claim a certificate on the strength of it. Your free Base Camp access and your progress stay.</li>
        <li>If someone referred you, their commission on that payment is cancelled.</li>
        <li>If you ask for a chargeback through your bank instead of asking us, access is paused while the dispute is open. Please contact us first; it&rsquo;s usually faster.</li>
        <li>We may refuse refunds where the policy is being misused, for example repeated buy-and-refund cycles or sharing materials before asking for a refund.</li>
      </ul>

      <h2 id="contact">10. Contact</h2>
      <p>{COMPANY.legalName}, {COMPANY.address}. Email: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
    </LegalPage>
  );
}
