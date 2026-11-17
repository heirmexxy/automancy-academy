import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadPrices } from "@/lib/price-settings";
import { AGENTS, agentMeta, dueAgents, mergeAgentSettings, type AgentKey, type AgentSettings } from "@/lib/agents/registry";

export type Flag = { kind: string; message: string; severity?: "low" | "medium" | "high"; target_type?: string; target_id?: string; detail?: unknown };
export type Ctx = {
  db: ReturnType<typeof createAdminClient>;
  auto: boolean;                         // may act (otherwise recommend only)
  trigger: "schedule" | "admin" | "event";
  flag: (f: Flag) => Promise<boolean>;   // true if a new flag was created
};
export type Outcome = { summary: string; actions: number; detail?: unknown };
type Impl = (ctx: Ctx) => Promise<Outcome>;

export async function getAgentSettings(): Promise<AgentSettings> {
  try {
    const { data } = await createAdminClient().from("settings").select("value").eq("key", "agents").maybeSingle();
    return mergeAgentSettings(data?.value);
  } catch { return mergeAgentSettings(null); }
}
export async function saveAgentSettings(s: AgentSettings) {
  await createAdminClient().from("settings").upsert({ key: "agents", value: s, updated_at: new Date().toISOString() }, { onConflict: "key" });
}

async function impl(key: AgentKey): Promise<Impl | null> {
  switch (key) {
    case "refunds": return (await import("./refunds")).run;
    case "payments": return (await import("./payments")).run;
    case "support": return (await import("./support")).run;
    case "learner_success": return (await import("./learner-success")).run;
    case "fraud": return (await import("./fraud")).run;
    case "payouts": return (await import("./payouts")).run;
    case "hiring": return (await import("./hiring")).run;
    case "moderation": return (await import("./moderation")).run;
    case "weekly_report": return (await import("./weekly-report")).run;
    default: return null; // course_review runs on submission (lib/course-agent.ts)
  }
}

/** Runs one agent and records the run. Never throws. */
export async function runAgent(key: AgentKey, trigger: Ctx["trigger"] = "schedule", settings?: AgentSettings): Promise<Outcome & { status: "ok" | "error" | "skipped" }> {
  const db = createAdminClient();
  const s = (settings || await getAgentSettings())[key];
  const fn = await impl(key);
  if (!fn) return { status: "skipped", summary: "Runs on events, not on a schedule.", actions: 0 };
  if (!s.enabled && trigger === "schedule") return { status: "skipped", summary: "Switched off.", actions: 0 };
  await loadPrices();
  const { data: row } = await db.from("agent_runs").insert({ agent: key, trigger }).select("id").maybeSingle();
  const ctx: Ctx = {
    db, trigger, auto: s.auto && !!agentMeta(key)?.canAct,
    flag: async f => {
      const { error } = await db.from("agent_flags").insert({
        agent: key, kind: f.kind, message: f.message.slice(0, 1000), severity: f.severity || "medium",
        target_type: f.target_type ?? null, target_id: f.target_id ?? null, detail: f.detail ?? null
      });
      if (error && error.code !== "23505") console.error(`[agent:${key}] flag failed`, error.message);
      return !error;
    }
  };
  try {
    const out = await fn(ctx);
    if (row?.id) await db.from("agent_runs").update({ status: "ok", summary: out.summary.slice(0, 2000), actions: out.actions, detail: out.detail ?? null, finished_at: new Date().toISOString() }).eq("id", row.id);
    return { ...out, status: "ok" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[agent:${key}] failed`, e);
    if (row?.id) await db.from("agent_runs").update({ status: "error", summary: `Failed: ${msg}`.slice(0, 2000), finished_at: new Date().toISOString() }).eq("id", row.id);
    return { status: "error", summary: msg, actions: 0 };
  }
}

/** The scheduled tick (hourly / daily from the server's cron). */
export async function runSchedule(tick: "hourly" | "daily") {
  const settings = await getAgentSettings();
  const weekday = new Date(Date.now() + 3_600_000).getUTCDay(); // Lagos (UTC+1)
  const results: Record<string, string> = {};
  for (const key of dueAgents(tick, weekday)) {
    const r = await runAgent(key, "schedule", settings);
    results[key] = `${r.status}: ${r.summary}`;
  }
  return results;
}
export { AGENTS };
