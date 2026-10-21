# n8n template spec (for writers)

Course context: read `docs/SHEET-SPEC.md` (first section) for the course, Harvest Lane and the guides.

Every lesson that builds something in n8n has a "PART 4 · Solved problem" (bosses: "SUGGESTED ARCHITECTURE", "YOUR MISSION" and "REFERENCE BUILD"). Your job: turn each solved build into importable n8n workflow JSON that matches the lesson step by step (same node order, names, expressions, code, sheet columns, tables, rules). A learner imports it, adds their own credentials and IDs, and it should run with test data.

## Output

For lesson `3.4`:
- one or more workflow files: `src/templates/wf/3-4-<short-slug>.json` (one file per workflow; sub-workflows and error workflows are separate files)
- one manifest: `src/templates/3-4.json`

Bosses: `B3` → `src/templates/B3.json` and `src/templates/wf/B3-<slug>.json`.

### Manifest

```json
{
  "id": "3.4",
  "items": [
    {
      "file": "3-4-paystack-banks.json",
      "name": "HL · Paystack banks",
      "what": "One sentence: what this workflow does.",
      "setup": [
        "Create a Header Auth credential called \"Paystack test\": Name Authorization, Value Bearer followed by your TEST secret key. Select it in the HTTP Request node.",
        "Replace YOUR_SHEET_ID in the Google Sheets node with your own sheet's ID."
      ],
      "test": "How to test it once, with test data, and what you should see."
    }
  ]
}
```

`setup` lists every credential to create (by type and suggested name) and every placeholder to replace, in order. Plain text, no HTML.

### Workflow JSON (n8n's copy/paste format)

```json
{
  "name": "HL · Paystack banks",
  "nodes": [
    {"parameters": {}, "id": "uuid-v4", "name": "Manual Trigger", "type": "n8n-nodes-base.manualTrigger", "typeVersion": 1, "position": [0, 0]}
  ],
  "connections": {
    "Manual Trigger": {"main": [[{"node": "Next node name", "type": "main", "index": 0}]]}
  },
  "pinData": {},
  "settings": {"executionOrder": "v1"},
  "meta": {"templateCredsSetupCompleted": false}
}
```

- Every node: unique `name`, unique `id` (random UUID v4), `type`, `typeVersion`, `position` (lay nodes left to right, 220 px apart; branches 180 px apart vertically), `parameters`.
- Do NOT include a `credentials` key on any node. The learner selects credentials after import (say so in `setup`).
- Connections: `main` for normal flow. For AI sub-nodes, the SUB-NODE is the source and the connection type is the sub-node kind, e.g. `"OpenAI Chat Model": {"ai_languageModel": [[{"node": "AI Agent", "type": "ai_languageModel", "index": 0}]]}`. Kinds: `ai_languageModel`, `ai_memory`, `ai_tool`, `ai_outputParser`, `ai_embedding`, `ai_vectorStore`, `ai_document`, `ai_textSplitter`.
- IF/Switch outputs: output 0 = true / first rule, etc. (`"main": [[...true...], [...false...]]`).
- Put a **Sticky Note** (`n8n-nodes-base.stickyNote`, typeVersion 1, parameters `{"content": "## Title\n…", "height": 240, "width": 360}`) at the left of every workflow: what it does, the lesson number, credentials to add, placeholders to replace. Add a sticky note beside any node that needs a decision.
- Placeholders are UPPER_SNAKE_CASE: `YOUR_SHEET_ID`, `YOUR_TELEGRAM_CHAT_ID`, `YOUR_N8N_DOMAIN`, `YOUR_SUPABASE_TABLE`. Never put a real-looking key, token, phone number or email. Use `+2348000000000` and `orders@harvestlane.example` style test values.
- Expressions: `={{ $json.field }}` (string parameters that are expressions start with `=`). Use `$('Node name').item.json.x` to reach earlier nodes.
- Code node: JavaScript, `"mode": "runOnceForAllItems"` unless the lesson says each item; `jsCode` must return an array of `{json: …}` items (or objects, which n8n wraps).

## Node types and versions to use

Use only these (choose the listed typeVersion). If the lesson needs something not here, use HTTP Request against the service's API, or a Code node, and explain in a sticky note.

