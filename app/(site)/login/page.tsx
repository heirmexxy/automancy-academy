import Link from "next/link";
import type { Metadata } from "next";
import { AuthCard } from "@/components/AuthCard";
import { signIn } from "@/lib/actions/auth";

export const metadata: Metadata = { title: "Log in" };

export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return (
    <AuthCard title="Welcome back" sub="Log in to continue your course." error={sp.error} notice={sp.notice}>
      <form action={signIn} className="stack">
        <input type="hidden" name="next" value={sp.next || "/learn"} />
        <label className="fld">Email<input name="email" type="email" autoComplete="email" required /></label>
        <label className="fld">Password<input name="password" type="password" autoComplete="current-password" required minLength={8} /></label>
        <button className="btn" type="submit">Log in</button>
      </form>
      <p className="note"><Link href="/forgot-password">Forgot your password?</Link> · New here? <Link href={`/signup${sp.next ? `?next=${encodeURIComponent(sp.next)}` : ""}`}>Create a free account</Link></p>
    </AuthCard>
  );
}
