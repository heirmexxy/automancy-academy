import { SecHead } from "./SecHead";
import { tracks, LESSONS, BOSSES, CAPSTONE, TRACK_COUNT, TOTAL_SESSIONS, WEEKS, SESSIONS_PER_WEEK } from "./data";

/** "What you'll build": the Harvest Lane story, the tracks with live lesson counts, the boss projects and the capstone. */
export function Course() {
  const ts = tracks();
  return (
    <section className="wrap" id="course" aria-labelledby="course-h" style={{ scrollMarginTop: 70 }}>
      <SecHead id="course-h" eyebrow="What you'll build" title="One business, rescued in six seasons"
        lede="Every lesson opens with a problem Tolu faces at Harvest Lane, her small farm-to-kitchen delivery business in Ibadan. You solve it with the guide, then solve a harder version for a business you know. By the finale, Harvest Lane runs on autopilot." />
      <div className="story3">
        <div className="card"><span className="num">Seasons 1–2</span><p className="bubble"><b>Tolu:</b> I spend four hours a day copying orders from WhatsApp into a notebook. Half of them have the wrong phone number.</p><p>Learn how apps talk, how data is shaped, and the first Zaps that save those four hours.</p></div>
        <div className="card"><span className="num">Seasons 3–4</span><p className="bubble"><b>Tolu:</b> We now do 3,000 orders a month. The automation bill is bigger than my rent.</p><p>Visual logic, loops, error handling, and self-hosting that cuts costs to almost zero.</p></div>
        <div className="card"><span className="num">Seasons 5–6</span><p className="bubble"><b>Tolu:</b> Customers message at 2 a.m. asking about refunds, prices and delivery. I can't hire a night shift.</p><p>Agents with memory, tools and human approval. Then Tolu sells the playbook to other businesses.</p></div>
      </div>

      <h3 style={{ marginBottom: 10 }}>{TRACK_COUNT} tracks, {LESSONS} lessons, from introduction to complex</h3>
      <ol className="trail">
        {ts.map(t => (
          <li key={t.track} style={{ ["--c" as string]: t.color } as React.CSSProperties}>
            <div className="stack" style={{ gap: 4 }}>
              <h3><span>Track {t.track}</span>{t.name}{t.track === 0 && <span className="pill ok" style={{ marginLeft: 8 }}>Free</span>}</h3>
              <p>{t.blurb}</p>
            </div>
            <div className="meta">{t.lessons} lessons{t.boss ? " + boss" : ""}{t.capstone ? " + capstone" : ""}<br />{t.sessions} sessions</div>
          </li>
        ))}
      </ol>

      <h3 style={{ margin: "26px 0 10px" }}>{BOSSES.length} boss projects and a capstone</h3>
      <p className="muted" style={{ marginBottom: 12 }}>Each track ends in a Boss Battle: a real project that proves the skill, scored against clear criteria you can read before you start.</p>
      <ul className="bosses">
        {BOSSES.map(b => (
          <li key={b.id}><span className="note">Track {b.track} · {b.trackName}</span><b>{b.title}</b></li>
        ))}
        {CAPSTONE && <li className="cap"><span className="note">Finale</span><b>{CAPSTONE.title}</b></li>}
      </ul>
      <p className="note" style={{ marginTop: 14 }}>About {TOTAL_SESSIONS} sessions of 60–120 minutes. At {SESSIONS_PER_WEEK} sessions a week that's about {WEEKS} weeks; you can go faster or slower.</p>
    </section>
  );
}
