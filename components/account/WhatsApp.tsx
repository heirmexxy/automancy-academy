import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { itemById } from "@/lib/course";
import { businessNumber, hasWhatsApp } from "@/lib/whatsapp/api";
import { decodeEntities, itemLabel, waMeLink } from "@/lib/whatsapp/core";
import { createLinkCode, setWhatsAppReminders, unlinkWhatsApp } from "@/lib/actions/whatsapp";

const NOTICES: Record<string, [string, string]> = {
  unavailable: ["warn", "Learning on WhatsApp isn't switched on yet."],
  slow: ["warn", "You've asked for several codes. Wait a few minutes, then try again."],
  error: ["bad", "We couldn't create a code. Please try again."],
  unlinked: ["ok", "Your number is unlinked. You won't get lessons or reminders on WhatsApp."],
  reminders_on: ["ok", "WhatsApp reminders are on."],
  reminders_off: ["ok", "WhatsApp reminders are off."]
};

const pretty = (e164: string) => {
  const d = e164.replace(/\D/g, "");
  return d.startsWith("234") && d.length === 13 ? `+234 ${d.slice(3, 6)} ${d.slice(6, 9)} ${d.slice(9)}` : e164;
};

/** Account → Learn on WhatsApp: link a number with a one-time code, then manage reminders or unlink. */
export default async function WhatsApp({ notice }: { notice?: string }) {
  const user = await requireUser("/account");
  const head = <h2 id="whatsapp-h" style={{ fontSize: "1.5rem" }}>Learn on WhatsApp</h2>;
  if (!hasWhatsApp()) {
    return (
      <div className="card" aria-labelledby="whatsapp-h">
        {head}
        <p className="muted">Coming soon: take lessons one card at a time in WhatsApp, answer quizzes, send your mission work for review and get reminders, all synced with your progress here.</p>
      </div>
    );
  }

  const db = await createClient();
  const { data: link } = await db.from("wa_links").select("phone_e164, linked_at, opted_in, reminders, stopped_at").eq("user_id", user.id).maybeSingle();
  const n = notice ? NOTICES[notice] : undefined;
  const alert = n ? <p className={`alert ${n[0]}`} role="status">{n[1]}</p> : null;

  if (link) {
    const admin = createAdminClient();
    const { data: sess } = await admin.from("wa_sessions").select("item_id, card_index, paused").eq("phone", link.phone_e164).maybeSingle();
    const it = sess?.item_id ? itemById(String(sess.item_id)) : null;
    return (
      <div className="card stack" aria-labelledby="whatsapp-h">
        {head}
        {alert}
        <p>Linked to <b>{pretty(String(link.phone_e164))}</b>. {link.opted_in
          ? <>Message <a href={`https://wa.me/${businessNumber()}`} target="_blank" rel="noopener noreferrer">Automancy Academy on WhatsApp</a> any time: send <b>MENU</b> to see your options.</>
          : <>You sent <b>STOP</b>, so we don&rsquo;t message this number. Send <b>START</b> to the Automancy number to carry on.</>}</p>
        {it && <p className="note">On WhatsApp you&rsquo;re on {itemLabel(it.id)} · {decodeEntities(it.title)}{sess?.paused ? " (paused)" : ""}.</p>}
        <div className="row">
          <form action={setWhatsAppReminders}>
            <input type="hidden" name="on" value={link.reminders ? "0" : "1"} />
            <button className="btn sm alt" type="submit" disabled={!link.opted_in}>{link.reminders ? "Turn reminders off" : "Turn reminders on"}</button>
          </form>
          <form action={unlinkWhatsApp}><button className="btn sm alt" type="submit">Unlink this number</button></form>
        </div>
        <p className="note">Reminders: if you haven&rsquo;t learned for two days, we send one short WhatsApp nudge with your next lesson (at most every three days). Reply <b>STOP</b> in WhatsApp at any time to stop all messages.</p>
      </div>
    );
  }

  const admin = createAdminClient();
  const { data: codeRow } = await admin.from("wa_link_codes").select("code, expires_at").eq("user_id", user.id).eq("used", false)
    .gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const code = codeRow ? String(codeRow.code) : "";
  const expires = codeRow ? new Date(String(codeRow.expires_at)).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }) : "";

  return (
    <div className="card stack" aria-labelledby="whatsapp-h">
      {head}
      {alert}
      <p>Take the course in WhatsApp: one short card at a time, quizzes you answer with a tap, missions you send for AI review, and a nudge if you fall behind. Your progress is shared with the web course.</p>
      {code ? (
        <div className="stack" style={{ gap: 10 }}>
          <p style={{ margin: 0 }}>Your link code (valid until {expires}, Lagos time):</p>
          <p style={{ fontFamily: "var(--mono)", fontSize: "2.2rem", letterSpacing: "0.3em", margin: 0 }} aria-label={`Code ${code.split("").join(" ")}`}>{code}</p>
          <div className="row">
            <a className="btn" href={waMeLink(businessNumber(), code)} target="_blank" rel="noopener noreferrer">Open WhatsApp and send LINK {code}</a>
          </div>
          <p className="note">On a computer? Send <b>LINK {code}</b> from your phone&rsquo;s WhatsApp to <b>+{businessNumber()}</b>. The code works once.</p>
        </div>
      ) : (
        <form action={createLinkCode}><button className="btn" type="submit">Get my link code</button></form>
      )}
      <p className="note">
        What happens: the message opens in WhatsApp with your code filled in. When you send it, that number is linked to this account and we reply with your first card.
        By sending it you agree to receive course messages from Automancy Academy on WhatsApp (lessons when you ask for them, and occasional reminders you can turn off).
        Reply <b>STOP</b> any time to stop all messages. We store your number only for this; see the <a href="/legal/privacy">privacy policy</a>.
      </p>
      {code && <form action={createLinkCode}><button className="btn sm alt" type="submit">Get a new code</button></form>}
    </div>
  );
}
