# Learning on WhatsApp: placeholders and setup (writer W2)

Setup steps are in README.md → "Going live with WhatsApp". Without the variables below everything degrades: /account shows "Learn on WhatsApp: coming soon", `/api/whatsapp/webhook` returns 503, `/api/whatsapp/reminders` returns 503.

| Placeholder | File | What it is | Where to get it |
|---|---|---|---|
| `WHATSAPP_TOKEN` | env, `lib/whatsapp/api.ts` | Permanent System User access token with `whatsapp_business_messaging` and `whatsapp_business_management` | Meta Business settings → Users → System users → Generate new token (expiry: never) |
| `WHATSAPP_PHONE_NUMBER_ID` | env, `lib/whatsapp/api.ts`, `lib/whatsapp/engine.ts` | The Cloud API phone number id (not the phone number) | developers.facebook.com → your app → WhatsApp → API Setup |
| `WHATSAPP_APP_SECRET` | env, `lib/whatsapp/api.ts` | Verifies `X-Hub-Signature-256` on every webhook POST | Meta app → App settings → Basic → App secret |
| `WHATSAPP_VERIFY_TOKEN` | env, `app/api/whatsapp/webhook/route.ts` | Shared secret for Meta's webhook verification (GET) | Make one up (long, random); enter it in Meta app → WhatsApp → Configuration |
| `WHATSAPP_BUSINESS_NUMBER` | env, `components/account/WhatsApp.tsx` | The number learners message, digits with country code (e.g. `2348012345678`) | The number you registered on the WhatsApp Business Platform |
| `WHATSAPP_GRAPH_VERSION` (default `v21.0`) | env, `lib/whatsapp/api.ts` | Graph API version in the URL | developers.facebook.com/docs/graph-api/changelog: use a current, supported version |
| `WHATSAPP_TEMPLATE_REMINDER` (default `lesson_reminder`) | env, `app/api/whatsapp/reminders/route.ts` | Approved Utility template, language `en`, one body variable (the next lesson) | WhatsApp Manager → Message templates |
| `CRON_SECRET` | env, `app/api/whatsapp/reminders/route.ts` | Bearer token Vercel Cron sends to the reminders route | Make one up; add it in Vercel → Environment Variables |
| Cron time `30 7 * * *` | `vercel.json` | Daily reminders at 07:30 UTC = 08:30 Lagos | Your choice (check your Vercel plan's cron limits) |
| Display name "Automancy Academy" | Meta (WhatsApp Manager) | Shown to learners | Submit for approval; must match the website brand |
| Meta pricing | README, admin page note | Since 1 Oct 2026: 1,000 free-form replies a month per number free, then charged; templates charged per delivery | developers.facebook.com/docs/whatsapp/pricing: **check the current Nigeria rates** |

## Template to submit
`lesson_reminder` · category **Utility** · language **English (en)** · body:

> Hi! Your next Automancy Academy lesson is ready: {{1}}. Reply CONTINUE to pick up where you left off, or REMINDERS OFF to stop these reminders.

Sample for `{{1}}`: `Lesson 3.4: Webhooks in n8n`. Optional quick-reply buttons: `Continue`, `Stop reminders` (the bot understands both, typed or tapped). No other templates are used: linking (`LINK 123456`) and lessons are replies inside the 24-hour window the learner opens.

## Decisions to confirm
- Reminders go only to learners who can open their next lesson (free Base Camp or enrolled). Learners who finished Base Camp without paying get no reminders, so the template stays non-promotional (Utility).
- A reminder that fails to send also waits three days before the next try.
- PAUSE also stops reminders until RESUME; STOP turns reminders off and START turns them back on.
- The bot awards XP as the course does: lesson 100, boss 300, capstone 400 (boss and capstone only after an accepted project submission), plus 25/50/100 when a Bronze/Silver/Gold mission review is accepted.
- WhatsApp quiz answers are not saved as the course's checkpoint quiz scores (those come from the 5-question quizzes in the web course and count towards the certificate).

## Data contracts read by the bot
- `data/whatsapp/<fileId>.json` and `data/whatsapp/index.json` (writer W1). A missing or empty script sends the learner to the lesson in the app; malformed cards are skipped; a script always ends with a "done" card.
- `data/whatsapp-media.json` (writer W3). A missing key falls back to the card's YouTube and/or app link. Videos are sent by link; `wa_media_ids` can hold uploaded media ids (used when present and unexpired).
