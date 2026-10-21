# Automancy Academy

The learning platform for **Automancy Academy**: an AI automation course (Zapier, Make, n8n, AI agents, growth and CRM automation, client work) for Nigerian and African learners, built with Kitovu. Live at **https://automancy.cc**.

- Public landing page, pricing, careers, legal pages, certificate verification, Hire talent directory, creator-course catalogue.
- Sign-up and login. Base Camp (lessons 0.1–0.6 and Boss 0) is free; everything else unlocks with a paid plan.
- The full course at `/learn`: 49 lessons, 6 boss projects and a capstone, labs, animated walkthroughs and clips, n8n/Make/Zapier templates, mission sheets, natural Nigerian voices, an AI course assistant ("Sage") and an AI reviewer that marks every mission.
- Paystack checkout (incl. Pay in 3), referrals and payouts, certificates, community, weekly challenges, leaderboard, Story Mode audio downloads, a creator marketplace, and an admin dashboard for all of it.

> **Status (21 Oct 2026).** All code is written, syntax-checked, type-checked against stand-in package types, and the money and marking logic is unit-tested (34 tests). It has **not yet been built or run against real Next.js, Supabase or Paystack**, because packages couldn't be installed where it was written. Expect a few small fixes on the first `npm run build`. Follow "First run" below and fix anything it reports before launch.

---

## ⚠️ Placeholders to replace before launch

Everything below is a placeholder or a decision to confirm. Each writer's detailed list is in `docs/placeholders/` (one file per area). **Search the code for `PLACEHOLDER` to find every marked spot.**

### Keys and accounts (environment variables; never commit them)
| Variable | What | Where to get it | Without it |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Database and login | Supabase → Project settings → API | **App won't work** |
| `PAYSTACK_SECRET_KEY`, `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Payments | Paystack → Settings → API Keys & Webhooks. **Not stored in this repository: add them at go-live (see "Going live with Paystack" below).** | Checkout pages work as normal, but clicking Pay shows "We couldn't start your payment… no money was taken", and admins get an email |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | AI reviewer and Sage assistant | console.anthropic.com (set a monthly spend limit). Confirm the current model name (default `claude-sonnet-5-5`). | Submissions wait for a person in Admin → AI reviews; Sage is hidden |
| `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` | Natural Nigerian voices (`en-NG-AbeoNeural`, `en-NG-EzinneNeural`) and Story Mode MP3s | Azure portal → Speech resource → Keys and Endpoint | Browser voices are used |
| `RESEND_API_KEY`, `EMAIL_FROM` | Receipts, intro requests, creator emails | resend.com (verify the sending domain) | Emails are logged, not sent |
| `ADMIN_EMAILS` | Accounts that become admins at first sign-in | Your email(s) | No admin access |
| `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPPORT_EMAIL`, `NEXT_PUBLIC_PRIVACY_EMAIL` | Domain and contact inboxes | `https://automancy.cc`; create the support@ and privacy@ mailboxes on automancy.cc | Defaults to `automancy.cc` addresses |
| `LINKEDIN_ORG_ID` (optional) | Links certificates to the LinkedIn company page | Your LinkedIn page admin URL | Plain-text organisation name |

### Business and legal
- **Seller details** (`lib/config.ts` → `COMPANY`): legal name (set to Twellr Technologies Limited: confirm), registered address, CAC RC number.
- **Legal review by a Nigerian lawyer** of `app/(site)/legal/*` (terms, privacy, refunds, certificate) and `app/(site)/teach/terms` (creator agreement). Data Protection Officer name, courts, NDPC registration, data-region names: `app/(site)/legal/meta.ts`.
- **Creator marketplace terms**: revenue share 70/30, price limits ₦2,000–₦500,000 (`app/(site)/courses/_lib/core.ts` **and** `supabase/migrations/0007_marketplace.sql`), payout schedule, withholding tax, copyright-complaint process, whether referrers earn on creator courses.
- **Prices** are final in `lib/pricing.ts` (rationale and sources in `docs/pricing-rationale.md`). USD checkout needs USD enabled on your Paystack account.
- **Service promises** shown to users: refund reply times, payout timing, Hire talent intro turnaround, creator review time (see `docs/placeholders/payments.md`, `community.md`, `marketplace.md`).

