
/* ================= ROUTER + LESSON COMPONENTS ================= */
const hub = document.getElementById("hub");
const lesson = document.getElementById("lesson");
const ORDER = [];
TRACKS.forEach(tr => { tr.mods.forEach((m,i) => ORDER.push({id:`${tr.code}.${i+1}`, t:m.t})); if(tr.boss) ORDER.push({id:`B${tr.code}`, t:tr.boss.t.replace(/^Boss \d · /,"")}); });
const tok = id => id.startsWith("B") ? "boss-" + id.slice(1) : "m-" + id.replace(".","-");
const label = id => id.startsWith("B") ? "Boss " + id.slice(1) : id;

/* Access (app mode): Base Camp is free; everything else needs the course. The server only sends the
   lesson <template>s a learner may open; locked items still show in the course map with a paywall. */
function canOpen(id){ return !APP_MODE || !!(AM.ent && AM.ent.course) || (AM.free || []).indexOf(id) >= 0; }
function lockedItem(id){ return APP_MODE && !canOpen(id); }
function lessonLinkHTML(id){
  const h = "#m-" + id.replace(".", "-");
  if(document.querySelector(`template[data-mod="${id}"]`)) return `<a class="openlesson" href="${h}">Open the full lesson →</a>`;
  if(lockedItem(id)) return `<a class="openlesson locked" href="${h}">Unlock with the full course →</a>`;
  return "";
}
function bossLinkHTML(bid, code){
  if(document.querySelector(`template[data-mod="${bid}"]`)) return `<a class="openlesson" style="--c:var(--sun);margin-top:10px" href="#boss-${code}">Enter the boss battle →</a>`;
  if(lockedItem(bid)) return `<a class="openlesson locked" style="--c:var(--sun);margin-top:10px" href="#boss-${code}">Unlock with the full course →</a>`;
  return "";
}
function paywallHTML(id){
  const it = ORDER.find(o => o.id === id); const name = id.startsWith("B") ? label(id) : "Lesson " + id;
  return `<div class="paywall"><span class="kicker2">Part of the full course</span><h2>${esc(name)} · ${esc(it ? it.t : "")}</h2>
    <p>Base Camp (lessons 0.1 to 0.6 and Boss 0) is free. This ${id.startsWith("B") ? "boss project" : "lesson"} and the rest of the course open when you enrol.</p>
    <div class="ctarow"><a class="cta" href="${esc((AM.links && AM.links.pricing) || "/pricing")}">See plans and prices</a><a class="cta alt" href="#course">Back to the course map</a></div></div>`;
}

function lessonNav(id){
  const i = ORDER.findIndex(o => o.id === id);
  const prev = ORDER[i-1], next = ORDER[i+1];
  const ready = x => x && (document.querySelector(`template[data-mod="${x.id}"]`) || lockedItem(x.id));
  const a = (x,label) => ready(x) ? `<a class="navbtn" href="#${tok(x.id)}">${label}</a>` : `<span class="navbtn" aria-disabled="true">${label}</span>`;
  return `<div class="lesson-top"><a class="navbtn" href="#course">← Course</a><div class="navgrp">${a(prev,"← "+(prev?label(prev.id):""))}${a(next,(next?label(next.id):"")+" →")}</div></div>`;
}
function lessonEnd(id){
  const i = ORDER.findIndex(o => o.id === id); const next = ORDER[i+1];
  const ch = done[id] ? "checked" : ""; const boss = id.startsWith("B");
  const last = id === "6.4";
  const head = boss ? "Boss defeated: +300 XP and a badge" : last ? "Course complete: +400 XP and the Autopilot badge" : "Finish line: +100 XP";
  const txt = last ? "Tick this when your capstone scores 80 or more on the rubric, every must-have passes, and you've presented your numbers." : boss ? "Tick this when every deliverable passes the scoring rubric at 80% or more." : "Tick this when you've done the guided build, at least the Bronze mission, and scored 4 of 5 on the quiz.";
  return `<div class="lesson-end"><div class="badge-earn"><svg viewBox="0 0 120 120"><use href="#${boss?"glitch":"bolt"}"/></svg><div><h3>${head}</h3><p>${txt}</p><label class="checkrow" style="margin-top:10px"><input type="checkbox" id="lesson-done-${id.replace('.','-')}" data-id="${id}" ${ch}> ${boss?label(id)+" defeated":"Lesson "+id+" complete"}</label></div></div>
  ${boss || last ? `<p class="note" style="margin-top:8px">Know someone who'd love this? <a href="#earn">Share your referral link.</a></p>` : ""}
  ${APP_MODE ? `<p class="note" style="margin-top:8px">Stuck? <button type="button" class="linkbtn" data-askhelp="${id}">Ask the community for help</button></p>` : ""}
  ${next ? `<p class="soon">Next: ${next.id.startsWith("B")?label(next.id):"Lesson "+next.id} · ${esc(next.t)}${document.querySelector(`template[data-mod="${next.id}"]`) ? "" : lockedItem(next.id) ? " (full course)" : ""}</p>` : ""}</div>`;
}
function route(){
  const h = location.hash.slice(1);
  stopSpeech();
  const m = h.match(/^m-(\d)-(\d+)$/) || h.match(/^boss-(\d)$/);
  if(m){
    const id = m[2] !== undefined ? `${m[1]}.${m[2]}` : `B${m[1]}`;
    const t = document.querySelector(`template[data-mod="${id}"]`);
    if(!t && lockedItem(id) && ORDER.some(o => o.id === id)){
      document.body.classList.remove("printall");
      lesson.innerHTML = lessonNav(id) + paywallHTML(id);
      hub.hidden = true; lesson.hidden = false; currentId = null;
      $$("#mainnav a").forEach(a => { if(a.dataset.nav === "course") a.setAttribute("aria-current","page"); else a.removeAttribute("aria-current"); }); closeMenu();
      window.scrollTo(0,0); document.title = `${label(id)} ${ORDER.find(o=>o.id===id).t} · Automancy Academy`;
      return;
    }
    if(t){
      document.body.classList.remove("printall");
      lesson.innerHTML = lessonNav(id) + t.innerHTML + lessonEnd(id);
      hub.hidden = true; lesson.hidden = false; currentId = id; currentIdLast = id;
      $$("#mainnav a").forEach(a => { if(a.dataset.nav === "course") a.setAttribute("aria-current","page"); else a.removeAttribute("aria-current"); }); closeMenu();
      initLesson(lesson); enhanceLesson(lesson, id); window.scrollTo(0,0);
      document.title = `${label(id)} ${ORDER.find(o=>o.id===id).t} · Automancy Academy`;
      return;
    }
  }
  if(h === "all"){
    showView("course");
    lesson.innerHTML = `<div class="lesson-top"><a class="navbtn" href="#course">← Course</a><span class="note">The whole course on one page</span></div>` +
      ORDER.map(o => document.querySelector(`template[data-mod="${o.id}"]`)).filter(Boolean).map(t => `<section class="pdfmod">${t.innerHTML}</section>`).join("");
    lesson.hidden = false; document.body.classList.add("printall");
    initLesson(lesson); lesson.querySelectorAll("details").forEach(d => d.open = true);
    document.title = "Full course · Automancy Academy"; window.scrollTo(0,0); return;
  }
  showView(h);
}
window.addEventListener("hashchange", route);

lesson.addEventListener("change", e => {
  const c = e.target;
  if(c.matches("input[type=checkbox][data-id]")){
    done[c.dataset.id] = c.checked; save(); onModuleToggle(c.dataset.id, c.checked); update();
    const mark = root.querySelector(`details[data-id="${c.dataset.id}"] .done-mark`); if(mark) mark.hidden = !c.checked;
    const hc = root.querySelector(`input[data-id="${c.dataset.id}"]`); if(hc) hc.checked = c.checked;
    return;
  }
  if(c.closest("[data-calc]")) runCalc(c.closest("[data-calc]"));
});
lesson.addEventListener("input", e => { const cc = e.target.closest("[data-calc]"); if(cc) runCalc(cc); });

lesson.addEventListener("click", e => {
  const opt = e.target.closest(".q button");
  if(opt){
    const q = opt.closest(".q"); if(q.dataset.done) return;
    q.dataset.done = "1";
    const right = opt.dataset.opt === q.dataset.ans;
    q.querySelectorAll("button").forEach(b => { if(b.dataset.opt === q.dataset.ans) b.classList.add("right"); });
    if(!right) opt.classList.add("wrong");
    const fb = q.querySelector(".fb"); fb.hidden = false;
    fb.textContent = (right ? "Correct. " : "Not quite. ") + fb.dataset.why;
    q.dataset.ok = right ? "1" : "0";
    const quiz = q.closest(".quiz"); const all = quiz.querySelectorAll(".q"); const answered = quiz.querySelectorAll(".q[data-done]");
    if(all.length === answered.length){
      const score = quiz.querySelectorAll('.q[data-ok="1"]').length;
      const out = quiz.querySelector(".qscore");
      out.textContent = `You scored ${score} of ${all.length}. ` + (score >= 4 ? "Checkpoint passed. Next module unlocked." : "Review the concept cards and try again.");
      if(score < 4){ const b = quiz.querySelector("[data-retry]"); if(b) b.hidden = false; }
      onQuizDone(quiz, score);
    }
    return;
  }
  const retry = e.target.closest("[data-retry]");
  if(retry){
    const quiz = retry.closest(".quiz");
    quiz.querySelectorAll(".q").forEach(q => { delete q.dataset.done; delete q.dataset.ok; q.querySelectorAll("button").forEach(b=>b.classList.remove("right","wrong")); const fb=q.querySelector(".fb"); fb.hidden = true; });
    quiz.querySelector(".qscore").textContent = ""; retry.hidden = true; return;
  }
  const add = e.target.closest("[data-addrow]");
  if(add){ const cc = add.closest("[data-calc]"); cc.querySelector("tbody").insertAdjacentHTML("beforeend", calcRow("",1,1,1,1)); runCalc(cc); return; }
  const cp = e.target.closest("[data-copy]");
  if(cp){
    const src = document.getElementById(cp.dataset.copy); const text = src.textContent;
    const done_ = () => { cp.textContent = "Copied"; setTimeout(()=>cp.textContent="Copy template",1500); };
    const fallback = () => { const r = document.createRange(); r.selectNodeContents(src); const s = getSelection(); s.removeAllRanges(); s.addRange(r); cp.textContent = "Selected: press copy"; };
    try{ navigator.clipboard.writeText(text).then(done_, fallback); }catch(err){ fallback(); }
  }
});

let rowSeq = 0;
function calcRow(name, per, min, err, diff){
  rowSeq++;
  const sel = (id, v, opts) => `<select id="${id}" aria-label="${id.split('-')[0]}">${opts.map(([val,l])=>`<option value="${val}" ${String(val)===String(v)?"selected":""}>${l}</option>`).join("")}</select>`;
  return `<tr><td><input id="task-${rowSeq}" type="text" value="${esc(name)}" placeholder="Task name" aria-label="Task name"></td>
  <td><input id="per-${rowSeq}" type="number" min="0" step="1" value="${per}" aria-label="Runs per week"></td>
  <td><input id="min-${rowSeq}" type="number" min="0" step="0.25" value="${min}" aria-label="Minutes per run"></td>
  <td>${sel("err-"+rowSeq, err, [[1,"Low ×1"],[1.5,"Medium ×1.5"],[2,"High ×2"]])}</td>
  <td>${sel("diff-"+rowSeq, diff, [[1,"Easy ÷1"],[2,"Medium ÷2"],[3,"Hard ÷3"]])}</td>
  <td class="out" data-w>–</td><td class="out" data-p>–</td></tr>`;
}
function runCalc(cc){
  const rows = [...cc.querySelectorAll("tbody tr")];
  const scored = rows.map(r => {
    const [name, per, min] = [...r.querySelectorAll("input")].map(i => i.value);
    const [err, diff] = [...r.querySelectorAll("select")].map(s => parseFloat(s.value));
    const w = (parseFloat(per)||0) * (parseFloat(min)||0) * err;
    const p = w / diff;
    r.querySelector("[data-w]").textContent = Math.round(w).toLocaleString();
    r.querySelector("[data-p]").textContent = Math.round(p).toLocaleString();
    return {name: name || "(unnamed task)", p, r};
  }).sort((a,b) => b.p - a.p);
  rows.forEach(r => r.querySelector("[data-p]").classList.remove("top"));
  scored.slice(0,3).forEach(s => s.r.querySelector("[data-p]").classList.add("top"));
  cc.querySelector(".rank").innerHTML = scored.map(s => `<li>${esc(s.name)} · <b>${Math.round(s.p).toLocaleString()}</b></li>`).join("");
}
function initLesson(el){
  el.querySelectorAll("[data-calc]").forEach(cc => {
    const tb = cc.querySelector("tbody");
    tb.innerHTML = JSON.parse(cc.dataset.calc).map(r => calcRow(...r)).join("");
    runCalc(cc);
  });
}

/* URL dissector */
function runDissect(box){
  const out = box.querySelector("[data-out]"); const v = box.querySelector("input").value.trim();
  let u; try{ u = new URL(v); }catch(e){ out.innerHTML = `<p class="err">That isn't a complete URL yet. It needs to start with https://</p>`; return; }
  const parts = [["Scheme", u.protocol+"//", "#FFD37A"],["Host (server)", u.host, "#9FD3F7"],["Path (endpoint)", u.pathname, "#8FE0B5"]];
  const params = [...u.searchParams.entries()];
  let html = `<div class="urlparts">${parts.map(([l,t,c])=>`<span style="--pc:${c}"><i>${l}</i>${esc(t)}</span>`).join("")}${params.length?`<span style="--pc:#FFC59E"><i>Query starts</i>?</span>`:""}${params.map(([k,val],i)=>`<span style="--pc:#C9BBFF"><i>Param ${i+1}</i>${esc(k)}=${esc(val)}</span>`).join("")}</div>`;
  if(params.length) html += `<div class="tablewrap"><table class="dt" style="min-width:0"><thead><tr><th>Parameter</th><th>Value</th></tr></thead><tbody>${params.map(([k,val])=>`<tr><td>${esc(k)}</td><td>${esc(val)}</td></tr>`).join("")}</tbody></table></div>`;
  out.innerHTML = html;
}
lesson.addEventListener("input", e => { const d = e.target.closest("[data-dissect]"); if(d) runDissect(d); });
const _initLesson = initLesson;
initLesson = function(el){ _initLesson(el); el.querySelectorAll("[data-dissect]").forEach(runDissect); };

/* JSON lab */
function jsonPath(obj, path){
  const toks = []; path.replace(/\[(\d+)\]|([^.[\]]+)/g, (m, idx, key) => { toks.push(idx !== undefined ? Number(idx) : key); });
  let cur = obj;
  for(const t of toks){
    if(cur === null || cur === undefined) return {miss:true, at:t};
    if(typeof t === "number" && !Array.isArray(cur)) return {miss:true, at:`[${t}] (not a list here)`};
    if(!(t in Object(cur))) return {miss:true, at: typeof t === "number" ? `[${t}] (this list has ${cur.length} items: [0] to [${cur.length-1}])` : t};
    cur = cur[t];
  }
  return {val:cur};
}
function typeName(v){ return v === null ? "null" : Array.isArray(v) ? "array" : typeof v === "object" ? "object" : typeof v; }
function runJsonLab(box){
  const ta = box.querySelector("textarea"), inp = box.querySelector("input"), st = box.querySelector(".jl-status"), out = box.querySelector(".jl-out");
  let data;
  try{ data = JSON.parse(ta.value); st.className = "jl-status jl-ok"; st.textContent = "Valid JSON ✓"; }
  catch(e){ st.className = "jl-status jl-bad"; st.textContent = "Not valid JSON: " + e.message; out.textContent = "Fix the JSON first."; return; }
  const p = inp.value.trim();
  if(!p){ out.innerHTML = `<span class="t">object</span>\n` + esc(JSON.stringify(data, null, 2)).slice(0, 400); return; }
  const r = jsonPath(data, p);
  if(r.miss){ out.innerHTML = `Nothing found. The path stops working at: <span class="t">${esc(String(r.at))}</span>`; return; }
  out.innerHTML = `<span class="t">${typeName(r.val)}</span>\n` + esc(JSON.stringify(r.val, null, 2));
}
lesson.addEventListener("input", e => { const j = e.target.closest("[data-jsonlab]"); if(j) runJsonLab(j); });
lesson.addEventListener("click", e => {
  const chip = e.target.closest(".pathchips button"); if(!chip) return;
  const j = chip.closest("[data-jsonlab]"); j.querySelector("input").value = chip.dataset.p; runJsonLab(j);
});
const _initLesson2 = initLesson;
initLesson = function(el){ _initLesson2(el); el.querySelectorAll("[data-jsonlab]").forEach(runJsonLab); };

/* Lookup lab */
function runLookup(box){
  const cfg = JSON.parse(box.dataset.lookup);
  const ord = cfg.orders[box.querySelector("select").selectedIndex];
  const mode = box.querySelector("input[type=radio]:checked").value;
  const truth = cfg.customers.find(c => c.id === ord.customer_id);
  const found = mode === "id" ? cfg.customers.find(c => c.id === ord.customer_id) : cfg.customers.find(c => c.name === ord.customer_name);
  const formula = mode === "id" ? `=XLOOKUP("${ord.customer_id}", Customers!A:A, Customers!D:D)` : `=XLOOKUP("${ord.customer_name}", Customers!B:B, Customers!D:D)`;
  const right = found && found.id === truth.id;
  const out = box.querySelector(".res-out");
  out.className = "res-out " + (right ? "ok" : "no");
  out.innerHTML = `<code>${esc(formula)}</code><span>Delivery goes to: <b>${esc(found ? found.area : "not found")}</b></span><span>${right ? "Correct customer. IDs are unique, so there's only one possible match." : `Wrong! This order belongs to ${esc(truth.name)} in ${esc(truth.area)}. The lookup stopped at the first "${esc(ord.customer_name)}" it found.`}</span>`;
}
lesson.addEventListener("change", e => { const l = e.target.closest("[data-lookup]"); if(l) runLookup(l); });
const _initLesson3 = initLesson;
initLesson = function(el){ _initLesson3(el); el.querySelectorAll("[data-lookup]").forEach(runLookup); };

