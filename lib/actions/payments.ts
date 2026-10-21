"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/settings";
import { SITE_URL, hasPaystack } from "@/lib/config";
import { PRODUCTS, REFERRAL, product } from "@/lib/pricing";
import { addDays, makeReference, normaliseCode, quote, referralApplies, toMinor, withinRefundWindow, type Currency } from "@/lib/money";
import { applyRefund, createTransferRecipient, initializeTransaction, listBanks, openInstalmentPlan, refundTransaction, resolveAccount } from "@/lib/paystack";
import { findReferrer } from "@/lib/referrals";
import { PAYMENT_UNAVAILABLE, reportCheckoutFailure } from "@/lib/payment-alert";

const s = (f: FormData, k: string, max = 500) => String(f.get(k) ?? "").trim().slice(0, max);
const back = (pid: string, q: Record<string, string>) => `/checkout/${encodeURIComponent(pid)}?${new URLSearchParams(q).toString()}`;

async function audit(actor: string, action: string, target: string, detail: unknown) {
  await createAdminClient().from("audit_log").insert({ actor, action, target, detail });
}

async function addToWaitlist(email: string, productId: string) {
  await createAdminClient().from("waitlist").upsert({ email: email.toLowerCase(), product: productId }, { onConflict: "email,product", ignoreDuplicates: true });
}

// ── Learner: checkout ─────────────────────────────────────────────────────────

export async function joinWaitlist(formData: FormData) {
  const pid = s(formData, "product", 40);
  const user = await requireUser(`/checkout/${pid}`);
  if (!product(pid) || !user.email) redirect("/pricing");
  await addToWaitlist(user.email, pid);
  redirect(back(pid, { waitlisted: "1" }));
}

export async function startCheckout(formData: FormData) {
  const pid = s(formData, "product", 40);
  const user = await requireUser(`/checkout/${pid}`);
  const p = product(pid);
  if (!p || p.ngn <= 0 || p.id === "team") redirect("/pricing");
  if (!user.email) redirect(back(pid, { error: "Your account has no email address. Contact support." }));
  if (p.comingSoon) { await addToWaitlist(user.email, p.id); redirect(back(pid, { waitlisted: "1" })); }
  if (p.hiddenUnlessCohortOpen && !(await getSettings()).cohort_open) redirect(back(pid, { error: "Cohort enrolment is closed right now. Join the waitlist and we'll tell you when it opens." }));
  // No keys yet (or removed by mistake): never pretend a payment happened. Tell the learner, alert the admin.
  if (!hasPaystack()) {
    await reportCheckoutFailure("PAYSTACK_SECRET_KEY is not set", { userId: user.id, email: user.email }, p.id);
    redirect(back(pid, { error: PAYMENT_UNAVAILABLE }));
  }

  const db = createAdminClient();
  const wantsPlan = s(formData, "plan", 2) === "3";
  let currency: Currency = s(formData, "currency", 3) === "USD" ? "USD" : "NGN";
  let amount = 0, discount = 0, instNo = 1, total = 1, planRef: string | null = null, refCode: string | null = null;

  const open = wantsPlan ? await openInstalmentPlan(user.id, p.id) : null;
  if (open) {
    currency = "NGN"; amount = open.amountKobo; discount = open.discountKobo; instNo = open.nextNo; total = open.total; planRef = open.planRef; refCode = open.referralCode;
  } else {
    let isRenewal = false;
    if (p.id === "member") {
      const { count } = await db.from("payments").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("product", "member").eq("status", "success");
      isRenewal = (count ?? 0) > 0;
    }
    const raw = s(formData, "ref", 40);
    let referral = false;
    if (raw && referralApplies(p, isRenewal)) {
      const r = await findReferrer(raw, user.id, user.email);
      if ("error" in r) redirect(back(pid, { error: r.error, ref: normaliseCode(raw), ...(wantsPlan ? { plan: "3" } : {}) }));
      referral = true; refCode = r.code;
      // Attribute the signup to the referrer if nobody has yet.
      await db.from("profiles").update({ referred_by: r.id }).eq("id", user.id).is("referred_by", null);
    }
    const q = quote(p, { currency, installments: wantsPlan, referral, isRenewal });
    if (!q.ok) redirect(back(pid, { error: q.error }));
    amount = q.amountMinor; discount = q.discountMinor; total = q.installmentsTotal; currency = q.currency;
  }

  const reference = makeReference(p.id);
  if (total > 1 && !planRef) planRef = reference;
  const { error } = await db.from("payments").insert({
    user_id: user.id, product: p.id, reference, amount_kobo: amount, currency, status: "initialized",
    installment_no: instNo, installments_total: total, plan_ref: planRef, referral_code: refCode, discount_kobo: discount
  });
  if (error) { console.error("[checkout] insert failed", error.message); redirect(back(pid, { error: "We couldn't start the payment. Please try again." })); }

  const init = await initializeTransaction({
    email: user.email, amountMinor: amount, currency, reference, callbackUrl: `${SITE_URL}/checkout/callback`,
    metadata: { user_id: user.id, product: p.id, installment_no: instNo, installments_total: total, cancel_action: `${SITE_URL}/checkout/${p.id}` }
  });
  if (!init.ok || !init.data?.authorization_url) {
    await db.from("payments").update({ status: "failed", raw: { init_error: init.message } }).eq("reference", reference);
    await reportCheckoutFailure(`Paystack initialize failed: ${init.message}`, { userId: user.id, email: user.email }, p.id);
    redirect(back(pid, { error: currency === "USD" ? "Paystack couldn't start a dollar payment. Try naira, or contact support." : "Paystack couldn't start the payment. Please try again in a minute." }));
  }
  redirect(init.data.authorization_url);
}

