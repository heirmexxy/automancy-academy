"use client";
import { useRef, useState } from "react";
import { generateLessonAudio, type GenResult } from "./actions";

type Item = { id: string; label: string };

/** Runs the server action lesson by lesson, so each request stays short and progress is visible. */
export function GenerateAll({ items, disabled }: { items: Item[]; disabled?: boolean }) {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [log, setLog] = useState<GenResult[]>([]);
  const stopRef = useRef(false);

  async function run() {
    stopRef.current = false; setRunning(true); setDone(0); setLog([]);
    for (let i = 0; i < items.length; i++) {
      if (stopRef.current) break;
      let r: GenResult;
      try { r = await generateLessonAudio(items[i].id); }
      catch (e) { r = { id: items[i].id, ok: false, error: e instanceof Error ? e.message : "Request failed" }; }
      setLog(l => [r, ...l]); setDone(i + 1);
    }
    setRunning(false);
  }

  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const failed = log.filter(r => !r.ok).length;
  const fresh = log.filter(r => r.ok && !r.cached).reduce((s, r) => s + (r.chars || 0), 0);

  return (
    <div className="stack">
      <div className="row">
        <button className="btn" type="button" onClick={run} disabled={running || disabled}>{running ? "Generating…" : "Generate all lesson audio"}</button>
        {running && <button className="btn alt" type="button" onClick={() => { stopRef.current = true; }}>Stop after this lesson</button>}
      </div>
      {(running || log.length > 0) && (
        <>
          <div className="gen-bar" role="progressbar" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={done} aria-label="Lesson audio progress"><i style={{ width: `${pct}%` }} /></div>
          <p className="note" aria-live="polite">{done} of {items.length} processed · {failed} failed · {fresh.toLocaleString()} new characters synthesised</p>
          <ul className="gen-log">
            {log.map(r => (
              <li key={r.id}>{r.ok ? (r.cached ? "✓ cached " : "✓ generated ") : "✗ "}{items.find(i => i.id === r.id)?.label || r.id}{r.ok ? ` · ${(r.chars || 0).toLocaleString()} chars` : ` · ${r.error}`}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
