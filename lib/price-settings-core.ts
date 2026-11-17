/**
 * Pure logic for admin-set prices (no I/O, unit-tested in tests/payments.test.mjs).
 * Naira and dollars are whole units; rates are fractions (0.10 = 10%).
 */
type ProductLike = { id: string; ngn: number; usd: number; kind: string; installments?: { count: number; ngn: number } };
type ReferralLike = { friendDiscount: number; tiers: { friend: number; graduate: number; ambassador: number }; packCommission: number; minPayoutNgn: number; refundWindowDays: number; [k: string]: unknown };
type MarketLike = { revenueShare: number; minPriceNgn: number; maxPriceNgn: number; minPriceUsd: number; maxPriceUsd: number; [k: string]: unknown };

export type ProductPrice = { ngn: number; usd: number; installments: { count: number; ngn: number } | null };
export type PriceSettings = {
  products: Record<string, ProductPrice>;
  referral: { friendDiscount: number; friend: number; graduate: number; ambassador: number; packCommission: number; minPayoutNgn: number; refundWindowDays: number };
  market: { revenueShare: number; minPriceNgn: number; maxPriceNgn: number; minPriceUsd: number; maxPriceUsd: number };
};

/** Products whose price is set here ("free" is always free). */
export const PRICED = (products: ProductLike[]) => products.filter(p => p.id !== "free");

export function defaultPriceSettings(products: ProductLike[], referral: ReferralLike, market: MarketLike): PriceSettings {
  const out: PriceSettings = {
    products: {},
    referral: {
      friendDiscount: referral.friendDiscount, friend: referral.tiers.friend, graduate: referral.tiers.graduate,
      ambassador: referral.tiers.ambassador, packCommission: referral.packCommission, minPayoutNgn: referral.minPayoutNgn,
      refundWindowDays: referral.refundWindowDays
    },
    market: { revenueShare: market.revenueShare, minPriceNgn: market.minPriceNgn, maxPriceNgn: market.maxPriceNgn, minPriceUsd: market.minPriceUsd, maxPriceUsd: market.maxPriceUsd }
  };
  for (const p of PRICED(products)) out.products[p.id] = { ngn: p.ngn, usd: p.usd, installments: p.installments ? { ...p.installments } : null };
  return JSON.parse(JSON.stringify(out));
}

const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);
const whole = (v: unknown, min: number, max: number, dflt: number) => { const n = Math.round(num(v)); return Number.isFinite(n) && n >= min && n <= max ? n : dflt; };
const money2 = (v: unknown, min: number, max: number, dflt: number) => { const n = Math.round(num(v) * 100) / 100; return Number.isFinite(n) && n >= min && n <= max ? n : dflt; };
const rate = (v: unknown, max: number, dflt: number) => { const n = num(v); return Number.isFinite(n) && n >= 0 && n <= max ? Math.round(n * 1000) / 1000 : dflt; };

