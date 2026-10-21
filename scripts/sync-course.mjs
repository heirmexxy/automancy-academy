#!/usr/bin/env node
/**
 * sync-course.mjs · builds the course for the app ("app mode") from the course source folder.
 *
 * Run from the app root:   node scripts/sync-course.mjs      (or: npm run course:sync)
 *
 * COURSE_SRC is the folder that holds the single-page course (build.py, src/hub.html, src/*.js, src/modules, …).
 * Default: ./course inside the app repo (or ../course next to it). Override with the COURSE_SRC environment variable.
 *
 * Writes into course-build/ (committed with the app; /learn and the AI features read it at runtime):
 *   shell.html          the course page in app mode, with markers that /learn fills in:
 *                         <!--AUTOMANCY_LESSONS-->  the lesson <template>s this learner may open
 *                         <!--AUTOMANCY_BOOT-->     the boot <script> (window.AUTOMANCY, window.__AUTOMANCY_DATA)
 *                         <!--AUTOMANCY_ADDONS-->   course-addons/*.js, inlined
 *   lessons/<id>.html   one <template> per item ("3.4" → 3-4.html, "B3" → B3.html)
 *   data/tpls.json      template manifests per item (workflow JSON and walkthroughs included)
 *   data/sheets.json    mission sheets per item
 *   data/clips.json     animated clips per item (filtered per learner like templates)
 *   index.json          the course outline (read by lib/course.ts)
 *
 * This mirrors the course's build.py (the prototype build). Keep the two in step:
 *   - <!--APP:CUT--> … <!--/APP:CUT--> blocks in src/hub.html are removed here (prototype-only views and copy).
 *   - <!--APP:ONLY: … :APP:ONLY--> blocks are un-commented here (app-only copy).
 *   - `const APP_MODE = /*APP_MODE*\/false` becomes true here.
 *   - TPLS and SHEETS are not embedded: in app mode they come from window.__AUTOMANCY_DATA (only the items the learner may open).
 * No dependencies.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const APP_ROOT = process.cwd();
const COURSE_SRC = path.resolve(process.env.COURSE_SRC || (fs.existsSync(path.join(APP_ROOT, "course", "src")) ? path.join(APP_ROOT, "course") : path.join(APP_ROOT, "..", "course")));
const SRC = path.join(COURSE_SRC, "src");
const OUT = path.join(APP_ROOT, "course-build");

/** Track names used in index.json (lib/course.ts, emails, admin). */
const TRACK_NAMES = ["Base Camp", "Spark Street (Zapier)", "Weave Workshop (Make)", "Nodo's Forge (n8n)", "Sage's Tower (AI agents)", "The Signal Tower (Growth)", "Launchpad"];
const FREE_TRACK = 0;

const read = f => fs.readFileSync(path.join(SRC, f), "utf8");
const readJSON = f => JSON.parse(fs.readFileSync(f, "utf8"));
const list = (dir, rx) => fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => rx.test(f)).sort() : [];
function must(cond, msg) { if (!cond) { console.error("sync-course: " + msg); process.exit(1); } }
function replaceOnce(s, old, neu, what) { must(s.includes(old), `marker not found: ${what || old.slice(0, 60)}`); return s.replace(old, () => neu); }

must(fs.existsSync(path.join(SRC, "hub.html")), `course source not found at ${COURSE_SRC} (set COURSE_SRC)`);

// ── data: sheets and templates (same rules as build.py) ─────────────────────
const sheets = {};
for (const f of list(path.join(SRC, "sheets"), /\.json$/)) { const d = readJSON(path.join(SRC, "sheets", f)); sheets[d.id] = d; }
const tpls = {};
for (const f of list(path.join(SRC, "templates"), /\.json$/)) {
  const m = readJSON(path.join(SRC, "templates", f));
  for (const it of m.items || []) {
    if (!it.kind) it.kind = "n8n";
    if (it.file) {
      const folder = it.kind === "make" ? "make" : "wf";
      it.path = `templates/${folder}/${it.file}`;
      it.wf = readJSON(path.join(SRC, it.path));
    }
  }
  if (tpls[m.id]) tpls[m.id].items.push(...(m.items || []));
  else tpls[m.id] = m;
}

// ── lessons: one <template> per item ────────────────────────────────────────
const lessons = {}; // id -> template html
for (const f of list(path.join(SRC, "modules"), /\.html$/)) {
  const html = fs.readFileSync(path.join(SRC, "modules", f), "utf8");
  for (const m of html.matchAll(/<template\b[^>]*\bdata-mod="([^"]+)"[\s\S]*?<\/template>/g)) {
    must(!lessons[m[1]], `two templates for ${m[1]}`);
    lessons[m[1]] = m[0];
  }
}
const fileId = id => id.replace(/\./g, "-");

