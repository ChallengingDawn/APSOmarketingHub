// STOCK TO PARTNERS - the mail a partner gets every morning with its stock file attached (SARCLA 18.10.2026).
// One function renders it, for the real mail and for Settings > Mail's preview alike. A customer mail, so
// APSOparts' look rather than the hub's; French first (ITAFRAN's file is French), English below.

import { esc } from "@/lib/notify/mailer";

export type PartnerStockMail = {
  partner: string; day: string; time: string; articles: number; inStock: number; moq: number; inactive: number; specials: number;
  filename: string; test: string[] | null;
  /** Who answers the partner's questions - named in the mail and where a reply goes, never the shared support inbox. */
  contact: string | null;
};

export const SAMPLE_PARTNER_STOCK: PartnerStockMail = {
  partner: "ITAFRAN", day: "2026-10-19", time: "07:00", articles: 271, inStock: 180, moq: 13, inactive: 0, specials: 18,
  filename: "APSOparts stock ITAFRAN 2026-10-19.xlsx", test: null, contact: "claudio.saraiva@apsoparts.com",
};

const dmy = (d: string) => d.split("-").reverse().join(".");

export function renderPartnerStockMail(m: PartnerStockMail): { subject: string; html: string; text: string } {
  const subject = `${m.test ? "[TEST] " : ""}APSOparts stock - ${m.partner} - ${dmy(m.day)}`;
  const fr = [
    "Bonjour,",
    `Veuillez trouver ci-joint l'état de notre stock du ${dmy(m.day)} à ${m.time} pour vos ${m.articles} articles : stock disponible, quantité minimale de commande (MOQ) et statut de l'article (actif / inactif).`,
    `${m.inStock} articles en stock · ${m.moq} avec MOQ · ${m.inactive} inactifs · ${m.specials} articles spéciaux.`,
  ];
  const en = [
    "Hello,",
    `Please find attached our stock as of ${dmy(m.day)} ${m.time} for your ${m.articles} articles: available stock, minimum order quantity (MOQ) and article status (active / inactive).`,
    `${m.inStock} articles in stock · ${m.moq} with an MOQ · ${m.inactive} inactive · ${m.specials} special articles.`,
  ];
  // only APSOparts on the mail (SARCLA 18.10.2026)
  const sign = ["Meilleures salutations / Best regards", "APSOparts®"];
  const banner = m.test ? `TEST - this mail went only to ${m.test.join(", ")}, not to ${m.partner}.` : null;
  // a person to write to, not "reply" - a reply to the shared support inbox lands on colleagues (SARCLA 18.10.2026)
  const footer = m.contact
    ? `Envoyé automatiquement chaque matin. Des questions ? Écrivez à ${m.contact}. / Sent automatically every morning. Questions? Write to ${m.contact}.`
    : "Envoyé automatiquement chaque matin. / Sent automatically every morning.";
  const p = (t: string, extra = "") => `<p style="margin:0 0 12px;font-size:14px;line-height:1.55;color:#1d2433${extra}">${esc(t)}</p>`;
  const html = `<!doctype html><html><body style="margin:0;background:#f4f5f7">
  <div style="max-width:640px;margin:0 auto;padding:26px 20px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
    <div style="font-size:20px;font-weight:800;color:#e2001a;margin-bottom:18px">APSOparts<span style="font-size:12px;vertical-align:super">®</span></div>
    ${banner ? `<div style="background:#fff4e5;border:1px solid #f3c27a;border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:13px;color:#7a4b00">${esc(banner)}</div>` : ""}
    <div style="background:#fff;border-radius:14px;padding:22px 24px;border:1px solid #e3e6ec">
      ${fr.map((t, i) => p(t, i === 2 ? ";color:#5d6b85" : "")).join("")}
      <hr style="border:none;border-top:1px solid #eceef2;margin:16px 0">
      ${en.map((t, i) => p(t, i === 2 ? ";color:#5d6b85" : "")).join("")}
      <p style="margin:16px 0 0;font-size:13px;color:#5d6b85">📎 ${esc(m.filename)}</p>
      <p style="margin:18px 0 0;font-size:14px;line-height:1.55;color:#1d2433">${sign.map(esc).join("<br>")}</p>
    </div>
    <p style="margin:14px 0 0;font-size:12px;color:#8b93a3">${esc(footer)}</p>
  </div></body></html>`;
  const text = [...(banner ? [banner, ""] : []), ...fr, "", ...en, "", `Attachment: ${m.filename}`, "", ...sign, "", footer].join("\n");
  return { subject, html, text };
}
