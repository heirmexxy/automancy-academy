"use server";
import { createHash } from "crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile, requireAdmin } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { esc } from "@/lib/format";
import { SITE_URL, SUPPORT_EMAIL } from "@/lib/config";
import { createPostCore, ITEM_SET } from "@/app/(site)/community/_lib/data";
import {
  AVAILABILITY, LIMITS, buildPost, clean, dbMessage, httpsUrl, isEmail, isRoom, list, safePath, sensitive, withParam
} from "@/app/(site)/community/_lib/rules";

type Result = { ok: boolean; msg: string; at?: number } | null;
const ok = (msg: string): Result => ({ ok: true, msg, at: Date.now() });
const fail = (msg: string): Result => ({ ok: false, msg, at: Date.now() });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (v: FormDataEntryValue | null) => { const s = String(v || ""); return UUID.test(s) ? s : null; };

async function me() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  return { sb, user };
}
function refresh() {
  revalidatePath("/community", "layout");
  revalidatePath("/leaderboard");
}

/* ───────────────────────── Learner actions (used with useActionState) ───────────────────────── */

export async function createPost(_prev: Result, fd: FormData): Promise<Result> {
  const { sb, user } = await me();
  if (!user) return fail("Log in to post.");
  const raw: Record<string, unknown> = {};
  for (const k of ["type", "room", "itemId", "title", "body", "review", "reflect", "recommend", "saved", "link", "challengeId"]) raw[k] = fd.get(k);
  if (raw.room === "auto") delete raw.room;
  const r = await createPostCore(sb, user.id, raw);
  if (!r.ok) return fail(r.error);
  refresh();
  return ok(raw.type === "challenge_entry" ? "Entry submitted. Good luck!" : "Posted.");
}

export async function deletePost(_prev: Result, fd: FormData): Promise<Result> {
  const { sb, user } = await me();
  const id = uuid(fd.get("postId"));
  if (!user || !id) return fail("Not allowed.");
  const { error } = await sb.from("posts").delete().eq("id", id).eq("user_id", user.id);
  if (error) return fail("Couldn't delete that post.");
  refresh();
  return ok("Post deleted.");
}

export async function toggleClap(_prev: Result, fd: FormData): Promise<Result> {
  const { sb, user } = await me();
  const id = uuid(fd.get("postId"));
  if (!user || !id) return fail("Log in to applaud.");
  const { data } = await sb.from("claps").select("post_id").eq("post_id", id).eq("user_id", user.id).maybeSingle();
  const { error } = data
    ? await sb.from("claps").delete().eq("post_id", id).eq("user_id", user.id)
    : await sb.from("claps").insert({ post_id: id, user_id: user.id });
  if (error) return fail("Couldn't save that.");
  refresh();
  return ok(data ? "" : "Applauded");
}

export async function addComment(_prev: Result, fd: FormData): Promise<Result> {
  const { sb, user } = await me();
  const id = uuid(fd.get("postId"));
  if (!user || !id) return fail("Log in to reply.");
  const body = clean(fd.get("body"), LIMITS.comment + 1);
  if (!body) return fail("Write a reply first.");
  if (body.length > LIMITS.comment) return fail(`Keep replies under ${LIMITS.comment} characters.`);
  const s = sensitive(body);
  if (s) return fail(s);
  const since = new Date(Date.now() - 864e5).toISOString();
  const { count } = await sb.from("comments").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since);
  if ((count || 0) >= LIMITS.commentsPerDay) return fail(`You've replied ${LIMITS.commentsPerDay} times today. Try again tomorrow.`);
  const { error } = await sb.from("comments").insert({ post_id: id, user_id: user.id, body });
  if (error) return fail(dbMessage(error.message, "Couldn't post your reply."));
  refresh();
  return ok("Reply posted.");
}

