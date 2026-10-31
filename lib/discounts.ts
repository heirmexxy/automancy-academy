import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { discountCodeProblem, normaliseCode, type DiscountCodeRow } from "@/lib/money";

export type CodeCheck = { ok: true; code: string; percent: number } | { ok: false; error: string };

/** Looks up a discount code for this buyer and product (service role; codes are never readable by learners). */
export async function checkDiscountCode(raw: unknown, productId: string, userId: string): Promise<CodeCheck> {
  const code = normaliseCode(raw);
  if (!code) return { ok: false, error: "That discount code isn't valid." };
  const db = createAdminClient();
  const { data } = await db.from("discount_codes").select("code, percent, active, products, starts_at, ends_at, max_uses, once_per_user").eq("code", code).maybeSingle();
  const row = data as DiscountCodeRow | null;
  const [{ count: uses }, { count: mine }] = await Promise.all([
    db.from("discount_redemptions").select("id", { count: "exact", head: true }).eq("code", code),
    db.from("discount_redemptions").select("id", { count: "exact", head: true }).eq("code", code).eq("user_id", userId)
  ]);
  const problem = discountCodeProblem(row, { productId, uses: uses ?? 0, usedByBuyer: mine ?? 0 });
  return problem || !row ? { ok: false, error: problem || "That discount code isn't valid." } : { ok: true, code, percent: row.percent };
}

/** Records a successful payment that used a code (first instalment only; idempotent per payment). */
export async function recordDiscountRedemption(p: { reference: string; user_id: string; product: string; discount_code?: string | null; discount_kobo: number; currency: string; installment_no: number }) {
  if (!p.discount_code || p.installment_no !== 1) return;
  await createAdminClient().from("discount_redemptions").upsert({
    code: p.discount_code, user_id: p.user_id, payment_reference: p.reference, product: p.product, discount_kobo: p.discount_kobo, currency: p.currency
  }, { onConflict: "payment_reference", ignoreDuplicates: true });
}
