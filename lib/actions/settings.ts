"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { getSettings, type Settings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";

/** Admin → Settings. Saves the runtime switches and records the change in audit_log. */
export async function saveSettings(formData: FormData) {
  const admin = await requireAdmin();
  const before = await getSettings();
  const rawDate = String(formData.get("next_cohort_date") || "").trim();
  if (rawDate && (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate) || isNaN(Date.parse(rawDate)))) {
    redirect(`/admin/settings?error=${encodeURIComponent("Use a valid date for the next cohort.")}`);
  }
  const after: Settings = {
    cohort_open: formData.get("cohort_open") === "on",
    live_calls_visible: formData.get("live_calls_visible") === "on",
    ai_review_auto: formData.get("ai_review_auto") === "on",
    next_cohort_date: rawDate || null
  };

  const db = createAdminClient();
  const now = new Date().toISOString();
  const rows = (Object.keys(after) as (keyof Settings)[])
    .filter(k => after[k] !== null)
    .map(k => ({ key: k, value: after[k], updated_at: now }));
  const { error } = await db.from("settings").upsert(rows, { onConflict: "key" });
  // settings.value is NOT NULL, so "no date" is stored by removing the row (getSettings falls back to null).
  const delErr = after.next_cohort_date === null ? (await db.from("settings").delete().eq("key", "next_cohort_date")).error : null;
  if (error || delErr) redirect(`/admin/settings?error=${encodeURIComponent("Couldn't save settings. Please try again.")}`);

  const changed = (Object.keys(after) as (keyof Settings)[]).filter(k => (before[k] ?? null) !== after[k]);
  if (changed.length) {
    await db.from("audit_log").insert({
      actor: admin.id, action: "settings.update", target: "settings",
      detail: { changed, before: Object.fromEntries(changed.map(k => [k, before[k] ?? null])), after: Object.fromEntries(changed.map(k => [k, after[k]])) }
    });
  }
  revalidatePath("/", "layout");
  redirect("/admin/settings?saved=1");
}
