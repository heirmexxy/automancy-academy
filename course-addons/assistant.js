/* Automancy Academy · "Ask Sage" course assistant (writer F)
 * A floating button on lesson pages that opens a small chat panel. Calls POST /api/assistant.
 * Hidden entirely when GET /api/assistant says Sage is unavailable. All text is inserted with textContent.
 */
(function () {
  "use strict";
  var A = window.AUTOMANCY || {};
  var API = (A.api || "/api").replace(/\/$/, "");
  if (!A.user || typeof fetch !== "function") return;

  var histories = {};   // itemId → [{role, content}]
  var busy = false, limit = 30, root, panel, log, form, input, sendBtn, fab, note;

  function lessonId() {
    var h = location.hash.replace(/^#/, ""), m;
    var lesson = document.getElementById("lesson");
    if (lesson && lesson.hidden) return null;
    if ((m = h.match(/^m-(\d)-(\d+)$/))) return m[1] + "." + m[2];
    if ((m = h.match(/^boss-(\d)$/))) return "B" + m[1];
    return null;
  }

  var CSS = "" +
    ".sage-fab{position:fixed;right:16px;bottom:16px;z-index:60;display:flex;align-items:center;gap:8px;padding:12px 16px;border-radius:999px;border:2px solid var(--ink,#141414);background:var(--grape,#7651E8);color:#fff;font:700 15px/1 var(--body,system-ui,sans-serif);box-shadow:0 4px 0 var(--ink,#141414);cursor:pointer}" +
    ".sage-fab:focus-visible,.sage-panel button:focus-visible,.sage-panel textarea:focus-visible{outline:3px solid var(--sky,#2E78E6);outline-offset:2px}" +
    ".sage-fab[hidden],.sage-panel[hidden]{display:none}" +
    ".sage-panel{position:fixed;right:16px;bottom:16px;z-index:61;width:min(380px,calc(100vw - 32px));height:min(560px,calc(100vh - 32px));display:flex;flex-direction:column;background:var(--card,#fff);color:var(--ink,#141414);border:2px solid var(--ink,#141414);border-radius:16px;box-shadow:0 8px 0 var(--ink,#141414);font:15px/1.5 var(--body,system-ui,sans-serif);overflow:hidden}" +
    ".sage-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 14px;background:var(--grape,#7651E8);color:#fff}" +
    ".sage-head b{font-size:16px}.sage-head small{display:block;opacity:.85;font-size:12px}" +
    ".sage-x{background:transparent;border:2px solid #fff;color:#fff;border-radius:8px;padding:4px 10px;font:inherit;cursor:pointer}" +
    ".sage-log{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px}" +
    ".sage-msg{max-width:92%;padding:8px 12px;border-radius:12px;white-space:pre-wrap;word-wrap:break-word}" +
    ".sage-msg.u{align-self:flex-end;background:var(--paper2,#F2EDE3)}" +
    ".sage-msg.a{align-self:flex-start;background:var(--paper,#FBF8F2);border:1px solid var(--line,#ddd)}" +
    ".sage-msg.w{align-self:stretch;background:#FFF4D6;border:1px solid #E0B000;font-size:14px}" +
    ".sage-msg.e{align-self:stretch;background:#FDE8E8;border:1px solid #D04040;font-size:14px}" +
    ".sage-msg pre{margin:6px 0;padding:8px;background:var(--ink,#141414);color:#f5f5f5;border-radius:8px;overflow-x:auto;white-space:pre;font:13px/1.45 var(--mono,ui-monospace,monospace)}" +
    ".sage-form{display:flex;gap:8px;padding:10px;border-top:1px solid var(--line,#ddd)}" +
    ".sage-form textarea{flex:1;resize:none;min-height:44px;max-height:120px;padding:8px 10px;border:2px solid var(--ink,#141414);border-radius:10px;font:inherit;background:var(--paper,#fff);color:inherit}" +
    ".sage-form button{padding:0 14px;border:2px solid var(--ink,#141414);border-radius:10px;background:var(--sun,#FFC94D);font:700 14px var(--body,system-ui,sans-serif);cursor:pointer;color:var(--ink,#141414)}" +
    ".sage-form button[disabled]{opacity:.6;cursor:wait}" +
    ".sage-note{padding:0 12px 10px;font-size:12px;color:var(--muted,#666)}" +
    "@media (max-width:520px){.sage-panel{right:0;bottom:0;width:100vw;height:85vh;border-radius:16px 16px 0 0}.sage-fab{right:12px;bottom:12px}}" +
    "@media print{.sage-fab,.sage-panel{display:none!important}}";

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function addMsg(kind, text) {
    var m = el("div", "sage-msg " + kind);
    // Render ``` fenced code as <pre>, everything else as plain text (never HTML).
    String(text).split(/```[a-zA-Z]*\n?/).forEach(function (part, i) {
      if (!part) return;
      if (i % 2) { var pre = el("pre"); pre.textContent = part.replace(/\n$/, ""); m.appendChild(pre); }
      else m.appendChild(document.createTextNode(part.replace(/^\n+|\n+$/g, "")));
    });
    log.appendChild(m); log.scrollTop = log.scrollHeight;
    return m;
  }

  function build() {
    var st = el("style"); st.textContent = CSS; document.head.appendChild(st);
    root = el("div"); root.className = "sage-root";
    fab = el("button", "sage-fab"); fab.type = "button"; fab.hidden = true;
    fab.setAttribute("aria-haspopup", "dialog"); fab.setAttribute("aria-expanded", "false");
    fab.appendChild(el("span", null, "✦")); fab.lastChild.setAttribute("aria-hidden", "true");
    fab.appendChild(document.createTextNode("Ask Sage"));
    panel = el("div", "sage-panel"); panel.hidden = true; panel.id = "sagePanel";
    panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "false"); panel.setAttribute("aria-labelledby", "sageTitle");
    fab.setAttribute("aria-controls", "sagePanel");
    var head = el("div", "sage-head"); var t = el("div"); var b = el("b", null, "Sage"); b.id = "sageTitle";
    t.appendChild(b); t.appendChild(el("small", null, "Course assistant for this lesson"));
    var x = el("button", "sage-x", "Close"); x.type = "button"; x.setAttribute("aria-label", "Close Sage");
    head.appendChild(t); head.appendChild(x);
    log = el("div", "sage-log"); log.setAttribute("role", "log"); log.setAttribute("aria-live", "polite"); log.setAttribute("tabindex", "0"); log.setAttribute("aria-label", "Conversation with Sage");
    form = el("form", "sage-form");
    input = el("textarea"); input.rows = 2; input.maxLength = 1500; input.placeholder = "Ask about this lesson, or describe what's not working…"; input.setAttribute("aria-label", "Your question for Sage");
    sendBtn = el("button", null, "Send"); sendBtn.type = "submit";
    form.appendChild(input); form.appendChild(sendBtn);
    note = el("p", "sage-note", "Hints first on missions. Never paste API keys, passwords or customer data.");
    panel.appendChild(head); panel.appendChild(log); panel.appendChild(form); panel.appendChild(note);
    root.appendChild(fab); root.appendChild(panel); document.body.appendChild(root);

    fab.addEventListener("click", open);
    x.addEventListener("click", close);
    panel.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.preventDefault(); close(); } });
    input.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : send(); } });
    form.addEventListener("submit", function (e) { e.preventDefault(); send(); });
    window.addEventListener("hashchange", sync);
    sync();
  }

  var shownFor = null;
  function sync() {
    var id = lessonId();
    fab.hidden = !id || !panel.hidden;
    if (!id) { if (!panel.hidden) close(true); return; }
    if (shownFor !== id) {
      shownFor = id; log.textContent = "";
      (histories[id] || []).forEach(function (t) { addMsg(t.role === "user" ? "u" : "a", t.content); });
      if (!(histories[id] || []).length) addMsg("a", "Hi, I'm Sage. Ask me anything about " + (id.charAt(0) === "B" ? "Boss " + id.slice(1) : "Lesson " + id) + ": an idea that didn't click, or a step in your build that isn't working.");
    }
  }
  function open() { panel.hidden = false; fab.hidden = true; fab.setAttribute("aria-expanded", "true"); input.focus(); }
  function close(silent) { panel.hidden = true; fab.setAttribute("aria-expanded", "false"); fab.hidden = !lessonId(); if (!silent && !fab.hidden) fab.focus(); }

  function send() {
    var id = lessonId(), q = input.value.trim();
    if (!id || !q || busy) return;
    busy = true; sendBtn.disabled = true; sendBtn.textContent = "…";
    addMsg("u", q); input.value = "";
    var thinking = addMsg("a", "Thinking…");
    var hist = (histories[id] || []).slice(-12);
    fetch(API + "/assistant", {
      method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: id, question: q, history: hist })
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, j: j }; });
    }).then(function (res) {
      thinking.remove();
      if (res.j && res.j.warning) addMsg("w", res.j.warning);
      if (!res.ok || !res.j.answer) {
        addMsg("e", (res.j && res.j.error) || "Sage couldn't answer just now.");
        if (res.status === 503) { fab.hidden = true; }
        return;
      }
      addMsg("a", res.j.answer);
      var h = histories[id] = histories[id] || [];
      h.push({ role: "user", content: q }, { role: "assistant", content: res.j.answer });
      if (h.length > 12) h.splice(0, h.length - 12);
      if (typeof res.j.remaining === "number" && res.j.remaining <= 5) note.textContent = res.j.remaining + " of " + limit + " questions left today. Never paste API keys or customer data.";
    }).catch(function () {
      thinking.remove(); addMsg("e", "Couldn't reach Sage. Check your connection and try again.");
    }).then(function () { busy = false; sendBtn.disabled = false; sendBtn.textContent = "Send"; });
  }

  fetch(API + "/assistant", { credentials: "same-origin" })
    .then(function (r) { return r.ok ? r.json() : { available: false }; })
    .then(function (j) {
      if (!j || !j.available) return;
      if (j.limit) limit = j.limit;
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build); else build();
    })
    .catch(function () {});
})();
