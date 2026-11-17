/**
 * Decision rules for the agents (pure: no I/O, unit-tested in tests/agents.test.mjs).
 */
import { REFUND_REASONS } from "../refund-reasons";

// ── Refunds ─────────────────────────────────────────────────────────────────
export type RefundFacts = {
  product: string; daysSincePaid: number; windowDays: number; reasonKey: string | null;
  paidLessonsDonePct: number; certificateClaimed: boolean; addonUsed: boolean | null;
  priorRefunds180d: number; duplicateOf: string | null; hasAccess: boolean;
};
export type RefundCall = { decision: "approve" | "decline" | "person"; recommend: "approve" | "decline"; reasons: string[]; note: string };
const COURSE_PRODUCTS = ["self", "cohort", "team"];
const ADDONS = ["story", "bundle", "crmspec"];

export function reasonKeyOf(stored: string): string | null {
  const m = /^\[([^\]]+)\]/.exec(stored || "");
  return m ? (REFUND_REASONS.find(r => r.label === m[1])?.key ?? null) : null;
}

export function decideRefund(f: RefundFacts): RefundCall {
  const reasons: string[] = [];
  // Always put right: a double charge, or a payment that never gave access.
  if (f.reasonKey === "duplicate" && f.duplicateOf) {
    return { decision: "approve", recommend: "approve", reasons: ["Charged twice for the same product."], note: "You were charged twice, so we've refunded the duplicate payment." };
  }
  if (f.reasonKey === "no_access" && !f.hasAccess && f.paidLessonsDonePct === 0) {
    return { decision: "approve", recommend: "approve", reasons: ["Paid but never got access, and no paid lessons were opened."], note: "We couldn't give you access to what you paid for, so we've refunded you. Sorry about that." };
  }
  if (f.priorRefunds180d >= 2) reasons.push(`${f.priorRefunds180d} earlier refunds in 6 months.`);
  // Clear policy declines.
  const late = f.daysSincePaid > f.windowDays;
  if (late) return { decision: f.reasonKey === "duplicate" || f.reasonKey === "no_access" ? "person" : "decline", recommend: "decline", reasons: [...reasons, `Asked after ${f.daysSincePaid} days (window ${f.windowDays}).`], note: `Refunds must be requested within ${f.windowDays} days of payment, so we can't refund this one.` };
  if (COURSE_PRODUCTS.includes(f.product) && f.certificateClaimed)
    return { decision: "decline", recommend: "decline", reasons: [...reasons, "Certificate already claimed."], note: "You've claimed your certificate for this course, so it can't be refunded." };
  if (COURSE_PRODUCTS.includes(f.product) && f.paidLessonsDonePct >= 30)
    return { decision: "decline", recommend: "decline", reasons: [...reasons, `${f.paidLessonsDonePct}% of paid lessons completed.`], note: `You've completed ${f.paidLessonsDonePct}% of the paid lessons; our policy refunds courses only below 30%.` };
  if (ADDONS.includes(f.product) && f.addonUsed === true)
    return { decision: "decline", recommend: "decline", reasons: [...reasons, "Add-on already used or downloaded."], note: "This add-on has already been used, so it can't be refunded." };
  if (!f.reasonKey) return { decision: "person", recommend: "decline", reasons: [...reasons, "No reason from the list was given."], note: "" };
  // A genuine reason within the rules: a person judges whether it's true.
  return { decision: "person", recommend: reasons.length ? "decline" : "approve", reasons: [...reasons, `Reason: ${REFUND_REASONS.find(r => r.key === f.reasonKey)?.label}. Within the rules; check the explanation.`], note: "" };
}

