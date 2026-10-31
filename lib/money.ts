/**
 * Pure money logic for payments and referrals. No "@/" imports and no I/O, so it can be unit-tested
 * with `tsx --test tests/payments.test.mjs`. All amounts are in minor units (kobo for NGN, cents for USD).
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { PRODUCTS, REFERRAL, type Product, type ProductId } from "./pricing";

export type Currency = "NGN" | "USD";
export const DAY_MS = 86_400_000;
/** Instalments 1..n-1 give access until this many days after that payment. */
export const INSTALMENT_ACCESS_DAYS = 35;
/** Membership included with a cohort seat. */
export const COHORT_MEMBER_DAYS = 90;

export const toMinor = (major: number) => Math.round(major * 100);
export const fromMinor = (minor: number) => Math.round(minor) / 100;
export const addDays = (d: Date, days: number) => new Date(d.getTime() + days * DAY_MS);

/** Referral codes: 3–32 letters, digits, "_" or "-", stored upper-case. Returns "" for anything else. */
export function normaliseCode(input: unknown): string {
  const s = String(input ?? "").trim().toUpperCase();
  return /^[A-Z0-9_-]{3,32}$/.test(s) ? s : "";
}

/** The friend discount (10%) applies to plans (course, cohort, first month of Membership), never to Membership renewals or add-ons. */
export function discountApplies(p: Pick<Product, "id" | "kind" | "ngn">, isRenewal: boolean): boolean {
  if (p.ngn <= 0) return false;
  if (p.id === "member" && isRenewal) return false;
  return p.kind === "plan";
}

/** Products whose payments earn the referrer a commission. Packs (template bundle) pay the flat pack rate. */
export const COMMISSION_PRODUCTS: ProductId[] = ["self", "cohort", "member", "story", "bundle", "crmspec"];
export const PACK_PRODUCTS: ProductId[] = ["bundle"];

/** Whether a referral code attaches to this purchase at all (commission and/or discount). */
export function referralApplies(p: Pick<Product, "id">, isRenewal: boolean): boolean {
  if (p.id === "member" && isRenewal) return false;
  return COMMISSION_PRODUCTS.includes(p.id);
}

/** Price after a code's percentage off (minor units), never below 1% of the price. */
export const applyPercent = (minor: number, percent: number) => minor - Math.round(minor * Math.min(DISCOUNT_CODE_MAX_PERCENT, Math.max(0, Math.floor(percent))) / 100);

/** Discount codes (Admin → Settings): 1–90% off; never 100%, because Paystack can't take a ₦0 payment. */
export const DISCOUNT_CODE_MAX_PERCENT = 90;
export type DiscountCodeRow = {
  code: string; percent: number; active: boolean; products: string[] | null; starts_at: string | null; ends_at: string | null;
  max_uses: number | null; once_per_user: boolean;
  /** Applies to Automancy's own products (default true). */ platform?: boolean;
  /** Applies to every creator course whose creator allows discounts. */ all_courses?: boolean;
  /** Applies to this one creator course. */ course_id?: string | null;
  /** Set when a creator made the code for their own course. */ owner_id?: string | null;
};
/** What is being bought: one of Automancy's products, or a creator course (and whether its creator allows promotions). */
export type DiscountTarget = { productId: string } | { course: { id: string; allowDiscounts: boolean } };
/** Whether a code covers this purchase at all (ignoring dates and limits). */
export function discountCovers(c: DiscountCodeRow, t: DiscountTarget): boolean {
  if ("course" in t) {
    if (c.course_id) return c.course_id === t.course.id && (!!c.owner_id || t.course.allowDiscounts);
    return !!c.all_courses && t.course.allowDiscounts;
  }
  if (c.course_id || c.owner_id || c.platform === false) return false;
  return !(c.products && c.products.length && !c.products.includes(t.productId));
}
/** Why a code can't be used for this purchase, or null when it can. Usage counts come from successful payments. */
export function discountCodeProblem(c: DiscountCodeRow | null | undefined, o: ({ productId: string } | { course: { id: string; allowDiscounts: boolean } }) & { now?: Date; uses: number; usedByBuyer: number }): string | null {
  if (!c || !c.active) return "That discount code isn't valid.";
  const now = (o.now || new Date()).getTime();
  if (c.starts_at && new Date(c.starts_at).getTime() > now) return "That discount code isn't active yet.";
  if (c.ends_at && new Date(c.ends_at).getTime() <= now) return "That discount code has expired.";
  if (!discountCovers(c, "course" in o ? { course: o.course } : { productId: o.productId })) return "course" in o ? "That discount code doesn't apply to this course." : "That discount code doesn't apply to this product.";
  if (c.max_uses != null && o.uses >= c.max_uses) return "That discount code has been fully used.";
  if (c.once_per_user && o.usedByBuyer > 0) return "You've already used that discount code.";
  if (!(c.percent >= 1 && c.percent <= DISCOUNT_CODE_MAX_PERCENT)) return "That discount code isn't valid.";
  return null;
}
/** End of the given Lagos calendar day (YYYY-MM-DD), as an ISO time: an "ends on" date includes that whole day. */
export const endOfLagosDay = (ymd: string) => /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? new Date(Date.parse(ymd + "T23:59:59Z") - 3_600_000).toISOString() : null;
export const startOfLagosDay = (ymd: string) => /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? new Date(Date.parse(ymd + "T00:00:00Z") - 3_600_000).toISOString() : null;

