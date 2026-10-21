import "server-only";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createAdminClient } from "@/lib/supabase/admin";
import { COURSE, itemById } from "@/lib/course";

/* ════════════════════════════════════════════════════════════════════════════
 * Natural Nigerian voices (Azure AI Speech) with a Supabase Storage cache.
 * The first section is pure text handling (no I/O) so it can be unit-tested;
 * the second talks to Azure and Supabase and is server-only.
 * ════════════════════════════════════════════════════════════════════════════ */

// ── Pure text helpers ──────────────────────────────────────────────────────

export const VOICES = { male: "en-NG-AbeoNeural", female: "en-NG-EzinneNeural" } as const;
export type VoiceKey = keyof typeof VOICES;
export const isVoiceKey = (v: unknown): v is VoiceKey => v === "male" || v === "female";

/** Azure's per-request text budget we stay under; long text is split and the MP3s joined. */
export const CHUNK_MAX = 3000;
/** Our narration sits a little slower than Azure's default: easier to follow for new learners. */
const BASE_RATE = 0.94;

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rarr: "→", larr: "←", mdash: "—", ndash: "–",
  hellip: "…", times: "×", middot: "·", bull: "•", asymp: "≈", le: "≤", ge: "≥", rsquo: "’", lsquo: "‘",
  rdquo: "”", ldquo: "“", copy: "©", deg: "°", naira: "₦"
};
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : "";
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

/** Same clean-up as the course's speakable(): naira amounts, no emoji, symbols read as words. */
export function speakable(t: string): string {
  return t
    .replace(/\b[A-Z]{6,}\b/g, w => w.charAt(0) + w.slice(1).toLowerCase())
    .replace(/\p{Extended_Pictographic}|️|‍/gu, "")
    .replace(/₦\s?(\d[\d,.]*?)(?:\s?(k|m)\b)?(?=[^\d,.]|[.,](?!\d)|$)/gi,(_m, n: string, u?: string) => `${n}${u ? (u.toLowerCase() === "k" ? " thousand" : " million") : ""} naira`)
    .replace(/₦/g, " naira ")
    .replace(/[·•]/g, ", ").replace(/→/g, " to ").replace(/←/g, " from ").replace(/≈/g, "about ").replace(/≤/g, "at most ")
    .replace(/≥/g, "at least ").replace(/×/g, " times ").replace(/[▶■❚↺↓↑]/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1").replace(/([,;:])\1+/g, "$1").replace(/^[\s,.;:]+/, "")
    .replace(/\s+/g, " ").trim();
}

/** Split at sentence boundaries into pieces of at most `max` characters. */
export function splitText(t: string, max = CHUNK_MAX): string[] {
  const out: string[] = []; let cur = "";
  for (let sn of t.split(/(?<=[.!?:;])\s+/)) {
    while (sn.length > max) {
      const comma = sn.lastIndexOf(", ", max - 1); const space = sn.lastIndexOf(" ", max - 1);
      const cut = comma > max / 3 ? comma + 1 : space > 0 ? space : max;
      if (cur) { out.push(cur); cur = ""; }
      out.push(sn.slice(0, cut).trim()); sn = sn.slice(cut).trim();
    }
    if (!sn) continue;
    if (cur && (cur + " " + sn).length > max) { out.push(cur); cur = sn; }
    else cur = cur ? cur + " " + sn : sn;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export const escapeXml = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]!));

/** A speed multiplier (1 = normal) clamped to a sensible range. */
export const clampRate = (r: unknown) => { const n = Number(r); return Number.isFinite(n) && n > 0 ? Math.min(1.6, Math.max(0.6, n)) : 1; };

export function buildSsml(text: string, voice: VoiceKey, rate = 1): string {
  const pct = Math.round((BASE_RATE * clampRate(rate) - 1) * 100);
  const body = escapeXml(text).replace(/([.!?])\s+/g, '$1 <break time="250ms"/> ');
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-NG"><voice name="${VOICES[voice]}"><prosody rate="${pct >= 0 ? "+" : ""}${pct}%">${body}</prosody></voice></speak>`;
}

export const ttsHash = (voice: VoiceKey, rate: number, text: string) =>
  createHash("sha256").update(`${VOICES[voice]}|${clampRate(rate).toFixed(2)}|${text}`).digest("hex");

/** course-build/lessons file for an item id: "3.4" → "3-4.html", "B3" → "B3.html". */
export const lessonFileName = (id: string) => (/^(\d\.\d{1,2}|B\d)$/.test(id) ? id.replace(".", "-") + ".html" : null);

// Minimal HTML rewriting (the lesson files are our own trusted markup, so a careful tag scanner is enough).
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr", "use", "path", "circle", "rect"]);
const hasClass = (tag: string, c: string) => { const m = tag.match(/\bclass\s*=\s*"([^"]*)"/i); return !!m && m[1].split(/\s+/).includes(c); };

