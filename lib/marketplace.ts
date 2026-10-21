import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { PAYMENT_UNAVAILABLE, reportCheckoutFailure } from "@/lib/payment-alert";
import { SITE_NAME, SITE_URL, SUPPORT_EMAIL, adminEmails, hasPaystack, hasSupabase } from "@/lib/config";
import { esc } from "@/lib/format";
import { makeReference, moneyText, normaliseCode, type Currency } from "@/lib/money";
import { initializeTransaction, type PaymentRow } from "@/lib/paystack";
import { MARKET, availableAt, creatorEarning, toNgnKobo, type CourseStatus, type Level, type LessonKind } from "@/app/(site)/courses/_lib/core";

/**
 * Creator marketplace (writer H). Payments contract with writer A:
 *  - startCoursePurchase creates A's `payments` row (product "course:<id>") plus our quote in `course_checkouts`,
 *    and initialises Paystack with metadata {kind: "course", course_id, user_id}.
 *  - A's fulfilPayment(ref, { onCourse: handleCoursePayment }) verifies the transaction and calls handleCoursePayment
 *    once; we check the amount, grant course_enrollments and record the creator's earning (idempotent on payment id).
 *  - Refunds: A's applyRefund sets payments.status = 'refunded'; the DB trigger in 0007 removes access and reverses the earning.
 * This module must never be imported by lib/paystack.ts (A passes our handler in to avoid an import cycle).
 */

export type Creator = {
  user_id: string; display_name: string; bio: string | null; photo_url: string | null; website: string | null;
  application_note: string | null; status: "applied" | "approved" | "suspended"; revenue_share: number;
  agreed_terms_at: string; decided_at: string | null; created_at: string;
};
export type Course = {
  id: string; creator_id: string; slug: string; title: string; subtitle: string | null; description: string | null;
  category: string | null; level: Level; language: string; cover_url: string | null; price_ngn: number; price_usd: number | null;
  is_free: boolean; status: CourseStatus; changes_pending: boolean; review_note: string | null; submitted_at: string | null;
  approved_at: string | null; approved_by: string | null; published_at: string | null; created_at: string; updated_at: string;
};
export type Section = { id: string; course_id: string; position: number; title: string };
export type Lesson = {
  id: string; section_id: string; course_id: string; position: number; title: string; kind: LessonKind; body_md: string;
  video_url: string | null; quiz: unknown; task: string | null; free_preview: boolean; minutes: number;
};
export type OutlineLesson = Pick<Lesson, "id" | "section_id" | "position" | "title" | "kind" | "minutes" | "free_preview">;
export type Curriculum<L> = (Section & { lessons: L[] })[];

const db = () => createAdminClient();
const OUTLINE_COLS = "id, section_id, position, title, kind, minutes, free_preview";

export async function audit(actor: string | null, action: string, target: string, detail: unknown) {
  try { await db().from("audit_log").insert({ actor, action, target, detail }); } catch { /* best effort */ }
}

// ── Reads (service role; callers decide what the viewer may see) ──────────────

export async function getCreator(userId: string): Promise<Creator | null> {
  if (!hasSupabase()) return null;
  const { data } = await db().from("creators").select("*").eq("user_id", userId).maybeSingle();
  return (data as Creator | null) ?? null;
}
export async function getCourse(id: string): Promise<Course | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db().from("courses").select("*").eq("id", id).maybeSingle();
  return (data as Course | null) ?? null;
}
export async function getCourseBySlug(slug: string): Promise<Course | null> {
  if (!/^[a-z0-9-]{3,80}$/.test(slug) || !hasSupabase()) return null;
  const { data } = await db().from("courses").select("*").eq("slug", slug).maybeSingle();
  return (data as Course | null) ?? null;
}
/** Sections with lessons in order. withContent=false returns titles only (safe for public pages). */
export async function getCurriculum(courseId: string, withContent: true): Promise<Curriculum<Lesson>>;
export async function getCurriculum(courseId: string, withContent: false): Promise<Curriculum<OutlineLesson>>;
export async function getCurriculum(courseId: string, withContent: boolean): Promise<Curriculum<Lesson | OutlineLesson>> {
  const [{ data: secs }, { data: les }] = await Promise.all([
    db().from("course_sections").select("*").eq("course_id", courseId).order("position").order("id"),
    db().from("course_lessons").select(withContent ? "*" : OUTLINE_COLS).eq("course_id", courseId).order("position").order("id")
  ]);
  const lessons = ((les || []) as unknown) as (Lesson | OutlineLesson)[];
  return ((secs || []) as Section[]).map(s => ({ ...s, lessons: lessons.filter(l => l.section_id === s.id) }));
}
export const flatLessons = <L,>(c: Curriculum<L>) => c.flatMap(s => s.lessons);

