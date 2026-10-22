/**
 * Creator marketplace: pure logic (no "@/" imports, no I/O) so it can be unit-tested and used by server
 * and client components alike. Money is in minor units (kobo / cents).
 */

/** PLACEHOLDER business rules to confirm (see docs/placeholders/marketplace.md). Price limits also live in 0007_marketplace.sql. */
export const MARKET = {
  revenueShare: 0.70,      // creator's share after payment-processor fees
  minPriceNgn: 2000,
  maxPriceNgn: 500000,
  minPriceUsd: 2,
  maxPriceUsd: 350,
  refundWindowDays: 14,    // creator earnings become available after this
  reviewDays: 5,           // working days we aim to review a submission in
  minLessons: 3,
  minDescription: 200,
  maxBody: 50000
} as const;

/**
 * The standards every creator course is reviewed against. Shown on /teach/standards and as the
 * reviewer's checklist on /admin/courses/[id], so creators and reviewers work from the same list.
 */
export const STANDARDS = [
  { key: "outcome", title: "Clear outcome", check: "The title, subtitle and description say who the course is for and what learners will be able to do or build at the end, and the lessons deliver exactly that." },
  { key: "practical", title: "Hands-on", check: "Learners do things, not just watch: every section ends with a task, quiz or build, and there is a final project or practical exercise." },
  { key: "accurate", title: "Accurate and current", check: "Steps, screenshots, prices and limits match the tools as they are today; nothing is misleading, and figures that change are hedged (\"check the current price\")." },
  { key: "original", title: "Original work", check: "All lessons, videos, templates and images are the creator's own or properly licensed. No copied courses, books, videos or paid templates." },
  { key: "safe", title: "Safe and lawful", check: "Automation follows each platform's rules and the law (including data protection and consent). No spam, scraping against terms, fake engagement or ways around limits. Learners are never asked for passwords, API keys, OTPs or bank details." },
  { key: "honest", title: "Honest promises", check: "No guaranteed income, get-rich-quick claims or fake urgency. Results claims are real and specific." },
  { key: "clear", title: "Clear and well produced", check: "Writing is plain and well organised; videos have clear audio, readable screens and no long dead air; lessons are in a sensible order with descriptive titles." },
  { key: "complete", title: "Complete", check: "Every lesson has its content, links work, free previews are set, and the course is finished (no \"coming soon\" lessons)." }
] as const;

export const CATEGORIES = [
  "Automation", "AI agents", "No-code tools", "Marketing and growth", "Sales and CRM", "Data and spreadsheets",
  "Freelancing and client work", "Productivity", "Business operations", "Other"
] as const;
export const LEVELS = ["beginner", "intermediate", "advanced"] as const;
export const LESSON_KINDS = ["text", "video", "quiz", "task"] as const;
export type Level = typeof LEVELS[number];
export type LessonKind = typeof LESSON_KINDS[number];
export type CourseStatus = "draft" | "submitted" | "changes_requested" | "approved" | "live" | "unlisted" | "rejected";

export const STATUS_LABEL: Record<CourseStatus, string> = {
  draft: "Draft", submitted: "In review", changes_requested: "Changes requested", approved: "Approved",
  live: "Live", unlisted: "Unlisted", rejected: "Rejected"
};
export const statusTone = (s: string) => s === "live" ? "ok" : s === "rejected" ? "bad" : (s === "submitted" || s === "changes_requested" || s === "approved") ? "warn" : "";
export const KIND_LABEL: Record<LessonKind, string> = { text: "Reading", video: "Video", quiz: "Quiz", task: "Task" };
/** Statuses in which the creator may edit content. "submitted" is locked until withdrawn; live edits re-enter review. */
export const EDITABLE: CourseStatus[] = ["draft", "changes_requested", "live", "unlisted"];
export const isEditable = (s: string) => (EDITABLE as string[]).includes(s);
export const DAY_MS = 86_400_000;

// ── Slugs and URLs ────────────────────────────────────────────────────────────

export function slugify(title: string): string {
  const s = title.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/g, "");
  return s.length >= 3 ? s : `course-${s || "new"}`.slice(0, 60);
}
export const validSlug = (s: string) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s) && s.length >= 3 && s.length <= 80;

