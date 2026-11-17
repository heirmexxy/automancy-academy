import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { fmtDate, ngn, usd } from "@/lib/format";
import { flatLessons, getCourse, getCreator, getCurriculum } from "@/lib/marketplace";
import { adminApproveCourse, adminRunCourseAgent, adminHideReview, adminRejectCourse, adminRequestChanges, adminSetFree, adminSetListing } from "@/lib/actions/marketplace";
import { KIND_LABEL, STANDARDS, STATUS_LABEL, normaliseQuiz, statusTone, submitProblems, type LessonKind } from "../../../courses/_lib/core";
import { Markdown, VideoEmbed } from "../../../courses/_components/Markdown";
import "../../../courses/marketplace.css";
import { latestAgentRun } from "@/lib/course-agent";
import { DECISION_LABEL } from "@/lib/course-agent-rules";

export const metadata: Metadata = { title: "Admin · Review course" };
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> };

export default async function ReviewCourse({ params, searchParams }: Props) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const c = await getCourse(id);
  if (!c) notFound();
  const [agent, creator, curriculum, { data: reviews }, { data: prof }] = await Promise.all([
    latestAgentRun(c.id).catch(() => null),
    getCreator(c.creator_id), getCurriculum(c.id, true),
    createAdminClient().from("course_reviews").select("id, rating, body, hidden, created_at").eq("course_id", c.id).order("created_at", { ascending: false }).limit(100),
    createAdminClient().from("profiles").select("email").eq("id", c.creator_id).maybeSingle()
  ]);
  const lessons = flatLessons(curriculum);
  const problems = submitProblems(c, lessons);
  const H = () => <input type="hidden" name="course_id" value={c.id} />;

  return (
    <div className="stack" style={{ gap: 18 }}>
      <p><Link href="/admin/courses?tab=queue">← Review queue</Link></p>
      <header className="stack" style={{ gap: 6 }}>
        <div className="row"><span className={`pill ${statusTone(c.status)}`}>{STATUS_LABEL[c.status]}</span>{c.changes_pending && <span className="pill warn">Changes pending</span>}{c.is_free && <span className="pill ok">Free</span>}</div>
        <h1 style={{ fontSize: "2rem" }}>{c.title}</h1>
        {c.subtitle && <p className="lede">{c.subtitle}</p>}
        <p className="note">By {creator?.display_name} ({String(prof?.email || "")}) · {c.category || "no category"} · {c.level} · {c.language} · {c.is_free ? "Free" : ngn(c.price_ngn)}{c.price_usd ? ` / ${usd(Number(c.price_usd))}` : ""} · submitted {c.submitted_at ? fmtDate(c.submitted_at) : "-"} · <Link href={`/courses/${c.slug}`}>sales page preview</Link></p>
      </header>
      {sp.error && <p className="alert bad" role="alert">{sp.error}</p>}
      {sp.saved && <p className="alert ok" role="status">Saved.</p>}
      {problems.length > 0 && <div className="alert warn"><b>Automatic checks:</b><ul className="mk-problems">{problems.map(p => <li key={p}>{p}</li>)}</ul></div>}
      {c.review_note && <p className="alert">Last note to creator: {c.review_note}</p>}

      <div id="agent" className="card stack">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: "1.2rem" }}>Course Review Agent</h2>
          <form action={adminRunCourseAgent}><H /><button className="btn alt sm" type="submit">{agent ? "Run again" : "Run the agent"}</button></form>
        </div>
        {sp.agent && <p className="alert ok" role="status">The agent has re-checked this course (recommendation only; nothing was changed).</p>}
        {!agent ? <p className="note">The agent hasn&apos;t checked this course yet. It runs automatically when a creator submits.</p> : <>
          <p>
            <span className={`pill ${agent.report.decision === "approve" ? "ok" : agent.report.decision === "reject" ? "bad" : "warn"}`}>{DECISION_LABEL[agent.report.decision]}</span>{" "}
            {agent.applied ? <b>Applied automatically</b> : <span className="note">Recommendation</span>}
            <span className="note"> · {fmtDate(agent.at)} · {agent.report.stats.lessons} lessons, {agent.report.stats.practical} tasks/quizzes, {agent.report.stats.videos} videos, {agent.report.stats.words.toLocaleString("en-NG")} words · AI read: {agent.ai === "used" ? "yes" : agent.ai === "failed" ? "failed (rules only)" : "off (no Anthropic key)"}</span>
          </p>
          {agent.report.findings.length === 0 ? <p className="note">Every rule passed.</p> : (
            <ul className="mk-problems">{agent.report.findings.map((f, i) => (
              <li key={i}><span className={`pill ${f.severity === "reject" ? "bad" : f.severity === "changes" ? "warn" : ""}`}>{f.severity === "person" ? "check" : f.severity}</span> <b>{STANDARDS.find(x => x.key === f.standard)?.title || f.standard}:</b> {f.message}{f.where ? <span className="note"> ({f.where})</span> : null}</li>
            ))}</ul>
          )}
          {agent.report.passed.length > 0 && <p className="note">Passed: {agent.report.passed.map(k => STANDARDS.find(x => x.key === k)?.title || k).join(", ")}.</p>}
          <p className="note">The agent checks the rules a machine can check reliably. You still decide anything marked &ldquo;check&rdquo;, and you can always override it below.</p>
        </>}
      </div>

      <div className="card bold stack">
        <h2 style={{ fontSize: "1.2rem" }}>Decision</h2>
        <p className="note">Read every lesson and watch the videos below, then tick each <Link href="/teach/standards" target="_blank">standard</Link>. All must be ticked to approve; if one fails, request changes and say which.</p>
        <form action={adminApproveCourse} className="stack"><H />
          <fieldset className="stack" style={{ border: "1.5px solid var(--line)", borderRadius: 12, padding: 12, gap: 8 }}>
            <legend className="note">Reviewer checklist</legend>
            {STANDARDS.map(st => (
              <label key={st.key} className="check"><input type="checkbox" name={`std_${st.key}`} required /> <span><b>{st.title}.</b> {st.check}</span></label>
            ))}
          </fieldset>
          <label className="fld">Note to creator (optional)<input name="note" maxLength={4000} /></label>
          {problems.length > 0 && <label className="check"><input type="checkbox" name="override" /> <span>Approve anyway (automatic checks failed)</span></label>}
          <button className="btn" type="submit" style={{ justifySelf: "start" }}>{c.status === "live" ? "Approve changes" : "Approve and publish"}</button>
        </form>
        <form action={adminRequestChanges} className="stack"><H />
          <label className="fld">What needs to change (emailed to the creator)<textarea name="note" maxLength={4000} required minLength={10} style={{ minHeight: 90 }} /></label>
          <div className="row">
            <button className="btn alt" type="submit">Request changes</button>
            <button className="btn alt" type="submit" formAction={adminRejectCourse}>{c.status === "live" ? "Reject and unlist" : "Reject"}</button>
          </div>
        </form>
        <div className="row">
          {(c.status === "live" || c.status === "unlisted") && (
            <form action={adminSetListing}><H /><input type="hidden" name="to" value={c.status === "live" ? "unlisted" : "live"} /><button className="btn alt sm" type="submit">{c.status === "live" ? "Unlist" : "Relist"}</button></form>
          )}
          <form action={adminSetFree}><H /><input type="hidden" name="free" value={c.is_free ? "0" : "1"} /><button className="btn alt sm" type="submit">{c.is_free ? "Make paid again" : "Make this course free"}</button></form>
        </div>
      </div>

      <div className="card stack">
        <h2 style={{ fontSize: "1.2rem" }}>Description</h2>
        {c.cover_url && <div className="mk-cover" style={{ maxWidth: 420 }}><img src={c.cover_url} alt="Cover" referrerPolicy="no-referrer" /></div>}
        <Markdown source={c.description} />
      </div>

      {curriculum.map(s => (
        <div key={s.id} className="stack">
          <h2 style={{ fontSize: "1.3rem" }}>{s.title}</h2>
          {s.lessons.map(l => {
            const quiz = l.kind === "quiz" ? normaliseQuiz(l.quiz) : null;
            return (
              <details key={l.id} className="card" open>
                <summary style={{ cursor: "pointer" }}><span className="pill">{KIND_LABEL[l.kind as LessonKind]}</span> <b>{l.title}</b> {l.free_preview && <span className="pill ok">Preview</span>} <span className="note">{l.minutes} min</span></summary>
                <div className="stack" style={{ marginTop: 10 }}>
                  {l.kind === "video" && <><VideoEmbed url={l.video_url} title={l.title} /><p className="note">Link: {l.video_url}</p></>}
                  <Markdown source={l.body_md} />
                  {l.kind === "task" && <p style={{ whiteSpace: "pre-line" }}><b>Task:</b> {l.task}</p>}
                  {quiz && (quiz.ok ? <ol>{quiz.quiz.map((q, i) => <li key={i}>{q.q}<ul>{q.options.map((o, j) => <li key={j}>{o}{j === q.answer ? " ✓" : ""}</li>)}</ul></li>)}</ol> : <p className="alert bad">Quiz data is invalid.</p>)}
                </div>
              </details>
            );
          })}
        </div>
      ))}

      <div className="stack" id="reviews">
        <h2 style={{ fontSize: "1.3rem" }}>Learner reviews</h2>
        {(reviews || []).length ? (reviews || []).map(r => (
          <div key={r.id as string} className="card row" style={{ justifyContent: "space-between" }}>
            <div><b>{"★".repeat(r.rating as number)}</b> <span className="note">{fmtDate(r.created_at as string)}</span>{r.hidden ? <span className="pill bad"> hidden</span> : null}<p style={{ whiteSpace: "pre-line" }}>{String(r.body || "")}</p></div>
            <form action={adminHideReview}><H /><input type="hidden" name="review_id" value={r.id as string} /><input type="hidden" name="hidden" value={r.hidden ? "0" : "1"} /><button className="btn alt sm" type="submit">{r.hidden ? "Show" : "Hide"}</button></form>
          </div>
        )) : <p className="muted">No reviews.</p>}
      </div>
    </div>
  );
}
