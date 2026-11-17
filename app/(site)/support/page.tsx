import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/app/(site)/community/_components/ActionForm";
import { createTicket } from "@/lib/actions/agents";
import { TICKET_TOPICS } from "@/lib/agents/support";
import { getProfile } from "@/lib/auth";
import { SUPPORT_EMAIL } from "@/lib/config";

export const metadata: Metadata = { title: "Contact support", description: "Ask Automancy Academy for help with your account, payments, lessons or certificate." };
export const dynamic = "force-dynamic";

export default async function Support() {
  const me = await getProfile().catch(() => null);
  return (
    <section className="narrow stack" style={{ maxWidth: 640, gap: 14 }}>
      <h1 style={{ fontSize: "2rem" }}>Contact support</h1>
      <p className="muted">Tell us what&apos;s wrong and we&apos;ll reply by email, usually within one working day; many questions get an answer in minutes. Quick answers first: <Link href="/pricing">pricing</Link>, <Link href="/legal/refunds">refunds</Link>, <Link href="/forgot-password">reset your password</Link>.</p>
      <ActionForm action={createTicket} reset className="card stack" label="Contact support">
        <input type="hidden" name="t" value={String(Date.now())} />
        <div className="hp" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
        <div className="grid2">
          <label className="fld">Your name<input name="name" required maxLength={120} autoComplete="name" defaultValue={me?.full_name || ""} /></label>
          <label className="fld">Email<input name="email" type="email" required maxLength={200} autoComplete="email" defaultValue={me?.email || ""} /></label>
        </div>
        <label className="fld">What it&apos;s about
          <select name="topic" defaultValue="access">{TICKET_TOPICS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}</select></label>
        <label className="fld">Subject<input name="subject" required minLength={3} maxLength={160} /></label>
        <label className="fld">Message<textarea name="message" required minLength={10} maxLength={4000} style={{ minHeight: 140 }} placeholder="What happened, what you expected, and any lesson number or payment reference." /></label>
        <p className="note">Never send passwords, OTPs or card details. You can also email {SUPPORT_EMAIL}.</p>
        <div className="row"><button className="btn" type="submit">Send</button></div>
      </ActionForm>
    </section>
  );
}
