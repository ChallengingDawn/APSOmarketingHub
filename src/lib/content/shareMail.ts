// THE EMAIL A PERSON GETS WHEN A PROJECT IS SHARED WITH THEM.
//
// Sent by the hub through its own relay (src/lib/notify/mailer.ts), in the
// hub's notification frame. It comes "from" the person who shared - their
// name in front of the hub's address - and a reply goes to them, not to
// support: an invitation is a conversation between two colleagues that the
// hub only delivers. Settings > Mail shows this exact template.

import { esc, wrap } from "@/lib/notify/mailer";

export function hubPublicUrl(): string {
  return (process.env.HUB_PUBLIC_URL ?? "https://apsomarketinghub-dev.awssandbox.angst-pfister.com").replace(/\/+$/, "");
}

export type InviteMail = {
  inviterName: string;
  inviteeName: string;
  projectId: number;
  projectTitle: string;
  brief: string | null;
  message: string | null;
  role: "editor" | "commenter";
};

const CAN = { editor: "edit and comment on it", commenter: "read it and comment" } as const;

export function renderInviteMail(m: InviteMail): { subject: string; html: string; text: string } {
  const link = `${hubPublicUrl()}/projects/${m.projectId}`;
  const subject = `${m.inviterName} shared “${m.projectTitle}” with you`;
  const quote = m.message
    ? `<div style="margin:0 0 16px;padding:12px 14px;border-left:3px solid #5b6ef5;background:#f5f6fa;border-radius:8px">
        <div style="font-size:12px;color:#8b97ac;margin-bottom:4px">${esc(m.inviterName)} wrote</div>
        <div style="font-size:14px;color:#15223a;line-height:1.55;white-space:pre-wrap">${esc(m.message)}</div>
      </div>`
    : "";
  const brief = m.brief
    ? `<div style="font-size:12px;color:#8b97ac;margin:0 0 4px">The brief</div>
       <div style="font-size:14px;color:#5d6b85;line-height:1.55;white-space:pre-wrap">${esc(m.brief.length > 600 ? `${m.brief.slice(0, 600)}…` : m.brief)}</div>`
    : "";
  const html = wrap({
    heading: `${m.inviterName} shared a project with you`,
    intro: `Hello ${m.inviteeName}, “${m.projectTitle}” is now in your projects - you can ${CAN[m.role]}.`,
    rows: quote + brief,
    cta: { label: "Open the project", href: link },
    hubUrl: hubPublicUrl(),
    footer: `Sent by APSOhub because ${m.inviterName} shared a content project with you. Reply to this email to answer ${m.inviterName}.`,
  });
  const text = [
    `Hello ${m.inviteeName},`,
    "",
    `${m.inviterName} shared the project “${m.projectTitle}” with you - you can ${CAN[m.role]}.`,
    ...(m.message ? ["", `${m.inviterName} wrote:`, m.message] : []),
    ...(m.brief ? ["", "The brief:", m.brief] : []),
    "",
    `Open it: ${link}`,
    "",
    `Sent by APSOhub because ${m.inviterName} shared a content project with you.`,
  ].join("\n");
  return { subject, html, text };
}

/** The example the Mail settings page renders, so the preview is the real template. */
export const SAMPLE_INVITE: InviteMail = {
  inviterName: "Anna Muster",
  inviteeName: "Marc",
  projectId: 1,
  projectTitle: "DirectCut landing page, Italy",
  brief: "One landing page for Italian workshops: what DirectCut cuts, in which materials, how fast it ships.",
  message: "Could you look at the two openings tonight? I lean towards the shorter one, but your German version reads better.",
  role: "editor",
};
