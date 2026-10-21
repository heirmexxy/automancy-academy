import Link from "next/link";
import type { Metadata } from "next";
import "@/components/landing/landing.css";
import "./careers.css";
import { product } from "@/lib/pricing";
import { SecHead, Steps } from "@/components/landing/SecHead";
import { WaitlistForm } from "@/components/landing/PlanCard";
import { priceText } from "@/components/landing/data";

export const metadata: Metadata = { title: "Careers", description: "Six career paths from the same course, the free credentials to add, and the CRM Implementation specialisation." };

const X = ({ href, children }: { href: string; children: React.ReactNode }) =>
  <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;

type Path = { n: number; title: string; color: string; body: string; deep: React.ReactNode; creds: React.ReactNode; paid?: React.ReactNode; show: string };

const PATHS: Path[] = [
  { n: 1, title: "AI Automation Specialist", color: "var(--spark)",
    body: "Connect a business's apps so work moves by itself: orders, invoices, reports, onboarding. Often the first hire a small company makes for “AI”.",
    deep: "Tracks 1–3 (Zapier, Make, n8n), Boss 1–3",
    creds: <><X href="https://academy.make.com/">Make Academy courses</X> · <X href="https://docs.n8n.io/courses/">n8n courses</X></>,
    show: "Boss 2 and Boss 3, with your proof-of-work logs as case studies" },
  { n: 2, title: "AI Agent Developer", color: "var(--grape)",
    body: "Build agents that use tools, remember customers, answer from documents and ask a person before risky actions, and measure whether they're good enough.",
    deep: "Track 4 (agents, RAG, MCP, evals), Boss 4",
    creds: <><X href="https://huggingface.co/learn/agents-course">Hugging Face AI Agents Course</X> (free certificate)</>,
    show: "Sage Desk (Boss 4) with its eval report" },
  { n: 3, title: "CRM Implementation Specialist", color: "var(--rose)",
    body: "Set up HubSpot, Zoho or Salesforce for a company: pipelines, clean data, imports, automation, integrations, dashboards and training, and build agents that audit and optimise the CRM with a person approving each change. Companies buy CRMs; they need people who make them work.",
    deep: <>5.8 and 5.9, Boss 5, then the <a href="#careers-crm">CRM specialisation</a></>,
    creds: <><X href="https://academy.hubspot.com/certification-overview">HubSpot Academy</X>: Inbound Sales, Sales Hub Software, Revenue Operations, Reporting · <X href="https://trailhead.salesforce.com/">Salesforce Trailhead</X> badges</>,
    paid: "Salesforce Certified Platform Administrator (US$200 exam; US$100 retake). Zoho doesn't currently certify administrators.",
    show: "A CRM you set up for a real business, and your CRM Ops Agent's health reports, with before-and-after numbers" },
  { n: 4, title: "Growth and Marketing Automation", color: "var(--sun)",
    body: "Run the systems that bring customers in: prospecting within the rules, social media, social inbox, email campaigns that land, and reports that show what each customer costs.",
    deep: "Track 5 (The Signal Tower), Boss 5",
    creds: <><X href="https://academy.hubspot.com/certification-overview">HubSpot Inbound</X> · <X href="https://academy.hubspot.com/courses/email-marketing">HubSpot email marketing</X> · <X href="https://www.facebook.com/business/learn">Meta Blueprint courses</X></>,
    show: "Growth Desk's growth report: source to customer, cost per customer" },
  { n: 5, title: "Customer Support Automation", color: "var(--volt)",
    body: "Give customers fast, consistent answers on WhatsApp, email and social, with people handling the hard cases on time.",
    deep: "4.3–4.5, 5.1, 5.5, 5.7, Boss 4",
    creds: <><X href="https://huggingface.co/learn/agents-course">Hugging Face AI Agents Course</X> · <X href="https://academy.hubspot.com/certification-overview">HubSpot Academy</X> service courses</>,
    show: "One inbox for every channel, with response times before and after" },
  { n: 6, title: "Freelancer or Automation Agency", color: "var(--sky)",
    body: "Sell automation to businesses yourself: find the costly process, scope it, price on value, deliver, hand over and keep a monthly retainer.",
    deep: "Track 6 (Launchpad) and the Grand Capstone",
    creds: "Your Automancy certificate and three case studies matter more here than any badge",
    show: "A portfolio page with three projects, and the capstone adapted to a second industry" }
];

