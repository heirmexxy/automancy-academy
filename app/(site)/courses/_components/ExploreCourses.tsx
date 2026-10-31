import Link from "next/link";
import { liveCourses } from "@/lib/catalogue";
import { CourseCard } from "./CourseCard";
import "../marketplace.css";

/** "Explore more courses": the newest live creator courses, with a link to the full catalogue. */
export async function ExploreCourses({ title = "Explore more courses", limit = 3, excludeIds = [], headingId = "explore-h" }: { title?: string; limit?: number; excludeIds?: string[]; headingId?: string }) {
  const { courses, ratings } = await liveCourses({ limit, excludeIds }).catch(() => ({ courses: [], ratings: {} as Record<string, { avg: number; count: number }> }));
  return (
    <div className="stack" aria-labelledby={headingId}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 id={headingId}>{title}</h2>
        <Link className="btn alt sm" href="/courses">See all courses</Link>
      </div>
      {courses.length ? (
        <div className="mk-grid">{courses.map(c => <CourseCard key={c.slug} c={c} rating={ratings[c.slug]} />)}</div>
      ) : (
        <p className="empty">More courses from independent creators are on the way. <Link href="/courses">Browse the catalogue</Link> or <Link href="/teach">teach your own</Link>.</p>
      )}
    </div>
  );
}
