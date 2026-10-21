import Link from "next/link";
import { Logo } from "./Logo";
import { getProfile } from "@/lib/auth";
import { hasSupabase } from "@/lib/config";

/** Public header. Learners who are signed in see "My course"; admins also see "Admin". */
export async function SiteHeader() {
  const profile = hasSupabase() ? await getProfile().catch(() => null) : null;
  return (
    <header className="site-h">
      <div className="wrap">
        <Link className="brand" href="/"><Logo /><span>Automancy <b>Academy</b></span></Link>
        <input type="checkbox" id="menu" hidden />
        <label htmlFor="menu" className="btn alt sm menu-t">Menu</label>
        <nav className="nav" aria-label="Main">
          <Link href="/#course">The course</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/courses">More courses</Link>
          <Link href="/teach">Teach</Link>
          <Link href="/hire">Hire talent</Link>
          <Link href="/careers">Careers</Link>
          {profile ? <>
            <Link href="/community">Community</Link>
            <Link href="/leaderboard">Leaderboard</Link>
            {profile.role === "admin" && <Link href="/admin">Admin</Link>}
            <Link href="/account">Account</Link>
            <Link className="btn sm" href="/learn">My course</Link>
          </> : <>
            <Link href="/login">Log in</Link>
            <Link className="btn sm" href="/signup">Start free</Link>
          </>}
        </nav>
      </div>
    </header>
  );
}
