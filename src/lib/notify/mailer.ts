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

let transport: Transporter | null = null;

export function mailConfigured(): boolean {
  const s = smtp();
  return !!(s.user && s.pass);
}

/** The DoC's own readiness also needs its backend key; mail alone does not. */
export { smtpConfigured };

export async function sendHubMail(m: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
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
    from: FROM, replyTo: REPLY_TO, to: m.to, subject: m.subject, html: m.html, text: m.text,
  });
  if (!info.accepted?.length) {
    throw new Error(`SMTP refused ${m.to}: ${JSON.stringify(info.rejected ?? [])}`);
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
  cta?: { label: string; href: string };
  hubUrl: string;
}): string {
  const button = opts.cta
    ? `<p style="margin:26px 0 0"><a href="${esc(opts.cta.href)}" style="background:#2459d1;color:#fff;text-decoration:none;padding:11px 20px;border-radius:10px;font-weight:600;display:inline-block">${esc(opts.cta.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f5f6fa">
  <div style="max-width:620px;margin:0 auto;padding:28px 20px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#15223a">
    <div style="font-size:21px;font-weight:800;letter-spacing:-.02em;margin-bottom:22px">APSO<span style="color:#5b6ef5;font-weight:700">hub</span></div>
    <div style="background:#fff;border-radius:16px;padding:24px;border:1px solid #e7eaf1">
      <h1 style="margin:0 0 6px;font-size:18px;font-weight:600;letter-spacing:-.02em">${esc(opts.heading)}</h1>
      <p style="margin:0 0 18px;font-size:14px;color:#5d6b85;line-height:1.5">${esc(opts.intro)}</p>
      ${opts.rows}
      ${button}
    </div>
    <p style="margin:18px 0 0;font-size:12px;color:#8b97ac;line-height:1.5">
      You are getting this because you switched it on in the hub.
      <a href="${esc(opts.hubUrl)}/settings/preferences" style="color:#5d6b85">Turn it off</a>.
    </p>
  </div></body></html>`;
}

export { esc };
