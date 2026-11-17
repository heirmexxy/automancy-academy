/**
 * Course Review Agent: the rules (pure, no I/O; unit-tested in tests/course-agent.test.mjs).
 * Every rule maps to one of the published creator standards (STANDARDS in courses/_lib/core.ts), so a creator
 * reading the agent's note sees the same words as /teach/standards.
 *
 *   reject   a hard rule is broken (scam promises, asking learners for passwords/OTPs/BVN, spam or fake engagement,
 *            selling off the platform). No fixing it by editing a lesson; a person can still override.
 *   changes  something fixable is missing (structure, too thin, no hands-on work, unclear outcome).
 *   person   nothing blocks it, but something needs human judgement (possible copied material, outdated claims).
 *   approve  every rule passes.
 */
import { MARKET, STANDARDS, normaliseQuiz, parseVideo, submitProblems, type CourseLike, type LessonLike } from "../app/(site)/courses/_lib/core";

export type AgentDecision = "approve" | "changes" | "reject" | "person";
export type Finding = { standard: string; severity: "reject" | "changes" | "person"; message: string; where?: string };
export type AgentCourse = CourseLike & { subtitle?: string | null; level?: string | null };
export type AgentLesson = LessonLike & { free_preview?: boolean; section?: string };
export type AgentReport = {
  decision: AgentDecision;
  findings: Finding[];
  passed: string[];               // standard keys with no findings
  stats: { lessons: number; practical: number; words: number; videos: number; previews: number };
  version: number;
};
export const AGENT_VERSION = 1;

const stdTitle = (key: string) => STANDARDS.find(s => s.key === key)?.title || key;

/** Hard rules: a match means the course is rejected (a person may override). Patterns are case-insensitive. */
const HARD: { standard: string; re: RegExp; message: string }[] = [
  { standard: "honest", re: /\b(guarantee[sd]?|guaranteed)\b[^.\n]{0,60}\b(income|profit|earnings?|returns?|money|salary|job)\b|\b(get[- ]rich[- ]quick|make (?:₦|n|\$)?\s?\d[\d,]*k?\s*(?:per|a|every)\s*(?:day|week|hour))\b|\b100%\s*(?:guaranteed|profit|success)\b/i,
    message: "Promises guaranteed income or quick riches." },
  { standard: "safe", re: /\b(send|share|give|enter|type|tell)\b[^.\n]{0,40}\b(your|ur)\b[^.\n]{0,20}\b(password|passcode|otp|one[- ]time (?:pin|code)|pin|bvn|nin|card (?:number|details)|cvv|bank (?:login|password)|seed phrase|private key)\b/i,
    message: "Asks learners for passwords, OTPs, PINs, BVN or card details." },
  { standard: "safe", re: /\b(buy|get|generate|add)\b[^.\n]{0,30}\b(fake|bot)\b[^.\n]{0,20}\b(followers|likes|reviews|engagement|views|accounts)\b|\b(bypass|get around|evade|avoid getting banned|dodge)\b[^.\n]{0,40}\b(rate limits?|captcha|spam filters?|ban|whatsapp limits?|terms of service)\b/i,
    message: "Teaches fake engagement or ways around platform limits and rules." },
  { standard: "safe", re: /\b(bulk|mass)\b[^.\n]{0,30}\b(unsolicited|cold)\b[^.\n]{0,30}\b(sms|whatsapp|messages?|emails?|dms?)\b|\bscrap(?:e|ing)\b[^.\n]{0,60}\b(without (?:permission|consent)|against (?:their|the) terms)\b/i,
    message: "Teaches spam or scraping without consent." },
  { standard: "honest", re: /\b(pay|send (?:the )?money|transfer)\b[^.\n]{0,40}\b(directly to me|to my (?:account|bank)|outside (?:automancy|the platform))\b|\bwhatsapp me\b[^.\n]{0,30}\b(to pay|for payment|to buy)\b/i,
    message: "Asks learners to pay outside Automancy." }
];

/** Soft signals that need a person (never block on their own). */
const SOFT: { standard: string; re: RegExp; message: string }[] = [
  { standard: "original", re: /\b(copyright|all rights reserved|©)\s*(?:20\d\d)?\s*(?!automancy)[a-z]/i, message: "Contains someone else's copyright notice: check the material is licensed." },
  { standard: "original", re: /\b(udemy|coursera|skillshare|domestika|linkedin learning)\b/i, message: "Mentions another course platform: check nothing is copied from it." },
  { standard: "accurate", re: /\b(free forever|always free|unlimited (?:tasks|operations|executions) (?:for )?free)\b/i, message: "Makes a pricing claim about a tool that may be out of date." },
  { standard: "honest", re: /\b(only \d+ (?:spots|seats) left|offer ends (?:today|tonight)|last chance)\b/i, message: "Uses urgency wording: check it isn't fake urgency." }
];

const words = (s: string) => (s.trim().match(/\S+/g) || []).length;
const lessonText = (l: AgentLesson) => [l.title, l.body_md || "", l.task || "", JSON.stringify(l.quiz ?? "")].join("\n");

