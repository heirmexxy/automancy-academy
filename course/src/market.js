
/* ================= CREATOR MARKETPLACE (prototype) =================
   Courses by other creators: apply to teach, build a course, set a price, submit, admin reviews against
   the standards, approved courses go live in the catalogue. In the app this is /teach, /teach/standards,
   /teach/studio, /admin/courses and /courses (Next.js + Supabase); this file is the in-browser preview only. */
const MK_KEY = "automancy-market-v1";
const MK = {revenueShare:0.7, minNgn:2000, maxNgn:500000, minUsd:2, maxUsd:350, refundDays:14, reviewDays:5, minLessons:3, minDesc:200};
const MK_CATS = ["Automation","AI agents","No-code tools","Marketing and growth","Sales and CRM","Data and spreadsheets","Freelancing and client work","Productivity","Business operations","Other"];
const MK_KIND = {text:"Reading", video:"Video", quiz:"Quiz", task:"Task"};
const MK_STATUS = {draft:["Draft",""], submitted:["In review","warn"], changes_requested:["Changes requested","warn"], live:["Live","ok"], rejected:["Rejected","bad"]};
/* Same list as STANDARDS in the app (app/(site)/courses/_lib/core.ts). Keep them in step. */
const MK_STANDARDS = [
  ["Clear outcome","The title, subtitle and description say who the course is for and what learners will be able to do or build at the end, and the lessons deliver exactly that."],
  ["Hands-on","Learners do things, not just watch: every section ends with a task, quiz or build, and there is a final project or practical exercise."],
  ["Accurate and current","Steps, screenshots, prices and limits match the tools as they are today; nothing is misleading, and figures that change are hedged (\"check the current price\")."],
  ["Original work","All lessons, videos, templates and images are the creator's own or properly licensed. No copied courses, books, videos or paid templates."],
  ["Safe and lawful","Automation follows each platform's rules and the law (including data protection and consent). No spam, scraping against terms, fake engagement or ways around limits. Learners are never asked for passwords, API keys, OTPs or bank details."],
  ["Honest promises","No guaranteed income, get-rich-quick claims or fake urgency. Results claims are real and specific."],
  ["Clear and well produced","Writing is plain and well organised; videos have clear audio, readable screens and no long dead air; lessons are in a sensible order with descriptive titles."],
  ["Complete","Every lesson has its content, links work, free previews are set, and the course is finished (no \"coming soon\" lessons)."]
];
const mkN = x => Number(x).toLocaleString("en-NG");
let mk = {creator:null, courses:[], enrolled:{}};
try{ const raw = JSON.parse(localStorage.getItem(MK_KEY) || "null"); if(raw && Array.isArray(raw.courses)) mk = Object.assign(mk, raw); }catch(e){}
const mkSave = () => { try{ localStorage.setItem(MK_KEY, JSON.stringify(mk)); }catch(e){} };
const mkId = () => Math.random().toString(36).slice(2, 10);
let mkEdit = null, mkOpen = null, mkLesson = null, mkReview = null;

