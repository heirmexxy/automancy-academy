import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PRODUCTS, product } from "@/lib/pricing";
import { fmtDate } from "@/lib/format";
import { moneyText, safeSearch, type Currency } from "@/lib/money";

export const metadata: Metadata = { title: "Payments · Admin" };
export const dynamic = "force-dynamic";

const STATUSES = ["success", "initialized", "failed", "refunded", "partially_refunded"];

export default async function Payments({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status || "") ? sp.status! : "";
  const prod = PRODUCTS.some(p => p.id === sp.product) ? sp.product! : "";
  const currency = sp.currency === "NGN" || sp.currency === "USD" ? sp.currency : "";
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.from || "") ? sp.from! : "";
  const to = /^\d{4}-\d{2}-\d{2}$/.test(sp.to || "") ? sp.to! : "";
  const q = safeSearch(sp.q);

  const db = createAdminClient();
  let userIds: string[] | null = null;
  if (q && !q.toUpperCase().startsWith("AM-")) {
    const { data } = await db.from("profiles").select("id").or(`email.ilike.*${q}*,full_name.ilike.*${q}*`).limit(200);
    userIds = (data || []).map(r => r.id as string);
  }
  let query = db.from("payments").select("id, user_id, product, reference, amount_kobo, currency, status, installment_no, installments_total, discount_kobo, referral_code, paid_at, created_at")
    .order("created_at", { ascending: false }).limit(1000);
  if (status) query = query.eq("status", status);
  if (prod) query = query.eq("product", prod);
  if (currency) query = query.eq("currency", currency);
  if (from) query = query.gte("created_at", `${from}T00:00:00Z`);
  if (to) query = query.lte("created_at", `${to}T23:59:59Z`);
  if (q && userIds === null) query = query.ilike("reference", `%${q}%`);
  if (userIds) query = userIds.length ? query.in("user_id", userIds) : query.eq("user_id", "00000000-0000-0000-0000-000000000000");
  const { data } = await query;
  const rows = data || [];
  const ids = [...new Set(rows.map(r => r.user_id as string))];
  const { data: profs } = ids.length ? await db.from("profiles").select("id, email, full_name").in("id", ids.slice(0, 1000)) : { data: [] };
  const who = new Map((profs || []).map(p => [p.id as string, p]));

  const totals = (cur: Currency) => {
    const r = rows.filter(x => x.currency === cur && x.status === "success");
    return { n: r.length, sum: r.reduce((a, x) => a + (x.amount_kobo as number), 0), disc: r.reduce((a, x) => a + (x.discount_kobo as number), 0) };
  };
  const ngnT = totals("NGN"), usdT = totals("USD");
  const refunded = rows.filter(x => x.status === "refunded" || x.status === "partially_refunded");

  return (
    <div className="stack">
      <h1 style={{ fontSize: "2rem" }}>Payments</h1>
      <form className="row" method="get">
        <input name="q" defaultValue={sp.q || ""} placeholder="Email, name or reference" aria-label="Search" style={{ maxWidth: 240 }} />
        <select name="status" defaultValue={status} aria-label="Status" style={{ maxWidth: 170 }}><option value="">All statuses</option>{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select>
        <select name="product" defaultValue={prod} aria-label="Product" style={{ maxWidth: 190 }}><option value="">All products</option>{PRODUCTS.filter(p => p.ngn > 0).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select name="currency" defaultValue={currency} aria-label="Currency" style={{ maxWidth: 120 }}><option value="">NGN + USD</option><option value="NGN">NGN</option><option value="USD">USD</option></select>
        <label className="note">From <input type="date" name="from" defaultValue={from} style={{ width: "auto" }} /></label>
        <label className="note">To <input type="date" name="to" defaultValue={to} style={{ width: "auto" }} /></label>
        <button className="btn sm" type="submit">Filter</button>
        <Link className="note" href="/admin/payments">Clear</Link>
      </form>
      <div className="grid4">
        <div className="kpi"><b>{moneyText(ngnT.sum)}</b><span>{ngnT.n} successful NGN payments</span></div>
        <div className="kpi"><b>{moneyText(usdT.sum, "USD")}</b><span>{usdT.n} successful USD payments</span></div>
        <div className="kpi"><b>{moneyText(ngnT.disc)}</b><span>referral discounts given (NGN)</span></div>
        <div className="kpi"><b>{refunded.length}</b><span>refunded in this list</span></div>
      </div>
      <p className="note">{rows.length} payment{rows.length === 1 ? "" : "s"}{rows.length >= 1000 ? " (first 1,000; filter to narrow)" : ""}. Totals count successful payments in the filtered list.</p>
      {rows.length === 0 ? <p className="empty">No payments match.</p> : (
        <div className="scroll"><table className="dt">
          <thead><tr><th>Date</th><th>Learner</th><th>Product</th><th>Amount</th><th>Status</th><th>Referral</th><th>Reference</th></tr></thead>
          <tbody>{rows.map(r => {
            const p = who.get(r.user_id as string);
            return (
              <tr key={r.id}>
                <td>{fmtDate(r.paid_at || r.created_at)}</td>
                <td><Link href={`/admin/learners/${r.user_id}`}>{p?.full_name || p?.email || "learner"}</Link>{p?.full_name ? <div className="note">{p.email}</div> : null}</td>
                <td>{product(r.product)?.name || r.product}{r.installments_total > 1 ? ` (${r.installment_no}/${r.installments_total})` : ""}</td>
                <td>{moneyText(r.amount_kobo, r.currency as Currency)}</td>
                <td><span className={`pill ${r.status === "success" ? "ok" : r.status === "initialized" ? "" : r.status === "partially_refunded" ? "warn" : "bad"}`}>{r.status}</span></td>
                <td>{r.referral_code || ""}</td>
                <td><code>{r.reference}</code></td>
              </tr>
            );
          })}</tbody>
        </table></div>
      )}
    </div>
  );
}
