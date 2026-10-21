import type { Metadata } from "next";
import { AuthCard } from "@/components/AuthCard";
import { sendReset } from "@/lib/actions/auth";

export const metadata: Metadata = { title: "Reset your password" };

export default async function Forgot({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return (
    <AuthCard title="Reset your password" notice={sp.sent ? "If that email has an account, a reset link is on its way. Check spam too." : undefined}>
      <form action={sendReset} className="stack">
        <label className="fld">Email<input name="email" type="email" autoComplete="email" required /></label>
        <button className="btn" type="submit">Send reset link</button>
      </form>
    </AuthCard>
  );
}