/** Replace each element whose opening tag passes `test` (nesting-aware) with fn(openTag, innerHtml). */
export function rewriteElements(html: string, test: (tag: string, name: string) => boolean, fn: (tag: string, inner: string) => string): string {
  const re = /<([a-zA-Z][\w-]*)\b[^>]*?(\/?)>/g;
  let out = "", last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const name = m[1].toLowerCase();
    if (!test(m[0], name)) continue;
    const start = m.index, openEnd = re.lastIndex;
    if (m[2] || VOID.has(name)) { out += html.slice(last, start) + fn(m[0], ""); last = openEnd; continue; }
    const inner = new RegExp(`<(/?)${name}\\b[^>]*?(/?)>`, "gi"); inner.lastIndex = openEnd;
    let depth = 1, end = html.length, innerEnd = html.length, n: RegExpExecArray | null;
    while ((n = inner.exec(html))) {
      if (n[1]) { if (--depth === 0) { innerEnd = n.index; end = inner.lastIndex; break; } }
      else if (!n[2]) depth++;
    }
    out += html.slice(last, start) + fn(m[0], html.slice(openEnd, innerEnd));
    last = end; re.lastIndex = end;
  }
  return out + html.slice(last);
}
const drop = (html: string, test: (tag: string, name: string) => boolean) => rewriteElements(html, test, () => " ");

const BLOCK = /<\/?(h[1-6]|p|li|ul|ol|div|section|article|header|footer|figure|figcaption|blockquote|summary|details|tr|table|thead|tbody|dl|dt|dd|br|hr|aside|nav|main|pre)\b[^>]*>/gi;

/**
 * Turn a lesson's <template> markup into plain text.
 * mode "speech": narration for audio (code blocks become a short spoken note, tables read row by row).
 * mode "ai": context for the course assistant (code kept).
 * Both skip quiz answers and reveals, facilitator notes, buttons, form controls and drawings.
 */
