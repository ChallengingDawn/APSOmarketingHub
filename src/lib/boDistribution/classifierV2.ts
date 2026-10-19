// BACK OFFICE ROUTING - THE TICKET CLASSIFIER, VERSION 2. The live step's classifier (classifier.ts, the faithful
// port of "SARCLA MULTILINGUAL TICKET CLASSIFIER", flow 3678508243 step #22) with its known faults fixed. v1's
// keyword lists, scoring, order-number reading and tie-breaks are reused as they are; v2 only adds rules around
// them. Each rule is named and can be switched off on its own (FIXES); with every rule off v2 answers exactly as
// v1 does (checked on 6,500 real tickets). A ticket's `fixes` lists the rules that changed something on it (its
// text or a score - not necessarily the category), so the hub can show what changed and why. Only v1's line
// cleaner is re-written here (its rules are private there), to make three of its rules switchable. The rules were
// chosen and checked on real Back Office e-mail tickets (19.10.2026: the last 30 days, then the 90 days before),
// against the category a person later set by hand. Pure: no I/O. Tests: tests/bo-classifier-v2.test.ts.

import {
  CATEGORIES, DROPDOWN_VALUES, KEYWORDS, PROPERTY_MAPPING, calculateScore, extractOrderNumbers,
  type Classification, type Status,
} from "./classifier";

/* ── the rules ─────────────────────────────────────────────────────────── */

export type FixId =
  | "null-fields"
  | "curly-apostrophe"
  | "company-line"
  | "more-greetings"
  | "mail-headers"
  | "read-forwarded"
  | "reach-verb"
  | "invoice-not-received"
  | "rfq-own-name"
  | "generic-words-need-price"
  | "existing-order"
  | "enquiry-is-rfq"
  | "product-info-words"
  | "delivery-words"
  | "cancellation-words";

export const FIXES: ReadonlyArray<{ id: FixId; title: string; description: string }> = [
  {
    id: "null-fields", title: "Empty subject or body is still read",
    description: "v1 writes nothing at all when HubSpot sends the subject or the body as empty (null). v2 reads whatever is there.",
  },
  {
    id: "curly-apostrophe", title: "Typographic apostrophes",
    description: "Outlook writes ’ instead of ', so \"demande d’offre\" never matched \"demande d'offre\". v2 reads both the same.",
  },
  {
    id: "company-line", title: "Company-name lines read correctly",
    description: "v1 throws away short lines it takes for a company name - but its test also hits \"Incorrect…\", \"Including…\", \"50 kg…\" and the French \"sa\". v2 only takes GmbH, Ltd, Inc… as whole words, and AG, SA, KG, Co. … only as written in capitals (KG not after a number).",
  },
  {
    id: "more-greetings", title: "More sign-offs end the message",
    description: "v1 stops reading at \"Mit freundlichen Grüssen\", \"Kind regards\", \"Cordialement\"… but not at \"Regards\", \"Viele Grüsse\", \"Gruss\", \"Met vriendelijke groet\", \"Pozdrawiam\", \"Bien à vous\", \"Saluti\"… - so the signature and the quoted older mails were scored. v2 knows these too (a short line that starts with them).",
  },
  {
    id: "mail-headers", title: "Quoted mail headers ignored",
    description: "The From / Sent / To / Subject lines of quoted mails (Von / Gesendet, De / Envoyé…) are not text: \"Sent\", \"Gesendet\", \"Envoyé\" each gave Delivery a point on every reply. v2 skips these lines.",
  },
  {
    id: "read-forwarded", title: "A forward is read past the colleague's note",
    description: "When a colleague forwards a customer mail (\"WG: / FW: / TR: …\") with a short note - \"Bitte übernehmen. LG Elli\" - v1 stops at the colleague's greeting and never reads the customer's mail below it. v2 then reads the forwarded mail (only when the note is under 120 letters).",
  },
  {
    id: "reach-verb", title: "\"reach out\" is not REACH",
    description: "REACH (the chemicals regulation) weighs 6x for Product Information and 8x for certificates, so \"please reach out to me\" filed a certificate request. v2 does not count \"reach\" used as a verb (reach out, reach you, to reach…).",
  },
  {
    id: "invoice-not-received", title: "\"Invoice not received\" is about the invoice",
    description: "\"received\" is a Delivery word, so \"we have not received the invoice\" went to Delivery. v2 reads the phrase (in 6 languages) as Invoicing - Invoice not received, and it no longer counts for Delivery.",
  },
  {
    id: "rfq-own-name", title: "\"Request for quotation\" names its sub-category",
    description: "The words \"request for quotation\" were missing from the sub-category of that name. v2 adds them (and \"request for quote\", \"richiesta di offerta\"…).",
  },
  {
    id: "generic-words-need-price", title: "\"Attached\" alone is not a quotation request",
    description: "\"anbei\", \"im Anhang\", \"in der Anlage\", \"ci-joint\", \"allegato\", \"bijlage\"… weigh up to 6x for Product Price, so any mail with an attachment - a payment notice, a letter, a complaint - became a quotation request and went to ESO/TSA. Most corrections people made were exactly these. v2 counts these words (and \"merci de me faire\", \"ich bitte um\", \"richiedere\") for Product Price only when a real price, quote or order word is there too.",
  },
  {
    id: "existing-order", title: "A reply about an existing order is not a new order",
    description: "When the subject names one of our orders (A2x.xxxxxx) or is one of our own mails (Auftragsbestätigung, Bestellbestätigung, Confirmation de commande, order confirmation, \"wurde versandt\"…), \"unsere Bestellung\", \"purchase order\", \"bestellen\"… describe that existing order, not a new one. v2 then does not count the order-placing words for Product Price; price words still count.",
  },
  {
    id: "enquiry-is-rfq", title: "\"Anfrage\" is a quotation request",
    description: "v1 lists \"Anfrage\" only under the \"Request for quotation\" sub-category, never for the category itself, so \"Anfrage 6000312260\", \"Angebotsanfrage\", \"FW: Anfrage\" mails with nothing else to go on ended in Others - and people then set Product Price by hand. v2 files them as Product Price - Request for quotation, but only when the subject says Anfrage and no category has any other word (so \"Anfrage zu Ihren Lieferungen\" stays Delivery), and never on a mail about an existing order.",
  },
  {
    id: "product-info-words", title: "German plurals for data sheets and certificates",
    description: "v1 knows \"Datenblatt\" and \"Zertifikat\" but not \"Datenblätter\", \"Zertifikate\", \"Materialzertifikat\", \"Konformitätserklärung(en)\", \"Werkszeugnis\"… v2 adds them to Product Information (Technical Data Sheet request / Conformities / Certificates).",
  },
  {
    id: "delivery-words", title: "Delivery words v1 misses",
    description: "German compounds and common delivery words were missing: Liefertermin, Lieferzeit, Liefermahnung, Lieferreklamation, Nachlieferung, Restlieferung, Mängelrüge, Vorzug, versendet, expedite, le délai, délai de livraison, data di consegna, delivery date, leverdatum… v2 adds them to Delivery.",
  },
  {
    id: "cancellation-words", title: "Cancellation words v1 misses",
    description: "\"Bestellstornierung\", \"Auftragsstornierung\", \"Stornoauftrag\", \"storniert werden\", \"bitte stornieren Sie\" were not seen as a cancellation (v1 only matches \"stornierung\" as a word on its own). v2 adds them to Order Cancellation.",
  },
];

