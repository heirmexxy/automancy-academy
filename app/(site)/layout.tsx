import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

/** Layout for every public and account page (not the full-screen course at /learn). */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (<><SiteHeader /><main>{children}</main><SiteFooter /></>);
}
