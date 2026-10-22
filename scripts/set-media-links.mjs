#!/usr/bin/env node
/* Point the WhatsApp lesson videos at wherever you uploaded them (Google Drive, or any HTTPS host).
   Input: a CSV or TSV with two columns, file name and share link, e.g. exported from a Drive folder:
     walk-3-4.mp4,https://drive.google.com/file/d/1AbC.../view?usp=sharing
   Usage: node scripts/set-media-links.mjs links.csv [--dry-run]
   Each file name maps to its manifest key (walk-3-4.mp4 → walk:3.4, clip-1-1-0.mp4 → clip:1.1:0, walk-B4.mp4 → walk:B4).
   Drive files must be shared as "Anyone with the link" (Viewer). Then commit data/whatsapp-media.json and redeploy;
   Admin → WhatsApp → Prepare videos uploads them to WhatsApp. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = path.join(ROOT, "data/whatsapp-media.json");
const [file] = process.argv.slice(2).filter(a => !a.startsWith("--"));
const DRY = process.argv.includes("--dry-run");
if (!file) { console.error("Usage: node scripts/set-media-links.mjs links.csv [--dry-run]"); process.exit(1); }
const keyOf = name => {
  const m = /^(walk|clip)-(.+)\.mp4$/i.exec(path.basename(name.trim()));
  if (!m) return null;
  const parts = m[2].split("-");
  if (m[1].toLowerCase() === "walk") return `walk:${parts.join(".")}`;
  const n = parts.pop(); return `clip:${parts.join(".")}:${n}`;
};
const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
let set = 0; const unknown = [], bad = [];
for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
  if (!line.trim() || /^\s*(name|file)/i.test(line)) continue;
  const [name, link] = line.split(/[,\t]/).map(s => (s || "").trim().replace(/^"|"$/g, ""));
  const key = keyOf(name || "");
  if (!key || !manifest[key]) { unknown.push(name); continue; }
  if (!/^https:\/\//.test(link || "")) { bad.push(name); continue; }
  manifest[key] = { ...manifest[key], url: link }; set++;
}
if (!DRY) fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
const left = Object.entries(manifest).filter(([, v]) => /YOUR-PROJECT/.test(v.url)).map(([k]) => k);
console.log(`${DRY ? "[dry run] would set" : "Set"} ${set} link(s).${unknown.length ? ` Not matched: ${unknown.join(", ")}.` : ""}${bad.length ? ` Not https: ${bad.join(", ")}.` : ""}${left.length ? ` Still placeholders: ${left.length} (${left.slice(0, 5).join(", ")}${left.length > 5 ? ", …" : ""}).` : " Every video has a link."}`);
