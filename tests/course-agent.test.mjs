// Run: tsx --test tests/course-agent.test.mjs — the Course Review Agent's rules.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as ns from "../lib/course-agent-rules.ts";
const A = ns.default ?? ns;
const para = n => Array.from({ length: n }, (_, i) => `Step ${i + 1}: open the workflow, add the node and test it with a sample order.`).join(" ");
const good = {
  title: "Automate WhatsApp orders with Make", subtitle: "From chat to spreadsheet in an afternoon", category: "Automation", level: "beginner",
  description: "This course is for small shop owners who take orders on WhatsApp. By the end you will be able to build a Make scenario that logs every order to Google Sheets, sends a receipt and alerts you about big orders. " + para(3),
  cover_url: "https://example.com/cover.jpg", price_ngn: 10000, price_usd: null
};
const lessons = () => [
  { title: "Why automate orders", kind: "text", body_md: para(12), video_url: null, quiz: null, task: null, free_preview: true },
  { title: "Your first scenario", kind: "video", body_md: para(4), video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", quiz: null, task: null },
  { title: "Check your understanding", kind: "quiz", body_md: "", video_url: null, task: null,
    quiz: [1, 2, 3].map(i => ({ q: `Question ${i}?`, options: ["A", "B", "C"], answer: 0 })) },
  { title: "Final project: your order log", kind: "task", body_md: para(3), video_url: null, quiz: null, task: "Build the scenario for your own shop and run five test orders through it." }
];

test("a complete, honest course is approved", () => {
  const r = A.reviewCourse(good, lessons());
  assert.deepEqual(r.findings, []);
  assert.equal(r.decision, "approve");
  assert.equal(r.passed.length, 8);
});

test("scam promises and asking for OTPs are rejected", () => {
  const ls = lessons(); ls[0].body_md += " This system is guaranteed to give you income of ₦50,000 every week.";
  ls[1].body_md += " Then send me your OTP so I can set it up for you.";
  const r = A.reviewCourse(good, ls);
  assert.equal(r.decision, "reject");
  assert.ok(r.findings.some(f => f.standard === "honest" && f.severity === "reject"));
  assert.ok(r.findings.some(f => f.standard === "safe" && f.where === "Your first scenario"));
  assert.match(A.creatorNote(r), /Safe and lawful:/);
});

test("fake engagement and paying off-platform are rejected", () => {
  for (const extra of ["Use this bot to buy fake followers for clients.", "To get the templates, pay directly to me by transfer.", "Here is how to bypass WhatsApp limits when blasting."]) {
    const ls = lessons(); ls[0].body_md += " " + extra;
    assert.equal(A.reviewCourse(good, ls).decision, "reject", extra);
  }
});

test("thin courses with no hands-on work get changes requested", () => {
  const ls = [
    { title: "Intro", kind: "text", body_md: "Welcome to the course. This is the intro lesson with a few words in it only.", video_url: null, quiz: null, task: null },
    { title: "Watch this", kind: "video", body_md: "", video_url: "https://youtu.be/dQw4w9WgXcQ", quiz: null, task: null },
    { title: "More", kind: "text", body_md: para(2), video_url: null, quiz: null, task: null }
  ];
  const r = A.reviewCourse({ ...good, description: "A course about stuff. " + "x ".repeat(120) }, ls);
  assert.equal(r.decision, "changes");
  const msgs = r.findings.map(f => f.message).join(" | ");
  assert.match(msgs, /tasks or quizzes/);
  assert.match(msgs, /final project/);
  assert.match(msgs, /written summary under the video/);
  assert.match(msgs, /what learners will be able to do/);
});

test("possible copying goes to a person, not an automatic decision", () => {
  const ls = lessons(); ls[0].body_md += " Originally from my Udemy course.";
  const r = A.reviewCourse(good, ls);
  assert.equal(r.decision, "person");
});

test("the AI can only make it stricter, and an AI reject alone goes to a person", () => {
  const ok = A.reviewCourse(good, lessons());
  assert.equal(A.combineWithAi(ok, { decision: "approve", findings: [] }).decision, "approve");
  assert.equal(A.combineWithAi(ok, { decision: "changes", findings: [{ standard: "accurate", severity: "changes", message: "Make's free plan limit is out of date." }] }).decision, "changes");
  assert.equal(A.combineWithAi(ok, { decision: "reject", findings: [] }).decision, "person");
  const bad = A.reviewCourse(good, [lessons()[0]]);
  assert.equal(A.combineWithAi(bad, { decision: "approve", findings: [] }).decision, bad.decision);
});
