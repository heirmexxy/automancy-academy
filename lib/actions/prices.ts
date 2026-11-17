"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PRODUCTS } from "@/lib/pricing";
import { loadPrices, priceDefaults, storePrices } from "@/lib/price-settings";
import { priceProblems, sanitizePriceSettings, type PriceSettings } from "@/lib/price-settings-core";

const back = (q: Record<string, string>): never => redirect(`/admin/settings?${new URLSearchParams(q).toString()}#prices`);
const f = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim().replace(/[,\s₦$%]/g, "");
const n = (fd: FormData, k: string) => { const v = f(fd, k); return v === "" ? NaN : Number(v); };
const whole = (fd: FormData, k: string) => Math.round(n(fd, k));
const cents = (fd: FormData, k: string) => Math.round(n(fd, k) * 100) / 100;
const pct = (fd: FormData, k: string) => Math.round(n(fd, k) * 10) / 1000;   // "12.5" → 0.125

/** Flattens settings for the "Recent changes" log: { "self.ngn": 45000, "referral.friend": 0.2, … }. */
function flat(s: PriceSettings): Record<string, number | string> {
  const out: Record<string, number | string> = {};
  for (const [id, p] of Object.entries(s.products)) {
    out[`${id}.ngn`] = p.ngn; out[`${id}.usd`] = p.usd;
    out[`${id}.pay_in`] = p.installments ? `${p.installments.count} × ${p.installments.ngn}` : "off";
  }
  for (const [k, v] of Object.entries(s.referral)) out[`referral.${k}`] = v;
  for (const [k, v] of Object.entries(s.market)) out[`creators.${k}`] = v;
  return out;
}

async function save(next: PriceSettings, before: PriceSettings, actorId: string, applyToCreators: boolean) {
  const db = createAdminClient();
  try { await storePrices(next, actorId); }
  catch { back({ price_error: "Couldn't save the prices. Run the database update 0014_price_settings.sql in Supabase, then try again." }); }

  // Optionally move creators who are still on the old default share to the new one (custom shares are left alone).
  if (applyToCreators && next.market.revenueShare !== before.market.revenueShare) {
    await db.from("creators").update({ revenue_share: next.market.revenueShare }).eq("revenue_share", before.market.revenueShare);
  }
  const a = flat(before), b = flat(next);
  const changed = Object.keys(b).filter(k => String(a[k]) !== String(b[k]));
  if (changed.length) {
    await db.from("audit_log").insert({
      actor: actorId, action: "settings.update", target: "prices",
      detail: { changed, before: Object.fromEntries(changed.map(k => [k, a[k]])), after: Object.fromEntries(changed.map(k => [k, b[k]])) }
    });
  }
  revalidatePath("/", "layout");
  return changed.length;
}

/** Admin → Settings → Prices and fees. */
export async function savePrices(fd: FormData) {
  const admin = await requireAdmin();
  const before = await loadPrices(true);
  const d = priceDefaults();
  const raw: PriceSettings = { products: {}, referral: { ...before.referral }, market: { ...before.market } };
  const names: Record<string, string> = {};
  for (const id of Object.keys(d.products)) {
    names[id] = PRODUCTS.find(p => p.id === id)?.name || id;
    const payIn = fd.get(`p_${id}_inst`) !== null;
    raw.products[id] = {
      ngn: whole(fd, `p_${id}_ngn`), usd: cents(fd, `p_${id}_usd`),
      installments: payIn ? { count: whole(fd, `p_${id}_count`), ngn: whole(fd, `p_${id}_each`) } : null
    };
    if (!(raw.products[id].ngn >= 100)) back({ price_error: `${names[id]}: enter a naira price of at least ₦100.` });
    if (!(raw.products[id].usd >= 0)) back({ price_error: `${names[id]}: enter a dollar price (0 hides the dollar option).` });
    if (payIn && !(Number(raw.products[id].installments?.count) >= 2 && Number(raw.products[id].installments?.ngn) >= 100))
      back({ price_error: `${names[id]}: Pay in instalments needs 2–12 payments of at least ₦100 each, or untick it.` });
  }
  raw.referral = {
    friendDiscount: pct(fd, "r_friendDiscount"), friend: pct(fd, "r_friend"), graduate: pct(fd, "r_graduate"),
    ambassador: pct(fd, "r_ambassador"), packCommission: pct(fd, "r_pack"), minPayoutNgn: whole(fd, "r_minPayout"),
    refundWindowDays: whole(fd, "r_refundDays")
  };
  raw.market = { revenueShare: pct(fd, "m_share"), minPriceNgn: whole(fd, "m_minNgn"), maxPriceNgn: whole(fd, "m_maxNgn"), minPriceUsd: cents(fd, "m_minUsd"), maxPriceUsd: cents(fd, "m_maxUsd") };
  for (const [k, v] of [...Object.entries(raw.referral), ...Object.entries(raw.market)])
    if (!Number.isFinite(v)) back({ price_error: `Fill in every field (${k} is empty or not a number).` });

  const next = sanitizePriceSettings(raw, d);
  // sanitize falls back to the default for out-of-range values: tell the admin instead of silently changing them.
  const outOfRange = Object.entries(flat(raw as PriceSettings)).filter(([k, v]) => String(flat(next)[k]) !== String(v) && !/pay_in/.test(k)).map(([k]) => k);
  if (outOfRange.length) back({ price_error: `Out of range: ${outOfRange.join(", ")}. Percentages are 0–90 (creator share 0–100), refund window 0–90 days.` });
  const problems = priceProblems(next, names);
  if (problems.length) back({ price_error: problems.join(" ") });

  const changed = await save(next, before, admin.id, fd.get("apply_existing_creators") !== null);
  back({ prices_saved: String(changed) });
}

/** Puts every price and fee back to the original defaults. */
export async function resetPrices() {
  const admin = await requireAdmin();
  const before = await loadPrices(true);
  const changed = await save(priceDefaults(), before, admin.id, false);
  back({ prices_saved: String(changed), reset: "1" });
}
