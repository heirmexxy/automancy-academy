import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { PRODUCTS, REFERRAL, type ProductId } from "@/lib/pricing";
import { MARKET } from "@/app/(site)/courses/_lib/core";
import { applyPriceSettings, defaultPriceSettings, sanitizePriceSettings, type PriceSettings } from "@/lib/price-settings-core";

/**
 * Prices and fees set in Admin → Settings → Prices and fees (table platform_prices, one row).
 * The code defaults in lib/pricing.ts and courses/_lib/core.ts stay as the fallback; loadPrices() lays the saved
 * values over them in place, so every page, checkout and payment check that reads PRODUCTS / REFERRAL / MARKET
 * uses the admin's numbers. Call it at the top of anything that shows or charges a price.
 */
const DEFAULTS: PriceSettings = defaultPriceSettings(PRODUCTS, REFERRAL, MARKET);
const TTL_MS = 30_000;
let loadedAt = 0;
let inflight: Promise<PriceSettings> | null = null;
let current: PriceSettings = DEFAULTS;

export const priceDefaults = () => DEFAULTS;
export const currentPrices = () => current;

function apply(s: PriceSettings) {
  current = s;
  applyPriceSettings(s, PRODUCTS, REFERRAL, MARKET as unknown as Record<string, number>);
}

/** Loads the saved prices (cached for 30 seconds) and applies them. Never throws: on any error the last known values stay. */
export async function loadPrices(force = false): Promise<PriceSettings> {
  if (!force && Date.now() - loadedAt < TTL_MS) return current;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return current;
      const { data, error } = await createAdminClient().from("platform_prices").select("data").eq("id", 1).maybeSingle();
      if (error) { console.error("[prices] load failed", error.message); return current; }
      apply(sanitizePriceSettings(data?.data, DEFAULTS));
      loadedAt = Date.now();
      return current;
    } catch (e) {
      console.error("[prices] load failed", e);
      return current;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Saves new prices (already validated) and applies them at once in this server. */
export async function storePrices(s: PriceSettings, actor: string) {
  const db = createAdminClient();
  const { error } = await db.from("platform_prices").upsert({ id: 1, data: s, updated_at: new Date().toISOString(), updated_by: actor });
  if (error) throw new Error(error.message);
  apply(s);
  loadedAt = Date.now();
}

export type { PriceSettings, ProductId };
