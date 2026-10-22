import Link from "next/link";
import { COMPANY, SUPPORT_EMAIL } from "@/lib/config";

export function SiteFooter() {
  return (
    <footer className="site-f">
      <div className="wrap">
        <nav aria-label="Footer">
          <Link href="/pricing">Pricing</Link><Link href="/careers">Careers</Link><Link href="/hire">Hire talent</Link>
          <Link href="/courses">More courses</Link><Link href="/teach">Teach on Automancy</Link><Link href="/teach/standards">Creator standards</Link><Link href="/earn">Refer &amp; earn</Link><Link href="/verify">Verify a certificate</Link>
          <Link href="/legal/terms">Terms</Link><Link href="/legal/privacy">Privacy</Link><Link href="/legal/refunds">Refunds</Link><Link href="/legal/certificate">Certificate</Link>
          <a href={`mailto:${SUPPORT_EMAIL}`}>Support</a>
        </nav>
        <p>© {new Date().getFullYear()} Automancy Academy, a product of {COMPANY.legalName}, built with Kitovu. Zapier, Make, n8n, HubSpot, Zoho and other names are trademarks of their owners; this course is independent and not endorsed by them.</p>
      </div>
    </footer>
  );
}
