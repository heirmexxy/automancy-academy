import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { fmtDate, ngn } from "@/lib/format";
import { moneyText } from "@/lib/money";
import { creatorEarnings, getCreator } from "@/lib/marketplace";
import { createCourse, updateCreatorProfile } from "@/lib/actions/marketplace";
import { MARKET, STATUS_LABEL, statusTone, type CourseStatus } from "../../courses/_lib/core";
import "../../courses/marketplace.css";

export const metadata: Metadata = { title: "Creator studio" };
export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function Studio({ searchParams }: Props) {
  const sp = await searchParams;
  const user = await requireUser("/teach/studio");
  const creator = await getCreator(user.id);
  if (!creator || creator.status !== "approved") redirect("/teach/apply");
  const tab = sp.tab === "earnings" || sp.tab === "profile" ? sp.tab : "courses";
  const db = createAdminClient();

  const { data: courses } = await db.from("courses").select("id, slug, title, status, changes_pending, price_ngn, is_free, updated_at, review_note").eq("creator_id", user.id).order("updated_at", { ascending: false });
  const ids = (courses || []).map(c => c.id as string);
  const { data: enr } = ids.length ? await db.from("course_enrollments").select("course_id").in("course_id", ids).eq("status", "active") : { data: [] };
  const learners = new Map<string, number>();
  (enr || []).forEach(e => learners.set(e.course_id as string, (learners.get(e.course_id as string) || 0) + 1));
  const titles = new Map<string, string>((courses || []).map(c => [c.id as string, c.title as string]));

  const Tabs = () => (
    <nav className="mk-tabs" aria-label="Studio">
      <Link href="/teach/studio" aria-current={tab === "courses" ? "page" : undefined}>Courses</Link>
      <Link href="/teach/studio?tab=earnings" aria-current={tab === "earnings" ? "page" : undefined}>Earnings</Link>
      <Link href="/teach/studio?tab=profile" aria-current={tab === "profile" ? "page" : undefined}>Profile</Link>
    </nav>
  );

  return (
    <section className="wrap stack">
      <header className="stack" style={{ gap: 6 }}>
        <p className="eyebrow">Creator studio</p>
        <h1 style={{ fontSize: "clamp(1.9rem,5vw,2.6rem)" }}>Hi {creator.display_name.split(" ")[0]}</h1>
      </header>
      <Tabs />
      {sp.error && <p className="alert bad" role="alert">{sp.error}</p>}
      {sp.deleted && <p className="alert ok" role="status">Draft deleted.</p>}

      {tab === "courses" && <>
        <form action={createCourse} className="card row">
          <label className="fld" style={{ flex: "1 1 240px" }}>New course title<input name="title" required minLength={3} maxLength={120} placeholder="e.g. WhatsApp order bots for small shops" /></label>
          <button className="btn" type="submit" style={{ alignSelf: "end" }}>Create course</button>
        </form>
        {(courses || []).length ? (
          <div className="scroll"><table className="dt">
            <thead><tr><th>Course</th><th>Status</th><th>Price</th><th>Learners</th><th>Updated</th></tr></thead>
            <tbody>{(courses || []).map(c => (
              <tr key={c.id as string}>
                <td><Link href={`/teach/studio/${c.id}`}><b>{c.title as string}</b></Link></td>
                <td><span className={`pill ${statusTone(c.status as string)}`}>{STATUS_LABEL[c.status as CourseStatus]}</span>{c.changes_pending ? <> <span className="pill warn">Changes in review</span></> : null}</td>
                <td>{c.is_free ? "Free" : c.price_ngn ? ngn(c.price_ngn as number) : "-"}</td>
                <td>{learners.get(c.id as string) || 0}</td>
                <td>{fmtDate(c.updated_at as string)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <p className="empty">No courses yet. Give your first one a title above to start.</p>}
        <p className="note">Need a hand? Read the <Link href="/teach/standards">standards and course specifications</Link> and the <Link href="/teach/terms">creator terms</Link>.</p>
      </>}

      {tab === "earnings" && <Earnings userId={user.id} titles={titles} share={creator.revenue_share} />}

      {tab === "profile" && (
        <form action={updateCreatorProfile} className="card stack">
          {sp.saved && <p className="alert ok" role="status">Profile saved.</p>}
          <label className="fld">Display name<input name="display_name" required maxLength={80} defaultValue={creator.display_name} /></label>
          <label className="fld">Bio (shown on your course pages)<textarea name="bio" maxLength={2000} defaultValue={creator.bio || ""} /></label>
          <label className="fld">Website<input name="website" type="url" maxLength={300} defaultValue={creator.website || ""} /></label>
          <label className="fld">Photo URL (https)<input name="photo_url" type="url" maxLength={500} defaultValue={creator.photo_url || ""} /></label>
          <button className="btn" type="submit" style={{ justifySelf: "start" }}>Save profile</button>
        </form>
      )}
    </section>
  );
}

async function Earnings({ userId, titles, share }: { userId: string; titles: Map<string, string>; share: number }) {
  const e = await creatorEarnings(userId);
  const { data: acct } = await createAdminClient().from("payout_accounts").select("bank_name, account_last4, account_name").eq("user_id", userId).maybeSingle();
  const now = Date.now();
  return (
    <div className="stack">
      <div className="grid4">
        <div className="kpi"><b>{moneyText(e.pending)}</b><span>Pending (refund window)</span></div>
        <div className="kpi"><b>{moneyText(e.available)}</b><span>Available for payout</span></div>
        <div className="kpi"><b>{moneyText(e.paid)}</b><span>Paid to you</span></div>
        <div className="kpi"><b>{e.rows.filter(r => r.status !== "reversed").length}</b><span>Sales</span></div>
      </div>
      <div className="card">
        <h2 style={{ fontSize: "1.2rem" }}>Payout account</h2>
        {acct ? <p>We pay to <b>{String(acct.account_name || "your account")}</b>, {String(acct.bank_name)} ····{String(acct.account_last4)}.</p> : <p className="alert warn">Add your bank account so we can pay you.</p>}
        <p><Link className="btn alt sm" href="/earn#payouts">{acct ? "Change bank account" : "Add bank account"}</Link></p>
        <p className="note">Your share is {Math.round(share * 100)}% of each sale after the Paystack fee (an estimate until the payment settles). Earnings become available {MARKET.refundWindowDays} days after the sale, and we pay available earnings monthly. Refunded sales are reversed.</p>
      </div>
      {e.rows.length ? (
        <div className="scroll"><table className="dt">
          <thead><tr><th>Date</th><th>Course</th><th>Sale</th><th>Fee (est.)</th><th>Your share</th><th>Status</th></tr></thead>
          <tbody>{e.rows.map(r => {
            const st = r.status === "pending" && new Date(r.available_at).getTime() <= now ? "available" : r.status;
            return (
              <tr key={r.id}>
                <td>{fmtDate(r.created_at)}</td><td>{titles.get(r.course_id) || "Course"}</td>
                <td>{moneyText(r.gross_kobo)}</td><td>{moneyText(r.fees_kobo)}</td><td><b>{moneyText(r.amount_kobo)}</b></td>
                <td><span className={`pill ${st === "paid" || st === "available" ? "ok" : st === "reversed" ? "bad" : "warn"}`}>{st}</span>
                  {st === "pending" && <span className="note"> until {fmtDate(r.available_at)}</span>}
                  {r.payout_ref && <span className="note"> · {r.payout_ref}</span>}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
      ) : <p className="empty">No sales yet. Share your course link to get your first learners.</p>}
    </div>
  );
}
