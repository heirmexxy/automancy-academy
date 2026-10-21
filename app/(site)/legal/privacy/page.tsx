import Link from "next/link";
import type { Metadata } from "next";
import { COMPANY, SUPPORT_EMAIL, SITE_URL, SITE_NAME } from "@/lib/config";
import { REFERRAL } from "@/lib/pricing";
import { LegalPage } from "../LegalPage";
import { PRIVACY_EMAIL, DPO_NAME, DB_REGION, FINANCE_RETENTION_YEARS, DELETION_DAYS } from "../meta";

export const metadata: Metadata = { title: "Privacy policy", description: "How Automancy Academy collects, uses and protects your personal data under the Nigeria Data Protection Act 2023." };

const PROCESSORS: [string, string, string, string][] = [
  ["Supabase", "Database, sign-in and authentication", "Your account, profile, progress, submissions, payments records, community posts", `${DB_REGION}`],
  ["Vercel", "Hosting the website", "Pages you request, IP address, browser details and technical logs", "Global network, mainly the United States and the EU"],
  ["Paystack", "Taking payments and paying referral earnings", "Name, email, amount, product, payment reference; for payouts, your bank name, account number and account name (we keep only the last 4 digits)", "Nigeria"],
  ["Anthropic", "AI review of missions and projects, and the course assistant", "The text and links you submit, the questions you ask the assistant, and the lesson they relate to. We don't send your email address or payment details", "United States"],
  ["Microsoft Azure (Speech)", "Turning lesson text into natural-voice audio", "Lesson text only. No personal data is sent", "PLACEHOLDER: Azure Speech region"],
  ["Resend", "Sending account, receipt and course emails", "Your email address, name and the content of the email", "United States"],
  ["Google Fonts", "Delivering the typefaces the site uses", "Your browser requests the fonts directly, so Google receives your IP address and browser details", "Global"]
];

