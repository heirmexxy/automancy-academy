export function SecHead({ id, eyebrow, title, lede }: { id: string; eyebrow?: string; title: string; lede?: React.ReactNode }) {
  return (
    <div className="sec-head">
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h2 id={id}>{title}</h2>
      {lede && <p className="lede">{lede}</p>}
    </div>
  );
}

/** Three numbered, coloured steps (used on the landing page and Careers). */
export function Steps({ items }: { items: { title: string; body: React.ReactNode; color: string }[] }) {
  return (
    <ol className="cols3" style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {items.map((s, i) => (
        <li key={s.title} style={{ ["--c" as string]: s.color } as React.CSSProperties} className="card">
          <span className="stp" aria-hidden="true">{i + 1}</span>
          <h3>{s.title}</h3>
          <p>{s.body}</p>
        </li>
      ))}
    </ol>
  );
}
