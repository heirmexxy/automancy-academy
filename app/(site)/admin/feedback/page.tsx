import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { itemById } from "@/lib/course";
import { fmtDate } from "@/lib/format";
import { setFeedbackStatus } from "./actions";

export const metadata: Metadata = { title: "Template feedback · Admin" };
export const dynamic = "force-dynamic";

const KIND: Record<string, string> = { import: "Doesn't import", step: "Step error or warning", instructions: "Setup steps unclear", other: "Other" };

export default async function Feedback({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const show = sp.show === "all" ? "all" : "open";
  const db = createAdminClient();
  let q = db.from("feedback").select("id, user_id, item_id, kind, file, message, status, created_at, closed_at").order("created_at", { ascending: false }).limit(300);
  if (show === "open") q = q.eq("status", "open");
  const { data, error } = await q;
  const rows = data || [];
  const userIds = [...new Set(rows.map(r => r.user_id as string))];
  const { data: profs } = userIds.length ? await db.from("profiles").select("id, email, full_name").in("id", userIds) : { data: [] as { id: string; email: string; full_name: string | null }[] };
  const who = new Map((profs || []).map(p => [p.id as string, p]));

  return (
    <div className="stack">
      <header className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ fontSize: "2rem" }}>Template feedback</h1>
        <div className="row"><Link className={`btn sm ${show === "open" ? "" : "alt"}`} href="/admin/feedback">Open</Link><Link className={`btn sm ${show === "all" ? "" : "alt"}`} href="/admin/feedback?show=all">All</Link></div>
      </header>
      {sp.done && <p className="alert ok" role="status">Saved.</p>}
      {sp.error && <p className="alert bad" role="alert">{sp.error}</p>}
      {error && <p className="alert warn">Couldn&apos;t read feedback: {error.message}. Has migration 0006_course.sql been run?</p>}
      <p className="note">Learners report templates that don&apos;t import or don&apos;t work from the template panel in each lesson. Fix the file in the course source, run <code>npm run course:sync</code>, deploy, then mark it fixed.</p>
      {rows.length === 0 ? <p className="empty">No {show === "open" ? "open " : ""}reports.</p> : rows.map(r => {
        const u = who.get(r.user_id as string);
        const it = itemById(r.item_id as string);
        return (
          <div key={r.id} className="card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <b>{r.item_id}{it ? ` · ${it.title.replace(/&amp;/g, "&")}` : ""}{r.file ? ` · ${r.file}` : ""}</b>
              <span className={`pill ${r.status === "open" ? "warn" : r.status === "fixed" ? "ok" : "bad"}`}>{r.status}</span>
            </div>
            <p className="note">{KIND[r.kind as string] || r.kind} · <Link href={`/admin/learners/${r.user_id}`}>{u?.full_name || u?.email || "learner"}</Link> · {fmtDate(r.created_at)}{r.closed_at ? ` · closed ${fmtDate(r.closed_at)}` : ""}</p>
            <p style={{ whiteSpace: "pre-wrap" }}>{r.message}</p>
            <div className="row">
              {(r.status === "open" ? ["fixed", "wontfix"] : ["open"]).map(st => (
                <form key={st} action={setFeedbackStatus}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="status" value={st} />
                  <input type="hidden" name="show" value={show} />
                  <button className={`btn sm ${st === "fixed" ? "" : "alt"}`} type="submit">{st === "fixed" ? "Mark fixed" : st === "wontfix" ? "Won't fix" : "Reopen"}</button>
                </form>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
