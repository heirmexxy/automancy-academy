#!/usr/bin/env node
/* ======================================================================
   Upload the WhatsApp lesson videos to Supabase Storage (W3)
   Uploads every MP4 in out/whatsapp-media/ (from render-whatsapp-videos.mjs)
   to the public bucket `wa-media` (created if missing), upserting by file
   name with content-type video/mp4, then rewrites the urls in
   data/whatsapp-media.json to the real public URLs.

   Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (read from the
   environment, or from .env.local / .env if present). Never commit the key.
   Usage: node scripts/upload-whatsapp-media.mjs [--dir out/whatsapp-media] [--only walk-3-4.mp4,clip-1-1-0.mp4] [--dry-run]
   ====================================================================== */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BUCKET = "wa-media";
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const DIR = path.resolve(ROOT, opt("--dir", "out/whatsapp-media"));
const ONLY = opt("--only", "") ? new Set(opt("--only", "").split(",").map(s => s.trim())) : null;
const DRY = argv.includes("--dry-run");
const MANIFEST = path.join(ROOT, "data/whatsapp-media.json");

/* minimal .env reader (no dependency); existing env wins */
for(const f of [".env.local", ".env"]){
  const p = path.join(ROOT, f); if(!fs.existsSync(p)) continue;
  for(const line of fs.readFileSync(p, "utf8").split(/\r?\n/)){
    const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line); if(!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}
const BASE = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if(!BASE || !KEY){ console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."); process.exit(1); }
const H = { Authorization: `Bearer ${KEY}`, apikey: KEY };

async function ensureBucket(){
  const r = await fetch(`${BASE}/storage/v1/bucket/${BUCKET}`, { headers: H });
  if(r.ok){
    const b = await r.json();
    if(!b.public){ // make it public (read by URL only; no listing policy is created)
      const u = await fetch(`${BASE}/storage/v1/bucket/${BUCKET}`, { method: "PUT", headers: { ...H, "Content-Type": "application/json" },
        body: JSON.stringify({ public: true, file_size_limit: 16 * 1024 * 1024, allowed_mime_types: ["video/mp4"] }) });
      if(!u.ok) throw new Error(`Could not make bucket public: ${u.status} ${await u.text()}`);
    }
    return "exists";
  }
  const c = await fetch(`${BASE}/storage/v1/bucket`, { method: "POST", headers: { ...H, "Content-Type": "application/json" },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true, file_size_limit: 16 * 1024 * 1024, allowed_mime_types: ["video/mp4"] }) });
  if(!c.ok){ const t = await c.text(); if(!/already exists|Duplicate/i.test(t)) throw new Error(`Could not create bucket: ${c.status} ${t}`); return "exists"; }
  return "created";
}

async function upload(file){
  const body = fs.readFileSync(path.join(DIR, file));
  const r = await fetch(`${BASE}/storage/v1/object/${BUCKET}/${encodeURIComponent(file)}`, {
    method: "POST", headers: { ...H, "Content-Type": "video/mp4", "x-upsert": "true", "Cache-Control": "max-age=86400" }, body });
  if(!r.ok) throw new Error(`${file}: ${r.status} ${await r.text()}`);
  return body.length;
}

(async () => {
  if(!fs.existsSync(DIR)){ console.error(`No folder ${path.relative(ROOT, DIR)}. Run scripts/render-whatsapp-videos.mjs first.`); process.exit(1); }
  const files = fs.readdirSync(DIR).filter(f => f.endsWith(".mp4") && (!ONLY || ONLY.has(f))).sort();
  if(!files.length){ console.error("No MP4 files to upload."); process.exit(1); }
  const publicBase = `${BASE}/storage/v1/object/public/${BUCKET}`;
  if(DRY){ files.forEach(f => console.log(`would upload ${f} → ${publicBase}/${f}`)); return; }
  console.log(`Bucket ${BUCKET}: ${await ensureBucket()}`);
  let fails = 0, total = 0;
  for(const f of files){
    try { const n = await upload(f); total += n; console.log(`✓ ${f} (${(n / 1048576).toFixed(2)} MB)`); }
    catch(e){ fails++; console.error(`✗ ${e.message}`); }
  }
  // point the manifest at the real public URLs (keys whose file was uploaded)
  if(fs.existsSync(MANIFEST)){
    const m = JSON.parse(fs.readFileSync(MANIFEST, "utf8")); const up = new Set(files); let changed = 0;
    for(const v of Object.values(m)){ const f = String(v.url || "").split("/").pop(); if(up.has(f) && v.url !== `${publicBase}/${f}`){ v.url = `${publicBase}/${f}`; changed++; } }
    fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + "\n");
    console.log(`Manifest: ${changed} url(s) updated.`);
  }
  console.log(`Uploaded ${files.length - fails}/${files.length} file(s), ${(total / 1048576).toFixed(1)} MB.`);
  process.exit(fails ? 1 : 0);
})();