### Content to confirm
- Kitovu figures and awards on the landing page (`components/landing/Sections.tsx`), guide titles, **written consent** to use both photos (`public/img/`).
- Featured videos: 38 of 55 couldn't be confirmed automatically. Open each in `course/docs/lesson-videos.md` once.
- n8n, Make and Zapier templates: checked for structure, not imported into the live tools. Import each once (test keys, test data). Learners can report problems; they appear in Admin → Feedback.
- Platform facts were re-checked in Oct 2026 (`course/docs/fact-check-*.md`); re-check plan limits and prices close to launch.
- Guide name in clips and walkthroughs: "Miracle" (confirm she prefers it to "Nduka").

---

## First run (local)

Needs Node 20+ and a Supabase project.

```bash
cp .env.example .env.local      # fill in at least the three Supabase values and ADMIN_EMAILS
npm install
npm run build                   # fix anything it reports, then:
npm run dev                     # http://localhost:3000
npm test                        # unit tests (money, referrals, reviewer)
```

## Deploy

1. **Supabase** (new project, region near your users).
   - SQL editor: run every file in `supabase/migrations/` **in order** (0001 → 0008). 0005 creates the public `tts` Storage bucket; 0008 holds security fixes and must also be run on a database that already has 0001–0007.
   - Authentication → URL configuration: Site URL `https://automancy.cc`; redirect URL `https://automancy.cc/auth/callback` (add `http://localhost:3000/auth/callback` for local).
   - Authentication → Email: keep "Confirm email" on; customise the templates with the Automancy name. Set up custom SMTP (e.g. Resend) for reliable delivery.
2. **Vercel**: import this repo, add every environment variable above (Production and Preview), deploy. Add the domain `automancy.cc` in Vercel → Domains and set the DNS records Vercel shows at your domain registrar (an A record for `automancy.cc`, and a CNAME for `www` if you want it). Vercel **Pro** is needed for the AI review route's 120-second limit (or lower `maxDuration` to 60 in `app/api/review/route.ts`).
3. **Paystack**: see "Going live with Paystack" below.
4. **First admin**: put your email in `ADMIN_EMAILS`, sign up at `/signup`, confirm the email. You'll see **Admin** in the header.
5. **Admin → Lesson audio → Generate all lesson audio** once (after Azure keys are set), so Story Mode and Listen are instant.
6. **Test the money loop** with Paystack test keys (or one small live purchase you then refund): buy, refund, Pay in 3, referral. Checklist in `docs/placeholders/payments.md`.

## Going live with Paystack

The Paystack keys are deliberately **not** in this repository or its history. Do this when taking the product live:

