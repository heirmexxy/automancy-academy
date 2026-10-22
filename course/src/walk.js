
/* ======================================================================
   Animated walkthrough player
   Builds the lesson's workflow on screen step by step from its template
   (n8n nodes, Make modules, Zap steps) or, when there is no template,
   from the lesson's own build steps. A guide narrates each step aloud.
   Walk data: item.walk = {title, sample, steps:[{at, say, show[], data}], end}
   (at = n8n node name · Make module id · Zap step number · card number).
   ====================================================================== */
const WK = {el:null, id:null, items:[], cur:0, g:null, steps:[], i:-1, playing:false, timer:null, tok:0};
const WK_TYPES = {
  manualTrigger:"Manual trigger", scheduleTrigger:"Schedule", webhook:"Webhook", respondToWebhook:"Respond to webhook", httpRequest:"HTTP Request",
  set:"Edit Fields", if:"IF", switch:"Switch", filter:"Filter", merge:"Merge", code:"Code", splitInBatches:"Loop over items", splitOut:"Split out",
  aggregate:"Aggregate", wait:"Wait", noOp:"No operation", stopAndError:"Stop and error", errorTrigger:"Error trigger", executeWorkflow:"Run sub-workflow",
  executeWorkflowTrigger:"Sub-workflow start", crypto:"Crypto", dateTime:"Date & Time", googleSheets:"Google Sheets", gmail:"Gmail", gmailTrigger:"Gmail trigger",
  telegram:"Telegram", telegramTrigger:"Telegram trigger", whatsApp:"WhatsApp", whatsAppTrigger:"WhatsApp trigger", supabase:"Supabase", postgres:"Postgres",
  hubspot:"HubSpot", hubspotTrigger:"HubSpot trigger", zohoCrm:"Zoho CRM", facebookGraphApi:"Facebook Graph API", agent:"AI Agent", chainLlm:"LLM chain",
  informationExtractor:"Information extractor", textClassifier:"Text classifier", sentimentAnalysis:"Sentiment analysis", chatTrigger:"Chat trigger",
  lmChatOpenAi:"OpenAI model", lmChatAnthropic:"Anthropic model", lmChatGoogleGemini:"Gemini model", memoryBufferWindow:"Simple memory",
  memoryPostgresChat:"Postgres memory", outputParserStructured:"Output parser", toolWorkflow:"Workflow tool", toolHttpRequest:"HTTP tool", toolCode:"Code tool",
  vectorStoreSupabase:"Supabase vector store", embeddingsOpenAi:"Embeddings", documentDefaultDataLoader:"Document loader",
  textSplitterRecursiveCharacterTextSplitter:"Text splitter", mcpTrigger:"MCP server trigger"
};
const WK_DO = {
  manualTrigger:"starts the workflow when you click Execute", scheduleTrigger:"starts it on a schedule", webhook:"receives data at its own web address",
  respondToWebhook:"sends the reply back to whoever called the webhook", httpRequest:"calls an outside API", set:"sets, renames or tidies fields",
  if:"checks a condition and splits the flow into true and false", switch:"sends each item down the route that matches", filter:"lets through only the items that match",
  merge:"joins two streams of data", code:"runs a few lines of JavaScript", splitInBatches:"works through the items a batch at a time", splitOut:"turns a list into separate items",
  aggregate:"gathers items back into one", wait:"pauses until it's time, or until someone answers", stopAndError:"stops the run with a clear error",
  errorTrigger:"starts whenever another workflow fails", executeWorkflow:"hands work to a sub-workflow", executeWorkflowTrigger:"starts when another workflow calls it",
  crypto:"creates or checks a signature or hash", dateTime:"works with dates and times", googleSheets:"reads or writes the sheet", gmail:"reads or sends email",
  gmailTrigger:"starts when a matching email arrives", telegram:"sends a Telegram message", telegramTrigger:"starts when a Telegram message arrives",
  whatsApp:"sends a WhatsApp message", whatsAppTrigger:"starts when a WhatsApp message arrives", supabase:"reads or writes the database", postgres:"runs a database query",
  hubspot:"reads or writes the CRM", hubspotTrigger:"starts when something changes in the CRM", zohoCrm:"reads or writes the CRM", facebookGraphApi:"talks to Facebook or Instagram",
  agent:"is the agent: it reads the message, decides, and uses its tools", chainLlm:"asks the AI model one clear question", informationExtractor:"pulls structured fields out of text",
  textClassifier:"sorts the text into categories", sentimentAnalysis:"labels the mood of the text", chatTrigger:"starts a chat you can test in the editor",
  lmChatOpenAi:"is the AI model the agent thinks with", lmChatAnthropic:"is the AI model the agent thinks with", lmChatGoogleGemini:"is the AI model the agent thinks with",
  memoryBufferWindow:"gives the agent a short memory", memoryPostgresChat:"keeps each customer's conversation in the database", outputParserStructured:"makes the AI answer in a fixed shape",
  toolWorkflow:"is a tool the agent can call", toolHttpRequest:"is a tool the agent can call", toolCode:"is a tool the agent can call",
  vectorStoreSupabase:"searches your documents for the right passage", embeddingsOpenAi:"turns text into numbers for searching", documentDefaultDataLoader:"loads the documents",
  textSplitterRecursiveCharacterTextSplitter:"cuts documents into small chunks", mcpTrigger:"lets an outside AI assistant use these tools"
};
const wkShort = (t, n) => { t = String(t == null ? "" : t).replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };
const wkTitle = s => s.replace(/[-_]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, c => c.toUpperCase());
function wkCat(t){
  t = t.toLowerCase();
  if(/error|stopanderror|break|rollback|ignore|resume|commit/.test(t)) return "err";
  if(/trigger|webhook$|watch|customwebhook/.test(t)) return "trig";
  if(/langchain|openai|anthropic|gemini|agent|claude/.test(t)) return "ai";
  if(/telegram|whatsapp|gmail|email|facebook|instagram|slack/.test(t)) return "msg";
  if(/\b(if|switch|filter|merge|code|set|router|feeder|aggregat|setvariable|json|loop|split|wait|datetime|crypto|noop|sleep|formatter|paths|delay)\b|basic|util:|n8n-nodes-base\.(if|switch|filter|merge|code|set|splitinbatches|splitout|aggregate|wait|datetime|crypto|noop)$/.test(t)) return "logic";
  return "app";
}
function wkFlat(o, pre, out){
  if(out.length > 40) return out;
  if(o && typeof o === "object" && !Array.isArray(o)){ for(const k of Object.keys(o)) if(!/^(__rl|cachedResultName|cachedResultUrl|mode)$/.test(k)) wkFlat(o[k], pre ? pre + "." + k : k, out); }
  else if(Array.isArray(o)){ o.slice(0, 3).forEach((v, i) => wkFlat(v, pre, out)); }
  else if(o !== "" && o != null && o !== false) out.push([pre.split(".").filter(x => !/^(values|value|parameters|options|conditions|rules|fields|assignments)$/.test(x)).slice(-2).join(" › ") || pre, o]);
  return out;
}
const WK_OPS = {"text:equal":"=","text:notequal":"≠","text:contain":"contains","text:notcontain":"doesn't contain","text:startwith":"starts with","text:endwith":"ends with","text:pattern":"matches","number:equal":"=","number:notequal":"≠","number:greater":">","number:less":"<","number:greaterorequal":"≥","number:lessorequal":"≤","exist":"exists","notexist":"is empty","boolean:equal":"=","date:greater":"after","date:less":"before","text:greaterorequal":"≥","text:less":"<"};
function wkFilterText(f){
  if(!f || !f.conditions) return [];
  return f.conditions.map(g => (g || []).map(c => { const o = String(c.o || ""); const ci = /:ci$/.test(o); const op = WK_OPS[o.replace(/:ci$/, "")] || o;
    return `${wkShort(String(c.a || "").replace(/[{}]/g, ""), 30)} ${op}${c.b !== undefined && c.b !== "" && !/exist/.test(o) ? " " + wkShort(String(c.b), 24) : ""}${ci ? " (any case)" : ""}`; }).join(" AND ")).map((t, i) => `${i ? "OR " : "Filter “" + (f.name || "filter") + "”: "}${t}`);
}
function wkShowFrom(params, pick){
  const pri = /operation|resource|method|url|path|rule|interval|hour|field|leftValue|operator|rightValue|name|value|jsCode|text|systemMessage|description|query|chatId|sheet|documentId|table|to|subject|model/i;
  const all = wkFlat(params || {}, "", []).filter(([k, v]) => !/^(position|id|webhookId|height|width|color|notice)$/.test(k));
  const sorted = all.filter(([k]) => pri.test(k)).concat(all.filter(([k]) => !pri.test(k)));
  return sorted.slice(0, pick || 4).map(([k, v]) => `${wkTitle(k)}: ${wkShort(typeof v === "string" ? v.replace(/^=/, "").split("\n")[0] : v, 70)}`);
}

