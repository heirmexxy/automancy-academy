import { NextResponse, after } from "next/server";
import { hasSupabase } from "@/lib/config";
import { hasWhatsApp, verifySignature } from "@/lib/whatsapp/api";
import { processWebhook } from "@/lib/whatsapp/engine";

/**
 * WhatsApp Cloud API webhook. In the Meta app: WhatsApp → Configuration → Callback URL ${SITE_URL}/api/whatsapp/webhook,
 * Verify token = WHATSAPP_VERIFY_TOKEN, subscribe to the "messages" field.
 * GET answers Meta's verification challenge. POST checks X-Hub-Signature-256 (HMAC-SHA256 of the raw body with
 * WHATSAPP_APP_SECRET), replies 200 at once and does the work in after() (Meta retries slow or failed deliveries;
 * the engine is idempotent on the message id).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120; // seconds: an AI review inside after() can take up to a minute

const unavailable = () => NextResponse.json({ error: "WhatsApp learning is not set up yet." }, { status: 503 });

export async function GET(req: Request) {
  if (!process.env.WHATSAPP_VERIFY_TOKEN) return unavailable();
  const u = new URL(req.url).searchParams;
  if (u.get("hub.mode") === "subscribe" && u.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(u.get("hub.challenge") || "", { status: 200, headers: { "content-type": "text/plain" } });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  if (!hasWhatsApp() || !hasSupabase()) return unavailable();
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"))) return NextResponse.json({ ok: false }, { status: 401 });
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  after(async () => {
    try { await processWebhook(payload); }
    catch (e) { console.error("[whatsapp] webhook handler error", e); }
  });
  return NextResponse.json({ ok: true });
}
