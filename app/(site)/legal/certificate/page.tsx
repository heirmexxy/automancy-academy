import Link from "next/link";
import type { Metadata } from "next";
import { SUPPORT_EMAIL, SITE_URL, SITE_NAME } from "@/lib/config";
import { CERT_STATEMENT } from "@/lib/certificate";
import { LegalPage } from "../LegalPage";
import { LESSONS, BOSSES } from "@/components/landing/data";

export const metadata: Metadata = { title: "Certificate policy", description: "What the Certificate in AI Automation certifies, how it's earned and verified, and what it is not." };

export default function CertificatePolicy() {
  return (
    <LegalPage title="Certificate policy" current="/legal/certificate" summary={<ul>
      <li>The Certificate in AI Automation is earned by finishing the course and passing every boss project and the capstone.</li>
      <li>Work is reviewed by AI against published rubrics, and a person checks anything the AI flags plus a sample of the rest.</li>
      <li>Every certificate has an ID and a public page anyone can use to check it.</li>
      <li>It is not an accredited qualification or a professional licence, and it isn&rsquo;t endorsed by Zapier, Make, n8n or any other tool maker.</li>
      <li>We can revoke a certificate obtained by cheating or misconduct.</li>
    </ul>}>
      <h2 id="statement">1. What the certificate certifies</h2>
      <p className="statement">{CERT_STATEMENT}</p>

      <h2 id="criteria">2. How to earn it</h2>
      <ul>
        <li><b>Every lesson:</b> all {LESSONS} lessons completed, with each checkpoint quiz passed at 4 out of 5 or better.</li>
        <li><b>{BOSSES.length} boss projects:</b> each scored 80 or more out of 100 against its rubric, with every must-have check met.</li>
        <li><b>The Grand Capstone:</b> scored 80 or more out of 100, with every must-have check met.</li>
        <li>An active paid enrolment that gives you access to the full course. A refunded purchase can&rsquo;t be used to earn the certificate.</li>
      </ul>
      <p>When you meet the criteria, you claim the certificate from <Link href="/account#certificate">Account</Link> and confirm the name to print on it. Use your real name: it&rsquo;s what employers will see. Claiming a certificate ends your eligibility for a refund on the course.</p>

      <h2 id="review">3. How work is reviewed</h2>
      <p>Boss projects and the capstone are marked against published rubrics, from the written evidence you submit: run logs, test results, screenshots described in text, and reports. An AI reviewer scores each submission and explains its reasoning. A person reviews every submission the AI flags as uncertain or borderline, and a random sample of the rest, and can change the result. If you think a result is wrong, email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> to ask for a human review.</p>
      <p>The work must be your own. You may use AI tools while you build, as the course teaches, but you must understand and be able to explain what you submit.</p>

      <h2 id="verify">4. Verification</h2>
      <p>Each certificate has a unique ID. Anyone can check it at <code>{SITE_URL}/verify/&lt;ID&gt;</code> or by entering the ID on the <Link href="/verify">verification page</Link>. The page shows the name on the certificate, the certificate ID, the issue date and whether it is valid or revoked. It shows nothing else about you. You can add the certificate to LinkedIn with its ID and verification link.</p>

      <h2 id="not">5. What the certificate is not</h2>
      <ul>
        <li>It is <b>not an accredited academic qualification</b>. It isn&rsquo;t issued by a university or approved by the National Universities Commission, the National Board for Technical Education or any other government body, and it doesn&rsquo;t carry academic credit.</li>
        <li>It is <b>not a professional licence</b> or a certification of competence by any professional body.</li>
        <li>It is <b>not endorsed</b> by Zapier, Make, n8n, HubSpot, Zoho, Salesforce, Anthropic, OpenAI or any other company whose tools the course uses. Their own certifications are earned directly from them.</li>
        <li>It is <b>not a guarantee</b> of employment, income or client results.</li>
      </ul>
      <p>It is a record that you completed {SITE_NAME}&rsquo;s coursework and that your practical projects passed review, as described above.</p>

      <h2 id="revocation">6. Revocation</h2>
      <p>We may revoke a certificate if we find that it was obtained by misconduct, including submitting someone else&rsquo;s work as your own, faking evidence or results, using another person&rsquo;s account, manipulating the review process, or if the purchase it relied on is refunded or charged back. We may also correct a certificate issued in error.</p>
      <p>Before revoking for misconduct, we&rsquo;ll tell you what we found and give you 14 days to respond. If we revoke it, the verification page will show it as revoked. You can appeal by emailing <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> within 30 days; a different member of our team will look at the appeal.</p>

      <h2 id="name">7. Changing the name on a certificate</h2>
      <p>If your legal name changes or we printed it wrongly, update your name in <Link href="/account#profile">Account</Link> and email us from your account&rsquo;s email address. We&rsquo;ll reissue the certificate with a new ID; the old ID will then no longer show as valid.</p>
    </LegalPage>
  );
}
