/**
 * Prices and what each product unlocks. Single source of truth for the landing page, pricing page,
 * checkout and Paystack verification. Amounts are whole naira / dollars.
 * FINAL prices (Oct 2026), set from the market research in docs/pricing-rationale.md.
 */
export type ProductId = "free" | "self" | "cohort" | "member" | "story" | "bundle" | "crmspec" | "team" | "employer_post";
export type Product = {
  id: ProductId; name: string; kind: "plan" | "addon" | "business";
  ngn: number; usd: number; period: "free" | "one-time" | "per month" | "per year" | "per seat" | "per post";
  blurb: string; features: string[]; cta: string;
  accessDays: number | null;        // how long the enrollment lasts (null = lifetime of the product)
  installments?: { count: number; ngn: number };
  hiddenUnlessCohortOpen?: boolean; // cohort plan shows only when Admin → Settings → cohort is open
  comingSoon?: boolean;             // waitlist instead of checkout
  highlight?: boolean;
};

export const PRODUCTS: Product[] = [
  { id: "free", name: "Free", kind: "plan", ngn: 0, usd: 0, period: "free", accessDays: null, cta: "Start free",
    blurb: "Try the course before you pay.", features: ["Base Camp: 6 lessons and Boss 0", "Animated walkthroughs and natural-voice Listen", "AI feedback on Base Camp missions", "Community (read and post)"] },
  { id: "self", name: "Self-paced", kind: "plan", ngn: 45000, usd: 79, period: "one-time", accessDays: 365, highlight: true, cta: "Enrol",
    installments: { count: 3, ngn: 16000 },
    blurb: "The whole course at your own pace.", features: ["All 49 lessons, 6 boss projects and the capstone", "Templates for n8n, Make and Zapier", "AI review of every mission and project", "Certificate with a public verification page", "Community, leaderboard and Hire talent profile", "12 months' access"] },
  { id: "cohort", name: "Cohort", kind: "plan", ngn: 150000, usd: 249, period: "one-time", accessDays: 365, hiddenUnlessCohortOpen: true, cta: "Reserve a seat",
    installments: { count: 3, ngn: 52000 },
    blurb: "Learn with a group and a mentor, live every week.", features: ["Everything in Self-paced", "13 weekly live build calls", "Mentor review of every boss project", "Story Mode and the template bundle included", "3 months of Membership free"] },
  { id: "member", name: "Membership", kind: "plan", ngn: 5000, usd: 12, period: "per month", accessDays: 31, cta: "Join",
    blurb: "Keep growing after the course.", features: ["Weekly challenges and new lessons", "New templates every month", "AI review on challenge entries", "Members' room in the community"] },
  { id: "story", name: "Story Mode", kind: "addon", ngn: 5000, usd: 9, period: "one-time", accessDays: 365, cta: "Add Story Mode",
    blurb: "Listen anywhere.", features: ["Every lesson as downloadable audio in natural Nigerian voices", "Listen offline, screen off, at your own speed"] },
  { id: "bundle", name: "Template bundle", kind: "addon", ngn: 20000, usd: 35, period: "one-time", accessDays: null, cta: "Get the bundle",
    blurb: "Production-ready packs for client work.", features: ["Extended client-ready template packs", "Setup guides and handover documents", "New packs from challenge winners"] },
  { id: "crmspec", name: "CRM Implementation specialisation", kind: "addon", ngn: 25000, usd: 45, period: "one-time", accessDays: 365, comingSoon: true, cta: "Join the waitlist",
    blurb: "HubSpot and Zoho in depth, migrations and a CRM Implementation Agent.", features: [] },
  { id: "team", name: "Team seats", kind: "business", ngn: 40000, usd: 70, period: "per seat", accessDays: 365, cta: "Talk to us",
    blurb: "For companies training 5 or more staff.", features: ["Self-paced access for each seat", "Team progress report", "Optional private workshop"] },
  { id: "employer_post", name: "Post a role", kind: "business", ngn: 20000, usd: 29, period: "per post", accessDays: 30, cta: "Post a role",
    blurb: "Reach certified graduates for 30 days.", features: ["First post free"] }
];

export const product = (id: string) => PRODUCTS.find(p => p.id === id);
export const REFERRAL = { friendDiscount: 0.10, tiers: { friend: 0.20, graduate: 0.25, ambassador: 0.30 }, packCommission: 0.30, attributionDays: 30, refundWindowDays: 14, minPayoutNgn: 5000 };