export type FixSwitches = Partial<Record<FixId, boolean>>;

export type ClassificationV2 = Classification & {
  /** the rules that changed something on this ticket, in FIXES order */
  fixes: FixId[];
};

/* ── Python string semantics, as v1 has them (classifier.ts keeps them private) ── */

const PY_WS = "\\t\\n\\x0b\\x0c\\r\\x1c-\\x20\\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
const S = `[${PY_WS}]`;
const IS_S = new RegExp(`^${S}$`, "u");
const W = "[\\p{L}\\p{N}_]";
const B0 = `(?<!${W})`, B1 = `(?!${W})`;

function pyStrip(s: string): string {
  let a = 0, b = s.length;
  while (a < b && IS_S.test(s[a])) a++;
  while (b > a && IS_S.test(s[b - 1])) b--;
  return s.slice(a, b);
}
const pyLen = (s: string): number => Array.from(s).length;

/* ── signature noise: v1's remove_signature_noise, with its rules switchable ── */

const SIGNATURE_TRIGGERS = [
  "mit freundlichen gr", "freundliche gr",
  "kind regards", "best regards",
  "cordialement", "cordiali saluti", "distinti saluti",
  "meilleures salutations",
];
const THANK_YOU = ["vielen dank", "merci", "merci beaucoup", "grazie", "thank you", "thanks"].map((t) => new RegExp(`^${t}${S}*$`, "u"));
const URL_LINE = new RegExp(`^${S}*https?://`, "u");
const WWW_LINE = new RegExp(`^${S}*www\\.`, "u");
const CONTACT_LINE = new RegExp(`^${S}*(?:tel[.:]|phone:|fax:|e-mail:|email:|mobile${S}*:)`, "u");
const COMPANY_WORD = new RegExp(`${B0}(?:gmbh|ag${B1}|sa${B1}|sas${B1}|sarl|srl|spa${B1}|ltd|inc|bv${B1}|kg${B1}|co\\.)`, "u");
const RFQ_WORDS = ["bestellung", "anfrage", "im anhang", "in der anlage", "anbei", "offerte", "angebot", "commande", "ordine"];
const COMPANY_LINE = new RegExp(
  `^${S}*[A-Z\\u00c0-\\u0178][A-Za-z\\u00c0-\\u00ff${PY_WS}&\\-]+${S}+(?:GmbH|AG|SA|SAS|SARL|SRL|SPA|Ltd|Inc|BV|KG|Co\\.)`, "u",
);
const DISCLAIMER = /confidentialit|privacy|notice|disclaimer|vertraulich/u;

