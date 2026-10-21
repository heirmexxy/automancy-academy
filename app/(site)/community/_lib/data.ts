import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { COURSE, itemById } from "@/lib/course";
import { getEntitlements } from "@/lib/auth";
import { buildPost, dbMessage, decode, FREE_ROOMS, LIMITS, type PostType, type Room } from "./rules";

export const ITEM_SET = new Set(COURSE.items.map(i => i.id));

export const TRACKS = Array.from(new Map(COURSE.items.map(i => [i.track, decode(i.trackName)])).entries())
  .sort((a, b) => a[0] - b[0]).map(([track, name]) => ({ room: String(track) as Room, track, name }));

export const roomLabel = (room: string) => room === "general" ? "General" : `Track ${room} · ${TRACKS.find(t => t.room === room)?.name || ""}`;

export function itemLabel(id: string | null | undefined) {
  if (!id) return "";
  const it = itemById(id);
  if (!it) return id;
  const prefix = it.kind === "boss" ? `Boss ${id.slice(1)}` : it.kind === "capstone" ? `Capstone ${id}` : `Lesson ${id}`;
  return `${prefix} · ${decode(it.title)}`;
}

export const ITEM_OPTIONS = COURSE.items.map(i => ({ id: i.id, label: itemLabel(i.id), track: i.track, free: i.free }));

export type Member = { name: string; city: string | null; staff: boolean };
export type PostRow = {
  id: string; user_id: string; type: PostType; room: Room; item_id: string | null; title: string | null; body: string;
  parts: Record<string, string> | null; link: string | null; challenge_id: string | null; hidden: boolean; hidden_reason: string | null;
  pinned: boolean; created_at: string;
};
export type CommentRow = { id: string; post_id: string; user_id: string; body: string; hidden: boolean; created_at: string };
export type FeedPost = PostRow & { author: Member; claps: number; clapped: boolean; comments: (CommentRow & { author: Member })[]; mine: boolean };

const ANON: Member = { name: "A learner", city: null, staff: false };

/** Display names via the community_members view (first name only for public profiles, "A learner" otherwise). */
export async function memberNames(sb: SupabaseClient, ids: string[]) {
  const uniq = [...new Set(ids)].filter(Boolean);
  const map = new Map<string, Member>();
  if (!uniq.length) return map;
  const { data } = await sb.from("community_members").select("id, name, city, staff").in("id", uniq);
  for (const r of data || []) map.set(r.id as string, { name: r.name as string, city: (r.city as string) || null, staff: !!r.staff });
  return map;
}

/** Adds authors, clap counts and comments to a list of posts. */
export async function hydrate(sb: SupabaseClient, posts: PostRow[], viewerId: string): Promise<FeedPost[]> {
  if (!posts.length) return [];
  const ids = posts.map(p => p.id);
  const [{ data: claps }, { data: comments }] = await Promise.all([
    sb.from("claps").select("post_id, user_id").in("post_id", ids),
    sb.from("comments").select("id, post_id, user_id, body, hidden, created_at").in("post_id", ids).order("created_at", { ascending: true }).limit(500)
  ]);
  const names = await memberNames(sb, [...posts.map(p => p.user_id), ...(comments || []).map(c => c.user_id as string)]);
  return posts.map(p => {
    const pc = (claps || []).filter(c => c.post_id === p.id);
    return {
      ...p,
      author: names.get(p.user_id) || ANON,
      mine: p.user_id === viewerId,
      claps: pc.length,
      clapped: pc.some(c => c.user_id === viewerId),
      comments: ((comments || []) as CommentRow[]).filter(c => c.post_id === p.id).map(c => ({ ...c, author: names.get(c.user_id) || ANON }))
    };
  });
}

export const PAGE_SIZE = 20;
const POST_COLS = "id, user_id, type, room, item_id, title, body, parts, link, challenge_id, hidden, hidden_reason, pinned, created_at";

export async function loadFeed(sb: SupabaseClient, viewerId: string, f: { room?: string; type?: string; mine?: boolean; page: number }) {
  let q = sb.from("posts").select(POST_COLS).order("created_at", { ascending: false }).range(f.page * PAGE_SIZE, f.page * PAGE_SIZE + PAGE_SIZE);
  if (f.room) q = q.eq("room", f.room);
  if (f.type) q = q.eq("type", f.type);
  if (f.mine) q = q.eq("user_id", viewerId);
  const { data } = await q;
  const rows = (data || []) as PostRow[];
  const more = rows.length > PAGE_SIZE;
  let posts = rows.slice(0, PAGE_SIZE);
  // Pinned announcements sit on top of the first unfiltered page.
  if (f.page === 0 && !f.type && !f.mine) {
    let pq = sb.from("posts").select(POST_COLS).eq("pinned", true).eq("hidden", false).order("created_at", { ascending: false }).limit(3);
    if (f.room) pq = pq.in("room", [f.room, "general"]);
    const { data: pinned } = await pq;
    const pins = (pinned || []) as PostRow[];
    posts = [...pins, ...posts.filter(p => !pins.some(x => x.id === p.id))];
  }
  return { posts: await hydrate(sb, posts, viewerId), more };
}

