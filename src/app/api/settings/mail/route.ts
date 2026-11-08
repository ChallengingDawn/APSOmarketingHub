// SETTINGS > MAIL: how the hub sends mail, and the mail it sends - each
// template rendered by the very function that renders it for real, with sample
// data, so the preview cannot drift from what goes out. "Send me a test" goes
// to the signed-in person only.

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { FROM, REPLY_TO, addressOf, mailConfigured, sendHubMail, smtp } from "@/lib/notify/mailer";
import { SAMPLE_INVITE, renderInviteMail } from "@/lib/content/shareMail";
import { renderContentMail, type MailContext } from "@/lib/content/workflowMail";
import { renderEmail } from "@/lib/doc/email";
import { SAMPLE_ORDER_ALERT, renderOrderAlert } from "@/lib/ticketAssoc/mail";
import { SAMPLE_PARTNER_STOCK, renderPartnerStockMail } from "@/lib/partnerStock/mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Template = {
  key: string; name: string; audience: string; when: string;
  from: string; replyTo: string; subject: string; html: string; text: string;
};

const CONTENT_SAMPLE: MailContext = {
  actorName: "Anna Rossi", actorEmail: null, projectId: 1, projectTitle: "DirectCut in Italy", pieceTitle: "Landing page · IT", dueDate: "2026-11-18",
};
const CONTENT_MAILS: { kind: Parameters<typeof renderContentMail>[0]; name: string; when: string; note?: string }[] = [
  { kind: "write", name: "A to-do for you to do", when: "When somebody in a content project makes you the one who does a piece (a page, a post, a newsletter) or a task." },
  { kind: "review", name: "Ready for your review", when: "When the writer of a piece asks you, its reviewer, to approve it or ask for changes." },
  { kind: "changes", name: "Changes asked", when: "When the reviewer sends your piece back - with what should change.", note: "Take Daniel's “senza attese”, and keep the delivery paragraph." },
  { kind: "approved", name: "Approved", when: "When the reviewer approves your piece." },
  { kind: "mention", name: "You were mentioned", when: "When somebody tags you with @ in a project's conversation.", note: "@Claudio can you check the Italian prices before Tuesday?" },
  { kind: "stage", name: "Your project moved", when: "When your project changes stage because its to-dos moved (in review, approved, live)." },
];

function templates(me: { full_name: string; username: string; email: string | null }): Template[] {
  const first = (me.full_name || me.username).split(" ")[0];
  const invite = renderInviteMail({ ...SAMPLE_INVITE, inviteeName: first });
  const doc = renderEmail({ lang: "en", to: me.email ?? "customer@example.com" });
  return [
    {
      key: "project-invite", name: "A project was shared with you", audience: "Colleagues",
      when: "When the owner of a content project shares it with somebody. It comes from them - their name in front of the hub's address - and a reply goes back to them.",
      from: `"${SAMPLE_INVITE.inviterName} via APSOhub" <${addressOf(FROM)}>`, replyTo: "the person who shared",
      ...invite,
    },
    // a content project's to-dos: who is asked to do, review, change, and who is tagged (08.11.2026)
    ...CONTENT_MAILS.map((m) => ({
      key: `content-${m.kind}`, name: m.name, audience: "Colleagues in a content project", when: m.when,
      from: `"${CONTENT_SAMPLE.actorName} via APSOhub" <${addressOf(FROM)}>`, replyTo: "the person who acted",
      ...renderContentMail(m.kind, { ...CONTENT_SAMPLE, note: m.note ?? null, ...(m.kind === "stage" ? { stage: "review" as const } : {}) }, first),
    })),
    {
      key: "doc-declaration", name: "Declaration of conformity", audience: "Customers",
      when: "When a shop order asked for a declaration of conformity and the order is invoiced. In the customer's language; shown here in English.",
      from: FROM, replyTo: REPLY_TO,
      ...doc,
    },
    {
      key: "ticket-order-alert", name: "Please check your ticket - an order was detected", audience: "ESO / TSA ticket owners",
      when: "When the customer of an open ESO or TSA ticket orders an article the ticket names, on or after the day the ticket was opened. The order is linked to the ticket; one mail per ticket and order. Sent only while Associations > Order alerts is set to mail.",
      from: FROM, replyTo: REPLY_TO,
      ...renderOrderAlert({ ...SAMPLE_ORDER_ALERT, ownerName: first }),
    },
    {
      key: "partner-stock", name: "Stock to partners - the daily stock file", audience: "Partners (ITAFRAN)",
      when: "Every morning at 07:00 Zurich time, with the partner's article list attached as an Excel file - its code and ours, our stock, MOQ and status. In test mode only to the test address. Set up under UC & HubSpot Apps > Stock to partners. French and English; the Excel file is not attached to this preview.",
      from: FROM, replyTo: `${SAMPLE_PARTNER_STOCK.contact} (the partner's contact, or the "Replies go to" address)`,
      ...renderPartnerStockMail(SAMPLE_PARTNER_STOCK),
    },
  ];
}

export async function GET() {
  const me = await requireUser();
  const s = smtp();
  return NextResponse.json({
    ok: true,
    relay: { host: s.host, port: s.port, ready: mailConfigured() },
    from: FROM, replyTo: REPLY_TO, me: me.email,
    templates: templates(me),
  });
}

export async function POST(req: NextRequest) {
  const me = await requireUser();
  const body = (await req.json().catch(() => ({}))) as { action?: unknown; template?: unknown };
  if (body.action !== "test") return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
  if (!me.email) return NextResponse.json({ ok: false, error: "Your account has no email address - add one under My account." }, { status: 400 });
  const t = templates(me).find((x) => x.key === body.template);
  if (!t) return NextResponse.json({ ok: false, error: "No such template." }, { status: 404 });
  try {
    await sendHubMail({
      to: me.email, subject: `[Test] ${t.subject}`, html: t.html, text: t.text,
      fromName: t.key === "project-invite" ? `${SAMPLE_INVITE.inviterName} via APSOhub` : undefined,
    });
    return NextResponse.json({ ok: true, to: me.email });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 502 });
  }
}
