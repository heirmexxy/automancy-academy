"use client";
import { startTransition, useActionState, useEffect, useRef } from "react";

export type ActionResult = { ok: boolean; msg: string; at?: number } | null;

/**
 * A form bound to a server action of the shape (prev, formData) => {ok, msg}.
 * Shows the message inline, disables itself while pending and (optionally) clears on success.
 * Submits through onSubmit so React doesn't wipe what the learner typed when the server says no.
 */
export function ActionForm({ action, children, className, reset = false, quiet = false, label }: {
  action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
  reset?: boolean;
  /** hide success messages (e.g. the applaud button) */
  quiet?: boolean;
  label?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (reset && state?.ok) ref.current?.reset(); }, [state, reset]);
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    let fd: FormData;
    try { fd = new FormData(e.currentTarget, submitter); } catch { fd = new FormData(e.currentTarget); }
    startTransition(() => formAction(fd));
  }
  return (
    <form ref={ref} action={formAction} onSubmit={onSubmit} className={className} aria-label={label} aria-busy={pending || undefined}>
      <fieldset disabled={pending} className="af-fs">{children}</fieldset>
      {state && state.msg && !(quiet && state.ok) && (
        <p className={`af-msg ${state.ok ? "ok" : "bad"}`} role={state.ok ? "status" : "alert"}>{state.msg}</p>
      )}
    </form>
  );
}
