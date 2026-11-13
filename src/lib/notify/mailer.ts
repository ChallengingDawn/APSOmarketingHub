// THE HUB'S OWN POST.
//
// The same relay the Declaration of Conformity mail already uses — HubSpot's
// SMTP on smtp.hubapi.com, with DOC_SMTP_USER and DOC_SMTP_PASS. One relay, one
// set of credentials, one place where "can the hub send mail" is answered.
//
// Nothing here knows what it is sending. A notification builds its own subject
// and body and hands it over; this only puts it on the wire and says whether it
// was accepted.

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { FROM, REPLY_TO, smtp, smtpConfigured } from "@/lib/doc/config";

export { FROM, REPLY_TO, smtp };

let transport: Transporter | null = null;

export function mailConfigured(): boolean {
  const s = smtp();
  return !!(s.user && s.pass);
}

/** The DoC's own readiness also needs its backend key; mail alone does not. */
export { smtpConfigured };

/** The address part of a sender like "APSOparts® <info@news.apsoparts.com>". */
export const addressOf = (from: string) => /<([^>]+)>/.exec(from)?.[1] ?? from.trim();

/**
 * The Back Office's HubSpot inbox, support@apsoparts.com - also the hub's own From on the live server and the
 * Backoffice Team owner's address. A hub mail sent there comes back as a new Back Office ticket. 05.11.2026: 120
 * such tickets in 44 minutes; 11.11.2026: the GQS approvals' "❗Special Request GQS Created" made one per
 * automatically approved request. So no hub mail ever goes there, whoever builds it - the address is taken off To
 * and Cc here, and a mail with nobody else on it is not sent. (Not DOC_REPLY_TO: that may name a person.)
 */
const BACK_OFFICE_INBOX = "support@apsoparts.com";
const OWN_INBOXES = (): Set<string> =>
  new Set([addressOf(FROM), BACK_OFFICE_INBOX].map((a) => a.trim().toLowerCase()).filter(Boolean));
// Split on , and ; outside quotes only, so "Smith, John" <j@x> stays one recipient (3a's review, 12.11.2026).
const splitAddresses = (list: string): string[] => (list.match(/(?:"[^"]*"|[^,;])+/g) ?? []).map((a) => a.trim()).filter(Boolean);
export const isOwnInbox = (address: string | null | undefined): boolean =>
  !!address && OWN_INBOXES().has(addressOf(address).trim().toLowerCase());

export async function sendHubMail(m: {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** A display name in front of the hub's own address - "Anna Muster via APSOhub". The address never changes: the relay only sends as its own domain. */
  fromName?: string;
  /** Where a reply goes, when it should reach a person rather than support. */
  replyTo?: string;
  /** Copies, comma separated (Stock to partners, 18.10.2026). */
  cc?: string;
  /** Files sent with it - the partners' stock file (18.10.2026). */
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
}): Promise<void> {
  const dropped = [...splitAddresses(m.to), ...splitAddresses(m.cc ?? "")].filter((a) => isOwnInbox(a));
  // Untouched when nothing is dropped: the mail goes out exactly as its sender built it.
  const to = dropped.length ? splitAddresses(m.to).filter((a) => !isOwnInbox(a)).join(", ") : m.to;
  const cc = dropped.length ? splitAddresses(m.cc ?? "").filter((a) => !isOwnInbox(a)).join(", ") : (m.cc ?? "");
  if (dropped.length) console.warn(`[mailer] "${m.subject.slice(0, 80)}": not to ${dropped.join(", ")} - the Back Office inbox, a mail there becomes a ticket`);
  if (!to.trim()) throw new Error(`not sent: ${m.to} is the Back Office inbox - a mail there becomes a ticket`);
  const s = smtp();
  if (!s.user || !s.pass) throw new Error("No SMTP credentials: DOC_SMTP_USER / DOC_SMTP_PASS are unset.");
  transport ??= nodemailer.createTransport({
    host: s.host,
    port: s.port,
    secure: s.port === 465,
    requireTLS: s.port !== 465,
    auth: { user: s.user, pass: s.pass },
  });
  const info = await transport.sendMail({
    from: m.fromName ? `"${m.fromName.replace(/["<>]/g, "")}" <${addressOf(FROM)}>` : FROM,
    replyTo: m.replyTo || REPLY_TO, to, subject: m.subject, html: m.html, text: m.text,
    ...(cc ? { cc } : {}), ...(m.attachments?.length ? { attachments: m.attachments } : {}),
  });
  if (!info.accepted?.length) {
    throw new Error(`SMTP refused ${to}: ${JSON.stringify(info.rejected ?? [])}`);
  }
}

const esc = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * One shell for every notification, so they are recognisably from the hub and
 * every one of them says how to stop receiving it. A mail without that line is
 * a mail people filter rather than unsubscribe from.
 */
export function wrap(opts: {
  heading: string;
  intro: string;
  rows: string;
  /** red: the A+P red button (SARCLA 07.11.2026: "on all mails, this button 'Open the ticket' - change the colour to red"). */
  cta?: { label: string; href: string; red?: boolean };
  hubUrl: string;
  /** The last line, when "you switched it on" is not why this mail came. */
  footer?: string;
}): string {
  const button = opts.cta
    ? `<p style="margin:26px 0 0"><a href="${esc(opts.cta.href)}" style="background:${opts.cta.red ? "#ed1b2f" : "#2459d1"};color:#fff;text-decoration:none;padding:11px 20px;border-radius:10px;font-weight:600;display:inline-block">${esc(opts.cta.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f5f6fa">
  <div style="max-width:620px;margin:0 auto;padding:28px 20px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#15223a">
    <div style="font-size:21px;font-weight:800;letter-spacing:-.02em;margin-bottom:22px">APSO<span style="color:#ed1b2f;font-weight:700">hub</span></div>
    <div style="background:#fff;border-radius:16px;padding:24px;border:1px solid #e7eaf1">
      <h1 style="margin:0 0 6px;font-size:18px;font-weight:600;letter-spacing:-.02em">${esc(opts.heading)}</h1>
      <p style="margin:0 0 18px;font-size:14px;color:#5d6b85;line-height:1.5">${esc(opts.intro)}</p>
      ${opts.rows}
      ${button}
    </div>
    <p style="margin:18px 0 0;font-size:12px;color:#8b97ac;line-height:1.5">
      ${opts.footer !== undefined ? esc(opts.footer) : `You are getting this because you switched it on in the hub.
      <a href="${esc(opts.hubUrl)}/settings/preferences" style="color:#5d6b85">Turn it off</a>.`}
    </p>
  </div></body></html>`;
}

export { esc };
