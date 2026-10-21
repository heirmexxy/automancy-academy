import Link from "next/link";
import type { Metadata } from "next";
import { AuthCard } from "@/components/AuthCard";
import { signUp } from "@/lib/actions/auth";

export const metadata: Metadata = { title: "Create your free account" };

export default async function Signup({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return (
    <AuthCard title="Start free" sub="Base Camp (6 lessons and your first project) is free. No card needed." error={sp.error}>
      <form action={signUp} className="stack">
        <input type="hidden" name="next" value={sp.next || "/learn"} />
        <label className="fld">Your name<input name="full_name" autoComplete="name" required maxLength={80} /></label>
        <label className="fld">Email<input name="email" type="email" autoComplete="email" required /></label>
        <label className="fld">Password<input name="password" type="password" autoComplete="new-password" required minLength={8} /><span className="note">At least 8 characters.</span></label>
        <label className="check"><input type="checkbox" name="terms" required /> <span>I agree to the <Link href="/legal/terms" target="_blank">terms</Link> and <Link href="/legal/privacy" target="_blank">privacy policy</Link>.</span></label>
        <label className="check"><input type="checkbox" name="marketing" /> <span>Send me course news and offers by email (optional; unsubscribe any time).</span></label>
        <button className="btn" type="submit">Create my account</button>
      </form>
      <p className="note">Already have an account? <Link href="/login">Log in</Link></p>
    </AuthCard>
  );
}
