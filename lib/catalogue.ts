import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabase } from "@/lib/config";
import { ratingSummary } from "@/lib/marketplace";
import type { CardCourse } from "@/app/(site)/courses/_components/CourseCard";

export type Catalogue = { courses: (CardCourse & { id: string })[]; ratings: Record<string, { avg: number; count: number }> };

/** Live creator courses for the catalogue and the "Explore more courses" sections, newest first. */
export async function liveCourses(o: { term?: string; category?: string; limit?: number; excludeIds?: string[] } = {}): Promise<Catalogue> {
  if (!hasSupabase()) return { courses: [], ratings: {} };
  const db = createAdminClient();
  let query = db.from("courses").select("id, slug, title, subtitle, cover_url, category, level, price_ngn, is_free, creator_id, published_at").eq("status", "live");
  if (o.category) query = query.eq("category", o.category);
  if (o.term) query = query.or(`title.ilike.%${o.term}%,subtitle.ilike.%${o.term}%,description.ilike.%${o.term}%`);
  const { data } = await query.order("published_at", { ascending: false }).limit(Math.min(60, (o.limit || 60) + (o.excludeIds?.length || 0)));
  const skip = new Set(o.excludeIds || []);
  const rows = (data || []).filter(r => !skip.has(r.id as string)).slice(0, o.limit || 60);
  const ids = [...new Set(rows.map(r => r.creator_id as string))];
  const { data: creators } = ids.length ? await db.from("creators").select("user_id, display_name").in("user_id", ids) : { data: [] };
  const names = new Map((creators || []).map(c => [c.user_id as string, c.display_name as string]));
  const courses = rows.map(r => ({
    id: r.id as string, slug: r.slug as string, title: r.title as string, subtitle: r.subtitle as string | null, cover_url: r.cover_url as string | null,
    category: r.category as string | null, level: r.level as string, price_ngn: r.price_ngn as number, is_free: !!r.is_free,
    creator: names.get(r.creator_id as string) || null
  }));
  const r = await ratingSummary(rows.map(x => x.id as string));
  const ratings = Object.fromEntries(courses.map(c => [c.slug, r[c.id]]).filter(([, v]) => v)) as Catalogue["ratings"];
  return { courses, ratings };
}

/** Creator courses this learner is enrolled in (for Account → My courses). */
export async function myCourses(userId: string): Promise<Catalogue["courses"]> {
  if (!hasSupabase()) return [];
  const db = createAdminClient();
  const { data: en } = await db.from("course_enrollments").select("course_id").eq("user_id", userId).limit(200);
  const ids = (en || []).map(e => e.course_id as string);
  if (!ids.length) return [];
  const { data } = await db.from("courses").select("id, slug, title, subtitle, cover_url, category, level, price_ngn, is_free, creator_id").in("id", ids);
  return (data || []).map(r => ({
    id: r.id as string, slug: r.slug as string, title: r.title as string, subtitle: r.subtitle as string | null, cover_url: r.cover_url as string | null,
    category: r.category as string | null, level: r.level as string, price_ngn: r.price_ngn as number, is_free: !!r.is_free, creator: null
  }));
}
