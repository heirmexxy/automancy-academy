import type { Metadata } from "next";
import Link from "next/link";
import { CERT_NAME, CERT_ORG, CERT_STATEMENT, CREATOR_COURSE_STATEMENT, FLAGSHIP_PROVIDER, FLAGSHIP_TITLE, verifyCertificate, verifyCertificateCourses } from "@/lib/certificate";
import { fmtDate } from "@/lib/format";
import "../verify.css";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const c = await verifyCertificate(decodeURIComponent(id));
  return c
    ? { title: `${c.name} · ${CERT_NAME}`, description: `${CERT_ORG} ${CERT_NAME} ${c.id}, issued ${fmtDate(c.issuedAt)} (${c.status}).`, robots: { index: false } }
    : { title: "Certificate not found", robots: { index: false } };
}

export default async function VerifyCertificate({ params }: Props) {
  const { id } = await params;
  const c = await verifyCertificate(decodeURIComponent(id));
  if (!c) {
    return (
      <div className="wrap narrow stack">
        <h1>Certificate not found</h1>
        <p className="alert bad">We couldn&apos;t find a certificate with that ID. Check it carefully (IDs look like AA-2026-7K3QX9) and try again.</p>
        <p><Link className="btn" href="/verify">Look up another ID</Link></p>
      </div>
    );
  }
  const valid = c.status === "valid";
  const courses = valid ? await verifyCertificateCourses(c.id).catch(() => []) : [];
  const flagship = courses.some(x => x.title === FLAGSHIP_TITLE && x.provider === FLAGSHIP_PROVIDER);
  const others = courses.some(x => !(x.title === FLAGSHIP_TITLE && x.provider === FLAGSHIP_PROVIDER));
  return (
    <div className="wrap stack">
      <p className="no-print"><span className={`pill ${valid ? "ok" : "bad"}`}>{valid ? "Valid certificate" : "Revoked"}</span></p>
      <article className={`cert-card${valid ? "" : " revoked"}`} aria-label="Certificate">
        <span className={`cert-stamp ${valid ? "ok" : "bad"}`}>{valid ? "VERIFIED" : "REVOKED"}</span>
        <div><div className="cert-org">{CERT_ORG}</div><h2>{CERT_NAME}</h2></div>
        <div>
          <p className="muted">This certifies that</p>
          <div className="cert-name">{c.name}</div>
          <p className="cert-what">has completed {courses.length === 1 ? "the following course" : "the following courses"} on {CERT_ORG}:</p>
          {courses.length > 0 && <ul className="cert-list">{courses.map(x => <li key={x.title + x.completed_at}><b>{x.title}</b> <span className="muted">· {x.provider === FLAGSHIP_PROVIDER ? "Automancy Academy" : `by ${x.provider}`} · {fmtDate(x.completed_at)}</span></li>)}</ul>}
        </div>
        <div className="cert-meta"><span>ID {c.id}</span><span>Issued {fmtDate(c.issuedAt)}</span><span>Status: {valid ? "valid" : "revoked"}</span></div>
      </article>
      {!valid && <p className="alert bad">This certificate has been revoked and is no longer valid.</p>}
      <section className="card stack" style={{ maxWidth: 820 }}>
        <h3>What this certificate means</h3>
        {(flagship || !others) && <p>{CERT_STATEMENT}</p>}
        {others && <p>{CREATOR_COURSE_STATEMENT}</p>}
      </section>
      <p className="note no-print">To print or save as PDF, use your browser&apos;s Print option. <Link href="/verify">Verify another certificate</Link></p>
    </div>
  );
}
