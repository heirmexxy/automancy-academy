import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { fmtDate } from "@/lib/format";
import { itemById } from "@/lib/course";
import { getTierSpec } from "@/lib/reviewer";
import { TIER_LABEL, isBossSpec, type Criterion, type ReviewResult, type Tier } from "@/lib/reviewer-core";
import { clearReviewFlag, overrideReview, rerunReview } from "@/lib/actions/reviews";

export const metadata: Metadata = { title: "Review · Admin" };
export const dynamic = "force-dynamic";

type AiStored = Partial<ReviewResult> & { meta?: { model?: string; at?: string; similarity?: number; input_tokens?: number; output_tokens?: number }; queued?: string; error?: string };

const safeHref = (u: string) => { try { const x = new URL(u); return x.protocol === "https:" || x.protocol === "http:" ? x.toString() : null; } catch { return null; } };

function Checks({ list }: { list: Criterion[] }) {
  return (
    <ul className="stack" style={{ gap: 6, paddingLeft: 18 }}>
      {list.map((c, i) => <li key={i}><span className={`pill ${c.met ? "ok" : "bad"}`}>{c.met ? "met" : "not met"}</span> <b>{c.name}</b>{c.note ? <> · <span className="muted">{c.note}</span></> : null}</li>)}
    </ul>
  );
}