// company-line: long forms as whole words in any case, short forms only as written - and KG not after a number
const COMPANY_LONG = new RegExp(`${B0}(?:gmbh|sarl|srl|ltd|inc)${B1}`, "u");
const COMPANY_SHORT = new RegExp(`${B0}(?:AG|SA|SAS|SpA|SPA|S\\.p\\.A\\.|BV|B\\.V\\.|(?<!\\p{Nd}${S}*)KG|Co\\.)(?!${W})`, "u");

// more-greetings: a short line that starts with a sign-off (v1's triggers stay as they are)
const GREETING = new RegExp(
  "^(?:(?:many\\s+)?thanks?(?:\\s+you)?\\s*(?:and|&)\\s+|(?:vielen\\s+|besten\\s+|herzlichen\\s+)?dank(?:e)?\\s*(?:und|&)\\s+" +
  "|merci\\s+(?:et|&)\\s+|grazie\\s+(?:e|&)\\s+|bedankt\\s+(?:en|&)\\s+)?" +
  "(?:(?:mit\\s+)?(?:den\\s+)?(?:besten|beste|viele|vielen|liebe|lieben|herzliche|herzlichen|freundliche|freundlichen|freundlichem|schöne|schönen|sonnige|sonnigen|liebe)\\s+gr(?:ü|ue|u)(?:ss|ß)(?:e|en)?" +
  // "Grüss Gott" / "Grüss dich" open a mail, they do not close it
  "|mit\\s+freundlichem\\s+gr|freundlich\\s+gr(?:ü|ue)(?:ss|ß)t|gr(?:ü|ue)(?:ss|ß)(?:e|en)?(?!\\s*(?:gott|di|dich|euch)(?![\\p{L}]))|gru(?:ss|ß)" +
  "|(?:best|kind|warm|warmest|many|kindest|with\\s+kind|with\\s+best)\\s+regards|regards|best\\s+wishes|(?:yours\\s+)?sincerely|yours\\s+faithfully|cheers" +
  "|bien\\s+(?:à|a)\\s+vous|(?:sinc(?:è|e)res|meilleures|cordiales|bien\\s+cordiales)\\s+salutations|salutations|bien\\s+cordialement" +
  "|(?:un\\s+)?(?:cordiale\\s+)?salut[oi]|saluti|(?:i\\s+)?migliori\\s+saluti|cordialità" +
  "|(?:met\\s+)?(?:vriendelijke|hartelijke)\\s+groet(?:en)?|groet(?:en|jes)?" +
  "|pozdrawiam|z\\s+poważaniem|z\\s+wyrazami\\s+szacunku|pozdrowienia" +
  "|saludos|atentamente|cumprimentos|atenciosamente)" +
  `(?=$|[${PY_WS},.!:;\\-])`, "u",
);
// LG, MfG, MVG, Cdlt, BàV: only on a line of a name at most ("LG Elli")
const GREETING_ABBR = new RegExp(`^(?:lg|mfg|mvg|cdlt|bàv)(?=$|[${PY_WS},.!:;\\-])`, "u");
// French formal closings run long, so they count anywhere in a line, as v1's own triggers do
const GREETING_ANYWHERE = ["salutations distinguées", "sincères salutations", "veuillez agréer", "vous prions d'agréer", "nos salutations"];

// mail-headers: the From / Sent / To / Cc / Subject lines of a quoted mail
const MAIL_HEADER = new RegExp(
  `^${S}*(?:from|von|de|da|od|van|sent|gesendet|envoyé|inviato|wysłano|verzonden|date|datum|to|an|à|a|do|aan|cc|bcc|subject|betreff|objet|oggetto|temat|onderwerp)${S}*:`,
  "u",
);

// read-forwarded: a forwarded ticket ("WG:", "FW:", "TR:"…) whose own note is a line or two, then a quoted mail
// the subject's first reply / forward prefix decides: "RE: Fwd:" is a reply
const MAIL_PREFIX = new RegExp(`(?<!${W})(re|aw|sv|antw|antwort|odp|r|wg|fw|fwd|tr|rv|doorst|pd|enc)${S}*:`, "iu");
const isForward = (subject: string) => /^(?:wg|fw|fwd|tr|rv|doorst|pd|enc)$/iu.test(MAIL_PREFIX.exec(subject)?.[1] ?? "");
const QUOTE_START = new RegExp(`^${S}*(?:from|von|de|da|od|van)${S}*:`, "u");
const OWN_MAIL = /apsoparts|angst[\s+-]*pfister/u;
const SAFETY_BANNER = /learn why this is important|erfahren sie, warum dies wichtig ist|pourquoi c'est important|perché è importante/u;
const SHORT_NOTE = 120; // letters

