import "server-only";
import { REFERRAL } from "@/lib/pricing";
import { SITE_URL } from "@/lib/config";
import { esc, ngn } from "@/lib/format";
import { emailAdmins, releaseDueEarnings } from "@/lib/marketplace";
import type { Ctx, Outcome } from "@/lib/agents/run";

/** Payouts Agent: approves earnings past the refund window (not for flagged users) and lists who is owed. Never sends money. */
export async function run(ctx: Ctx): Promise<Outcome> {
  const { db } = ctx;
  const nowIso = new Date().toISOString();
  const { data: flagged } = await db.from("agent_flags").select("target_id").eq("status", "open").eq("severity", "high").eq("target_type", "user").limit(5000);
  const held = new Set((flagged || []).map(f => String(f.target_id)));

  let approved = 0, creators = 0, heldCount = 0;
  const { data: due } = await db.from("referral_earnings").select("id, referrer_id").eq("status", "pending").lte("available_at", nowIso).limit(5000);
  const okIds = (due || []).filter(e => !held.has(String(e.referrer_id))).map(e => String(e.id));
  heldCount = (due || []).length - okIds.length;
  if (ctx.auto && okIds.length) {
    const { data } = await db.from("referral_earnings").update({ status: "approved" }).in("id", okIds).eq("status", "pending").select("id");
    approved = data?.length ?? 0;
    creators = await releaseDueEarnings();
  }

  // Who is owed: approved referral earnings not yet in a payout, and available creator earnings.
  const [{ data: refOwed }, { data: crOwed }, { data: accts }] = await Promise.all([
    db.from("referral_earnings").select("referrer_id, amount_kobo").eq("status", "approved").is("payout_id", null).limit(20000),
    db.from("creator_earnings").select("creator_id, amount_kobo").eq("status", "available").limit(20000),
    db.from("payout_accounts").select("user_id")
  ]);
  const hasAcct = new Set((accts || []).map(a => String(a.user_id)));
  const owed = new Map<string, { ref: number; creator: number }>();
  for (const r of refOwed || []) { const k = String(r.referrer_id); const o = owed.get(k) || { ref: 0, creator: 0 }; o.ref += Number(r.amount_kobo); owed.set(k, o); }
  for (const r of crOwed || []) { const k = String(r.creator_id); const o = owed.get(k) || { ref: 0, creator: 0 }; o.creator += Number(r.amount_kobo); owed.set(k, o); }
  const ids = [...owed.keys()];
  const { data: profs } = ids.length ? await db.from("profiles").select("id, full_name, email").in("id", ids.slice(0, 1000)) : { data: [] };
  const nameOf = new Map((profs || []).map(p => [String(p.id), `${p.full_name || ""} <${p.email}>`.trim()]));
  const minKobo = REFERRAL.minPayoutNgn * 100;
  const rows = ids.map(id => ({ id, ...owed.get(id)!, total: owed.get(id)!.ref + owed.get(id)!.creator }))
    .filter(r => r.creator > 0 || r.ref >= minKobo).sort((a, b) => b.total - a.total);
  for (const r of rows) if (!hasAcct.has(r.id)) await ctx.flag({ kind: "owed_no_bank", target_type: "user", target_id: r.id, severity: "low", message: `Owed ${ngn(r.total / 100)} but has no payout bank account yet.` });

  const total = rows.reduce((n, r) => n + r.total, 0);
  const monday = new Date(Date.now() + 3_600_000).getUTCDay() === 1;
  if (rows.length && (monday || ctx.trigger === "admin")) {
    const table = rows.slice(0, 50).map(r => `<tr><td>${esc(nameOf.get(r.id) || r.id)}</td><td>${ngn(r.ref / 100)}</td><td>${ngn(r.creator / 100)}</td><td><b>${ngn(r.total / 100)}</b></td><td>${hasAcct.has(r.id) ? "yes" : "<b>no</b>"}</td><td>${held.has(r.id) ? "<b>held (fraud flag)</b>" : ""}</td></tr>`).join("");
    await emailAdmins(`Payouts due: ${ngn(total / 100)} to ${rows.length} people`,
      `<p>The Payouts Agent's list. Nothing has been paid: pay referrers in <a href="${esc(SITE_URL)}/admin/referrals">Admin → Referrals</a> and creators in <a href="${esc(SITE_URL)}/admin/courses">Admin → Creator courses</a>.</p>
       <table border="1" cellpadding="6" style="border-collapse:collapse"><tr><th>Person</th><th>Referrals</th><th>Courses</th><th>Total</th><th>Bank set</th><th></th></tr>${table}</table>`);
  }
  return {
    summary: `${approved} referral earnings approved, ${creators} creator earnings released${heldCount ? `, ${heldCount} held for fraud flags` : ""}; ${rows.length} people owed ${ngn(total / 100)}.`,
    actions: approved + creators, detail: { owed: rows.slice(0, 100) }
  };
}
