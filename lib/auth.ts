import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string; email: string; full_name: string | null; role: "learner" | "reviewer" | "admin";
  city: string | null; public_profile: boolean; referral_code: string | null; created_at: string;
};

export async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return (data as Profile) ?? null;
}

export async function requireUser(next = "/learn") {
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export async function requireAdmin() {
  const p = await getProfile();
  if (!p) redirect("/login?next=/admin");
  if (p.role !== "admin") redirect("/learn");
  return p;
}

/** Products the learner has paid for (active enrollments). "course" unlocks every lesson beyond Base Camp. */
export async function getEntitlements(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("enrollments").select("product, status, expires_at").eq("user_id", userId).eq("status", "active");
  const now = Date.now();
  const active = (data || []).filter(e => !e.expires_at || new Date(e.expires_at).getTime() > now).map(e => e.product as string);
  const set = new Set(active);
  return {
    products: [...set],
    course: set.has("self") || set.has("cohort") || set.has("team"),
    member: set.has("member") || set.has("cohort"),
    story: set.has("story") || set.has("cohort"),
    templates: set.has("bundle") || set.has("cohort"),
    crmspec: set.has("crmspec")
  };
}
