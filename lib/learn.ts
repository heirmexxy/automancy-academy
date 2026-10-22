import "server-only";
import fs from "node:fs";
import path from "node:path";
import { COURSE, ITEM_IDS, FREE_IDS } from "@/lib/course";

/**
 * Server-side assembly of /learn from course-build/ (written by scripts/sync-course.mjs).
 * shell.html has three markers: <!--AUTOMANCY_LESSONS-->, <!--AUTOMANCY_BOOT-->, <!--AUTOMANCY_ADDONS-->.
 */

const BUILD = path.join(process.cwd(), "course-build");
const ADDONS = path.join(process.cwd(), "course-addons");
const CACHE = process.env.NODE_ENV === "production";

type Json = Record<string, unknown>;
type Build = { shell: string; lessons: Map<string, string>; tpls: Record<string, unknown>; sheets: Record<string, unknown>; clips: Record<string, unknown> };

let buildCache: Build | null = null;
let addonCache: { at: number; js: string } | null = null;

const fileId = (id: string) => id.replace(/\./g, "-");

/** Reads course-build/ once per server process (every request in development). */
export function loadBuild(): Build {
  if (buildCache && CACHE) return buildCache;
  const shell = fs.readFileSync(path.join(BUILD, "shell.html"), "utf8");
  const lessons = new Map<string, string>();
  for (const id of ITEM_IDS) {
    const f = path.join(BUILD, "lessons", fileId(id) + ".html");
    if (fs.existsSync(f)) lessons.set(id, fs.readFileSync(f, "utf8"));
  }
  const readJson = (f: string) => { try { return JSON.parse(fs.readFileSync(path.join(BUILD, "data", f), "utf8")); } catch { return {}; } };
  buildCache = { shell, lessons, tpls: readJson("tpls.json"), sheets: readJson("sheets.json"), clips: readJson("clips.json") };
  return buildCache;
}

/** One lesson's <template> HTML (for the AI reviewer and assistant), or null. */
export function lessonHtml(id: string): string | null {
  return loadBuild().lessons.get(id) ?? null;
}

/** Every course-addons/*.js file, in name order, inlined. The folder may not exist yet. Cached for 60 s in production. */
export function loadAddons(): string {
  if (CACHE && addonCache && Date.now() - addonCache.at < 60_000) return addonCache.js;
  let js = "";
  try {
    const files = fs.readdirSync(ADDONS).filter(f => f.endsWith(".js")).sort();
    js = files.map(f => `<script data-addon="${f.replace(/[^\w.-]/g, "")}">\n${safeScript(fs.readFileSync(path.join(ADDONS, f), "utf8"))}\n</script>`).join("\n");
  } catch { js = ""; }
  addonCache = { at: Date.now(), js };
  return js;
}

/** Items a learner may open: Base Camp always; everything with an active course enrollment. */
export function allowedItems(ent: { course: boolean }): string[] {
  return ent.course ? [...ITEM_IDS] : ITEM_IDS.filter(id => FREE_IDS.has(id));
}

/** JSON that is safe inside an inline <script>. */
export function scriptJson(v: unknown): string {
  return JSON.stringify(v).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}
/** Keeps an inlined script from closing its own tag. */
function safeScript(js: string) { return js.replace(/<\/script/gi, "<\\/script"); }

export type LearnInput = {
  user: { id: string; name: string; email: string };
  ent: { course: boolean; member: boolean; story: boolean; templates: boolean; crmspec: boolean };
  progress: { done: Json; state: Json; xp: number } | null;
  reviews: { itemId: string; tier: string }[];
  settings: { live_calls_visible: boolean; cohort_open: boolean; next_cohort_date: string | null };
  siteUrl: string;
};

export const LEARN_LINKS = {
  pricing: "/pricing", community: "/community", leaderboard: "/leaderboard", hire: "/hire", earn: "/earn",
  careers: "/careers", courses: "/courses", teach: "/teach", account: "/account", logout: "/auth/signout"
};

