#!/usr/bin/env node
/* ======================================================================
   Render the WhatsApp lesson videos (W3)
   For every lesson's default animated walkthrough ("walk:<id>") and every
   animated clip ("clip:<id>:<n>"), this opens the stand-alone preview course
   (course/flowforge.html) in headless Chromium at a portrait phone viewport,
   shows ONLY the walkthrough player (injected CSS; course source untouched),
   plays it with a fake speechSynthesis (≈2.6 words/sec, no real audio) so the
   step captions advance at a natural pace, records it, and converts it with
   ffmpeg to H.264/AAC MP4 (yuv420p, faststart, silent audio track).

   Output: out/whatsapp-media/<walk-3-4|clip-1-1-0>.mp4 (git-ignored) and the
   manifest data/whatsapp-media.json = { "walk:3.4": {url, bytes, seconds}, … }
   (url = `${MEDIA_BASE_URL}/<file>`). Existing manifest entries are kept, so
   --only renders merge into it.

   Usage:
     node scripts/render-whatsapp-videos.mjs [--only 3.4,1.1] [--walks-only | --clips-only]
         [--concurrency 2] [--out out/whatsapp-media] [--build] [--no-title] [--keep-webm] [--skip-existing] [--stills]
   Needs Playwright (global install is fine) with Chromium, and ffmpeg on PATH
   (or FFMPEG / FFPROBE env). MEDIA_BASE_URL defaults to a placeholder.
   ====================================================================== */
import { createRequire } from "node:module";
import { execFile, execFileSync, execSync } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile); /* async, so one worker's ffmpeg never blocks another worker's timing */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FFMPEG = process.env.FFMPEG || "ffmpeg";
const FFPROBE = process.env.FFPROBE || "ffprobe";
const MEDIA_BASE_URL = (process.env.MEDIA_BASE_URL || "https://YOUR-PROJECT.supabase.co/storage/v1/object/public/wa-media").replace(/\/+$/, "");
const MAX_BYTES = 16 * 1024 * 1024, TARGET_BYTES = 8 * 1024 * 1024;
const WORDS_PER_SEC = 2.6;

/* ---- args ---- */
const argv = process.argv.slice(2);
const flag = n => argv.includes(n);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const ONLY = opt("--only", "") ? opt("--only", "").split(",").map(s => s.trim()).filter(Boolean) : null;
const WALKS = !flag("--clips-only"), CLIPS = !flag("--walks-only");
const CONC = Math.max(1, parseInt(opt("--concurrency", "2"), 10) || 2);
const OUT = path.resolve(ROOT, opt("--out", "out/whatsapp-media"));
const TITLE = !flag("--no-title"), KEEP_WEBM = flag("--keep-webm");
const SKIP = flag("--skip-existing"); /* resume: skip items whose MP4 exists and is in the manifest */
const STILLS = flag("--stills"); /* QA: no video; a PNG of every step goes to <out>/stills/ */
const MANIFEST = path.join(ROOT, "data/whatsapp-media.json");
const COURSE_HTML = path.join(ROOT, "course/flowforge.html");

/* phone portrait: the player is laid out at 540×960 CSS px and zoomed 4/3 to fill a 720×1280 window,
   because Playwright records the viewport at CSS-pixel size (deviceScaleFactor does not raise video resolution) */
const VIEW = { width: 720, height: 1280 }, VIDEO = { width: 720, height: 1280 }, DSF = 1;

/* ---- playwright from a local or global install ---- */
function loadPlaywright(){
  const req = createRequire(import.meta.url);
  try { return req("playwright"); } catch {}
  try { const g = execSync("npm root -g", { encoding: "utf8" }).trim(); return createRequire(path.join(g, "noop.js"))("playwright"); } catch {}
  throw new Error("Playwright not found. Install it (npm i -g playwright) with Chromium.");
}
const { chromium } = loadPlaywright();

