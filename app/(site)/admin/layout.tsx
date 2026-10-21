import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

/** Admin dashboard shell. Every page under /admin is admin-only (checked here and again in each server action). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="wrap admin">
      <aside aria-label="Admin">
        <Link href="/admin">Overview</Link>
        <Link href="/admin/learners">Learners</Link>
        <Link href="/admin/payments">Payments</Link>
        <Link href="/admin/refunds">Refunds</Link>
        <Link href="/admin/referrals">Referrals</Link>
        <Link href="/admin/reviews">AI reviews</Link>
        <Link href="/admin/certificates">Certificates</Link>
        <Link href="/admin/community">Community</Link>
        <Link href="/admin/hire">Hire talent</Link>
        <Link href="/admin/courses">Creator courses</Link>
        <Link href="/admin/audio">Lesson audio</Link>
        <Link href="/admin/feedback">Feedback</Link>
        <Link href="/admin/settings">Settings</Link>
      </aside>
      <div className="stack" style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}
