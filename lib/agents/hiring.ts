import "server-only";
import { SITE_URL } from "@/lib/config";
import { esc } from "@/lib/format";
import { sendEmail } from "@/lib/email";
import { emailUser, wrapEmail } from "@/lib/marketplace";
import { topMatches, type HireProfile } from "@/lib/agents/rules";
import type { Ctx, Outcome } from "@/lib/agents/run";

/** Hiring Matchmaker: matches open Hire talent requests with graduate profiles. */
export async function run(ctx: Ctx): Promise<Outcome> {
  const { db } = ctx;
  const { data: reqs } = await db.from("hire_requests").select("id, employer_name, company, email, role, message, profile_user_id").eq("status", "open").order("created_at").limit(30);
  if (!reqs?.length) return { summary: "No open hiring requests.", actions: 0 };
  const { data: profs } = await db.from("hire_profiles").select("user_id, display_name, headline, bio, skills, tools, availability, city").eq("visible", true).eq("hidden_by_admin", false).limit(2000);
  const profiles = (profs || []) as HireProfile[];
  let introduced = 0, suggested = 0, none = 0;
  for (const r of reqs) {
    const want = `${r.role || ""} ${r.message || ""}`;
    const picked = r.profile_user_id ? profiles.filter(p => p.user_id === r.profile_user_id).map(p => ({ p, score: 99 })) : topMatches(want, profiles);
    if (!picked.length) {
      none++;
      await ctx.flag({ kind: "hire_no_match", target_type: "hire_request", target_id: String(r.id), severity: "low", message: `No graduate profile matches "${(r.role || r.message || "").slice(0, 80)}" from ${r.company || r.employer_name}. Reply to them yourself.` });
      continue;
    }
    const names = picked.map(x => `${x.p.display_name} (${x.p.headline})`).join("; ");
    if (!ctx.auto) {
      suggested++;
      await ctx.flag({ kind: "hire_matches", target_type: "hire_request", target_id: String(r.id), severity: "low", message: `Matches for ${r.company || r.employer_name}: ${names}.` });
      continue;
    }
    const list = picked.map(x => `<li><a href="${esc(`${SITE_URL}/hire/${x.p.user_id}`)}">${esc(x.p.display_name)}</a>: ${esc(x.p.headline)}${x.p.city ? ` · ${esc(x.p.city)}` : ""}</li>`).join("");
    await sendEmail(String(r.email), `Automancy graduates for ${r.role || "your role"}`, wrapEmail(
      `<p>Hi ${esc(String(r.employer_name).split(/\s+/)[0])},</p><p>Thanks for your request${r.role ? ` for <b>${esc(String(r.role))}</b>` : ""}. These certified Automancy graduates match what you described:</p><ul>${list}</ul>
       <p>We've let each of them know about your request and shared your name, company and email so they can contact you. Every certificate can be checked at ${esc(SITE_URL)}/verify.</p><p>Automancy Academy</p>`));
    for (const x of picked) await emailUser(x.p.user_id, `An employer is interested in your profile`,
      `<p>${esc(String(r.employer_name))}${r.company ? ` from <b>${esc(String(r.company))}</b>` : ""} is looking for${r.role ? ` <b>${esc(String(r.role))}</b>` : " automation help"}, and your Hire talent profile is a match.</p>
       ${r.message ? `<blockquote>${esc(String(r.message).slice(0, 800))}</blockquote>` : ""}<p>If you're interested, email them at <a href="mailto:${esc(String(r.email))}">${esc(String(r.email))}</a>. Terms are agreed directly between you.</p>`);
    await db.from("hire_requests").update({ status: "forwarded" }).eq("id", r.id).eq("status", "open");
    introduced++;
  }
  return { summary: `${reqs.length} requests: ${introduced} introduced, ${suggested} matches suggested, ${none} with no match.`, actions: introduced };
}
