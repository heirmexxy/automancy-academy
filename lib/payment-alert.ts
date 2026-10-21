import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_NAME, SUPPORT_EMAIL, adminEmails } from "@/lib/config";
import { sendEmail } from "@/lib/email";

/** What a learner sees if a payment can't be started (missing keys, Paystack down, network error). */
export const PAYMENT_UNAVAILABLE = `We couldn't start your payment just now. No money was taken. Please try again in a few minutes, or email ${SUPPORT_EMAIL} and we'll help you finish.`;

let lastAlert = 0;

/**
 * Called when someone tries to pay but checkout can't start. Logs it, records the attempt
 * (so the admin can follow up) and emails admins at most once an hour per server instance.
 */
export async function reportCheckoutFailure(reason: string, who: { userId?: string; email?: string | null }, item: string) {
  console.error(`[checkout] could not start payment for ${item}: ${reason}`);
  try {
    await createAdminClient().from("audit_log").insert({
      actor: who.userId ?? null, action: "checkout_failed", target: item,
      detail: { reason, email: who.email ?? null },
    });
  } catch { /* logging must never block the learner */ }
  const now = Date.now();
  if (now - lastAlert < 60 * 60 * 1000) return;
  lastAlert = now;
  const to = adminEmails();
  if (!to.length) return;
  try {
    await sendEmail(to.join(","), `${SITE_NAME}: a learner couldn't pay`,
      `<p>Someone (${who.email ?? "unknown"}) tried to buy <b>${item}</b> but checkout couldn't start.</p><p>Reason: ${reason}</p>` +
      `<p>If the reason is a missing key, add PAYSTACK_SECRET_KEY and NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY in Vercel and redeploy (README: "Going live with Paystack"). Failed attempts are listed in the audit log.</p>`);
  } catch { /* ignore */ }
}
