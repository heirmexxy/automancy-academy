"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/config";
import { esc } from "@/lib/format";
import { moneyText } from "@/lib/money";
import {
  audit, emailAdmins, emailUser, getCourse, getCreator, getCurriculum, flatLessons, getRole, grantFreeEnrollment, isEnrolled,
  releaseDueEarnings, startCoursePurchase, courseLink, studioLink, type Course
} from "@/lib/marketplace";
import {
  CATEGORIES, LESSON_KINDS, LEVELS, MARKET, QUIZ_PASS, STANDARDS, httpsUrl, isEditable, normaliseQuiz, parseVideo, priceProblem,
  scoreQuiz, slugify, submitProblems, validSlug, type QuizQ
} from "@/app/(site)/courses/_lib/core";

/** Every action re-checks who is asking; writes use the service role only after those checks (RLS still guards direct API use). */
const s = (f: FormData, k: string, max = 500) => String(f.get(k) ?? "").trim().slice(0, max);
const q = (o: Record<string, string>) => "?" + new URLSearchParams(o).toString();
const db = () => createAdminClient();
const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

// ── Creator application ───────────────────────────────────────────────────────

export async function applyToTeach(formData: FormData) {
  const user = await requireUser("/teach/apply");
  const display_name = s(formData, "display_name", 80);
  const bio = s(formData, "bio", 2000);
  const note = s(formData, "application_note", 3000);
  const websiteRaw = s(formData, "website", 300);
  const photoRaw = s(formData, "photo_url", 500);
  const back: (error: string) => never = error => redirect("/teach/apply" + q({ error }));
  if (display_name.length < 2) back("Add the name learners will see.");
  if (bio.length < 50) back("Write a short bio (at least 50 characters).");
  if (note.length < 50) back("Tell us what you want to teach (at least 50 characters).");
  if (formData.get("agree") !== "on") back("Please read and accept the creator terms.");
  const website = websiteRaw ? (/^https?:\/\//.test(websiteRaw) ? websiteRaw : null) : null;
  if (websiteRaw && !website) back("The website must start with https://");
  const photo_url = photoRaw ? httpsUrl(photoRaw) : null;
  if (photoRaw && !photo_url) back("The photo URL must start with https://");

  const existing = await getCreator(user.id);
  if (existing?.status === "suspended") back("Your creator account is suspended. Contact support.");
  if (existing) {
    await db().from("creators").update({ display_name, bio, website, photo_url, application_note: note }).eq("user_id", user.id);
  } else {
    const { error } = await db().from("creators").insert({
      user_id: user.id, display_name, bio, website, photo_url, application_note: note, status: "applied", agreed_terms_at: new Date().toISOString()
    });
    if (error) back("We couldn't save your application. Try again.");
    await emailAdmins("New creator application", `<p><b>${esc(display_name)}</b> applied to teach.</p><p>${esc(note)}</p><p><a href="${esc(SITE_URL)}/admin/courses">Review applications</a></p>`);
  }
  await audit(user.id, existing ? "creator_profile_update" : "creator_apply", user.id, { display_name });
  revalidatePath("/teach/apply");
  redirect("/teach/apply?sent=1");
}

async function requireCreator(next = "/teach/studio") {
  const user = await requireUser(next);
  const c = await getCreator(user.id);
  if (!c || c.status !== "approved") redirect("/teach/apply");
  return { user, creator: c };
}

/** The course, owned by this creator, in an editable status. */
async function ownCourse(courseId: string, needEditable = true): Promise<{ userId: string; course: Course }> {
  const { user } = await requireCreator(`/teach/studio/${courseId}`);
  const course = isUuid(courseId) ? await getCourse(courseId) : null;
  if (!course || course.creator_id !== user.id) redirect("/teach/studio" + q({ error: "Course not found." }));
  if (needEditable && !isEditable(course.status)) redirect(`/teach/studio/${course.id}` + q({ error: "This course is in review. Withdraw it to make changes." }));
  return { userId: user.id, course };
}

/** Any content change to a live course re-enters review (status stays live; see docs). */
async function touched(course: Course) {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (course.status === "live" && !course.changes_pending) { patch.changes_pending = true; patch.submitted_at = new Date().toISOString(); }
  await db().from("courses").update(patch).eq("id", course.id);
}

export async function updateCreatorProfile(formData: FormData) {
  const { user } = await requireCreator();
  const display_name = s(formData, "display_name", 80);
  const bio = s(formData, "bio", 2000);
  const websiteRaw = s(formData, "website", 300);
  const photoRaw = s(formData, "photo_url", 500);
  const website = websiteRaw && /^https?:\/\//.test(websiteRaw) ? websiteRaw : null;
  const photo_url = photoRaw ? httpsUrl(photoRaw) : null;
  if (display_name.length < 2) redirect("/teach/studio" + q({ tab: "profile", error: "Add a display name." }));
  await db().from("creators").update({ display_name, bio: bio || null, website, photo_url }).eq("user_id", user.id);
  revalidatePath("/teach/studio");
  redirect("/teach/studio" + q({ tab: "profile", saved: "1" }));
}

// ── Courses ───────────────────────────────────────────────────────────────────

async function uniqueSlug(base: string, exceptId?: string): Promise<string> {
  let slug = slugify(base);
  for (let n = 0; n < 6; n++) {
    const { data } = await db().from("courses").select("id").eq("slug", slug).maybeSingle();
    if (!data || data.id === exceptId) return slug;
    slug = `${slugify(base).slice(0, 52)}-${Math.random().toString(36).slice(2, 7)}`;
  }
  return `${slug}-${Date.now().toString(36)}`;
}

export async function createCourse(formData: FormData) {
  const { user } = await requireCreator();
  const title = s(formData, "title", 120);
  if (title.length < 3) redirect("/teach/studio" + q({ error: "Give the course a title." }));
  const slug = await uniqueSlug(title);
  const { data, error } = await db().from("courses").insert({ creator_id: user.id, slug, title, status: "draft" }).select("id").single();
  if (error || !data) redirect("/teach/studio" + q({ error: "We couldn't create the course. Try again." }));
  await db().from("course_sections").insert({ course_id: data.id, position: 0, title: "Getting started" });
  await audit(user.id, "course_create", data.id as string, { title });
  redirect(`/teach/studio/${data.id}`);
}

export async function saveCourseDetails(formData: FormData) {
  const id = s(formData, "course_id", 64);
  const { userId, course } = await ownCourse(id);
  const back: (o: Record<string, string>) => never = o => redirect(`/teach/studio/${course.id}` + q(o) + "#details");
  const title = s(formData, "title", 120);
  const subtitle = s(formData, "subtitle", 200);
  const description = String(formData.get("description") ?? "").trim().slice(0, 10000);
  const categoryRaw = s(formData, "category", 60);
  const category = (CATEGORIES as readonly string[]).includes(categoryRaw) ? categoryRaw : null;
  const levelRaw = s(formData, "level", 20);
  const level = (LEVELS as readonly string[]).includes(levelRaw) ? levelRaw : "beginner";
  const language = s(formData, "language", 40) || "English";
  const coverRaw = s(formData, "cover_url", 500);
  const cover_url = coverRaw ? httpsUrl(coverRaw) : null;
  const price_ngn = Math.round(Number(s(formData, "price_ngn", 12).replace(/[,\s₦]/g, "")) || 0);
  const usdRaw = s(formData, "price_usd", 12).replace(/[,\s$]/g, "");
  const price_usd = usdRaw ? Math.round(Number(usdRaw) * 100) / 100 : null;
  let slug = s(formData, "slug", 80).toLowerCase();

  if (title.length < 3) back({ error: "Give the course a title (3+ characters)." });
  if (coverRaw && !cover_url) back({ error: "The cover image URL must start with https://" });
  if (price_ngn < 0 || price_ngn > MARKET.maxPriceNgn || (price_usd != null && (!Number.isFinite(price_usd) || price_usd < 0)))
    back({ error: `Prices must be between ₦0 and ₦${MARKET.maxPriceNgn.toLocaleString("en-NG")}.` });
  if (course.status === "live" || course.published_at) {
    const p = priceProblem({ price_ngn, price_usd, is_free: course.is_free });
    if (p) back({ error: p });
    slug = course.slug; // fixed once published
  } else if (slug && slug !== course.slug) {
    if (!validSlug(slug)) back({ error: "The web address may use lower-case letters, numbers and single hyphens (3–80 characters)." });
    const { data: taken } = await db().from("courses").select("id").eq("slug", slug).maybeSingle();
    if (taken && taken.id !== course.id) back({ error: "That web address is taken. Try another." });
  } else slug = course.slug;

  const { error } = await db().from("courses").update({
    title, subtitle: subtitle || null, description: description || null, category, level, language, cover_url, price_ngn, price_usd, slug
  }).eq("id", course.id);
  if (error) back({ error: "We couldn't save. " + (/price/.test(error.message) ? "Check the price." : "Try again.") });
  await touched(course);
  await audit(userId, "course_details", course.id, { title });
  revalidatePath(`/teach/studio/${course.id}`);
  back({ saved: "details" });
}

export async function deleteCourse(formData: FormData) {
  const { userId, course } = await ownCourse(s(formData, "course_id", 64), false);
  if (course.status !== "draft" || course.published_at) redirect(`/teach/studio/${course.id}` + q({ error: "Only unpublished drafts can be deleted." }));
  await db().from("courses").delete().eq("id", course.id).eq("status", "draft");
  await audit(userId, "course_delete", course.id, { title: course.title });
  redirect("/teach/studio" + q({ deleted: "1" }));
}

// ── Curriculum ────────────────────────────────────────────────────────────────

const toCurriculum: (id: string) => never = id => redirect(`/teach/studio/${id}#curriculum`);

export async function addSection(formData: FormData) {
  const { course } = await ownCourse(s(formData, "course_id", 64));
  const title = s(formData, "title", 120) || "New section";
  const { data: last } = await db().from("course_sections").select("position").eq("course_id", course.id).order("position", { ascending: false }).limit(1);
  const { count } = await db().from("course_sections").select("id", { count: "exact", head: true }).eq("course_id", course.id);
  if ((count ?? 0) >= 40) redirect(`/teach/studio/${course.id}` + q({ error: "A course can have up to 40 sections." }));
  await db().from("course_sections").insert({ course_id: course.id, title, position: ((last?.[0]?.position as number) ?? -1) + 1 });
  await touched(course);
  revalidatePath(`/teach/studio/${course.id}`);
  toCurriculum(course.id);
}

export async function renameSection(formData: FormData) {
  const { course } = await ownCourse(s(formData, "course_id", 64));
  const title = s(formData, "title", 120);
  if (title) await db().from("course_sections").update({ title }).eq("id", s(formData, "section_id", 64)).eq("course_id", course.id);
  await touched(course);
  revalidatePath(`/teach/studio/${course.id}`);
  toCurriculum(course.id);
}

export async function deleteSection(formData: FormData) {
  const { course } = await ownCourse(s(formData, "course_id", 64));
  await db().from("course_sections").delete().eq("id", s(formData, "section_id", 64)).eq("course_id", course.id);
  await touched(course);
  revalidatePath(`/teach/studio/${course.id}`);
  toCurriculum(course.id);
}

/** Swap with the neighbour above/below, then renumber 0..n-1 so positions stay tidy. */
async function move(table: "course_sections" | "course_lessons", courseId: string, id: string, dir: "up" | "down", scope?: { section_id: string }) {
  let query = db().from(table).select("id, position").eq("course_id", courseId);
  if (scope) query = query.eq("section_id", scope.section_id);
  const { data } = await query.order("position").order("id");
  const list = (data || []).map(r => r.id as string);
  const i = list.indexOf(id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await Promise.all(list.map((rid, pos) => db().from(table).update({ position: pos }).eq("id", rid).eq("course_id", courseId)));
}

export async function moveSection(formData: FormData) {
  const { course } = await ownCourse(s(formData, "course_id", 64));
  await move("course_sections", course.id, s(formData, "section_id", 64), s(formData, "dir", 4) === "up" ? "up" : "down");
  await touched(course);
  revalidatePath(`/teach/studio/${course.id}`);
  toCurriculum(course.id);
}

export async function addLesson(formData: FormData) {
  const { course } = await ownCourse(s(formData, "course_id", 64));
  const sectionId = s(formData, "section_id", 64);
  const title = s(formData, "title", 160) || "New lesson";
  const kindRaw = s(formData, "kind", 10);
  const kind = (LESSON_KINDS as readonly string[]).includes(kindRaw) ? kindRaw : "text";
  const { data: sec } = await db().from("course_sections").select("id").eq("id", sectionId).eq("course_id", course.id).maybeSingle();
  if (!sec) redirect(`/teach/studio/${course.id}` + q({ error: "Section not found." }));
  const { count } = await db().from("course_lessons").select("id", { count: "exact", head: true }).eq("course_id", course.id);
  if ((count ?? 0) >= 300) redirect(`/teach/studio/${course.id}` + q({ error: "A course can have up to 300 lessons." }));
  const { data: last } = await db().from("course_lessons").select("position").eq("section_id", sectionId).order("position", { ascending: false }).limit(1);
  const { data, error } = await db().from("course_lessons").insert({
    course_id: course.id, section_id: sectionId, title, kind, position: ((last?.[0]?.position as number) ?? -1) + 1
  }).select("id").single();
  if (error || !data) redirect(`/teach/studio/${course.id}` + q({ error: "We couldn't add the lesson." }));
  await touched(course);
  redirect(`/teach/studio/${course.id}/lesson/${data.id}`);
}

export async function saveLesson(formData: FormData) {
  const { userId, course } = await ownCourse(s(formData, "course_id", 64));
  const lessonId = s(formData, "lesson_id", 64);
  const back: (o: Record<string, string>) => never = o => redirect(`/teach/studio/${course.id}/lesson/${lessonId}` + q(o));
  const { data: cur } = await db().from("course_lessons").select("id, kind").eq("id", lessonId).eq("course_id", course.id).maybeSingle();
  if (!cur) redirect(`/teach/studio/${course.id}` + q({ error: "Lesson not found." }));
  const title = s(formData, "title", 160);
  const kindRaw = s(formData, "kind", 10);
  const kind = (LESSON_KINDS as readonly string[]).includes(kindRaw) ? kindRaw : String(cur.kind);
  const body_md = String(formData.get("body_md") ?? "").replace(/\r\n?/g, "\n");
  const minutes = Math.max(0, Math.min(600, parseInt(s(formData, "minutes", 4), 10) || 0));
  const free_preview = formData.get("free_preview") === "on";
  const patch: Record<string, unknown> = { title, kind, body_md, minutes, free_preview };
  if (!title) back({ error: "Give the lesson a title." });
  if (body_md.length > MARKET.maxBody) back({ error: `Lesson text is limited to ${MARKET.maxBody.toLocaleString("en-NG")} characters.` });

  // Kind-specific fields are only in the form for the lesson's saved kind; keep the others as they are.
  if (formData.has("video_url")) {
    const v = s(formData, "video_url", 500);
    if (v && !parseVideo(v)) back({ error: "Use a YouTube, Vimeo or Loom link (https). Other video hosts aren't supported." });
    patch.video_url = v || null;
  }
  if (formData.has("task")) patch.task = s(formData, "task", 5000) || null;
  if (formData.has("quiz")) {
    const qz = normaliseQuiz(String(formData.get("quiz") ?? "[]").slice(0, 100000));
    if (!qz.ok) back({ error: qz.error });
    if (qz.ok) patch.quiz = qz.quiz;
  }
  const { error } = await db().from("course_lessons").update(patch).eq("id", lessonId).eq("course_id", course.id);
  if (error) back({ error: "We couldn't save the lesson. Try again." });
  await touched(course);
  await audit(userId, "lesson_save", lessonId, { course: course.id });
  revalidatePath(`/teach/studio/${course.id}`);
  back({ saved: "1" });
}

export async function moveLesson(formData: FormData) {
  const { course } = await ownCourse(s(formData, "course_id", 64));
  const lessonId = s(formData, "lesson_id", 64);
  const { data: l } = await db().from("course_lessons").select("section_id").eq("id", lessonId).eq("course_id", course.id).maybeSingle();
  if (l) await move("course_lessons", course.id, lessonId, s(formData, "dir", 4) === "up" ? "up" : "down", { section_id: l.section_id as string });
  await touched(course);
  revalidatePath(`/teach/studio/${course.id}`);
  toCurriculum(course.id);
}

export async function deleteLesson(formData: FormData) {
  const { course } = await ownCourse(s(formData, "course_id", 64));
  await db().from("course_lessons").delete().eq("id", s(formData, "lesson_id", 64)).eq("course_id", course.id);
  await touched(course);
  revalidatePath(`/teach/studio/${course.id}`);
  toCurriculum(course.id);
}

// ── Review workflow (creator side) ────────────────────────────────────────────

export async function submitCourse(formData: FormData) {
  const { userId, course } = await ownCourse(s(formData, "course_id", 64), false);
  const back: (o: Record<string, string>) => never = o => redirect(`/teach/studio/${course.id}` + q(o));
  const lessons = flatLessons(await getCurriculum(course.id, true));
  const problems = submitProblems(course, lessons);
  if (problems.length) back({ error: problems.slice(0, 6).join(" ") });
  if (formData.get("standards") !== "on") back({ error: "Confirm that the course meets the standards and specifications before submitting." });
  const now = new Date().toISOString();
  if (course.status === "live") {
    await db().from("courses").update({ changes_pending: true, submitted_at: now }).eq("id", course.id);
  } else if (["draft", "changes_requested", "unlisted"].includes(course.status)) {
    await db().from("courses").update({ status: "submitted", submitted_at: now }).eq("id", course.id);
  } else back({ error: "This course can't be submitted right now." });
  await audit(userId, "course_submit", course.id, { title: course.title, live: course.status === "live" });
  await emailAdmins(`Course submitted: ${course.title}`, `<p><b>${esc(course.title)}</b> is waiting for review${course.status === "live" ? " (changes to a live course)" : ""}.</p><p><a href="${esc(SITE_URL)}/admin/courses/${course.id}">Review it</a></p>`);
  await emailUser(userId, `We've received "${course.title}"`, `<p>Thanks! We review courses in about ${MARKET.reviewDays} working days and will email you when we're done.</p>`);
  revalidatePath("/teach/studio");
  back({ submitted: "1" });
}

export async function withdrawCourse(formData: FormData) {
  const { userId, course } = await ownCourse(s(formData, "course_id", 64), false);
  if (course.status === "submitted") await db().from("courses").update({ status: "draft" }).eq("id", course.id).eq("status", "submitted");
  await audit(userId, "course_withdraw", course.id, {});
  redirect(`/teach/studio/${course.id}` + q({ withdrawn: "1" }));
}

// ── Learner ───────────────────────────────────────────────────────────────────

export async function buyCourse(formData: FormData) {
  const courseId = s(formData, "course_id", 64);
  const slug = s(formData, "slug", 80);
  const user = await requireUser(`/courses/${slug}`);
  const currency = s(formData, "currency", 3) === "USD" ? "USD" : "NGN";
  const ref = (await cookies()).get("am_ref")?.value || null;
  const r = await startCoursePurchase(user.id, user.email || "", courseId, ref, currency);
  if (r.ok) redirect(r.url);
  if (r.enrolled) redirect(`/courses/${slug}`);
  redirect(`/courses/${slug}` + q({ error: r.error }) + "#buy");
}

export async function enrolFree(formData: FormData) {
  const courseId = s(formData, "course_id", 64);
  const c = await getCourse(courseId);
  const user = await requireUser(c ? `/courses/${c.slug}` : "/courses");
  if (!c || !c.is_free || c.status !== "live") redirect("/courses");
  await grantFreeEnrollment(user.id, c);
  redirect(`/courses/${c.slug}` + q({ enrolled: "1" }));
}

/** Learner may use this lesson: enrolled, owner/admin (preview), or a free preview of a live course. */
async function lessonAccess(lessonId: string) {
  const user = await requireUser("/courses");
  if (!isUuid(lessonId)) return null;
  const { data: l } = await db().from("course_lessons").select("id, course_id, kind, quiz, free_preview").eq("id", lessonId).maybeSingle();
  if (!l) return null;
  const c = await getCourse(l.course_id as string);
  if (!c) return null;
  const enrolled = await isEnrolled(user.id, c.id);
  const ok = enrolled || (l.free_preview && c.status === "live") || c.creator_id === user.id || (await getRole(user.id)) === "admin";
  return ok ? { user, lesson: l, course: c, enrolled } : null;
}

export async function markLessonDone(formData: FormData) {
  const lessonId = s(formData, "lesson_id", 64);
  const done = s(formData, "done", 1) !== "0";
  const a = await lessonAccess(lessonId);
  if (!a) redirect("/courses");
  if (a.enrolled) {
    await db().from("course_progress").upsert({ user_id: a.user.id, lesson_id: lessonId, course_id: a.course.id, done, updated_at: new Date().toISOString() }, { onConflict: "user_id,lesson_id" });
  }
  const next = s(formData, "next", 64);
  revalidatePath(`/courses/${a.course.slug}/learn/${lessonId}`);
  redirect(`/courses/${a.course.slug}/learn/${next && isUuid(next) && done ? next : lessonId}`);
}

export type QuizResult = { ok: boolean; error?: string; correct?: number; total?: number; percent?: number; results?: boolean[]; answers?: number[]; passed?: boolean };
/** Called from the quiz component. Scores on the server; the client never sees the answers before submitting. */
export async function submitQuiz(lessonId: string, answers: number[]): Promise<QuizResult> {
  const a = await lessonAccess(String(lessonId).slice(0, 64));
  if (!a || a.lesson.kind !== "quiz") return { ok: false, error: "You don't have access to this quiz." };
  const parsed = normaliseQuiz(a.lesson.quiz);
  const quiz: QuizQ[] = parsed.ok ? parsed.quiz : [];
  const r = scoreQuiz(quiz, Array.isArray(answers) ? answers.slice(0, 30) : []);
  const passed = r.percent >= QUIZ_PASS;
  if (a.enrolled) {
    const { data: prev } = await db().from("course_progress").select("quiz_score, done").eq("user_id", a.user.id).eq("lesson_id", lessonId).maybeSingle();
    await db().from("course_progress").upsert({
      user_id: a.user.id, lesson_id: lessonId, course_id: a.course.id,
      quiz_score: Math.max(r.percent, (prev?.quiz_score as number | null) ?? 0), done: !!prev?.done || passed, updated_at: new Date().toISOString()
    }, { onConflict: "user_id,lesson_id" });
  }
  return { ok: true, ...r, passed, answers: quiz.map(x => x.answer) };
}

export async function saveCourseReview(formData: FormData) {
  const courseId = s(formData, "course_id", 64);
  const c = await getCourse(courseId);
  const user = await requireUser(c ? `/courses/${c.slug}` : "/courses");
  if (!c) redirect("/courses");
  const rating = Math.round(Number(s(formData, "rating", 1)));
  const body = s(formData, "body", 2000);
  if (!(await isEnrolled(user.id, c.id))) redirect(`/courses/${c.slug}` + q({ error: "Only learners on this course can review it." }) + "#reviews");
  if (!(rating >= 1 && rating <= 5)) redirect(`/courses/${c.slug}` + q({ error: "Choose a rating from 1 to 5." }) + "#reviews");
  const { data: prev } = await db().from("course_reviews").select("id, hidden").eq("course_id", c.id).eq("user_id", user.id).maybeSingle();
  if (prev) await db().from("course_reviews").update({ rating, body: body || null, updated_at: new Date().toISOString() }).eq("id", prev.id);
  else await db().from("course_reviews").insert({ course_id: c.id, user_id: user.id, rating, body: body || null });
  revalidatePath(`/courses/${c.slug}`);
  redirect(`/courses/${c.slug}` + q({ reviewed: "1" }) + "#reviews");
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export async function adminDecideCreator(formData: FormData) {
  const admin = await requireAdmin();
  const userId = s(formData, "user_id", 64);
  const decision = s(formData, "decision", 12);
  const status = decision === "approve" ? "approved" : decision === "suspend" ? "suspended" : null;
  const c = await getCreator(userId);
  if (!c || !status) redirect("/admin/courses" + q({ error: "Creator not found." }));
  const shareRaw = s(formData, "revenue_share", 6);
  const patch: Record<string, unknown> = { status, decided_at: new Date().toISOString(), decided_by: admin.id };
  if (shareRaw) {
    const share = Number(shareRaw) > 1 ? Number(shareRaw) / 100 : Number(shareRaw);
    if (share >= 0 && share <= 1) patch.revenue_share = Math.round(share * 1000) / 1000;
  }
  await db().from("creators").update(patch).eq("user_id", userId);
  if (status === "suspended") {
    // Suspended creators' courses leave the catalogue; enrolled learners keep access.
    await db().from("courses").update({ status: "unlisted" }).eq("creator_id", userId).eq("status", "live");
  }
  await audit(admin.id, `creator_${status}`, userId, patch);
  if (c.status !== status) await emailUser(userId, status === "approved" ? "You're approved to teach on Automancy" : "Your creator account is suspended",
    status === "approved"
      ? `<p>Welcome aboard, ${esc(c.display_name)}! Open the <a href="${esc(SITE_URL)}/teach/studio">creator studio</a> to build your first course.</p>`
      : `<p>Your creator account has been suspended and your courses are no longer listed. Reply to this email if you think this is a mistake.</p>`);
  revalidatePath("/admin/courses");
  redirect("/admin/courses" + q({ done: "creator" }));
}

async function adminCourse(formData: FormData) {
  const admin = await requireAdmin();
  const c = await getCourse(s(formData, "course_id", 64));
  if (!c) redirect("/admin/courses" + q({ tab: "queue", error: "Course not found." }));
  return { admin, c, note: s(formData, "note", 4000) };
}

export async function adminApproveCourse(formData: FormData) {
  const { admin, c, note } = await adminCourse(formData);
  const problems = submitProblems(c, flatLessons(await getCurriculum(c.id, true)));
  if (problems.length && formData.get("override") !== "on") redirect(`/admin/courses/${c.id}` + q({ error: "Not ready: " + problems.slice(0, 4).join(" ") + " (tick 'approve anyway' to override)." }));
  const missed = STANDARDS.filter(st => formData.get(`std_${st.key}`) !== "on").map(st => st.title);
  if (missed.length) redirect(`/admin/courses/${c.id}` + q({ error: "Tick every standard before approving. Not ticked: " + missed.join(", ") + ". If one fails, request changes instead." }));
  const now = new Date().toISOString();
  await db().from("courses").update({
    status: "live", changes_pending: false, review_note: note || null, approved_at: now, approved_by: admin.id, published_at: c.published_at || now
  }).eq("id", c.id);
  await audit(admin.id, "course_approve", c.id, { title: c.title, note, wasLive: c.status === "live" });
  await emailUser(c.creator_id, `"${c.title}" is live`, `<p>Your course is approved and live at <a href="${esc(courseLink(c))}">${esc(courseLink(c))}</a>.</p>${note ? `<p>Reviewer's note: ${esc(note)}</p>` : ""}`);
  revalidatePath("/admin/courses"); revalidatePath("/courses");
  redirect("/admin/courses" + q({ tab: "queue", done: "approved" }));
}

export async function adminRequestChanges(formData: FormData) {
  const { admin, c, note } = await adminCourse(formData);
  if (note.length < 10) redirect(`/admin/courses/${c.id}` + q({ error: "Explain what needs to change (the creator sees this note)." }));
  // A live course stays live while the creator fixes it; otherwise it goes back to the creator.
  const patch = c.status === "live" ? { review_note: note, changes_pending: false } : { status: "changes_requested", review_note: note };
  await db().from("courses").update(patch).eq("id", c.id);
  await audit(admin.id, "course_changes_requested", c.id, { note });
  await emailUser(c.creator_id, `Changes requested: ${c.title}`, `<p>Thanks for submitting <b>${esc(c.title)}</b>. Before it can go live, please change the following:</p><blockquote>${esc(note)}</blockquote><p><a href="${esc(studioLink(c))}">Open the studio</a>, make the changes, and submit again.</p>`);
  revalidatePath("/admin/courses");
  redirect("/admin/courses" + q({ tab: "queue", done: "changes" }));
}

export async function adminRejectCourse(formData: FormData) {
  const { admin, c, note } = await adminCourse(formData);
  if (note.length < 10) redirect(`/admin/courses/${c.id}` + q({ error: "Give the reason for rejecting (the creator sees this note)." }));
  // A course with buyers is unlisted (they keep access); otherwise rejected.
  const { count } = await db().from("course_enrollments").select("id", { count: "exact", head: true }).eq("course_id", c.id);
  const status = (count ?? 0) > 0 ? "unlisted" : "rejected";
  await db().from("courses").update({ status, review_note: note, changes_pending: false }).eq("id", c.id);
  await audit(admin.id, "course_reject", c.id, { note, status });
  await emailUser(c.creator_id, `Your course wasn't approved: ${c.title}`, `<p>We reviewed <b>${esc(c.title)}</b> and can't publish it.</p><blockquote>${esc(note)}</blockquote><p>Reply to this email if you'd like to talk it through.</p>`);
  revalidatePath("/admin/courses"); revalidatePath("/courses");
  redirect("/admin/courses" + q({ tab: "queue", done: "rejected" }));
}

export async function adminSetListing(formData: FormData) {
  const { admin, c, note } = await adminCourse(formData);
  const relist = s(formData, "to", 10) === "live";
  if (relist && c.status !== "unlisted") redirect("/admin/courses" + q({ tab: "live" }));
  if (!relist && c.status !== "live") redirect("/admin/courses" + q({ tab: "live" }));
  await db().from("courses").update({ status: relist ? "live" : "unlisted", ...(note ? { review_note: note } : {}) }).eq("id", c.id);
  await audit(admin.id, relist ? "course_relist" : "course_unlist", c.id, { note });
  await emailUser(c.creator_id, relist ? `"${c.title}" is listed again` : `"${c.title}" has been unlisted`,
    relist ? `<p>Your course is back in the catalogue.</p>` : `<p>Your course is no longer in the catalogue. Learners who bought it keep access.</p>${note ? `<blockquote>${esc(note)}</blockquote>` : ""}`);
  revalidatePath("/admin/courses"); revalidatePath("/courses");
  redirect("/admin/courses" + q({ tab: "live", done: relist ? "relisted" : "unlisted" }));
}

export async function adminSetFree(formData: FormData) {
  const { admin, c } = await adminCourse(formData);
  const free = s(formData, "free", 1) === "1";
  await db().from("courses").update({ is_free: free }).eq("id", c.id);
  await audit(admin.id, free ? "course_free_on" : "course_free_off", c.id, {});
  redirect(`/admin/courses/${c.id}` + q({ saved: "free" }));
}

export async function adminHideReview(formData: FormData) {
  const admin = await requireAdmin();
  const id = s(formData, "review_id", 64);
  const hidden = s(formData, "hidden", 1) !== "0";
  await db().from("course_reviews").update({ hidden }).eq("id", id);
  await audit(admin.id, hidden ? "course_review_hide" : "course_review_show", id, {});
  redirect(`/admin/courses/${s(formData, "course_id", 64)}#reviews`);
}

export async function adminReleaseEarnings() {
  const admin = await requireAdmin();
  const n = await releaseDueEarnings();
  await audit(admin.id, "creator_earnings_release", "all", { count: n });
  revalidatePath("/admin/courses");
  redirect("/admin/courses" + q({ tab: "earnings", released: String(n) }));
}

/** Marks every available earning of one creator as paid (after the admin has transferred the money). */
export async function adminMarkEarningsPaid(formData: FormData) {
  const admin = await requireAdmin();
  const creatorId = s(formData, "creator_id", 64);
  const ref = s(formData, "payout_ref", 120);
  if (!ref) redirect("/admin/courses" + q({ tab: "earnings", error: "Add the transfer reference before marking paid." }));
  await releaseDueEarnings();
  const { data } = await db().from("creator_earnings").update({ status: "paid", paid_at: new Date().toISOString(), payout_ref: ref })
    .eq("creator_id", creatorId).eq("status", "available").select("id, amount_kobo");
  const total = (data || []).reduce((a, r) => a + (r.amount_kobo as number), 0);
  await audit(admin.id, "creator_payout_paid", creatorId, { ref, count: data?.length ?? 0, amount_kobo: total });
  if (total > 0) await emailUser(creatorId, "Your creator payout is on its way", `<p>We've sent <b>${esc(moneyText(total))}</b> to your bank account (reference ${esc(ref)}).</p><p><a href="${esc(SITE_URL)}/teach/studio?tab=earnings">See your earnings</a></p>`);
  revalidatePath("/admin/courses");
  redirect("/admin/courses" + q({ tab: "earnings", done: "paid" }));
}