export function lessonHtmlToText(html: string, mode: "speech" | "ai" = "speech"): string {
  let h = (html.match(/<template\b[^>]*>([\s\S]*)<\/template>/i)?.[1] ?? html).replace(/<!--[\s\S]*?-->/g, " ");
  // Drawings, scripts and staff-only notes
  h = drop(h, (t, n) => n === "svg" || n === "script" || n === "style" || n === "noscript" || n === "canvas" || n === "iframe" || n === "video"
    || hasClass(t, "facil") || hasClass(t, "kicker") || hasClass(t, "lesson-top") || hasClass(t, "tplbox") || hasClass(t, "wk"));
  // Quiz answers: feedback lines and "reveal" panels never get read or sent
  h = drop(h, (t, n) => hasClass(t, "fb") || hasClass(t, "qscore") || (n === "details" && hasClass(t, "reveal")));
  h = h.replace(/<button\b[^>]*\bdata-opt="(\w)"[^>]*>([\s\S]*?)<\/button>/gi, (_m, k: string, txt: string) => `<p>Option ${k.toUpperCase()}: ${txt}.</p>`);
  h = rewriteElements(h, (t, n) => n === "div" && hasClass(t, "quiz"), (_t, inner) =>
    `<p>${mode === "speech" ? "Quick quiz. Pause after each question, then check your answers in the lesson." : "Quiz (answers are checked in the lesson)."}</p>${inner}`);
  // Other closed panels: read the summary only in audio; keep everything for the assistant
  if (mode === "speech") h = rewriteElements(h, (_t, n) => n === "details", (_t, inner) => `<p>${inner.match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/i)?.[1] ?? ""}</p>`);
  h = drop(h, (t, n) => n === "button" || n === "select" || n === "textarea" || n === "input" || hasClass(t, "mdone"));
  h = h.replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, (_m, inner: string) => {
    const code = decodeEntities(inner.replace(/<[^>]+>/g, ""));
    if (mode === "ai") return `\n\`\`\`\n${code.trim()}\n\`\`\`\n`;
    return /AUTOMANCY LOG|^#|\|/.test(code.trim().slice(0, 40)) ? "<p>There's a template you can copy in the lesson.</p>" : "<p>There's a code example in the lesson.</p>";
  });
  h = h.replace(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi, (_m, row: string) => {
    const cells = [...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c => c[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()).filter(Boolean);
    return cells.length ? `<p>${cells.join(mode === "ai" ? " | " : ", ")}.</p>` : " ";
  });
  // Keep fenced code intact while flattening the rest
  const fences: string[] = [];
  h = h.replace(/\n```\n[\s\S]*?\n```\n/g, f => { fences.push(f.trim()); return `\n@@FENCE${fences.length - 1}@@\n`; });
  const text = decodeEntities(h.replace(BLOCK, "\n").replace(/<[^>]+>/g, " "));
  const lines = text.split("\n").map(l => l.replace(/\s+/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim()).filter(l => l.length > 1 || /^\w$/.test(l))
    .map(l => (/^@@FENCE\d+@@$/.test(l) ? l : /[.!?:;…"”)]$/.test(l) ? l : l + "."));
  if (mode === "ai") return lines.join("\n").replace(/@@FENCE(\d+)@@/g, (_m, i: string) => fences[Number(i)]);
  return speakable(lines.join(" "));
}

// ── Server: Azure + cache ──────────────────────────────────────────────────

const BUCKET = "tts";
export const DAILY_CHARS = () => Number(process.env.TTS_DAILY_CHARS || 60000);

async function azureChunk(text: string, voice: VoiceKey, rate: number): Promise<Buffer> {
  const region = process.env.AZURE_SPEECH_REGION, key = process.env.AZURE_SPEECH_KEY;
  if (!region || !key) throw new Error("Azure Speech is not configured");
  const ssml = buildSsml(text, voice, rate);
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        "User-Agent": "AutomancyAcademy"
      },
      body: ssml,
      signal: AbortSignal.timeout(90_000),
      cache: "no-store"
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    if ((res.status === 429 || res.status >= 500) && attempt < 2) { await new Promise(r => setTimeout(r, 800 * (attempt + 1) * (attempt + 1))); continue; }
    throw new Error(`Azure Speech error ${res.status}`);
  }
  throw new Error("Azure Speech unavailable");
}

function publicUrl(p: string) {
  return createAdminClient().storage.from(BUCKET).getPublicUrl(p).data.publicUrl;
}

/** Public URL of an already-generated clip, or null. */
export async function cachedUrl(hash: string): Promise<string | null> {
  const { data } = await createAdminClient().from("tts_cache").select("path").eq("hash", hash).maybeSingle();
  return data?.path ? publicUrl(data.path as string) : null;
}

export type TtsResult = { url: string; cached: boolean; chars: number; hash: string };

/**
 * Text (already cleaned with speakable) → cached MP3 URL. Generates with Azure on a miss.
 * Only call after checking who is asking (uses the service-role client).
 */
export async function synthesize(text: string, voice: VoiceKey, rate = 1, meta: { kind?: "clip" | "lesson"; itemId?: string } = {}): Promise<TtsResult> {
  const r = clampRate(rate);
  const hash = ttsHash(voice, r, text);
  const hit = await cachedUrl(hash);
  if (hit) return { url: hit, cached: true, chars: text.length, hash };
  const parts: Buffer[] = [];
  for (const piece of splitText(text, CHUNK_MAX)) parts.push(await azureChunk(piece, voice, r)); // sequential: Azure free tier allows little concurrency
  const mp3 = Buffer.concat(parts); // same codec/bitrate on every frame, so joined MP3s play as one file
  const kind = meta.kind || "clip";
  const p = kind === "lesson" && meta.itemId ? `lessons/${meta.itemId.replace(".", "-")}-${hash.slice(0, 16)}.mp3` : `clips/${hash.slice(0, 2)}/${hash}.mp3`;
  const admin = createAdminClient();
  const up = await admin.storage.from(BUCKET).upload(p, mp3, { contentType: "audio/mpeg", cacheControl: "31536000", upsert: true });
  if (up.error) throw new Error("Storage upload failed: " + up.error.message);
  await admin.from("tts_cache").upsert({ hash, voice: VOICES[voice], chars: text.length, path: p, kind, item_id: meta.itemId ?? null });
  return { url: publicUrl(p), cached: false, chars: text.length, hash };
}

/**
 * Add `chars` to today's TTS usage for a user. Returns false when it would pass the daily budget.
 * A negative number refunds (used when Azure fails after charging).
 */
export async function chargeTts(userId: string, chars: number): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("tts_charge", { p_user: userId, p_chars: chars, p_limit: DAILY_CHARS() });
  if (error) throw new Error("Usage check failed: " + error.message);
  return data !== null && data !== undefined;
}

/** Raw markup of a lesson from course-build/lessons (written by the course build). */
export async function lessonHtml(id: string): Promise<string> {
  const f = lessonFileName(id);
  if (!f || !itemById(id)) throw new Error("Unknown lesson");
  try { return await readFile(path.join(process.cwd(), "course-build", "lessons", f), "utf8"); }
  catch { throw new Error(`Lesson text for ${id} has not been built yet`); }
}

/** Guides alternate through the course like the in-course guide cards: even positions Emeka (male), odd Miracle (female). */
export const lessonVoice = (id: string): VoiceKey => (Math.max(0, COURSE.items.findIndex(i => i.id === id)) % 2 === 0 ? "male" : "female");

export async function lessonNarration(id: string): Promise<string> {
  const text = lessonHtmlToText(await lessonHtml(id), "speech");
  if (text.length < 20) throw new Error(`Lesson ${id} has no readable text`);
  return text;
}

/** Whole-lesson MP3 (generated once, then served from the cache). */
export async function lessonAudio(id: string): Promise<TtsResult> {
  return synthesize(await lessonNarration(id), lessonVoice(id), 1, { kind: "lesson", itemId: id });
}
