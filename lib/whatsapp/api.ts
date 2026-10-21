import "server-only";
import { WA, clip, verifySignature as verifyHmac, type Out, type Button, type Row } from "@/lib/whatsapp/core";

/**
 * Meta WhatsApp Cloud API (Graph API) over fetch. Server only.
 * Env: WHATSAPP_TOKEN (permanent System User token), WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_APP_SECRET,
 * WHATSAPP_VERIFY_TOKEN, WHATSAPP_BUSINESS_NUMBER, WHATSAPP_GRAPH_VERSION (default v21.0). All PLACEHOLDERs until go-live.
 */
export const graphVersion = () => (process.env.WHATSAPP_GRAPH_VERSION || "v21.0").trim(); // PLACEHOLDER: check Meta's current Graph API version
/** Sending works (token + phone number id). */
export const canSend = () => !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
/** The whole feature is configured: sending, the webhook and the number learners message. */
export const hasWhatsApp = () => !!(canSend() && process.env.WHATSAPP_APP_SECRET && process.env.WHATSAPP_VERIFY_TOKEN && businessNumber());
/** The Automancy WhatsApp number, digits only (e.g. 2348012345678). */
export const businessNumber = () => (process.env.WHATSAPP_BUSINESS_NUMBER || "").replace(/\D/g, "");
export const reminderTemplate = () => process.env.WHATSAPP_TEMPLATE_REMINDER || "lesson_reminder";

export function verifySignature(raw: string, header: string | null) {
  return verifyHmac(raw, header, process.env.WHATSAPP_APP_SECRET);
}

export type SendResult = { ok: true; id: string } | { ok: false; error: string; code?: number };

async function graph(path: string, body: Record<string, unknown>): Promise<SendResult> {
  if (!canSend()) return { ok: false, error: "WhatsApp is not configured" };
  const url = `https://graph.facebook.com/${graphVersion()}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/${path}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000)
    });
    const data = (await res.json().catch(() => ({}))) as { messages?: { id?: string }[]; success?: boolean; error?: { message?: string; code?: number; error_data?: { details?: string } } };
    if (!res.ok) {
      const e = data.error || {};
      return { ok: false, error: clip(`${res.status} ${e.code ?? ""} ${e.message || res.statusText}${e.error_data?.details ? ": " + e.error_data.details : ""}`.replace(/\s+/g, " ").trim(), 500), code: e.code };
    }
    return { ok: true, id: data.messages?.[0]?.id || (data.success ? "ok" : "") };
  } catch (e) {
    return { ok: false, error: clip(e instanceof Error ? e.message : "network error", 300) };
  }
}

const base = (to: string) => ({ messaging_product: "whatsapp", recipient_type: "individual", to: to.replace(/\D/g, "") });

export function sendText(to: string, body: string, previewUrl = /https?:\/\//.test(body)) {
  return graph("messages", { ...base(to), type: "text", text: { body: clip(body, WA.textMax), preview_url: previewUrl } });
}

export function sendButtons(to: string, body: string, buttons: Button[], opts: { footer?: string; header?: string } = {}) {
  return graph("messages", {
    ...base(to), type: "interactive",
    interactive: {
      type: "button",
      ...(opts.header ? { header: { type: "text", text: clip(opts.header, WA.headerMax) } } : {}),
      body: { text: clip(body, WA.interactiveBody) },
      ...(opts.footer ? { footer: { text: clip(opts.footer, WA.footerMax) } } : {}),
      action: { buttons: buttons.slice(0, WA.buttonsMax).map(b => ({ type: "reply", reply: { id: b.id.slice(0, WA.idMax), title: clip(b.title, WA.buttonTitle) } })) }
    }
  });
}

export function sendList(to: string, body: string, button: string, rows: Row[], opts: { footer?: string; header?: string; sectionTitle?: string } = {}) {
  return graph("messages", {
    ...base(to), type: "interactive",
    interactive: {
      type: "list",
      ...(opts.header ? { header: { type: "text", text: clip(opts.header, WA.headerMax) } } : {}),
      body: { text: clip(body, WA.interactiveBody) },
      ...(opts.footer ? { footer: { text: clip(opts.footer, WA.footerMax) } } : {}),
      action: {
        button: clip(button, WA.listButton),
        sections: [{
          title: clip(opts.sectionTitle || "Options", 24),
          rows: rows.slice(0, WA.rowsMax).map(r => ({
            id: r.id.slice(0, 200), title: clip(r.title, WA.rowTitle),
            ...(r.description ? { description: clip(r.description, WA.rowDescription) } : {})
          }))
        }]
      }
    }
  });
}

/** Video by public HTTPS link (H.264/AAC MP4, ≤ 16 MB), or by an uploaded media id. */
export function sendVideo(to: string, media: { link?: string; id?: string }, caption?: string) {
  const video: Record<string, string> = media.id ? { id: media.id } : { link: media.link || "" };
  if (caption) video.caption = clip(caption, WA.captionMax);
  return graph("messages", { ...base(to), type: "video", video });
}

export type TemplateComponent = { type: "header" | "body" | "button"; sub_type?: string; index?: string; parameters: Record<string, unknown>[] };
/** An approved message template (the only way to message someone outside the 24-hour window). */
export function sendTemplate(to: string, name: string, language = "en", components: TemplateComponent[] = []) {
  return graph("messages", { ...base(to), type: "template", template: { name, language: { code: language }, ...(components.length ? { components } : {}) } });
}

/** Blue ticks on the learner's message. Best effort. */
export function markRead(messageId: string) {
  return graph("messages", { messaging_product: "whatsapp", status: "read", message_id: messageId });
}

/** Sends one rendered message. */
export function sendOut(to: string, m: Out, mediaId?: string): Promise<SendResult> {
  switch (m.type) {
    case "text": return sendText(to, m.body, m.previewUrl);
    case "buttons": return sendButtons(to, m.body, m.buttons, { footer: m.footer, header: m.header });
    case "list": return sendList(to, m.body, m.button, m.rows, { footer: m.footer, header: m.header, sectionTitle: m.sectionTitle });
    case "video": return sendVideo(to, mediaId ? { id: mediaId } : { link: m.link }, m.caption);
  }
}
