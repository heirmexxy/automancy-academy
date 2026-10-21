import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCourse, getCreator, type Lesson } from "@/lib/marketplace";
import { saveLesson } from "@/lib/actions/marketplace";
import { KIND_LABEL, LESSON_KINDS, MARKET, isEditable, lessonProblem, normaliseQuiz, parseVideo } from "../../../../../courses/_lib/core";
import { Markdown, VideoEmbed } from "../../../../../courses/_components/Markdown";
import { QuizEditor } from "../../../../../courses/_components/QuizEditor";
import "../../../../../courses/marketplace.css";

export const metadata: Metadata = { title: "Edit lesson" };
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string; lessonId: string }>; searchParams: Promise<Record<string, string | undefined>> };

export default async function EditLesson({ params, searchParams }: Props) {
  const { id, lessonId } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/teach/studio/${id}/lesson/${lessonId}`);
  const creator = await getCreator(user.id);
  if (!creator || creator.status !== "approved") redirect("/teach/apply");
  const c = await getCourse(id);
  if (!c || c.creator_id !== user.id || !/^[0-9a-f-]{36}$/i.test(lessonId)) notFound();
  const { data } = await createAdminClient().from("course_lessons").select("*").eq("id", lessonId).eq("course_id", c.id).maybeSingle();
  const l = data as Lesson | null;
  if (!l) notFound();
  const editable = isEditable(c.status);
  const quiz = normaliseQuiz(l.quiz);
  const problem = lessonProblem(l);

  return (
    <section className="wrap stack" style={{ gap: 16 }}>
      <p><Link href={`/teach/studio/${c.id}#curriculum`}>← {c.title}</Link></p>
      <h1 style={{ fontSize: "clamp(1.6rem,4.5vw,2.2rem)" }}>{l.title}</h1>
      {sp.error && <p className="alert bad" role="alert">{sp.error}</p>}
      {sp.saved && <p className="alert ok" role="status">Lesson saved.{c.status === "live" ? " The change is live and has gone back into review." : ""}</p>}
      {!editable && <p className="alert warn">This course is in review, so lessons are read-only. <Link href={`/teach/studio/${c.id}`}>Withdraw it</Link> to edit.</p>}
      {problem && <p className="alert warn">{problem}</p>}

      <div className="grid2" style={{ alignItems: "start" }}>
        <form action={saveLesson} className="card stack">
          <fieldset disabled={!editable} className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
            <input type="hidden" name="course_id" value={c.id} /><input type="hidden" name="lesson_id" value={l.id} />
            <label className="fld">Title<input name="title" required maxLength={160} defaultValue={l.title} /></label>
            <div className="grid2">
              <label className="fld">Type
                <select name="kind" defaultValue={l.kind}>{LESSON_KINDS.map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select>
              </label>
              <label className="fld">Minutes<input name="minutes" type="number" min={0} max={600} defaultValue={l.minutes} /></label>
            </div>
            <p className="note">Changed the type? Save, and the fields for the new type appear.</p>
            <label className="check"><input type="checkbox" name="free_preview" defaultChecked={l.free_preview} /> <span>Free preview: anyone signed in can open this lesson</span></label>

            {l.kind === "video" && (
              <label className="fld">Video link (YouTube, Vimeo or Loom)
                <input name="video_url" type="url" maxLength={500} defaultValue={l.video_url || ""} placeholder="https://www.youtube.com/watch?v=…" />
                <span className="note">Upload to YouTube (unlisted is fine), Vimeo or Loom and paste the share link. We embed YouTube in privacy-enhanced mode.</span>
              </label>
            )}
            {l.kind === "task" && (
              <label className="fld">Task instructions
                <textarea name="task" maxLength={5000} defaultValue={l.task || ""} placeholder="What should the learner build or do, and how will they know they're done?" />
                <span className="note">Never ask learners to send you passwords, API keys or private data.</span>
              </label>
            )}
            {l.kind === "quiz" && <div className="stack"><p className="fld" style={{ fontWeight: 700 }}>Questions</p><QuizEditor initial={quiz.ok ? quiz.quiz : []} /></div>}

            <label className="fld">{l.kind === "text" ? "Lesson text" : "Notes under the " + KIND_LABEL[l.kind].toLowerCase() + " (optional)"} (markdown)
              <textarea name="body_md" maxLength={MARKET.maxBody} defaultValue={l.body_md} style={{ minHeight: l.kind === "text" ? 360 : 140, fontFamily: "var(--mono)", fontSize: ".9rem" }} />
              <span className="note"># Heading · **bold** · *italic* · `code` · - list · 1. list · [link](https://…) · ``` code block ```. HTML isn't allowed. Max {MARKET.maxBody.toLocaleString("en-NG")} characters.</span>
            </label>
            <button className="btn" type="submit" style={{ justifySelf: "start" }}>Save lesson</button>
          </fieldset>
        </form>

        <div className="card stack">
          <p className="eyebrow">Saved version · how learners see it</p>
          {l.kind === "video" && (parseVideo(l.video_url) ? <VideoEmbed url={l.video_url} title={l.title} /> : <p className="empty">No video link yet.</p>)}
          {l.body_md ? <Markdown source={l.body_md} /> : l.kind === "text" ? <p className="empty">No text yet.</p> : null}
          {l.kind === "task" && l.task && <div className="card bold"><p className="eyebrow">Your task</p><p style={{ whiteSpace: "pre-line" }}>{l.task}</p></div>}
          {l.kind === "quiz" && quiz.ok && <ol>{quiz.quiz.map((q, i) => <li key={i}>{q.q} <span className="note">({q.options.length} options; answer: {q.options[q.answer]})</span></li>)}</ol>}
          <Link className="btn alt sm" href={`/courses/${c.slug}/learn/${l.id}`} style={{ justifySelf: "start" }}>Open in the learner view</Link>
        </div>
      </div>
    </section>
  );
}
