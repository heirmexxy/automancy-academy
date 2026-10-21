import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminEmails } from "@/lib/config";

/** Email confirmation, password reset and magic links land here. Also promotes ADMIN_EMAILS accounts to admin. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextRaw = url.searchParams.get("next") || "/learn";
  // new URL("/\\evil.com", origin) resolves to https://evil.com/, so backslashes are refused as well as "//".
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") && !nextRaw.includes("\\") ? nextRaw : "/learn";
  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user?.email && data.user.email_confirmed_at && adminEmails().includes(data.user.email.toLowerCase())) {
      await createAdminClient().from("profiles").update({ role: "admin" }).eq("id", data.user.id);
    }
    if (error) return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent("That link has expired. Log in or request a new one.")}`, url.origin));
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
