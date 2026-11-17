import "server-only";
import { hasPaystack } from "@/lib/config";
import { fulfilPayment } from "@/lib/paystack";
import { handleCoursePayment } from "@/lib/marketplace";
import type { Ctx, Outcome } from "@/lib/agents/run";

const MIN = 60_000;
const ACCESS_PRODUCTS = ["self", "cohort", "member", "story", "bundle", "crmspec"];

/** Payment Checker: confirms payments the webhook missed and flags paid purchases without access. */
export async function run(ctx: Ctx): Promise<Outcome> {
  if (!hasPaystack()) return { summary: "Paystack isn't set up yet, so there's nothing to check.", actions: 0 };
  const { db } = ctx;
  const now = Date.now();
  const { data: stuck } = await db.from("payments").select("id, reference, product, created_at").eq("status", "initialized")
    .lte("created_at", new Date(now - 20 * MIN).toISOString()).gte("created_at", new Date(now - 7 * 1440 * MIN).toISOString()).order("created_at", { ascending: false }).limit(100);
  let fixed = 0; const lines: string[] = [];
  for (const p of stuck || []) {
    if (!ctx.auto) { await ctx.flag({ kind: "payment_unconfirmed", target_type: "payment", target_id: String(p.reference), severity: "low", message: `Payment ${p.reference} (${p.product}) started ${String(p.created_at).slice(0, 16)} is still unconfirmed.` }); continue; }
    try {
      const r = await fulfilPayment(String(p.reference), { onCourse: handleCoursePayment });
      if (r.ok && r.status === "success") { fixed++; lines.push(`Confirmed ${p.reference} (${p.product})`); }
      else if (r.status === "failed" && /match/i.test(r.message)) await ctx.flag({ kind: "payment_amount_mismatch", target_type: "payment", target_id: String(p.reference), severity: "high", message: `Payment ${p.reference} (${p.product}): Paystack's amount didn't match the order. Check it in the Paystack dashboard.` });
    } catch (e) { lines.push(`Couldn't check ${p.reference}: ${e instanceof Error ? e.message : e}`); }
  }

  // Paid in the last 30 days but no access row.
  const { data: paid } = await db.from("payments").select("id, reference, product, user_id").eq("status", "success").eq("installment_no", 1).in("product", ACCESS_PRODUCTS)
    .gte("paid_at", new Date(now - 30 * 1440 * MIN).toISOString()).limit(1000);
  let missing = 0;
  if (paid?.length) {
    const { data: ens } = await db.from("enrollments").select("payment_id").in("payment_id", paid.map(p => p.id));
    const has = new Set((ens || []).map(e => String(e.payment_id)));
    for (const p of paid) if (!has.has(String(p.id))) {
      missing++;
      await ctx.flag({ kind: "paid_without_access", target_type: "payment", target_id: String(p.reference), severity: "high", message: `Payment ${p.reference} (${p.product}) succeeded but no access was granted. Grant it in Admin → Learners.` });
    }
  }
  const { count: failed } = await db.from("payments").select("id", { count: "exact", head: true }).eq("status", "failed").gte("created_at", new Date(now - 1440 * MIN).toISOString());
  if ((failed ?? 0) >= 5) await ctx.flag({ kind: "failed_spike", target_type: "day", target_id: new Date().toISOString().slice(0, 10), severity: "medium", message: `${failed} failed payments in the last 24 hours: check Paystack for a problem with cards or the checkout.` });
  return { summary: `${(stuck || []).length} unconfirmed payments checked, ${fixed} confirmed; ${missing} paid without access; ${failed ?? 0} failed in 24h.`, actions: fixed, detail: { lines } };
}
