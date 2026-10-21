import { requestIntro } from "@/lib/actions/community";
import { ActionForm } from "@/app/(site)/community/_components/ActionForm";

/** Employer intro request. Stored for the team and emailed to support; graduates' contact details are never shown. */
export function IntroForm({ profileUserId, cta = "Request introduction" }: { profileUserId?: string; cta?: string }) {
  return (
    <ActionForm action={requestIntro} reset className="stack" label="Request an introduction">
      {profileUserId && <input type="hidden" name="profileUserId" value={profileUserId} />}
      <input type="hidden" name="t" value={String(Date.now())} />
      <div className="hp" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <div className="grid2">
        <label className="fld">Your name<input name="employer_name" required minLength={2} maxLength={120} autoComplete="name" /></label>
        <label className="fld">Company<input name="company" maxLength={120} autoComplete="organization" /></label>
      </div>
      <label className="fld">Work email<input name="email" type="email" required maxLength={200} autoComplete="email" placeholder="you@company.com" /></label>
      <label className="fld">Role or project<input name="role" maxLength={160} placeholder="e.g. n8n contractor, 3 months, remote" /></label>
      <label className="fld">Message<textarea name="message" maxLength={2000} placeholder="What they'd automate, budget or salary range, start date" /></label>
      <p className="note">We read every request and introduce you by email, usually within two working days. We never share graduates&apos; contact details publicly.</p>
      <div className="row"><button className="btn" type="submit">{cta}</button></div>
    </ActionForm>
  );
}
