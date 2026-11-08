// CERTIFICATES - the declaration made on the ticket goes out (SARCLA 07.11.2026: the certificate maker on the ticket card
// "Certificate request" - the issuer validates and signs, the conformity expert signs, "then sent automatically to the
// customer and EDA, in separate mails"; "really put a validation process before sending where the user can select his
// signature and accept signing").
//
// The card (HubSpot app function apsomh-certificate-maker) makes and signs the PDFs and keeps the state in the hidden
// ticket property apsohub_certificate_maker. Once the conformity expert has signed (status "signed"), the hub - on its
// 3-minute look, in Live, with "Declarations made on the ticket: Live" on Settings - claims it (status "sending", so it
// never goes twice), mails the customer (the DoC mail, in his language, the PDFs attached), then EDA on its own mail,
// logs the customer's mail on the ticket, and sets "Sent out to customer and EDA" - the engine then resolves the ticket.
// Never: a TEST (made on a ticket on hold), a ticket on hold, an address of ours as the customer. A mail that broke off
// is never sent again by itself: the card shows why and the Back Office sends it.

import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { hubspotToken } from "@/lib/integrations/status";
import { esc, sendHubMail } from "@/lib/notify/mailer";
import { isDocLang, renderEmail } from "@/lib/doc/email";
import { ACT, certsText, type Facts } from "./rules";
import { companyOf, customerMail, edaMail, plainHtml } from "./makerMail";
import { DEMO_PROP, EDA, MAKER_PROP, demoOf, notSending, parseMaker, type MakerFile, type MakerRow, type MakerSend, type MakerState } from "./makerRules";

export { DEMO_PROP, EDA, MAKER_PROP, demoOf, parseMaker, type MakerRow, type MakerSend, type MakerState } from "./makerRules";

const hs = <T>(path: string, method: "GET" | "POST" | "PATCH" | "PUT" = "GET", body?: unknown) => hubspotRetry<T>({ path, method, body });

async function write(id: string, s: MakerState, extra: Record<string, string> = {}) {
  await hs(`/crm/v3/objects/tickets/${id}`, "PATCH", { properties: { [MAKER_PROP]: JSON.stringify(s), ...extra } });
}

/** The PDFs from HubSpot's file manager (private files: through a signed link). */
async function download(files: MakerFile[]): Promise<{ filename: string; content: Buffer; contentType: string }[]> {
  const token = hubspotToken();
  if (!token) throw new Error("HUBSPOT_TOKEN is not set");
  const out = [];
  for (const f of files) {
    const s = await hs<{ url?: string }>(`/files/v3/files/${f.id}/signed-url?expirationSeconds=600`);
    if (!s.url) throw new Error(`no link to ${f.name}`);
    const r = await fetch(s.url);
    if (!r.ok) throw new Error(`${f.name}: ${r.status}`);
    out.push({ filename: f.name, content: Buffer.from(await r.arrayBuffer()), contentType: "application/pdf" });
  }
  return out;
}

/** The customer's mail on the ticket's timeline, as the DoC app logs its own. */
async function logOnTicket(ticketId: string, to: string, mail: { subject: string; html: string; text: string }, names: string[]) {
  const note = `- sent by APSOhub (Certificates) to ${to}, attached: ${names.join(", ")}`;
  const e = await hs<{ id: string }>("/crm/v3/objects/emails", "POST", {
    properties: {
      hs_timestamp: new Date().toISOString(), hs_email_direction: "EMAIL", hs_email_status: "SENT",
      hs_email_subject: mail.subject, hs_email_text: `${mail.text}\n\n${note}`,
      hs_email_html: mail.html.replace("</body>", `<p style="color:#7c98b6;font-size:12px;font-family:Arial;text-align:center">${esc(note)}</p></body>`),
      hs_email_headers: JSON.stringify({ from: { email: "info@news.apsoparts.com", firstName: "APSOparts®" }, to: [{ email: to }], cc: [], bcc: [] }),
    },
  });
  await hs(`/crm/v4/objects/emails/${e.id}/associations/tickets/${ticketId}`, "PUT", [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 224 }]);
}

/**
 * One look: every open request whose declaration the conformity expert signed. writing = the engine is Live.
 * company(f) = the ticket's company name, for the EDA subject.
 */
