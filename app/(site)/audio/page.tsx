import Link from "next/link";
import type { Metadata } from "next";
import { getEntitlements, getProfile, requireUser } from "@/lib/auth";
import { hasAzureSpeech } from "@/lib/config";
import { COURSE, type CourseItem } from "@/lib/course";
import { product } from "@/lib/pricing";
import { ngn } from "@/lib/format";
import { decodeEntities, lessonVoice } from "@/lib/tts";
import "./audio.css";

export const metadata: Metadata = { title: "Story Mode audio" };
export const dynamic = "force-dynamic";

const itemLabel = (i: CourseItem) => (i.kind === "boss" ? `Boss ${i.id.slice(1)}` : i.kind === "capstone" ? `Capstone · ${i.id}` : `Lesson ${i.id}`);

export default async function StoryAudio() {
  const user = await requireUser("/audio");
  const [profile, ent] = await Promise.all([getProfile(), getEntitlements(user.id)]);
  const admin = profile?.role === "admin";
  const entitled = ent.story || admin;
  const story = product("story");

  if (!entitled) {
    return (
      <main className="wrap narrow stack story-page">
        <p className="eyebrow">Story Mode</p>
        <h1>Listen to every lesson, anywhere</h1>
        <p className="lede">Story Mode turns each lesson into audio read in natural Nigerian voices: Emeka (Abeo) and Miracle (Ezinne). Download the MP3s and listen on the bus, at the farm or with your screen off.</p>
        <div className="card bold stack">
          <ul className="story-list">
            {(story?.features || []).map(f => <li key={f}>{f}</li>)}
            <li>Code examples and quiz answers stay on screen, so the audio is easy to follow.</li>
          </ul>
          {story && <p><b>{ngn(story.ngn)}</b> <span className="muted">{story.period}{story.accessDays ? ` · ${Math.round(story.accessDays / 30)} months' access` : ""}</span></p>}
          <div className="row"><Link className="btn" href="/checkout/story">{story?.cta || "Add Story Mode"}</Link><Link className="btn alt" href="/learn">Back to the course</Link></div>
        </div>
        <p className="note">The free Listen button on every lesson stays available to everyone. Story Mode adds downloadable audio. Lessons beyond Base Camp also need the full course.</p>
      </main>
    );
  }

  const tracks = new Map<string, CourseItem[]>();
  for (const i of COURSE.items) {
    const k = `Track ${i.track} · ${decodeEntities(i.trackName)}`;
    tracks.set(k, [...(tracks.get(k) || []), i]);
  }

  return (
    <main className="wrap stack story-page">
      <p className="eyebrow">Story Mode</p>
      <h1>Lesson audio</h1>
      <p className="lede">Every lesson read aloud in natural Nigerian voices. Play it here or download the MP3 to listen offline.</p>
      {!hasAzureSpeech() && <div className="alert warn">Lesson audio is being set up. Downloads will work shortly.</div>}
      <p className="note">If a lesson hasn't been prepared yet, the first download can take a minute. Code examples and quiz answers are left out of the audio: you'll find them in the lesson.</p>
      {[...tracks.entries()].map(([name, items]) => (
        <section key={name} className="card stack" aria-labelledby={`t-${items[0].track}`}>
          <h2 id={`t-${items[0].track}`}>{name}</h2>
          <ul className="story-items">
            {items.map(i => {
              const locked = !i.free && !ent.course && !admin;
              const href = `/api/tts/lesson?id=${encodeURIComponent(i.id)}`;
              return (
                <li key={i.id} className="story-item">
                  <div className="story-meta">
                    <span className="pill">{itemLabel(i)}</span>
                    <b>{decodeEntities(i.title)}</b>
                    <span className="muted">Read by {lessonVoice(i.id) === "male" ? "Emeka" : "Miracle"}</span>
                  </div>
                  {locked ? (
                    <span className="story-actions"><span className="pill warn">Needs the course</span><Link className="btn sm alt" href="/pricing">Enrol</Link></span>
                  ) : (
                    <span className="story-actions">
                      <audio controls preload="none" src={`${href}&inline=1`} aria-label={`Play ${itemLabel(i)}`} />
                      <a className="btn sm" href={href} download>Download MP3</a>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </main>
  );
}