// ── Community moderation ───────────────────────────────────────────────────
const SCAM = /\b(forex|binary option|crypto (?:signal|investment)|double your money|investment (?:plan|opportunity) with \d+%|loan app|send me \$|recovery expert|hack(?:er|ing) service|fake (?:id|certificate)|adult content|onlyfans|betting tips?|sure odds)\b/i;
const CONTACT_PUSH = /\b(dm|inbox|whatsapp|call|text)\s+me\b|\+?\d[\d\s-]{9,}\d/i;
const ABUSE = /\b(fuck|bitch|bastard|idiot|stupid fool|mumu|ode|ashawo|shege)\b/i;
export type ModCall = { action: "hide" | "flag" | "ok"; reason: string };
export function moderate(text: string, o: { sameTextCount: number; reports: number; links: number }): ModCall {
  if (o.reports >= 2) return { action: "hide", reason: `Reported by ${o.reports} members` };
  if (SCAM.test(text)) return { action: "hide", reason: "Looks like a scam or spam offer" };
  if (o.sameTextCount >= 3) return { action: "hide", reason: "The same message posted 3 or more times" };
  if (o.links >= 4) return { action: "hide", reason: "Too many links (likely spam)" };
  if (ABUSE.test(text)) return { action: "flag", reason: "Possibly abusive language" };
  if (CONTACT_PUSH.test(text)) return { action: "flag", reason: "Pushes people to contact off the platform" };
  if (o.reports === 1) return { action: "flag", reason: "Reported by a member" };
  return { action: "ok", reason: "" };
}

