import { timingSafeEqual } from "node:crypto";
import { runSchedule } from "@/lib/agents/run";

/**
 * Scheduled agents. The server's cron calls this hourly (?tick=hourly) and daily (?tick=daily) with
 * `Authorization: Bearer ${CRON_SECRET}` (scripts/deploy-vps.sh writes /etc/cron.d/automancy).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

function authorised(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const a = Buffer.from(req.headers.get("authorization") || "");
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  if (!authorised(req)) return new Response("Unauthorised", { status: 401 });
  const tick = new URL(req.url).searchParams.get("tick") === "daily" ? "daily" : "hourly";
  const results = await runSchedule(tick);
  return Response.json({ tick, results });
}
