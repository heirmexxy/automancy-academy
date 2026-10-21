"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { SUPPORT_EMAIL, SITE_URL, hasSupabase } from "@/lib/config";
import { PRODUCTS } from "@/lib/pricing";
import { esc } from "@/lib/format";

/** Trim, drop control characters, cap length. */
const clean = (v: FormDataEntryValue | null, max: number) =>
  String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const msg = (s: string) => encodeURIComponent(s);
const EMAIL_RE = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[A-Za-z]{2,}$/;

/** Only same-site paths for redirects after a public form. */
const safeBack = (v: FormDataEntryValue | null) => {
  const s = String(v || "/pricing");
  return s.startsWith("/") && !s.startsWith("//") && !s.includes("\\") ? s.split("#")[0] : "/pricing";
};
const withParam = (path: string, kv: string) => path + (path.includes("?") ? "&" : "?") + kv;

/** Products people can join a waitlist for: coming-soon products and the cohort (while closed). */
const WAITLIST_PRODUCTS = new Set(PRODUCTS.filter(p => p.comingSoon || p.hiddenUnlessCohortOpen).map(p => p.id as string));

export async function joinWaitlist(formData: FormData) {
  const back = safeBack(formData.get("back"));
  const productId = clean(formData.get("product"), 40);
  const email = clean(formData.get("email"), 254).toLowerCase();
  if (!WAITLIST_PRODUCTS.has(productId)) redirect(withParam(back, `error=${msg("That waitlist doesn't exist.")}`));
  if (!EMAIL_RE.test(email)) redirect(withParam(back, `error=${msg("Please enter a valid email address.")}`) + `#${productId}`);
  if (hasSupabase()) {
    // waitlist is admin-write under RLS, so the server inserts it with the service role after validating the input above.
    const { error } = await createAdminClient().from("waitlist").upsert({ email, product: productId }, { onConflict: "email,product", ignoreDuplicates: true });
    if (error) redirect(withParam(back, `error=${msg("We couldn't add you just now. Please try again.")}`) + `#${productId}`);
  }
  redirect(withParam(back, `waitlisted=${encodeURIComponent(productId)}`) + `#${productId}`);
}

async function currentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account");
  return { supabase, user };
}

export async function updateProfile(formData: FormData) {
  const { supabase, user } = await currentUser();
  const full_name = clean(formData.get("full_name"), 80);
  const city = clean(formData.get("city"), 60);
  const public_profile = formData.get("public_profile") === "on";
  const marketing_consent = formData.get("marketing_consent") === "on";
  if (full_name.length < 2) redirect(`/account?error=${msg("Please enter your name (at least 2 characters).")}#profile`);

  const { data: cur } = await supabase.from("profiles").select("marketing_consent").eq("id", user.id).single();
  const patch: Record<string, unknown> = { full_name, city: city || null, public_profile, marketing_consent };
  if (marketing_consent && !cur?.marketing_consent) patch.consent_at = new Date().toISOString();
  if (!marketing_consent) patch.consent_at = null;

  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) redirect(`/account?error=${msg("We couldn't save your profile. Please try again.")}#profile`);
  revalidatePath("/account");
  redirect("/account?saved=1#profile");
}

/** Records a deletion request (audit_log) and tells support. An admin deletes the account by hand after checking payments and refunds. */
export async function requestDeletion(formData: FormData) {
  const { user } = await currentUser();
  if (formData.get("confirm") !== "on") redirect(`/account?error=${msg("Tick the box to confirm you want your account deleted.")}#data`);
  const reason = clean(formData.get("reason"), 1000);
  const email = user.email || "";
  const db = createAdminClient();
  const { error } = await db.from("audit_log").insert({
    actor: user.id, action: "account.deletion_requested", target: user.id,
    detail: { email, reason: reason || null, requested_at: new Date().toISOString() }
  });
  if (error) redirect(`/account?error=${msg(`We couldn't record your request. Please email ${SUPPORT_EMAIL}.`)}#data`);

  await sendEmail(SUPPORT_EMAIL, `Account deletion request: ${email}`,
    `<p>A learner asked for their account to be deleted.</p><p>User ID: ${esc(user.id)}<br>Email: ${esc(email)}</p>` +
    `<p>Reason: ${esc(reason || "(none given)")}</p><p>Check open payments, refunds and referral payouts, then delete the user in Supabase (Authentication → Users). ` +
    `Keep payment records as the privacy policy describes. Reply to the learner within 30 days.</p>`).catch(() => null);
  if (email) {
    await sendEmail(email, "We've received your request to delete your Automancy Academy account",
      `<p>Hello,</p><p>We've received your request to delete your Automancy Academy account. We'll confirm by email once it's done, within 30 days. ` +
      `If you didn't ask for this, reply to this email or write to ${esc(SUPPORT_EMAIL)} straight away.</p>` +
      `<p>What we keep and why: <a href="${SITE_URL}/legal/privacy#retention">${SITE_URL}/legal/privacy#retention</a></p>`).catch(() => null);
  }
  redirect("/account?deletion=requested#data");
}
