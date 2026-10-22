// WhatsApp bot pure logic. Run: tsx --test tests/whatsapp.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import * as ns from "../lib/whatsapp/core.ts";
const W = ns.default ?? ns; // tsx loads .ts as CommonJS here: exports land on .default
const {
  verifySignature, signBody, normalisePhone, waIdOf, maskPhone, splitText, toWhatsAppText, parseCommand, parseQuizAnswer,
  parseItemId, formatQuiz, renderCard, cleanScript, cleanCard, awaitingFor, quizFeedback, withButtons, itemXp,
  courseAccessFrom, reminderDue, within24h, codeFromInt, isLinkCode, waMeLink, appAnchor, decodeEntities, WA, DAY
} = W;

test("signature: valid, tampered, wrong secret, malformed", () => {
  const body = JSON.stringify({ entry: [{ id: "1" }] });
  const sig = "sha256=" + createHmac("sha256", "s3cret").update(body).digest("hex");
  assert.equal(verifySignature(body, sig, "s3cret"), true);
  assert.equal(verifySignature(Buffer.from(body), sig.toUpperCase().replace("SHA256=", "sha256="), "s3cret"), true);
  assert.equal(verifySignature(body + " ", sig, "s3cret"), false);
  assert.equal(verifySignature(body, sig, "other"), false);
  assert.equal(verifySignature(body, "sha256=abc", "s3cret"), false);
  assert.equal(verifySignature(body, null, "s3cret"), false);
  assert.equal(verifySignature(body, sig, undefined), false);
  assert.equal(signBody(body, "s3cret"), sig);
});

test("phone: Nigerian formats to E.164", () => {
  for (const s of ["08031234567", "0803 123 4567", "8031234567", "2348031234567", "+234 803 123 4567", "+234 (0) 803-123-4567", "002348031234567", "+2340803 123 4567"]) {
    assert.equal(normalisePhone(s), "+2348031234567", s);
  }
  assert.equal(normalisePhone("09012345678"), "+2349012345678");
  assert.equal(normalisePhone("07012345678"), "+2347012345678");
  assert.equal(normalisePhone("+447700900123"), "+447700900123");
  assert.equal(normalisePhone("447700900123"), "+447700900123");
  assert.equal(normalisePhone("0803123456"), null);    // too short
  assert.equal(normalisePhone("+23412345678"), null);   // landline-ish, not a valid NG mobile
  assert.equal(normalisePhone("hello"), null);
  assert.equal(normalisePhone(""), null);
  assert.equal(waIdOf("+2348031234567"), "2348031234567");
  assert.equal(maskPhone("+2348031234567"), "+234 803 *** 4567");
});

test("splitText keeps chunks under the limit and prefers paragraph breaks", () => {
  const para = "word ".repeat(150).trim();
  const text = [para, para, para].join("\n\n");
  const parts = splitText(text, 1000);
  assert.ok(parts.length >= 3);
  assert.ok(parts.every(p => p.length <= 1000));
  assert.equal(parts.join(" ").replace(/\s+/g, " "), text.replace(/\s+/g, " "));
  assert.deepEqual(splitText("short"), ["short"]);
  assert.ok(splitText("x".repeat(5000), 4096).every(p => p.length <= 4096));
});

test("toWhatsAppText converts Markdown", () => {
  assert.equal(toWhatsAppText("## Step one\n**Bold** and [docs](https://n8n.io)\n* item"), "*Step one*\n*Bold* and docs (https://n8n.io)\n- item");
});

test("parseCommand: words, buttons, arguments, case", () => {
  assert.deepEqual(parseCommand("link 123456"), { cmd: "link", code: "123456" });
  assert.deepEqual(parseCommand("LINK: 123456"), { cmd: "link", code: "123456" });
  assert.equal(parseCommand("LINK 12345"), null);
  assert.deepEqual(parseCommand("hi"), { cmd: "start" });
  assert.deepEqual(parseCommand("Next!"), { cmd: "next" });
  assert.deepEqual(parseCommand("  menu "), { cmd: "menu" });
  assert.deepEqual(parseCommand("lesson 3.4"), { cmd: "lesson", id: "3.4" });
  assert.deepEqual(parseCommand("LESSON 3-4"), { cmd: "lesson", id: "3.4" });
  assert.deepEqual(parseCommand("lesson b3"), { cmd: "lesson", id: "B3" });
  assert.deepEqual(parseCommand("boss 2"), { cmd: "lesson", id: "B2" });
  assert.deepEqual(parseCommand("LESSONS 4"), { cmd: "lessons", track: 4 });
  assert.deepEqual(parseCommand("help"), { cmd: "help", question: "" });
  assert.deepEqual(parseCommand("Help: why does my webhook 401?"), { cmd: "help", question: "why does my webhook 401?" });
  assert.deepEqual(parseCommand("reminders off"), { cmd: "reminders", on: false });
  assert.deepEqual(parseCommand("Stop reminders"), { cmd: "reminders", on: false });
  assert.deepEqual(parseCommand("STOP"), { cmd: "stop" });
  assert.deepEqual(parseCommand("unsubscribe"), { cmd: "stop" });
  assert.deepEqual(parseCommand("ANS 4 2"), { cmd: "answer", card: 4, option: 2 });
  assert.deepEqual(parseCommand("Continue"), { cmd: "continue" });
  assert.equal(parseCommand("I built a Zap that sends leads to Sheets"), null);
  // strict (task waiting): long text is the learner's work, not a command
  assert.equal(parseCommand("lesson 3.4 " + "x".repeat(60), { strict: true }), null);
  assert.deepEqual(parseCommand("skip", { strict: true }), { cmd: "skip" });
});

