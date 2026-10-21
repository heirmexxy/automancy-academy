"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const STATUSES = ["open", "fixed", "wontfix"];

/** Admin → Feedback: mark a template report fixed, won't fix, or reopen it. */
export async function setFeedbackStatus(form: FormData) {
  const admin = await requireAdmin();
  const id = String(form.get("id") || "");
  const status = String(form.get("status") || "");
  const show = String(form.get("show") || "open") === "all" ? "all" : "open";
  if (!/^[0-9a-f-]{36}$/i.test(id) || !STATUSES.includes(status)) redirect(`/admin/feedback?show=${show}&error=${encodeURIComponent("Invalid request.")}`);
  const db = createAdminClient();
  const closed = status !== "open";
  const { error } = await db.from("feedback").update({ status, closed_at: closed ? new Date().toISOString() : null, closed_by: closed ? admin.id : null }).eq("id", id);
  if (error) redirect(`/admin/feedback?show=${show}&error=${encodeURIComponent(error.message)}`);
  await db.from("audit_log").insert({ actor: admin.id, action: "feedback." + status, target: id });
  revalidatePath("/admin/feedback");
  redirect(`/admin/feedback?show=${show}&done=1`);
}
