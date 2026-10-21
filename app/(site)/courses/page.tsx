import Link from "next/link";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabase } from "@/lib/config";
import { product } from "@/lib/pricing";
import { ngn } from "@/lib/format";
import { safeSearch } from "@/lib/money";
import { ratingSummary } from "@/lib/marketplace";
import { CATEGORIES } from "./_lib/core";
import { CourseCard, type CardCourse } from "./_components/CourseCard";
import "./marketplace.css";

export const metadata: Metadata = { title: "Courses", description: "Practical automation, AI and business courses from Automancy and independent creators, reviewed before they go live." };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function Catalogue({ searchParams }: Props) {
  const sp = await searchParams;
  const term = safeSearch(sp.q);
  const cat = (CATEGORIES as readonly string[]).includes(sp.category || "") ? sp.category! : "";
  let courses: CardCourse[] = [];
  let ratings: Record<string, { avg: number; count: number }> = {};
  if (hasSupabase()) {
    const db = createAdminClient();
    let query = db.from("courses").select("id, slug, title, subtitle, cover_url, category, level, price_ngn, is_free, creator_id, published_at").eq("status", "live");
    if (cat) query = query.eq("category", cat);
    if (term) query = query.or(`title.ilike.%${term}%,subtitle.ilike.%${term}%,description.ilike.%${term}%`);
    const { data } = await query.order("published_at", { ascending: false }).limit(60);
    const rows = data || [];
    const ids = [...new Set(rows.map(r => r.creator_id as string))];
    const { data: creators } = ids.length ? await db.from("creators").select("user_id, display_name").in("user_id", ids) : { data: [] };
    const names = new Map((creators || []).map(c => [c.user_id as string, c.display_name as string]));
    courses = rows.map(r => ({
      slug: r.slug as string, title: r.title as string, subtitle: r.subtitle as string | null, cover_url: r.cover_url as string | null,
      category: r.category as string | null, level: r.level as string, price_ngn: r.price_ngn as number, is_free: !!r.is_free,
      creator: names.get(r.creator_id as string) || null
    }));
    const r = await ratingSummary(rows.map(x => x.id as string));
    ratings = Object.fromEntries(rows.map(x => [x.slug as string, r[x.id as string]]).filter(([, v]) => v)) as Record<string, { avg: number; count: number }>;
  }
  const flagship = product("self");
  const filtered = !!(term || cat);

  return (
    <section className="wrap stack" style={{ gap: 22 }}>
      <header className="mk-hero">
        <p className="eyebrow">Courses</p>
        <h1>Learn a skill. Use it this week.</h1>
        <p className="lede">Short, practical courses from Automancy and independent creators. Every course is reviewed by our team before it goes live.</p>
      </header>

      <form className="mk-filter" role="search" method="get">
        <label className="fld">Search<input name="q" type="search" defaultValue={term} placeholder="e.g. WhatsApp, n8n, invoices" /></label>
        <label className="fld">Category
          <select name="category" defaultValue={cat}>
            <option value="">All categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <div className="row"><button className="btn" type="submit">Search</button>{filtered && <Link className="btn alt" href="/courses">Clear</Link>}</div>
      </form>

      {!filtered && (
        <Link href="/" className="card bold mk-flag" style={{ textDecoration: "none", color: "var(--ink)" }}>
          <p className="eyebrow">Flagship · by Automancy</p>
          <h2 style={{ fontSize: "1.6rem" }}>Automancy Academy: AI automation, from zero to paid client work</h2>
          <p>49 lessons, 6 boss projects and a capstone. Zapier, Make, n8n, AI agents, growth and CRM, following Tolu's produce business in Ibadan. Base Camp is free.</p>
          <p><b>{flagship ? `${ngn(flagship.ngn)} · ` : ""}Start free →</b></p>
        </Link>
      )}

      {courses.length ? (
        <div className="mk-grid">{courses.map(c => <CourseCard key={c.slug} c={c} rating={ratings[c.slug]} />)}</div>
      ) : (
        <div className="empty">
          {filtered ? <>No courses match that search. <Link href="/courses">See all courses</Link>.</> : <>Creator courses are coming soon. Know your stuff? <Link href="/teach">Teach on Automancy</Link>.</>}
        </div>
      )}

      <div className="card row" style={{ justifyContent: "space-between" }}>
        <p><b>Teach what you know.</b> Creators keep 70% of every sale after payment fees.</p>
        <Link className="btn alt" href="/teach">Become a creator</Link>
      </div>
    </section>
  );
}
