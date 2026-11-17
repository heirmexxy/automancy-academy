import "server-only";
import { emailIdentity } from "@/lib/agents/rules";
import type { Ctx, Outcome } from "@/lib/agents/run";

const DAY = 86_400_000;

/** Fraud Watch: flags only. The Payouts Agent holds earnings for anyone with an open high-risk flag. */
export async function run(ctx: Ctx): Promise<Outcome> {
  const { db } = ctx;
  const since = new Date(Date.now() - 180 * DAY).toISOString();
  let flags = 0;
  const f = async (x: Parameters<Ctx["flag"]>[0]) => { if (await ctx.flag(x)) flags++; };

  // 1) Repeated buy-and-refund.
  const { data: refunded } = await db.from("payments").select("user_id").in("status", ["refunded", "partially_refunded"]).gte("created_at", since).limit(5000);
  const rc = new Map<string, number>();
  (refunded || []).forEach(r => rc.set(String(r.user_id), (rc.get(String(r.user_id)) || 0) + 1));
  for (const [u, n] of rc) if (n >= 2) await f({ kind: "repeat_refunds", target_type: "user", target_id: u, severity: n >= 3 ? "high" : "medium", message: `${n} refunded payments in 6 months.` });

  // 2) Referral earnings: self-referral by email identity, shared payout accounts, referrers whose referrals refund.
  const { data: earns } = await db.from("referral_earnings").select("referrer_id, buyer_id, status").gte("created_at", since).limit(10000);
  if (earns?.length) {
    const ids = [...new Set(earns.flatMap(e => [String(e.referrer_id), String(e.buyer_id)]))];
    const [{ data: profs }, { data: accts }] = await Promise.all([
      db.from("profiles").select("id, email").in("id", ids.slice(0, 1000)),
      db.from("payout_accounts").select("user_id, bank_code, account_last4, account_name").in("user_id", ids.slice(0, 1000))
    ]);
    const email = new Map((profs || []).map(p => [String(p.id), emailIdentity(String(p.email || ""))]));
    const acct = new Map((accts || []).map(a => [String(a.user_id), `${a.bank_code}:${a.account_last4}:${String(a.account_name || "").toLowerCase()}`]));
    const perRef = new Map<string, { total: number; reversed: number }>();
    for (const e of earns) {
      const r = String(e.referrer_id), b = String(e.buyer_id);
      const s = perRef.get(r) || { total: 0, reversed: 0 }; s.total++; if (e.status === "reversed") s.reversed++; perRef.set(r, s);
      if (email.get(r) && email.get(r) === email.get(b)) await f({ kind: "self_referral", target_type: "user", target_id: r, severity: "high", message: "Referred a purchase made from the same email inbox (dots or +tags changed)." });
      if (acct.get(r) && acct.get(r) === acct.get(b)) await f({ kind: "shared_payout_account", target_type: "user", target_id: r, severity: "high", message: "Referrer and buyer use the same bank account for payouts." });
    }
    for (const [r, s] of perRef) if (s.total >= 3 && s.reversed / s.total >= 0.5)
      await f({ kind: "referrals_refunding", target_type: "user", target_id: r, severity: "high", message: `${s.reversed} of ${s.total} referred purchases were refunded.` });
  }

  // 3) Many discount codes used by one learner.
  const { data: reds } = await db.from("discount_redemptions").select("user_id").gte("created_at", new Date(Date.now() - 30 * DAY).toISOString()).limit(10000);
  const dc = new Map<string, number>();
  (reds || []).forEach(r => dc.set(String(r.user_id), (dc.get(String(r.user_id)) || 0) + 1));
  for (const [u, n] of dc) if (n >= 4) await f({ kind: "many_codes", target_type: "user", target_id: u, severity: "low", message: `${n} discount codes used in 30 days.` });

  return { summary: `${flags} new flags.`, actions: 0 };
}
