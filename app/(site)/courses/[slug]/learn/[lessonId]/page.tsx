import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { flatLessons, getCourseBySlug, getCurriculum, getRole, isEnrolled, progressFor, type Lesson } from "@/lib/marketplace";
import { markLessonDone } from "@/lib/actions/marketplace";
import { KIND_LABEL, normaliseQuiz, type LessonKind } from "../../../_lib/core";
import { Markdown, VideoEmbed } from "../../../_components/Markdown";
import { QuizPlayer } from "../../../_components/QuizPlayer";
import "../../../marketplace.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Lesson", robots: { index: false } };
type Props = { params: Promise<{ slug: string; lessonId: string }> };

export default async function LearnLesson({ params }: Props) {
  const { slug, lessonId } = await params;
  const user = await requireUser(`/courses/${slug}/learn/${lessonId}`);
  const c = await getCourseBySlug(slug);
  if (!c || !/^[0-9a-f-]{36}$/i.test(lessonId)) notFound();

  const [enrolled, role] = await Promise.all([isEnrolled(user.id, c.id), getRole(user.id)]);
  const preview = c.creator_id === user.id || role === "admin";
  const { data: row } = await createAdminClient().from("course_lessons").select("*").eq("id", lessonId).eq("course_id", c.id).maybeSingle();
  const lesson = row as Lesson | null;
  if (!lesson) notFound();
  const freePreview = lesson.free_preview && c.status === "live";
  if (!enrolled && !preview && !freePreview) redirect(`/courses/${c.slug}#buy`);
  if (!enrolled && !preview && c.status !== "live") notFound();

  const curriculum = await getCurriculum(c.id, false);
  const all = flatLessons(curriculum);
  const progress = enrolled ? await progressFor(user.id, c.id) : new Map<string, { done: boolean; quiz_score: number | null }>();
  const canOpen = (l: { free_preview: boolean }) => enrolled || preview || (l.free_preview && c.status === "live");
  const idx = all.findIndex(l => l.id === lesson.id);
  const prev = all.slice(0, idx).reverse().find(canOpen);
  const next = all.slice(idx + 1).find(canOpen);
  const done = all.filter(l => progress.get(l.id)?.done).length;
  const pct = all.length ? Math.round(done / all.length * 100) : 0;
  const me = progress.get(lesson.id);
  const quiz = lesson.kind === "quiz" ? (() => { const q = normaliseQuiz(lesson.quiz); return q.ok ? q.quiz : []; })() : [];

  return (
    <div className="wrap mk-learn">
      <nav aria-label="Course lessons">
        <Link href={`/courses/${c.slug}`} className="note">← {c.title}</Link>
        {enrolled && <>
          <div className="mk-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Course progress"><span style={{ width: `${pct}%` }} /></div>
          <p className="note">{done} of {all.length} lessons done ({pct}%)</p>
        </>}
        <details open>
          <summary className="note" style={{ cursor: "pointer" }}>All lessons</summary>
          {curriculum.map(s => (
            <div key={s.id} style={{ marginTop: 8 }}>
              <p className="eyebrow">{s.title}</p>
              <ol>{s.lessons.map(l => {
                const ok = canOpen(l);
                const d = progress.get(l.id)?.done;
                return (
                  <li key={l.id}>
                    {ok
                      ? <Link href={`/courses/${c.slug}/learn/${l.id}`} aria-current={l.id === lesson.id ? "page" : undefined}><span aria-hidden="true">{d ? "✓" : "○"}</span><span>{l.title}</span></Link>
                      : <a className="lock" href={`/courses/${c.slug}#buy`}><span aria-hidden="true">🔒</span><span>{l.title}</span></a>}
                  </li>
                );
              })}</ol>
            </div>
          ))}
        </details>
      </nav>

      <article className="stack" style={{ gap: 18, minWidth: 0 }}>
        {preview && !enrolled && <p className="mk-banner">Preview as learner{c.status !== "live" ? ` · course status: ${c.status.replace("_", " ")}` : ""}. Progress isn't saved.</p>}
        {!enrolled && !preview && <p className="mk-banner">Free preview. <Link href={`/courses/${c.slug}#buy`}>Get the full course</Link></p>}
        <header className="stack" style={{ gap: 6 }}>
          <p className="eyebrow">{KIND_LABEL[lesson.kind as LessonKind]}{lesson.minutes ? ` · ${lesson.minutes} min` : ""}</p>
          <h1 style={{ fontSize: "clamp(1.7rem,4.5vw,2.5rem)" }}>{lesson.title}</h1>
        </header>

        {lesson.kind === "video" && <VideoEmbed url={lesson.video_url} title={lesson.title} />}
        <Markdown source={lesson.body_md} />
        {lesson.kind === "task" && lesson.task && (
          <div className="card bold">
            <p className="eyebrow">Your task</p>
            <p style={{ whiteSpace: "pre-line" }}>{lesson.task}</p>
          </div>
        )}
        {lesson.kind === "quiz" && (quiz.length
          ? <QuizPlayer lessonId={lesson.id} questions={quiz.map(q => ({ q: q.q, options: q.options }))} best={me?.quiz_score ?? null} canSave={enrolled} />
          : <p className="empty">This quiz has no questions yet.</p>)}

        {enrolled && lesson.kind !== "quiz" && (
          <form action={markLessonDone} className="row">
            <input type="hidden" name="lesson_id" value={lesson.id} />
            {me?.done ? (
              <><span className="pill ok">Done</span><input type="hidden" name="done" value="0" /><button className="btn alt sm" type="submit">Mark as not done</button></>
            ) : (
              <><input type="hidden" name="done" value="1" />{next && <input type="hidden" name="next" value={next.id} />}
                <button className="btn" type="submit">{lesson.kind === "task" ? "I've done the task" : "Mark as done"}{next ? " and continue" : ""}</button></>
            )}
          </form>
        )}

        <div className="mk-pager">
          {prev ? <Link className="btn alt sm" href={`/courses/${c.slug}/learn/${prev.id}`}>← {prev.title}</Link> : <span />}
          {next ? <Link className="btn alt sm" href={`/courses/${c.slug}/learn/${next.id}`}>{next.title} →</Link>
            : enrolled ? <Link className="btn sm" href={`/courses/${c.slug}#reviews`}>Finish: rate the course</Link> : <span />}
        </div>
      </article>
    </div>
  );
}
