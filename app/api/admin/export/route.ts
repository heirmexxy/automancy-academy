import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { csvRow, fromMinor } from "@/lib/money";
import { loadLearners } from "@/app/(site)/admin/learners/data";

export const dynamic = "force-dynamic";

/** Admin-only CSV of learners (replaces the tracking spreadsheet). */
export async function GET() {
  const me = await getProfile();
  if (!me || me.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const rows = await loadLearners({ limit: 10000 });
  const lines = [csvRow(["Name", "Email", "City", "Products", "Joined", "First paid", "Paid NGN", "Paid USD", "Progress %", "Items done", "Last active"])];
  for (const r of rows) {
    lines.push(csvRow([
      r.name, r.email, r.city || "", r.products.join(" "), r.createdAt.slice(0, 10), r.firstPaid ? r.firstPaid.slice(0, 10) : "",
      r.paidNgnKobo ? fromMinor(r.paidNgnKobo) : "", r.paidUsdCents ? fromMinor(r.paidUsdCents) : "", r.pct, r.itemsDone, r.lastActive ? r.lastActive.slice(0, 10) : ""
    ]));
  }
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse("﻿" + lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="automancy-learners-${date}.csv"`,
      "Cache-Control": "no-store"
    }
  });
}
