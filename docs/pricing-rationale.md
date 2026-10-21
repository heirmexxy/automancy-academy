# Automancy Academy: pricing rationale

Prices researched 19–21 October 2026. Exchange rate used for context: official NFEM ₦1,332/$, parallel about ₦1,375/$ ([TechEconomy, 14 Oct 2026](https://techeconomy.ng/dollar-to-naira-exchange-rate-today-october-14-2026)). USD prices are set for diaspora and international buyers, not converted at the market rate.

## Final prices

| Product id | Name | NGN | USD | Period | Pay in 3 (NGN) |
|---|---|---|---|---|---|
| free | Free | 0 | 0 | free | n/a |
| self | Self-paced | 45,000 | 79 | one-time (12 months' access) | 3 × 16,000 (= 48,000) |
| cohort | Cohort | 150,000 | 249 | one-time | 3 × 52,000 (= 156,000) |
| member | Membership | 5,000 | 12 | per month | n/a |
| story | Story Mode | 5,000 | 9 | one-time | n/a |
| bundle | Template bundle | 20,000 | 35 | one-time | n/a |
| crmspec | CRM Implementation specialisation | 25,000 | 45 | one-time | n/a |
| team | Team seats | 40,000 | 70 | per seat (min 5) | n/a (invoice) |
| employer_post | Post a role | 20,000 | 29 | per post (30 days) | n/a |

Changes from the draft in `lib/pricing.ts`: **member** ₦7,500 → ₦5,000; **bundle** ₦25,000/$45 → ₦20,000/$35; **employer_post** $35 → $29. Everything else is confirmed.

## Reasoning per product

- **free**: Base Camp (6 lessons + Boss 0) is the trial. Free vendor academies (Make Academy, Zapier Learn, n8n courses) mean "free" is the baseline expectation, so the free tier must exist to compete.
- **self, ₦45,000 / $79**: This matches AltSchool's Nano-Diploma (₦45,000). It sits in the middle of Nigerian AI-automation courses (₦20k–₦150k) and is well below 12-week live courses (₦150k). It costs about 30% of a typical ₦150k entry-level monthly salary, which a graduate can stretch to, especially at 3 × ₦16,000. At $79 it is below a single Skool community month ($67–$129) and in line with Coursera single courses ($49–$99), so it is fair for diaspora buyers.
- **cohort, ₦150,000 / $249**: This is the same price as Labano's 12-week live course (₦150k) and below a 3-day corporate AI course (₦210k). It also includes items worth about ₦40k bought separately: Story Mode ₦5k, the bundle ₦20k and 3 months of Membership ₦15k. The mentor's time is the real cost, so don't go lower.
- **member, ₦5,000 / $12 per month**: Nigerian paid communities price at ₦5,000/month (Digital Business Trybe, Smart Hustle Hub). At ₦7,500, graduates still job-hunting are likely to churn. $12 is far below global AI communities ($67–$129), so the USD price can stay.
- **story, ₦5,000 / $9**: This is an impulse add-on priced at the level of a Selar e-book (₦5,000 n8n book). The audio is generated once and cached, so the cost per learner is close to nil.
- **bundle, ₦20,000 / $35**: Template packs are bought after the ₦45k course. At ₦25k the add-on would be 55% of the course price; at ₦20k it is 44%. One client setup (₦50k–₦250k, as quoted on the Selar course) pays for it.
- **crmspec, ₦25,000 / $45**: This is a deeper specialisation than a template pack and sits just above the bundle. Keep it on the waitlist and confirm demand from waitlist sign-ups before launch.
- **team, ₦40,000 / $70 per seat (min 5)**: That is 11% off retail, which is the usual group discount in Nigeria (Tom Associates gives 5–10%). It is still 80% cheaper than per-participant corporate AI training (₦210k–₦280k). Quote the private workshop separately, at about ₦150k–₦250k per half-day.
- **employer_post, ₦20,000 / $29 for 30 days, first post free**: Jobberman's Standard Listing is ₦100,000 + VAT. A niche board with a small pool of certified graduates has to be much cheaper. $29 is easier for a foreign SME to accept.

## Unit economics and referral check

Assumptions:

- **AI review**: about 80–100 reviews per full learner (49 missions, 6 bosses, capstone, resubmits), at about 3k input and 1k output tokens each on a mid-tier model. That comes to roughly $1–$3 per learner, about ₦1,500–₦4,000.
- **Voice**: lessons are generated once and cached, so the cost per learner is near zero. Generating audio on demand per learner would cost much more, so don't do that.
- **Paystack fees**: 1.5% + ₦100 locally (capped at ₦2,000) and about 3.9% + ₦100 for international cards. These are Paystack's standard published rates.

Worst case for **self** (friend discount + ambassador 30%), against a list price of ₦45,000:

| Item | ₦ |
|---|---|
| Paid after 10% discount | 40,500 |
| Commission 30% of paid | −12,150 |
| Paystack | −708 |
| AI review (high case) | −4,000 |
| **Net** | **≈ 23,600 (52% of list)** |

At the friend tier (20%) the net is about ₦27,700 (62% of list). Both are sustainable for a digital product.

- **cohort**: In the worst case the net is ₦135,000 − ₦40,500 − ₦2,000 − ₦4,000 ≈ ₦88,500. That leaves about ₦60k after a mentor budget of about ₦25–30k per learner. It is fine, but cohort is where the 30% tier hurts most. Optional: cap cohort commission at 25%.
- **member** (first month only; no discount or commission on renewals): ₦4,500 paid, less ₦1,350 commission. That is acceptable as acquisition cost.
- **bundle / packs at 30%**: the commission is ₦6,000 with no discount and no marginal cost. Fine.
- **Story Mode**: a ₦5,000 sale pays ₦1,000–₦1,500, which is below the ₦5,000 minimum payout on its own. It still accumulates, so that is fine.

The referral programme works at these prices. Two guards are recommended:

1. Block self-referral (same user, email, phone or card). Otherwise anyone gets 10% off plus 20% back, about 28% off.
2. Pay commission on the amount actually paid (after discount) and per instalment as each one clears. The current `ngnEquivalentMinor` on the paid amount already does this.

## Instalments

Nigerian buyers expect "pay small small". Bootcamps commonly take part-payment, for example Utiva at 70% upfront with the balance before graduation, and many courses do not publish a plan at all. A 5–10% premium for paying in instalments is normal and accepted:

- **self**: 3 × ₦16,000 = ₦48,000 (+6.7%).
- **cohort**: 3 × ₦52,000 = ₦156,000 (+4%).

Keep the 35-day access window per instalment. Instalments are in naira only.

## Comparison table

| Offer | Type | Price | Source (seen) |
|---|---|---|---|
| AltSchool Africa Nano-Diploma | Nigerian tech school | ₦45,000 | [Techpoint, 24 Sep 2025](https://techpoint.africa/news/altschool-africa-nano-diploma/) (seen 21 Oct 2026) |
| AltSchool Africa full diploma (12 months) | Nigerian tech school | $290 | same as above |
| Utiva Data Science Bootcamp (6 months) | Nigerian bootcamp | $250 full / $175 part-payment (70% upfront) | [utiva.io](https://utiva.io/courses/data-science-bootcamp/) (21 Oct 2026) |
| Labano Academy AI Automation (12 weeks, live + recorded) | Nigerian AI automation | ₦150,000 | [labanoacademy.com](https://www.labanoacademy.com/courses/ai-automation/) (21 Oct 2026) |
| SureSkill Cohort AI Automation (2 weeks; Make, n8n, Zapier) | Nigerian AI automation | ₦20,000 Basic / ₦50,000 Advanced | [sureskillcohort.com](https://sureskillcohort.com/) (21 Oct 2026) |
| EvolveHQ AI Automation (6 weeks) | Nigerian AI automation | ₦25,000 | [evolvehq.co](https://evolvehq.co/programs/artificial-intelligence-automation/) (21 Oct 2026) |
| Netisens AI Automation (4 months, physical, Uyo) | Nigerian AI automation | ₦100,000 | [netisens.com](https://netisens.com/ai-automation/) (21 Oct 2026) |
| "Work Smarter, Earn More, Lead with AI" (6 live sessions) | Selar live workshop | ₦80,000 / $58.98 | [Selar](https://selar.com/7926x8d171) (21 Oct 2026) |
| AI Automation for Beginners (PDF course) | Selar | $14.75 | [Selar](https://selar.com/17657o9rie) (21 Oct 2026) |
| n8n Automation Bootcamp (184-page e-book) | Selar | ₦5,000 | [Selar](https://selar.com/96tgz366m9?currency=GHS) (21 Oct 2026) |
| Moringa/McTaba AI Agents & Workflow Automation (6 weeks, Kenya) | African AI automation | KES 30,000 (about $230) | [mctaba.com](https://mctaba.com/courses/ai-agents-and-workflow-automation) (21 Oct 2026) |
| Udemy courses | Global marketplace | $9.99–$17.99 on sale; list $19.99–$199.99; Personal Plan about $16.58/month | [SkillScouter](https://skillscouter.com/udemy-review/) (21 Oct 2026) |
| Udemy in India (purchasing-power pricing reference) | Global marketplace | Rs 399–519 | [Zoutons, Aug 2026](https://zoutons.com/news/udemy-course-price-india-august-2026) (21 Oct 2026) |
| Coursera Plus / single course | Global | $59/month, $399/year; courses $49–$99 | [EduBracket](https://edubracket.com/articles/coursera-pricing-2026) (21 Oct 2026) |
| Make Academy, Zapier Learn, n8n courses | Vendor academies | Free | [SkillScouter](https://skillscouter.com/best-ai-automation-courses/) (21 Oct 2026) |
| Skool AI-automation communities (AI Automation Society Plus, RoboNuggets, Jack, Chase AI+, AAA Accelerator) | Global communities | $67–$129/month; AAA Accelerator $97–$197 | [AI Funnel Insider](https://aifunnelinsider.com/ai-automation-communities/) (21 Oct 2026) |
| Digital Business Trybe membership | Nigerian community | ₦5,000/month or ₦50,000/year ($3.5/month) | [Selar](https://selar.com/dbt) (21 Oct 2026) |
| Smart Hustle Hub membership | Nigerian community | ₦5,000/month | [Selar](https://selar.com/q23979e978) (21 Oct 2026, from search listing) |
| Tom Associates "AI Essentials for Today's Workforce" (3 days) | Nigerian corporate training | ₦210,000 online / ₦280,000 classroom per participant; 5–10% group discount | [tomassociatesng.com](https://tomassociatesng.com/event/ai-essentials-for-today-s-workforce-1193) (21 Oct 2026) |
| TrainingCred "AI Agents for Business" (5 days, virtual) | Corporate training (East Africa) | $1,050 per participant | [trainingcred.com](https://trainingcred.com/ng/course-schedules/ai-agents-for-business-an-executive-primer-training/virtual/) (21 Oct 2026) |
| Jobberman Standard Listing | Nigerian job board | ₦100,000 + VAT | [jobberman.com](https://www.jobberman.com/employer/standard-listing) (21 Oct 2026) |
| MyJobMag, NgCareers | Nigerian job boards | Paid, price on request | [brands.ng](https://brands.ng/?p=2758) (21 Oct 2026) |
| Entry-level salary, Nigeria | Purchasing power | ₦80k–₦250k/month, average about ₦150k; minimum wage ₦70k | [MyJobMag, updated 9 Oct 2026](https://www.myjobmag.com/blog/average-salaries-in-nigeria) (21 Oct 2026) |

## JSON

```json
{
  "free":          {"ngn": 0,      "usd": 0,   "installments": null},
  "self":          {"ngn": 45000,  "usd": 79,  "installments": {"count": 3, "ngn": 16000}},
  "cohort":        {"ngn": 150000, "usd": 249, "installments": {"count": 3, "ngn": 52000}},
  "member":        {"ngn": 5000,   "usd": 12,  "installments": null},
  "story":         {"ngn": 5000,   "usd": 9,   "installments": null},
  "bundle":        {"ngn": 20000,  "usd": 35,  "installments": null},
  "crmspec":       {"ngn": 25000,  "usd": 45,  "installments": null},
  "team":          {"ngn": 40000,  "usd": 70,  "installments": null},
  "employer_post": {"ngn": 20000,  "usd": 29,  "installments": null}
}
```
