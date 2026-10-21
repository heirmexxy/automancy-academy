# Make blueprint and Zap recipe spec (for writers)

Course context: read the first section of `docs/SHEET-SPEC.md`. Each lesson's "PART 4 · Solved problem" (bosses: "SUGGESTED ARCHITECTURE", "YOUR MISSION", "REFERENCE BUILD") is the build to reproduce, step by step, with the same names, formulas, filters, routes, data stores and error handlers.

Output goes next to the n8n templates. Manifest: `src/templates/<id>.json` (lesson "2.4" → `2-4.json`, boss "B2" → `B2.json`). For 6.4, a manifest already exists with n8n items: do NOT edit it. Write your own extra manifest instead, `src/templates/6-4.make.json` or `src/templates/6-4.zap.json`, with `"id": "6.4"` and your items; the build merges them.

Every manifest item has: `file` (or `null` for Zap recipes), `name`, `what`, `setup` (array of plain-text steps), `test`, and `kind`: `"make"` or `"zap"`.

## A. Make blueprints (`kind: "make"`)

Write `src/templates/make/<id>-<slug>.json`, Make's blueprint format:

```json
{
  "name": "HL · Paid orders → kitchen sheet",
  "flow": [
    {"id": 1, "module": "gateway:CustomWebHook", "version": 1, "parameters": {"hook": null, "maxResults": 1}, "mapper": {}, "metadata": {"designer": {"x": 0, "y": 0}}},
    {"id": 2, "module": "builtin:BasicRouter", "version": 1, "mapper": null, "metadata": {"designer": {"x": 300, "y": 0}},
     "routes": [
       {"flow": [{"id": 3, "module": "google-sheets:addRow", "version": 2, "parameters": {}, "mapper": {"spreadsheetId": "YOUR_SHEET_ID"}, "metadata": {"designer": {"x": 600, "y": -150}},
                  "filter": {"name": "Paid", "conditions": [[{"a": "{{1.status}}", "b": "success", "o": "text:equal"}]]}}]}
     ]}
  ],
  "metadata": {"instant": true, "version": 1, "scenario": {"roundtrips": 1, "maxErrors": 3, "autoCommit": true, "autoCommitTriggerLast": true, "sequential": false, "confidential": false, "dataloss": false, "dlq": false, "freshVariables": false}, "designer": {"orphans": []}}
}
```

- Module ids are unique integers across the whole blueprint (including inside routes and error handlers).
- Mapping uses Make's formula syntax exactly as the lesson does: `{{1.field}}`, functions with `;` separators (`formatDate(1.created_at; "YYYY-MM-DD")`).
- A filter sits on the module it leads INTO (`"filter"` key on that module). Conditions: outer array = OR groups, inner array = AND. Operators like `text:equal`, `text:contain`, `number:greater`, `exist`, `notexist`.
- Error handlers: put `"onerror": [ {module…}, … ]` on the module, ending with a directive module: `builtin:Ignore`, `builtin:Resume`, `builtin:Commit`, `builtin:Rollback` or `builtin:Break`.
- Connections, webhooks, data stores and spreadsheets are NOT in the blueprint: leave `"__IMTCONN__"`/connection fields out, set hook/datastore ids to `null`, and use placeholders like `YOUR_SHEET_ID`. List each connection, webhook and data store to create in `setup`.
- Use these module ids where they fit; if you need another, use your best knowledge and list it in your final reply as unsure:
  `gateway:CustomWebHook`, `gateway:WebhookRespond`, `builtin:BasicRouter`, `builtin:BasicFeeder` (Iterator), `builtin:BasicAggregator` (Array aggregator), `util:TextAggregator`, `util:SetVariable2`, `util:SetVariables`, `util:FunctionSleep`, `json:ParseJSON`, `json:CreateJSON`, `http:ActionSendData`, `datastore:GetRecord`, `datastore:AddRecord`, `datastore:ExistRecord`, `google-sheets:watchRows`, `google-sheets:filterRows`, `google-sheets:addRow`, `google-sheets:updateRow`, `google-email:TriggerWatchEmails`, `google-email:ActionSendEmail`, `telegram:SendReplyMessage`, `openai-gpt-3:CreateCompletion`, `builtin:Ignore`, `builtin:Resume`, `builtin:Commit`, `builtin:Rollback`, `builtin:Break`.
- No secrets, no real phone numbers or emails (use `+2348000000000`, `@harvestlane.example`).

Also give every Make item a `build` field in the manifest: an array of strings, one per module in order, "1 · Webhooks › Custom webhook: …settings…", including filters ("Filter on 2→3: status = success"), routes and error handlers, with the exact formulas. This is the fallback if Make doesn't recognise a module on import, so it must be complete enough to build the scenario by hand.

## B. Zap recipes (`kind: "zap"`, `file: null`)

Zapier templates are shared as links made inside a Zapier account, so we provide the exact recipe to build and then share. Manifest item fields: `name`, `what`, `kind: "zap"`, `file: null`, `steps` (array of strings: "1 · Trigger · Gmail › New Email Matching Search: search string label:orders", then each action with app › event, every field mapping and value, Filter/Paths rules, Formatter transforms, Delay, Lookup Table rows), `setup`, `test`, and `tasks` (one sentence estimating Zapier tasks per run, using the lesson's own counting).

## Validate

Run `python3 tools/validate_make.py <your make files>` and `python3 -c "import json,glob;[json.load(open(f)) for f in glob.glob('src/templates/*.json')];print('ok')"` and fix everything. Then reply with only: files written, and anything unsure (one line each). Other writers work in the same folders at the same time; only write your own files.
