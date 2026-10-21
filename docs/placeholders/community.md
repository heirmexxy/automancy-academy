# Community, leaderboard and Hire talent (writer D): placeholders and launch checks

| File | What | Where to get the real value / what to do |
|---|---|---|
| `lib/config.ts` → `SUPPORT_EMAIL` (shared) | Inbox that receives Hire talent intro requests (`requestIntro` emails it) | Set `NEXT_PUBLIC_SUPPORT_EMAIL` to the real support inbox |
| `lib/email.ts` → `RESEND_API_KEY`, `EMAIL_FROM` (shared) | Without a key, intro-request emails are only logged (requests are still stored and visible in Admin → Hire talent) | Resend dashboard → API keys; verify the sending domain |
| `supabase/migrations/0004_community.sql` | Run after 0001 (and ideally after 0003). No secrets inside | Supabase SQL editor or `supabase db push` |
| `app/(site)/leaderboard/page.tsx` → "How XP works" | XP amounts (lesson 100, boss 300, capstone 400) copied from the course prototype | Confirm against the final course scoring (writer B) |
| `app/(site)/hire/page.tsx` → employer copy | "Introductions are free … usually within two working days" | Confirm the promise and the turnaround the team can keep |
| `lib/pricing.ts` → `employer_post` (shared) | "Post a role" price shown on /hire, links to `/checkout/employer_post` | Writer A / pricing owner |
| Challenges | No challenges exist at launch; the banner is hidden until an admin creates one in Admin → Community → Weekly challenges | Write the first brief; only promise prizes you will hand out manually (nothing is auto-awarded) |

Notes
- Rate limits: 20 posts and 60 replies per learner per 24 h (checked in the app and again by database triggers); 5 intro requests per IP or email per 24 h, plus a honeypot field and a 3-second time trap.
- Auto-moderation: 3 open reports hide a post or reply until an admin reviews it in Admin → Community.
- Hire talent profiles are public only while `visible`, not hidden by an admin, and the learner holds a non-revoked certificate (`public.has_certificate`, which looks up writer C's `certificates` table defensively).