1. **Generate fresh keys.** Paystack Dashboard → Settings → API Keys & Webhooks → generate new Live keys. (Earlier keys were shared in chat during development; don't use them.)
2. **Add them to Vercel**, never to the code: Project → Settings → Environment Variables → `PAYSTACK_SECRET_KEY` = the `sk_live_…` key (Production only) and `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` = the `pk_live_…` key. For Preview deployments use the Test keys (`sk_test_…` / `pk_test_…`). For local work put them in `.env.local` (git-ignored).
3. **Set the webhook**: same Paystack page → Live Webhook URL `https://automancy.cc/api/paystack/webhook` (and the Test Webhook URL for your preview/local tunnel).
4. **Enable channels**: card, bank transfer, USSD; enable USD only if your Paystack account is approved for it (otherwise remove the USD option at checkout).
5. **Redeploy** so the new variables load, then **test the loop**: one purchase (test keys first, or a small live purchase), the confirmation page, access unlocked, then a refund from Admin → Refunds.
6. **Keep the secret key secret**: only in Vercel/`.env.local`; never in code, chat, email or screenshots. If it's ever exposed, regenerate it in Paystack and update Vercel.

Checkout is fully built: every price, Pay-in-3 option, referral code box and course Buy button is live on the site. The only missing piece is the keys. Until they are added, clicking Pay shows a polite "we couldn't start your payment, no money was taken" message, the attempt is logged (`audit_log`, action `checkout_failed`) and admins get an email (at most hourly). The moment the keys are in Vercel and you redeploy, the same buttons take real payments; no code change is needed.

## Updating the course

The course itself (lessons, labs, templates, walkthroughs) lives in `course/` and is a single-page app built by `course/build.py`.

```bash
# after changing anything in course/src:
npm run course:sync                     # rebuilds course-build/ (what /learn serves)
npm run review:data                     # rebuilds data/ (what the AI reviewer marks against)
python3 course/build.py                 # optional: rebuilds the stand-alone preview course/flowforge.html
```
Commit `course-build/` and `data/`; they are deployed as files.

## How it fits together

| Area | Routes | Code |
|---|---|---|
| Public site | `/`, `/pricing`, `/careers`, `/legal/*`, `/verify/*`, `/hire`, `/courses`, `/teach` | `app/(site)/…`, `components/landing` |
| Accounts | `/signup`, `/login`, `/forgot-password`, `/reset-password`, `/auth/callback`, `/account` | `lib/actions/auth.ts`, `lib/actions/account.ts` |
| Course | `/learn` (full-screen course; paid lessons are never sent to non-paying learners) | `app/learn/route.ts`, `lib/learn.ts`, `course-build/`, `course-addons/` |
| Progress | `PUT /api/progress` | `app/api/progress` |
| Payments | `/checkout/[product]`, `/checkout/callback`, `/api/paystack/webhook`, `/earn` | `lib/paystack.ts`, `lib/money.ts`, `lib/referrals.ts`, `lib/actions/payments.ts` |
| AI reviewer and certificates | `/api/review`, `/account#certificate`, `/verify/[id]` | `lib/reviewer*.ts`, `lib/certificate.ts`, `course-addons/review.js`, `data/` |
| Voice, Story Mode, Sage | `/api/tts`, `/api/tts/lesson`, `/audio`, `/api/assistant` | `lib/tts.ts`, `lib/assistant.ts`, `course-addons/voice.js`, `course-addons/assistant.js` |
| Community | `/community`, `/community/challenges`, `/leaderboard`, `/hire/profile`, `/api/community/*` | `lib/actions/community.ts` |
| Creator marketplace | `/teach`, `/teach/apply`, `/teach/studio`, `/courses/[slug]`, `/courses/[slug]/learn/[lessonId]` | `lib/marketplace.ts`, `lib/actions/marketplace.ts` |
| Admin | `/admin` (overview), learners, payments, refunds, referrals, AI reviews, certificates, community, hire, creator courses, lesson audio, feedback, settings, CSV export | `app/(site)/admin/**`, `app/api/admin/export` |
| Database | 8 migrations with row-level security on every table | `supabase/migrations/` |

Conventions for anyone changing the code: `docs/CONVENTIONS.md`.

## Security notes
- Never commit `.env.local` (it's in `.gitignore`). Keep `SUPABASE_SERVICE_ROLE_KEY`, `PAYSTACK_SECRET_KEY`, `ANTHROPIC_API_KEY` and `AZURE_SPEECH_KEY` server-side only (no `NEXT_PUBLIC_` prefix).
- Payments are granted only after the Paystack signature check and a server-side re-verification of the transaction.
- Learners can't change their role, enrollments, marks or certificates; the database enforces this with row-level security and triggers.
- Learner submissions and questions are scanned for keys and personal data before they're stored or sent to the AI.

## Known limits (v1)
- Payouts (referrers and creators) are paid by hand and marked paid in admin.
- XP and lesson completion come from the course in the browser (capped and validated on the server); missions, bosses and certificates are decided on the server.
- Learning on WhatsApp is designed but not built yet.
