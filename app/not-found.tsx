import Link from "next/link";
import type { Metadata } from "next";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="narrow" style={{ minHeight: "80vh", display: "grid", alignContent: "center", gap: 16, paddingBlock: 40 }}>
      <Link href="/" className="brand" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "var(--ink)", fontWeight: 800 }}>
        <span style={{ width: 30, height: 30, display: "inline-block" }}><Logo /></span>Automancy Academy
      </Link>
      <p className="eyebrow">Error 404</p>
      <h1>Glitch ate this page.</h1>
      <p className="lede">The page you're looking for doesn't exist or has moved. Check the address, or try one of these.</p>
      <div className="row">
        <Link className="btn" href="/">Home</Link>
        <Link className="btn alt" href="/learn">My course</Link>
        <Link className="btn alt" href="/pricing">Pricing</Link>
      </div>
    </main>
  );
}