export default function Privacy() {
  return (
    <LegalPage title="Privacy policy" current="/legal/privacy" summary={<ul>
      <li>We collect what we need to run the course: your account, progress, the work you submit and your payment records.</li>
      <li>Card details go straight to Paystack. We never see or store them.</li>
      <li>What you submit for review, and questions you ask the assistant, are sent to Anthropic for AI processing.</li>
      <li>We don&rsquo;t record your voice. Listen turns lesson text into audio; it never uses your microphone.</li>
      <li>We don&rsquo;t sell your data, and marketing emails need your consent.</li>
      <li>You can download your data or ask us to delete your account from <Link href="/account#data">Account</Link>, and complain to the Nigeria Data Protection Commission.</li>
    </ul>}>
      <h2 id="who">1. Who is responsible for your data</h2>
      <p>The data controller is {COMPANY.legalName} (RC {COMPANY.rcNumber}), {COMPANY.address}, which runs {SITE_NAME} at <a href={SITE_URL}>{SITE_URL}</a>. We follow the Nigeria Data Protection Act 2023 (&ldquo;NDPA&rdquo;) and the regulations and guidance of the Nigeria Data Protection Commission (&ldquo;NDPC&rdquo;). If you live elsewhere, you keep any extra rights your own country&rsquo;s law gives you.</p>
      <p>Contact for anything about your data: <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>. Data Protection Officer: {DPO_NAME}, at the same address.</p>

      <h2 id="collect">2. What we collect</h2>
      <ul>
        <li><b>Account:</b> your name, email address, password (stored only as a secure hash by our authentication provider), city if you add it, your settings (public profile, marketing consent) and when you gave consent.</li>
        <li><b>Learning:</b> lessons completed, quiz answers and scores, missions, XP, streaks, pace and learning journal entries.</li>
        <li><b>Submissions and reviews:</b> the text and links you submit for missions, boss projects and the capstone, the AI&rsquo;s feedback and scores, and any notes from a human reviewer.</li>
        <li><b>Assistant:</b> the questions you ask the course assistant and its answers.</li>
        <li><b>Certificate:</b> the name you choose for your certificate, its ID, issue date and status.</li>
        <li><b>Community and hiring:</b> posts, comments, claps, votes and reports you make, and your Hire talent profile if you create one.</li>
        <li><b>Payments:</b> what you bought, the amount and currency, the Paystack reference, instalments, discounts, refund requests, and the referral code used. Your card details are entered on Paystack&rsquo;s page and never reach us.</li>
        <li><b>Referral programme:</b> your referral code, who referred you, your referral earnings and payouts, and for payouts your bank name, the last 4 digits of your account number, the account name and Paystack&rsquo;s recipient code.</li>
        <li><b>Creator courses:</b> if you buy a course by another creator, your enrolment and progress in that course.</li>
        <li><b>Technical:</b> IP address, browser and device type, and logs of requests and errors, kept by our hosting provider for security and troubleshooting. We also count how often you use AI review, the assistant and audio, to apply fair-use limits.</li>
        <li><b>Messages:</b> what you send us by email.</li>
      </ul>
      <p><b>What we don&rsquo;t collect:</b> we don&rsquo;t record your voice or use your microphone; Listen and Story Mode only turn lesson text into audio. We don&rsquo;t ask for sensitive data (such as health, religion or biometrics), and we ask you not to include it, or anyone else&rsquo;s personal data, in submissions, posts or questions.</p>

      <h2 id="use">3. Why we use it, and our lawful basis</h2>
      <div className="scroll"><table>
        <thead><tr><th>Purpose</th><th>Lawful basis (NDPA s.25)</th></tr></thead>
        <tbody>
          <tr><td>Creating your account and giving you the lessons you have access to</td><td>Contract</td></tr>
          <tr><td>Reviewing your work with AI and people, and answering your questions with the assistant</td><td>Contract</td></tr>
          <tr><td>Issuing your certificate and keeping its public verification page</td><td>Contract; our legitimate interest in letting employers check certificates are real</td></tr>
          <tr><td>Taking payments, instalments and refunds, and paying referral earnings</td><td>Contract; legal obligation (tax and accounting records)</td></tr>
          <tr><td>Showing your name on the leaderboard, community and Hire talent</td><td>Consent (the public profile switch in Account; you can turn it off at any time)</td></tr>
          <tr><td>Course news and offers by email</td><td>Consent (you can withdraw it in Account or from any email)</td></tr>
          <tr><td>Service emails (receipts, password resets, review results)</td><td>Contract</td></tr>
          <tr><td>Keeping the service secure, preventing fraud and abuse, and applying fair-use limits</td><td>Legitimate interests</td></tr>
          <tr><td>Improving the course using combined, non-identifying statistics</td><td>Legitimate interests</td></tr>
          <tr><td>Responding to legal requests and enforcing our terms</td><td>Legal obligation; legitimate interests</td></tr>
        </tbody>
      </table></div>
      <p>Where we rely on legitimate interests, we have weighed them against your rights, and you can object (see section 8).</p>

      <h2 id="ai">4. AI processing and automated decisions</h2>
      <p>When you submit work for review or ask the assistant a question, the content is sent to Anthropic, which processes it on our behalf under its commercial terms to produce feedback and answers. We don&rsquo;t send your email address or payment details with it. Please don&rsquo;t include passwords, API keys, or personal or confidential data in what you submit.</p>
      <p>AI scores count towards your certificate, so we don&rsquo;t let them decide alone: a person reviews any submission the AI flags and a sample of the rest, and you can ask for a human review of any result by emailing <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. This reflects your right under the NDPA not to be subject to decisions based solely on automated processing that significantly affect you.</p>

      <h2 id="processors">5. Who we share it with</h2>
      <p>We don&rsquo;t sell your personal data. We share it only with service providers that process it for us under contract, as listed below, and:</p>
      <ul>
        <li>publicly, only what you choose to make public (for example your name on the leaderboard), plus the details on your certificate&rsquo;s verification page (name on the certificate, certificate ID, issue date and status) for anyone who has the ID;</li>
        <li>with an employer, only if you send them an introduction through Hire talent;</li>
        <li>with a person who referred you: they see that a referral led to a purchase, but not your name unless you choose to tell them;</li>
        <li>with the creator of a course you buy from another creator, only what they need to run their course for you (such as your name and progress in that course);</li>
        <li>with authorities, when the law requires it.</li>
      </ul>
      <div className="scroll"><table>
        <thead><tr><th>Provider</th><th>What for</th><th>What data</th><th>Where</th></tr></thead>
        <tbody>{PROCESSORS.map(p => <tr key={p[0]}><td><b>{p[0]}</b></td><td>{p[1]}</td><td>{p[2]}</td><td>{p[3]}</td></tr>)}</tbody>
      </table></div>

      <h2 id="transfers">6. International transfers</h2>
      <p>Several of our providers store or process data outside Nigeria, mainly in the United States and the European Union. Under the NDPA (sections 41 to 43), we transfer data abroad only where the recipient is bound to protect it to a standard that is adequate under the NDPA. We use the providers&rsquo; data processing agreements and standard contractual clauses, choose providers with recognised security certifications, and send only what each one needs. Where those safeguards don&rsquo;t apply, we rely on the transfer being necessary to provide the service you asked for. You can ask us for a copy of the safeguards we use.</p>

      <h2 id="retention">7. How long we keep it</h2>
      <ul>
        <li><b>Account, progress, submissions and community content:</b> while your account is open. When you ask us to delete your account, we delete or anonymise this data within {DELETION_DAYS} days, except as below.</li>
        <li><b>Payment, refund and referral payout records:</b> {FINANCE_RETENTION_YEARS} years after the payment, because Nigerian tax and company law requires us to keep financial records.</li>
        <li><b>Certificates:</b> while your account is open, so the verification page keeps working. If you delete your account, we keep only the certificate ID, name on it, issue date and status, so that a certificate you have already shared can still be checked, unless you ask us to remove that too.</li>
        <li><b>Technical logs and fair-use counters:</b> for short periods, generally no more than 90 days.</li>
        <li><b>Marketing consent records:</b> until you withdraw consent, and then a record that you withdrew it.</li>
        <li><b>Waitlist emails:</b> until the product opens and we&rsquo;ve told you, or you ask us to remove you.</li>
        <li>Our providers may keep backups and processing logs for limited periods under their own terms.</li>
      </ul>

      <h2 id="rights">8. Your rights</h2>
      <p>Under the NDPA you have the right to:</p>
      <ul>
        <li><b>be informed</b> about how we use your data (this policy);</li>
        <li><b>access</b> your data and get a copy of it;</li>
        <li><b>correct</b> data that is wrong or incomplete (you can edit most of it in Account);</li>
        <li><b>delete</b> your data, unless we must keep it by law;</li>
        <li><b>restrict</b> how we use it while a complaint is looked into;</li>
        <li><b>portability</b>: receive your data in a machine-readable format and send it to someone else;</li>
        <li><b>object</b> to processing based on our legitimate interests, and to direct marketing at any time;</li>
        <li><b>withdraw consent</b> at any time, without affecting what we did before;</li>
        <li>not be subject to a decision based <b>solely on automated processing</b> that significantly affects you (see section 4);</li>
        <li><b>complain</b> to the Nigeria Data Protection Commission (<a href="https://ndpc.gov.ng" target="_blank" rel="noopener noreferrer">ndpc.gov.ng</a>). We&rsquo;d like the chance to help first, but you can go to the NDPC at any time.</li>
      </ul>
      <p><b>How:</b> use <Link href="/account#data">Account → Your data</Link> to download your data or ask for deletion, or email <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>. We may need to confirm your identity. We reply within 30 days, and it&rsquo;s free unless a request is clearly unfounded or excessive.</p>

      <h2 id="cookies">9. Cookies and local storage</h2>
      <p>We use only the cookies the service needs to work. We don&rsquo;t use advertising cookies or third-party tracking.</p>
      <div className="scroll"><table>
        <thead><tr><th>Name</th><th>Purpose</th><th>How long</th></tr></thead>
        <tbody>
          <tr><td><code>sb-…</code> (authentication)</td><td>Keeps you signed in securely</td><td>Until you sign out, or the session expires</td></tr>
          <tr><td><code>am_ref</code> (referral)</td><td>Remembers the referral code from a link you clicked, so the right person gets credit and you get the friend discount</td><td>{REFERRAL.attributionDays} days</td></tr>
        </tbody>
      </table></div>
      <p>The course also saves some progress and preferences (such as your reading position and voice settings) in your browser&rsquo;s local storage so it works smoothly; this stays on your device. If we ever add analytics, we&rsquo;ll update this policy first and ask for consent where the law requires it.</p>

      <h2 id="children">10. Age</h2>
      <p>{SITE_NAME} is for people aged 18 and over. We don&rsquo;t knowingly collect data from anyone younger. If you believe someone under 18 has created an account, tell us at <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a> and we&rsquo;ll delete it.</p>

      <h2 id="security">11. Security</h2>
      <p>We encrypt data in transit, limit access to the people who need it, use database rules so each learner can only read their own records, and store passwords only as secure hashes. If a personal data breach is likely to put your rights at risk, we&rsquo;ll notify the NDPC within 72 hours of becoming aware of it, and tell you without undue delay if the risk to you is high.</p>

      <h2 id="changes">12. Changes</h2>
      <p>We&rsquo;ll update this policy when our practices change, and change the date at the top. If a change is significant, we&rsquo;ll tell you by email or on the site before it takes effect.</p>

      <h2 id="contact">13. Contact</h2>
      <p>{COMPANY.legalName}, {COMPANY.address}. Privacy: <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>. Data Protection Officer: {DPO_NAME}.</p>
    </LegalPage>
  );
}
