# Voice, Story Mode and Sage: placeholders and setup (writer F)

| Placeholder | File | What it is | Where to get it |
|---|---|---|---|
| `AZURE_SPEECH_KEY` | env (`lib/config.ts` `hasAzureSpeech`, `lib/tts.ts`) | Key 1 of an Azure AI Speech resource | Azure portal → your Speech resource → Keys and Endpoint |
| `AZURE_SPEECH_REGION` | env | Region of that resource, e.g. `westeurope`, `eastus`, `southafricanorth` | Same page ("Location/Region"), lower-case with no spaces |
| `AZURE_TTS_USD_PER_MILLION` (optional, default 15) | env, `app/(site)/admin/audio/page.tsx` | Price per 1M characters used for the admin cost estimate | Azure Speech pricing page: neural text to speech. **Check the current price**; it changes |
| `TTS_DAILY_CHARS` (optional, default 60000) | env, `lib/tts.ts` | Natural-voice characters per learner per day (cached clips don't count) | Your choice |
| `ANTHROPIC_API_KEY` | env (`hasAnthropic`, `lib/assistant.ts`) | Key for Sage, the course assistant | console.anthropic.com → API keys (set a monthly spend limit) |
| `ANTHROPIC_MODEL` | env, `lib/assistant.ts` (fallback `claude-sonnet-5-5`: confirm the current model name) | Model ID Sage uses | docs.claude.com → Models overview; pick a current Sonnet or Haiku ID |
| `ASSISTANT_DAILY_QUESTIONS` (optional, default 30) | env, `lib/assistant.ts` | Sage questions per learner per day | Your choice |

## Azure AI Speech setup
1. Azure portal → Create a resource → "Speech" (Azure AI services). Pricing tier: **Free F0** (0.5M neural characters a month) to start, **Standard S0** for launch.
2. Region: Nigerian voices `en-NG-AbeoNeural` (male, Emeka's lessons) and `en-NG-EzinneNeural` (female, Miracle's lessons) are standard neural voices available in most regions. Pick one close to your server and users (e.g. `westeurope` or `southafricanorth`) and confirm both voices are in the region's voice list (Speech Studio → Voice gallery).
3. Copy Key 1 and the region into `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` (server env only, never `NEXT_PUBLIC_`).
4. Run `supabase/migrations/0005_voice.sql`. It creates the public `tts` Storage bucket, `tts_cache`, `tts_usage`, `assistant_usage` and the usage functions.
5. Admin → Lesson audio → "Generate all lesson audio" once (and again after lesson text changes) so Story Mode downloads are instant. The page shows characters used and an estimated cost; the full course is a one-off cost, after which only new Listen clips are billed.

Cost note: every unique sentence group is synthesised once and cached forever. The Listen button sends clips of up to 1,200 characters, and the per-learner daily budget (`TTS_DAILY_CHARS`) caps abuse. Without Azure keys, everything falls back to browser voices automatically.

## Anthropic (Sage)
1. Create a key at console.anthropic.com, set `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL`.
2. Set a monthly spend limit in the console. Each question sends the lesson text (up to about 28k characters) plus the question, at most 700 output tokens; the daily per-learner limit is 30 questions.
3. Free accounts can ask about Base Camp items only; enrolled learners about every item.

## Notes for other writers
- `course-addons/voice.js` implements `window.AUTOMANCY_TTS` per the contract. `speak()` resolves when the clip ends **and** when it is interrupted by `stop()` or a newer `speak()`; it rejects only on failure (fall back to browser speech then). Optional extras: `prefetch(text, {voice})`, and `speak(text, {voice, rate, next})` to warm the next chunk while the current one plays. Keep each `text` ≤ 1,200 characters (the course's 220-character `chunks()` are fine).
- Speed: clips are generated at normal speed and played with `playbackRate`, so all speeds share one cached file. `rate` defaults to the course's `#lsnRate` value.
- Story Mode links: `/audio` (learner page) and `/api/tts/lesson?id=<id>` (redirects to the MP3; add `&inline=1` to play instead of download). The in-course "Story Mode" button can link to `/audio`.
- The `tts` bucket is public: anyone with an MP3's URL can play it. Lesson file names include a 16-character hash of the narration, so they can't be guessed.
