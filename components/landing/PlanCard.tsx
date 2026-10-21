import Link from "next/link";
import type { Product } from "@/lib/pricing";
import { SUPPORT_EMAIL } from "@/lib/config";
import { ngn } from "@/lib/format";
import { joinWaitlist } from "@/lib/actions/account";
import { priceText, periodText, accessText, type Cur } from "./data";

/** Email form that puts someone on the waitlist for a product (coming-soon products, or the cohort while it's closed). */
export function WaitlistForm({ productId, back, label = "Join the waitlist" }: { productId: string; back: string; label?: string }) {
  return (
    <form action={joinWaitlist} className="inline-form">
      <input type="hidden" name="product" value={productId} />
      <input type="hidden" name="back" value={back} />
      <label className="sr-only" htmlFor={`wl-${productId}`}>Email for the {productId} waitlist</label>
      <input id={`wl-${productId}`} name="email" type="email" required placeholder="you@example.com" autoComplete="email" />
      <button className="btn sm" type="submit">{label}</button>
    </form>
  );
}

export function ctaHref(p: Product): string {
  if (p.ngn <= 0) return "/signup";
  if (p.id === "team") return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Team seats for Automancy Academy")}`;
  return `/checkout/${p.id}`;
}

/** One product card. `compact` hides the feature list (landing preview). */
export function PlanCard({ p, cur, compact = false, back = "/pricing" }: { p: Product; cur: Cur; compact?: boolean; back?: string }) {
  const period = periodText(p);
  return (
    <article className={`card plan${p.highlight ? " hl" : ""}`} id={p.id} aria-labelledby={`p-${p.id}`}>
      {p.highlight && <span className="tag">Most popular</span>}
      <h3 id={`p-${p.id}`}>{p.name}</h3>
      <p className="price">{priceText(p, cur)}{period && <small>{period}</small>}</p>
      {p.installments && (cur === "ngn"
        ? <p className="note">or {p.installments.count} payments of {ngn(p.installments.ngn)}</p>
        : <p className="note">Pay in {p.installments.count} is available in naira.</p>)}
      <p>{p.blurb}</p>
      {!compact && p.features.length > 0 && <ul>{p.features.map(f => <li key={f}>{f}</li>)}</ul>}
      {!compact && p.kind !== "business" && <p className="note">{accessText(p)}</p>}
      {p.comingSoon
        ? <><p className="pill warn" style={{ justifySelf: "start" }}>Coming soon</p><WaitlistForm productId={p.id} back={back} /></>
        : ctaHref(p).startsWith("mailto:")
          ? <a className="btn alt" href={ctaHref(p)}>{p.cta}</a>
          : <Link className={`btn${p.highlight ? "" : " alt"}`} href={ctaHref(p)}>{p.cta}</Link>}
    </article>
  );
}
