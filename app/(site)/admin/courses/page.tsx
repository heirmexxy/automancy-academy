import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { fmtDate, ngn } from "@/lib/format";
import { moneyText } from "@/lib/money";
import { adminDecideCreator, adminMarkEarningsPaid, adminReleaseEarnings, adminSetListing } from "@/lib/actions/marketplace";
import { STATUS_LABEL, statusTone, type CourseStatus } from "../../courses/_lib/core";
import "../../courses/marketplace.css";

export const metadata: Metadata = { title: "Admin · Creator courses" };
export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<Record<string, string | undefined>> };
const TABS = [["creators", "Creators"], ["queue", "Review queue"], ["live", "Courses"], ["earnings", "Earnings & payouts"]] as const;

export default async function AdminCourses({ searchParams }: Props) {
  await requireAdmin();
  const sp = await searchParams;
  const tab = (TABS.map(t => t[0]) as readonly string[]).includes(sp.tab || "") ? sp.tab! : "creators";
  const db = createAdminClient();

  return (
    <div className="stack">
      <h1 style={{ fontSize: "2rem" }}>Creator courses</h1>
      <nav className="mk-tabs" aria-label="Creator courses">
        {TABS.map(([k, label]) => <Link key={k} href={`/admin/courses?tab=${k}`} aria-current={tab === k ? "page" : undefined}>{label}</Link>)}
      </nav>
      {sp.error && <p className="alert bad" role="alert">{sp.error}</p>}
      {sp.done && <p className="alert ok" role="status">Done: {sp.done}.</p>}
      {sp.released && <p className="alert ok" role="status">{sp.released} earnings moved to available.</p>}
      {tab === "creators" && <Creators db={db} />}
      {tab === "queue" && <Queue db={db} />}
      {tab === "live" && <Live db={db} />}
      {tab === "earnings" && <Earnings db={db} />}
    </div>
  );
}

type DB = ReturnType<typeof createAdminClient>;

async function Creators({ db }: { db: DB }) {
  const { data } = await db.from("creators").select("*").order("created_at", { ascending: false }).limit(300);
  const rows = data || [];
  const ids = rows.map(r => r.user_id as string);
  const { data: profs } = ids.length ? await db.from("profiles").select("id, email").in("id", ids) : { data: [] };
  const email = new Map((profs || []).map(p => [p.id as string, p.email as string]));
  const order = (s: string) => (s === "applied" ? 0 : s === "approved" ? 1 : 2);
  rows.sort((a, b) => order(a.status as string) - order(b.status as string));
  if (!rows.length) return <p className="empty">No creator applications yet.</p>;
  return (
    <div className="stack">
      {rows.map(r => (
        <div key={r.user_id as string} className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div><b>{r.display_name as string}</b> <span className="muted">{email.get(r.user_id as string)}</span></div>
            <span className={`pill ${r.status === "approved" ? "ok" : r.status === "suspended" ? "bad" : "warn"}`}>{r.status as string}</span>
          </div>
          <p className="note">Applied {fmtDate(r.created_at as string)} · share {Math.round(Number(r.revenue_share) * 100)}%{r.website ? <> · <a href={String(r.website)} target="_blank" rel="noopener noreferrer nofollow">{String(r.website)}</a></> : null}</p>
          {r.bio && <p style={{ whiteSpace: "pre-line" }}>{String(r.bio)}</p>}
          {r.application_note && <p style={{ whiteSpace: "pre-line" }}><b>Wants to teach:</b> {String(r.application_note)}</p>}
          <form action={adminDecideCreator} className="row">
            <input type="hidden" name="user_id" value={r.user_id as string} />
            <label className="fld" style={{ width: 140 }}>Revenue share %<input name="revenue_share" type="number" min={0} max={100} step={1} defaultValue={Math.round(Number(r.revenue_share) * 100)} /></label>
            {r.status !== "approved" && <button className="btn sm" name="decision" value="approve" type="submit">Approve</button>}
            {r.status === "approved" && <button className="btn alt sm" name="decision" value="approve" type="submit">Save share</button>}
            {r.status !== "suspended" && <button className="btn alt sm" name="decision" value="suspend" type="submit">{r.status === "applied" ? "Decline" : "Suspend"}</button>}
          </form>
        </div>
      ))}
    </div>
  );
}

async function names(db: DB, ids: string[]) {
  const { data } = ids.length ? await db.from("creators").select("user_id, display_name").in("user_id", [...new Set(ids)]) : { data: [] };
  return new Map((data || []).map(c => [c.user_id as string, c.display_name as string]));
}

async function Queue({ db }: { db: DB }) {
  const { data } = await db.from("courses").select("id, title, creator_id, status, changes_pending, submitted_at, price_ngn")
    .or("status.eq.submitted,and(status.eq.live,changes_pending.eq.true)").order("submitted_at", { ascending: true });
  const rows = data || [];
  const who = await names(db, rows.map(r => r.creator_id as string));
  if (!rows.length) return <p className="empty">Nothing waiting for review.</p>;
  return (
    <div className="scroll"><table className="dt">
      <thead><tr><th>Course</th><th>Creator</th><th>Type</th><th>Submitted</th><th>Price</th><th /></tr></thead>
      <tbody>{rows.map(r => (
        <tr key={r.id as string}>
          <td><b>{r.title as string}</b></td><td>{who.get(r.creator_id as string)}</td>
          <td>{r.status === "live" ? <span className="pill warn">Changes to live course</span> : <span className="pill">New</span>}</td>
          <td>{r.submitted_at ? fmtDate(r.submitted_at as string) : "-"}</td><td>{ngn(r.price_ngn as number)}</td>
          <td><Link className="btn sm" href={`/admin/courses/${r.id}`}>Review</Link></td>
        </tr>
      ))}</tbody>
    </table></div>
  );
}

