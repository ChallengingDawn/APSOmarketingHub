// A NEW PERSON'S WAY INTO A SANDBOX - the one-time link the sandbox made (src/lib/sandbox/people.ts), mailed by the hub
// because the sandbox holds no mail credentials. The link sets their password and their authenticator; the same
// login opens the CLI. For a builder the mail also says how to get going; an admin only needs the link.

import type { PendingInvite } from "@/lib/sandbox/peopleList";
import { esc, sendHubMail, wrap } from "@/lib/notify/mailer";
import { hubPublicUrl } from "@/lib/content/shareMail";

export function inviteMail(i: PendingInvite, sandboxHost: string, hubUrl: string) {
  const sandbox = `https://${sandboxHost}`;
  const step = (n: number, html: string) =>
    `<tr><td style="padding:6px 10px 6px 0;vertical-align:top;color:#8b97ac;font-size:13px">${n}</td><td style="padding:6px 0;font-size:14px;line-height:1.5">${html}</td></tr>`;
  const code = (s: string) => `<code style="font:12px ui-monospace,Consolas,monospace;background:#f3f5f9;padding:2px 6px;border-radius:6px">${esc(s)}</code>`;
  const rows = `<table style="border-collapse:collapse;width:100%">
    ${step(1, "Open the button below (once, within 72 hours): set your password and add the sandbox to your authenticator app.")}
    ${step(2, `On your computer: Node 22, Git, the Railway CLI (${code("npm i -g @railway/cli")}) and Claude Code.`)}
    ${step(3, `In an empty folder: ${code(`curl -O ${sandbox}/sbx.mjs`)}, then ${code(`node sbx.mjs login --url ${sandbox}`)} and ${code("node sbx.mjs pull")}.`)}
    ${step(4, `${code("npm install")}, then start Claude Code in that folder - its CLAUDE.md has the rules and the way of working.`)}
    </table>
    <p style="margin:14px 0 0;font-size:13px;color:#5d6b85;line-height:1.5">Everything in the sandbox is coded: customers by their HubSpot number, nothing real is stored.</p>`;
  return {
    subject: "Your APSOhub sandbox",
    html: wrap({ heading: `Hello ${i.name.split(" ")[0]}`, intro: "A copy of APSOhub to build in, with coded data only.",
      rows, cta: { label: "Set up my access", href: i.url }, hubUrl,
      footer: "This link works once and for 72 hours. If it has run out, ask for a new one." }),
    text: `A copy of APSOhub to build in, with coded data only.\n\n1. Set up your access (once, within 72 hours): ${i.url}\n`
      + `2. Install Node 22, Git, the Railway CLI (npm i -g @railway/cli) and Claude Code.\n`
      + `3. In an empty folder: curl -O ${sandbox}/sbx.mjs; node sbx.mjs login --url ${sandbox}; node sbx.mjs pull\n`
      + `4. npm install, then start Claude Code in that folder - its CLAUDE.md has the rules.\n`,
  };
}

export async function sendInvite(i: PendingInvite, sandboxHost: string): Promise<void> {
  const m = inviteMail(i, sandboxHost, hubPublicUrl());
  await sendHubMail({ to: i.email, subject: m.subject, html: m.html, text: m.text });
}