test("parseItemId and appAnchor", () => {
  assert.equal(parseItemId("0.1"), "0.1");
  assert.equal(parseItemId("4 09"), "4.9");
  assert.equal(parseItemId("B 5"), "B5");
  assert.equal(parseItemId("nonsense"), null);
  assert.equal(appAnchor("3.4"), "#m-3-4");
  assert.equal(appAnchor("B3"), "#boss-3");
});

test("parseQuizAnswer", () => {
  assert.equal(parseQuizAnswer("a", 4), 0);
  assert.equal(parseQuizAnswer("C)", 4), 2);
  assert.equal(parseQuizAnswer("option b", 3), 1);
  assert.equal(parseQuizAnswer("2", 4), 1);
  assert.equal(parseQuizAnswer("e", 4), null);
  assert.equal(parseQuizAnswer("because", 4), null);
});

test("formatQuiz: buttons, list rows, lettered list", () => {
  const b = formatQuiz("Which tool?", ["Zapier", "Make", "n8n"], 3);
  assert.equal(b.type, "buttons");
  assert.deepEqual(b.buttons.map(x => x.id), ["ANS 3 0", "ANS 3 1", "ANS 3 2"]);
  const l = formatQuiz("Which?", ["One", "Two", "Three", "Four"], 5);
  assert.equal(l.type, "list");
  assert.equal(l.rows.length, 4);
  assert.equal(l.rows[3].title, "Four");
  const long = ["A webhook that pushes data instantly", "Polling every fifteen minutes", "Manual export", "Email parsing"];
  const z = formatQuiz("How does the trigger work?", long, 7);
  assert.equal(z.type, "list");
  assert.deepEqual(z.rows.map(r => r.title), ["A", "B", "C", "D"]);
  assert.match(z.body, /A\) A webhook that pushes data instantly/);
  assert.ok(z.body.length <= WA.interactiveBody);
  assert.ok(z.rows.every(r => (r.description || "").length <= WA.rowDescription));
});

const media = { "walk:0.1": { url: "https://cdn.example.com/walk-0-1.mp4", bytes: 1000, seconds: 30 } };
const ctx = (index = 1) => ({ itemId: "0.1", title: "Think Like an Automator", index, total: 6, media, appUrl: "https://automancy.cc/learn#m-0-1" });

test("renderCard: one card per message, Next + Menu, ≤ 2 messages", () => {
  const t = renderCard({ t: "text", body: "Hello" }, ctx(0));
  assert.equal(t.length, 1);
  assert.equal(t[0].type, "buttons");
  assert.match(t[0].body, /^\*Lesson 0\.1 · Think Like an Automator\*/);
  assert.deepEqual(t[0].buttons.map(b => b.id), ["NEXT", "MENU"]);
  assert.equal(t[0].footer, "Lesson 0.1 · 1/6");

  const v = renderCard({ t: "video", caption: "Watch", media: "walk:0.1", youtube: null, app: null }, ctx());
  assert.equal(v.length, 2);
  assert.equal(v[0].type, "video");
  assert.equal(v[0].link, media["walk:0.1"].url);
  assert.equal(v[1].type, "buttons");

  const vf = renderCard({ t: "video", caption: "Watch", media: "walk:9.9", youtube: "https://youtu.be/x", app: "https://automancy.cc/learn#m-0-1" }, ctx());
  assert.equal(vf.length, 1);
  assert.match(vf[0].body, /youtu\.be\/x/);
  assert.match(vf[0].body, /Or open it in the app/);

  const q = renderCard({ t: "quiz", q: "Pick", options: ["Yes", "No"], answer: 0, why: "Because" }, ctx(2));
  assert.equal(q[0].type, "buttons");
  assert.equal(q[0].buttons[0].id, "ANS 2 0");

  const r = renderCard({ t: "reveal", prompt: "Spot the bug", answer: "It's the date" }, ctx());
  assert.deepEqual(r[0].buttons.map(b => b.id), ["REVEAL", "NEXT", "MENU"]);

  const k = renderCard({ t: "task", tier: "b", title: "Bronze", body: "Build it" }, ctx());
  assert.match(k[0].body, /reply SKIP/);
  assert.equal(k[0].buttons[0].id, "SKIP");

  const longText = renderCard({ t: "text", body: "x".repeat(1500) }, ctx());
  assert.equal(longText.length, 2);
  assert.equal(longText[0].type, "text");
  for (const outs of [t, v, vf, q, r, k, longText]) assert.ok(outs.length <= 2);
});

