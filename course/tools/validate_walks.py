#!/usr/bin/env python3
import json, sys, re, glob, os, html
def mod_ids(flow, out):
    for m in flow or []:
        out.add(str(m.get("id"))); [mod_ids(r.get("flow"), out) for r in m.get("routes", []) or []]; mod_ids(m.get("onerror"), out)
    return out
def cards_for(id_):
    f = "src/modules/" + ({"B0":"0-9-boss","B1":"1-9-boss","B2":"2-9-boss","B3":"3-9-boss","B4":"4-99-boss","B5":"5-99-boss"}.get(id_) or id_.replace(".", "-")) + ".html"
    s = open(f).read()
    tag = "YOUR MISSION" if id_.startswith("B") else "PART 4"
    i = s.find('class="tag">' + tag); j = s.find('<section class="part"', i)
    return len(re.findall(r'<div class="step">', s[i:j if j > 0 else None]))
def check_walk(w, keys, label):
    e = []
    for k in ("title", "steps", "end"):
        if not w.get(k): e.append(f"{label}: missing {k}")
    st = w.get("steps") or []
    if not 6 <= len(st) <= 18: e.append(f"{label}: {len(st)} steps (aim 8–16)")
    for i, s in enumerate(st):
        at = s.get("at")
        if at is not None and str(at) not in keys: e.append(f"{label} step {i+1}: at {at!r} not found")
        if not s.get("say") or len(s["say"]) > 320: e.append(f"{label} step {i+1}: say missing or too long")
        if re.search(r"[{}<>]|=>", s.get("say", "")): e.append(f"{label} step {i+1}: say has code symbols")
        if not isinstance(s.get("show", []), list): e.append(f"{label} step {i+1}: show must be a list")
    return e
bad = 0
for f in sys.argv[1:]:
    m = json.load(open(f)); errs = []
    for it in m.get("items", []):
        if "walk" not in it: continue
        kind = it.get("kind", "n8n")
        if kind == "zap": keys = {str(i + 1) for i in range(len(it.get("steps", [])))}
        else:
            wf = json.load(open("src/templates/" + ("make/" if kind == "make" else "wf/") + it["file"]))
            keys = mod_ids(wf.get("flow"), set()) if kind == "make" else {n["name"] for n in wf["nodes"]}
        errs += check_walk(it["walk"], keys, it.get("name", "?"))
    if "walk" in m:
        n = cards_for(m["id"]); errs += check_walk(m["walk"], {str(i + 1) for i in range(n)}, f"cards({n})")
    walks = sum(1 for it in m.get("items", []) if "walk" in it) + (1 if "walk" in m else 0)
    if walks == 0: errs.append("no walk in this manifest")
    if walks > 1 and "walk" not in m: errs.append(f"{walks} walks (one is enough)")
    if errs: bad += 1; print("✗", f); [print("   -", x) for x in errs[:20]]
    else: print("✓", f)
sys.exit(1 if bad else 0)
