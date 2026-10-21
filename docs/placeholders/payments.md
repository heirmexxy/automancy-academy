# Placeholders · payments, referrals and admin (writer A)

Checkout is built as live: learners see the full checkout and Buy buttons. Until the keys are set, clicking Pay shows "We couldn't start your payment just now. No money was taken…", logs a `checkout_failed` row in `audit_log` and emails the admins (at most hourly). No payment is ever simulated; an admin can still grant access from Admin → Learners → (learner) → Grant access. Adding the keys and redeploying is all it takes to start charging.

| What | Where it's used | Where to get the real value |
|---|---|---|
| `PAYSTACK_SECRET_KEY` | `lib/paystack.ts` (all API calls, webhook signature), `hasPaystack()` | Paystack Dashboard → Settings → API Keys & Webhooks. Use `sk_test_…` while testing and `sk_live_…` at launch. Server-only: never expose it. |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Not needed by the redirect checkout (kept in `.env.example` for later inline checkout) | Same page (`pk_test_…` / `pk_live_…`). |
| Webhook URL | `app/api/paystack/webhook/route.ts` | In Paystack → Settings → API Keys & Webhooks, set **Webhook URL** to `${SITE_URL}/api/paystack/webhook` (e.g. `https://automancy.cc/api/paystack/webhook`). Set it separately for Test and Live mode. Events used: `charge.success`, `refund.processed`. |
| Callback URL | `lib/actions/payments.ts` sends `callback_url = ${SITE_URL}/checkout/callback` on every initialize | Nothing to set in the dashboard (it is per transaction). Make sure `NEXT_PUBLIC_SITE_URL` is the real domain. |
| USD payments | Checkout "US dollars" option | Paystack only accepts USD once enabled on your business: Dashboard → Settings → Preferences → Currencies (requires a USD settlement account / approval). Until then, USD attempts fail at initialize and the learner sees "Try naira". You can hide the option by removing it from `app/(site)/checkout/[product]/page.tsx`. |
| Pay with transfer / USSD / bank | Naira checkout | Enable the channels you want in Dashboard → Settings → Preferences → Payment channels. |
| Refunds API | `refundTransaction()` (Admin → Refunds → "Approve and refund via Paystack") | Works on live keys once the account has a positive balance; otherwise use "Mark refunded manually" and refund from the dashboard. |
| Bank list endpoint | `listBanks()` → `GET https://api.paystack.co/bank?country=nigeria&currency=NGN` (payout form on `/earn`) | No setup; needs the secret key. Without it, `/earn` shows free-text bank name and account name fields. |
| Account resolve + transfer recipients | `resolveAccount()` (`GET /bank/resolve`), `createTransferRecipient()` (`POST /transferrecipient`) | No setup. Only the last 4 digits of the account number are stored (`payout_accounts.account_last4`). |
| Transfers (payouts) | Admin pays referral payouts **manually** for now and marks them paid in Admin → Referrals | To automate later: enable Transfers in Paystack (Dashboard → Transfers; may need OTP disabled for API transfers) and call `POST /transfer` with the stored `paystack_recipient_code`. |
| `RESEND_API_KEY`, `EMAIL_FROM` | Receipt email after a successful payment (`sendReceipt` in `lib/paystack.ts`) | See `lib/email.ts`; without a key receipts are logged, not sent. |
| `COMPANY.legalName` / `address` | Receipt email footer | `lib/config.ts` (PLACEHOLDER address and RC number). |
| `SUPPORT_EMAIL` | Checkout, callback failure text, team-seats contact | `lib/config.ts` / `NEXT_PUBLIC_SUPPORT_EMAIL`. |
| Refund turnaround copy | "We reply within 3 working days", "5 to 10 working days" (Purchases), "We pay within 5 working days" (/earn) | PLACEHOLDER service levels: confirm or edit in `components/account/Purchases.tsx` and `app/(site)/earn/page.tsx`. |
| Referral terms link | `/earn` links to `/legal/terms` | Writer E's terms page should include the referral rules (tiers, 14-day pending, cohort cap 25%, no self-referral, minimum payout). |
| Prices, discount, tiers, refund window, minimum payout | Everything reads `PRODUCTS` and `REFERRAL` in `lib/pricing.ts` | Final values live there; cohort commission cap (25%) is `COHORT_COMMISSION_CAP` in `lib/money.ts`. |

## Database
Run `supabase/migrations/0002_payments.sql` after `0001_core.sql`. It adds `payments`, `refund_requests`, `referral_earnings`, `payout_accounts`, `payouts`, `waitlist`, plus `profiles.referred_by`, `payments.plan_ref` (groups a Pay-in-3 plan) and `referral_earnings.payout_id`.

## Test checklist (Paystack test mode)
1. Set test keys and the test webhook URL (for local testing, expose your dev server with a tunnel and use that URL).
2. Buy Self-paced with test card `4084 0840 8408 4081` (any future expiry, CVV 408). Expect: callback success page, enrollment `self` for 365 days, receipt logged/sent.
3. Buy with a friend's referral code: 10% off, a `pending` referral earning available after 14 days.
4. Pay in 3: instalment 1 gives 35 days; pay instalments 2 and 3 from the same checkout page; the last sets 365 days from the first payment.
5. Request a refund from Account → Purchases, approve it in Admin → Refunds: access ends, earning reversed.
