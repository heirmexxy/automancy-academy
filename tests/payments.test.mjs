// Run: tsx --test tests/payments.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import * as moneyNs from "../lib/money.ts";
import * as pricingNs from "../lib/pricing.ts";
// tsx loads .ts as CommonJS in a package without "type": "module": exports land on .default
const M = moneyNs.default ?? moneyNs, PR = pricingNs.default ?? pricingNs;
const {
  toMinor, fromMinor, normaliseCode, discountApplies, referralApplies, quote, commissionTier,
  ngnEquivalentMinor, commissionMinor, earningAvailableAt, withinRefundWindow, refundDeadline,
  accessPlan, grantRules, verifySignature, makeReference, csvRow, safeSearch, moneyText, addDays,
  INSTALMENT_ACCESS_DAYS, COHORT_COMMISSION_CAP, canonicalEmail, isSelfReferral
} = M;
const { PRODUCTS, REFERRAL, product } = PR;

const P = id => product(id);
const day = 86400000;

test("kobo conversion", () => {
  assert.equal(toMinor(45000), 4500000);
  assert.equal(toMinor(79.99), 7999);
  assert.equal(fromMinor(4500000), 45000);
  assert.equal(toMinor(0.1 + 0.2), 30);
});

test("referral codes are normalised and validated", () => {
  assert.equal(normaliseCode(" emeka1a2b "), "EMEKA1A2B");
  assert.equal(normaliseCode("ab"), "");
  assert.equal(normaliseCode("bad code!"), "");
  assert.equal(normaliseCode(undefined), "");
});

test("discount: plans yes, membership renewals and add-ons no", () => {
  assert.equal(discountApplies(P("self"), false), true);
  assert.equal(discountApplies(P("cohort"), false), true);
  assert.equal(discountApplies(P("member"), false), true);
  assert.equal(discountApplies(P("member"), true), false);
  assert.equal(discountApplies(P("bundle"), false), false);
  assert.equal(discountApplies(P("story"), false), false);
  assert.equal(discountApplies(P("free"), false), false);
  assert.equal(referralApplies(P("bundle"), false), true);
  assert.equal(referralApplies(P("member"), true), false);
  assert.equal(referralApplies(P("employer_post"), false), false);
});

test("quote: full price, referral discount, USD", () => {
  const self = P("self");
  const q = quote(self, { currency: "NGN", installments: false, referral: false, isRenewal: false });
  assert.ok(q.ok); assert.equal(q.amountMinor, toMinor(self.ngn)); assert.equal(q.discountMinor, 0);
  const r = quote(self, { currency: "NGN", installments: false, referral: true, isRenewal: false });
  assert.ok(r.ok); assert.equal(r.discountMinor, Math.round(toMinor(self.ngn) * REFERRAL.friendDiscount));
  assert.equal(r.amountMinor + r.discountMinor, toMinor(self.ngn));
  const u = quote(self, { currency: "USD", installments: false, referral: true, isRenewal: false });
  assert.ok(u.ok); assert.equal(u.listMinor, toMinor(self.usd)); assert.equal(u.currency, "USD");
  const b = quote(P("bundle"), { currency: "NGN", installments: false, referral: true, isRenewal: false });
  assert.ok(b.ok); assert.equal(b.discountMinor, 0);
});

test("quote: pay in 3 is NGN only and only where offered", () => {
  const self = P("self");
  const q = quote(self, { currency: "NGN", installments: true, referral: true, isRenewal: false });
  assert.ok(q.ok); assert.equal(q.installmentsTotal, self.installments.count);
  assert.equal(q.listMinor, toMinor(self.installments.ngn));
  assert.equal(q.amountMinor, toMinor(self.installments.ngn) - Math.round(toMinor(self.installments.ngn) * REFERRAL.friendDiscount));
  assert.equal(quote(self, { currency: "USD", installments: true, referral: false, isRenewal: false }).ok, false);
  assert.equal(quote(P("story"), { currency: "NGN", installments: true, referral: false, isRenewal: false }).ok, false);
  assert.equal(quote(P("free"), { currency: "NGN", installments: false, referral: false, isRenewal: false }).ok, false);
});

