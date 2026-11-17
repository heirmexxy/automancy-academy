import "server-only";
import { COURSE, itemById } from "@/lib/course";
import { SITE_URL } from "@/lib/config";
import { esc } from "@/lib/format";
import { emailUser } from "@/lib/marketplace";
import type { Ctx, Outcome } from "@/lib/agents/run";

const DAY = 86_400_000;
const PAID_PLANS = ["self", "cohort", "member", "team"];
const label = (id: string) => (id.startsWith("B") ? `Boss ${id.slice(1)}` : `Lesson ${id}`);
const title = (id: string) => (itemById(id)?.title || "").replace(/&amp;/g, "&").replace(/&[a-z]+;/g, " ").replace(/<[^>]+>/g, "").trim();
const lessonLink = (id: string) => `${SITE_URL}/learn#m-${id.replace(/\./g, "-")}`;

/** Learner Success Agent: nudges paying learners who've gone quiet or are stuck on a mission. */
export async function run(ctx: Ctx): Promise<Outcome> {
  const { db } = ctx;
  const now = Date.now();
  const { data: ens } = await db.from("enrollments").select("user_id, started_at").eq("status", "active").in("product", PAID_PLANS).limit(5000);
  const users = [...new Set((ens || []).map(e => String(e.user_id)))];
  if (!users.length) return { summary: "No paying learners yet.", actions: 0 };

  const recent = new Set<string>();
  const { data: nudged } = await db.from("audit_log").select("target").eq("action", "agent.nudge").gte("at", new Date(now - 14 * DAY).toISOString()).limit(10000);
  (nudged || []).forEach(n => recent.add(String(n.target)));

  const candidates: { user: string; kind: "quiet" | "stuck"; item: string; days?: number; tries?: number }[] = [];
  // Stuck: 2+ "revise" results on the same item in 14 days, and not accepted since.
  const { data: subs } = await db.from("submissions").select("user_id, item_id, status, created_at").gte("created_at", new Date(now - 14 * DAY).toISOString()).in("user_id", users.slice(0, 1000)).limit(20000);
  const tries = new Map<string, number>(), accepted = new Set<string>();
  for (const s of subs || []) {
    const k = `${s.user_id}|${s.item_id}`;
    if (s.status === "revise") tries.set(k, (tries.get(k) || 0) + 1);
    if (s.status === "accepted") accepted.add(k);
  }
  for (const [k, n] of tries) if (n >= 2 && !accepted.has(k)) { const [user, item] = k.split("|"); candidates.push({ user, kind: "stuck", item, tries: n }); }

  // Quiet: no progress for 7+ days (or never started 3+ days after paying), course not finished.
  const { data: progs } = await db.from("progress").select("user_id, done, updated_at").in("user_id", users.slice(0, 1000));
  const byUser = new Map((progs || []).map(p => [String(p.user_id), p]));
  const started = new Map((ens || []).map(e => [String(e.user_id), Date.parse(String(e.started_at))]));
  for (const u of users) {
    if (candidates.some(c => c.user === u)) continue;
    const p = byUser.get(u);
    const done = (p?.done || {}) as Record<string, boolean>;
    const next = COURSE.items.find(i => done[i.id] !== true);
    if (!next) continue;
    const last = p ? Date.parse(String(p.updated_at)) : (started.get(u) || now);
    const days = Math.floor((now - last) / DAY);
    if (days >= (p ? 7 : 3)) candidates.push({ user: u, kind: "quiet", item: next.id, days });
  }

  let sent = 0; const list: string[] = [];
  for (const c of candidates.filter(c => !recent.has(c.user)).slice(0, 100)) {
    list.push(`${c.kind === "stuck" ? "Stuck" : "Quiet"}: ${c.user.slice(0, 8)} · ${label(c.item)}${c.days ? ` · ${c.days} days` : ""}${c.tries ? ` · ${c.tries} tries` : ""}`);
    if (!ctx.auto) continue;
    const name = `${label(c.item)}: ${title(c.item)}`;
    const body = c.kind === "stuck"
      ? `<p>We noticed <b>${esc(name)}</b> has needed another go ${c.tries} times. That's normal: it's one of the harder ones.</p>
         <p>Three things that help: read the reviewer's feedback line by line and fix one point at a time; ask Sage in the lesson (the "Ask Sage" button) about the exact step; or post your attempt in the community help room, where other learners have solved it.</p>
         <p><a href="${esc(lessonLink(c.item))}">Open ${esc(label(c.item))}</a></p>`
      : `<p>Your next step in Automancy Academy is waiting: <b>${esc(name)}</b>.</p>
         <p>One session of 60 to 90 minutes moves you forward. If you have less time, open the lesson and do just the first part; your progress is saved.</p>
         <p><a href="${esc(lessonLink(c.item))}">Continue with ${esc(label(c.item))}</a></p>`;
    await emailUser(c.user, c.kind === "stuck" ? `Stuck on ${label(c.item)}? Here's help` : `Pick up where you left off: ${label(c.item)}`,
      `${body}<p style="color:#666;font-size:13px">We send this at most once every two weeks. Reply to tell us if something is in your way.</p>`);
    await db.from("audit_log").insert({ actor: null, action: "agent.nudge", target: c.user, detail: { kind: c.kind, item: c.item } });
    sent++;
  }
  return { summary: `${candidates.length} learners need a nudge (${candidates.filter(c => c.kind === "stuck").length} stuck); ${sent} emailed${ctx.auto ? "" : " (recommend-only mode: none sent)"}.`, actions: sent, detail: { list } };
}
