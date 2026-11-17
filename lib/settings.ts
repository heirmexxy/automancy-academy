import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { FEATURES } from "@/lib/config";

export type Settings = { cohort_open: boolean; live_calls_visible: boolean; next_cohort_date: string | null; ai_review_auto: boolean };
const DEFAULTS: Settings = { cohort_open: FEATURES.cohortDefault, live_calls_visible: false, next_cohort_date: null, ai_review_auto: true };

/** Runtime feature switches stored in the `settings` table (Admin → Settings). */
export async function getSettings(): Promise<Settings> {
  try {
    const db = createAdminClient();
    const { data } = await db.from("settings").select("key, value");
    const out: Record<string, unknown> = { ...DEFAULTS };
    (data || []).forEach(r => { out[r.key] = r.value; });
    return out as Settings;
  } catch { return DEFAULTS; }
}