/* Token & cost estimator */
function runTok(box){
  const v = id => parseFloat(box.querySelector(`[data-f="${id}"]`).value) || 0;
  const text = box.querySelector("textarea").value;
  const inTok = Math.ceil(text.length / 4);
  const outTok = v("out"), n = v("n"), pin = v("pin"), pout = v("pout"), fx = v("fx");
  const per = inTok * pin / 1e6 + outTok * pout / 1e6;
  const month = per * n;
  const f = (x, d) => x.toLocaleString(undefined, {minimumFractionDigits:d, maximumFractionDigits:d});
  box.querySelector("[data-o='tok']").textContent = f(inTok,0);
  box.querySelector("[data-o='per']").textContent = "$" + f(per, 5);
  box.querySelector("[data-o='month']").textContent = "$" + f(month, 2);
  box.querySelector("[data-o='ngn']").textContent = "≈ ₦" + f(month * fx, 0) + " a month";
}
lesson.addEventListener("input", e => { const t = e.target.closest("[data-tok]"); if(t) runTok(t); });
const _initLesson4 = initLesson;
initLesson = function(el){ _initLesson4(el); el.querySelectorAll("[data-tok]").forEach(runTok); };

/* Safe-or-risky sorter */
lesson.addEventListener("click", e => {
  const b = e.target.closest(".sitem button"); if(!b) return;
  const it = b.closest(".sitem"); if(it.dataset.done) return; it.dataset.done = "1";
  const ok = b.dataset.v === it.dataset.ans;
  it.classList.add(ok ? "right" : "wrong");
  const w = it.querySelector(".why"); w.hidden = false; w.textContent = (ok ? "Right. " : "Not quite. ") + w.dataset.t;
  const s = it.closest(".sorter"); const all = s.querySelectorAll(".sitem"), done = s.querySelectorAll(".sitem[data-done]");
  if(all.length === done.length) s.querySelector(".sscore").textContent = `You sorted ${s.querySelectorAll(".sitem.right").length} of ${all.length} correctly.`;
});

/* Route tester */
function testCond(c, d){
  const x = d[c.f];
  switch(c.op){
    case ">": return Number(x) > c.v; case "<=": return Number(x) <= c.v;
    case "in": return c.v.includes(x); case "notin": return !c.v.includes(x);
    case "is": return x === c.v; case "notis": return x !== c.v;
  }
  return false;
}
function runRouter(box){
  const cfg = JSON.parse(box.dataset.route);
  const d = {};
  box.querySelectorAll("[data-k]").forEach(i => d[i.dataset.k] = i.type === "number" ? Number(i.value) : i.value);
  box.querySelectorAll(".design").forEach((el, di) => {
    const des = cfg.designs[di];
    let html = `<h5>${esc(des.name)}</h5>`;
    if(des.gate && !des.gate.every(c => testCond(c, d))){ el.innerHTML = html + `<div class="pathrow run"><span>${esc(des.gateName || "Filter before the router")}</span><span>STOPPED</span></div><p class="verdict">The bundle stops here. No route runs, and no credits are used after the filter. ✓</p>`; return; }
    const hits = des.paths.map(p => (p.all || []).every(c => testCond(c, d)) && (!p.any || p.any.some(c => testCond(c, d))));
    const any = hits.some(Boolean);
    des.paths.forEach((p,i) => html += `<div class="pathrow ${hits[i]?"run":""}"><span>${esc(p.name)}</span><span>${hits[i]?"RUNS":"skipped"}</span></div>`);
    if(des.fallback) html += `<div class="pathrow ${!any?"run":""}"><span>${esc(des.fallback)} (fallback)</span><span>${!any?"RUNS":"skipped"}</span></div>`;
    const n = hits.filter(Boolean).length + (des.fallback && !any ? 1 : 0);
    if(des.multiOk) html += `<p class="verdict ${n===0?"bad":""}">${n===0 ? "Nothing runs. This order is silently dropped!" : `${n} route${n>1?"s":""} run${n>1?"":"s"}. Here that's intended: each route is an independent rule. ✓`}</p>`;
    else html += `<p class="verdict ${n===1?"":"bad"}">${n===1 ? "Exactly one branch runs. ✓" : n===0 ? "Nothing runs. This order is silently dropped!" : `${n} branches run. Tolu gets duplicate alerts and double work.`}</p>`;
    el.innerHTML = html;
  });
}
lesson.addEventListener("input", e => { const r = e.target.closest("[data-route]"); if(r) runRouter(r); });
lesson.addEventListener("change", e => { const r = e.target.closest("[data-route]"); if(r) runRouter(r); });
const _initLesson5 = initLesson;
initLesson = function(el){ _initLesson5(el); el.querySelectorAll("[data-route]").forEach(runRouter); };

/* Webhook payload tester: mirrors the Code step in Module 1.4 */
function hlValidate(raw, secret){
  let order;
  try{ order = JSON.parse(raw); }catch(e){ return {valid:false, errors:"body is not valid JSON: " + e.message}; }
  const errors = [];
  if(order.token !== secret) errors.push("wrong or missing token");
  if(!order.customer || !order.customer.phone) errors.push("missing phone");
  if(!Array.isArray(order.items) || order.items.length === 0) errors.push("no items");
  let items_total = 0;
  const line_items = (Array.isArray(order.items) ? order.items : []).map((it, i) => {
    const qty = Number(it.qty), unit_price = Number(it.unit_price);
    if(!Number.isFinite(qty) || qty <= 0) errors.push(`item ${i+1}: bad qty`);
    if(!Number.isFinite(unit_price) || unit_price <= 0) errors.push(`item ${i+1}: bad price`);
    const line_total = qty * unit_price; items_total += line_total;
    return {sku: it.sku, qty, unit_price, line_total};
  });
  const delivery_fee = Number(order.delivery_fee) || 0;
  const total = items_total + delivery_fee;
  if(order.total !== undefined && Number(order.total) !== total) errors.push(`total mismatch: sent ${order.total}, calculated ${total}`);
  return {order_id: order.order_id || null, valid: errors.length === 0, errors: errors.join("; "), items_total, delivery_fee, total, item_count: line_items.length, line_items};
}
function runHook(box){
  const out = hlValidate(box.querySelector("textarea").value, box.dataset.secret);
  const st = box.querySelector(".jl-status");
  st.className = "jl-status " + (out.valid ? "jl-ok" : "jl-bad");
  st.textContent = out.valid ? "valid: true → the order is saved" : "valid: false → Tolu gets an alert: " + out.errors;
  box.querySelector(".jl-out").innerHTML = `<span class="t">output</span>\n` + esc(JSON.stringify(out, null, 2));
}
lesson.addEventListener("input", e => { const h = e.target.closest("[data-hooktest]"); if(h) runHook(h); });
lesson.addEventListener("click", e => {
  const b = e.target.closest("[data-sample]"); if(!b) return;
  const h = b.closest("[data-hooktest]"); h.querySelector("textarea").value = document.getElementById(b.dataset.sample).textContent.trim(); runHook(h);
});
const _initLesson6 = initLesson;
initLesson = function(el){ _initLesson6(el); el.querySelectorAll("[data-hooktest]").forEach(runHook); };

/* Platform volume & cost calculator (Module 1.6) */
function runPlat(box){
  const v = k => parseFloat(box.querySelector(`[data-p="${k}"]`).value) || 0;
  const runs = v("runs");
  const rows = [
    ["Zapier", "tasks", runs * v("zt"), v("zp")],
    ["Make", "credits", runs * v("mo"), v("mp")],
    ["n8n Cloud", "executions", runs * v("ne"), v("np")]
  ];
  const f = x => Math.round(x).toLocaleString();
  let html = rows.map(([n, u, q, p]) => `<div class="stat"><b>${f(q)}</b><span>${u} a month on ${n}${p ? ` · ≈ $${f(q / 1000 * p)} at $${p} per 1,000` : ""}</span></div>`).join("");
  const vps = v("vps");
  html += `<div class="stat"><b>${vps ? "$" + f(vps) : "–"}</b><span>n8n self-hosted: a fixed server cost, whatever the volume (plus your time to run it)</span></div>`;
  box.querySelector(".stats").innerHTML = html;
}
lesson.addEventListener("input", e => { const p = e.target.closest("[data-plat]"); if(p) runPlat(p); });
const _initLesson7 = initLesson;
initLesson = function(el){ _initLesson7(el); el.querySelectorAll("[data-plat]").forEach(runPlat); };

/* Make credit estimator (Module 2.1) */
function runCredits(box){
  const v = k => parseFloat(box.querySelector(`[data-c="${k}"]`).value) || 0;
  const checksPerDay = v("interval") > 0 ? (v("hours") * 60) / v("interval") : 0;
  const trig = box.querySelector("[data-c='instant']").checked ? 0 : Math.ceil(checksPerDay) * 30;
  const work = v("bundles") * v("modules") * 30;
  const total = trig + work;
  const f = x => Math.round(x).toLocaleString();
  box.querySelector("[data-o='trig']").textContent = f(trig);
  box.querySelector("[data-o='work']").textContent = f(work);
  box.querySelector("[data-o='total']").textContent = f(total);
  box.querySelector("[data-o='verdict']").textContent = total <= 1000 ? "Fits the Free plan's 1,000 credits a month." : `About ${f(total)} credits a month: more than the Free plan's 1,000.`;
}
lesson.addEventListener("input", e => { const c = e.target.closest("[data-credits]"); if(c) runCredits(c); });
lesson.addEventListener("change", e => { const c = e.target.closest("[data-credits]"); if(c) runCredits(c); });
const _initLesson8 = initLesson;
initLesson = function(el){ _initLesson8(el); el.querySelectorAll("[data-credits]").forEach(runCredits); };

/* Make function playground (Module 2.2) — JS equivalents of the Make formulas shown */
const FN_RECIPES = {
  phone: {label:"Clean a Nigerian phone number", input:"0803 123 4567",
    formula:'if(substring(D; 0; 1) = "0"; "+234" + substring(D; 1; length(D)); "+" + D)\n  where D = replace(1.phone; /[^0-9]/g; emptystring)',
    run: x => { const d = x.replace(/[^0-9]/g, ""); if(!d) return "(empty)"; return d[0] === "0" ? "+234" + d.slice(1) : d.startsWith("234") ? "+" + d : "+234" + d; }},
  name: {label:"Tidy a name", input:"  mrs ADEBAYO ",
    formula:'startcase(lower(trim(1.name)))',
    run: x => x.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase())},
  first: {label:"First name from a full name", input:"Tunde Bakare",
    formula:'get(split(trim(1.name); " "); 1)',
    run: x => x.trim().split(/\s+/)[0] || "(empty)"},
  money: {label:"Show money for people", input:"26500",
    formula:'₦{{formatNumber(1.total; 0; "."; ",")}}',
    run: x => { const n = Number(String(x).replace(/[^0-9.]/g, "")); return isFinite(n) && String(x).trim() !== "" ? "₦" + Math.round(n).toLocaleString("en-US") : "(not a number)"; }},
  parse: {label:"Turn '₦12,500' back into a number", input:"₦12,500",
    formula:'parseNumber(replace(replace(1.price; "₦"; emptystring); ","; emptystring))',
    run: x => { const n = Number(String(x).replace(/₦/g, "").replace(/,/g, "").trim()); return isFinite(n) && String(x).trim() !== "" ? String(n) + "   (a number now)" : "(not a number)"; }},
  delivery: {label:"Next-day delivery, skipping Sunday", input:"2026-10-10",
    formula:'if(formatDate(addDays(1.order_date; 1); "d") = 0;\n   formatDate(addDays(1.order_date; 2); "dddd D MMM");\n   formatDate(addDays(1.order_date; 1); "dddd D MMM"))',
    run: x => { const d = new Date(x + "T12:00:00"); if(isNaN(d)) return "(use YYYY-MM-DD)"; d.setDate(d.getDate() + 1); if(d.getDay() === 0) d.setDate(d.getDate() + 1); return d.toLocaleDateString("en-GB", {weekday:"long", day:"numeric", month:"short"}); }},
  empty: {label:"A safe default for a blank field", input:"",
    formula:'ifempty(1.area; "Area not given")',
    run: x => x.trim() === "" ? "Area not given" : x}
};
function runFn(box){
  const r = FN_RECIPES[box.querySelector("select").value];
  const inp = box.querySelector("input");
  if(box.dataset.cur !== box.querySelector("select").value){ inp.value = r.input; box.dataset.cur = box.querySelector("select").value; }
  box.querySelector("[data-o='formula']").textContent = r.formula;
  box.querySelector("[data-o='result']").textContent = r.run(inp.value);
}
lesson.addEventListener("input", e => { const f = e.target.closest("[data-fnlab]"); if(f) runFn(f); });
lesson.addEventListener("change", e => { const f = e.target.closest("[data-fnlab]"); if(f) runFn(f); });
const _initLesson9 = initLesson;
initLesson = function(el){ _initLesson9(el); el.querySelectorAll("[data-fnlab]").forEach(box => { box.querySelector("select").innerHTML = Object.entries(FN_RECIPES).map(([k,r]) => `<option value="${k}">${esc(r.label)}</option>`).join(""); runFn(box); }); };

/* Bundle machine: iterator + aggregators (Module 2.4) */
function runBundles(box){
  const out = box.querySelector("[data-o='bundles']"), agg = box.querySelector("[data-o='agg']"), st = box.querySelector(".jl-status");
  let items;
  try{ items = JSON.parse(box.querySelector("textarea").value); }catch(e){ st.className = "jl-status jl-bad"; st.textContent = "Not valid JSON: " + e.message; out.innerHTML = ""; agg.textContent = ""; return; }
  if(!Array.isArray(items)){ st.className = "jl-status jl-bad"; st.textContent = "The Iterator needs an array [ … ]. This is one object, so it would pass through as 1 bundle."; out.innerHTML = ""; agg.textContent = ""; return; }
  st.className = "jl-status jl-ok"; st.textContent = `Iterator: 1 bundle in → ${items.length} bundle${items.length===1?"":"s"} out`;
  out.innerHTML = items.map((it,i) => `<span class="chip" style="background:var(--sun);color:#13233A;border-color:var(--ink)">bundle ${i+1}: ${esc(it.qty)}× ${esc(it.name || it.sku)}</span>`).join(" ");
  const lines = items.map(it => `${it.qty}× ${it.name || it.sku} · ₦${(Number(it.qty) * Number(it.unit_price) || 0).toLocaleString("en-US")}`);
  const sum = items.reduce((s, it) => s + (Number(it.qty) * Number(it.unit_price) || 0), 0);
  const bad = items.filter(it => !isFinite(Number(it.qty)) || !isFinite(Number(it.unit_price)) || it.unit_price === undefined).length;
  agg.textContent = `TEXT AGGREGATOR → 1 bundle:\n${lines.join("\n")}\n\nNUMERIC AGGREGATOR (SUM of qty × unit_price) → 1 bundle:\n₦${sum.toLocaleString("en-US")}` + (bad ? `\n\n⚠ ${bad} item(s) have a price or qty that isn't a number, so they add 0.` : "");
}
lesson.addEventListener("input", e => { const b = e.target.closest("[data-bundle]"); if(b) runBundles(b); });
const _initLesson10 = initLesson;
initLesson = function(el){ _initLesson10(el); el.querySelectorAll("[data-bundle]").forEach(runBundles); };

/* Duplicate-webhook simulator (Module 2.5) */
function runDedupe(box){
  const events = JSON.parse(box.dataset.dedupe);
  const on = box.querySelector("input[type=checkbox]").checked;
  const seen = new Set(); let receipts = 0, naira = 0;
  const rows = events.map((ev, i) => {
    const dup = seen.has(ev.ref);
    let action;
    if(on && dup){ action = "Skipped (reference already in data store)"; }
    else { action = "Marked Paid · receipt sent"; receipts++; naira += ev.amount / 100; }
    seen.add(ev.ref);
    return `<tr class="${!on && dup ? "dupe" : ""}"><td>${i+1}</td><td>${esc(ev.time)}</td><td>${esc(ev.ref)}</td><td class="n">₦${(ev.amount/100).toLocaleString("en-US")}</td><td>${action}${!on && dup ? " <b style='color:var(--glitch)'>(duplicate!)</b>" : ""}</td></tr>`;
  }).join("");
  box.querySelector("tbody").innerHTML = rows;
  const real = [...new Set(events.map(e => e.ref))].length;
  box.querySelector("[data-o='sum']").textContent = `${receipts} receipts sent for ${real} real payments · payments counted: ₦${naira.toLocaleString("en-US")}`;
}
lesson.addEventListener("change", e => { const d = e.target.closest("[data-dedupe]"); if(d) runDedupe(d); });
const _initLesson11 = initLesson;
initLesson = function(el){ _initLesson11(el); el.querySelectorAll("[data-dedupe]").forEach(runDedupe); };

