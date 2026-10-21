import Link from "next/link";
import type { Metadata } from "next";
import { getUser } from "@/lib/auth";
import { hasPaystack } from "@/lib/config";
import { REFERRAL, product } from "@/lib/pricing";
import { fmtDate, ngn } from "@/lib/format";
import { COHORT_COMMISSION_CAP, moneyText, toMinor } from "@/lib/money";
import { listBanks } from "@/lib/paystack";
import { referralSummary } from "@/lib/referrals";
import { requestPayout, savePayoutAccount } from "@/lib/actions/payments";
import "../checkout/checkout.css";

export const metadata: Metadata = { title: "Earn with Automancy", description: "Refer friends to Automancy Academy and earn up to 30% of what they pay." };
export const dynamic = "force-dynamic";

const pct = (n: number) => `${Math.round(n * 100)}%`;
const EARN_STATUS: Record<string, string> = { pending: "warn", approved: "ok", paid: "ok", reversed: "bad" };

export default async function Earn({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await getUser();
  const r = user ? await referralSummary(user.id) : null;
  const banks = user && hasPaystack() ? await listBanks() : [];
  const self = product("self");

  return (
    <section className="wrap stack" style={{ gap: 24 }}>
      <header className="stack" style={{ gap: 8 }}>
        <p className="eyebrow">Referral programme</p>
        <h1>Share Automancy. Earn when friends learn.</h1>
        <p className="lede">Your friends get {pct(REFERRAL.friendDiscount)} off a plan. You earn {pct(REFERRAL.tiers.friend)} to {pct(REFERRAL.tiers.ambassador)} of what they pay, paid into your Nigerian bank account.</p>
      </header>

      <div className="grid3">
        <div className="card"><p className="eyebrow">Friend</p><h3>{pct(REFERRAL.tiers.friend)} commission</h3><p className="muted">Everyone with an account starts here.</p></div>
        <div className="card"><p className="eyebrow">Graduate</p><h3>{pct(REFERRAL.tiers.graduate)} commission</h3><p className="muted">Once you hold a valid Automancy certificate.</p></div>
        <div className="card"><p className="eyebrow">Ambassador</p><h3>{pct(REFERRAL.tiers.ambassador)} commission</h3><p className="muted">10 or more paying referrals in the last 90 days. Cohort seats are capped at {pct(COHORT_COMMISSION_CAP)}.</p></div>
      </div>

      <div className="card prose">
        <h2 style={{ marginTop: 0 }}>How it works</h2>
        <ol>
          <li>Share your link. When someone opens it, we remember your code on their device for {REFERRAL.attributionDays} days. They can also type your code at checkout.</li>
          <li>They get {pct(REFERRAL.friendDiscount)} off Self-paced{self ? ` (${ngn(self.ngn * (1 - REFERRAL.friendDiscount))} instead of ${ngn(self.ngn)})` : ""}, the Cohort, or their first month of Membership. Membership renewals and add-ons have no discount.</li>
          <li>You earn your tier's share of what they actually pay, on every plan payment, including each Pay-in-3 instalment. Template packs earn a flat {pct(REFERRAL.packCommission)}; Cohort seats earn at most {pct(COHORT_COMMISSION_CAP)}.</li>
          <li>Earnings stay <b>pending</b> for {REFERRAL.refundWindowDays} days (our refund window). If the buyer is refunded, the earning is reversed.</li>
          <li>After that we approve them. Once your approved balance reaches {ngn(REFERRAL.minPayoutNgn)}, request a payout and we pay it to your bank account.</li>
        </ol>
        <p className="note">You can't use your own code (or one belonging to the same email address), and earnings from self-referrals or fake accounts are reversed. Payouts are made by bank transfer in naira; full terms are in our <Link href="/legal/terms">terms</Link>.</p>
      </div>

      {!user || !r ? (
        <div className="card bold"><h2 style={{ fontSize: "1.4rem" }}>Get your link</h2><p>Every Automancy account has a referral code, including free ones.</p>
          <div className="row"><Link className="btn" href="/signup?next=/earn">Create a free account</Link><Link className="btn alt" href="/login?next=/earn">Log in</Link></div></div>
      ) : (
        <>
          <div className="card bold">
            <h2 style={{ fontSize: "1.4rem" }}>Your link</h2>
            {r.link ? <p className="reflink">{r.link}</p> : <p className="muted">Your code is being set up. Refresh in a minute.</p>}
            {r.code && <p className="note">Code: <b>{r.code}</b> · Your tier: <b>{r.tier.tier}</b> ({pct(r.tier.rate)})</p>}
            <p className="note">We don't track link clicks; you'll see people who signed up or paid with your code.</p>
            <div className="grid4">
              <div className="kpi"><b>{r.signups}</b><span>signed up through you</span></div>
              <div className="kpi"><b>{r.paidBuyers}</b><span>paying referrals ({r.payments} payments)</span></div>
              <div className="kpi"><b>{moneyText(r.pendingKobo)}</b><span>pending (refund window)</span></div>
              <div className="kpi"><b>{moneyText(r.approvedKobo)}</b><span>approved, ready to pay out</span></div>
              <div className="kpi"><b>{moneyText(r.inPayoutKobo)}</b><span>in a payout</span></div>
              <div className="kpi"><b>{moneyText(r.paidKobo)}</b><span>paid to you</span></div>
            </div>
          </div>

          <div className="card">
            <h2 style={{ fontSize: "1.3rem" }}>Earnings</h2>
            {r.earnings.length === 0 ? <p className="empty">No earnings yet. Share your link to get started.</p> : (
              <div className="scroll"><table className="dt">
                <thead><tr><th>Date</th><th>Amount</th><th>Rate</th><th>Status</th><th>Available</th></tr></thead>
                <tbody>{r.earnings.map(e => (
                  <tr key={e.id}><td>{fmtDate(e.created_at)}</td><td>{moneyText(e.amount_kobo)}</td><td>{pct(Number(e.rate))} · {e.tier}</td>
                    <td><span className={`pill ${EARN_STATUS[e.status] || ""}`}>{e.status === "approved" && e.payout_id ? "in payout" : e.status}</span></td>
                    <td>{e.status === "pending" ? fmtDate(e.available_at) : "-"}</td></tr>
                ))}</tbody>
              </table></div>
            )}
          </div>

          <div className="card" id="payouts">
            <h2 style={{ fontSize: "1.3rem" }}>Payouts</h2>
            {sp.saved && <p className="alert ok" role="status">Bank account saved.</p>}
            {sp.payout === "requested" && <p className="alert ok" role="status">Payout requested. We pay within 5 working days.</p>}
            {sp.payout_error && <p className="alert bad" role="alert">{sp.payout_error}</p>}
            {r.account ? (
              <p>Paying to <b>{r.account.account_name || "your account"}</b>, {r.account.bank_name} ····{r.account.account_last4}{r.account.paystack_recipient_code ? "" : " (to be checked by our team)"}.</p>
            ) : <p className="muted">Add the bank account we should pay you into.</p>}
            <details open={!r.account}>
              <summary style={{ cursor: "pointer", fontWeight: 700 }}>{r.account ? "Change bank account" : "Add bank account"}</summary>
              <form action={savePayoutAccount} className="stack" style={{ marginTop: 10 }}>
                {banks.length > 0 ? (
                  <label className="fld">Bank
                    <select name="bank_code" required defaultValue={r.account?.bank_code || ""}>
                      <option value="" disabled>Choose your bank</option>
                      {banks.map(b => <option key={`${b.code}-${b.name}`} value={b.code}>{b.name}</option>)}
                    </select>
                  </label>
                ) : (
                  <>
                    <label className="fld">Bank name<input name="bank_name" required maxLength={100} defaultValue={r.account?.bank_name || ""} /></label>
                    <label className="fld">Account name<input name="account_name" required maxLength={100} defaultValue={r.account?.account_name || ""} /></label>
                  </>
                )}
                <label className="fld">Account number (10 digits)<input name="account_number" required inputMode="numeric" pattern="[0-9]{10}" maxLength={10} autoComplete="off" /></label>
                <p className="note">{banks.length > 0 ? "We check the account name with Paystack and store only the last 4 digits." : "We store only the last 4 digits; our team confirms the account before paying."}</p>
                <button className="btn alt" type="submit">Save bank account</button>
              </form>
            </details>
            <form action={requestPayout} className="row">
              <button className="btn" type="submit" disabled={!r.account || r.approvedKobo < toMinor(REFERRAL.minPayoutNgn)}>Request payout of {moneyText(r.approvedKobo)}</button>
              <span className="note">Minimum {ngn(REFERRAL.minPayoutNgn)} approved.</span>
            </form>
            {r.payouts.length > 0 && (
              <div className="scroll"><table className="dt">
                <thead><tr><th>Requested</th><th>Amount</th><th>Status</th><th>Paid</th></tr></thead>
                <tbody>{r.payouts.map(p => (
                  <tr key={p.id}><td>{fmtDate(p.created_at)}</td><td>{moneyText(p.amount_kobo)}</td>
                    <td><span className={`pill ${p.status === "paid" ? "ok" : p.status === "failed" ? "bad" : "warn"}`}>{p.status}</span></td>
                    <td>{p.paid_at ? fmtDate(p.paid_at) : "-"}</td></tr>
                ))}</tbody>
              </table></div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