export async function deleteComment(_prev: Result, fd: FormData): Promise<Result> {
  const { sb, user } = await me();
  const id = uuid(fd.get("commentId"));
  if (!user || !id) return fail("Not allowed.");
  const { error } = await sb.from("comments").delete().eq("id", id).eq("user_id", user.id);
  if (error) return fail("Couldn't delete that reply.");
  refresh();
  return ok("Reply deleted.");
}

export async function reportContent(_prev: Result, fd: FormData): Promise<Result> {
  const { sb, user } = await me();
  if (!user) return fail("Log in to report.");
  const postId = uuid(fd.get("postId")), commentId = uuid(fd.get("commentId"));
  if (!postId === !commentId) return fail("Nothing to report.");
  const reason = clean(fd.get("reason"), LIMITS.reason);
  if (reason.length < 3) return fail("Tell us briefly what's wrong.");
  const { error } = await sb.from("reports").insert({ reporter_id: user.id, post_id: commentId ? null : postId, comment_id: commentId, reason });
  if (error && !/duplicate/.test(error.message)) return fail("Couldn't send the report.");
  refresh();
  return ok("Thanks. A moderator will look at it.");
}

export async function castVote(_prev: Result, fd: FormData): Promise<Result> {
  const { sb, user } = await me();
  const challengeId = uuid(fd.get("challengeId")), postId = uuid(fd.get("postId"));
  if (!user || !challengeId || !postId) return fail("Log in to vote.");
  const { error } = await sb.from("votes").insert({ challenge_id: challengeId, user_id: user.id, post_id: postId });
  if (error) return fail(/duplicate/.test(error.message) ? "You've already voted in this challenge." : dbMessage(error.message, "Couldn't save your vote."));
  refresh();
  return ok("Vote counted.");
}

/* ───────────────────────── Hire talent ───────────────────────── */

export async function saveHireProfile(_prev: Result, fd: FormData): Promise<Result> {
  const { sb, user } = await me();
  if (!user) return fail("Log in first.");
  const { data: cert } = await sb.rpc("my_certificate");
  const c = Array.isArray(cert) ? cert[0] : cert;
  if (!c?.id) return fail("A Hire talent profile needs your Automancy certificate first.");
  const profile = await getProfile();
  const headline = clean(fd.get("headline"), 120);
  if (headline.length < 3) return fail("Add a one-line headline, e.g. “n8n and WhatsApp automation for small businesses”.");
  const bio = clean(fd.get("bio"), 2000);
  const city = clean(fd.get("city"), 60) || null;
  const rate_note = clean(fd.get("rate_note"), 80) || null;
  const availability = String(fd.get("availability") || "");
  if (!(availability in AVAILABILITY)) return fail("Choose your availability.");
  const links: string[] = [];
  for (const l of list(fd.get("portfolio_links"), 5, 500)) {
    const u = httpsUrl(l);
    if (!u) return fail(`Portfolio links must start with https:// (check “${l.slice(0, 40)}”).`);
    links.push(u);
  }
  const s = sensitive([headline, bio, rate_note].join(" "));
  if (s) return fail(s);
  const row = {
    user_id: user.id,
    display_name: clean(c.name_on_certificate || profile?.full_name || "Automancy graduate", 80),
    cert_id: String(c.id),
    headline, bio: bio || null,
    skills: list(fd.get("skills"), 12), tools: list(fd.get("tools"), 12), portfolio_links: links,
    city, availability, rate_note, visible: fd.get("visible") === "on"
  };
  const { error } = await sb.from("hire_profiles").upsert(row, { onConflict: "user_id" });
  if (error) return fail(dbMessage(error.message, "Couldn't save your profile."));
  revalidatePath("/hire", "layout");
  return ok(row.visible ? "Saved. Your profile is live on Hire talent." : "Saved. Your profile is hidden until you tick “Show my profile”.");
}

async function ipHash() {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") || h.get("x-real-ip") || "").split(",")[0].trim() || "unknown";
  return createHash("sha256").update(ip + (process.env.SUPABASE_SERVICE_ROLE_KEY || "").slice(-12)).digest("hex").slice(0, 32);
}

