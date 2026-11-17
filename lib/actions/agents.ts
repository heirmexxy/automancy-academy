"use server";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUser, requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { emailAdmins, wrapEmail } from "@/lib/marketplace";
import { SITE_URL } from "@/lib/config";
import { esc } from "@/lib/format";
import { AGENTS, agentMeta, type AgentKey } from "@/lib/agents/registry";
import { getAgentSettings, runAgent, saveAgentSettings } from "@/lib/agents/run";
import { TICKET_TOPICS, handleTicket } from "@/lib/agents/support";

const s = (f: FormData, k: string, max = 500) => String(f.get(k) ?? "").trim().slice(0, max);
const q = (o: Record<string, string>) => "?" + new URLSearchParams(o).toString();

/** Admin → Agents: switch agents on/off and between "act" and "recommend only". */
export async function saveAgents(fd: FormData) {
  const admin = await requireAdmin();
  const cur = await getAgentSettings();
  for (const a of AGENTS) cur[a.key] = { enabled: fd.get(`${a.key}_enabled`) === "on", auto: a.canAct && fd.get(`${a.key}_auto`) === "on" };
  await saveAgentSettings(cur);
  await createAdminClient().from("audit_log").insert({ actor: admin.id, action: "agents.settings", target: "agents", detail: cur });
  revalidatePath("/admin/agents");
  redirect("/admin/agents" + q({ saved: "1" }));
}

export async function runAgentNow(fd: FormData) {
  await requireAdmin();
  const key = s(fd, "agent", 40) as AgentKey;
  if (!agentMeta(key)) redirect("/admin/agents");
  const r = await runAgent(key, "admin");
  revalidatePath("/admin/agents");
  redirect("/admin/agents" + q({ ran: key, result: `${r.status}: ${r.summary}`.slice(0, 300) }) + `#${key}`);
}

export async function closeFlag(fd: FormData) {
  const admin = await requireAdmin();
  const id = s(fd, "id", 64);
  const status = s(fd, "status", 12) === "dismissed" ? "dismissed" : "resolved";
  await createAdminClient().from("agent_flags").update({ status, resolved_by: admin.id, resolved_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/admin/agents");
  redirect(s(fd, "back", 200) || "/admin/agents#flags");
}

// ── Support tickets ─────────────────────────────────────────────────────────

type TicketResult = { ok: boolean; msg: string; at?: number } | null;
async function ipHash() {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") || h.get("x-real-ip") || "").split(",")[0].trim() || "unknown";
  return createHash("sha256").update(ip + (process.env.SUPABASE_SERVICE_ROLE_KEY || "").slice(-12)).digest("hex").slice(0, 32);
}

/** Public "Contact support" form. Honeypot + time trap + per-IP/email limits, then the Support Agent answers or drafts. */
export async function createTicket(_prev: TicketResult, fd: FormData): Promise<TicketResult> {
  if (s(fd, "website", 200)) return { ok: true, msg: "Thanks. We'll reply by email." };
  const shownAt = Number(fd.get("t") || 0);
  if (!shownAt || Date.now() - shownAt < 3000) return { ok: false, msg: "That was quick. Please check the form and send it again." };
  const user = await getUser().catch(() => null);
  const name = s(fd, "name", 120), email = s(fd, "email", 200).toLowerCase(), subject = s(fd, "subject", 160), message = s(fd, "message", 4000);
  const topic = TICKET_TOPICS.some(t => t.key === s(fd, "topic", 40)) ? s(fd, "topic", 40) : "other";
  if (!name) return { ok: false, msg: "Add your name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, msg: "Add a valid email so we can reply." };
  if (subject.length < 3) return { ok: false, msg: "Add a short subject." };
  if (message.length < 10) return { ok: false, msg: "Tell us a little more (at least 10 characters)." };
  const db = createAdminClient();
  const ip_hash = await ipHash();
  const since = new Date(Date.now() - 864e5).toISOString();
  const [{ count: byIp }, { count: byEmail }] = await Promise.all([
    db.from("support_tickets").select("id", { count: "exact", head: true }).eq("ip_hash", ip_hash).gte("created_at", since),
    db.from("support_tickets").select("id", { count: "exact", head: true }).eq("email", email).gte("created_at", since)
  ]);
  if ((byIp ?? 0) >= 6 || (byEmail ?? 0) >= 6) return { ok: false, msg: "You've sent several messages today; we'll reply to those first." };
  const { data: t, error } = await db.from("support_tickets").insert({ user_id: user?.id ?? null, name, email, topic, subject, message, ip_hash }).select("id, name, email, topic, subject, message").maybeSingle();
  if (error || !t) return { ok: false, msg: "Couldn't send your message. Please try again in a minute." };

  let outcome: "sent" | "drafted" = "drafted";
  const cfg = (await getAgentSettings()).support;
  if (cfg.enabled) { try { outcome = await handleTicket({ db, auto: cfg.auto }, t as never); } catch (e) { console.error("[support] agent failed", e); } }
  if (outcome !== "sent") await emailAdmins(`Support: ${subject}`, `<p><b>${esc(name)}</b> (${esc(email)}) · ${esc(topic)}</p><blockquote>${esc(message)}</blockquote><p><a href="${esc(SITE_URL)}/admin/support">Answer it</a></p>`);
  return { ok: true, msg: outcome === "sent" ? "Thanks. We've emailed you an answer; reply to it if you need more help." : "Thanks. We've got your message and will reply by email, usually within one working day." };
}

/** Admin → Support: send a reply (the agent's draft, edited or not). */
export async function replyTicket(fd: FormData) {
  const admin = await requireAdmin();
  const id = s(fd, "id", 64), reply = s(fd, "reply", 6000);
  if (reply.length < 5) redirect("/admin/support" + q({ error: "Write a reply first." }));
  const db = createAdminClient();
  const { data: t } = await db.from("support_tickets").select("email, subject").eq("id", id).maybeSingle();
  if (!t) redirect("/admin/support");
  await sendEmail(String(t.email), `Re: ${t.subject}`, wrapEmail(reply.split("\n").map(l => (l ? `<p>${esc(l)}</p>` : "")).join("")));
  await db.from("support_tickets").update({ status: "answered", reply, replied_by: admin.id, replied_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/admin/support");
  redirect("/admin/support" + q({ sent: "1" }));
}
export async function closeTicket(fd: FormData) {
  await requireAdmin();
  await createAdminClient().from("support_tickets").update({ status: "closed" }).eq("id", s(fd, "id", 64));
  revalidatePath("/admin/support");
  redirect("/admin/support");
}