// ── Learner: refunds ──────────────────────────────────────────────────────────

export async function requestRefund(formData: FormData) {
  const user = await requireUser("/account");
  const paymentId = s(formData, "payment_id", 64);
  const reason = s(formData, "reason", 2000);
  const db = createAdminClient();
  const { data: pay } = await db.from("payments").select("id, user_id, status, paid_at").eq("id", paymentId).maybeSingle();
  const ok = pay && pay.user_id === user.id && pay.status === "success" && withinRefundWindow(pay.paid_at as string) && reason.length >= 5;
  if (ok) {
    const { data: existing } = await db.from("refund_requests").select("id").eq("payment_id", paymentId).in("status", ["open", "approved", "refunded"]).limit(1);
    if (!existing?.length) await db.from("refund_requests").insert({ user_id: user.id, payment_id: paymentId, reason });
  }
  revalidatePath("/account");
  redirect(ok ? "/account?refund=requested#purchases" : "/account?refund=not-eligible#purchases");
}

// ── Learner: referral payouts ────────────────────────────────────────────────

export async function savePayoutAccount(formData: FormData) {
  const user = await requireUser("/earn");
  const accountNumber = s(formData, "account_number", 20).replace(/\D/g, "");
  let bankCode = s(formData, "bank_code", 20);
  let bankName = s(formData, "bank_name", 100);
  let accountName = s(formData, "account_name", 100);
  if (!/^\d{10}$/.test(accountNumber)) redirect("/earn?payout_error=" + encodeURIComponent("Enter your 10-digit NUBAN account number.") + "#payouts");
  let recipient: string | null = null;
  if (hasPaystack()) {
    const banks = await listBanks();
    const bank = banks.find(b => b.code === bankCode);
    if (!bank) redirect("/earn?payout_error=" + encodeURIComponent("Choose your bank from the list.") + "#payouts");
    bankName = bank.name;
    const resolved = await resolveAccount(accountNumber, bankCode);
    if (!resolved.ok || !resolved.data) redirect("/earn?payout_error=" + encodeURIComponent("Paystack couldn't find that account at that bank. Check the number.") + "#payouts");
    accountName = resolved.data.account_name;
    const r = await createTransferRecipient({ name: accountName, accountNumber, bankCode });
    if (!r.ok || !r.data) redirect("/earn?payout_error=" + encodeURIComponent("We couldn't save the account with Paystack. Try again later.") + "#payouts");
    recipient = r.data.recipient_code;
  } else {
    bankCode = bankCode.replace(/[^0-9A-Za-z]/g, "") || "MANUAL";
    if (!bankName) redirect("/earn?payout_error=" + encodeURIComponent("Enter your bank's name.") + "#payouts");
  }
  // Only the last 4 digits are stored; the full number went to Paystack (or nowhere, in placeholder mode).
  await createAdminClient().from("payout_accounts").upsert({
    user_id: user.id, bank_name: bankName, bank_code: bankCode, account_last4: accountNumber.slice(-4),
    account_name: accountName || null, paystack_recipient_code: recipient, updated_at: new Date().toISOString()
  }, { onConflict: "user_id" });
  revalidatePath("/earn");
  redirect("/earn?saved=1#payouts");
}