test("commission tiers", () => {
  assert.deepEqual(commissionTier({ productId: "self", hasCertificate: false, paidReferrals90d: 0 }), { tier: "friend", rate: REFERRAL.tiers.friend });
  assert.deepEqual(commissionTier({ productId: "self", hasCertificate: true, paidReferrals90d: 3 }), { tier: "graduate", rate: REFERRAL.tiers.graduate });
  assert.deepEqual(commissionTier({ productId: "self", hasCertificate: false, paidReferrals90d: 10 }), { tier: "ambassador", rate: REFERRAL.tiers.ambassador });
  assert.deepEqual(commissionTier({ productId: "self", hasCertificate: true, paidReferrals90d: 9 }).tier, "graduate");
  assert.deepEqual(commissionTier({ productId: "bundle", hasCertificate: false, paidReferrals90d: 0 }), { tier: "pack", rate: REFERRAL.packCommission });
  assert.equal(commissionMinor(4050000, 0.2), 810000);
  assert.equal(commissionMinor(333, 0.25), 83);
});

test("cohort commission is capped at 25% even for ambassadors", () => {
  assert.equal(COHORT_COMMISSION_CAP, 0.25);
  const a = commissionTier({ productId: "cohort", hasCertificate: false, paidReferrals90d: 12 });
  assert.equal(a.tier, "ambassador"); assert.equal(a.rate, 0.25);
  assert.equal(commissionTier({ productId: "cohort", hasCertificate: false, paidReferrals90d: 0 }).rate, REFERRAL.tiers.friend);
  assert.equal(commissionTier({ productId: "self", hasCertificate: false, paidReferrals90d: 12 }).rate, REFERRAL.tiers.ambassador);
});

test("commission is on the amount actually paid: each instalment, after discount", () => {
  const self = P("self");
  const q = quote(self, { currency: "NGN", installments: true, referral: true, isRenewal: false });
  const { rate } = commissionTier({ productId: "self", hasCertificate: false, paidReferrals90d: 0 });
  assert.equal(commissionMinor(q.amountMinor, rate), Math.floor(toMinor(self.installments.ngn) * (1 - REFERRAL.friendDiscount) * rate));
});

test("self-referral: same account or same mailbox", () => {
  assert.equal(canonicalEmail("Tolu.Ade+promo@GoogleMail.com"), "toluade@gmail.com");
  assert.equal(canonicalEmail("tolu.ade+x@yahoo.com"), "tolu.ade@yahoo.com");
  assert.equal(isSelfReferral({ buyerId: "a", referrerId: "a" }), true);
  assert.equal(isSelfReferral({ buyerId: "a", buyerEmail: "t.olu@gmail.com", referrerId: "b", referrerEmail: "tolu+2@gmail.com" }), true);
  assert.equal(isSelfReferral({ buyerId: "a", buyerEmail: "tolu@gmail.com", referrerId: "b", referrerEmail: "ada@gmail.com" }), false);
  assert.equal(isSelfReferral({ buyerId: "a", buyerEmail: null, referrerId: "b", referrerEmail: "ada@gmail.com" }), false);
});

test("USD commissions convert at the product's list-price ratio", () => {
  const self = P("self");
  assert.equal(ngnEquivalentMinor(toMinor(self.usd), "USD", self), toMinor(self.ngn));
  assert.equal(ngnEquivalentMinor(12345, "NGN", self), 12345);
});

test("earnings become available after the refund window", () => {
  const paid = new Date("2026-10-01T10:00:00Z");
  assert.equal(earningAvailableAt(paid).getTime() - paid.getTime(), REFERRAL.refundWindowDays * day);
});

test("refund window is 14 days from payment", () => {
  const paid = new Date("2026-10-01T10:00:00Z");
  assert.equal(REFERRAL.refundWindowDays, 14);
  assert.equal(withinRefundWindow(paid, addDays(paid, 13)), true);
  assert.equal(withinRefundWindow(paid, addDays(paid, 14)), true);
  assert.equal(withinRefundWindow(paid, addDays(paid, 14.01)), false);
  assert.equal(withinRefundWindow(null), false);
  assert.equal(refundDeadline(paid.toISOString()).toISOString(), "2026-10-15T10:00:00.000Z");
});