export async function isEnrolled(userId: string, courseId: string): Promise<boolean> {
  const { data } = await db().from("course_enrollments").select("id").eq("course_id", courseId).eq("user_id", userId).eq("status", "active").maybeSingle();
  return !!data;
}
export async function getRole(userId: string): Promise<string> {
  const { data } = await db().from("profiles").select("role").eq("id", userId).maybeSingle();
  return String(data?.role || "learner");
}
export async function publicCreator(userId: string) {
  const { data } = await db().from("creators").select("user_id, display_name, bio, photo_url, website, status").eq("user_id", userId).maybeSingle();
  return data as null | { user_id: string; display_name: string; bio: string | null; photo_url: string | null; website: string | null; status: string };
}
export async function ratingSummary(courseIds: string[]): Promise<Record<string, { avg: number; count: number }>> {
  if (!courseIds.length) return {};
  const { data } = await db().from("course_reviews").select("course_id, rating").in("course_id", courseIds).eq("hidden", false);
  const out: Record<string, { avg: number; count: number }> = {};
  for (const r of data || []) {
    const k = r.course_id as string;
    const o = out[k] || (out[k] = { avg: 0, count: 0 });
    o.avg = (o.avg * o.count + (r.rating as number)) / (o.count + 1); o.count++;
  }
  return out;
}
export async function progressFor(userId: string, courseId: string) {
  const { data } = await db().from("course_progress").select("lesson_id, done, quiz_score").eq("user_id", userId).eq("course_id", courseId);
  return new Map<string, { done: boolean; quiz_score: number | null }>((data || []).map(r => [r.lesson_id as string, { done: !!r.done, quiz_score: r.quiz_score as number | null }]));
}

// ── Email ─────────────────────────────────────────────────────────────────────

const wrap = (body: string) => `<div style="font-family:system-ui,sans-serif;max-width:560px">${body}
  <p style="color:#666;font-size:13px">${esc(SITE_NAME)} · Questions? ${esc(SUPPORT_EMAIL)}</p></div>`;
export async function emailUser(userId: string, subject: string, bodyHtml: string) {
  try {
    const { data } = await db().from("profiles").select("email").eq("id", userId).maybeSingle();
    if (data?.email) await sendEmail(String(data.email), subject, wrap(bodyHtml));
  } catch (e) { console.error("[marketplace] email failed", e); }
}
export async function emailAdmins(subject: string, bodyHtml: string) {
  try {
    let to = adminEmails();
    if (!to.length) {
      const { data } = await db().from("profiles").select("email").eq("role", "admin").limit(10);
      to = (data || []).map(r => String(r.email));
    }
    await Promise.all(to.map(e => sendEmail(e, subject, wrap(bodyHtml))));
  } catch (e) { console.error("[marketplace] admin email failed", e); }
}
export const courseLink = (c: Pick<Course, "slug">) => `${SITE_URL}/courses/${c.slug}`;
export const studioLink = (c: Pick<Course, "id">) => `${SITE_URL}/teach/studio/${c.id}`;

// ── Purchases ─────────────────────────────────────────────────────────────────

export type PurchaseResult = { ok: true; url: string } | { ok: false; error: string; enrolled?: boolean };

/**
 * Starts a Paystack checkout for a live course. Returns the Paystack authorization URL to redirect to.
 * Never charges without PAYSTACK_SECRET_KEY: returns a friendly error and alerts the admin instead.
 * refCode is stored on the payment for attribution only; marketplace courses pay no referral commission (yet).
 */
