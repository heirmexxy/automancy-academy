"use client";
import { useState } from "react";

type Q = { q: string; options: string[]; answer: number };

/** Builds the quiz JSON for the lesson form (hidden input "quiz"). The server validates it again. */
export function QuizEditor({ initial }: { initial: Q[] }) {
  const [qs, setQs] = useState<Q[]>(initial.length ? initial : [{ q: "", options: ["", ""], answer: 0 }]);
  const upd = (i: number, f: (q: Q) => Q) => setQs(list => list.map((x, k) => (k === i ? f(x) : x)));
  const move = (i: number, d: number) => setQs(list => {
    const j = i + d; if (j < 0 || j >= list.length) return list;
    const c = [...list]; [c[i], c[j]] = [c[j], c[i]]; return c;
  });
  return (
    <div className="stack">
      <input type="hidden" name="quiz" value={JSON.stringify(qs)} />
      {qs.map((q, i) => (
        <fieldset key={i} className="card mk-qed">
          <legend><b>Question {i + 1}</b></legend>
          <label className="fld">Question<input value={q.q} maxLength={500} onChange={e => upd(i, x => ({ ...x, q: e.target.value }))} /></label>
          {q.options.map((o, j) => (
            <div key={j} className="row mk-optrow">
              <label className="check" title="Correct answer">
                <input type="radio" name={`answer-${i}`} checked={q.answer === j} onChange={() => upd(i, x => ({ ...x, answer: j }))} />
                <span className="sr">Correct</span>
              </label>
              <input aria-label={`Option ${j + 1}`} value={o} maxLength={300} onChange={e => upd(i, x => ({ ...x, options: x.options.map((y, k) => (k === j ? e.target.value : y)) }))} />
              {q.options.length > 2 && (
                <button type="button" className="btn alt sm" aria-label={`Remove option ${j + 1}`}
                  onClick={() => upd(i, x => ({ ...x, options: x.options.filter((_, k) => k !== j), answer: x.answer === j ? 0 : x.answer > j ? x.answer - 1 : x.answer }))}>✕</button>
              )}
            </div>
          ))}
          <p className="note">Tick the circle next to the correct option.</p>
          <div className="row">
            {q.options.length < 6 && <button type="button" className="btn alt sm" onClick={() => upd(i, x => ({ ...x, options: [...x.options, ""] }))}>Add option</button>}
            <button type="button" className="btn alt sm" onClick={() => move(i, -1)} disabled={i === 0}>Move up</button>
            <button type="button" className="btn alt sm" onClick={() => move(i, 1)} disabled={i === qs.length - 1}>Move down</button>
            <button type="button" className="btn alt sm" onClick={() => setQs(list => list.filter((_, k) => k !== i))}>Delete question</button>
          </div>
        </fieldset>
      ))}
      {qs.length < 30 && <button type="button" className="btn alt" onClick={() => setQs(l => [...l, { q: "", options: ["", ""], answer: 0 }])}>Add question</button>}
    </div>
  );
}
