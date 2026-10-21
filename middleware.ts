import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/** Pages that need a signed-in learner. Everything else (landing, pricing, legal, verify, hire browse) is public. */
const PROTECTED = ["/learn", "/account", "/community", "/admin", "/checkout", "/teach/studio"];

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  // Remember a referral code for 30 days (?ref=CODE on any page)
  const ref = request.nextUrl.searchParams.get("ref");
  const { response, user } = await updateSession(request);
  if (ref && /^[A-Za-z0-9_-]{3,32}$/.test(ref)) {
    response.cookies.set("am_ref", ref.toUpperCase(), { maxAge: 60 * 60 * 24 * 30, path: "/", sameSite: "lax", httpOnly: true, secure: true });
  }
  if (PROTECTED.some(p => pathname === p || pathname.startsWith(p + "/")) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|img/|templates/|api/paystack/webhook|.*\\.(?:png|jpg|jpeg|svg|webp|ico|mp3|json)$).*)"]
};
