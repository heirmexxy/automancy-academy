import Link from "next/link";
import type { Metadata } from "next";
import { product } from "@/lib/pricing";
import { ngn } from "@/lib/format";
import { safeSearch } from "@/lib/money";
import { liveCourses } from "@/lib/catalogue";
import { CATEGORIES } from "./_lib/core";
import { CourseCard } from "./_components/CourseCard";
import "./marketplace.css";

export const metadata: Metadata = { title: "Explore more courses", description: "Practical automation, AI and business courses from Automancy and independent creators, reviewed before they go live." };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function Catalogue({ searchParams }: Props) {
  const sp = await searchParams;
  const term = safeSearch(sp.q);
  const cat = (CATEGORIES as readonly string[]).includes(sp.category || "") ? sp.category! : "";
  const { courses, ratings } = await liveCourses({ term, category: cat });
  const flagship = product("self");
  const filtered = !!(term || cat);

  return (
    <section className="wrap stack" style={{ gap: 22 }}>
      <header className="mk-hero">
        <p className="eyebrow">Explore more courses</p>
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