/* ---- in-page injections (no course source edits) ---- */
function initScript(wps){
  // fake speech: each utterance "lasts" words / wps seconds, then fires onend
  const timers = new Set();
  const ss = {
    speaking: false, pending: false, paused: false, onvoiceschanged: null,
    getVoices: () => [{ name: "Microsoft Abeo Online (Natural) - English (Nigeria)", lang: "en-NG", localService: false, default: false, voiceURI: "abeo" },
                      { name: "Microsoft Ezinne Online (Natural) - English (Nigeria)", lang: "en-NG", localService: false, default: false, voiceURI: "ezinne" }],
    speak(u){ const words = String(u.text || "").trim().split(/\s+/).filter(Boolean).length;
      const ms = Math.max(700, (words / wps) * 1000) / (u.rate || 1); ss.speaking = true;
      const t = setTimeout(() => { timers.delete(t); ss.speaking = timers.size > 0; if(u.onend) u.onend({}); }, ms); timers.add(t); },
    cancel(){ timers.forEach(clearTimeout); timers.clear(); ss.speaking = false; },
    pause(){}, resume(){}, addEventListener(){}, removeEventListener(){}
  };
  Object.defineProperty(window, "speechSynthesis", { value: ss, configurable: true });
  window.SpeechSynthesisUtterance = function(t){ this.text = t; };
  const css = `
html,body{margin:0!important;padding:0!important;overflow:hidden!important;width:100%;height:100%}
body>*:not(#wa-stage){display:none!important}
#wa-stage{position:fixed;left:0;top:0;width:540px;height:960px;zoom:1.33334;z-index:2147483000;box-sizing:border-box;padding:22px 18px 20px;display:flex;flex-direction:column;gap:12px;background:var(--paper,#faf6ec);color:var(--ink,#111)}
#wa-brand{display:flex;justify-content:space-between;align-items:baseline;gap:10px;font:600 13px/1.2 var(--mono,monospace);letter-spacing:.04em;color:var(--muted,#666);text-transform:uppercase}
#wa-brand b{color:var(--ink,#111);font-family:var(--display,sans-serif);text-transform:none;font-size:15px;letter-spacing:0}
#wa-stage .wk{flex:1;min-height:0;margin:0;padding:14px;gap:12px;display:flex;flex-direction:column;box-shadow:4px 4px 0 var(--ink,#111)}
#wa-stage .wk-pick,#wa-stage .wk-ctl,#wa-stage .wk-note{display:none!important}
#wa-stage .wk-head{flex-wrap:nowrap}
#wa-stage .wk-av{width:56px;height:56px}
#wa-stage .wk-t b{font-size:1.15rem}
#wa-stage .wk-t small{font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#wa-stage .wk-stage{display:flex;flex-direction:column;gap:14px;flex:1;min-height:0}
#wa-stage .wk-canvas{flex:1 1 470px;min-height:250px;height:auto;position:relative;display:block}
#wa-stage .wk-svg{position:absolute;inset:0;width:100%;height:100%}
#wa-stage .wkc{height:100%;box-sizing:border-box}
#wa-stage .wkc-title{font-size:1.15rem}
#wa-stage .wkc-b{font-size:.98rem}
#wa-stage .wk-panel{flex:none;align-content:start;gap:10px;padding-bottom:2px}
#wa-stage .wk-n{font-size:.85rem}
#wa-stage .wk-say{font-size:1.32rem;line-height:1.4;font-weight:500}
#wa-stage .wk-show li{font-size:.92rem;padding:6px 10px}
#wa-stage .wk-bar{height:8px;flex:none}
#wa-title{position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;justify-content:center;gap:16px;padding:48px 40px;background:var(--paper,#faf6ec);transition:opacity .35s ease}
#wa-title.out{opacity:0}
#wa-title .k{font:600 15px/1.2 var(--mono,monospace);letter-spacing:.08em;text-transform:uppercase;color:var(--muted,#666)}
#wa-title h1{margin:0;font:800 44px/1.08 var(--display,sans-serif);color:var(--ink,#111)}
#wa-title .s{font-size:21px;line-height:1.35;color:var(--ink,#111)}
#wa-title .brand{margin-top:22px;display:inline-flex;align-self:flex-start;gap:8px;align-items:center;border:2px solid var(--ink,#111);border-radius:99px;padding:8px 16px;font:700 17px/1 var(--display,sans-serif);background:var(--volt,#c6f432);box-shadow:3px 3px 0 var(--ink,#111)}`;
  const add = () => { if(document.getElementById("wa-css")) return; const s = document.createElement("style"); s.id = "wa-css"; s.textContent = css; (document.head || document.documentElement).appendChild(s); };
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", add); else add();
}

