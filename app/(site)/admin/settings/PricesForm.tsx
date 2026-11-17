import { Fragment } from "react";
import { PRODUCTS } from "@/lib/pricing";
import { resetPrices, savePrices } from "@/lib/actions/prices";
import type { PriceSettings } from "@/lib/price-settings-core";

const pc = (r: number) => Math.round(r * 1000) / 10;            // 0.125 → 12.5
const KIND: Record<string, string> = { plan: "Plans", addon: "Add-ons", business: "Business" };

/** Admin → Settings → Prices and fees. Every amount a learner, employer, referrer or creator sees or pays. */
export function PricesForm({ s, d, msg }: { s: PriceSettings; d: PriceSettings; msg: { saved?: string; reset?: string; error?: string } }) {
  const rows = PRODUCTS.filter(p => s.products[p.id]);
  return (
    <section id="prices" className="stack" style={{ marginTop: 10 }}>
      <h2 style={{ fontSize: "1.3rem" }}>Prices and fees</h2>
      <p className="muted">Everything people pay or earn on Automancy. Changes apply at once to the website, checkout and WhatsApp; anyone already halfway through paying keeps the price they were shown, and Pay in instalments plans already started keep their amounts. Grey numbers are the original defaults.</p>
      {msg.saved && <p className="alert ok" role="status">{msg.reset ? "Prices reset to the defaults." : "Prices saved."} {msg.saved === "0" ? "Nothing had changed." : `${msg.saved} value${msg.saved === "1" ? "" : "s"} changed.`}</p>}
      {msg.error && <p className="alert bad" role="alert">{msg.error}</p>}

      <form action={savePrices} className="card stack">
        <h3>Products</h3>
        <div className="scroll"><table className="dt">
          <thead><tr><th>Product</th><th>Naira (₦)</th><th>Dollars ($)</th><th>Pay in instalments (naira)</th></tr></thead>
          <tbody>{rows.map((p, i) => {
            const v = s.products[p.id], dv = d.products[p.id];
            const head = i === 0 || rows[i - 1].kind !== p.kind;
            return (<Fragment key={p.id}>
              {head && <tr><td colSpan={4} className="note"><b>{KIND[p.kind] || p.kind}</b></td></tr>}
              <tr>
                <td><b>{p.name}</b><div className="note">{p.period}{p.id === "cohort" ? " · shown when the cohort is open" : ""}</div></td>
                <td><input name={`p_${p.id}_ngn`} type="number" min={100} step={100} required defaultValue={v.ngn} style={{ width: 130 }} aria-label={`${p.name} naira price`} />
                  <div className="note">default {dv.ngn.toLocaleString("en-NG")}</div></td>
                <td><input name={`p_${p.id}_usd`} type="number" min={0} step={0.01} required defaultValue={v.usd} style={{ width: 100 }} aria-label={`${p.name} dollar price`} />
                  <div className="note">default {dv.usd}</div></td>
                <td>
                  <label className="check"><input type="checkbox" name={`p_${p.id}_inst`} defaultChecked={!!v.installments} /> <span>Offer</span></label>
                  <div className="row" style={{ gap: 6, alignItems: "center" }}>
                    <input name={`p_${p.id}_count`} type="number" min={2} max={12} step={1} defaultValue={v.installments?.count ?? 3} style={{ width: 64 }} aria-label={`${p.name} number of payments`} />
                    <span>payments of ₦</span>
                    <input name={`p_${p.id}_each`} type="number" min={100} step={100} defaultValue={v.installments?.ngn ?? Math.ceil(v.ngn / 3 / 100) * 100} style={{ width: 110 }} aria-label={`${p.name} amount per payment`} />
                  </div>
                  {v.installments && <div className="note">= ₦{(v.installments.count * v.installments.ngn).toLocaleString("en-NG")} in total</div>}
                </td>
              </tr>
            </Fragment>);
          })}</tbody>
        </table></div>

        <h3>Referrals</h3>
        <div className="grid3">
          <label className="fld">Friend&apos;s discount (%)<input name="r_friendDiscount" type="number" min={0} max={90} step={0.1} required defaultValue={pc(s.referral.friendDiscount)} /><span className="note">Off a referred person&apos;s first purchase. Default {pc(d.referral.friendDiscount)}%.</span></label>
          <label className="fld">Minimum payout (₦)<input name="r_minPayout" type="number" min={0} step={100} required defaultValue={s.referral.minPayoutNgn} /><span className="note">Default {d.referral.minPayoutNgn.toLocaleString("en-NG")}.</span></label>
          <label className="fld">Refund window (days)<input name="r_refundDays" type="number" min={0} max={90} step={1} required defaultValue={s.referral.refundWindowDays} /><span className="note">For refunds, and before referral and creator earnings become available. Default {d.referral.refundWindowDays}.</span></label>
        </div>
        <div className="grid3">
          <label className="fld">Commission: friend (%)<input name="r_friend" type="number" min={0} max={90} step={0.1} required defaultValue={pc(s.referral.friend)} /><span className="note">Default {pc(d.referral.friend)}%.</span></label>
          <label className="fld">Commission: graduate (%)<input name="r_graduate" type="number" min={0} max={90} step={0.1} required defaultValue={pc(s.referral.graduate)} /><span className="note">Referrers with a certificate. Default {pc(d.referral.graduate)}%.</span></label>
          <label className="fld">Commission: ambassador (%)<input name="r_ambassador" type="number" min={0} max={90} step={0.1} required defaultValue={pc(s.referral.ambassador)} /><span className="note">10+ paid referrals in 90 days. Default {pc(d.referral.ambassador)}%.</span></label>
        </div>
        <div className="grid3">
          <label className="fld">Commission: template packs (%)<input name="r_pack" type="number" min={0} max={90} step={0.1} required defaultValue={pc(s.referral.packCommission)} /><span className="note">Default {pc(d.referral.packCommission)}%.</span></label>
        </div>

        <h3>Creator courses</h3>
        <div className="grid3">
          <label className="fld">Creator&apos;s share (%)<input name="m_share" type="number" min={0} max={100} step={0.1} required defaultValue={pc(s.market.revenueShare)} /><span className="note">After the Paystack fee, for new creators. Change one creator in Admin → Courses. Default {pc(d.market.revenueShare)}%.</span></label>
          <label className="fld">Lowest price (₦)<input name="m_minNgn" type="number" min={100} step={100} required defaultValue={s.market.minPriceNgn} /><span className="note">Default {d.market.minPriceNgn.toLocaleString("en-NG")}.</span></label>
          <label className="fld">Highest price (₦)<input name="m_maxNgn" type="number" min={100} step={100} required defaultValue={s.market.maxPriceNgn} /><span className="note">Default {d.market.maxPriceNgn.toLocaleString("en-NG")}.</span></label>
        </div>
        <div className="grid3">
          <label className="fld">Lowest dollar price ($)<input name="m_minUsd" type="number" min={0} step={0.01} required defaultValue={s.market.minPriceUsd} /><span className="note">Default {d.market.minPriceUsd}.</span></label>
          <label className="fld">Highest dollar price ($)<input name="m_maxUsd" type="number" min={0} step={0.01} required defaultValue={s.market.maxPriceUsd} /><span className="note">Default {d.market.maxPriceUsd}.</span></label>
        </div>
        <label className="check"><input type="checkbox" name="apply_existing_creators" /> <span>Also move existing creators who are on the current default share to the new share (creators you gave a custom share keep theirs)</span></label>

        <div className="row"><button className="btn" type="submit">Save prices and fees</button></div>
      </form>
      <form action={resetPrices} className="row">
        <button className="btn alt sm" type="submit">Reset everything to the defaults</button>
      </form>
    </section>
  );
}
