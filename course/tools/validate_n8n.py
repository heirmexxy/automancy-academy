#!/usr/bin/env python3
"""Structural validator for n8n workflow JSON templates (Automancy Academy)."""
import json, re, sys, uuid
ALLOWED = {'n8n-nodes-base.manualTrigger': 1.0, 'n8n-nodes-base.scheduleTrigger': 1.2, 'n8n-nodes-base.webhook': 2.0, 'n8n-nodes-base.respondToWebhook': 1.1, 'n8n-nodes-base.httpRequest': 4.2, 'n8n-nodes-base.set': 3.4, 'n8n-nodes-base.if': 2.0, 'n8n-nodes-base.switch': 3.0, 'n8n-nodes-base.filter': 2.0, 'n8n-nodes-base.merge': 3.0, 'n8n-nodes-base.code': 2.0, 'n8n-nodes-base.splitInBatches': 3.0, 'n8n-nodes-base.splitOut': 1.0, 'n8n-nodes-base.aggregate': 1.0, 'n8n-nodes-base.wait': 1.1, 'n8n-nodes-base.noOp': 1.0, 'n8n-nodes-base.stopAndError': 1.0, 'n8n-nodes-base.errorTrigger': 1.0, 'n8n-nodes-base.executeWorkflow': 1.1, 'n8n-nodes-base.executeWorkflowTrigger': 1.0, 'n8n-nodes-base.crypto': 1.0, 'n8n-nodes-base.dateTime': 2.0, 'n8n-nodes-base.googleSheets': 4.5, 'n8n-nodes-base.gmail': 2.1, 'n8n-nodes-base.gmailTrigger': 1.1, 'n8n-nodes-base.telegram': 1.2, 'n8n-nodes-base.telegramTrigger': 1.1, 'n8n-nodes-base.whatsApp': 1.0, 'n8n-nodes-base.whatsAppTrigger': 1.0, 'n8n-nodes-base.supabase': 1.0, 'n8n-nodes-base.postgres': 2.5, 'n8n-nodes-base.hubspot': 2.0, 'n8n-nodes-base.hubspotTrigger': 1.0, 'n8n-nodes-base.zohoCrm': 1.0, 'n8n-nodes-base.facebookGraphApi': 1.0, 'n8n-nodes-base.stickyNote': 1.0, '@n8n/n8n-nodes-langchain.agent': 1.7, '@n8n/n8n-nodes-langchain.chainLlm': 1.5, '@n8n/n8n-nodes-langchain.informationExtractor': 1.0, '@n8n/n8n-nodes-langchain.textClassifier': 1.0, '@n8n/n8n-nodes-langchain.sentimentAnalysis': 1.0, '@n8n/n8n-nodes-langchain.chatTrigger': 1.1, '@n8n/n8n-nodes-langchain.lmChatOpenAi': 1.0, '@n8n/n8n-nodes-langchain.lmChatAnthropic': 1.2, '@n8n/n8n-nodes-langchain.lmChatGoogleGemini': 1.0, '@n8n/n8n-nodes-langchain.memoryBufferWindow': 1.3, '@n8n/n8n-nodes-langchain.memoryPostgresChat': 1.1, '@n8n/n8n-nodes-langchain.outputParserStructured': 1.2, '@n8n/n8n-nodes-langchain.toolWorkflow': 1.3, '@n8n/n8n-nodes-langchain.toolHttpRequest': 1.1, '@n8n/n8n-nodes-langchain.toolCode': 1.1, '@n8n/n8n-nodes-langchain.vectorStoreSupabase': 1.0, '@n8n/n8n-nodes-langchain.embeddingsOpenAi': 1.1, '@n8n/n8n-nodes-langchain.documentDefaultDataLoader': 1.0, '@n8n/n8n-nodes-langchain.textSplitterRecursiveCharacterTextSplitter': 1.0, '@n8n/n8n-nodes-langchain.mcpTrigger': 1.0}
CONN_KINDS = {"main","ai_languageModel","ai_memory","ai_tool","ai_outputParser","ai_embedding","ai_vectorStore","ai_document","ai_textSplitter"}
SECRET = re.compile(r"(sk_(live|test)_[A-Za-z0-9]{8,}|xox[bp]-|AKIA[0-9A-Z]{12}|eyJ[A-Za-z0-9_-]{20,}\.|sk-[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,}|\b\d{9,10}:[A-Za-z0-9_-]{30,}\b)")
def check(path):
    errs=[]
    try: wf=json.load(open(path))
    except Exception as e: return [f"invalid JSON: {e}"]
    for k in ("name","nodes","connections"):
        if k not in wf: errs.append(f"missing top-level '{k}'")
    nodes=wf.get("nodes",[]); names=set(); ids=set()
    if not any(n.get("type")!="n8n-nodes-base.stickyNote" for n in nodes): errs.append("no functional nodes")
    if not any(n.get("type")=="n8n-nodes-base.stickyNote" for n in nodes): errs.append("no sticky note")
    for n in nodes:
        nm=n.get("name")
        for k in ("parameters","id","name","type","typeVersion","position"):
            if k not in n: errs.append(f"node {nm!r}: missing {k}")
        if nm in names: errs.append(f"duplicate node name {nm!r}")
        names.add(nm)
        if n.get("id") in ids: errs.append(f"duplicate id on {nm!r}")
        ids.add(n.get("id"))
        try: uuid.UUID(str(n.get("id")))
        except Exception: errs.append(f"node {nm!r}: id is not a UUID")
        t=n.get("type")
        if t not in ALLOWED: errs.append(f"node {nm!r}: type {t} not in the allowed list")
        elif float(n.get("typeVersion",0))!=ALLOWED[t]: errs.append(f"node {nm!r}: typeVersion {n.get('typeVersion')} (use {ALLOWED[t]})")
        p=n.get("position")
        if not (isinstance(p,list) and len(p)==2 and all(isinstance(x,(int,float)) for x in p)): errs.append(f"node {nm!r}: bad position")
        if "credentials" in n: errs.append(f"node {nm!r}: remove 'credentials'")
        if not isinstance(n.get("parameters"),dict): errs.append(f"node {nm!r}: parameters must be an object")
    for src,kinds in wf.get("connections",{}).items():
        if src not in names: errs.append(f"connection from unknown node {src!r}")
        for kind,outs in kinds.items():
            if kind not in CONN_KINDS: errs.append(f"{src!r}: unknown connection kind {kind}")
            if not isinstance(outs,list): errs.append(f"{src!r}.{kind}: not a list"); continue
            for out in outs:
                for c in (out or []):
                    if c.get("node") not in names: errs.append(f"{src!r} → unknown node {c.get('node')!r}")
                    if c.get("type")!=kind: errs.append(f"{src!r} → {c.get('node')!r}: type {c.get('type')} should be {kind}")
            if kind!="main":
                for out in outs:
                    for c in (out or []):
                        tgt=next((x for x in nodes if x.get("name")==c.get("node")),{})
                        if tgt.get("type") and "langchain" not in tgt["type"]: errs.append(f"{src!r} {kind} → non-AI node {c.get('node')!r}")
    raw=json.dumps(wf)
    for m in SECRET.finditer(raw): errs.append(f"possible secret: {m.group(0)[:24]}…")
    for n in nodes:
        for k,v in _walk(n.get("parameters",{})):
            if isinstance(v,str) and "{{" in v:
                if v.count("{{")!=v.count("}}"): errs.append(f"node {n.get('name')!r}: unbalanced {{{{ }}}} in {k}")
                if not v.startswith("=") : errs.append(f"node {n.get('name')!r}: expression in {k} must start with '='")
    # every non-trigger, non-sticky, non-AI-subnode should be reachable
    targets={c.get("node") for kinds in wf.get("connections",{}).values() for outs in kinds.values() for out in outs for c in (out or [])}
    sources=set(wf.get("connections",{}).keys())
    for n in nodes:
        t=n.get("type","")
        if t=="n8n-nodes-base.stickyNote": continue
        trig = t.endswith("Trigger") or t.endswith("trigger") or t in ("n8n-nodes-base.webhook","n8n-nodes-base.errorTrigger","n8n-nodes-base.manualTrigger")
        if not trig and n.get("name") not in targets and n.get("name") not in sources: errs.append(f"node {n.get('name')!r} is not connected")
        if not trig and n.get("name") not in targets and n.get("name") in sources and "langchain" not in t: errs.append(f"node {n.get('name')!r} has no input")
    return errs
def _walk(o,prefix=""):
    if isinstance(o,dict):
        for k,v in o.items(): yield from _walk(v,prefix+"."+k)
    elif isinstance(o,list):
        for i,v in enumerate(o): yield from _walk(v,f"{prefix}[{i}]")
    else: yield prefix,o
if __name__=="__main__":
    bad=0
    for f in sys.argv[1:]:
        e=check(f)
        if e:
            bad+=1; print(f"✗ {f}"); [print("   -",x) for x in e[:40]]
        else: print(f"✓ {f}")
    sys.exit(1 if bad else 0)