/* ---- helpers ---- */
const fileFor = key => key.replace(/:/g, "-").replace(/\./g, "-") + ".mp4";       // walk:3.4 → walk-3-4.mp4, clip:1.1:0 → clip-1-1-0.mp4
const hashFor = id => id.startsWith("B") ? "boss-" + id.slice(1) : "m-" + id.replace(".", "-");
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function probe(file){
  const j = JSON.parse((await run(FFPROBE, ["-v", "error", "-show_entries", "format=duration,size:stream=codec_name,codec_type", "-of", "json", file], { encoding: "utf8" })).stdout);
  return { seconds: Math.round(parseFloat(j.format.duration) * 10) / 10, bytes: parseInt(j.format.size, 10), codecs: j.streams.map(s => s.codec_type + ":" + s.codec_name) };
}
async function encode(webm, mp4, trim, dur){
  for(const crf of [23, 26, 29, 32, 35]){
    await run(FFMPEG, ["-y", "-v", "error", "-ss", trim.toFixed(2), "-t", dur.toFixed(2), "-i", webm, "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
      "-map", "0:v:0", "-map", "1:a:0", "-shortest",
      "-c:v", "libx264", "-preset", "medium", "-crf", String(crf), "-tune", "animation", "-pix_fmt", "yuv420p", "-r", "25",
      "-profile:v", "main", "-level", "3.1", "-vf", `scale=${VIDEO.width}:${VIDEO.height}:flags=lanczos`,
      "-c:a", "aac", "-b:a", "32k", "-movflags", "+faststart", mp4]);
    const size = fs.statSync(mp4).size;
    if(size <= TARGET_BYTES || (size <= MAX_BYTES && crf >= 29)) return crf;
  }
  if(fs.statSync(mp4).size > MAX_BYTES) throw new Error(`${path.basename(mp4)} is over 16 MB even at CRF 35`);
  return 35;
}

/* ---- discover jobs ---- */
async function discover(browser){
  const page = await browser.newPage({ viewport: VIEW });
  await page.goto(pathToFileURL(COURSE_HTML).href + "#course"); await page.waitForTimeout(300);
  const ids = await page.evaluate(() => [...document.querySelectorAll("template[data-mod]")].map(t => t.dataset.mod));
  const jobs = [];
  for(const id of ids){
    if(ONLY && !ONLY.includes(id)) continue;
    await page.evaluate(h => location.hash = h, hashFor(id)); await page.waitForTimeout(120);
    const info = await page.evaluate(() => { const W = window.__WK; if(!W || !W.el || !W.el.isConnected) return null;
      const sel = W.el.querySelector(".wk-pick select");
      return { def: sel ? +sel.value : W.cur, kinds: W.items.map(it => it.kind) }; });
    if(!info) continue;
    if(WALKS && info.kinds[info.def] !== "clip") jobs.push({ key: `walk:${id}`, id, k: info.def });
    if(CLIPS) info.kinds.map((kd, k) => [kd, k]).filter(([kd]) => kd === "clip").forEach(([, k], n) => jobs.push({ key: `clip:${id}:${n}`, id, k }));
  }
  await page.close();
  return jobs;
}

