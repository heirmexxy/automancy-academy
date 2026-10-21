# Mission sheet spec (for writers)

Course: Automancy Academy, an AI automation course (Zapier, Make, n8n, AI agents, growth, CRM, client work) for Nigerian and African learners. Lessons live in `src/modules/*.html` as `<template data-mod="X.Y">`. The running case study is Harvest Lane, Tolu's fresh-produce delivery business in Ibadan (orders on WhatsApp, Paystack payments, riders, restaurant and hotel customers). Guides: Bolt (Zapier), Weave (Make), Nodo (n8n), Sage (agents), Echo (growth), Tolu, and Glitch (the mischief-maker who breaks things).

Each lesson has PART 6 "Missions" with three tiers (Bronze +25 XP, Silver +50 XP, Gold +100 XP). Each tier has a title (h4), task bullets, and "Done when" criteria. Gold missions are usually for a real business.

Boss battles (`*-9-boss.html`, `4-99-boss.html`, `5-99-boss.html`) have deliverables, tests, a go-live check, curveballs, a SCORING rubric table and a reference build.

## Your job

For each item assigned to you, READ THE WHOLE MODULE FILE FIRST, then write one JSON file to `src/sheets/<file>.json`:
- Lesson "1.3" → `src/sheets/1-3.json`. Boss "B2" → `src/sheets/B2.json`.

### Lesson schema

```json
{
  "id": "1.3",
  "tiers": {
    "b": {
      "answer": "<p>…</p>",
      "mistakes": ["…", "…", "…"],
      "pass": "…",
      "redo": "…"
    },
    "s": { same keys },
    "g": { same keys }
  }
}
```

- `answer`: the model answer as HTML. A complete, worked answer a learner can compare their own work with: the actual list, map, table, scope, prompt, test cases, node-by-node settings, expressions or code that a strong learner would hand in. Use Harvest Lane (or, where the mission says "a real business", a clearly fictional sample business such as a pharmacy in Ibadan, a salon in Enugu or a school in Abeokuta) as the worked example, and say so in the first line ("Worked example: …"). Bronze 120–250 words; Silver 200–400 words; Gold 200–400 words (for Gold, show a sample of the finished evidence: the report, the numbers table, the case-study outline, and what to submit).
- `mistakes`: 3–4 short, specific mistakes learners make on THIS mission.
- `pass`: one or two sentences: what a reviewer must see to accept it (make the "Done when" criteria concrete and checkable).
- `redo`: one or two sentences: the usual reasons to send it back.

### Boss schema

```json
{
  "id": "B2",
  "boss": true,
  "intro": "<p>How to use this guide…</p>",
  "rows": [ {"area": "…", "full": "…", "partial": "…", "low": "…"} ],
  "evidence": ["…"],
  "mistakes": ["…"]
}
```

- `rows`: one row per row of that boss's SCORING rubric table, same area names, same order. `full` = what full marks look like (concrete and checkable), `partial` = typical half marks, `low` = little or no marks.
- `evidence`: 5–8 things the learner submits (files, screenshots, logs, demo video length), matching the boss's deliverables.
- `mistakes`: 4–6 common reasons boss submissions fail.
- `intro`: 2–3 sentences, for learners and reviewers.

## Allowed HTML inside strings

`<p>`, `<ul>`, `<ol>`, `<li>`, `<b>`, `<i>`, `<code>`, `<br>`, `<pre class="codebox">…</pre>`, and tables as `<div class="tablewrap"><table class="dt"><thead><tr><th>…</th></tr></thead><tbody><tr><td>…</td></tr></tbody></table></div>`. No other tags, no attributes except those class names, no links, no emoji. Inside `<pre>` and everywhere else escape `<`, `>` and `&` in literal text as `&lt;` `&gt;` `&amp;`. Inside JSON strings, escape double quotes as `\"` and newlines as `\n` (a `<pre>` block needs real `\n` newlines).

## Style

- Plain, warm, direct English, British spelling ("normalise", "organise", "colour"). Short sentences. Second person ("you").
- Naira with ₦ and commas (₦45,000). Nigerian context where natural.
- Stay consistent with the lesson: same tools, node names, numbers, rules and safety practices (test mode, never paste real keys or real customer data, a person approves risky actions, consent). Don't contradict the lesson's solved problem; the model answer for Silver often extends it.
- Don't invent platform facts (prices, limits, feature names) that aren't in the lesson. If you must mention one, use the lesson's figure or hedge ("check the current limit").
- No hype, no promises of income.

## Before you finish

Run `python3 -c "import json,sys; [json.load(open(f)) for f in sys.argv[1:]]; print('ok')" src/sheets/<your files>` from the course directory and fix any errors. Then reply with only: the list of files written and anything in a lesson you found inconsistent or wrong (one line each). Don't edit any other file.
