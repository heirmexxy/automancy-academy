"use client";
import { useState, useTransition } from "react";
import { submitQuiz, type QuizResult } from "@/lib/actions/marketplace";

/** Quiz for learners. Questions arrive WITHOUT answers; the server scores the attempt and returns the key. */
export function QuizPlayer({ lessonId, questions, best, canSave }: { lessonId: string; questions: { q: string; options: string[] }[]; best: number | null; canSave: boolean }) {
  const [picked, setPicked] = useState<number[]>(() => questions.map(() => -1));
  const [res, setRes] = useState<QuizResult | null>(null);
  const [pending, start] = useTransition();
  const all = picked.every(p => p >= 0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => { setRes(await submitQuiz(lessonId, picked)); });
  };
  const retry = () => { setRes(null); setPicked(questions.map(() => -1)); };

  return (
    <form className="stack mk-quiz" onSubmit={submit}>
      {best != null && !res && <p className="note">Your best score so far: {best}%.</p>}
      {questions.map((q, i) => {
        const correct = res?.answers?.[i];
        return (
          <fieldset key={i} className="card" disabled={!!res?.ok}>
            <legend><b>{i + 1}. {q.q}</b></legend>
            {q.options.map((o, j) => {
              const cls = res?.ok ? (j === correct ? "ok" : j === picked[i] ? "bad" : "") : "";
              return (
                <label key={j} className={`check mk-opt ${cls}`}>
                  <input type="radio" name={`q${i}`} checked={picked[i] === j} onChange={() => setPicked(p => p.map((x, k) => (k === i ? j : x)))} />
                  <span>{o}{res?.ok && j === correct ? " ✓" : ""}</span>
                </label>
              );
            })}
          </fieldset>
        );
      })}
      {res?.ok ? (
        <div className={`alert ${res.passed ? "ok" : "warn"}`} role="status">
          <p><b>{res.correct} of {res.total} correct ({res.percent}%).</b> {res.passed ? "Nice work: lesson complete." : "Have another look at the lesson and try again."}</p>
          {!canSave && <p className="note">Preview mode: your score isn't saved.</p>}
          <button type="button" className="btn alt sm" onClick={retry}>Try again</button>
        </div>
      ) : (
        <div className="row">
          <button className="btn" type="submit" disabled={!all || pending}>{pending ? "Checking…" : "Check my answers"}</button>
          {!all && <span className="note">Answer every question first.</span>}
          {res && !res.ok && <span className="alert bad" role="alert">{res.error}</span>}
        </div>
      )}
    </form>
  );
}
