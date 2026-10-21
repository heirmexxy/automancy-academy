# Fact check · Tracks 0–4 and 6 (Oct 2026)

Scope: `src/modules/0-*`, `1-*`, `2-*`, `3-*`, `4-*`, `6-*` and the boss files. Checked against official pages where they could be reached, otherwise against recent third-party summaries (marked). Every "at the time of writing" in these files is now "as of Oct 2026" or carries a date.

Status key: **OK** = confirmed, no change · **Fixed** = text corrected · **Hedged** = sources conflict, wording softened · **Not re-checked** = couldn't verify this pass, no change.

| # | Lesson | Fact | Status | Old | New | Source |
|---|---|---|---|---|---|---|
| 1 | 1.1 | Zapier Free: 100 tasks/month, two-step Zaps, 15-min polling | OK (date updated) | "Free plan, at the time of writing" | "Free plan, as of Oct 2026" | zapier.com/pricing |
| 2 | 1.5 | AI by Zapier tiers: Standard 1×, Advanced 3×, Premium 5×, BYOK 1× | OK | – | – | help.zapier.com/hc/en-us/articles/46425475442829 |
| 3 | 1.5 | Default tier | Hedged | "Premium (often the default)" | "Premium (the default for new steps on many accounts; check yours)" | Zapier help 46425475442829 says Premium; 46597632373389 (June 15 2026 pricing) says Advanced |
| 4 | 1.5 | Tool calls, per-run cap, Free-plan access | Fixed (added) | "…at the time of writing; AI by Zapier requires a paid plan." | Adds: tool calls cost the multiplier again; 75-task per-run approval cap; Free can only preview | Zapier help 46425475442829, 46597632373389 |
| 5 | 1.6 | Agents: 400 activities/month free (tests count) | OK, detail added | "400 … (including testing), with more on paid plans" | Adds Pro 1,500 (testing doesn't count), dated Oct 2026 | help.zapier.com/hc/en-us/articles/26559132765325 |
| 6 | 1.6 | Zapier MCP: 2 tasks per successful call, failed calls free, on existing plan incl. Free | OK | – | – | docs.zapier.com/mcp/overview/usage.md; zapier.com/pricing |
| 7 | 1.6 | What counts as an activity | OK | – | – | Zapier help 26559132765325 |
| 8 | 1.6, 2.1 | Make filters and routers use no credits | Hedged | "filters and routers are free" | Same, plus "some third-party guides disagree; confirm with a run's credit count in History" | Make help (as summarised by superdupr.com) vs zapier.com/blog/make-com-pricing (says they cost a credit) |
| 9 | 2.1 | Make polling check costs a credit even with no data; 15 min all day ≈ 2,880/month | OK | – | – | superdupr.com/blog/make-com-pricing (citing help.make.com/operations) |
| 10 | 2.1 | Make Free: 1,000 credits, 2 active scenarios, 15-min minimum | OK, detail added | "at the time of writing" | "as of Oct 2026", adds 1 data store | make.com/en/help/general/pricing-parameters; jetadmin.io; zapier.com/blog/make-com-pricing |
| 11 | 2.3, 2.9 | "More than the Free plan's 1,000" | OK | – | – | as above |
| 12 | 2.7 | Make AI Agents: instructions, model, tools (modules, scenarios, MCP), Run an agent, thread/conversation ID, structured output, knowledge | OK, detail added | "Billing summary … at the time of writing." | Adds: open beta; Make AI provider on all plans, other providers need a paid plan | help.make.com/make-ai-agent-new-app.md |
| 13 | 3.1 | n8n Cloud Starter price and trial | Fixed | "Starter is about $20–24 a month for 2,500 executions, with a free trial" | "about €20 a month billed annually, a little more monthly, for 2,500 executions; the 14-day free trial gives Pro features capped at 1,000 executions" | jetadmin.io/blog/n8n-pricing (Sep 2026); docs.n8n.io/deploy/use-n8n-cloud/start-your-free-trial.md |
| 14 | 3.1 | Save vs Publish in 2.x (replaces Active toggle) | OK | – | – | docs.n8n.io/changelog/v20-breaking-changes |
| 15 | 3.1 | Docker volume /home/node/.n8n, GENERIC_TIMEZONE + TZ | OK | – | – | docs.n8n.io/deploy/host-n8n/install-options/install-with-docker.md |
| 16 | 3.1 | Default timezone America/New_York | Not re-checked | – | – | Docs page doesn't name a default |
| 17 | 3.5 | Pyodide Python removed in 2.x; native Python via task runners | OK | – | – | v20-breaking-changes |
| 18 | 3.5 | Native Python uses `_items` / `_item` | Not re-checked | – | – | Breaking-changes page mentions `_query`, not these names |
| 19 | 3.8 | `N8N_WEBHOOK_URL` replaces `WEBHOOK_URL` (deprecated from 2.35.0); `N8N_PROXY_HOPS=1` | OK | – | – | docs.n8n.io/hosting/configuration/configuration-examples/webhook-url |
| 20 | 3.8 | Current n8n version naming | OK | – | – | docs.n8n.io release notes (stable 2.44.x, beta 2.45.0, Oct 2026) |
| 21 | 3.9 boss | Sub-workflow runs don't count toward Cloud executions | OK | – | – | docs.n8n.io/build/understand-workflows/understand-executions.md |
| 22 | 3.9 boss | Entry Cloud plan allowance | Fixed (date) | "at the time of writing (about 2,500)" | "as of Oct 2026 (2,500 on Starter)" | jetadmin.io n8n pricing |
| 23 | 3.9 boss | Telegram callback_data 1–64 bytes | OK | – | – | python-telegram-bot docs (mirrors Bot API) |
| 24 | 3.3, 6.4 | Telegram rate limits (~1 msg/s per chat, ~30/s overall, 20/min in groups; 429 on excess) | OK (lessons use examples only) | – | – | core.telegram.org/bots/faq |
| 25 | 4.1 | AI Agent Max Iterations default | Fixed | "check the default in your version" | "n8n's docs give a default of 10" | docs.n8n.io … openai-functions-agent.md |
| 26 | 4.5 | Human review channels (Chat, Slack, Discord, Telegram, Teams, Gmail, WhatsApp Business Cloud, Google Chat, Outlook) | OK | – | – | docs.n8n.io/build/integrate-ai/ai-examples/human-in-the-loop-for-tools.md |
| 27 | 4.6 | MCP Server Trigger: SSE + streamable HTTP, Bearer/Header auth, tool nodes only, mcp-remote for Claude Desktop, proxy buffering/gzip off, single replica for /mcp* | OK | – | – | docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-langchain.mcptrigger.md |
| 28 | 4.8 | `client.beta.messages.tool_runner` (beta) | OK | – | – | platform.claude.com/docs/en/agents-and-tools/tool-use/tool-runner |
| 29 | 4.8 | Claude Agent SDK: Python + TypeScript, query(), @tool, in-process MCP servers, allowed_tools | OK | – | – | github.com/anthropics/claude-agent-sdk-python (`pip install claude-agent-sdk`, Python 3.10+) |
| 30 | 4.8 | Model ID `claude-sonnet-5-5` | OK (the lesson already says "check the models page") | – | – | apidog.com (released 28 Sep 2026); official tool-runner docs use `claude-opus-5-5` (same naming) |
| 31 | 4.9 | n8n Evaluations plan limits | Fixed (added) | – | Metric-based evaluations: Cloud Pro/Enterprise, self-hosted Enterprise; registered Community and Starter users can use them on one workflow | docs.n8n.io/advanced-ai/evaluations/metric-based-evaluations |
| 32 | 4.9 | LangSmith env vars (`LANGCHAIN_TRACING_V2`) | Not re-checked | – | – | docs.N8n.io/advanced-ai/langchain/langsmith/ (fetch limit hit) |
| 33 | 4.9 | Langfuse open source and self-hostable | OK (no free-tier numbers stated in lesson) | – | – | langfuse.com |
| 34 | 4.3, 4.4 | Supabase gives a free Postgres database; pgvector | OK in general (no numbers stated) | – | – | supabase.com/pricing (not fetched; third-party guides agree) |
| 35 | 4.1, 4.2, 6.4 | Hugging Face Agents Course is free with a certificate | Not re-checked | – | – | huggingface.co/learn/agents-course (fetch limit hit) |
| 36 | 3.4 | DummyJSON `limit`, `skip`, `select`, response has products/total/skip/limit | OK per docs (live call blocked by proxy) | – | – | dummyjson.com/docs/products |
| 37 | 2.5, 6.2 | Paystack webhook: HMAC-SHA512 of raw body with secret key in `x-paystack-signature`; amounts in kobo | OK | – | – | hookdeck.com Paystack guide (third-party, matches Paystack docs) |
| 38 | 6.2 | Paystack Nigeria local fees 1.5% + ₦100, ₦100 waived under ₦2,500, cap ₦2,000 | OK, international added | "(local cards, at the time of writing: …)" | Adds "international cards 3.9% + ₦100, and the ₦2,000 cap is listed for local fees only"; Amex 4.5% not mentioned | paystack.com/pricing; support.paystack.com article 360009881920 (edited 15 Sep 2026) |
| 39 | 6.2 | "Failed subscription charges aren't retried automatically" | Hedged | as quoted | "Sources differ on whether Paystack retries a failed subscription charge, so check Paystack's subscriptions docs and plan your own follow-up either way." | mctaba.com says Paystack retries; no official statement found |
| 40 | 4.7 | Anthropic multi-agent research post: ~4× tokens for agents, ~15× for multi-agent | Not re-checked | – | – | anthropic.com/engineering/multi-agent-research-system |
| 41 | 0.x, 2.6 | Google Sheets/Gmail quotas | OK (lessons give no numbers, only "quota blip" and 15-min Gmail polling) | – | – | – |

**Totals:** 41 facts reviewed. 8 corrected or extended (rows 4, 5, 10, 12, 13, 25, 31, 38), 3 hedged (rows 3, 8, 39; row 8 is edited in both 1.6 and 2.1), 2 date-only updates (rows 1, 22), 5 not re-checked (rows 16, 18, 32, 35, 40), and the rest confirmed with no change.

## Facts in files outside this task's scope (reported, not edited)

- `src/lesson.js` `runDock()` (3.1 Docker builder) adds `-e N8N_RUNNERS_ENABLED=true`. n8n's current Docker guide doesn't include it; task runners are on by default in 2.x, so it's harmless but could be dropped to match the guide. The rest of the command matches the guide.
- `src/lesson.js` compose builder (3.8): `N8N_WEBHOOK_URL` vs `WEBHOOK_URL` "before 2.35" note is correct; `N8N_PROXY_HOPS=1` correct.
- `src/lesson.js` `psFee()` (6.2 calculator): local fee formula matches Paystack (1.5% + ₦100, waiver under ₦2,500, ₦2,000 cap). It doesn't model international cards (3.9% + ₦100).
- `src/lesson.js` line ~339 platform calculator labels n8n Cloud units as "executions": correct.
- `src/platform.js` community sample answer mentions `N8N_WEBHOOK_URL`: correct.
- Blocked or unreachable this pass (for a later check): help.make.com/credits.md, platform.claude.com/docs/en/models/overview, the human-in-the-loop docs page (its old URL now 404s).
