import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/config";
import { product } from "@/lib/pricing";
import {
  AMBASSADOR_WINDOW_DAYS, DAY_MS, commissionMinor, commissionTier, earningAvailableAt, ngnEquivalentMinor,
  isSelfReferral, normaliseCode, type Currency, type Tier
} from "@/lib/money";

export const referralLink = (code: string) => `${SITE_URL}/?ref=${encodeURIComponent(code)}`;

/** Looks up the owner of a referral code. Blocks self-referral: the buyer's own code, or a code owned by the same mailbox. */
export async function findReferrer(rawCode: string, buyerId: string, buyerEmail?: string | null): Promise<{ id: string; code: string } | { error: string }> {
  const code = normaliseCode(rawCode);
  if (!code) return { error: "That referral code doesn't look right. Check it, or leave the box empty." };
  const db = createAdminClient();
  const { data } = await db.from("profiles").select("id, email, referral_code").eq("referral_code", code).maybeSingle();
  if (!data) return { error: "We couldn't find that referral code. Check it, or leave the box empty." };
  if (isSelfReferral({ buyerId, buyerEmail, referrerId: data.id as string, referrerEmail: data.email as string })) return { error: "That's your own referral code. Share it with friends instead: it can't be used on your own purchase." };
  return { id: data.id as string, code };
}

/** Graduate tier needs a non-revoked certificate. The certificates table belongs to another migration and may not exist yet. */
export async function hasValidCertificate(userId: string): Promise<boolean> {
  try {
    const { data, error } = await createAdminClient().from("certificates").select("id").eq("user_id", userId).eq("revoked", false).limit(1);
    if (error) return false;
    return (data || []).length > 0;
  } catch { return false; }
}

/** Distinct buyers who paid through this referrer in the last 90 days (reversed earnings don't count). */
export async function paidReferralsRecent(referrerId: string): Promise<number> {
  const since = new Date(Date.now() - AMBASSADOR_WINDOW_DAYS * DAY_MS).toISOString();
  const { data } = await createAdminClient().from("referral_earnings").select("buyer_id")
    .eq("referrer_id", referrerId).neq("status", "reversed").gte("created_at", since);
  return new Set((data || []).map(r => r.buyer_id as string)).size;
}

export async function currentTier(referrerId: string, productId = "self"): Promise<{ tier: Tier; rate: number }> {
  const [hasCertificate, paidReferrals90d] = await Promise.all([hasValidCertificate(referrerId), paidReferralsRecent(referrerId)]);
  return commissionTier({ productId, hasCertificate, paidReferrals90d });
}

type PaymentRow = { id: string; user_id: string; product: string; amount_kobo: number; currency: Currency; referral_code: string | null; paid_at: string | null };

/** Creates the pending earning for a successful referred payment, on the amount actually paid (this instalment, after discount). Idempotent (payment_id is unique). */
export async function recordReferralEarning(payment: PaymentRow) {
  if (!payment.referral_code) return null;
  const db = createAdminClient();
  const [{ data: ref }, { data: buyer }] = await Promise.all([
    db.from("profiles").select("id, email").eq("referral_code", payment.referral_code).maybeSingle(),
    db.from("profiles").select("email").eq("id", payment.user_id).maybeSingle()
  ]);
  if (!ref || isSelfReferral({ buyerId: payment.user_id, buyerEmail: buyer?.email as string | null, referrerId: ref.id as string, referrerEmail: ref.email as string })) return null;
  const p = product(payment.product);
  if (!p) return null;
  const { tier, rate } = await currentTier(ref.id as string, p.id);
  const base = ngnEquivalentMinor(payment.amount_kobo, payment.currency, p);
  const amount = commissionMinor(base, rate);
  if (amount <= 0) return null;
  const paidAt = payment.paid_at ? new Date(payment.paid_at) : new Date();
  const { data, error } = await db.from("referral_earnings").upsert({
    referrer_id: ref.id, payment_id: payment.id, buyer_id: payment.user_id, amount_kobo: amount, rate, tier,
    status: "pending", available_at: earningAvailableAt(paidAt).toISOString()
  }, { onConflict: "payment_id", ignoreDuplicates: true }).select("id");
  if (error) console.error("[referrals] earning insert failed", error.message);
  return data;
}

export type EarningRow = { id: string; payment_id: string; buyer_id: string; amount_kobo: number; rate: number; tier: Tier; status: "pending" | "approved" | "paid" | "reversed"; available_at: string; payout_id: string | null; created_at: string };

/** Everything the learner's referral views need. Call only for the signed-in user's own id. */
export async function referralSummary(userId: string) {
  const db = createAdminClient();
  const [{ data: prof }, { count: signups }, { data: earnings }, { data: account }, { data: payouts }] = await Promise.all([
    db.from("profiles").select("referral_code").eq("id", userId).maybeSingle(),
    db.from("profiles").select("id", { count: "exact", head: true }).eq("referred_by", userId),
    db.from("referral_earnings").select("id, payment_id, buyer_id, amount_kobo, rate, tier, status, available_at, payout_id, created_at").eq("referrer_id", userId).order("created_at", { ascending: false }),
    db.from("payout_accounts").select("bank_name, bank_code, account_last4, account_name, paystack_recipient_code, updated_at").eq("user_id", userId).maybeSingle(),
    db.from("payouts").select("id, amount_kobo, status, created_at, paid_at").eq("user_id", userId).order("created_at", { ascending: false })
  ]);
  const rows = (earnings || []) as EarningRow[];
  const sum = (f: (e: EarningRow) => boolean) => rows.filter(f).reduce((a, e) => a + e.amount_kobo, 0);
  const tier = await currentTier(userId);
  const code = (prof?.referral_code as string | null) || null;
  return {
    code, link: code ? referralLink(code) : null, tier,
    signups: signups ?? 0,
    paidBuyers: new Set(rows.filter(e => e.status !== "reversed").map(e => e.buyer_id)).size,
    payments: rows.filter(e => e.status !== "reversed").length,
    pendingKobo: sum(e => e.status === "pending"),
    approvedKobo: sum(e => e.status === "approved" && !e.payout_id),
    inPayoutKobo: sum(e => e.status === "approved" && !!e.payout_id),
    paidKobo: sum(e => e.status === "paid"),
    reversedKobo: sum(e => e.status === "reversed"),
    earnings: rows,
    account: account as null | { bank_name: string; bank_code: string; account_last4: string; account_name: string | null; paystack_recipient_code: string | null; updated_at: string },
    payouts: (payouts || []) as { id: string; amount_kobo: number; status: string; created_at: string; paid_at: string | null }[]
  };
}
