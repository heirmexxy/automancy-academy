import Link from "next/link";
import { product } from "@/lib/pricing";
import { PlanCard } from "./PlanCard";
import { SecHead } from "./SecHead";

/** Landing-page preview: Free, Self-paced and Membership (Cohort only while a cohort is open). Prices come from lib/pricing.ts. */
export function PricingPreview({ cohortOpen }: { cohortOpen: boolean }) {
  const ids = ["free", "self", ...(cohortOpen ? ["cohort"] : []), "member"];
  const list = ids.map(id => product(id)).filter((p): p is NonNullable<typeof p> => !!p);
  return (
    <section className="wrap" aria-labelledby="price-h">
      <SecHead id="price-h" eyebrow="Plans" title="Start free. Upgrade when you're ready." lede="Prices in naira. Paying in US dollars? Switch currency on the pricing page." />
      <div className="plans">{list.map(p => <PlanCard key={p.id} p={p} cur="ngn" compact back="/" />)}</div>
      <p style={{ marginTop: 14 }}><Link href="/pricing">Compare all plans, add-ons and payment options</Link></p>
    </section>
  );
}