test("withButtons and quizFeedback", () => {
  assert.equal(withButtons("x".repeat(1024), []).length, 1);
  assert.equal(withButtons("x".repeat(1025), []).length, 2);
  const card = { t: "quiz", q: "?", options: ["A thing", "B thing"], answer: 1, why: "Because B." };
  assert.equal(quizFeedback(card, 1).correct, true);
  assert.match(quizFeedback(card, 1).body, /^\*Correct\.\*/);
  assert.match(quizFeedback(card, 0).body, /Not quite.*B\) B thing/);
});

test("cleanScript validates cards and always ends with done", () => {
  const s = cleanScript({ title: "T", cards: [
    { t: "text", body: "Hi" }, { t: "quiz", q: "?", options: ["a"], answer: 0 }, { t: "quiz", q: "?", options: ["a", "b"], answer: 5 },
    { t: "task", tier: "x", body: "no" }, { t: "link", body: "Open", url: "javascript:alert(1)" }, { t: "bogus" }
  ] }, { id: "0.1", title: "Fallback", track: 0, free: true });
  assert.deepEqual(s.cards.map(c => c.t), ["text", "text", "done"]); // bad quiz/task dropped, unsafe link → text
  assert.equal(s.title, "T");
  assert.equal(cleanScript({ cards: [] }, { id: "0.1", title: "F", track: 0, free: true }), null);
  const cut = cleanScript({ cards: [{ t: "text", body: "a" }, { t: "done", body: "end" }, { t: "text", body: "after" }] }, { id: "0.1", title: "F", track: 0, free: true });
  assert.equal(cut.cards.length, 2);
  assert.equal(cleanCard({ t: "video", caption: "c", media: null, youtube: null, app: null }).t, "text");
  assert.equal(awaitingFor({ t: "quiz" }), "quiz");
  assert.equal(awaitingFor({ t: "task" }), "task");
  assert.equal(awaitingFor({ t: "done" }), "none");
  assert.equal(awaitingFor({ t: "text" }), "next");
});

test("XP as in course/src/platform.js", () => {
  assert.equal(itemXp("1.3"), 100);
  assert.equal(itemXp("B2"), 300);
  assert.equal(itemXp("6.4"), 400);
});

test("course access mirrors getEntitlements", () => {
  const future = new Date(Date.now() + DAY).toISOString(), past = new Date(Date.now() - DAY).toISOString();
  assert.equal(courseAccessFrom([{ product: "self", status: "active", expires_at: null }]), true);
  assert.equal(courseAccessFrom([{ product: "team", status: "active", expires_at: future }]), true);
  assert.equal(courseAccessFrom([{ product: "cohort", status: "active", expires_at: past }]), false);
  assert.equal(courseAccessFrom([{ product: "self", status: "refunded", expires_at: null }]), false);
  assert.equal(courseAccessFrom([{ product: "member", status: "active", expires_at: null }]), false);
});

test("reminders: inactive ≥ 2 days, at most one per 3 days; 24-hour window", () => {
  const now = Date.parse("2026-10-21T07:30:00Z");
  const ago = d => new Date(now - d * DAY).toISOString();
  assert.equal(reminderDue({ lastActive: ago(1), lastReminder: null, linkedAt: ago(10) }, now), false);
  assert.equal(reminderDue({ lastActive: ago(2), lastReminder: null, linkedAt: ago(10) }, now), true);
  assert.equal(reminderDue({ lastActive: ago(5), lastReminder: ago(1), linkedAt: ago(10) }, now), false);
  assert.equal(reminderDue({ lastActive: ago(5), lastReminder: ago(3), linkedAt: ago(10) }, now), true);
  assert.equal(reminderDue({ lastActive: null, lastReminder: null, linkedAt: ago(1) }, now), false);
  assert.equal(reminderDue({ lastActive: null, lastReminder: null, linkedAt: null }, now), false);
  assert.equal(within24h(ago(0.5), now), true);
  assert.equal(within24h(ago(1), now), false);
  assert.equal(within24h(null, now), false);
});

test("link codes and wa.me links", () => {
  assert.equal(codeFromInt(42), "000042");
  assert.equal(codeFromInt(999999), "999999");
  assert.equal(isLinkCode("012345"), true);
  assert.equal(isLinkCode("12345"), false);
  assert.equal(waMeLink("+234 801 234 5678", "012345"), "https://wa.me/2348012345678?text=LINK%20012345");
  assert.equal(decodeEntities("APIs &amp; Webhooks"), "APIs & Webhooks");
});
