
/* ================= AUTOMANCY PLATFORM (prototype) ================= */
const SKEY = "automancy-state-v1";
const S0 = {missions:{}, quizzes:{}, events:[], days:[], profile:{name:"", city:"", public:true}, pace:{mode:"standard", start:"", days:5, min:90}, instructor:false, cur:"NGN", journal:[], chat:{}, helps:0, helped:{}, claps:{}, replies:{}, challenge:null, votes:{}, draft:null};
const clone = o => JSON.parse(JSON.stringify(o));
function mergeState(raw){
  const x = Object.assign(clone(S0), raw && typeof raw === "object" ? raw : {});
  x.profile = Object.assign(clone(S0.profile), (raw && raw.profile) || {}); x.pace = Object.assign(clone(S0.pace), (raw && raw.pace) || {});
  ["events","days","journal"].forEach(k => { if(!Array.isArray(x[k])) x[k] = []; });
  ["missions","quizzes","chat","helped","claps","replies","votes"].forEach(k => { if(!x[k] || typeof x[k] !== "object" || Array.isArray(x[k])) x[k] = {}; });
  if(typeof x.helps !== "number") x.helps = 0;
  return x;
}
let S = clone(S0);
if(APP_MODE){ try{ S = mergeState(AM.progress && AM.progress.state); }catch(e){ S = clone(S0); } }
else { try{ S = mergeState(JSON.parse(localStorage.getItem(SKEY) || "{}")); }catch(e){ S = clone(S0); } }
const saveS = () => { if(APP_MODE){ queueSync(); return; } try{ localStorage.setItem(SKEY, JSON.stringify(S)); }catch(e){} };
const on = (sel, ev, fn) => { const el = document.querySelector(sel); if(el) el.addEventListener(ev, fn); };
const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => [...el.querySelectorAll(sel)];
const pad = n => String(n).padStart(2, "0");
const dk = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const fmtD = d => d.toLocaleDateString("en-GB", {day:"numeric", month:"short"});
const ngn = n => "₦" + Math.round(n).toLocaleString("en-NG");
const usd = n => "$" + Math.round(n).toLocaleString("en-US");
const initials = n => (String(n).trim().split(/\s+/).map(w => w[0]).join("").slice(0,2) || "Y").toUpperCase();
const myName = () => (APP_MODE ? String((AM.user && AM.user.name) || "").trim() : S.profile.name.trim()) || "You";
let currentId = null;

/* No sample people: everything here is the learner's own data, or real data from the app's APIs. */
const mini = (name, col, cls="mini") => `<span class="${cls}" style="background:${col}" aria-hidden="true">${esc(initials(name))}</span>`;
const myCol = "var(--sky)";

/* ---------- toast, modal, XP burst ---------- */
function toast(msg){ const h = $("#toastHost"); h.innerHTML = `<div class="toast" role="status">${esc(msg)}</div>`; clearTimeout(toast.t); toast.t = setTimeout(() => h.innerHTML = "", 3600); }
function modal(html){ const h = $("#modalHost"); h.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><div class="modal-box"><button type="button" class="xbtn" data-close>Close</button>${html}</div></div>`; const b = h.querySelector(".modal-box"); const f = b.querySelector("input,button:not(.xbtn),a"); (f || b.querySelector(".xbtn")).focus(); }
function closeModal(){ $("#modalHost").innerHTML = ""; }
document.addEventListener("click", e => { if(e.target.closest("[data-close]") || e.target.classList.contains("modal")) closeModal(); });
document.addEventListener("keydown", e => { if(e.key === "Escape") closeModal(); });
function burst(txt){ const d = document.createElement("div"); d.className = "xpburst"; d.textContent = txt; document.body.appendChild(d); setTimeout(() => d.remove(), 2300); }

/* ---------- activity, XP, streaks, levels ---------- */
function markActive(){ const k = dk(new Date()); if(!S.days.includes(k)) S.days.push(k); }
function award(xp, text){ S.events.unshift({t:Date.now(), xp, text}); S.events = S.events.slice(0, 300); if(xp > 0) markActive(); saveS(); if(xp > 0) burst(`+${xp} XP · ${text}`); refreshPlatform(); }
function onModuleToggle(id, on){
  const it = ORDER.find(o => o.id === id); const name = it ? (id.startsWith("B") ? "Boss " + id.slice(1) : "Lesson " + id) : id;
  const xp = id.startsWith("B") ? 300 : id === "6.4" ? 400 : 100;
  award(on ? xp : -xp, on ? `${name} complete` : `${name} unticked`);
}
function onQuizDone(quiz, score){
  if(!currentId) return; const prev = S.quizzes[currentId] || 0;
  if(score > prev){ S.quizzes[currentId] = score; const gain = (score >= 4 && prev < 4 ? 20 : 0) + (score === 5 && prev < 5 ? 10 : 0); if(gain) award(gain, `Quiz ${score}/5 on ${currentId}`); else saveS(); }
}
const MXP = {b:25, s:50, g:100};
function streakInfo(){
  const set = new Set(S.days); let cur = 0, freezes = 2; const used = [];
  let d = new Date(); if(!set.has(dk(d))) d = addDays(d, -1);
  for(let i = 0; i < 400; i++){
    const k = dk(d);
    if(set.has(k)) cur++;
    else if(freezes > 0 && cur > 0 && set.has(dk(addDays(d, -1)))){ freezes--; used.push(k); }
    else break;
    d = addDays(d, -1);
  }
  let best = 0, run = 0, last = null;
  [...set].sort().forEach(k => { const t = new Date(k + "T12:00:00"); run = last && Math.round((t - last) / 864e5) === 1 ? run + 1 : 1; best = Math.max(best, run); last = t; });
  return {cur, best:Math.max(best, cur), freezesLeft:freezes, used};
}
function weekStart(d){ const x = new Date(d); const w = (x.getDay() + 6) % 7; x.setDate(x.getDate() - w); x.setHours(0,0,0,0); return x; }
function weekGoal(){
  const goal = S.pace.mode === "standard" ? 5 : Number(S.pace.days); const set = new Set(S.days);
  const count = ws => { let n = 0; for(let i = 0; i < 7; i++) if(set.has(dk(addDays(ws, i)))) n++; return n; };
  let ws = weekStart(new Date()); const thisWeek = count(ws); let streak = 0;
  if(thisWeek >= goal) streak++;
  ws = addDays(ws, -7);
  while(count(ws) >= goal && streak < 200){ streak++; ws = addDays(ws, -7); }
  return {goal, thisWeek, streak};
}
function xpParts(){
  let mod = 0, boss = 0, mis = 0, quiz = 0;
  Object.keys(done).forEach(k => { if(!done[k]) return; if(k.startsWith("B")) boss += 300; else mod += (k === "6.4" ? 400 : 100); });
  Object.entries(S.missions).forEach(([k, v]) => { if(v) mis += MXP[k.split(":")[1]] || 0; });
  Object.values(S.quizzes).forEach(s => { if(s >= 4) quiz += 20; if(s === 5) quiz += 10; });
  const jour = S.journal.length * 10, help = S.helps * 15, chal = S.challenge ? 50 : 0;
  const bonus = Math.floor(streakInfo().best / 7) * 50;
  return {mod, boss, mis, quiz, jour, help, chal, bonus, total: mod + boss + mis + quiz + jour + help + chal + bonus};
}
const weekXp = () => { const since = Date.now() - 7 * 864e5; return Math.max(0, S.events.filter(e => e.t >= since).reduce((s, e) => s + e.xp, 0)); };
function levelOf(xp){ let i = 0; LV.forEach(([t], j) => { if(xp >= t) i = j; }); const nx = LV[i+1]; return {name:LV[i][1], idx:i, at:LV[i][0], next:nx ? nx[1] : null, nextAt:nx ? nx[0] : null}; }
const doneCount = () => Object.keys(done).filter(k => done[k]).length;
const nextItem = () => ORDER.find(o => !done[o.id]);

/* ---------- badges ---------- */
const BADGES = [
  {id:"first", n:"First Step", d:"Finish your first lesson.", c:"var(--teal)", g:"1", t:() => doneCount() >= 1},
  {id:"B0", n:"Blueprint", d:"Beat Boss 0 · The Order Flood.", c:"var(--teal)", g:"B0", t:() => done.B0},
  {id:"B1", n:"First Spark", d:"Beat Boss 1 · The Lead Machine (Zapier).", c:"var(--sun)", g:"B1", t:() => done.B1},
  {id:"B2", n:"Eight Arms", d:"Beat Boss 2 · Receipt-to-Books (Make).", c:"var(--volt)", g:"B2", t:() => done.B2},
  {id:"B3", n:"Self-Hosted", d:"Beat Boss 3 · The Telegram Order Bot (n8n).", c:"var(--spark)", g:"B3", t:() => done.B3},
  {id:"B4", n:"Agent Tamer", d:"Beat Boss 4 · Sage Desk (AI agents).", c:"var(--grape)", g:"B4", t:() => done.B4},
  {id:"B5", n:"Signal Boost", d:"Beat Boss 5 · Growth Desk.", c:"var(--rose)", g:"B5", t:() => done.B5},
  {id:"auto", n:"Autopilot", d:"Complete the Grand Capstone.", c:"var(--sky)", g:"6.4", t:() => done["6.4"]},
  {id:"fire", n:"On Fire", d:"Reach a 7-day streak.", c:"var(--spark)", g:"7d", t:() => streakInfo().best >= 7},
  {id:"unstop", n:"Unstoppable", d:"Reach a 30-day streak.", c:"var(--glitch)", g:"30", t:() => streakInfo().best >= 30},
  {id:"gold", n:"Gold Standard", d:"Complete your first Gold mission.", c:"var(--sun)", g:"Au", t:() => Object.keys(S.missions).some(k => S.missions[k] && k.endsWith(":g"))},
  {id:"sharp", n:"Sharp Mind", d:"Score 5/5 on five quizzes.", c:"var(--grape)", g:"5/5", t:() => Object.values(S.quizzes).filter(s => s === 5).length >= 5},
  {id:"book", n:"Open Book", d:"Post three learning journal entries.", c:"var(--teal)", g:"J3", t:() => S.journal.length >= 3},
  {id:"helper", n:"Helping Hand", d:"Help three learners on the help board.", c:"var(--volt)", g:"H3", t:() => S.helps >= 3},
  {id:"chal", n:"Challenger", d:"Enter a weekly challenge.", c:"var(--spark)", g:"W", t:() => !!S.challenge},
  {id:"cert", n:"Certified", d:"Earn the Certificate in AI Automation.", c:"var(--ink)", g:"AA", t:() => certStatus().ok}
];
function badgeSVG(b){
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 3 L57 17 V47 L32 61 L7 47 V17 Z" fill="${b.c}" stroke="var(--ink)" stroke-width="3" stroke-linejoin="round"/><path d="M32 11 L50 21 V43 L32 53 L14 43 V21 Z" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="2"/><text x="32" y="38" text-anchor="middle" font-family="Bricolage Grotesque,sans-serif" font-weight="800" font-size="${b.g.length > 2 ? 12 : 16}" fill="#fff">${esc(b.g)}</text></svg>`;
}

/* ---------- views + router ---------- */
const VIEWS = APP_MODE ? ["course","dashboard"] : ["home","course","dashboard","community","challenges","hire","pricing","business","certificate","earn","careers"];
/* App mode: views that live elsewhere in the app open their Next.js route (window.AUTOMANCY.links). */
const EXT = (() => {
  if(!APP_MODE) return {};
  const L = AM.links || {}, acct = L.account || "/account";
  return {community:L.community, challenges:L.community, hire:L.hire, "hire-post":L.hire, "hire-talent":L.hire, pricing:L.pricing, business:L.pricing,
    earn:L.earn, "earn-links":L.earn, "earn-calc":L.earn, careers:L.careers, "careers-paths":L.careers, "careers-crm":L.careers,
    certificate:acct + "#certificate", account:acct, leaderboard:L.leaderboard};
})();
if(APP_MODE){
  document.addEventListener("click", e => {
    const a = e.target.closest('a[href^="#"]'); if(!a) return;
    const h = a.getAttribute("href").slice(1); if(EXT[h]){ e.preventDefault(); location.assign(EXT[h]); }
  }, true);
}
const VTITLE = {home:"", course:"Course", dashboard:"My dashboard", community:"Community", challenges:"Weekly challenges", hire:"Hire talent", pricing:"Pricing", business:"For business", certificate:"Certificate", earn:"Refer & earn", careers:"Careers"};
let curView = APP_MODE ? "course" : "home";
function showView(h){
  if(APP_MODE){ if(EXT[h]){ location.replace(EXT[h]); return; } if(!h || h === "home") h = "course"; }
  let v = VIEWS.includes(h) ? h : null, anchor = null;
  if(!v && h){ const el = document.getElementById(h); const host = el && el.closest(".view"); if(host){ v = host.dataset.view; anchor = el; } }
  if(!v) v = APP_MODE ? "course" : "home";
  curView = v; currentId = null; stopSpeech();
  lesson.hidden = true; hub.hidden = false; document.body.classList.remove("printall");
  $$(".view", hub).forEach(x => x.hidden = x.dataset.view !== v);
  $$("#mainnav a").forEach(a => { if(a.dataset.nav === (v === "certificate" ? "course" : v)) a.setAttribute("aria-current","page"); else a.removeAttribute("aria-current"); });
  closeMenu();
  document.title = VTITLE[v] ? `${VTITLE[v]} · Automancy Academy` : "Automancy Academy";
  renderView(v);
  if(anchor) setTimeout(() => anchor.scrollIntoView(), 0); else window.scrollTo(0, 0);
}
function renderView(v){
  ({home:renderHome, course:renderCourse, dashboard:renderDash, community:renderCommunity, challenges:renderChallenges, hire:renderHire, pricing:renderPricing, business:renderBusiness, certificate:renderCert, earn:renderEarn}[v] || (()=>{}))();
}
function closeMenu(){ const n = $("#mainnav"); n.classList.remove("open"); $("#menuBtn").setAttribute("aria-expanded","false"); }
on("#menuBtn", "click", () => { const n = $("#mainnav"); const o = n.classList.toggle("open"); $("#menuBtn").setAttribute("aria-expanded", String(o)); });

