/**
 * The only grounds on which we refund (see /legal/refunds). Learners must pick one and explain it;
 * "I changed my mind", "no time" or "I stopped halfway" are not grounds. An admin decides every request.
 */
export const REFUND_REASONS = [
  { key: "not_as_described", label: "The course isn't what was described (missing or wrong content)" },
  { key: "technical", label: "A technical problem stopped me using it, and support couldn't fix it" },
  { key: "no_access", label: "I paid but never got access" },
  { key: "duplicate", label: "I was charged twice, or bought the wrong product by mistake" },
  { key: "other", label: "Another serious problem with what I bought (explain below)" }
] as const;
export type RefundReasonKey = (typeof REFUND_REASONS)[number]["key"];
export const REFUND_DETAIL_MIN = 40;

export const refundReasonLabel = (key: string) => REFUND_REASONS.find(r => r.key === key)?.label;

/** "[Not as described] details…": stored in refund_requests.reason so admins see the ground first. */
export function formatRefundReason(key: string, detail: string): string | null {
  const label = refundReasonLabel(key);
  const d = detail.trim();
  if (!label || d.length < REFUND_DETAIL_MIN) return null;
  return `[${label}]\n${d}`.slice(0, 2000);
}
