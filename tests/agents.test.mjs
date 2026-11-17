// Run: tsx --test tests/agents.test.mjs — the agents' decision rules.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as rulesNs from "../lib/agents/rules.ts";
import * as regNs from "../lib/agents/registry.ts";
import * as reasonsNs from "../lib/refund-reasons.ts";
const R = rulesNs.default ?? rulesNs, G = regNs.default ?? regNs, RR = reasonsNs.default ?? reasonsNs;
const base = { product: "self", daysSincePaid: 3, windowDays: 14, reasonKey: "technical", paidLessonsDonePct: 5, certificateClaimed: false, addonUsed: null, priorRefunds180d: 0, duplicateOf: null, hasAccess: true };

test("refunds: double charges and no-access are approved automatically", () => {
  assert.equal(R.decideRefund({ ...base, reasonKey: "duplicate", duplicateOf: "p2" }).decision, "approve");
  assert.equal(R.decideRefund({ ...base, reasonKey: "no_access", hasAccess: false, paidLessonsDonePct: 0 }).decision, "approve");
  assert.equal(R.decideRefund({ ...base, reasonKey: "duplicate", duplicateOf: null }).decision, "person");    // claimed but not found
  assert.equal(R.decideRefund({ ...base, reasonKey: "no_access", hasAccess: true }).decision, "person");       // has access
});

test("refunds: the policy's clear declines", () => {
  assert.equal(R.decideRefund({ ...base, daysSincePaid: 20 }).decision, "decline");
  assert.equal(R.decideRefund({ ...base, paidLessonsDonePct: 45 }).decision, "decline");
  assert.equal(R.decideRefund({ ...base, certificateClaimed: true }).decision, "decline");
  assert.equal(R.decideRefund({ ...base, product: "crmspec", addonUsed: true }).decision, "decline");
  assert.match(R.decideRefund({ ...base, paidLessonsDonePct: 45 }).note, /45%/);
});

test("refunds: genuine-sounding reasons go to a person, with a recommendation", () => {
  const c = R.decideRefund(base);
  assert.equal(c.decision, "person"); assert.equal(c.recommend, "approve");
  assert.equal(R.decideRefund({ ...base, priorRefunds180d: 3 }).recommend, "decline");
  assert.equal(R.decideRefund({ ...base, reasonKey: null }).decision, "person");
  const stored = RR.formatRefundReason("not_as_described", "Lesson 3.4 template is missing from the download pack entirely.");
  assert.equal(R.reasonKeyOf(stored), "not_as_described");
});

test("moderation: hides scams, repeats and double reports; flags borderline", () => {
  const o = { sameTextCount: 1, reports: 0, links: 0 };
  assert.equal(R.moderate("Join my forex signal group, double your money weekly", o).action, "hide");
  assert.equal(R.moderate("Buy now", { ...o, sameTextCount: 3 }).action, "hide");
  assert.equal(R.moderate("anything", { ...o, reports: 2 }).action, "hide");
  assert.equal(R.moderate("a b c", { ...o, links: 5 }).action, "hide");
  assert.equal(R.moderate("DM me for the template", o).action, "flag");
  assert.equal(R.moderate("My n8n webhook keeps timing out on step 3, any ideas?", o).action, "ok");
});

test("hiring: matches on tools and skills, ignores unavailable people", () => {
  const ps = [
    { user_id: "a", display_name: "Ada", headline: "n8n and AI agents builder", bio: "Built WhatsApp bots for shops", skills: ["AI agents", "CRM setup"], tools: ["n8n", "HubSpot"], availability: "contract", city: "Lagos" },
    { user_id: "b", display_name: "Bayo", headline: "Zapier automations", bio: null, skills: ["Lead routing"], tools: ["Zapier"], availability: "freelance", city: "Ibadan" },
    { user_id: "c", display_name: "Chi", headline: "n8n expert", bio: null, skills: ["AI agents"], tools: ["n8n"], availability: "not_available", city: null }
  ];
  const m = R.topMatches("Looking for an n8n contractor to build an AI agent on WhatsApp, Lagos", ps);
  assert.deepEqual(m.map(x => x.p.user_id), ["a"]);
  assert.equal(R.topMatches("Need help with our Zapier zaps for lead routing", ps)[0].p.user_id, "b");
  assert.equal(R.topMatches("Plumber needed", ps).length, 0);
});

test("fraud: one inbox behind different-looking addresses", () => {
  assert.equal(R.emailIdentity("A.Da+ref@gmail.com"), "ada@gmail.com");
  assert.equal(R.emailIdentity("ada@googlemail.com"), "ada@gmail.com");
  assert.notEqual(R.emailIdentity("a.da@company.ng"), R.emailIdentity("ada@company.ng"));
});

test("support: answers from the knowledge base, money topics never auto-sent", () => {
  const kb = R.supportKb({ site: "https://automancy.cc", refundDays: 14, selfPrice: "₦45,000", installments: "3 payments of ₦16,000", supportEmail: "s@a" });
  const a = R.answerFromKb(kb, "access", "I can't log in, forgot my password");
  assert.ok(a.confidence >= 0.8 && a.safeToSend);
  const r = R.answerFromKb(kb, "refund", "I want my money back");
  assert.equal(r.safeToSend, false);
  assert.match(R.answerFromKb(kb, "payment", "How does pay in 3 work?").answer, /16,000/);
});

test("registry: settings default sensibly and the schedule picks the right agents", () => {
  const s = G.mergeAgentSettings({ fraud: { enabled: true, auto: true }, hiring: { auto: true } });
  assert.equal(s.fraud.auto, false);           // fraud can't act
  assert.equal(s.hiring.auto, true);
  assert.equal(s.refunds.enabled, true);
  assert.ok(G.dueAgents("hourly", 3).includes("payments"));
  assert.ok(!G.dueAgents("hourly", 3).includes("refunds"));
  assert.ok(G.dueAgents("daily", 1).includes("weekly_report"));
  assert.ok(!G.dueAgents("daily", 2).includes("weekly_report"));
  assert.ok(!G.dueAgents("daily", 1).includes("course_review"));
});
