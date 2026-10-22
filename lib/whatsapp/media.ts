import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadMedia } from "@/lib/whatsapp/api";
import { clip, driveDownloadUrl, driveFileId, looksLikeMp4, type MediaManifest } from "@/lib/whatsapp/core";

/**
 * Lesson videos can live anywhere that serves the MP4 to our server: Google Drive (share link, "Anyone with the
 * link"), Supabase Storage, or any HTTPS URL. Before a video is first sent we download it once, upload it to
 * WhatsApp's media store and cache the media id in wa_media_ids (Meta keeps it about 30 days; we renew at 28).
 * Sends then use the id, so the source is fetched about once a month per video, not once per learner.
 */
const MAX_BYTES = 16 * 1024 * 1024; // WhatsApp's video limit
const KEEP_DAYS = 28;
const DAY = 86_400_000;

export type FetchResult = { ok: true; bytes: ArrayBuffer } | { ok: false; error: string };

export async function fetchVideo(url: string): Promise<FetchResult> {
  const id = driveFileId(url), src = id ? driveDownloadUrl(id) : url;
  try {
    const res = await fetch(src, { redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(45_000) });
    if (!res.ok) return { ok: false, error: `${res.status} ${res.statusText} from ${id ? "Google Drive" : "the video host"}` };
    if (/text\/html/i.test(res.headers.get("content-type") || "")) {
      return { ok: false, error: id ? "Google Drive sent a web page, not the video. Share the file as \"Anyone with the link\" (Viewer), or Drive may be limiting downloads: try again later." : "The link returned a web page, not an MP4." };
    }
    const len = Number(res.headers.get("content-length") || 0);
    if (len > MAX_BYTES) return { ok: false, error: "The video is over WhatsApp's 16 MB limit." };
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength > MAX_BYTES) return { ok: false, error: "The video is over WhatsApp's 16 MB limit." };
    if (!looksLikeMp4(new Uint8Array(bytes.slice(0, 12)))) return { ok: false, error: "The file isn't an MP4." };
    return { ok: true, bytes };
  } catch (e) {
    return { ok: false, error: clip(e instanceof Error ? e.message : "download failed", 200) };
  }
}

/** A cached WhatsApp media id for this video, uploading it first if needed. null when it can't be prepared. */
export async function mediaIdFor(key: string, url: string, opts: { force?: boolean } = {}): Promise<{ id: string | null; error?: string }> {
  const db = createAdminClient();
  if (!opts.force) {
    const { data } = await db.from("wa_media_ids").select("media_id, url, expires_at").eq("media_key", key).maybeSingle();
    if (data && data.url === url && new Date(String(data.expires_at)).getTime() > Date.now()) return { id: String(data.media_id) };
  }
  const v = await fetchVideo(url);
  if (!v.ok) { console.error(`[whatsapp] couldn't fetch ${key}:`, v.error); return { id: null, error: v.error }; }
  const up = await uploadMedia(v.bytes, `${key.replace(/[^a-z0-9]+/gi, "-")}.mp4`);
  if (!up.ok) { console.error(`[whatsapp] Meta refused ${key}:`, up.error); return { id: null, error: "WhatsApp refused the upload: " + up.error }; }
  const now = Date.now();
  await db.from("wa_media_ids").upsert({ media_key: key, url, media_id: up.id, uploaded_at: new Date(now).toISOString(), expires_at: new Date(now + KEEP_DAYS * DAY).toISOString() });
  return { id: up.id };
}

/**
 * Uploads videos that have no media id yet or whose id expires within 3 days, at most `limit` per call
 * (each takes a few seconds). Used by the daily cron and Admin → WhatsApp → Prepare videos.
 */
export async function prepareVideos(manifest: MediaManifest, limit = 15) {
  const db = createAdminClient();
  const { data } = await db.from("wa_media_ids").select("media_key, url, expires_at");
  const have = new Map((data || []).map(r => [String(r.media_key), r]));
  const soon = Date.now() + 3 * DAY;
  const due = Object.entries(manifest).filter(([k, v]) => { const h = have.get(k); return !h || h.url !== v.url || new Date(String(h.expires_at)).getTime() < soon; });
  const out = { total: Object.keys(manifest).length, due: due.length, prepared: 0, failed: [] as { key: string; error: string }[] };
  for (const [k, v] of due.slice(0, limit)) {
    const r = await mediaIdFor(k, v.url, { force: true });
    if (r.id) out.prepared++; else out.failed.push({ key: k, error: r.error || "failed" });
  }
  return out;
}