/** Links in markdown: http(s), mailto and site-relative paths only. */
export function safeHref(raw: string): string | null {
  const s = raw.trim();
  if (/^\/(?!\/)/.test(s)) return s;
  if (/^mailto:[^\s<>"]+@[^\s<>"]+$/i.test(s)) return s;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch { return null; }
}
export function httpsUrl(raw: string, max = 500): string | null {
  const s = raw.trim();
  if (!s || s.length > max) return null;
  try { const u = new URL(s); return u.protocol === "https:" ? u.toString() : null; } catch { return null; }
}

export type Video = { provider: "youtube" | "vimeo" | "loom"; id: string; embed: string };
/** YouTube (embedded via youtube-nocookie), Vimeo (dnt=1) and Loom share links only. Anything else → null. */
export function parseVideo(raw: string | null | undefined): Video | null {
  if (!raw) return null;
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase().replace(/^(www\.|m\.)/, "");
  if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "youtu.be") {
    let id = host === "youtu.be" ? u.pathname.slice(1).split("/")[0] : (u.searchParams.get("v") || "");
    const m = /^\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})/.exec(u.pathname);
    if (m && host !== "youtu.be") id = m[1];
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? { provider: "youtube", id, embed: `https://www.youtube-nocookie.com/embed/${id}?rel=0` } : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = /^\/(?:video\/)?(\d{5,12})(?:\/([0-9a-f]{6,20}))?\/?$/.exec(u.pathname);
    if (!m) return null;
    const h = m[2] || u.searchParams.get("h") || "";
    const hash = /^[0-9a-f]{6,20}$/.test(h) ? h : "";
    return { provider: "vimeo", id: m[1], embed: `https://player.vimeo.com/video/${m[1]}?dnt=1${hash ? `&h=${hash}` : ""}` };
  }
  if (host === "loom.com") {
    const m = /^\/(?:share|embed)\/([0-9a-f]{32})\/?$/.exec(u.pathname);
    return m ? { provider: "loom", id: m[1], embed: `https://www.loom.com/embed/${m[1]}` } : null;
  }
  return null;
}

// ── Quizzes ───────────────────────────────────────────────────────────────────

export type QuizQ = { q: string; options: string[]; answer: number };
export function normaliseQuiz(raw: unknown): { ok: true; quiz: QuizQ[] } | { ok: false; error: string } {
  let v = raw;
  if (typeof v === "string") { try { v = JSON.parse(v || "[]"); } catch { return { ok: false, error: "The quiz couldn't be read. Try again." }; } }
  if (!Array.isArray(v)) return { ok: false, error: "The quiz couldn't be read. Try again." };
  if (v.length > 30) return { ok: false, error: "A quiz can have at most 30 questions." };
  const quiz: QuizQ[] = [];
  for (let i = 0; i < v.length; i++) {
    const x = v[i] as Record<string, unknown>;
    const q = String(x?.q ?? "").trim().slice(0, 500);
    const options = (Array.isArray(x?.options) ? x.options : []).map(o => String(o ?? "").trim().slice(0, 300)).filter(Boolean);
    const answer = Number(x?.answer);
    if (!q && !options.length) continue; // empty row
    if (!q) return { ok: false, error: `Question ${i + 1} has no text.` };
    if (options.length < 2 || options.length > 6) return { ok: false, error: `Question ${i + 1} needs 2 to 6 options.` };
    if (!Number.isInteger(answer) || answer < 0 || answer >= options.length) return { ok: false, error: `Choose the correct option for question ${i + 1}.` };
    quiz.push({ q, options, answer });
  }
  return { ok: true, quiz };
}
/** Server-side scoring. answers[i] is the chosen option index (or -1). */
export function scoreQuiz(quiz: QuizQ[], answers: unknown): { correct: number; total: number; percent: number; results: boolean[] } {
  const a = Array.isArray(answers) ? answers : [];
  const results = quiz.map((q, i) => Number(a[i]) === q.answer);
  const correct = results.filter(Boolean).length;
  const total = quiz.length;
  return { correct, total, percent: total ? Math.round((correct / total) * 100) : 0, results };
}
export const QUIZ_PASS = 60;

// ── Money ─────────────────────────────────────────────────────────────────────

/**
 * Paystack fee ESTIMATE (PLACEHOLDER: confirm against your Paystack pricing):
 * local cards 1.5% + ₦100 (₦100 waived under ₦2,500), capped at ₦2,000; international 3.9% + ₦100.
 */