async function Live({ db }: { db: DB }) {
  const { data } = await db.from("courses").select("id, slug, title, creator_id, status, price_ngn, is_free, published_at, updated_at").order("updated_at", { ascending: false }).limit(300);
  const rows = data || [];
  const who = await names(db, rows.map(r => r.creator_id as string));
  const ids = rows.map(r => r.id as string);
  const { data: enr } = ids.length ? await db.from("course_enrollments").select("course_id").in("course_id", ids).eq("status", "active") : { data: [] };
  const count = new Map<string, number>();
  (enr || []).forEach(e => count.set(e.course_id as string, (count.get(e.course_id as string) || 0) + 1));
  if (!rows.length) return <p className="empty">No courses yet.</p>;
  return (
    <div className="scroll"><table className="dt">
      <thead><tr><th>Course</th><th>Creator</th><th>Status</th><th>Price</th><th>Learners</th><th /></tr></thead>
      <tbody>{rows.map(r => (
        <tr key={r.id as string}>
          <td><Link href={`/admin/courses/${r.id}`}><b>{r.title as string}</b></Link><br /><span className="note">/courses/{r.slug as string}</span></td>
          <td>{who.get(r.creator_id as string)}</td>
          <td><span className={`pill ${statusTone(r.status as string)}`}>{STATUS_LABEL[r.status as CourseStatus]}</span></td>
          <td>{r.is_free ? "Free" : ngn(r.price_ngn as number)}</td>
          <td>{count.get(r.id as string) || 0}</td>
          <td>
            {(r.status === "live" || r.status === "unlisted") && (
              <form action={adminSetListing}><input type="hidden" name="course_id" value={r.id as string} />
                <input type="hidden" name="to" value={r.status === "live" ? "unlisted" : "live"} />
                <button className="btn alt sm" type="submit">{r.status === "live" ? "Unlist" : "Relist"}</button>
              </form>
            )}
          </td>
        </tr>
      ))}</tbody>
    </table></div>
  );
}

async function Earnings({ db }: { db: DB }) {
  const { data } = await db.from("creator_earnings").select("creator_id, amount_kobo, status, available_at").neq("status", "reversed").limit(5000);
  const now = Date.now();
  const by = new Map<string, { pending: number; available: number; paid: number }>();
  for (const e of data || []) {
    const k = e.creator_id as string;
    const o = by.get(k) || { pending: 0, available: 0, paid: 0 };
    const amt = e.amount_kobo as number;
    if (e.status === "paid") o.paid += amt;
    else if (e.status === "available" || new Date(e.available_at as string).getTime() <= now) o.available += amt;
    else o.pending += amt;
    by.set(k, o);
  }
  const ids = [...by.keys()];
  const who = await names(db, ids);
  const { data: accts } = ids.length ? await db.from("payout_accounts").select("user_id, bank_name, account_last4, account_name, paystack_recipient_code").in("user_id", ids) : { data: [] };
  const acct = new Map<string, Record<string, unknown>>((accts || []).map(a => [a.user_id as string, a]));
  return (
    <div className="stack">
      <form action={adminReleaseEarnings} className="row">
        <button className="btn alt sm" type="submit">Release earnings past the refund window</button>
        <span className="note">Moves pending earnings older than 14 days to "available". Marking paid does this too.</span>
      </form>
      {!ids.length ? <p className="empty">No creator earnings yet.</p> : (
        <div className="scroll"><table className="dt">
          <thead><tr><th>Creator</th><th>Pending</th><th>Available</th><th>Paid</th><th>Bank</th><th>Mark available as paid</th></tr></thead>
          <tbody>{ids.map(id => {
            const o = by.get(id)!; const a = acct.get(id);
            return (
              <tr key={id}>
                <td>{who.get(id) || id.slice(0, 8)}</td><td>{moneyText(o.pending)}</td><td><b>{moneyText(o.available)}</b></td><td>{moneyText(o.paid)}</td>
                <td>{a ? <>{String(a.account_name || "")} {String(a.bank_name)} ····{String(a.account_last4)}{a.paystack_recipient_code ? <><br /><code className="note">{String(a.paystack_recipient_code)}</code></> : null}</> : <span className="pill bad">No account</span>}</td>
                <td>{o.available > 0 && (
                  <form action={adminMarkEarningsPaid} className="row"><input type="hidden" name="creator_id" value={id} />
                    <input name="payout_ref" placeholder="Transfer reference" maxLength={120} required style={{ width: 170 }} />
                    <button className="btn sm" type="submit">Mark paid</button>
                  </form>
                )}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
      )}
      <p className="note">Send the transfer first (Paystack Transfers or your bank), then mark paid with its reference. Refunds after payout are logged as "creator_clawback_needed" in the audit log; deduct them from the next payout.</p>
    </div>
  );
}
