import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { SUPPORT_EMAIL } from "@/lib/config";
import { moneyText } from "@/lib/money";
import { fulfilPayment } from "@/lib/paystack";
import { flatLessons, getCourseBySlug, getCurriculum, handleCoursePayment, isEnrolled } from "@/lib/marketplace";
import "../../marketplace.css";

export const metadata: Metadata = { title: "Payment" };
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | undefined>> };

/** Paystack returns here (callback_url set by startCoursePurchase). Verification happens server-side in A's fulfilPayment. */
export default async function CoursePaid({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const reference = (sp.reference || sp.trxref || "").slice(0, 100);
  const user = await requireUser(`/courses/${slug}/paid${reference ? `?reference=${encodeURIComponent(reference)}` : ""}`);
  const course = await getCourseBySlug(slug);

  const fail = (title: string, msg: string) => (
    <section className="narrow stack">
      <div className="card bold">
        <p className="eyebrow">Payment</p>
        <h1 style={{ fontSize: "2rem" }}>{title}</h1>
        <p role="alert">{msg}</p>
        <div className="row">{course && <Link className="btn" href={`/courses/${course.slug}`}>Back to the course</Link>}<Link className="btn alt" href="/account#purchases">Your purchases</Link></div>
        <p className="note">If money left your account and this page doesn't update within an hour, email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with the reference {reference || "from your bank alert"}.</p>
      </div>
    </section>
  );
  if (!reference || !course) return fail("No payment to check", "We didn't receive a payment reference from Paystack.");

  const r = await fulfilPayment(reference, { onCourse: handleCoursePayment });
  const { data: own } = await createAdminClient().from("payments").select("user_id, product").eq("reference", reference).maybeSingle();
  if (!own || own.user_id !== user.id || own.product !== `course:${course.id}`) return fail("Payment not found", "We couldn't find that payment on your account.");
  if (!r.ok || !r.payment) return fail("Payment not completed", r.message);
  // fulfilPayment runs our handler only the first time; make sure access exists even if this is a repeat visit.
  if (!(await isEnrolled(user.id, course.id))) await handleCoursePayment(r.payment);
  const enrolled = await isEnrolled(user.id, course.id);
  if (!enrolled) return fail("We're checking your payment", "Your payment went through but we couldn't open the course yet. Our team has been alerted; you'll get access shortly.");
  const first = flatLessons(await getCurriculum(course.id, false))[0];

  return (
    <section className="narrow stack">
      <div className="card bold">
        <p className="eyebrow">Payment confirmed</p>
        <h1 style={{ fontSize: "2rem" }}>You're in: {course.title}</h1>
        <p>Paid {moneyText(r.payment.amount_kobo, r.payment.currency)} · reference <code>{r.payment.reference}</code>. A receipt is on its way to {user.email}.</p>
        <div className="row">
          {first && <Link className="btn" href={`/courses/${course.slug}/learn/${first.id}`}>Start the course</Link>}
          <Link className="btn alt" href={`/courses/${course.slug}`}>Course page</Link>
        </div>
      </div>
    </section>
  );
}
