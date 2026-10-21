import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { fmtDate } from "@/lib/format";
import { adminReissueCertificate, adminRevokeCertificate } from "@/lib/actions/reviews";

export const metadata: Metadata = { title: "Certificates · Admin" };
export const dynamic = "force-dynamic";

type Cert = { id: string; user_id: string; name_on_certificate: string; issued_at: string; revoked: boolean; revoked_reason: string | null };

export default async function AdminCertificates({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const show = sp.show || "all"; // all | valid | revoked
  const db = createAdminClient();
  let query = db.from("certificates").select("*").order("issued_at", { ascending: false }).limit(200);
  if (show === "valid") query = query.eq("revoked", false);
  if (show === "revoked") query = query.eq("revoked", true);
  if (q) {
    const safe = q.replace(/[%_,()]/g, "");
    const { data: ps } = await db.from("profiles").select("id").ilike("email", `%${safe}%`).limit(50);
    const ids = (ps || []).map(p => p.id as string);
    query = ids.length ? query.or(`id.ilike.%${safe}%,name_on_certificate.ilike.%${safe}%,user_id.in.(${ids.join(",")})`) : query.or(`id.ilike.%${safe}%,name_on_certificate.ilike.%${safe}%`);
  }
  const [{ data }, { count: valid }] = await Promise.all([query, db.from("certificates").select("id", { count: "exact", head: true }).eq("revoked", false)]);
  const certs = (data || []) as Cert[];
  const uids = [...new Set(certs.map(c => c.user_id))];
  const { data: profiles } = uids.length ? await db.from("profiles").select("id, email, full_name").in("id", uids) : { data: [] };
  const who = new Map((profiles || []).map(p => [p.id as string, p as { email: string; full_name: string | null }]));

  return (
    <div className="stack">
      <div>
        <p className="eyebrow">Admin</p>
        <h1>Certificates</h1>
        <p className="muted">{valid || 0} valid certificates. Learners claim their own once the server confirms every criterion. Revoking or re-issuing is logged.</p>
      </div>
      {sp.error && <p className="alert bad">{sp.error}</p>}
      {sp.notice && <p className="alert ok">{sp.notice}</p>}
      <form className="row" method="get" style={{ flexWrap: "wrap", gap: 8, alignItems: "end" }}>
        <label className="fld">Search<input name="q" defaultValue={q} placeholder="ID, name or email" /></label>
        <label className="fld">Show<select name="show" defaultValue={show}><option value="all">All</option><option value="valid">Valid</option><option value="revoked">Revoked</option></select></label>
        <button className="btn sm" type="submit">Filter</button>
      </form>
      {certs.length === 0 ? <p className="empty">No certificates yet.</p> : (
        <div className="scroll">
          <table className="dt">
            <thead><tr><th>ID</th><th>Name on certificate</th><th>Learner</th><th>Issued</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {certs.map(c => {
                const p = who.get(c.user_id);
                return (
                  <tr key={c.id}>
                    <td><Link href={`/verify/${c.id}`}>{c.id}</Link></td>
                    <td>{c.name_on_certificate}{p?.full_name && p.full_name.trim() !== c.name_on_certificate ? <><br /><small className="muted">Profile now: {p.full_name}</small></> : null}</td>
                    <td><small>{p?.email || c.user_id}</small></td>
                    <td>{fmtDate(c.issued_at)}</td>
                    <td>{c.revoked ? <><span className="pill bad">revoked</span><br /><small className="muted">{c.revoked_reason}</small></> : <span className="pill ok">valid</span>}</td>
                    <td>
                      {!c.revoked && (
                        <details>
                          <summary className="btn sm alt">Manage</summary>
                          <form action={adminRevokeCertificate} className="stack" style={{ marginTop: 8, minWidth: 220 }}>
                            <input type="hidden" name="id" value={c.id} />
                            <label className="fld">Reason for revoking<input name="reason" required minLength={5} maxLength={500} /></label>
                            <button className="btn sm" type="submit">Revoke</button>
                          </form>
                          <form action={adminReissueCertificate} style={{ marginTop: 8 }}>
                            <input type="hidden" name="id" value={c.id} />
                            <button className="btn sm alt" type="submit">Re-issue with current profile name</button>
                          </form>
                        </details>
                      )}
                      {c.revoked && (
                        <form action={adminReissueCertificate}>
                          <input type="hidden" name="id" value={c.id} />
                          <button className="btn sm alt" type="submit">Re-issue (new ID)</button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
