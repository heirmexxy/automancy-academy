import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getCreator } from "@/lib/marketplace";
import { applyToTeach } from "@/lib/actions/marketplace";
import { fmtDate } from "@/lib/format";
import "../../courses/marketplace.css";

export const metadata: Metadata = { title: "Apply to teach" };
export const dynamic = "force-dynamic";

export default async function Apply({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await requireUser("/teach/apply");
  const c = await getCreator(user.id);
  if (c?.status === "suspended") {
    return <section className="narrow stack"><h1 style={{ fontSize: "2rem" }}>Creator account suspended</h1><p>Your creator account is suspended. Contact support if you'd like to discuss it.</p></section>;
  }
  return (
    <section className="narrow stack">
      <p className="eyebrow">Teach on Automancy</p>
      <h1 style={{ fontSize: "clamp(2rem,5vw,2.6rem)" }}>{c ? "Your creator application" : "Apply to teach"}</h1>
      {c?.status === "approved" && <p className="alert ok">You're approved. <Link href="/teach/studio">Open the creator studio</Link>.</p>}
      {c?.status === "applied" && <p className="alert warn" role="status">We received your application on {fmtDate(c.created_at)}. We'll email you once we've reviewed it (usually within a week). You can update it below.</p>}
      {sp.sent && <p className="alert ok" role="status">Saved. Thank you!</p>}
      {sp.error && <p className="alert bad" role="alert">{sp.error}</p>}
      <form action={applyToTeach} className="card stack">
        <label className="fld">Name learners will see<input name="display_name" required minLength={2} maxLength={80} defaultValue={c?.display_name || ""} /></label>
        <label className="fld">Short bio<textarea name="bio" required minLength={50} maxLength={2000} defaultValue={c?.bio || ""} placeholder="What do you do, and what have you built or achieved that qualifies you to teach?" /></label>
        <label className="fld">What do you want to teach?<textarea name="application_note" required minLength={50} maxLength={3000} defaultValue={c?.application_note || ""} placeholder="Course idea(s), who it's for, and what learners will be able to do at the end." /></label>
        <label className="fld">Website or LinkedIn (optional)<input name="website" type="url" maxLength={300} placeholder="https://" defaultValue={c?.website || ""} /></label>
        <label className="fld">Photo URL (optional, https)<input name="photo_url" type="url" maxLength={500} placeholder="https://" defaultValue={c?.photo_url || ""} /></label>
        <label className="check"><input type="checkbox" name="agree" required defaultChecked={!!c} /> <span>I've read and accept the <Link href="/teach/terms" target="_blank">creator terms</Link>, and my courses will be my own original work.</span></label>
        <button className="btn" type="submit" style={{ justifySelf: "start" }}>{c ? "Update application" : "Send application"}</button>
      </form>
    </section>
  );
}
