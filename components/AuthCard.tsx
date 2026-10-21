export function AuthCard({ title, sub, children, error, notice }: { title: string; sub?: string; children: React.ReactNode; error?: string; notice?: string }) {
  return (
    <section className="narrow" style={{ maxWidth: 460 }}>
      <div className="card bold" style={{ padding: 24, gap: 14 }}>
        <h1 style={{ fontSize: "1.9rem" }}>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
        {notice && <p className="alert ok" role="status">{notice}</p>}
        {error && <p className="alert bad" role="alert">{error}</p>}
        {children}
      </div>
    </section>
  );
}