export function paystackFeeKobo(amountKobo: number, international: boolean): number {
  if (amountKobo <= 0) return 0;
  if (international) return Math.round(amountKobo * 0.039) + 10000;
  const fee = Math.round(amountKobo * 0.015) + (amountKobo < 250000 ? 0 : 10000);
  return Math.min(fee, 200000);
}
/** Naira-kobo value of a payment: USD converts at the course's own NGN/USD price ratio. */
export function toNgnKobo(amountMinor: number, currency: "NGN" | "USD", c: { price_ngn: number; price_usd: number | null }): number {
  if (currency === "NGN") return amountMinor;
  return c.price_usd && c.price_usd > 0 ? Math.round(amountMinor * c.price_ngn / Number(c.price_usd)) : 0;
}
/** Creator earning = (gross − fee estimate) × share, floored to the kobo. */
export function creatorEarning(o: { grossNgnKobo: number; international: boolean; share: number }) {
  const fees = Math.min(o.grossNgnKobo, paystackFeeKobo(o.grossNgnKobo, o.international));
  const share = Math.max(0, Math.min(1, Number(o.share)));
  return { feesKobo: fees, amountKobo: Math.floor((o.grossNgnKobo - fees) * share) };
}
export const availableAt = (paidAt: Date) => new Date(paidAt.getTime() + MARKET.refundWindowDays * DAY_MS);

export function priceProblem(c: { price_ngn: number; price_usd: number | null; is_free?: boolean }): string | null {
  if (c.is_free) return null;
  if (!Number.isInteger(c.price_ngn) || c.price_ngn < MARKET.minPriceNgn || c.price_ngn > MARKET.maxPriceNgn)
    return `Set a naira price between ₦${MARKET.minPriceNgn.toLocaleString("en-NG")} and ₦${MARKET.maxPriceNgn.toLocaleString("en-NG")}.`;
  if (c.price_usd != null && (c.price_usd < MARKET.minPriceUsd || c.price_usd > MARKET.maxPriceUsd))
    return `Leave the dollar price empty, or set it between $${MARKET.minPriceUsd} and $${MARKET.maxPriceUsd}.`;
  return null;
}

// ── Submission checks ─────────────────────────────────────────────────────────

export type LessonLike = { title: string; kind: string; body_md: string | null; video_url: string | null; quiz: unknown; task: string | null };
export type CourseLike = { title: string; description: string | null; cover_url: string | null; price_ngn: number; price_usd: number | null; is_free?: boolean; category: string | null };

export function lessonProblem(l: LessonLike): string | null {
  const name = `"${l.title}"`;
  if (l.kind === "text" && (l.body_md || "").trim().length < 50) return `Lesson ${name} needs at least 50 characters of text.`;
  if (l.kind === "video" && !parseVideo(l.video_url)) return `Lesson ${name} needs a YouTube, Vimeo or Loom link.`;
  if (l.kind === "quiz") { const q = normaliseQuiz(l.quiz); if (!q.ok || q.quiz.length < 1) return `Quiz ${name} needs at least one complete question.`; }
  if (l.kind === "task" && (l.task || "").trim().length < 20) return `Task ${name} needs instructions (at least 20 characters).`;
  return null;
}
/** Everything that blocks "Submit for review". Empty array = ready. */
export function submitProblems(c: CourseLike, lessons: LessonLike[]): string[] {
  const out: string[] = [];
  if ((c.title || "").trim().length < 5) out.push("Give the course a title of at least 5 characters.");
  if ((c.description || "").trim().length < MARKET.minDescription) out.push(`Write a description of at least ${MARKET.minDescription} characters (now ${(c.description || "").trim().length}).`);
  if (!c.category) out.push("Choose a category.");
  if (!c.cover_url || !httpsUrl(c.cover_url)) out.push("Add a cover image URL (https).");
  const p = priceProblem(c); if (p) out.push(p);
  if (lessons.length < MARKET.minLessons) out.push(`Add at least ${MARKET.minLessons} lessons (now ${lessons.length}).`);
  for (const l of lessons) { const e = lessonProblem(l); if (e) out.push(e); }
  return out;
}

// ── Safe markdown (no raw HTML ever: we build an AST and React renders it) ───