type Ctx = { on: (id: FixId) => boolean; fired: Set<FixId>; forward: boolean };

/** v1's remove_signature_noise line by line, with company-line / more-greetings / mail-headers applied when on. */
function removeSignatureNoiseV2(text: string, ctx: Ctx): string {
  if (!text) return text;
  const cleaned: string[] = [];
  let inSignature = false, quoteSeen = false, noteLetters = 0;
  for (const line of text.split("\n")) {
    const lower = pyStrip(line.toLowerCase());
    if (QUOTE_START.test(lower)) {
      // the first quoted mail of a forward with a short note, unless it is one of ours: read it
      if (inSignature && !quoteSeen && ctx.forward && noteLetters < SHORT_NOTE && !OWN_MAIL.test(lower) && ctx.on("read-forwarded")) {
        inSignature = false; ctx.fired.add("read-forwarded");
      }
      quoteSeen = true;
    }
    if (SIGNATURE_TRIGGERS.some((t) => lower.includes(t))) { inSignature = true; continue; }
    if (THANK_YOU.some((re) => re.test(lower))) { inSignature = true; continue; }
    if (inSignature) continue;
    const len = pyLen(lower);
    if (ctx.on("more-greetings") && len <= 60
      && (GREETING.test(lower) || (len <= 25 && GREETING_ABBR.test(lower)) || GREETING_ANYWHERE.some((t) => lower.includes(t)))) {
      inSignature = true; ctx.fired.add("more-greetings"); continue;
    }
    if (URL_LINE.test(lower) || WWW_LINE.test(lower)) continue;
    if (CONTACT_LINE.test(lower) && pyLen(pyStrip(line)) < 80) continue;
    if (ctx.on("mail-headers") && MAIL_HEADER.test(lower)) { ctx.fired.add("mail-headers"); continue; }
    const short = pyLen(pyStrip(line)) < 80 && !RFQ_WORDS.some((k) => lower.includes(k));
    const v1Company = COMPANY_WORD.test(lower) && short;
    if (ctx.on("company-line")) {
      const v2Company = (COMPANY_LONG.test(lower) || COMPANY_SHORT.test(line)) && short;
      if (v1Company !== v2Company) ctx.fired.add("company-line");
      if (v2Company) continue;
    } else if (v1Company) continue;
    if (COMPANY_LINE.test(line)) continue;
    if (DISCLAIMER.test(lower)) continue;
    cleaned.push(line);
    if (!SAFETY_BANNER.test(lower)) noteLetters += (lower.match(/\p{L}/gu) ?? []).length;
  }
  return cleaned.join("\n");
}

/* ── keyword additions and phrase rules ────────────────────────────────── */

const L = `(?<!${W})`, R = `(?!${W})`;
const re = (s: string) => new RegExp(s, "giu");

// reach-verb: "reach" used as a verb - only the word itself is blanked out
const REACH_VERB = [
  re(`${L}reach(?=${S}+(?:out|you|me|us|him|her|them|our|your|my|this|that|it|each|the\\s+(?:person|team|office|right|sales))${R})`),
  re(`(?<=${L}(?:to|can|could|cannot|can't|couldn't|will|would|able\\s+to|unable\\s+to|try\\s+to|tried\\s+to|trying\\s+to|not)${S}+)reach${R}`),
];

