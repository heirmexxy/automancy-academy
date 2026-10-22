"use server";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canSend, sendText } from "@/lib/whatsapp/api";
import { clip, within24h } from "@/lib/whatsapp/core";

const back: (q: string) => never = q => redirect(`/admin/whatsapp?${q}`);

/** Admin → WhatsApp: send a test text to the admin's own linked number (free-form, so only inside the 24-hour window). */
export async function sendTestMessage(form: FormData) {
  const admin = await requireAdmin();
  const text = String(form.get("text") || "").trim().slice(0, 1000);
  if (!text) back(`error=${encodeURIComponent("Type a message first.")}`);
  if (!canSend()) back(`error=${encodeURIComponent("WhatsApp isn't configured (WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID).")}`);
  const db = createAdminClient();
  const { data: link } = await db.from("wa_links").select("phone_e164, opted_in").eq("user_id", admin.id).maybeSingle();
  if (!link) back(`error=${encodeURIComponent("Link your own number first (Account → Learn on WhatsApp).")}`);
  if (!link.opted_in) back(`error=${encodeURIComponent("Your number has opted out (STOP). Send START to the business number first.")}`);
  const { data: sess } = await db.from("wa_sessions").select("last_inbound_at").eq("phone", link.phone_e164).maybeSingle();
  if (!within24h(sess?.last_inbound_at as string | null)) back(`error=${encodeURIComponent("Free-form messages only work within 24 hours of your last message to the number. Send it any message (e.g. MENU), then try again.")}`);
  const res = await sendText(String(link.phone_e164), `[Test] ${text}`);
  await db.from("wa_messages").insert({
    direction: "out", phone: link.phone_e164, user_id: admin.id, wa_message_id: res.ok && res.id !== "ok" ? res.id : null, kind: "admin_test",
    body_excerpt: clip(text, 160), status: res.ok ? "sent" : "failed", error: res.ok ? null : res.error, cost_category: "service"
  });
  await db.from("audit_log").insert({ actor: admin.id, action: "whatsapp.test_send", target: admin.id, detail: { ok: res.ok } });
  if (!res.ok) back(`error=${encodeURIComponent("Meta refused it: " + res.error)}`);
  back("sent=1");
}
