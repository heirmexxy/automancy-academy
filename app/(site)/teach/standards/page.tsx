import Link from "next/link";
import type { Metadata } from "next";
import { CATEGORIES, MARKET, STANDARDS } from "../../courses/_lib/core";
import "../../courses/marketplace.css";

export const metadata: Metadata = {
  title: "Creator standards and course specifications",
  description: "What a course needs to be accepted on Automancy: quality standards, creator requirements, course specifications, formatting and the review process."
};

const n = (x: number) => x.toLocaleString("en-NG");

const SPECS: [string, string, string][] = [
  ["Title", "5–120 characters", "Say what learners will do: \"Automate your shop's WhatsApp orders with Make\", not \"Make Masterclass\"."],
  ["Subtitle", "Up to 200 characters", "One line on the result. Optional, but courses with one sell better."],
  ["Description", `${n(MARKET.minDescription)}–10,000 characters`, "Who it's for, what they'll build, what they need before starting (tools, accounts, budget), and what's inside. Formatting below."],
  ["Category", "One of the list below", "Pick the closest one; \"Other\" only if nothing fits."],
  ["Level", "Beginner, intermediate or advanced", "Beginner means no prior experience with the tool."],
  ["Language", "Any; English by default", "Lessons must all be in the language you choose."],
  ["Cover image", "https link, 16:9, at least 1280 × 720 px", "JPG or PNG under 1 MB, hosted somewhere public (your site, Cloudinary, Google Drive public link that ends in an image). Your own artwork or licensed; readable title; no third-party logos you don't have rights to."],
  ["Price", `₦${n(MARKET.minPriceNgn)}–₦${n(MARKET.maxPriceNgn)}; optional $${MARKET.minPriceUsd}–$${MARKET.maxPriceUsd}`, "Set in whole naira (steps of ₦100). The dollar price is optional, for learners outside Nigeria."],
  ["Lessons", `At least ${MARKET.minLessons}; we recommend 8–40`, "Group them into sections (modules). Aim for 3–8 lessons per section."],
  ["Free previews", "1–2 lessons", "Mark your best early lessons as free previews so people can try before they buy."],
  ["Reading lesson", "50–50,000 characters", "Formatted text (see below). Best for steps, explanations and checklists."],
  ["Video lesson", "YouTube, Vimeo or Loom link", "3–15 minutes each is ideal; 20 minutes maximum recommended. Unlisted links are fine. Add a short text summary under the video."],
  ["Quiz lesson", "1–30 questions, 2–6 options each", "One correct answer per question. Test understanding of the lesson, not trick wording."],
  ["Task lesson", "At least 20 characters of instructions", "A concrete thing to build or do, what \"done\" looks like, and how the learner can check their own work."]
];

const FORMAT: [string, string][] = [
  ["## Section heading", "Large heading (use ### and #### for smaller ones)"],
  ["**bold** and *italic*", "Bold and italic text"],
  ["- item  or  1. item", "Bulleted or numbered list (one item per line)"],
  ["[link text](https://example.com)", "Link (https, http, mailto or a site page only)"],
  ["`code`", "Inline code: field names, formulas, short commands"],
  ["``` on its own line, before and after", "Code block for longer code, JSON or expressions"],
  ["> text", "Quote or callout"],
  ["---", "Divider line"]
];

const OUTLINE = `Section 1: Start here
  1. Welcome: what you'll build and how the course works (video, free preview)
  2. Set up your accounts and tools (reading)
  3. Quick win: your first working result in 15 minutes (video, free preview)
  4. Check your setup (quiz)

Section 2: <first core skill>
  5. Concept, explained with a real example (video)
  6. Step-by-step build (video + written steps)
  7. Common mistakes and how to fix them (reading)
  8. Build it yourself (task)

Section 3, 4 ...: <next core skills, same pattern>

Final section: Project
  - Brief: build the full thing for a real or sample business (task)
  - Checklist to test it before going live (reading)
  - What to do next (reading)`;

