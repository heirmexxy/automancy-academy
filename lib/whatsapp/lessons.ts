import "server-only";
import fs from "node:fs";
import path from "node:path";
import { COURSE, itemById, type CourseItem } from "@/lib/course";
import { cleanScript, decodeEntities, fileIdOf, type MediaManifest, type Script } from "@/lib/whatsapp/core";

/**
 * Lesson scripts (data/whatsapp/<fileId>.json) and the media manifest (data/whatsapp-media.json), written by other
 * writers. Both may be missing: a missing script sends the learner to the app, a missing media key falls back to
 * the YouTube/app link (as does a URL still on the YOUR-PROJECT placeholder). Read from disk (next.config includes ./data/** for /api routes); cached for 60 s in production.
 */
const DATA = path.join(process.cwd(), "data");
const CACHE_MS = process.env.NODE_ENV === "production" ? 60_000 : 0;
const scripts = new Map<string, { at: number; s: Script | null }>();
let media: { at: number; m: MediaManifest } | null = null;

export const titleOf = (item: CourseItem | undefined | null) => decodeEntities(item?.title || "");

export function loadScript(itemId: string): Script | null {
  const item = itemById(itemId);
  if (!item) return null;
  const hit = scripts.get(itemId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.s;
  let s: Script | null = null;
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(DATA, "whatsapp", fileIdOf(itemId) + ".json"), "utf8"));
    s = cleanScript(raw, { id: item.id, title: titleOf(item), track: item.track, free: item.free });
    if (s) s.free = item.free; // access always follows the course index, never the script file
  } catch { s = null; }
  scripts.set(itemId, { at: Date.now(), s });
  return s;
}

export function loadMedia(): MediaManifest {
  if (media && Date.now() - media.at < CACHE_MS) return media.m;
  let m: MediaManifest = {};
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(DATA, "whatsapp-media.json"), "utf8")) as Record<string, unknown>;
    for (const [k, v] of Object.entries(raw || {})) {
      const url = v && typeof v === "object" ? String((v as { url?: unknown }).url || "") : "";
      if (/^https:\/\//.test(url) && !/YOUR-PROJECT|PLACEHOLDER/i.test(url)) m[k] = { url, bytes: Number((v as { bytes?: unknown }).bytes) || undefined, seconds: Number((v as { seconds?: unknown }).seconds) || undefined };
    }
  } catch { m = {}; }
  media = { at: Date.now(), m };
  return m;
}

/** The item after `id` in course order, or null at the end. */
export function nextItem(id: string): CourseItem | null {
  const i = COURSE.items.findIndex(x => x.id === id);
  return i >= 0 && i + 1 < COURSE.items.length ? COURSE.items[i + 1] : null;
}
/** First item not yet done (optionally only among those the learner may open). */
export function firstUndone(done: Record<string, unknown>, canOpen: (item: CourseItem) => boolean = () => true): CourseItem | null {
  return COURSE.items.find(i => done[i.id] !== true && canOpen(i)) || null;
}
