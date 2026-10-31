"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PRODUCTS } from "@/lib/pricing";
import { DISCOUNT_CODE_MAX_PERCENT, endOfLagosDay, normaliseCode, startOfLagosDay } from "@/lib/money";

const s = (f: FormData, k: string, max = 300) => String(f.get(k) ?? "").trim().slice(0, max);
const back: (q: Record<string, string>) => never = q => redirect(`/admin/settings?${new URLSearchParams(q).toString()}#discounts`);
const PAID = PRODUCTS.filter(p => p.ngn > 0 && p.id !== "team").map(p => p.id as string);

async function audit(actor: string, action: string, target: string, detail: unknown) {
  await createAdminClient().from("audit_log").insert({ actor, action, target, detail });
}

/** Admin → Settings → Discount codes: create a code, or update the settings of an existing one. */
export async function saveDiscountCode(formData: FormData) {
  const admin = await requireAdmin();
  const raw = s(formData, "code", 40);
  const code = normaliseCode(raw);
  if (!code || !/^[A-Z0-9]/.test(code)) back({ code_error: "Codes are 3–32 letters, numbers, - or _, starting with a letter or number (e.g. LAUNCH20)." });
  const percent = Math.floor(Number(s(formData, "percent", 4)));
  if (!(percent >= 1 && percent <= DISCOUNT_CODE_MAX_PERCENT)) back({ code_error: `The discount must be a whole number from 1 to ${DISCOUNT_CODE_MAX_PERCENT}%.` });
  const products = formData.getAll("products").map(String).filter(x => PAID.includes(x));
  const startsAt = startOfLagosDay(s(formData, "starts", 10));
  const endsAt = endOfLagosDay(s(formData, "ends", 10));
  if (startsAt && endsAt && endsAt <= startsAt) back({ code_error: "The end date must be after the start date." });
  const maxRaw = s(formData, "max_uses", 7);
  const maxUses = maxRaw ? Math.floor(Number(maxRaw)) : null;
  if (maxUses !== null && !(maxUses >= 1)) back({ code_error: "Usage limit must be 1 or more, or left empty for no limit." });
  const row = {
    code, percent, active: formData.get("active") !== null || formData.get("is_new") === "1",
    products: products.length && products.length < PAID.length ? products : null,
    starts_at: startsAt, ends_at: endsAt, max_uses: maxUses, once_per_user: formData.get("once_per_user") !== null,
    note: s(formData, "note", 300) || null
  };
  const db = createAdminClient();
  const isNew = formData.get("is_new") === "1";
  if (isNew) {
    const { data: exists } = await db.from("discount_codes").select("code").eq("code", code).maybeSingle();
    if (exists) back({ code_error: `${code} already exists. Edit it in the list below.` });
    const { error } = await db.from("discount_codes").insert({ ...row, created_by: admin.id });
    if (error) back({ code_error: "Couldn't save the code: " + error.message });
  } else {
    const { error } = await db.from("discount_codes").update(row).eq("code", code);
    if (error) back({ code_error: "Couldn't save the code: " + error.message });
  }
  await audit(admin.id, isNew ? "discount.create" : "discount.update", code, row);
  revalidatePath("/admin/settings");
  back({ code_saved: code });
}

/** Turn a code on or off. Off takes effect immediately for new checkouts. */
export async function toggleDiscountCode(formData: FormData) {
  const admin = await requireAdmin();
  const code = normaliseCode(s(formData, "code", 40));
  const active = s(formData, "active", 1) === "1";
  if (!code) back({ code_error: "Unknown code." });
  await createAdminClient().from("discount_codes").update({ active }).eq("code", code);
  await audit(admin.id, active ? "discount.enable" : "discount.disable", code, {});
  revalidatePath("/admin/settings");
  back({ code_saved: code });
}

/** Delete a code that has never been used. Used codes are kept (they're on receipts and reports): switch them off instead. */
export async function deleteDiscountCode(formData: FormData) {
  const admin = await requireAdmin();
  const code = normaliseCode(s(formData, "code", 40));
  const db = createAdminClient();
  const { count } = await db.from("discount_redemptions").select("id", { count: "exact", head: true }).eq("code", code);
  if ((count ?? 0) > 0) back({ code_error: `${code} has been used, so it's kept for your records. Switch it off instead.` });
  await db.from("discount_codes").delete().eq("code", code);
  await audit(admin.id, "discount.delete", code, {});
  revalidatePath("/admin/settings");
  back({ code_deleted: code });
}
