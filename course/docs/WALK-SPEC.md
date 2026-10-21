# Walk spec: narration for the animated walkthrough (for writers)

Course context: read the first section of docs/SHEET-SPEC.md. Every lesson has an animated walkthrough player at the top of its solved problem (PART 4; bosses: YOUR MISSION). It draws the lesson's template on a simplified canvas and adds one node (n8n), module (Make) or step (Zap) at a time, with a pointer, a settings panel and a data chip, while a guide (Emeka or Miracle) reads the narration aloud. Your job is the narration: a **walk**.

## Where it goes

- Lessons with templates: add a `"walk"` field to ONE item in `src/templates/<id>.json` — the main workflow the solved problem builds (the player opens on the item that has a walk). Don't change anything else in the manifest.
- Lessons with no template (Track 0, B0, 4.8, 6.1, 6.3): the player shows the solved problem's numbered steps (`.step` elements in PART 4, or in YOUR MISSION for B0) as cards. Add a manifest-level `"walk"` to `src/templates/<id>.json` (create it as `{"id": "0.1", "items": [], "walk": {…}}` if it doesn't exist; if it exists, only add the `walk` key). Here `at` is the card number "1", "2", … in the order of the `.step` elements.

## Format

```json
"walk": {
  "title": "Build it: supplier invoices file themselves",
  "sample": "Email from Farmgate Supplies · Invoice 0192 · inv_0192.pdf",
  "steps": [
    {"at": "Gmail Trigger", "say": "…", "show": ["Label: Invoices", "Search: -in:sent"], "data": "1 email · inv_0192.pdf"}
  ],
  "end": "One closing sentence spoken during the test run."
}
```

- `at`: n8n → the node's exact `name` in the template; Make → the module `id` as a string ("3"); Zap → the step number ("2"); cards → card number. It must exist. Several consecutive steps can share an `at` (talk through one node's settings in two or three steps). Use `null` only for a short opening step.
- `say`: what the guide says. One or two short sentences, spoken English, warm and plain, second person, Harvest Lane context. Explain WHY as well as what ("we normalise the phone first, or the same customer becomes three"). No markdown, no code read out character by character, no emoji. Avoid symbols the voice reads badly (write "naira" not "₦" is fine either way; avoid "=>", "{{ }}" in say).
- `show`: 1–4 short lines shown in the settings panel: the exact setting names and values, formulas or expressions from the template (these CAN contain code like `{{ $json.phone }}`), max ~70 characters each.
- `data`: optional, a few words describing what the data looks like after this step ("3 items · Mrs Ade, Chef Tunde, Bodija Suites"), using the lesson's sample data.
- 8–16 steps per walk, covering every important node in build order (minor nodes may be skipped; they appear at the test run). Include the safety moments the lesson teaches (approval, signature check, test mode, consent, caps).
- `sample`: the test data used in the run, one line. `end`: one sentence for the test run.
- Stay consistent with the lesson and the template; don't invent settings.

## Validate

Run `python3 tools/validate_walks.py src/templates/<your manifests>` from the course directory and fix every error. Reply with only the list of manifests you changed and anything unsure (one line each). Other writers work in the same folder; only touch your own manifests, and re-read a manifest right before editing it.
