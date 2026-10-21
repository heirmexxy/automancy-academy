import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { COMPANY, SITE_NAME, SITE_URL, SUPPORT_EMAIL } from "@/lib/config";
import { product } from "@/lib/pricing";
import { esc, fmtDate } from "@/lib/format";
import { accessPlan, moneyText, verifySignature as verifyHmac, type Currency } from "@/lib/money";
import { recordReferralEarning } from "@/lib/referrals";

/**
 * Paystack (https://paystack.com/docs/api/) called with fetch, plus payment fulfilment shared by the webhook
 * and the callback page. With no PAYSTACK_SECRET_KEY (PLACEHOLDER) every API call returns { ok: false }.
 */
const API = "https://api.paystack.co";
type Res<T> = { ok: boolean; message: string; data: T | null };

async function call<T>(path: string, method: "GET" | "POST" = "GET", body?: unknown): Promise<Res<T>> {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) return { ok: false, message: "Paystack is not configured yet.", data: null };
  try {
    const r = await fetch(API + path, {
      method, cache: "no-store",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    });
    const j = await r.json().catch(() => ({} as Record<string, unknown>));
    return { ok: r.ok && j.status === true, message: String(j.message || r.statusText), data: (j.data ?? null) as T | null };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e), data: null };
  }
}

export type PsTransaction = {
  id: number; status: string; reference: string; amount: number; currency: string; paid_at: string | null;
  gateway_response?: string; customer?: { email?: string }; metadata?: Record<string, unknown> | null;
};

export function initializeTransaction(o: { email: string; amountMinor: number; currency: Currency; reference: string; callbackUrl: string; metadata?: Record<string, unknown> }) {
  return call<{ authorization_url: string; access_code: string; reference: string }>("/transaction/initialize", "POST", {
    email: o.email, amount: o.amountMinor, currency: o.currency, reference: o.reference, callback_url: o.callbackUrl, metadata: o.metadata
  });
}
export const verifyTransaction = (reference: string) => call<PsTransaction>(`/transaction/verify/${encodeURIComponent(reference)}`);
/** Full refund unless amountMinor is given. */
export const refundTransaction = (reference: string, amountMinor?: number) =>
  call<{ status: string; transaction?: { reference?: string } }>("/refund", "POST", amountMinor ? { transaction: reference, amount: amountMinor } : { transaction: reference });
export const resolveAccount = (accountNumber: string, bankCode: string) =>
  call<{ account_number: string; account_name: string }>(`/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`);
/** Bank code + account number → recipient_code. The account number goes to Paystack only; we keep the last 4 digits. */
export const createTransferRecipient = (o: { name: string; accountNumber: string; bankCode: string }) =>
  call<{ recipient_code: string; details?: { account_name?: string; bank_name?: string } }>("/transferrecipient", "POST", {
    type: "nuban", name: o.name, account_number: o.accountNumber, bank_code: o.bankCode, currency: "NGN"
  });
export async function listBanks(): Promise<{ name: string; code: string }[]> {
  const r = await call<{ name: string; code: string; active?: boolean }[]>("/bank?country=nigeria&currency=NGN&perPage=200");
  return (r.data || []).filter(b => b.active !== false).map(b => ({ name: b.name, code: b.code }));
}
/** Webhook signature check with the secret key. */
export const verifySignature = (rawBody: string, header: string | null) => verifyHmac(rawBody, header, process.env.PAYSTACK_SECRET_KEY);

// ── Fulfilment ────────────────────────────────────────────────────────────────

export type PaymentRow = {
  id: string; user_id: string; product: string; reference: string; amount_kobo: number; currency: Currency; status: string;
  installment_no: number; installments_total: number; plan_ref: string | null; referral_code: string | null;
  discount_kobo: number; paystack_id: number | null; paid_at: string | null; created_at: string;
};
export type FulfilResult = { ok: boolean; status: string; message: string; payment: PaymentRow | null };

async function audit(action: string, target: string, detail: unknown) {
  try { await createAdminClient().from("audit_log").insert({ actor: null, action, target, detail }); } catch { /* best effort */ }
}

/**
 * Verifies a transaction with Paystack and, the first time it succeeds, grants access, records the referral
 * earning and sends the receipt. Safe to call any number of times for the same reference.
 */
export type FulfilHooks = {
  /** Marketplace courses (writer H): lib/marketplace.ts handleCoursePayment. Passed in by the webhook and callback to avoid an import cycle. */
  onCourse?: (payment: PaymentRow) => Promise<unknown>;
};
const isCourse = (m: unknown): m is { kind: "course"; course_id?: string; user_id?: string } =>
  !!m && typeof m === "object" && (m as Record<string, unknown>).kind === "course";

