# AI reviewer and certificates: placeholders and setup (writer C)

## Placeholders to replace

| File | What | Where to get the real value |
|---|---|---|
| `.env` `ANTHROPIC_API_KEY` | Anthropic API key used by the AI reviewer (`lib/reviewer.ts`). Without it, every submission waits in Admin → AI reviews for a person. | console.anthropic.com → API keys. Set a monthly spend limit there too. |
| `.env` `ANTHROPIC_MODEL` / `lib/reviewer.ts` `reviewerModel()` | Model name, default `claude-sonnet-5-5` (PLACEHOLDER: confirm the current model name before launch). | Anthropic docs → Models. |
| `.env` `LINKEDIN_ORG_ID` (optional) / `lib/certificate.ts` `LINKEDIN_ORG_ID` | Numeric LinkedIn company page ID, so "Add to LinkedIn" links the certificate to the Automancy Academy page instead of plain text. | The number in your LinkedIn company page admin URL (linkedin.com/company/<ID>/admin). |
| `lib/config.ts` `SITE_URL` (shared) | The certificate's verify links (`/verify/<id>`) are built from it, so they're printed on LinkedIn and shared links. Set the final domain **before** the first certificate is issued. | Your production domain. |
| `lib/certificate.ts` `CERT_STATEMENT` | The wording of what the certificate certifies (also shown on the legal page and each verify page). Have it checked before launch. | Founder / legal review. |
| `app/api/review/route.ts` `maxDuration = 120` | AI reviews can take up to a minute. Vercel Hobby caps functions at 60 s; use Pro (or lower it to 60). | Vercel plan settings. |

## Setup

1. Run `supabase/migrations/0003_reviews.sql` after `0001_core.sql` (creates `submissions`, `certificates`, `review_usage`, and the `verify_certificate` and `take_review_quota` functions).
2. Marking data: `node scripts/build-review-data.mjs` (reads `../course/src/modules/*.html` and `../course/src/sheets/*.json`, or pass the course path / set `COURSE_DIR`). It writes `data/missions.json` and `data/sheets/*.json`. Re-run and redeploy whenever lessons, rubrics or mission sheets change. It prints anything it couldn't parse.
3. Admin → Settings → `ai_review_auto`: when off, submissions are stored as pending and flagged for a person.

## How it behaves
- Limits: 20 reviews per learner per day, 5 per mission tier per day (Lagos calendar day); free accounts can submit Base Camp items only (0.1–0.6, B0).
- Lessons: accepted when every "Done when" criterion, "covers every task" and "safe to share" are met and the score is 70+. Bosses and capstone: the score is the sum of the rubric areas, and it passes at 80+ with every go-live/handover must-have met. These rules are enforced in code, not left to the model.
- It judges written evidence only. Links are stored for spot-checks and never opened or sent to the model (only their host names).
- Secrets (keys, tokens, passwords, real card numbers) are redacted before storing and before the model sees them; the submission is then flagged.
- Flagged for a person (`needs_human`): thin or unjudgeable evidence, likely copy of the model answer (also checked in code: 45%+ overlap), secrets or unsafe content, prompt-injection attempts, AI errors, or no API key. An AI "accept" that's flagged stays **pending** until a person confirms it.
- Accepted reviews: the course add-on dispatches `automancy:review` (B's course awards the XP); the server-side source of truth is `submissions.status = 'accepted'`.

## For other writers
- E (account page): render `<Certificate notice={sp.cert} error={sp.cert_error} />` from `components/account/Certificate.tsx` (server component). The claim action redirects to `/account?cert=issued#certificate` or `/account?cert_error=…#certificate`.
- E (legal page): `import { CERT_STATEMENT } from "@/lib/certificate"`.
- A and D: a live certificate is `certificates` row with `revoked = false` (at most one per learner, enforced by a unique index).