/* AI invoice checker (Module 2.7) — the validation rules that run after the AI */
function runInv(box){
  const st = box.querySelector(".jl-status"), out = box.querySelector(".jl-out");
  let inv; try{ inv = JSON.parse(box.querySelector("textarea").value); }catch(e){ st.className="jl-status jl-bad"; st.textContent="The AI's answer isn't valid JSON → send to review: " + e.message; out.textContent=""; return; }
  const issues = [], checks = [];
  ["supplier","invoice_number","invoice_date","total"].forEach(k => { if(inv[k] === null || inv[k] === undefined || inv[k] === "") issues.push(`missing ${k}`); });
  if(inv.invoice_date && !/^\d{4}-\d{2}-\d{2}$/.test(inv.invoice_date)) issues.push("invoice_date is not YYYY-MM-DD");
  const lines = Array.isArray(inv.lines) ? inv.lines : [];
  if(!lines.length) issues.push("no line items");
  let sum = 0;
  lines.forEach((l, i) => { const q = Number(l.qty), p = Number(l.unit_price), t = Number(l.line_total);
    if(![q,p,t].every(isFinite)) { issues.push(`line ${i+1}: a number is missing or not a number`); return; }
    if(Math.abs(q * p - t) > 1) issues.push(`line ${i+1}: ${q} × ${p} = ${q*p}, but line_total says ${t}`);
    sum += t; });
  checks.push(`Lines add up to ${sum.toLocaleString("en-US")}`);
  const sub = Number(inv.subtotal), vat = Number(inv.vat || 0), tot = Number(inv.total);
  if(isFinite(sub) && Math.abs(sum - sub) > 1) issues.push(`lines total ${sum.toLocaleString("en-US")} ≠ subtotal ${sub.toLocaleString("en-US")}`);
  if(isFinite(sub) && isFinite(tot) && Math.abs(sub + vat - tot) > 1) issues.push(`subtotal + VAT = ${(sub+vat).toLocaleString("en-US")} ≠ total ${tot.toLocaleString("en-US")}`);
  if(isFinite(sub) && vat && Math.abs(vat - sub * 0.075) > 1) checks.push(`Note: VAT is not 7.5% of subtotal (expected ${(sub*0.075).toLocaleString("en-US")}); check the invoice`);
  st.className = "jl-status " + (issues.length ? "jl-bad" : "jl-ok");
  st.textContent = issues.length ? `Route: NEEDS REVIEW (${issues.length} problem${issues.length>1?"s":""})` : "Route: AUTO-SAVE ✓ all checks passed";
  out.textContent = (issues.length ? issues.map(x => "✗ " + x).join("\n") + "\n" : "") + checks.map(x => "• " + x).join("\n");
}
lesson.addEventListener("input", e => { const b = e.target.closest("[data-invcheck]"); if(b) runInv(b); });
lesson.addEventListener("click", e => {
  const b = e.target.closest("[data-invsample]"); if(!b) return;
  const box = b.closest("[data-invcheck]"); box.querySelector("textarea").value = document.getElementById(b.dataset.invsample).textContent.trim(); runInv(box);
});
const _initLesson12 = initLesson;
initLesson = function(el){ _initLesson12(el); el.querySelectorAll("[data-invcheck]").forEach(runInv); };

/* Docker command builder (Module 3.1) */
function runDock(box){
  const g = k => box.querySelector(`[data-d="${k}"]`);
  const tz = g("tz").value, portRaw = g("port").value.trim(), vol = g("vol").checked, rm = g("rm").checked, one = g("one").checked;
  const portOk = /^\d{2,5}$/.test(portRaw) && +portRaw > 0 && +portRaw < 65536;
  const port = portOk ? portRaw : "5678";
  const parts = ["docker run -it" + (rm ? " --rm" : ""), "--name n8n", `-p ${port}:5678`];
  if(tz) parts.push(`-e GENERIC_TIMEZONE="${tz}"`, `-e TZ="${tz}"`);
  parts.push("-e N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true", "-e N8N_RUNNERS_ENABLED=true");
  if(vol) parts.push("-v n8n_data:/home/node/.n8n");
  parts.push("n8nio/n8n");
  let cmd = (vol ? "docker volume create n8n_data\n\n" : "") + (one ? parts.join(" ") : parts.join(" \\\n  "));
  box.querySelector("[data-o='cmd']").textContent = cmd;
  const notes = [];
  if(!vol && rm) notes.push(["bad", "Danger: no volume and --rm. When this container stops, every workflow, credential and execution is deleted. Tick the volume."]);
  else if(!vol) notes.push(["bad", "Risky: your data lives only inside this container. Remove or recreate it and everything is gone. Tick the volume."]);
  else notes.push(["ok", "Your data lives in the n8n_data volume, so it survives restarts, upgrades and --rm."]);
  if(!tz) notes.push(["bad", "No timezone: schedule nodes use n8n's default, America/New_York. A 06:30 trigger would fire at about 11:30 or 12:30 in Lagos, depending on US daylight saving."]);
  else notes.push(["ok", `Schedules run on ${tz} time.`]);
  if(!portOk) notes.push(["bad", `"${portRaw}" isn't a valid port, so 5678 is used.`]);
  notes.push(["ok", `When the log says the editor is ready, open http://localhost:${port}`]);
  if(!one) notes.push(["tip", "The backslashes continue the command over several lines on Mac, Linux and WSL. In Windows PowerShell, tick “one line”."]);
  box.querySelector("[data-o='notes']").innerHTML = notes.map(([k, t]) => `<li class="${k}">${esc(t)}</li>`).join("");
}
lesson.addEventListener("input", e => { const d = e.target.closest("[data-dock]"); if(d) runDock(d); });
lesson.addEventListener("change", e => { const d = e.target.closest("[data-dock]"); if(d) runDock(d); });
const _initLesson13 = initLesson;
initLesson = function(el){ _initLesson13(el); el.querySelectorAll("[data-dock]").forEach(runDock); };

/* n8n expression simulator (Module 3.2) — a safe mini-evaluator for the item-reference patterns taught */
function exprEval(src, cfg, i){
  src = src.trim();
  if(src === "$itemIndex") return {v:i};
  const s = src.replace(/^\$json\b/, "$input.item.json");
  const m = s.match(/^\$(?:input|\(\s*['"]([^'"]+)['"]\s*\))\.(item|first\(\)|last\(\)|all\(\)\[(\d+)\])\.json((?:\.[A-Za-z_]\w*|\[\d+\])*)\s*((?:\.\w+\([^)]*\))?)$/);
  if(!m) return {err:"This simulator understands $json…, $input…, $('Node').item / .first() / .last() / .all()[n], then .json.field"};
  const name = m[1] || cfg.input;
  const list = cfg.nodes[name];
  if(!list) return {err:`Referenced node "${name}" doesn't exist`};
  let it;
  if(m[2] === "item") it = list[i];
  else if(m[2] === "first()") it = list[0];
  else if(m[2] === "last()") it = list[list.length - 1];
  else it = list[Number(m[3])];
  if(!it) return {v:undefined};
  let v = it;
  const p = m[4].replace(/^\./, "");
  if(p){ const r = jsonPath(it, p); v = r.miss ? undefined : r.val; }
  const meth = m[5];
  if(meth && v !== undefined){
    const mm = meth.match(/^\.(\w+)\(([^)]*)\)$/); const fn = mm[1], arg = mm[2].trim().replace(/^['"]|['"]$/g, "");
    if(fn === "toUpperCase" && typeof v === "string") v = v.toUpperCase();
    else if(fn === "toLowerCase" && typeof v === "string") v = v.toLowerCase();
    else if(fn === "trim" && typeof v === "string") v = v.trim();
    else if(fn === "toLocaleString" && typeof v === "number") v = v.toLocaleString(arg || "en-NG");
    else return {err:`.${fn}() isn't available on this value in the simulator`};
  }
  return {v};
}
function exprShow(v){
  if(v === undefined || v === null) return {t:"", empty:true};
  if(typeof v === "object") return {t:`[Object: ${JSON.stringify(v)}]`, obj:true};
  return {t:String(v)};
}
function runExpr(box){
  const cfg = JSON.parse(box.dataset.expr);
  const tpl = box.querySelector("textarea").value;
  const n = cfg.nodes[cfg.input].length;
  let html = "";
  for(let i = 0; i < n; i++){
    let out = "", warn = [];
    tpl.split(/(\{\{[\s\S]*?\}\})/).forEach(part => {
      const mm = part.match(/^\{\{([\s\S]*)\}\}$/);
      if(!mm){ out += esc(part); return; }
      const r = exprEval(mm[1], cfg, i);
      if(r.err){ out += `<mark class="xerr">[ERROR: ${esc(r.err)}]</mark>`; warn.push("error"); return; }
      const s = exprShow(r.v);
      if(s.empty){ out += `<mark class="xerr">⟨empty⟩</mark>`; warn.push("empty"); }
      else if(s.obj){ out += `<mark class="xerr">${esc(s.t)}</mark>`; warn.push("object"); }
      else out += `<mark>${esc(s.t)}</mark>`;
    });
    const exp = cfg.expect[i];
    const ok = exp.every(x => out.includes(esc(x))) && !warn.length;
    html += `<div class="xitem ${ok ? "ok" : "no"}"><span class="xn">item ${i}</span><p>${out}</p><span class="xv">${ok ? esc(cfg.okText || "✓ right customer, right order") : warn.length ? "✗ fix the highlighted part" : esc(cfg.badText || "✗ this message has someone else's details") + " (expected " + esc(exp.join(", ")) + ")"}</span></div>`;
  }
  box.querySelector(".xout").innerHTML = html;
}
lesson.addEventListener("input", e => { const x = e.target.closest("[data-expr]"); if(x) runExpr(x); });
lesson.addEventListener("click", e => {
  const b = e.target.closest("[data-xtpl]"); if(!b) return;
  const x = b.closest("[data-expr]"); x.querySelector("textarea").value = document.getElementById(b.dataset.xtpl).textContent.trim(); runExpr(x);
});
const _initLesson14 = initLesson;
initLesson = function(el){ _initLesson14(el); el.querySelectorAll("[data-expr]").forEach(runExpr); };

/* n8n Merge simulator (Module 3.3) */
function runMerge(box){
  const cfg = JSON.parse(box.dataset.merge);
  const renamed = box.querySelector("[data-m='glitch']").checked;
  const in1 = cfg.in1;
  const in2 = cfg.in2.map(r => renamed ? Object.fromEntries(Object.entries(r).map(([k, v]) => [k === "customer_id" ? "customerId" : k, v])) : r);
  const f1 = box.querySelector("[data-m='f1']").value, f2 = box.querySelector("[data-m='f2']").value, mode = box.querySelector("[data-m='mode']").value;
  const match = (a, b) => a[f1] !== undefined && b[f2] !== undefined && String(a[f1]) === String(b[f2]);
  let out = [];
  if(mode === "append") out = [...in1.map(r => ({...r, _from:"1"})), ...in2.map(r => ({...r, _from:"2"}))];
  else {
    const m1 = in1.map(a => in2.filter(b => match(a, b)));
    const used2 = new Set(); in2.forEach((b, j) => { if(in1.some(a => match(a, b))) used2.add(j); });
    const merged = []; in1.forEach((a, i) => m1[i].forEach(b => merged.push({...a, ...b, _from:"1+2"})));
    const non1 = in1.filter((a, i) => !m1[i].length).map(r => ({...r, _from:"1"}));
    const non2 = in2.filter((b, j) => !used2.has(j)).map(r => ({...r, _from:"2"}));
    if(mode === "matches") out = merged;
    else if(mode === "non1") out = non1;
    else if(mode === "nonboth") out = [...non1, ...non2];
    else if(mode === "everything") out = [...merged, ...non1, ...non2];
    else if(mode === "enrich1") out = in1.map((a, i) => m1[i].length ? {...a, ...m1[i][0], _from:"1+2"} : {...a, _from:"1"});
  }
  const cols = []; out.forEach(r => Object.keys(r).forEach(k => { if(k !== "_from" && !cols.includes(k)) cols.push(k); }));
  const st = box.querySelector(".jl-status");
  if(!out.length){ st.className = "jl-status jl-bad"; st.textContent = "0 items out. Nothing matched, so the next node never runs. Check that both key fields hold the same values."; }
  else { st.className = "jl-status jl-ok"; st.textContent = `${out.length} item${out.length > 1 ? "s" : ""} out`; }
  box.querySelector(".mout").innerHTML = out.length ? `<table class="dt"><thead><tr><th>from</th>${cols.map(c => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${out.map(r => `<tr><td>${r._from}</td>${cols.map(c => `<td>${r[c] === undefined ? "<span class='muted'>–</span>" : esc(typeof r[c] === "number" ? r[c].toLocaleString("en-NG") : r[c])}</td>`).join("")}</tr>`).join("")}</tbody></table>` : "";
  const goal = box.querySelector("[data-o='goal']");
  if(goal){
    const owe = cfg.goal; const names = out.map(r => r.customer_id).filter(Boolean);
    const hit = mode !== "append" && out.length === owe.length && owe.every(id => names.includes(id)) && out.every(r => r._from === "1");
    goal.className = "mgoal " + (hit ? "ok" : "");
    goal.textContent = hit ? "✓ Exactly the customers who still owe. These are the ones to remind." : `Goal: output only the ${owe.length} customers who haven't paid (${owe.join(", ")}).`;
  }
}
lesson.addEventListener("change", e => { const m = e.target.closest("[data-merge]"); if(m) runMerge(m); });
const _initLesson15 = initLesson;
initLesson = function(el){ _initLesson15(el); el.querySelectorAll("[data-merge]").forEach(runMerge); };

/* Batch planner (Module 3.3) */
function runBatch(box){
  const v = k => Math.max(0, parseFloat(box.querySelector(`[data-b="${k}"]`).value) || 0);
  const n = v("n"), b = Math.max(1, v("size")), w = v("wait"), lim = v("limit");
  const batches = Math.ceil(n / b), waits = Math.max(0, batches - 1), secs = waits * w;
  const rate = w > 0 ? Math.min(n, b * Math.max(1, 60 / w)) : n;
  const mm = Math.floor(secs / 60), ss = Math.round(secs % 60);
  const f = x => Math.round(x).toLocaleString();
  box.querySelector("[data-o='batches']").textContent = f(batches);
  box.querySelector("[data-o='time']").textContent = secs ? `${mm}m ${String(ss).padStart(2, "0")}s` : "instant";
  box.querySelector("[data-o='rate']").textContent = f(rate);
  const ok = rate <= lim;
  const vd = box.querySelector("[data-o='verdict']");
  vd.className = "mgoal " + (ok ? "ok" : "bad");
  vd.textContent = ok ? `✓ At most about ${f(rate)} messages in any minute, under the ${f(lim)}-per-minute limit.` : `✗ Up to ${f(rate)} messages in a single minute: over the ${f(lim)}-per-minute limit. Make batches smaller or waits longer.`;
}
lesson.addEventListener("input", e => { const b = e.target.closest("[data-batch]"); if(b) runBatch(b); });
const _initLesson16 = initLesson;
initLesson = function(el){ _initLesson16(el); el.querySelectorAll("[data-batch]").forEach(runBatch); };

/* Pagination & rate-limit simulator (Module 3.4) */
const PG_EXPR = {
  pc: {label:"{{ $pageCount }}", f:c => c},
  pc1: {label:"{{ $pageCount + 1 }}", f:c => c + 1},
  one: {label:"{{ 1 }}", f:() => 1},
  sk: {label:"{{ $pageCount * 50 }}", f:(c, s) => c * s},
  sk1: {label:"{{ ($pageCount + 1) * 50 }}", f:(c, s) => (c + 1) * s}
};
function runPager(box){
  const g = k => box.querySelector(`[data-pg="${k}"]`);
  const total = Math.max(0, parseInt(g("total").value) || 0), size = Math.max(1, parseInt(g("size").value) || 1);
  const style = g("style").value, ex = PG_EXPR[g("expr").value], stop = g("stop").value;
  const interval = Math.max(0, parseInt(g("interval").value) || 0), limit = Math.max(1, parseInt(g("limit").value) || 1), retry = g("retry").checked;
  const cap = 20, rows = [], got = []; let failed = false, hitCap = false, n429 = 0, t = 0; const times = [];
  for(let c = 0; ; c++){
    if(c >= cap){ hitCap = true; break; }
    const v = ex.f(c, size);
    let from, to;
    if(style === "page"){ const p = Math.max(1, v); from = (p - 1) * size; to = Math.min(p * size, total); }
    else { from = Math.max(0, v); to = Math.min(from + size, total); }
    const items = to > from ? to - from : 0;
    t = c === 0 ? 0 : t + Math.max(interval, 100);
    times.push(t);
    const inWin = times.filter(x => x > t - 1000).length;
    let status = "200";
    if(inWin > limit){
      n429++;
      if(!retry){ rows.push({c, v, items:0, status:"429", note:"Too Many Requests → node fails"}); failed = true; break; }
      status = "429 → retried ✓"; t += 1000; times[times.length - 1] = t;
    }
    for(let k = from; k < to; k++) got.push(k + 1);
    const label = items ? `products ${from + 1}–${to}` : "empty";
    rows.push({c, v, items, status, note:label});
    if(stop === "empty" && items === 0) break;
    if(stop === "short" && items < size) break;
    if(stop === "fixed" && c >= 3) break;
  }
  const uniq = new Set(got).size, dups = got.length - uniq, missing = total - uniq;
  const param = style === "page" ? "page" : "skip";
  box.querySelector("[data-o='rows']").innerHTML = `<table class="dt"><thead><tr><th>$pageCount</th><th>${param}=</th><th>status</th><th>result</th></tr></thead><tbody>${rows.map(r => `<tr class="${r.status === "429" ? "bad" : ""}"><td>${r.c}</td><td>${r.v}</td><td>${r.status}</td><td>${esc(r.note)}</td></tr>`).join("")}${hitCap ? `<tr class="bad"><td colspan="4">…stopped by "Limit Pages Fetched" (max ${cap}). Without it, this would never end.</td></tr>` : ""}</tbody></table>`;
  const f = x => x.toLocaleString();
  box.querySelector("[data-o='req']").textContent = f(rows.length);
  box.querySelector("[data-o='uniq']").textContent = failed ? "0 saved" : f(uniq) + " / " + f(total);
  box.querySelector("[data-o='dup']").textContent = failed ? "–" : f(dups);
  const vd = box.querySelector("[data-o='verdict']");
  let ok = false, msg;
  if(failed) msg = "✗ The supplier answered 429 Too Many Requests and the node stopped. Nothing reaches the sheet. Slow down (interval) or turn on Retry On Fail.";
  else if(hitCap) msg = "✗ The page parameter never moves on, so the same page comes back forever.";
  else if(dups) msg = `✗ ${f(dups)} duplicate products: two requests fetched the same page. Check where your page count starts.`;
  else if(missing > 0) msg = `✗ ${f(missing)} products missing. The loop stopped early or skipped a page.`;
  else { ok = true; msg = `✓ All ${f(total)} products, no duplicates, in ${rows.length} requests${n429 ? ` (${n429} retried after a 429)` : ""}.`; }
  vd.className = "mgoal " + (ok ? "ok" : "bad"); vd.textContent = msg;
}
lesson.addEventListener("input", e => { const b = e.target.closest("[data-pager]"); if(b) runPager(b); });
lesson.addEventListener("change", e => { const b = e.target.closest("[data-pager]"); if(b) runPager(b); });
const _initLesson17 = initLesson;
initLesson = function(el){ _initLesson17(el); el.querySelectorAll("[data-pager]").forEach(b => {
  b.querySelector("[data-pg='expr']").innerHTML = Object.entries(PG_EXPR).map(([k, x]) => `<option value="${k}"${k === "pc" ? " selected" : ""}>${esc(x.label)}</option>`).join("");
  runPager(b); }); };