// invoice-not-received: the phrase in six languages (one sentence, the words in either order)
const SENT = "[^.\\n!?]";
const INVOICE_NOT_RECEIVED = [
  re(`${L}(?:invoices?|bills?)${R}${SENT}{0,40}?(?:${L}not|${L}never|n't|n’t|${L}yet\\s+to)${R}${SENT}{0,20}?${L}receiv(?:e|ed)${R}`),
  re(`(?:${L}not|${L}never|n't|n’t)${R}${SENT}{0,20}?${L}receiv(?:e|ed)${R}${SENT}{0,25}?${L}(?:invoices?|bills?)${R}`),
  re(`${L}rechnung(?:en)?${R}${SENT}{0,40}?${L}(?:nicht|nie|keine)${R}${SENT}{0,20}?${L}(?:erhalten|bekommen|angekommen|eingegangen)${R}`),
  re(`${L}(?:nicht|nie|keine)${R}${SENT}{0,20}?${L}rechnung(?:en)?${R}${SENT}{0,20}?${L}(?:erhalten|bekommen)${R}`),
  re(`${L}factures?${R}${SENT}{0,40}?${L}(?:pas|non|jamais)${R}${SENT}{0,15}?${L}re[çc]u(?:e|s|es)?${R}`),
  re(`${L}(?:pas|jamais)${R}${SENT}{0,15}?${L}re[çc]u(?:e|s|es)?${R}${SENT}{0,25}?${L}factures?${R}`),
  re(`${L}fattur[ae]${R}${SENT}{0,40}?${L}non${R}${SENT}{0,15}?${L}ricevut[aoie]${R}`),
  re(`${L}non${R}${SENT}{0,15}?${L}(?:ricevut[aoie]|ricevuto)${R}${SENT}{0,25}?${L}fattur[ae]${R}`),
  re(`${L}factu(?:ur|ren)${R}${SENT}{0,40}?${L}(?:niet|nooit|geen)${R}${SENT}{0,15}?${L}ontvangen${R}`),
  re(`${L}geen${S}+factuur${R}${SENT}{0,20}?${L}ontvangen${R}`),
  re(`${L}nie${S}+(?:otrzyma|dosta)\\p{L}*${SENT}{0,25}?${L}faktur\\p{L}*`),
  re(`${L}faktur\\p{L}*${SENT}{0,40}?${L}nie${R}${SENT}{0,15}?${L}(?:otrzyma|dotar|dosta)\\p{L}*`),
];
const INVOICE_NOT_RECEIVED_WEIGHT = 3;

// enquiry-is-rfq: German "Anfrage" (and its compounds) is how most quotation requests are titled
const ENQUIRY_WORDS = ["anfrage", "angebotsanfrage", "eilanfrage", "offertanfrage", "offertenanfrage", "preisanfrage"];
// "Ihre Anfrage" is an answer to one (often an auto-reply), not a request
const YOUR_ENQUIRY = [re(`${L}ihre${S}+anfrage${R}`)];

// product-info-words: the German plurals and compounds v1's singular keywords miss
const PRODUCT_INFO_SUB: Record<string, string[]> = {
  "Technical Data Sheet request": ["datenblätter", "datenblättern", "produktdatenblatt", "technisches datenblatt", "sicherheitsdatenblatt", "sicherheitsdatenblätter"],
  "Conformities / Certificates": [
    "zertifikate", "zertifikaten", "materialzertifikat", "materialzertifikate", "werkszeugnis", "abnahmeprüfzeugnis",
    "konformitätserklärung", "konformitätserklärungen", "lebensmittelkonformität", "konformitätsbescheinigung",
  ],
};
const PRODUCT_INFO_MAIN = Object.values(PRODUCT_INFO_SUB).flat();

const RFQ_NAME = [
  "request for quotation", "requests for quotation", "request for quote", "request for a quote", "request for a quotation",
  "request for offer", "request for an offer", "quotation request", "richiesta di offerta", "richiesta offerta",
  "demande de cotation", "zapytanie ofertowe", "offerteaanvraag",
];

// generic-words-need-price: Product Price words that say nothing about price on their own ("attached", "please")
const GENERIC = new Set([
  "in der anlage finden", "im anhang", "anbei", "in der anlage", "finden sie unsere", "senden wir ihnen", "sende ich ihnen",
  "ci-joint", "ci-jointe", "ci joint", "ci jointe", "selon annexe", "allegato", "allegata", "allegati",
  "załącznik", "w załączniku", "bijgevoegd", "bijlage",
  "merci de me faire", "ich bitte um", "richiedere",
  // the same kind in the "Request for quotation" sub-category list
  "please find attached", "find attached", "beigefügt", "bitte finden", "faire parvenir",
]);
// ... they still count next to a real price / quote / order word - Product Price's own, the "Request for quotation"
// list's (anfrage, demande de devis…), or one of these signs of a new order sent as an attachment
const NEW_ORDER_SIGNS = [
  "einkaufsbeleg", "bestellschein", "bestellformular", "erwarten wir ihre auftragsbestätigung", "um ihre auftragsbestätigung",
  "bitte um auftragsbestätigung", "zusendung der auftragsbestätigung", "zusendung einer auftragsbestätigung", "um eine auftragsbestätigung",
  "auftragsbestätigung zukommen", "send us the order confirmation", "send us an order confirmation", "send the order confirmation",
  "bon de commande", "ordine di acquisto", "inkooporder", "zamówienie zakupu",
];

