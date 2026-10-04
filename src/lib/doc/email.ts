// The declaration email: its language, its greeting and its HTML.
//
// Subject and text are the approved copy (./texts). The frame and footer are those
// of the existing HubSpot "Requested Company Certificates" emails (2497946922xx),
// so the customer recognises them. Moved here from SARCLA C2S V1 unchanged in
// wording; every function in this file is pure.

import { TEXTS, type DocLang } from "./texts";
import { correctSalutation, displayName, genderOf, type ContactProps } from "./salutation";

export const LANGS = Object.keys(TEXTS) as DocLang[];

export function isDocLang(lang: string | null | undefined): lang is DocLang {
  return !!lang && (LANGS as string[]).includes(lang);
}

// ── language ───────────────────────────────────────────────────────────────

// The shop store an order came from, read off the order-number prefix - the only
// thing that tells Switzerland apart (6xxx = de-CH, 7xxx = fr-CH).
const STORE_LANG: Record<number, DocLang> = { 6: "de", 7: "fr", 9: "de", 10: "de", 12: "de", 18: "fr", 20: "it", 22: "nl" };

// A shop order number is the store id, "000", then the store's running counter:
// 6000290830 is store 6, 22000012345 store 22. Anchored at both ends so the store
// is read off the whole number: C2S V1's greedy /^(\d{1,2})0{3}/ took "70" out of
// 7000012345 whenever the counter started with a zero, and a French-Swiss customer
// without a language on their contact got the English email.
export function storeLangFromIncrement(incrementId: string | null | undefined): DocLang | "" {
  const m = /^(\d{1,2})000\d{6,7}$/.exec(String(incrementId ?? "").trim());
  return (m && STORE_LANG[Number(m[1])]) || "";
}

// The billing country on the order - real data, no guessing.
const COUNTRY_LANG: Record<string, DocLang> = {
  DE: "de", AT: "de", LI: "de",
  FR: "fr", BE: "fr", LU: "fr", MC: "fr",
  IT: "it", SM: "it",
  NL: "nl",
  PL: "pl",
  GB: "en", IE: "en", US: "en",
};

export function countryLang(code: string | null | undefined): DocLang | "" {
  return COUNTRY_LANG[String(code ?? "").trim().toUpperCase()] || "";
}

/**
 * The first language we know anything about - the contact's, else the shop store,
 * else the billing country - and English when that one has no copy. Exactly as
 * C2S V1 decided it: a Spanish contact gets English, not the store's German.
 */
export function languageFor(p: {
  override?: string | null;
  contactLang?: string | null;
  webNo: string;
  country?: string | null;
}): DocLang {
  const first = p.override || p.contactLang || storeLangFromIncrement(p.webNo) || countryLang(p.country) || "en";
  return isDocLang(first) ? first : "en";
}

// ── greeting ───────────────────────────────────────────────────────────────
// Personal ("Guten Tag Herr Müller") only when the contact really says who we
// write to: a stored salutation phrase, a known gender and a last name. A role
// mailbox (purchasing@, einkauf@, info@ ...) or a company in the name fields is
// not a person: the copy's generic opening ("Sehr geehrter Kunde").

const ROLE_MAILBOX = /^(info|infos|information|purchas\w*|einkauf\w*|beschaffung|procurement|achat\w*|acquist\w*|ufficio\w*|inkoop|zakup\w*|zaopatrzenie|order\w*|bestell\w*|commande\w*|ordini|office|buero|bureau|admin\w*|sales|verkauf|vente\w*|vendite|accounting|buchhaltung|compta\w*|contabilita|finance|invoice\w*|rechnung\w*|factur\w*|fattur\w*|kontakt|contact\w*|contatti|service\w*|kundendienst|support|mail|email|post|team|zentrale|empfang|reception|logisti\w*|lager|warehouse|magazzino|technik|technique|tecnico|engineering|qualit\w*|qs|qm|marketing|no-?reply|workshop|werkstatt|atelier|produktion|production|produzione|betrieb|instandhaltung|maintenance|unterhalt|labor|lab|webshop|shop|eshop)$/i;
const COMPANY_FORM = /\b(AG|GmbH|SA|S\.A\.|S[àa]rl|Ltd|Limited|S\.p\.A\.?|SpA|S\.r\.l\.?|Srl|B\.?V\.?|N\.?V\.?|KG|OHG|Inc|LLC|Sp\. z o\.o\.)(?=\s|$|[.,])/i;

export type Greeting = { text: string; personal: boolean };

export function greetingFor(p: { lang: DocLang; props?: ContactProps | null; email: string }): Greeting {
  const generic = { text: TEXTS[p.lang].greeting, personal: false };
  const props = p.props;
  if (!props) return generic;
  const local = String(p.email || "").split("@")[0].toLowerCase();
  if (ROLE_MAILBOX.test(local) || ROLE_MAILBOX.test(local.split(/[._+\-\d]/)[0])) return generic;
  const last = displayName(props.lastname);
  if (!last || !String(props.salutation_phrase ?? "").trim()) return generic;
  if (COMPANY_FORM.test(`${props.firstname ?? ""} ${props.lastname ?? ""}`)) return generic;
  if (!genderOf(props).gender) return generic;
  const phrase = correctSalutation({ ...props, lang: p.lang }); // in the language of THIS email
  return phrase ? { text: `${phrase} ${last}`, personal: true } : generic;
}

