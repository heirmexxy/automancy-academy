import { NextResponse, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyRefund, fulfilPayment, verifySignature } from "@/lib/paystack";
import { handleCoursePayment } from "@/lib/marketplace";

/**
 * Paystack webhook. Set this URL in Paystack → Settings → API Keys & Webhooks: ${SITE_URL}/api/paystack/webhook
 * The signature is checked on the raw body; work happens after the 200 is sent (Paystack retries non-200s).
 * charge.success is never trusted as-is: fulfilPayment re-verifies the transaction through the API.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Evt = { event?: string; data?: Record<string, unknown> };

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-paystack-signature"))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  let evt: Evt;
  try { evt = JSON.parse(raw) as Evt; } catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  after(async () => {
    try {
      if (evt.event === "charge.success") {
        const ref = String(evt.data?.reference || "");
        if (ref) {
          // metadata.kind === "course" (marketplace) → handleCoursePayment, decided on the re-verified transaction
          const r = await fulfilPayment(ref, { onCourse: handleCoursePayment });
          if (!r.ok) console.error("[webhook] charge.success not fulfilled", ref, r.status, r.message);
        }
      } else if (evt.event === "refund.processed") {
        const d = evt.data || {};
        const tx = d.transaction as Record<string, unknown> | string | number | undefined;
        const ref = String(d.transaction_reference || (typeof tx === "object" && tx ? tx.reference : "") || "");
        if (!ref) { console.error("[webhook] refund.processed without a transaction reference"); return; }
        const db = createAdminClient();
        const { data: pay } = await db.from("payments").select("id, amount_kobo, status").eq("reference", ref).maybeSingle();
        if (!pay) { console.error("[webhook] refund for unknown payment", ref); return; }
        const refunded = Number(d.amount || 0);
        const partial = refunded > 0 && refunded < (pay.amount_kobo as number);
        await applyRefund(pay.id as string, { partial });
        await db.from("audit_log").insert({ actor: null, action: "refund_processed", target: pay.id, detail: { reference: ref, amount: refunded, partial } });
      }
    } catch (e) {
      console.error("[webhook] handler error", evt.event, e);
    }
  });

  return NextResponse.json({ ok: true });
}
