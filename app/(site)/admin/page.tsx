import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPaystack } from "@/lib/config";
import { percentDone } from "@/lib/course";
import { DAY_MS, moneyText } from "@/lib/money";

export const metadata: Metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

type Db = ReturnType<typeof createAdminClient>;
/** Counts on tables owned by other features may not exist yet: show "–" instead of failing. */
async function safeCount(run: () => PromiseLike<{ count: number | null; error: unknown }>): Promise<number | null> {
  try { const { count, error } = await run(); return error ? null : count ?? 0; } catch { return null; }
}

export default async function AdminHome() {
  await requireAdmin();
  const db: Db = createAdminClient();
  const ago = (d: number) => new Date(Date.now() - d * DAY_MS).toISOString();

  const [signups, signups7, paid, active7, progress, refunds, reviews, hires] = await Promise.all([
    safeCount(() => db.from("profiles").select("id", { count: "exact", head: true })),
    safeCount(() => db.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", ago(7))),
    db.from("payments").select("user_id, amount_kobo, currency, paid_at").eq("status", "success"),
    safeCount(() => db.from("progress").select("user_id", { count: "exact", head: true }).gte("updated_at", ago(7))),
    db.from("progress").select("done"),
    safeCount(() => db.from("refund_requests").select("id", { count: "exact", head: true }).eq("status", "open")),
    safeCount(() => db.from("submissions").select("id", { count: "exact", head: true }).eq("status", "pending").eq("needs_human", true)),
    safeCount(() => db.from("hire_requests").select("id", { count: "exact", head: true }).eq("status", "open"))
  ]);

  const pays = paid.data || [];
  const since30 = Date.now() - 30 * DAY_MS;
  const sum = (cur: string, recent: boolean) => pays.filter(p => p.currency === cur && (!recent || (p.paid_at && new Date(p.paid_at).getTime() >= since30)))
    .reduce((a, p) => a + (p.amount_kobo as number), 0);
  const payers = new Set(pays.map(p => p.user_id)).size;
  const prows = progress.data || [];
  const avg = prows.length ? Math.round(prows.reduce((a, r) => a + percentDone(r.done as Record<string, boolean>), 0) / prows.length) : 0;
  const n = (v: number | null) => (v == null ? "–" : v.toLocaleString("en-NG"));
  const usd30 = sum("USD", true), usdAll = sum("USD", false);

  return (
    <div className="stack">
      <header className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ fontSize: "2rem" }}>Overview</h1>
        <a className="btn alt sm" href="/api/admin/export">Download learners CSV</a>
      </header>
      {!hasPaystack() && <p className="alert warn">Paystack isn't configured (placeholder mode): checkout shows a waitlist. Grant access from <Link href="/admin/learners">Learners</Link>.</p>}
      <div className="grid4">
        <div className="kpi"><b>{n(signups)}</b><span>sign-ups ({n(signups7)} in 7 days)</span></div>
        <div className="kpi"><b>{n(payers)}</b><span>paying learners</span></div>
        <div className="kpi"><b>{moneyText(sum("NGN", true))}</b><span>revenue, last 30 days{usd30 ? ` + ${moneyText(usd30, "USD")}` : ""}</span></div>
        <div className="kpi"><b>{moneyText(sum("NGN", false))}</b><span>revenue, all time{usdAll ? ` + ${moneyText(usdAll, "USD")}` : ""}</span></div>
        <div className="kpi"><b>{n(active7)}</b><span>active learners, 7 days</span></div>
        <div className="kpi"><b>{avg}%</b><span>average progress</span></div>
        <Link className="kpi" href="/admin/refunds" style={{ color: "inherit", textDecoration: "none" }}><b>{n(refunds)}</b><span>open refund requests</span></Link>
        <Link className="kpi" href="/admin/reviews" style={{ color: "inherit", textDecoration: "none" }}><b>{n(reviews)}</b><span>reviews waiting for a person</span></Link>
        <Link className="kpi" href="/admin/hire" style={{ color: "inherit", textDecoration: "none" }}><b>{n(hires)}</b><span>open hire requests</span></Link>
      </div>
      <p className="note">Revenue counts successful payments only (refunded payments are excluded); dollar payments are shown separately.</p>
    </div>
  );
}