test("access: self 365 days, member extends from current expiry", () => {
  const paid = new Date("2026-01-01T00:00:00Z");
  const [g] = accessPlan({ productId: "self", paidAt: paid });
  assert.equal(g.product, "self"); assert.equal(g.expiresAt.getTime(), paid.getTime() + 365 * day);
  const cur = new Date("2026-01-20T00:00:00Z");
  const [m] = accessPlan({ productId: "member", paidAt: paid, currentExpiry: { member: cur } });
  assert.equal(m.expiresAt.getTime(), cur.getTime() + 31 * day);
  const [m2] = accessPlan({ productId: "member", paidAt: paid, currentExpiry: { member: new Date("2025-12-01T00:00:00Z") } });
  assert.equal(m2.expiresAt.getTime(), paid.getTime() + 31 * day);
});

test("access: cohort unlocks cohort, story, bundle and 90 days of membership", () => {
  const paid = new Date("2026-01-01T00:00:00Z");
  const g = accessPlan({ productId: "cohort", paidAt: paid });
  assert.deepEqual(g.map(x => x.product).sort(), ["bundle", "cohort", "member", "story"]);
  assert.equal(g.find(x => x.product === "member").expiresAt.getTime(), paid.getTime() + 90 * day);
  assert.equal(g.find(x => x.product === "bundle").expiresAt, null);
  for (const id of ["story", "bundle", "crmspec", "team"]) assert.equal(grantRules(id)[0].product, id);
  assert.deepEqual(grantRules("free"), []);
});

test("access: instalments 1 and 2 give 35 days, the last gives 365 from the first", () => {
  const first = new Date("2026-01-01T00:00:00Z");
  const second = new Date("2026-01-30T00:00:00Z");
  const third = new Date("2026-02-28T00:00:00Z");
  const [a] = accessPlan({ productId: "self", paidAt: first, installmentNo: 1, installmentsTotal: 3 });
  assert.equal(a.expiresAt.getTime(), first.getTime() + INSTALMENT_ACCESS_DAYS * day);
  const [b] = accessPlan({ productId: "self", paidAt: second, installmentNo: 2, installmentsTotal: 3, firstPaidAt: first });
  assert.equal(b.expiresAt.getTime(), second.getTime() + 35 * day);
  const [c] = accessPlan({ productId: "self", paidAt: third, installmentNo: 3, installmentsTotal: 3, firstPaidAt: first });
  assert.equal(c.expiresAt.getTime(), first.getTime() + 365 * day);
});

test("Paystack signature: HMAC-SHA512 hex, constant-time", () => {
  const secret = "sk_test_abc";
  const body = JSON.stringify({ event: "charge.success", data: { reference: "AM-SELF-1" } });
  const sig = createHmac("sha512", secret).update(body).digest("hex");
  assert.equal(verifySignature(body, sig, secret), true);
  assert.equal(verifySignature(Buffer.from(body), sig.toUpperCase(), secret), true);
  assert.equal(verifySignature(body + " ", sig, secret), false);
  assert.equal(verifySignature(body, sig.slice(0, -1), secret), false);
  assert.equal(verifySignature(body, sig, "sk_test_other"), false);
  assert.equal(verifySignature(body, null, secret), false);
  assert.equal(verifySignature(body, sig, ""), false);
});

test("references are unique and Paystack-safe", () => {
  const a = makeReference("self"), b = makeReference("self");
  assert.notEqual(a, b);
  assert.match(a, /^AM-SELF-[A-Z0-9]+-[A-F0-9]{8}$/);
});

test("CSV rows quote fields and defuse formulas", () => {
  assert.equal(csvRow(["Tolu", 'say "hi"', null, 5]), '"Tolu","say ""hi""","","5"');
  assert.equal(csvRow(["=HYPERLINK(1)"]), `"'=HYPERLINK(1)"`);
  assert.equal(csvRow(["-5"]), `"'-5"`);
});

test("search text is safe for PostgREST filters", () => {
  assert.equal(safeSearch("tolu,(id.eq.1)"), "tolu  id.eq.1");
  assert.equal(safeSearch("tolu@gmail.com"), "tolu@gmail.com");
  assert.equal(safeSearch(null), "");
});

test("money text", () => {
  assert.equal(moneyText(4500000, "NGN"), "₦45,000");
  assert.equal(moneyText(7950, "USD"), "$79.50");
});

test("every paid product has a sensible price", () => {
  for (const p of PRODUCTS.filter(p => p.ngn > 0)) assert.ok(p.usd > 0, p.id);
});