export type DiscountSource = "referral" | "code" | null;
export type Quote = { ok: true; listMinor: number; discountMinor: number; amountMinor: number; installmentsTotal: number; currency: Currency; discountSource: DiscountSource }
  | { ok: false; error: string };

/**
 * What the learner pays for one transaction. With installments, this is one instalment (NGN only).
 * codePercent: a valid discount code's percentage (Admin → Settings). Discounts don't stack: the larger of the
 * friend (referral) discount and the code applies. The referrer still earns commission on what is actually paid.
 */
export function quote(p: Product, o: { currency: Currency; installments: boolean; referral: boolean; isRenewal: boolean; codePercent?: number }): Quote {
  if (p.ngn <= 0) return { ok: false, error: "This product is free." };
  let listMinor: number; let installmentsTotal = 1; const currency = o.currency;
  if (o.installments) {
    if (!p.installments) return { ok: false, error: "Pay in 3 isn't available for this product." };
    if (currency !== "NGN") return { ok: false, error: "Pay in 3 is in naira only." };
    listMinor = toMinor(p.installments.ngn); installmentsTotal = p.installments.count;
  } else {
    listMinor = toMinor(currency === "USD" ? p.usd : p.ngn);
  }
  if (listMinor <= 0) return { ok: false, error: "This product has no price in that currency." };
  const refMinor = o.referral && discountApplies(p, o.isRenewal) ? Math.round(listMinor * REFERRAL.friendDiscount) : 0;
  const pct = Math.min(DISCOUNT_CODE_MAX_PERCENT, Math.max(0, Math.floor(o.codePercent || 0)));
  const codeMinor = pct > 0 ? Math.round(listMinor * pct / 100) : 0;
  const discountMinor = Math.max(refMinor, codeMinor);
  const discountSource: DiscountSource = discountMinor === 0 ? null : codeMinor >= refMinor ? "code" : "referral";
  return { ok: true, listMinor, discountMinor, amountMinor: listMinor - discountMinor, installmentsTotal, currency, discountSource };
}

export type Tier = "friend" | "graduate" | "ambassador" | "pack";
export const AMBASSADOR_MIN_REFERRALS = 10;
export const AMBASSADOR_WINDOW_DAYS = 90;

/** Cohort commissions never exceed 25%, even for ambassadors (pricing research, Oct 2026). */
export const COHORT_COMMISSION_CAP = 0.25;

/**
 * Commission tier: packs 30%; otherwise ambassador (10+ paid referrals in 90 days) 30%, graduate (valid certificate) 25%,
 * friend 20%. Cohort payments are capped at COHORT_COMMISSION_CAP. Paid on the amount actually paid (each instalment, after discount).
 */
export function commissionTier(o: { productId: string; hasCertificate: boolean; paidReferrals90d: number }): { tier: Tier; rate: number } {
  if (PACK_PRODUCTS.includes(o.productId as ProductId)) return { tier: "pack", rate: REFERRAL.packCommission };
  const t: { tier: Tier; rate: number } =
    o.paidReferrals90d >= AMBASSADOR_MIN_REFERRALS ? { tier: "ambassador", rate: REFERRAL.tiers.ambassador }
    : o.hasCertificate ? { tier: "graduate", rate: REFERRAL.tiers.graduate }
    : { tier: "friend", rate: REFERRAL.tiers.friend };
  if (o.productId === "cohort") t.rate = Math.min(t.rate, COHORT_COMMISSION_CAP);
  return t;
}

/** Canonical mailbox for self-referral checks: lower-case, "+tag" removed, and dots ignored for Gmail. */
export function canonicalEmail(email: unknown): string {
  const s = String(email ?? "").trim().toLowerCase();
  const at = s.lastIndexOf("@");
  if (at < 1) return s;
  let local = s.slice(0, at).split("+")[0];
  let domain = s.slice(at + 1);
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}
/** Self-referral: same account, or the same mailbox behind two accounts. */
export const isSelfReferral = (o: { buyerId: string; buyerEmail?: string | null; referrerId: string; referrerEmail?: string | null }) =>
  o.buyerId === o.referrerId || (!!o.buyerEmail && !!o.referrerEmail && canonicalEmail(o.buyerEmail) === canonicalEmail(o.referrerEmail));

