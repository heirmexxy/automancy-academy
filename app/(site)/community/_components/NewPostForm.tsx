"use client";
import { useState } from "react";
import { createPost } from "@/lib/actions/community";
import { ActionForm } from "./ActionForm";

type Opt = { id: string; label: string; track: number; free: boolean };
type Track = { room: string; name: string };
type Kind = "journal" | "help" | "win";

const KINDS: { id: Kind; label: string; hint: string }[] = [
  { id: "journal", label: "Journal", hint: "Review, reflect, recommend: what you built and what you learned." },
  { id: "help", label: "Ask for help", hint: "Stuck? Say what you tried, what you expected and what happened instead." },
  { id: "win", label: "Share a win", hint: "A client said yes, a workflow saved hours, a boss project passed." }
];

export function NewPostForm({ items, tracks, allRooms, room, kind = "journal" }: {
  items: Opt[]; tracks: Track[]; allRooms: boolean; room?: string; kind?: Kind;
}) {
  const [k, setK] = useState<Kind>(kind);
  const lessonSelect = (
    <label className="fld">Lesson (optional)
      <select name="itemId" defaultValue="">
        <option value="">Not about a specific lesson</option>
        {items.map(o => <option key={o.id} value={o.id} disabled={!allRooms && !o.free}>{o.label}</option>)}
      </select>
    </label>
  );
  return (
    <div className="card np">
      <div className="np-tabs" role="tablist" aria-label="What are you posting?">
        {KINDS.map(x => (
          <button key={x.id} type="button" role="tab" aria-selected={k === x.id} className={k === x.id ? "on" : ""} onClick={() => setK(x.id)}>{x.label}</button>
        ))}
      </div>
      <p className="note">{KINDS.find(x => x.id === k)!.hint}</p>
      <ActionForm action={createPost} reset className="stack" label="New post">
        <input type="hidden" name="type" value={k} />
        {k === "journal" && <>
          <div className="grid2">
            {lessonSelect}
            <label className="fld">Time it saves (optional)<input name="saved" maxLength={60} placeholder="e.g. 3 hours a week" /></label>
          </div>
          <label className="fld">Review: what did you build?<textarea name="review" required maxLength={1200} placeholder="What it does, which tools, what happened when you tested it" /></label>
          <div className="grid2">
            <label className="fld">Reflect: what was hard, what did you learn?<textarea name="reflect" maxLength={800} placeholder="The bug that took longest, the idea that clicked" /></label>
            <label className="fld">Recommend: a tip for the next learner<textarea name="recommend" maxLength={600} placeholder="Something you wish you'd known" /></label>
          </div>
        </>}
        {k === "help" && <>
          <label className="fld">What are you stuck on?<input name="title" required maxLength={140} placeholder="e.g. Make HTTP module returns 401 from Paystack" /></label>
          {lessonSelect}
          <label className="fld">Details<textarea name="body" required maxLength={4000} placeholder="What you tried, what you expected, what happened instead (paste the error message, never your API keys)" /></label>
        </>}
        {k === "win" && <>
          <label className="fld">Headline<input name="title" required maxLength={140} placeholder="e.g. First client signed: setup plus monthly retainer" /></label>
          <label className="fld">Tell the story<textarea name="body" required maxLength={4000} placeholder="What happened, what you built, what you'd tell someone starting out" /></label>
        </>}
        <div className="grid2">
          <label className="fld">Link (optional)<input name="link" type="url" maxLength={500} placeholder="https:// screenshot, Loom or workflow export" /></label>
          <label className="fld">Room
            <select name="room" defaultValue={room || "auto"}>
              <option value="auto">Match the lesson (or General)</option>
              <option value="general">General</option>
              {tracks.map(t => <option key={t.room} value={t.room} disabled={!allRooms && t.room !== "0"}>Track {t.room} · {t.name}</option>)}
            </select>
          </label>
        </div>
        <p className="note">Never post API keys, passwords or customers&apos; phone numbers. Use placeholders like &lt;API_KEY&gt;.</p>
        <div className="row"><button className="btn" type="submit">Post</button></div>
      </ActionForm>
    </div>
  );
}