// ── the email ──────────────────────────────────────────────────────────────

const FOOTER: Record<DocLang, {
  follow: string; support: string; imprint: string; privacy: string; sentTo: string;
  urls: { home: string; contact: string; imprint: string; privacy: string };
}> = {
  de: { follow: "UNSERER SEITE FOLGEN", support: "UNSEREN SUPPORT KONTAKTIEREN", imprint: "Impressum", privacy: "Datenschutzbestimmungen",
    sentTo: "Diese E-Mail wurde gesendet an", urls: { home: "de-INT/", contact: "de-INT/contact", imprint: "de-DE/imprint", privacy: "de-INT/privacy" } },
  en: { follow: "FOLLOW OUR PAGE", support: "CONTACT OUR SUPPORT", imprint: "Masthead", privacy: "Data Protection Policy",
    sentTo: "This email has been sent to", urls: { home: "en-INT/", contact: "en-INT/contact", imprint: "en-INT/imprint", privacy: "en-INT/privacy" } },
  fr: { follow: "SUIVEZ NOTRE PAGE", support: "CONTACTEZ NOTRE ASSISTANCE", imprint: "Infos légales", privacy: "Politique de protection des données",
    sentTo: "Cet e-mail a été envoyé à", urls: { home: "fr-INT/", contact: "fr-INT/contact", imprint: "fr-INT/imprint", privacy: "fr-INT/privacy" } },
  it: { follow: "SEGUI LA NOSTRA PAGINA", support: "CONTATTA L’ASSISTENZA", imprint: "Colophon", privacy: "Tutela dei dati personali",
    sentTo: "Questa e-mail è stata inviata a", urls: { home: "it-INT/", contact: "it-INT/contact", imprint: "it-INT/imprint", privacy: "it-INT/privacy" } },
  nl: { follow: "VOLG ONZE PAGINA", support: "CONTACT MET ONDERSTEUNING", imprint: "Colofon", privacy: "Privacyverklaring",
    sentTo: "Deze e-mail is verstuurd naar", urls: { home: "nl-INT/", contact: "nl-INT/contact", imprint: "nl-INT/imprint", privacy: "nl-INT/privacy" } },
  pl: { follow: "OBSERWUJ NASZĄ STRONĘ", support: "SKONTAKTUJ SIĘ Z DZIAŁEM POMOCY TECHNICZNEJ", imprint: "Najważniejsze informacje", privacy: "Polityka ochrony danych",
    sentTo: "Ta wiadomość e-mail została wysłana do", urls: { home: "pl-PL/", contact: "pl-PL/contact", imprint: "pl-PL/imprint", privacy: "pl-PL/privacy" } },
};

const SHOP = "https://www.apsoparts.com/";
const LOGO = "https://campaigns.apsoparts.com/hubfs/Logo2.jpg";
const LINKEDIN = "https://www.linkedin.com/company/2573330";

export const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

export type RenderedEmail = { subject: string; html: string; text: string };

export function renderEmail(p: { lang: DocLang; to: string; greeting?: string }): RenderedEmail {
  const c = TEXTS[p.lang];
  const f = FOOTER[p.lang];
  const paragraphs = [p.greeting || c.greeting, ...c.body];
  const u = {
    home: SHOP + f.urls.home, contact: SHOP + f.urls.contact,
    imprint: SHOP + f.urls.imprint, privacy: SHOP + f.urls.privacy,
  };
  const font = "font-family:Arial,Helvetica,sans-serif;";
  const para = (s: string) => `<p style="${font}font-size:15px;line-height:1.6;color:#33475b;margin:0 0 14px">${esc(s)}</p>`;
  const html = `<!doctype html><html lang="${p.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(c.subject)}</title></head>
<body style="margin:0;padding:0;background:#EAF0F6">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EAF0F6"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #EAF0F6">
<tr><td style="padding:0"><a href="${u.home}"><img src="${LOGO}" alt="APSOparts®" width="600" style="display:block;border:0;width:100%;max-width:600px;height:auto"></a></td></tr>
<tr><td style="padding:16px 32px 10px">
${paragraphs.map(para).join("\n")}
</td></tr>
<tr><td style="padding:18px 32px 26px;border-top:1px solid #EAF0F6;text-align:center;${font}font-size:12px;line-height:1.7;color:#7c98b6">
<a href="${u.contact}" style="color:#33475b;font-weight:bold;text-decoration:none">${esc(f.support)}</a> &nbsp;·&nbsp; <a href="${LINKEDIN}" style="color:#33475b;font-weight:bold;text-decoration:none">${esc(f.follow)}</a><br>
APSOparts® GmbH<br>
<a href="${u.imprint}" style="color:#7c98b6">${esc(f.imprint)}</a> | <a href="${u.privacy}" style="color:#7c98b6">${esc(f.privacy)}</a><br>
${esc(f.sentTo)} ${esc(p.to)}
</td></tr>
</table></td></tr></table></body></html>`;
  const text = [...paragraphs, `APSOparts® GmbH · ${u.imprint} · ${u.privacy}`].join("\n\n");
  return { subject: c.subject, html, text };
}
