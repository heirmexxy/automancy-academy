import Link from "next/link";
import type { Metadata } from "next";
import "../../community/community.css";
import { requireUser, getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { saveHireProfile } from "@/lib/actions/community";
import { ActionForm } from "../../community/_components/ActionForm";
import { AVAILABILITY } from "../../community/_lib/rules";
import { HIRE_COLS, type HireProfile } from "../_lib";

export const metadata: Metadata = { title: "Your Hire talent profile" };
export const dynamic = "force-dynamic";

export default async function EditHireProfile() {
  const user = await requireUser("/hire/profile");
  const sb = await createClient();
  const [{ data: certData }, { data: existing }, profile] = await Promise.all([
    sb.rpc("my_certificate"),
    sb.from("hire_profiles").select(`${HIRE_COLS}, visible, hidden_by_admin`).eq("user_id", user.id).maybeSingle(),
    getProfile()
  ]);
  const cert = (Array.isArray(certData) ? certData[0] : certData) as { id: string; name_on_certificate: string } | null;
  const p = existing as (HireProfile & { visible: boolean; hidden_by_admin: boolean }) | null;

  if (!cert) {
    return (
      <div className="narrow community stack">
        <span className="eyebrow">Hire talent</span>
        <h1>Your Hire talent profile</h1>
        <p className="lede">Profiles on Hire talent are for certified graduates, so employers know every person listed has done the work.</p>
        <div className="card stack">
          <h2 style={{ fontSize: "1.3rem" }}>How to get listed</h2>
          <ol className="prose" style={{ margin: 0 }}>
            <li>Finish the lessons and the six boss projects.</li>
            <li>Submit your capstone (6.4) for review in the course.</li>
            <li>When it passes, your certificate is issued and appears in <Link href="/account">Account</Link>.</li>
            <li>Come back here to publish your profile.</li>
          </ol>
          <div className="row"><Link className="btn" href="/learn">Continue the course</Link><Link className="btn alt" href="/hire">See Hire talent</Link></div>
        </div>
        {p && <p className="note">You have a saved profile, but it isn&apos;t shown while there&apos;s no valid certificate on your account.</p>}
      </div>
    );
  }

  return (
    <div className="narrow community stack">
      <span className="eyebrow">Hire talent</span>
      <h1>Your Hire talent profile</h1>
      <p className="lede">Employers see this on <Link href="/hire">Hire talent</Link>. They contact us through a form; we introduce you by email, so your email and phone stay private.</p>
      {p?.hidden_by_admin && <p className="alert bad">Our team has hidden your profile from the directory. Email us if you think this is a mistake.</p>}
      {p && !p.hidden_by_admin && p.visible && <p className="alert ok">Your profile is live. <Link href={`/hire/${user.id}`}>View it</Link>.</p>}
      <div className="card">
        <p className="note">Shown as <b>{cert.name_on_certificate || profile?.full_name}</b> (the name on certificate <code>{cert.id}</code>).</p>
        <ActionForm action={saveHireProfile} className="stack" label="Hire talent profile">
          <label className="fld">Headline<input name="headline" required minLength={3} maxLength={120} defaultValue={p?.headline || ""} placeholder="e.g. n8n and WhatsApp automations for small businesses" /></label>
          <label className="fld">About you<textarea name="bio" maxLength={2000} defaultValue={p?.bio || ""} placeholder="What you've built (your capstone counts), the kind of work you want, industries you know" /></label>
          <div className="grid2">
            <label className="fld">Tools (comma separated)<input name="tools" maxLength={600} defaultValue={(p?.tools || []).join(", ")} placeholder="Zapier, Make, n8n, Google Sheets" /></label>
            <label className="fld">Skills (comma separated)<input name="skills" maxLength={600} defaultValue={(p?.skills || []).join(", ")} placeholder="AI agents, WhatsApp, CRM, Paystack" /></label>
          </div>
          <label className="fld">Portfolio links (one per line, https://)<textarea name="portfolio_links" rows={3} maxLength={2600} defaultValue={(p?.portfolio_links || []).join("\n")} placeholder="https://loom.com/…" /></label>
          <div className="grid2">
            <label className="fld">City<input name="city" maxLength={60} defaultValue={p?.city ?? profile?.city ?? ""} placeholder="e.g. Ibadan or Remote" /></label>
            <label className="fld">Availability
              <select name="availability" defaultValue={p?.availability || "contract"}>
                {Object.entries(AVAILABILITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          </div>
          <label className="fld">Rate or salary note (optional)<input name="rate_note" maxLength={80} defaultValue={p?.rate_note || ""} placeholder="e.g. From ₦25,000/hour or negotiable" /></label>
          <label className="check"><input type="checkbox" name="visible" defaultChecked={p ? p.visible : true} /> Show my profile on Hire talent</label>
          <p className="note">Don&apos;t put your phone number or email here; employers reach you through us.</p>
          <div className="row"><button className="btn" type="submit">Save profile</button></div>
        </ActionForm>
      </div>
    </div>
  );
}