/* ---- graphs ---- */
function wkGraphN8n(wf){
  const nodes = (wf.nodes || []).filter(n => n.type !== "n8n-nodes-base.stickyNote");
  const sticky = (wf.nodes || []).filter(n => n.type === "n8n-nodes-base.stickyNote").sort((a, b) => a.position[0] - b.position[0] || a.position[1] - b.position[1])[0];
  const G = {kind:"n8n", nodes:[], edges:[], byKey:{}, intro: sticky ? (sticky.parameters.content || "") : ""};
  nodes.forEach(n => {
    const t = n.type.split(".").pop();
    const g = {key:n.name, label:n.name, sub:WK_TYPES[t] || wkTitle(t), x:n.position[0], y:n.position[1], cat:wkCat(n.type + " " + t), type:t, params:n.parameters};
    G.nodes.push(g); G.byKey[n.name] = g; G.byKey[n.name.toLowerCase()] = g;
  });
  for(const [src, kinds] of Object.entries(wf.connections || {})) for(const [kind, outs] of Object.entries(kinds)) (outs || []).forEach(out => (out || []).forEach(c => {
    if(G.byKey[src] && G.byKey[c.node]) G.edges.push({a:G.byKey[src], b:G.byKey[c.node], ai:kind !== "main"});
  }));
  return G;
}
function wkMakeLabel(mod){
  const [app, act] = mod.split(":");
  const fixed = {"builtin:BasicRouter":"Router", "builtin:BasicFeeder":"Iterator", "builtin:BasicAggregator":"Array aggregator", "util:TextAggregator":"Text aggregator",
    "util:NumericAggregator":"Numeric aggregator", "gateway:CustomWebHook":"Custom webhook", "gateway:WebhookRespond":"Webhook response", "util:SetVariable2":"Set variable",
    "util:SetVariables":"Set variables", "util:GetVariable2":"Get variable", "json:ParseJSON":"Parse JSON", "json:CreateJSON":"Create JSON", "http:ActionSendData":"HTTP request",
    "builtin:Ignore":"Ignore", "builtin:Resume":"Resume", "builtin:Commit":"Commit", "builtin:Rollback":"Rollback", "builtin:Break":"Break", "util:FunctionSleep":"Sleep"};
  const appName = {"google-sheets":"Google Sheets", "google-email":"Gmail", "google-drive":"Google Drive", "openai-gpt-3":"OpenAI", "datastore":"Data store", "gateway":"Webhooks", "builtin":"Flow control", "util":"Tools", "http":"HTTP", "json":"JSON", "telegram":"Telegram", "scenario-service":"Scenario"}[app] || wkTitle(app);
  return {label: fixed[mod] || wkTitle(act || mod), sub: appName};
}
function wkGraphMake(bp){
  const G = {kind:"make", nodes:[], edges:[], byKey:{}, intro:""};
  const add = (m, prev, err) => {
    const L = wkMakeLabel(m.module || "");
    const g = {key:String(m.id), label:`${m.id} · ${L.label}`, sub:L.sub, x:(m.metadata && m.metadata.designer || {}).x || 0, y:(m.metadata && m.metadata.designer || {}).y || 0, cat:wkCat(m.module || ""), type:m.module, params:m.mapper || m.parameters || {}, filter:m.filter};
    if(G.byKey[g.key]) return G.byKey[g.key];
    G.nodes.push(g); G.byKey[g.key] = g;
    if(prev) G.edges.push({a:prev, b:g, ai:!!err, label:m.filter ? wkShort(m.filter.name || "filter", 22) : ""});
    return g;
  };
  const walk = (flow, prev, err) => { let p = prev, first = true;
    (flow || []).forEach(m => { const g = add(m, p, err && first); first = false;
      if(m.routes) m.routes.forEach(r => walk(r.flow, g, false));
      if(m.onerror) walk(m.onerror, g, true);
      p = m.routes ? null : g; }); };
  walk(bp.flow, null, false);
  // error handlers often share designer positions: nudge overlaps down
  const seen = {}; G.nodes.forEach(n => { const k = n.x + "," + n.y; if(seen[k]){ n.y += 120 * seen[k]; } seen[k] = (seen[k] || 0) + 1; });
  return G;
}
function wkGraphList(steps, kind){
  const G = {kind, nodes:[], edges:[], byKey:{}, intro:""};
  steps.forEach((s, i) => {
    const m = /^\s*(\d+)\s*·\s*([^·]+?)\s*·\s*([^:]+?)(?::\s*([\s\S]*))?$/.exec(s.text || "");
    const label = s.label || (m ? m[3] : wkShort(s.text, 40));
    const g = {key:String(i + 1), label:wkShort(label, 34), sub: s.sub || (m ? `${m[1]} · ${m[2]}` : `Step ${i + 1}`), x:0, y:i * 95, cat: kind === "zap" ? (i === 0 ? "trig" : wkCat((m ? m[3] : "") + " " + (m ? m[2] : ""))) : "card", type:kind, detail: m ? (m[4] || "") : (s.detail || ""), say:s.say};
    G.nodes.push(g); G.byKey[g.key] = g;
    if(i) G.edges.push({a:G.nodes[i - 1], b:g});
  });
  return G;
}
function wkGraph(item){
  if(item.kind === "clip") return {kind:"clip", nodes:[], edges:[], byKey:{}, intro:"", clip:item.clip};
  if(item.kind === "make" && item.wf) return wkGraphMake(item.wf);
  if(item.kind === "zap") return wkGraphList((item.steps || []).map(t => ({text:t})), "zap");
  if(item.kind === "cards") return wkGraphList(item.cards, "cards");
  return wkGraphN8n(item.wf);
}

