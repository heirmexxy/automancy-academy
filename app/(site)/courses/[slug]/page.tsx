import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { SUPPORT_EMAIL } from "@/lib/config";
import { fmtDate, ngn, usd } from "@/lib/format";
import { flatLessons, getCourseBySlug, getCurriculum, getRole, healEnrollment, isEnrolled, publicCreator, ratingSummary, progressFor } from "@/lib/marketplace";
import { buyCourse, enrolFree, saveCourseReview } from "@/lib/actions/marketplace";
import { KIND_LABEL, MARKET, STATUS_LABEL, type LessonKind } from "../_lib/core";
import { Markdown, Stars } from "../_components/Markdown";
import "../marketplace.css";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = await getCourseBySlug(slug);
  if (!c || c.status !== "live") return { title: "Course" };
  return { title: c.title, description: c.subtitle || undefined, openGraph: c.cover_url ? { images: [c.cover_url] } : undefined };
}

export default async function CoursePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const c = await getCourseBySlug(slug);
  if (!c) notFound();
  const user = await getUser().catch(() => null);
  const role = user ? await getRole(user.id) : "learner";
  const owner = !!user && user.id === c.creator_id;
  const admin = role === "admin";
  // Live: everyone. Unlisted: enrolled learners (and owner/admin). Anything else: owner/admin preview only.
  let enrolled = user ? await isEnrolled(user.id, c.id) : false;
  if (user && !enrolled && c.status === "live") { await healEnrollment(user.id, c.id); enrolled = await isEnrolled(user.id, c.id); }
  const visible = c.status === "live" || owner || admin || (c.status === "unlisted" && enrolled);
  if (!visible) notFound();
  const preview = c.status !== "live" && (owner || admin);

  const [curriculum, creator, ratings, progress, reviewsRes, mine] = await Promise.all([
    getCurriculum(c.id, false),
    publicCreator(c.creator_id),
    ratingSummary([c.id]),
    user && enrolled ? progressFor(user.id, c.id) : Promise.resolve(new Map<string, { done: boolean; quiz_score: number | null }>()),
    createAdminClient().from("course_reviews").select("id, rating, body, created_at, user_id").eq("course_id", c.id).eq("hidden", false).order("created_at", { ascending: false }).limit(20),
    user ? createAdminClient().from("course_reviews").select("rating, body").eq("course_id", c.id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null })
  ]);
  const lessons = flatLessons(curriculum);
  const totalMin = lessons.reduce((a, l) => a + (l.minutes || 0), 0);
  const firstPreview = lessons.find(l => l.free_preview);
  const doneCount = lessons.filter(l => progress.get(l.id)?.done).length;
  const nextLesson = lessons.find(l => !progress.get(l.id)?.done) || lessons[0];
  const rating = ratings[c.id];
  const reviewerIds = [...new Set((reviewsRes.data || []).map(r => r.user_id as string))];
  const { data: names } = reviewerIds.length ? await createAdminClient().from("profiles").select("id, full_name, public_profile").in("id", reviewerIds) : { data: [] };
  const nameOf = new Map((names || []).map(n => [n.id as string, n.public_profile && n.full_name ? String(n.full_name).split(" ")[0] : "A learner"]));
  const priceText = c.is_free ? "Free" : ngn(c.price_ngn);

  const buyBox = (
    <div className="card bold" id="buy">
      <p style={{ font: "800 2rem/1 var(--display)" }}>{priceText}</p>
      {c.price_usd && !c.is_free ? <p className="note">or {usd(Number(c.price_usd))} with an international card</p> : null}
      {sp.error && <p className="alert bad" role="alert">{sp.error}</p>}
      {sp.enrolled && <p className="alert ok" role="status">You're enrolled. Enjoy the course!</p>}
      {enrolled ? (
        <>
          <div className="mk-bar" aria-label={`${doneCount} of ${lessons.length} lessons done`}><span style={{ width: `${lessons.length ? Math.round(doneCount / lessons.length * 100) : 0}%` }} /></div>
          <p className="note">{doneCount} of {lessons.length} lessons done</p>
          {nextLesson && <Link className="btn" href={`/courses/${c.slug}/learn/${nextLesson.id}`}>{doneCount ? "Continue" : "Start the course"}</Link>}
        </>
      ) : preview || owner ? (
        <>
          <p className="muted">{owner ? "This is your course." : "Admin preview."}</p>
          {lessons[0] && <Link className="btn alt" href={`/courses/${c.slug}/learn/${lessons[0].id}`}>Preview as learner</Link>}
        </>
      ) : c.is_free ? (
        user
          ? <form action={enrolFree}><input type="hidden" name="course_id" value={c.id} /><button className="btn" type="submit">Enrol free</button></form>
          : <Link className="btn" href={`/login?next=${encodeURIComponent(`/courses/${c.slug}`)}`}>Log in to enrol</Link>
      ) : user ? (
        <form action={buyCourse} className="stack">
          <input type="hidden" name="course_id" value={c.id} /><input type="hidden" name="slug" value={c.slug} />
          {c.price_usd ? (
            <label className="fld">Pay in
              <select name="currency" defaultValue="NGN"><option value="NGN">Naira ({ngn(c.price_ngn)})</option><option value="USD">US dollars ({usd(Number(c.price_usd))})</option></select>
            </label>
          ) : null}
          <button className="btn" type="submit">Buy now</button>
          <p className="note">Secure payment by Paystack. {MARKET.refundWindowDays}-day refund policy: <Link href="/legal/terms">terms</Link>.</p>
        </form>
      ) : (
        <Link className="btn" href={`/signup?next=${encodeURIComponent(`/courses/${c.slug}`)}`}>Sign up to buy</Link>
      )}
      {!enrolled && firstPreview && <Link href={`/courses/${c.slug}/learn/${firstPreview.id}`}>Watch a free preview</Link>}
      <ul className="note" style={{ margin: 0, paddingLeft: 18 }}>
        <li>{lessons.length} lessons{totalMin ? ` · about ${Math.max(1, Math.round(totalMin / 60 * 10) / 10)} hours` : ""}</li>
        <li>Level: {c.level} · {c.language}</li>
        <li>Lifetime access to this course</li>
      </ul>
    </div>
  );

  return (
    <section className="wrap stack" style={{ gap: 20 }}>
      {preview && <p className="mk-banner" role="status"><b>Preview.</b> Status: {STATUS_LABEL[c.status]}. Only you{admin ? " (admin)" : ""} can see this page. {owner && <Link href={`/teach/studio/${c.id}`}>Back to the studio</Link>}</p>}
      {c.status === "unlisted" && !preview && <p className="mk-banner">This course is no longer in the catalogue. You keep access as a learner.</p>}
      <div className="mk-sales">
        <header className="stack mk-head" style={{ gap: 8 }}>
          <p className="eyebrow">{c.category || "Course"} · {c.level}</p>
          <h1 style={{ fontSize: "clamp(2rem,5vw,3rem)" }}>{c.title}</h1>
          {c.subtitle && <p className="lede">{c.subtitle}</p>}
          <div className="row">
            {rating && rating.count > 0 && <Stars value={rating.avg} count={rating.count} />}
            {creator && <span className="muted">by {creator.display_name}</span>}
            {c.published_at && <span className="note">Published {fmtDate(c.published_at)}</span>}
          </div>
          {c.cover_url && <div className="mk-cover" style={{ border: "2px solid var(--ink)", marginTop: 8 }}><img src={c.cover_url} alt="" referrerPolicy="no-referrer" /></div>}
        </header>
        <aside className="mk-buy">{buyBox}</aside>
        <div className="stack mk-body" style={{ gap: 20, minWidth: 0 }}>
          <div className="stack">
            <h2 style={{ fontSize: "1.5rem" }}>About this course</h2>
            <Markdown source={c.description} />
          </div>

          <div className="stack" id="curriculum">
            <h2 style={{ fontSize: "1.5rem" }}>Curriculum</h2>
            <p className="muted">{curriculum.length} sections · {lessons.length} lessons{totalMin ? ` · ${totalMin} minutes` : ""}</p>
            <div className="mk-outline">
              {curriculum.map((s, si) => (
                <details key={s.id} open={si === 0}>
                  <summary>{s.title} <span className="note">({s.lessons.length})</span></summary>
                  <ol>{s.lessons.map(l => {
                    const open = enrolled || l.free_preview || owner || admin;
                    return (
                      <li key={l.id} className="mk-li">
                        <span className="pill">{KIND_LABEL[l.kind as LessonKind]}</span>
                        {open ? <Link href={`/courses/${c.slug}/learn/${l.id}`}>{l.title}</Link> : <span>{l.title}</span>}
                        {l.free_preview && !enrolled && <span className="pill ok">Free preview</span>}
                        {progress.get(l.id)?.done && <span className="pill ok">Done</span>}
                        <span className="note">{l.minutes ? `${l.minutes} min` : ""}</span>
                      </li>
                    );
                  })}</ol>
                </details>
              ))}
            </div>
          </div>

          {creator && (
            <div className="card">
              <p className="eyebrow">Your instructor</p>
              <div className="mk-creator">
                {creator.photo_url && <img src={creator.photo_url} alt="" referrerPolicy="no-referrer" />}
                <div className="stack" style={{ gap: 6 }}>
                  <h3>{creator.display_name}</h3>
                  {creator.bio && <p style={{ whiteSpace: "pre-line" }}>{creator.bio}</p>}
                  {creator.website && <a href={creator.website} target="_blank" rel="noopener noreferrer nofollow">{creator.website.replace(/^https?:\/\//, "")}</a>}
                </div>
              </div>
            </div>
          )}

          <div className="stack" id="reviews">
            <h2 style={{ fontSize: "1.5rem" }}>Reviews</h2>
            {sp.reviewed && <p className="alert ok" role="status">Thanks for your review.</p>}
            {enrolled && (
              <form action={saveCourseReview} className="card stack">
                <input type="hidden" name="course_id" value={c.id} />
                <label className="fld">{mine.data ? "Update your rating" : "Rate this course"}
                  <select name="rating" defaultValue={String(mine.data?.rating ?? 5)} required>
                    {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{"★".repeat(n)} ({n})</option>)}
                  </select>
                </label>
                <label className="fld">Your review (optional)<textarea name="body" maxLength={2000} defaultValue={String(mine.data?.body ?? "")} style={{ minHeight: 80 }} /></label>
                <button className="btn alt sm" type="submit" style={{ justifySelf: "start" }}>Save review</button>
              </form>
            )}
            {(reviewsRes.data || []).length ? (reviewsRes.data || []).map(r => (
              <div key={r.id as string} className="card" style={{ gap: 4 }}>
                <div className="row"><Stars value={r.rating as number} /><b>{nameOf.get(r.user_id as string) || "A learner"}</b><span className="note">{fmtDate(r.created_at as string)}</span></div>
                {r.body && <p style={{ whiteSpace: "pre-line" }}>{String(r.body)}</p>}
              </div>
            )) : <p className="muted">No reviews yet.</p>}
          </div>
          <p className="note">Questions about this course? <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(c.title)}`}>{SUPPORT_EMAIL}</a>. Courses are created by independent creators and reviewed by Automancy before publishing.</p>
        </div>
      </div>
    </section>
  );
}
