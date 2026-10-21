import Link from "next/link";
import type { Metadata } from "next";
import { COMPANY, SUPPORT_EMAIL, SITE_URL, SITE_NAME } from "@/lib/config";
import { REFERRAL, product } from "@/lib/pricing";
import { ngn } from "@/lib/format";
import { LegalPage } from "../LegalPage";
import { COURTS } from "../meta";

export const metadata: Metadata = { title: "Terms of use", description: "The agreement between you and Automancy Academy." };

const pct = (n: number) => `${Math.round(n * 100)}%`;

export default function Terms() {
  const self = product("self");
  const months = self?.accessDays ? Math.round(self.accessDays / 30.4) : 12;
  return (
    <LegalPage title="Terms of use" current="/legal/terms" summary={<ul>
      <li>You must be 18 or older. Keep your login to yourself: one account per person.</li>
      <li>You may use the lessons for your own learning, and use the templates in your own work, including paid client work. You may not resell or share the course.</li>
      <li>Follow the rules of every platform you automate. No spam, no scraping where it's not allowed.</li>
      <li>AI feedback can be wrong. It is guidance, not professional advice.</li>
      <li>Refer friends honestly, say you earn a commission, and never refer yourself.</li>
      <li>Courses by other creators belong to them. We review them before they go live, but we aren't responsible for what they teach.</li>
      <li>We don't promise jobs or income. Nigerian law applies.</li>
    </ul>}>
      <h2 id="who">1. Who we are</h2>
      <p>{SITE_NAME} (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is an online course in AI automation provided at <a href={SITE_URL}>{SITE_URL}</a> by {COMPANY.legalName}, a company registered in Nigeria (RC {COMPANY.rcNumber}), {COMPANY.address}. You can reach us at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
      <p>These terms are the agreement between you and us when you create an account, take a lesson, buy anything or join the referral programme. Our <Link href="/legal/privacy">privacy policy</Link>, <Link href="/legal/refunds">refund policy</Link> and <Link href="/legal/certificate">certificate policy</Link> form part of these terms. By creating an account you accept them. If you don't agree, please don't use the service.</p>

      <h2 id="account">2. Your account</h2>
      <ul>
        <li>You must be at least 18 years old to create an account.</li>
        <li>Give us accurate details, and keep your name up to date: it is the name used on your certificate.</li>
        <li>One account per person. Don't share your login or let anyone else use your account, and keep your password safe. Tell us straight away at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> if you think someone else has used it.</li>
        <li>You are responsible for what happens under your account.</li>
        <li>Business accounts (team seats) must assign each seat to one named person. A seat can be moved to another employee once, if the first person has not started the paid lessons.</li>
      </ul>

      <h2 id="access">3. Free and paid access</h2>
      <p>Base Camp is free. The rest of the course, add-ons and Membership need a paid product, listed with its price and what it includes on the <Link href="/pricing">pricing page</Link>. Access lasts for the period shown for that product: for example, the Self-paced course gives {months} months&rsquo; access from the date you pay. When access ends you can still log in, see your account and certificate, and download your data.</p>
      <p>We keep improving the course. We may update, reorder or replace lessons, tools and features, as long as the paid product still gives you substantially what was described when you bought it.</p>

      <h2 id="licence">4. Using the course materials</h2>
      <p>The lessons, stories, characters, videos, audio, quizzes, walkthroughs, templates and other materials belong to us or our licensors. When you have access, we give you a personal, non-exclusive, non-transferable licence to use them for your own learning.</p>
      <ul>
        <li><b>Templates:</b> you may import, change and use the workflow templates in your own projects and in work you do for your employer or paying clients, and you may hand the finished workflows over to them. You may not sell, publish or give away the templates themselves, alone or as a pack, course or marketplace listing.</li>
        <li>You may not copy, record, resell, share, publish or make available any part of the course to people who haven't bought it, or use the materials to build a competing course.</li>
        <li>You may not use automated tools to download or copy the course, or try to get around access controls, rate limits or payment.</li>
      </ul>
      <p><b>Your work stays yours.</b> You own what you submit: missions, projects, journal entries and community posts. You give us a non-exclusive licence to store, process and show it as needed to run the service: to review it (including with AI, see section 7), show it to you and our reviewers, and show it publicly only where you choose to (for example a public community post or your Hire talent profile). We will only use your work as a case study or in marketing with your separate permission.</p>

      <h2 id="conduct">5. How we expect you to behave</h2>
      <ul>
        <li>Submit your own work. You may use AI tools while you build, as the course teaches, but you must understand what you submit and must not pass off someone else&rsquo;s work as yours.</li>
        <li>Be respectful in the community. No harassment, hate, threats, sexual content, scams or spam.</li>
        <li>Don&rsquo;t put other people&rsquo;s personal data, passwords, API keys or confidential client information into submissions, posts or questions to the assistant. Use test data or remove details first.</li>
        <li>Don&rsquo;t try to break, overload or probe the service, or misuse the AI reviewer or assistant (for example, trying to make it ignore its instructions or award marks).</li>
      </ul>

      <h2 id="platforms">6. Following the rules of the platforms you use</h2>
      <p>The course teaches you to use third-party platforms, including Zapier, Make, n8n, AI model providers, WhatsApp and other Meta products, Telegram, email services, HubSpot and Zoho. You use those platforms under your own accounts and their own terms, and you pay any charges they make.</p>
      <ul>
        <li>Follow each platform&rsquo;s terms and policies, and the law, including the Nigeria Data Protection Act 2023 and similar laws where your customers are.</li>
        <li>Don&rsquo;t send spam or unsolicited bulk messages, buy contact lists, or message people who haven&rsquo;t agreed to hear from you.</li>
        <li>Don&rsquo;t scrape websites or platforms where their terms or the law don&rsquo;t allow it.</li>
        <li>Get permission before you automate anything for a business, and protect the data you handle for them.</li>
      </ul>
      <p>You are responsible for the automations you build and run, for yourself or for clients. We are not responsible for what happens when they run.</p>

      <h2 id="ai">7. AI review and the assistant</h2>
      <p>We use AI to review missions and projects and to answer questions about the lessons. AI can make mistakes. Its feedback and scores are guidance to help you learn, not professional, legal, financial or technical advice, and you should check important answers yourself.</p>
      <p>Decisions that count towards your certificate are made with AI assistance and checked by a person: we review any submission the AI flags and a sample of the rest. If you think a review is wrong, ask for a human review at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. See the <Link href="/legal/certificate">certificate policy</Link> and, for how your submissions are processed, the <Link href="/legal/privacy#processors">privacy policy</Link>.</p>
      <p>To keep the service fair and affordable, we limit how often you can use AI review, the assistant and audio generation.</p>

      <h2 id="payments">8. Prices and payments</h2>
      <ul>
        <li>Prices are shown on the <Link href="/pricing">pricing page</Link> in naira and US dollars. The price you pay is fixed when you pay; later price changes don&rsquo;t affect what you&rsquo;ve bought.</li>
        <li>Payments are processed by Paystack. We never see or store your full card details.</li>
        <li>Prices include any value added tax we are required to charge. Your bank may add its own fees, for example for international payments.</li>
        <li>Discounts and referral discounts apply only as described at checkout and can&rsquo;t be combined unless we say so.</li>
      </ul>
      <h3 id="instalments">Paying in instalments</h3>
      <p>Where a product offers instalments (&ldquo;Pay in 3&rdquo;), you pay in naira in equal instalments about a month apart. Each instalment gives you access until the next one is due. If an instalment isn&rsquo;t paid, access to the paid parts pauses until it is; your progress is kept. Once you have paid every instalment, your full access period counts from the date of your first payment. Choosing instalments is not a loan and we don&rsquo;t charge interest.</p>
      <h3 id="membership">Membership</h3>
      <p>Membership is paid one month at a time. You can stop at any time; your access continues until the end of the month you&rsquo;ve paid for.</p>
      <h3>Refunds</h3>
      <p>Refunds are covered by our <Link href="/legal/refunds">refund policy</Link>. Nothing in these terms affects your rights under the Federal Competition and Consumer Protection Act 2018 or other consumer laws that apply to you.</p>

      <h2 id="referrals">9. Referral programme</h2>
      <p>Anyone with an account can join the referral programme from <Link href="/earn">Refer &amp; earn</Link>. These rules apply:</p>
      <ul>
        <li><b>Your friend&rsquo;s discount:</b> people who buy a plan through your link or code get {pct(REFERRAL.friendDiscount)} off. The discount doesn&rsquo;t apply to Membership renewals or add-ons.</li>
        <li><b>Commission:</b> you earn {pct(REFERRAL.tiers.friend)} of what your referral pays for eligible products (Friend level), {pct(REFERRAL.tiers.graduate)} once you hold a valid certificate (Graduate level), or {pct(REFERRAL.tiers.ambassador)} as an Ambassador (10 or more paid referrals in 90 days). Template packs earn {pct(REFERRAL.packCommission)}. Commission is calculated on the amount actually paid, after discounts, and on each instalment as it is paid. Payments in dollars are converted to naira at the product&rsquo;s own price ratio.</li>
        <li><b>Attribution:</b> a referral counts if the person buys within {REFERRAL.attributionDays} days of clicking your link. If they click more than one person&rsquo;s link, the last link before they pay counts.</li>
        <li><b>When you get paid:</b> commission becomes payable after the buyer&rsquo;s {REFERRAL.refundWindowDays}-day refund window closes. We pay approved earnings in naira by bank transfer through Paystack on the schedule shown on Refer &amp; earn, once your balance reaches at least {ngn(REFERRAL.minPayoutNgn)}; smaller balances roll over. You must give us correct bank details; we store only the last four digits of your account number and Paystack&rsquo;s recipient code.</li>
        <li><b>Refunds and chargebacks:</b> if a referred payment is refunded or charged back, the commission on it is cancelled. If it has already been paid to you, we deduct it from your pending or future earnings.</li>
        <li><b>Promote honestly:</b> recommend us only if you believe in the course, describe it accurately, and always say that you earn a commission. Never promise jobs, income or results.</li>
        <li><b>Not allowed:</b> referring yourself or your own other accounts, creating fake accounts, spam (unsolicited messages, bulk posting in groups, bought lists), misleading claims, pretending to be us, and bidding on &ldquo;Automancy&rdquo; or our name in search or social ads.</li>
        <li>If you break these rules we may withhold or cancel affected earnings and close your referral account. Commission is not wages, and taking part doesn&rsquo;t make you our employee or agent. You are responsible for any tax on your earnings.</li>
        <li>We may change commission rates or end the programme with 30 days&rsquo; notice on the Refer &amp; earn page. Earnings already approved will still be paid.</li>
      </ul>

      <h2 id="creators">10. Courses by other creators</h2>
      <p>Alongside our own course, the <Link href="/courses">course catalogue</Link> lists courses made by independent creators who teach on {SITE_NAME}.</p>
      <ul>
        <li><b>Their content is theirs.</b> Each creator owns their course and is responsible for what it teaches and for any claims they make about it. When you buy a creator&rsquo;s course, section 4 applies to it in the same way: you get a personal licence to use it for your own learning.</li>
        <li><b>We review courses before they go live.</b> We check each course against our content standards before it appears in the catalogue, and we can remove a course that breaks them. Our review is not an endorsement, and we don&rsquo;t check every statement in it.</li>
        <li><b>Our responsibility is limited.</b> To the extent the law allows, we are not liable for the content, accuracy or results of courses made by other creators. We still handle payments and refunds for them under our <Link href="/legal/refunds">refund policy</Link>, and you can report a problem with any course to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</li>
        <li>A creator&rsquo;s course doesn&rsquo;t count towards the Automancy Certificate in AI Automation unless we say so on the course page.</li>
        <li>If you want to teach, see <Link href="/teach">Teach on {SITE_NAME}</Link>. Creators also agree to the <Link href="/teach/terms">creator terms</Link>.</li>
      </ul>

      <h2 id="outcomes">11. No promise of jobs or income</h2>
      <p>The course is designed to help you build useful skills and a portfolio. We don&rsquo;t promise that you will find a job, win clients or earn any amount of money. That depends on many things outside our control. The <Link href="/legal/certificate">certificate</Link> is not an accredited qualification or a professional licence.</p>

      <h2 id="third-party">12. Third-party services and links</h2>
      <p>Lessons link to free videos, courses and tools run by others. We don&rsquo;t control them and aren&rsquo;t responsible for their content, availability or charges. Zapier, Make, n8n, HubSpot, Zoho, Salesforce, WhatsApp and other names are trademarks of their owners; {SITE_NAME} is independent and not endorsed by them.</p>
      <p><b>Learning on WhatsApp.</b> If you link your WhatsApp number, the same account, progress, access rules and AI review apply in WhatsApp as on the website. WhatsApp is run by Meta under its own terms; your mobile network may charge for data. Hands-on tasks still need a computer. Reply STOP to stop messages at any time.</p>

      <h2 id="availability">13. Availability</h2>
      <p>We work to keep the service available, but we can&rsquo;t promise it will always be uninterrupted or error-free. We may need to pause it for maintenance or for reasons outside our control.</p>

      <h2 id="liability">14. Our liability</h2>
      <p>Nothing in these terms limits liability that the law doesn&rsquo;t allow us to limit, such as liability for fraud, or for death or personal injury caused by our negligence, or your statutory consumer rights.</p>
      <p>Otherwise, to the extent the law allows:</p>
      <ul>
        <li>we are not liable for indirect or consequential losses, lost profits, lost business or lost data;</li>
        <li>we are not liable for charges from third-party platforms, or for losses caused by automations you build or run;</li>
        <li>our total liability to you for any claim is limited to the amount you paid us in the 12 months before the claim.</li>
      </ul>

      <h2 id="ending">15. Suspending or closing accounts</h2>
      <p>You can ask us to close your account at any time from <Link href="/account#data">Account</Link>. We may suspend or close an account, or remove content, if you seriously or repeatedly break these terms, misuse the service, or if the law requires it. Where it&rsquo;s fair to do so, we will tell you why and give you a chance to respond. If we close your account because we&rsquo;ve stopped offering a paid product you still have access to, we&rsquo;ll refund the unused part.</p>

      <h2 id="law">16. Law and disputes</h2>
      <p>These terms are governed by the laws of the Federal Republic of Nigeria. If something goes wrong, please contact us first at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>; we&rsquo;ll try to resolve it within 30 days. If we can&rsquo;t, disputes will be decided by {COURTS}. If you live outside Nigeria, you keep any protection that the consumer laws of your country give you and that can&rsquo;t be excluded by agreement.</p>

      <h2 id="changes">17. Changes to these terms</h2>
      <p>We may update these terms from time to time. If a change matters to you, we&rsquo;ll tell you by email or on the site at least 14 days before it takes effect. If you don&rsquo;t agree with a change, you can close your account and, where you&rsquo;ve paid for access you can no longer use as agreed, ask for a refund of the unused part. The date at the top shows when these terms last changed.</p>

      <h2 id="contact">18. Contact</h2>
      <p>{COMPANY.legalName}, {COMPANY.address}. Email: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
    </LegalPage>
  );
}
