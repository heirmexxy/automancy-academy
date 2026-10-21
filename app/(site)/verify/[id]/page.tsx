import type { Metadata } from "next";
import Link from "next/link";
import { CERT_NAME, CERT_ORG, CERT_STATEMENT, verifyCertificate } from "@/lib/certificate";
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
  return (
    <div className="wrap stack">
      <p className="no-print"><span className={`pill ${valid ? "ok" : "bad"}`}>{valid ? "Valid certificate" : "Revoked"}</span></p>
      <article className={`cert-card${valid ? "" : " revoked"}`} aria-label="Certificate">
        <span className={`cert-stamp ${valid ? "ok" : "bad"}`}>{valid ? "VERIFIED" : "REVOKED"}</span>
        <div><div className="cert-org">{CERT_ORG}</div><h2>{CERT_NAME}</h2></div>
        <div>
          <p className="muted">This certifies that</p>
          <div className="cert-name">{c.name}</div>
          <p className="cert-what">has completed 49 lessons, six practical boss projects and a reviewed capstone, building automations, AI agents and growth systems with Zapier, Make and n8n.</p>
        </div>
        <div className="cert-meta"><span>ID {c.id}</span><span>Issued {fmtDate(c.issuedAt)}</span><span>Status: {valid ? "valid" : "revoked"}</span></div>
      </article>
      {!valid && <p className="alert bad">This certificate has been revoked and is no longer valid.</p>}
      <section className="card stack" style={{ maxWidth: 820 }}>
        <h3>What this certificate means</h3>
        <p>{CERT_STATEMENT}</p>
      </section>
      <p className="note no-print">To print or save as PDF, use your browser&apos;s Print option. <Link href="/verify">Verify another certificate</Link></p>
    </div>
  );
}
