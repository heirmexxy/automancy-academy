"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { CertificateError, issueCertificate, reissueCertificate, revokeCertificate } from "@/lib/certificate";
import { reviewSubmission } from "@/lib/reviewer";
import { isTier, normaliseCertId } from "@/lib/reviewer-core";

const q = (s: string) => encodeURIComponent(s);

/* ── Learner ─────────────────────────────────────────────────────────── */

/** Claim the certificate (eligibility is checked on the server). */
export async function claimCertificate() {
  const user = await requireUser("/account");
  let target = "/account?cert=issued#certificate";
  try { await issueCertificate(user.id); }
  catch (e) {
    console.error("[certificate] claim failed", e);
    target = `/account?cert_error=${q(e instanceof CertificateError ? e.message : "Something went wrong issuing your certificate. Please try again or contact support.")}#certificate`;
  }
  revalidatePath("/account");
  redirect(target);
}

/* ── Admin: reviews ──────────────────────────────────────────────────── */

const STATUSES = ["accepted", "revise", "rejected", "pending"] as const;

/** Override the AI's verdict and score with a note (shown to the learner). Clears the needs-human flag. */
export async function overrideReview(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "") as (typeof STATUSES)[number];
  const scoreRaw = String(formData.get("score") ?? "").trim();
  const note = String(formData.get("note") || "").trim().slice(0, 2000);
  if (!id || !STATUSES.includes(status)) redirect(`/admin/reviews/${q(id)}?error=${q("Choose a verdict.")}`);
  const score = scoreRaw === "" ? null : Math.max(0, Math.min(100, Math.round(Number(scoreRaw))));
  if (score !== null && !Number.isFinite(score)) redirect(`/admin/reviews/${q(id)}?error=${q("Score must be 0–100.")}`);
  if (!note && status !== "accepted") redirect(`/admin/reviews/${q(id)}?error=${q("Add a note for the learner explaining the decision.")}`);
  const db = createAdminClient();
  const { data: before } = await db.from("submissions").select("status, score, needs_human").eq("id", id).single();
  const { error } = await db.from("submissions").update({
    status, score, reviewer_note: note || null, reviewed_by: admin.id, reviewed_at: status === "pending" ? null : new Date().toISOString(), needs_human: status === "pending"
  }).eq("id", id);
  if (error) redirect(`/admin/reviews/${q(id)}?error=${q(error.message)}`);
  await db.from("audit_log").insert({ actor: admin.id, action: "review.override", target: id, detail: { before, after: { status, score }, note } });
  revalidatePath("/admin/reviews");
  redirect(`/admin/reviews/${q(id)}?notice=${q("Saved. The learner sees your verdict and note.")}`);
}

/** Clear the needs-human flag without changing the AI's verdict. */
export async function clearReviewFlag(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  const db = createAdminClient();
  const { data: row } = await db.from("submissions").select("status, ai_result").eq("id", id).single();
  if (!row) redirect(`/admin/reviews?error=${q("Submission not found.")}`);
  // A pending row held back by the flag takes the AI's verdict once a person has checked it.
  const ai = (row.ai_result || {}) as { verdict?: string };
  const status = row.status === "pending" && ai.verdict ? (ai.verdict === "accept" ? "accepted" : "revise") : row.status;
  await db.from("submissions").update({ needs_human: false, status, reviewed_by: admin.id, reviewed_at: new Date().toISOString() }).eq("id", id);
  await db.from("audit_log").insert({ actor: admin.id, action: "review.clear_flag", target: id, detail: { status } });
  revalidatePath("/admin/reviews");
  redirect(`/admin/reviews/${q(id)}?notice=${q(`Flag cleared (status: ${status}).`)}`);
}

/** Run the AI reviewer again on a stored submission (for example after a prompt or marking-data fix). */
export async function rerunReview(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  const db = createAdminClient();
  const { data: row } = await db.from("submissions").select("id, item_id, tier, content, links").eq("id", id).single();
  if (!row || !isTier(row.tier)) redirect(`/admin/reviews?error=${q("Submission not found.")}`);
  let msg = "";
  try {
    const { result, status, meta } = await reviewSubmission({ itemId: row.item_id, tier: row.tier, content: row.content, links: row.links || [] });
    await db.from("submissions").update({
      status, score: result.score, ai_result: { ...result, meta, rerun_by: admin.id }, needs_human: result.needs_human,
      reviewer_note: null, reviewed_by: null, reviewed_at: status === "pending" ? null : new Date().toISOString()
    }).eq("id", id);
    await db.from("audit_log").insert({ actor: admin.id, action: "review.rerun", target: id, detail: { status, score: result.score } });
    msg = `notice=${q(`AI re-run: ${status}, ${result.score}/100.`)}`;
  } catch (e) {
    msg = `error=${q(`AI re-run failed: ${e instanceof Error ? e.message : "unknown error"}`)}`;
  }
  revalidatePath("/admin/reviews");
  redirect(`/admin/reviews/${q(id)}?${msg}`);
}

/* ── Admin: certificates ─────────────────────────────────────────────── */

export async function adminRevokeCertificate(formData: FormData) {
  const admin = await requireAdmin();
  const id = normaliseCertId(formData.get("id"));
  const reason = String(formData.get("reason") || "").trim();
  if (!id) redirect(`/admin/certificates?error=${q("Unknown certificate ID.")}`);
  if (reason.length < 5) redirect(`/admin/certificates?error=${q("Give a reason for revoking (it's kept in the audit log).")}`);
  try { await revokeCertificate(id, reason, admin.id); }
  catch (e) { redirect(`/admin/certificates?error=${q(e instanceof Error ? e.message : "Revoke failed")}`); }
  revalidatePath("/admin/certificates");
  redirect(`/admin/certificates?notice=${q(`${id} revoked.`)}`);
}

export async function adminReissueCertificate(formData: FormData) {
  const admin = await requireAdmin();
  const id = normaliseCertId(formData.get("id"));
  if (!id) redirect(`/admin/certificates?error=${q("Unknown certificate ID.")}`);
  let newId = "";
  try { newId = (await reissueCertificate(id, admin.id)).id; }
  catch (e) { redirect(`/admin/certificates?error=${q(e instanceof Error ? e.message : "Re-issue failed")}`); }
  revalidatePath("/admin/certificates");
  redirect(`/admin/certificates?notice=${q(`Re-issued as ${newId} with the learner's current profile name.`)}`);
}
