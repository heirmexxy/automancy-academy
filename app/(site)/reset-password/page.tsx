import type { Metadata } from "next";
import { AuthCard } from "@/components/AuthCard";
import { updatePassword } from "@/lib/actions/auth";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function Reset({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser("/reset-password");
  const sp = await searchParams;
  return (
    <AuthCard title="Choose a new password" error={sp.error}>
      <form action={updatePassword} className="stack">
        <label className="fld">New password<input name="password" type="password" autoComplete="new-password" required minLength={8} /></label>
        <button className="btn" type="submit">Save password</button>
      </form>
    </AuthCard>
  );
}