/* Code node sandbox (Module 3.5) — runs the learner's own JavaScript in a Web Worker against sample items */
const CODE_WORKER = `
onmessage = e => {
  const {code, items, mode} = e.data;
  const wrap = j => ({json: j});
  const clone = x => JSON.parse(JSON.stringify(x));
  const logs = []; const console = {log: (...a) => logs.push(a.map(v => typeof v === "string" ? v : JSON.stringify(v)).join(" "))};
  try{
    const fn = new Function("$input", "items", "$json", "console", '"use strict";\\n' + code);
    if(mode === "all"){
      const all = clone(items).map(wrap);
      const $input = {all: () => all, first: () => all[0], last: () => all[all.length - 1]};
      postMessage({ok:true, result: fn($input, all, undefined, console), logs});
    } else {
      const out = [];
      clone(items).forEach((j, i) => { const it = wrap(j); const $input = {item: it, all: () => items.map(wrap), first: () => wrap(items[0])}; out.push(fn($input, undefined, it.json, console)); });
      postMessage({ok:true, result: out, each:true, logs});
    }
  }catch(err){ postMessage({ok:false, error: String(err && err.message || err), logs}); }
};`;
function codeCheck(res){
  if(!res.ok) return /unsafe-eval|Refused to evaluate|EvalError/i.test(res.error) ? {err:"This viewer doesn't allow running code. Copy the code into an n8n Code node to run it."} : {err:"Error: " + res.error};
  let r = res.result;
  if(res.each){
    if(r.some(x => x === undefined)) return {err:"Code doesn't return items properly: in Run Once for Each Item mode, return one object, e.g. return { json: {...} }."};
    r = r.map(x => x);
  }
  if(r === undefined || r === null) return {err:"Code doesn't return items properly: nothing was returned. Did you forget the return statement?"};
  if(!Array.isArray(r)) return res.each ? {err:"Unexpected result"} : {err:"Code doesn't return items properly: return an array of objects, one for each item you want to output."};
  const bad = r.findIndex(x => x === null || typeof x !== "object" || Array.isArray(x));
  if(bad > -1) return {err:`Code doesn't return items properly: item ${bad} is ${JSON.stringify(r[bad])}, not an object. Wrap values like this: { json: { name: … } }.`};
  const items = r.map(x => (x && typeof x.json === "object" && !Array.isArray(x.json)) ? x.json : x);
  const wrapped = r.every(x => x.json && typeof x.json === "object");
  return {items, wrapped};
}
function runCode(box){
  const cfg = JSON.parse(document.getElementById(box.dataset.code).textContent);
  const code = box.querySelector("textarea").value, mode = box.querySelector("[data-cm]").value;
  const st = box.querySelector(".jl-status"), out = box.querySelector(".jl-out"), chk = box.querySelector("[data-o='check']");
  st.className = "jl-status"; st.textContent = "Running…"; out.textContent = ""; if(chk){ chk.textContent = ""; chk.className = "mgoal"; }
  const finish = res => {
    const c = codeCheck(res);
    const logs = res.logs && res.logs.length ? "console.log:\n" + res.logs.slice(0, 20).join("\n") + "\n\n" : "";
    if(c.err){ st.className = "jl-status jl-bad"; st.textContent = c.err; out.textContent = logs || "No output."; return; }
    st.className = "jl-status jl-ok"; st.textContent = `${c.items.length} item${c.items.length === 1 ? "" : "s"} out ✓` + (c.wrapped ? "" : " (n8n wraps plain objects in json for you; writing { json: … } makes it explicit)");
    out.innerHTML = esc(logs) + `<span class="t">output</span>\n` + esc(JSON.stringify(c.items, null, 2)).slice(0, 6000);
    if(chk && cfg.expect && mode === "all"){
      const e = cfg.expect; const got = c.items;
      const byPhone = Object.fromEntries(got.map(x => [x.phone, x]));
      const probs = [];
      if(got.length !== e.length) probs.push(`${got.length} customers out; expected ${e.length} unique phone numbers`);
      e.forEach(x => { const g = byPhone[x.phone]; if(!g) probs.push(`missing ${x.phone}`); else { if(Number(g.lifetime_value) !== x.lifetime_value) probs.push(`${x.phone}: lifetime_value ${JSON.stringify(g.lifetime_value)}, expected ${x.lifetime_value}`); if(g.last_order !== x.last_order) probs.push(`${x.phone}: last_order ${g.last_order}, expected ${x.last_order}`); if(Number(g.orders) !== x.orders) probs.push(`${x.phone}: orders ${g.orders}, expected ${x.orders}`); } });
      chk.className = "mgoal " + (probs.length ? "bad" : "ok");
      chk.textContent = probs.length ? "Checker: " + probs.slice(0, 3).join(" · ") + (probs.length > 3 ? ` · and ${probs.length - 3} more` : "") : "Checker: ✓ every customer once, with the right order count, lifetime value and last order date.";
    }
  };
  let done = false, w;
  try{
    w = new Worker(URL.createObjectURL(new Blob([CODE_WORKER], {type:"text/javascript"})));
    const timer = setTimeout(() => { if(!done){ done = true; w.terminate(); finish({ok:false, error:"Timed out after 3 seconds. Is there an endless loop?"}); } }, 3000);
    w.onmessage = e => { if(done) return; done = true; clearTimeout(timer); w.terminate(); finish(e.data); };
    w.onerror = e => { if(done) return; done = true; clearTimeout(timer); w.terminate(); finish({ok:false, error: e.message || "Script error"}); e.preventDefault(); };
    w.postMessage({code, items: cfg.items, mode});
  }catch(err){ st.className = "jl-status jl-bad"; st.textContent = "This browser blocked the sandbox. Copy the code into n8n to run it."; }
}
lesson.addEventListener("click", e => {
  const run = e.target.closest("[data-run]"); if(run){ runCode(run.closest("[data-code]")); return; }
  const ld = e.target.closest("[data-codeload]"); if(!ld) return;
  const box = ld.closest("[data-code]"); const src = document.getElementById(ld.dataset.codeload);
  box.querySelector("textarea").value = src.textContent.trim(); if(src.dataset.mode) box.querySelector("[data-cm]").value = src.dataset.mode; runCode(box);
});
const _initLesson18 = initLesson;
initLesson = function(el){ _initLesson18(el); el.querySelectorAll("[data-code]").forEach(box => {
  const v = box.querySelector(".indata"); const src = document.getElementById(box.dataset.code);
  if(v && src) v.textContent = JSON.stringify(JSON.parse(src.textContent).items, null, 2);
  runCode(box); }); };

/* AI classifier test-set scorer (Module 3.7) */
function runEval(box){
  const cfg = JSON.parse(document.getElementById(box.dataset.evalset).textContent);
  const lines = box.querySelector("textarea").value.split(/\n/).map(l => l.trim()).filter(l => l && !l.startsWith("#"));
  const pairs = lines.map(l => l.split(",").map(x => x.trim().toLowerCase())).filter(p => p.length >= 2 && p[0] && p[1]);
  const cats = [...new Set([...cfg.cats, ...pairs.flatMap(p => [p[0], p[1]])])];
  const right = pairs.filter(p => p[0] === p[1]).length;
  const crit = pairs.map((p, i) => ({p, i})).filter(({p}) => p[0] !== p[1] && ((cfg.mustReach.includes(p[0]) && !cfg.mustReach.includes(p[1])) || (p[1] === "spam" && p[0] !== "spam")));
  const f = x => x.toLocaleString();
  const acc = pairs.length ? right / pairs.length : 0;
  box.querySelector("[data-o='acc']").textContent = pairs.length ? Math.round(acc * 100) + "%" : "–";
  box.querySelector("[data-o='n']").textContent = `${right} of ${pairs.length}`;
  box.querySelector("[data-o='crit']").textContent = f(crit.length);
  const m = {}; cats.forEach(a => { m[a] = {}; cats.forEach(b => m[a][b] = 0); }); pairs.forEach(p => m[p[0]][p[1]]++);
  box.querySelector("[data-o='matrix']").innerHTML = `<table class="dt"><thead><tr><th>expected ↓ / AI said →</th>${cats.map(c => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${cats.map(a => `<tr><td><b>${esc(a)}</b></td>${cats.map(b => `<td class="${m[a][b] ? (a === b ? "hit" : "miss") : ""}">${m[a][b] || ""}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const vd = box.querySelector("[data-o='verdict']");
  const ok = pairs.length >= 10 && acc >= 0.9 && !crit.length;
  vd.className = "mgoal " + (ok ? "ok" : "bad");
  vd.textContent = !pairs.length ? "Add lines like: complaint,complaint" : ok ? "✓ Good enough to switch on, with Tolu reviewing drafts for the first two weeks." : crit.length ? `✗ ${crit.length} critical miss${crit.length > 1 ? "es" : ""}: ${crit.slice(0, 3).map(({p, i}) => `line ${i + 1} (${p[0]} → ${p[1]})`).join(", ")}. A complaint or refund that never reaches Tolu, or a real email marked spam, is worse than any other error.` : `✗ ${Math.round(acc * 100)}% accuracy${pairs.length < 10 ? " on too few tests" : ""}. Aim for 90%+ on at least 10 test emails before going live.`;
}
lesson.addEventListener("input", e => { const b = e.target.closest("[data-evalset]"); if(b) runEval(b); });
lesson.addEventListener("click", e => {
  const b = e.target.closest("[data-evrun]"); if(!b) return;
  const box = b.closest("[data-evalset]"); const cfg = JSON.parse(document.getElementById(box.dataset.evalset).textContent);
  const run = cfg.runs[b.dataset.evrun];
  box.querySelector("textarea").value = "# expected,predicted  (" + b.textContent.trim() + ")\n" + cfg.emails.map((em, i) => `${em.expected},${run[i]}`).join("\n");
  runEval(box);
});
const _initLesson19 = initLesson;
initLesson = function(el){ _initLesson19(el); el.querySelectorAll("[data-evalset]").forEach(runEval); };

/* Deploy file generator (Module 3.8) */
function randHex(n){ try{ const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map(b => b.toString(16).padStart(2, "0")).join(""); }catch(e){ return ""; } }
function runDeploy(box){
  const g = k => box.querySelector(`[data-dp="${k}"]`);
  const dom = g("domain").value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const ver = g("ver").value.trim() || "latest", tz = g("tz").value, legacy = g("legacy").checked;
  let key = g("key").value.trim();
  const domOk = /^([a-z0-9-]+\.)+[a-z]{2,}$/.test(dom);
  const env = `# .env  (keep this file private: never commit it to Git)
DOMAIN=${dom || "n8n.example.com"}
N8N_VERSION=${ver}
N8N_ENCRYPTION_KEY=${key || "PASTE-OR-GENERATE-A-LONG-RANDOM-KEY"}
TZ_NAME=${tz}`;
  const compose = `# docker-compose.yml
services:
  n8n:
    image: n8nio/n8n:\${N8N_VERSION}
    restart: unless-stopped
    environment:
      - N8N_HOST=\${DOMAIN}
      - N8N_PROTOCOL=https
      - ${legacy ? "WEBHOOK_URL" : "N8N_WEBHOOK_URL"}=https://\${DOMAIN}/
      - N8N_PROXY_HOPS=1
      - N8N_ENCRYPTION_KEY=\${N8N_ENCRYPTION_KEY}
      - GENERIC_TIMEZONE=\${TZ_NAME}
      - TZ=\${TZ_NAME}
      - N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true
    volumes:
      - n8n_data:/home/node/.n8n
  caddy:
    image: caddy:2
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
volumes:
  n8n_data:
  caddy_data:`;
  const caddy = `# Caddyfile  (Caddy fetches and renews the HTTPS certificate for you)
${dom || "n8n.example.com"} {
  reverse_proxy n8n:5678
}`;
  box.querySelector("[data-o='env']").textContent = env;
  box.querySelector("[data-o='compose']").textContent = compose;
  box.querySelector("[data-o='caddy']").textContent = caddy;
  const notes = [];
  notes.push(domOk ? ["ok", `Point a DNS "A" record for ${dom} at your server's IP before starting, or Caddy can't get a certificate.`] : ["bad", "Enter a real domain or subdomain you control, such as n8n.yourbusiness.com. HTTPS, Telegram and payment webhooks all need one."]);
  notes.push(ver === "latest" ? ["bad", "\"latest\" means an update can arrive by surprise on any restart. Pin a version number from n8n's release notes, and update on purpose after a backup."] : ["ok", `Pinned to ${ver}. To update: back up, change this number, docker compose pull && docker compose up -d.`]);
  notes.push(key.length >= 32 ? ["ok", "Encryption key set. Store a copy in your password manager: without it, a restored backup can't decrypt your credentials."] : ["bad", "No strong encryption key yet. Click \"Generate key\" (it's created in your browser and sent nowhere), then save a copy in your password manager."]);
  notes.push(legacy ? ["tip", "WEBHOOK_URL is the older name, for n8n versions before 2.35. Newer versions use N8N_WEBHOOK_URL."] : ["ok", "N8N_WEBHOOK_URL makes the editor show public webhook URLs (https://…), not localhost:5678."]);
  notes.push(["tip", "Only ports 80 and 443 are opened, to Caddy. n8n's port 5678 stays private inside Docker."]);
  box.querySelector("[data-o='notes']").innerHTML = notes.map(([k, t]) => `<li class="${k}">${esc(t)}</li>`).join("");
}
lesson.addEventListener("input", e => { const d = e.target.closest("[data-deploy]"); if(d) runDeploy(d); });
lesson.addEventListener("change", e => { const d = e.target.closest("[data-deploy]"); if(d) runDeploy(d); });
lesson.addEventListener("click", e => { const b = e.target.closest("[data-genkey]"); if(!b) return; const d = b.closest("[data-deploy]"); d.querySelector("[data-dp='key']").value = randHex(32); runDeploy(d); });

/* Go-live checklist (Module 3.8) */
function runReady(box){
  const items = [...box.querySelectorAll("input[type=checkbox]")];
  const tot = items.reduce((s, i) => s + Number(i.dataset.w), 0);
  const got = items.filter(i => i.checked).reduce((s, i) => s + Number(i.dataset.w), 0);
  const missCrit = items.filter(i => !i.checked && i.dataset.crit).map(i => { const l = i.closest("label").cloneNode(true); l.querySelectorAll(".must").forEach(m => m.remove()); return l.textContent.trim(); });
  const pct = Math.round(got / tot * 100);
  box.querySelector("[data-o='score']").textContent = pct + "%";
  const vd = box.querySelector("[data-o='verdict']");
  vd.className = "mgoal " + (!missCrit.length && pct >= 80 ? "ok" : "bad");
  vd.textContent = missCrit.length ? `Not ready: ${missCrit.length} must-have${missCrit.length > 1 ? "s" : ""} missing, starting with "${missCrit[0]}".` : pct >= 80 ? (box.dataset.okmsg || "✓ Ready to move Harvest Lane's workflows onto this server.") : "Must-haves done. Add a few more safety nets before relying on it.";
}
lesson.addEventListener("change", e => { const r = e.target.closest("[data-ready]"); if(r) runReady(r); });
const _initLesson20 = initLesson;
initLesson = function(el){ _initLesson20(el); el.querySelectorAll("[data-deploy]").forEach(runDeploy); el.querySelectorAll("[data-ready]").forEach(runReady); };

/* Order brain (Boss 3): AI extracts, rules price */
function runBrain(box){
  const cfg = JSON.parse(document.getElementById(box.dataset.brain).textContent);
  const st = box.querySelector(".jl-status"), out = box.querySelector("[data-o='reply']"), btns = box.querySelector("[data-o='btns']"), lines = box.querySelector("[data-o='lines']");
  let ex;
  try{ ex = JSON.parse(box.querySelector("textarea").value); }catch(e){ st.className = "jl-status jl-bad"; st.textContent = "Not valid JSON: " + e.message + ". In the workflow, the Structured Output Parser or Information Extractor prevents this; here, fix it by hand."; out.textContent = ""; btns.innerHTML = ""; lines.innerHTML = ""; return; }
  const items = Array.isArray(ex.items) ? ex.items : [];
  const naira = n => "₦" + Math.round(n).toLocaleString("en-NG");
  const ask = [], human = [], rows = [];
  let sub = 0;
  items.forEach(it => {
    const name = String(it.product ?? "").trim().toLowerCase();
    const qty = Number(it.qty);
    const p = cfg.products.find(pr => pr.aliases.some(a => name === a || name.includes(a)));
    if(!name){ ask.push("one item has no product name"); return; }
    if(!p){ ask.push(`we don't recognise "${it.product}"`); rows.push([it.product, "?", "not on the price list", ""]); return; }
    if(!Number.isFinite(qty) || qty <= 0 || !Number.isInteger(qty)){ ask.push(`how many ${p.unit}s of ${p.name.toLowerCase()}?`); rows.push([p.name, String(it.qty ?? "?"), "quantity unclear", ""]); return; }
    if(qty > cfg.maxQty){ human.push(`${qty} × ${p.name} is above the ${cfg.maxQty}-unit limit`); rows.push([p.name, qty, "large order → Tolu", ""]); return; }
    if(qty > p.stock){ ask.push(`we have only ${p.stock} ${p.unit}${p.stock === 1 ? "" : "s"} of ${p.name.toLowerCase()} left; shall we send ${p.stock}?`); rows.push([p.name, qty, `only ${p.stock} in stock`, ""]); return; }
    const lt = qty * p.price; sub += lt; rows.push([`${p.name} (${p.unit})`, qty, `${naira(p.price)} each`, naira(lt)]);
  });
  if(!items.length) ask.push("what would you like to order?");
  if(!ex.delivery_date) ask.push("which day should we deliver?");
  if(!ex.area) ask.push("which area should we deliver to?");
  const fee = sub >= cfg.freeFrom ? 0 : cfg.fee, total = sub + (sub ? fee : 0);
  lines.innerHTML = rows.length ? `<table class="dt"><thead><tr><th>Item</th><th class="n">Qty</th><th>Rule</th><th class="n">Line</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r[0])}</td><td class="n">${esc(r[1])}</td><td>${esc(r[2])}</td><td class="n">${esc(r[3])}</td></tr>`).join("")}${sub ? `<tr><td colspan="3">Delivery ${fee ? "" : "(free from " + naira(cfg.freeFrom) + ")"}</td><td class="n">${naira(fee)}</td></tr><tr><td colspan="3"><b>Total</b></td><td class="n"><b>${naira(total)}</b></td></tr>` : ""}</tbody></table>` : "";
  let msg, b = [], state;
  if(human.length){ state = ["jl-bad", "Route: Tolu reviews (" + human.join("; ") + ")"]; msg = "Thank you! This is a big order, so Tolu will confirm it with you personally within the hour. 🙏"; }
  else if(ask.length){ state = ["jl-bad", "Route: ask the customer, no order created yet"]; msg = "Thanks for your order! Quick question" + (ask.length > 1 ? "s" : "") + ":\n• " + ask.join("\n• "); }
  else { state = ["jl-ok", "Route: ready to confirm. Pending order saved, waiting for the customer's tap"]; msg = `Here's your order for ${ex.delivery_date}, ${ex.area}:\n` + rows.map(r => `• ${r[1]} × ${r[0]} = ${r[3]}`).join("\n") + `\nDelivery: ${fee ? naira(fee) : "free"}\nTotal: ${naira(total)}\n\nPrices from today's Harvest Lane price list.`; b = ["✅ Confirm", "✏️ Change"]; }
  st.className = "jl-status " + state[0]; st.textContent = state[1];
  out.textContent = msg;
  btns.innerHTML = b.map(x => `<span>${esc(x)}</span>`).join("");
}
lesson.addEventListener("input", e => { const b = e.target.closest("[data-brain]"); if(b) runBrain(b); });
lesson.addEventListener("click", e => { const p = e.target.closest("[data-brainset]"); if(!p) return; const box = p.closest("[data-brain]"); box.querySelector("textarea").value = document.getElementById(p.dataset.brainset).textContent.trim(); runBrain(box); });
const _initLesson21 = initLesson;
initLesson = function(el){ _initLesson21(el); el.querySelectorAll("[data-brain]").forEach(runBrain); };

/* Agent loop stepper (Module 4.1) */
function traceRender(box){
  const cfg = JSON.parse(document.getElementById(box.dataset.trace).textContent);
  const sc = cfg[box.querySelector("select").value];
  const n = Number(box.dataset.step || 0);
  const shown = sc.steps.slice(0, n);
  const kinds = {think:"🧠 Think", act:"🛠️ Act", obs:"👀 Observe", answer:"💬 Answer", stop:"⛔ Stopped"};
  box.querySelector(".tq").textContent = "Customer: " + sc.q;
  box.querySelector(".tsteps").innerHTML = shown.map((s, i) => `<li class="ts ${s.k}"><b>${kinds[s.k]}</b><span>${esc(s.t)}</span></li>`).join("");
  let tok = 0, ctx = cfg._base; shown.forEach(s => { if(s.k === "think" || s.k === "answer"){ tok += ctx; } ctx += s.tok || 60; });
  const calls = shown.filter(s => s.k === "think" || s.k === "answer").length;
  box.querySelector("[data-o='calls']").textContent = calls;
  box.querySelector("[data-o='tok']").textContent = tok.toLocaleString();
  const done = n >= sc.steps.length;
  const nb = box.querySelector("[data-tnext]"); nb.disabled = done;
  nb.textContent = n === 0 ? "▶ Start" : done ? "Finished" : "Next step";
  box.querySelector(".tnote").textContent = done ? sc.note : "";
}
lesson.addEventListener("click", e => {
  const nx = e.target.closest("[data-tnext]"), rs = e.target.closest("[data-treset]");
  const box = (nx || rs) && (nx || rs).closest("[data-trace]"); if(!box) return;
  box.dataset.step = nx ? Number(box.dataset.step || 0) + 1 : 0; traceRender(box);
});
lesson.addEventListener("change", e => { const b = e.target.closest("[data-trace]"); if(b && e.target.tagName === "SELECT"){ b.dataset.step = 0; traceRender(b); } });
const _initLesson22 = initLesson;
initLesson = function(el){ _initLesson22(el); el.querySelectorAll("[data-trace]").forEach(b => { b.dataset.step = 0; traceRender(b); }); };

/* Tool description linter (Module 4.2) */
const TOOL_VERBS = ["get","find","check","calculate","create","list","search","lookup","look","update","send","add","cancel","quote","book","fetch","read","count"];
function runToolLint(box){
  const name = box.querySelector("[data-tl='name']").value.trim();
  const desc = box.querySelector("[data-tl='desc']").value.trim();
  const params = box.querySelector("[data-tl='params']").value.split(/\n/).map(l => l.trim()).filter(Boolean).map(l => { const i = l.indexOf(":"); return i > 0 ? [l.slice(0, i).trim(), l.slice(i + 1).trim()] : [l, ""]; });
  const d = desc.toLowerCase();
  const checks = [
    [/^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(name) && TOOL_VERBS.includes(name.split("_")[0]), "Name is verb_noun in snake_case (get_price, check_delivery_date)", "Use a verb_noun name in snake_case. \"tool1\" or \"PriceData\" tells the model nothing."],
    [desc.length >= 80 && desc.length <= 700, "Description is a useful length (80–700 characters)", desc.length < 80 ? "Too short. Say what it does, when to use it, and what it returns." : "Very long. Keep the description focused; move policy into the system message."],
    [/(use (this|it|when|for|before)|call (this|it|when)|before answering|whenever)/.test(d), "Says when to use it", "Add when to use it: \"Use this whenever a customer asks about a price or total.\""],
    [/(returns|gives back|responds with|output)/.test(d), "Says what it returns", "Say what comes back: \"Returns the product name, unit, price in naira and stock.\""],
    [/(do not|don't|never|only|not for)/.test(d), "Sets a boundary (when not to use it, or what it can't do)", "Add a boundary: \"Don't use it for delivery fees\" or \"Only today's prices.\""],
    [params.length > 0 && params.every(([k, v]) => /^[a-z][a-z0-9_]*$/.test(k) && v.length >= 15), "Every input has a clear snake_case name and a description", "Describe every input, one per line, like \"product: the product as the customer wrote it, e.g. tatashe\"."],
    [params.length > 0 && params.some(([, v]) => /(e\.g\.|example|format|yyyy|naira|₦|number|integer|\d)/i.test(v)), "Inputs give a format, unit or example", "Give formats and examples: \"date in YYYY-MM-DD\", \"quantity as a whole number\"."]
  ];
  const score = checks.filter(c => c[0]).length;
  box.querySelector("[data-o='score']").textContent = `${score} / ${checks.length}`;
  box.querySelector("[data-o='checks']").innerHTML = checks.map(([ok, good, fix]) => `<li class="${ok ? "ok" : "bad"}">${ok ? "✓ " + esc(good) : "✗ " + esc(fix)}</li>`).join("");
  const fa = params.filter(([k]) => /^[a-z][a-z0-9_]*$/.test(k)).map(([k, v]) => `$fromAI('${k}', '${(v || "").replace(/'/g, "’").slice(0, 140)}', 'string')`);
  box.querySelector("[data-o='fromai']").textContent = fa.length ? fa.join("\n") : "(add inputs to see the $fromAI() expressions)";
}
lesson.addEventListener("input", e => { const b = e.target.closest("[data-toollint]"); if(b) runToolLint(b); });
lesson.addEventListener("click", e => {
  const p = e.target.closest("[data-tlset]"); if(!p) return; const box = p.closest("[data-toollint]");
  const s = JSON.parse(document.getElementById(p.dataset.tlset).textContent);
  box.querySelector("[data-tl='name']").value = s.name; box.querySelector("[data-tl='desc']").value = s.desc; box.querySelector("[data-tl='params']").value = s.params; runToolLint(box);
});
const _initLesson23 = initLesson;
initLesson = function(el){ _initLesson23(el); el.querySelectorAll("[data-toollint]").forEach(runToolLint); };

