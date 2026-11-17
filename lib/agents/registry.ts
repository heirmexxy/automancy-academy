/**
 * The agents that run Automancy (pure data: safe to import anywhere, including tests).
 * Each agent is switched on/off and set to "act" or "recommend only" in Admin → Agents.
 */
export type AgentKey =
  | "course_review" | "refunds" | "payments" | "support" | "learner_success"
  | "fraud" | "payouts" | "hiring" | "moderation" | "weekly_report";
export type Schedule = "event" | "hourly" | "daily" | "weekly";
export type AgentMeta = {
  key: AgentKey; name: string; does: string; acts: string; recommends: string;
  schedule: Schedule; defaults: { enabled: boolean; auto: boolean }; canAct: boolean;
};

export const AGENTS: AgentMeta[] = [
  { key: "course_review", name: "Course Review Agent", schedule: "event", canAct: true, defaults: { enabled: true, auto: true },
    does: "Checks every course a creator submits against the creator standards.",
    acts: "Approves and publishes, requests changes or rejects, and emails the creator. Unsure cases wait for you.",
    recommends: "Leaves its recommendation on the course's review page." },
  { key: "refunds", name: "Refund Agent", schedule: "daily", canAct: true, defaults: { enabled: true, auto: true },
    does: "Checks each refund request: days since payment, progress through paid lessons, certificate, the reason given, and past refunds.",
    acts: "Approves clear double charges and paid-but-no-access cases, declines requests the policy rules out (late, 30%+ done, certificate claimed, add-on used), and emails the learner. Everything else waits for you with a recommendation.",
    recommends: "Writes a recommendation on every request; you decide." },
  { key: "payments", name: "Payment Checker", schedule: "hourly", canAct: true, defaults: { enabled: true, auto: true },
    does: "Compares unfinished payments with Paystack and checks paid purchases have access.",
    acts: "Confirms payments Paystack says succeeded (unlocking access, exactly like the webhook) and flags anything odd.",
    recommends: "Flags stuck payments for you to confirm." },
  { key: "support", name: "Support Agent", schedule: "hourly", canAct: true, defaults: { enabled: true, auto: true },
    does: "Reads messages sent through Contact support and drafts answers from the site's policies and FAQs.",
    acts: "Sends answers it is confident about (how-to, access, certificates, WhatsApp); money questions and anything unclear wait for you with a draft.",
    recommends: "Drafts every answer for you to send." },
  { key: "learner_success", name: "Learner Success Agent", schedule: "daily", canAct: true, defaults: { enabled: true, auto: true },
    does: "Finds paying learners who've gone quiet for a week, or are stuck on a mission after several tries.",
    acts: "Emails them the exact next step (at most once every 14 days each).",
    recommends: "Lists who needs a nudge." },
  { key: "fraud", name: "Fraud Watch", schedule: "daily", canAct: false, defaults: { enabled: true, auto: false },
    does: "Looks for self-referrals, repeated buy-and-refund, referrers whose referrals keep refunding, and shared payout accounts.",
    acts: "Flags only. The Payouts Agent holds back earnings for anyone with an open high-risk flag.",
    recommends: "Flags only." },
  { key: "payouts", name: "Payouts Agent", schedule: "daily", canAct: true, defaults: { enabled: true, auto: true },
    does: "Works out which referral and creator earnings are past the refund window, and who is owed money.",
    acts: "Approves due earnings (skipping anyone with an open fraud flag) and sends you the weekly payout list on Mondays. It never sends money itself.",
    recommends: "Sends you the list; you approve." },
  { key: "hiring", name: "Hiring Matchmaker", schedule: "daily", canAct: true, defaults: { enabled: true, auto: false },
    does: "Matches each Hire talent request with the best three graduate profiles by skills and tools.",
    acts: "Emails the employer the matching profiles and tells each graduate an employer is interested (graduates' contact details are never shared).",
    recommends: "Shows you the matches to forward yourself." },
  { key: "moderation", name: "Community Moderator", schedule: "hourly", canAct: true, defaults: { enabled: true, auto: true },
    does: "Reads new community posts and comments, and reports from members.",
    acts: "Hides clear spam and scams, and anything reported by two or more members, and flags borderline posts for you.",
    recommends: "Flags posts for you to hide." },
  { key: "weekly_report", name: "Weekly Business Report", schedule: "weekly", canAct: false, defaults: { enabled: true, auto: false },
    does: "Every Monday: sign-ups, sales, conversion, refunds, and where learners drop off, with suggested fixes.",
    acts: "Emails the report to the admins.",
    recommends: "Emails the report to the admins." }
];

export const agentMeta = (k: string) => AGENTS.find(a => a.key === k);
export type AgentSettings = Record<AgentKey, { enabled: boolean; auto: boolean }>;
export function mergeAgentSettings(raw: unknown): AgentSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, { enabled?: unknown; auto?: unknown }>;
  const out = {} as AgentSettings;
  for (const a of AGENTS) {
    const x = r[a.key] || {};
    out[a.key] = {
      enabled: typeof x.enabled === "boolean" ? x.enabled : a.defaults.enabled,
      auto: a.canAct ? (typeof x.auto === "boolean" ? x.auto : a.defaults.auto) : false
    };
  }
  return out;
}
/** Which scheduled agents run on a tick: hourly ticks run hourly agents; daily ticks also run daily ones; Monday's daily tick adds weekly. */
export function dueAgents(tick: "hourly" | "daily", lagosWeekday: number): AgentKey[] {
  return AGENTS.filter(a => a.schedule === "hourly" || (tick === "daily" && (a.schedule === "daily" || (a.schedule === "weekly" && lagosWeekday === 1)))).map(a => a.key);
}
