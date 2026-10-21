import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { REFERRAL } from "@/lib/pricing";
import { moneyText } from "@/lib/money";
import { referralSummary } from "@/lib/referrals";

/** The learner's referral link and earnings at a glance (account page). Full details live on /earn. */
export default async function Referral() {
  const user = await requireUser("/account");
  const r = await referralSummary(user.id);
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  return (
    <div className="card" aria-labelledby="referral-h">
      <h2 id="referral-h" style={{ fontSize: "1.5rem" }}>Refer a friend</h2>
      <p className="muted">Friends get {pct(REFERRAL.friendDiscount)} off a plan. You earn {pct(r.tier.rate)} of what they pay ({r.tier.tier} tier).</p>
      {r.link ? <p className="reflink" style={{ fontFamily: "var(--mono)", wordBreak: "break-all" }}>{r.link}</p> : <p className="muted">Your code is being set up. Refresh in a minute.</p>}
      {r.code && <p className="note">Or they can type your code at checkout: <b>{r.code}</b></p>}
      <div className="grid4">
        <div className="kpi"><b>{r.signups}</b><span>signed up</span></div>
        <div className="kpi"><b>{r.paidBuyers}</b><span>paid</span></div>
        <div className="kpi"><b>{moneyText(r.pendingKobo)}</b><span>pending</span></div>
        <div className="kpi"><b>{moneyText(r.paidKobo)}</b><span>paid to you</span></div>
      </div>
      <p><Link href="/earn">Earnings, payouts and how it works</Link></p>
    </div>
  );
}
