import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SITE_URL } from "@/lib/config";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Automancy Academy · Learn AI automation that runs real businesses", template: "%s · Automancy Academy" },
  description: "Build automations and AI agents with Zapier, Make and n8n, on real Nigerian business problems. 49 lessons, 6 projects, a reviewed capstone and a certificate.",
  openGraph: { type: "website", siteName: "Automancy Academy" }
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#13233A" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=JetBrains+Mono:wght@400;600&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
