/** Course facts and price labels for the public pages, all derived from lib/course.ts and lib/pricing.ts (never hard-coded). */
import { COURSE, type CourseItem } from "@/lib/course";
import { PRODUCTS, type Product } from "@/lib/pricing";
import { ngn, usd } from "@/lib/format";

export type Track = { track: number; name: string; lessons: number; sessions: number; boss?: CourseItem; capstone?: CourseItem; color: string; blurb: string };

const TRACK_META: Record<number, { color: string; blurb: string }> = {
  0: { color: "var(--teal)", blurb: "Automation thinking, APIs, JSON, spreadsheets as databases, prompting, security." },
  1: { color: "var(--sun)", blurb: "Triggers, actions, formatter, paths, webhooks, AI steps, agents and MCP." },
  2: { color: "var(--volt)", blurb: "Scenarios, mapping, routers, iterators, aggregators, HTTP, error handlers, AI modules." },
  3: { color: "var(--spark)", blurb: "Self-hosting, items and expressions, flow control, HTTP mastery, code, AI nodes, production." },
  4: { color: "var(--grape)", blurb: "Tools, memory, RAG, guardrails, MCP, multi-agent systems, code-first agents, evals." },
  5: { color: "var(--rose)", blurb: "WhatsApp, Telegram and voice channels, prospecting agents, social listening, a social media manager, a social inbox, email campaigns, one inbox for every channel, and CRM setup and automation with HubSpot or Zoho." },
  6: { color: "var(--sky)", blurb: "Client discovery and scoping, pricing and getting paid, portfolio and templates, and the Grand Capstone." }
};

export function tracks(): Track[] {
  const map = new Map<number, Track>();
  for (const it of COURSE.items) {
    const meta = TRACK_META[it.track] ?? { color: "var(--sky)", blurb: "" };
    const t = map.get(it.track) ?? { track: it.track, name: it.trackName, lessons: 0, sessions: 0, color: meta.color, blurb: meta.blurb };
    t.sessions += it.sessions;
    if (it.kind === "lesson") t.lessons += 1;
    if (it.kind === "boss") t.boss = it;
    if (it.kind === "capstone") t.capstone = it;
    map.set(it.track, t);
  }
  return [...map.values()].sort((a, b) => a.track - b.track);
}

export const LESSONS = COURSE.items.filter(i => i.kind === "lesson").length;
export const BOSSES = COURSE.items.filter(i => i.kind === "boss");
export const CAPSTONE = COURSE.items.find(i => i.kind === "capstone");
export const FREE_LESSONS = COURSE.items.filter(i => i.free && i.kind === "lesson").length;
export const TRACK_COUNT = new Set(COURSE.items.map(i => i.track)).size;
export const TOTAL_SESSIONS = COURSE.items.reduce((s, i) => s + (i.sessions || 1), 0);
export const SESSIONS_PER_WEEK = 5;
export const WEEKS = Math.ceil(TOTAL_SESSIONS / SESSIONS_PER_WEEK);

export type Cur = "ngn" | "usd";
export const curOf = (v: string | undefined): Cur => (v === "usd" ? "usd" : "ngn");

export function priceText(p: Product, cur: Cur): string {
  if (p.ngn <= 0) return "Free";
  return cur === "usd" ? usd(p.usd) : ngn(p.ngn);
}
export function periodText(p: Product): string {
  switch (p.period) {
    case "free": return "";
    case "one-time": return "one-time";
    case "per month": return "a month";
    case "per year": return "a year";
    case "per seat": return "per seat";
    case "per post": return "per post";
    default: return "";
  }
}
export function accessText(p: Product): string {
  if (p.ngn <= 0) return "No time limit";
  if (p.accessDays == null) return "Yours to keep";
  if (p.accessDays >= 365) return `${Math.round(p.accessDays / 30.4)} months' access`;
  return `${p.accessDays} days' access`;
}
export const plans = () => PRODUCTS.filter(p => p.kind === "plan");
export const addons = () => PRODUCTS.filter(p => p.kind === "addon");
export const business = () => PRODUCTS.filter(p => p.kind === "business");
