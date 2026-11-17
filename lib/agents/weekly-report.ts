import "server-only";
import { COURSE } from "@/lib/course";
import { SITE_URL } from "@/lib/config";
import { esc, ngn } from "@/lib/format";
import { emailAdmins } from "@/lib/marketplace";
import type { Ctx, Outcome } from "@/lib/agents/run";

const DAY = 86_400_000;
const pct = (a: number, b: number) => (b ? `${Math.round(a * 100 / b)}%` : "–");
const change = (a: number, b: number) => (b ? `${a >= b ? "+" : ""}${Math.round((a - b) * 100 / b)}%` : a ? "new" : "–");

/** Weekly Business Report: emailed to the admins every Monday. */
export async function run(ctx: Ctx): Promise<Outcome> {
  const { db } = ctx;
  const now = Date.now();
  const w0 = new Date(now - 7 * DAY).toISOString(), w1 = new Date(now - 14 * DAY).toISOString();
  const count = async (table: string, col: string, from: string, to: string, extra?: (q: any) => any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    let q = db.from(table).select("id", { count: "exact", head: true }).gte(col, from).lt(col, to);
    if (extra) q = extra(q);
    const { count: c } = await q; return c ?? 0;
  };
  const nowIso = new Date(now).toISOString();
  const [su, suPrev] = await Promise.all([count("profiles", "created_at", w0, nowIso), count("profiles", "created_at", w1, w0)]);
  const sales = async (from: string, to: string) => {
    const { data } = await db.from("payments").select("amount_kobo, currency, product, user_id").eq("status", "success").gte("paid_at", from).lt("paid_at", to).limit(20000);
    const ngnK = (data || []).filter(p => p.currency === "NGN").reduce((n, p) => n + Number(p.amount_kobo), 0);
    const usdC = (data || []).filter(p => p.currency === "USD").reduce((n, p) => n + Number(p.amount_kobo), 0);
    const byProduct = new Map<string, number>(); (data || []).forEach(p => byProduct.set(String(p.product), (byProduct.get(String(p.product)) || 0) + 1));
    return { n: (data || []).length, ngnK, usdC, buyers: new Set((data || []).map(p => String(p.user_id))).size, byProduct };
  };
  const [s, sPrev] = await Promise.all([sales(w0, nowIso), sales(w1, w0)]);
  const [refunds, refundReq] = await Promise.all([
    count("payments", "created_at", w0, nowIso, q => q.in("status", ["refunded", "partially_refunded"])),
    count("refund_requests", "created_at", w0, nowIso)
  ]);
  const [tickets, reviews] = await Promise.all([count("support_tickets", "created_at", w0, nowIso), count("submissions", "created_at", w0, nowIso)]);

  // Drop-off: among paying learners inactive 14+ days, where did they stop?
  const { data: progs } = await db.from("progress").select("done, updated_at").lt("updated_at", new Date(now - 14 * DAY).toISOString()).limit(5000);
  const stops = new Map<string, number>();
  for (const p of progs || []) { const done = (p.done || {}) as Record<string, boolean>; const next = COURSE.items.find(i => done[i.id] !== true); if (next && Object.keys(done).length) stops.set(next.id, (stops.get(next.id) || 0) + 1); }
  const topStops = [...stops.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const title = (id: string) => (COURSE.items.find(i => i.id === id)?.title || id).replace(/<[^>]+>/g, "").replace(/&amp;/g, "&");

  const tips: string[] = [];
  if (su && s.buyers / su < 0.03) tips.push("Fewer than 3% of new sign-ups bought this week: send Base Camp finishers an offer (a discount code that ends in 72 hours).");
  if (topStops[0] && topStops[0][1] >= 3) tips.push(`Most learners who stopped got stuck before ${topStops[0][0]} (${title(topStops[0][0])}): check that lesson's instructions and template, and the Feedback page for reports.`);
  if (refundReq >= 3) tips.push(`${refundReq} refund requests this week: read their reasons in Admin → Refunds for a pattern.`);
  if (su < suPrev) tips.push("Sign-ups fell compared with last week: post a learner win or a free Base Camp lesson on social media.");
  if (!tips.length) tips.push("No warning signs this week.");

  const products = [...s.byProduct.entries()].sort((a, b) => b[1] - a[1]).map(([p, n]) => `${esc(p)} ${n}`).join(", ") || "none";
  const html = `<h2>Automancy weekly report</h2>
  <table border="1" cellpadding="6" style="border-collapse:collapse">
   <tr><td>Sign-ups</td><td><b>${su}</b> (${change(su, suPrev)} on last week)</td></tr>
   <tr><td>Sales</td><td><b>${s.n}</b> payments · ${ngn(s.ngnK / 100)}${s.usdC ? ` + $${(s.usdC / 100).toFixed(2)}` : ""} (${change(s.ngnK, sPrev.ngnK)} on last week)</td></tr>
   <tr><td>By product</td><td>${products}</td></tr>
   <tr><td>Sign-up to buyer</td><td>${pct(s.buyers, su)}</td></tr>
   <tr><td>Refunds</td><td>${refunds} refunded · ${refundReq} requested</td></tr>
   <tr><td>Support tickets</td><td>${tickets}</td></tr>
   <tr><td>Missions submitted</td><td>${reviews}</td></tr>
   <tr><td>Where quiet learners stopped</td><td>${topStops.map(([id, n]) => `${esc(id)} ${esc(title(id))} (${n})`).join("<br>") || "–"}</td></tr>
  </table>
  <h3>Suggested this week</h3><ul>${tips.map(t => `<li>${esc(t)}</li>`).join("")}</ul>
  <p><a href="${esc(SITE_URL)}/admin">Open Admin</a> · <a href="${esc(SITE_URL)}/admin/agents">What the agents did</a></p>`;
  await emailAdmins(`Automancy weekly: ${su} sign-ups, ${ngn(s.ngnK / 100)} sales`, html);
  return { summary: `${su} sign-ups, ${s.n} sales (${ngn(s.ngnK / 100)}), ${refunds} refunds. Emailed to admins.`, actions: 1, detail: { tips } };
}
