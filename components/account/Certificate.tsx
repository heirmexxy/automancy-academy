import Link from "next/link";
import { getUser } from "@/lib/auth";
import { CERT_NAME, CERT_ORG, certLinkedInUrl, certUrl, eligibility, getCertificate } from "@/lib/certificate";
import { claimCertificate } from "@/lib/actions/reviews";
import { itemById } from "@/lib/course";
import { fmtDate } from "@/lib/format";
import "@/app/(site)/verify/verify.css";

const label = (id: string) => (id.startsWith("B") ? `Boss ${id.slice(1)}` : id === "6.4" ? "Capstone 6.4" : `Lesson ${id}`);
const learnHref = (id: string) => `/learn#${id.startsWith("B") ? "boss-" + id.slice(1) : "m-" + id.replace(".", "-")}`;

/**
 * Account → Certificate: the eligibility checklist (computed on the server), the claim button,
 * and the issued certificate with share, LinkedIn and verify links. Server component.
 * Props: `notice` / `error` from the account page's searchParams (?cert=issued, ?cert_error=…).
 */
export default async function Certificate({ notice, error }: { notice?: string; error?: string }) {
  const user = await getUser();
  if (!user) return null;
  const [cert, el] = await Promise.all([getCertificate(user.id), eligibility(user.id)]);

  return (
    <section id="certificate" className="card stack" aria-labelledby="cert-h">
      <div>
        <p className="eyebrow">Certificate</p>
        <h2 id="cert-h">{CERT_NAME}</h2>
      </div>
      {notice && <p className="alert ok">{notice === "issued" ? "Your certificate is ready. Congratulations." : notice}</p>}
      {error && <p className="alert bad">{error}</p>}

      {cert ? (
        <>
          <article className="cert-card" aria-label="Your certificate">
            <span className="cert-stamp ok">VERIFIED</span>
            <div><div className="cert-org">{CERT_ORG}</div><h2>{CERT_NAME}</h2></div>
            <div>
              <p className="muted">This certifies that</p>
              <div className="cert-name">{cert.name_on_certificate}</div>
              <p className="cert-what">has completed 49 lessons, six practical boss projects and a reviewed capstone, building automations, AI agents and growth systems with Zapier, Make and n8n.</p>
            </div>
            <div className="cert-meta"><span>ID {cert.id}</span><span>Issued {fmtDate(cert.issued_at)}</span><span>Verify at {certUrl(cert.id).replace(/^https?:\/\//, "")}</span></div>
          </article>
          <div className="cert-actions">
            <a className="btn" href={certLinkedInUrl(cert)} target="_blank" rel="noopener noreferrer">Add to LinkedIn</a>
            <a className="btn alt" href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(certUrl(cert.id))}`} target="_blank" rel="noopener noreferrer">Share on LinkedIn</a>
            <a className="btn alt" href={`https://wa.me/?text=${encodeURIComponent(`I earned the ${CERT_NAME} from ${CERT_ORG}. Verify it here: ${certUrl(cert.id)}`)}`} target="_blank" rel="noopener noreferrer">Share on WhatsApp</a>
            <Link className="btn alt" href={`/verify/${cert.id}`}>Open printable page</Link>
          </div>
          <p className="note">The name comes from your profile. If it&apos;s wrong, update your full name and ask support to re-issue the certificate.</p>
        </>
      ) : (
        <>
          <p className="muted">Meet every criterion below and claim your certificate. It&apos;s issued in your profile name and anyone can verify it online.</p>
          <ul className="cert-checks">
            {el.checks.map(c => {
              const met = c.have >= c.need;
              return (
                <li key={c.key} className={met ? "met" : ""}>
                  <span className="tick" aria-hidden="true">{met ? "✓" : "○"}</span>
                  <div>
                    <b>{c.label}</b>
                    {!met && c.missing.length > 0 && (
                      <div className="miss">
                        Still to do: {c.missing.slice(0, 12).map((id, i) => (
                          <span key={id}>{i ? ", " : ""}<Link href={learnHref(id)} title={itemById(id)?.title.replace(/&amp;/g, "&")}>{label(id)}</Link></span>
                        ))}{c.missing.length > 12 ? ` and ${c.missing.length - 12} more` : ""}
                      </div>
                    )}
                  </div>
                  <span className="pill">{c.have} / {c.need}</span>
                </li>
              );
            })}
          </ul>
          <form action={claimCertificate}>
            <button className="btn" type="submit" disabled={!el.ok}>{el.ok ? "Claim my certificate" : "Claim (unlocks when every criterion is met)"}</button>
          </form>
          <p className="note">Boss projects and the capstone count once the AI reviewer (or a person) accepts them at 80 or more with every must-have met.</p>
        </>
      )}
    </section>
  );
}
export { Certificate };