/** Employer asks to be introduced to a graduate. Public form: honeypot + time trap + per-IP/email limits. */
export async function requestIntro(_prev: Result, fd: FormData): Promise<Result> {
  if (clean(fd.get("website"), 200)) return ok("Thanks. We'll be in touch."); // honeypot: pretend success
  const shownAt = Number(fd.get("t") || 0);
  if (!shownAt || Date.now() - shownAt < 3000) return fail("That was quick. Please check the form and send it again.");
  const profileUserId = uuid(fd.get("profileUserId"));
  const employer_name = clean(fd.get("employer_name"), 120);
  const company = clean(fd.get("company"), 120) || null;
  const email = clean(fd.get("email"), 200).toLowerCase();
  const role = clean(fd.get("role"), 160) || null;
  const message = clean(fd.get("message"), 2000) || null;
  if (employer_name.length < 2) return fail("Add your name.");
  if (!isEmail(email)) return fail("Add a valid work email so we can reply.");
  if (!role && !message) return fail("Tell us about the role or project.");

  const sb = await createClient();
  let graduate: { display_name: string; headline: string } | null = null;
  if (profileUserId) {
    const { data } = await sb.from("hire_profiles").select("display_name, headline").eq("user_id", profileUserId).maybeSingle();
    if (!data) return fail("That profile isn't available any more.");
    graduate = data as { display_name: string; headline: string };
  }
  const admin = createAdminClient();
  const ip_hash = await ipHash();
  const since = new Date(Date.now() - 864e5).toISOString();
  const [{ count: byIp }, { count: byEmail }] = await Promise.all([
    admin.from("hire_requests").select("id", { count: "exact", head: true }).eq("ip_hash", ip_hash).gte("created_at", since),
    admin.from("hire_requests").select("id", { count: "exact", head: true }).eq("email", email).gte("created_at", since)
  ]);
  if ((byIp || 0) >= LIMITS.introsPerDay || (byEmail || 0) >= LIMITS.introsPerDay) return fail("You've sent several requests today. Email us instead and we'll help directly.");
  const { error } = await admin.from("hire_requests").insert({ profile_user_id: profileUserId, employer_name, company, email, role, message, ip_hash });
  if (error) return fail("Couldn't send your request. Try again, or email us.");

  const rows: [string, string | null][] = [
    ["Graduate", graduate ? `${graduate.display_name} (${graduate.headline}) · ${SITE_URL}/hire/${profileUserId}` : "General request (no specific graduate)"],
    ["Employer", employer_name], ["Company", company], ["Email", email], ["Role", role], ["Message", message]
  ];
  await sendEmail(SUPPORT_EMAIL, `Hire talent request: ${employer_name}${company ? ` (${company})` : ""}`,
    `<h2>New Hire talent request</h2><table>${rows.map(([k, v]) => `<tr><th align="left" valign="top">${esc(k)}</th><td>${esc(v || "–").replace(/\n/g, "<br>")}</td></tr>`).join("")}</table>
     <p>Manage it in <a href="${SITE_URL}/admin/hire">Admin → Hire talent</a>.</p>`).catch(() => null);
  return ok("Thanks. We've received your request and will reply by email, usually within two working days.");
}

/* ───────────────────────── Admin actions (plain form actions; each checks requireAdmin) ───────────────────────── */

async function audit(actor: string, action: string, target: string, detail?: Record<string, unknown>) {
  await createAdminClient().from("audit_log").insert({ actor, action, target, detail: detail || null });
}
function back(fd: FormData, fallback: string, msg: string): never {
  redirect(withParam(safePath(fd.get("back"), fallback), "msg", msg));
}

