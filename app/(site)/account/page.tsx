import Link from "next/link";
import type { Metadata } from "next";
import "./account.css";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SUPPORT_EMAIL } from "@/lib/config";
import { updateProfile, requestDeletion } from "@/lib/actions/account";
import Purchases from "@/components/account/Purchases";
import Referral from "@/components/account/Referral";
import Certificate from "@/components/account/Certificate";
import WhatsApp from "@/components/account/WhatsApp";

export const metadata: Metadata = { title: "Your account" };
export const dynamic = "force-dynamic";

type Row = { full_name: string | null; email: string; city: string | null; public_profile: boolean; marketing_consent: boolean };

export default async function Account({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await requireUser("/account");
  const db = await createClient();
  const { data } = await db.from("profiles").select("full_name, email, city, public_profile, marketing_consent").eq("id", user.id).single();
  const p = (data || { full_name: null, email: user.email || "", city: null, public_profile: false, marketing_consent: false }) as Row;

  return (
    <div className="wrap account">
      <header className="stack" style={{ paddingTop: 32, gap: 6 }}>
        <span className="eyebrow">Account</span>
        <h1 style={{ fontSize: "clamp(2rem,5vw,2.8rem)" }}>Hello{p.full_name ? `, ${p.full_name.split(" ")[0]}` : ""}</h1>
        <nav className="acc-nav" aria-label="Account sections">
          <a href="#profile">Profile</a><a href="#purchases">Purchases</a><a href="#referral">Referrals</a><a href="#certificate">Certificate</a><a href="#whatsapp">WhatsApp</a><a href="#data">Your data</a>
        </nav>
      </header>

      {sp.error && <p className="alert bad" role="alert">{sp.error}</p>}

      <section id="profile" aria-labelledby="profile-h">
        <div className="card">
          <h2 id="profile-h">Profile</h2>
          {sp.saved && <p className="alert ok" role="status">Saved.</p>}
          <form action={updateProfile} className="stack">
            <div className="grid2">
              <label className="fld">Your name<input name="full_name" defaultValue={p.full_name || ""} autoComplete="name" required minLength={2} maxLength={80} />
                <span className="note">Used in the course and suggested for your certificate.</span></label>
              <label className="fld">City (optional)<input name="city" defaultValue={p.city || ""} autoComplete="address-level2" maxLength={60} placeholder="e.g. Ibadan" /></label>
            </div>
            <label className="check"><input type="checkbox" name="public_profile" defaultChecked={p.public_profile} />
              <span><b>Show my name publicly.</b> Your name and city appear on the leaderboard and next to your community posts, and you can create a Hire talent profile. When this is off, other learners don&rsquo;t see your name. Your certificate&rsquo;s verification page always shows the name on the certificate to anyone with its ID.</span></label>
            <label className="check"><input type="checkbox" name="marketing_consent" defaultChecked={p.marketing_consent} />
              <span>Send me course news and offers by email. You&rsquo;ll still get receipts and account emails if this is off.</span></label>
            <div className="row"><button className="btn" type="submit">Save profile</button></div>
          </form>
          <p className="note">Email: {p.email}. Need to change it? Write to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. · <Link href="/reset-password">Change password</Link></p>
        </div>
      </section>

      <section id="purchases" aria-label="Purchases"><Purchases refund={sp.refund} /></section>
      <section id="referral" aria-label="Referrals"><Referral /></section>
      <section id="certificate" aria-label="Certificate"><Certificate notice={sp.cert === "issued" ? "Your certificate has been issued." : undefined} error={sp.cert_error} /></section>

      <section id="whatsapp" aria-label="Learn on WhatsApp"><WhatsApp notice={sp.wa} /></section>

      <section id="data" aria-labelledby="data-h">
        <div className="card">
          <h2 id="data-h">Your data</h2>
          <p>You can download a copy of the data we hold about you, or ask us to delete your account. See the <Link href="/legal/privacy">privacy policy</Link> for what we keep and why.</p>
          <div className="row"><a className="btn alt" href="/account/data" download>Download my data (JSON)</a></div>

          <details className="danger">
            <summary>Delete my account</summary>
            {sp.deletion === "requested"
              ? <p className="alert ok" role="status">We&rsquo;ve received your request and emailed you a confirmation. We&rsquo;ll delete your account within 30 days and email you when it&rsquo;s done.</p>
              : <form action={requestDeletion} className="stack">
                  <p>We&rsquo;ll delete your account, progress, submissions and community posts. We keep payment records for as long as the law requires, and a minimal record of any certificate so it can still be verified unless you ask us to remove it. Paid access you haven&rsquo;t used isn&rsquo;t refunded unless the <Link href="/legal/refunds">refund policy</Link> allows it.</p>
                  <label className="fld">Anything you&rsquo;d like to tell us? (optional)<textarea name="reason" maxLength={1000} style={{ minHeight: 80 }} /></label>
                  <label className="check"><input type="checkbox" name="confirm" required /> <span>I understand this can&rsquo;t be undone.</span></label>
                  <div className="row"><button className="btn" type="submit" style={{ background: "var(--glitch)" }}>Request deletion</button></div>
                </form>}
          </details>
        </div>
      </section>

      <section aria-label="Sign out">
        <form action="/auth/signout" method="post"><button className="btn alt" type="submit">Sign out</button></form>
      </section>
    </div>
  );
}
