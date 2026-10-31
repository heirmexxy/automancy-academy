import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { fmtDate } from "@/lib/format";
import { saveSettings } from "@/lib/actions/settings";
import { deleteDiscountCode, saveDiscountCode, toggleDiscountCode } from "@/lib/actions/discounts";
import { PRODUCTS } from "@/lib/pricing";
import { DISCOUNT_CODE_MAX_PERCENT, moneyText, type DiscountCodeRow } from "@/lib/money";
import { SITE_URL } from "@/lib/config";

export const metadata: Metadata = { title: "Settings · Admin" };
export const dynamic = "force-dynamic";

type Code = DiscountCodeRow & { note: string | null; created_at: string; uses: number; given: number };
type OptCourse = { id: string; title: string };
const PAID = PRODUCTS.filter(p => p.ngn > 0 && p.id !== "team");
/** Lagos calendar date (YYYY-MM-DD) of an ISO time, for date inputs. */
const lagosYmd = (iso: string | null) => iso ? new Date(Date.parse(iso) + 3_600_000).toISOString().slice(0, 10) : "";
function codeState(c: Code): [string, string] {
  const now = Date.now();
  if (!c.active) return ["Off", ""];
  if (c.ends_at && Date.parse(c.ends_at) <= now) return ["Expired", "bad"];
  if (c.starts_at && Date.parse(c.starts_at) > now) return ["Scheduled", "warn"];
  if (c.max_uses != null && c.uses >= c.max_uses) return ["Used up", "bad"];
  return ["Active", "ok"];
}

/** The fields shared by "New code" and each code's edit form. */
function CodeFields({ c, courses }: { c?: Code; courses: OptCourse[] }) {
  return (
    <>
      <div className="grid3">
        <label className="fld">Code
          <input name="code" required minLength={3} maxLength={32} pattern="[A-Za-z0-9][A-Za-z0-9_\-]{2,31}" defaultValue={c?.code} readOnly={!!c} placeholder="LAUNCH20" style={{ textTransform: "uppercase" }} />
          <span className="note">Letters, numbers, - and _. Not case-sensitive.</span></label>
        <label className="fld">Discount (%)
          <input name="percent" type="number" required min={1} max={DISCOUNT_CODE_MAX_PERCENT} step={1} defaultValue={c?.percent ?? 10} />
          <span className="note">1–{DISCOUNT_CODE_MAX_PERCENT}%, off the price at checkout.</span></label>
        <label className="fld">Usage limit
          <input name="max_uses" type="number" min={1} step={1} defaultValue={c?.max_uses ?? ""} placeholder="No limit" />
          <span className="note">Total paid orders allowed. Empty = unlimited.</span></label>
      </div>
      <div className="grid3">
        <label className="fld">Starts (optional)<input name="starts" type="date" defaultValue={lagosYmd(c?.starts_at ?? null)} /></label>
        <label className="fld">Ends (optional)<input name="ends" type="date" defaultValue={lagosYmd(c?.ends_at ?? null)} /><span className="note">Valid until the end of this day (Lagos time).</span></label>
        <label className="fld">Note (only admins see it)<input name="note" maxLength={300} defaultValue={c?.note ?? ""} placeholder="e.g. Launch week, UNILAG I2M class" /></label>
      </div>
      <fieldset className="stack" style={{ border: "1.5px solid var(--line)", borderRadius: 12, padding: 12, gap: 8 }}>
        <legend className="note">Applies to</legend>
        <label className="check"><input type="checkbox" name="platform" defaultChecked={c ? c.platform !== false : true} /> <span><b>Automancy&apos;s own products</b> (tick products below, or none for all of them)</span></label>
        <div className="row" style={{ paddingLeft: 26 }}>{PAID.map(p => (
          <label key={p.id} className="check"><input type="checkbox" name="products" value={p.id} defaultChecked={!!c?.products?.includes(p.id)} /> <span>{p.name}</span></label>
        ))}</div>
        <label className="check"><input type="checkbox" name="all_courses" defaultChecked={!!c?.all_courses} /> <span><b>Every creator course whose creator allows promotions</b> (platform-wide)</span></label>
        <label className="fld">Or one creator course only
          <select name="course_id" defaultValue={c?.course_id || ""}>
            <option value="">None</option>
            {courses.map(x => <option key={x.id} value={x.id}>{x.title}</option>)}
          </select>
          <span className="note">Only courses whose creator has switched on &ldquo;Automancy promotions&rdquo; are listed.</span></label>
      </fieldset>
      <label className="check"><input type="checkbox" name="once_per_user" defaultChecked={c ? c.once_per_user : true} /> <span>One use per learner</span></label>
      {c && <label className="check"><input type="checkbox" name="active" defaultChecked={c.active} /> <span>Active</span></label>}
    </>
  );
}

