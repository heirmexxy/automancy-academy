import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { hasAnthropic, hasAzureSpeech } from "@/lib/config";
import { COURSE } from "@/lib/course";
import { fmtDate, usd } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { decodeEntities, DAILY_CHARS } from "@/lib/tts";
import { DAILY_QUESTIONS } from "@/lib/assistant";
import { GenerateAll } from "./GenerateAll";
import "../../audio/audio.css";

export const metadata: Metadata = { title: "Lesson audio · Admin" };
export const dynamic = "force-dynamic";
export const maxDuration = 300; // applies to the generate action: one uncached lesson can take a while

/** PLACEHOLDER: Azure neural TTS list price (USD per 1M characters). Check azure.microsoft.com/pricing/details/cognitive-services/speech-services/ */
const DEFAULT_PRICE = Number(process.env.AZURE_TTS_USD_PER_MILLION || 15);

export default async function AdminAudio({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const priceIn = Number(sp.price);
  const price = Number.isFinite(priceIn) && priceIn > 0 ? priceIn : DEFAULT_PRICE;

  const supabase = await createClient();
  const today = new Date(Date.now() + 3600_000).toISOString().slice(0, 10); // Africa/Lagos is UTC+1, no DST
  const [stats, lessons, ttsToday, askToday] = await Promise.all([
    supabase.rpc("tts_cache_stats"),
    supabase.from("tts_cache").select("item_id, chars, created_at").eq("kind", "lesson").order("created_at", { ascending: false }),
    supabase.from("tts_usage").select("chars").eq("day", today),
    supabase.from("assistant_usage").select("questions").eq("day", today)
  ]);
  const rows = (stats.data || []) as { kind: string; files: number; chars: number }[];
  const by = (k: string) => rows.find(r => r.kind === k) || { files: 0, chars: 0 };
  const files = rows.reduce((s, r) => s + Number(r.files), 0);
  const chars = rows.reduce((s, r) => s + Number(r.chars), 0);
  const latest = new Map<string, { chars: number; created_at: string }>();
  for (const l of (lessons.data || []) as { item_id: string; chars: number; created_at: string }[]) if (l.item_id && !latest.has(l.item_id)) latest.set(l.item_id, l);
  const lessonChars = COURSE.items.reduce((s, i) => s + (latest.get(i.id)?.chars || 0), 0);
  const ttsUsers = (ttsToday.data || []).length, ttsChars = (ttsToday.data || []).reduce((s, r) => s + Number(r.chars), 0);
  const askUsers = (askToday.data || []).length, asks = (askToday.data || []).reduce((s, r) => s + Number(r.questions), 0);
  const cost = (n: number) => usd((n / 1_000_000) * price);
  const label = (id: string) => { const i = COURSE.items.find(x => x.id === id)!; return `${i.kind === "boss" ? "Boss " + id.slice(1) : id} · ${decodeEntities(i.title)}`; };

  return (
    <div className="stack">
      <h1>Lesson audio and Sage</h1>
      {!hasAzureSpeech() && <div className="alert warn">Azure Speech isn&apos;t configured (AZURE_SPEECH_KEY, AZURE_SPEECH_REGION). Learners hear browser voices until it is. See docs/placeholders/voice.md.</div>}
      {!hasAnthropic() && <div className="alert warn">ANTHROPIC_API_KEY isn&apos;t set, so the Ask Sage button is hidden.</div>}
      {stats.error && <div className="alert bad">Couldn&apos;t read the audio cache: {stats.error.message}. Has migration 0005_voice.sql been run?</div>}

      <div className="grid4">
        <div className="kpi"><span>Cached files</span><b>{files.toLocaleString()}</b><span>{Number(by("lesson").files)} lesson · {Number(by("clip").files)} clip</span></div>
        <div className="kpi"><span>Characters synthesised</span><b>{chars.toLocaleString()}</b><span>≈ {cost(chars)} at {usd(price)}/1M</span></div>
        <div className="kpi"><span>Lessons ready</span><b>{latest.size} / {COURSE.items.length}</b><span>{lessonChars.toLocaleString()} chars ≈ {cost(lessonChars)}</span></div>
        <div className="kpi"><span>Today (Lagos)</span><b>{ttsChars.toLocaleString()}</b><span>voice chars by {ttsUsers} learners · {asks} Sage questions by {askUsers}</span></div>
      </div>

      <form className="row" method="get">
        <label className="fld" style={{ maxWidth: 260 }}>Azure price, USD per 1M characters
          <input name="price" type="number" step="0.01" min="0" defaultValue={price} />
        </label>
        <button className="btn sm alt" type="submit">Recalculate</button>
      </form>
      <p className="note">Estimates only; cached clips are never billed twice. Limits: {DAILY_CHARS().toLocaleString()} voice characters and {DAILY_QUESTIONS()} Sage questions per learner per day. Set the default price with AZURE_TTS_USD_PER_MILLION and check Azure&apos;s current neural TTS price (the free tier covers 0.5M characters a month).</p>

      <section className="card stack">
        <h2>Pre-generate lesson audio</h2>
        <p className="note">Builds every lesson&apos;s narration once so learners&apos; first Story Mode play or download is instant. Lessons already generated with the same text are skipped (shown as cached). Run again after lesson text changes.</p>
        <GenerateAll items={COURSE.items.map(i => ({ id: i.id, label: label(i.id) }))} disabled={!hasAzureSpeech()} />
      </section>

      <section className="card stack">
        <h2>Lessons</h2>
        <div className="scroll">
          <table className="dt">
            <thead><tr><th>Item</th><th>Status</th><th>Characters</th><th>Est. cost</th><th>Generated</th></tr></thead>
            <tbody>
              {COURSE.items.map(i => {
                const l = latest.get(i.id);
                return (
                  <tr key={i.id}>
                    <td>{label(i.id)}</td>
                    <td>{l ? <span className="pill ok">ready</span> : <span className="pill">not yet</span>}</td>
                    <td>{l ? l.chars.toLocaleString() : "–"}</td>
                    <td>{l ? cost(l.chars) : "–"}</td>
                    <td>{l ? fmtDate(l.created_at) : "–"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
