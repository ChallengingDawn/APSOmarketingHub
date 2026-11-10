// THE INVITATION MAIL (SARCLA 10.11.2026, on Add a person: "are we sending a mail here? ... it would be easier to send
// the mail and user"). Its words: ./inviteMailRules.ts.
//
// What it carries is what the admin would have said: the hub's address and the one to sign in with. No link that signs
// anybody in - the door asks a never-used account to choose its password (src/app/api/auth/claim), so the mail holds
// nothing a forwarded copy could use. Never to an inbox (notify/teamRecipients: a mail there comes back as a ticket).

import { esc, mailConfigured, sendHubMail, wrap } from "@/lib/notify/mailer";
import { isInbox } from "@/lib/notify/teamRecipients";
import { inviteContent, type InviteMailFor, type InviteMailFrom } from "./inviteMailRules";

const HUB_URL = process.env.HUB_PUBLIC_URL ?? "https://apsomarketinghub-dev.awssandbox.angst-pfister.com";

const rowHtml = (k: string, v: string) =>
  `<tr><td style="padding:5px 12px 5px 0;color:#8b97ac;font-size:13px;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:5px 0;font-size:14px;color:#15223a">${esc(v)}</td></tr>`;

/** Send it; the address it went to, or why not. Never throws - the account stands either way. */
export async function sendInviteMail(to: InviteMailFor, from: InviteMailFrom): Promise<{ mailed: string | null; mailError: string | null }> {
  if (!mailConfigured()) return { mailed: null, mailError: "the hub's mail is not set up" };
  try {
    if (await isInbox(to.email)) return { mailed: null, mailError: `${to.email} is a HubSpot inbox, never mailed` };
    const c = inviteContent(to, from);
    const signin = `${HUB_URL}/signin`;
    await sendHubMail({
      to: to.email,
      subject: c.subject,
      html: wrap({
        heading: c.heading, intro: c.intro,
        rows: `<table style="border-collapse:collapse">${c.rows.map(([k, v]) => rowHtml(k, v)).join("")}</table>`,
        cta: { label: "Open the hub", href: signin, red: true }, hubUrl: HUB_URL, footer: c.footer,
      }),
      text: [c.intro, "", ...c.rows.map(([k, v]) => `${k}: ${v}`), "", `Open the hub: ${signin}`, "", c.footer].join("\n"),
      fromName: `${from.fullName} via APSOhub`,
      ...(from.email ? { replyTo: from.email } : {}),
    });
    return { mailed: to.email, mailError: null };
  } catch (e) {
    return { mailed: null, mailError: String((e as Error)?.message ?? e).slice(0, 160) };
  }
}
