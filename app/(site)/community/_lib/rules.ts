/** Pure community rules (no imports, so they can be tested with `tsx --test`). Shared by server actions and API routes. */

export const POST_TYPES = ["journal", "help", "win", "challenge_entry", "announcement"] as const;
export type PostType = (typeof POST_TYPES)[number];
export const LEARNER_TYPES = ["journal", "help", "win"] as const;
export const ROOMS = ["general", "0", "1", "2", "3", "4", "5", "6"] as const;
export type Room = (typeof ROOMS)[number];
export const FREE_ROOMS: Room[] = ["general", "0"];
export const LIMITS = { postsPerDay: 20, commentsPerDay: 60, body: 4000, title: 140, comment: 2000, reason: 600, introsPerDay: 5 };

export const TYPE_LABEL: Record<PostType, string> = {
  journal: "Journal", help: "Needs help", win: "Win", challenge_entry: "Challenge entry", announcement: "Announcement"
};
export const AVAILABILITY: Record<string, string> = {
  full_time: "Open to full-time", contract: "Open to contracts", freelance: "Freelance projects", not_available: "Not available right now"
};

const SECRET_RE = /sk_(test|live)_[A-Za-z0-9]{6,}|sk-[A-Za-z0-9_-]{10,}|xox[abpr]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/;
const PHONE_RE = /(\+?234[\s-]?|\b0)[789][01]\d[\s-]?\d{3}[\s-]?\d{4}\b/;

/** Returns a message when text looks like it contains an API key or a phone number (learners paste these by accident). */
export function sensitive(text: string): string | null {
  if (SECRET_RE.test(text)) return "That looks like an API key or secret. Remove it and use a placeholder like <API_KEY> before posting.";
  if (PHONE_RE.test(text)) return "That looks like a phone number. Remove it before posting (use 080XXXXXXXX as a placeholder).";
  return null;
}

export const clean = (v: unknown, max: number) => String(v ?? "").replace(/\r\n/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);

export function httpsUrl(v: unknown): string | null {
  const s = clean(v, 500);
  if (!s) return null;
  try { const u = new URL(s); return u.protocol === "https:" ? u.toString() : null; } catch { return null; }
}

/** The room a lesson belongs to: "1.3" → "1", "B4" → "4"; anything else → "general". */
export function roomForItem(itemId: string | null | undefined): Room {
  const m = /^B?([0-6])/.exec(itemId || "");
  return (m ? m[1] : "general") as Room;
}

export const isRoom = (r: unknown): r is Room => typeof r === "string" && (ROOMS as readonly string[]).includes(r);

export type PostInput = {
  type: PostType; room: Room; itemId: string | null; title: string | null; body: string;
  parts: Record<string, string> | null; link: string | null; challengeId: string | null;
};

/**
 * Validates and normalises a post. `itemIds` is the set of valid course item ids.
 * Journal posts may be given as parts (review/reflect/recommend/saved); body is then composed from them.
 */
export function buildPost(raw: Record<string, unknown>, itemIds: Set<string>, opts: { allowAnnouncement?: boolean } = {}):
  { ok: true; post: PostInput } | { ok: false; error: string } {
  const type = String(raw.type || "") as PostType;
  const allowed: readonly string[] = opts.allowAnnouncement ? POST_TYPES : [...LEARNER_TYPES, "challenge_entry"];
  if (!allowed.includes(type)) return { ok: false, error: "Choose a post type." };
  const itemRaw = clean(raw.itemId, 10);
  const itemId = itemRaw && itemIds.has(itemRaw) ? itemRaw : null;
  if (itemRaw && !itemId) return { ok: false, error: "That lesson doesn't exist." };
  const title = clean(raw.title, LIMITS.title) || null;
  let body = clean(raw.body, LIMITS.body + 1);
  let parts: Record<string, string> | null = null;
  if (type === "journal") {
    const review = clean(raw.review, 1200), reflect = clean(raw.reflect, 800), recommend = clean(raw.recommend, 600), saved = clean(raw.saved, 60);
    if (review || reflect || recommend) {
      if (!review) return { ok: false, error: "Fill in Review: what did you build?" };
      parts = { review, reflect, recommend, saved };
      body = [`Review: ${review}`, reflect && `Reflect: ${reflect}`, recommend && `Recommend: ${recommend}`, saved && `Time or money saved: ${saved}`].filter(Boolean).join("\n\n");
    }
  }
  if (!body) return { ok: false, error: "Write something before posting." };
  if (body.length > LIMITS.body) return { ok: false, error: `Keep it under ${LIMITS.body.toLocaleString()} characters.` };
  if ((type === "help" || type === "win" || type === "announcement") && !title) return { ok: false, error: "Add a short title." };
  const link = httpsUrl(raw.link);
  if (clean(raw.link, 500) && !link) return { ok: false, error: "Links must start with https://" };
  if (type === "challenge_entry" && !link) return { ok: false, error: "Add a https:// link to your workflow export or video." };
  const s = sensitive([title, body, link].filter(Boolean).join(" "));
  if (s) return { ok: false, error: s };
  const room: Room = isRoom(raw.room) ? raw.room : roomForItem(itemId);
  const challengeId = type === "challenge_entry" ? clean(raw.challengeId, 40) || null : null;
  if (type === "challenge_entry" && !challengeId) return { ok: false, error: "Which challenge is this for?" };
  return { ok: true, post: { type, room, itemId, title, body, parts, link, challengeId } };
}

/** Comma/newline separated list → unique trimmed items. */
export function list(v: unknown, maxItems: number, maxLen = 40): string[] {
  const out: string[] = [];
  for (const s of String(v ?? "").split(/[,\n]/)) {
    const t = s.trim().replace(/\s+/g, " ").slice(0, maxLen);
    if (t && !out.some(o => o.toLowerCase() === t.toLowerCase())) out.push(t);
    if (out.length >= maxItems) break;
  }
  return out;
}

export const isEmail = (s: string) => /^[^\s@<>()]{1,64}@[^\s@<>()]{1,190}\.[A-Za-z]{2,}$/.test(s);

/** Course titles in the index carry HTML entities ("APIs &amp; Webhooks"); React escapes text, so decode first. */
export const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

/** Safe in-app return path for redirects. */
export const safePath = (v: unknown, fallback = "/community") => {
  const s = String(v ?? "");
  return s.startsWith("/") && !s.startsWith("//") && !s.includes("\\") ? s : fallback;
};

/** Adds or replaces a query parameter on an in-app path. */
export function withParam(path: string, key: string, value: string) {
  const [base, hash] = path.split("#");
  const [p, q] = base.split("?");
  const sp = new URLSearchParams(q || "");
  sp.set(key, value);
  return `${p}?${sp.toString()}${hash ? "#" + hash : ""}`;
}

export const timeAgo = (iso: string, now = Date.now()) => {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

/** Postgres trigger messages are prefixed with CODE: …; show the human part. */
export function dbMessage(msg: string | undefined, fallback = "Something went wrong. Try again.") {
  if (!msg) return fallback;
  const m = /^(RATE_LIMIT|COURSE_ONLY|CHALLENGE_CLOSED|OWN_ENTRY|VOTING_CLOSED|NO_CERTIFICATE):\s*(.+)$/.exec(msg);
  if (m) return m[2];
  if (/duplicate key/.test(msg)) return "You've already done that.";
  return fallback;
}