/* ---- render one item ---- */
async function render(browser, job, tmpDir){
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: DSF, ...(STILLS ? {} : { recordVideo: { dir: tmpDir, size: VIDEO } }) });
  await ctx.addInitScript(initScript, WORDS_PER_SEC);
  const page = await ctx.newPage(); const t0 = Date.now();
  const errs = []; page.on("pageerror", e => errs.push(e.message));
  try {
    await page.goto(pathToFileURL(COURSE_HTML).href + "#" + hashFor(job.id)); await page.waitForTimeout(500);
    const meta = await page.evaluate(({ k, id, title }) => {
      const W = window.__WK; if(!W || !W.el) throw new Error("no walkthrough player for " + id);
      const art = document.querySelector("#lesson article") || document;
      const h1 = art.querySelector("header.lh h1"), eb = art.querySelector("header.lh .eyebrow");
      const stage = document.createElement("div"); stage.id = "wa-stage";
      const lessonTitle = h1 ? h1.textContent.trim() : id;
      stage.innerHTML = `<div id="wa-brand"><span>${id.startsWith("B") ? "Boss " + id.slice(1) : "Lesson " + id}</span><b>Automancy Academy</b></div>`;
      document.body.appendChild(stage); stage.appendChild(W.el);
      const v = W.el.querySelector('[data-wk="voice"]'); if(v) v.checked = true;
      const sel = W.el.querySelector(".wk-pick select");
      if(sel){ sel.value = String(k); sel.dispatchEvent(new Event("change", { bubbles: true })); }
      else { const r = W.el.querySelector('[data-wk="restart"]'); if(r) r.click(); } /* single item: re-fit the camera to the new size */
      const it = W.items[W.cur], kind = W.g.kind;
      const sub = kind === "clip" ? "Animated clip · " + W.g.clip.title : (W.el.querySelector(".wk-kind") || {}).textContent || "Animated walkthrough";
      if(title){ const t = document.createElement("div"); t.id = "wa-title";
        const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
        t.innerHTML = `<div class="k">${esc(eb ? eb.textContent.trim() : "Lesson " + id)}</div><h1>${esc(lessonTitle)}</h1><div class="s">${esc(sub)}</div><div class="brand">Automancy Academy</div>`;
        stage.appendChild(t); }
      // expected narration length (same pacing as the fake voice + the player's own gaps)
      const words = s => String(s || "").trim().split(/\s+/).filter(Boolean).length;
      const est = W.steps.reduce((a, s) => a + Math.max(0.7, words(s.say) / 2.6) + (s.at === "__run" ? Math.max(2.2, W.g.edges.length * 0.68 + 0.8) : 0.65), 0);
      return { title: lessonTitle, kind, steps: W.steps.length, item: it.name, est: Math.round(est * 10) / 10 };
    }, { k: job.k, id: job.id, title: TITLE });
    await page.evaluate(() => document.fonts && document.fonts.ready); await page.waitForTimeout(400);
    if(STILLS){
      const dir = path.join(OUT, "stills"); fs.mkdirSync(dir, { recursive: true }); const base = fileFor(job.key).replace(/\.mp4$/, "");
      if(TITLE){ await page.screenshot({ path: path.join(dir, `${base}-title.png`) }); await page.evaluate(() => document.getElementById("wa-title").remove()); }
      for(let i = 0; i < meta.steps; i++){ await page.evaluate(i => document.querySelector(`#wa-stage [data-wk="${i ? "next" : "restart"}"]`).click(), i); await page.waitForTimeout(1200);
        await page.screenshot({ path: path.join(dir, `${base}-s${String(i + 1).padStart(2, "0")}.png`) }); }
      await ctx.close(); return { ...job, ...meta, stills: meta.steps, errs };
    }
    const tStart = Date.now(); let tPlay = 0;
    if(TITLE){ await page.waitForTimeout(1300); await page.evaluate(() => document.getElementById("wa-title").classList.add("out")); await page.waitForTimeout(350);
      await page.evaluate(() => document.getElementById("wa-title").remove()); }
    await page.evaluate(() => document.querySelector('#wa-stage [data-wk="play"]').click()); tPlay = Date.now();
    const limit = Date.now() + 10 * 60 * 1000;
    while(Date.now() < limit){ await sleep(250); if(!(await page.evaluate(() => window.__WK.playing))) break; }
    const played = Math.round((Date.now() - tPlay) / 100) / 10;
    const done = await page.evaluate(() => ({ i: window.__WK.i + 1, n: window.__WK.steps.length }));
    await page.waitForTimeout(1500); const tEnd = Date.now();
    const video = page.video(); await ctx.close();
    const webm = await video.path();
    const mp4 = path.join(OUT, fileFor(job.key));
    const trim = Math.max(0, (tStart - t0) / 1000 - 0.1);
    const crf = await encode(webm, mp4, trim, (tEnd - tStart) / 1000 + 0.1);
    if(!KEEP_WEBM) fs.rmSync(webm, { force: true });
    const p = await probe(mp4);
    const expect = Math.round(((tEnd - tStart) / 1000 + 0.1) * 10) / 10;
    if(Math.abs(p.seconds - expect) > Math.max(1.5, expect * 0.04)) errs.push(`duration ${p.seconds}s, expected ≈${expect}s (timing drift)`);
    return { ...job, ...meta, ...p, crf, file: path.basename(mp4), complete: done.i === done.n, played, errs };
  } catch(e){ await ctx.close().catch(() => {}); throw e; }
}

