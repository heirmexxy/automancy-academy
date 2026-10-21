import Link from "next/link";
import type { Metadata } from "next";
import "./community.css";
import { requireUser, getProfile, getEntitlements } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NewPostForm } from "./_components/NewPostForm";
import { PostCard } from "./_components/PostCard";
import { ChallengeBanner } from "./_components/ChallengeBanner";
import { ITEM_OPTIONS, TRACKS, currentChallenge, loadFeed, roomLabel } from "./_lib/data";
import { isRoom, TYPE_LABEL } from "./_lib/rules";

export const metadata: Metadata = { title: "Community" };
export const dynamic = "force-dynamic";

const TYPES = ["journal", "help", "win", "challenge_entry", "announcement"] as const;

export default async function Community({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser("/community");
  const sp = await searchParams;
  const room = isRoom(sp.room) ? sp.room : undefined;
  const type = (TYPES as readonly string[]).includes(sp.type || "") ? sp.type : undefined;
  const mine = sp.mine === "1";
  const page = Math.max(0, Math.min(200, parseInt(sp.page || "0", 10) || 0));
  const sb = await createClient();
  const [profile, ent, feed, challenge] = await Promise.all([
    getProfile(), getEntitlements(user.id), loadFeed(sb, user.id, { room, type, mine, page }), currentChallenge(sb)
  ]);
  let entered = false, entries = 0;
  if (challenge) {
    const { data } = await sb.from("posts").select("user_id").eq("challenge_id", challenge.id).eq("type", "challenge_entry");
    entries = (data || []).length;
    entered = (data || []).some(r => r.user_id === user.id);
  }
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { room, type, mine: mine ? "1" : undefined, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return `/community${s ? "?" + s : ""}`;
  };
  const firstName = (profile?.full_name || "").trim().split(/\s+/)[0];

  return (
    <div className="wrap community stack">
      <header className="stack com-head">
        <span className="eyebrow">Community</span>
        <h1>Build in public</h1>
        <p className="lede">Post what you built, ask for help when you&apos;re stuck, and cheer on other learners. Everything here is from real learners on the course.</p>
        <p className="alert">
          {profile?.public_profile && firstName
            ? <>You post as <b>{firstName}</b>{profile.city ? ` from ${profile.city}` : ""}. </>
            : <>You post as <b>A learner</b> because your profile is private. To show your first name and city, switch on your public profile in <Link href="/account">Account</Link>. </>}
          Only first names are shown; emails never are.
        </p>
      </header>

      {challenge && <ChallengeBanner challenge={challenge} entered={entered} entries={entries} />}

      <div className="com-grid">
        <aside className="com-side stack" aria-label="Rooms">
          <nav className="rooms">
            <Link href={qs({ room: undefined, page: undefined })} aria-current={!room ? "page" : undefined}>Everything</Link>
            <Link href={qs({ room: "general", page: undefined })} aria-current={room === "general" ? "page" : undefined}># general</Link>
            {TRACKS.map(t => (
              <Link key={t.room} href={qs({ room: t.room, page: undefined })} aria-current={room === t.room ? "page" : undefined}>
                # {t.name}{!ent.course && t.room !== "0" ? <small> · read only</small> : null}
              </Link>
            ))}
          </nav>
          <p className="note"><Link href="/community/challenges">Weekly challenges</Link> · <Link href="/leaderboard">Leaderboard</Link></p>
        </aside>

        <div className="stack com-main">
          <NewPostForm items={ITEM_OPTIONS} tracks={TRACKS} allRooms={ent.course} room={room} kind={type === "help" || type === "win" ? type : "journal"} />
          {!ent.course && <p className="note">Base Camp learners can post in General and Base Camp. Track rooms open when you <Link href="/pricing">enrol</Link>.</p>}

          <div className="row chips" role="navigation" aria-label="Filter by type">
            <Link className={`chip${!type && !mine ? " on" : ""}`} href={qs({ type: undefined, mine: undefined, page: undefined })}>All posts</Link>
            {TYPES.map(t => <Link key={t} className={`chip${type === t ? " on" : ""}`} href={qs({ type: t, mine: undefined, page: undefined })}>{TYPE_LABEL[t]}</Link>)}
            <Link className={`chip${mine ? " on" : ""}`} href={qs({ mine: "1", type: undefined, page: undefined })}>My posts</Link>
          </div>
          {room && <h2 className="room-title"># {roomLabel(room)}</h2>}

          {feed.posts.length ? feed.posts.map(p => <PostCard key={p.id} post={p} viewerId={user.id} />) : (
            <div className="empty">
              {mine ? "You haven't posted yet. Your first journal entry is a great way to remember what you learned."
                : page > 0 ? "No more posts."
                : "Nothing here yet. Be the first: share what you built this week, or ask the question you're stuck on."}
            </div>
          )}
          <div className="row">
            {page > 0 && <Link className="btn alt sm" href={qs({ page: String(page - 1) })}>Newer</Link>}
            {feed.more && <Link className="btn alt sm" href={qs({ page: String(page + 1) })}>Older posts</Link>}
          </div>
        </div>
      </div>
    </div>
  );
}
