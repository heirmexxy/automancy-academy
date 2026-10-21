import Link from "next/link";
import { LESSONS, BOSSES, FREE_LESSONS } from "./data";

export function Hero() {
  return (
    <header className="wrap hero">
      <div>
        <p className="for">For job seekers, professionals and business owners in Nigeria and across Africa</p>
        <h1>Build the AI automations businesses <em>pay for</em>.</h1>
        <p className="lede">Learn Zapier, Make, n8n and AI agents by rescuing one small business, step by step. Finish with working projects you can show, a Certificate in AI Automation, and a path to clients or a job. No coding background needed.</p>
        <div className="row">
          <Link className="btn" href="/signup">Start free</Link>
          <a className="btn alt" href="#course">See the course</a>
        </div>
        <p className="note" style={{ marginTop: 10 }}>Base Camp ({FREE_LESSONS} lessons and your first project) is free. No card needed.</p>
        <ul className="trust" aria-label="What's included">
          <li>{LESSONS} lessons</li>
          <li>{BOSSES.length} boss projects + capstone</li>
          <li>AI review of every mission</li>
          <li>Listen to any lesson</li>
          <li>Verifiable certificate</li>
        </ul>
      </div>
      <figure className="scene">
        <svg viewBox="0 0 440 300" role="img" aria-labelledby="scene-t">
          <title id="scene-t">An order travels from a phone message, through an automation trigger and an AI step, into a spreadsheet, ready for delivery.</title>
          <path className="flow" d="M72 88 C120 88 120 150 170 150 S250 88 290 88 S360 150 380 190" stroke="var(--spark)" strokeWidth="4" fill="none" />
          <rect x="40" y="46" width="60" height="96" rx="12" fill="var(--card)" stroke="var(--ink)" strokeWidth="3" />
          <rect x="48" y="60" width="44" height="14" rx="7" fill="var(--volt)" /><rect x="48" y="80" width="34" height="14" rx="7" fill="var(--line)" /><rect x="56" y="100" width="36" height="14" rx="7" fill="var(--volt)" />
          <text x="70" y="162" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="11" fill="var(--muted)">new order</text>
          <g className="pulse">
            <circle cx="170" cy="150" r="26" fill="var(--sun)" stroke="var(--ink)" strokeWidth="3" />
            <path d="M172 134 L162 152 L171 152 L166 166 L180 146 L171 146 Z" fill="var(--ink)" />
          </g>
          <text x="170" y="194" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="11" fill="var(--muted)">trigger</text>
          <rect x="262" y="60" width="56" height="56" rx="14" fill="var(--grape)" stroke="var(--ink)" strokeWidth="3" />
          <text x="290" y="96" textAnchor="middle" fontFamily="Bricolage Grotesque, sans-serif" fontWeight="800" fontSize="20" fill="#fff">AI</text>
          <text x="290" y="134" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="11" fill="var(--muted)">understand</text>
          <rect x="352" y="186" width="64" height="52" rx="6" fill="var(--card)" stroke="var(--ink)" strokeWidth="3" />
          <path d="M352 202 H416 M352 218 H416 M374 186 V238" stroke="var(--line)" strokeWidth="2" />
          <rect x="376" y="204" width="38" height="12" fill="var(--volt)" opacity=".5" />
          <text x="384" y="256" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="11" fill="var(--muted)">record + deliver</text>
          <rect x="24" y="214" width="168" height="54" rx="12" fill="var(--card)" stroke="var(--ink)" strokeWidth="2" />
          <text x="36" y="236" fontFamily="Atkinson Hyperlegible, sans-serif" fontSize="12" fill="var(--ink)">Tolu: &ldquo;It filled the sheet</text>
          <text x="36" y="254" fontFamily="Atkinson Hyperlegible, sans-serif" fontSize="12" fill="var(--ink)">by itself!&rdquo;</text>
        </svg>
      </figure>
    </header>
  );
}