/** Naira-kobo value of a payment, for commissions. USD payments convert at the product's own NGN/USD list-price ratio. */
export function ngnEquivalentMinor(amountMinor: number, currency: Currency, p: Pick<Product, "ngn" | "usd">): number {
  if (currency === "NGN") return amountMinor;
  return p.usd > 0 ? Math.round(amountMinor * p.ngn / p.usd) : 0;
}
export const commissionMinor = (baseMinor: number, rate: number) => Math.floor(baseMinor * rate);
/** Earnings become approvable when the buyer's refund window has closed. */
export const earningAvailableAt = (paidAt: Date) => addDays(paidAt, REFERRAL.refundWindowDays);

/** Refund policy: a request must be made within REFERRAL.refundWindowDays (14) of payment. */
export const refundDeadline = (paidAt: Date | string) => addDays(new Date(paidAt), REFERRAL.refundWindowDays);
export const withinRefundWindow = (paidAt: Date | string | null | undefined, now: Date = new Date()) =>
  !!paidAt && now.getTime() <= refundDeadline(paidAt).getTime();

/** What each product unlocks. days null = no expiry. extend = add to the current expiry (Membership). */
export type GrantRule = { product: string; days: number | null; extend?: boolean };
const daysOf = (id: ProductId) => PRODUCTS.find(p => p.id === id)?.accessDays ?? null;
export function grantRules(productId: string): GrantRule[] {
  switch (productId) {
    case "self": return [{ product: "self", days: 365 }];
    case "cohort": return [
      { product: "cohort", days: daysOf("cohort") ?? 365 },
      { product: "story", days: daysOf("story") },
      { product: "bundle", days: daysOf("bundle") },
      { product: "member", days: COHORT_MEMBER_DAYS, extend: true }
    ];
    case "member": return [{ product: "member", days: daysOf("member") ?? 31, extend: true }];
    case "story": case "bundle": case "crmspec": case "team": case "employer_post":
      return [{ product: productId, days: daysOf(productId) }];
    default: return [];
  }
}

export type Grant = { product: string; startsAt: Date; expiresAt: Date | null };
/**
 * Enrollment rows to create for a successful payment.
 * - Single payment: each rule from paidAt (extend rules from the later of paidAt and the current expiry).
 * - Instalments 1..n-1: every grant ends INSTALMENT_ACCESS_DAYS after that payment.
 * - Final instalment: the normal durations, counted from the FIRST instalment's payment date.
 */
export function accessPlan(o: {
  productId: string; paidAt: Date; installmentNo?: number; installmentsTotal?: number;
  firstPaidAt?: Date | null; currentExpiry?: Record<string, Date | null | undefined>;
}): Grant[] {
  const no = o.installmentNo ?? 1, total = o.installmentsTotal ?? 1;
  const rules = grantRules(o.productId);
  if (total > 1 && no < total) {
    return rules.map(r => ({ product: r.product, startsAt: o.paidAt, expiresAt: addDays(o.paidAt, INSTALMENT_ACCESS_DAYS) }));
  }
  const base = total > 1 ? (o.firstPaidAt ?? o.paidAt) : o.paidAt;
  return rules.map(r => {
    if (r.days == null) return { product: r.product, startsAt: o.paidAt, expiresAt: null };
    let start = base;
    const cur = r.extend ? o.currentExpiry?.[r.product] : null;
    if (cur && cur.getTime() > start.getTime()) start = cur;
    return { product: r.product, startsAt: o.paidAt, expiresAt: addDays(start, r.days) };
  });
}

/** Paystack webhook check: HMAC-SHA512 of the raw body with the secret key, hex, compared in constant time. */
export function verifySignature(rawBody: string | Buffer, header: string | null | undefined, secret: string | null | undefined): boolean {
  if (!header || !secret) return false;
  const expected = Buffer.from(createHmac("sha512", secret).update(rawBody).digest("hex"), "utf8");
  const given = Buffer.from(header.trim().toLowerCase(), "utf8");
  if (expected.length !== given.length) return false;
  return timingSafeEqual(expected, given);
}

/** Our transaction reference: AM-<PRODUCT>-<time>-<random>. Only letters, digits and "-" (Paystack allows these). */
export function makeReference(productId: string): string {
  return `AM-${productId.toUpperCase().replace(/[^A-Z0-9]/g, "")}-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

/** One CSV line. Quotes every field and defuses spreadsheet formulas (=, +, -, @ at the start). */
export function csvRow(values: unknown[]): string {
  return values.map(v => {
    let s = v == null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }).join(",");
}

/** Strip characters that have meaning in PostgREST filter strings, for admin search boxes. */
export const safeSearch = (q: unknown) => String(q ?? "").replace(/[,()*%\\:"']/g, " ").trim().slice(0, 80);

/** Format minor units for display (kept here so tests can cover it). */
export function moneyText(minor: number, currency: Currency = "NGN"): string {
  const major = fromMinor(minor);
  return currency === "USD"
    ? "$" + major.toLocaleString("en-US", { minimumFractionDigits: major % 1 ? 2 : 0, maximumFractionDigits: 2 })
    : "₦" + major.toLocaleString("en-NG", { minimumFractionDigits: major % 1 ? 2 : 0, maximumFractionDigits: 2 });
}
