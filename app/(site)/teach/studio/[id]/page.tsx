import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { flatLessons, getCourse, getCreator, getCurriculum } from "@/lib/marketplace";
import {
  addLesson, addSection, deleteCourse, deleteLesson, deleteSection, moveLesson, moveSection, renameSection,
  saveCourseDetails, submitCourse, withdrawCourse
} from "@/lib/actions/marketplace";
import { CATEGORIES, KIND_LABEL, LESSON_KINDS, LEVELS, MARKET, STATUS_LABEL, isEditable, lessonProblem, statusTone, submitProblems, type LessonKind } from "../../../courses/_lib/core";
import "../../../courses/marketplace.css";

export const metadata: Metadata = { title: "Edit course" };
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> };

const Hidden = ({ id }: { id: string }) => <input type="hidden" name="course_id" value={id} />;

export default async function EditCourse({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/teach/studio/${id}`);
  const creator = await getCreator(user.id);
  if (!creator || creator.status !== "approved") redirect("/teach/apply");
  const c = await getCourse(id);
  if (!c || c.creator_id !== user.id) notFound();
  const curriculum = await getCurriculum(c.id, true);
  const lessons = flatLessons(curriculum);
  const problems = submitProblems(c, lessons);
  const editable = isEditable(c.status);
  const published = !!c.published_at || c.status === "live";
  const canSubmit = ["draft", "changes_requested", "unlisted"].includes(c.status) || (c.status === "live" && !c.changes_pending);

  return (
    <section className="wrap stack" style={{ gap: 18 }}>
      <p><Link href="/teach/studio">← All courses</Link></p>
      <header className="stack" style={{ gap: 8 }}>
        <div className="row"><span className={`pill ${statusTone(c.status)}`}>{STATUS_LABEL[c.status]}</span>{c.changes_pending && <span className="pill warn">Changes in review</span>}</div>
        <h1 style={{ fontSize: "clamp(1.8rem,5vw,2.5rem)" }}>{c.title}</h1>
        <div className="row">
          <Link className="btn alt sm" href={`/courses/${c.slug}`}>Preview as learner</Link>
          {c.status === "live" && <Link className="btn alt sm" href={`/courses/${c.slug}`}>View live page</Link>}
        </div>
      </header>

      {sp.error && <p className="alert bad" role="alert">{sp.error}</p>}
      {sp.submitted && <p className="alert ok" role="status">Submitted. We review courses in about {MARKET.reviewDays} working days and will email you.</p>}
      {sp.withdrawn && <p className="alert ok" role="status">Withdrawn from review. You can edit again.</p>}
      {c.review_note && (c.status === "changes_requested" || c.status === "rejected" || c.status === "unlisted" || c.status === "live") && (
        <div className={`alert ${c.status === "rejected" ? "bad" : "warn"}`}><b>Reviewer's note:</b> <span style={{ whiteSpace: "pre-line" }}>{c.review_note}</span></div>
      )}
      {c.status === "submitted" && (
        <div className="alert warn row" style={{ justifyContent: "space-between" }}>
          <span>In review since {c.submitted_at ? fmtDate(c.submitted_at) : "recently"}. Editing is locked while we review.</span>
          <form action={withdrawCourse}><Hidden id={c.id} /><button className="btn alt sm" type="submit">Withdraw to edit</button></form>
        </div>
      )}
      {c.status === "live" && <p className="note">This course is live. Changes you save appear straight away and go back into our review queue; we may ask you to fix or undo them.</p>}

      {/* Submit panel */}
      <div className="card bold" id="submit">
        <h2 style={{ fontSize: "1.3rem" }}>{c.status === "live" ? "Review" : "Submit for review"}</h2>
        <p className="note">We review every course against the <Link href="/teach/standards">standards and specifications</Link>.</p>
        {problems.length ? (
          <><p>Before you can submit:</p><ul className="mk-problems">{problems.map(p => <li key={p}>{p}</li>)}</ul></>
        ) : <p className="muted">Everything we check automatically looks good.</p>}
        {canSubmit && (
          <form action={submitCourse} className="stack"><Hidden id={c.id} />
            <label className="check"><input type="checkbox" name="standards" required /> <span>I&apos;ve previewed the whole course and it meets the <Link href="/teach/standards" target="_blank">standards and specifications</Link>, and it&apos;s my own original work.</span></label>
            <button className="btn" type="submit" disabled={problems.length > 0}>{c.status === "live" ? "Send my changes for review" : "Submit for review"}</button>
          </form>
        )}
      </div>

      {/* Details */}
      <form action={saveCourseDetails} className="card stack" id="details">
        <h2 style={{ fontSize: "1.3rem" }}>Details</h2>
        {sp.saved === "details" && <p className="alert ok" role="status">Saved.</p>}
        <fieldset disabled={!editable} className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
          <Hidden id={c.id} />
          <label className="fld">Title<input name="title" required minLength={3} maxLength={120} defaultValue={c.title} /></label>
          <label className="fld">Subtitle<input name="subtitle" maxLength={200} defaultValue={c.subtitle || ""} placeholder="One line: what learners will be able to do" /></label>
          <label className="fld">Web address
            <input name="slug" maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={c.slug} readOnly={published} />
            <span className="note">/courses/{c.slug}{published ? " (fixed once published)" : ""}</span>
          </label>
          <label className="fld">Description (markdown: **bold**, *italic*, lists, links)
            <textarea name="description" maxLength={10000} defaultValue={c.description || ""} style={{ minHeight: 200 }} />
            <span className="note">At least {MARKET.minDescription} characters. Say who it's for, what they'll build and what they need.</span>
          </label>
          <div className="grid3">
            <label className="fld">Category
              <select name="category" defaultValue={c.category || ""}><option value="">Choose…</option>{CATEGORIES.map(x => <option key={x} value={x}>{x}</option>)}</select>
            </label>
            <label className="fld">Level
              <select name="level" defaultValue={c.level}>{LEVELS.map(x => <option key={x} value={x}>{x[0].toUpperCase() + x.slice(1)}</option>)}</select>
            </label>
            <label className="fld">Language<input name="language" maxLength={40} defaultValue={c.language} /></label>
          </div>
          <label className="fld">Cover image URL (https, 16:9, at least 1280 × 720 px, under 1 MB)<input name="cover_url" type="url" maxLength={500} defaultValue={c.cover_url || ""} placeholder="https://" /></label>
          <div className="grid2">
            <label className="fld">Price in naira (₦{MARKET.minPriceNgn.toLocaleString("en-NG")}–₦{MARKET.maxPriceNgn.toLocaleString("en-NG")})
              <input name="price_ngn" type="number" inputMode="numeric" min={0} max={MARKET.maxPriceNgn} step={100} defaultValue={c.price_ngn || ""} />
            </label>
            <label className="fld">Price in US dollars (optional, ${MARKET.minPriceUsd}–${MARKET.maxPriceUsd})
              <input name="price_usd" type="number" inputMode="decimal" min={0} max={MARKET.maxPriceUsd} step={0.5} defaultValue={c.price_usd ?? ""} />
            </label>
          </div>
          {c.is_free && <p className="note">An admin has made this course free.</p>}
          <button className="btn" type="submit" style={{ justifySelf: "start" }}>Save details</button>
        </fieldset>
      </form>

      {/* Curriculum */}
      <div className="card stack" id="curriculum">
        <h2 style={{ fontSize: "1.3rem" }}>Curriculum</h2>
        <p className="note">{lessons.length} lessons in {curriculum.length} sections. At least {MARKET.minLessons} lessons to submit. Mark one or two lessons as free previews so people can try before they buy.</p>
        {curriculum.map((s, si) => (
          <div key={s.id} className="mk-sec">
            <div className="mk-sec-h">
              <form action={renameSection}><Hidden id={c.id} /><input type="hidden" name="section_id" value={s.id} />
                <input name="title" aria-label="Section title" defaultValue={s.title} maxLength={120} disabled={!editable} />
                {editable && <button className="btn alt sm" type="submit">Rename</button>}
              </form>
              {editable && <>
                <form action={moveSection}><Hidden id={c.id} /><input type="hidden" name="section_id" value={s.id} /><input type="hidden" name="dir" value="up" /><button className="btn alt sm" type="submit" disabled={si === 0} aria-label="Move section up">↑</button></form>
                <form action={moveSection}><Hidden id={c.id} /><input type="hidden" name="section_id" value={s.id} /><input type="hidden" name="dir" value="down" /><button className="btn alt sm" type="submit" disabled={si === curriculum.length - 1} aria-label="Move section down">↓</button></form>
                <details><summary className="btn alt sm">Delete</summary>
                  <form action={deleteSection} style={{ marginTop: 6 }}><Hidden id={c.id} /><input type="hidden" name="section_id" value={s.id} /><button className="btn sm" type="submit">Delete section and its {s.lessons.length} lessons</button></form>
                </details>
              </>}
            </div>
            {s.lessons.map((l, li) => {
              const problem = lessonProblem(l);
              return (
                <div key={l.id} className="mk-lrow">
                  <span className="pill">{KIND_LABEL[l.kind as LessonKind]}</span>
                  <Link className="t" href={`/teach/studio/${c.id}/lesson/${l.id}`}>{l.title}</Link>
                  {l.free_preview && <span className="pill ok">Preview</span>}
                  {problem && <span className="pill bad" title={problem}>Incomplete</span>}
                  {editable && <>
                    <form action={moveLesson}><Hidden id={c.id} /><input type="hidden" name="lesson_id" value={l.id} /><input type="hidden" name="dir" value="up" /><button className="btn alt sm" type="submit" disabled={li === 0} aria-label={`Move ${l.title} up`}>↑</button></form>
                    <form action={moveLesson}><Hidden id={c.id} /><input type="hidden" name="lesson_id" value={l.id} /><input type="hidden" name="dir" value="down" /><button className="btn alt sm" type="submit" disabled={li === s.lessons.length - 1} aria-label={`Move ${l.title} down`}>↓</button></form>
                    <form action={deleteLesson}><Hidden id={c.id} /><input type="hidden" name="lesson_id" value={l.id} /><button className="btn alt sm" type="submit" aria-label={`Delete ${l.title}`}>Delete</button></form>
                  </>}
                </div>
              );
            })}
            {editable && (
              <form action={addLesson} className="mk-add"><Hidden id={c.id} /><input type="hidden" name="section_id" value={s.id} />
                <input name="title" aria-label="New lesson title" placeholder="New lesson title" maxLength={160} required />
                <select name="kind" aria-label="Lesson type" defaultValue="text">{LESSON_KINDS.map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select>
                <button className="btn alt sm" type="submit">Add lesson</button>
              </form>
            )}
          </div>
        ))}
        {editable && (
          <form action={addSection} className="row"><Hidden id={c.id} />
            <input name="title" aria-label="New section title" placeholder="New section title" maxLength={120} style={{ flex: "1 1 220px", width: "auto" }} />
            <button className="btn alt" type="submit">Add section</button>
          </form>
        )}
      </div>

      {c.status === "draft" && !c.published_at && (
        <details className="card"><summary style={{ cursor: "pointer", fontWeight: 700 }}>Delete this draft</summary>
          <form action={deleteCourse} style={{ marginTop: 10 }}><Hidden id={c.id} /><button className="btn" type="submit">Delete "{c.title}" permanently</button></form>
        </details>
      )}
    </section>
  );
}
