import "server-only";
import missionsData from "@/data/missions.json";
import { itemById } from "@/lib/course";
import {
  buildReviewPrompt, copySimilarity, htmlToText, isBossSheet, isBossSpec, parseReviewText, redactSecrets, statusFor,
  type ItemSpec, type ReviewResult, type Sheet, type Tier, type TierSpec
} from "@/lib/reviewer-core";

/**
 * The AI reviewer: marks a learner's mission or boss submission against the mission's tasks, its "Done when"
 * criteria (or the boss rubric and go-live must-haves) and the mission sheet's marking guide, by calling the
 * Anthropic Messages API with fetch. Pure prompt/parse logic lives in lib/reviewer-core.ts.
 * Marking data comes from data/missions.json and data/sheets/*.json (scripts/build-review-data.mjs).
 */
const MISSIONS = (missionsData as unknown as { items: Record<string, ItemSpec> }).items;
const API_URL = "https://api.anthropic.com/v1/messages";
export const reviewerModel = () => process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5"; // PLACEHOLDER: confirm the current model name before launch

export function getItemSpec(itemId: string): ItemSpec | null { return MISSIONS[itemId] || null; }
export function getTierSpec(itemId: string, tier: Tier): TierSpec | null {
  const item = MISSIONS[itemId]; return (item && (item.tiers[tier] as TierSpec | undefined)) || null;
}

/** Loads a mission sheet (bundled with the server build through a dynamic import context). */
export async function loadSheet(itemId: string): Promise<Sheet | null> {
  const file = MISSIONS[itemId]?.sheet;
  if (!file || !/^[A-Za-z0-9-]+\.json$/.test(file)) return null;
  try {
    const mod = await import(`../data/sheets/${file.replace(/\.json$/, "")}.json`);
    return ((mod as { default?: Sheet }).default || (mod as unknown as Sheet)) ?? null;
  } catch { return null; }
}

/** The model answer text for copy detection (lessons only; boss sheets have no single model answer). */
function modelAnswer(sheet: Sheet | null, tier: Tier): string {
  if (!sheet || isBossSheet(sheet)) return "";
  return htmlToText(sheet.tiers[tier]?.answer || "");
}

export type ReviewOutcome = {
  result: ReviewResult;
  status: "accepted" | "revise" | "pending";
  meta: { model: string; input_tokens?: number; output_tokens?: number; at: string; similarity: number };
};

async function callClaude(system: string, user: string, maxTokens: number) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90_000);
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: reviewerModel(), max_tokens: maxTokens, temperature: 0, system, messages: [{ role: "user", content: user }] }),
      signal: ctrl.signal,
      cache: "no-store"
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${data?.error?.message || res.statusText}`);
    const text = (Array.isArray(data.content) ? data.content : []).filter((b: { type?: string }) => b.type === "text").map((b: { text?: string }) => b.text || "").join("");
    if (data.stop_reason === "max_tokens") throw new Error("The reviewer's reply was cut off (max_tokens)");
    return { text, usage: data.usage as { input_tokens?: number; output_tokens?: number } | undefined };
  } finally { clearTimeout(timer); }
}

/**
 * Marks one submission. `content` should already be redacted (the route stores the redacted text); it is
 * redacted again here so a re-run of an old row is safe too. Throws on API or parse failure: callers queue the
 * submission for a person instead.
 */
export async function reviewSubmission(input: { itemId: string; tier: Tier; content: string; links: string[] }): Promise<ReviewOutcome> {
  const item = itemById(input.itemId); const spec = getTierSpec(input.itemId, input.tier);
  if (!item || !spec) throw new Error(`No marking data for ${input.itemId}/${input.tier}`);
  const sheet = await loadSheet(input.itemId);
  const red = redactSecrets(input.content);
  const similarity = isBossSpec(spec) ? 0 : copySimilarity(red.text, modelAnswer(sheet, input.tier));
  const prompt = buildReviewPrompt({ item: { id: item.id, title: htmlToText(item.title), kind: item.kind }, spec, sheet, content: red.text, links: input.links });
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { text, usage } = await callClaude(prompt.system, prompt.user, prompt.maxTokens);
      const found = red.found.length ? red.found : /\[REDACTED [^\]]+\]/.test(input.content) ? ["earlier redaction"] : [];
      const result = parseReviewText(text, { spec, secretsFound: found, similarity });
      return { result, status: statusFor(result), meta: { model: reviewerModel(), input_tokens: usage?.input_tokens, output_tokens: usage?.output_tokens, at: new Date().toISOString(), similarity } };
    } catch (e) { lastErr = e; if (e instanceof Error && /API 4\d\d/.test(e.message) && !/API 429/.test(e.message)) break; }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Review failed");
}
