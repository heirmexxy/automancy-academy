#!/usr/bin/env python3
"""Structural validator for Make blueprint JSON (Automancy Academy)."""
import json, re, sys
SECRET = re.compile(r"(sk_(live|test)_[A-Za-z0-9]{8,}|sk-[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,}|\b\d{9,10}:[A-Za-z0-9_-]{30,}\b|eyJ[A-Za-z0-9_-]{20,}\.)")
DIRECTIVES = {"builtin:Ignore","builtin:Resume","builtin:Commit","builtin:Rollback","builtin:Break"}
def walk(flow, path, ids, errs, depth=0):
    if not isinstance(flow, list): errs.append(f"{path}: flow must be a list"); return
    for m in flow:
        mid = m.get("id"); mod = m.get("module")
        if not isinstance(mid, int): errs.append(f"{path}: module id {mid!r} not an integer")
        elif mid in ids: errs.append(f"{path}: duplicate module id {mid}")
        else: ids.add(mid)
        if not isinstance(mod, str) or not re.match(r"^[a-z0-9-]+:[A-Za-z0-9]+$", mod): errs.append(f"{path}: bad module name {mod!r}")
        if not isinstance(m.get("version"), int): errs.append(f"module {mid}: version must be an integer")
        md = (m.get("metadata") or {}).get("designer")
        if not (isinstance(md, dict) and "x" in md and "y" in md): errs.append(f"module {mid}: metadata.designer x/y missing")
        if "__IMTCONN__" in json.dumps(m.get("parameters") or {}): errs.append(f"module {mid}: remove connection ids")
        f = m.get("filter")
        if f is not None:
            c = f.get("conditions")
            if not (isinstance(c, list) and all(isinstance(g, list) and all(isinstance(x, dict) and "o" in x and "a" in x for x in g) for g in c)): errs.append(f"module {mid}: bad filter conditions")
        for k, v in (m.get("mapper") or {}).items() if isinstance(m.get("mapper"), dict) else []:
            sv = json.dumps(v)
            if sv.count("{{") != sv.count("}}"): errs.append(f"module {mid}: unbalanced {{{{ }}}} in mapper.{k}")
        if mod == "builtin:BasicRouter":
            r = m.get("routes")
            if not (isinstance(r, list) and r): errs.append(f"router {mid}: no routes")
            for i, rt in enumerate(r or []): walk(rt.get("flow"), f"{path}>router{mid}.route{i}", ids, errs, depth+1)
        if "onerror" in m:
            oe = m["onerror"]
            walk(oe, f"{path}>module{mid}.onerror", ids, errs, depth+1)
            if not oe or oe[-1].get("module") not in DIRECTIVES: errs.append(f"module {mid}: error handler should end with a directive (Ignore/Resume/Commit/Rollback/Break)")
def check(p):
    errs = []
    try: bp = json.load(open(p))
    except Exception as e: return [f"invalid JSON: {e}"]
    for k in ("name", "flow", "metadata"):
        if k not in bp: errs.append(f"missing '{k}'")
    ids = set(); walk(bp.get("flow", []), "flow", ids, errs)
    for m in SECRET.finditer(json.dumps(bp)): errs.append(f"possible secret {m.group(0)[:20]}…")
    return errs
bad = 0
for f in sys.argv[1:]:
    e = check(f)
    if e: bad += 1; print("✗", f); [print("   -", x) for x in e[:30]]
    else: print("✓", f)
sys.exit(1 if bad else 0)