// ── shell.html ──────────────────────────────────────────────────────────────
let s = read("hub.html");
s = s.replace(/<!--APP:CUT-->[\s\S]*?<!--\/APP:CUT-->/g, "");
s = s.replace(/<!--APP:ONLY:([\s\S]*?):APP:ONLY-->/g, "$1");
s = replaceOnce(s, "const APP_MODE = /*APP_MODE*/false;", "const APP_MODE = /*APP_MODE*/true;", "APP_MODE flag");
const css = (read("lesson.css") + read("platform.css")).replace(".q > p{font-weight:700}", ".q > p:first-child{font-weight:700}");
s = replaceOnce(s, "</style>", css + "\n</style>");
const dataJs = "\n/* App mode: templates and mission sheets for the items this learner may open, sent by /learn */\n" +
  "const TPLS = (window.__AUTOMANCY_DATA && window.__AUTOMANCY_DATA.tpls) || {};\n" +
  "const SHEETS = (window.__AUTOMANCY_DATA && window.__AUTOMANCY_DATA.sheets) || {};\n";
// Animated clips are per lesson: like templates, they're sent only for lessons the learner may open.
let clips = {};
if (fs.existsSync(path.join(SRC, "clips.js"))) clips = vm.runInNewContext(read("clips.js") + "\n;CLIPS", {});
const clipsJs = "const CLIPS = (window.__AUTOMANCY_DATA && window.__AUTOMANCY_DATA.clips) || {};\n";
const js = read("lesson.js") + read("sb7.js") + read("videos.js") + dataJs + read("platform.js") + clipsJs + read("walk.js");
s = replaceOnce(s, "update();\n})();", js + "\nupdate();\nroute();\n})();", "update();})();");
s = replaceOnce(s, "<!--MODULES-->\n<script>", "<!--AUTOMANCY_LESSONS-->\n<!--AUTOMANCY_BOOT-->\n<script>", "<!--MODULES--> before the course script");
must(!/<\/script>[\s\S]*<script>/.test(s.slice(s.indexOf("<!--AUTOMANCY_BOOT-->"))), "expected one course <script> after the boot marker");
s = s.replace(/\s*$/, "");
if (/<\/body>/i.test(s)) s = s.replace(/<\/body>/i, "<!--AUTOMANCY_ADDONS-->\n</body>");
else s += "\n<!--AUTOMANCY_ADDONS-->\n</body>\n</html>\n";
if (!/^<!doctype/i.test(s)) s = "<!doctype html>\n<html lang=\"en\">\n" + s;
must(!/<!--APP:(CUT|ONLY)/.test(s), "unbalanced APP:CUT / APP:ONLY markers in hub.html");

// ── index.json ──────────────────────────────────────────────────────────────
const items = Object.keys(lessons).map(id => {
  const boss = id.startsWith("B");
  const track = Number(boss ? id.slice(1) : id.split(".")[0]);
  const h1 = (lessons[id].match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || id;
  const title = h1.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  const kind = boss ? "boss" : /capstone/i.test(title) ? "capstone" : "lesson";
  return { id, title, track, trackName: TRACK_NAMES[track] || `Track ${track}`, kind, free: track === FREE_TRACK, sessions: kind === "boss" ? 2 : kind === "capstone" ? 3 : 1 };
});
const order = it => it.track * 1000 + (it.kind === "boss" ? 999 : Number(it.id.split(".")[1]));
items.sort((a, b) => order(a) - order(b));
const index = { items, lessons: items.filter(i => i.kind !== "boss").length, bosses: items.filter(i => i.kind === "boss").length, total: items.length };

// ── write ───────────────────────────────────────────────────────────────────
fs.rmSync(path.join(OUT, "lessons"), { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "lessons"), { recursive: true });
fs.mkdirSync(path.join(OUT, "data"), { recursive: true });
fs.writeFileSync(path.join(OUT, "shell.html"), s);
for (const [id, html] of Object.entries(lessons)) fs.writeFileSync(path.join(OUT, "lessons", fileId(id) + ".html"), html + "\n");
fs.writeFileSync(path.join(OUT, "data", "tpls.json"), JSON.stringify(tpls));
fs.writeFileSync(path.join(OUT, "data", "sheets.json"), JSON.stringify(sheets));
fs.writeFileSync(path.join(OUT, "data", "clips.json"), JSON.stringify(clips));
fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index, null, 1) + "\n");
console.log(`course-build: shell ${(s.length / 1024).toFixed(0)} KB · ${items.length} lessons (${index.lessons} lessons/capstone, ${index.bosses} bosses) · ${Object.keys(tpls).length} template sets · ${Object.keys(sheets).length} sheets`);