const LESSON = `## What you'll do
One or two sentences on the result of this lesson.

## Before you start
- Account or tool needed
- File or template to download (link)

## Steps
1. First step, with exact names of buttons and fields
2. Second step
3. Test it: what you should see when it works

> Tip: one common mistake and how to avoid it.

## Check your work
- It's done when ...`;

export default function Standards() {
  return (
    <div className="wrap stack" style={{ gap: 28, paddingBottom: 40 }}>
      <section className="mk-hero">
        <p className="eyebrow">Teach on Automancy · Creator handbook</p>
        <h1>Standards and course specifications</h1>
        <p className="lede">Everything a course needs to be accepted and go live: who can teach, the quality bar, the exact specifications, how to format lessons, and how our review works. Read this before you build; we review every course against it.</p>
        <div className="row"><Link className="btn" href="/teach/apply">Apply to teach</Link><Link className="btn alt" href="/teach/studio">Open the creator studio</Link><Link className="btn alt" href="/teach/terms">Creator terms</Link></div>
      </section>

      <nav className="card" aria-label="On this page">
        <h2 style={{ fontSize: "1.1rem" }}>On this page</h2>
        <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 4 }}>
          <li><a href="#requirements">Who can teach</a></li>
          <li><a href="#standards">Quality standards</a></li>
          <li><a href="#specs">Course specifications</a></li>
          <li><a href="#structure">How to structure your course</a></li>
          <li><a href="#format">Formatting lessons</a></li>
          <li><a href="#video">Video and media</a></li>
          <li><a href="#rules">Content rules</a></li>
          <li><a href="#review">Submission and review</a></li>
          <li><a href="#pricing">Pricing and earnings</a></li>
          <li><a href="#checklist">Checklist before you submit</a></li>
        </ol>
      </nav>

      <section className="stack" id="requirements">
        <h2>1. Who can teach</h2>
        <div className="card prose">
          <ul>
            <li><b>An Automancy account</b> with a verified email address.</li>
            <li><b>An approved creator application.</b> Tell us who you are, what you've built or achieved that qualifies you, and what you want to teach. We approve creators by hand, usually within a week.</li>
            <li><b>Real experience.</b> You use what you teach in your own work or for clients. Evidence helps: a portfolio, LinkedIn profile, case study or live project.</li>
            <li><b>A Nigerian bank account</b> in your name (or your registered business's name) to receive payouts.</li>
            <li><b>Acceptance of the <Link href="/teach/terms">creator terms</Link></b>, including that your course is your own work.</li>
            <li>You must be 18 or older.</li>
          </ul>
        </div>
      </section>

      <section className="stack" id="standards">
        <h2>2. Quality standards</h2>
        <p className="muted">Our reviewers tick each of these before a course goes live. A course that misses one is sent back with notes.</p>
        <div className="grid2">
          {STANDARDS.map((s, i) => (
            <div key={s.key} className="card"><h3>{i + 1}. {s.title}</h3><p>{s.check}</p></div>
          ))}
        </div>
      </section>

      <section className="stack" id="specs">
        <h2>3. Course specifications</h2>
        <p className="muted">The studio checks the items marked as limits automatically and won't let you submit until they're met.</p>
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="dt">
            <thead><tr><th>Item</th><th>Requirement</th><th>Guidance</th></tr></thead>
            <tbody>{SPECS.map(([a, b, c]) => <tr key={a}><td><b>{a}</b></td><td>{b}</td><td>{c}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="note">Categories: {CATEGORIES.join(", ")}.</p>
      </section>

      <section className="stack" id="structure">
        <h2>4. How to structure your course</h2>
        <div className="grid2">
          <div className="card stack">
            <h3>Recommended outline</h3>
            <p>Start with a quick win, teach one skill per section, end every section with practice, and finish with a project. Copy this outline into your planning notes:</p>
            <pre className="md" style={{ whiteSpace: "pre-wrap", margin: 0, background: "var(--paper2)", border: "1.5px solid var(--line)", borderRadius: 10, padding: 12, font: ".85rem/1.5 var(--mono)" }}>{OUTLINE}</pre>
          </div>
          <div className="card stack">
            <h3>Lesson template</h3>
            <p>Use the same shape for every reading lesson (or the text under a video) so learners always know where to look:</p>
            <pre className="md" style={{ whiteSpace: "pre-wrap", margin: 0, background: "var(--paper2)", border: "1.5px solid var(--line)", borderRadius: 10, padding: 12, font: ".85rem/1.5 var(--mono)" }}>{LESSON}</pre>
          </div>
        </div>
        <div className="card prose">
          <ul>
            <li><b>One idea per lesson.</b> If a lesson needs more than 15 minutes, split it.</li>
            <li><b>Descriptive titles.</b> &ldquo;Send a WhatsApp confirmation when an order is paid&rdquo; beats &ldquo;Lesson 6&rdquo;.</li>
            <li><b>Use sample data.</b> Use a sample business and test accounts. Never show real customers' names, phone numbers, emails or payment details.</li>
            <li><b>Use local context where it helps:</b> naira prices, Nigerian tools and payment providers, realistic business examples.</li>
          </ul>
        </div>
      </section>

      <section className="stack" id="format">
        <h2>5. Formatting lessons</h2>
        <p className="muted">Reading lessons, task instructions and the course description use simple text formatting (a safe version of Markdown). Type it straight into the studio and use &ldquo;Preview as learner&rdquo; to check it.</p>
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="dt">
            <thead><tr><th>Type this</th><th>To get</th></tr></thead>
            <tbody>{FORMAT.map(([a, b]) => <tr key={a}><td><code>{a}</code></td><td>{b}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="card prose">
          <ul>
            <li><b>Not supported:</b> HTML, scripts, embedded forms, tables and inline images. Anything like <code>&lt;b&gt;</code> shows as plain text.</li>
            <li><b>For a table,</b> use a list, or link to a Google Sheet or a public file.</li>
            <li><b>For screenshots and diagrams,</b> show them in your video, or link to them.</li>
            <li><b>For templates and downloads</b> (Make blueprints, n8n JSON, Sheets), link to a public file you own, and remove any keys, tokens or personal data first.</li>
            <li>Leave a blank line between paragraphs, headings and lists.</li>
          </ul>
        </div>
      </section>

      <section className="stack" id="video">
        <h2>6. Video and media</h2>
        <div className="card prose">
          <ul>
            <li><b>Hosting:</b> upload to YouTube (public or unlisted), Vimeo or Loom, then paste the share link. Private videos won't play for learners.</li>
            <li><b>Quality:</b> at least 720p (1080p preferred), screen text readable on a phone, and clear audio with no background music over speech. A cheap external mic is worth it.</li>
            <li><b>Length:</b> 3–15 minutes per video. Cut setup pauses, loading screens and mistakes you don't explain.</li>
            <li><b>Captions</b> are strongly recommended (YouTube's auto-captions, checked for errors, are fine).</li>
            <li><b>Screens:</b> hide passwords, API keys, OTPs, customer data and private messages before recording. Blur anything you miss before uploading.</li>
            <li><b>AI-generated</b> voices, videos or images are allowed if they're accurate and clearly presented; don't imitate a real person's voice or face without their permission.</li>
            <li>Add a short written summary or steps under each video for learners on slow connections.</li>
          </ul>
        </div>
      </section>

      <section className="stack" id="rules">
        <h2>7. Content rules</h2>
        <div className="grid2">
          <div className="card">
            <h3>Every course must</h3>
            <ul>
              <li>Be your original work, or material you have the right to sell.</li>
              <li>Teach something a learner can do by the end.</li>
              <li>Use automation that follows each platform's rules (WhatsApp, Meta, Google, LinkedIn and so on) and the law, including the Nigeria Data Protection Act and consent for messaging.</li>
              <li>Keep risky actions (sending money, mass messaging, deleting data) behind a human check and test mode.</li>
            </ul>
          </div>
          <div className="card">
            <h3>We don't accept</h3>
            <ul>
              <li>Copyrighted material you don't own: other people's videos, paid courses, books or templates.</li>
              <li>Get-rich-quick claims, guaranteed income, or &ldquo;make ₦1m in a week&rdquo; promises.</li>
              <li>Spam, scraping that breaks terms of service, fake engagement, or ways around platform limits.</li>
              <li>Lessons that ask learners for passwords, API keys, OTPs or bank details, or to send them to you.</li>
              <li>Links that push learners to pay you outside Automancy for the same content.</li>
              <li>Hateful, misleading, adult or dangerous content.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="stack" id="review">
        <h2>8. Submission and review</h2>
        <ol className="mk-steps" style={{ padding: 0 }}>
          <li className="card"><h3>Build</h3><p>Create the course in the <Link href="/teach/studio">studio</Link>: details, cover, price, sections and lessons. Preview it as a learner.</p></li>
          <li className="card"><h3>Submit</h3><p>When the automatic checks pass, confirm it meets these standards and submit. Editing is locked while it's in review; you can withdraw it to edit.</p></li>
          <li className="card"><h3>Review</h3><p>A person reads every lesson and watches the videos against the standards above, in about {MARKET.reviewDays} working days.</p></li>
          <li className="card"><h3>Decision</h3><p><b>Approved:</b> it goes live in the catalogue. <b>Changes requested:</b> you get notes, fix them and resubmit. <b>Rejected:</b> it breaks the content rules; you get the reason.</p></li>
        </ol>
        <div className="card prose">
          <ul>
            <li><b>Updating a live course:</b> your changes appear straight away and go back into review. We may ask you to fix or undo them.</li>
            <li><b>After launch</b> we watch ratings, refund requests and reports. Courses with repeated problems may be unlisted until they're fixed.</li>
            <li><b>Most common reasons we send courses back:</b> the description promises more than the lessons deliver; videos with unreadable screens or poor audio; lessons that are only a link; outdated steps; keys or customer data visible on screen.</li>
          </ul>
        </div>
      </section>

      <section className="stack" id="pricing">
        <h2>9. Pricing and earnings</h2>
        <div className="card prose">
          <p>You choose the price between ₦{n(MARKET.minPriceNgn)} and ₦{n(MARKET.maxPriceNgn)}. As a guide: short single-skill courses (1–2 hours) sell well at ₦5,000–₦15,000; complete project courses (3–8 hours) at ₦15,000–₦50,000; advanced or professional courses higher.</p>
          <p>You receive <b>{Math.round(MARKET.revenueShare * 100)}%</b> of each sale after the payment processor's fee. Earnings become available after the {MARKET.refundWindowDays}-day refund window and are paid to your bank account. Full details are in the <Link href="/teach/terms">creator terms</Link>.</p>
        </div>
      </section>

      <section className="stack" id="checklist">
        <h2>10. Checklist before you submit</h2>
        <div className="card prose">
          <ul>
            <li>Title, subtitle and description say who it's for and what they'll be able to do.</li>
            <li>Cover image is 16:9, sharp and yours.</li>
            <li>Price is set; one or two lessons are free previews.</li>
            <li>At least {MARKET.minLessons} complete lessons, in sections, each with a clear title.</li>
            <li>Every section ends with a quiz or task; there's a final project.</li>
            <li>Every video plays, is readable on a phone and has clear sound.</li>
            <li>No keys, passwords, OTPs or real customer data anywhere on screen or in files.</li>
            <li>Every link and download works and is yours to share.</li>
            <li>You've previewed the whole course as a learner.</li>
          </ul>
        </div>
        <div className="card bold row" style={{ justifyContent: "space-between" }}>
          <div className="stack" style={{ gap: 4 }}><h3>Ready to build?</h3><p className="muted">Apply once; then create as many courses as you like.</p></div>
          <div className="row"><Link className="btn" href="/teach/apply">Apply to teach</Link><Link className="btn alt" href="/teach/studio">Open the studio</Link></div>
        </div>
      </section>
    </div>
  );
}