export default async function AdminReview({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = createAdminClient();
  const { data: s } = await db.from("submissions").select("*").eq("id", id).maybeSingle();
  if (!s) notFound();
  const [{ data: p }, { data: reviewer }, { data: history }] = await Promise.all([
    db.from("profiles").select("email, full_name").eq("id", s.user_id).single(),
    s.reviewed_by ? db.from("profiles").select("email").eq("id", s.reviewed_by).single() : Promise.resolve({ data: null }),
    db.from("submissions").select("id, status, score, created_at").eq("user_id", s.user_id).eq("item_id", s.item_id).eq("tier", s.tier).order("created_at", { ascending: false }).limit(10)
  ]);
  const ai = (s.ai_result || {}) as AiStored;
  const item = itemById(s.item_id);
  const spec = getTierSpec(s.item_id, s.tier as Tier);

  return (
    <div className="stack">
      <p><Link href="/admin/reviews">← Review queue</Link></p>
      {sp.error && <p className="alert bad">{sp.error}</p>}
      {sp.notice && <p className="alert ok">{sp.notice}</p>}
      <div>
        <p className="eyebrow">{TIER_LABEL[s.tier as Tier] || s.tier} · {s.item_id}</p>
        <h1>{item?.title.replace(/&amp;/g, "&")}{spec && !isBossSpec(spec) ? ` · ${spec.title}` : ""}</h1>
        <p className="muted">{p?.full_name || "—"} ({p?.email}) · submitted {fmtDate(s.created_at)} · status <b>{s.status}</b>{s.score !== null ? ` · ${s.score}/100` : ""}{s.needs_human ? " · needs a person" : ""}{reviewer?.email ? ` · last decision by ${reviewer.email}` : ""}</p>
      </div>

      <div className="grid2">
        <section className="card stack" style={{ minWidth: 0 }}>
          <h3>Submission</h3>
          <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxHeight: 560, overflow: "auto", margin: 0, fontFamily: "var(--mono)", fontSize: ".85rem" }}>{s.content}</pre>
          <div>
            <b>Links</b> <span className="note">(stored for spot-checks; the AI doesn&apos;t open them)</span>
            {(s.links || []).length ? (
              <ul>{(s.links as string[]).map((l, i) => { const h = safeHref(l); return <li key={i}>{h ? <a href={h} target="_blank" rel="noopener noreferrer nofollow">{l}</a> : l}</li>; })}</ul>
            ) : <p className="muted">None.</p>}
          </div>
        </section>

        <section className="card stack" style={{ minWidth: 0 }}>
          <h3>AI result</h3>
          {ai.queued && <p className="alert warn">Not marked by AI: {ai.queued.replace(/_/g, " ")}{ai.error ? ` (${ai.error})` : ""}.</p>}
          {ai.verdict && <p><span className={`pill ${ai.verdict === "accept" ? "ok" : "warn"}`}>{ai.verdict}</span> <b>{ai.score}/100</b>{ai.meta?.model ? <span className="note"> · {ai.meta.model}{ai.meta.at ? `, ${fmtDate(ai.meta.at)}` : ""}{typeof ai.meta.similarity === "number" && ai.meta.similarity > 0 ? ` · model-answer overlap ${Math.round(ai.meta.similarity * 100)}%` : ""}</span> : null}</p>}
          {ai.human_reason && <p className="alert warn">Why flagged: {ai.human_reason}</p>}
          {!!ai.flags?.length && <p className="note">Flags: {ai.flags.join(" · ")}</p>}
          {ai.feedback && <p>{ai.feedback}</p>}
          {!!ai.rubric?.length && (
            <div className="scroll"><table className="dt"><thead><tr><th>Area</th><th className="n">Points</th><th>Note</th></tr></thead>
              <tbody>{ai.rubric.map((r, i) => <tr key={i}><td>{r.area}</td><td className="n">{r.points}/{r.max}</td><td><small>{r.note}</small></td></tr>)}</tbody></table></div>
          )}
          {!!ai.must_haves?.length && <><b>Must-haves</b><Checks list={ai.must_haves} /></>}
          {!ai.rubric?.length && !!ai.criteria?.length && <><b>Criteria</b><Checks list={ai.criteria} /></>}
          {!!ai.strengths?.length && <><b>Strengths</b><ul>{ai.strengths.map((x, i) => <li key={i}>{x}</li>)}</ul></>}
          {!!ai.fixes?.length && <><b>Fixes</b><ul>{ai.fixes.map((x, i) => <li key={i}>{x}</li>)}</ul></>}
          {s.reviewer_note && <p className="alert ok">Reviewer note (shown to the learner): {s.reviewer_note}</p>}
        </section>
      </div>

      <section className="card stack">
        <h3>Decide</h3>
        <form action={overrideReview} className="stack">
          <input type="hidden" name="id" value={s.id} />
          <div className="row" style={{ flexWrap: "wrap", gap: 8, alignItems: "end" }}>
            <label className="fld">Verdict
              <select name="status" defaultValue={s.status === "pending" ? (ai.verdict === "accept" ? "accepted" : "revise") : s.status}>
                <option value="accepted">Accept</option><option value="revise">Revise (resubmit)</option><option value="rejected">Reject</option><option value="pending">Back to pending</option>
              </select>
            </label>
            <label className="fld">Score (0–100)<input name="score" type="number" min={0} max={100} defaultValue={s.score ?? ""} /></label>
          </div>
          <label className="fld">Note to the learner (required unless accepting)<textarea name="note" rows={3} maxLength={2000} defaultValue={s.reviewer_note || ""} placeholder="Plain, warm, specific: what you saw and what to do next." /></label>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}><button className="btn" type="submit">Save decision</button></div>
        </form>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {s.needs_human && <form action={clearReviewFlag}><input type="hidden" name="id" value={s.id} /><button className="btn alt sm" type="submit">AI was right: clear the flag</button></form>}
          <form action={rerunReview}><input type="hidden" name="id" value={s.id} /><button className="btn alt sm" type="submit">Re-run the AI review</button></form>
        </div>
        <p className="note">Accepted boss and capstone submissions count towards the certificate and mark the mission done in the learner&apos;s course.</p>
      </section>

      {(history || []).length > 1 && (
        <section className="card stack">
          <h3>This learner&apos;s attempts at this mission</h3>
          <ul>{(history || []).map(h => <li key={h.id}>{h.id === s.id ? <b>this one</b> : <Link href={`/admin/reviews/${h.id}`}>{fmtDate(h.created_at)}</Link>} · {h.status}{h.score !== null ? ` · ${h.score}` : ""}</li>)}</ul>
        </section>
      )}
    </div>
  );
}
