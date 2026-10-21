import Link from "next/link";
import "./legal.css";
import { LEGAL_UPDATED } from "./meta";

const PAGES = [
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/refunds", label: "Refunds" },
  { href: "/legal/certificate", label: "Certificate" }
];

/** Shell for a legal page: title, last-updated date, a short summary box, then the full text. */
export function LegalPage({ title, current, summary, children }: { title: string; current: string; summary: React.ReactNode; children: React.ReactNode }) {
  return (
    <article className="narrow legal">
      <nav className="legal-nav" aria-label="Policies">
        {PAGES.map(p => <Link key={p.href} href={p.href} aria-current={p.href === current ? "page" : undefined}>{p.label}</Link>)}
      </nav>
      <h1>{title}</h1>
      <p className="note">Last updated: {LEGAL_UPDATED}</p>
      <aside className="summary" aria-label="Summary">
        <h2>In short</h2>
        {summary}
        <p className="note">This summary helps you find your way. The full text below is what applies.</p>
      </aside>
      <div className="prose">{children}</div>
    </article>
  );
}
