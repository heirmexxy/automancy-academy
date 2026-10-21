/**
 * Pure WhatsApp helpers: signature check, phone numbers, text splitting and formatting, command parsing,
 * lesson-script validation and card rendering. No "@/" imports and no network or database I/O, so it can be
 * unit-tested with `tsx --test tests/whatsapp.test.mjs`.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/* ── WhatsApp Cloud API limits ─────────────────────────────────────────── */
export const WA = {
  textMax: 4096,          // text message body
  interactiveBody: 1024,  // interactive (buttons / list) body
  captionMax: 1024,       // media caption
  buttonTitle: 20,        // reply button title
  buttonsMax: 3,
  rowTitle: 24,           // list row title
  rowDescription: 72,
  rowsMax: 10,
  listButton: 20,         // the list's open button
  footerMax: 60,
  headerMax: 60,
  idMax: 256
};

/* ── Signature (X-Hub-Signature-256: "sha256=<hex>") ───────────────────── */
export function verifySignature(rawBody: string | Buffer, header: string | null | undefined, appSecret: string | undefined): boolean {
  if (!appSecret || !header) return false;
  const m = /^sha256=([0-9a-f]{64})$/i.exec(header.trim());
  if (!m) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest();
  const given = Buffer.from(m[1], "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
export function signBody(rawBody: string, appSecret: string) {
  return "sha256=" + createHmac("sha256", appSecret).update(rawBody).digest("hex");
}

/* ── Phone numbers ─────────────────────────────────────────────────────── */
/**
 * Normalises a phone number to E.164 ("+2348031234567"). Nigerian local formats are understood:
 * 08031234567, 8031234567, 2348031234567, +234 803 123 4567, 00234…, +234 0803… . Other countries need the
 * country code (with + or 00). Returns null when it can't be a valid number.
 */
export function normalisePhone(input: unknown): string | null {
  let s = String(input ?? "").trim();
  if (!s) return null;
  const plus = s.startsWith("+");
  s = s.replace(/[\s().\- ]/g, "");
  if (plus) s = s.slice(1);
  if (!/^\d+$/.test(s)) return null;
  if (!plus && s.startsWith("00")) s = s.slice(2);
  else if (!plus && /^0[789][01]\d{8}$/.test(s)) s = "234" + s.slice(1);     // 0803 123 4567
  else if (!plus && /^[789][01]\d{8}$/.test(s)) s = "234" + s;               // 803 123 4567
  if (s.startsWith("2340") && s.length === 14) s = "234" + s.slice(4);        // +234 0803…
  if (s.startsWith("234")) return /^234[789][01]\d{8}$/.test(s) ? "+" + s : null;
  if (!plus && !String(input).trim().startsWith("00") && s.length < 11) return null;
  return /^[1-9]\d{7,14}$/.test(s) ? "+" + s : null;
}
/** WhatsApp ids are E.164 digits without the plus. */
export const waIdOf = (e164: string) => e164.replace(/^\+/, "");
/** "+234 803 *** 4567" for admin screens. */
export function maskPhone(e164: string | null | undefined): string {
  const d = String(e164 || "").replace(/\D/g, "");
  if (d.length < 8) return d ? "***" : "";
  return d.startsWith("234") ? `+234 ${d.slice(3, 6)} *** ${d.slice(-4)}` : `+${d.slice(0, d.length - 7)} *** ${d.slice(-4)}`;
}

/* ── Text helpers ──────────────────────────────────────────────────────── */
const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rarr: "→", middot: "·", ndash: "–", mdash: "—", hellip: "…" };
export const decodeEntities = (s: string) => String(s ?? "")
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
export const clip = (s: string, n: number) => {
  const t = String(s ?? "");
  return t.length > n ? t.slice(0, Math.max(0, n - 1)).trimEnd() + "…" : t;
};
const CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
export const cleanInbound = (s: unknown, max = 20000) => String(s ?? "").replace(CTRL, "").replace(/\r\n/g, "\n").trim().slice(0, max);

/** Splits long text into chunks ≤ max, preferring paragraph, then line, then sentence, then word breaks. */
export function splitText(text: string, max = WA.textMax): string[] {
  const out: string[] = [];
  let rest = String(text ?? "").trim();
  while (rest.length > max) {
    const win = rest.slice(0, max + 1);
    let cut = -1;
    for (const sep of ["\n\n", "\n", ". ", " "]) {
      const i = win.lastIndexOf(sep);
      if (i >= max * 0.4) { cut = i + (sep === ". " ? 1 : 0); break; }
    }
    if (cut <= 0) cut = max;
    out.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  if (rest) out.push(rest);
  return out;
}

/** Converts Markdown (from Sage) to WhatsApp formatting: **bold** → *bold*, headings → bold lines, links → "text (url)". */
export function toWhatsAppText(md: string): string {
  return String(md ?? "")
    .replace(/```[a-z]*\n?/gi, "```")
    .replace(/^#{1,6}\s+(.+)$/gm, "*$1*")
    .replace(/\*\*(.+?)\*\*/g, "*$1*")
    .replace(/__(.+?)__/g, "_$1_")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, "$1 ($2)")
    .replace(/^\s*[*+]\s+/gm, "- ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* ── Course ids ────────────────────────────────────────────────────────── */
export const fileIdOf = (id: string) => id.replace(/\./g, "-");
/** Where an item opens in the web course (/learn): lessons #m-3-4, bosses #boss-3. */
export const appAnchor = (id: string) => (id.startsWith("B") ? `#boss-${id.slice(1)}` : `#m-${fileIdOf(id)}`);
export const itemLabel = (id: string) => (id.startsWith("B") ? `Boss ${id.slice(1)}` : `Lesson ${id}`);
/** "3.4", "3-4", "lesson 3.4", "b3", "boss 3", "B 3" → canonical id (unchecked against the course). */
export function parseItemId(input: string): string | null {
  const s = String(input || "").trim().toUpperCase().replace(/^LESSON\s*/, "");
  let m = /^(?:B|BOSS)\s*(\d)$/.exec(s);
  if (m) return "B" + m[1];
  m = /^(\d)\s*[.\-, ]\s*(\d{1,2})$/.exec(s);
  if (m) return `${m[1]}.${Number(m[2])}`;
  return null;
}

/* ── Commands ──────────────────────────────────────────────────────────── */
export type Command =
  | { cmd: "link"; code: string }
  | { cmd: "start" } | { cmd: "menu" } | { cmd: "next" } | { cmd: "continue" } | { cmd: "repeat" } | { cmd: "back" }
  | { cmd: "lesson"; id: string } | { cmd: "lessons"; track: number | null } | { cmd: "tracks" }
  | { cmd: "progress" } | { cmd: "help"; question: string } | { cmd: "pause" } | { cmd: "resume" }
  | { cmd: "reminders"; on: boolean } | { cmd: "stop" } | { cmd: "skip" } | { cmd: "reveal" }
  | { cmd: "answer"; card: number | null; option: number };

const WORD: Record<string, Command> = {
  START: { cmd: "start" }, HI: { cmd: "start" }, HELLO: { cmd: "start" }, HEY: { cmd: "start" }, UNSTOP: { cmd: "start" },
  MENU: { cmd: "menu" }, NEXT: { cmd: "next" }, CONTINUE: { cmd: "continue" }, REPEAT: { cmd: "repeat" }, AGAIN: { cmd: "repeat" },
  BACK: { cmd: "back" }, PREVIOUS: { cmd: "back" }, PROGRESS: { cmd: "progress" }, PAUSE: { cmd: "pause" }, RESUME: { cmd: "resume" },
  STOP: { cmd: "stop" }, UNSUBSCRIBE: { cmd: "stop" }, "OPT OUT": { cmd: "stop" }, OPTOUT: { cmd: "stop" }, "STOP ALL": { cmd: "stop" },
  SKIP: { cmd: "skip" }, REVEAL: { cmd: "reveal" }, TRACKS: { cmd: "tracks" }, LESSONS: { cmd: "lessons", track: null },
  "CHOOSE LESSON": { cmd: "lessons", track: null }, "MY PROGRESS": { cmd: "progress" },
  "NEXT LESSON": { cmd: "next" }, "STOP REMINDERS": { cmd: "reminders", on: false }
};

/**
 * Parses a learner's message or a button/list reply id. Button ids are the command text itself ("NEXT",
 * "LESSON 3.4", "ANS 4 2"), so typed and tapped commands go through one path. Returns null for free text.
 * `strict`: only short, whole-message commands count (used while a task is waiting for the learner's work, so a
 * submission that happens to start with "Next" isn't swallowed). HELP and STOP always count.
 */
export function parseCommand(input: string, opts: { strict?: boolean } = {}): Command | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  const s = raw.replace(/\s+/g, " ").replace(/[.!?]+$/, "");
  const up = s.toUpperCase();
  if (WORD[up]) return WORD[up];
  let m = /^LINK\s*:?\s*(\d{6})$/i.exec(s);
  if (m) return { cmd: "link", code: m[1] };
  m = /^HELP(?:\s*[:,-]?\s+([\s\S]+))?$/i.exec(raw.trim());
  if (m) return { cmd: "help", question: (m[1] || "").trim() };
  if (opts.strict && s.length > 40) return null;
  m = /^(?:LESSON|OPEN|GO TO)\s+(.+)$/i.exec(s);
  if (m) { const id = parseItemId(m[1]); if (id) return { cmd: "lesson", id }; }
  m = /^BOSS\s*(\d)$/i.exec(s);
  if (m) return { cmd: "lesson", id: "B" + m[1] };
  m = /^(?:LESSONS|TRACK)\s+(\d)$/i.exec(s);
  if (m) return { cmd: "lessons", track: Number(m[1]) };
  m = /^REMINDERS?\s+(ON|OFF)$/i.exec(s);
  if (m) return { cmd: "reminders", on: m[1].toUpperCase() === "ON" };
  m = /^ANS\s+(\d{1,3})\s+(\d)$/i.exec(s);
  if (m) return { cmd: "answer", card: Number(m[1]), option: Number(m[2]) };
  return null;
}

/** A typed quiz answer: "A", "b)", "2", "option C", "(d)". Returns the 0-based index or null. */
export function parseQuizAnswer(input: string, count: number): number | null {
  const s = String(input ?? "").trim().toUpperCase().replace(/^(?:OPTION|ANSWER|IT'?S|MY ANSWER IS)\s*/, "").replace(/[()\[\].:)\s]/g, "");
  if (s.length !== 1) return null;
  let i = -1;
  if (/[A-J]/.test(s)) i = s.charCodeAt(0) - 65;
  else if (/[1-9]/.test(s)) i = Number(s) - 1;
  return i >= 0 && i < count ? i : null;
}

/* ── Lesson scripts (data/whatsapp/<fileId>.json, written by W1) ───────── */
export type Card =
  | { t: "text"; body: string }
  | { t: "video"; caption: string; media: string | null; youtube: string | null; app: string | null }
  | { t: "quiz"; q: string; options: string[]; answer: number; why: string }
  | { t: "reveal"; prompt: string; answer: string }
  | { t: "task"; tier: "b" | "s" | "g" | "boss" | "capstone"; title: string; body: string }
  | { t: "link"; body: string; url: string }
  | { t: "done"; body: string };
export type Script = { id: string; title: string; track: number; free: boolean; voice: "male" | "female"; cards: Card[] };
export type MediaManifest = Record<string, { url: string; bytes?: number; seconds?: number }>;

const str = (v: unknown, max = 4000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const httpsUrl = (v: unknown) => { const s = str(v, 2000); if (!s) return null; try { const u = new URL(s); return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null; } catch { return null; } };
const TIERS = ["b", "s", "g", "boss", "capstone"];

/** Validates one card; returns null for anything malformed (it is skipped rather than breaking the lesson). */
export function cleanCard(c: unknown): Card | null {
  if (!c || typeof c !== "object") return null;
  const o = c as Record<string, unknown>;
  switch (o.t) {
    case "text": { const body = str(o.body); return body ? { t: "text", body } : null; }
    case "video": {
      const media = typeof o.media === "string" && /^(walk|clip):/.test(o.media) ? o.media : null;
      const youtube = httpsUrl(o.youtube), app = httpsUrl(o.app);
      const caption = str(o.caption, 1000);
      return media || youtube || app ? { t: "video", caption, media, youtube, app } : caption ? { t: "text", body: caption } : null;
    }
    case "quiz": {
      const q = str(o.q, 1000);
      const options = Array.isArray(o.options) ? o.options.map(x => str(x, 300)).filter(Boolean).slice(0, 10) : [];
      const answer = Number(o.answer);
      if (!q || options.length < 2 || !Number.isInteger(answer) || answer < 0 || answer >= options.length) return null;
      return { t: "quiz", q, options, answer, why: str(o.why, 1000) };
    }
    case "reveal": { const prompt = str(o.prompt, 1000), answer = str(o.answer, 3000); return prompt && answer ? { t: "reveal", prompt, answer } : null; }
    case "task": {
      const tier = typeof o.tier === "string" && TIERS.includes(o.tier) ? (o.tier as "b") : null;
      const body = str(o.body), title = str(o.title, 200);
      return tier && (body || title) ? { t: "task", tier, title, body } : null;
    }
    case "link": { const url = httpsUrl(o.url); const body = str(o.body); return url ? { t: "link", body, url } : body ? { t: "text", body } : null; }
    case "done": return { t: "done", body: str(o.body) || "Lesson complete." };
    default: return null;
  }
}
/** Validates a whole script. Always ends with a "done" card (added when missing). */
export function cleanScript(raw: unknown, fallback: { id: string; title: string; track: number; free: boolean }): Script | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const cards = (Array.isArray(o.cards) ? o.cards : []).map(cleanCard).filter((c): c is Card => !!c);
  if (!cards.length) return null;
  const doneAt = cards.findIndex(c => c.t === "done");
  const list = doneAt >= 0 ? cards.slice(0, doneAt + 1) : [...cards, { t: "done", body: "Lesson complete." } as Card];
  return {
    id: fallback.id, title: str(o.title, 200) || fallback.title, track: fallback.track, free: fallback.free,
    voice: o.voice === "female" ? "female" : "male", cards: list
  };
}

/* ── Outgoing messages (rendered from cards; sent by lib/whatsapp/api.ts) ─ */
export type Button = { id: string; title: string };
export type Row = { id: string; title: string; description?: string };
export type Out =
  | { type: "text"; body: string; previewUrl?: boolean }
  | { type: "buttons"; body: string; buttons: Button[]; footer?: string; header?: string }
  | { type: "list"; body: string; button: string; rows: Row[]; footer?: string; header?: string; sectionTitle?: string }
  | { type: "video"; link: string; caption?: string; mediaKey?: string };

export const btn = (id: string, title: string): Button => ({ id: id.slice(0, WA.idMax), title: clip(title, WA.buttonTitle) });
export const NEXT_BTN = btn("NEXT", "Next");
export const MENU_BTN = btn("MENU", "Menu");

/** Interactive body, or a text message followed by a short buttons message when the body is too long (a burst of 2). */
export function withButtons(body: string, buttons: Button[], footer?: string, prompt = "Tap a button to carry on."): Out[] {
  const b = buttons.slice(0, WA.buttonsMax);
  if (body.length <= WA.interactiveBody) return [{ type: "buttons", body, buttons: b, footer }];
  return [{ type: "text", body: clip(body, WA.textMax) }, { type: "buttons", body: prompt, buttons: b, footer }];
}

const LETTERS = "ABCDEFGHIJ";
/**
 * A quiz as reply buttons (≤ 3 options that fit 20-character titles), a list with the options as row titles
 * (each ≤ 24 characters), or a list whose rows are letters with the full options written in the body as A–D.
 * Reply ids are "ANS <cardIndex> <optionIndex>" so a tap on an old quiz can't answer the current one.
 */
export function formatQuiz(q: string, options: string[], cardIndex: number, footer?: string): Out {
  const id = (i: number) => `ANS ${cardIndex} ${i}`;
  if (options.length <= WA.buttonsMax && options.every(o => o.length <= WA.buttonTitle)) {
    return { type: "buttons", body: clip(q, WA.interactiveBody), buttons: options.map((o, i) => ({ id: id(i), title: o })), footer };
  }
  if (options.every(o => o.length <= WA.rowTitle)) {
    return { type: "list", body: clip(q, WA.interactiveBody), button: "Choose an answer", sectionTitle: "Answers", footer,
      rows: options.slice(0, WA.rowsMax).map((o, i) => ({ id: id(i), title: o })) };
  }
  const listed = options.map((o, i) => `${LETTERS[i]}) ${o}`).join("\n");
  const tail = `\n\n${listed}`;
  const body = clip(q, Math.max(100, WA.interactiveBody - tail.length)) + tail;
  return { type: "list", body: clip(body, WA.interactiveBody), button: "Choose an answer", sectionTitle: "Answers", footer,
    rows: options.slice(0, WA.rowsMax).map((o, i) => ({ id: id(i), title: LETTERS[i], description: clip(o, WA.rowDescription) })) };
}

export type RenderCtx = {
  itemId: string; title: string; index: number; total: number;
  media: MediaManifest; appUrl: string;
};
/** "3.4 · 2/12" for interactive footers. */
export const footerFor = (ctx: Pick<RenderCtx, "itemId" | "index" | "total">) => clip(`${itemLabel(ctx.itemId)} · ${ctx.index + 1}/${ctx.total}`, WA.footerMax);

/**
 * One card → the message(s) to send (at most 2). The first card of a lesson starts with its title.
 * "done" cards are rendered by the engine (they depend on whether the item could be marked done).
 */
export function renderCard(card: Card, ctx: RenderCtx): Out[] {
  const footer = footerFor(ctx);
  const head = ctx.index === 0 ? `*${itemLabel(ctx.itemId)} · ${ctx.title}*\n\n` : "";
  switch (card.t) {
    case "text":
      return withButtons(head + card.body, [NEXT_BTN, MENU_BTN], footer);
    case "link":
      return withButtons(`${head}${card.body ? card.body + "\n\n" : ""}Open it here: ${card.url}`, [NEXT_BTN, MENU_BTN], footer);
    case "video": {
      const hit = card.media ? ctx.media[card.media] : undefined;
      if (hit && /^https:\/\//.test(hit.url)) {
        return [
          { type: "video", link: hit.url, caption: clip(head + card.caption, WA.captionMax), mediaKey: card.media || undefined },
          { type: "buttons", body: "Tap Next when you've watched it.", buttons: [NEXT_BTN, MENU_BTN], footer }
        ];
      }
      const links = [card.youtube ? `Watch: ${card.youtube}` : "", card.app ? `${card.youtube ? "Or open" : "Open"} it in the app: ${card.app}` : ""].filter(Boolean).join("\n");
      return withButtons(`${head}${card.caption ? card.caption + "\n\n" : ""}${links}`.trim(), [NEXT_BTN, MENU_BTN], footer);
    }
    case "quiz": {
      const out = formatQuiz(head + card.q, card.options, ctx.index, footer);
      return [out];
    }
    case "reveal":
      return withButtons(`${head}${card.prompt}\n\nThink it through, then tap Reveal.`, [btn("REVEAL", "Reveal"), NEXT_BTN, MENU_BTN], footer);
    case "task": {
      const body = `${head}*${card.title || "Your mission"}*\n\n${card.body}\n\nSend your work as a message (your log, test results or outputs, and a short description), or reply SKIP.`;
      return withButtons(body, [btn("SKIP", "Skip"), MENU_BTN], footer, "Send your work as a message, or tap Skip.");
    }
    case "done":
      return withButtons(head + card.body, [NEXT_BTN, MENU_BTN], footer);
  }
}

/** What the bot waits for after a card. */
export function awaitingFor(card: Card | undefined): "none" | "next" | "quiz" | "reveal" | "task" {
  if (!card) return "none";
  return card.t === "quiz" ? "quiz" : card.t === "reveal" ? "reveal" : card.t === "task" ? "task" : card.t === "done" ? "none" : "next";
}

export function quizFeedback(card: Extract<Card, { t: "quiz" }>, chosen: number): { correct: boolean; body: string } {
  const correct = chosen === card.answer;
  const right = `${LETTERS[card.answer]}) ${card.options[card.answer]}`;
  const body = correct
    ? `*Correct.*${card.why ? "\n\n" + card.why : ""}`
    : `*Not quite.* The answer is ${right}.${card.why ? "\n\n" + card.why : ""}`;
  return { correct, body };
}

/* ── XP (as the course awards it in course/src/platform.js) ────────────── */
export const itemXp = (id: string) => (id.startsWith("B") ? 300 : id === "6.4" ? 400 : 100);
export const MISSION_XP: Record<string, number> = { b: 25, s: 50, g: 100 };
/** Bosses and the capstone count as done only with an accepted boss/capstone submission. */
export const needsAcceptedProject = (id: string, kind: string) => kind === "boss" || kind === "capstone" || id.startsWith("B") || id === "6.4";
export const projectTier = (id: string) => (id.startsWith("B") ? "boss" : "capstone");

/* ── Access (mirrors getEntitlements in lib/auth.ts, for server jobs without a user session) ── */
export function courseAccessFrom(rows: { product: string; status: string; expires_at: string | null }[], now = Date.now()): boolean {
  return rows.some(e => e.status === "active" && (!e.expires_at || new Date(e.expires_at).getTime() > now) && ["self", "cohort", "team"].includes(e.product));
}

/* ── Reminders and the 24-hour window ──────────────────────────────────── */
export const DAY = 86_400_000;
export const within24h = (lastInbound: string | null | undefined, now = Date.now()) =>
  !!lastInbound && now - new Date(lastInbound).getTime() < DAY - 5 * 60_000; // 5 minutes' margin
/** Inactive ≥ 2 days, no reminder in the last 3 days. */
export function reminderDue(o: { lastActive: string | null; lastReminder: string | null; linkedAt: string | null }, now = Date.now()): boolean {
  const t = (s: string | null) => (s ? new Date(s).getTime() : 0);
  const active = Math.max(t(o.lastActive), t(o.linkedAt));
  if (!active || now - active < 2 * DAY) return false;
  return !o.lastReminder || now - t(o.lastReminder) >= 3 * DAY - 60 * 60_000; // an hour's slack for cron drift
}

/* ── Link codes ────────────────────────────────────────────────────────── */
export const LINK_CODE_TTL_MS = 15 * 60_000;
export const isLinkCode = (s: unknown) => typeof s === "string" && /^\d{6}$/.test(s);
export const codeFromInt = (n: number) => String(Math.abs(Math.floor(n)) % 1_000_000).padStart(6, "0");
/** wa.me deep link with the LINK message pre-filled. */
export const waMeLink = (businessNumber: string, code: string) => `https://wa.me/${businessNumber.replace(/\D/g, "")}?text=${encodeURIComponent(`LINK ${code}`)}`;

/** Lagos calendar day (UTC+1, no DST), as the course's streak days are stored. */
export const lagosDate = (d = new Date()) => new Date(d.getTime() + 3_600_000).toISOString().slice(0, 10);