/* ---- walk steps (authored or generated) ---- */
function wkOrder(G){
  const inn = new Map(G.nodes.map(n => [n, 0]));
  G.edges.filter(e => !e.ai).forEach(e => inn.set(e.b, inn.get(e.b) + 1));
  const starts = G.nodes.filter(n => inn.get(n) === 0 && !G.edges.some(e => e.ai && e.a === n)).sort((a, b) => a.x - b.x || a.y - b.y);
  const out = [], seen = new Set(), q = [...starts];
  while(q.length){ const n = q.shift(); if(seen.has(n)) continue; seen.add(n); out.push(n);
    G.edges.filter(e => e.ai && e.b === n).forEach(e => { if(!seen.has(e.a)){ seen.add(e.a); out.push(e.a); } });
    G.edges.filter(e => !e.ai && e.a === n).sort((a, b) => a.b.y - b.b.y).forEach(e => q.push(e.b)); }
  G.nodes.forEach(n => { if(!seen.has(n)) out.push(n); });
  return out;
}
function wkPlain(md){ return String(md || "").replace(/^#+\s*/gm, "").replace(/[*_`>]/g, "").replace(/\n{2,}/g, "\n").trim(); }
function wkAutoSteps(G, item){
  const steps = [];
  if(G.kind === "cards"){
    G.nodes.forEach(n => steps.push({at:n.key, say:n.say || n.label, show:n.detail ? [wkShort(n.detail, 120)] : []}));
    return steps;
  }
  if(G.kind === "zap"){
    G.nodes.forEach(n => steps.push({at:n.key, say:`${n.sub.replace(/^\d+ · /, "Step " + n.key + ", ")}: ${n.label}.`, show:(n.detail || "").split(/;\s*/).filter(Boolean).slice(0, 4).map(x => wkShort(x, 90))}));
    return steps;
  }
  const intro = wkPlain(G.intro).split("\n").filter(l => l.length > 25).slice(0, 2).join(" ");
  steps.push({at:null, say: intro ? wkShort(intro, 260) : `Here's how ${item.name} is built, one step at a time.`, show:[item.what ? wkShort(item.what, 140) : ""].filter(Boolean)});
  wkOrder(G).forEach((n, i) => {
    let say;
    if(G.kind === "make"){
      say = `${i === 0 ? "It starts with" : "Then"} module ${n.key}: ${n.sub}, ${n.label.replace(/^\d+ · /, "")}.` + (n.filter ? ` A filter called ${n.filter.name || "the filter"} lets only the right bundles in.` : "");
    } else {
      const d = WK_DO[n.type]; say = `${i === 0 ? "It starts with" : "Next,"} “${n.label}”, ${/^[AEIOU]/.test(n.sub) ? "an" : "a"} ${n.sub} step. ${d ? "It " + d + "." : ""}`;
    }
    steps.push({at:n.key, say, show:wkFilterText(n.filter).concat(wkShowFrom(n.params, n.filter ? 3 : 4))});
  });
  return steps;
}
function wkSteps(G, item){
  if(G.kind === "clip"){
    const C = G.clip, S2 = (C.steps || []).map((s, i) => ({at:String(i), say:s.say, show:s.show || [], data:"", clip:s}));
    const last = S2.length ? S2[S2.length - 1].clip : {screen:C.title, ui:[]};
    if(C.end) S2.push({at:"__end", say:C.end, show:[], data:"", clip:Object.assign({}, last, {ui:(last.ui || []).map(u => Object.assign({}, u, {highlight:false}))})});
    return S2;
  }
  const w = item.walk;
  const steps = w && w.steps && w.steps.length ? w.steps.map(s => ({at: s.at == null ? null : String(s.at), say:s.say, show:s.show || [], data:s.data})) : wkAutoSteps(G, item);
  if(G.nodes.length > 1) steps.push({at:"__run", say: (w && w.end) || (G.kind === "cards" ? "That's the whole build. Now try it yourself, step by step." : "Now the test run. Use test data, run it once, and watch every step turn green before you switch it on."), show: w && w.sample ? [`Test data: ${w.sample}`] : [], data:""});
  return steps;
}

/* ---- rendering ---- */
const WK_W = 176, WK_H = 54;
function wkSVG(G){
  const xs = G.nodes.map(n => n.x), ys = G.nodes.map(n => n.y);
  const minX = Math.min(...xs), minY = Math.min(...ys), maxX = Math.max(...xs), maxY = Math.max(...ys);
  // n8n and Make spacing differ; scale to keep boxes from overlapping
  const sx = G.kind === "make" ? 0.8 : G.kind === "n8n" ? 1.05 : 1, sy = G.kind === "make" ? 0.75 : 1;
  G.nodes.forEach(n => { n.px = (n.x - minX) * sx + 20; n.py = (n.y - minY) * sy + 46; });
  // n8n packs AI sub-nodes (models, memory, tools) closer than our boxes are wide: push overlapping boxes apart
  for(let pass = 0; pass < 8; pass++){
    let moved = false; const ns = [...G.nodes].sort((a, b) => a.px - b.px || a.py - b.py);
    for(let i = 0; i < ns.length; i++) for(let j = i + 1; j < ns.length; j++){
      const a = ns[i], b = ns[j];
      if(Math.abs(a.py - b.py) < WK_H + 10 && b.px - a.px < WK_W + 16){ b.px = a.px + WK_W + 16; moved = true; }
    }
    if(!moved) break;
  }
  const W = Math.max(...G.nodes.map(n => n.px)) + WK_W + 20, H = Math.max(...G.nodes.map(n => n.py)) + WK_H + 50;
  const path = e => { const a = e.a, b = e.b;
    if(e.ai){ const x1 = a.px + WK_W / 2, y1 = a.py, x2 = b.px + WK_W / 2, y2 = b.py + WK_H; return `M${x1} ${y1} C${x1} ${(y1 + y2) / 2} ${x2} ${(y1 + y2) / 2} ${x2} ${y2}`; }
    if(G.kind === "zap" || G.kind === "cards"){ const x = a.px + WK_W / 2; return `M${x} ${a.py + WK_H} L${x} ${b.py}`; }
    const x1 = a.px + WK_W, y1 = a.py + WK_H / 2, x2 = b.px, y2 = b.py + WK_H / 2, mx = (x1 + x2) / 2; return `M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`; };
  G.edges.forEach((e, i) => e.id = "wke" + i);
  const box = (n, i) => `<g class="wk-node c-${n.cat}" data-k="${esc(n.key)}" transform="translate(${n.px} ${n.py})"><rect width="${WK_W}" height="${WK_H}" rx="${G.kind === "make" ? 27 : 10}"/>
      <title>${esc(n.label + " · " + n.sub)}</title><text x="12" y="22" class="wk-l">${esc(wkShort(n.label, 30))}</text><text x="12" y="40" class="wk-s">${esc(wkShort(n.sub, 34))}</text><circle class="wk-ok" cx="${WK_W - 12}" cy="12" r="6"/></g>`;
  return `<svg class="wk-svg" viewBox="0 0 ${Math.max(W, 260)} ${Math.max(H, 140)}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Workflow being built step by step">
    <defs><marker id="wkArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="var(--muted)"/></marker></defs>
    <g class="wk-edges">${G.edges.map(e => `<path id="${e.id}" class="wk-edge${e.ai ? " ai" : ""}" d="${path(e)}" marker-end="url(#wkArrow)"/>${e.label ? `<text class="wk-elabel" data-e="${e.id}"><textPath href="#${e.id}" startOffset="50%" text-anchor="middle">${esc(e.label)}</textPath></text>` : ""}`).join("")}</g>
    <g class="wk-nodes">${G.nodes.map(box).join("")}</g>
    <g class="wk-chip" opacity="0"><rect rx="8" height="24"/><text y="16"></text></g>
    <circle class="wk-dot" r="7" opacity="0"/>
    <g class="wk-ptr" opacity="0"><path d="M0 0 L0 20 L5 15 L9 24 L13 22 L9 13 L16 13 Z"/></g>
    <circle class="wk-ripple" r="4" opacity="0"/>
  </svg>`;
}
function wkMount(host, id, part){
  const T = TPLS[id]; const items = (T && T.items || []).filter(it => it.kind === "zap" ? (it.steps || []).length : it.kind === "make" || it.kind === "n8n" ? it.wf : false);
  if(!items.length){
    const cards = $$(".step", part || host).map(st => { const h = st.querySelector("h4"); const p = st.querySelector("p, li");
      return {label: h ? h.textContent.trim() : "", say: (h ? h.textContent.trim() + ". " : "") + (p ? wkShort(p.textContent, 300) : ""), detail: p ? p.textContent.trim() : ""}; }).filter(c => c.label);
    if(cards.length < 2 && !wkClipsFor(id).length) return;
    if(cards.length >= 2) items.push({kind:"cards", name: id.startsWith("B") ? "The build, step by step" : "The solved problem, step by step", cards, walk:(T && T.walk) || null});
  }
  const c = coachFor(id);
  let best = items.findIndex(it => it.walk && it.walk.steps && it.walk.steps.length);
  if(best < 0){ let mx = -1; items.forEach((it, i) => { const n = it.wf && it.wf.nodes ? it.wf.nodes.length : it.wf && it.wf.flow ? JSON.stringify(it.wf.flow).split('"module"').length : (it.steps || it.cards || []).length; if(n > mx){ mx = n; best = i; } }); }
  if(best < 0) best = 0;
  /* the lesson's animated clips go after its workflows; the default selection stays a workflow */
  wkClipsFor(id).forEach(cl => items.push({kind:"clip", name:"▶ Clip: " + cl.title, clip:cl}));
  host.insertAdjacentHTML("beforeend", `<div class="wk" id="walk" data-id="${esc(id)}">
    <div class="wk-head"><span class="wk-av" style="--cc:${c.col}"><img src="${c.img}" alt=""></span><div class="wk-t"><b>Animated walkthrough</b><small>with <span class="wk-who">${esc(wkWho(c, false))}</span> · <span class="wk-kind"></span></small></div>
      ${items.length > 1 ? `<label class="wk-pick">Workflow <select>${items.map((it, i) => `<option value="${i}">${esc(wkShort(it.name, it.kind === "clip" ? 72 : 48))}</option>`).join("")}</select></label>` : ""}</div>
    <div class="wk-stage"><div class="wk-canvas"></div><div class="wk-panel"><span class="wk-n"></span><p class="wk-say" aria-live="polite"></p><ul class="wk-show"></ul></div></div>
    <div class="wk-bar"><i></i></div>
    <div class="wk-ctl"><button type="button" data-wk="prev" aria-label="Previous step">◀</button><button type="button" class="cta sm" data-wk="play">▶ Play</button><button type="button" data-wk="next" aria-label="Next step">▶|</button><button type="button" data-wk="restart" aria-label="Start again">↺</button>
      <label class="note"><input type="checkbox" data-wk="voice" checked> Voice</label></div>
    <p class="note wk-note">A simplified picture of the canvas, not the real screen: the real ${"tool"} looks different, but the steps, names and settings are the same as the template.</p>
  </div>`);
  WK.el = host.querySelector(".wk"); WK.id = id; WK.items = items; WK.coach = c;
  const sel = WK.el.querySelector(".wk-pick select"); if(sel) sel.value = String(best);
  wkLoad(best);
}
function wkLoad(k){
  wkPause(); const it = WK.items[k]; WK.cur = k;
  const G = wkGraph(it); WK.g = G; WK.steps = wkSteps(G, it); WK.i = -1;
  const el = WK.el, cv = el.querySelector(".wk-canvas");
  const who = G.kind === "clip" ? (COACH.find(x => x.g === G.clip.presenter) || WK.coach) : WK.coach;
  WK.voice = who.g; const av = el.querySelector(".wk-av"); av.style.setProperty("--cc", who.col); const ai = av.querySelector("img"); if(ai && ai.getAttribute("src") !== who.img) ai.src = who.img;
  el.querySelector(".wk-who").textContent = wkWho(who, G.kind === "clip");
  cv.classList.toggle("wkc-on", G.kind === "clip");
  if(G.kind === "clip"){
    cv.innerHTML = wkClipHTML(); el.querySelector(".wk-kind").textContent = "Animated clip · " + G.clip.title;
    el.querySelector(".wk-note").textContent = "Animated illustration. The real screen may look different; the steps are the same.";
    wkGo(0, false); return;
  }
  cv.innerHTML = wkSVG(G);
  wkFitLabels(cv);
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if(cv.isConnected) wkFitLabels(cv); });
  el.querySelector(".wk-kind").textContent = {n8n:"n8n", make:"Make", zap:"Zapier", cards:"lesson steps"}[G.kind] + (it.walk && it.walk.title ? " · " + it.walk.title : "");
  el.querySelector(".wk-note").textContent = G.kind === "cards" ? "A step-by-step summary of the build in this lesson." : `A simplified picture of the canvas, not the real ${({n8n:"n8n", make:"Make", zap:"Zapier"})[G.kind]} screen. The real one looks different, but the steps, names and settings match the template.`;
  WK.camInit = false; wkGo(0, false);
}
/* Best start for a frame of `size` near `lo` so that no interval [a,b] crosses an edge; `must` stays fully inside. */
function wkSnap(lo, size, ivs, must, pad){
  const cands = [lo]; ivs.forEach(([a, b]) => { cands.push(a - pad, b + pad - size); });
  let at = lo, cut = Infinity, sc = Infinity;
  for(const c of cands){
    if(must && (must[0] < c - 0.5 || must[1] > c + size + 0.5)) continue;
    let n = 0; for(const [a, b] of ivs){ if((a < c && b > c) || (a < c + size && b > c + size)) n++; }
    const s = n * 1e6 + Math.abs(c - lo); if(s < sc){ sc = s; at = c; cut = n; }
  }
  return {at, cut: cut === Infinity ? 0 : cut};
}
function wkCam(G, keys, focus, instant, visAll){
  const svg = WK.el && WK.el.querySelector("svg"); if(!svg) return;
  const ns = keys.length ? G.nodes.filter(n => keys.includes(n.key)) : G.nodes;
  if(!ns.length) return;
  const x0 = Math.min(...ns.map(n => n.px)) - 30, y0 = Math.min(...ns.map(n => n.py)) - 44, x1 = Math.max(...ns.map(n => n.px + WK_W)) + 30, y1 = Math.max(...ns.map(n => n.py + WK_H)) + 30;
  const r = svg.getBoundingClientRect(); const A = r.width && r.height ? r.width / r.height : 1.8;
  const MAXW = A < 1 ? 430 : A < 1.4 ? 560 : 1000, MINW = A < 1.4 ? 300 : 520;
  let w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  if(w / h < A) w = h * A; else h = w / A;
  if(w > MAXW && focus){
    // too wide to show everything: frame the current node with the shown nodes it connects to, so neither is cut off
    const near = new Set([focus.key]); G.edges.forEach(e => { if(e.a === focus && keys.includes(e.b.key) && !(A < 1 && !e.ai)) near.add(e.b.key); if(e.b === focus && keys.includes(e.a.key) && (A >= 1 || e.ai || near.size < 2)) near.add(e.a.key); });
    const nb = G.nodes.filter(n => near.has(n.key));
    const bx0 = Math.min(...nb.map(n => n.px)) - 24, bx1 = Math.max(...nb.map(n => n.px + WK_W)) + 24, by0 = Math.min(...nb.map(n => n.py)) - 40, by1 = Math.max(...nb.map(n => n.py + WK_H)) + 24;
    let bw = bx1 - bx0, bh = by1 - by0; if(bw / bh < A) bw = bh * A; else bh = bw / A;
    if(bw <= MAXW * 1.35){ w = Math.max(bw, Math.min(MAXW, x1 - x0)); h = w / A; cx = (bx0 + bx1) / 2; cy = (by0 + by1) / 2; }
    else { w = MAXW; h = w / A; cx = focus.px + WK_W / 2; cy = focus.py + WK_H / 2; }
    cx = Math.min(Math.max(cx, x0 + w / 2), Math.max(x1 - w / 2, x0 + w / 2)); cy = Math.min(Math.max(cy, y0 + h / 2), Math.max(y1 - h / 2, y0 + h / 2));
  }
  if(w < MINW){ w = MINW; h = w / A; }
  // never slice a box at an edge: every visible box is either fully in frame or fully out (widen a little if that helps)
  const vis = visAll || !keys.length ? G.nodes : ns;
  if(vis.length > 1){
    const must = focus ? [[focus.px - 12, focus.px + WK_W + 12], [focus.py - 36, focus.py + WK_H + 12]] : null;
    const xs = vis.map(n => [n.px, n.px + WK_W]), ys = vis.map(n => [n.py, n.py + WK_H]);
    let best = null;
    for(const k of [1, 1.12, 1.25]){
      const ww = w * k, hh = ww / A, sx = wkSnap(cx - ww / 2, ww, xs, must && must[0], 14), sy = wkSnap(cy - hh / 2, hh, ys, must && must[1], 12);
      const cut = sx.cut + sy.cut; if(!best || cut < best.cut){ best = {cut, ww, hh, x:sx.at, y:sy.at}; } if(cut === 0) break;
    }
    w = best.ww; h = best.hh; cx = best.x + w / 2; cy = best.y + h / 2;
  }
  const to = [cx - w / 2, cy - h / 2, w, h];
  const from = (svg.getAttribute("viewBox") || "0 0 100 100").split(/\s+/).map(Number);
  const myTok = (WK.cam = (WK.cam || 0) + 1);
  if(instant || matchMedia("(prefers-reduced-motion: reduce)").matches){ svg.setAttribute("viewBox", to.join(" ")); return; }
  const t0 = performance.now(), D = 650;
  const step = now => { if(myTok !== WK.cam) return; const f = Math.min(1, (now - t0) / D), e = f < .5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
    svg.setAttribute("viewBox", from.map((v, i) => v + (to[i] - v) * e).join(" ")); if(f < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
/* On narrow (portrait) screens a big workflow is too small to read whole, so the test run's camera follows the data. */
function wkFollow(){
  const svg = WK.el && WK.el.querySelector("svg"), G = WK.g; if(!svg || !G || !G.nodes.length) return false;
  const r = svg.getBoundingClientRect(), A = r.width && r.height ? r.width / r.height : 1.8;
  const span = Math.max(...G.nodes.map(n => n.px + WK_W)) - Math.min(...G.nodes.map(n => n.px));
  return A < 1.4 ? span > 620 : span > 1150;
}
/* Shorten node titles that don't fit their box (measured, so it works for any font). The full name is in the box's tooltip. */
function wkFitLabels(root){
  $$(".wk-node", root).forEach(g => [[".wk-l", WK_W - 34], [".wk-s", WK_W - 22]].forEach(([sel, max]) => {
    const t = g.querySelector(sel); if(!t || !t.getComputedTextLength) return;
    let s = t.textContent, n = 0;
    try{ while(t.getComputedTextLength() > max && s.length > 4 && n++ < 40){ s = s.slice(0, -1).replace(/\s+$/, ""); t.textContent = s + "…"; } }catch(e){}
  }));
}
function wkNodeEl(key){ return key == null ? null : WK.el.querySelector(`.wk-node[data-k="${CSS.escape(String(key))}"]`); }
function wkResolve(at){ const G = WK.g; if(at == null) return null; return G.byKey[at] || G.byKey[String(at).toLowerCase()] || null; }
function wkGo(i, speak){
  const el = WK.el; if(!el || !el.isConnected) return wkPause();
  const S2 = WK.steps; i = Math.max(0, Math.min(S2.length - 1, i)); WK.i = i; const st = S2[i]; WK.runTok = (WK.runTok || 0) + 1;
  const G = WK.g, svg = el.querySelector("svg");
  if(G.kind === "clip"){
    wkClipShow(st);
    el.querySelector(".wk-n").textContent = st.at === "__end" ? "Done" : `Step ${i + 1} of ${S2.length}`;
    el.querySelector(".wk-say").textContent = st.say || "";
    el.querySelector(".wk-show").innerHTML = (st.show || []).filter(Boolean).map((l, j) => `<li style="animation-delay:${200 + j * 260}ms">${esc(l)}</li>`).join("");
    el.querySelector(".wk-bar i").style.width = `${((i + 1) / S2.length) * 100}%`;
    if(speak) wkSay(st.say);
    return;
  }
  // which nodes are revealed: every node referenced up to this step (plus all at the run step)
  const shown = new Set();
  if(st.at === "__run") G.nodes.forEach(n => shown.add(n.key));
  else for(let j = 0; j <= i; j++){ const n = wkResolve(S2[j].at); if(n) shown.add(n.key); }
  if(![...shown].length && G.kind !== "cards"){ /* intro: show nothing yet */ }
  const cur = st.at === "__run" ? null : wkResolve(st.at);
  $$(".wk-node", svg).forEach(g => { const k = g.dataset.k; g.classList.toggle("on", shown.has(k)); g.classList.toggle("cur", !!cur && cur.key === k); g.classList.remove("ran"); });
  G.edges.forEach(e => { const p = svg.getElementById(e.id); if(p) p.classList.toggle("on", shown.has(e.a.key) && shown.has(e.b.key)); const t = svg.querySelector(`[data-e="${e.id}"]`); if(t) t.classList.toggle("on", shown.has(e.a.key) && shown.has(e.b.key)); });
  // pointer, ripple and data chip
  const ptr = svg.querySelector(".wk-ptr"), rip = svg.querySelector(".wk-ripple"), chip = svg.querySelector(".wk-chip");
  if(cur){
    const x = cur.px + WK_W * 0.62, y = cur.py + WK_H * 0.6;
    ptr.setAttribute("opacity", "1"); ptr.style.transform = `translate(${x}px, ${y}px)`;
    rip.setAttribute("cx", x); rip.setAttribute("cy", y); rip.classList.remove("go"); void rip.getBBox(); rip.classList.add("go");
    if(st.data){ const t = chip.querySelector("text"); t.textContent = wkShort(st.data, 40); t.setAttribute("x", 10);
      const w = Math.min(320, 16 + 7.2 * t.textContent.length); chip.querySelector("rect").setAttribute("width", w);
      chip.setAttribute("transform", `translate(${Math.max(4, cur.px + WK_W / 2 - w / 2)} ${cur.py - 32})`); chip.setAttribute("opacity", "1"); }
    else chip.setAttribute("opacity", "0");
  } else { ptr.setAttribute("opacity", "0"); chip.setAttribute("opacity", "0"); }
  // panel
  el.querySelector(".wk-n").textContent = st.at === "__run" ? "Test run" : `Step ${i + 1} of ${S2.length}`;
  el.querySelector(".wk-say").textContent = st.say || "";
  el.querySelector(".wk-show").innerHTML = (st.show || []).filter(Boolean).map((l, j) => `<li style="animation-delay:${200 + j * 260}ms">${esc(l)}</li>`).join("") + (st.data && !cur ? `<li class="wk-d">${esc(st.data)}</li>` : "");
  el.querySelector(".wk-bar i").style.width = `${((i + 1) / S2.length) * 100}%`;
  if(cur){ const ne = wkNodeEl(cur.key); if(ne && ne.scrollIntoView && false) ne.scrollIntoView(); }
  wkCam(G, st.at === "__run" ? [] : [...shown], cur, WK.i === 0 && !speak && !WK.camInit);
  WK.camInit = true;
  if(st.at === "__run") wkRun();
  if(speak) wkSay(st.say);
}
function wkRun(){
  const svg = WK.el.querySelector("svg"), dot = svg.querySelector(".wk-dot"), G = WK.g;
  const order = wkOrder(G).filter(n => !G.edges.some(e => e.ai && e.a === n));
  const edges = []; order.forEach(n => G.edges.filter(e => !e.ai && e.a === n).forEach(e => edges.push(e)));
  let k = 0; const myTok = (WK.runTok = (WK.runTok || 0) + 1);
  const mark = n => { const g = wkNodeEl(n.key); if(g) g.classList.add("ran"); };
  const follow = wkFollow(), dur = follow ? 760 : 520;
  if(order[0]) mark(order[0]);
  const stepE = () => {
    if(myTok !== WK.runTok || !WK.el.isConnected) return;
    if(k >= edges.length){ dot.setAttribute("opacity", "0"); G.nodes.forEach(mark); if(follow) wkCam(G, [], null, false); return; }
    const e = edges[k++], p = svg.getElementById(e.id); if(!p){ stepE(); return; }
    if(follow) wkCam(G, [e.a.key, e.b.key], e.b, false, true);
    const L = p.getTotalLength(); const t0 = performance.now();
    dot.setAttribute("opacity", "1");
    const anim = now => { if(myTok !== WK.runTok) return; const f = Math.min(1, (now - t0) / dur); const pt = p.getPointAtLength(L * f); dot.setAttribute("cx", pt.x); dot.setAttribute("cy", pt.y);
      if(f < 1) requestAnimationFrame(anim); else { mark(e.b); setTimeout(stepE, 120); } };
    requestAnimationFrame(anim);
  };
  setTimeout(stepE, 300);
}
function wkTTS(){ const t = window.AUTOMANCY_TTS; return t && t.ready && typeof t.speak === "function" ? t : null; }
function wkTTSStop(){ try{ const t = window.AUTOMANCY_TTS; if(t && typeof t.stop === "function") t.stop(); }catch(e){} }
function wkVoiceOn(){ const c = WK.el && WK.el.querySelector('[data-wk="voice"]'); return !!(c && c.checked && (wkTTS() || window.speechSynthesis)); }
function wkSay(text){
  const myTok = ++WK.tok; clearTimeout(WK.timer);
  const rate = parseFloat(($("#lsnRate") || {}).value || "1") || 1;
  const after = () => { if(myTok !== WK.tok || !WK.playing) return; WK.timer = setTimeout(() => { if(myTok !== WK.tok || !WK.playing) return; if(WK.i < WK.steps.length - 1) wkGo(WK.i + 1, true); else wkPause(true); }, WK.steps[WK.i].at === "__run" ? Math.max(2200, WK.g.edges.length * (wkFollow() ? 900 : 680) + (wkFollow() ? 2200 : 800)) : 650); };
  WK.el.querySelector(".wk-av").classList.add("talk");
  const silent = () => { WK.timer = setTimeout(after, Math.max(2600, String(text || "").split(/\s+/).length * 360) / rate); };
  if(!wkVoiceOn() || !text){ silent(); return; }
  try{ _wkStopMain(); }catch(e){}
  const gender = WK.voice || WK.coach.g;
  const browser = () => {
    if(myTok !== WK.tok) return;
    if(!window.speechSynthesis){ silent(); return; }
    const parts = chunks(speakable(text)); let j = 0; const pv = pickVoice(gender);
  const next = () => {
    if(myTok !== WK.tok) return;
    if(j >= parts.length){ WK.el.querySelector(".wk-av").classList.remove("talk"); after(); return; }
    const u = new SpeechSynthesisUtterance(parts[j++]); if(pv.v){ u.voice = pv.v; u.lang = pv.v.lang; } u.pitch = pv.pitch; u.rate = rate;
    u.onend = next; u.onerror = next; speechSynthesis.speak(u);
  };
  next();
  };
  /* voice hook (window.AUTOMANCY_TTS): resolves when the audio ends, rejects so we fall back to the browser voice */
  const tts = wkTTS();
  if(tts){
    let p; try{ p = Promise.resolve(tts.speak(speakable(text), {voice:gender, rate})); }catch(e){ p = Promise.reject(e); }
    p.then(() => { if(myTok !== WK.tok) return; const a = WK.el && WK.el.querySelector(".wk-av"); if(a) a.classList.remove("talk"); after(); }, () => browser());
    return;
  }
  browser();
}
function wkPlay(){ if(!WK.el) return; WK.playing = true; WK.el.querySelector('[data-wk="play"]').textContent = "❚❚ Pause"; if(WK.i >= WK.steps.length - 1) wkGo(0, true); else wkGo(WK.i < 0 ? 0 : WK.i, true); }
function wkPause(done){
  WK.playing = false; WK.tok++; clearTimeout(WK.timer);
  try{ if(window.speechSynthesis) speechSynthesis.cancel(); }catch(e){}
  wkTTSStop(); WK.typeTok = (WK.typeTok || 0) + 1;
  if(WK.el){ const b = WK.el.querySelector('[data-wk="play"]'); if(b) b.textContent = done ? "↺ Play again" : "▶ Play"; const a = WK.el.querySelector(".wk-av"); if(a) a.classList.remove("talk"); }
}
/* the lesson's own Listen reader and the walkthrough never talk at once */
const _wkStopMain = stopSpeech;
stopSpeech = function(){ if(WK.playing) wkPause(); _wkStopMain(); };
/* the lesson reader and the guide's own button take over the voice: pause the walkthrough first */
document.addEventListener("click", e => { if(WK.playing && e.target.closest("#lsnPlay, [data-coachplay]")) wkPause(); }, true);
document.addEventListener("click", e => {
  const go = e.target.closest("[data-walk-go]"); if(go){ const w = document.getElementById("walk"); if(w){ w.scrollIntoView({behavior:"smooth", block:"start"}); } return; }
  const b = e.target.closest("[data-wk]"); if(!b || !WK.el || !WK.el.contains(b)) return; const a = b.dataset.wk;
  if(a === "play"){ WK.playing ? wkPause() : wkPlay(); }
  else if(a === "next"){ const p = WK.playing; wkPause(); wkGo(WK.i + 1, false); if(p) wkPlay(); }
  else if(a === "prev"){ const p = WK.playing; wkPause(); wkGo(WK.i - 1, false); if(p) wkPlay(); }
  else if(a === "restart"){ wkPause(); wkGo(0, false); }
});
document.addEventListener("change", e => {
  if(WK.el && e.target.closest(".wk-pick select")) wkLoad(+e.target.value);
  if(WK.el && e.target.matches('[data-wk="voice"]') && !e.target.checked){ try{ speechSynthesis.cancel(); }catch(x){} wkTTSStop(); if(WK.playing){ const i = WK.i; wkPause(); WK.i = i; wkPlay(); } }
});
function addWalk(el, id){
  const art = el.querySelector("article"); if(!art || art.querySelector(".wk")) return;
  const tagOf = p => ((p.querySelector(".part-h .tag") || {}).textContent || "");
  const parts = $$(".part", art);
  const host = id.startsWith("B") ? (parts.find(p => /YOUR MISSION/.test(tagOf(p)))) : parts.find(p => /^PART 4/.test(tagOf(p)));
  if(!host) return;
  // place the player right under the part heading
  const tmp = document.createElement("div"); wkMount(tmp, id, host);
  const w = tmp.querySelector(".wk"); if(!w) return;
  const head = host.querySelector(".part-h"); if(head) head.after(w); else host.prepend(w);
  WK.el = w;
}
const _enhanceLesson2 = enhanceLesson;
enhanceLesson = function(el, id){ wkPause(); WK.el = null; _enhanceLesson2(el, id); addWalk(el, id); };
/* ---- animated clips (data in src/clips.js): a generic browser window, not a node graph ---- */
function wkClipsFor(id){ try{ return (typeof CLIPS !== "undefined" && CLIPS && CLIPS[id]) || []; }catch(e){ return []; } }
function wkWho(c, clip){ const p = c.n.split(" "); return p[0] === "Nwachinemere" ? "Emeka" : (p[1] || c.n); }
function wkClipHTML(){
  return `<div class="wkc" role="img" aria-label="Animated illustration of the screen">
    <div class="wkc-top"><i></i><i></i><i></i><div class="wkc-url"><span class="wkc-u"></span></div></div>
    <div class="wkc-title"></div>
    <div class="wkc-body"><div class="wkc-blocks"></div><span class="wkc-rip"></span>
      <svg class="wkc-ptr" width="20" height="26" viewBox="-1 -1 18 26" aria-hidden="true"><path d="M0 0 L0 20 L5 15 L9 24 L13 22 L9 13 L16 13 Z"/></svg></div>
  </div>`;
}
function wkClipSplit(u){ const L = String(u.label || ""); const k = L.indexOf(": "); return u.kind === "field" && k > 0 ? [L.slice(0, k), L.slice(k + 2)] : ["", L]; }
function wkType(node, text, ms, delay){
  const myTok = WK.typeTok;
  if(!node) return;
  if(matchMedia("(prefers-reduced-motion: reduce)").matches){ node.textContent = text; return; }
  node.textContent = ""; node.classList.add("typing"); let n = 0;
  const tick = () => { if(myTok !== WK.typeTok || !node.isConnected){ node.textContent = text; node.classList.remove("typing"); return; }
    node.textContent = text.slice(0, ++n); if(n < text.length) setTimeout(tick, ms); else node.classList.remove("typing"); };
  setTimeout(tick, delay || 0);
}
function wkClipShow(st){
  const win = WK.el.querySelector(".wkc"); if(!win) return;
  const C = WK.g.clip, s = st.clip || {}, url = s.url || C.url || "";
  WK.typeTok = (WK.typeTok || 0) + 1;
  const u = win.querySelector(".wkc-u");
  if(u.dataset.url !== url){ u.dataset.url = url; wkType(u, url, 22, 0); }
  const key = (s.screen || "") + "|" + url, fresh = win.dataset.scr !== key; win.dataset.scr = key;
  const t = win.querySelector(".wkc-title"); t.textContent = s.screen || C.title;
  if(fresh){ t.classList.remove("in"); void t.offsetWidth; t.classList.add("in"); }
  const box = win.querySelector(".wkc-blocks");
  box.innerHTML = (s.ui || []).map((b, j) => { const [cap, val] = wkClipSplit(b); const k = ["button", "field", "menu", "card", "text"].includes(b.kind) ? b.kind : "card";
    return `<div class="wkc-b k-${k}${b.highlight ? " hl" : ""}${fresh ? " in" : ""}" style="${fresh ? `animation-delay:${80 + j * 90}ms` : ""}">${cap ? `<small>${esc(cap)}</small>` : ""}${k === "field" ? `<span class="wkc-in"><span class="wkc-val">${esc(val)}</span></span>` : `<span class="wkc-lab">${esc(val)}</span>`}${k === "menu" ? `<b aria-hidden="true">›</b>` : ""}</div>`; }).join("");
  const body = win.querySelector(".wkc-body"), ptr = win.querySelector(".wkc-ptr"), rip = win.querySelector(".wkc-rip");
  const hl = box.querySelector(".wkc-b.hl");
  if(!hl){ ptr.classList.remove("on"); rip.classList.remove("go"); body.scrollTop = 0; return; }
  // keep the highlighted block in view inside the window (never scroll the page)
  const top = hl.offsetTop, h = hl.offsetHeight;
  body.scrollTop = Math.max(0, Math.min(top - (body.clientHeight - h) / 2, body.scrollHeight - body.clientHeight));
  const x = hl.offsetLeft + Math.min(hl.offsetWidth * 0.72, hl.offsetWidth - 18), y = top + h * 0.55;
  ptr.classList.add("on"); ptr.style.transform = `translate(${x}px, ${y}px)`;
  rip.style.left = x + "px"; rip.style.top = y + "px"; rip.classList.remove("go"); void rip.offsetWidth; rip.classList.add("go");
  if(hl.classList.contains("k-field")){ const v = hl.querySelector(".wkc-val"); wkType(v, v.textContent, 45, 650); }
}
(function wkClipCSS(){
  if(document.getElementById("wkc-css")) return;
  const st = document.createElement("style"); st.id = "wkc-css";
  st.textContent = `
.wk-canvas.wkc-on{display:block;place-items:normal;padding:10px;background-image:none}
.wkc{width:100%;border:2px solid var(--ink);border-radius:12px;background:var(--card);overflow:hidden;display:flex;flex-direction:column;height:300px;box-shadow:3px 3px 0 var(--ink)}
@media (max-width:820px){.wkc{height:290px}}
.wkc-top{display:flex;align-items:center;gap:6px;padding:7px 9px;background:var(--paper2);border-bottom:1.5px solid var(--line);min-width:0}
.wkc-top>i{width:9px;height:9px;border-radius:50%;background:var(--line);flex:none}
.wkc-top>i:nth-child(1){background:var(--rose,#e66)}.wkc-top>i:nth-child(2){background:var(--sun,#eb5)}.wkc-top>i:nth-child(3){background:var(--volt,#6c6)}
.wkc-url{flex:1;min-width:0;margin-left:6px;background:var(--card);border:1.5px solid var(--line);border-radius:99px;padding:3px 10px;font:12px/1.3 var(--mono,monospace);color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wkc-title{padding:9px 14px 4px;font:700 1rem/1.25 var(--display,sans-serif);color:var(--ink);overflow-wrap:anywhere}
.wkc-title.in{animation:wkcin .35s ease both}
.wkc-body{position:relative;flex:1;overflow:hidden;padding:6px 14px 40px;scroll-behavior:smooth}
.wkc-blocks{display:grid;gap:8px}
.wkc-b{position:relative;border:1.5px solid var(--line);border-radius:10px;padding:8px 11px;background:var(--card);color:var(--ink);font-size:.86rem;line-height:1.3;overflow-wrap:anywhere;transition:box-shadow .35s ease,border-color .35s ease}
.wkc-b.in{animation:wkcin .35s ease both}
.wkc-b small{display:block;font-size:.72rem;color:var(--muted);margin-bottom:3px}
.wkc-b.k-button{justify-self:start;max-width:100%;border:2px solid var(--ink);border-radius:99px;background:color-mix(in srgb,var(--volt) 30%,var(--card));font-weight:700;padding:6px 16px}
.wkc-b.k-field .wkc-in{display:block;border:1.5px solid var(--line);border-radius:7px;padding:5px 8px;background:var(--paper2);font-family:var(--mono,monospace);font-size:.8rem;min-height:1.6em}
.wkc-val.typing::after{content:"";display:inline-block;width:2px;height:1em;margin-left:1px;vertical-align:-2px;background:var(--ink);animation:wkcblink .8s steps(1) infinite}
.wkc-b.k-menu{display:flex;justify-content:space-between;gap:8px;border-color:transparent;background:var(--paper2);padding:6px 11px}
.wkc-b.k-menu b{color:var(--muted)}
.wkc-b.k-card{border-width:2px;border-color:var(--ink);background:color-mix(in srgb,var(--sky,#9cf) 12%,var(--card))}
.wkc-b.k-text{border-color:transparent;padding:2px 2px;color:var(--muted);font-family:var(--mono,monospace);font-size:.78rem}
.wkc-b.hl{border-color:var(--spark,#f60);box-shadow:0 0 0 3px color-mix(in srgb,var(--spark,#f60) 35%,transparent),0 0 16px color-mix(in srgb,var(--spark,#f60) 45%,transparent)}
.wkc-ptr{position:absolute;left:0;top:0;opacity:0;pointer-events:none;transition:transform .6s cubic-bezier(.3,.7,.3,1),opacity .3s;z-index:2}
.wkc-ptr.on{opacity:1}
.wkc-ptr path{fill:var(--ink);stroke:var(--card);stroke-width:1.5}
.wkc-rip{position:absolute;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;border:3px solid var(--spark,#f60);opacity:0;pointer-events:none;z-index:1}
.wkc-rip.go{animation:wkcrip .7s ease-out .55s}
@keyframes wkcin{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes wkcrip{0%{opacity:.9;transform:scale(1)}100%{opacity:0;transform:scale(5)}}
@keyframes wkcblink{50%{opacity:0}}
@media (prefers-reduced-motion:reduce){.wkc-b.in,.wkc-title.in{animation:none}.wkc-ptr{transition:none}.wkc-rip.go{animation:none}.wkc-body{scroll-behavior:auto}}`;
  document.head.appendChild(st);
})();
window.__WK = WK; /* read-only handle for tests */
