import "server-only";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { COURSE } from "@/lib/course";
import { SITE_NAME, SITE_URL } from "@/lib/config";
import { sendEmail } from "@/lib/email";
import { esc } from "@/lib/format";
import { BOSS_IDS, CAPSTONE_ID, computeEligibility, linkedInAddUrl, makeCertId, normaliseCertId, type Eligibility } from "@/lib/reviewer-core";

export const CERT_NAME = "Certificate in AI Automation";
export const CERT_ORG = SITE_NAME;
/** PLACEHOLDER: the LinkedIn company page ID for Automancy Academy (numeric). Empty = LinkedIn uses the organisation name. */
export const LINKEDIN_ORG_ID = process.env.LINKEDIN_ORG_ID || "";

/** One-paragraph wording of what the certificate certifies (also used on the legal page). */
export const CERT_STATEMENT =
  "The Automancy Academy Certificate in AI Automation certifies that the holder completed all 49 lessons of the course " +
  "and passed every lesson's checkpoint quiz at 4 out of 5 or better, built six practical boss projects that each scored " +
  "80 or more out of 100 with every must-have safety and go-live check met, and completed a grand capstone that took a " +
  "small business's operations from orders and payments to monitoring and a written handover, also scoring 80 or more. " +
  "Projects were marked against published rubrics from the written evidence the learner submitted (run logs, test results " +
  "and reports), by an AI reviewer with human review of anything it flagged. Along the way the holder built automations, AI " +
  "agents and growth systems with Zapier, Make and n8n, using test data, human approval for risky actions and safe handling " +
  "of keys and customer data. The certificate records completed, reviewed coursework; it is not a licence or a guarantee of employment.";

export type Certificate = { id: string; user_id: string; name_on_certificate: string; issued_at: string; revoked: boolean; revoked_reason: string | null };

export const certUrl = (id: string) => `${SITE_URL}/verify/${encodeURIComponent(id)}`;
export const certLinkedInUrl = (c: Pick<Certificate, "id" | "issued_at">) =>
  linkedInAddUrl({ certName: CERT_NAME, orgName: CERT_ORG, orgId: LINKEDIN_ORG_ID || undefined, issuedAt: c.issued_at, certId: c.id, certUrl: certUrl(c.id) });

const LESSON_IDS = COURSE.items.filter(i => i.kind !== "boss").map(i => i.id); // 48 lessons + the capstone lesson 6.4

/**
 * What a learner still needs for the certificate. Computed on the server from progress (done + quizzes in state)
 * and accepted submissions. Call only for the signed-in user or after requireAdmin().
 */
export async function eligibility(userId: string): Promise<Eligibility> {
  const db = createAdminClient();
  const [{ data: prog }, { data: subs }] = await Promise.all([
    db.from("progress").select("done, state").eq("user_id", userId).maybeSingle(),
    db.from("submissions").select("item_id, tier").eq("user_id", userId).eq("status", "accepted").in("tier", ["boss", "capstone"])
  ]);
  const state = (prog?.state || {}) as { quizzes?: Record<string, number> };
  const accepted = (subs || []) as { item_id: string; tier: string }[];
  return computeEligibility({
    lessonIds: LESSON_IDS,
    done: (prog?.done || {}) as Record<string, unknown>,
    quizzes: state.quizzes || {},
    acceptedBosses: accepted.filter(s => s.tier === "boss" && BOSS_IDS.includes(s.item_id)).map(s => s.item_id),
    capstoneAccepted: accepted.some(s => s.tier === "capstone" && s.item_id === CAPSTONE_ID)
  });
}

/** The learner's live (non-revoked) certificate, if any. */
export async function getCertificate(userId: string): Promise<Certificate | null> {
  const { data } = await createAdminClient().from("certificates").select("*").eq("user_id", userId).eq("revoked", false).maybeSingle();
  return (data as Certificate) || null;
}