type Audit = { id: number; actor: string | null; detail: { changed?: string[]; before?: Record<string, unknown>; after?: Record<string, unknown> } | null; at: string };

export default async function AdminSettings({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const s = await getSettings();
  let log: Audit[] = [];
  const names: Record<string, string> = {};
  try {
    const db = createAdminClient();
    const { data } = await db.from("audit_log").select("id, actor, detail, at").eq("action", "settings.update").order("at", { ascending: false }).limit(10);
    log = (data || []) as Audit[];
    const ids = [...new Set(log.map(l => l.actor).filter((x): x is string => !!x))];
    if (ids.length) {
      const { data: ps } = await db.from("profiles").select("id, full_name, email").in("id", ids);
      (ps || []).forEach(p => { names[p.id] = p.full_name || p.email; });
    }
  } catch { /* no database yet */ }

  let codes: Code[] = [];
  let optCourses: OptCourse[] = [];
  const courseTitles = new Map<string, string>();
  try {
    const db = createAdminClient();
    const [{ data: cs }, { data: rs }] = await Promise.all([
      db.from("discount_codes").select("code, percent, active, products, starts_at, ends_at, max_uses, once_per_user, note, created_at, platform, all_courses, course_id, owner_id").order("created_at", { ascending: false }).limit(200),
      db.from("discount_redemptions").select("code, discount_kobo, currency").limit(20000)
    ]);
    const uses = new Map<string, number>(), given = new Map<string, number>();
    (rs || []).forEach(r => { const k = String(r.code); uses.set(k, (uses.get(k) || 0) + 1); if (r.currency === "NGN") given.set(k, (given.get(k) || 0) + Number(r.discount_kobo || 0)); });
    codes = ((cs || []) as Omit<Code, "uses" | "given">[]).map(c => ({ ...c, uses: uses.get(c.code) || 0, given: given.get(c.code) || 0 }));
    const { data: crs } = await db.from("courses").select("id, title, allow_discounts, status").limit(500);
    (crs || []).forEach(x => courseTitles.set(String(x.id), String(x.title)));
    optCourses = (crs || []).filter(x => x.allow_discounts && x.status === "live").map(x => ({ id: String(x.id), title: String(x.title) }));
  } catch { /* table not created yet: run 0011_discount_codes.sql */ }

  return (
    <>
      <h1 style={{ fontSize: "2rem" }}>Settings</h1>
      {sp.saved && <p className="alert ok" role="status">Settings saved. Public pages update within a few minutes.</p>}
      {sp.error && <p className="alert bad" role="alert">{sp.error}</p>}
      <form action={saveSettings} className="card stack">
        <label className="check"><input type="checkbox" name="cohort_open" defaultChecked={!!s.cohort_open} />
          <span><b>Cohort open.</b> Shows the Cohort plan on the landing and pricing pages and lets people buy a seat. When off, they can only join the waitlist.</span></label>
        <label className="fld" style={{ maxWidth: 260 }}>Next cohort start date
          <input type="date" name="next_cohort_date" defaultValue={s.next_cohort_date || ""} />
          <span className="note">Shown on the pricing page. Leave empty for &ldquo;join the waitlist&rdquo;.</span></label>
        <label className="check"><input type="checkbox" name="live_calls_visible" defaultChecked={!!s.live_calls_visible} />
          <span><b>Live calls visible.</b> Shows live-call links and schedules to cohort learners in the course.</span></label>
        <label className="check"><input type="checkbox" name="ai_review_auto" defaultChecked={!!s.ai_review_auto} />
          <span><b>AI review decides automatically.</b> When off, every AI review waits for a person in Admin → AI reviews before the learner sees the result.</span></label>
        <div className="row"><button className="btn" type="submit">Save settings</button></div>
      </form>

      <section id="discounts" className="stack" style={{ marginTop: 10 }}>
        <h2 style={{ fontSize: "1.3rem" }}>Discount codes</h2>
        <p className="muted">Create a code and set its percentage off. Learners type it in the &ldquo;Discount code&rdquo; box at checkout, or you share a link that fills it in. It doesn&apos;t stack with a friend&apos;s referral discount (the bigger one applies), and with Pay in 3 it applies to every instalment. A code can also cover creator courses, but only those whose creator has agreed (&ldquo;Automancy promotions&rdquo; in their studio); creators can also make their own codes for their own courses, which appear here too.</p>
        {sp.code_saved && <p className="alert ok" role="status">Saved {sp.code_saved}.</p>}
        {sp.code_deleted && <p className="alert ok" role="status">Deleted {sp.code_deleted}.</p>}
        {sp.code_error && <p className="alert bad" role="alert">{sp.code_error}</p>}
        <details className="card" open={codes.length === 0}>
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>New discount code</summary>
          <form action={saveDiscountCode} className="stack" style={{ marginTop: 12 }}>
            <input type="hidden" name="is_new" value="1" />
            <CodeFields courses={optCourses} />
            <div className="row"><button className="btn" type="submit">Create code</button></div>
          </form>
        </details>
        {codes.length === 0 ? <p className="empty">No discount codes yet.</p> : (
          <div className="scroll"><table className="dt">
            <thead><tr><th>Code</th><th>Off</th><th>Status</th><th>Used</th><th>Discount given</th><th>Applies to</th><th>Dates</th><th></th></tr></thead>
            <tbody>{codes.map(c => { const [label, tone] = codeState(c); return (
              <tr key={c.code}>
                <td><b><code>{c.code}</code></b>{c.note && <div className="note">{c.note}</div>}</td>
                <td>{c.percent}%</td>
                <td><span className={`pill ${tone}`}>{label}</span></td>
                <td>{c.uses}{c.max_uses != null ? ` / ${c.max_uses}` : ""}{c.once_per_user ? <div className="note">once each</div> : null}</td>
                <td>{moneyText(c.given, "NGN")}</td>
                <td>{[
                  c.platform !== false && !c.course_id ? (c.products?.length ? c.products.map(id => PRODUCTS.find(p => p.id === id)?.name || id).join(", ") : "All Automancy products") : null,
                  c.all_courses ? "All opted-in creator courses" : null,
                  c.course_id ? `Course: ${courseTitles.get(c.course_id) || "unknown"}${c.owner_id ? " (creator's code)" : ""}` : null
                ].filter(Boolean).join(" · ")}</td>
                <td className="note">{c.starts_at ? `from ${fmtDate(c.starts_at)}` : ""}{c.starts_at && c.ends_at ? " " : ""}{c.ends_at ? `until ${fmtDate(c.ends_at)}` : (!c.starts_at ? "No end date" : "")}</td>
                <td>
                  <div className="row" style={{ gap: 6 }}>
                    <form action={toggleDiscountCode}><input type="hidden" name="code" value={c.code} /><input type="hidden" name="active" value={c.active ? "0" : "1"} /><button className="btn alt sm" type="submit">{c.active ? "Switch off" : "Switch on"}</button></form>
                    {c.uses === 0 && <form action={deleteDiscountCode}><input type="hidden" name="code" value={c.code} /><button className="btn alt sm" type="submit">Delete</button></form>}
                  </div>
                  {!c.owner_id && <details style={{ marginTop: 6 }}><summary className="note" style={{ cursor: "pointer" }}>Edit · share link</summary>
                    <p className="note" style={{ margin: "6px 0" }}>Share: <code>{`${SITE_URL}/checkout/${c.products?.[0] || "self"}?code=${c.code}`}</code></p>
                    <form action={saveDiscountCode} className="stack" style={{ marginTop: 8, minWidth: 320 }}>
                      <CodeFields c={c} courses={optCourses} />
                      <div className="row"><button className="btn sm" type="submit">Save {c.code}</button></div>
                    </form>
                  </details>}
                </td>
              </tr>
            ); })}</tbody>
          </table></div>
        )}
      </section>

      <h2 style={{ fontSize: "1.3rem", marginTop: 10 }}>Recent changes</h2>
      {log.length === 0 ? <p className="empty">No changes recorded yet.</p> : (
        <div className="scroll"><table className="dt">
          <thead><tr><th>When</th><th>Who</th><th>Changed</th></tr></thead>
          <tbody>{log.map(l => (
            <tr key={l.id}>
              <td>{fmtDate(l.at)}</td>
              <td>{(l.actor && names[l.actor]) || "Admin"}</td>
              <td>{(l.detail?.changed || []).map(k => <div key={k}><code>{k}</code>: {String(l.detail?.before?.[k] ?? "–")} → {String(l.detail?.after?.[k] ?? "–")}</div>)}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </>
  );
}
