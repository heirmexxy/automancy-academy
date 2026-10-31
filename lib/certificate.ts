import "server-only";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { COURSE } from "@/lib/course";
import { SITE_NAME, SITE_URL } from "@/lib/config";
import { sendEmail } from "@/lib/email";
import { esc } from "@/lib/format";
import { BOSS_IDS, CAPSTONE_ID, computeEligibility, linkedInAddUrl, makeCertId, normaliseCertId, type Eligibility } from "@/lib/reviewer-core";

/** One certificate per learner, listing every course they completed on Automancy (flagship and creator courses). */
export const CERT_NAME = "Automancy Academy Certificate";
export const FLAGSHIP_KEY = "automancy";
export const FLAGSHIP_TITLE = "AI Automation: Zapier, Make, n8n and AI agents";
export const FLAGSHIP_PROVIDER = SITE_NAME;
/** What completing a creator course on the certificate means. */
export const CREATOR_COURSE_STATEMENT =
  "Courses from independent creators are reviewed by Automancy against published standards before they go live. A creator course " +
  "is listed on the certificate when the holder has completed every lesson and passed every quiz in it at 60% or better.";
export const CERT_ORG = SITE_NAME;
/** PLACEHOLDER: the LinkedIn company page ID for Automancy Academy (numeric). Empty = LinkedIn uses the organisation name. */
export const LINKEDIN_ORG_ID = process.env.LINKEDIN_ORG_ID || "";

/** One-paragraph wording of what the certificate certifies (also used on the legal page). */
export const CERT_STATEMENT =
  "For the flagship AI Automation course, the Automancy Academy Certificate certifies that the holder completed all 49 lessons of the course " +
  "and passed every lesson's checkpoint quiz at 4 out of 5 or better, built six practical boss projects that each scored " +
  "80 or more out of 100 with every must-have safety and go-live check met, and completed a grand capstone that took a " +
  "small business's operations from orders and payments to monitoring and a written handover, also scoring 80 or more. " +
  "Projects were marked against published rubrics from the written evidence the learner submitted (run logs, test results " +
  "and reports), by an AI reviewer with human review of anything it flagged. Along the way the holder built automations, AI " +
  "agents and growth systems with Zapier, Make and n8n, using test data, human approval for risky actions and safe handling " +
  "of keys and customer data. The certificate records completed, reviewed coursework; it is not a licence or a guarantee of employment.";

export type Certificate = { id: string; user_id: string; name_on_certificate: string; issued_at: string; revoked: boolean; revoked_reason: string | null };
export type CertCourse = { course_key?: string; title: string; provider: string; completed_at: string };

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

/** Courses this learner has completed (what their certificate lists), oldest first. */
export async function completedCourses(userId: string): Promise<CertCourse[]> {
  const { data } = await createAdminClient().from("certificate_courses").select("course_key, title, provider, completed_at").eq("user_id", userId).order("completed_at");
  return (data || []) as CertCourse[];
}
/** Public: the courses listed on a valid certificate. */
export async function verifyCertificateCourses(id: string): Promise<CertCourse[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("verify_certificate_courses", { cert_id: normaliseCertId(id) || "" });
  return (Array.isArray(data) ? data : []) as CertCourse[];
}
async function addCourse(userId: string, row: { course_key: string; title: string; provider: string }) {
  const { data } = await createAdminClient().from("certificate_courses")
    .upsert({ user_id: userId, ...row, title: row.title.slice(0, 160), provider: row.provider.slice(0, 120) }, { onConflict: "user_id,course_key", ignoreDuplicates: true }).select("course_key");
  return (data || []).length > 0; // true when newly added
}
/** Adds the flagship course to the learner's list once they meet its criteria. */
export async function ensureFlagship(userId: string, el?: Eligibility) {
  const e = el || await eligibility(userId);
  if (e.ok) await addCourse(userId, { course_key: FLAGSHIP_KEY, title: FLAGSHIP_TITLE, provider: FLAGSHIP_PROVIDER });
  return e.ok;
}
/** Course quiz pass mark (matches QUIZ_PASS in the marketplace). */
const CREATOR_QUIZ_PASS = 60;
/**
 * After a creator-course lesson or quiz is saved: if every lesson is done and every quiz passed, the course goes on the
 * learner's certificate (issuing the certificate if they don't have one yet and their name is set). Never throws.
 */
export async function syncCourseCompletion(userId: string, courseId: string) {
  try {
    const db = createAdminClient();
    const [{ data: lessons }, { data: prog }, { data: course }] = await Promise.all([
      db.from("course_lessons").select("id, kind").eq("course_id", courseId),
      db.from("course_progress").select("lesson_id, done, quiz_score").eq("user_id", userId).eq("course_id", courseId),
      db.from("courses").select("id, title, creator_id").eq("id", courseId).maybeSingle()
    ]);
    if (!course || !(lessons || []).length) return;
    const by = new Map((prog || []).map(p => [String(p.lesson_id), p]));
    const complete = (lessons || []).every(l => { const p = by.get(String(l.id)); return !!p && (l.kind === "quiz" ? Number(p.quiz_score ?? 0) >= CREATOR_QUIZ_PASS : !!p.done); });
    if (!complete) return;
    const { data: cr } = await db.from("creators").select("display_name").eq("user_id", course.creator_id as string).maybeSingle();
    const added = await addCourse(userId, { course_key: String(course.id), title: String(course.title), provider: String(cr?.display_name || "an Automancy creator") });
    if (!added) return;
    const cert = await getCertificate(userId);
    if (cert) {
      const { data: prof } = await db.from("profiles").select("email").eq("id", userId).maybeSingle();
      if (prof?.email) await sendEmail(String(prof.email), `${course.title} is on your certificate`,
        `<p>Well done: you completed <b>${esc(String(course.title))}</b>. It's now listed on your ${esc(CERT_NAME)}.</p><p><a href="${certUrl(cert.id)}">See your certificate</a></p>`).catch(() => undefined);
    } else {
      await issueCertificate(userId, { skipEligibility: true }).catch(() => undefined); // needs a profile name; otherwise they claim it from Account
    }
  } catch (e) { console.error("[certificate] course completion sync failed", e); }
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
    const flagship = await ensureFlagship(userId);
    if (!flagship && (await completedCourses(userId)).length === 0) throw new CertificateError("Complete a course first: the flagship course's checklist, or every lesson and quiz of a creator course.");
  } else await ensureFlagship(userId).catch(() => false);
  const db = createAdminClient();
  const { data: profile } = await db.from("profiles").select("full_name, email").eq("id", userId).single();
  const name = String(profile?.full_name || "").trim().replace(/\s+/g, " ").slice(0, 120);
  if (!name) throw new CertificateError("Add your full name in your account settings first: it's printed on the certificate.");
  const cert = await insertCertificate(userId, name);
  await db.from("audit_log").insert({ actor: opts.actor || userId, action: "certificate.issue", target: cert.id, detail: { user_id: userId, name } });
  if (profile?.email) {
    await sendEmail(profile.email, `Your ${CERT_NAME}`,
      `<p>Congratulations, ${esc(name)}.</p><p>You've earned the ${esc(CERT_NAME)}. It lists every course you complete with us and updates as you finish more. Certificate ID: <b>${esc(cert.id)}</b>.</p>` +
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