| Node | type | typeVersion |
|---|---|---|
| Manual Trigger | n8n-nodes-base.manualTrigger | 1 |
| Schedule Trigger | n8n-nodes-base.scheduleTrigger | 1.2 |
| Webhook | n8n-nodes-base.webhook | 2 |
| Respond to Webhook | n8n-nodes-base.respondToWebhook | 1.1 |
| HTTP Request | n8n-nodes-base.httpRequest | 4.2 |
| Edit Fields (Set) | n8n-nodes-base.set | 3.4 |
| IF | n8n-nodes-base.if | 2 |
| Switch | n8n-nodes-base.switch | 3 |
| Filter | n8n-nodes-base.filter | 2 |
| Merge | n8n-nodes-base.merge | 3 |
| Code | n8n-nodes-base.code | 2 |
| Loop Over Items | n8n-nodes-base.splitInBatches | 3 |
| Split Out | n8n-nodes-base.splitOut | 1 |
| Aggregate | n8n-nodes-base.aggregate | 1 |
| Wait | n8n-nodes-base.wait | 1.1 |
| No Operation | n8n-nodes-base.noOp | 1 |
| Stop and Error | n8n-nodes-base.stopAndError | 1 |
| Error Trigger | n8n-nodes-base.errorTrigger | 1 |
| Execute Workflow | n8n-nodes-base.executeWorkflow | 1.1 |
| Execute Workflow Trigger | n8n-nodes-base.executeWorkflowTrigger | 1 |
| Crypto | n8n-nodes-base.crypto | 1 |
| Date & Time | n8n-nodes-base.dateTime | 2 |
| Google Sheets | n8n-nodes-base.googleSheets | 4.5 |
| Gmail | n8n-nodes-base.gmail | 2.1 |
| Gmail Trigger | n8n-nodes-base.gmailTrigger | 1.1 |
| Telegram | n8n-nodes-base.telegram | 1.2 |
| Telegram Trigger | n8n-nodes-base.telegramTrigger | 1.1 |
| WhatsApp Business Cloud | n8n-nodes-base.whatsApp | 1 |
| WhatsApp Trigger | n8n-nodes-base.whatsAppTrigger | 1 |
| Supabase | n8n-nodes-base.supabase | 1 |
| Postgres | n8n-nodes-base.postgres | 2.5 |
| HubSpot | n8n-nodes-base.hubspot | 2 |
| HubSpot Trigger | n8n-nodes-base.hubspotTrigger | 1 |
| Zoho CRM | n8n-nodes-base.zohoCrm | 1 |
| Facebook Graph API | n8n-nodes-base.facebookGraphApi | 1 |
| Sticky Note | n8n-nodes-base.stickyNote | 1 |
| AI Agent | @n8n/n8n-nodes-langchain.agent | 1.7 |
| Basic LLM Chain | @n8n/n8n-nodes-langchain.chainLlm | 1.5 |
| Information Extractor | @n8n/n8n-nodes-langchain.informationExtractor | 1 |
| Text Classifier | @n8n/n8n-nodes-langchain.textClassifier | 1 |
| Sentiment Analysis | @n8n/n8n-nodes-langchain.sentimentAnalysis | 1 |
| Chat Trigger | @n8n/n8n-nodes-langchain.chatTrigger | 1.1 |
| OpenAI Chat Model | @n8n/n8n-nodes-langchain.lmChatOpenAi | 1 |
| Anthropic Chat Model | @n8n/n8n-nodes-langchain.lmChatAnthropic | 1.2 |
| Google Gemini Chat Model | @n8n/n8n-nodes-langchain.lmChatGoogleGemini | 1 |
| Simple Memory | @n8n/n8n-nodes-langchain.memoryBufferWindow | 1.3 |
| Postgres Chat Memory | @n8n/n8n-nodes-langchain.memoryPostgresChat | 1.1 |
| Structured Output Parser | @n8n/n8n-nodes-langchain.outputParserStructured | 1.2 |
| Call n8n Workflow Tool | @n8n/n8n-nodes-langchain.toolWorkflow | 1.3 |
| HTTP Request Tool | @n8n/n8n-nodes-langchain.toolHttpRequest | 1.1 |
| Code Tool | @n8n/n8n-nodes-langchain.toolCode | 1.1 |
| Supabase Vector Store | @n8n/n8n-nodes-langchain.vectorStoreSupabase | 1 |
| Embeddings OpenAI | @n8n/n8n-nodes-langchain.embeddingsOpenAi | 1.1 |
| Default Data Loader | @n8n/n8n-nodes-langchain.documentDefaultDataLoader | 1 |
| Recursive Character Text Splitter | @n8n/n8n-nodes-langchain.textSplitterRecursiveCharacterTextSplitter | 1 |
| MCP Server Trigger | @n8n/n8n-nodes-langchain.mcpTrigger | 1 |

Use the model the lesson uses; if it doesn't say, use the OpenAI Chat Model with a placeholder model name `YOUR_MODEL` and say in the sticky note to pick one.

## Rules

- Match the lesson. If the lesson's build has a step that can't be expressed cleanly (e.g. a manual UI action), do it in a sticky note.
- Safety: test mode only, approval steps kept exactly as the lesson requires, signature/secret checks kept, rate caps kept, consent and suppression checks kept.
- Keep parameters minimal but complete enough that the node is configured after the learner picks a credential and replaces placeholders. Where you are unsure of an exact parameter key for a node, prefer HTTP Request or Code (whose parameters you know) over guessing, and note it.
- When finished, run `python3 tools/validate_n8n.py src/templates/wf/<your files>` from the course directory and fix every error. Then reply with only: files written, and anything you were unsure about (one line each). Don't edit any other files. Other writers work in the same folders at the same time; only write your own files.
