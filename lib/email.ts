import "server-only";

/** Sends an email through Resend. With no RESEND_API_KEY (PLACEHOLDER) the email is logged instead, so nothing breaks before launch. */
export async function sendEmail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Automancy Academy <hello@automancy.cc>";
  if (!key) { console.log(`[email:not-sent] to=${to} subject=${subject}`); return { ok: false, skipped: true }; }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html })
  });
  return { ok: r.ok, skipped: false };
}