/* ---- main ---- */
(async () => {
  if(flag("--build") || !fs.existsSync(COURSE_HTML)) execFileSync("python3", ["build.py"], { cwd: path.join(ROOT, "course"), stdio: "inherit" });
  fs.mkdirSync(OUT, { recursive: true });
  const tmpDir = path.join(OUT, ".webm"); fs.mkdirSync(tmpDir, { recursive: true });
  const browser = await chromium.launch();
  let jobs = await discover(browser);
  if(SKIP && !STILLS){ const m0 = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")) : {};
    const before = jobs.length; jobs = jobs.filter(j => !(m0[j.key] && fs.existsSync(path.join(OUT, fileFor(j.key)))));
    if(before !== jobs.length) console.log(`Skipping ${before - jobs.length} already rendered.`); }
  console.log(`Rendering ${jobs.length} video(s) → ${path.relative(ROOT, OUT)} (concurrency ${CONC})`);
  const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")) : {};
  const T0 = Date.now(); let next = 0, fails = 0;
  const save = () => { const sorted = Object.fromEntries(Object.keys(manifest).sort((a, b) => a.localeCompare(b, "en", { numeric: true })).map(k => [k, manifest[k]]));
    fs.mkdirSync(path.dirname(MANIFEST), { recursive: true }); fs.writeFileSync(MANIFEST, JSON.stringify(sorted, null, 2) + "\n"); };
  const worker = async () => {
    while(next < jobs.length){ const job = jobs[next++];
      try {
        const r = await render(browser, job, tmpDir);
        if(STILLS){ console.log(`✓ ${job.key} ${r.stills} still(s)${r.errs.length ? "  errors: " + r.errs.join(" | ") : ""}`); continue; }
        manifest[job.key] = { url: `${MEDIA_BASE_URL}/${r.file}`, bytes: r.bytes, seconds: r.seconds };
        save();
        console.log(`✓ ${job.key.padEnd(14)} ${r.file.padEnd(18)} ${(r.bytes / 1048576).toFixed(2)} MB  ${r.seconds}s (played ${r.played}s, narration ≈${r.est}s, ${r.steps} steps, crf ${r.crf})${r.complete ? "" : "  [did not reach last step]"}${r.errs.length ? "  errors: " + r.errs.slice(0, 2).join(" | ") : ""}`);
        if(!r.complete) fails++;
      } catch(e){ fails++; console.error(`✗ ${job.key}: ${e.message}`); }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONC, jobs.length) }, worker));
  await browser.close();
  if(!KEEP_WEBM) fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log(`Done in ${Math.round((Date.now() - T0) / 1000)}s, ${fails} failure(s). Manifest: ${path.relative(ROOT, MANIFEST)}`);
  process.exit(fails ? 1 : 0);
})();
