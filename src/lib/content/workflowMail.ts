// THE MAILS A CONTENT PROJECT SENDS (SARCLA 07.11.2026: "tag and status should also trigger mails to needed users").
//
// Who gets which is decided in pieceRules (mailsFor, stageMail, mentionsIn); this file only writes and sends them.
// Each comes "from" the person who acted - their name in front of the hub's address - and a reply reaches them.
// Only people with an account in the hub and an address on it are mailed: never a shared inbox, never HubSpot's.

import { esc, sendHubMail, wrap } from "@/lib/notify/mailer";
import { hubPublicUrl } from "@/lib/content/shareMail";
import { personByUsername } from "@/lib/content/sharing";
import { STAGE_LABEL, type MailKind, type MailTo, type Stage } from "@/lib/content/pieceRules";

export type MailContext = {
  actorName: string;
  actorEmail: string | null;
  projectId: number;
  projectTitle: string;
  pieceTitle?: string | null;
  dueDate?: string | null;
  /** A reviewer's note, or the comment that tagged someone. */
  note?: string | null;
  stage?: Stage;
};

const day = (iso: string | null | undefined) => {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
};

/** Subject, heading and the one line under it, per kind. */
export function describe(kind: MailKind, c: MailContext, toName: string): { subject: string; heading: string; intro: string; cta: string } {
  const piece = c.pieceTitle ? `“${c.pieceTitle}”` : "a piece";
  const due = day(c.dueDate) ? `, due ${day(c.dueDate)}` : "";
  const where = `in “${c.projectTitle}”`;
  switch (kind) {
    case "write": return { subject: `${c.actorName} asks you to write ${piece}`, heading: "A piece for you to write", intro: `Hello ${toName}, ${c.actorName} asks you to write ${piece} ${where}${due}.`, cta: "Open the project" };
    case "review_assigned": return { subject: `You review ${piece} ${where}`, heading: "A piece you will review", intro: `Hello ${toName}, ${c.actorName} named you reviewer of ${piece} ${where}${due}. You get a mail when it is ready.`, cta: "Open the project" };
    case "review": return { subject: `${c.actorName} asks you to review ${piece}`, heading: "Ready for your review", intro: `Hello ${toName}, ${piece} ${where} is ready. ${c.actorName} asks you to approve it or ask for changes${due}.`, cta: "Review it" };
    case "approved": return { subject: `${c.actorName} approved ${piece}`, heading: "Approved", intro: `Hello ${toName}, ${c.actorName} approved ${piece} ${where}.`, cta: "Open the project" };
    case "changes": return { subject: `${c.actorName} asks for changes on ${piece}`, heading: "Changes asked", intro: `Hello ${toName}, ${c.actorName} asks for changes on ${piece} ${where}.`, cta: "Open the piece" };
    case "live": return { subject: `${piece} is live`, heading: "Live", intro: `Hello ${toName}, ${c.actorName} marked ${piece} ${where} as live.`, cta: "Open the project" };
    case "mention": return { subject: `${c.actorName} mentioned you in “${c.projectTitle}”`, heading: `${c.actorName} mentioned you`, intro: `Hello ${toName}, ${c.actorName} wrote to you in “${c.projectTitle}”.`, cta: "Answer in the project" };
    case "todo": return { subject: `${c.actorName} gives you a to-do: ${c.pieceTitle ?? ""}`.trim(), heading: "A to-do for you", intro: `Hello ${toName}, ${c.actorName} gives you “${c.pieceTitle ?? "a to-do"}” ${where}${due}.`, cta: "Open the project" };
    case "todo_done": return { subject: `Done: ${c.pieceTitle ?? "a to-do"}`, heading: "A to-do is done", intro: `Hello ${toName}, ${c.actorName} ticked off “${c.pieceTitle ?? "a to-do"}” ${where}.`, cta: "Open the project" };
    case "stage": return { subject: `“${c.projectTitle}” is now ${c.stage ? STAGE_LABEL[c.stage] : "moved"}`, heading: `Now ${c.stage ? STAGE_LABEL[c.stage] : "moved"}`, intro: `Hello ${toName}, your project “${c.projectTitle}” moved to ${c.stage ? STAGE_LABEL[c.stage] : "its next stage"} after ${c.actorName}'s change.`, cta: "Open the project" };
  }
}

export function renderContentMail(kind: MailKind, c: MailContext, toName: string): { subject: string; html: string; text: string } {
  const d = describe(kind, c, toName);
  const link = `${hubPublicUrl()}/projects/${c.projectId}`;
  const quote = c.note
    ? `<div style="margin:0 0 16px;padding:12px 14px;border-left:3px solid #c22c6e;background:#fbf3f7;border-radius:8px">
        <div style="font-size:12px;color:#8b97ac;margin-bottom:4px">${esc(c.actorName)} wrote</div>
        <div style="font-size:14px;color:#15223a;line-height:1.55;white-space:pre-wrap">${esc(c.note.length > 1200 ? `${c.note.slice(0, 1200)}…` : c.note)}</div>
      </div>`
    : "";
  const html = wrap({
    heading: d.heading,
    intro: d.intro,
    rows: quote,
    cta: { label: d.cta, href: link, red: true },
    hubUrl: hubPublicUrl(),
    footer: `Sent by APSOhub because you are in the content project “${c.projectTitle}”. Reply to this email to answer ${c.actorName}.`,
  });
  const text = [d.intro, ...(c.note ? ["", `${c.actorName} wrote:`, c.note] : []), "", `${d.cta}: ${link}`].join("\n");
  return { subject: d.subject, html, text };
}

/** Sends each mail; a failed one is logged and never stops the change that caused it. Returns who was mailed. */
export async function sendContentMails(to: MailTo[], c: MailContext): Promise<string[]> {
  const sent: string[] = [];
  for (const m of to) {
    try {
      const p = await personByUsername(m.username);
      if (!p?.email) { console.warn(`[content-mail] ${m.kind} to ${m.username}: no address in the hub`); continue; }
      const mail = renderContentMail(m.kind, c, p.name.split(" ")[0] || p.name);
      await sendHubMail({ to: p.email, ...mail, fromName: `${c.actorName} via APSOhub`, ...(c.actorEmail ? { replyTo: c.actorEmail } : {}) });
      sent.push(m.username);
    } catch (e) {
      console.warn(`[content-mail] ${m.kind} to ${m.username} failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return sent;
}
