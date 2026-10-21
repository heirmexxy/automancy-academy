import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { normaliseCertId } from "@/lib/reviewer-core";
import { CERT_NAME } from "@/lib/certificate";
import "./verify.css";

export const metadata: Metadata = { title: "Verify a certificate", description: `Check that an Automancy Academy ${CERT_NAME} is genuine.` };

export default async function VerifyLookup({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const raw = (sp.id || "").trim();
  const id = normaliseCertId(raw);
  if (id) redirect(`/verify/${encodeURIComponent(id)}`);
  return (
    <div className="wrap narrow stack">
      <p className="eyebrow">Certificate check</p>
      <h1>Verify a certificate</h1>
      <p className="lede">Enter the certificate ID to confirm the holder&apos;s name, the issue date and whether it&apos;s still valid.</p>
      <form className="verify-form card" method="get" action="/verify">
        <label className="fld">Certificate ID
          <input name="id" defaultValue={raw} placeholder="AA-2026-7K3QX9" autoCapitalize="characters" spellCheck={false} required maxLength={20} />
        </label>
        <button className="btn" type="submit">Verify</button>
      </form>
      {raw && !id && <p className="alert bad">That doesn&apos;t look like a certificate ID. IDs look like AA-2026-7K3QX9.</p>}
      <p className="note">The ID is printed on the certificate and in the link the holder shared. We only show the name, the issue date and the status.</p>
    </div>
  );
}