function refreshPlatform(){
  const xp = xpParts().total, st = streakInfo();
  $("#navXp").textContent = xp.toLocaleString() + " XP";
  $("#navStreak").textContent = st.cur;
  $("#navAv").textContent = initials(myName());
  if(APP_MODE){ const n = nextItem(), c = $("#hdrCta"); if(c){ c.href = n ? "#" + tok(n.id) : EXT.certificate; c.textContent = n ? (doneCount() ? "Continue" : "Start") : "Certificate"; } }
  document.body.classList.toggle("instructor", !!S.instructor);
  if(!hub.hidden) renderView(curView);
}

/* ---------- HOME ---------- */
const AUD = {
  seeker:{p:"You've applied for months, and every role asks for experience with AI tools you've never been taught to use.", g:"Build six working systems in thirteen weeks, with a guide and a community. Each one goes in your portfolio.", s:"A verified portfolio, a Certificate in AI Automation, and a profile on our hiring page.", cta:["Start free", "#m-0-1"]},
  pro:{p:"Your week disappears into copy-paste, reports and follow-ups, and you can see AI changing your job.", g:"Automate your own work first, one 90-minute lesson a day at a pace that fits around your job.", s:"Hours back every week, and you become the person your company calls when it wants AI to do real work.", cta:["Start free", "#m-0-1"]},
  owner:{p:"Orders arrive on WhatsApp, payments need checking, and your staff spend their day typing instead of selling.", g:"Find out what to automate with a free audit, then train your team in two days or hire a graduate to build it.", s:"Orders confirmed in seconds, fewer mistakes, and a business that keeps running when you step away.", cta:["Run the free automation audit", "#business"]},
  hirer:{p:"Every CV says “AI”, but few candidates have built anything you can check.", g:"Once the first learners graduate, you'll be able to browse their verified projects, badges and capstone results, and request an introduction.", s:"An automation builder who can show you their work before you hire them.", cta:["How hiring will work", "#hire"]}
};
function renderAud(key){
  const a = AUD[key];
  $("#audBody").innerHTML = `<div><h4>The problem</h4><p>${esc(a.p)}</p></div><div><h4>How we help</h4><p>${esc(a.g)}</p></div><div><h4>Where you'll be</h4><p class="win">${esc(a.s)}</p><p style="margin-top:12px"><a class="cta sm" href="${a.cta[1]}">${esc(a.cta[0])}</a></p></div>`;
  $$("#audTabs button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.aud === key)));
}
on("#audTabs", "click", e => { const b = e.target.closest("button"); if(b) renderAud(b.dataset.aud); });
const FEATS = [
  ["#tolu","Story-led lessons","Every lesson opens with a problem at Harvest Lane. You learn by fixing it."],
  ["#nodo","Labs in your browser","Calculators, simulators and code sandboxes that check your work, with nothing to install."],
  ["#glitch","Glitch hunts","Find and fix a broken workflow in every lesson. That's how you learn to debug."],
  ["#bolt","Missions with model answers","Bronze, Silver and Gold problems, with worked solutions to compare against."],
  ["#weave","Community and journal","Chat rooms by track, a learning journal, and a help board where peers unblock you."],
  ["#sage","Weekly challenges","A real business brief every Monday. The best solutions are featured."],
  ["#tolu","Certificate and hiring page","A verifiable certificate, and a profile on our hiring page when you graduate."],
  ["#sage","Listen to any lesson","A free Listen button on every lesson. Story Mode adds character voices."]
];
function renderHome(){
  if(!$("#audBody").innerHTML) renderAud("seeker");
  $("#featGrid").innerHTML = FEATS.map(f => `<div class="tile"><svg class="ic" viewBox="0 0 120 120" aria-hidden="true"><use href="${f[0]}"/></svg><h3>${esc(f[1])}</h3><p>${esc(f[2])}</p></div>`).join("");
  $("#homePlans").innerHTML = PLANS.slice(0,3).map(p => `<div class="tile"><h3>${esc(p.n)}</h3><div class="price" style="font-family:var(--display);font-weight:800;font-size:1.7rem">${priceTxt(p)}</div><p>${esc(p.tag)}</p></div>`).join("");
}

/* ---------- COURSE ---------- */
function renderCourse(){
  const n = nextItem(); const a = $("#courseResume");
  if(n){ a.href = "#" + tok(n.id); a.textContent = doneCount() ? `Continue: ${n.id.startsWith("B") ? "Boss " + n.id.slice(1) : "lesson " + n.id}` : "Start lesson 0.1"; } else { a.href = "#certificate"; a.textContent = "Claim your certificate"; }
}

/* ---------- DASHBOARD ---------- */
let lbTab = "week";
function renderDash(){
  const xp = xpParts(), lv = levelOf(xp.total), st = streakInfo(), wg = weekGoal(), nm = myName();
  $("#dashHello").textContent = S.profile.name ? `Welcome back, ${S.profile.name.split(" ")[0]}` : "Welcome to your dashboard";
  $("#dAv").textContent = initials(nm); $("#dName").textContent = nm;
  $("#dLevelLine").textContent = `${lv.name} · ${xp.total.toLocaleString()} XP${S.profile.city ? " · " + S.profile.city : ""}`;
  $("#dLvFill").style.width = lv.nextAt ? Math.min(100, (xp.total - lv.at) / (lv.nextAt - lv.at) * 100) + "%" : "100%";
  $("#dLvNext").textContent = lv.nextAt ? `${(lv.nextAt - xp.total).toLocaleString()} XP to ${lv.next}` : "Top level reached: Orchestrator";
  $("#kXp").textContent = xp.total.toLocaleString(); $("#kWeek").textContent = weekXp().toLocaleString(); $("#kStreak").textContent = st.cur; $("#kDone").textContent = doneCount();
  const n = nextItem(); const nx = $("#dNext");
  if(n){ nx.href = "#" + tok(n.id); nx.textContent = `${doneCount() ? "Continue" : "Start"}: ${n.id.startsWith("B") ? "Boss " + n.id.slice(1) : "lesson " + n.id} · ${n.t}`; } else { nx.href = "#certificate"; nx.textContent = "Claim your certificate"; }
  // streak week strip
  const set = new Set(S.days), ws = weekStart(new Date()), today = dk(new Date());
  $("#week7").innerHTML = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d, i) => { const k = dk(addDays(ws, i)); const cls = set.has(k) ? "on" : st.used.includes(k) ? "fz" : ""; return `<div><i class="${cls} ${k === today ? "today" : ""}" title="${k}"></i>${d}</div>`; }).join("");
  $("#dStreakNote").textContent = st.cur ? `${st.cur}-day streak · best ${st.best}` : "Learn on any day to start a streak";
  $("#dFreeze").textContent = `Streak freezes left: ${st.freezesLeft} of 2. A freeze protects your streak when you miss a single day.`;
  $("#dWeekGoal").innerHTML = `Weekly goal: <b>${wg.thisWeek} of ${wg.goal}</b> learning days this week · ${wg.streak} week${wg.streak === 1 ? "" : "s"} in a row on target. Every 7-day streak earns a 50 XP bonus.`;
  // badges
  const earned = BADGES.filter(b => b.t());
  $("#dBadgeCount").textContent = `${earned.length} of ${BADGES.length} earned`;
  $("#badgeGrid").innerHTML = BADGES.map(b => `<button type="button" class="bdg ${b.t() ? "" : "locked"}" data-badge="${b.id}">${badgeSVG(b)}<span>${esc(b.n)}</span></button>`).join("");
  renderPace(); renderLB(); renderFeed(); renderRef();
  if($("#setName")){ $("#setName").value = S.profile.name; $("#setCity").value = S.profile.city; $("#setPublic").checked = S.profile.public; }
  $("#setInstructor").checked = !!S.instructor;
  const lc = $("#liveCalls"); if(lc) lc.hidden = !(APP_MODE && AM.settings && AM.settings.live_calls_visible);
}
on("#badgeGrid", "click", e => {
  const b = e.target.closest("[data-badge]"); if(!b) return; const bd = BADGES.find(x => x.id === b.dataset.badge); const got = bd.t();
  modal(`<div style="display:grid;grid-template-columns:90px 1fr;gap:14px;align-items:center"><div style="width:90px">${badgeSVG(bd)}</div><div><h3>${esc(bd.n)}</h3><p>${esc(bd.d)}</p><p class="note">${got ? "Earned." : "Not earned yet."}</p></div></div>${got ? shareBlock(`I just earned the ${bd.n} badge at Automancy Academy, learning to build AI automations.`) : ""}`);
});
// pace + schedule
const SESS = id => id.startsWith("B") ? 2 : id === "6.4" ? 3 : 1;
function paceDays(){ return S.pace.mode === "standard" ? 5 : Math.max(1, Math.min(7, Number(S.pace.days) || 5)); }
function renderPace(){
  $$("#paceTabs button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.pace === S.pace.mode)));
  const custom = S.pace.mode === "custom";
  $("#paceDays").disabled = !custom; $("#paceMin").disabled = !custom;
  $("#paceDays").value = String(paceDays()); $("#paceMin").value = String(custom ? S.pace.min : 90);
  const start = S.pace.start ? new Date(S.pace.start + "T12:00:00") : (S.days.length ? new Date([...S.days].sort()[0] + "T12:00:00") : new Date());
  $("#paceStart").value = dk(start);
  const per = paceDays(); let cum = 0; const weeks = [];
  ORDER.forEach(o => { const w = Math.floor(cum / per); (weeks[w] = weeks[w] || []).push(o.id); cum += SESS(o.id); });
  const total = cum, nWeeks = Math.ceil(total / per), end = addDays(start, nWeeks * 7 - 1);
  $("#paceEnd").textContent = end.toLocaleDateString("en-GB", {day:"numeric", month:"short", year:"numeric"});
  const elapsedDays = Math.max(0, Math.floor((new Date() - start) / 864e5));
  const expectSess = Math.min(total, Math.floor(elapsedDays / 7 * per));
  let doneSess = 0; ORDER.forEach(o => { if(done[o.id]) doneSess += SESS(o.id); });
  const diff = doneSess - expectSess;
  $("#paceStatus").innerHTML = `${total} sessions of ${custom ? S.pace.min : 90} minutes, ${per} a week. ` + (doneSess === 0 && expectSess === 0 ? `<span class="pill2 info">Starts ${fmtD(start)}</span>` : diff >= 2 ? `<span class="pill2 ok">Ahead by ${diff} sessions</span>` : diff >= -1 ? `<span class="pill2 ok">On track</span>` : `<span class="pill2 warn">Behind by ${-diff} sessions</span> Catch up at the weekend, or set a gentler pace.`);
  const curW = Math.floor(elapsedDays / 7);
  $("#sched").innerHTML = weeks.map((ids, i) => { const a = addDays(start, i * 7), b = addDays(a, 6); const allDone = ids.every(id => done[id]); return `<div class="${i === curW ? "now" : i < curW ? "past" : ""}"><b>Week ${i + 1}</b><span>${ids.map(id => id.startsWith("B") ? "Boss " + id.slice(1) : id).join(" · ")}</span><em>${fmtD(a)}–${fmtD(b)}${allDone ? " ✓" : ""}</em></div>`; }).join("");
}
on("#paceTabs", "click", e => { const b = e.target.closest("button"); if(!b) return; S.pace.mode = b.dataset.pace; saveS(); renderPace(); });
["paceStart","paceDays","paceMin"].forEach(id => on("#" + id, "change", () => { S.pace.start = $("#paceStart").value; if(S.pace.mode === "custom"){ S.pace.days = Number($("#paceDays").value); S.pace.min = Number($("#paceMin").value); } saveS(); renderPace(); renderDashKpisOnly(); }));
function renderDashKpisOnly(){ const wg = weekGoal(); $("#dWeekGoal").innerHTML = `Weekly goal: <b>${wg.thisWeek} of ${wg.goal}</b> learning days this week · ${wg.streak} week${wg.streak === 1 ? "" : "s"} in a row on target. Every 7-day streak earns a 50 XP bonus.`; }
// leaderboard: the prototype shows only you; the app reads GET /api/community/leaderboard (public profiles only)
const lbCache = {};
function lbRow(r, i, unit){ return `<tr class="${r.me ? "you" : ""}"><td class="rank">${i + 1}</td><td><div class="who">${mini(r.n, r.col || "var(--muted)")}<span>${esc(r.n)}${r.me ? " (you)" : ""}<br><small class="note">${esc(r.c || "")}${r.items != null ? (r.c ? " · " : "") + r.items + " done" : ""}</small></span></div></td><td class="n">${Number(r.v || 0).toLocaleString()} ${unit}</td></tr>`; }
function renderLB(){
  if(APP_MODE){ $$("#lbTabs button").forEach(b => { if(b.dataset.lb === "streak") b.hidden = true; }); if(lbTab === "streak") lbTab = "week"; }
  $$("#lbTabs button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.lb === lbTab)));
  const unit = lbTab === "streak" ? "days" : "XP";
  const head = `<thead><tr><th>#</th><th>Learner</th><th class="n">${lbTab === "week" ? "XP this week" : lbTab === "all" ? "Total XP" : "Streak"}</th></tr></thead>`;
  const empty = msg => `<tbody><tr><td colspan="3" class="note" style="padding:14px 8px">${esc(msg)}</td></tr></tbody>`;
  if(!APP_MODE){
    const me = {n:myName(), c:S.profile.city, col:myCol, me:true, v:lbTab === "week" ? weekXp() : lbTab === "all" ? xpParts().total : streakInfo().cur};
    $("#lbTable").innerHTML = head + "<tbody>" + lbRow(me, 0, unit) + "</tbody>";
    $("#lbLeague").textContent = "Real learners will appear here once the course opens.";
    return;
  }
  const scope = lbTab === "all" ? "all" : "week";
  const draw = (rows, err) => {
    if(lbTab !== (scope === "all" ? "all" : "week")) return;
    $("#lbTable").innerHTML = head + (rows.length ? "<tbody>" + rows.slice(0, 20).map((r, i) => lbRow({n:r.name || "Learner", c:r.city, v:r.xp, items:r.items}, i, unit)).join("") + "</tbody>"
      : empty(err ? "The leaderboard couldn't load. Try again in a moment." : "No one is on the board yet. Learners who choose to appear publicly will show here as they earn XP."));
    $("#lbLeague").innerHTML = `Only learners who chose a public profile are listed. Change yours in <a href="${esc(EXT.account)}">your account</a>.${EXT.leaderboard ? ` <a href="${esc(EXT.leaderboard)}">Full leaderboard →</a>` : ""}`;
  };
  const c = lbCache[scope];
  if(c){ draw(c.rows, c.err); if(Date.now() - c.at < 60000) return; }
  else $("#lbTable").innerHTML = head + empty("Loading…");
  lbCache[scope] = Object.assign(c || {rows:[]}, {at:Date.now()});
  fetch((AM.api || "/api") + "/community/leaderboard?scope=" + scope, {credentials:"same-origin"})
    .then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(rows => { lbCache[scope] = {rows:Array.isArray(rows) ? rows : [], at:Date.now()}; draw(lbCache[scope].rows); })
    .catch(() => { lbCache[scope] = {rows:[], at:Date.now(), err:true}; draw([], true); });
}
on("#lbTabs", "click", e => { const b = e.target.closest("button"); if(b){ lbTab = b.dataset.lb; renderLB(); } });
// your activity (only your own events)
function renderFeed(){
  const mine = S.events.filter(e => e.xp > 0).slice(0, 12);
  $("#feed").innerHTML = mine.length ? mine.map(e => `<li>${mini(myName(), myCol)}<span><b>${esc(myName())}</b>: ${esc(e.text)}<small>${esc(rel(e.t))}</small></span></li>`).join("")
    : `<li><span class="note">Your lessons, quizzes and missions will show here as you finish them.</span></li>`;
}
function rel(t){ const m = Math.round((Date.now() - t) / 6e4); return m < 1 ? "just now" : m < 60 ? m + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : Math.round(m / 1440) + " d ago"; }
// referral + share
function refCode(){ const base = (S.profile.name || "").replace(/[^A-Za-z]/g, "").slice(0, 5).toUpperCase() || "AUTO"; let h = 0; for(const ch of (S.profile.name || "you") + "aa") h = (h * 31 + ch.charCodeAt(0)) % 9000; return `${base}${h + 1000}`; }
const SITE_HOST = APP_MODE && AM.siteUrl ? String(AM.siteUrl).replace(/^https?:\/\//, "").replace(/\/$/, "") : "automancy.twellr.com";
function shareBlock(text){
  const t = encodeURIComponent(text + " Start free: ${SITE_HOST}");
  return `<div class="sharecard"><svg viewBox="0 0 120 120" aria-hidden="true"><use href="#bolt"/></svg><div><b>${esc(text)}</b><p class="note">${esc(SITE_HOST)}</p></div></div>
  <div class="sharelinks"><a class="cta sm" href="https://wa.me/?text=${t}" target="_blank" rel="noopener">WhatsApp</a><a class="cta alt sm" href="https://www.linkedin.com/feed/?shareActive=true&text=${t}" target="_blank" rel="noopener">LinkedIn</a><a class="cta alt sm" href="https://twitter.com/intent/tweet?text=${t}" target="_blank" rel="noopener">X</a><button type="button" class="cta alt sm" data-copytext="${esc(text)} Start free: ${SITE_HOST}">Copy text</button></div>`;
}
function renderRef(){
  if(!$("#refLink")) return;
  const code = refCode();
  $("#refLink").textContent = `automancy.twellr.com/r/${code}`;
  $("#refShare").innerHTML = shareBlock(`I'm learning to build AI automations with Automancy Academy. Join with my code ${code} and get 10% off (I earn a commission if you join).`).replace(/<div class="sharecard">[\s\S]*?<\/div><\/div>/, "");
}
document.addEventListener("click", e => {
  const c = e.target.closest("[data-copytext]");
  if(c){ const txt = c.dataset.copytext; try{ navigator.clipboard.writeText(txt).then(() => { c.textContent = "Copied"; }, () => { c.textContent = "Select and copy the text above"; }); }catch(err){ c.textContent = "Select and copy the text above"; } }
  const s = e.target.closest("[data-share]");
  if(s){
    const xp = xpParts().total, lv = levelOf(xp).name, st = streakInfo().cur;
    const text = s.dataset.share === "cert" ? (certStatus().ok ? "I earned the Certificate in AI Automation from Automancy Academy." : `I'm working towards the Certificate in AI Automation at Automancy Academy: ${doneCount()} of ${ORDER.length} lessons and projects done.`) : `I'm a ${lv} at Automancy Academy: ${xp.toLocaleString()} XP and a ${st}-day streak, learning to build AI automations.`;
    modal(`<h3>Share your progress</h3>${shareBlock(text)}<p class="note">Sharing opens the app in a new tab with your message ready to post.</p>`);
  }
});
// settings
on("#setName", "change", e => { S.profile.name = e.target.value.trim(); saveS(); refreshPlatform(); });
on("#setCity", "change", e => { S.profile.city = e.target.value.trim(); saveS(); refreshPlatform(); });
on("#setPublic", "change", e => { S.profile.public = e.target.checked; saveS(); refreshPlatform(); });
on("#setInstructor", "change", e => { S.instructor = e.target.checked; saveS(); refreshPlatform(); toast(S.instructor ? "Instructor view on: facilitator notes now show in every lesson." : "Instructor view off."); });
on("#demoFill", "click", () => {
  const ids = ORDER.slice(0, 12).map(o => o.id); ids.forEach(id => done[id] = true); save();
  ids.filter(id => !id.startsWith("B")).forEach((id, i) => { S.missions[id + ":b"] = true; if(i % 2 === 0) S.missions[id + ":s"] = true; if(i === 3) S.missions[id + ":g"] = true; S.quizzes[id] = i % 3 === 0 ? 5 : 4; });
  for(let i = 0; i < 9; i++){ const k = dk(addDays(new Date(), -i)); if(i !== 4 && !S.days.includes(k)) S.days.push(k); }
  S.events.unshift({t:Date.now() - 36e5, xp:300, text:"Boss 1 complete"}, {t:Date.now() - 864e5, xp:100, text:"Lesson 1.6 complete"});
  saveS(); if(typeof update === "function") update(); syncChecks(); refreshPlatform(); toast("Demo progress loaded. Reset it any time from Settings.");
});
let resetArmed = false;
on("#resetAll", "click", () => {
  if(!resetArmed){ resetArmed = true; $("#resetAll").textContent = "Tap again to confirm reset"; $("#resetNote").textContent = "This clears your progress, journal and settings in this browser."; setTimeout(() => { resetArmed = false; $("#resetAll").textContent = "Reset my progress"; $("#resetNote").textContent = ""; }, 5000); return; }
  resetArmed = false; Object.keys(done).forEach(k => delete done[k]); save(); S = clone(S0); saveS(); if(typeof update === "function") update(); syncChecks();
  $("#resetAll").textContent = "Reset my progress"; $("#resetNote").textContent = ""; refreshPlatform(); toast("Progress reset.");
});
function syncChecks(){ $$("#trackRoot input[type=checkbox][data-id]").forEach(c => { c.checked = !!done[c.dataset.id]; const m = $(`details[data-id="${c.dataset.id}"] .done-mark`); if(m) m.hidden = !done[c.dataset.id]; }); }

/* ---------- COMMUNITY ---------- */
const ROOMS = [
  ["general","Say hello, share wins, ask anything."],["base-camp","Track 0: APIs, JSON, sheets, prompting, safety."],["zapier","Track 1 with Bolt."],["make","Track 2 with Weave."],["n8n","Track 3 with Nodo: self-hosting and workflows."],["agents","Track 4 with Sage: tools, memory, RAG, evals."],["launchpad","Track 5: clients, pricing, portfolios."],["stuck","Post the error message and what you tried."],["jobs","Roles, gigs and client leads from members."]
];
const ROOMMSG = {};
let room = "general", comTab = "chat", jFilter = "all";
function renderCommunity(){
  $$("#comTabs button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.com === comTab)));
  $$("[data-compane]").forEach(p => p.hidden = p.dataset.compane !== comTab);
  if(comTab === "chat") renderChat();
  if(comTab === "journal") renderJournal();
  if(comTab === "help") renderHelp();
  if(comTab === "cases") renderCases();
}
on("#comTabs", "click", e => { const b = e.target.closest("button"); if(b){ comTab = b.dataset.com; renderCommunity(); } });
function renderChat(){
  $("#rooms").innerHTML = ROOMS.map(([r]) => `<button type="button" role="tab" aria-selected="${r === room}" data-room="${r}"># ${r}<small>${(ROOMMSG[r] || []).length + (S.chat[r] || []).length}</small></button>`).join("");
  const R_ = ROOMS.find(x => x[0] === room); $("#roomName").textContent = "# " + room; $("#roomDesc").textContent = R_[1];
  const msgs = [...(ROOMMSG[room] || []).map(([n, t, m]) => ({n, t, when:m < 60 ? m + " min ago" : Math.round(m / 60) + " h ago", col:"var(--muted)"})), ...(S.chat[room] || []).map(m => ({n:myName(), t:m.t, when:rel(m.at), col:myCol}))];
  $("#msgs").innerHTML = msgs.length ? "" : `<p class="note" style="padding:12px">No messages yet. Real learners will appear here once the course opens.</p>`;
  if(msgs.length) $("#msgs").innerHTML = msgs.map(m => `<div class="msg">${mini(m.n, m.col)}<div><b>${esc(m.n)}</b><small>${esc(m.when)}</small><p>${esc(m.t).replace(/`([^`]+)`/g, "<code>$1</code>")}</p></div></div>`).join("");
  $("#msgs").scrollTop = 1e6;
}
on("#rooms", "click", e => { const b = e.target.closest("[data-room]"); if(b){ room = b.dataset.room; renderChat(); } });
on("#chatForm", "submit", e => { e.preventDefault(); const v = $("#chatInput").value.trim(); if(!v) return; if(/sk_(test|live)_[A-Za-z0-9]{6,}|sk-[A-Za-z0-9-]{10,}/.test(v)){ toast("That looks like a secret key. Remove it before posting."); return; } (S.chat[room] = S.chat[room] || []).push({t:v, at:Date.now()}); $("#chatInput").value = ""; markActive(); saveS(); renderChat(); });
function jPosts(){ return S.journal.map(j => Object.assign({mine:true, who:myName()}, j)); }
function jCard(j){
  const p = {n:myName(), col:myCol, c:S.profile.city}; const it = ORDER.find(o => o.id === j.mod);
  const claps = (j.claps || 0) + (S.claps[j.id] ? 1 : 0); const reps = [...(j.replies || []), ...((S.replies[j.id] || []).map(t => [myName(), t]))];
  return `<article class="jpost ${j.stuck ? "help" : ""}" data-j="${j.id}">
    <div class="jhead">${mini(p.n, p.col)}<div><b>${esc(p.n)}</b><br><small>${esc(p.c || "")} · ${rel(j.at)} · ${it ? (j.mod.startsWith("B") ? "Boss " + j.mod.slice(1) : "Lesson " + j.mod) + " · " + esc(it.t) : ""}</small></div>${j.stuck ? '<span class="pill2 warn" style="margin-left:auto">Needs help</span>' : j.featured ? '<span class="pill2 ok" style="margin-left:auto">Case study</span>' : ""}</div>
    <div class="rrr"><div><h5>Review</h5><p>${esc(j.review || "")}</p></div><div><h5>Reflect</h5><p>${esc(j.reflect || "–")}</p></div><div><h5>Recommend</h5><p>${esc(j.rec || "–")}</p></div></div>
    ${j.saved ? `<p class="note">Time or money saved: <b>${esc(j.saved)}</b></p>` : ""}
    ${j.stuck ? `<div class="stuck"><b>Stuck on:</b> ${esc(j.stuck)}</div>` : ""}
    ${reps.length ? `<div class="replies">${reps.map(r => `<div class="r"><b>${esc(r[0])}</b> ${esc(r[1])}</div>`).join("")}</div>` : ""}
    <div class="jacts"><button type="button" class="${S.claps[j.id] ? "on" : ""}" data-clap="${j.id}">Applaud · ${claps}</button>${j.mine ? "" : `<form class="replybox" data-reply="${j.id}"><input type="text" maxlength="400" placeholder="${j.stuck ? "Reply with a hint (+15 XP)" : "Reply"}" aria-label="Reply"><button type="submit" class="cta sm">Reply</button></form>`}</div>
  </article>`;
}
function renderJournal(){
  $("#jMod").innerHTML = ORDER.map(o => `<option value="${o.id}">${o.id.startsWith("B") ? "Boss " + o.id.slice(1) : o.id} · ${esc(o.t)}</option>`).join("");
  if(S.draft){ $("#jMod").value = S.draft.mod; $("#jReview").value = S.draft.review; S.draft = null; saveS(); $("#jReview").focus(); }
  else if(currentIdLast) $("#jMod").value = currentIdLast;
  $$("#jFilter button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.jf === jFilter)));
  const list = jPosts().filter(j => jFilter === "all" || j.mine);
  $("#jList").innerHTML = list.length ? list.map(jCard).join("") : `<p class="note">You haven't posted yet. Your first entry earns 10 XP. Other learners' entries will appear here once the course opens.</p>`;
}
let currentIdLast = null;
on("#jFilter", "click", e => { const b = e.target.closest("button"); if(b){ jFilter = b.dataset.jf; renderJournal(); } });
on("#jStuck", "change", e => { $("#jStuckWrap").hidden = !e.target.checked; });
on("#jForm", "submit", e => {
  e.preventDefault(); const txt = [$("#jReview").value, $("#jReflect").value, $("#jRec").value, $("#jStuckTxt").value].join(" ");
  if(/sk_(test|live)_[A-Za-z0-9]{6,}|sk-[A-Za-z0-9-]{10,}|\b0[789][01]\d{8}\b/.test(txt)){ toast("Remove the key or phone number before posting. Use placeholders like <API_KEY>."); return; }
  const stuck = $("#jStuck").checked ? $("#jStuckTxt").value.trim() || "I'm stuck on this lesson." : "";
  S.journal.unshift({id:"m" + Date.now(), mod:$("#jMod").value, review:$("#jReview").value.trim(), reflect:$("#jReflect").value.trim(), rec:$("#jRec").value.trim(), saved:$("#jSaved").value.trim(), stuck, at:Date.now()});
  ["jReview","jReflect","jRec","jSaved","jStuckTxt"].forEach(id => $("#" + id).value = ""); $("#jStuck").checked = false; $("#jStuckWrap").hidden = true;
  award(10, "Journal entry posted"); jFilter = "all"; renderJournal();
});
function renderHelp(){ const l = jPosts().filter(j => j.stuck); $("#helpList").innerHTML = l.length ? l.map(jCard).join("") : `<p class="note">No help requests yet. Real learners will appear here once the course opens.</p>`; }
function renderCases(){ const l = jPosts().filter(j => j.featured); $("#caseList").innerHTML = l.length ? l.map(jCard).join("") : `<p class="note">No case studies yet. The first ones will come from real learners' capstones, with their permission.</p>`; }
document.addEventListener("click", e => { const c = e.target.closest("[data-clap]"); if(!c) return; S.claps[c.dataset.clap] = !S.claps[c.dataset.clap]; saveS(); renderCommunity(); });
document.addEventListener("submit", e => {
  const f = e.target.closest("[data-reply]"); if(!f) return; e.preventDefault();
  const v = f.querySelector("input").value.trim(); if(!v) return; const id = f.dataset.reply;
  (S.replies[id] = S.replies[id] || []).push(v);
  saveS();
  renderCommunity();
});

/* ---------- CHALLENGES ---------- */
function deadline(){
  const now = Date.now(); const wat = new Date(now + 36e5); const toSun = (7 - wat.getUTCDay()) % 7;
  let t = Date.UTC(wat.getUTCFullYear(), wat.getUTCMonth(), wat.getUTCDate() + toSun, 23, 59, 0) - 36e5; if(t < now) t += 7 * 864e5; return t;
}
let chalTimer = null;
const ENTRIES = [];
function renderChallenges(){
  const mine = S.challenge;
  $("#chalCard").innerHTML = `<div><span class="kicker2">This week</span><h2 style="font-size:clamp(1.5rem,3.6vw,2.2rem)">The Refill Reminder</h2>
    <p><b>The client:</b> a neighbourhood pharmacy (fictional brief) with 400 regular customers on monthly medicines. Customers forget to refill; the pharmacy loses about 60 sales a month.</p>
    <p><b>Build:</b> an automation that reminds each customer three days before their refill date, takes a reply ("YES", "LATER", "STOP"), and gives the pharmacist a pick list every morning.</p>
    <ul><li>Any platform. WhatsApp templates, Telegram or SMS are all allowed.</li><li>No message after STOP. The pharmacist approves anything that changes a prescription.</li><li>Test with the 10 sample customers in the brief, never real patient data.</li></ul>
    <p class="note">Deliver: a link to your workflow export or a 2-minute video, plus a short write-up.</p></div>
    <div class="side"><span class="kicker2">Closes Sunday 23:59 WAT</span><div class="count" id="chalCount"></div>
    <p><b>Prize:</b> featured on the home page, 500 XP, and a free month of Membership. Winning solutions become paid templates with revenue share.</p>
    ${mine ? `<p class="pill2 ok">Entry submitted ${rel(mine.at)}</p><p class="note">${esc(mine.sum)}</p>` : `<form id="chalForm" style="display:grid;gap:10px"><label class="fld">Link to your workflow or video<input id="chLink" type="url" required placeholder="https://"></label><label class="fld">Short write-up<textarea id="chSum" required maxlength="600" placeholder="What you built and how you tested it"></textarea></label><button type="submit" class="cta">Submit entry (+50 XP)</button></form>`}
    <p class="note">Sponsor a challenge with a real problem from your business: <a href="#business">talk to us</a>.</p></div>`;
  const tick = () => { const ms = Math.max(0, deadline() - Date.now()); const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60; const c = $("#chalCount"); if(c) c.innerHTML = [[d,"days"],[h,"hours"],[m,"mins"]].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join(""); };
  tick(); clearInterval(chalTimer); chalTimer = setInterval(() => { if(curView === "challenges" && !hub.hidden) tick(); else clearInterval(chalTimer); }, 30000);
  const rows = mine ? [{n:myName(), d:mine.sum.slice(0, 70), v:0, col:myCol, me:true}] : [];
  $("#chalTable").innerHTML = `<thead><tr><th>#</th><th>Entry</th><th class="n">Votes</th><th></th></tr></thead><tbody>${rows.length ? "" : `<tr><td colspan="4" class="note" style="padding:14px 8px">No entries yet. Real learners' entries will appear here once challenges start.</td></tr>`}${rows.map((r, i) => `<tr class="${r.me ? "you" : ""}"><td class="rank">${i + 1}</td><td><div class="who">${mini(r.n, r.col)}<span>${esc(r.n)}<br><small class="note">${esc(r.d)}</small></span></div></td><td class="n">${r.v}</td><td>${r.me ? "" : `<button type="button" class="cta alt sm" data-vote="${esc(r.n)}">${S.votes[r.n] ? "Voted" : "Vote"}</button>`}</td></tr>`).join("")}</tbody>`;
  $("#chalPast").innerHTML = `<p class="note">Past challenges and their winners will be listed here once challenges start.</p>`;
}
document.addEventListener("click", e => { const v = e.target.closest("[data-vote]"); if(!v) return; S.votes[v.dataset.vote] = !S.votes[v.dataset.vote]; saveS(); renderChallenges(); });
document.addEventListener("submit", e => { if(e.target.id !== "chalForm") return; e.preventDefault(); S.challenge = {link:$("#chLink").value, sum:$("#chSum").value.trim(), at:Date.now()}; award(50, "Challenge entry submitted"); renderChallenges(); });

/* ---------- HIRE ---------- */
function renderHire(){
  $("#tfCount").textContent = "";
  $("#talentList").innerHTML = `<div class="panel2"><h3>No graduates yet</h3><p class="note">The course is new. Profiles appear here after the first learners earn their certificate and choose to be listed.</p></div>`;
  $("#employerPlans").innerHTML = EMPLOYER.map(planCard).join("");
}
["tfQ","tfP","tfA","tfL"].forEach(id => on("#" + id, "input", renderHire));
document.addEventListener("submit", e => {
  if(e.target.id === "roleForm"){ e.preventDefault(); $("#rfNote").textContent = "Posting roles opens when the first learners graduate."; }
  if(e.target.id === "bizForm"){ e.preventDefault(); $("#bzNote").textContent = "Booking calls opens soon, on the Automancy Academy website."; }
});

/* ---------- PRICING (draft) ---------- */
const PLANS = [
  {id:"free", n:"Base Camp", ngn:0, usd:0, per:"", tag:"Track 0 free: 6 lessons and Boss 0.", f:["6 lessons + Boss 0 with all labs","Listen button on every lesson","Dashboard, XP, badges and streaks","#general and #base-camp chat"], cta:"Start free"},
  {id:"self", n:"Self-paced", ngn:45000, usd:79, per:"one-time", sub:"or 3 × ₦17,000", tag:"The full course at your own pace, with the community.", f:["All 49 lessons, 6 boss projects and the capstone","Community chat, journal and help board","Weekly challenges for 12 months","Certificate review included","12 months' access"], cta:"Enrol"},
  {id:"cohort", n:"Cohort bootcamp", ngn:150000, usd:399, per:"13 weeks", sub:"Early bird ₦120,000 ($299) · or 3 × ₦55,000", tag:"Learn with a group, live every week, with a mentor.", f:["Everything in Self-paced","13 weekly live build calls","Mentor review of every boss project","Cohort room and accountability group","Template bundle and Story Mode included","3 months of Membership free"], cta:"Reserve a seat", hot:true},
  {id:"member", n:"Membership", ngn:7500, usd:15, per:"/month", sub:"or ₦75,000 ($150) a year", tag:"After the course: jobs, challenges and community.", f:["Profile on the Hire talent page","Job and gig alerts","Weekly challenges and leagues","Community and new lessons as they're released"], cta:"Join"}
];
const ADDONS = [
  {id:"story", n:"Story Mode", ngn:5000, usd:12, per:"one-time", tag:"Character voices, animated guides and offline audio for every lesson.", f:[], cta:"Add"},
  {id:"pack", n:"Template pack", ngn:7500, usd:19, per:"each", tag:"Ready-to-import workflows for one job: orders, payments, support or reports. n8n, Make and Zapier versions.", f:[], cta:"Browse packs"},
  {id:"bundle", n:"Template bundle", ngn:30000, usd:69, per:"all packs", tag:"Every pack, including new ones from weekly challenge winners.", f:[], cta:"Add"},
  {id:"crmspec", n:"CRM Implementation specialisation", ngn:25000, usd:49, per:"one-time", sub:"Coming later", tag:"HubSpot and Zoho in depth, migrations, integrations, a CRM Implementation Agent, and a reviewed client project. For graduates of Track 5.", f:[], cta:"Join the waitlist"}
];
const EMPLOYER = [
  {id:"post", n:"Per role", ngn:20000, usd:49, per:"per post", sub:"Your first post is free", tag:"Post one role to graduates and the jobs room for 30 days.", f:["Applicants with portfolios","Shortlist in your inbox"], cta:"Post a role"},
  {id:"emp", n:"Talent access", ngn:100000, usd:199, per:"/month", sub:"or ₦900,000 a year", tag:"Unlimited posts and full talent search.", f:["Search and filter all graduates","Request intros directly","Priority on new cohorts"], cta:"Start", hot:true},
  {id:"place", n:"Placement", ngn:0, usd:0, per:"", pct:"10% of first-year salary", tag:"We shortlist and you pay only when you hire.", f:["Shortlist in 5 working days","Replacement within 60 days"], cta:"Talk to us"}
];
const CORP = [
  {id:"seat", n:"Per participant", ngn:200000, usd:450, per:"per person", tag:"Join an open 2-day workshop with other companies.", f:["Day 1: Base Camp","Day 2: Zapier, Make or n8n","Certificate of attendance"], cta:"Book seats"},
  {id:"team", n:"Private team · online", ngn:3000000, usd:6500, per:"up to 20 people", tag:"Your team only, built around your real processes.", f:["Pre-workshop process audit","Two live days","30 days of follow-up support"], cta:"Book a call", hot:true},
  {id:"onsite", n:"Private team · on-site", ngn:3800000, usd:6500, per:"up to 20 + travel", tag:"We come to you anywhere in Nigeria.", f:["Everything in online","In-person facilitation","Travel billed at cost"], cta:"Book a call"}
];
function priceTxt(p){ if(p.pct) return esc(p.pct); const v = S.cur === "USD" ? p.usd : p.ngn; return v === 0 ? "Free" : `${S.cur === "USD" ? usd(v) : ngn(v)} <small>${esc(p.per)}</small>`; }
function planCard(p){ return `<div class="plan ${p.hot ? "hot" : ""}">${p.hot ? '<span class="ribbon">RECOMMENDED</span>' : "<span></span>"}<h3>${esc(p.n)}</h3><div><div class="price">${priceTxt(p)}</div>${p.sub ? `<div class="sub">${esc(S.cur === "USD" && p.id === "cohort" ? "Early bird $299" : p.sub)}</div>` : ""}</div><div style="display:grid;gap:8px;align-content:start"><p class="note">${esc(p.tag)}</p>${p.f.length ? `<ul>${p.f.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}</div><button type="button" class="cta ${p.hot ? "" : "alt"}" data-buy="${p.id}">${esc(p.cta)}</button></div>`; }
function renderPricing(){
  $$("[data-cur]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.cur === S.cur)));
  $("#planGrid").innerHTML = PLANS.map(planCard).join("");
  $("#addonGrid").innerHTML = ADDONS.map(planCard).join("");
  const rows = [["Base Camp lessons + Boss 0",1,1,1,0],["All 49 lessons, 6 bosses, capstone",0,1,1,0],["Listen button",1,1,1,1],["Community chat and journal","Part",1,1,1],["Weekly challenges",0,1,1,1],["Live build calls",0,0,1,0],["Mentor review",0,0,1,0],["Certificate",0,1,1,0],["Template bundle",0,0,1,0],["Story Mode",0,0,1,0],["Hire talent profile",0,0,"3 months",1]];
  $("#cmpTable").innerHTML = `<thead><tr><th></th>${PLANS.map(p => `<th>${esc(p.n)}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r[0])}</td>${r.slice(1).map(v => `<td>${v === 1 ? '<span class="ck" aria-label="Included">✓</span>' : v === 0 ? '<span class="note" aria-label="Not included">–</span>' : esc(v)}</td>`).join("")}</tr>`).join("")}</tbody>`;
}
document.addEventListener("click", e => { const b = e.target.closest("[data-cur]"); if(!b) return; S.cur = b.dataset.cur; saveS(); renderView(curView); });
document.addEventListener("click", e => {
  const b = e.target.closest("[data-buy]"); if(!b) return; const all = [...PLANS, ...ADDONS, ...EMPLOYER, ...CORP]; const p = all.find(x => x.id === b.dataset.buy);
  if(p.id === "free"){ location.hash = "#m-0-1"; return; }
  if(["team","onsite","place"].includes(p.id)){ location.hash = p.id === "place" ? "#hire-post" : "#business"; if(p.id !== "place") setTimeout(() => $("#bizForm").scrollIntoView(), 50); return; }
  if(p.id === "post"){ location.hash = "#hire-post"; return; }
  if(p.id === "crmspec"){ modal(`<h3>Waitlist · ${esc(p.n)}</h3><p>The specialisation opens after the main course launches. Leave your email and we'll tell you first.</p><p class="note">The waitlist opens on the Automancy Academy website.</p><p><a href="#careers-crm" data-close>See the outline →</a></p>`); return; }
  const usdMode = S.cur === "USD";
  modal(`<h3>Checkout · ${esc(p.n)}</h3><p class="price" style="font-family:var(--display);font-weight:800;font-size:1.8rem">${priceTxt(p)}</p>
    <form id="payForm" style="display:grid;gap:12px"><label class="fld">Email for your receipt and login<input id="payEmail" type="email" required placeholder="you@example.com"></label>
    <div class="pay" role="radiogroup" aria-label="Payment method">${usdMode ? `<label><input type="radio" name="pm" value="card" checked> International card (Visa, Mastercard) in US dollars</label>` : `<label><input type="radio" name="pm" value="paystack" checked> Paystack: card, bank transfer or USSD</label><label><input type="radio" name="pm" value="flutterwave"> Flutterwave: card, bank transfer or USSD</label>`}</div>
    <label class="fld">Referral or discount code<input id="payCode" type="text" placeholder="Optional"></label>
    <button type="submit" class="cta">Pay ${S.cur === "USD" ? usd(p.usd) : ngn(p.ngn)}</button>
    <p class="note">You pay on a secure Paystack checkout, and access unlocks when the payment is verified.</p></form>`);
});
document.addEventListener("submit", e => { if(e.target.id !== "payForm") return; e.preventDefault(); closeModal(); toast("Online enrolment opens on the Automancy Academy website."); });

/* ---------- BUSINESS ---------- */
function renderBusiness(){
  const v = id => Math.max(0, parseFloat($("#" + id).value) || 0);
  const hrs = v("auTimes") * v("auMin") * 52 / 12 / 60, cost = hrs * v("auRate") + v("auErr") * v("auErrCost") * 52 / 12, save_ = cost * .8;
  $("#auHrs").textContent = Math.round(hrs).toLocaleString(); $("#auCost").textContent = ngn(cost); $("#auSave").textContent = ngn(save_); $("#auYear").textContent = ngn(save_ * 12);
  const task = $("#auTask").value.trim() || "this task";
  const plat = hrs > 60 || v("auTimes") > 300 ? "n8n (high volume keeps costs predictable)" : v("auTimes") > 60 ? "Make (good value for branching and bulk data)" : "Zapier (fastest to set up at low volume)";
  $("#auAdvice").innerHTML = `<b>Suggested starting point:</b> ${esc(plat)}. Your team could learn this in Base Camp plus Track ${plat.startsWith("n8n") ? "3" : plat.startsWith("Make") ? "2" : "1"}, or a graduate could build it for you.`;
  const msg = `Automation audit: "${task}" costs about ${ngn(cost)} a month in staff time and mistakes. Automating it could save about ${ngn(save_ * 12)} a year. Free audit: automancy.twellr.com`;
  $("#auShare").href = "https://wa.me/?text=" + encodeURIComponent(msg);
  $("#corpPlans").innerHTML = CORP.map(planCard).join("");
}
["auTask","auTimes","auMin","auRate","auErr","auErrCost"].forEach(id => on("#" + id, "input", renderBusiness));

/* ---------- CERTIFICATE ---------- */
function certStatus(){
  const core = ORDER;
  const mods = core.filter(o => !o.id.startsWith("B")), bosses = core.filter(o => o.id.startsWith("B"));
  const c = [
    {l:"Lessons complete", have:mods.filter(o => done[o.id]).length, need:mods.length},
    {l:"Checkpoint quizzes passed (4/5+)", have:mods.filter(o => (S.quizzes[o.id] || 0) >= 4).length, need:mods.length},
    {l:"Boss projects scored 80+", have:bosses.filter(o => done[o.id]).length, need:bosses.length},
    {l:"Capstone reviewed and presented", have:done["6.4"] ? 1 : 0, need:1},
    {l:"Journal entries", have:new Set(S.journal.filter(j => mods.some(m => m.id === j.mod)).map(j => j.mod)).size, need:mods.length}
  ];
  return {c, ok:c.every(x => x.have >= x.need)};
}
const certId = () => { let h = 7; for(const ch of myName()) h = (h * 33 + ch.charCodeAt(0)) % 90000; return "AA-26-" + String(h + 10000).padStart(5, "0"); };
function renderCert(){
  const st = certStatus();
  $("#certCrit").innerHTML = st.c.map(x => `<div class="${x.have >= x.need ? "met" : ""}"><i>${x.have >= x.need ? "✓" : ""}</i><span>${esc(x.l)}</span><em>${x.have} / ${x.need}</em></div>`).join("");
  const li = $("#certLinkedIn"); const d = new Date();
  if(st.ok){ li.href = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent("Certificate in AI Automation")}&organizationName=${encodeURIComponent("Automancy Academy")}&issueYear=${d.getFullYear()}&issueMonth=${d.getMonth() + 1}&certId=${certId()}`; li.removeAttribute("aria-disabled"); }
  else { li.href = "#certificate"; li.setAttribute("aria-disabled","true"); }
  $("#certNote").textContent = st.ok ? "You've met every criterion. Your certificate is ready." : "The LinkedIn button unlocks when every criterion is met.";
  $("#certCard").innerHTML = `${st.ok ? "" : '<div class="wm" aria-hidden="true">PREVIEW</div>'}
    <svg class="seal" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29" fill="var(--sun)" stroke="var(--ink)" stroke-width="3"/><circle cx="32" cy="32" r="22" fill="none" stroke="var(--ink)" stroke-width="1.5" stroke-dasharray="3 3"/><text x="32" y="37" text-anchor="middle" font-family="Bricolage Grotesque,sans-serif" font-weight="800" font-size="14" fill="#13233A">AA</text></svg>
    <div><div class="ttl">Automancy Academy</div><h2>Certificate in AI Automation</h2></div>
    <div><p class="note">This certifies that</p><div class="nm">${esc(S.profile.name || "Your Name")}</div><p style="max-width:52ch;margin-top:8px">has completed 49 lessons, six practical boss projects and a reviewed capstone, building automations, AI agents and growth systems with Zapier, Make and n8n.</p></div>
    <div class="meta2"><span>ID ${certId()}</span><span>${st.ok ? "Issued " + d.toLocaleDateString("en-GB", {day:"numeric", month:"long", year:"numeric"}) : "Not yet issued"}</span><span>Verify at ${esc(SITE_HOST)}/verify</span></div>`;
}
on("#certLinkedIn", "click", e => { if(e.currentTarget.getAttribute("aria-disabled") === "true"){ e.preventDefault(); toast("Meet every criterion first. Your progress is on the left."); } });
const VERIFY = {};
on("#verifyForm", "submit", e => {
  e.preventDefault(); const id = $("#verifyId").value.trim().toUpperCase(); const st = certStatus();
  const hit = VERIFY[id] || (st.ok && id === certId() ? [myName(), "Issued to you"] : null);
  $("#verifyOut").innerHTML = hit ? `<p class="pill2 ok">Valid</p><p><b>${esc(hit[0])}</b> · Certificate in AI Automation · ${esc(hit[1])}</p>` : `<p class="pill2 bad">Not found</p><p class="note">Check the ID and try again. IDs look like AA-26-00001.</p>`;
});

/* ---------- LESSON ADD-ONS ---------- */
let speech = {on:false, units:[], i:0, gender:null, mode:"browser", paused:false, tok:0, tts:null};
/* Voice hook (app): window.AUTOMANCY_TTS = {ready, speak(text, {voice, rate}) => Promise, stop()}. Missing or failing → browser speech. */
const ttsReady = () => { const t = window.AUTOMANCY_TTS; return !!(t && t.ready && typeof t.speak === "function"); };
const canSpeak = () => ttsReady() || ("speechSynthesis" in window);
const F_RX = /ezinne|female|woman|zira|susan|samantha|victoria|karen|moira|tessa|fiona|serena|libby|sonia|hazel|aria|jenny|natasha|emma|olivia|\bava\b|allison|kate|libby|leah/i;
const M_RX = /abeo|\bmale\b|david|daniel|\balex\b|fred|george|ryan|\bguy\b|thomas|oliver|arthur|william|christopher|eric|\bmark\b|james|aaron|rishi/i;
const isNG = v => /en[-_]NG/i.test(v.lang) || /nigeria/i.test(v.name);
function enVoices(){ try{ return speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang)); }catch(e){ return []; } }
function pickVoice(gender){
  const vs = enVoices(); const ng = vs.filter(isNG);
  const fallback = ng[0] || vs.find(x => /en-GB/i.test(x.lang)) || vs[0] || null;
  if(gender){
    const rx = gender === "female" ? F_RX : M_RX;
    const v = ng.find(x => rx.test(x.name)) || vs.find(x => rx.test(x.name));
    if(v) return {v, pitch:1};
    return {v:fallback, pitch: gender === "female" ? 1.2 : 0.8};
  }
  if(S.voice){ const v = vs.find(x => x.name === S.voice); if(v) return {v, pitch:1}; }
  return {v:fallback, pitch:1};
}
function fillVoices(){
  const sel = $("#lsnVoice"); if(!sel) return; const vs = enVoices();
  const ng = vs.filter(isNG), rest = vs.filter(v => !isNG(v));
  sel.innerHTML = `<option value="">Auto${ng.length ? " (Nigerian English)" : ""}</option>` + [...ng, ...rest].map(v => `<option value="${esc(v.name)}" ${S.voice === v.name ? "selected" : ""}>${esc(v.name.replace(/^Microsoft |^Google /, "").replace(/ Online \(Natural\)/, ""))}</option>`).join("");
  const hint = $("#lsnHint"); if(hint) hint.hidden = ng.length > 0 || !vs.length;
}
try{ if(window.speechSynthesis) speechSynthesis.addEventListener("voiceschanged", fillVoices); }catch(e){}
function stopSpeech(){ speech.tok++; speech.paused = false; try{ if(window.AUTOMANCY_TTS && typeof window.AUTOMANCY_TTS.stop === "function") window.AUTOMANCY_TTS.stop(); }catch(e){} try{ if(window.speechSynthesis) speechSynthesis.cancel(); }catch(e){} speech.on = false; $$(".coach.speaking").forEach(c => c.classList.remove("speaking")); $$("[data-coachplay]").forEach(b => b.textContent = b.dataset.label || "▶ Walk me through it"); $$(".reading").forEach(x => x.classList.remove("reading")); const b = $("#lsnPlay"); if(b){ b.textContent = "▶ Listen"; } }
const READ_CAND = "h1,h2,h3,h4,h5,p,li,figcaption,.cap,.bubble,.vocab > div,.outcomes > div,.wcard,tr,summary,blockquote,pre,.stat,.kpi,.id-msg,.mission .tier,.mission .crit,.anat > div";
function visibleEl(el){ return !!(el.offsetParent || el.getClientRects().length); }
function collectBlocks(root, after){
  let c = $$(READ_CAND, root).filter(el => visibleEl(el)
    && !el.closest(".wk,.tplbox,.lesson-top,.listen,.mres,.q,.qscore,.coach .acts,.lesson-end,button,select,svg,label.mdone,.kicker,.part-h .tag")
    && !(el.closest(".facil") && !S.instructor)
    && !(el.closest("details:not([open])") && !el.matches("summary")));
  if(after) c = c.filter(el => !after.contains(el) && (after.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING));
  return c.filter(el => !c.some(o => o !== el && el.contains(o)));
}
function blockText(el){
  if(el.matches("pre")) return /AUTOMANCY LOG|^#|\|/.test(el.textContent.trim().slice(0, 40)) ? "A template you can copy is on screen here." : "There's a code example on screen here.";
  if(el.matches("tr")) return [...el.cells].map(c => c.innerText.trim()).filter(Boolean).join(", ") + ".";
  try{ if(getComputedStyle(el).textTransform === "uppercase") return el.textContent; }catch(e){}
  return el.innerText;
}
function speakable(t){
  return t.replace(/\b[A-Z]{6,}\b/g, w => w.charAt(0) + w.slice(1).toLowerCase()).replace(/\p{Extended_Pictographic}|️/gu, "").replace(/₦\s?([\d,.]+)\s?(k|m)?\b/gi, (m, n, u) => `${n}${u ? (u.toLowerCase() === "k" ? " thousand" : " million") : ""} naira`)
    .replace(/[·•]/g, ", ").replace(/→/g, " to ").replace(/≈/g, "about ").replace(/≤/g, "at most ").replace(/≥/g, "at least ").replace(/×/g, " times ").replace(/\s+/g, " ").trim();
}
function chunks(t){
  const out = []; let cur = "";
  t.split(/(?<=[.!?:;])\s+/).forEach(sn => {
    while(sn.length > 220){ const cut = sn.lastIndexOf(",", 200) > 60 ? sn.lastIndexOf(",", 200) + 1 : sn.lastIndexOf(" ", 200); out.push((cur + " " + sn.slice(0, cut)).trim()); cur = ""; sn = sn.slice(cut); }
    if((cur + " " + sn).length > 220){ if(cur) out.push(cur.trim()); cur = sn; } else cur = (cur + " " + sn).trim();
  });
  if(cur.trim()) out.push(cur.trim());
  return out;
}
function buildUnits(blocks){ const u = []; blocks.forEach(el => { const t = speakable(blockText(el) || ""); if(t.length > 1) chunks(t).forEach(c => u.push({el, text:c})); }); return u; }
function speakNext(){
  if(!speech.on) return;
  const un = speech.units[speech.i]; const st = $("#lsnStatus");
  $$(".reading").forEach(x => { if(!un || x !== un.el) x.classList.remove("reading"); });
  if(!un){ stopSpeech(); if(st) st.textContent = "Finished. Well done."; return; }
  if(!un.el.classList.contains("reading")){ un.el.classList.add("reading"); if($("#lsnFollow") && $("#lsnFollow").checked) un.el.scrollIntoView({block:"center", behavior:matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"}); }
  const rate = Number(($("#lsnRate") || {value:1}).value) || 1;
  if(st) st.textContent = `Reading ${Math.min(100, Math.round((speech.i + 1) / speech.units.length * 100))}%`;
  if(speech.tts !== false && ttsReady()){
    speech.mode = "tts"; const myTok = ++speech.tok;
    const voice = speech.gender || (currentId ? coachFor(currentId).g : "female");
    let p; try{ const nx = speech.units[speech.i + 1]; p = Promise.resolve(window.AUTOMANCY_TTS.speak(un.text, {voice, rate, next:nx ? nx.text : undefined})); }catch(e){ p = Promise.reject(e); }
    p.then(() => { if(myTok !== speech.tok || !speech.on || speech.paused) return; speech.i++; speakNext(); },
           () => { if(myTok !== speech.tok || !speech.on || speech.paused) return; speech.tts = false; speakNext(); });
    return;
  }
  if(!("speechSynthesis" in window)){ stopSpeech(); if(st) st.textContent = "Your browser can't read aloud. Try Chrome or Edge."; return; }
  speech.mode = "browser";
  const u = new SpeechSynthesisUtterance(un.text); u.rate = rate;
  const pv = pickVoice(speech.gender); if(pv.v){ u.voice = pv.v; u.lang = pv.v.lang; } else u.lang = "en-NG"; u.pitch = pv.pitch;
  u.onend = () => { speech.i++; speakNext(); };
  u.onerror = e => { if(e.error === "interrupted" || e.error === "canceled") return; speech.i++; speakNext(); };
  speechSynthesis.speak(u);
}
lesson.addEventListener("click", e => {
  const b = e.target.closest("#lsnPlay"); if(b){
    if(!canSpeak()){ $("#lsnStatus").textContent = "Your browser can't read aloud. Try Chrome or Edge."; return; }
    if(speech.on && speech.mode === "tts"){
      if(!speech.paused){ speech.paused = true; speech.tok++; try{ window.AUTOMANCY_TTS.stop(); }catch(err){} b.textContent = "▶ Resume"; }
      else { speech.paused = false; b.textContent = "❚❚ Pause"; speakNext(); }
      return;
    }
    if(speech.on && !speechSynthesis.paused){ speechSynthesis.pause(); b.textContent = "▶ Resume"; return; }
    if(speech.on && speechSynthesis.paused){ speechSynthesis.resume(); b.textContent = "❚❚ Pause"; return; }
    stopSpeech(); speech.units = buildUnits(collectBlocks(lesson)); speech.i = 0; speech.tts = null;
    speech.gender = null; speech.on = true; b.textContent = "❚❚ Pause"; speakNext(); return;
  }
  const cp = e.target.closest("[data-coachplay]"); if(cp){
    const coachEl = cp.closest(".coach"); const st = $("#lsnStatus");
    if(!canSpeak()){ cp.textContent = "Read-aloud isn't available in this browser"; return; }
    if(coachEl.classList.contains("speaking")){ stopSpeech(); speech.i = 0; return; }
    stopSpeech(); const sec = coachEl.closest(".part");
    speech.units = buildUnits([coachEl.querySelector(".say2"), ...collectBlocks(sec, coachEl)]);
    speech.i = 0; speech.tts = null; speech.gender = cp.dataset.gender; speech.on = true; coachEl.classList.add("speaking"); cp.textContent = "■ Stop";
    speakNext(); return;
  }
  if(e.target.closest("#lsnStop")){ stopSpeech(); speech.i = 0; $("#lsnStatus").textContent = "Stopped."; return; }
  if(e.target.closest("#lsnStory")){ modal(`<h3>Story Mode</h3><p>Hear every lesson in the characters' own voices: Bolt, Weave, Nodo, Sage, Tolu and Glitch, with animated guides and audio you can download for offline listening.</p><p class="note">A paid add-on. The free Listen button stays available to everyone.</p>${APP_MODE ? `<a class="cta" href="/audio">Open Story Mode</a>` : `<a class="cta" href="#pricing" data-close>See Story Mode pricing</a>`}`); return; }
  const pj = e.target.closest("[data-tojournal]"); if(pj){ const src = document.getElementById(pj.dataset.tojournal);
    if(APP_MODE){ journalModal(currentId, src ? src.textContent.trim() : ""); return; }
    S.draft = {mod:currentId, review:src.textContent.trim()}; saveS(); comTab = "journal"; location.hash = "#community"; }
  const ah = e.target.closest("[data-askhelp]"); if(ah && APP_MODE){ helpModal(ah.dataset.askhelp); return; }
});
lesson.addEventListener("change", e => {
  const m = e.target.closest("[data-mission]"); if(!m) return; const k = m.dataset.mission; S.missions[k] = m.checked;
  const tier = k.split(":")[1]; award(m.checked ? MXP[tier] : -MXP[tier], `${{b:"Bronze",s:"Silver",g:"Gold"}[tier]} mission ${m.checked ? "done" : "unticked"} on ${k.split(":")[0]}`);
});
function enhanceLesson(el, id){
  const art = el.querySelector("article"); if(!art) return;
  const lede = art.querySelector(":scope > .lede");
  const sb = SB7[id];
  if(lede && sb && !art.querySelector(".sb7")){
    lede.insertAdjacentHTML("afterend", `<div class="sb7"><div><h5>Your problem</h5><p>${esc(sb[0])}</p></div><div><h5>The plan</h5><p>${esc(sb[1])}</p></div><div class="s3"><h5>After this ${id.startsWith("B") ? "project" : "lesson"}</h5><p>${esc(sb[2])}</p></div></div>
    <div class="listen" role="group" aria-label="Listen to this lesson"><button type="button" class="play" id="lsnPlay">▶ Listen</button><button type="button" id="lsnStop">■ Stop</button><label class="note">Speed <select id="lsnRate"><option value="0.85">0.85×</option><option value="1" selected>1×</option><option value="1.2">1.2×</option><option value="1.4">1.4×</option></select></label><label class="note"><input type="checkbox" id="lsnFollow" checked> Follow along</label><label class="note">Voice <select id="lsnVoice" aria-label="Voice"><option value="">Auto</option></select></label><span class="st" id="lsnStatus">Free read-aloud, in your browser's voice.</span><button type="button" class="story" id="lsnStory">Story Mode</button><p class="note" id="lsnHint" hidden style="flex-basis:100%">No Nigerian English voice on this device. Microsoft Edge includes Nigerian voices (Abeo and Ezinne); Android phones may offer one in Settings → Text-to-speech.</p></div>
    <div class="mres">${SHEETS[id] ? `<button type="button" class="mres-go" data-sheet-go><b>Mission sheet</b> with model answers ↓</button>` : ""}${TPLS[id] && TPLS[id].items.length ? `<button type="button" class="mres-go" data-tpl-go><b>Templates</b> (${TPLS[id].items.length}) ↓</button>` : ""}<button type="button" class="mres-go" data-walk-go><b>Animated walkthrough</b> ↓</button></div>`);
  }
  const target = $$(".part", art).find(p => /PART 4|YOUR MISSION/.test((p.querySelector(".part-h .tag") || {}).textContent || ""));
  if(target && !target.querySelector(".coach")){
    const c = coachFor(id); const prose = target.querySelector(".prose p");
    let goal = prose ? prose.textContent.replace(/^The goal\.\s*/, "").split(/(?<=\.)\s/)[0] : (SB7[id] ? SB7[id][1] : "");
    const line = id.startsWith("B") ? `This is where it all comes together. ${goal} Take it one phase at a time; I'll be with you at every step.` : `Let's solve a real problem, step by step, the way we would at Kitovu. ${goal}`;
    target.querySelector(".part-h").insertAdjacentHTML("afterend", `<div class="coach" style="--c:${c.col}"><div class="portrait-anim ${c.alt ? "alt" : ""}"><img src="${c.img}" alt="${esc(c.n)}" width="96" height="96"><i class="ring" aria-hidden="true"></i></div><div style="min-width:0"><span class="who">Your guide for this build · <b>${esc(c.n)}</b>, ${esc(c.role)}</span><p class="say2">${esc(line)}</p><div class="acts"><button type="button" class="btn ghost" data-coachplay data-gender="${c.g}" data-label="▶ Walk me through it">▶ Walk me through it</button><span class="bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span></div></div></div>`);
  }
  fillVoices();
  const vid = VIDEOS[id]; let watch = $$(".part", art).find(p => /Watch/.test((p.querySelector(".part-h h2") || {}).textContent || ""));
  if(vid && !watch){ const mis = $$(".part", art).find(p => /YOUR MISSION/.test((p.querySelector(".part-h .tag") || {}).textContent || "")); if(mis){ mis.insertAdjacentHTML("beforebegin", `<section class="part" style="--c:#C9BBFF"><div class="part-h"><span class="tag">BEFORE YOU START</span><h2>Watch a similar build</h2></div><div class="watch"></div></section>`); watch = mis.previousElementSibling; } }
  if(vid && watch && !watch.querySelector(".featured-vid")){
    const host = watch.querySelector(".watch") || watch;
    host.insertAdjacentHTML("afterbegin", `<a class="wcard featured-vid" href="https://www.youtube.com/watch?v=${vid[2]}" target="_blank" rel="noopener"><span class="play"><svg viewBox="0 0 20 20"><path d="M5 3 L17 10 L5 17 Z" fill="#fff"/></svg></span><span><small class="fv-tag">FEATURED VIDEO</small><b>${esc(vid[0])}</b><small>${vid[1] ? esc(vid[1]) + " · " : ""}What to look for: ${esc(vid[3])}</small></span></a>`);
  }
  if(!id.startsWith("B")) $$(".mission", art).forEach(ms => {
    const t = ms.querySelector(".tier"); if(!t || ms.querySelector(".mdone")) return;
    const tier = t.classList.contains("t-g") ? "g" : t.classList.contains("t-s") ? "s" : "b"; const k = `${id}:${tier}`;
    if(APP_MODE) ms.insertAdjacentHTML("beforeend", `<span class="mdone mstatus ${S.missions[k] ? "ok" : ""}" data-mission-status="${k}">${missionStatusText(k)}</span>`);
    else ms.insertAdjacentHTML("beforeend", `<label class="mdone"><input type="checkbox" data-mission="${k}" ${S.missions[k] ? "checked" : ""}> Mission done (+${MXP[tier]} XP)</label>`);
  });
  $$("pre[id^='log-']", art).forEach(pre => { const box = pre.parentElement.querySelector("div"); if(box && !box.querySelector("[data-tojournal]")) box.insertAdjacentHTML("beforeend", ` <button type="button" class="btn ghost" data-tojournal="${pre.id}">Post to my learning journal (+10 XP)</button>`); });
}

/* ---------- guides ---------- */
const COACH = [
  {n:"Nwachinemere Emeka", img:"img/emeka.jpg", role:"Founder & CEO, Kitovu", g:"male", col:"var(--spark)", alt:false},
  {n:"Nduka Miracle", img:"img/miracle.jpg", role:"Co-founder, Kitovu", g:"female", col:"var(--rose)", alt:true}
];
function coachFor(id){ const i = Math.max(0, ORDER.findIndex(o => o.id === id)); return COACH[i % 2]; }

/* ---------- EARN ---------- */
const EPROD = {cohort:{n:"Cohort bootcamp", p:150000, disc:.1}, self:{n:"Self-paced course", p:45000, disc:.1}, member:{n:"Membership (yearly)", p:75000, disc:.1}, bundle:{n:"Template bundle", p:30000, disc:.1, fixed:.3}, team:{n:"Team workshop", p:3000000, disc:0, fixed:.1}};
function renderEarn(){
  const code = refCode();
  $("#erCode").textContent = "Code: " + code;
  const links = [["Any course or plan","r/" + code],["Cohort bootcamp","r/" + code + "/cohort"],["Self-paced course","r/" + code + "/self-paced"],["Template packs","r/" + code + "/templates"],["Team workshop (business)","r/" + code + "/business"]];
  $("#erLinks").innerHTML = links.map(([n, l]) => { const url = "automancy.twellr.com/" + l; const msg = encodeURIComponent(`I'm learning to build AI automations with Automancy Academy and it's been worth it. Join with my link and get 10% off: ${url} (I earn a commission if you join.)`); return `<div class="linkrow2"><div><b>${esc(n)}</b><code>${esc(url)}</code></div><button type="button" class="cta alt sm" data-copytext="${esc(url)}">Copy</button><a class="cta sm" href="https://wa.me/?text=${msg}" target="_blank" rel="noopener">WhatsApp</a></div>`; }).join("");
  $("#erWall").innerHTML = `<thead><tr><th>#</th><th>Referrer</th><th class="n">Earned this quarter</th></tr></thead><tbody><tr><td colspan="3" class="note" style="padding:14px 8px">No referrers yet. The wall starts when referrals open.</td></tr></tbody>`;
  const kit = [
    ["WhatsApp status", `I just built [what you built] in Automancy Academy 🤖 [What it does for you]. If you've been wanting to learn AI automation, use my link for 10% off: automancy.twellr.com/r/${code} (I earn a commission if you join.)`],
    ["Class or alumni group", `Hi all. I'm taking Automancy Academy's AI automation course (Zapier, Make, n8n, AI agents). It's practical: every lesson solves a real business problem. Base Camp is free if you want to try it first. My link gives 10% off the paid plans: automancy.twellr.com/r/${code}. Full disclosure: I earn a commission if you enrol.`],
    ["LinkedIn", `[How long] ago I couldn't build an automation. This week I shipped [what you built, in one line]. If you want to learn to build AI automations that businesses pay for, Automancy Academy is where I learned. Link (10% off, and I earn a commission): automancy.twellr.com/r/${code}`]
  ];
  $("#erKit").innerHTML = kit.map(([t, m]) => `<div class="panel2"><h3>${esc(t)}</h3><div class="msg2">${esc(m)}</div><div class="sharelinks"><button type="button" class="cta alt sm" data-copytext="${esc(m)}">Copy</button></div></div>`).join("");
  calcEarn();
}
function calcEarn(){
  const pr = EPROD[$("#ecProd").value], n = Math.max(0, parseInt($("#ecN").value, 10) || 0), t = parseFloat($("#ecTier").value);
  const rate = pr.fixed && $("#ecProd").value === "team" ? pr.fixed : pr.fixed && $("#ecProd").value === "bundle" ? Math.max(pr.fixed, t) : t;
  const paid = pr.p * (1 - pr.disc), per = paid * rate;
  $("#ecOut").textContent = ngn(per * n);
  $("#ecNote").textContent = `${pr.n}: your friend pays ${ngn(paid)}${pr.disc ? " (10% off with your link)" : ""}; you earn ${Math.round(rate * 100)}% = ${ngn(per)} each.`;
}
["ecProd","ecN","ecTier"].forEach(id => on("#" + id, "input", calcEarn));

/* ---------- boot ---------- */
(function migrate(){ if(APP_MODE) return; try{ if(!localStorage.getItem("automancy-progress-v1")){ const old = localStorage.getItem("flowforge-progress-v1"); if(old){ localStorage.setItem("automancy-progress-v1", old); Object.assign(done, JSON.parse(old)); } } }catch(e){} })();
document.body.classList.toggle("instructor", !!S.instructor);
lesson.addEventListener("change", e => { if(e.target.id === "lsnVoice"){ S.voice = e.target.value; saveS(); const st = $("#lsnStatus"); if(st) st.textContent = S.voice ? "Voice set. Press Listen." : "Auto voice: Nigerian English when your device has one."; } });

/* Mission sheets: model answers and marking guides */
const TIERN = {b:["Bronze","t-b"], s:["Silver","t-s"], g:["Gold","t-g"]};
/* Sheet text is authored HTML from src/sheets (already escaped), so it is inserted as is. */
function sheetHTML(id){
  const d = SHEETS[id]; if(!d) return "";
  const li = a => a.map(x => `<li>${x}</li>`).join("");
  if(d.boss) return `<details class="reveal msheet" id="msheet"><summary>Marking guide · what full marks look like</summary><div>
    ${d.intro || ""}
    <div class="ms-rows">${d.rows.map(r => `<div class="ms-row"><h5>${r.area}</h5><p><span class="ms-l ok">Full marks</span>${r.full}</p><p><span class="ms-l mid">Partial</span>${r.partial}</p><p><span class="ms-l lo">Little or none</span>${r.low}</p></div>`).join("")}</div>
    <div class="ms-two"><div class="box"><h5>What to submit</h5><ul>${li(d.evidence)}</ul></div><div class="box"><h5>Why submissions fail</h5><ul>${li(d.mistakes)}</ul></div></div></div></details>`;
  return `<details class="reveal msheet" id="msheet"><summary>Mission sheet · model answers and marking guide</summary><div>
    <p class="note">Try the mission first, then compare. Your answer can differ and still be right; the marking guide says what matters.</p>
    ${["b","s","g"].map(k => { const t = d.tiers[k]; return `<section class="ms-tier"><span class="tier ${TIERN[k][1]}">${TIERN[k][0]} · model answer</span>
      <div class="ms-ans">${t.answer}</div>
      <div class="ms-two"><div class="box"><h5>Common mistakes</h5><ul>${li(t.mistakes)}</ul></div><div class="box"><h5>Marking guide</h5><p><b>Accept when:</b> ${t.pass}</p><p><b>Send back when:</b> ${t.redo}</p></div></div></section>`; }).join("")}
  </div></details>`;
}
function addSheet(el, id){
  const art = el.querySelector("article"); if(!art || !SHEETS[id] || art.querySelector(".msheet")) return;
  const tagOf = p => ((p.querySelector(".part-h .tag") || {}).textContent || "");
  const parts = $$(".part", art);
  const host = SHEETS[id].boss ? parts.find(p => /SCORING/.test(tagOf(p))) : parts.find(p => /^PART 6/.test(tagOf(p)));
  if(!host) return;
  host.insertAdjacentHTML("beforeend", sheetHTML(id));
}
const _enhanceLesson0 = enhanceLesson;
enhanceLesson = function(el, id){ _enhanceLesson0(el, id); addSheet(el, id); };
document.addEventListener("click", e => {
  if(!e.target.closest("[data-sheet-go]")) return;
  const d = document.getElementById("msheet"); if(!d) return; d.open = true; d.scrollIntoView({behavior:"smooth", block:"start"});
});

/* n8n templates: copy straight into n8n, or open the JSON file */
function tplHTML(id){
  const m = TPLS[id]; if(!m) return "";
  if(!m.items.length) return m.note ? `<div class="tplbox" id="tplbox"><h5>Templates</h5><p class="note">${esc(m.note)}</p></div>` : "";
  const K = {n8n:"n8n", make:"Make", zap:"Zapier"};
  const one = (it, i) => {
    const kind = it.kind || "n8n";
    const file = (label, cls) => APP_MODE ? `<button type="button" class="${cls}" data-tpl-dl="${esc(id)}|${i}">${label}</button>` : `<a class="${cls}" href="${esc(it.path)}" target="_blank" rel="noopener">${label}</a>`;
    const act = kind === "n8n" ? `<button type="button" class="cta sm" data-tpl-copy="${esc(id)}|${i}">Copy</button>${file("JSON file", "note linkbtn")}`
      : kind === "make" ? `${file("Blueprint file", "cta sm")}<button type="button" class="note linkbtn" data-tpl-copy="${esc(id)}|${i}">Copy JSON</button>`
      : `<span class="note">Recipe · build it in Zapier</span>`;
    const how = kind === "make" ? `<details><summary>Build it by hand (${(it.build || []).length} modules)</summary><ol>${(it.build || []).map(x => `<li>${esc(x)}</li>`).join("")}</ol></details>`
      : kind === "zap" ? `<details open><summary>Steps (${(it.steps || []).length})</summary><ol>${(it.steps || []).map(x => `<li>${esc(x)}</li>`).join("")}</ol>${it.tasks ? `<p class="note">${esc(it.tasks)}</p>` : ""}</details>` : "";
    return `<div class="tpl"><div class="tpl-h"><b><span class="tpl-k k-${kind}">${K[kind]}</span> ${esc(it.name)}</b><span class="tpl-act">${act}</span></div>
      <p>${esc(it.what)}</p>${how}
      <details><summary>Setup (${(it.setup || []).length} steps) and test</summary><ol>${(it.setup || []).map(x => `<li>${esc(x)}</li>`).join("")}</ol><p><b>Test:</b> ${esc(it.test || "")}</p></details>
      ${APP_MODE ? `<p class="tpl-rep"><button type="button" class="note linkbtn" data-tpl-report="${esc(id)}|${i}">Report a problem with this template</button></p>` : ""}</div>`;
  };
  const kinds = [...new Set(m.items.map(it => it.kind || "n8n"))];
  const howTo = [
    kinds.includes("n8n") ? "<b>n8n:</b> click Copy, open a new workflow and press Ctrl+V (Cmd+V on a Mac)." : "",
    kinds.includes("make") ? "<b>Make:</b> save the blueprint file, then in a new scenario open the … menu and choose Import Blueprint. If a module shows as unknown, rebuild it from “Build it by hand”." : "",
    kinds.includes("zap") ? "<b>Zapier:</b> build the Zap from the steps (a ready-to-use Zapier template link will be added here)." : ""].filter(Boolean).join(" ");
  return `<details class="reveal tplbox" id="tplbox"><summary>Templates · ${m.items.length} ${m.items.length > 1 ? "workflows" : "workflow"} (${kinds.map(k => K[k]).join(", ")})</summary><div>
    <p class="note">Build it yourself first; use these to compare, or to get unstuck. ${howTo} Then add your own connections and replace the UPPER_CASE placeholders. Test mode and test data only.</p>
    ${m.items.map(one).join("")}
    <p class="note tpl-checked">Checked for structure; tell us if anything doesn't import. If a step shows a warning after import, open it and re-select the option it names.</p>
  </div></details>`;
}
function addTpl(el, id){
  const art = el.querySelector("article"); if(!art || !TPLS[id] || art.querySelector(".tplbox")) return;
  const tagOf = p => ((p.querySelector(".part-h .tag") || {}).textContent || "");
  const parts = $$(".part", art);
  const host = id.startsWith("B") ? parts.find(p => /REFERENCE BUILD/.test(tagOf(p))) : parts.find(p => /^PART 4/.test(tagOf(p)));
  if(host) host.insertAdjacentHTML("beforeend", tplHTML(id));
}
const _enhanceLesson1 = enhanceLesson;
enhanceLesson = function(el, id){ _enhanceLesson1(el, id); addTpl(el, id); };
function copyText(t){
  if(navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).catch(() => fallbackCopy(t));
  fallbackCopy(t); return Promise.resolve();
}
function fallbackCopy(t){ const ta = document.createElement("textarea"); ta.value = t; ta.setAttribute("readonly",""); ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); try{ document.execCommand("copy"); }catch(e){} ta.remove(); }
document.addEventListener("click", e => {
  const go = e.target.closest("[data-tpl-go]");
  if(go){ const d = document.getElementById("tplbox"); if(d){ d.open = true; d.scrollIntoView({behavior:"smooth", block:"start"}); } return; }
  const b = e.target.closest("[data-tpl-copy]"); if(!b) return;
  const [id, i] = b.dataset.tplCopy.split("|"); const it = TPLS[id].items[+i];
  const lbl = b.textContent; copyText(JSON.stringify(it.wf, null, 2)).then(() => { b.textContent = "Copied ✓"; setTimeout(() => b.textContent = lbl, 2500); toast(it.kind === "make" ? "Copied. Save it as a .json file, then use Import Blueprint in Make." : "Copied. In n8n, open a new workflow and press Ctrl+V (Cmd+V on a Mac)."); });
});

/* Template downloads (app: built from the embedded JSON) and "Report a problem" (app: POST /api/feedback) */
document.addEventListener("click", e => {
  const dl = e.target.closest("[data-tpl-dl]");
  if(dl){
    const [id, i] = dl.dataset.tplDl.split("|"); const it = TPLS[id] && TPLS[id].items[+i]; if(!it || !it.wf) return;
    try{ const url = URL.createObjectURL(new Blob([JSON.stringify(it.wf, null, 2)], {type:"application/json"}));
      const a = document.createElement("a"); a.href = url; a.download = it.file || (it.name || "template").replace(/[^\w-]+/g, "-") + ".json"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); }catch(err){ toast("Couldn't save the file. Use Copy instead."); }
    return;
  }
  const rp = e.target.closest("[data-tpl-report]"); if(!rp) return;
  const [id, i] = rp.dataset.tplReport.split("|"); const it = (TPLS[id] && TPLS[id].items[+i]) || {};
  modal(`<h3>Report a problem with this template</h3><p class="note">${esc(it.name || "Template")} · ${esc(id.startsWith("B") ? "Boss " + id.slice(1) : "Lesson " + id)}</p>
    <form id="tplRepForm" data-item="${esc(id)}" data-file="${esc(it.file || it.name || "")}" style="display:grid;gap:12px">
      <label class="fld">What went wrong?<select id="trKind"><option value="import">It doesn't import</option><option value="step">A step shows an error or warning</option><option value="instructions">The setup steps are unclear or wrong</option><option value="other">Something else</option></select></label>
      <label class="fld">Details<textarea id="trMsg" required maxlength="2000" placeholder="Which tool and version, which step, and the exact error message"></textarea></label>
      <button type="submit" class="cta">Send report</button>
      <p class="note">Never paste API keys, passwords or customer data.</p></form>`);
});
document.addEventListener("submit", e => {
  if(e.target.id !== "tplRepForm") return; e.preventDefault();
  const f = e.target, msg = $("#trMsg").value.trim(); if(!msg) return;
  if(/sk_(test|live)_[A-Za-z0-9]{6,}|sk-[A-Za-z0-9-]{10,}/.test(msg)){ toast("That looks like a secret key. Remove it before sending."); return; }
  if(!APP_MODE) return;
  const btn = f.querySelector("button[type=submit]"); btn.disabled = true;
  fetch((AM.api || "/api") + "/feedback", {method:"POST", credentials:"same-origin", headers:{"content-type":"application/json"}, body:JSON.stringify({itemId:f.dataset.item, kind:$("#trKind").value, file:f.dataset.file, message:msg})})
    .then(r => { if(!r.ok) throw r.status; closeModal(); toast("Thanks. We'll check the template and fix it."); })
    .catch(() => { btn.disabled = false; toast("Couldn't send the report. Try again in a moment."); });
});

/* ================= APP MODE: progress sync, reviews, journal and help posts ================= */
function missionStatusText(k){
  const tier = k.split(":")[1];
  return S.missions[k] ? `Accepted ✓ +${MXP[tier]} XP` : `Submit this mission for review to earn +${MXP[tier]} XP`;
}
/* Missions (and boss/capstone projects) count as done when a review has been accepted on the server. */
function applyReviews(){
  if(!APP_MODE) return;
  S.missions = {};
  (AM.reviews || []).forEach(r => {
    if(!r || !r.itemId) return;
    if(["b","s","g"].indexOf(r.tier) >= 0) S.missions[r.itemId + ":" + r.tier] = true;
    else if((r.tier === "boss" || r.tier === "capstone") && ORDER.some(o => o.id === r.itemId)) done[r.itemId] = true;
  });
}
/* writer C's review add-on dispatches: window.dispatchEvent(new CustomEvent("automancy:review", {detail:{itemId, tier, status}})) */
window.addEventListener("automancy:review", e => {
  const d = (e && e.detail) || {}; if(!APP_MODE || d.status !== "accepted" || !d.itemId) return;
  AM.reviews = AM.reviews || []; if(!AM.reviews.some(r => r.itemId === d.itemId && r.tier === d.tier)) AM.reviews.push({itemId:d.itemId, tier:d.tier});
  const before = xpParts().total; applyReviews(); syncChecks(); const gain = xpParts().total - before;
  $$(`[data-mission-status="${d.itemId}:${d.tier}"]`).forEach(x => { x.classList.add("ok"); x.textContent = missionStatusText(`${d.itemId}:${d.tier}`); });
  if(gain > 0) award(gain, `Review accepted on ${d.itemId}`); else { saveS(); refreshPlatform(); }
  if(typeof update === "function") update();
});

let syncT = null, syncBusy = false, syncAgain = false, syncFails = 0;
function queueSync(){ if(!APP_MODE) return; clearTimeout(syncT); syncT = setTimeout(() => { syncT = null; pushProgress(false); }, 1500); }
function pushProgress(keepalive){
  if(!APP_MODE) return;
  if(syncBusy){ syncAgain = true; return; }
  syncBusy = true;
  const body = JSON.stringify({done, state:S, xp:xpParts().total, weekXp:weekXp()});
  fetch((AM.api || "/api") + "/progress", {method:"PUT", credentials:"same-origin", headers:{"content-type":"application/json"}, body, keepalive:!!keepalive && body.length < 60000})
    .then(r => { if(!r.ok) throw r.status; syncFails = 0; })
    .catch(st => {
      if(st === 401) toast("You've been signed out. Sign in again to keep saving your progress.");
      else if(++syncFails <= 3) setTimeout(queueSync, 4000 * syncFails);
      else toast("Your progress couldn't be saved. Check your connection; we'll try again on your next step.");
    })
    .finally(() => { syncBusy = false; if(syncAgain){ syncAgain = false; queueSync(); } });
}
if(APP_MODE){
  window.addEventListener("pagehide", () => { if(syncT){ clearTimeout(syncT); syncT = null; pushProgress(true); } });
  document.addEventListener("visibilitychange", () => { if(document.visibilityState === "hidden" && syncT){ clearTimeout(syncT); syncT = null; pushProgress(true); } });
}

function postCommunity(payload){
  return fetch((AM.api || "/api") + "/community/posts", {method:"POST", credentials:"same-origin", headers:{"content-type":"application/json"}, body:JSON.stringify(payload)})
    .then(r => r.ok ? r.json().catch(() => ({})) : Promise.reject(r.status));
}
const SECRET_RX = /sk_(test|live)_[A-Za-z0-9]{6,}|sk-[A-Za-z0-9-]{10,}|\b0[789][01]\d{8}\b/;
const itemName = id => { const it = ORDER.find(o => o.id === id); return (id && id.startsWith("B") ? "Boss " + id.slice(1) : "Lesson " + id) + (it ? " · " + it.t : ""); };
function journalModal(id, review){
  modal(`<h3>Post to my learning journal <span class="note">+10 XP</span></h3><p class="note">${esc(itemName(id))}</p>
    <form id="jPostForm" data-item="${esc(id || "")}" style="display:grid;gap:12px">
      <label class="fld">Review: what did you build?<textarea id="jpReview" maxlength="1200" required>${esc(review || "")}</textarea></label>
      <label class="fld">Reflect: what was hard, what did you learn?<textarea id="jpReflect" maxlength="800"></textarea></label>
      <label class="fld">Recommend: a tip for the next learner<textarea id="jpRec" maxlength="600"></textarea></label>
      <label class="fld">Time it saves (optional)<input id="jpSaved" type="text" maxlength="60" placeholder="e.g. 3 hours a week"></label>
      <label class="switch"><input type="checkbox" id="jpStuck"> I'm stuck and want help from peers</label>
      <label class="fld" id="jpStuckWrap" hidden>What are you stuck on?<textarea id="jpStuckTxt" maxlength="600" placeholder="What you tried, what you expected, what happened instead"></textarea></label>
      <button type="submit" class="cta">Post to journal</button>
      <p class="note">Never paste API keys, passwords or real customer data.</p></form>`);
}
function helpModal(id){
  modal(`<h3>Ask the community for help</h3><p class="note">${esc(itemName(id))}</p>
    <form id="helpPostForm" data-item="${esc(id || "")}" style="display:grid;gap:12px">
      <label class="fld">What are you stuck on?<textarea id="hpTxt" maxlength="1500" required placeholder="What you tried, what you expected, what happened instead (paste the error message)"></textarea></label>
      <button type="submit" class="cta">Post to the help board</button>
      <p class="note">Never paste API keys, passwords or real customer data.</p></form>`);
}
document.addEventListener("change", e => { if(e.target.id === "jpStuck"){ const w = $("#jpStuckWrap"); if(w) w.hidden = !e.target.checked; } });
document.addEventListener("submit", e => {
  const f = e.target;
  if(f.id === "jPostForm"){
    e.preventDefault(); const id = f.dataset.item || null;
    const v = k => ($("#" + k) ? $("#" + k).value.trim() : "");
    const review = v("jpReview"), reflect = v("jpReflect"), rec = v("jpRec"), saved = v("jpSaved"), stuck = $("#jpStuck").checked ? (v("jpStuckTxt") || "I'm stuck on this lesson.") : "";
    if(!review) return;
    if(SECRET_RX.test([review, reflect, rec, stuck].join(" "))){ toast("Remove the key or phone number before posting. Use placeholders like <API_KEY>."); return; }
    const body = [`Review: ${review}`, reflect && `Reflect: ${reflect}`, rec && `Recommend: ${rec}`, saved && `Time saved: ${saved}`].filter(Boolean).join("\n\n");
    const btn = f.querySelector("button[type=submit]"); btn.disabled = true;
    postCommunity({type:"journal", itemId:id || undefined, title:itemName(id), body})
      .then(() => stuck ? postCommunity({type:"help", itemId:id || undefined, title:"Help with " + itemName(id), body:stuck}).catch(() => toast("Your journal entry posted, but the help request didn't. Try again from the lesson end.")) : null)
      .then(() => { S.journal.unshift({id:"m" + Date.now(), mod:id, review:review.slice(0, 300), stuck:stuck ? stuck.slice(0, 200) : "", at:Date.now()}); closeModal(); award(10, "Journal entry posted"); toast("Posted to your learning journal."); })
      .catch(() => { btn.disabled = false; toast("Couldn't post right now. Try again in a moment."); });
  }
  if(f.id === "helpPostForm"){
    e.preventDefault(); const id = f.dataset.item || null; const txt = $("#hpTxt").value.trim(); if(!txt) return;
    if(SECRET_RX.test(txt)){ toast("Remove the key or phone number before posting."); return; }
    const btn = f.querySelector("button[type=submit]"); btn.disabled = true;
    postCommunity({type:"help", itemId:id || undefined, title:"Help with " + itemName(id), body:txt})
      .then(() => { closeModal(); markActive(); saveS(); toast(`Posted. Replies appear in the community.`); })
      .catch(() => { btn.disabled = false; toast("Couldn't post right now. Try again in a moment."); });
  }
});

(function appBoot(){
  if(!APP_MODE) return;
  S.profile.name = String((AM.user && AM.user.name) || "").trim();
  // First visit with an empty account: move progress saved in this browser by the old prototype (once per user).
  const pr = AM.progress || {};
  const empty = !(pr.done && Object.keys(pr.done).length) && !(pr.state && Object.keys(pr.state).length);
  if(empty){
    try{
      const flag = "automancy-migrated-" + ((AM.user && AM.user.id) || "");
      if(!localStorage.getItem(flag)){
        const od = JSON.parse(localStorage.getItem(KEY) || localStorage.getItem("flowforge-progress-v1") || "null");
        const os = JSON.parse(localStorage.getItem(SKEY) || "null");
        if((od && typeof od === "object") || (os && typeof os === "object")){
          if(od && typeof od === "object") Object.keys(od).forEach(k => { if(od[k] && ORDER.some(o => o.id === k)) done[k] = true; });
          if(os && typeof os === "object"){ S = mergeState(os); S.profile.name = String((AM.user && AM.user.name) || "").trim(); }
          localStorage.setItem(flag, "1"); queueSync();
          setTimeout(() => toast("We moved the progress saved in this browser to your account."), 400);
        }
      }
    }catch(e){}
  }
  applyReviews(); syncChecks();
  // header: account and sign out
  const nav = $("#mainnav"), L = AM.links || {};
  if(nav && !nav.querySelector(".acctlink")){
    nav.insertAdjacentHTML("beforeend", `<a class="acctlink" href="${esc(L.account || "/account")}">Account</a>${L.logout ? `<form method="post" action="${esc(L.logout)}" class="acctlink"><button type="submit" class="linkbtn">Sign out</button></form>` : ""}`);
  }
  $$("#mainnav a, .site-foot a").forEach(a => { const h = (a.getAttribute("href") || "").replace(/^#/, ""); if(EXT[h]) a.href = EXT[h]; });
  const brand = $("#brandLink"); if(brand) brand.setAttribute("href", "#course");
  document.body.classList.add("appmode");
  document.body.classList.toggle("live-calls", !!(AM.settings && AM.settings.live_calls_visible));
})();