/** Public lookup: name, issue date and status only (through the verify_certificate RPC). */
export async function verifyCertificate(input: string): Promise<{ id: string; name: string; issuedAt: string; status: "valid" | "revoked" } | null> {
  const id = normaliseCertId(input);
  if (!id) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("verify_certificate", { cert_id: id });
  const row = (Array.isArray(data) ? data[0] : data) as { id: string; name_on_certificate: string; issued_at: string; status: "valid" | "revoked" } | undefined;
  return row ? { id: row.id, name: row.name_on_certificate, issuedAt: row.issued_at, status: row.status } : null;
}

async function insertCertificate(userId: string, name: string): Promise<Certificate> {
  const db = createAdminClient();
  for (let i = 0; i < 5; i++) {
    const id = makeCertId(new Date().getUTCFullYear(), randomBytes(6));
    const { data, error } = await db.from("certificates").insert({ id, user_id: userId, name_on_certificate: name }).select("*").single();
    if (!error && data) return data as Certificate;
    if (error && error.code === "23505") {
      const live = await getCertificate(userId); // another request issued one first
      if (live) return live;
      continue; // ID collision: try another
    }
    throw new Error(error?.message || "Couldn't issue the certificate");
  }
  throw new Error("Couldn't generate a unique certificate ID");
}

export class CertificateError extends Error {}

/**
 * Issues the learner's certificate if they're eligible. Idempotent: returns the live certificate if one exists.
 * The name comes from the learner's profile (full_name).
 */
export async function issueCertificate(userId: string, opts: { actor?: string; skipEligibility?: boolean } = {}): Promise<Certificate> {
  const existing = await getCertificate(userId);
  if (existing) return existing;
  if (!opts.skipEligibility) {
    const el = await eligibility(userId);
    if (!el.ok) throw new CertificateError("You haven't met every criterion yet. Your checklist shows what's left.");
  }
  const db = createAdminClient();
  const { data: profile } = await db.from("profiles").select("full_name, email").eq("id", userId).single();
  const name = String(profile?.full_name || "").trim().replace(/\s+/g, " ").slice(0, 120);
  if (!name) throw new CertificateError("Add your full name in your account settings first: it's printed on the certificate.");
  const cert = await insertCertificate(userId, name);
  await db.from("audit_log").insert({ actor: opts.actor || userId, action: "certificate.issue", target: cert.id, detail: { user_id: userId, name } });
  if (profile?.email) {
    await sendEmail(profile.email, `Your ${CERT_NAME}`,
      `<p>Congratulations, ${esc(name)}.</p><p>You've earned the ${esc(CERT_NAME)} from ${esc(SITE_NAME)}. Certificate ID: <b>${esc(cert.id)}</b>.</p>` +
      `<p>Anyone can verify it at <a href="${certUrl(cert.id)}">${certUrl(cert.id)}</a>. You can add it to LinkedIn from your account page.</p>`
    ).catch(() => undefined);
  }
  return cert;
}

/** Admin: revoke a certificate with a reason. */
export async function revokeCertificate(id: string, reason: string, actor: string) {
  const db = createAdminClient();
  const { error } = await db.from("certificates").update({ revoked: true, revoked_reason: reason.slice(0, 500) }).eq("id", id);
  if (error) throw new Error(error.message);
  await db.from("audit_log").insert({ actor, action: "certificate.revoke", target: id, detail: { reason } });
}

/** Admin: replace a certificate with a new ID and the learner's current profile name (the old one is revoked). */
export async function reissueCertificate(id: string, actor: string): Promise<Certificate> {
  const db = createAdminClient();
  const { data: old } = await db.from("certificates").select("*").eq("id", id).single();
  if (!old) throw new Error("Certificate not found");
  const { data: live } = await db.from("certificates").select("id").eq("user_id", old.user_id).eq("revoked", false);
  const replaced = (live || []).map(l => l.id as string);
  if (replaced.length) await db.from("certificates").update({ revoked: true, revoked_reason: "Replaced by a re-issued certificate" }).in("id", replaced);
  const cert = await issueCertificate(old.user_id, { actor, skipEligibility: true });
  if (replaced.length) await db.from("certificates").update({ revoked_reason: `Replaced by ${cert.id}` }).in("id", replaced);
  await db.from("audit_log").insert({ actor, action: "certificate.reissue", target: cert.id, detail: { replaces: id } });
  return cert;
}