export async function fulfilPayment(reference: string, hooks: FulfilHooks = {}): Promise<FulfilResult> {
  const db = createAdminClient();
  const { data: pay } = await db.from("payments").select("*").eq("reference", reference).maybeSingle();
  let payment = pay as PaymentRow | null;
  if (!payment) {
    // Marketplace course purchases may be initialised without a payments row: create it from the VERIFIED transaction
    // (metadata is set server-side at initialisation, so user_id and course_id come from us, not the buyer).
    const pre = await verifyTransaction(reference);
    const m = pre.data?.metadata;
    if (pre.ok && pre.data && pre.data.status === "success" && isCourse(m) && m.user_id && m.course_id && (pre.data.currency === "NGN" || pre.data.currency === "USD")) {
      await db.from("payments").upsert({
        user_id: m.user_id, product: `course:${String(m.course_id).slice(0, 80)}`, reference, amount_kobo: pre.data.amount,
        currency: pre.data.currency, status: "initialized"
      }, { onConflict: "reference", ignoreDuplicates: true });
      const { data: again } = await db.from("payments").select("*").eq("reference", reference).maybeSingle();
      payment = again as PaymentRow | null;
    }
  }
  if (!payment) return { ok: false, status: "unknown", message: "We couldn't find that payment.", payment: null };
  if (payment.status === "success") return { ok: true, status: "success", message: "Payment confirmed.", payment };
  if (payment.status !== "initialized") return { ok: false, status: payment.status, message: `This payment is ${payment.status.replace("_", " ")}.`, payment };

  const v = await verifyTransaction(reference);
  if (!v.ok || !v.data) return { ok: false, status: "unverified", message: "We couldn't confirm this payment with Paystack yet. If you were charged, it will show in your account within a few minutes.", payment };
  const t = v.data;
  if (t.status !== "success") {
    if (t.status === "failed" || t.status === "reversed") await db.from("payments").update({ status: "failed", raw: t }).eq("id", payment.id).eq("status", "initialized");
    return { ok: false, status: t.status, message: t.gateway_response || "The payment wasn't completed.", payment };
  }
  if (t.amount !== payment.amount_kobo || t.currency !== payment.currency || t.reference !== payment.reference) {
    console.error("[paystack] amount/currency mismatch", { reference, expected: [payment.amount_kobo, payment.currency], got: [t.amount, t.currency] });
    await db.from("payments").update({ status: "failed", raw: t }).eq("id", payment.id).eq("status", "initialized");
    await audit("payment_mismatch", payment.id, { reference, expected: payment.amount_kobo, got: t.amount, currency: t.currency });
    return { ok: false, status: "failed", message: "The amount paid didn't match the order. Please contact support.", payment };
  }

  const paidAt = t.paid_at || new Date().toISOString();
  // Conditional update: only one caller (webhook or callback) wins and fulfils.
  const { data: won } = await db.from("payments").update({ status: "success", paystack_id: t.id, paid_at: paidAt, raw: t })
    .eq("id", payment.id).eq("status", "initialized").select("*");
  const updated = (won && won[0]) as PaymentRow | undefined;
  if (!updated) {
    const { data: again } = await db.from("payments").select("*").eq("id", payment.id).maybeSingle();
    return { ok: (again as PaymentRow | null)?.status === "success", status: (again as PaymentRow | null)?.status || "unknown", message: "Payment confirmed.", payment: again as PaymentRow | null };
  }

  if (isCourse(t.metadata) || updated.product.startsWith("course:")) {
    // Marketplace course: H grants course_enrollments and records the creator's earning (and should check the price).
    if (!hooks.onCourse) { console.error("[paystack] course payment without a handler", updated.reference); await audit("fulfil_error", updated.id, { step: "course", error: "no handler" }); }
    else { try { await hooks.onCourse(updated); } catch (e) { console.error("[paystack] course handler failed", e); await audit("fulfil_error", updated.id, { step: "course", error: String(e) }); } }
    try { await sendReceipt(updated); } catch (e) { console.error("[paystack] receipt failed", e); }
    return { ok: true, status: "success", message: "Payment confirmed.", payment: updated };
  }
  try { await grantAccess(updated); } catch (e) { console.error("[paystack] grant failed", e); await audit("fulfil_error", updated.id, { step: "grant", error: String(e) }); }
  try { await recordReferralEarning(updated); } catch (e) { console.error("[paystack] referral failed", e); await audit("fulfil_error", updated.id, { step: "referral", error: String(e) }); }
  try { await sendReceipt(updated); } catch (e) { console.error("[paystack] receipt failed", e); }
  return { ok: true, status: "success", message: "Payment confirmed.", payment: updated };
}

async function grantAccess(p: PaymentRow) {
  const db = createAdminClient();
  let firstPaidAt: Date | null = null;
  if (p.installments_total > 1 && p.plan_ref) {
    const { data: first } = await db.from("payments").select("paid_at").eq("reference", p.plan_ref).maybeSingle();
    if (first?.paid_at) firstPaidAt = new Date(first.paid_at as string);
  }
  const { data: memberRows } = await db.from("enrollments").select("expires_at").eq("user_id", p.user_id).eq("product", "member").eq("status", "active");
  const memberExpiry = (memberRows || []).map(r => r.expires_at ? new Date(r.expires_at as string) : null)
    .reduce<Date | null>((a, d) => (d && (!a || d > a) ? d : a), null);
  const grants = accessPlan({
    productId: p.product, paidAt: new Date(p.paid_at || Date.now()), installmentNo: p.installment_no,
    installmentsTotal: p.installments_total, firstPaidAt, currentExpiry: { member: memberExpiry }
  });
  if (!grants.length) return;
  const note = p.installments_total > 1 ? `Instalment ${p.installment_no} of ${p.installments_total}` : null;
  const { error } = await db.from("enrollments").insert(grants.map(g => ({
    user_id: p.user_id, product: g.product, status: "active", source: "paystack", payment_id: p.id,
    started_at: g.startsAt.toISOString(), expires_at: g.expiresAt ? g.expiresAt.toISOString() : null, note
  })));
  if (error) throw new Error(error.message);
}