// existing-order: the subject is one of our order confirmations (or a reply to it)
const ORDER_NO = "A2\\p{Nd}\\.\\p{Nd}{6}";
const HAS_ORDER_NO = new RegExp(`${L}(?:OS-)?${ORDER_NO}`, "iu");
const CONFIRMATION_WORDS = new RegExp(
  `auftragsbest(?:ä|ae)tigung|bestellbest(?:ä|ae)tigung|confirmation${S}+de${S}+(?:la${S}+|votre${S}+)?commande|order${S}+confirmation|confirmation${S}+of${S}+order|` +
  `conferma${S}+(?:d'|dell'|del${S}+tuo${S}+)?${S}*ordine|orderbevestiging|potwierdzenie${S}+zamówienia|lieferschein|delivery${S}+note|bon${S}+de${S}+livraison|` +
  `bestellung${S}+wurde${S}+versandt|commande${S}+a${S}+été${S}+envoyée`,
  "iu",
);
/** the subject names one of our orders (A2x.xxxxxx), or is one of our confirmation / shipping mails */
const isExistingOrderSubject = (s: string) => HAS_ORDER_NO.test(s) || CONFIRMATION_WORDS.test(s);
const ORDER_WORDS = new Set([
  "rfq", "order request", "new order", "want to order", "place an order", "purchase order", "po number", "vendor",
  "bestellen", "möchte bestellen", "bestellung aufgeben", "neue bestellung", "erhalten sie bestellung",
  "unsere bestellung", "die bestellung", "meine bestellung", "senden bestellung", "erhalten bestellung",
  "commander", "nouvelle commande", "passer commande", "ordinare", "nuovo ordine", "zamówić", "nowe zamówienie", "nieuwe bestelling",
  "arc", "accusé de réception", // the acknowledgement of that order
]);

const DELIVERY_MAIN = [
  "liefertermin", "liefertermine", "lieferdatum", "lieferzeit", "lieferzeiten", "lieferverzug", "lieferverzögerung",
  "liefermahnung", "lieferterminerinnerung", "lieferreklamation", "nachlieferung", "restlieferung", "teillieferung",
  "ersatzlieferung", "mängelrüge", "nicht versendet", "noch nicht erhalten", "noch nicht geliefert", "nicht geliefert",
  // not "versandt": "Ihre Bestellung wurde versandt" is our own shipping mail's subject, whatever the reply is about
  "falsche ware", "falscher artikel", "beschädigt", "rückstand", "versendet", "verschickt", "geliefert",
  "expedite", "expedited", "expediting", "vorzug", "liefer-urgenz", "gelieferte ware", "falsch geliefert",
  // open orders and missing order confirmations (v1 has "open orders", "offene aufträge", "order portfolio")
  "offene bestellung", "offene bestellungen", "open order", // not "offene Positionen": accounting says it too
  "offene ab", "ab-mahnung", "auftragsbestätigungsmahnung", "fehlende auftragsbestätigung", "fehlende auftragsbestätigungen",
  "demande de délai",
  "délai de livraison", "délais de livraison", "date de livraison", "le délai", "votre délai", "vos délais",
  "donner un délai", "indiquer un délai", "communiquer un délai", // not "dans un délai court"
  "reliquat", "livré", "livrée", "livrés", "livraisons", "livrer", "à recevoir", "reste à livrer", "restant à livrer",
  "data di consegna", "termine di consegna", "tempi di consegna", "consegnato",
  "delivery date", "delivery time", "backorder", "back order", "not yet received", "not received yet", "dispatched",
  "levertijd", "leverdatum", "geleverd", "termin dostawy",
];
const DELIVERY_SUB: Record<string, string[]> = {
  "Delivery is late": ["liefermahnung", "lieferterminerinnerung", "lieferverzug", "lieferverzögerung", "nicht versendet", "noch nicht erhalten", "noch nicht geliefert", "not yet received", "not received yet", "reliquat", "backorder", "back order", "rückstand"],
  "Issue with existing delivery": ["lieferreklamation", "mängelrüge", "nachlieferung", "restlieferung", "teillieferung", "ersatzlieferung", "falsche ware", "falscher artikel"],
};
const CANCEL_WORDS = [
  "bestellstornierung", "auftragsstornierung", "bestellstorno", "stornoauftrag", "storno-auftrag", "stornierung der bestellung", "storniert werden",
  "bitte stornieren sie", "stornieren sie bitte", "annulation de notre commande", "annulez",
];
// "sauf erreur (de ma part)" = "unless I am mistaken": not the "erreur" that Order Cancellation counts
const NOT_A_MISTAKE = [re(`${L}sauf${S}+erreur${R}`)];

/* ── scoring ───────────────────────────────────────────────────────────── */

/** the matches blanked out (same length, so nothing else moves), and how many there were */
function blank(text: string, patterns: readonly RegExp[]): { text: string; n: number } {
  let n = 0;
  let out = text;
  for (const p of patterns) out = out.replace(p, (m) => { n++; return " ".repeat(m.length); });
  return { text: out, n };
}

type Scored = { score: number; matched: string[] };
const add = (a: Scored, b: Scored): Scored => ({ score: a.score + b.score, matched: [...a.matched, ...b.matched] });

