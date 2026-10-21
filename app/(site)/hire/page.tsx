import Link from "next/link";
import type { Metadata } from "next";
import "../community/community.css";
import { createClient } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/config";
import { product } from "@/lib/pricing";
import { ngn } from "@/lib/format";
import { AVAILABILITY } from "../community/_lib/rules";
import { IntroForm } from "./_components/IntroForm";
import { HIRE_COLS, type HireProfile } from "./_lib";

export const metadata: Metadata = {
  title: "Hire talent",
  description: "Certified Automancy Academy graduates who build automations with Zapier, Make, n8n and AI agents."
};
export const dynamic = "force-dynamic";

const uniq = (xs: string[]) => [...new Map(xs.filter(Boolean).map(x => [x.toLowerCase(), x])).values()].sort((a, b) => a.localeCompare(b));

export default async function Hire({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  let all: HireProfile[] = [];
  if (hasSupabase()) {
    const sb = await createClient();
    // RLS returns only visible profiles of learners holding a non-revoked certificate.
    const { data } = await sb.from("hire_profiles").select(HIRE_COLS).order("updated_at", { ascending: false }).limit(500);
    all = (data || []) as HireProfile[];
  }
  const q = (sp.q || "").trim().toLowerCase().slice(0, 80);
  const skill = sp.skill || "", tool = sp.tool || "", city = sp.city || "", av = sp.availability || "";
  const eq = (a: string | null, b: string) => (a || "").toLowerCase() === b.toLowerCase();
  const list = all.filter(p =>
    (!q || [p.display_name, p.headline, p.bio, p.city, ...p.skills, ...p.tools].join(" ").toLowerCase().includes(q)) &&
    (!skill || p.skills.some(s => eq(s, skill))) &&
    (!tool || p.tools.some(t => eq(t, tool))) &&
    (!city || eq(p.city, city)) &&
    (!av || p.availability === av));
  const skills = uniq(all.flatMap(p => p.skills)), tools = uniq(all.flatMap(p => p.tools)), cities = uniq(all.map(p => p.city || ""));
  const post = product("employer_post");
  const filtered = !!(q || skill || tool || city || av);

  return (
    <div className="wrap community stack">
      <header className="stack">
        <span className="eyebrow">Hire talent</span>
        <h1>Hire certified automation builders</h1>
        <p className="lede">Every person listed here finished the Automancy Academy course, passed the capstone review and holds a certificate you can verify. They build with Zapier, Make, n8n and AI agents for real businesses.</p>
        <div className="row">
          <a className="btn" href="#intro">Tell us who you need</a>
          {post && <Link className="btn alt" href="/checkout/employer_post">{post.cta} · {ngn(post.ngn)} {post.period}</Link>}
        </div>
      </header>

      {all.length > 0 && (
        <form className="card filters" method="get" role="search" aria-label="Filter graduates">
          <label className="fld">Search<input name="q" defaultValue={sp.q || ""} placeholder="Name, skill, tool or city" /></label>
          <label className="fld">Skill<select name="skill" defaultValue={skill}><option value="">Any</option>{skills.map(s => <option key={s}>{s}</option>)}</select></label>
          <label className="fld">Tool<select name="tool" defaultValue={tool}><option value="">Any</option>{tools.map(s => <option key={s}>{s}</option>)}</select></label>
          <label className="fld">City<select name="city" defaultValue={city}><option value="">Anywhere</option>{cities.map(s => <option key={s}>{s}</option>)}</select></label>
          <label className="fld">Availability<select name="availability" defaultValue={av}><option value="">Any</option>{Object.entries(AVAILABILITY).filter(([k]) => k !== "not_available").map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <div className="row"><button className="btn sm" type="submit">Filter</button>{filtered && <Link className="note" href="/hire">Clear</Link>}</div>
        </form>
      )}

      {all.length === 0 ? (
        <div className="empty stack">
          <b>No graduate profiles yet.</b>
          <span>Graduates appear here after they finish the course, pass the capstone review and receive their certificate, then choose to publish a profile. Tell us what you need below and we&apos;ll introduce you as soon as there&apos;s a match.</span>
        </div>
      ) : (
        <>
          <p className="note" aria-live="polite">{list.length} {list.length === 1 ? "graduate matches" : "graduates match"}</p>
          {list.length ? (
            <div className="grid3">
              {list.map(p => (
                <article className="card tcard" key={p.user_id}>
                  <div className="who"><span className="av" aria-hidden="true">{p.display_name.slice(0, 1).toUpperCase()}</span>
                    <div><h3>{p.display_name}</h3><small className="muted">{[p.city, AVAILABILITY[p.availability]].filter(Boolean).join(" · ")}</small></div></div>
                  <p>{p.headline}</p>
                  {(p.tools.length > 0 || p.skills.length > 0) && <div className="tags">{[...p.tools, ...p.skills].slice(0, 8).map(t => <span key={t}>{t}</span>)}</div>}
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="note">{p.rate_note || ""}{p.cert_id ? <>{p.rate_note ? " · " : ""}<span className="pill ok">Certified</span></> : null}</span>
                    <Link className="btn sm" href={`/hire/${p.user_id}`}>View profile</Link>
                  </div>
                </article>
              ))}
            </div>
          ) : <div className="empty">No graduates match those filters. Try fewer filters, or tell us what you need below.</div>}
        </>
      )}

      <section className="hp-grid" id="intro" aria-labelledby="intro-h">
        <div className="card stack">
          <h2 id="intro-h" style={{ fontSize: "1.4rem" }}>Tell us who you need</h2>
          <IntroForm cta="Send request" />
        </div>
        <div className="card stack">
          <h3>For employers</h3>
          <ul className="prose" style={{ margin: 0 }}>
            <li>Graduates hold a certificate you can check at <Link href="/verify">/verify</Link>.</li>
            <li>Introductions are free. We connect you by email; you agree terms directly with the graduate.</li>
            {post && <li><Link href="/checkout/employer_post">Post a role</Link> to reach graduates for {post.accessDays} days ({ngn(post.ngn)} {post.period}).</li>}
          </ul>
          <p className="note">Graduate? <Link href="/hire/profile">Create or edit your profile</Link>.</p>
        </div>
      </section>
    </div>
  );
}
