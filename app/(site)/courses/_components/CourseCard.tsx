import Link from "next/link";
import { Stars } from "./Markdown";

export type CardCourse = { slug: string; title: string; subtitle: string | null; cover_url: string | null; category: string | null; level: string; price_ngn: number; is_free: boolean; creator: string | null };

export function CourseCard({ c, rating }: { c: CardCourse; rating?: { avg: number; count: number } }) {
  return (
    <Link href={`/courses/${c.slug}`} className="card mk-card">
      <div className="mk-cover">{c.cover_url ? <img src={c.cover_url} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span aria-hidden="true">{c.title.slice(0, 1)}</span>}</div>
      <div className="row" style={{ gap: 6 }}>
        {c.category && <span className="pill">{c.category}</span>}
        <span className="pill">{c.level}</span>
      </div>
      <h3>{c.title}</h3>
      {c.subtitle && <p className="muted mk-clamp">{c.subtitle}</p>}
      {c.creator && <p className="note">by {c.creator}</p>}
      <div className="row mk-cardfoot">
        <b>{c.is_free ? "Free" : "₦" + c.price_ngn.toLocaleString("en-NG")}</b>
        {rating && rating.count > 0 && <Stars value={rating.avg} count={rating.count} />}
      </div>
    </Link>
  );
}
