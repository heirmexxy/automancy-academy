import Image from "next/image";
import Link from "next/link";
import { SecHead, Steps } from "./SecHead";
import { WEEKS, BOSSES } from "./data";

export function Problem() {
  return (
    <section className="wrap" aria-labelledby="prob-h">
      <SecHead id="prob-h" eyebrow="The problem" title="AI is changing work faster than most people can keep up" />
      <div className="cols3">
        <div style={{ ["--c" as string]: "var(--spark)" } as React.CSSProperties}><h3>What's happening</h3><p>Businesses want AI that does real work: answering customers, confirming payments, writing reports. Very few people can build it, so the people who can are in demand.</p></div>
        <div style={{ ["--c" as string]: "var(--grape)" } as React.CSSProperties}><h3>How it feels</h3><p>Tutorials jump from &ldquo;hello world&rdquo; to jargon. You watch hours of videos and still haven't built anything that works, so you start to wonder if this is for you.</p></div>
        <div style={{ ["--c" as string]: "var(--teal)" } as React.CSSProperties}><h3>What should be true</h3><p>You shouldn't need a computer science degree to build tools that save a business hours every week. Most automation is clear thinking plus the right tools, and both can be learned.</p></div>
      </div>
    </section>
  );
}

export function Guide() {
  return (
    <section className="wrap" aria-labelledby="guide-h">
      <SecHead id="guide-h" eyebrow="Your guides" title="Learn from the team behind Kitovu"
        lede="Kitovu builds digital infrastructure for African agriculture: platforms that connect farmers, inputs, data and markets. Automation and AI are how a small team serves hundreds of thousands of farmers. Now we're teaching you to build the same way." />
      <div className="guide">
        {/* PLACEHOLDER: Kitovu figures and awards to confirm before launch (docs/placeholders/site.md) */}
        <div className="kstats">
          <div><b>25,000</b><span>smallholder farmers supported</span></div>
          <div><b>300,000</b><span>Abia farmers on the ADDS platform, digital infrastructure we built</span></div>
          <div><b>30,000+ t</b><span>of produce connected to market</span></div>
        </div>
        <ul className="kawards" aria-label="Kitovu's awards">
          <li>UN Science, Technology and Innovation Award 2020</li>
          <li>World Bank Ideas for Action 2017 winners</li>
          <li>Africa Prize for Innovation 2018</li>
          <li>Total Startupper Awards 2016</li>
          <li>Global Startup Awards Africa 2021</li>
        </ul>
        <div className="people">
          <div className="card person">
            <Image src="/img/emeka.jpg" alt="Nwachinemere Emeka" width={96} height={96} />
            <div className="stack" style={{ gap: 4 }}><h3>Nwachinemere Emeka</h3><span className="role">Founder &amp; CEO, Kitovu</span><p>Takes you through every other guided build: one real business problem, solved step by step.</p></div>
          </div>
          <div className="card person">
            <Image src="/img/miracle.jpg" alt="Nduka Miracle" width={96} height={96} />
            <div className="stack" style={{ gap: 4 }}><h3>Nduka Miracle</h3><span className="role">Co-founder, Kitovu</span><p>Takes you through the guided builds in between, from first workflow to growth agents.</p></div>
          </div>
        </div>
        <p className="note">Inside every lesson, one of us takes you through the guided build: a real problem, solved step by step.</p>
      </div>
    </section>
  );
}

export function Plan() {
  return (
    <section className="wrap" aria-labelledby="plan-h">
      <SecHead id="plan-h" eyebrow="The plan" title="Three steps from curious to paid" />
      <Steps items={[
        { title: "Learn", color: "var(--teal)", body: "Start with Base Camp, free. One 60–120 minute lesson a day, at the standard pace or your own. Stories, diagrams, animated walkthroughs and labs that run in your browser." },
        { title: "Build", color: "var(--spark)", body: `Solve a real problem in every lesson, beat ${BOSSES.length} boss projects and a capstone. Log each build in your learning journal. That's your portfolio.` },
        { title: "Get paid or hired", color: "var(--volt)", body: "Earn your Certificate in AI Automation, get a verified profile on the hiring page, and use the client playbook to win your first paid work." }
      ]} />
      <div className="row" style={{ marginTop: 18 }}><Link className="btn" href="/signup">Start free</Link><a href="#course">or browse the full course</a></div>
    </section>
  );
}

const HOW = [
  { t: "Animated walkthroughs", c: "var(--sky)", i: "▶", d: "Watch each build happen step by step, screen by screen, before you try it yourself, with a guide talking you through it." },
  { t: "Listen to any lesson", c: "var(--grape)", i: "♪", d: "A Listen button on every lesson reads it aloud in a natural voice, so you can learn on the bus, in the kitchen or with the screen off." },
  { t: "Templates for n8n, Make and Zapier", c: "var(--volt)", i: "⇩", d: "Import a working starting point for each build instead of beginning from a blank canvas, then change it to fit your own business." },
  { t: "AI review of every mission", c: "var(--spark)", i: "✓", d: "Submit a mission or a boss project and get feedback in minutes: what works, what to fix, and how it scores against the criteria. A person checks flagged work." },
  { t: "Certificate you can verify", c: "var(--teal)", i: "★", d: "Pass every boss project and the capstone to earn the Certificate in AI Automation, with a public page anyone can use to check it's real." },
  { t: "Story-led lessons", c: "var(--sun)", i: "✎", d: "Every lesson opens with a problem at Harvest Lane. You learn by fixing it, then solve a harder version for a business you know." },
  { t: "Glitch hunts", c: "var(--glitch)", i: "!", d: "Find and fix a deliberately broken workflow in every lesson. That's how you learn to debug." },
  { t: "Community and journal", c: "var(--rose)", i: "☺", d: "A learning journal that becomes your portfolio, a help board where peers unblock you, and a weekly leaderboard." }
];