export async function loadPost(sb: SupabaseClient, viewerId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await sb.from("posts").select(POST_COLS).eq("id", id).maybeSingle();
  if (!data) return null;
  return (await hydrate(sb, [data as PostRow], viewerId))[0];
}

export type Challenge = {
  id: string; title: string; brief: string; prize: string | null; starts_at: string; ends_at: string;
  status: "draft" | "open" | "judging" | "closed"; winner_post_id: string | null; created_at: string;
};
const CH_COLS = "id, title, brief, prize, starts_at, ends_at, status, winner_post_id, created_at";

/** This week's challenge: the open one closing soonest (falls back to one being judged). */
export async function currentChallenge(sb: SupabaseClient): Promise<Challenge | null> {
  const { data } = await sb.from("challenges").select(CH_COLS).in("status", ["open", "judging"]).order("ends_at", { ascending: true }).limit(5);
  const list = (data || []) as Challenge[];
  const now = Date.now();
  return list.find(c => c.status === "open" && new Date(c.ends_at).getTime() > now)
    || list.find(c => c.status === "judging") || list.find(c => c.status === "open") || null;
}

export async function getChallenge(sb: SupabaseClient, id: string): Promise<Challenge | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await sb.from("challenges").select(CH_COLS).eq("id", id).maybeSingle();
  return (data as Challenge) || null;
}

export async function pastChallenges(sb: SupabaseClient, limit = 12): Promise<Challenge[]> {
  const { data } = await sb.from("challenges").select(CH_COLS).eq("status", "closed").order("ends_at", { ascending: false }).limit(limit);
  return (data || []) as Challenge[];
}

export const acceptingEntries = (c: Challenge) => c.status === "open" && Date.now() >= new Date(c.starts_at).getTime() && Date.now() <= new Date(c.ends_at).getTime();

/** Entries with vote counts and the viewer's vote. */
export async function challengeEntries(sb: SupabaseClient, challengeId: string, viewerId: string) {
  const { data } = await sb.from("posts").select(POST_COLS).eq("challenge_id", challengeId).eq("type", "challenge_entry").order("created_at", { ascending: true }).limit(300);
  const posts = await hydrate(sb, (data || []) as PostRow[], viewerId);
  const { data: votes } = await sb.from("votes").select("post_id, user_id").eq("challenge_id", challengeId);
  const myVote = (votes || []).find(v => v.user_id === viewerId)?.post_id as string | undefined;
  const entries = posts.map(p => ({ ...p, votes: (votes || []).filter(v => v.post_id === p.id).length }))
    .sort((a, b) => b.votes - a.votes || a.created_at.localeCompare(b.created_at));
  return { entries, myVote: myVote || null };
}

export const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }) + " WAT";

/**
 * Creates a learner post (journal, help, win or challenge entry) as the signed-in user.
 * Used by the community server action and by POST /api/community/posts. RLS and DB triggers enforce the same rules again.
 */
export async function createPostCore(sb: SupabaseClient, userId: string, raw: Record<string, unknown>): Promise<{ ok: true; id: string } | { ok: false; error: string; status: number }> {
  const built = buildPost(raw, ITEM_SET);
  if (!built.ok) return { ok: false, error: built.error, status: 400 };
  const post = built.post;
  if (!FREE_ROOMS.includes(post.room) && !(await getEntitlements(userId)).course) {
    return { ok: false, error: "Track rooms beyond Base Camp open when you enrol. Post in General or Base Camp for now.", status: 403 };
  }
  const since = new Date(Date.now() - 864e5).toISOString();
  const { count } = await sb.from("posts").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since);
  if ((count || 0) >= LIMITS.postsPerDay) return { ok: false, error: `You've posted ${LIMITS.postsPerDay} times in the last 24 hours. Try again tomorrow.`, status: 429 };
  const { data, error } = await sb.from("posts").insert({
    user_id: userId, type: post.type, room: post.room, item_id: post.itemId, title: post.title, body: post.body,
    parts: post.parts, link: post.link, challenge_id: post.challengeId
  }).select("id").single();
  if (error || !data) {
    const msg = dbMessage(error?.message, "Couldn't post that. Try again.");
    return { ok: false, error: /duplicate/.test(error?.message || "") && post.type === "challenge_entry" ? "You've already entered this challenge." : msg, status: /RATE_LIMIT/.test(error?.message || "") ? 429 : 400 };
  }
  return { ok: true, id: data.id as string };
}
