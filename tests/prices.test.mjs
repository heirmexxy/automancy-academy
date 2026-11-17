// Run: tsx --test tests/prices.test.mjs — admin-set prices and refund reasons.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as coreNs from "../lib/price-settings-core.ts";
import * as pricingNs from "../lib/pricing.ts";
import * as moneyNs from "../lib/money.ts";
import * as refundNs from "../lib/refund-reasons.ts";
const C = coreNs.default ?? coreNs, PR = pricingNs.default ?? pricingNs, M = moneyNs.default ?? moneyNs, R = refundNs.default ?? refundNs;
const { defaultPriceSettings, sanitizePriceSettings, applyPriceSettings, priceProblems } = C;
const MARKET0 = { revenueShare: 0.7, minPriceNgn: 2000, maxPriceNgn: 500000, minPriceUsd: 2, maxPriceUsd: 350, refundWindowDays: 14 };
const D = defaultPriceSettings(PR.PRODUCTS, PR.REFERRAL, MARKET0);

test("defaults mirror the code and skip the free plan", () => {
  assert.equal(D.products.self.ngn, 45000);
  assert.deepEqual(D.products.self.installments, { count: 3, ngn: 16000 });
  assert.equal(D.products.free, undefined);
  assert.equal(D.referral.friendDiscount, 0.1);
  assert.equal(D.referral.refundWindowDays, 14);
  assert.equal(D.market.revenueShare, 0.7);
});

test("sanitize keeps good values and falls back per value for bad ones", () => {
  const s = sanitizePriceSettings({ products: { self: { ngn: 50000, usd: "85", installments: { count: 4, ngn: 13000 } }, story: { ngn: -5, usd: 9 } },
    referral: { friendDiscount: 2, friend: 0.15 }, market: { minPriceNgn: 9000, maxPriceNgn: 3000 } }, D);
  assert.equal(s.products.self.ngn, 50000);
  assert.equal(s.products.self.usd, 85);
  assert.deepEqual(s.products.self.installments, { count: 4, ngn: 13000 });
  assert.equal(s.products.story.ngn, D.products.story.ngn);           // -5 rejected
  assert.equal(s.referral.friendDiscount, D.referral.friendDiscount); // 200% rejected
  assert.equal(s.referral.friend, 0.15);
  assert.equal(s.market.minPriceNgn, 3000);                           // swapped into order
  assert.equal(s.market.maxPriceNgn, 9000);
  assert.deepEqual(sanitizePriceSettings(null, D), D);
  assert.equal(sanitizePriceSettings({ products: { self: { installments: null } } }, D).products.self.installments, null);
});

test("applying settings changes what checkout charges, and can be undone", () => {
  const products = JSON.parse(JSON.stringify(PR.PRODUCTS)), referral = JSON.parse(JSON.stringify(PR.REFERRAL)), market = { ...MARKET0 };
  const s = JSON.parse(JSON.stringify(D));
  s.products.self = { ngn: 60000, usd: 99, installments: null };
  s.referral.friendDiscount = 0.2; s.referral.refundWindowDays = 7; s.market.revenueShare = 0.8;
  applyPriceSettings(s, products, referral, market);
  const self = products.find(p => p.id === "self");
  assert.equal(self.ngn, 60000); assert.equal(self.installments, undefined);
  assert.equal(referral.friendDiscount, 0.2); assert.equal(referral.refundWindowDays, 7);
  assert.equal(market.revenueShare, 0.8); assert.equal(market.refundWindowDays, 7);
  applyPriceSettings(D, products, referral, market);
  assert.deepEqual(products.find(p => p.id === "self").installments, { count: 3, ngn: 16000 });
});

test("the live objects used by quote() pick up the admin's price", () => {
  const before = JSON.parse(JSON.stringify(D));
  const s = JSON.parse(JSON.stringify(D)); s.products.self.ngn = 52000; s.referral.friendDiscount = 0.15;
  applyPriceSettings(s, PR.PRODUCTS, PR.REFERRAL, { ...MARKET0 });
  try {
    const q = M.quote(PR.product("self"), { currency: "NGN", installments: false, referral: true, isRenewal: false });
    assert.equal(q.listMinor, 5_200_000);
    assert.equal(q.discountMinor, 780_000);
  } finally { applyPriceSettings(before, PR.PRODUCTS, PR.REFERRAL, { ...MARKET0 }); }
  assert.equal(PR.product("self").ngn, 45000);
});

test("problems a person must fix", () => {
  const s = JSON.parse(JSON.stringify(D));
  s.products.self.installments = { count: 3, ngn: 10000 };            // 30,000 < 45,000
  s.referral.friend = 0.4;                                             // above graduate
  const p = priceProblems(s, { self: "Self-paced" });
  assert.equal(p.length, 2);
  assert.match(p[0], /Self-paced/);
  assert.deepEqual(priceProblems(D, {}), []);
});

test("refund requests need a listed reason and a real explanation", () => {
  assert.equal(R.formatRefundReason("changed_my_mind", "x".repeat(60)), null);
  assert.equal(R.formatRefundReason("technical", "too short"), null);
  const r = R.formatRefundReason("technical", "  The lesson 3.2 lab never loads on my phone or laptop, support couldn't fix it.  ");
  assert.match(r, /^\[A technical problem/);
  assert.ok(!R.REFUND_REASONS.some(x => /mind|time/i.test(x.label)));
});