function bestOf(scored: Record<string, Scored>): { name: string | null; best: Scored } {
  let name: string | null = null, best: Scored = { score: 0, matched: [] };
  for (const [k, r] of Object.entries(scored)) if (r.score > best.score) [name, best] = [k, r];
  return { name, best };
}

function listed(keywords: string[], n = 5): string {
  const u = [...new Set(keywords)];
  return u.slice(0, n).map((k) => `"${k}"`).join(", ") + (u.length > n ? ` and ${u.length - n} more` : "");
}

const zeroScores = (): Record<string, number> => Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
const fixTitle = new Map(FIXES.map((f) => [f.id, f.title]));

/**
 * The classifier, v2: what the step would write with the fixes on. `switches` turns single rules off
 * ({ "delivery-words": false }); every rule is on by default, and with all of them off the answer is v1's.
 */
export function classifyTicketV2(input: { subject?: string | null; content?: string | null }, switches: FixSwitches = {}): ClassificationV2 {
  const fired = new Set<FixId>();
  const on = (id: FixId) => switches[id] !== false;
  const done = (c: Classification): ClassificationV2 => {
    const fixes = FIXES.map((f) => f.id).filter((id) => fired.has(id));
    const why = fixes.length ? ` v2: ${fixes.map((id) => fixTitle.get(id)).join("; ")}.` : "";
    return { ...c, explanation: c.explanation + why, fixes };
  };
  const none = (status: Status, explanation: string): ClassificationV2 => done({
    status, category: null, subProperty: null, subCategory: null, subKey: null, orderNumber: null, orderNumbers: [],
    scores: zeroScores(), subScores: {}, matched: [], confidence: 0, explanation,
  });

  let title = input.subject === undefined ? "" : input.subject;
  let description = input.content === undefined ? "" : input.content;
  if (title === null || description === null) {
    if (!on("null-fields")) return none("error", `The ${title === null ? "subject" : "content"} is null: the step raises a TypeError and writes nothing.`);
    if ((title ?? "") || (description ?? "")) fired.add("null-fields");
    title = title ?? "";
    description = description ?? "";
  }
  if (!title && !description) return none("skipped", "Subject and content are empty: the step skips the ticket.");

  if (on("curly-apostrophe")) {
    const fix = (s: string) => s.replace(/[’‘ʼ]/gu, "'");
    const [t, d] = [fix(title), fix(description)];
    if (t !== title || d !== description) fired.add("curly-apostrophe");
    [title, description] = [t, d];
  }

  const ctx: Ctx = { on, fired, forward: isForward(title) };
  let combined = `${title} `.repeat(10) + removeSignatureNoiseV2(description, ctx);
  const orders = extractOrderNumbers(title + " " + description);

  if (on("reach-verb")) {
    const r = blank(combined, REACH_VERB);
    if (r.n) { fired.add("reach-verb"); combined = r.text; }
  }

  // invoice-not-received: found once, counted for Invoicing, blanked out for Delivery
  let notReceived = 0, forDelivery = combined;
  if (on("invoice-not-received")) {
    const r = blank(combined, INVOICE_NOT_RECEIVED);
    notReceived = r.n;
    forDelivery = r.text;
  }
  const existingOrder = on("existing-order") && isExistingOrderSubject(title);

  const mainScores: Record<string, Scored> = {};
  for (const [name, data] of Object.entries(KEYWORDS)) {
    let r = calculateScore(name === "Delivery" ? forDelivery : combined, data.main);
    if (name === "Product Price" && (existingOrder || on("generic-words-need-price"))) {
      // existing-order first: without its order words, are any real price words left for the generic ones to join?
      const notOrder = existingOrder ? data.main.filter((k) => !ORDER_WORDS.has(k)) : data.main;
      const r1 = notOrder === data.main ? r : calculateScore(combined, notOrder);
      if (r1.score !== r.score) fired.add("existing-order");
      r = r1;
      if (on("generic-words-need-price")) {
        const real = calculateScore(combined, notOrder.filter((k) => !GENERIC.has(k)));
        const rfq = KEYWORDS[name].sub["Request for quotation"].filter((k) => !GENERIC.has(k) && !(existingOrder && ORDER_WORDS.has(k)));
        const unlock = real.score > 0 || calculateScore(combined, existingOrder ? rfq : [...rfq, ...NEW_ORDER_SIGNS]).score > 0;
        if (!unlock && r.score > 0) { fired.add("generic-words-need-price"); r = real; }
      }
    }
    if (name === "Product Information" && on("product-info-words")) {
      const x = calculateScore(combined, PRODUCT_INFO_MAIN);
      if (x.score) { r = add(r, x); fired.add("product-info-words"); }
    }
    if (name === "Delivery" && on("delivery-words")) {
      const x = calculateScore(forDelivery, DELIVERY_MAIN);
      if (x.score) { r = add(r, x); fired.add("delivery-words"); }
    }
    if (name === "Order Cancellation" && on("cancellation-words")) {
      const idiom = blank(combined, NOT_A_MISTAKE);
      if (idiom.n) {
        const r1 = calculateScore(idiom.text, data.main);
        if (r1.score !== r.score) { r = r1; fired.add("cancellation-words"); }
      }
      const x = calculateScore(combined, CANCEL_WORDS);
      if (x.score) { r = add(r, x); fired.add("cancellation-words"); }
    }
    if (name === "Invoicing & Accounting" && notReceived) {
      r = add(r, { score: notReceived * INVOICE_NOT_RECEIVED_WEIGHT, matched: ["invoice not received"] });
      fired.add("invoice-not-received");
    }
    mainScores[name] = r;
  }
  // enquiry-is-rfq: nothing else recognised and the subject is an "Anfrage" - a quotation request
  if (on("enquiry-is-rfq") && !existingOrder && Object.values(mainScores).every((r) => r.score === 0)) {
    const x = calculateScore(blank(title, YOUR_ENQUIRY).text, ENQUIRY_WORDS);
    if (x.score) { mainScores["Product Price"] = { score: 1, matched: x.matched }; fired.add("enquiry-is-rfq"); }
  }
  const scores = Object.fromEntries(Object.entries(mainScores).map(([k, r]) => [k, r.score]));
  const { name: cat, best: main } = bestOf(mainScores);

  const subScores: Record<string, number> = {};
  if (cat === null) {
    return done({
      status: "not_classified", category: null, subProperty: null, subCategory: null, subKey: null, orderNumber: null,
      orderNumbers: orders, scores, subScores, matched: [], confidence: 0,
      explanation: "No keyword of any category in the subject or the cleaned content: nothing is written, not even an order number.",
    });
  }
  const subScored: Record<string, Scored> = {};
  for (const [name, keywords] of Object.entries(KEYWORDS[cat].sub)) {
    let r = calculateScore(cat === "Delivery" ? forDelivery : combined, keywords);
    if (cat === "Product Price" && name === "Request for quotation" && on("rfq-own-name")) {
      const x = calculateScore(combined, RFQ_NAME);
      if (x.score) { r = add(r, x); fired.add("rfq-own-name"); }
    }
    if (cat === "Product Information" && on("product-info-words") && PRODUCT_INFO_SUB[name]) {
      const x = calculateScore(combined, PRODUCT_INFO_SUB[name]);
      if (x.score) { r = add(r, x); fired.add("product-info-words"); }
    }
    if (cat === "Delivery" && on("delivery-words") && DELIVERY_SUB[name]) {
      const x = calculateScore(forDelivery, DELIVERY_SUB[name]);
      if (x.score) { r = add(r, x); fired.add("delivery-words"); }
    }
    if (cat === "Order Cancellation" && name === "Cancel existing order" && on("cancellation-words")) {
      const x = calculateScore(combined, CANCEL_WORDS);
      if (x.score) { r = add(r, x); fired.add("cancellation-words"); }
    }
    if (cat === "Invoicing & Accounting" && name === "Invoice not received" && notReceived) {
      r = add(r, { score: notReceived * INVOICE_NOT_RECEIVED_WEIGHT, matched: ["invoice not received"] });
    }
    subScored[name] = r;
    subScores[name] = r.score;
  }
  const { name: subKey, best: sub } = bestOf(subScored);
  const subValue = subKey === null ? null : DROPDOWN_VALUES[cat]?.[subKey] ?? subKey;
  const subProperty = subValue ? PROPERTY_MAPPING.sub_categories[cat] ?? null : null;
  const orderNumber = orders.length ? orders.join(", ") : null;
  const confidence = Math.round(Math.min(100, ((main.matched.length + sub.matched.length) / 3) * 100) * 10) / 10;

  let next: string | null = null;
  for (const c of CATEGORIES) if (c !== cat && (next === null || scores[c] > scores[next])) next = c;
  const rival = next === null || scores[next] === 0 ? "" : scores[next] === main.score
    ? ` - tied with ${next}, the first in list order wins` : `; next ${next} at ${scores[next]}`;
  const subText = subKey === null ? "no sub-category keyword, so none is written"
    : `sub-category ${subValue} ("${subKey}", score ${sub.score}) on ${listed(sub.matched)}`;
  return done({
    status: "classified", category: cat, subProperty, subCategory: subProperty ? subValue : null, subKey,
    orderNumber, orderNumbers: orders, scores, subScores, matched: [...main.matched, ...sub.matched], confidence,
    explanation: `${cat} (score ${main.score}${rival}) on ${listed(main.matched)}; ${subText}${orderNumber ? `; order_number ${orderNumber}` : ""}.`,
  });
}
