# Automancy Academy app · conventions for everyone writing code here

App root: `/tmp/claude-0/-home-claude/7b78737b-5c8c-5c3c-b5c8-e7547964bd96/scratchpad/automancy-app`
Course source (the existing single-page course): `/tmp/claude-0/-home-claude/7b78737b-5c8c-5c3c-b5c8-e7547964bd96/scratchpad/course`

## Product in one paragraph
Automancy Academy teaches AI automation (Zapier, Make, n8n, AI agents, growth, CRM, client work) to Nigerian/African learners through 49 lessons, 6 boss projects and a capstone, following Harvest Lane (Tolu's produce business in Ibadan). Guides: Emeka (Founder & CEO, Kitovu) and Nduka Miracle (Co-founder, Kitovu). Live at `https://automancy.twellr.com` (placeholder domain). A public landing page introduces the product; the learning sits behind sign-up/login. Base Camp (Track 0: lessons 0.1–0.6 and B0) is free; everything else needs an active "self", "cohort" or "team" enrollment.

## Stack (do not add dependencies)
Next.js 15 App Router + TypeScript + React 19, `@supabase/ssr` + `@supabase/supabase-js`, `server-only`. No Tailwind, no UI kits, no other npm packages. Call third-party APIs (Paystack, Anthropic, Azure Speech, Resend) with `fetch`. npm is unavailable in this workspace, so nothing can be installed or built here: write carefully, keep to well-known APIs, and run the syntax checker (below).

Next.js 15 rules: `cookies()`, `headers()`, `params` and `searchParams` are async (`await`). Page props: `{ params: Promise<{…}>, searchParams: Promise<Record<string,string|undefined>> }`. Route handlers export `GET`/`POST`. Server actions live in `lib/actions/<feature>.ts` with `"use server"`. Client components start with `"use client"` and must not import `lib/auth`, `lib/supabase/server`, `lib/supabase/admin`, `lib/settings` or `lib/email`.

## Shared modules (already written; import, don't rewrite)
- `lib/config.ts`: SITE_URL, SITE_NAME, SUPPORT_EMAIL, COMPANY, FEATURES, `hasSupabase/hasPaystack/hasAnthropic/hasAzureSpeech`, `adminEmails()`.
- `lib/supabase/server.ts` `createClient()` (user session, RLS applies) · `lib/supabase/admin.ts` `createAdminClient()` (service role: only after checking who's asking) · `lib/supabase/client.ts` (browser).
- `lib/auth.ts`: `getUser()`, `getProfile()`, `requireUser(next)`, `requireAdmin()`, `getEntitlements(userId)` → `{products, course, member, story, templates, crmspec}`.
- `lib/settings.ts` `getSettings()` → `{cohort_open, live_calls_visible, next_cohort_date, ai_review_auto}`.
- `lib/email.ts` `sendEmail(to, subject, html)` (logs instead of sending when no key).
- `lib/pricing.ts` `PRODUCTS`, `product(id)`, `REFERRAL` (prices will be finalised separately; always read prices from here, never hard-code).
- `lib/course.ts` `COURSE.items` (55 items: id, title, track, trackName, kind lesson|boss|capstone, free, sessions), `percentDone(done)`.
- `lib/format.ts` `ngn()`, `usd()`, `fmtDate()`, `esc()`.
- `middleware.ts`: protects `/learn`, `/account`, `/community`, `/earn`, `/admin`, `/checkout`; stores `?ref=CODE` in cookie `am_ref` for 30 days.
- Layouts: `app/layout.tsx` (fonts, globals), `app/(site)/layout.tsx` (header + footer for all normal pages). Put normal pages under `app/(site)/…`. `/learn` is NOT in (site) (full-screen course).
- Admin shell: `app/(site)/admin/layout.tsx` (requireAdmin + side nav). Admin pages: `/admin`, `/admin/learners`, `/admin/payments`, `/admin/refunds`, `/admin/referrals`, `/admin/reviews`, `/admin/certificates`, `/admin/community`, `/admin/hire`, `/admin/audio`, `/admin/settings`. Each admin server action must call `requireAdmin()` itself.
- Styles: `app/globals.css` classes: `.wrap .narrow .stack .row .grid2 .grid3 .grid4 .card .card.bold .btn .btn.alt .btn.sm .pill(.ok/.warn/.bad) .fld .check .alert(.ok/.bad/.warn) table.dt .scroll .empty .kpi .prose .eyebrow .lede .muted .note .placeholder`. Colour tokens `--paper --paper2 --card --ink --muted --line --sun --spark --volt --sky --grape --teal --glitch --rose`, fonts `--display --body --mono`. Feature-specific CSS: `app/(site)/<feature>/<feature>.css` imported by its page.
- DB (migration `supabase/migrations/0001_core.sql`): `profiles(id, email, full_name, city, role learner|reviewer|admin, public_profile, referral_code, marketing_consent, consent_at, created_at, last_seen_at)`, `enrollments(id, user_id, product, status active|refunded|expired|cancelled, source paystack|admin|free|coupon|team, payment_id, started_at, expires_at, note)`, `progress(user_id, done jsonb, state jsonb, xp, items_done, week_xp, week_start, updated_at)`, `settings(key, value jsonb)`, `audit_log(actor, action, target, detail, at)`; SQL helpers `public.is_admin()`, `public.is_staff()`.

## Ownership (only create/edit files you own; read anything)
| Writer | Owns |
|---|---|
| A · Payments & admin | `lib/paystack.ts`, `lib/referrals.ts`, `lib/actions/payments.ts`, `app/(site)/checkout/**`, `app/api/paystack/**`, `app/(site)/earn/**`, `app/(site)/admin/page.tsx`, `admin/learners/**`, `admin/payments/**`, `admin/refunds/**`, `admin/referrals/**`, `components/account/Purchases.tsx`, `components/account/Referral.tsx`, `supabase/migrations/0002_payments.sql`, `tests/payments.test.mjs`, `docs/placeholders/payments.md` |
| B · Course integration | course source files except `src/modules/*.html` and `src/walk.js`; `app/learn/**`, `app/api/progress/**`, `app/api/feedback/**`, `lib/learn.ts`, `scripts/sync-course.mjs`, `course-build/**`, `supabase/migrations/0006_course.sql`, `app/(site)/admin/feedback/**`, `docs/placeholders/course.md` |
| C · AI reviewer & certificates | `lib/reviewer.ts`, `lib/certificate.ts`, `lib/actions/reviews.ts`, `app/api/review/**`, `app/(site)/verify/**`, `admin/reviews/**`, `admin/certificates/**`, `components/account/Certificate.tsx`, `course-addons/review.js`, `data/sheets/**`, `supabase/migrations/0003_reviews.sql`, `tests/reviewer.test.mjs`, `docs/placeholders/reviewer.md` |
| D · Community | `app/(site)/community/**`, `app/(site)/leaderboard/**`, `app/(site)/hire/**`, `app/api/community/**`, `lib/actions/community.ts`, `admin/community/**`, `admin/hire/**`, `supabase/migrations/0004_community.sql`, `docs/placeholders/community.md` |
| E · Site pages | `app/(site)/page.tsx` (landing), `app/(site)/pricing/**`, `app/(site)/careers/**`, `app/(site)/legal/**`, `app/(site)/account/**` (composes the account components), `admin/settings/**`, `lib/actions/account.ts`, `lib/actions/settings.ts`, `components/landing/**`, `app/not-found.tsx`, `docs/placeholders/site.md` |
| H · Creator marketplace | `app/(site)/teach/**`, `app/(site)/courses/**`, `app/(site)/admin/courses/**`, `app/api/courses/**`, `lib/marketplace.ts`, `lib/actions/marketplace.ts`, `supabase/migrations/0007_marketplace.sql`, `docs/placeholders/marketplace.md` |
| F · Voice & assistant | `lib/tts.ts`, `lib/assistant.ts`, `app/api/tts/**`, `app/api/assistant/**`, `app/(site)/audio/**` (Story Mode downloads), `admin/audio/**`, `course-addons/voice.js`, `course-addons/assistant.js`, `supabase/migrations/0005_voice.sql`, `docs/placeholders/voice.md` |

Course add-ons: files in `course-addons/*.js` are plain browser JavaScript (no imports, no build) that `/learn` inlines after the course script. They read `window.AUTOMANCY` (see below) and call the app's `/api/*` routes with `fetch(…, {credentials: "same-origin"})`.

`window.AUTOMANCY` (set by `/learn`, defined by B): `{ user: {id, name, email}, ent: {course, member, story, templates, crmspec}, progress: {done, state, xp}, free: ["0.1",…,"B0"], api: "/api", siteUrl, links: {pricing, community, leaderboard, hire, earn, careers, account, logout} }`.

## Placeholders
Anything that must be replaced before launch (keys, IDs, legal details, emails, prices to confirm) uses an `UPPER_SNAKE` placeholder or the word `PLACEHOLDER` in a comment. List every one in your `docs/placeholders/<you>.md` (file, what it is, where to get the real value). The README is assembled from these.

## Security musts
Never trust the client for money or grades: verify Paystack signatures (HMAC-SHA512 of the raw body with the secret key) and re-verify the transaction by API; compute access, certificates and XP awards on the server. Use RLS on every table; service-role client only on the server after an auth check. Escape user content (React does by default; never `dangerouslySetInnerHTML` with user input). Rate-limit AI and TTS calls per user.

## Check your work
`NODE_PATH=$(npm root -g) node /tmp/claude-0/-home-claude/7b78737b-5c8c-5c3c-b5c8-e7547964bd96/scratchpad/apptools/syntax.mjs <app root>` must report no problems in your files (it checks syntax, `@/` imports, and client/server mixing). Pure logic you can test goes in a module with no `@/` imports, tested with `node --test` or `tsx --test` (both available globally).

## Cross-writer contracts (build to these exactly)
- **Submissions (C creates in 0003):** `submissions(id uuid, user_id, item_id text, tier text 'b'|'s'|'g'|'boss'|'capstone', content text, links text[], status text 'pending'|'accepted'|'revise'|'rejected', score int, ai_result jsonb, needs_human bool, reviewer_note text, reviewed_by uuid, created_at, reviewed_at)`. B reads accepted rows (`status='accepted'`) to mark missions done in the course. A and E may count pending rows.
- **Certificates (C creates in 0003):** `certificates(id text primary key, user_id, name_on_certificate, issued_at, revoked bool, revoked_reason)`. D requires a non-revoked certificate for a Hire talent profile; A uses it for the Graduate referral tier. `lib/certificate.ts` (C) exports `CERT_STATEMENT` (one-paragraph wording) used by E's legal page.
- **Community API (D):** `POST /api/community/posts` body `{type: "journal"|"help"|"win", itemId?: string, title?: string, body: string}` → `{id}`; `GET /api/community/leaderboard?scope=week|all` → `[{name, city, xp, items}]` (public_profile users only). B's course calls both.
- **Progress API (B):** `GET/PUT /api/progress` body `{done, state, xp, weekXp}`.
- **Review API (C):** `POST /api/review` body `{itemId, tier, content, links}` → `{id, status, score, feedback, strengths[], fixes[], criteria[]}`; `GET /api/review?itemId=` → the learner's submissions for that item.
- **Voice hook (F provides, B and G use):** `window.AUTOMANCY_TTS = { ready: boolean, speak(text, {voice: "male"|"female", rate}) => Promise<void> (resolves when audio ends; rejects on failure so the caller falls back to browser speech), stop() }`. Callers: course Listen reader, guide "Walk me through it", the animated walkthrough player. If `AUTOMANCY_TTS` is missing or not ready, keep the existing browser-voice behaviour.
- **Lesson text for AI (B provides):** `course-build/lessons/<id>.html` (id with "." → "-", e.g. `3-4.html`, bosses `B3.html`) containing that item's `<template>`; F and C read these on the server.
- **Marketplace payments (A calls H):** A's checkout and webhook support a second kind of purchase: Paystack metadata `{kind: "course", course_id}`. H provides `lib/marketplace.ts` exporting `startCoursePurchase(userId, email, courseId, refCode?)` (returns the Paystack init params or a redirect URL, using A's `lib/paystack.ts`) and `handleCoursePayment(payment)` (grants `course_enrollments` access and records the creator's earning). A's webhook calls `handleCoursePayment` when `metadata.kind === "course"`.

## WhatsApp learning (added 21 Oct 2026)
App root is now the git repo **/home/claude/automancy-academy** (course source in `course/`). Work there.

Learners choose "Learn on WhatsApp" in /account, link their number (they send `LINK 123456` with a one-time code to the Automancy number from their phone; no template needed), then learn lesson by lesson in chat. Progress is the same `progress` row as the web course; missions go through the same AI reviewer (`submissions`). Meta WhatsApp Cloud API, Graph API version from env `WHATSAPP_GRAPH_VERSION` (default `v21.0`).

**Lesson scripts (W1 writes, W2 reads):** `data/whatsapp/<fileId>.json` (fileId as for course-build lessons: `3-4`, `B3`) = `{ id, title, track, free, voice: "male"|"female", cards: Card[] }`, where Card is one of:
- `{t:"text", body}` (≤ 1000 chars, plain WhatsApp formatting: *bold*, _italic_, `- ` bullets)
- `{t:"video", caption, media: "walk:<id>" | "clip:<id>:<n>" | null, youtube: url | null, app: url}` (media key is resolved through `data/whatsapp-media.json`; if missing, the bot sends the YouTube link and/or the app link instead)
- `{t:"quiz", q, options: string[] (2–4, each ≤ 24 chars for list rows; longer ones go in the body as A–D), answer: number, why}`
- `{t:"reveal", prompt, answer}` (Glitch hunts: learner taps "Reveal")
- `{t:"task", tier: "b"|"s"|"g"|"boss"|"capstone", title, body}` (learner replies with their proof-of-work text, or SKIP; the bot sends it to the AI reviewer)
- `{t:"link", body, url}` (interactive labs and code-heavy parts: open in the app)
- `{t:"done", body}` (lesson complete; marks the item done in progress)
Index: `data/whatsapp/index.json` = `[{id, title, track, free, cards}]` in course order.

**Media manifest (W3 writes, W2 reads):** `data/whatsapp-media.json` = `{ "walk:<id>": {url, bytes, seconds}, "clip:<id>:<n>": {…} }`, public HTTPS MP4 URLs (H.264/AAC, ≤ 16 MB).

**Bot (W2):** `app/api/whatsapp/webhook/route.ts` (GET verify with `WHATSAPP_VERIFY_TOKEN`; POST verifies `X-Hub-Signature-256` HMAC-SHA256 with `WHATSAPP_APP_SECRET` on the raw body), `lib/whatsapp/*`, migration `0009_whatsapp.sql`, account linking UI `components/account/WhatsApp.tsx` + `lib/actions/whatsapp.ts`, reminders `app/api/whatsapp/reminders/route.ts` (Vercel Cron, `CRON_SECRET`), admin `app/(site)/admin/whatsapp/**`, `docs/placeholders/whatsapp.md`.