export async function adminModeratePost(fd: FormData) {
  const admin = await requireAdmin();
  const id = uuid(fd.get("postId"));
  const op = String(fd.get("op") || "");
  if (!id) back(fd, "/admin/community", "Missing post");
  const updates: Record<string, Record<string, unknown>> = {
    hide: { hidden: true, hidden_reason: clean(fd.get("reason"), 200) || "Hidden by a moderator" },
    unhide: { hidden: false, hidden_reason: null },
    pin: { pinned: true },
    unpin: { pinned: false }
  };
  const done: Record<string, string> = { hide: "Post hidden", unhide: "Post visible again", pin: "Post pinned", unpin: "Post unpinned", delete: "Post deleted" };
  if (!done[op]) back(fd, "/admin/community", "Unknown action");
  const sb = await createClient();
  const { error } = op === "delete" ? await sb.from("posts").delete().eq("id", id) : await sb.from("posts").update(updates[op]).eq("id", id);
  await audit(admin.id, `community.post.${op}`, id);
  refresh();
  back(fd, "/admin/community", error ? `Failed: ${error.message}` : done[op]);
}

export async function adminModerateComment(fd: FormData) {
  const admin = await requireAdmin();
  const id = uuid(fd.get("commentId"));
  const op = String(fd.get("op") || "");
  if (!id) back(fd, "/admin/community", "Missing comment");
  const sb = await createClient();
  const { error } = op === "delete" ? await sb.from("comments").delete().eq("id", id) : await sb.from("comments").update({ hidden: op === "hide" }).eq("id", id);
  await audit(admin.id, `community.comment.${op}`, id);
  refresh();
  back(fd, "/admin/community", error ? `Failed: ${error.message}` : "Comment updated");
}

export async function adminResolveReport(fd: FormData) {
  const admin = await requireAdmin();
  const id = uuid(fd.get("reportId"));
  const status = String(fd.get("status") || "");
  if (!id || !["actioned", "dismissed"].includes(status)) back(fd, "/admin/community", "Invalid report action");
  const sb = await createClient();
  const { data: rep } = await sb.from("reports").select("post_id, comment_id").eq("id", id).maybeSingle();
  if (rep && status === "actioned") {
    if (rep.post_id) await sb.from("posts").update({ hidden: true, hidden_reason: "Hidden after a report" }).eq("id", rep.post_id);
    if (rep.comment_id) await sb.from("comments").update({ hidden: true }).eq("id", rep.comment_id);
  }
  // Resolve every open report about the same content at once.
  let q = sb.from("reports").update({ status, resolved_by: admin.id, resolved_at: new Date().toISOString() }).eq("status", "open");
  q = rep?.post_id ? q.eq("post_id", rep.post_id) : rep?.comment_id ? q.eq("comment_id", rep.comment_id) : q.eq("id", id);
  const { error } = await q;
  await audit(admin.id, `community.report.${status}`, id, { post_id: rep?.post_id, comment_id: rep?.comment_id });
  refresh();
  back(fd, "/admin/community", error ? `Failed: ${error.message}` : status === "actioned" ? "Content hidden and report closed" : "Report dismissed");
}

export async function adminPostAnnouncement(fd: FormData) {
  const admin = await requireAdmin();
  const room = String(fd.get("room") || "general");
  const built = buildPost({ type: "announcement", room: isRoom(room) ? room : "general", title: fd.get("title"), body: fd.get("body"), link: fd.get("link") }, ITEM_SET, { allowAnnouncement: true });
  if (!built.ok) back(fd, "/admin/community", built.error);
  const p = built.post;
  const sb = await createClient();
  const { data, error } = await sb.from("posts").insert({
    user_id: admin.id, type: "announcement", room: p.room, title: p.title, body: p.body, link: p.link, pinned: fd.get("pinned") === "on"
  }).select("id").single();
  if (data) await audit(admin.id, "community.announcement", data.id as string);
  refresh();
  back(fd, "/admin/community", error ? `Failed: ${error.message}` : "Announcement posted");
}