export default async function Careers({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const crm = product("crmspec");
  return (
    <div className="wrap careers">
      <header className="sec-head" style={{ paddingTop: 36 }}>
        <span className="eyebrow">Careers</span>
        <h1>Where these skills can take you</h1>
        <p className="lede">The same course leads to several kinds of work. Pick the path that fits you, follow its lessons, add the free credentials employers already recognise, and prove it with a project you can show. We don't promise jobs or income; we help you build the evidence that gets you hired.</p>
        <div className="row"><a className="btn" href="#careers-paths">See the paths</a><a className="btn alt" href="#careers-crm">CRM specialisation</a><Link href="/hire">How employers find graduates</Link></div>
      </header>

      <section id="careers-paths" aria-labelledby="cp-h">
        <SecHead id="cp-h" title="Six career paths" lede="Every path starts with Base Camp and ends with the Grand Capstone. What changes is where you go deepest and which credentials you add." />
        <div className="cpaths">
          {PATHS.map(p => (
            <article key={p.n} className="card cpath" style={{ ["--c" as string]: p.color } as React.CSSProperties} aria-labelledby={`path-${p.n}`}>
              <span className="eyebrow">Path {p.n}</span>
              <h3 id={`path-${p.n}`}>{p.title}</h3>
              <p>{p.body}</p>
              <dl>
                <dt>Go deepest in</dt><dd>{p.deep}</dd>
                <dt>Free credentials to add</dt><dd>{p.creds}</dd>
                {p.paid && <><dt>Paid, optional</dt><dd>{p.paid}</dd></>}
                <dt>Show</dt><dd>{p.show}</dd>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="ch-h">
        <SecHead id="ch-h" title="How to get your first role or client" />
        <Steps items={[
          { title: "Build in public", color: "var(--sky)", body: "Post each boss project with your proof-of-work log. Employers see what you can do, not just what you studied." },
          { title: "Do one real project", color: "var(--rose)", body: "Every Gold mission is for a real business. One honest result with numbers beats ten tutorials." },
          { title: "Get found", color: "var(--volt)", body: <>Graduates get a verified profile on <Link href="/hire">Hire talent</Link>, and the certificate links to a public verification page.</> }
        ]} />
      </section>

      <section id="careers-crm" aria-labelledby="crm-h" style={{ scrollMarginTop: 70 }}>
        <SecHead id="crm-h" title="CRM Implementation specialisation"
          lede="For graduates who want Path 3. Lessons 5.8 and 5.9 teach you to set up and automate a CRM on the free plans. The specialisation goes further: paid-plan features, migrations, an agent that carries out implementations, and running a full implementation for a client." />
        <p id="crmspec" style={{ scrollMarginTop: 70 }}><span className="pill warn">Coming later</span></p>
        <div className="grid2" style={{ marginTop: 12 }}>
          <div className="card"><h3>Outline (≈ 18 hours)</h3><ol className="olist">
            <li><b>Discovery and requirements:</b> map the sales process, audit the data, agree what success looks like.</li>
            <li><b>HubSpot in depth:</b> paid-plan workflows, sequences, quotes, custom reports, permissions.</li>
            <li><b>Zoho CRM in depth:</b> Blueprint, workflow rules, Zoho Flow, and a first look at Deluge scripts.</li>
            <li><b>Migration:</b> from spreadsheets or another CRM: field mapping, de-duplication, test loads, cut-over day.</li>
            <li><b>Integrations:</b> website forms, WhatsApp, Paystack, accounting tools, via APIs and webhooks.</li>
            <li><b>Adoption and handover:</b> training, playbooks, dashboards, and a 30-day check-in.</li>
            <li><b>Salesforce on-ramp:</b> a guided Trailhead path, and how to prepare for the Platform Administrator exam if you choose to.</li>
            <li><b>Build a CRM Implementation Agent:</b> an agent team that audits a client's CRM and data, drafts the design (pipeline, fields, automations), plans the migration, and carries out each approved step through the API, with before-and-after checks and a rollback plan.</li>
            <li><b>Specialisation project:</b> use your agent to implement or optimise a CRM for a real business, with a person approving every change, reviewed by a mentor.</li>
          </ol></div>
          <div className="card">
            <h3>Who it's for</h3>
            <ul className="olist"><li>Graduates who finished Track 5</li><li>Sales or operations staff who look after their company's CRM</li><li>Freelancers adding CRM setup to their services</li></ul>
            {crm && <>
              <h3 style={{ marginTop: 8 }}>Price</h3>
              <p>{priceText(crm, "ngn")} or {priceText(crm, "usd")}, with a specialisation certificate. See <Link href="/pricing">Pricing</Link>.</p>
              {sp.waitlisted === "crmspec"
                ? <p className="alert ok" role="status">You're on the waitlist. We'll email you when it opens.</p>
                : <>{sp.error && <p className="alert bad" role="alert">{sp.error}</p>}<WaitlistForm productId="crmspec" back="/careers" /></>}
            </>}
            <p className="note" style={{ marginTop: 8 }}>HubSpot, Zoho and Salesforce are trademarks of their owners. This specialisation is independent and not endorsed by them; their own certifications are earned directly from them.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