export type Inline = { t: "text"; v: string } | { t: "code"; v: string } | { t: "b"; c: Inline[] } | { t: "i"; c: Inline[] } | { t: "a"; href: string; c: Inline[] };
export type Block = { t: "h"; level: 2 | 3 | 4; c: Inline[] } | { t: "p"; c: Inline[] } | { t: "ul" | "ol"; items: Inline[][] }
  | { t: "code"; text: string } | { t: "quote"; c: Inline[] } | { t: "hr" };

export function parseInline(s: string, depth = 0): Inline[] {
  const out: Inline[] = [];
  let buf = "", i = 0;
  const flush = () => { if (buf) { out.push({ t: "text", v: buf }); buf = ""; } };
  while (i < s.length) {
    const c = s[i];
    if (c === "\\" && i + 1 < s.length && /[\\`*_[\]()#>!.-]/.test(s[i + 1])) { buf += s[i + 1]; i += 2; continue; }
    if (c === "`") {
      const j = s.indexOf("`", i + 1);
      if (j > i + 1) { flush(); out.push({ t: "code", v: s.slice(i + 1, j) }); i = j + 1; continue; }
    }
    if (depth < 4) {
      if (c === "[") {
        const m = /^\[([^\]\n]{1,300})\]\(([^()\s]{1,2000})\)/.exec(s.slice(i));
        if (m) {
          flush();
          const href = safeHref(m[2]);
          if (href) out.push({ t: "a", href, c: parseInline(m[1], depth + 1) }); else out.push({ t: "text", v: m[1] });
          i += m[0].length; continue;
        }
      }
      if (s.startsWith("**", i) || s.startsWith("__", i)) {
        const mark = s.slice(i, i + 2);
        const j = s.indexOf(mark, i + 2);
        if (j > i + 2) { flush(); out.push({ t: "b", c: parseInline(s.slice(i + 2, j), depth + 1) }); i = j + 2; continue; }
      }
      if ((c === "*" || c === "_") && s[i + 1] && s[i + 1] !== " " && s[i + 1] !== c && (c === "*" || !/\w/.test(s[i - 1] || ""))) {
        const j = s.indexOf(c, i + 1);
        if (j > i + 1 && s[j - 1] !== " " && (c === "*" || !/\w/.test(s[j + 1] || ""))) {
          flush(); out.push({ t: "i", c: parseInline(s.slice(i + 1, j), depth + 1) }); i = j + 1; continue;
        }
      }
    }
    buf += c; i++;
  }
  flush();
  return out;
}

export function parseMarkdown(src: string): Block[] {
  const lines = String(src || "").slice(0, MARKET.maxBody).replace(/\r\n?/g, "\n").split("\n");
  const out: Block[] = [];
  let para: string[] = [];
  const flushP = () => { if (para.length) { out.push({ t: "p", c: parseInline(para.join(" ")) }); para = []; } };
  const UL = /^\s*[-*+]\s+/, OL = /^\s*\d{1,3}[.)]\s+/;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const tr = line.trim();
    if (tr.startsWith("```")) {
      flushP();
      const code: string[] = []; i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) { code.push(lines[i]); i++; }
      i++; out.push({ t: "code", text: code.join("\n") }); continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(tr);
    if (h) { flushP(); out.push({ t: "h", level: Math.min(4, h[1].length + 1) as 2 | 3 | 4, c: parseInline(h[2].replace(/\s+#+\s*$/, "")) }); i++; continue; }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(tr)) { flushP(); out.push({ t: "hr" }); i++; continue; }
    if (UL.test(line) || OL.test(line)) {
      flushP();
      const re = UL.test(line) ? UL : OL;
      const items: Inline[][] = [];
      while (i < lines.length && re.test(lines[i])) { items.push(parseInline(lines[i].replace(re, "").trim())); i++; }
      out.push({ t: re === UL ? "ul" : "ol", items }); continue;
    }
    if (tr.startsWith(">")) {
      flushP();
      const q: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) { q.push(lines[i].trim().replace(/^>\s?/, "")); i++; }
      out.push({ t: "quote", c: parseInline(q.join(" ")) }); continue;
    }
    if (!tr) { flushP(); i++; continue; }
    para.push(tr); i++;
  }
  flushP();
  return out;
}
