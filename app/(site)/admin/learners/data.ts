import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { percentDone } from "@/lib/course";
import { safeSearch } from "@/lib/money";

export type LearnerRow = {
  id: string; name: string; email: string; city: string | null; role: string; createdAt: string;
  products: string[]; firstPaid: string | null; paidNgnKobo: number; paidUsdCents: number;
  pct: number; itemsDone: number; lastActive: string | null;
};

/** Learner table for admin (list page and CSV export). Call only after requireAdmin(). */
export async function loadLearners(o: { q?: string; limit?: number } = {}): Promise<LearnerRow[]> {
  const db = createAdminClient();
  let query = db.from("profiles").select("id, email, full_name, city, role, created_at, last_seen_at").order("created_at", { ascending: false }).limit(o.limit ?? 500);
  const q = safeSearch(o.q);
  if (q) query = query.or(`full_name.ilike.*${q}*,email.ilike.*${q}*`);
  const { data: profiles } = await query;
  const list = profiles || [];
  if (!list.length) return [];
  const ids = list.map(p => p.id as string);
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 200) chunks.push(ids.slice(i, i + 200));
  const [ens, pays, progs] = await Promise.all([
    Promise.all(chunks.map(c => db.from("enrollments").select("user_id, product, status, expires_at").in("user_id", c))),
    Promise.all(chunks.map(c => db.from("payments").select("user_id, amount_kobo, currency, paid_at").eq("status", "success").in("user_id", c))),
    Promise.all(chunks.map(c => db.from("progress").select("user_id, done, items_done, updated_at").in("user_id", c)))
  ]);
  const flat = <T,>(rs: { data: T[] | null }[]) => rs.flatMap(r => r.data || []);
  const now = Date.now();
  const enrol = new Map<string, Set<string>>();
  for (const e of flat(ens)) {
    if (e.status !== "active" || (e.expires_at && new Date(e.expires_at as string).getTime() < now)) continue;
    const s = enrol.get(e.user_id as string) || new Set<string>(); s.add(e.product as string); enrol.set(e.user_id as string, s);
  }
  const money = new Map<string, { first: string | null; ngn: number; usd: number }>();
  for (const p of flat(pays)) {
    const m = money.get(p.user_id as string) || { first: null, ngn: 0, usd: 0 };
    if (p.paid_at && (!m.first || (p.paid_at as string) < m.first)) m.first = p.paid_at as string;
    if (p.currency === "USD") m.usd += p.amount_kobo as number; else m.ngn += p.amount_kobo as number;
    money.set(p.user_id as string, m);
  }
  const prog = new Map(flat(progs).map(p => [p.user_id as string, p]));
  return list.map(p => {
    const pr = prog.get(p.id as string); const m = money.get(p.id as string);
    const lastActive = [pr?.updated_at as string | undefined, p.last_seen_at as string | undefined].filter(Boolean).sort().pop() || null;
    return {
      id: p.id as string, name: (p.full_name as string) || "", email: p.email as string, city: (p.city as string) || null, role: p.role as string,
      createdAt: p.created_at as string, products: [...(enrol.get(p.id as string) || [])].sort(),
      firstPaid: m?.first || null, paidNgnKobo: m?.ngn || 0, paidUsdCents: m?.usd || 0,
      pct: pr ? percentDone(pr.done as Record<string, boolean>) : 0, itemsDone: (pr?.items_done as number) || 0, lastActive
    };
  });
}