export async function requestPayout() {
  const user = await requireUser("/earn");
  const db = createAdminClient();
  const [{ data: acct }, { data: rows }, { data: openPayout }] = await Promise.all([
    db.from("payout_accounts").select("user_id").eq("user_id", user.id).maybeSingle(),
    db.from("referral_earnings").select("id, amount_kobo").eq("referrer_id", user.id).eq("status", "approved").is("payout_id", null),
    db.from("payouts").select("id").eq("user_id", user.id).eq("status", "requested").limit(1)
  ]);
  const total = (rows || []).reduce((a, r) => a + (r.amount_kobo as number), 0);
  if (!acct) redirect("/earn?payout_error=" + encodeURIComponent("Add your bank account first.") + "#payouts");
  if (openPayout?.length) redirect("/earn?payout_error=" + encodeURIComponent("You already have a payout being processed.") + "#payouts");
  if (total < toMinor(REFERRAL.minPayoutNgn)) redirect("/earn?payout_error=" + encodeURIComponent("Your approved balance is below the minimum payout.") + "#payouts");
  const { data: payout, error } = await db.from("payouts").insert({ user_id: user.id, amount_kobo: total, status: "requested" }).select("id").single();
  if (error || !payout) redirect("/earn?payout_error=" + encodeURIComponent("We couldn't create the payout. Try again.") + "#payouts");
  // Claim only earnings that are still free (two quick requests can race past the checks above); the payout is what was claimed.
  const { data: claimed } = await db.from("referral_earnings").update({ payout_id: payout.id })
    .in("id", (rows || []).map(r => r.id as string)).eq("status", "approved").is("payout_id", null).select("amount_kobo");
  const got = (claimed || []).reduce((a, r) => a + (r.amount_kobo as number), 0);
  if (got < toMinor(REFERRAL.minPayoutNgn)) {
    await db.from("referral_earnings").update({ payout_id: null }).eq("payout_id", payout.id);
    await db.from("payouts").delete().eq("id", payout.id).eq("status", "requested");
    redirect("/earn?payout_error=" + encodeURIComponent("You already have a payout being processed.") + "#payouts");
  }
  if (got !== total) await db.from("payouts").update({ amount_kobo: got }).eq("id", payout.id);
  revalidatePath("/earn");
  redirect("/earn?payout=requested#payouts");
}

// ── Admin: refunds ────────────────────────────────────────────────────────────

export async function adminApproveRefund(formData: FormData) {
  const admin = await requireAdmin();
  const id = s(formData, "id", 64);
  const manual = s(formData, "mode", 10) === "manual";
  const note = s(formData, "note", 1000) || null;
  const db = createAdminClient();
  const { data: req } = await db.from("refund_requests").select("id, payment_id, status").eq("id", id).maybeSingle();
  if (!req || req.status !== "open") redirect("/admin/refunds?error=" + encodeURIComponent("That request is no longer open."));
  const { data: pay } = await db.from("payments").select("id, reference, status").eq("id", req.payment_id).maybeSingle();
  if (!pay || pay.status !== "success") redirect("/admin/refunds?error=" + encodeURIComponent("That payment isn't in a refundable state."));
  if (!manual) {
    if (!hasPaystack()) redirect("/admin/refunds?error=" + encodeURIComponent("Paystack isn't configured. Refund the learner yourself, then use 'Mark refunded manually'."));
    const r = await refundTransaction(pay.reference as string);
    if (!r.ok) redirect("/admin/refunds?error=" + encodeURIComponent(`Paystack refused the refund: ${r.message}`));
  }
  // Access is removed and the earning reversed immediately. A Paystack refund stays "approved" until the
  // refund.processed webhook marks it "refunded" (applyRefund is idempotent); a manual one is "refunded" now.
  await applyRefund(pay.id as string, { decidedBy: admin.id });
  await db.from("refund_requests").update({ status: manual ? "refunded" : "approved", admin_note: note, decided_at: new Date().toISOString(), decided_by: admin.id }).eq("id", id);
  await audit(admin.id, manual ? "refund_manual" : "refund_paystack", pay.id as string, { request: id, note });
  revalidatePath("/admin/refunds");
  redirect("/admin/refunds?done=1");
}

