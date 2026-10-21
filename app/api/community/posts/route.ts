import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createPostCore } from "@/app/(site)/community/_lib/data";

export const dynamic = "force-dynamic";

/**
 * Contract (D): POST /api/community/posts
 * body {type: "journal"|"help"|"win", itemId?: string, title?: string, body: string} → {id}
 * Used by the course (journal and "I'm stuck" help requests from inside a lesson). Same-origin, signed-in only.
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  let sameSite = true;
  if (origin) { try { sameSite = new URL(origin).host === host; } catch { sameSite = false; } }
  if (!sameSite) return NextResponse.json({ error: "Cross-site requests are not allowed" }, { status: 403 });
  if (!(req.headers.get("content-type") || "").includes("application/json")) return NextResponse.json({ error: "Send JSON" }, { status: 415 });
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in to post" }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    const text = await req.text();
    if (text.length > 20000) return NextResponse.json({ error: "Too long" }, { status: 413 });
    body = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("bad");
  } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const type = String(body.type || "");
  if (!["journal", "help", "win"].includes(type)) return NextResponse.json({ error: "type must be journal, help or win" }, { status: 400 });
  // Only the contract fields are accepted; the room follows the lesson (or General).
  // Help and win posts need a title; the course may send only a body, so derive one from its first line.
  let title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title && type !== "journal") title = String(body.body || "").trim().split("\n")[0].slice(0, 100) || (type === "help" ? "Help request" : "A win");
  const r = await createPostCore(sb, user.id, { type, itemId: body.itemId, title: title || null, body: body.body });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ id: r.id }, { status: 201 });
}
