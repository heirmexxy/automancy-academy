import "server-only";
import { COURSE } from "@/lib/course";
import { REFERRAL, product } from "@/lib/pricing";
import { hasPaystack } from "@/lib/config";
import { applyRefund, refundTransaction } from "@/lib/paystack";
import { emailUser } from "@/lib/marketplace";
import { esc } from "@/lib/format";
import { decideRefund, reasonKeyOf } from "@/lib/agents/rules";
import type { Ctx, Outcome } from "@/lib/agents/run";

const PAID_IDS = COURSE.items.filter(i => !i.free).map(i => i.id);
const DAY = 86_400_000;

/** Refund Agent: decides the clear-cut requests and recommends on the rest. */
export async function run(ctx: Ctx): Promise<Outcome> {
  const { db } = ctx;
  const { data: reqs } = await db.from("refund_requests").select("id, user_id, payment_id, reason, created_at").eq("status", "open").order("created_at").limit(50);
  let approved = 0, declined = 0, waiting = 0;
  const lines: string[] = [];
  for (const r of reqs || []) {
    const { data: pay } = await db.from("payments").select("id, user_id, product, reference, status, paid_at, plan_ref, created_at").eq("id", r.payment_id).maybeSingle();
    if (!pay || pay.status !== "success") continue;
    let firstPaid = pay.paid_at as string;
    if (pay.plan_ref) {
      const { data: plan } = await db.from("payments").select("paid_at").eq("plan_ref", pay.plan_ref).eq("status", "success").order("paid_at").limit(1);
      firstPaid = (plan?.[0]?.paid_at as string) || firstPaid;
    }
    const [{ data: prog }, { count: certs }, { count: prior }, { data: dups }, { count: active }] = await Promise.all([
      db.from("progress").select("done").eq("user_id", r.user_id).maybeSingle(),
      db.from("certificates").select("id", { count: "exact", head: true }).eq("user_id", r.user_id).eq("revoked", false),
      db.from("payments").select("id", { count: "exact", head: true }).eq("user_id", r.user_id).in("status", ["refunded", "partially_refunded"]).gte("created_at", new Date(Date.now() - 180 * DAY).toISOString()),
      db.from("payments").select("id, paid_at").eq("user_id", r.user_id).eq("product", pay.product).eq("status", "success").neq("id", pay.id),
      db.from("enrollments").select("id", { count: "exact", head: true }).eq("user_id", r.user_id).eq("payment_id", pay.id).eq("status", "active")
    ]);
    const done = (prog?.done || {}) as Record<string, boolean>;
    const paidDone = PAID_IDS.filter(id => done[id] === true).length;
    const pct = PAID_IDS.length ? Math.round(paidDone * 100 / PAID_IDS.length) : 0;
    const paidAt = Date.parse(pay.paid_at as string);
    const duplicate = (dups || []).find(d => Math.abs(Date.parse(d.paid_at as string) - paidAt) < 3 * DAY && !pay.plan_ref);
    let addonUsed: boolean | null = null;
    if (pay.product === "crmspec") addonUsed = Object.keys(done).some(k => (k.startsWith("7.") || k === "B7") && done[k]);
    if (pay.product === "story") {
      const { count } = await db.from("tts_usage").select("day", { count: "exact", head: true }).eq("user_id", r.user_id).gte("day", (pay.paid_at as string).slice(0, 10));
      addonUsed = (count ?? 0) > 0;
    }
    const call = decideRefund({
      product: pay.product as string, daysSincePaid: Math.floor((Date.now() - Date.parse(firstPaid)) / DAY), windowDays: REFERRAL.refundWindowDays,
      reasonKey: reasonKeyOf(r.reason as string), paidLessonsDonePct: pct, certificateClaimed: (certs ?? 0) > 0, addonUsed,
      priorRefunds180d: prior ?? 0, duplicateOf: duplicate ? String(duplicate.id) : null, hasAccess: (active ?? 0) > 0
    });
    const name = product(pay.product as string)?.name || String(pay.product);
    const summary = `${name}: ${call.reasons.join(" ")}`;

    if (ctx.auto && call.decision === "approve") {
      if (hasPaystack()) {
        const res = await refundTransaction(pay.reference as string);
        if (!res.ok) { await ctx.flag({ kind: "refund_failed", target_type: "refund_request", target_id: r.id, severity: "high", message: `Paystack refused the refund the agent approved: ${res.message}. ${summary}` }); continue; }
      }
      await applyRefund(pay.id as string, { decidedBy: null });
      await db.from("refund_requests").update({ status: hasPaystack() ? "approved" : "refunded", admin_note: `${call.note} (decided by the Refund Agent)`, decided_at: new Date().toISOString() }).eq("id", r.id);
      await emailUser(r.user_id, "Your refund is on its way", `<p>${esc(call.note)}</p><p>The money goes back to the card or account you paid with, usually within 5 to 10 working days.</p>`);
      approved++; lines.push(`Approved: ${summary}`);
    } else if (ctx.auto && call.decision === "decline") {
      await db.from("refund_requests").update({ status: "declined", admin_note: `${call.note} (decided by the Refund Agent; reply to our email if you think this is wrong)`, decided_at: new Date().toISOString() }).eq("id", r.id).eq("status", "open");
      await emailUser(r.user_id, "About your refund request", `<p>We've looked at your refund request for <b>${esc(name)}</b>. ${esc(call.note)}</p><p>Our refund policy is at <a href="https://automancy.cc/legal/refunds">automancy.cc/legal/refunds</a>. If you think we've got this wrong, reply to this email and a person will look at it.</p>`);
      declined++; lines.push(`Declined: ${summary}`);
    } else {
      await ctx.flag({ kind: "refund_review", target_type: "refund_request", target_id: r.id, severity: "medium",
        message: `Recommend ${call.recommend.toUpperCase()}${call.decision !== "person" ? ` (would ${call.decision} automatically)` : ""}. ${summary}` });
      waiting++;
    }
  }
  return { summary: `${(reqs || []).length} open requests: ${approved} approved, ${declined} declined, ${waiting} waiting for you.`, actions: approved + declined, detail: { lines } };
}