export async function startCoursePurchase(userId: string, email: string, courseId: string, refCode?: string | null, currency: Currency = "NGN"): Promise<PurchaseResult> {
  const c = await getCourse(courseId);
  if (!c || c.status !== "live") return { ok: false, error: "This course isn't on sale." };
  if (c.is_free) return { ok: false, error: "This course is free: use Enrol." };
  if (c.creator_id === userId) return { ok: false, error: "You can't buy your own course. Use Preview instead." };
  if (await isEnrolled(userId, c.id)) return { ok: false, error: "You already have this course.", enrolled: true };
  if (!email) return { ok: false, error: "Your account has no email address. Contact support." };
  if (!hasPaystack()) {
    await reportCheckoutFailure("PAYSTACK_SECRET_KEY is not set", { userId, email }, `course:${c.slug}`);
    return { ok: false, error: PAYMENT_UNAVAILABLE };
  }

  const usd = currency === "USD";
  if (usd && !(c.price_usd && c.price_usd > 0)) return { ok: false, error: "This course is priced in naira only." };
  const amount = usd ? Math.round(Number(c.price_usd) * 100) : c.price_ngn * 100;
  if (amount <= 0) return { ok: false, error: "This course has no price yet." };

  const reference = makeReference("COURSE");
  const d = db();
  const { error } = await d.from("payments").insert({
    user_id: userId, product: `course:${c.id}`, reference, amount_kobo: amount, currency: usd ? "USD" : "NGN", status: "initialized",
    referral_code: normaliseCode(refCode) || null, discount_kobo: 0
  });
  if (error) { console.error("[marketplace] payment insert failed", error.message); return { ok: false, error: "We couldn't start the payment. Please try again." }; }
  await d.from("course_checkouts").insert({ reference, user_id: userId, course_id: c.id, amount_kobo: amount, currency: usd ? "USD" : "NGN" });

  const init = await initializeTransaction({
    email, amountMinor: amount, currency: usd ? "USD" : "NGN", reference,
    callbackUrl: `${SITE_URL}/courses/${c.slug}/paid`,
    metadata: { kind: "course", course_id: c.id, user_id: userId, course_slug: c.slug, cancel_action: courseLink(c) }
  });
  if (!init.ok || !init.data?.authorization_url) {
    await d.from("payments").update({ status: "failed", raw: { init_error: init.message } }).eq("reference", reference);
    console.error("[marketplace] Paystack initialize failed", init.message);
    return { ok: false, error: usd ? "Paystack couldn't start a dollar payment. Try naira." : "Paystack couldn't start the payment. Please try again in a minute." };
  }
  return { ok: true, url: init.data.authorization_url };
}

/**
 * Called by A's fulfilPayment once a course payment is verified (status success). Re-reads the payment, checks the
 * amount against the price we quoted, grants access and records the creator's earning. Idempotent on payment id.
 */
