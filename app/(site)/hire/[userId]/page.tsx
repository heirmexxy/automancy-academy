import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import "../../community/community.css";
import { createClient } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/config";
import { fmtDate } from "@/lib/format";
import { AVAILABILITY } from "../../community/_lib/rules";
import { IntroForm } from "../_components/IntroForm";
import { HIRE_COLS, type HireProfile } from "../_lib";

export const dynamic = "force-dynamic";

async function load(userId: string): Promise<HireProfile | null> {
  if (!hasSupabase() || !/^[0-9a-f-]{36}$/i.test(userId)) return null;
  const sb = await createClient();
  const { data } = await sb.from("hire_profiles").select(HIRE_COLS).eq("user_id", userId).maybeSingle();
  return (data as HireProfile) || null;
}

export async function generateMetadata({ params }: { params: Promise<{ userId: string }> }): Promise<Metadata> {
  const p = await load((await params).userId);
  return p ? { title: `${p.display_name} · Hire talent`, description: p.headline } : { title: "Hire talent" };
}

export default async function HireProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const p = await load(userId);
  if (!p) notFound();
  return (
    <div className="wrap community stack">
      <p className="note"><Link href="/hire">← All graduates</Link></p>
      <div className="hp-grid">
        <article className="card bold stack">
          <div className="who"><span className="av" aria-hidden="true">{p.display_name.slice(0, 1).toUpperCase()}</span>
            <div><h1 style={{ fontSize: "clamp(1.6rem,4vw,2.3rem)" }}>{p.display_name}</h1>
              <small className="muted">{[p.city, AVAILABILITY[p.availability], p.rate_note].filter(Boolean).join(" · ")}</small></div></div>
          <p className="lede">{p.headline}</p>
          {p.bio && <p className="post-body">{p.bio}</p>}
          {p.tools.length > 0 && <div className="stack" style={{ gap: 6 }}><span className="eyebrow">Tools</span><div className="tags">{p.tools.map(t => <span key={t}>{t}</span>)}</div></div>}
          {p.skills.length > 0 && <div className="stack" style={{ gap: 6 }}><span className="eyebrow">Skills</span><div className="tags">{p.skills.map(t => <span key={t}>{t}</span>)}</div></div>}
          {p.portfolio_links.length > 0 && (
            <div className="stack" style={{ gap: 6 }}><span className="eyebrow">Portfolio</span>
              <ul className="prose" style={{ margin: 0 }}>{p.portfolio_links.map(l => <li key={l}><a href={l} target="_blank" rel="nofollow ugc noopener noreferrer">{l.replace(/^https:\/\//, "").slice(0, 80)}</a></li>)}</ul></div>
          )}
          <div className="alert ok">
            <b>Certified Automancy Academy graduate.</b>{" "}
            {p.cert_id ? <>Certificate <code>{p.cert_id}</code> · <Link href={`/verify/${encodeURIComponent(p.cert_id)}`}>verify it</Link>.</> : "Certificate on file."}
          </div>
          <p className="note">Profile updated {fmtDate(p.updated_at)}. Written by the graduate; we check the certificate, not every claim.</p>
        </article>
        <aside className="card stack" aria-labelledby="intro-h">
          <h2 id="intro-h" style={{ fontSize: "1.3rem" }}>Request an introduction</h2>
          <IntroForm profileUserId={p.user_id} />
        </aside>
      </div>
    </div>
  );
}