export async function adminDeclineRefund(formData: FormData) {
  const admin = await requireAdmin();
  const id = s(formData, "id", 64);
  const note = s(formData, "note", 1000);
  if (!note) redirect("/admin/refunds?error=" + encodeURIComponent("Add a note explaining the decision; the learner sees it."));
  await createAdminClient().from("refund_requests").update({ status: "declined", admin_note: note, decided_at: new Date().toISOString(), decided_by: admin.id }).eq("id", id).eq("status", "open");
  await audit(admin.id, "refund_declined", id, { note });
  revalidatePath("/admin/refunds");
  redirect("/admin/refunds?done=1");
}

// ── Admin: access ─────────────────────────────────────────────────────────────

export async function adminGrantAccess(formData: FormData) {
  const admin = await requireAdmin();
  const userId = s(formData, "user_id", 64);
  const pid = s(formData, "product", 40);
  const p = PRODUCTS.find(x => x.id === pid && x.id !== "free");
  const daysRaw = s(formData, "days", 6);
  const note = s(formData, "note", 500) || null;
  const days = daysRaw === "" ? p?.accessDays ?? null : Math.max(1, Math.min(3650, parseInt(daysRaw, 10) || 0));
  if (!p) redirect(`/admin/learners/${encodeURIComponent(userId)}?error=` + encodeURIComponent("Choose a product."));
  const now = new Date();
  await createAdminClient().from("enrollments").insert({
    user_id: userId, product: p.id, status: "active", source: "admin", started_at: now.toISOString(),
    expires_at: days ? addDays(now, days).toISOString() : null, note
  });
  await audit(admin.id, "grant_access", userId, { product: p.id, days, note });
  revalidatePath(`/admin/learners/${userId}`);
  redirect(`/admin/learners/${encodeURIComponent(userId)}?done=granted`);
}

export async function adminRevokeAccess(formData: FormData) {
  const admin = await requireAdmin();
  const id = s(formData, "enrollment_id", 64);
  const userId = s(formData, "user_id", 64);
  const note = s(formData, "note", 500) || null;
  await createAdminClient().from("enrollments").update({ status: "cancelled", note }).eq("id", id).eq("user_id", userId);
  await audit(admin.id, "revoke_access", userId, { enrollment: id, note });
  revalidatePath(`/admin/learners/${userId}`);
  redirect(`/admin/learners/${encodeURIComponent(userId)}?done=revoked`);
}

// ── Admin: referrals and payouts ─────────────────────────────────────────────

export async function adminApproveEarnings(formData: FormData) {
  const admin = await requireAdmin();
  const referrer = s(formData, "referrer_id", 64);
  let q = createAdminClient().from("referral_earnings").update({ status: "approved" }).eq("status", "pending").lte("available_at", new Date().toISOString());
  if (referrer) q = q.eq("referrer_id", referrer);
  const { data } = await q.select("id");
  await audit(admin.id, "approve_earnings", referrer || "all", { count: data?.length ?? 0 });
  revalidatePath("/admin/referrals");
  redirect(`/admin/referrals?approved=${data?.length ?? 0}`);
}

export async function adminSetPayout(formData: FormData) {
  const admin = await requireAdmin();
  const id = s(formData, "id", 64);
  const status = s(formData, "status", 10) === "failed" ? "failed" : "paid";
  const transfer = s(formData, "transfer_code", 80) || null;
  const db = createAdminClient();
  const { data: payout } = await db.from("payouts").select("id, status").eq("id", id).maybeSingle();
  if (!payout || payout.status !== "requested") redirect("/admin/referrals?error=" + encodeURIComponent("That payout is no longer pending."));
  await db.from("payouts").update({ status, paystack_transfer_code: transfer, paid_at: status === "paid" ? new Date().toISOString() : null }).eq("id", id);
  if (status === "paid") await db.from("referral_earnings").update({ status: "paid" }).eq("payout_id", id).eq("status", "approved");
  else await db.from("referral_earnings").update({ payout_id: null }).eq("payout_id", id).eq("status", "approved");
  await audit(admin.id, `payout_${status}`, id, { transfer });
  revalidatePath("/admin/referrals");
  redirect("/admin/referrals?done=1");
}