/* Memory session-key simulator (Module 4.3) */
function runMem(box){
  const cfg = JSON.parse(document.getElementById(box.dataset.mem).textContent);
  const key = box.querySelector("[data-mk='key']").value, win = Number(box.querySelector("[data-mk='win']").value), at = Number(box.querySelector("[data-mk='at']").value);
  const kf = c => key === "const" ? "harvest-lane" : key === "name" ? c.first_name : String(c.chat_id);
  const ev = cfg.events.map((e, i) => ({...e, i: i + 1, c: cfg.customers[e.who]}));
  const cur = ev[at - 1], sk = kf(cur.c);
  const prior = ev.slice(0, at - 1).filter(e => kf(e.c) === sk);
  const seen = prior.slice(-win);
  const leaked = seen.filter(e => e.who !== cur.who);
  const forgot = prior.filter(e => e.who === cur.who && !seen.includes(e));
  box.querySelector("[data-o='sk']").textContent = sk;
  box.querySelector("[data-o='now']").textContent = `#${cur.i} ${cur.c.label}: "${cur.text}"`;
  box.querySelector("[data-o='seen']").innerHTML = seen.length ? seen.map(e => `<li class="${e.who !== cur.who ? "bad" : "ok"}"><b>#${e.i} ${esc(e.c.label)}</b> ${esc(e.text)}${e.who !== cur.who ? " ← someone else's message!" : ""}</li>`).join("") : `<li>(nothing: the agent starts fresh)</li>`;
  const vd = box.querySelector("[data-o='verdict']");
  let msg, ok = false;
  if(leaked.length) msg = `✗ Privacy leak: the agent can see ${leaked.length} message${leaked.length > 1 ? "s" : ""} from other customers, and may repeat their orders or addresses.`;
  else if(forgot.length && cur.needs && forgot.some(e => e.i === cur.needs)) msg = `✗ No leak, but the window is too short: message #${cur.needs} (the one this question depends on) has dropped out of memory.`;
  else { ok = true; msg = "✓ The agent sees only this customer's own recent messages, including what this question depends on."; }
  vd.className = "mgoal " + (ok ? "ok" : "bad"); vd.textContent = msg;
}
lesson.addEventListener("change", e => { const b = e.target.closest("[data-mem]"); if(b) runMem(b); });
const _initLesson24 = initLesson;
initLesson = function(el){ _initLesson24(el); el.querySelectorAll("[data-mem]").forEach(b => {
  const cfg = JSON.parse(document.getElementById(b.dataset.mem).textContent);
  b.querySelector("[data-mk='at']").innerHTML = cfg.events.map((e, i) => `<option value="${i + 1}"${i + 1 === cfg.defaultAt ? " selected" : ""}>#${i + 1} ${esc(cfg.customers[e.who].label)}: ${esc(e.text.slice(0, 34))}${e.text.length > 34 ? "…" : ""}</option>`).join("");
  b.querySelector(".memlog").innerHTML = cfg.events.map((e, i) => `<li><b>#${i + 1} ${esc(cfg.customers[e.who].label)}</b> <span class="muted">(chat ${cfg.customers[e.who].chat_id}, first name "${esc(cfg.customers[e.who].first_name)}")</span><br>${esc(e.text)}</li>`).join("");
  runMem(b); }); };

