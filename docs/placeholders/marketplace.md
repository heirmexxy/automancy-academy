# Creator marketplace: placeholders and setup (writer H)

| Placeholder | File | What it is | Where to get / decide it |
|---|---|---|---|
| Revenue share 70% / 30% | `app/(site)/courses/_lib/core.ts` `MARKET.revenueShare`, default `creators.revenue_share` in `0007_marketplace.sql` | Creator's share after payment fees. Per-creator overrides: Admin → Creator courses → Creators | Business decision. Changing the default does not change existing creators' rows |
| Price limits ₦2,000 – ₦500,000; USD $2 – $350 | `MARKET` in `core.ts` **and** the `courses_price_when_public` / `price_ngn` checks in `0007_marketplace.sql` | Allowed course prices (USD optional) | Business decision. Keep the SQL and `MARKET` in step |
| Paystack fee estimate | `paystackFeeKobo()` in `core.ts` | Local 1.5% + ₦100 (₦100 waived under ₦2,500, cap ₦2,000); international/USD 3.9% + ₦100. Used to compute creator earnings | paystack.com/pricing (Nigeria). Confirm, and whether you want to use the actual settled fee instead |
| Refund window 14 days | `MARKET.refundWindowDays` (matches `REFERRAL.refundWindowDays` in `lib/pricing.ts`) | Creator earnings stay "pending" this long | Must match the refund policy in the legal terms |
| Review time "about 5 working days" | `MARKET.reviewDays` | Promise shown on /teach and in emails | Ops capacity |
| Creator terms | `app/(site)/teach/terms/page.tsx` (marked "Draft pending legal review") | Licence, warranties, takedown, prices, refunds pro rata, tax, termination, governing law | **Legal review by a Nigerian lawyer before launch.** Also confirm the withholding-tax position for creator payouts and whether a TIN is required |
| Payout schedule "monthly" | /teach/terms, studio earnings tab | How often creators are paid | Ops decision. Payouts are manual: Admin → Creator courses → Earnings → "Mark paid" with the transfer reference |
| Referral commission on creator courses | `startCoursePurchase` stores `referral_code` on the payment but **no commission or discount** applies to marketplace courses | Whether referrers earn on creator courses (and who pays it: platform share or creator) | Business decision; if yes, add it in `handleCoursePayment` |

## Setup
1. Run `supabase/migrations/0007_marketplace.sql` after 0001 and 0002. It adds `creators`, `courses`, `course_sections`, `course_lessons`, `course_enrollments`, `course_checkouts`, `course_progress`, `course_reviews`, `creator_earnings`, two public views (`creator_public`, `course_outline`) and a trigger on `payments` that removes access and reverses the creator earning when a course payment is refunded.
2. No new environment variables. Without `PAYSTACK_SECRET_KEY` the "Buy" button shows "Payments open soon" and adds the learner to `waitlist` with product `course:<course_id>`.
3. Paystack: course checkouts use callback `${SITE_URL}/courses/<slug>/paid`; the webhook (writer A) handles `metadata.kind = "course"` by calling `handleCoursePayment`.

## Content moderation process (to agree with the team)
- **Creators** apply at /teach/apply; an admin approves or declines in Admin → Creator courses → Creators (you can set a per-creator revenue share there). Suspending a creator unlists their live courses; buyers keep access.
- **New courses**: the creator submits (automatic checks: at least 3 complete lessons, description ≥ 200 characters, price within limits, cover image). The course appears in the Review queue. The reviewer reads every lesson (all content is shown on one page, quiz answers included) against the rules on /teach: original work, no copyrighted material, no get-rich-quick claims, platform-rules compliant automation, no requests for passwords/keys/OTPs. Then: **Approve** (goes live), **Request changes** (note emailed to the creator) or **Reject** (note emailed; a course with buyers is unlisted rather than rejected).
- **Edits to live courses** (decision): edits are saved and visible immediately, and the course gets `changes_pending = true`, which puts it back in the Review queue while it stays live. We chose this over a versioned draft copy for simplicity; the trade-off is that an edit is public before it's reviewed. Price changes on a live course must stay within the limits; the slug is fixed once published. Approve clears the flag; Request changes keeps it live with a note; Reject unlists it.
- **Complaints / takedown**: use Admin → Creator courses → Courses → Unlist (buyers keep access), or Reject on the review page. A copyright notice (DMCA-style) process and contact address still need to be published: PLACEHOLDER.
- **Learner reviews** can be hidden from the course's admin review page.
- Every admin action writes `audit_log` (`creator_approved`, `course_approve`, `course_changes_requested`, `course_reject`, `course_unlist`, `creator_payout_paid`, …). Refunds after a creator payout log `creator_clawback_needed`; partial refunds log `creator_partial_refund` for a manual pro-rata adjustment.