export async function adminSaveChallenge(fd: FormData) {
  const admin = await requireAdmin();
  const id = uuid(fd.get("challengeId"));
  const title = clean(fd.get("title"), 140);
  const brief = clean(fd.get("brief"), 8000);
  const prize = clean(fd.get("prize"), 400) || null;
  const status = String(fd.get("status") || "draft");
  // datetime-local inputs are entered in WAT (UTC+1, no daylight saving)
  const toIso = (v: FormDataEntryValue | null) => { const s = String(v || ""); const d = new Date(/Z|[+-]\d\d:\d\d$/.test(s) ? s : s + ":00+01:00"); return isNaN(d.getTime()) ? null : d.toISOString(); };
  const starts_at = toIso(fd.get("starts_at")), ends_at = toIso(fd.get("ends_at"));
  const fallback = id ? `/admin/community/challenges/${id}` : "/admin/community/challenges";
  if (title.length < 3 || !brief) back(fd, fallback, "Add a title and a brief");
  if (!["draft", "open", "judging", "closed"].includes(status)) back(fd, fallback, "Invalid status");
  if (!starts_at || !ends_at || ends_at <= starts_at) back(fd, fallback, "Check the start and end times (end must be after start)");
  const sb = await createClient();
  const row = { title, brief, prize, status, starts_at, ends_at, updated_at: new Date().toISOString() };
  const { data, error } = id
    ? await sb.from("challenges").update(row).eq("id", id).select("id").single()
    : await sb.from("challenges").insert({ ...row, created_by: admin.id }).select("id").single();
  if (error || !data) back(fd, fallback, `Failed: ${error?.message || "not saved"}`);
  await audit(admin.id, id ? "challenge.update" : "challenge.create", data.id as string, { status });
  refresh();
  redirect(withParam(`/admin/community/challenges/${data.id}`, "msg", "Challenge saved"));
}

export async function adminPickWinner(fd: FormData) {
  const admin = await requireAdmin();
  const challengeId = uuid(fd.get("challengeId")), postId = uuid(fd.get("postId"));
  const path = `/admin/community/challenges/${challengeId}`;
  if (!challengeId || !postId) back(fd, "/admin/community/challenges", "Missing challenge or entry");
  const sb = await createClient();
  const { data: post } = await sb.from("posts").select("id, challenge_id, type").eq("id", postId).maybeSingle();
  if (!post || post.challenge_id !== challengeId || post.type !== "challenge_entry") back(fd, path, "That entry isn't part of this challenge");
  const { error } = await sb.from("challenges").update({ winner_post_id: postId, status: "closed", updated_at: new Date().toISOString() }).eq("id", challengeId);
  await audit(admin.id, "challenge.winner", challengeId!, { post_id: postId });
  refresh();
  back(fd, path, error ? `Failed: ${error.message}` : "Winner saved and challenge closed");
}

export async function adminHireRequest(fd: FormData) {
  const admin = await requireAdmin();
  const id = uuid(fd.get("requestId"));
  const status = String(fd.get("status") || "");
  if (!id || !["open", "forwarded", "closed"].includes(status)) back(fd, "/admin/hire", "Invalid action");
  const sb = await createClient();
  const { error } = await sb.from("hire_requests").update({ status, handled_by: admin.id }).eq("id", id);
  await audit(admin.id, `hire.request.${status}`, id);
  back(fd, "/admin/hire", error ? `Failed: ${error.message}` : `Marked ${status}`);
}

export async function adminHireProfile(fd: FormData) {
  const admin = await requireAdmin();
  const userId = uuid(fd.get("userId"));
  const op = String(fd.get("op") || "");
  if (!userId || !["hide", "unhide"].includes(op)) back(fd, "/admin/hire", "Invalid action");
  const sb = await createClient();
  const { error } = await sb.from("hire_profiles").update({ hidden_by_admin: op === "hide" }).eq("user_id", userId);
  await audit(admin.id, `hire.profile.${op}`, userId);
  revalidatePath("/hire", "layout");
  back(fd, "/admin/hire", error ? `Failed: ${error.message}` : op === "hide" ? "Profile hidden from the directory" : "Profile visible again");
}