/* Chunking & retrieval lab (Module 4.4) — word overlap stands in for embeddings */
const RAG_STOP = new Set("a an the and or of to for in on at by is are was were be been it its this that with as from if you your we our i my me can do does did will would should not no yes what how when which who about any all have has had there their them they than then so but into per".split(" "));
function ragWords(t){ return t.toLowerCase().replace(/[^a-z0-9₦\s]/g, " ").split(/\s+/).filter(w => w && !RAG_STOP.has(w)).map(w => w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w); }
function ragChunk(text, size, overlap){
  // Like a recursive splitter: try section breaks first, then sentences, then pack up to the size.
  const secs = text.replace(/\r/g, "").split(/\n(?=##\s)/).map(x => x.trim()).filter(Boolean);
  const pieces = [];
  secs.forEach(sec => {
    if(sec.length <= size){ pieces.push(sec.replace(/\n+/g, " ")); return; }
    sec.split(/(?<=[.!?])\s+|\n+/).map(x => x.trim()).filter(Boolean).forEach(x => pieces.push(x));
  });
  const chunks = []; let cur = "";
  pieces.forEach(p => {
    if(cur && (cur + " " + p).length > size){
      chunks.push(cur);
      let tail = overlap > 0 ? cur.slice(-overlap) : "";
      const sp = tail.indexOf(" "); if(sp > -1 && tail.length === overlap) tail = tail.slice(sp + 1);
      cur = tail ? tail + " " + p : p;
    } else cur = cur ? cur + " " + p : p;
  });
  if(cur) chunks.push(cur);
  return chunks;
}
function runRag(box){
  const text = box.querySelector("textarea").value;
  const size = Math.max(80, Number(box.querySelector("[data-rg='size']").value) || 300);
  const overlap = Math.min(size - 20, Math.max(0, Number(box.querySelector("[data-rg='ov']").value) || 0));
  const k = Number(box.querySelector("[data-rg='k']").value);
  const q = box.querySelector("[data-rg='q']").value;
  box.querySelector("[data-o='sizev']").textContent = size; box.querySelector("[data-o='ovv']").textContent = overlap;
  const chunks = ragChunk(text, size, overlap);
  const heads = [...text.matchAll(/^##\s*(.+)$/gm)].map(m => m[1].trim());
  const secOf = c => heads.filter(h => c.includes(h));
  const qw = new Set(ragWords(q));
  const scored = chunks.map((c, i) => { const cw = ragWords(c); let s = 0; qw.forEach(w => { if(cw.includes(w)) s++; }); return {i, c, s: s / Math.sqrt(Math.max(cw.length, 1)) * 10, hits: [...qw].filter(w => cw.includes(w))}; });
  const top = [...scored].sort((a, b) => b.s - a.s).slice(0, k).filter(x => x.s > 0);
  box.querySelector("[data-o='nch']").textContent = chunks.length;
  box.querySelector("[data-o='chunks']").innerHTML = chunks.map((c, i) => { const t = top.find(x => x.i === i); const secs = secOf(c); return `<li class="${t ? "hit" : ""}"><b>Chunk ${i + 1}</b>${t ? ` <span class="rk">retrieved #${top.indexOf(t) + 1}</span>` : ""}${secs.length > 1 ? ` <span class="mx">mixes ${secs.length} sections</span>` : ""}<br>${esc(c)}</li>`; }).join("");
  const vd = box.querySelector("[data-o='verdict']");
  if(!top.length){ vd.className = "mgoal bad"; vd.textContent = "Nothing relevant retrieved. A good agent now says \"I don't know\" and offers to ask Tolu, rather than guessing."; return; }
  const firstSecs = secOf(top[0].c);
  const mixed = top.some(t => secOf(t.c).length > 1);
  vd.className = "mgoal " + (mixed ? "bad" : "ok");
  vd.textContent = mixed ? `✗ A retrieved chunk mixes ${firstSecs.length > 1 ? firstSecs.join(" + ") : "two sections"}. The model may blend their rules. Try smaller chunks (or split on headings).` : `✓ Retrieved chunks each come from a single section${firstSecs.length ? ` (top: "${firstSecs[0]}")` : ""}, so the answer can cite one rule cleanly.`;
}
lesson.addEventListener("input", e => { const b = e.target.closest("[data-rag]"); if(b) runRag(b); });
lesson.addEventListener("change", e => { const b = e.target.closest("[data-rag]"); if(b) runRag(b); });
const _initLesson25 = initLesson;
initLesson = function(el){ _initLesson25(el); el.querySelectorAll("[data-rag]").forEach(runRag); };

/* Defence-in-layers test bench (Module 4.5) */
function runShield(box){
  const cfg = JSON.parse(document.getElementById(box.dataset.shield).textContent);
  const on = {}; box.querySelectorAll("[data-ly]").forEach(c => on[c.dataset.ly] = c.checked);
  const names = cfg.layers;
  let harms = 0, okLegit = true;
  const rows = cfg.attacks.map(a => {
    if(a.legit){
      const res = on.A ? ["ok", "Reaches Tolu for approval with the order and photo. ✓ (Good guardrails don't block real customers.)"] : on.L ? ["warn", "No refund tool and no approval route: the customer is told to wait, and nobody is alerted."] : ["bad", "Refund paid automatically, with no one checking the photo."];
      if(res[0] !== "ok") okLegit = false;
      return `<li class="${res[0]}"><b>${esc(a.msg)}</b><span>${esc(res[1])}</span></li>`;
    }
    const by = a.stop.filter(l => on[l]);
    if(by.length) return `<li class="ok"><b>${esc(a.msg)}</b><span>Stopped by: ${by.map(l => esc(names[l])).join(", ")}</span></li>`;
    harms++; return `<li class="bad"><b>${esc(a.msg)}</b><span>HARM: ${esc(a.harm)}</span></li>`;
  });
  box.querySelector("[data-o='rows']").innerHTML = rows.join("");
  box.querySelector("[data-o='harms']").textContent = harms;
  const vd = box.querySelector("[data-o='verdict']");
  const n = Object.values(on).filter(Boolean).length;
  vd.className = "mgoal " + (!harms && okLegit ? "ok" : "bad");
  vd.textContent = !harms && okLegit ? `✓ All ${cfg.attacks.length - 1} attacks stopped, and the genuine refund still reaches Tolu. Notice that no single layer did it alone.` : harms ? `✗ ${harms} attack${harms > 1 ? "s" : ""} cause${harms > 1 ? "" : "s"} harm with ${n} layer${n === 1 ? "" : "s"} on. Which layer would stop the rest?` : "No harm, but the genuine customer isn't served properly. Guardrails must still let real requests through.";
}
lesson.addEventListener("change", e => { const b = e.target.closest("[data-shield]"); if(b) runShield(b); });
const _initLesson26 = initLesson;
initLesson = function(el){ _initLesson26(el); el.querySelectorAll("[data-shield]").forEach(runShield); };

/* Claude Desktop MCP config builder (Module 4.6) */
function runMcpCfg(box){
  const g = k => box.querySelector(`[data-mc="${k}"]`);
  const url = g("url").value.trim(), tok = g("tok").value.trim(), name = (g("name").value.trim() || "harvest-lane").replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
  const cfg = {mcpServers: {[name]: {command: "npx", args: ["mcp-remote", url || "<MCP_URL>", "--header", "Authorization: Bearer ${AUTH_TOKEN}"], env: {AUTH_TOKEN: tok ? "••••••••" : "<MCP_BEARER_TOKEN>"}}}};
  box.querySelector("[data-o='json']").textContent = JSON.stringify(cfg, null, 2);
  const notes = [];
  if(!url) notes.push(["bad", "Paste the MCP Server Trigger's URL from n8n."]);
  else {
    if(!/^https:\/\//.test(url)) notes.push(["bad", "Use the https address of your server (3.8). Plain http sends your token unencrypted."]);
    if(/mcp-test/.test(url)) notes.push(["bad", "This looks like the test URL. It only works while you're listening in the editor. Use the production URL from a published workflow."]);
    if(/localhost|127\.0\.0\.1/.test(url)) notes.push(["tip", "localhost only works when Claude Desktop runs on the same computer as n8n."]);
    if(/^https:\/\//.test(url) && !/mcp-test/.test(url)) notes.push(["ok", "Production https URL. Good."]);
  }
  notes.push(tok.length >= 24 ? ["ok", "Bearer token set (hidden here). In the real file, put the token where the dots are, and keep the file private."] : ["bad", "Set Bearer authentication on the MCP Server Trigger with a long random token, and paste it here. Never leave an MCP server open with no auth."]);
  notes.push(["tip", "File location: Claude Desktop → Settings → Developer → Edit Config. Restart Claude Desktop after saving. mcp-remote needs Node.js installed."]);
  box.querySelector("[data-o='notes']").innerHTML = notes.map(([k, t]) => `<li class="${k}">${esc(t)}</li>`).join("");
}
lesson.addEventListener("input", e => { const b = e.target.closest("[data-mcpcfg]"); if(b) runMcpCfg(b); });
const _initLesson27 = initLesson;
initLesson = function(el){ _initLesson27(el); el.querySelectorAll("[data-mcpcfg]").forEach(runMcpCfg); };

/* Multi-agent team cost & review-loop calculator (Module 4.7) */
function runTeam(box){
  const v = k => Math.max(0, parseFloat(box.querySelector(`[data-tm="${k}"]`).value) || 0);
  const capSel = box.querySelector("[data-tm='cap']").value, cap = capSel === "none" ? 50 : Number(capSel);
  const p = Math.min(1, v("p") / 100);
  let reviews = 0; for(let k = 0; k <= cap; k++) reviews += Math.pow(1 - p, k);
  const revisions = reviews - 1;
  const stuck = Math.pow(1 - p, cap + 1);
  const calls = v("res") + 1 + revisions + reviews;
  const tokens = calls * v("tok");
  const cost = tokens / 1e6 * v("price");
  const f = (x, d = 0) => x.toLocaleString(undefined, {minimumFractionDigits:d, maximumFractionDigits:d});
  box.querySelector("[data-o='calls']").textContent = f(calls, 1);
  box.querySelector("[data-o='tok']").textContent = f(Math.round(tokens));
  box.querySelector("[data-o='cost']").textContent = "$" + f(cost, 2) + " / $" + f(cost * 4, 2);
  const vd = box.querySelector("[data-o='verdict']");
  if(capSel === "none"){ const worst = (v("res") + 1 + 100) * v("tok"); vd.className = "mgoal bad"; vd.textContent = `✗ No cap. With a ${f(p * 100)}% approval rate it usually ends, but nothing guarantees it. If the editor is told never to be satisfied (Glitch's brief), 50 rounds burn about ${f(worst)} tokens ($${f(worst / 1e6 * v("price"), 2)}) per issue before a timeout stops it.`; }
  else { vd.className = "mgoal " + (stuck > 0.2 ? "bad" : "ok"); vd.textContent = `${cap} review round${cap === 1 ? "" : "s"} max. Chance the draft still isn't approved at the cap: ${f(stuck * 100, 1)}%. ${stuck > 0.2 ? "That's high: improve the writer's brief or the editor's checklist, rather than adding rounds." : "When it happens, the draft goes to Tolu flagged \"needs a human look\". Nothing loops."}`; }
}
lesson.addEventListener("input", e => { const b = e.target.closest("[data-team]"); if(b) runTeam(b); });
lesson.addEventListener("change", e => { const b = e.target.closest("[data-team]"); if(b) runTeam(b); });
const _initLesson28 = initLesson;
initLesson = function(el){ _initLesson28(el); el.querySelectorAll("[data-team]").forEach(runTeam); };

/* Messages-list stepper (Module 4.8) */
function msgRender(box){
  const steps = JSON.parse(document.getElementById(box.dataset.msgs).textContent);
  const n = Number(box.dataset.step || 0);
  box.querySelector(".mlist").innerHTML = steps.slice(0, n).map((s, i) => `<li class="${s.role}${i === n - 1 ? " new" : ""}"><b>${esc(s.label)}</b><pre>${esc(JSON.stringify(s.json, null, 2))}</pre></li>`).join("");
  box.querySelector(".mnote").textContent = n ? steps[n - 1].note : "Press Next to send the first message.";
  const nb = box.querySelector("[data-mnext]"); nb.disabled = n >= steps.length; nb.textContent = n >= steps.length ? "Finished" : n ? "Next" : "▶ Start";
  box.querySelector("[data-o='mcount']").textContent = steps.slice(0, n).filter(s => s.inList).length;
}
lesson.addEventListener("click", e => {
  const nx = e.target.closest("[data-mnext]"), rs = e.target.closest("[data-mreset]");
  const box = (nx || rs) && (nx || rs).closest("[data-msgs]"); if(!box) return;
  box.dataset.step = nx ? Number(box.dataset.step || 0) + 1 : 0; msgRender(box);
});
const _initLesson29 = initLesson;
initLesson = function(el){ _initLesson29(el); el.querySelectorAll("[data-msgs]").forEach(b => { b.dataset.step = 0; msgRender(b); }); };

/* Regression finder (Module 4.9) */
function runRegress(box){
  const cfg = JSON.parse(document.getElementById(box.dataset.regress).textContent);
  const only = box.querySelector("[data-rf='only']").checked;
  const n = cfg.cases.length;
  const p1 = cfg.cases.filter(c => c.v1).length, p2 = cfg.cases.filter(c => c.v2).length;
  const reg = cfg.cases.filter(c => c.v1 && !c.v2), fix = cfg.cases.filter(c => !c.v1 && c.v2);
  const critReg = reg.filter(c => c.crit);
  box.querySelector("[data-o='a1']").textContent = `${p1}/${n} (${Math.round(p1 / n * 100)}%)`;
  box.querySelector("[data-o='a2']").textContent = `${p2}/${n} (${Math.round(p2 / n * 100)}%)`;
  box.querySelector("[data-o='rg']").textContent = `${reg.length} (${critReg.length} critical)`;
  const rows = cfg.cases.filter(c => !only || c.v1 !== c.v2);
  box.querySelector("[data-o='tbl']").innerHTML = `<table class="dt"><thead><tr><th>#</th><th>Test case</th><th>v1</th><th>v2</th></tr></thead><tbody>${rows.map(c => { const cls = c.v1 && !c.v2 ? "reg" : !c.v1 && c.v2 ? "fix" : ""; return `<tr class="${cls}"><td>${c.id}</td><td>${esc(c.q)}${c.crit ? ' <span class="crit-tag">critical</span>' : ""}</td><td>${c.v1 ? "✓" : "✗"}</td><td>${c.v2 ? "✓" : "✗"}</td></tr>`; }).join("")}</tbody></table>`;
  const vd = box.querySelector("[data-o='verdict']");
  vd.className = "mgoal " + (critReg.length ? "bad" : "ok");
  vd.textContent = critReg.length ? `✗ Don't ship v2. Overall accuracy went up (${p1} → ${p2}), but ${critReg.length} critical case${critReg.length > 1 ? "s" : ""} broke: ${critReg.map(c => "#" + c.id).join(", ")}. An average hides exactly the failures that cost money.` : "✓ No critical regressions. Ship it, and keep the test set for next time.";
}
lesson.addEventListener("change", e => { const b = e.target.closest("[data-regress]"); if(b) runRegress(b); });

/* Model routing cost (Module 4.9) */
function runRoute(box){
  const v = k => Math.max(0, parseFloat(box.querySelector(`[data-rt="${k}"]`).value) || 0);
  const msgs = v("msgs"), easy = Math.min(100, v("easy")) / 100, tok = v("tok"), cheap = v("cheap"), strong = v("strong"), cls = v("cls");
  const allStrong = msgs * tok / 1e6 * strong;
  const routed = msgs * (cls / 1e6 * cheap) + msgs * easy * tok / 1e6 * cheap + msgs * (1 - easy) * tok / 1e6 * strong;
  const f = x => "$" + x.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2});
  box.querySelector("[data-o='all']").textContent = f(allStrong);
  box.querySelector("[data-o='rt']").textContent = f(routed);
  box.querySelector("[data-o='save']").textContent = allStrong ? Math.round((1 - routed / allStrong) * 100) + "%" : "–";
}
lesson.addEventListener("input", e => { const b = e.target.closest("[data-route-cost]"); if(b) runRoute(b); });
const _initLesson30 = initLesson;
initLesson = function(el){ _initLesson30(el); el.querySelectorAll("[data-regress]").forEach(runRegress); el.querySelectorAll("[data-route-cost]").forEach(runRoute); };

/* WhatsApp send-rule checker (Module 5.1) */
function runWa(box){
  const hrs = Math.max(0, parseFloat(box.querySelector("[data-wa='hrs']").value) || 0);
  const purpose = box.querySelector("[data-wa='purpose']").value;
  const optin = box.querySelector("[data-wa='optin']").checked;
  const open = hrs < 24;
  const P = {
    reply: {label:"Answer the customer's question", cat:"utility"},
    confirm: {label:"Order confirmation / delivery update", cat:"utility"},
    remind: {label:"Payment reminder", cat:"utility"},
    promo: {label:"Promotion or newsletter", cat:"marketing"},
    otp: {label:"One-time login code", cat:"authentication"}
  }[purpose];
  const out = [];
  let ok = true;
  if(open && (purpose === "reply" || purpose === "confirm")){
    out.push(["ok", "The 24-hour customer service window is open: you can send a normal (free-form) message. Since 1 October 2026 each business number gets 1,000 free-form replies a month inside the window; after that they're charged."]);
  } else if(open && P.cat === "utility"){
    out.push(["ok", "Window open: a free-form message works (1,000 free a month per number, then charged). A utility template sent inside the window is charged per message."]);
  } else if(open){
    out.push(["tip", `Window open, but this is a ${P.cat} message. Use an approved ${P.cat} template; ${P.cat} templates are charged per message.`]);
  } else {
    out.push(["bad", `It's been ${Math.floor(hrs)} hours since the customer's last message, and the window lasts 24 hours, so it's closed. A free-form message will fail. Send an approved ${P.cat} template instead; it's charged per message.`]);
  }
  if(!open || P.cat !== "utility" || purpose === "remind"){
    if(!optin){ out.push(["bad", "You're starting the conversation, so the customer must have agreed to receive WhatsApp messages from Harvest Lane. Record that opt-in first."]); ok = false; }
    else out.push(["ok", "Opt-in recorded."]);
  }
  if(purpose === "promo") out.push(["tip", "Marketing messages: keep them rare and relevant. Customers can block or report you, which hurts your number's quality rating."]);
  box.querySelector("[data-o='cat']").textContent = (open && (purpose === "reply" || purpose === "confirm")) ? "free-form (service)" : P.cat + " template";
  box.querySelector("[data-o='win']").textContent = open ? `open (${Math.max(0, Math.ceil(24 - hrs))} h left)` : "closed";
  box.querySelector("[data-o='notes']").innerHTML = out.map(([k, t]) => `<li class="${k}">${esc(t)}</li>`).join("");
}
lesson.addEventListener("input", e => { const b = e.target.closest("[data-warule]"); if(b) runWa(b); });
lesson.addEventListener("change", e => { const b = e.target.closest("[data-warule]"); if(b) runWa(b); });
const _initLesson31 = initLesson;
initLesson = function(el){ _initLesson31(el); el.querySelectorAll("[data-warule]").forEach(runWa); };

/* ROI / payback calculator (Module 6.1) */
function runRoi(box){
  const v = k => Math.max(0, parseFloat(String(box.querySelector(`[data-ro="${k}"]`).value).replace(/,/g, "")) || 0);
  const auto = Math.min(100, v("auto")) / 100;
  const timeVal = v("hrs") * 52 / 12 * v("rate") * auto;
  const errVal = v("errs") * v("ecost") * auto;
  const value = timeVal + errVal + v("extra");
  const net = value - v("run");
  const build = v("build");
  const n = x => (x < 0 ? "−₦" : "₦") + Math.abs(Math.round(x)).toLocaleString("en-NG");
  box.querySelector("[data-o='val']").textContent = n(value);
  box.querySelector("[data-o='net']").textContent = n(net);
  box.querySelector("[data-o='pb']").textContent = net > 0 ? (build / net).toFixed(1) + " months" : "never";
  box.querySelector("[data-o='y1']").textContent = n(12 * net - build);
  const vd = box.querySelector("[data-o='verdict']");
  const pb = net > 0 ? build / net : Infinity;
  vd.className = "mgoal " + (pb <= 6 ? "ok" : "bad");
  vd.textContent = net <= 0 ? "✗ Running costs exceed the value. Don't build this as scoped: find a bigger pain, or a cheaper design." : pb <= 3 ? "✓ Pays for itself within a quarter: an easy yes for most owners." : pb <= 6 ? "✓ Pays back within six months: a solid proposal. Lead with the monthly saving." : "✗ Payback over six months: hard to sell to a small business. Shrink the scope, or find more value.";
}
lesson.addEventListener("input", e => { const b = e.target.closest("[data-roi]"); if(b) runRoi(b); });
const _initLesson32 = initLesson;
initLesson = function(el){ _initLesson32(el); el.querySelectorAll("[data-roi]").forEach(runRoi); };

/* Pricing helper (Module 6.2) */
function psFee(a){ if(a <= 0) return 0; const f = a * 0.015 + (a < 2500 ? 0 : 100); return Math.min(f, 2000); }
function runPrice(box){
  const v = k => Math.max(0, parseFloat(box.querySelector(`[data-pr="${k}"]`).value) || 0);
  const val = v("val"), hrs = v("hrs"), rate = v("rate"), setup = v("setup"), mon = v("mon"), cost = v("cost");
  const n = x => "₦" + Math.round(x).toLocaleString("en-NG");
  const floor = hrs * rate;
  box.querySelector("[data-o='floor']").textContent = n(floor);
  box.querySelector("[data-o='vrange']").textContent = `${n(val * 1)} – ${n(val * 3)}`;
  box.querySelector("[data-o='mrange']").textContent = `${n(val * 0.08)} – ${n(val * 0.15)}`;
  const clientNet = val - mon;
  const pb = clientNet > 0 ? setup / clientNet : Infinity;
  box.querySelector("[data-o='pb']").textContent = isFinite(pb) ? pb.toFixed(1) + " months" : "never";
  box.querySelector("[data-o='eff']").textContent = hrs ? n(setup / hrs) + "/h" : "–";
  box.querySelector("[data-o='margin']").textContent = n(mon - cost);
  box.querySelector("[data-o='fees']").textContent = `${n(psFee(setup / 2))} per half of setup · ${n(psFee(mon))} per month`;
  const vd = box.querySelector("[data-o='verdict']");
  let ok = true, msg;
  if(setup < floor){ ok = false; msg = `✗ Below your cost floor: at ${n(setup)} you earn ${n(setup / Math.max(hrs, 1))} an hour, under your ${n(rate)} target.`; }
  else if(mon <= cost){ ok = false; msg = "✗ The monthly fee doesn't cover your running costs. You'd pay to keep the client."; }
  else if(pb > 6){ ok = false; msg = `✗ The client's payback is ${isFinite(pb) ? pb.toFixed(1) + " months" : "never"}: hard to say yes to. Lower the setup, or add value.`; }
  else msg = `✓ Fair on both sides: you clear your floor, the monthly fee leaves ${n(mon - cost)} margin, and the client pays back in ${pb.toFixed(1)} months.`;
  vd.className = "mgoal " + (ok ? "ok" : "bad"); vd.textContent = msg;
}
lesson.addEventListener("input", e => { const b = e.target.closest("[data-pricing]"); if(b) runPrice(b); });
const _initLesson33 = initLesson;
initLesson = function(el){ _initLesson33(el); el.querySelectorAll("[data-pricing]").forEach(runPrice); };

/* Template sanitiser (Module 6.3) — scans an exported workflow JSON for things that must not ship */
const SAN_RULES = [
  {re:/\bsk_(live|test)_[A-Za-z0-9]{10,}/g, what:"Paystack secret key", ph:"<PAYSTACK_SECRET_KEY>"},
  {re:/\bsk-ant-[A-Za-z0-9_\-]{10,}/g, what:"Anthropic API key", ph:"<ANTHROPIC_API_KEY>"},
  {re:/\bsk-(proj-)?[A-Za-z0-9_\-]{20,}/g, what:"OpenAI-style API key", ph:"<OPENAI_API_KEY>"},
  {re:/\b\d{8,10}:[A-Za-z0-9_\-]{30,}\b/g, what:"Telegram bot token", ph:"<TELEGRAM_BOT_TOKEN>"},
  {re:/Bearer\s+[A-Za-z0-9._\-]{16,}/g, what:"Bearer token in a header", ph:"Bearer <TOKEN>"},
  {re:/\b(\+?234|0)[789][01]\d{8}\b/g, what:"Nigerian phone number", ph:"<PHONE>"},
  {re:/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, what:"Email address", ph:"<EMAIL>"},
  {re:/\b1[A-Za-z0-9_-]{40,}\b/g, what:"Google Sheet or Drive file ID", ph:"<YOUR_SHEET_ID>"}
];
function runSan(box){
  const ta = box.querySelector("textarea"); const st = box.querySelector(".jl-status"); const list = box.querySelector("[data-o='finds']"); const out = box.querySelector("[data-o='clean']");
  let wf;
  try{ wf = JSON.parse(ta.value); }catch(e){ st.className = "jl-status jl-bad"; st.textContent = "Not valid JSON: " + e.message; list.innerHTML = ""; out.textContent = ""; return; }
  const finds = [];
  if(wf.pinData && Object.keys(wf.pinData).length) finds.push(["bad", `Pinned test data on ${Object.keys(wf.pinData).length} node(s). It ships inside the file, often with real customer records. Removed.`]);
  delete wf.pinData;
  let text = JSON.stringify(wf, null, 2);
  SAN_RULES.forEach(r => { const m = text.match(r.re); if(m){ const uniq = [...new Set(m)]; finds.push(["bad", `${r.what} × ${uniq.length}: ${uniq.map(x => x.length > 14 ? x.slice(0, 10) + "…" : x).join(", ")} → replaced with ${r.ph}`]); text = text.replace(r.re, r.ph); } });
  const creds = (text.match(/"credentials"\s*:/g) || []).length;
  if(creds) finds.push(["tip", `${creds} node(s) reference credentials by name and ID. That's fine (secrets aren't exported), but list in the README which credentials the buyer must create.`]);
  const hooks = (text.match(/"webhookId"\s*:/g) || []).length;
  if(hooks) finds.push(["tip", `${hooks} webhook ID(s). The buyer's n8n will create its own URL on import; say so in the README.`]);
  if(!finds.some(f => f[0] === "bad")) finds.unshift(["ok", "No secrets, personal data or pinned data found by these checks. Still read the file once yourself."]);
  st.className = "jl-status " + (finds.some(f => f[0] === "bad") ? "jl-bad" : "jl-ok");
  st.textContent = finds.filter(f => f[0] === "bad").length ? `${finds.filter(f => f[0] === "bad").length} problem type(s) found and cleaned below` : "Looks shippable";
  list.innerHTML = finds.map(([k, t]) => `<li class="${k}">${esc(t)}</li>`).join("");
  out.textContent = text;
}
lesson.addEventListener("input", e => { const b = e.target.closest("[data-sanit]"); if(b) runSan(b); });
const _initLesson34 = initLesson;
initLesson = function(el){ _initLesson34(el); el.querySelectorAll("[data-sanit]").forEach(runSan); };

/* Incident room (Module 6.4): pick the three real root causes */
function runIncident(box){
  const need = Number(box.dataset.need || 3);
  const labels = [...box.querySelectorAll(".cands label")];
  const picked = labels.filter(l => l.querySelector("input").checked);
  const vd = box.querySelector("[data-o='verdict']");
  labels.forEach(l => { l.classList.remove("hit","miss","wrong"); l.querySelector(".exp").hidden = true; });
  if(picked.length !== need){ vd.className = "mgoal bad"; vd.textContent = `Pick exactly ${need} root causes (you've picked ${picked.length}). Glitch broke ${need} things.`; return; }
  let hits = 0;
  labels.forEach(l => {
    const real = l.dataset.real === "1", on = l.querySelector("input").checked;
    if(real && on){ l.classList.add("hit"); hits++; }
    else if(real){ l.classList.add("miss"); }
    else if(on){ l.classList.add("wrong"); }
    if(real || on) l.querySelector(".exp").hidden = false;
  });
  vd.className = "mgoal " + (hits === need ? "ok" : "bad");
  vd.textContent = hits === need ? `✓ All ${need} found. Now write the incident note: what broke, how you noticed, the fix, and the alert you'll add so it can't hide again.` : `${hits} of ${need} found. Read the explanations, look at the feed again, and notice which faults never raised an alert.`;
}
lesson.addEventListener("click", e => { const b = e.target.closest("[data-incheck]"); if(b) runIncident(b.closest("[data-incident]")); });
lesson.addEventListener("change", e => { const b = e.target.closest("[data-incident]"); if(b){ b.querySelector("[data-o='verdict']").className = "mgoal"; b.querySelector("[data-o='verdict']").textContent = ""; b.querySelectorAll(".cands label").forEach(l => { l.classList.remove("hit","miss","wrong"); l.querySelector(".exp").hidden = true; }); } });

/* Results board (Module 6.4): before/after numbers into one headline */
function runResults(box){
  const v = k => Math.max(0, parseFloat(String(box.querySelector(`[data-rs="${k}"]`).value).replace(/,/g, "")) || 0);
  const wk = 52 / 12;
  const n = x => (x < 0 ? "−₦" : "₦") + Math.abs(Math.round(x)).toLocaleString("en-NG");
  const hrs = Math.max(0, v("bmin") - v("amin")) * v("orders") * wk / 60;
  const timeVal = hrs * v("rate");
  const won = Math.max(0, v("bmiss") - v("amiss")) * wk;
  const wonVal = won * v("aov") * Math.min(100, v("margin")) / 100;
  const net = timeVal + wonVal - v("run");
  box.querySelector("[data-o='hrs']").textContent = Math.round(hrs).toLocaleString("en-NG") + " h";
  box.querySelector("[data-o='tval']").textContent = n(timeVal);
  box.querySelector("[data-o='won']").textContent = Math.round(won).toLocaleString("en-NG");
  box.querySelector("[data-o='wval']").textContent = n(wonVal);
  box.querySelector("[data-o='net']").textContent = n(net);
  const vd = box.querySelector("[data-o='verdict']");
  vd.className = "mgoal " + (net > 0 ? "ok" : "bad");
  vd.textContent = net > 0
    ? `Headline: “${box.dataset.biz || "The business"} saves about ${Math.round(hrs)} hours a month and wins back about ${Math.round(won)} orders that used to slip away, worth roughly ${n(net)} a month after running costs.”`
    : "The running costs are bigger than the measured gains. Check your numbers, or find where the system isn't yet doing its job, before you present.";
}
lesson.addEventListener("input", e => { const b = e.target.closest("[data-results]"); if(b) runResults(b); });
const _initLesson35 = initLesson;
initLesson = function(el){ _initLesson35(el); el.querySelectorAll("[data-results]").forEach(runResults); };

/* Prospect lab (Lesson 5.2): ICP scoring, contact rules, outreach checker */
function runProspect(box){
  const cfg = JSON.parse(document.getElementById(box.dataset.prospect).textContent);
  const minR = parseFloat(box.querySelector("[data-pp='rating']").value);
  const needDel = box.querySelector("[data-pp='delivery']").checked;
  const bakeries = box.querySelector("[data-pp='bakery']").checked;
  const cap = Math.max(1, parseInt(box.querySelector("[data-pp='cap']").value, 10) || 1);
  box.querySelector("[data-o='rv']").textContent = minR.toFixed(1);
  const rows = cfg.biz.map(b => {
    let score = Math.max(0, Math.min(40, (b.rating - 3.5) / 1.3 * 40)) + Math.min(20, Math.log10(b.reviews + 1) * 6.7) + (b.delivery ? 25 : 0) + (b.website ? 15 : 0);
    score = Math.round(score);
    let fit = true, why = [];
    if(b.rating < minR){ fit = false; why.push(`rating below ${minR.toFixed(1)}`); }
    if(needDel && !b.delivery){ fit = false; why.push("no delivery"); }
    if(b.cat === "bakery" && !bakeries){ fit = false; why.push("bakery, outside ICP"); }
    const c = cfg.contact[b.contact];
    let act, cls;
    if(!fit){ act = "Skip: " + why.join(", "); cls = "tip"; }
    else if(c.ok === "email"){ act = score >= 60 ? "Research → draft email" : "Low fit: park for later"; cls = score >= 60 ? "ok" : "tip"; }
    else if(c.ok === "manual"){ act = c.act; cls = "tip"; }
    else { act = c.act; cls = "bad"; }
    return {b, score, act, cls, draft: fit && c.ok === "email" && score >= 60};
  });
  box.querySelector("tbody").innerHTML = rows.map(r => `<tr><td><b>${esc(r.b.name)}</b><br><small class="muted">${esc(r.b.area)} · ★${r.b.rating} (${r.b.reviews.toLocaleString()})</small></td><td>${r.b.delivery ? "Yes" : "No"}</td><td>${esc(cfg.contact[r.b.contact].label)}</td><td class="n">${r.score}</td><td><span class="pp-${r.cls}">${esc(r.act)}</span></td></tr>`).join("");
  const drafts = rows.filter(r => r.draft);
  const sel = box.querySelector("[data-pp='pick']"); const prev = sel.value;
  sel.innerHTML = drafts.map(r => `<option value="${esc(r.b.name)}">${esc(r.b.name)}</option>`).join("") || `<option value="">No one to email yet</option>`;
  if(drafts.some(r => r.b.name === prev)) sel.value = prev;
  // lint
  const tpl = box.querySelector("[data-pp='tpl']").value;
  const [subjLine, ...bodyLines] = tpl.split("\n"); const subj = subjLine.replace(/^subject:\s*/i, ""); const body = bodyLines.join("\n");
  const words = body.replace(/\{\{\w+\}\}/g, "x").split(/\s+/).filter(Boolean).length;
  const q = (body.match(/\?/g) || []).length;
  const caps = (body.replace(/\{\{\w+\}\}/g, "").match(/\b[A-Z]{4,}\b/g) || []).filter(w => w !== "STOP");
  const checks = [
    [/reply\s+stop|unsubscribe|opt[ -]?out|won.t (email|contact) (you )?again/i.test(body), "Easy opt-out in the message (e.g. “Reply STOP and I won't email again”)."],
    [/Harvest Lane/i.test(body) && /Ibadan/i.test(body), "Says who you are and where you are (name, business, city)."],
    [/\{\{fact\}\}/.test(body), "Uses a researched fact ({{fact}}), not a made-up compliment."],
    [words <= 120, `Short: ${words} words (aim for 120 or fewer).`],
    [q >= 1 && q <= 2, `A clear question to reply to (${q} question mark${q === 1 ? "" : "s"}; keep it to one or two).`],
    [!/!!|guarantee|100%|act now|risk[- ]free|\$\$/i.test(tpl) && !caps.length, caps.length ? `No shouting or spam words (found: ${caps.slice(0,3).join(", ")}).` : "No spam words or shouting."],
    [!/^\s*(re|fwd?):/i.test(subj), "Honest subject line (no fake “Re:” or “Fwd:”)."]
  ];
  box.querySelector("[data-o='lint']").innerHTML = checks.map(([ok, t]) => `<li class="${ok ? "ok" : "bad"}">${ok ? "✓" : "✗"} ${esc(t)}</li>`).join("");
  const pass = checks.every(c => c[0]);
  // preview
  const pick = drafts.find(r => r.b.name === sel.value);
  const out = box.querySelector("[data-o='preview']");
  if(!pick){ out.textContent = "No business passes the ICP and contact rules. Loosen the ICP, or find more sources."; }
  else {
    const f = pick.b.fact;
    const fill = s => s.replace(/\{\{business\}\}/g, pick.b.name).replace(/\{\{area\}\}/g, pick.b.area).replace(/\{\{fact\}\}/g, f || "[NO VERIFIED FACT: the agent must use a general line here, never invent one]");
    out.textContent = `Subject: ${fill(subj)}\n\n${fill(body).trim()}`;
  }
  const n = drafts.length, days = Math.ceil(n / cap);
  const vd = box.querySelector("[data-o='verdict']");
  vd.className = "mgoal " + (pass && cap <= 30 && n ? "ok" : "bad");
  vd.textContent = !n ? "No one to email yet." : !pass ? `Fix the ${checks.filter(c => !c[0]).length} failing check${checks.filter(c => !c[0]).length > 1 ? "s" : ""} before anything goes to Tolu for approval.` : cap > 30 ? `${n} drafts at ${cap} a day is too fast for a new sending domain. Start at 20–30 a day and grow slowly.` : `✓ Ready for approval: ${n} draft${n > 1 ? "s" : ""}, sent over ${days} day${days > 1 ? "s" : ""} at up to ${cap} a day, each one approved by Tolu first.`;
}
lesson.addEventListener("input", e => { const b = e.target.closest("[data-prospect]"); if(b) runProspect(b); });
lesson.addEventListener("change", e => { const b = e.target.closest("[data-prospect]"); if(b) runProspect(b); });
const _initLesson36 = initLesson;
initLesson = function(el){ _initLesson36(el); el.querySelectorAll("[data-prospect]").forEach(runProspect); };

/* Sentiment lab (Lesson 5.3): label, compare, tune the alert rule */
function runSenti(box){
  const cfg = JSON.parse(document.getElementById(box.dataset.senti).textContent);
  const thr = parseFloat(box.querySelector("[data-sl='thr']").value);
  box.querySelector("[data-o='thr']").textContent = thr.toFixed(2);
  const topics = [...box.querySelectorAll("[data-sl='topic']:checked")].map(i => i.value);
  const always = box.querySelector("[data-sl='safety']").checked;
  let mine = 0, matchRef = 0, matchAi = 0; const dis = [];
  const alerts = [], missed = [], falseA = [];
  cfg.items.forEach((it, i) => {
    const sel = box.querySelector(`[data-sl='lab'][data-i='${i}']`); const v = sel.value;
    if(v){ mine++; if(v === it.ref) matchRef++; if(v === it.ai) matchAi++; else dis.push(i + 1); }
    const fire = (it.ai === "negative" && it.conf >= thr && topics.includes(it.topic)) || (always && it.topic === "food safety");
    if(fire) alerts.push(i + 1);
    if(fire && !it.urgent) falseA.push(i + 1);
    if(!fire && it.urgent) missed.push(i + 1);
  });
  box.querySelector("[data-o='agree']").textContent = mine ? `You've labelled ${mine} of ${cfg.items.length}. You agree with the AI on ${matchAi} of ${mine}${dis.length ? ` (you disagree on #${dis.join(", #")})` : ""}.` + (mine === cfg.items.length ? ` Against the reference labels you scored ${matchRef}/${cfg.items.length}; the AI scored ${cfg.items.filter(it => it.ai === it.ref).length}/${cfg.items.length}.` : "") : "Label each comment yourself first. Then compare with the AI.";
  box.querySelectorAll("tbody tr").forEach((tr, i) => { const it = cfg.items[i]; tr.querySelector("[data-o='ai']").innerHTML = mine === cfg.items.length ? `${esc(it.ai)} <small>(${it.conf.toFixed(2)})</small>${it.ai === it.ref ? "" : ` <b class="sl-bad">ref: ${esc(it.ref)}</b>`}` : `${esc(it.ai)} <small>(${it.conf.toFixed(2)})</small>`; tr.classList.toggle("sl-alert", alerts.includes(i + 1)); });
  const vd = box.querySelector("[data-o='verdict']");
  const ok = !missed.length && falseA.length <= 1;
  vd.className = "mgoal " + (ok ? "ok" : "bad");
  vd.textContent = `Alerts fired: ${alerts.length ? "#" + alerts.join(", #") : "none"}. ` + (missed.length ? `Missed urgent: #${missed.join(", #")}. ` : "") + (falseA.length ? `False alarms: #${falseA.join(", #")}. ` : "") + (ok ? "✓ Every urgent item reaches Tolu, with at most one false alarm." : missed.length ? "An urgent complaint would sit unseen. Loosen the rule, or add a hard rule for what can never wait." : "Too many false alarms: Tolu will start ignoring them. Tighten the rule.");
}
lesson.addEventListener("input", e => { const b = e.target.closest("[data-senti]"); if(b) runSenti(b); });
lesson.addEventListener("change", e => { const b = e.target.closest("[data-senti]"); if(b) runSenti(b); });
const _initLesson37 = initLesson;
initLesson = function(el){ _initLesson37(el); el.querySelectorAll("[data-senti]").forEach(b => {
  const cfg = JSON.parse(document.getElementById(b.dataset.senti).textContent);
  b.querySelector("tbody").innerHTML = cfg.items.map((it, i) => `<tr><td class="n">${i + 1}</td><td>${esc(it.text)}<br><small class="muted">${esc(it.src)} · topic: ${esc(it.topic)}</small></td><td><select data-sl="lab" data-i="${i}" aria-label="Your label for comment ${i + 1}"><option value="">–</option><option>positive</option><option>neutral</option><option>negative</option></select></td><td data-o="ai"></td></tr>`).join("");
  runSenti(b); }); };

/* Post lab (Lesson 5.4): one idea, six platforms, each platform's rules */
const PL_RULES = {
  facebook:{n:"Facebook Page", max:63206, media:false, tags:3},
  instagram:{n:"Instagram", max:2200, media:true, tags:5, hardTags:5, linkTip:"Links in captions aren't clickable: say “link in bio”."},
  linkedin:{n:"LinkedIn Page", max:3000, media:false, tags:3},
  x:{n:"X", max:280, media:false, tags:2},
  tiktok:{n:"TikTok", max:2200, media:true, video:true, tags:5},
  whatsapp:{n:"WhatsApp", max:1024, media:false, tags:0}
};
function runPostLab(box){
  const base = box.querySelector("[data-pl='base']").value.trim();
  const xv = box.querySelector("[data-pl='xver']").value.trim();
  const media = box.querySelector("[data-pl='media']").value;
  const link = box.querySelector("[data-pl='link']").value.trim();
  const time = box.querySelector("[data-pl='time']").value;
  const plats = [...box.querySelectorAll("[data-pl='plat']:checked")].map(i => i.value);
  let errs = 0;
  const rows = plats.map(k => {
    const r = PL_RULES[k]; const txt = (k === "x" && xv) ? xv : base; const full = link && k !== "instagram" ? txt + " " + link : txt;
    const len = [...full].length; const tags = (txt.match(/#[\p{L}\p{N}_]+/gu) || []).length; const out = [];
    if(k === "whatsapp"){ out.push(["tip", "Not a feed: send only to customers who opted in, with an approved marketing template (5.1). Once a week at most."]); }
    if(len > r.max){ out.push(["bad", `Too long: ${len} of ${r.max} characters.${k === "x" ? " Write a short X version." : ""}`]); errs++; }
    if(r.media && media === "none"){ out.push(["bad", r.video ? "Needs a video (or photo carousel). Text-only posts aren't possible." : "Needs a photo or video. Text-only posts aren't possible."]); errs++; }
    else if(r.video && media === "photo"){ out.push(["tip", "Use a short video or a photo carousel; single photos do poorly here."]); }
    if(r.hardTags && tags > r.hardTags){ out.push(["bad", `${tags} hashtags; the limit is ${r.hardTags}.`]); errs++; }
    else if(k !== "whatsapp" && tags > r.tags){ out.push(["tip", `${tags} hashtags. ${r.tags} or fewer reads better here.`]); }
    if(k === "instagram" && link) out.push(["tip", r.linkTip]);
    if(k === "x") out.push(["tip", `Via the API this post costs $${link ? "0.20 (it has a link)" : "0.015"}.`]);
    if(k === "tiktok") out.push(["tip", "Until TikTok audits your app, API posts are private (SELF_ONLY). Send drafts for Tolu to publish in the app."]);
    if(!out.some(o => o[0] === "bad")) out.unshift(["ok", `${len} characters · ready`]);
    return `<tr><td><b>${r.n}</b></td><td>${out.map(o => `<div class="pl-${o[0]}">${o[0] === "ok" ? "✓" : o[0] === "bad" ? "✗" : "•"} ${esc(o[1])}</div>`).join("")}</td></tr>`;
  });
  const late = time === "03:00";
  box.querySelector("tbody").innerHTML = rows.join("") || `<tr><td colspan="2">Choose at least one platform.</td></tr>`;
  const vd = box.querySelector("[data-o='verdict']");
  vd.className = "mgoal " + (errs || late || !plats.length ? "bad" : "ok");
  vd.textContent = !plats.length ? "Choose where to post." : (errs ? `${errs} problem${errs > 1 ? "s" : ""} to fix before this goes to Tolu for approval. ` : "") + (late ? "3 a.m. reaches almost nobody: pick a time from your page insights, often lunchtime or early evening." : "") || `✓ Ready for approval: ${plats.length} platform version${plats.length > 1 ? "s" : ""}, scheduled for ${time}.`;
}
lesson.addEventListener("input", e => { const b = e.target.closest("[data-postlab]"); if(b) runPostLab(b); });
lesson.addEventListener("change", e => { const b = e.target.closest("[data-postlab]"); if(b) runPostLab(b); });
const _initLesson38 = initLesson;
initLesson = function(el){ _initLesson38(el); el.querySelectorAll("[data-postlab]").forEach(runPostLab); };

/* Inbox triage lab (Lesson 5.5) */
const IB_ACTS = [["","Choose…"],["public","Reply publicly"],["private","Private reply (one DM to the commenter)"],["dm","Reply in the DM thread"],["hide","Hide as spam"],["human","Hand to Tolu"],["ignore","No reply needed"]];
function initInbox(box){
  const cfg = JSON.parse(document.getElementById(box.dataset.inbox).textContent);
  box.querySelector("[data-o='queue']").innerHTML = cfg.items.map((it, i) => `<div class="ib-item" data-i="${i}">
    <div class="ib-meta"><b>${esc(it.platform)}</b> · ${esc(it.kind)} · ${esc(it.age)}</div>
    <p class="ib-text">“${esc(it.text)}”</p>
    <div class="ib-ctl"><select data-ib="act" aria-label="Action for item ${i + 1}">${IB_ACTS.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select>
    <label><input type="checkbox" data-ib="lead"> Save as lead</label></div>
    <p class="ib-fb" hidden></p></div>`).join("");
}
function runInbox(box){
  const cfg = JSON.parse(document.getElementById(box.dataset.inbox).textContent);
  let pts = 0, max = 0, unanswered = 0;
  box.querySelectorAll(".ib-item").forEach(el => {
    const it = cfg.items[+el.dataset.i]; const a = el.querySelector("[data-ib='act']").value; const lead = el.querySelector("[data-ib='lead']").checked;
    const fb = el.querySelector(".ib-fb"); max += 2;
    if(!a){ unanswered++; fb.hidden = true; el.classList.remove("ib-ok","ib-bad"); return; }
    const actOk = it.ok.includes(a), leadOk = lead === it.lead; pts += (actOk ? 1 : 0) + (leadOk ? 1 : 0);
    const banned = it.no && it.no[a];
    fb.hidden = false; el.classList.toggle("ib-ok", actOk && leadOk); el.classList.toggle("ib-bad", !(actOk && leadOk));
    fb.innerHTML = `${actOk ? "✓" : "✗"} ${banned ? `<b>${esc(banned)}</b> ` : ""}${esc(it.why)}${leadOk ? "" : it.lead ? " <b>This is a lead: save it, with its source.</b>" : " <b>Not a lead.</b>"}`;
  });
  const vd = box.querySelector("[data-o='verdict']");
  vd.className = "mgoal " + (unanswered ? "" : pts === max ? "ok" : "bad");
  vd.textContent = unanswered ? `${unanswered} message${unanswered > 1 ? "s" : ""} still waiting.` : pts === max ? `✓ ${pts}/${max}. Every message handled within the platform's rules, and every lead captured.` : `${pts}/${max}. Read the notes, then change your choices.`;
}
lesson.addEventListener("click", e => { const b = e.target.closest("[data-ibcheck]"); if(b) runInbox(b.closest("[data-inbox]")); });
const _initLesson39 = initLesson;
initLesson = function(el){ _initLesson39(el); el.querySelectorAll("[data-inbox]").forEach(initInbox); };

/* Deliverability lab (Lesson 5.6) */
const DL_PLANS = {brevo:{n:"Brevo Free", day:300, month:Infinity, contacts:100000, auto:"automation up to 2,000 contacts"}, mailchimp:{n:"Mailchimp Free", day:250, month:500, contacts:250, auto:"one single-email automation (such as a welcome email); multi-step flows need a paid plan"}, paid:{n:"a paid plan", day:Infinity, month:Infinity, contacts:Infinity, auto:"full automation"}};
function runDeliv(box){
  const v = k => box.querySelector(`[data-dl='${k}']`);
  const spf = v("spf").value.trim(), dmarc = v("dmarc").value.trim(), dkim = v("dkim").checked, from = v("from").value, plan = DL_PLANS[v("plan").value];
  const size = Math.max(0, parseInt(v("size").value, 10) || 0), src = v("src").value, unsub = v("unsub").checked, cr = Math.max(0, parseFloat(v("cr").value) || 0);
  const spfRecs = spf.split(/\n+/).filter(l => /v=spf1/i.test(l));
  const lookups = (spf.match(/\b(include|a|mx|ptr|exists|redirect)[:=]/gi) || []).length;
  const checks = [
    ["Sending from your own domain, not a free mailbox", from === "own", "A @gmail.com From address sent through an email tool fails DMARC at Gmail and Yahoo. Send from your own domain, ideally a subdomain like mail.harvestlane.example."],
    ["Exactly one SPF record", spfRecs.length === 1, spfRecs.length ? `${spfRecs.length} SPF records found. Merge them into one line.` : "No SPF record. Start it with v=spf1."],
    ["SPF ends safely (~all or -all, never +all)", /(\s|^)[~-]all\s*$/i.test(spfRecs[0] || ""), "+all lets anyone send as you. End with ~all (or -all once you're sure)."],
    ["SPF stays within 10 DNS lookups", lookups <= 10, `${lookups} lookups. Remove services you no longer use.`],
    ["DKIM set up from the email tool's domain settings", dkim, "Add the DKIM records your email tool gives you, then press verify in the tool."],
    ["DMARC record present and valid", /^v=DMARC1;\s*p=(none|quarantine|reject)/i.test(dmarc), "Add a TXT record at _dmarc with at least: v=DMARC1; p=none; rua=mailto:dmarc@yourdomain. Tighten to quarantine later."],
    ["One-click unsubscribe in every marketing email", unsub, "Gmail and Yahoo require one-click unsubscribe for bulk senders. Brevo and Mailchimp add it if you use their unsubscribe link."],
    ["Everyone on the list agreed to hear from you", src === "optin", src === "bought" ? "Bought lists contain people who never agreed, and spam traps. Delete it." : "WhatsApp or phone contacts didn't agree to email marketing. Ask them to opt in first."],
    [`Spam complaints under 0.1% (yours: ${cr}%)`, cr < 0.1, cr >= 0.3 ? "At 0.3% or more, Gmail and Yahoo start filtering or blocking you. Stop and fix the list." : "Between 0.1% and 0.3% is a warning zone. Check list quality and frequency."],
    [`The plan fits the list (${plan.n})`, size <= plan.contacts, `${plan.n} holds ${plan.contacts.toLocaleString()} contacts; you have ${size.toLocaleString()}.`]
  ];
  box.querySelector("[data-o='checks']").innerHTML = checks.map(([l, ok, fix]) => `<li class="${ok ? "ok" : "bad"}">${ok ? "✓" : "✗"} ${esc(l)}${ok ? "" : `<br><small>${esc(fix)}</small>`}</li>`).join("");
  const sendable = Math.min(size, plan.contacts);
  const days = plan.day === Infinity ? 1 : Math.ceil(sendable / plan.day);
  const monthNote = plan.month !== Infinity && sendable > plan.month ? ` It also exceeds the ${plan.month.toLocaleString()} emails a month the plan allows, so one newsletter won't reach everyone.` : "";
  box.querySelector("[data-o='plan']").textContent = sendable ? `One newsletter to ${sendable.toLocaleString()} contacts on ${plan.n} (${plan.day === Infinity ? "no daily cap" : plan.day + " a day"}, ${plan.auto}) takes ${days} day${days > 1 ? "s" : ""} to send.${monthNote}` : "Add contacts to see the sending plan.";
  const fails = checks.filter(c => !c[1]).length;
  const vd = box.querySelector("[data-o='verdict']");
  vd.className = "mgoal " + (fails ? "bad" : "ok");
  vd.textContent = fails ? `${fails} problem${fails > 1 ? "s" : ""} to fix before sending. Each one sends mail to spam, or gets you blocked.` : "✓ Authenticated, consented and within limits. This campaign can reach the inbox.";
}
lesson.addEventListener("input", e => { const b = e.target.closest("[data-deliv]"); if(b) runDeliv(b); });
lesson.addEventListener("change", e => { const b = e.target.closest("[data-deliv]"); if(b) runDeliv(b); });
const _initLesson40 = initLesson;
initLesson = function(el){ _initLesson40(el); el.querySelectorAll("[data-deliv]").forEach(runDeliv); };

/* Identity lab (Lesson 5.7): who is who across channels */
function initIdent(box){
  const cfg = JSON.parse(document.getElementById(box.dataset.ident).textContent);
  box.querySelector("[data-o='msgs']").innerHTML = cfg.msgs.map(m => `<div class="id-msg"><span class="id-n">${m.n}</span><span><b>${esc(m.ch)}</b> · ${esc(m.from)} · ${esc(m.at)}<br>“${esc(m.text)}”</span></div>`).join("");
  box.querySelector("[data-o='pairs']").innerHTML = cfg.pairs.map((p, i) => `<div class="id-pair" data-i="${i}"><div><b>Messages ${p.a} and ${p.b}</b><br><small>${esc(p.evidence)}</small></div>
    <select data-id="dec" aria-label="Decision for messages ${p.a} and ${p.b}"><option value="">Choose…</option><option value="merge">Merge automatically</option><option value="verify">Suggest, and verify before sharing details</option><option value="separate">Keep separate</option></select><p class="id-fb" hidden></p></div>`).join("");
}
function runIdent(box){
  const cfg = JSON.parse(document.getElementById(box.dataset.ident).textContent);
  let right = 0, done = 0;
  box.querySelectorAll(".id-pair").forEach(el => {
    const p = cfg.pairs[+el.dataset.i]; const v = el.querySelector("select").value; const fb = el.querySelector(".id-fb");
    if(!v){ fb.hidden = true; el.classList.remove("ib-ok","ib-bad"); return; }
    done++; const ok = v === p.best; if(ok) right++;
    el.classList.toggle("ib-ok", ok); el.classList.toggle("ib-bad", !ok);
    fb.hidden = false; fb.textContent = (ok ? "✓ " : "✗ ") + p.why;
  });
  const vd = box.querySelector("[data-o='verdict']"); const n = cfg.pairs.length;
  vd.className = "mgoal " + (done < n ? "" : right === n ? "ok" : "bad");
  vd.textContent = done < n ? `${n - done} decision${n - done > 1 ? "s" : ""} left.` : right === n ? "✓ All correct. Funke gets one answer, on the channel she used last; the other threads get a short “replied on WhatsApp” note. Nobody else's order is ever shown to her." : `${right} of ${n} correct. Merging the wrong people leaks private orders; failing to merge gives one customer three different answers.`;
}
lesson.addEventListener("change", e => { const b = e.target.closest("[data-ident]"); if(b) runIdent(b); });
const _initLesson41 = initLesson;
initLesson = function(el){ _initLesson41(el); el.querySelectorAll("[data-ident]").forEach(b => { initIdent(b); runIdent(b); }); };

/* Pick lab (Lesson 5.8): choose the right option for each item */
function initPick(box){
  const cfg = JSON.parse(document.getElementById(box.dataset.pick).textContent);
  const opts = `<option value="">Choose…</option>` + cfg.opts.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join("");
  box.querySelector("[data-o='items']").innerHTML = cfg.items.map((it, i) => `<div class="id-pair" data-i="${i}"><div><b>${i + 1}.</b> ${esc(it.t)}</div><select aria-label="${esc(cfg.label || "Stage for note")} ${i + 1}">${opts}</select><p class="id-fb" hidden></p></div>`).join("");
}
function runPick(box){
  const cfg = JSON.parse(document.getElementById(box.dataset.pick).textContent);
  let right = 0, done = 0;
  box.querySelectorAll(".id-pair").forEach(el => {
    const it = cfg.items[+el.dataset.i]; const v = el.querySelector("select").value; const fb = el.querySelector(".id-fb");
    if(!v){ fb.hidden = true; el.classList.remove("ib-ok","ib-bad"); return; }
    done++; const ok = v === it.best; if(ok) right++;
    el.classList.toggle("ib-ok", ok); el.classList.toggle("ib-bad", !ok);
    fb.hidden = false; fb.textContent = (ok ? "✓ " : "✗ ") + (ok ? it.why : "Not quite. " + (cfg.hint || "Check the exit rules in Card 2.") + " " + it.why);
  });
  const vd = box.querySelector("[data-o='verdict']"); const n = cfg.items.length;
  vd.className = "mgoal " + (done < n ? "" : right === n ? "ok" : "bad");
  vd.textContent = done < n ? `${n - done} left to place.` : right === n ? cfg.ok : `${right} of ${n} correct. ${cfg.bad}`;
}
lesson.addEventListener("change", e => { const b = e.target.closest("[data-pick]"); if(b) runPick(b); });
const _initLesson42 = initLesson;
initLesson = function(el){ _initLesson42(el); el.querySelectorAll("[data-pick]").forEach(b => { initPick(b); runPick(b); }); };

/* Lead scoring lab (Lesson 5.9): calibrate weights against real outcomes */
function initScore(box){
  const cfg = JSON.parse(document.getElementById(box.dataset.score).textContent);
  box.querySelector("[data-o='weights']").innerHTML = cfg.signals.map(([k, l, w]) => `<label>${esc(l)} (points)<input type="number" data-w="${k}" min="0" max="100" step="5" value="${w}"></label>`).join("");
  box.querySelector("[data-sc='threshold']").value = cfg.threshold;
}
function runScore(box){
  const cfg = JSON.parse(document.getElementById(box.dataset.score).textContent);
  const w = {}; box.querySelectorAll("[data-w]").forEach(i => { w[i.dataset.w] = Math.max(0, parseFloat(i.value) || 0); });
  const th = Math.max(0, parseFloat(box.querySelector("[data-sc='threshold']").value) || 0);
  const knock = box.querySelector("[data-sc='knock']").checked;
  let caught = 0, buyers = 0, falses = 0;
  const rows = cfg.leads.map(l => {
    const s = l.s.reduce((a, k) => a + (w[k] || 0), 0);
    const out = knock && !l.s.includes("zone");
    const ready = !out && s >= th;
    if(l.won){ buyers++; if(ready) caught++; } else if(ready) falses++;
    const ok = ready === l.won;
    return `<li class="${ok ? "ok" : "bad"}">${ready ? "📞" : "·"} <b>${esc(l.n)}</b>: ${s} pts${out ? " (outside zone)" : ""} · ${l.won ? "became a customer" : "never bought"}</li>`;
  });
  box.querySelector("[data-o='leads']").innerHTML = rows.join("");
  const vd = box.querySelector("[data-o='verdict']");
  const good = caught === buyers && falses === 0;
  vd.className = "mgoal " + (good ? "ok" : "bad");
  vd.textContent = good ? `✓ All ${buyers} buyers on the call-first list, and no false alarms. Now test it on next month's leads before trusting it.` : `Call-first list catches ${caught} of ${buyers} buyers, with ${falses} false alarm${falses === 1 ? "" : "s"}. ${caught < buyers ? "Some buyers would wait. Which signals do all four buyers share? " : ""}${falses ? "Tolu would waste calls. Which signals do the non-buyers have? Try the zone rule too." : ""}`;
}
lesson.addEventListener("input", e => { const b = e.target.closest("[data-score]"); if(b) runScore(b); });
lesson.addEventListener("change", e => { const b = e.target.closest("[data-score]"); if(b) runScore(b); });
const _initLesson43 = initLesson;
initLesson = function(el){ _initLesson43(el); el.querySelectorAll("[data-score]").forEach(b => { initScore(b); runScore(b); }); };