export function reviewCourse(c: AgentCourse, lessons: AgentLesson[]): AgentReport {
  const findings: Finding[] = [];
  const add = (f: Finding) => { if (!findings.some(x => x.message === f.message && x.where === f.where)) findings.push(f); };

  // 1) Structure: the same checks as "Submit for review" (complete).
  for (const p of submitProblems(c, lessons)) add({ standard: "complete", severity: "changes", message: p });

  // 2) Hands-on: tasks or quizzes, and a final practical piece (practical).
  const practical = lessons.filter(l => l.kind === "task" || l.kind === "quiz").length;
  if (lessons.length >= MARKET.minLessons && practical === 0)
    add({ standard: "practical", severity: "changes", message: "Add tasks or quizzes: every section should end with something learners do." });
  const last = lessons[lessons.length - 1];
  if (last && last.kind !== "task" && !/\b(project|capstone|build|final)\b/i.test(last.title))
    add({ standard: "practical", severity: "changes", message: "End with a final project or practical task.", where: last.title });

  // 3) Clear outcome: the description says who it's for and what they'll be able to do (outcome).
  const desc = (c.description || "").toLowerCase();
  if (!/\b(you will|you'll|by the end|learn to|able to|build|create|set up|automate)\b/.test(desc))
    add({ standard: "outcome", severity: "changes", message: "Say in the description what learners will be able to do or build by the end." });
  if (!/\b(?:is|are|made|designed|built|perfect|ideal|great) for\b|\bfor\b[^.]{0,40}\b(?:anyone|beginners|people|owners|founders|freelancers|marketers|teams|students|professionals|businesses|managers|assistants|you)\b|\bwho (?:is|it'?s) for\b|\bif you\b/.test(desc))
    add({ standard: "outcome", severity: "person", message: "The description doesn't clearly say who the course is for." });

  // 4) Clear and well produced: lessons aren't thin, no duplicates, videos have a summary (clear).
  const seen = new Map<string, string>();
  for (const l of lessons) {
    if (l.kind === "text" && words(l.body_md || "") < 120) add({ standard: "clear", severity: "changes", message: "Reading lesson is very short (under 120 words): add the steps and explanation.", where: l.title });
    if (l.kind === "video" && parseVideo(l.video_url) && words(l.body_md || "") < 25) add({ standard: "clear", severity: "changes", message: "Add a short written summary under the video (at least 25 words).", where: l.title });
    if (l.kind === "quiz") { const q = normaliseQuiz(l.quiz); if (q.ok && q.quiz.length < 3) add({ standard: "clear", severity: "person", message: "Quiz has fewer than 3 questions.", where: l.title }); }
    const key = (l.body_md || "").trim().toLowerCase().replace(/\s+/g, " ");
    if (key.length > 80) { const prev = seen.get(key); if (prev) add({ standard: "clear", severity: "changes", message: `Same text as "${prev}".`, where: l.title }); else seen.set(key, l.title); }
  }
  if (!lessons.some(l => l.free_preview)) add({ standard: "clear", severity: "person", message: "No free preview lesson: we recommend 1–2." });

  // 5) Hard rules and soft signals over all text (safe, honest, original, accurate).
  const blocks: [string, string][] = [["Course details", [c.title, c.subtitle || "", c.description || ""].join("\n")], ...lessons.map(l => [l.title, lessonText(l)] as [string, string])];
  for (const [where, text] of blocks) {
    for (const r of HARD) if (r.re.test(text)) add({ standard: r.standard, severity: "reject", message: r.message, where });
    for (const r of SOFT) if (r.re.test(text)) add({ standard: r.standard, severity: "person", message: r.message, where });
  }

  const decision: AgentDecision = findings.some(f => f.severity === "reject") ? "reject"
    : findings.some(f => f.severity === "changes") ? "changes"
    : findings.some(f => f.severity === "person") ? "person" : "approve";
  const failed = new Set(findings.map(f => f.standard));
  return {
    decision, findings,
    passed: STANDARDS.map(s => s.key).filter(k => !failed.has(k)),
    stats: {
      lessons: lessons.length, practical,
      words: lessons.reduce((n, l) => n + words(l.body_md || ""), 0) + words(c.description || ""),
      videos: lessons.filter(l => l.kind === "video").length,
      previews: lessons.filter(l => l.free_preview).length
    },
    version: AGENT_VERSION
  };
}

/** Combines the rules with the optional AI read: the AI can only make the decision stricter, never approve a failing course. */
export function combineWithAi(r: AgentReport, ai: { decision: AgentDecision; findings: Finding[] } | null): AgentReport {
  if (!ai) return r;
  const order: AgentDecision[] = ["approve", "person", "changes", "reject"];
  const findings = [...r.findings, ...ai.findings.map(f => ({ ...f, message: `AI: ${f.message}` }))];
  // An AI "reject" alone goes to a person, not straight out: rules decide automatic rejections.
  const aiDecision: AgentDecision = ai.decision === "reject" ? "person" : ai.decision;
  const decision = order[Math.max(order.indexOf(r.decision), order.indexOf(aiDecision))];
  const failed = new Set(findings.map(f => f.standard));
  return { ...r, decision, findings, passed: STANDARDS.map(s => s.key).filter(k => !failed.has(k)) };
}

/** The note the creator receives (plain text, grouped by standard). */
export function creatorNote(r: AgentReport): string {
  const by = new Map<string, Finding[]>();
  for (const f of r.findings.filter(f => f.severity !== "person")) by.set(f.standard, [...(by.get(f.standard) || []), f]);
  const lines = [...by.entries()].map(([k, fs]) => `${stdTitle(k)}:\n` + fs.map(f => `- ${f.message}${f.where ? ` (${f.where})` : ""}`).join("\n"));
  return lines.join("\n\n").slice(0, 3800);
}

export const DECISION_LABEL: Record<AgentDecision, string> = {
  approve: "Approve", changes: "Request changes", reject: "Reject", person: "Needs a person"
};
