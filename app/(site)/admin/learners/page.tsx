import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { moneyText } from "@/lib/money";
import { loadLearners } from "./data";

export const metadata: Metadata = { title: "Learners · Admin" };
export const dynamic = "force-dynamic";

export default async function Learners({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q || "").slice(0, 80);
  const filter = sp.filter || "all";
  let rows = await loadLearners({ q, limit: 500 });
  if (filter === "paying") rows = rows.filter(r => r.firstPaid);
  if (filter === "free") rows = rows.filter(r => !r.products.length);

  return (
    <div className="stack">
      <header className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ fontSize: "2rem" }}>Learners</h1>
        <a className="btn alt sm" href="/api/admin/export">Download CSV</a>
      </header>
      <form className="row" method="get">
        <input name="q" defaultValue={q} placeholder="Search name or email" aria-label="Search name or email" style={{ maxWidth: 320 }} />
        <select name="filter" defaultValue={filter} aria-label="Filter" style={{ maxWidth: 180 }}>
          <option value="all">Everyone</option><option value="paying">Paid at least once</option><option value="free">No active access</option>
        </select>
        <button className="btn sm" type="submit">Search</button>
      </form>
      <p className="note">{rows.length} learner{rows.length === 1 ? "" : "s"}{rows.length >= 500 ? " (first 500; search to narrow)" : ""}</p>
      {rows.length === 0 ? <p className="empty">No learners match.</p> : (
        <div className="scroll"><table className="dt">
          <thead><tr><th>Name</th><th>Email</th><th>Access</th><th>First paid</th><th>Paid</th><th>Progress</th><th>Items</th><th>Last active</th><th></th></tr></thead>
          <tbody>{rows.map(r => (
            <tr key={r.id}>
              <td>{r.name || <span className="muted">(no name)</span>}{r.role !== "learner" ? <> <span className="pill">{r.role}</span></> : null}</td>
              <td>{r.email}</td>
              <td>{r.products.length ? r.products.join(", ") : <span className="muted">free</span>}</td>
              <td>{r.firstPaid ? fmtDate(r.firstPaid) : "-"}</td>
              <td>{r.paidNgnKobo ? moneyText(r.paidNgnKobo) : ""}{r.paidUsdCents ? ` ${moneyText(r.paidUsdCents, "USD")}` : ""}{!r.paidNgnKobo && !r.paidUsdCents ? "-" : ""}</td>
              <td>{r.pct}%</td>
              <td>{r.itemsDone}</td>
              <td>{r.lastActive ? fmtDate(r.lastActive) : "-"}</td>
              <td><Link href={`/admin/learners/${r.id}`}>Open</Link></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  );
}
