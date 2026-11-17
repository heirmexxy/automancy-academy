import "server-only";
import { moderate } from "@/lib/agents/rules";
import type { Ctx, Outcome } from "@/lib/agents/run";

const HOUR = 3_600_000;
const links = (s: string) => (s.match(/https?:\/\//g) || []).length;
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 300);

/** Community Moderator: hides clear spam/scams and twice-reported content; flags borderline posts. */
export async function run(ctx: Ctx): Promise<Outcome> {
  const { db } = ctx;
  const since = new Date(Date.now() - 26 * HOUR).toISOString();
  const [{ data: posts }, { data: comments }, { data: reports }] = await Promise.all([
    db.from("posts").select("id, user_id, title, body, link, type").eq("hidden", false).neq("type", "announcement").gte("created_at", since).limit(2000),
    db.from("comments").select("id, user_id, body").eq("hidden", false).gte("created_at", since).limit(4000),
    db.from("reports").select("id, post_id, comment_id").eq("status", "open").limit(2000)
  ]);
  const repCount = new Map<string, number>();
  for (const r of reports || []) { const k = r.post_id ? `p:${r.post_id}` : `c:${r.comment_id}`; repCount.set(k, (repCount.get(k) || 0) + 1); }
  // Reported items may be older than a day: include them.
  const reportedPosts = [...repCount.keys()].filter(k => k.startsWith("p:")).map(k => k.slice(2)).filter(id => !(posts || []).some(p => p.id === id));
  const reportedComments = [...repCount.keys()].filter(k => k.startsWith("c:")).map(k => k.slice(2)).filter(id => !(comments || []).some(c => c.id === id));
  const [{ data: oldP }, { data: oldC }] = await Promise.all([
    reportedPosts.length ? db.from("posts").select("id, user_id, title, body, link, type").eq("hidden", false).in("id", reportedPosts) : Promise.resolve({ data: [] as never[] }),
    reportedComments.length ? db.from("comments").select("id, user_id, body").eq("hidden", false).in("id", reportedComments) : Promise.resolve({ data: [] as never[] })
  ]);
  const items = [
    ...[...(posts || []), ...(oldP || [])].map(p => ({ kind: "post" as const, id: String(p.id), user: String(p.user_id), text: `${p.title || ""}\n${p.body}${p.link ? `\n${p.link}` : ""}` })),
    ...[...(comments || []), ...(oldC || [])].map(c => ({ kind: "comment" as const, id: String(c.id), user: String(c.user_id), text: String(c.body) }))
  ];
  const same = new Map<string, number>();
  for (const i of items) { const k = `${i.user}|${norm(i.text)}`; same.set(k, (same.get(k) || 0) + 1); }

  let hidden = 0, flagged = 0;
  for (const i of items) {
    const call = moderate(i.text, { sameTextCount: same.get(`${i.user}|${norm(i.text)}`) || 1, reports: repCount.get(`${i.kind === "post" ? "p" : "c"}:${i.id}`) || 0, links: links(i.text) });
    if (call.action === "ok") continue;
    if (call.action === "hide" && ctx.auto) {
      const table = i.kind === "post" ? "posts" : "comments";
      const patch = i.kind === "post" ? { hidden: true, hidden_reason: `Hidden by the Community Moderator: ${call.reason}` } : { hidden: true };
      await db.from(table).update(patch).eq("id", i.id);
      await db.from("reports").update({ status: "actioned", resolved_at: new Date().toISOString() }).eq(i.kind === "post" ? "post_id" : "comment_id", i.id).eq("status", "open");
      await ctx.flag({ kind: "auto_hidden", target_type: i.kind, target_id: i.id, severity: "low", message: `Hidden: ${call.reason}. "${i.text.slice(0, 160)}" (unhide in Admin → Community if wrong)` });
      hidden++;
    } else if (await ctx.flag({ kind: call.action === "hide" ? "should_hide" : "borderline", target_type: i.kind, target_id: i.id, severity: call.action === "hide" ? "medium" : "low", message: `${call.reason}: "${i.text.slice(0, 200)}"` })) flagged++;
  }
  return { summary: `${items.length} posts and comments checked: ${hidden} hidden, ${flagged} flagged for you.`, actions: hidden };
}