/** The full /learn page for one learner. */
export function assembleLearnPage(input: LearnInput): string {
  const b = loadBuild();
  const allowed = allowedItems(input.ent);
  const pick = (src: Record<string, unknown>) => Object.fromEntries(allowed.filter(id => id in src).map(id => [id, src[id]]));
  const templates = allowed.map(id => b.lessons.get(id)).filter(Boolean).join("\n");

  const AUTOMANCY = {
    user: input.user,
    ent: input.ent,
    progress: { done: input.progress?.done ?? {}, state: input.progress?.state ?? {}, xp: input.progress?.xp ?? 0 },
    free: COURSE.items.filter(i => i.free).map(i => i.id),
    api: "/api",
    siteUrl: input.siteUrl,
    links: LEARN_LINKS,
    reviews: input.reviews,
    settings: { live_calls_visible: !!input.settings.live_calls_visible, cohort_open: !!input.settings.cohort_open, next_cohort_date: input.settings.next_cohort_date ?? null }
  };
  const boot = `<script>
window.AUTOMANCY = ${scriptJson(AUTOMANCY)};
window.__AUTOMANCY_DATA = ${scriptJson({ tpls: pick(b.tpls), sheets: pick(b.sheets), clips: pick(b.clips) })};
</script>`;

  // Function replacers: lesson HTML can contain "$" sequences that String.replace would interpret.
  return b.shell
    .replace("<!--AUTOMANCY_LESSONS-->", () => templates)
    .replace("<!--AUTOMANCY_BOOT-->", () => boot)
    .replace("<!--AUTOMANCY_ADDONS-->", () => loadAddons());
}

// ── Progress validation (PUT /api/progress) ─────────────────────────────────

export const STATE_MAX_BYTES = 200 * 1024;
/** Upper bound for XP: every lesson, boss, capstone, all missions and quizzes, plus generous room for journal, help, challenges and streak bonuses. */
export const XP_MAX = 25_000;
export const WEEK_XP_MAX = 6_000;

const isObj = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);

/** Monday (Africa/Lagos, UTC+1, no DST) of the week containing `now`, as YYYY-MM-DD. */
export function lagosWeekStart(now = new Date()): string {
  const lagos = new Date(now.getTime() + 60 * 60 * 1000);
  const dow = (lagos.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), lagos.getUTCDate() - dow));
  return monday.toISOString().slice(0, 10);
}

export type CleanProgress = { done: Record<string, true>; state: Json; xp: number; items_done: number; week_xp: number; week_start: string };

export type PrevProgress = { xp: number | null; week_xp: number | null; week_start: string | null } | null;

/**
 * Validates a progress body {done, state, xp, weekXp}. Returns an error string or the row to store.
 * week_xp is computed here, not trusted: XP gained since this week's Monday (Africa/Lagos). It carries over while the
 * stored week_start is this week and starts again from 0 when the week changes. The client's weekXp only caps it.
 */
export function cleanProgress(body: unknown, prev: PrevProgress = null, now = new Date()): { error: string } | { row: CleanProgress } {
  if (!isObj(body)) return { error: "Body must be a JSON object." };
  const { done, state, xp, weekXp } = body as Json;
  if (!isObj(done)) return { error: "done must be an object." };
  if (!isObj(state)) return { error: "state must be an object." };
  const stateJson = JSON.stringify(state);
  if (Buffer.byteLength(stateJson, "utf8") > STATE_MAX_BYTES) return { error: "state is larger than 200 KB." };
  const clean: Record<string, true> = {};
  for (const id of ITEM_IDS) if (done[id] === true) clean[id] = true;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : 0);
  const xpC = Math.max(0, Math.min(XP_MAX, num(xp)));
  const weekStart = lagosWeekStart(now);
  const gain = Math.max(0, xpC - Math.max(0, prev?.xp ?? 0));
  const sameWeek = !!prev && String(prev.week_start || "").slice(0, 10) === weekStart;
  // A new week (or first save) can't count more than the client says it earned in the last 7 days.
  const weekRaw = sameWeek ? Math.max(0, prev!.week_xp ?? 0) + gain : Math.min(gain, Math.max(0, num(weekXp)));
  const weekC = Math.max(0, Math.min(WEEK_XP_MAX, xpC, weekRaw));
  return { row: { done: clean, state: JSON.parse(stateJson) as Json, xp: xpC, items_done: Object.keys(clean).length, week_xp: weekC, week_start: weekStart } };
}
