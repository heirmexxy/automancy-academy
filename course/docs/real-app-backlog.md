# Automancy Academy · Real app build backlog

Everything agreed so far that the clickable prototype can only simulate. Status as of 2 October 2026.

## Foundations
- [ ] Domain: automancy.academy (or similar), after a trademark check (automancy.net is an existing business-automation company)
- [ ] Stack: Next.js + Supabase (logins, database, real-time) on Vercel, deployed to your own accounts
- [ ] Learner accounts, profiles, privacy settings (public/hidden on leaderboards)

## Learning
- [ ] **Embedded video in every lesson** *(added 1 Oct 2026)*: videos picked for all 55 slots (see lesson-videos.md) and shown as a featured card in the prototype; each still to be watched and approved; embed it in the lesson page (youtube-nocookie), with "what to look for" notes. Documentation links still open in a new tab (those sites block embedding).
- [ ] Progress, XP, levels, badges, streaks and pace stored on the server (currently in the browser only)
- [ ] Quiz results and certificate criteria checked on the server
- [x] Mission sheets with model answers and marking guides for all 55 items (2 Oct 2026; in the prototype, source in src/sheets/)
- [x] n8n templates: 118 workflows for Tracks 3–6 and Bosses 3–5 (7 Oct 2026; src/templates/), structurally validated (tools/validate_n8n.py); safety-critical ones independently reviewed
- [ ] Import-test every n8n template once in a real n8n (test mode) and fix any node that shows a warning; then mark them tested
- [x] Make blueprints for Track 2, Boss 2 and the capstone's HL·07, with by-hand build steps as a fallback (14 Oct 2026; src/templates/make/)
- [x] Zap recipes for Track 1, Boss 1 and the capstone's HL·08 (14 Oct 2026)
- [x] Animated walkthrough player in every lesson (14 Oct 2026; src/walk.js), with written narration (walks) for all 55 items
- [ ] Import-test every Make blueprint once (module ids and field names were written from memory); fix or rebuild from the by-hand steps
- [ ] Build each Zap recipe in the team's Zapier account and add its share link to the manifest (field "link")
- [ ] Record the 16 short real-screen clips (scripts in docs/clip-scripts.md) and place them in their lessons
- [ ] Optional: replace browser voices in the walkthroughs with recorded or Azure Nigerian voices (Story Mode)

## CRM *(added 2 Oct 2026)*
- [x] Core lessons 5.8 CRM Foundations and 5.9 CRM Automation & Integration (in the prototype)
- [x] CRM Ops Agent added to 5.9 (weekly health check, read-only tools, proposals approved on Telegram, executor with allow-list); Boss 5 test 18
- [ ] CRM Implementation specialisation (≈18 h, now including a CRM Implementation Agent module, draft price ₦25,000 / US$49): discovery, HubSpot and Zoho in depth, migration, integrations, adoption and handover, Salesforce on-ramp via Trailhead, reviewed client project. Waitlist in the prototype; build after launch
- [ ] Re-check HubSpot and Zoho free-plan limits before launch (Oct 2026: HubSpot Free 2 users, 1,000 contacts, 1 pipeline, 10 custom properties; Zoho Free 3 users, 5,000 records). HubSpot Starter price and workflow limits disagree between HubSpot's own pages
- [ ] Optional partnerships: HubSpot Solutions Partner and Zoho Partner programmes, so graduates can be referred implementation work

## Voice and Story Mode
- [ ] Free Listen button (done in prototype; keep)
- [ ] Story Mode: pre-recorded audio for every lesson, ideally in Emeka's and Miracle's own voices, or Nigerian AI voices (e.g. Azure Abeo and Ezinne); downloadable for offline listening
- [ ] Optional: talking-avatar video of the two guides from their photos (HeyGen, D-ID or similar), with consent

## Community
- [ ] Real-time chat rooms, learning journal, help board, case studies (with permission)
- [ ] Moderation tools and reporting

## Money
- [ ] Paystack and Flutterwave checkout (naira), international cards (USD); instalment plans
- [ ] Confirm prices (current prices are drafts)
- [ ] Referral and affiliate programme: unique links and codes, 30-day attribution, 10% friend discount, 20/25/30% tiers, Friday payouts via Paystack Transfers after the 14-day refund window, clawbacks on refunds
- [ ] Short term: list paid courses on Nestuge or Selar for their affiliate networks
- [ ] Legal review of the referral terms, refund policy and certificate wording

## Careers and business
- [ ] Careers page: six paths with free credentials (in the prototype); add graduate outcomes once real ones exist, with permission
- [ ] Hire talent: graduate profiles, filters, intro requests, employer plans
- [ ] Weekly challenges: briefs, submissions, voting, judging, winners
- [ ] Certificate issuing with a public verification page and an "Add to LinkedIn" link
- [ ] For business: free automation audit, workshop bookings, team seats

## Content to confirm
- [ ] Emeka's and Miracle's names, roles and photo assignment
- [ ] Kitovu figures and award names (e.g. "Africa Prize for Engineering Innovation" wording)
- [ ] Channel-rules sheet re-checked before launch (platform rules and prices change)