async function sendReceipt(p: PaymentRow) {
  const db = createAdminClient();
  const { data: prof } = await db.from("profiles").select("email, full_name").eq("id", p.user_id).maybeSingle();
  if (!prof?.email) return;
  const name = product(p.product)?.name || (p.product.startsWith("course:") ? "Marketplace course" : p.product);
  const row = (k: string, v: string) => `<tr><td style="padding:4px 12px 4px 0;color:#666">${esc(k)}</td><td style="padding:4px 0"><b>${esc(v)}</b></td></tr>`;
  const html = `<div style="font-family:system-ui,sans-serif;max-width:560px">
    <h2>Thank you${prof.full_name ? ", " + esc(String(prof.full_name)) : ""}!</h2>
    <p>Your payment for <b>${esc(name)}</b> is confirmed. Here is your receipt.</p>
    <table>${row("Product", name)}${p.installments_total > 1 ? row("Instalment", `${p.installment_no} of ${p.installments_total}`) : ""}
    ${p.discount_kobo ? row("Referral discount", moneyText(p.discount_kobo, p.currency)) : ""}
    ${row("Amount paid", moneyText(p.amount_kobo, p.currency))}${row("Date", fmtDate(p.paid_at || new Date()))}${row("Reference", p.reference)}</table>
    <p><a href="${esc(SITE_URL)}/learn">Start learning</a> · Receipts and refunds: <a href="${esc(SITE_URL)}/account">your account</a></p>
    <p style="color:#666;font-size:13px">${esc(COMPANY.legalName)} · ${esc(COMPANY.address)} · ${esc(SUPPORT_EMAIL)}</p></div>`;
  await sendEmail(String(prof.email), `Your ${SITE_NAME} receipt: ${name}`, html);
}

/**
 * Applies a refund: payment refunded (or partially_refunded), enrollments from the payment (and the rest of its
 * Pay-in-3 plan) marked refunded, the referral earning reversed, any open/approved request marked refunded.
 */
export async function applyRefund(paymentId: string, o: { partial?: boolean; decidedBy?: string | null } = {}) {
  const db = createAdminClient();
  const { data: pay } = await db.from("payments").select("*").eq("id", paymentId).maybeSingle();
  const p = pay as PaymentRow | null;
  if (!p) return { ok: false };
  await db.from("payments").update({ status: o.partial ? "partially_refunded" : "refunded" }).eq("id", p.id);
  let ids = [p.id];
  if (p.plan_ref) {
    const { data: plan } = await db.from("payments").select("id").eq("plan_ref", p.plan_ref);
    ids = [...new Set([...ids, ...(plan || []).map(r => r.id as string)])];
  }
  if (!o.partial) await db.from("enrollments").update({ status: "refunded" }).in("payment_id", ids).eq("status", "active");
  await db.from("referral_earnings").update({ status: "reversed", payout_id: null }).eq("payment_id", p.id).in("status", ["pending", "approved"]);
  await db.from("refund_requests").update({ status: "refunded", decided_at: new Date().toISOString(), ...(o.decidedBy ? { decided_by: o.decidedBy } : {}) })
    .eq("payment_id", p.id).in("status", ["open", "approved"]);
  return { ok: true };
}

/** An unfinished Pay-in-3 plan for this product, if the learner has one. */
export async function openInstalmentPlan(userId: string, productId: string) {
  const db = createAdminClient();
  const { data: firsts } = await db.from("payments").select("reference, amount_kobo, discount_kobo, referral_code, installments_total, paid_at")
    .eq("user_id", userId).eq("product", productId).eq("installment_no", 1).gt("installments_total", 1).eq("status", "success")
    .order("created_at", { ascending: false }).limit(1);
  const first = firsts?.[0];
  if (!first) return null;
  const { data: plan } = await db.from("payments").select("installment_no, status").eq("plan_ref", first.reference as string);
  const paid = (plan || []).filter(r => r.status === "success").length;
  if ((plan || []).some(r => r.status === "refunded" || r.status === "partially_refunded")) return null;
  const total = first.installments_total as number;
  if (paid >= total) return null;
  return {
    planRef: first.reference as string, nextNo: paid + 1, total, amountKobo: first.amount_kobo as number,
    discountKobo: first.discount_kobo as number, referralCode: (first.referral_code as string | null) || null, firstPaidAt: first.paid_at as string
  };
}
