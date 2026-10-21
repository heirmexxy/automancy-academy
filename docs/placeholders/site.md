# Placeholders · site pages (writer E)

Replace or confirm everything below before launch.

## Legal review needed
**The four legal pages are drafts for legal review.** They read as final on the site, but a Nigerian lawyer should review them before launch: `app/(site)/legal/{terms,privacy,refunds,certificate}/page.tsx`. Points to check in particular:
- Terms: liability cap (12 months' fees), the governing courts, the instalment wording ("not a loan, no interest"), the creator-content section (must match H's `/teach/terms`), and the referral rules (must match A's `/earn` page and payout schedule).
- Privacy: NDPA 2023 lawful bases, the transfer safeguards (sections 41 to 43; confirm each provider's DPA and SCCs are actually signed), whether the company must register with the NDPC as a data controller of major importance and appoint a DPO, and 6-year retention of financial records.
- Refunds: the 30% rule and the cohort cut-off (first live call) must match how A's admin refund screen decides; creator-course refunds (section 7) must match H's creator terms.
- Certificate: wording must stay consistent with `CERT_STATEMENT` in `lib/certificate.ts` (writer C).
- When you change any legal page, update `LEGAL_UPDATED` in `app/(site)/legal/meta.ts`.

## Values to set
| File | What | Where to get it |
|---|---|---|
| `lib/config.ts` → `COMPANY` (shared) | Seller's legal name, registered address and CAC RC number, shown on every legal page | CAC certificate. Confirm whether the seller is Twellr Technologies Limited or another entity |
| `lib/config.ts` → `SUPPORT_EMAIL` (shared) | Support mailbox, used for refunds, deletion requests, team-seat and workshop enquiries | Set `NEXT_PUBLIC_SUPPORT_EMAIL` |
| `app/(site)/legal/meta.ts` → `PRIVACY_EMAIL` | Privacy contact (defaults to support) | Set `NEXT_PUBLIC_PRIVACY_EMAIL`, e.g. privacy@… |
| `app/(site)/legal/meta.ts` → `DPO_NAME` | Data Protection Officer's name (shows on the privacy page) | Company decision; NDPA s.32 |
| `app/(site)/legal/meta.ts` → `COURTS` | Courts with jurisdiction (currently "the courts of Lagos State, Nigeria") | Counsel |
| `app/(site)/legal/meta.ts` → `DB_REGION` | Supabase project region, shown in the privacy processors table | Supabase → Project settings → General |
| `app/(site)/legal/privacy/page.tsx` → Azure row | Azure Speech region | Azure portal (same as `AZURE_SPEECH_REGION`) |
| `app/(site)/legal/meta.ts` → `FINANCE_RETENTION_YEARS`, `DELETION_DAYS` | 6 years and 30 days | Confirm with accountant and counsel |
| `app/(site)/legal/refunds/page.tsx` → `MAX_DONE` | "30%" of paid lessons | Keep in step with A's refund checks |
| `app/(site)/legal/refunds/page.tsx` | "We reply within 5 working days" and the Paystack timing "5 to 10 working days" | Confirm the support SLA and Paystack's current refund timings |

## Content to confirm
- **Kitovu figures and awards** (`components/landing/Sections.tsx` → `Guide`, marked PLACEHOLDER): 25,000 smallholder farmers supported; 300,000 Abia farmers on the ADDS platform; 30,000+ t of produce connected to market; awards: UN Science, Technology and Innovation Award 2020, World Bank Ideas for Action 2017 winners, Africa Prize for Innovation 2018, Total Startupper Awards 2016, Global Startup Awards Africa 2021. Copied from the prototype; confirm each one is accurate and can be stated publicly.
- **Photo consent:** `/public/img/emeka.jpg` and `/public/img/miracle.jpg` appear on the landing page. Get written consent from both for public use.
- **Guide roles:** "Founder & CEO, Kitovu" and "Co-founder, Kitovu" (Nduka Miracle). Confirm the titles.
- **Hero copy and FAQ:** the course length (sessions and weeks) is computed from `course-build/index.json`. The tool-cost FAQ says Zapier, Make and n8n have free plans; re-check before launch.
- **Careers:** the Salesforce exam price (US$200, US$100 retake) and "Zoho doesn't currently certify administrators" come from the prototype. Re-check both. The CRM specialisation price comes from `lib/pricing.ts`.
- **Private team workshop** card on `/pricing#business` says "Quote" and links to email. Add a price if one is set.

## Behaviour notes for other writers
- Waitlist: `joinWaitlist` in `lib/actions/account.ts` inserts into A's `waitlist` table (service role, after validating email and product). It accepts only products with `comingSoon` or `hiddenUnlessCohortOpen`. It has no rate limit; add one if it gets abused.
- Account deletion is a request only: it writes `audit_log` (`action = 'account.deletion_requested'`) and emails support. An admin deletes the user in Supabase → Authentication after checking payments, refunds and payouts.
- `/account/data` exports the learner's own rows from a fixed list of tables (in `app/(site)/account/data/route.ts`). Add new user-owned tables there; the marketplace names `course_enrollments` and `creators` are guesses.
- Admin → Settings stores "no next cohort date" by deleting the `next_cohort_date` row, because `settings.value` is NOT NULL.