/** Anything unreadable or out of range falls back to the default for that one value. */
export function sanitizePriceSettings(raw: unknown, d: PriceSettings): PriceSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<PriceSettings>;
  const out: PriceSettings = JSON.parse(JSON.stringify(d));
  for (const [id, dp] of Object.entries(d.products)) {
    const x = (r.products && typeof r.products === "object" ? (r.products as Record<string, Partial<ProductPrice>>)[id] : undefined) || {};
    const ngn = whole(x.ngn, 100, 100_000_000, dp.ngn);
    const usd = money2(x.usd, 0, 1_000_000, dp.usd);
    let inst = dp.installments;
    if (x.installments === null) inst = null;
    else if (x.installments && typeof x.installments === "object") {
      const count = whole(x.installments.count, 2, 12, dp.installments?.count ?? 3);
      const each = whole(x.installments.ngn, 100, 100_000_000, dp.installments?.ngn ?? Math.ceil(ngn / count));
      inst = { count, ngn: each };
    }
    out.products[id] = { ngn, usd, installments: inst };
  }
  const rr = (r.referral || {}) as Partial<PriceSettings["referral"]>;
  out.referral = {
    friendDiscount: rate(rr.friendDiscount, 0.9, d.referral.friendDiscount),
    friend: rate(rr.friend, 0.9, d.referral.friend),
    graduate: rate(rr.graduate, 0.9, d.referral.graduate),
    ambassador: rate(rr.ambassador, 0.9, d.referral.ambassador),
    packCommission: rate(rr.packCommission, 0.9, d.referral.packCommission),
    minPayoutNgn: whole(rr.minPayoutNgn, 0, 10_000_000, d.referral.minPayoutNgn),
    refundWindowDays: whole(rr.refundWindowDays, 0, 90, d.referral.refundWindowDays)
  };
  const m = (r.market || {}) as Partial<PriceSettings["market"]>;
  const minN = whole(m.minPriceNgn, 100, 100_000_000, d.market.minPriceNgn);
  const maxN = whole(m.maxPriceNgn, 100, 100_000_000, d.market.maxPriceNgn);
  const minU = money2(m.minPriceUsd, 0, 1_000_000, d.market.minPriceUsd);
  const maxU = money2(m.maxPriceUsd, 0, 1_000_000, d.market.maxPriceUsd);
  out.market = {
    revenueShare: rate(m.revenueShare, 1, d.market.revenueShare),
    minPriceNgn: Math.min(minN, maxN), maxPriceNgn: Math.max(minN, maxN),
    minPriceUsd: Math.min(minU, maxU), maxPriceUsd: Math.max(minU, maxU)
  };
  return out;
}

/** Problems a person should fix before saving (empty = fine). Ranges are checked again by sanitizePriceSettings. */
export function priceProblems(s: PriceSettings, names: Record<string, string>): string[] {
  const out: string[] = [];
  for (const [id, p] of Object.entries(s.products)) {
    const n = names[id] || id;
    if (!(p.ngn >= 100)) out.push(`${n}: the naira price must be at least ₦100.`);
    if (!(p.usd >= 0)) out.push(`${n}: the dollar price can't be negative.`);
    if (p.installments && p.installments.count * p.installments.ngn < p.ngn)
      out.push(`${n}: ${p.installments.count} payments of ₦${p.installments.ngn.toLocaleString("en-NG")} add up to less than the one-time price.`);
  }
  const r = s.referral;
  if (!(r.friend <= r.graduate && r.graduate <= r.ambassador)) out.push("Referral commission: friend ≤ graduate ≤ ambassador.");
  if (s.market.minPriceNgn > s.market.maxPriceNgn) out.push("Creator courses: the lowest naira price is above the highest.");
  return out;
}

/** Lays the settings over the live objects (in place, so every module that imported them sees the new values). */
export function applyPriceSettings(s: PriceSettings, products: ProductLike[], referral: ReferralLike, market: Record<string, number>) {
  for (const p of products) {
    const x = s.products[p.id];
    if (!x) continue;
    p.ngn = x.ngn; p.usd = x.usd;
    if (x.installments) p.installments = { count: x.installments.count, ngn: x.installments.ngn };
    else delete p.installments;
  }
  referral.friendDiscount = s.referral.friendDiscount;
  referral.tiers.friend = s.referral.friend;
  referral.tiers.graduate = s.referral.graduate;
  referral.tiers.ambassador = s.referral.ambassador;
  referral.packCommission = s.referral.packCommission;
  referral.minPayoutNgn = s.referral.minPayoutNgn;
  referral.refundWindowDays = s.referral.refundWindowDays;
  market.refundWindowDays = s.referral.refundWindowDays; // creator earnings unlock when the refund window closes
  market.revenueShare = s.market.revenueShare;
  market.minPriceNgn = s.market.minPriceNgn;
  market.maxPriceNgn = s.market.maxPriceNgn;
  market.minPriceUsd = s.market.minPriceUsd;
  market.maxPriceUsd = s.market.maxPriceUsd;
}
