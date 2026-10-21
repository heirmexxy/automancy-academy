"use server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { SITE_URL, adminEmails } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";

/** Remember who referred a new learner (from the 30-day am_ref cookie), so referred sign-ups are counted even before they pay. */
async function linkReferrer(id?: string) {
  if (!id) return;
  const code = (await cookies()).get("am_ref")?.value;
  if (!code) return;
  const db = createAdminClient();
  const { data: ref } = await db.from("profiles").select("id").eq("referral_code", code.toUpperCase()).maybeSingle();
  if (ref && ref.id !== id) await db.from("profiles").update({ referred_by: ref.id }).eq("id", id).is("referred_by", null);
}

/** Accounts listed in ADMIN_EMAILS become admins the first time they sign in (only once the email is confirmed). */
async function ensureAdmin(id?: string, email?: string | null, confirmedAt?: string | null) {
  if (id && email && confirmedAt && adminEmails().includes(email.toLowerCase())) await createAdminClient().from("profiles").update({ role: "admin" }).eq("id", id);
}

// Same-site paths only. Backslashes are refused too: browsers read "/\evil.com" as "//evil.com".
const safeNext = (n: FormDataEntryValue | null) => {
  const s = String(n || "/learn");
  return s.startsWith("/") && !s.startsWith("//") && !s.includes("\\") ? s : "/learn";
};
// Email links always point at our own site, never at a Host / X-Forwarded-Host header the request supplied.
const origin = async () => SITE_URL;

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const next = safeNext(formData.get("next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (!error) await ensureAdmin(data.user?.id, data.user?.email, data.user?.email_confirmed_at);
  if (error) redirect(`/login?error=${encodeURIComponent("That email and password don't match. Try again, or reset your password.")}&next=${encodeURIComponent(next)}`);
  redirect(next);
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const full_name = String(formData.get("full_name") || "").trim().slice(0, 80);
  const marketing_consent = formData.get("marketing") === "on";
  const terms = formData.get("terms") === "on";
  const next = safeNext(formData.get("next"));
  if (!terms) redirect(`/signup?error=${encodeURIComponent("Please accept the terms and privacy policy to create an account.")}`);
  if (password.length < 8) redirect(`/signup?error=${encodeURIComponent("Use a password of at least 8 characters.")}`);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { full_name, marketing_consent }, emailRedirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(next)}` }
  });
  if (error) redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  try { await linkReferrer(data.user?.id); } catch { /* the referral link is best-effort */ }
  // If email confirmation is switched on in Supabase, there is no session yet.
  if (data.session) await ensureAdmin(data.user?.id, data.user?.email, data.user?.email_confirmed_at);
  if (!data.session) redirect(`/login?notice=${encodeURIComponent("Check your email for a link to confirm your account, then log in.")}`);
  redirect(next);
}

export async function sendReset(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${await origin()}/auth/callback?next=/reset-password` });
  redirect(`/forgot-password?sent=1`);
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") || "");
  if (password.length < 8) redirect(`/reset-password?error=${encodeURIComponent("Use at least 8 characters.")}`);
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);
  redirect(`/learn`);
}