export async function makerPass(facts: (Facts & { maker?: string | null })[], held: Record<string, unknown>, mode: MakerSend, writing: boolean): Promise<{ rows: MakerRow[]; mailed: number }> {
  const rows: MakerRow[] = [];
  let mailed = 0;
  for (const f of facts) {
    const s = parseMaker(f.maker);
    if (!s || s.status !== "signed") continue;
    const why = notSending(f, s, held, mode);
    const at = new Date().toISOString();
    // waiting (off, on hold, a test) is no event - the card says why; only a mail sent or broken off is kept
    if (why || !writing) continue;
    // claimed before anything goes out: never twice
    const claim: MakerState = { ...s, status: "sending", log: [...(s.log ?? []), { at, what: "sending", by: "APSOhub" }] };
    await write(f.id, claim);
    // a DEMO: the customer's mail and EDA's both go to the demo user, marked [DEMO]
    const demo = demoOf(f.demo);
    const to = demo ? demo.email : s.send!.to;
    const eda = demo ? demo.email : EDA;
    const tag = demo ? "[DEMO] " : "";
    let customerSent = false;
    try {
      const files = await download(s.files);
      const lang = isDocLang(s.send!.lang) ? s.send!.lang : "en";
      // the Back Office's own short text, in the issuer's name, signed by the company that issued the declaration
      // (SARCLA 08.11.2026: Swiss vs European entity; "it should be much less" than the shop's DoC text - makerMail.ts)
      const issuer = s.signers.issuer?.name ?? s.decl.issuer.name;
      const c = customerMail(s, lang);
      const mail = renderEmail({ lang, to, company: companyOf(s.decl), subject: c.subject, body: c.body });
      await sendHubMail({ to, subject: `${tag}${mail.subject}`, html: mail.html, text: mail.text, attachments: files, fromName: `${issuer} | APSOparts®` });
      customerSent = true;
      mailed++;
      await logOnTicket(f.id, to, mail, files.map((x) => x.filename)).catch((e) => console.warn(`[certificates] maker log ${f.id}: ${(e as Error).message}`));
      let edaError: string | undefined;
      try {
        // as the Back Office writes to EDA - answers go to the issuer (a person, never an inbox; a DEMO: the demo user)
        const m = edaMail(s, certsText(f), f.company);
        const replyTo = demo ? demo.email : s.signers.issuer?.email || s.decl.issuer.email || undefined;
        await sendHubMail({ to: eda, subject: `${tag}${m.subject}`.slice(0, 180), html: plainHtml(m.text), text: m.text, attachments: files, fromName: `${issuer} | APSOparts®`, ...(replyTo ? { replyTo } : {}) });
        mailed++;
      } catch (e) { edaError = (e as Error).message.slice(0, 160); }
      const done: MakerState = { ...claim, status: "sent", sent: { at: new Date().toISOString(), to, eda: edaError ? null : eda, ...(edaError ? { edaError } : {}) }, log: [...(claim.log ?? []), { at: new Date().toISOString(), what: edaError ? `sent to ${to} - EDA failed` : demo ? `DEMO: sent to ${to} (as the customer and as EDA)` : `sent to ${to} and EDA`, by: "APSOhub" }] };
      // "Sent out to customer and EDA": the engine closes the request on its next look
      await write(f.id, done, { actions_for_certificates: ACT.sent });
      rows.push({ at, ticketId: f.id, what: "sent", to, eda: edaError ? null : eda, ...(edaError ? { error: `EDA: ${edaError}` } : {}) });
    } catch (e) {
      const msg = (e as Error).message.slice(0, 200);
      const failed: MakerState = { ...claim, status: customerSent ? "sent" : "failed", error: msg, ...(customerSent ? { sent: { at: new Date().toISOString(), to, eda: null, edaError: msg } } : {}), log: [...(claim.log ?? []), { at: new Date().toISOString(), what: customerSent ? `sent to ${to}, then: ${msg}` : `not sent: ${msg}`, by: "APSOhub" }] };
      await write(f.id, failed, customerSent ? { actions_for_certificates: ACT.sent } : {}).catch(() => undefined);
      rows.push({ at, ticketId: f.id, what: customerSent ? "sent" : "failed", to, eda: null, error: msg });
    }
  }
  return { rows, mailed };
}
