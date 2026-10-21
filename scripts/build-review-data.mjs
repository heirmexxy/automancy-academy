#!/usr/bin/env node
/**
 * Builds the AI reviewer's marking data from the course source (no dependencies).
 *
 *   node scripts/build-review-data.mjs [courseDir]
 *
 * courseDir defaults to $COURSE_DIR or ../course next to the app. Writes:
 *   data/sheets/<file>.json  copies of the mission sheets (model answers + "pass"/"redo" marking guides)
 *   data/missions.json       per item and tier: title, tasks and "Done when" criteria (lessons, PART 6),
 *                            or deliverables, tests, SCORING rubric rows and go-live must-haves (bosses, capstone)
 * Re-run whenever lessons or sheets change.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COURSE = path.resolve(process.argv[2] || process.env.COURSE_DIR || (fs.existsSync(path.join(APP, "course", "src")) ? path.join(APP, "course") : path.join(APP, "..", "course")));
const MODS = path.join(COURSE, "src", "modules");
const SHEETS = path.join(COURSE, "src", "sheets");
const OUT = path.join(APP, "data");

if (!fs.existsSync(MODS)) { console.error(`Course modules not found at ${MODS}`); process.exit(1); }

/* ── tiny HTML helpers ─────────────────────────────────────────────────── */
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rarr: "→", larr: "←", middot: "·", ndash: "–", mdash: "—", hellip: "…", times: "×", naira: "₦" };
export function decode(s) {
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => (n.toLowerCase() in ENT ? ENT[n.toLowerCase()] : m));
}
/** HTML → readable plain text (keeps list items, table rows and <pre> line breaks). */
export function text(html) {
  return decode(String(html)
    .replace(/<(script|style|svg)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(td|th)>/gi, " | ")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/(p|div|h\d|ul|ol|table|thead|tbody|tfoot|pre|details)>/gi, "\n")
    .replace(/<[^>]+>/g, ""))
    .replace(/[ \t]+\| *\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
const oneLine = s => text(s).replace(/\s*\n\s*/g, " ").trim();
const lis = html => [...String(html).matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map(m => oneLine(m[1])).filter(Boolean);
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

/** Split a module into its <section class="part"> blocks, keyed by the part tag text. */
function parts(html) {
  const out = [];
  const re = /<section class="part"[\s\S]*?<\/section>/gi;
  for (const m of html.matchAll(re)) {
    const tag = (m[0].match(/class="tag">([^<]*)</) || [])[1] || "";
    const h2 = (m[0].match(/<h2>([\s\S]*?)<\/h2>/) || [])[1] || "";
    out.push({ tag: decode(tag).trim(), h2: oneLine(h2), html: m[0] });
  }
  return out;
}
/** Balanced <div …class="cls"…> blocks (the course nests divs inside missions and steps). */
function divBlocks(html, cls) {
  const out = []; const open = new RegExp(`<div class="${cls}"[^>]*>`, "g"); let m;
  while ((m = open.exec(html))) {
    let depth = 1, i = m.index + m[0].length; const tagRe = /<\/?div\b[^>]*>/g; tagRe.lastIndex = i; let t;
    while (depth && (t = tagRe.exec(html))) { depth += t[0][1] === "/" ? -1 : 1; i = tagRe.lastIndex; }
    out.push(html.slice(m.index, i)); open.lastIndex = i;
  }
  return out;
}
const preById = (html, prefix) => [...html.matchAll(/<pre id="([^"]+)"[^>]*>([\s\S]*?)<\/pre>/g)]
  .filter(m => !prefix || prefix.some(p => m[1].startsWith(p))).map(m => ({ id: m[1], text: decode(m[2].replace(/<[^>]+>/g, "")).trim() }));

/* ── lessons: PART 6 missions ──────────────────────────────────────────── */
const TIER_NAME = { b: "Bronze", s: "Silver", g: "Gold" };
function lessonTiers(html) {
  const p6 = parts(html).find(p => /^PART 6/.test(p.tag));
  if (!p6) return {};
  const tiers = {};
  for (const block of divBlocks(p6.html, "mission")) {
    const cls = (block.match(/class="tier (t-[bsg])"/) || [])[1];
    if (!cls) continue;
    const tier = cls.slice(2);
    const title = oneLine((block.match(/<h4>([\s\S]*?)<\/h4>/) || [])[1] || "");
    const [before, after = ""] = block.split(/<span class="crit">[^<]*<\/span>/);
    const body = before.replace(/<span class="tier[\s\S]*?<\/span>/, "").replace(/<h4>[\s\S]*?<\/h4>/, "");
    const tasks = lis(body);
    // Missions with a paragraph or a table instead of bullets (e.g. 6.4 Silver): keep them as context.
    const extra = text(body.replace(/<ul>[\s\S]*?<\/ul>/gi, "")).trim();
    tiers[tier] = { tier, label: TIER_NAME[tier], title, tasks, context: extra ? clip(extra, 1500) : "", doneWhen: lis(after) };
  }
  return tiers;
}

/* ── bosses and capstone: deliverables, tests, rubric, must-haves ──────── */
function rubric(html) {
  const sc = parts(html).find(p => p.tag === "SCORING");
  if (!sc) return { rows: [], total: 0, winRule: "" };
  const rows = [...(sc.html.match(/<tbody>([\s\S]*?)<\/tbody>/) || ["", ""])[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(r => {
    const tds = [...r[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(c => oneLine(c[1]));
    return { area: tds[0], full: tds[1], points: Number(tds[2]) || 0 };
  });
  const foot = [...((sc.html.match(/<tfoot>([\s\S]*?)<\/tfoot>/) || ["", ""])[1]).matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(c => oneLine(c[1]));
  return { rows, total: rows.reduce((s, r) => s + r.points, 0), winRule: foot[1] || "Win at 80 or more" };
}
function readyCheck(html) {
  const p = parts(html).find(x => /GO-LIVE CHECK|HANDOVER CHECK/.test(x.tag));
  if (!p) return { name: "", checks: [], mustHaves: [] };
  const checks = []; let group = "";
  for (const m of p.html.matchAll(/<h5>([\s\S]*?)<\/h5>|<label>([\s\S]*?)<\/label>/g)) {
    if (m[1] !== undefined) { group = oneLine(m[1]); continue; }
    const must = /class="must"/.test(m[2]);
    const name = oneLine(m[2].replace(/<span class="must">[\s\S]*?<\/span>/, ""));
    checks.push({ group, name, must });
  }
  return { name: p.tag.toLowerCase().replace(/^./, c => c.toUpperCase()), checks, mustHaves: checks.filter(c => c.must).map(c => c.name) };
}
function deliverables(html) {
  const p = parts(html).find(x => x.tag === "YOUR MISSION");
  if (!p) return { list: [], tests: [] };
  const list = divBlocks(p.html, "step").map(s => {
    const clean = s.replace(/<details[\s\S]*?<\/details>/gi, "");
    const name = oneLine(((clean.match(/<h4>([\s\S]*?)<\/h4>/) || [])[1] || "").replace(/<span class="soon">[\s\S]*?<\/span>/, ""));
    const detail = clip(text(clean.replace(/<h4>[\s\S]*?<\/h4>/, "")), 900);
    return { name, detail };
  }).filter(d => d.name);
  const tests = preById(p.html).map(x => ({ id: x.id, text: clip(x.text, 3500) }));
  return { list, tests };
}
function bossTier(html, id, kind) {
  const r = rubric(html), ready = readyCheck(html), d = deliverables(html);
  if (kind === "capstone") {
    // The capstone has no YOUR MISSION section: its deliverables are the Bronze capstone mission's tasks,
    // and its tests are the end-to-end test table in the guided build.
    const b = lessonTiers(html).b;
    if (b) d.list = b.tasks.map((t, i) => ({ name: `Capstone task ${i + 1}`, detail: t }));
    d.tests = preById(html, ["e2e-"]).map(x => ({ id: x.id, text: clip(x.text, 3500) }));
  }
  return {
    tier: kind === "capstone" ? "capstone" : "boss",
    label: kind === "capstone" ? "Capstone" : "Boss project",
    title: kind === "capstone" ? "Grand Capstone" : `Boss ${id.slice(1)}`,
    deliverables: d.list,
    tests: d.tests,
    rubric: r.rows,
    total: r.total,
    passMark: 80,
    winRule: r.winRule,
    checkName: ready.name,
    checks: ready.checks,
    mustHaves: ready.mustHaves
  };
}

/* ── main ──────────────────────────────────────────────────────────────── */
let titles = {};
try { for (const it of JSON.parse(fs.readFileSync(path.join(APP, "course-build", "index.json"), "utf8")).items) titles[it.id] = { title: decode(it.title), kind: it.kind }; } catch { /* index optional */ }

const items = {};
const problems = [];
for (const f of fs.readdirSync(MODS).filter(f => f.endsWith(".html")).sort()) {
  const html = fs.readFileSync(path.join(MODS, f), "utf8");
  const id = (html.match(/<template data-mod="([^"]+)"/) || [])[1];
  if (!id) { problems.push(`${f}: no <template data-mod>`); continue; }
  const kind = id.startsWith("B") ? "boss" : (titles[id]?.kind === "capstone" || id === "6.4") ? "capstone" : "lesson";
  const h1 = oneLine((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "");
  const entry = { id, title: titles[id]?.title || h1 || id, kind, tiers: {} };
  if (kind !== "boss") entry.tiers = lessonTiers(html);
  if (kind !== "lesson") entry.tiers[kind === "capstone" ? "capstone" : "boss"] = bossTier(html, id, kind);
  const log = preById(html, ["log-"])[0];
  const docs = preById(html, ["docs-"])[0];
  entry.logTemplate = log ? log.text : docs ? docs.text : "";
  for (const t of ["b", "s", "g"]) if (kind !== "boss" && !entry.tiers[t]) problems.push(`${id}: missing ${TIER_NAME[t]} mission`);
  for (const [t, v] of Object.entries(entry.tiers)) {
    if ("doneWhen" in v && !v.doneWhen.length) problems.push(`${id}/${t}: no "Done when" criteria`);
    if ("rubric" in v && (!v.rubric.length || v.total !== 100)) problems.push(`${id}/${t}: rubric total ${v.total} (expected 100)`);
  }
  items[id] = entry;
}

fs.mkdirSync(path.join(OUT, "sheets"), { recursive: true });
let sheets = 0;
if (fs.existsSync(SHEETS)) {
  for (const f of fs.readdirSync(SHEETS).filter(f => /\.json$/.test(f))) {
    const raw = fs.readFileSync(path.join(SHEETS, f), "utf8");
    try { JSON.parse(raw); } catch (e) { problems.push(`sheet ${f}: ${e.message}`); continue; }
    fs.writeFileSync(path.join(OUT, "sheets", f), raw); sheets++;
  }
}
const sheetFile = id => id.replace(/\./g, "-") + ".json";
for (const id of Object.keys(items)) {
  items[id].sheet = fs.existsSync(path.join(OUT, "sheets", sheetFile(id))) ? sheetFile(id) : null;
  if (!items[id].sheet) problems.push(`${id}: no mission sheet`);
}

const out = { generated: new Date().toISOString(), source: "course/src/modules + course/src/sheets", items };
fs.writeFileSync(path.join(OUT, "missions.json"), JSON.stringify(out, null, 1) + "\n");
console.log(`missions.json: ${Object.keys(items).length} items · sheets copied: ${sheets}`);
if (problems.length) { console.log("Check:"); problems.forEach(p => console.log("  - " + p)); }