export function HowItWorks() {
  return (
    <section className="wrap" aria-labelledby="how-h">
      <SecHead id="how-h" eyebrow="How learning works" title="Everything you need to go from first Zap to paid work" />
      <div className="feat">
        {HOW.map(h => (
          <div className="card" key={h.t} style={{ ["--c" as string]: h.c } as React.CSSProperties}>
            <span className="ic" aria-hidden="true">{h.i}</span>
            <h3>{h.t}</h3>
            <p className="muted">{h.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const AUD = [
  { k: "I'm looking for work", c: "var(--spark)",
    p: "You've applied for months, and every role asks for experience with AI tools you've never been taught to use.",
    g: `Build working systems in about ${WEEKS} weeks, with a guide and a community. Each one goes in your portfolio.`,
    s: "A verified portfolio, a Certificate in AI Automation, and a profile on our hiring page that employers can browse.",
    cta: ["Start free", "/signup"] },
  { k: "I have a job", c: "var(--grape)",
    p: "Your week disappears into copy-paste, reports and follow-ups, and you can see AI changing your job.",
    g: "Automate your own work first, one lesson a day at a pace that fits around your job.",
    s: "Hours back every week, and you become the person your company calls when it wants AI to do real work.",
    cta: ["Start free", "/signup"] },
  { k: "I run a business", c: "var(--volt)",
    p: "Orders arrive on WhatsApp, payments need checking, and your staff spend their day typing instead of selling.",
    g: "Learn to automate it yourself, train your team with team seats or a private workshop, or hire a graduate to build it.",
    s: "Orders confirmed in seconds, fewer mistakes, and a business that keeps running when you step away.",
    cta: ["Options for businesses", "/pricing#business"] },
  { k: "I'm hiring", c: "var(--sky)",
    p: "Every CV says “AI”, but few candidates have built anything you can check.",
    g: "Browse certified graduates with verified projects, badges and capstone results, and post a role they'll see.",
    s: "An automation builder who can show you their work before you hire them.",
    cta: ["Hire talent", "/hire"] }
];

export function Audiences() {
  return (
    <section className="wrap" aria-labelledby="who-h">
      <SecHead id="who-h" eyebrow="Start where you are" title="Which of these sounds like you?" />
      <div className="aud">
        {AUD.map(a => (
          <article className="card" key={a.k} style={{ ["--c" as string]: a.c } as React.CSSProperties}>
            <h3>{a.k}</h3>
            <dl>
              <dt>The problem</dt><dd>{a.p}</dd>
              <dt>How we help</dt><dd>{a.g}</dd>
              <dt>Where you'll be</dt><dd className="win">{a.s}</dd>
            </dl>
            <p><Link className="btn sm alt" href={a.cta[1]}>{a.cta[0]}</Link></p>
          </article>
        ))}
      </div>
    </section>
  );
}

/** Short pointer to the creator marketplace (/courses, /teach). */
export function Marketplace() {
  return (
    <section className="wrap" aria-labelledby="mkt-h">
      <div className="card mkt">
        <div className="stack" style={{ gap: 6 }}>
          <span className="eyebrow">More to learn</span>
          <h2 id="mkt-h" style={{ fontSize: "1.5rem" }}>Courses from other creators, and a place to teach your own</h2>
          <p className="muted">Browse practical courses by independent creators, reviewed before they go live. Have a skill people pay for? Teach it on Automancy.</p>
        </div>
        <div className="row"><Link className="btn alt sm" href="/courses">Browse courses</Link><Link className="btn alt sm" href="/teach">Teach on Automancy</Link></div>
      </div>
    </section>
  );
}

export function Success() {
  return (
    <section className="wrap" aria-labelledby="stake-h">
      <SecHead id="stake-h" eyebrow="What's at stake" title={`${WEEKS} weeks from now, which one is you?`} />
      <div className="stakes">
        <div className="card yes"><h3>With Automancy Academy</h3><ul>
          <li>You've built a WhatsApp order bot, a payment checker and an AI support agent that run without you.</li>
          <li>You can explain to a business owner what to automate, what it costs and what it saves.</li>
          <li>Your capstone ends with a results sheet: hours saved, orders won back, money made.</li>
          <li>Your profile shows verified projects, badges and a certificate employers can check.</li>
        </ul></div>
        <div className="card"><h3>Without a plan</h3><ul>
          <li>Another three months of tutorials, with nothing to show.</li>
          <li>Still doing the copy-and-paste work by hand.</li>
          <li>Watching AI jobs and clients go to people who started earlier.</li>
        </ul></div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <div className="wrap">
      <div className="finalcta">
        <h2>Your first automation is one lesson away.</h2>
        <p>Base Camp is free. No card needed.</p>
        <Link className="btn" href="/signup">Start free</Link>
      </div>
    </div>
  );
}