/* --- safe text formatting (a small Markdown subset; everything is escaped first, no HTML ever) --- */
function mkHref(u){ u = String(u).trim(); return /^https?:\/\/[^\s"<>]+$/i.test(u) || /^mailto:[^\s"<>]+@[^\s"<>]+$/i.test(u) ? u : null; }
function mkInline(s){
  s = esc(s);
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<i>$2</i>");
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, h) => { const u = mkHref(h.replace(/&amp;/g, "&")); return u ? `<a href="${esc(u)}" target="_blank" rel="noopener nofollow">${t}</a>` : t; });
  return s;
}
function mkMd(src){
  const lines = String(src || "").replace(/\r/g, "").split("\n"), out = [];
  let i = 0;
  while(i < lines.length){
    const l = lines[i];
    if(!l.trim()){ i++; continue; }
    if(/^```/.test(l.trim())){ const buf = []; i++; while(i < lines.length && !/^```/.test(lines[i].trim())) buf.push(lines[i++]); i++; out.push(`<pre class="mk-pre">${esc(buf.join("\n"))}</pre>`); continue; }
    let m;
    if((m = /^(#{2,4})\s+(.*)$/.exec(l))){ const n = Math.min(4, m[1].length + 1); out.push(`<h${n}>${mkInline(m[2])}</h${n}>`); i++; continue; }
    if(/^---+\s*$/.test(l)){ out.push("<hr>"); i++; continue; }
    if(/^>\s?/.test(l)){ const buf = []; while(i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, "")); out.push(`<blockquote>${mkInline(buf.join(" "))}</blockquote>`); continue; }
    if(/^\s*[-*]\s+/.test(l)){ const buf = []; while(i < lines.length && /^\s*[-*]\s+/.test(lines[i])) buf.push(lines[i++].replace(/^\s*[-*]\s+/, "")); out.push(`<ul>${buf.map(x => `<li>${mkInline(x)}</li>`).join("")}</ul>`); continue; }
    if(/^\s*\d+[.)]\s+/.test(l)){ const buf = []; while(i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) buf.push(lines[i++].replace(/^\s*\d+[.)]\s+/, "")); out.push(`<ol>${buf.map(x => `<li>${mkInline(x)}</li>`).join("")}</ol>`); continue; }
    const buf = []; while(i < lines.length && lines[i].trim() && !/^(#{2,4}\s|```|>|\s*[-*]\s+|\s*\d+[.)]\s+|---+\s*$)/.test(lines[i])) buf.push(lines[i++]);
    out.push(`<p>${mkInline(buf.join(" "))}</p>`);
  }
  return `<div class="mk-md">${out.join("")}</div>`;
}
function mkVideo(raw){
  let u; try{ u = new URL(String(raw || "").trim()); }catch(e){ return null; }
  if(u.protocol !== "https:") return null;
  const h = u.hostname.toLowerCase().replace(/^(www\.|m\.)/, "");
  if(h === "youtu.be" || h === "youtube.com"){ let id = h === "youtu.be" ? u.pathname.slice(1).split("/")[0] : (u.searchParams.get("v") || ""); const m = /^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/.exec(u.pathname); if(m) id = m[1]; return /^[A-Za-z0-9_-]{11}$/.test(id) ? "https://www.youtube-nocookie.com/embed/" + id + "?rel=0" : null; }
  if(h === "vimeo.com" || h === "player.vimeo.com"){ const m = /^\/(?:video\/)?(\d{5,12})/.exec(u.pathname); return m ? "https://player.vimeo.com/video/" + m[1] + "?dnt=1" : null; }
  if(h === "loom.com"){ const m = /^\/(?:share|embed)\/([0-9a-f]{32})/.exec(u.pathname); return m ? "https://www.loom.com/embed/" + m[1] : null; }
  return null;
}

/* --- checks: the same automatic checks the studio runs before "Submit for review" --- */
const mkLessons = c => c.sections.flatMap(s => s.lessons);
function mkLessonProblem(l){
  const n = `"${l.title}"`;
  if(l.kind === "text" && (l.body || "").trim().length < 50) return `Lesson ${n} needs at least 50 characters of text.`;
  if(l.kind === "video" && !mkVideo(l.video)) return `Lesson ${n} needs a YouTube, Vimeo or Loom link.`;
  if(l.kind === "quiz" && !(l.quiz || []).some(q => q.q.trim() && q.options.filter(o => o.trim()).length >= 2)) return `Quiz ${n} needs at least one complete question.`;
  if(l.kind === "task" && (l.task || "").trim().length < 20) return `Task ${n} needs instructions (at least 20 characters).`;
  return null;
}
function mkProblems(c){
  const out = [], ls = mkLessons(c);
  if((c.title || "").trim().length < 5) out.push("Give the course a title of at least 5 characters.");
  if((c.description || "").trim().length < MK.minDesc) out.push(`Write a description of at least ${MK.minDesc} characters (now ${(c.description || "").trim().length}).`);
  if(!c.category) out.push("Choose a category.");
  if(!/^https:\/\/\S+$/.test(c.cover || "")) out.push("Add a cover image URL (https).");
  if(!(c.priceNgn >= MK.minNgn && c.priceNgn <= MK.maxNgn)) out.push(`Set a naira price between ${ngn(MK.minNgn)} and ${ngn(MK.maxNgn)}.`);
  if(c.priceUsd && !(c.priceUsd >= MK.minUsd && c.priceUsd <= MK.maxUsd)) out.push(`The dollar price must be between $${MK.minUsd} and $${MK.maxUsd}, or left empty.`);
  if(ls.length < MK.minLessons) out.push(`Add at least ${MK.minLessons} lessons (now ${ls.length}).`);
  if(ls.length && !ls.some(l => l.preview)) out.push("Mark at least one lesson as a free preview.");
  ls.forEach(l => { const e = mkLessonProblem(l); if(e) out.push(e); });
  return out;
}
const mkPill = st => `<span class="pill2 ${MK_STATUS[st][1]}">${MK_STATUS[st][0]}</span>`;
const mkCover = c => /^https:\/\//.test(c.cover || "") ? `<img src="${esc(c.cover)}" alt="" referrerpolicy="no-referrer" loading="lazy">` : `<span>${esc((c.title || "?")[0].toUpperCase())}</span>`;

/* ================= Standards (static guide) ================= */
function mkStandardsHTML(){
  const specs = [
    ["Title","5–120 characters","Say what learners will do: \"Automate your shop's WhatsApp orders with Make\", not \"Make Masterclass\"."],
    ["Subtitle","Up to 200 characters","One line on the result."],
    ["Description",`${MK.minDesc}–10,000 characters`,"Who it's for, what they'll build, what they need before starting (tools, accounts, budget), and what's inside."],
    ["Category","One of the list below","Pick the closest one; \"Other\" only if nothing fits."],
    ["Level","Beginner, intermediate or advanced","Beginner means no prior experience with the tool."],
    ["Cover image","https link, 16:9, at least 1280 × 720 px","JPG or PNG under 1 MB. Your own artwork or licensed; readable title; no logos you don't have rights to."],
    ["Price",`${ngn(MK.minNgn)}–${ngn(MK.maxNgn)}; optional $${MK.minUsd}–$${MK.maxUsd}`,"Whole naira, steps of ₦100. The dollar price is for learners outside Nigeria."],
    ["Lessons",`At least ${MK.minLessons}; we recommend 8–40`,"Grouped into sections of 3–8 lessons."],
    ["Free previews","1–2 lessons","Your best early lessons, so people can try before they buy."],
    ["Reading lesson","50–50,000 characters","Formatted text (see below)."],
    ["Video lesson","YouTube, Vimeo or Loom link","3–15 minutes each; 20 minutes maximum recommended. Add a short written summary."],
    ["Quiz lesson","1–30 questions, 2–6 options each","One correct answer per question. Test understanding, not trick wording."],
    ["Task lesson","At least 20 characters of instructions","What to build, what \"done\" looks like, and how to check it."]
  ];
  const fmt = [["## Heading","Heading (### and #### for smaller)"],["**bold** and *italic*","Bold and italic"],["- item  or  1. item","Bulleted or numbered list"],["[text](https://link)","Link"],["`code`","Inline code"],["``` before and after","Code block"],["> text","Quote or callout"],["---","Divider"]];
  const outline = "Section 1: Start here\n  1. Welcome: what you'll build (video, free preview)\n  2. Set up your accounts and tools (reading)\n  3. Quick win in 15 minutes (video, free preview)\n  4. Check your setup (quiz)\n\nSection 2: <first core skill>\n  5. Concept, with a real example (video)\n  6. Step-by-step build (video + written steps)\n  7. Common mistakes and fixes (reading)\n  8. Build it yourself (task)\n\nSection 3, 4 ...: <same pattern>\n\nFinal section: Project\n  - Brief: build the full thing (task)\n  - Test checklist before going live (reading)\n  - What to do next (reading)";
  const lessonT = "## What you'll do\nOne or two sentences on the result.\n\n## Before you start\n- Account or tool needed\n- File or template (link)\n\n## Steps\n1. Exact names of buttons and fields\n2. Next step\n3. Test it: what you should see\n\n> Tip: one common mistake.\n\n## Check your work\n- It's done when ...";
  return `
  <div class="mk-toc panel2"><h3>On this page</h3><ol>
    <li><a href="#mks-who">Who can teach</a></li><li><a href="#mks-std">Quality standards</a></li><li><a href="#mks-spec">Course specifications</a></li><li><a href="#mks-struct">How to structure your course</a></li>
    <li><a href="#mks-fmt">Formatting lessons</a></li><li><a href="#mks-vid">Video and media</a></li><li><a href="#mks-rules">Content rules</a></li><li><a href="#mks-rev">Submission and review</a></li><li><a href="#mks-price">Pricing and earnings</a></li><li><a href="#mks-check">Checklist before you submit</a></li></ol></div>
  <h3 class="mk-h" id="mks-who">1. Who can teach</h3>
  <div class="panel2"><ul class="mk-ul">
    <li><b>An Automancy account</b> with a verified email address.</li>
    <li><b>An approved creator application:</b> who you are, what you've built that qualifies you, and what you want to teach. We approve creators by hand, usually within a week.</li>
    <li><b>Real experience:</b> you use what you teach in your own work or for clients. A portfolio, LinkedIn profile, case study or live project helps.</li>
    <li><b>A Nigerian bank account</b> in your name or your registered business's name, for payouts.</li>
    <li><b>Acceptance of the creator terms</b>, including that your course is your own work. You must be 18 or older.</li></ul></div>
  <h3 class="mk-h" id="mks-std">2. Quality standards</h3>
  <p class="note">Reviewers tick each of these before a course goes live. A course that misses one is sent back with notes.</p>
  <div class="grid2">${MK_STANDARDS.map(([t, d], i) => `<div class="tile"><h3>${i + 1}. ${esc(t)}</h3><p>${esc(d)}</p></div>`).join("")}</div>
  <h3 class="mk-h" id="mks-spec">3. Course specifications</h3>
  <p class="note">The studio checks the limits automatically and won't let you submit until they're met.</p>
  <div class="panel2 scroll"><table class="lb mk-tbl"><thead><tr><th>Item</th><th>Requirement</th><th>Guidance</th></tr></thead><tbody>${specs.map(r => `<tr><td><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join("")}</tbody></table></div>
  <p class="note">Categories: ${MK_CATS.join(", ")}.</p>
  <h3 class="mk-h" id="mks-struct">4. How to structure your course</h3>
  <div class="grid2">
    <div class="panel2"><h3>Recommended outline</h3><p class="note">Start with a quick win, one skill per section, practice at the end of every section, and a final project.</p><pre class="mk-pre">${esc(outline)}</pre><button type="button" class="cta alt sm" data-copytext="${esc(outline)}">Copy outline</button></div>
    <div class="panel2"><h3>Lesson template</h3><p class="note">Use the same shape for every reading lesson, or the text under a video.</p><pre class="mk-pre">${esc(lessonT)}</pre><button type="button" class="cta alt sm" data-copytext="${esc(lessonT)}">Copy template</button></div>
  </div>
  <div class="panel2"><ul class="mk-ul"><li><b>One idea per lesson.</b> If it needs more than 15 minutes, split it.</li><li><b>Descriptive titles:</b> "Send a WhatsApp confirmation when an order is paid" beats "Lesson 6".</li><li><b>Sample data only.</b> Never show real customers' names, numbers, emails or payment details.</li><li><b>Local context</b> where it helps: naira prices, Nigerian tools and payment providers.</li></ul></div>
  <h3 class="mk-h" id="mks-fmt">5. Formatting lessons</h3>
  <p class="note">Reading lessons, tasks and the description use simple text formatting (a safe version of Markdown). Preview as a learner to check it.</p>
  <div class="panel2 scroll"><table class="lb mk-tbl"><thead><tr><th>Type this</th><th>To get</th></tr></thead><tbody>${fmt.map(r => `<tr><td><code>${esc(r[0])}</code></td><td>${esc(r[1])}</td></tr>`).join("")}</tbody></table></div>
  <div class="panel2"><ul class="mk-ul"><li><b>Not supported:</b> HTML, scripts, embedded forms, tables and inline images (they show as plain text).</li><li><b>Tables:</b> use a list, or link to a Google Sheet.</li><li><b>Screenshots and diagrams:</b> show them in your video, or link to them.</li><li><b>Templates and downloads</b> (Make blueprints, n8n JSON, Sheets): link to a public file you own, with keys, tokens and personal data removed.</li></ul></div>
  <h3 class="mk-h" id="mks-vid">6. Video and media</h3>
  <div class="panel2"><ul class="mk-ul"><li><b>Hosting:</b> YouTube (public or unlisted), Vimeo or Loom. Private videos won't play.</li><li><b>Quality:</b> 720p minimum (1080p preferred), screen text readable on a phone, clear audio, no music over speech.</li><li><b>Length:</b> 3–15 minutes. Cut loading screens and unexplained mistakes.</li><li><b>Captions</b> strongly recommended.</li><li><b>Hide</b> passwords, API keys, OTPs, customer data and private messages before recording.</li><li><b>AI-generated</b> voices, video and images are fine if accurate; never imitate a real person without permission.</li></ul></div>
  <h3 class="mk-h" id="mks-rules">7. Content rules</h3>
  <div class="grid2"><div class="box"><h5>Every course must</h5><ul><li>Be your original work, or material you have the right to sell.</li><li>Teach something a learner can do by the end.</li><li>Follow each platform's rules and the law, including the Nigeria Data Protection Act and consent for messaging.</li><li>Keep risky actions (money, mass messages, deleting data) behind a human check and test mode.</li></ul></div>
    <div class="box"><h5>We don't accept</h5><ul><li>Copyrighted material you don't own.</li><li>Get-rich-quick claims or guaranteed income.</li><li>Spam, scraping against terms, fake engagement or ways around limits.</li><li>Asking learners for passwords, API keys, OTPs or bank details.</li><li>Links that push learners to pay you outside Automancy for the same content.</li><li>Hateful, misleading, adult or dangerous content.</li></ul></div></div>
  <h3 class="mk-h" id="mks-rev">8. Submission and review</h3>
  <div class="grid2">
    <div class="tile"><h3>1. Build</h3><p>Create the course in the studio and preview it as a learner.</p></div>
    <div class="tile"><h3>2. Submit</h3><p>When the automatic checks pass, confirm it meets these standards and submit. Editing locks while it's in review.</p></div>
    <div class="tile"><h3>3. Review</h3><p>A person reads every lesson and watches the videos against the standards, in about ${MK.reviewDays} working days.</p></div>
    <div class="tile"><h3>4. Decision</h3><p><b>Approved:</b> it goes live. <b>Changes requested:</b> fix and resubmit. <b>Rejected:</b> it breaks the content rules; you get the reason.</p></div>
  </div>
  <p class="note">Edits to a live course go back into review. Most common reasons we send courses back: the description promises more than the lessons deliver, unreadable screens or poor audio, lessons that are only a link, outdated steps, keys or customer data visible on screen.</p>
  <h3 class="mk-h" id="mks-price">9. Pricing and earnings</h3>
  <div class="panel2"><p>You choose the price between ${ngn(MK.minNgn)} and ${ngn(MK.maxNgn)}. As a guide: short single-skill courses (1–2 hours) ₦5,000–₦15,000; complete project courses (3–8 hours) ₦15,000–₦50,000; advanced or professional courses higher.</p>
    <p>You receive <b>${Math.round(MK.revenueShare * 100)}%</b> of each sale after the payment processor's fee. Earnings become available after the ${MK.refundDays}-day refund window and are paid to your bank account.</p></div>
  <h3 class="mk-h" id="mks-check">10. Checklist before you submit</h3>
  <div class="panel2"><ul class="mk-ul mk-checks"><li>Title, subtitle and description say who it's for and what they'll be able to do.</li><li>Cover image is 16:9, sharp and yours.</li><li>Price set; one or two free preview lessons.</li><li>At least ${MK.minLessons} complete lessons in sections, with clear titles.</li><li>Every section ends with a quiz or task; there's a final project.</li><li>Every video plays, is readable on a phone and has clear sound.</li><li>No keys, passwords, OTPs or real customer data anywhere.</li><li>Every link and download works and is yours to share.</li><li>You've previewed the whole course as a learner.</li></ul></div>`;
}

/* ================= Teach view: apply, studio, admin review ================= */
function renderTeach(){
  const st = $("#mkStandards"); if(st && !st.dataset.done){ st.innerHTML = mkStandardsHTML(); st.dataset.done = "1"; }
  renderStudio(); renderAdminQueue();
}
function renderStudio(){
  const box = $("#mkStudio"); if(!box) return;
  const cr = mk.creator;
  if(!cr){
    box.innerHTML = `<div class="panel2"><h3>Apply to teach</h3><p class="note">Read the <a href="#teach-standards">standards and course specifications</a> first. Applying takes five minutes.</p>
      <form id="mkApply" class="mk-form">
        <label class="fld">Name learners will see<input name="name" required minlength="2" maxlength="80" value="${esc(S.profile.name || "")}"></label>
        <label class="fld">Short bio<textarea name="bio" required minlength="50" maxlength="2000" placeholder="What do you do, and what have you built or achieved that qualifies you to teach?"></textarea></label>
        <label class="fld">What do you want to teach?<textarea name="idea" required minlength="50" maxlength="3000" placeholder="Course idea(s), who it's for, and what learners will be able to do at the end."></textarea></label>
        <label class="fld">Website or LinkedIn (optional)<input name="site" type="url" maxlength="300" placeholder="https://"></label>
        <label class="mk-check"><input type="checkbox" required> <span>I accept the creator terms and the course standards, and my courses will be my own original work.</span></label>
        <button class="cta" type="submit">Send application</button></form></div>`;
    return;
  }
  if(cr.status === "applied"){
    box.innerHTML = `<div class="panel2"><h3>Application received ${mkPill("submitted")}</h3><p>Thanks, ${esc(cr.name)}. We review creator applications by hand, usually within a week, and email you.</p><p class="note">In this preview you can play the admin: approve yourself under <a href="#teach-admin">Admin review</a> below.</p></div>`;
    return;
  }
  const c = mkEdit && mk.courses.find(x => x.id === mkEdit);
  if(c) return renderEditor(box, c);
  const rows = mk.courses.map(c => `<tr><td><b>${esc(c.title)}</b></td><td>${mkPill(c.status)}</td><td class="n">${ngn(c.priceNgn || 0)}</td><td class="n">${mkLessons(c).length}</td><td><button type="button" class="cta alt sm" data-mk="edit" data-id="${c.id}">Open</button></td></tr>`).join("");
  box.innerHTML = `<div class="panel2"><h3>Creator studio <span class="note">Hi ${esc(cr.name.split(" ")[0])}</span></h3>
    <form id="mkNew" class="mk-row"><label class="fld" style="flex:1 1 260px">New course title<input name="title" required minlength="3" maxlength="120" placeholder="e.g. WhatsApp order bots for small shops"></label><button class="cta" type="submit">Create course</button></form>
    ${mk.courses.length ? `<div class="scroll"><table class="lb"><thead><tr><th>Course</th><th>Status</th><th class="n">Price</th><th class="n">Lessons</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : `<p class="note">No courses yet. Create your first one above, then build it to the <a href="#teach-standards">standards</a>.</p>`}</div>`;
}
function renderEditor(box, c){
  const editable = c.status !== "submitted", probs = mkProblems(c), dis = editable ? "" : " disabled";
  const lessonEd = l => {
    if(mkLesson !== l.id) return "";
    let body = "";
    if(l.kind === "text") body = `<label class="fld">Lesson text (formatting: ## heading, **bold**, - list, [link](https://…))<textarea data-lf="body" rows="10" maxlength="50000"${dis}>${esc(l.body || "")}</textarea></label>`;
    if(l.kind === "video") body = `<label class="fld">YouTube, Vimeo or Loom link<input data-lf="video" type="url" value="${esc(l.video || "")}" placeholder="https://www.youtube.com/watch?v=…"${dis}></label><label class="fld">Summary or steps under the video (optional)<textarea data-lf="body" rows="5"${dis}>${esc(l.body || "")}</textarea></label>`;
    if(l.kind === "task") body = `<label class="fld">Task instructions: what to build, what "done" looks like, how to check it<textarea data-lf="task" rows="7"${dis}>${esc(l.task || "")}</textarea></label>`;
    if(l.kind === "quiz") body = `<div class="mk-quiz">${(l.quiz || []).map((q, qi) => `<fieldset class="mk-q"><legend>Question ${qi + 1}</legend><label class="fld">Question<input data-qq="${qi}" value="${esc(q.q)}"${dis}></label>${q.options.map((o, oi) => `<div class="mk-opt"><input type="radio" name="ans-${l.id}-${qi}" data-qa="${qi}" value="${oi}" ${q.answer === oi ? "checked" : ""} aria-label="Correct answer"${dis}><input data-qo="${qi}:${oi}" value="${esc(o)}" placeholder="Option ${oi + 1}"${dis}></div>`).join("")}<p class="note">Tick the correct option.</p></fieldset>`).join("")}${editable ? `<button type="button" class="cta alt sm" data-mk="addq">Add question</button>` : ""}</div>`;
    return `<div class="mk-led" data-lesson="${l.id}">${body}<label class="mk-check"><input type="checkbox" data-lf="preview" ${l.preview ? "checked" : ""}${dis}> <span>Free preview (anyone can watch or read it)</span></label>${editable ? `<div class="mk-row"><button type="button" class="cta sm" data-mk="savel">Save lesson</button><button type="button" class="cta alt sm" data-mk="closel">Close</button></div>` : ""}</div>`;
  };
  box.innerHTML = `<div class="panel2 mk-editor">
    <div class="mk-row" style="justify-content:space-between"><button type="button" class="cta alt sm" data-mk="back">← All courses</button><span>${mkPill(c.status)}</span></div>
    <h3 style="font-size:1.5rem">${esc(c.title)}</h3>
    ${c.note ? `<p class="mk-alert ${c.status === "rejected" ? "bad" : "warn"}"><b>Reviewer's note:</b> ${esc(c.note)}</p>` : ""}
    ${c.status === "submitted" ? `<p class="mk-alert warn">In review. Editing is locked while we review. <button type="button" class="cta alt sm" data-mk="withdraw">Withdraw to edit</button></p>` : ""}
    ${c.status === "live" ? `<p class="note">This course is live. Saved changes go back into review.</p>` : ""}
    <div class="panel2 mk-submit"><h3>${c.status === "live" ? "Send changes for review" : "Submit for review"}</h3>
      ${probs.length ? `<p>Before you can submit:</p><ul class="mk-ul mk-probs">${probs.map(p => `<li>${esc(p)}</li>`).join("")}</ul>` : `<p class="note">Everything we check automatically looks good.</p>`}
      ${editable ? `<label class="mk-check"><input type="checkbox" id="mkAgree"> <span>I've previewed the whole course and it meets the <a href="#teach-standards">standards and specifications</a>, and it's my own original work.</span></label>
      <div class="mk-row"><button type="button" class="cta" data-mk="submit" ${probs.length ? "disabled" : ""}>Submit for review</button><button type="button" class="cta alt" data-mk="preview">Preview as learner</button></div>` : ""}
    </div>
    <form id="mkDetails" class="mk-form"><h3>Details</h3><fieldset${dis} class="mk-fs">
      <label class="fld">Title<input name="title" required minlength="3" maxlength="120" value="${esc(c.title)}"></label>
      <label class="fld">Subtitle<input name="subtitle" maxlength="200" value="${esc(c.subtitle || "")}" placeholder="One line: what learners will be able to do"></label>
      <label class="fld">Description (formatting allowed; at least ${MK.minDesc} characters: who it's for, what they'll build, what they need)<textarea name="description" rows="8" maxlength="10000">${esc(c.description || "")}</textarea></label>
      <div class="formgrid"><label class="fld">Category<select name="category"><option value="">Choose…</option>${MK_CATS.map(x => `<option ${c.category === x ? "selected" : ""}>${esc(x)}</option>`).join("")}</select></label>
      <label class="fld">Level<select name="level">${["beginner","intermediate","advanced"].map(x => `<option value="${x}" ${c.level === x ? "selected" : ""}>${x[0].toUpperCase() + x.slice(1)}</option>`).join("")}</select></label></div>
      <label class="fld">Cover image URL (https, 16:9, at least 1280 × 720 px, under 1 MB)<input name="cover" type="url" maxlength="500" value="${esc(c.cover || "")}" placeholder="https://"></label>
      <div class="formgrid"><label class="fld">Price in naira (${ngn(MK.minNgn)}–${ngn(MK.maxNgn)})<input name="priceNgn" type="number" min="0" max="${MK.maxNgn}" step="100" value="${c.priceNgn || ""}"></label>
      <label class="fld">Price in US dollars (optional, $${MK.minUsd}–$${MK.maxUsd})<input name="priceUsd" type="number" min="0" max="${MK.maxUsd}" step="0.5" value="${c.priceUsd || ""}"></label></div>
      <p class="note">You earn ${Math.round(MK.revenueShare * 100)}% of each sale after the payment fee: about ${ngn(Math.floor(((c.priceNgn || 0) * 0.985) * MK.revenueShare))} per sale at this price.</p>
      <button class="cta" type="submit">Save details</button></fieldset></form>
    <div class="mk-form"><h3>Curriculum <span class="note">${mkLessons(c).length} lessons in ${c.sections.length} sections</span></h3>
      ${c.sections.map((s, si) => `<div class="mk-sec" data-sec="${s.id}"><div class="mk-row"><b style="flex:1">${si + 1}. ${esc(s.title)}</b>${editable ? `<button type="button" class="cta alt sm" data-mk="secup" ${si ? "" : "disabled"} aria-label="Move section up">↑</button><button type="button" class="cta alt sm" data-mk="secdel">Delete</button>` : ""}</div>
        ${s.lessons.map((l, li) => { const p = mkLessonProblem(l); return `<div class="mk-lrow" data-lid="${l.id}"><span class="pill2 info">${MK_KIND[l.kind]}</span><button type="button" class="mk-lt" data-mk="openl">${esc(l.title)}</button>${l.preview ? `<span class="pill2 ok">Preview</span>` : ""}${p ? `<span class="pill2 bad" title="${esc(p)}">Incomplete</span>` : ""}${editable ? `<button type="button" class="cta alt sm" data-mk="lup" ${li ? "" : "disabled"} aria-label="Move lesson up">↑</button><button type="button" class="cta alt sm" data-mk="ldel">Delete</button>` : ""}</div>${lessonEd(l)}`; }).join("")}
        ${editable ? `<form class="mk-row mk-addl"><input name="title" required maxlength="160" placeholder="New lesson title" aria-label="New lesson title"><select name="kind" aria-label="Lesson type">${Object.entries(MK_KIND).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select><button class="cta alt sm" type="submit">Add lesson</button></form>` : ""}</div>`).join("")}
      ${editable ? `<form id="mkAddSec" class="mk-row"><input name="title" required maxlength="120" placeholder="New section title, e.g. Section 1: Start here" aria-label="New section title" style="flex:1 1 240px"><button class="cta alt" type="submit">Add section</button></form>` : ""}
    </div>
    ${c.status === "draft" ? `<details><summary class="note" style="cursor:pointer">Delete this draft</summary><button type="button" class="cta alt sm" data-mk="delc" style="margin-top:8px">Delete "${esc(c.title)}" permanently</button></details>` : ""}
  </div>`;
}
function mkTouchLive(c){ if(c.status === "live"){ c.pending = true; } }
function mkSaveLesson(c, l, ed){
  $$("[data-lf]", ed).forEach(i => { const k = i.dataset.lf; l[k] = i.type === "checkbox" ? i.checked : i.value; });
  if(l.kind === "quiz"){
    $$("[data-qq]", ed).forEach(i => { l.quiz[+i.dataset.qq].q = i.value; });
    $$("[data-qo]", ed).forEach(i => { const [q, o] = i.dataset.qo.split(":").map(Number); l.quiz[q].options[o] = i.value; });
    $$("[data-qa]", ed).forEach(i => { if(i.checked) l.quiz[+i.dataset.qa].answer = +i.value; });
  }
  mkTouchLive(c);
}
function mkOnStudio(e){
  const b = e.target.closest("[data-mk]"); if(!b) return;
  const act = b.dataset.mk, c = mk.courses.find(x => x.id === (b.dataset.id || mkEdit));
  const sec = c && b.closest("[data-sec]") && c.sections.find(s => s.id === b.closest("[data-sec]").dataset.sec);
  const lid = b.closest("[data-lid]") ? b.closest("[data-lid]").dataset.lid : b.closest("[data-lesson]") ? b.closest("[data-lesson]").dataset.lesson : null;
  const l = c && lid && mkLessons(c).find(x => x.id === lid);
  if(act === "edit"){ mkEdit = c.id; mkLesson = null; }
  else if(act === "back"){ mkEdit = null; mkLesson = null; }
  else if(act === "openl"){ mkLesson = mkLesson === lid ? null : lid; }
  else if(act === "closel"){ mkLesson = null; }
  else if(act === "savel"){ mkSaveLesson(c, l, b.closest("[data-lesson]")); toast("Lesson saved."); }
  else if(act === "addq"){ mkSaveLesson(c, l, b.closest("[data-lesson]")); l.quiz.push({q:"", options:["","","",""], answer:0}); }
  else if(act === "lup"){ const i = sec.lessons.indexOf(l); if(i > 0){ sec.lessons.splice(i, 1); sec.lessons.splice(i - 1, 0, l); mkTouchLive(c); } }
  else if(act === "ldel"){ sec.lessons = sec.lessons.filter(x => x !== l); mkTouchLive(c); }
  else if(act === "secup"){ const i = c.sections.indexOf(sec); if(i > 0){ c.sections.splice(i, 1); c.sections.splice(i - 1, 0, sec); mkTouchLive(c); } }
  else if(act === "secdel"){ if(sec.lessons.length && !confirmDel(sec)) return; c.sections = c.sections.filter(x => x !== sec); mkTouchLive(c); }
  else if(act === "withdraw"){ c.status = "draft"; toast("Withdrawn from review. You can edit again."); }
  else if(act === "delc"){ mk.courses = mk.courses.filter(x => x !== c); mkEdit = null; toast("Draft deleted."); }
  else if(act === "preview"){ mkOpen = c.id; mkLesson = null; mkSave(); location.hash = "#courses"; return; }
  else if(act === "submit"){
    if(!$("#mkAgree").checked){ toast("Tick the box to confirm the course meets the standards."); return; }
    if(mkProblems(c).length) return;
    if(c.status === "live") c.pending = true; else c.status = "submitted";
    c.submittedAt = new Date().toISOString(); c.note = "";
    toast(`Submitted. We review courses in about ${MK.reviewDays} working days.`);
  } else return;
  mkSave(); renderTeach();
}
function confirmDel(sec){ return sec.lessons.length < 1 || window.__mkDelOk === sec.id || (window.__mkDelOk = sec.id, toast(`Tap Delete again to remove the section and its ${sec.lessons.length} lessons.`), false); }
function mkOnSubmit(e){
  const f = e.target; if(!f.closest("#mkStudio")) return;
  e.preventDefault();
  const d = Object.fromEntries(new FormData(f).entries());
  const c = mk.courses.find(x => x.id === mkEdit);
  if(f.id === "mkApply"){ mk.creator = {name:d.name.trim(), bio:d.bio.trim(), idea:d.idea.trim(), site:d.site || "", status:"applied", at:new Date().toISOString()}; toast("Application sent."); }
  else if(f.id === "mkNew"){ const nc = {id:mkId(), title:d.title.trim(), subtitle:"", description:"", category:"", level:"beginner", cover:"", priceNgn:0, priceUsd:0, status:"draft", note:"", sections:[{id:mkId(), title:"Section 1: Start here", lessons:[]}]}; mk.courses.unshift(nc); mkEdit = nc.id; }
  else if(f.id === "mkDetails"){ Object.assign(c, {title:d.title.trim(), subtitle:d.subtitle.trim(), description:d.description, category:d.category, level:d.level, cover:d.cover.trim(), priceNgn:Math.round(+d.priceNgn || 0), priceUsd:+d.priceUsd || 0}); mkTouchLive(c); toast("Details saved."); }
  else if(f.id === "mkAddSec"){ c.sections.push({id:mkId(), title:d.title.trim(), lessons:[]}); mkTouchLive(c); }
  else if(f.classList.contains("mk-addl")){ const s = c.sections.find(x => x.id === f.closest("[data-sec]").dataset.sec); const l = {id:mkId(), title:d.title.trim(), kind:d.kind, body:"", video:"", task:"", quiz:d.kind === "quiz" ? [{q:"", options:["","","",""], answer:0}] : [], preview:false}; s.lessons.push(l); mkLesson = l.id; mkTouchLive(c); }
  mkSave(); renderTeach();
}

/* Admin review (in the app: /admin/courses, admins only) */
function renderAdminQueue(){
  const box = $("#mkAdmin"); if(!box) return;
  const apps = mk.creator && mk.creator.status === "applied" ? [mk.creator] : [];
  const queue = mk.courses.filter(c => c.status === "submitted" || (c.status === "live" && c.pending));
  const r = mkReview && queue.find(c => c.id === mkReview);
  if(r){
    box.innerHTML = `<div class="panel2"><div class="mk-row" style="justify-content:space-between"><button type="button" class="cta alt sm" data-ad="back">← Review queue</button>${mkPill(r.status)}</div>
      <h3 style="font-size:1.4rem">${esc(r.title)}</h3><p class="note">By ${esc(mk.creator ? mk.creator.name : "")} · ${esc(r.category)} · ${esc(r.level)} · ${ngn(r.priceNgn)}${r.priceUsd ? " / $" + r.priceUsd : ""}</p>
      ${mkProblems(r).length ? `<p class="mk-alert warn">Automatic checks: ${esc(mkProblems(r).join(" "))}</p>` : ""}
      <details><summary class="cta alt sm">Read the course (${mkLessons(r).length} lessons)</summary><div class="mk-read">${mkMd(r.description)}${r.sections.map(s => `<h4>${esc(s.title)}</h4>${s.lessons.map(l => `<div class="mk-rl"><b>${MK_KIND[l.kind]}: ${esc(l.title)}</b>${mkLessonBody(l, true)}</div>`).join("")}`).join("")}</div></details>
      <fieldset class="mk-fs mk-std"><legend class="note">Reviewer checklist: tick every standard to approve</legend>${MK_STANDARDS.map(([t, d], i) => `<label class="mk-check"><input type="checkbox" data-std="${i}"> <span><b>${esc(t)}.</b> ${esc(d)}</span></label>`).join("")}</fieldset>
      <label class="fld">Note to the creator (required to request changes or reject)<textarea id="mkNote" rows="3" maxlength="4000"></textarea></label>
      <div class="mk-row"><button type="button" class="cta" data-ad="approve">${r.status === "live" ? "Approve changes" : "Approve and publish"}</button><button type="button" class="cta alt" data-ad="changes">Request changes</button><button type="button" class="cta alt" data-ad="reject">Reject</button></div></div>`;
    return;
  }
  box.innerHTML = `<div class="panel2"><h3>Admin review <span class="note">admins only in the app</span></h3>
    ${apps.length ? `<h4>Creator applications</h4>${apps.map(a => `<div class="mk-lrow"><b style="flex:1">${esc(a.name)}</b><span class="note">${esc(a.idea.slice(0, 90))}…</span><button type="button" class="cta sm" data-ad="appr-creator">Approve creator</button></div>`).join("")}` : ""}
    <h4>Courses waiting for review</h4>
    ${queue.length ? queue.map(c => `<div class="mk-lrow"><b style="flex:1">${esc(c.title)}</b>${c.pending ? `<span class="pill2 warn">Changes to a live course</span>` : mkPill(c.status)}<button type="button" class="cta alt sm" data-ad="open" data-id="${c.id}">Review</button></div>`).join("") : `<p class="note">Nothing waiting. Submitted courses appear here.</p>`}</div>`;
}
function mkOnAdmin(e){
  const b = e.target.closest("[data-ad]"); if(!b) return;
  const act = b.dataset.ad, r = mk.courses.find(x => x.id === mkReview);
  if(act === "appr-creator"){ mk.creator.status = "approved"; toast("Creator approved. The studio is open."); }
  else if(act === "open"){ mkReview = b.dataset.id; }
  else if(act === "back"){ mkReview = null; }
  else if(act === "approve"){
    const miss = $$("[data-std]").filter(i => !i.checked).map(i => MK_STANDARDS[+i.dataset.std][0]);
    if(miss.length){ toast("Tick every standard to approve. Not ticked: " + miss.join(", ") + "."); return; }
    r.status = "live"; r.pending = false; r.note = $("#mkNote").value.trim(); r.liveAt = r.liveAt || new Date().toISOString(); mkReview = null; toast("Approved. The course is live in the catalogue.");
  } else if(act === "changes" || act === "reject"){
    const note = $("#mkNote").value.trim(); if(note.length < 10){ toast("Write a note (at least 10 characters) so the creator knows what to fix."); return; }
    r.note = note; r.pending = false; r.status = act === "reject" ? "rejected" : "changes_requested"; mkReview = null;
    toast(act === "reject" ? "Rejected. The creator has your reason." : "Changes requested. The creator has your notes.");
  } else return;
  mkSave(); renderTeach();
}

/* ================= Courses view: catalogue, course page, lessons ================= */
function mkLessonBody(l, admin){
  if(l.kind === "video"){ const v = mkVideo(l.video); return (v ? `<div class="mk-vid"><iframe src="${esc(v)}" title="${esc(l.title)}" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>` : `<p class="note">No video link yet.</p>`) + (l.body ? mkMd(l.body) : ""); }
  if(l.kind === "task") return `<div class="box"><h5>Your task</h5>${mkMd(l.task)}</div>`;
  if(l.kind === "quiz") return `<ol class="mk-ul">${(l.quiz || []).map(q => `<li><b>${esc(q.q)}</b><ul>${q.options.filter(o => o.trim()).map((o, i) => `<li>${esc(o)}${admin && i === q.answer ? " ✓" : ""}</li>`).join("")}</ul></li>`).join("")}</ol>`;
  return mkMd(l.body);
}
function renderCourses(){
  const box = $("#mkCatalogue"); if(!box) return;
  const live = mk.courses.filter(c => c.status === "live");
  const c = mkOpen && mk.courses.find(x => x.id === mkOpen);
  if(c){
    const owner = !!mk.creator && c.status !== "live", has = !!mk.enrolled[c.id] || owner;
    const l = mkLesson && mkLessons(c).find(x => x.id === mkLesson);
    if(l && (has || l.preview)){
      box.innerHTML = `<div class="panel2"><button type="button" class="cta alt sm" data-cv="course">← ${esc(c.title)}</button><span class="kicker2">${MK_KIND[l.kind]}${l.preview ? " · free preview" : ""}</span><h2 style="font-size:1.6rem">${esc(l.title)}</h2>${mkLessonBody(l, false)}</div>`;
      return;
    }
    box.innerHTML = `<div class="mk-sales">
      <div class="panel2"><button type="button" class="cta alt sm" data-cv="all">← All courses</button>${c.status !== "live" ? `<p class="mk-alert warn">Preview: this is how learners will see your course once it's approved.</p>` : ""}
        <span class="kicker2">${esc(c.category || "Course")} · ${esc(c.level)}</span><h2 style="font-size:clamp(1.6rem,4vw,2.2rem)">${esc(c.title)}</h2>${c.subtitle ? `<p class="lede">${esc(c.subtitle)}</p>` : ""}
        <p class="note">By ${esc(mk.creator ? mk.creator.name : "an Automancy creator")} · ${mkLessons(c).length} lessons</p>
        ${mkMd(c.description)}
        <h3>What's inside</h3>${c.sections.map(s => `<details class="mk-out" open><summary>${esc(s.title)} <span class="note">${s.lessons.length} lessons</span></summary><ol>${s.lessons.map(l => `<li><span class="pill2 info">${MK_KIND[l.kind]}</span> ${has || l.preview ? `<button type="button" class="mk-lt" data-cv="lesson" data-lid="${l.id}">${esc(l.title)}</button>` : esc(l.title)}${l.preview && !has ? ` <span class="pill2 ok">Free preview</span>` : ""}</li>`).join("")}</ol></details>`).join("")}
      </div>
      <aside class="panel2 mk-buy"><div class="mk-cover">${mkCover(c)}</div><b class="mk-price">${ngn(c.priceNgn)}</b>${c.priceUsd ? `<span class="note">or $${c.priceUsd}</span>` : ""}
        ${has ? `<p class="pill2 ok">${owner ? "Your course" : "You're enrolled"}</p>` : `<button type="button" class="cta" data-cv="buy">Buy course</button><p class="note">Pay by card, bank transfer or USSD through Paystack. ${MK.refundDays}-day refund if it isn't for you.</p>`}
        <p class="note">Courses are created by independent creators and reviewed by Automancy against our <a href="#teach-standards">standards</a> before they go live.</p></aside></div>`;
    return;
  }
  const q = ($("#mkSearch") && $("#mkSearch").value || "").toLowerCase(), cat = $("#mkCat") ? $("#mkCat").value : "";
  const list = live.filter(c => (!cat || c.category === cat) && (!q || (c.title + " " + c.subtitle + " " + c.description).toLowerCase().includes(q)));
  box.innerHTML = list.length ? `<div class="mk-grid">${list.map(c => `<button type="button" class="mk-card panel2" data-cv="open" data-id="${c.id}"><div class="mk-cover">${mkCover(c)}</div><span class="kicker2">${esc(c.category)}</span><h3>${esc(c.title)}</h3><p class="note">${esc(c.subtitle || "")}</p><div class="mk-row" style="justify-content:space-between"><b>${ngn(c.priceNgn)}</b><span class="note">${mkLessons(c).length} lessons · ${esc(c.level)}</span></div></button>`).join("")}</div>`
    : `<div class="panel2"><h3>${live.length ? "No courses match that search." : "Creator courses appear here once they're approved."}</h3><p>Know a practical skill people pay for? <a href="#teach">Teach on Automancy</a>: build your course, set your price, and we review it before it goes live.</p></div>`;
}
function mkOnCourses(e){
  const b = e.target.closest("[data-cv]"); if(!b) return;
  const act = b.dataset.cv;
  if(act === "open"){ mkOpen = b.dataset.id; mkLesson = null; }
  else if(act === "all"){ mkOpen = null; mkLesson = null; }
  else if(act === "course"){ mkLesson = null; }
  else if(act === "lesson"){ mkLesson = b.dataset.lid; }
  else if(act === "buy"){ mk.enrolled[mkOpen] = new Date().toISOString(); mkSave(); toast("Enrolled. (In this preview no payment is taken; the live site opens Paystack checkout.)"); }
  else return;
  renderCourses(); window.scrollTo(0, ($("#mkCatalogue").getBoundingClientRect().top + window.scrollY) - 80);
}
(function mkWire(){
  const st = $("#mkStudio"), ad = $("#mkAdmin"), cv = $("#mkCatalogue");
  if(st){ st.addEventListener("click", mkOnStudio); st.addEventListener("submit", mkOnSubmit); }
  if(ad) ad.addEventListener("click", mkOnAdmin);
  if(cv) cv.addEventListener("click", mkOnCourses);
  on("#mkSearch", "input", renderCourses); on("#mkCat", "change", renderCourses);
  const std = $("#mkStandards"); if(std){ std.innerHTML = mkStandardsHTML(); std.dataset.done = "1"; }
  const sel = $("#mkCat"); if(sel) sel.innerHTML = `<option value="">All categories</option>` + MK_CATS.map(x => `<option>${esc(x)}</option>`).join("");
})();
