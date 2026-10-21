"use server";
import { randomInt } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasWhatsApp } from "@/lib/whatsapp/api";
import { LINK_CODE_TTL_MS, codeFromInt } from "@/lib/whatsapp/core";

/** Account → Learn on WhatsApp. Every action checks the signed-in user, then writes with the service role. */
const back: (q: string) => never = q => redirect(`/account?${q}#whatsapp`);

/** A one-time 6-digit code, valid 15 minutes. The learner sends "LINK <code>" from their phone. */
export async function createLinkCode() {
  const user = await requireUser("/account");
  if (!hasWhatsApp()) back("wa=unavailable");
  const db = createAdminClient();
  const now = Date.now();
  // Throttle: at most 5 codes in 15 minutes per learner.
  const { count } = await db.from("wa_link_codes").select("code", { count: "exact", head: true })
    .eq("user_id", user.id).gte("created_at", new Date(now - LINK_CODE_TTL_MS).toISOString());
  if ((count || 0) >= 5) back("wa=slow");
  await db.from("wa_link_codes").delete().eq("used", false).lt("expires_at", new Date(now).toISOString());
  // Older live codes for this learner stop working (kept, marked used, so the throttle above still counts them).
  await db.from("wa_link_codes").update({ used: true }).eq("user_id", user.id).eq("used", false);
  for (let i = 0; i < 5; i++) {
    const code = codeFromInt(randomInt(0, 1_000_000));
    const { error } = await db.from("wa_link_codes").insert({ code, user_id: user.id, expires_at: new Date(now + LINK_CODE_TTL_MS).toISOString() });
    if (!error) { revalidatePath("/account"); back("wa=code"); }
    if (error.code !== "23505") { console.error("[whatsapp] link code", error.message); break; }
  }
  back("wa=error");
}

export async function setWhatsAppReminders(form: FormData) {
  const user = await requireUser("/account");
  const on = String(form.get("on") || "") === "1";
  const db = createAdminClient();
  await db.from("wa_links").update({ reminders: on }).eq("user_id", user.id);
  revalidatePath("/account");
  back(`wa=${on ? "reminders_on" : "reminders_off"}`);
}

/** Unlink: the number stops getting lessons and reminders. Progress stays on the account. */
export async function unlinkWhatsApp() {
  const user = await requireUser("/account");
  const db = createAdminClient();
  await db.from("wa_links").delete().eq("user_id", user.id);
  await db.from("wa_sessions").delete().eq("user_id", user.id);
  await db.from("wa_link_codes").delete().eq("user_id", user.id).eq("used", false);
  await db.from("audit_log").insert({ actor: user.id, action: "whatsapp.unlinked", target: user.id });
  revalidatePath("/account");
  back("wa=unlinked");
}
