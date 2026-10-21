import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";
import { adminHireProfile, adminHireRequest } from "@/lib/actions/community";
import { AVAILABILITY } from "../../community/_lib/rules";

export const metadata: Metadata = { title: "Hire talent · Admin" };
export const dynamic = "force-dynamic";

type Req = { id: string; profile_user_id: string | null; employer_name: string; company: string | null; email: string; role: string | null; message: string | null; status: string; created_at: string };
type Prof = { user_id: string; display_name: string; cert_id: string | null; headline: string; city: string | null; availability: string; visible: boolean; hidden_by_admin: boolean; updated_at: string };

export default async function AdminHire({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const status = ["open", "forwarded", "closed"].includes(sp.status || "") ? sp.status! : "open";
  const sb = await createClient(); // admin RLS policies apply
  const [{ data: reqData }, { data: profData }, { count: openCount }] = await Promise.all([
    sb.from("hire_requests").select("id, profile_user_id, employer_name, company, email, role, message, status, created_at").eq("status", status).order("created_at", { ascending: false }).limit(200),
    sb.from("hire_profiles").select("user_id, display_name, cert_id, headline, city, availability, visible, hidden_by_admin, updated_at").order("updated_at", { ascending: false }).limit(300),
    sb.from("hire_requests").select("id", { count: "exact", head: true }).eq("status", "open")
  ]);
  const reqs = (reqData || []) as Req[];
  const profs = (profData || []) as Prof[];
  const ids = [...new Set([...profs.map(p => p.user_id), ...(reqs.map(r => r.profile_user_id).filter(Boolean) as string[])])];
  const { data: people } = ids.length ? await sb.from("profiles").select("id, email").in("id", ids) : { data: [] };
  const email = new Map((people || []).map(p => [p.id as string, p.email as string]));
  const name = new Map(profs.map(p => [p.user_id, p.display_name]));
  const back = status === "open" ? "/admin/hire" : `/admin/hire?status=${status}`;

  return (
    <div className="stack">
      <div>
        <p className="eyebrow">Admin</p>
        <h1>Hire talent</h1>
        <p className="muted">Employer intro requests ({openCount || 0} open) and graduate profiles. To introduce, email both sides from the support inbox, then mark the request forwarded. Graduates&apos; emails are never shown to employers on the site.</p>
      </div>
      {sp.msg && <p className={`alert ${/^(Failed|Invalid)/.test(sp.msg) ? "bad" : "ok"}`} role="status">{sp.msg}</p>}

      <section className="stack" aria-labelledby="req-h">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 id="req-h" style={{ fontSize: "1.3rem" }}>Requests</h2>
          <div className="row">{["open", "forwarded", "closed"].map(s => <Link key={s} className={`btn sm${s === status ? "" : " alt"}`} href={s === "open" ? "/admin/hire" : `/admin/hire?status=${s}`}>{s}</Link>)}</div>
        </div>
        {reqs.length === 0 ? <p className="empty">No {status} requests.</p> : (
          <div className="scroll card">
            <table className="dt">
              <thead><tr><th>Employer</th><th>For</th><th>Role / message</th><th>Received</th><th>Actions</th></tr></thead>
              <tbody>
                {reqs.map(r => (
                  <tr key={r.id}>
                    <td><b>{r.employer_name}</b>{r.company && <><br />{r.company}</>}<br /><a href={`mailto:${r.email}`}>{r.email}</a></td>
                    <td className="note">{r.profile_user_id ? <><Link href={`/hire/${r.profile_user_id}`}>{name.get(r.profile_user_id) || "profile"}</Link><br />{email.get(r.profile_user_id) || ""}</> : "General request"}</td>
                    <td style={{ maxWidth: 360 }}>{r.role && <b>{r.role}</b>}<p className="post-body" style={{ whiteSpace: "pre-wrap" }}>{r.message || ""}</p></td>
                    <td className="note">{fmtDate(r.created_at)}</td>
                    <td>
                      <div className="row">
                        {["open", "forwarded", "closed"].filter(s => s !== r.status).map(s => (
                          <form key={s} action={adminHireRequest}><input type="hidden" name="requestId" value={r.id} /><input type="hidden" name="status" value={s} /><input type="hidden" name="back" value={back} />
                            <button className="btn alt sm" type="submit">{s === "open" ? "Reopen" : s === "forwarded" ? "Mark forwarded" : "Close"}</button></form>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="stack" aria-labelledby="prof-h">
        <h2 id="prof-h" style={{ fontSize: "1.3rem" }}>Graduate profiles ({profs.length})</h2>
        {profs.length === 0 ? <p className="empty">No graduate has created a profile yet.</p> : (
          <div className="scroll card">
            <table className="dt">
              <thead><tr><th>Graduate</th><th>Headline</th><th>Shown?</th><th>Updated</th><th>Actions</th></tr></thead>
              <tbody>
                {profs.map(p => (
                  <tr key={p.user_id}>
                    <td><Link href={`/hire/${p.user_id}`}>{p.display_name}</Link><br /><span className="note">{email.get(p.user_id) || ""}{p.cert_id ? ` · ${p.cert_id}` : ""}</span></td>
                    <td className="note" style={{ maxWidth: 300 }}>{p.headline}<br />{[p.city, AVAILABILITY[p.availability]].filter(Boolean).join(" · ")}</td>
                    <td>{p.hidden_by_admin ? <span className="pill bad">Hidden by admin</span> : p.visible ? <span className="pill ok">Visible*</span> : <span className="pill">Hidden by graduate</span>}</td>
                    <td className="note">{fmtDate(p.updated_at)}</td>
                    <td>
                      <form action={adminHireProfile}><input type="hidden" name="userId" value={p.user_id} /><input type="hidden" name="op" value={p.hidden_by_admin ? "unhide" : "hide"} /><input type="hidden" name="back" value="/admin/hire" />
                        <button className="btn alt sm" type="submit">{p.hidden_by_admin ? "Allow again" : "Hide from directory"}</button></form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="note">* Visible profiles are listed only while the graduate holds a non-revoked certificate.</p>
          </div>
        )}
      </section>
    </div>
  );
}
