// CERTIFICATES - the two mails with a declaration made on the ticket card (pure - makerSend.ts sends them, the Mails tab
// shows them). SARCLA 08.11.2026, on the shop's DoC text the hub first used: "this text template we should be able to see
// via the hub, it should be much less as well - also the EDA one, base yourself on the mails colleagues have written".
//
// The customer's mail = the Back Office's own text, as they send a certificate today (158 mails on certificate tickets,
// 2026: "Sehr geehrter Partner, / Wir möchten Ihnen nochmals herzlich für Ihre Bestellung A26.x danken / Anbei finden Sie
// das Zertifikat für Ihre Unterlagen / ..." - the same in French, Italian and English; Dutch and Polish in the same words),
// subject "APSOparts® | Zertifikat für A26.x", signed by the issuer. The frame (logo, footer) stays the DoC mail's.
// EDA's mail = as the Back Office writes to EDA ("Dear EDA Team / Customer ordered following article with FDA certificate:
// / <article> / ... / thanks and BR,"): plain text in the issuer's name, the declaration attached.

import type { DocLang } from "../doc/texts";
import type { MakerState } from "./makerRules";

type CustomerText = { subject: string; lines: string[] };
/** {order} = the order number */
export const CUSTOMER_TEXT: Record<DocLang, CustomerText> = {
  de: {
    subject: "APSOparts® | Zertifikat für {order}",
    lines: ["Sehr geehrter Partner,", "Wir möchten Ihnen nochmals herzlich für Ihre Bestellung {order} danken.\nAnbei finden Sie das Zertifikat für Ihre Unterlagen.", "Sollten Sie weitere Fragen haben, stehen wir Ihnen jederzeit gerne zur Verfügung.", "Vielen Dank für Ihr Vertrauen in APSOparts®\nWir wünschen Ihnen einen schönen Tag"],
  },
  fr: {
    subject: "APSOparts® | Certificat(s) pour {order}",
    lines: ["Cher partenaire,", "Nous tenons à vous remercier à nouveau pour votre commande {order}.\nVeuillez trouver ci-joint le certificat pour vos dossiers.", "Si vous avez d’autres questions, n’hésitez pas à nous contacter.", "Merci pour votre confiance en APSOparts®\nNous vous souhaitons une excellente journée,"],
  },
  it: {
    subject: "APSOparts® | Certificato per {order}",
    lines: ["Caro partner,", "Desideriamo ringraziarvi ancora per il vostro ordine {order}.\nIn allegato troverete il certificato per i vostri archivi.", "Per qualsiasi ulteriore domanda, non esitate a contattarci.", "Grazie per la fiducia riposta in APSOparts®\nVi auguriamo una buona giornata"],
  },
  en: {
    subject: "APSOparts® | Certificates for {order}",
    lines: ["Dear partner,", "We would like to thank you again for your order {order}.\nPlease find enclosed the certificate for your records.", "If you have any further questions, please do not hesitate to contact us.", "Thank you for your trust in APSOparts®\nHave a nice day,"],
  },
  nl: {
    subject: "APSOparts® | Certificaat voor {order}",
    lines: ["Beste partner,", "Nogmaals hartelijk dank voor uw bestelling {order}.\nIn de bijlage vindt u het certificaat voor uw administratie.", "Heeft u nog vragen, neem dan gerust contact met ons op.", "Bedankt voor uw vertrouwen in APSOparts®\nWij wensen u een fijne dag,"],
  },
  pl: {
    subject: "APSOparts® | Certyfikat do zamówienia {order}",
    lines: ["Szanowny Partnerze,", "Jeszcze raz serdecznie dziękujemy za zamówienie {order}.\nW załączeniu przesyłamy certyfikat do Państwa dokumentacji.", "W razie dalszych pytań prosimy o kontakt.", "Dziękujemy za zaufanie do APSOparts®\nŻyczymy miłego dnia,"],
  },
};

/** The order as the customer knows it: "A26.666379" (the base, without the line suffix). */
const orderOf = (d: MakerState["decl"]) => String(d.order || d.job || "").replace(/^(A\d{2}\.\d{6}).*$/i, "$1");
/** The company that issued the declaration (certificateMaker.js ISSUERS): signs the mail. */
export const companyOf = (d: MakerState["decl"]) => (d.entity === "ch" ? "APSOparts® AG" : "APSOparts® GmbH");
const issuerOf = (s: Pick<MakerState, "decl" | "signers">) => s.signers?.issuer?.name ?? s.decl.issuer.name;

/** The customer's mail: subject and paragraphs (each may hold line breaks) - the issuer's name and company under it. */
export function customerMail(s: Pick<MakerState, "decl" | "signers">, lang: DocLang): { subject: string; body: string[] } {
  const t = CUSTOMER_TEXT[lang] ?? CUSTOMER_TEXT.en;
  const order = orderOf(s.decl);
  const fill = (x: string) => x.replace(/\{order\}/g, order).replace(/ \.$/, ".");
  return { subject: fill(t.subject), body: [...t.lines.map(fill), `${issuerOf(s)}\n${companyOf(s.decl)}`] };
}

/** EDA's mail, as the Back Office writes it: what the customer ordered with which certificate, the declaration attached. */
export function edaMail(s: Pick<MakerState, "decl" | "signers" | "send">, certs: string, company: string | null): { subject: string; text: string } {
  const d = s.decl;
  const customer = d.customer[0] ?? company ?? "";
  const order = orderOf(d);
  const many = d.positions.length > 1;
  const lines = [
    "Dear EDA Team",
    "",
    `Customer ordered following article${many ? "s" : ""}${certs ? ` with ${certs} certificate` : ""}:`,
    "",
    ...d.positions.map((p) => `${p.article} ${p.text}`.trim()),
    "",
    `Attached is the declaration of conformity we sent to the customer${customer ? ` (${customer}${d.customerNo ? `, customer no. ${d.customerNo}` : ""})` : ""} for order ${order}${s.signers?.expert ? `, signed by ${issuerOf(s)} and ${s.signers.expert.name}` : ""}.`,
    "",
    "thanks and BR,",
    issuerOf(s),
  ];
  return { subject: `Declaration of conformity${certs ? ` ${certs}` : ""} | ${order} | ${customer}`.replace(/\s+\|\s*$/, "").slice(0, 180), text: lines.join("\n") };
}

/** A mail as a person writes it - no hub frame (EDA's). */
export const plainHtml = (text: string) =>
  `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#15223a;line-height:1.5">${text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string).replace(/\n/g, "<br>")}</div>`;

/** A sample request for the Mails tab when no declaration has been sent yet. */
export const SAMPLE: Pick<MakerState, "decl" | "signers" | "send"> = {
  decl: {
    date: "2026-11-08", customer: ["Sample Customer AG", "Musterstrasse 1", "8000 Zürich", "Switzerland"], customerNo: "800000", order: "A26.600000", job: "A26.600000.001",
    issuer: { name: "Sara Gashi", email: "", code: "GASHSA" }, positions: [{ article: "8001167981", text: "POM C, natural, round rod Ø 50 x 3000 mm; EG1935", master: "" }], entity: "ch",
  },
  signers: { issuer: { name: "Sara Gashi", email: "", sig: "", at: "2026-11-08T08:00:00Z" }, expert: { name: "Maida Osmani", email: "", sig: "", at: "2026-11-08T09:00:00Z" } },
  send: { to: "buyer@example.com", lang: "de", at: "2026-11-08T09:00:00Z", by: "Maida Osmani" },
};