// ── Hiring matchmaker ──────────────────────────────────────────────────────
const STOP = new Set("a an and are as at be but by for from has have i in is it of on or our the to we who with you your need looking someone person role job help can will".split(" "));
export const tokens = (s: string) => new Set((s.toLowerCase().match(/[a-z0-9+#.]{2,}/g) || []).map(w => w.replace(/\.$/, "")).filter(w => !STOP.has(w)));
const TOOL_ALIASES: Record<string, string[]> = { n8n: ["n8n"], make: ["make", "integromat"], zapier: ["zapier", "zap", "zaps"], hubspot: ["hubspot", "crm"], zoho: ["zoho", "crm"], whatsapp: ["whatsapp"], ai: ["ai", "agent", "agents", "gpt", "llm", "chatbot"], sheets: ["sheets", "spreadsheet", "excel"] };
export type HireProfile = { user_id: string; display_name: string; headline: string; bio: string | null; skills: string[]; tools: string[]; availability: string; city: string | null };
export function matchScore(request: string, p: HireProfile): number {
  if (p.availability === "not_available") return 0;
  const want = tokens(request);
  const tools = p.tools.map(t => t.toLowerCase()), skills = p.skills.map(t => t.toLowerCase());
  let score = 0;
  for (const [tool, words] of Object.entries(TOOL_ALIASES)) if (words.some(w => want.has(w)) && tools.some(t => t.includes(tool))) score += 3;
  for (const s of skills) if ([...tokens(s)].some(w => want.has(w))) score += 2;
  for (const w of tokens(`${p.headline} ${p.bio || ""}`)) if (want.has(w)) score += 1;
  if (p.city && want.has(p.city.toLowerCase())) score += 1;
  return score;
}
export const topMatches = (request: string, profiles: HireProfile[], n = 3) =>
  profiles.map(p => ({ p, score: matchScore(request, p) })).filter(x => x.score >= 3).sort((a, b) => b.score - a.score).slice(0, n);

// ── Fraud ───────────────────────────────────────────────────────────────────
/** The mailbox behind an address: gmail dots and "+tags" removed, so a.b+x@gmail.com = ab@gmail.com. */
export function emailIdentity(email: string): string {
  const [local = "", domain = ""] = email.toLowerCase().trim().split("@");
  const base = local.split("+")[0];
  const d = domain === "googlemail.com" ? "gmail.com" : domain;
  return `${d === "gmail.com" ? base.replace(/\./g, "") : base}@${d}`;
}

// ── Support ─────────────────────────────────────────────────────────────────
export type KbEntry = { topic: string; keys: RegExp; answer: string; safeToSend: boolean };
/** Built from the site's policies and FAQ (see lib/agents/support.ts, which fills in live numbers). */
export function supportKb(o: { site: string; refundDays: number; selfPrice: string; installments: string; supportEmail: string }): KbEntry[] {
  return [
    { topic: "access", keys: /\b(log ?in|login|sign ?in|password|reset|can'?t (?:access|open|log)|locked out|verification|confirm(?:ation)? email)\b/i, safeToSend: true,
      answer: `To get back in: go to ${o.site}/forgot-password, enter the email you signed up with, and follow the link we send (check spam and promotions too). If no email arrives within 10 minutes, reply to this message with the email address you used and we'll check your account.` },
    { topic: "access", keys: /\b(paid|bought|purchase)\b.{0,60}\b(no access|can'?t see|locked|still free|not unlocked)\b/i, safeToSend: false,
      answer: `Thanks for letting us know. Payments usually unlock access within a minute. Please log out and back in at ${o.site}/login, then open ${o.site}/learn. If it's still locked, reply with your payment reference (from the Paystack receipt) and we'll unlock it straight away.` },
    { topic: "certificate", keys: /\b(certificate|cert|verify|verification|linkedin)\b/i, safeToSend: true,
      answer: `Your Automancy Academy Certificate is issued from Account → Certificate once every required lesson and project is accepted. It has a public verification page at ${o.site}/verify that employers can check, and you can add it to LinkedIn from the same page. If something you completed isn't counted, reply with the lesson number and we'll look.` },
    { topic: "whatsapp", keys: /\bwhats ?app\b/i, safeToSend: true,
      answer: `You can take the course on WhatsApp: go to Account → Learn on WhatsApp, link your number, then send MENU to our number. Send HELP followed by your question to ask Sage, and REMINDERS OFF to stop reminders.` },
    { topic: "payment", keys: /\b(pay in 3|instal+ments?|part payment)\b/i, safeToSend: true,
      answer: `Pay in 3 is available on the Self-paced plan in naira: ${o.installments}, one month apart. The first payment unlocks the course; if a later payment is missed, access pauses until it's paid.` },
    { topic: "payment", keys: /\b(price|cost|how much|fee|discount|coupon|code)\b/i, safeToSend: true,
      answer: `The Self-paced course is ${o.selfPrice} one-time (or ${o.installments}). Base Camp is free to try first. All prices are on ${o.site}/pricing. If you have a discount code, enter it in the "Discount code" box at checkout.` },
    { topic: "refund", keys: /\b(refund|money back|cancel)\b/i, safeToSend: false,
      answer: `You can ask for a refund from Account → Purchases within ${o.refundDays} days of paying, for a genuine problem with what you bought (not as described, a technical problem we couldn't fix, no access, or a double charge). The full policy is at ${o.site}/legal/refunds.` },
    { topic: "creator", keys: /\b(teach|creator|sell my course|instructor|upload (?:a|my) course)\b/i, safeToSend: true,
      answer: `You can teach on Automancy: apply at ${o.site}/teach. Once approved, you build your course in the studio, submit it, and it's reviewed against the standards at ${o.site}/teach/standards. You keep a share of each sale after the payment fee; details are in the creator terms.` },
    { topic: "hire", keys: /\b(hire|recruit|talent|graduates?|employ)\b/i, safeToSend: true,
      answer: `To hire a graduate, tell us who you need at ${o.site}/hire. We match your request with certified graduates and introduce you by email, usually within two working days. Introductions are free.` }
  ];
}
export function answerFromKb(kb: KbEntry[], topic: string, text: string): { answer: string; confidence: number; safeToSend: boolean } | null {
  const hits = kb.filter(k => k.keys.test(text));
  const best = hits.find(k => k.topic === topic) || hits[0] || kb.find(k => k.topic === topic);
  if (!best) return null;
  const confidence = hits.includes(best) ? (best.topic === topic ? 0.85 : 0.7) : 0.4;
  return { answer: best.answer, confidence, safeToSend: best.safeToSend };
}
