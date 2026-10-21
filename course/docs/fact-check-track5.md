# Track 5 fact check (Oct 2026)

Scope: `src/modules/5-1.html` to `5-9.html` and `5-99-boss.html`. Checked 19–21 Oct 2026.
Status: **confirmed** (matches source, unchanged), **corrected** (text changed), **hedged** (source unclear or volatile, wording softened).

| # | Lesson | Fact | Status | Old | New | Source |
|---|---|---|---|---|---|---|
| 1 | 5.1 | WhatsApp pricing is per message (since 1 Jul 2025), charged on delivery | confirmed (wording) | "charged per message by category (since July 2025, pricing is per message)" | "charged per delivered message by category (pricing has been per message since July 2025)" | https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing.md |
| 2 | 5.1 | Free-form (service) messages in the 24-h window are free | **corrected** | "normal (free-form) messages, which are free" | Since 1 Oct 2026: 1,000 free service messages per business number per month, then charged | https://developers.secure.facebook.com/docs/whatsapp/pricing/updates-to-pricing |
| 3 | 5.1 | Utility templates inside the window are free | **corrected** | "utility templates sent inside the window are also free" | "utility templates sent inside the window are charged again too" (since 1 Oct 2026) | same as #2 |
| 4 | 5.1 | Quiz 2 answer and feedback ("which is free?") | **corrected** | "Non-template replies inside an open customer service window"; feedback "free… utility templates free too" | Answer adds "up to the monthly free tier"; feedback explains 1,000/month and charged utility templates | same as #2 |
| 5 | 5.1 | "Remember this": pricing per message | **corrected** | "pricing is per message and changes" | adds "(free-form replies are free only up to 1,000 a month per number since October 2026)" | same as #2 |
| 6 | 5.1 | 24-hour customer service window; only templates outside it | confirmed | – | – | pricing.md (above) |
| 7 | 5.1 | Template categories: marketing, utility, authentication | confirmed | – | – | pricing.md (above) |
| 8 | 5.1 | Opt-in needed for business-initiated messages | confirmed | – | – | pricing.md: "you can only send messages to WhatsApp users who have opted in" |
| 9 | 5.1 | Test number messages "a few" verified recipients; temporary token for testing; permanent system user token | confirmed | – | – | https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started.md (no exact recipient count given, so "a few" stays) |
| 10 | 5.1 | Telegram: free, fast to build | confirmed | – | – | Telegram Bot API is free (core.telegram.org/bots); no change needed |
| 11 | 5.1 | Voice agents: Vapi, ElevenLabs, Twilio; Nigerian number availability varies | confirmed (already hedged) | – | – | Wording already tells learners to check with the provider |
| 12 | 5.2 | Places: don't store content except place ID | confirmed | – | – | https://developers.google.com/maps/documentation/places/web-service/policies |
| 13 | 5.2 | Places: free monthly caps per tier (10k Essentials / 5k Pro / 1k Enterprise), then pay; rating/website cost more than ID | confirmed | – | – | https://developers.google.com/maps/billing-and-pricing/pricing-categories |
| 14 | 5.2 | LinkedIn User Agreement s.8.2 bans scrapers, bots, extensions | confirmed (secondary) | – | – | https://contentin.io/blog/linkedin-mcp-terms-of-service/ (quotes s.8.2); LinkedIn Help a1341387 (couldn't be fetched) |
| 15 | 5.2 | NDPA right to object; GAID 2025 requires consent for direct marketing (Art. 18 cited in resources) | confirmed (secondary) | – | – | https://www.mondaq.com/nigeria/privacy-protection/1700306/ (GAID requires express consent; cites art 18) |
| 16 | 5.2 | NCC DND 2442 covers unsolicited SMS | **corrected** (made more complete) | "do-not-disturb rules (2442) cover unsolicited SMS" | "do-not-disturb service (text STOP to 2442) covers unsolicited SMS and calls" | https://consumer.ncc.gov.ng/articles/111-do-not-disturb-dnd-service-in-nigeria |
| 17 | 5.2 | Free Gmail: 500/day, locked out up to 24 h; Workspace about 2,000/day | confirmed | – | – | https://support.google.com/mail/answer/22839 ; https://knowledge.workspace.google.com/admin/gmail/gmail-sending-limits-in-google-workspace |
| 18 | 5.3/5.5 | Instagram API needs a Business/Creator (professional) account | confirmed | – | – | https://developers.facebook.com/documentation/business-messaging/instagram-messaging/features/private-replies |
| 19 | 5.3/5.4/5.5/Boss | X API pay per use: $0.015 per post, $0.20 with a URL; reads charged | confirmed | "(at the time of writing)" | "(checked Oct 2026)" | https://docs.x.com/x-api/getting-started/pricing.md |
| 20 | 5.3/5.5 | LinkedIn Community Management API needs approval; Google Business Profile API needs access request | confirmed | – | – | Not re-fetched; long-standing access processes, wording already hedged ("needs approval") |
| 21 | 5.4 | TikTok: unaudited clients' posts are private until the app is audited | confirmed | – | – | https://developers.tiktok.com/doc/content-posting-api-get-started |
| 22 | 5.4 | Instagram: media container then publish; no text-only posts | confirmed | – | – | Instagram content publishing (unchanged) |
| 23 | 5.5/Boss | Messenger: 24-h window; human agent tag, 7 days | confirmed | – | – | https://developers.facebook.com/documentation/business-messaging/messenger-platform/policy |
| 24 | 5.5/Boss | Private replies within 7 days, one message (Facebook and Instagram) | confirmed | – | – | messenger policy (above) + Instagram private replies page |
| 25 | 5.5 | Instagram replies after 24 h: "check Meta's current rules" | hedged (kept) | – | – | Policy page doesn't say whether the human agent tag applies to IG |
| 26 | 5.5/Boss | Instagram messaging needs app review (Advanced Access) | confirmed | – | – | Instagram private replies page: "Advanced Access" required |
| 27 | 5.6/Boss | Brevo Free: 300 emails/day, up to 100,000 contacts, automation up to 2,000 contacts, Brevo branding | confirmed | – | – | https://help.brevo.com/hc/en-us/articles/208580669 |
| 28 | 5.6 | Brevo "also does SMS and WhatsApp campaigns" | **corrected** | "Transactional email, SMS and WhatsApp campaigns" | "Transactional email; SMS and WhatsApp campaigns on paid plans" | same as #27 (WhatsApp is listed as not included on Free) |
| 29 | 5.6/Boss | Mailchimp Free: 250 contacts, 500 sends/month, 250/day, 1 audience | confirmed | – | – | https://mailchimp.com/help/about-mailchimp-pricing-plans/ |
| 30 | 5.6 | Mailchimp Free has no automation | **corrected** (×3: Card 2 table, Part 4, Remember this) | "No automation flows" / "has no automation flows" / "has none" | "One single-email automation (e.g. a welcome email); multi-step flows need a paid plan" | https://mailchimp.com/automate ("The Free plan only allows you to set up a single email automation") |
| 31 | 5.6 | Plans note date stamp | **corrected** | "Plans and limits at the time of writing" | "Plans and limits checked Oct 2026" | – |
| 32 | 5.6 | Unsubscribe honoured within 2 days | **corrected** (made more complete) | "(Yahoo asks within 2 days)" | "(Gmail and Yahoo ask within 2 days)" | https://senders.yahooinc.com/best-practices ; Gmail 48 h per https://www.suped.com/learn/email-deliverability/what-are-the-recent-changes-to-googles-bulk-sender-guidelines |
| 33 | 5.6 | Gmail/Yahoo: SPF + DKIM + DMARC (p=none minimum), one-click unsubscribe for bulk senders | confirmed | – | – | Yahoo Sender Hub (above); Gmail via suped summary (support.google.com/a/answer/81126 couldn't be fetched) |
| 34 | 5.6 | Spam complaints under 0.1%; at 0.3% filtering starts | confirmed | – | – | same as #33 |
| 35 | 5.6 | Make: Brevo app (34 modules), Mailchimp app (44 modules) | hedged | "Brevo app (34 modules)", "Mailchimp app (44 modules)" | "Brevo app", "Mailchimp app" (counts change and couldn't be verified) | apps.make.com couldn't be fetched |
| 36 | 5.6 | n8n Brevo and Mailchimp nodes; Brevo campaign endpoints | confirmed | – | – | Not changed; standard node/API operations |
| 37 | 5.8 | HubSpot Free: 2 users, 1,000 contacts | confirmed | – | – | https://www.hubspot.com/pricing/crm |
| 38 | 5.8 | HubSpot Free: 1 pipeline, 10 custom properties | confirmed (secondary) | – | – | https://www.usecarly.com/blog/hubspot-free-plan-limits/ (Jun 2026); HubSpot KB says the limit "depends on your subscription" |
| 39 | 5.8/5.9 | HubSpot workflows: limited on Starter, full on Professional | confirmed | – | – | hubspot.com/pricing/crm (Starter: "Up to 50 workflows with restricted triggers and actions") |
| 40 | 5.9 | HubSpot lead scoring: Professional or Enterprise only | confirmed | – | – | https://knowledge.hubspot.com/scoring/understand-the-lead-scoring-tool |
| 41 | 5.9 | Private apps on all plans; may appear as "legacy apps"; 100 requests/10 s per app; daily limit | confirmed | – | – | https://developers.hubspot.com/docs/developer-tooling/platform/usage-guidelines.md (Free/Starter: 100/10 s per app, 250,000/day) |
| 42 | 5.8 | HubSpot Starter price | not in Track 5 | – | – | Pricing page shows Starter from $7/seat/month (for other writers) |
| 43 | 5.8/5.9 | Zoho CRM Free: 3 users, 5,000 records | confirmed | – | – | https://www.zoho.com/crm/what-is-zoho-crm-free-edition.html |
| 44 | 5.8 | Zoho Free: 1 GB storage | hedged | "3 users, 5,000 records, 1 GB storage" | "3 users, 5,000 records (check storage on the current plan)" | Zoho page gives no storage figure |
| 45 | 5.8/5.9 | Zoho Free workflow rules | **corrected** | "Workflow rules, limited" | "Up to 5 workflow rules" | Zoho free-edition page FAQ: "up to five workflow rules" |
| 46 | 5.8 | Zoho Standard price; Salesforce Platform Administrator exam fee | not in Track 5 | – | – | Not stated in these files |
| 47 | 5.8/5.6/5.9 | HubSpot Academy courses/certifications (Inbound Sales, Sales Hub Software, Reporting, Email Marketing) | confirmed (partly) | – | – | https://academy.hubspot.com/courses/hubspot-sales-hub-software ; others are long-standing, not re-fetched |
| 48 | 5.9 | n8n HubSpot node: contact "Create or Update" | confirmed (secondary) | – | – | https://dev.to/pirateprentice/n8n-hubspot-node-sync-contacts-deals-and-companies-in-your-workflows-free-workflow-json-5fn9 (n8n docs URL couldn't be fetched) |
| 49 | 5.9 | n8n Zoho CRM node: Upsert | confirmed | – | – | https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.zohocrm/ |
| 50 | 5.9 | Make HubSpot app: OAuth, Super Admin must pre-approve | confirmed | – | – | https://apps.make.com/hubspotcrm |
| 51 | Boss | Channel-rules sheet dates and WhatsApp row | **corrected** | "1 Oct 2026" ×7; "opt-in; per-message pricing" | "Oct 2026" ×7; "opt-in; per-message; 1,000 free svc/mo" | see #2, #19, #23, #27, #29 |

## Not editable by this pass: please fix in `src/lesson.js`

- **WhatsApp window simulator (about lines 1157–1159):** still says non-template messages and utility templates in an open window are free. Since 1 Oct 2026, service messages are free only up to 1,000 per number per month, and in-window utility templates are charged. Source: #2 above.
- **Post lab (line 1410):** Instagram `hardTags: 30`. Since Dec 2025, Instagram caps posts at **5 hashtags** (https://www.socialmediatoday.com/news/instagrams-implementing-new-limits-on-hashtag-use/808309/). Set `hardTags: 5`.
- **Deliverability lab (line 1482):** Mailchimp `auto: "no automation flows"`. It should say "one single-email automation". Source: #30.

## Couldn't be fetched (blocked)

developers.facebook.com/docs/whatsapp/pricing (used the .md mirror instead), support.google.com/a/answer/81126, linkedin.com help pages, docs.n8n.io HubSpot node page, apps.make.com/brevo.
