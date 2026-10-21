/* Automancy Academy · AI review panels for the course (plain browser JS, inlined by /learn after the course script).
 * Lessons: a "Submit for review" panel under each Bronze/Silver/Gold mission in PART 6.
 * Bosses: one panel in the SCORING part. Capstone 6.4: Silver and Gold panels in PART 6, and one "capstone" panel in SCORING.
 * Calls POST/GET /api/review. When a submission is accepted, ticks the course's own mission (or "done") checkbox
 * and dispatches a change event so the course awards XP as usual. Reads window.AUTOMANCY. */
(function () {
  "use strict";
  var A = window.AUTOMANCY || {};
  var API = (A.api || "/api").replace(/\/$/, "") + "/review";
  var FREE = A.free || ["0.1", "0.2", "0.3", "0.4", "0.5", "0.6", "B0"];
  var TIER = { b: "Bronze", s: "Silver", g: "Gold", boss: "Boss project", capstone: "Capstone" };
  var cache = {};       // itemId -> submissions (newest first)
  var busy = false;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function $(sel, el) { return (el || document).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
  function when(iso) { try { return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } }

  function currentId() {
    var h = location.hash.slice(1), m = h.match(/^m-(\d)-(\d+)$/), b = h.match(/^boss-(\d)$/);
    return m ? m[1] + "." + m[2] : b ? "B" + b[1] : null;
  }
  function tagOf(part) { var t = part.querySelector(".part-h .tag"); return t ? t.textContent : ""; }

  /* ---------- styles (course tokens, mobile-first) ---------- */
  if (!document.getElementById("rv-style")) {
    var st = document.createElement("style"); st.id = "rv-style";
    st.textContent = [
      ".rv-panel{margin-top:10px;border:1.5px dashed var(--line);border-radius:14px;padding:12px;display:grid;gap:10px;background:var(--paper2,transparent)}",
      ".rv-panel > *{min-width:0}",
      ".rv-panel h5{margin:0;font-size:1rem}",
      ".rv-panel textarea{min-height:180px;font-family:var(--mono);font-size:.84rem}",
      ".rv-panel .rv-links{min-height:56px}",
      ".rv-acts{display:flex;flex-wrap:wrap;gap:8px;align-items:center}",
      ".rv-card{background:var(--card);border:1.5px solid var(--line);border-radius:12px;padding:12px;display:grid;gap:8px}",
      ".rv-card > *{min-width:0;margin:0}",
      ".rv-card.ok{border-color:var(--volt)}.rv-card.warn{border-color:var(--sun)}.rv-card.bad{border-color:var(--glitch)}",
      ".rv-card ul{margin:0;padding-left:20px;display:grid;gap:4px;font-size:.92rem}",
      ".rv-head{display:flex;flex-wrap:wrap;gap:8px;align-items:center}",
      ".rv-score{font-family:var(--mono);font-weight:700}",
      ".rv-crit li.met::marker{content:'✓  '}.rv-crit li.unmet::marker{content:'✗  '}",
      ".rv-hist{font-size:.88rem}.rv-hist summary{cursor:pointer;font-weight:600}",
      ".rv-hist .rv-card{margin-top:8px}",
      ".rv-err{color:var(--glitch);font-weight:600}",
      "@media print{.rv-panel{display:none!important}}"
    ].join("\n");
    document.head.appendChild(st);
  }

  /* ---------- data ---------- */
  function load(itemId) {
    if (cache[itemId]) return Promise.resolve(cache[itemId]);
    if (!A.user) return Promise.resolve([]);
    return fetch(API + "?itemId=" + encodeURIComponent(itemId), { credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (list) { cache[itemId] = Array.isArray(list) ? list : []; return cache[itemId]; })
      .catch(function () { return []; });
  }

  /* ---------- marking a mission done in the course ---------- */
  function tick(input) {
    if (!input || input.checked) return;
    input.checked = true;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function known(itemId, tier) {
    return (A.reviews || []).some(function (r) { return r && r.itemId === itemId && r.tier === tier; });
  }
  function markDone(itemId, tier) {
    // The course (app mode) listens for this event, records the accepted review and awards the XP itself.
    if (!known(itemId, tier)) {
      try { window.dispatchEvent(new CustomEvent("automancy:review", { detail: { itemId: itemId, tier: tier, status: "accepted" } })); } catch (e) { /* old browsers */ }
      if (!known(itemId, tier)) { A.reviews = A.reviews || []; A.reviews.push({ itemId: itemId, tier: tier }); }
    }
    // Fallback for the stand-alone course, which still shows tick boxes.
    var lesson = document.getElementById("lesson"); if (!lesson || currentId() !== itemId) return;
    if (tier === "b" || tier === "s" || tier === "g") { tick(lesson.querySelector('input[data-mission="' + itemId + ":" + tier + '"]')); return; }
    if (tier === "capstone") tick(lesson.querySelector('input[data-mission="' + itemId + ':b"]')); // the Bronze capstone mission
    tick(document.getElementById("lesson-done-" + itemId.replace(".", "-")));                      // boss / capstone "done"
  }

  /* ---------- rendering ---------- */
  function pill(status) {
    var m = { accepted: ["ok", "Accepted"], revise: ["warn", "Revise and resubmit"], rejected: ["bad", "Not accepted"], pending: ["info", "Waiting for a reviewer"] }[status] || ["info", status];
    return '<span class="pill2 ' + m[0] + '">' + esc(m[1]) + "</span>";
  }
  function list(title, arr, cls) {
    if (!arr || !arr.length) return "";
    return "<div><b>" + esc(title) + "</b><ul" + (cls ? ' class="' + cls + '"' : "") + ">" + arr.map(function (x) {
      if (typeof x === "string") return "<li>" + esc(x) + "</li>";
      return '<li class="' + (x.met ? "met" : "unmet") + '">' + esc(x.name) + (x.note ? ' <span class="note">· ' + esc(x.note) + "</span>" : "") + "</li>";
    }).join("") + "</ul></div>";
  }
  function card(s, opts) {
    opts = opts || {};
    var cls = s.status === "accepted" ? "ok" : s.status === "pending" ? "" : s.status === "revise" ? "warn" : "bad";
    var crit = s.rubric && s.rubric.length
      ? s.rubric.map(function (r) { return { name: r.area + " (" + r.points + "/" + r.max + ")", met: r.points >= Math.ceil(r.max * 0.7), note: r.note }; })
      : s.criteria;
    var must = s.rubric && s.criteria ? s.criteria.filter(function (c) { return /^Must-have:/.test(c.name); }) : [];
    return '<div class="rv-card ' + cls + '" aria-live="polite">' +
      '<div class="rv-head">' + pill(s.status) + (typeof s.score === "number" ? '<span class="rv-score">' + s.score + "/100</span>" : "") +
      (s.createdAt ? '<span class="note">' + esc(when(s.createdAt)) + "</span>" : "") + "</div>" +
      (s.feedback ? "<p>" + esc(s.feedback) + "</p>" : "") +
      (s.reviewerNote && s.aiFeedback && s.aiFeedback !== s.feedback ? '<p class="note">AI reviewer: ' + esc(s.aiFeedback) + "</p>" : "") +
      list("What you did well", s.strengths) +
      list("Fix next", s.fixes) +
      (must.length ? list("Must-haves", must, "rv-crit") : "") +
      (crit && crit.length ? '<details><summary class="note">Criteria</summary>' + list("", crit, "rv-crit") + "</details>" : "") +
      (opts.resubmit && (s.status === "revise" || s.status === "rejected") ? '<div class="rv-acts"><button type="button" class="btn ghost" data-rv-again>Resubmit</button></div>' : "") +
      "</div>";
  }

  function logTemplate(art) {
    var pre = art.querySelector("pre[id^='log-']") || art.querySelector("pre[id^='docs-']");
    return pre ? pre.textContent.trim() : "";
  }

  function panelHtml(itemId, tier, title, locked) {
    var head = "<h5>Submit for review" + (title ? ' <span class="note">· ' + esc(TIER[tier]) + "</span>" : "") + "</h5>";
    if (!A.user) return head + '<p class="note">Log in to submit your work for review.</p>';
    if (locked) return head + '<p class="note">Reviews for this lesson come with the full course. <a href="' + esc((A.links && A.links.pricing) || "/pricing") + '">See plans</a></p>';
    var boss = tier === "boss" || tier === "capstone";
    return head +
      '<p class="note">Our AI reviewer marks what you write and paste here: your log, test tables, run outputs and a short description of what you built' +
      (boss ? ", scored against the rubric below (80+ with every must-have to pass)" : ", against this mission's “Done when” criteria") +
      ". Links (Loom, screenshots, Drive) are saved for spot-checks but not opened, so paste the evidence itself. Never paste real API keys or real customer data.</p>" +
      '<div class="rv-result"></div>' +
      '<form class="rv-form" novalidate>' +
      '<label class="fld">Your evidence<textarea class="rv-text" maxlength="20000" required></textarea></label>' +
      '<label class="fld">Links <span class="note">(optional, one per line)</span><textarea class="rv-links" maxlength="5000" placeholder="https://www.loom.com/share/…"></textarea></label>' +
      '<div class="rv-acts"><button type="submit" class="btn">Submit for review</button><span class="note rv-status" aria-live="polite"></span></div>' +
      "</form>" +
      '<div class="rv-history"></div>';
  }

  function draftKey(itemId, tier) { return "am-review-draft:" + itemId + ":" + tier; }

  function mount(host, where, itemId, tier, title, art) {
    if (host.querySelector('.rv-panel[data-rv-tier="' + tier + '"]')) return;
    var locked = FREE.indexOf(itemId) < 0 && !(A.ent && A.ent.course);
    var panel = document.createElement("div");
    panel.className = "rv-panel"; panel.setAttribute("data-rv-tier", tier); panel.setAttribute("data-rv-item", itemId);
    panel.innerHTML = panelHtml(itemId, tier, title, locked);
    if (where === "append") host.appendChild(panel); else host.insertAdjacentElement("afterend", panel);
    var form = panel.querySelector(".rv-form"); if (!form) return;
    var ta = panel.querySelector(".rv-text"), links = panel.querySelector(".rv-links");
    var draft = store(draftKey(itemId, tier));
    var tpl = logTemplate(art);
    ta.value = draft || (tpl ? tpl + "\n\nWhat I built and how I tested it:\n" : "What I built:\n\nHow I tested it (paste the results):\n\n");
    ta.addEventListener("input", function () { store(draftKey(itemId, tier), ta.value); });
    form.addEventListener("submit", function (e) { e.preventDefault(); submit(panel, itemId, tier, ta, links); });
    panel.addEventListener("click", function (e) {
      if (e.target.closest("[data-rv-again]")) { form.hidden = false; ta.focus(); }
    });
    render(panel, itemId, tier);
  }

  function render(panel, itemId, tier) {
    load(itemId).then(function (all) {
      var mine = all.filter(function (s) { return s.tier === tier; });
      var res = panel.querySelector(".rv-result"), hist = panel.querySelector(".rv-history"), form = panel.querySelector(".rv-form");
      if (!res) return;
      var latest = mine[0];
      var accepted = mine.filter(function (s) { return s.status === "accepted"; })[0];
      res.innerHTML = latest ? card(latest, { resubmit: true }) : "";
      if (form) form.hidden = !!accepted || (latest && latest.status === "pending");
      if (accepted) markDone(itemId, tier);
      var older = mine.slice(1);
      hist.innerHTML = older.length ? '<details class="rv-hist"><summary>Earlier submissions (' + older.length + ")</summary>" + older.map(function (s) { return card(s); }).join("") + "</details>" : "";
    });
  }

  function submit(panel, itemId, tier, ta, linksEl) {
    if (busy) return;
    var status = panel.querySelector(".rv-status"), btn = panel.querySelector(".rv-form button[type=submit]");
    var content = ta.value.trim();
    if (content.length < 30) { status.innerHTML = '<span class="rv-err">Paste your evidence first: your log, test results or outputs.</span>'; return; }
    var links = linksEl.value.split(/[\s,]+/).filter(function (x) { return /^https?:\/\//i.test(x); }).slice(0, 10);
    busy = true; btn.disabled = true; status.textContent = "Reviewing your work… this can take up to a minute.";
    fetch(API, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ itemId: itemId, tier: tier, content: content, links: links }) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }, function () { return { ok: false, j: {} }; }); })
      .then(function (x) {
        if (!x.ok) { status.innerHTML = '<span class="rv-err">' + esc(x.j.error || "Something went wrong. Try again in a minute.") + "</span>"; return; }
        status.textContent = "";
        delete cache[itemId];
        if (x.j.status === "accepted") store(draftKey(itemId, tier), null);
        render(panel, itemId, tier);
      })
      .catch(function () { status.innerHTML = '<span class="rv-err">Couldn’t reach the reviewer. Check your connection and try again.</span>'; })
      .then(function () { busy = false; btn.disabled = false; });
  }

  /* ---------- placing panels ---------- */
  function enhance() {
    var id = currentId(), lesson = document.getElementById("lesson");
    if (!id || !lesson || lesson.hidden) return;
    var art = lesson.querySelector("article") || lesson;
    var parts = $$(".part", art);
    var scoring = parts.filter(function (p) { return tagOf(p).trim() === "SCORING"; })[0];
    if (/^B\d$/.test(id)) {
      if (scoring) mount(scoring, "append", id, "boss", "", art);
      return;
    }
    var p6 = parts.filter(function (p) { return /^PART 6/.test(tagOf(p)); })[0];
    if (p6) $$(".mission", p6).forEach(function (ms) {
      var t = ms.querySelector(".tier"); if (!t) return;
      var tier = t.classList.contains("t-g") ? "g" : t.classList.contains("t-s") ? "s" : "b";
      if (id === "6.4" && tier === "b") {
        if (!ms.querySelector(".rv-pointer")) ms.insertAdjacentHTML("beforeend", '<p class="note rv-pointer">Submit the capstone itself in the review panel under the rubric below.</p>');
        return;
      }
      mount(ms, "append", id, tier, ms.querySelector("h4") ? ms.querySelector("h4").textContent : "", art);
    });
    if (id === "6.4" && scoring) mount(scoring, "append", id, "capstone", "", art);
  }

  var timer = null;
  function schedule() { clearTimeout(timer); timer = setTimeout(enhance, 60); }
  window.addEventListener("hashchange", schedule);
  var lessonEl = document.getElementById("lesson");
  if (lessonEl && window.MutationObserver) new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) if (muts[i].target === lessonEl) { schedule(); return; }
  }).observe(lessonEl, { childList: true });
  schedule();
})();