export async function handleCoursePayment(payment: PaymentRow): Promise<{ ok: boolean; message: string }> {
  const d = db();
  const { data: row } = await d.from("payments").select("*").eq("id", payment.id).maybeSingle();
  const p = row as PaymentRow | null;
  if (!p || p.status !== "success" || !p.product.startsWith("course:")) return { ok: false, message: "Not a successful course payment." };
  const courseId = p.product.slice("course:".length);

  const { data: existing } = await d.from("course_enrollments").select("id").eq("payment_id", p.id).maybeSingle();
  const c = await getCourse(courseId);
  if (!c) { await audit(null, "course_payment_unknown_course", p.id, { product: p.product }); return { ok: false, message: "Course not found." }; }

  // Amount check: against our quote (course_checkouts) or, if the row came from metadata only, the current price.
  const { data: quote } = await d.from("course_checkouts").select("amount_kobo, currency, user_id, course_id").eq("reference", p.reference).maybeSingle();
  const expected = quote
    ? { amount: quote.amount_kobo as number, currency: String(quote.currency), user: String(quote.user_id), course: String(quote.course_id) }
    : { amount: p.currency === "USD" ? Math.round(Number(c.price_usd || 0) * 100) : c.price_ngn * 100, currency: p.currency, user: p.user_id, course: c.id };
  if (expected.amount <= 0 || p.amount_kobo < expected.amount || p.currency !== expected.currency || p.user_id !== expected.user || c.id !== expected.course) {
    await audit(null, "course_payment_mismatch", p.id, { reference: p.reference, paid: p.amount_kobo, currency: p.currency, expected });
    return { ok: false, message: "The amount paid didn't match the course price." };
  }

  if (!existing) {
    const { data: prior } = await d.from("course_enrollments").select("id, status, payment_id").eq("course_id", c.id).eq("user_id", p.user_id).maybeSingle();
    if (!prior) {
      const { error } = await d.from("course_enrollments").insert({
        course_id: c.id, user_id: p.user_id, payment_id: p.id, price_paid_kobo: p.amount_kobo, currency: p.currency, source: "paystack", status: "active"
      });
      if (error && !/duplicate/i.test(error.message)) throw new Error(error.message);
    } else if (prior.status !== "active") {
      await d.from("course_enrollments").update({ status: "active", payment_id: p.id, price_paid_kobo: p.amount_kobo, currency: p.currency, source: "paystack" }).eq("id", prior.id);
    } else {
      // Already enrolled through another payment: keep the money trail; an admin may refund this one.
      await audit(null, "course_duplicate_purchase", p.id, { course: c.id, user: p.user_id, enrollment: prior.id });
    }
  }

  // Creator earning (unique on payment_id, so a second call is a no-op).
  const creator = await getCreator(c.creator_id);
  const gross = toNgnKobo(p.amount_kobo, p.currency, c);
  const share = creator ? Number(creator.revenue_share) : 0.7;
  const e = creatorEarning({ grossNgnKobo: gross, international: p.currency === "USD", share });
  const { data: ins } = await d.from("creator_earnings").upsert({
    creator_id: c.creator_id, course_id: c.id, payment_id: p.id, gross_kobo: gross, fees_kobo: e.feesKobo, share,
    amount_kobo: e.amountKobo, status: "pending", available_at: availableAt(new Date(p.paid_at || Date.now())).toISOString()
  }, { onConflict: "payment_id", ignoreDuplicates: true }).select("id");
  if (ins && ins.length) {
    await emailUser(c.creator_id, `New sale: ${c.title}`,
      `<h2>You made a sale</h2><p>Someone just bought <b>${esc(c.title)}</b>. Your share is <b>${esc(moneyText(e.amountKobo))}</b>, available after the ${MARKET.refundWindowDays}-day refund window.</p>
       <p><a href="${esc(SITE_URL)}/teach/studio?tab=earnings">See your earnings</a></p>`);
  }
  return { ok: true, message: "Enrolled." };
}

/** Admin-flagged free courses: enrol without payment. */
export async function grantFreeEnrollment(userId: string, c: Course) {
  if (!c.is_free || c.status !== "live") return { ok: false };
  const { error } = await db().from("course_enrollments").upsert({
    course_id: c.id, user_id: userId, payment_id: null, price_paid_kobo: 0, currency: "NGN", source: "free", status: "active"
  }, { onConflict: "course_id,user_id" });
  return { ok: !error };
}

/**
 * Self-heal: if the learner paid for this course but the enrollment is missing (e.g. the handler failed),
 * run handleCoursePayment again for their successful payments of this course.
 */
export async function healEnrollment(userId: string, courseId: string) {
  const { data } = await db().from("payments").select("*").eq("user_id", userId).eq("product", `course:${courseId}`).eq("status", "success").limit(3);
  for (const p of (data || []) as PaymentRow[]) { try { await handleCoursePayment(p); } catch (e) { console.error("[marketplace] heal failed", e); } }
}

/** Pending earnings whose refund window has closed become available. Returns how many changed. */
export async function releaseDueEarnings(): Promise<number> {
  const { data } = await db().from("creator_earnings").update({ status: "available" }).eq("status", "pending").lte("available_at", new Date().toISOString()).select("id");
  return data?.length ?? 0;
}

export type EarningRow = { id: string; course_id: string; payment_id: string; gross_kobo: number; fees_kobo: number; share: number; amount_kobo: number; status: string; available_at: string; paid_at: string | null; payout_ref: string | null; created_at: string };
export async function creatorEarnings(creatorId: string) {
  const { data } = await db().from("creator_earnings").select("*").eq("creator_id", creatorId).order("created_at", { ascending: false }).limit(500);
  const rows = (data || []) as EarningRow[];
  const now = Date.now();
  const sum = (f: (e: EarningRow) => boolean) => rows.filter(f).reduce((a, e) => a + e.amount_kobo, 0);
  return {
    rows,
    pending: sum(e => e.status === "pending" && new Date(e.available_at).getTime() > now),
    available: sum(e => e.status === "available" || (e.status === "pending" && new Date(e.available_at).getTime() <= now)),
    paid: sum(e => e.status === "paid"),
    reversed: sum(e => e.status === "reversed")
  };
}
