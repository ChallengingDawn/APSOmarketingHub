// NEWSLETTER - THE STUDIO'S DOCUMENT AND ITS E-MAIL (SARCLA 08.11.2026: "newsletter - learn from our newsletters in HS
// and here you should be able to build our newsletter, push to HubSpot, plan to send; everything on the content calendar";
// then, the same day: "much more improved, with the assistant on the side; pictures are not being generated").
//
// A newsletter is a subject, a preheader and blocks (header, lead story, stories - stacked or beside their picture -,
// products, banner, text, the shop's facts, call to action, divider, footer). renderEmail turns it into e-mail HTML that
// survives Outlook and phones: tables, inline styles, a 600 px column, a bulletproof button, the preheader hidden at the
// top - no script, no web font, no CSS grid. A picture kept in the hub (/api/content/picture/...) goes into the e-mail
// with the hub's full address (`origin`).
// Three layouts to start from, shaped on our best newsletters (the brain's gold examples: the know-how letter, the shop
// feature letter) and a product letter. The assistant changes any block's words through `textFields` / `applyEdits`.
// Pure and shared with the browser (relative imports only): tests/studio-newsletter.test.ts.

import { brandWarnings } from "../blog/model";

export type Link = { label: string; url: string };
export type Block =
  | { id: string; kind: "header"; tagline: string; logoUrl: string }
  | { id: string; kind: "hero"; eyebrow: string; headline: string; text: string; imageUrl: string; imageAlt: string; imagePrompt?: string; button: Link }
  | { id: string; kind: "article"; title: string; text: string; imageUrl: string; imageAlt: string; imagePrompt?: string; link: Link; layout?: "stacked" | "left" | "right" }
  | { id: string; kind: "products"; title: string; items: { name: string; text: string; imageUrl: string; url: string }[] }
  | { id: string; kind: "banner"; imageUrl: string; imageAlt: string; imagePrompt?: string; url: string }
  | { id: string; kind: "text"; text: string }
  | { id: string; kind: "facts"; items: { big: string; label: string }[] }
  | { id: string; kind: "cta"; text: string; button: Link }
  | { id: string; kind: "divider" }
  | { id: string; kind: "footer"; text: string };
export type BlockKind = Block["kind"];

export type NewsletterDoc = {
  v: 1;
  subject: string;
  preheader: string;
  /** The sender's name the inbox shows. */
  fromName: string;
  language: string;
  blocks: Block[];
  /** The layout it was started from (a key of TEMPLATES). */
  layout?: string;
  /** What happened in HubSpot - set by the server action, shown in the studio. */
  hubspot?: { emailId?: string; url?: string; state?: string; at?: string };
  /** The HubSpot e-mail it started from - its look is what a HubSpot draft copies (SARCLA 08.11.2026: "look at the
   *  latest we sent"). */
  startedFrom?: { emailId: string; subject: string; language: string; date: string };
  /** Our e-mails the assistant writes like (picked in "Our e-mails"; "we should be able to select more"). */
  learnFrom?: { emailId: string; subject: string }[];
};

export const SUBJECT_MAX = 55;
export const PREHEADER_MAX = 90;

export const BLOCK_LABEL: Record<BlockKind, string> = {
  header: "Header", hero: "Lead story", article: "Story", products: "Products", banner: "Banner", text: "Text",
  facts: "The shop's facts", cta: "Call to action", divider: "Divider", footer: "Footer",
};
export const BLOCK_HINT: Record<BlockKind, string> = {
  header: "Logo and a line", hero: "Big picture, headline, button", article: "Picture, title, text, link", products: "Three products with pictures",
  banner: "One wide picture with a link", text: "A paragraph or two", facts: "Three facts about the shop", cta: "A line and a button",
  divider: "A thin line", footer: "Unsubscribe and address",
};

let seq = 0;
const rid = () => `b${Date.now().toString(36)}${(seq++).toString(36)}`;

/** The shop's own facts, from the brain (positioning guard and our gold newsletters) - never invented figures. */
export const SHOP_FACTS: Record<string, { big: string; label: string }[]> = {
  EN: [{ big: "100,000+", label: "standard components" }, { big: "48/72 h", label: "delivery across Europe on stock items" }, { big: "7 languages", label: "1:1 support by chat and e-mail" }],
  DE: [{ big: "100'000+", label: "Standardkomponenten" }, { big: "48/72 h", label: "Lieferung in Europa ab Lager" }, { big: "7 Sprachen", label: "Support 1:1 per Chat und E-Mail" }],
  FR: [{ big: "100 000+", label: "composants standard" }, { big: "48/72 h", label: "livraison en Europe sur stock" }, { big: "7 langues", label: "support 1:1 par chat et e-mail" }],
  IT: [{ big: "100.000+", label: "componenti standard" }, { big: "48/72 h", label: "consegna in Europa da magazzino" }, { big: "7 lingue", label: "supporto 1:1 via chat ed e-mail" }],
  NL: [{ big: "100.000+", label: "standaardcomponenten" }, { big: "48/72 u", label: "levering in Europa uit voorraad" }, { big: "7 talen", label: "1:1 support via chat en e-mail" }],
  PL: [{ big: "100 000+", label: "komponentów standardowych" }, { big: "48/72 h", label: "dostawa w Europie z magazynu" }, { big: "7 języków", label: "wsparcie 1:1 przez czat i e-mail" }],
};
const factsOf = (lang: string) => (SHOP_FACTS[lang.toUpperCase()] ?? SHOP_FACTS.EN).map((x) => ({ ...x }));

/** The words the e-mail carries around the blocks, in its language. */
const WORDS: Record<string, { unsubscribe: string; browser: string; tagline: string; footer: string; more: string; discover: string; view: string; order: string }> = {
  EN: { unsubscribe: "Unsubscribe", browser: "View in your browser", tagline: "Technical parts, delivered", footer: "APSOparts - Angst+Pfister. You receive this newsletter because you subscribed on apsoparts.com.", more: "Read more", discover: "Discover more", view: "View", order: "Order on apsoparts.com" },
  DE: { unsubscribe: "Abmelden", browser: "Im Browser ansehen", tagline: "Technische Teile, geliefert", footer: "APSOparts - Angst+Pfister. Sie erhalten diesen Newsletter, weil Sie ihn auf apsoparts.com abonniert haben.", more: "Weiterlesen", discover: "Mehr erfahren", view: "Ansehen", order: "Auf apsoparts.com bestellen" },
  FR: { unsubscribe: "Se désabonner", browser: "Voir dans le navigateur", tagline: "Pièces techniques, livrées", footer: "APSOparts - Angst+Pfister. Vous recevez cette newsletter car vous vous êtes abonné sur apsoparts.com.", more: "Lire la suite", discover: "En savoir plus", view: "Voir", order: "Commander sur apsoparts.com" },
  IT: { unsubscribe: "Annulla l'iscrizione", browser: "Apri nel browser", tagline: "Parti tecniche, consegnate", footer: "APSOparts - Angst+Pfister. Ricevete questa newsletter perché vi siete iscritti su apsoparts.com.", more: "Continua a leggere", discover: "Scopri di più", view: "Vedi", order: "Ordina su apsoparts.com" },
  NL: { unsubscribe: "Afmelden", browser: "Bekijk in je browser", tagline: "Technische onderdelen, geleverd", footer: "APSOparts - Angst+Pfister. U ontvangt deze nieuwsbrief omdat u zich op apsoparts.com hebt aangemeld.", more: "Lees verder", discover: "Meer ontdekken", view: "Bekijken", order: "Bestellen op apsoparts.com" },
  PL: { unsubscribe: "Wypisz się", browser: "Zobacz w przeglądarce", tagline: "Części techniczne, dostarczone", footer: "APSOparts - Angst+Pfister. Otrzymujesz ten newsletter, ponieważ zapisałeś się na apsoparts.com.", more: "Czytaj dalej", discover: "Dowiedz się więcej", view: "Zobacz", order: "Zamów na apsoparts.com" },
};
export const wordsOf = (lang: string) => WORDS[(lang || "EN").toUpperCase()] ?? WORDS.EN;

/** A new block of a kind, with empty fields (and an id), in the newsletter's language. */
export function newBlock(kind: BlockKind, id = rid(), lang = "EN"): Block {
  const w = wordsOf(lang);
  switch (kind) {
    case "header": return { id, kind, tagline: w.tagline, logoUrl: "" };
    case "hero": return { id, kind, eyebrow: "", headline: "", text: "", imageUrl: "", imageAlt: "", imagePrompt: "", button: { label: w.discover, url: "https://www.apsoparts.com" } };
    case "article": return { id, kind, title: "", text: "", imageUrl: "", imageAlt: "", imagePrompt: "", link: { label: w.more, url: "https://www.apsoparts.com" }, layout: "stacked" };
    case "products": return { id, kind, title: "", items: [{ name: "", text: "", imageUrl: "", url: "" }, { name: "", text: "", imageUrl: "", url: "" }, { name: "", text: "", imageUrl: "", url: "" }] };
    case "banner": return { id, kind, imageUrl: "", imageAlt: "", imagePrompt: "", url: "" };
    case "text": return { id, kind, text: "" };
    case "facts": return { id, kind, items: factsOf(lang) };
    case "cta": return { id, kind, text: "", button: { label: w.order, url: "https://www.apsoparts.com" } };
    case "divider": return { id, kind };
    case "footer": return { id, kind, text: w.footer };
  }
}

/** A block like another, with a new id (the duplicate button). */
export const copyBlock = (b: Block): Block => ({ ...JSON.parse(JSON.stringify(b)), id: rid() });

/* ── the layouts to start from ─────────────────────────────────────────────────────────────────────────────────── */

export type Template = { key: string; name: string; about: string; blocks: (lang: string) => Block[] };

const story = (lang: string, layout: "stacked" | "left" | "right"): Block => ({ ...(newBlock("article", rid(), lang) as Extract<Block, { kind: "article" }>), layout });

export const TEMPLATES: Template[] = [
  {
    key: "knowhow", name: "Know-how letter",
    about: "One question answered: three points beside their pictures, our facts. Like our FFKM letter.",
    blocks: (l) => [newBlock("header", rid(), l), newBlock("hero", rid(), l), story(l, "left"), story(l, "right"), story(l, "left"), newBlock("facts", rid(), l), newBlock("cta", rid(), l), newBlock("footer", rid(), l)],
  },
  {
    key: "news", name: "Shop news",
    about: "A shop feature and what it saves: two stories with pictures. Like our reorder letter.",
    blocks: (l) => [newBlock("header", rid(), l), newBlock("hero", rid(), l), story(l, "stacked"), story(l, "stacked"), newBlock("text", rid(), l), newBlock("cta", rid(), l), newBlock("footer", rid(), l)],
  },
  {
    key: "products", name: "Product letter",
    about: "Products first: a wide banner, three products with pictures, our facts.",
    blocks: (l) => [newBlock("header", rid(), l), newBlock("banner", rid(), l), newBlock("text", rid(), l), newBlock("products", rid(), l), newBlock("facts", rid(), l), newBlock("cta", rid(), l), newBlock("footer", rid(), l)],
  },
];

/** The newsletter a to-do starts with: the shop news layout, its words still to write. */
export function emptyNewsletter(language = "EN"): NewsletterDoc {
  return { v: 1, subject: "", preheader: "", fromName: "APSOparts", language, blocks: TEMPLATES[1].blocks(language), layout: "news" };
}

/** True when nothing has been written into the blocks yet (the layout gallery shows first). */
export function isBlank(docIn: unknown): boolean {
  const d = asNewsletter(docIn);
  return !d.subject.trim() && d.blocks.every((b) => textFields(b).filter((f) => !/^(button|link|tagline|footer|item\d(Big|Label))$/.test(f.name) && !(b.kind === "footer")).every((f) => !f.value.trim())
    && !("imageUrl" in b && b.imageUrl));
}

/**
 * The layout's blocks with the words already written carried over: each new block takes the next written block of its
 * kind (a story's title and text, a picture) - so changing the layout never loses work.
 */
export function applyTemplate(docIn: unknown, key: string): NewsletterDoc {
  const d = asNewsletter(docIn);
  const t = TEMPLATES.find((x) => x.key === key) ?? TEMPLATES[0];
  const pool = new Map<BlockKind, Block[]>();
  for (const b of d.blocks) pool.set(b.kind, [...(pool.get(b.kind) ?? []), b]);
  const blocks = t.blocks(d.language).map((nb) => {
    const old = pool.get(nb.kind)?.shift();
    if (!old) return nb;
    return nb.kind === "article" && old.kind === "article" ? { ...old, layout: nb.layout } : { ...old };
  });
  return { ...d, blocks, layout: t.key };
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Whatever is stored, as a newsletter (a document from an older shape keeps what it can). */
export function asNewsletter(doc: unknown): NewsletterDoc {
  const d = isObj(doc) ? doc : {};
  const base = emptyNewsletter(typeof d.language === "string" ? d.language : "EN");
  return {
    ...base,
    subject: typeof d.subject === "string" ? d.subject : "",
    preheader: typeof d.preheader === "string" ? d.preheader : "",
    fromName: typeof d.fromName === "string" && d.fromName ? d.fromName : base.fromName,
    blocks: Array.isArray(d.blocks) ? (d.blocks.filter((b) => isObj(b) && typeof b.kind === "string" && typeof b.id === "string" && b.kind in BLOCK_LABEL) as Block[]) : base.blocks,
    layout: typeof d.layout === "string" ? d.layout : Array.isArray(d.blocks) ? undefined : base.layout,
    hubspot: isObj(d.hubspot) ? (d.hubspot as NewsletterDoc["hubspot"]) : undefined,
    startedFrom: isObj(d.startedFrom) && typeof d.startedFrom.emailId === "string" ? (d.startedFrom as NewsletterDoc["startedFrom"]) : undefined,
    learnFrom: Array.isArray(d.learnFrom) ? (d.learnFrom.filter((x) => isObj(x) && typeof x.emailId === "string").slice(0, 8) as NewsletterDoc["learnFrom"]) : undefined,
  };
}

/* ── the words of a block, for the assistant ───────────────────────────────────────────────────────────────────── */

export type TextField = { name: string; value: string };

/** A block's words, by name (what the assistant may change - never an address or a picture). */
export function textFields(b: Block): TextField[] {
  switch (b.kind) {
    case "header": return [{ name: "tagline", value: b.tagline }];
    case "hero": return [{ name: "eyebrow", value: b.eyebrow }, { name: "headline", value: b.headline }, { name: "text", value: b.text }, { name: "button", value: b.button.label }, { name: "imageAlt", value: b.imageAlt }];
    case "article": return [{ name: "title", value: b.title }, { name: "text", value: b.text }, { name: "link", value: b.link.label }, { name: "imageAlt", value: b.imageAlt }];
    case "products": return [{ name: "title", value: b.title }, ...b.items.flatMap((x, i) => [{ name: `item${i + 1}Name`, value: x.name }, { name: `item${i + 1}Text`, value: x.text }])];
    case "banner": return [{ name: "imageAlt", value: b.imageAlt }];
    case "text": return [{ name: "text", value: b.text }];
    case "facts": return b.items.flatMap((x, i) => [{ name: `item${i + 1}Big`, value: x.big }, { name: `item${i + 1}Label`, value: x.label }]);
    case "cta": return [{ name: "text", value: b.text }, { name: "button", value: b.button.label }];
    case "footer": return [{ name: "footer", value: b.text }];
    case "divider": return [];
  }
}

/** The block with one of its words changed (an unknown name changes nothing). */
export function setTextField(b: Block, name: string, value: string): Block {
  const item = /^item(\d)(Name|Text|Big|Label)$/.exec(name);
  if (item) {
    const i = Number(item[1]) - 1;
    if (b.kind === "products" && b.items[i] && (item[2] === "Name" || item[2] === "Text")) return { ...b, items: b.items.map((x, k) => (k === i ? { ...x, [item[2] === "Name" ? "name" : "text"]: value } : x)) };
    if (b.kind === "facts" && b.items[i] && (item[2] === "Big" || item[2] === "Label")) return { ...b, items: b.items.map((x, k) => (k === i ? { ...x, [item[2] === "Big" ? "big" : "label"]: value } : x)) };
    return b;
  }
  if (!textFields(b).some((f) => f.name === name)) return b;
  if (name === "button" && (b.kind === "hero" || b.kind === "cta")) return { ...b, button: { ...b.button, label: value } };
  if (name === "link" && b.kind === "article") return { ...b, link: { ...b.link, label: value } };
  if (name === "footer" && b.kind === "footer") return { ...b, text: value };
  return { ...b, [name]: value } as Block;
}

export type Edits = { subject?: string; preheader?: string; blocks: { id: string; fields: TextField[] }[] };

/** The assistant's answer laid into the newsletter: only words, only of blocks that are still there. */
export function applyEdits(docIn: unknown, e: Edits): NewsletterDoc {
  const d = asNewsletter(docIn);
  const by = new Map(e.blocks.map((x) => [x.id, x.fields]));
  return {
    ...d,
    subject: e.subject?.trim() ? e.subject.trim() : d.subject,
    preheader: e.preheader?.trim() ? e.preheader.trim() : d.preheader,
    blocks: d.blocks.map((b) => (by.get(b.id) ?? []).reduce((acc, f) => (typeof f.value === "string" ? setTextField(acc, f.name, f.value) : acc), b)),
  };
}

/** The words the assistant is shown: the envelope and each block's fields (one block only, when it works on one). */
export function editable(docIn: unknown, blockId?: string): { subject: string; preheader: string; blocks: { id: string; kind: BlockKind; fields: TextField[] }[] } {
  const d = asNewsletter(docIn);
  return {
    subject: d.subject, preheader: d.preheader,
    blocks: d.blocks.filter((b) => (!blockId || b.id === blockId) && textFields(b).length).map((b) => ({ id: b.id, kind: b.kind, fields: textFields(b) })),
  };
}

/** What a picture should show, made from a block's words when nobody wrote it (the picture panel starts from it). */
export function pictureIdea(b: Block): string {
  const own = "imagePrompt" in b && b.imagePrompt ? b.imagePrompt : "";
  if (own) return own;
  const plain = (s: string) => s.replace(/\*\*|\[|\]\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
  if (b.kind === "hero") return plain([b.headline, b.text].filter(Boolean).join(" - ")).slice(0, 300);
  if (b.kind === "article") return plain([b.title, b.text].filter(Boolean).join(" - ")).slice(0, 300);
  if (b.kind === "banner") return plain(b.imageAlt).slice(0, 300);
  return "";
}

/* ── the e-mail ─────────────────────────────────────────────────────────────────────────────────────────────────── */

export const BRAND = { petrol: "#274e64", deep: "#1b3a4b", red: "#d80901", ink: "#1d2326", muted: "#5b6670", line: "#e3e8ec", page: "#eef1f3", pale: "#f4f6f7" };
const FONT = "Arial, Helvetica, sans-serif";

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** A link the e-mail may carry: http(s) or mailto, or HubSpot's own tokens; anything else becomes "#". */
export const safeUrl = (u: string) => {
  const t = (u ?? "").trim();
  return /^(https?:\/\/|mailto:)/i.test(t) || /^\{\{\s*[\w.]+\s*\}\}$/.test(t) ? t : "#";
};
/** A picture's address in the e-mail: one kept in the hub gets the hub's full address. */
export const pictureUrl = (u: string, origin?: string) => {
  const t = (u ?? "").trim();
  return origin && t.startsWith("/api/content/picture/") ? `${origin.replace(/\/+$/, "")}${t}` : safeUrl(t);
};

/** Light text formatting: **bold**, [label](url), blank line = new paragraph. Everything else is escaped. */
export function richText(text: string, color: string = BRAND.ink, size = 16, line = 25): string {
  const paras = (text ?? "").trim().split(/\n{2,}/).filter(Boolean);
  return paras.map((p) => {
    let h = esc(p);
    h = h.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    h = h.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, url: string) => `<a href="${esc(safeUrl(url.replace(/&amp;/g, "&")))}" style="color:${BRAND.petrol};text-decoration:underline">${label}</a>`);
    h = h.replace(/\n/g, "<br>");
    return `<p style="margin:0 0 14px;font-family:${FONT};font-size:${size}px;line-height:${line}px;color:${color}">${h}</p>`;
  }).join("");
}

const button = (l: Link, align: "left" | "center" = "left") => !l.label ? "" : `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="${align}" style="margin:10px ${align === "center" ? "auto" : "0"} 0">
  <tr><td bgcolor="${BRAND.red}" style="border-radius:2px">
    <a href="${esc(safeUrl(l.url))}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:15px;font-weight:bold;letter-spacing:.3px;color:#ffffff;text-decoration:none;border-radius:2px">${esc(l.label)}</a>
  </td></tr>
</table>`;

type R = { preview: boolean; origin?: string; lang: string };

/** In the preview a missing picture shows as a quiet box saying so; in the e-mail it is left out. */
const image = (url: string, alt: string, r: R, width = 600, height = 260) =>
  url ? `<img src="${esc(pictureUrl(url, r.origin))}" width="${width}" alt="${esc(alt)}" style="display:block;width:100%;max-width:${width}px;height:auto;border:0">`
    : r.preview ? `<div style="height:${height}px;background:repeating-linear-gradient(135deg,#f4f6f7 0 12px,#eceff1 12px 24px);border:1px dashed #c3ccd1;box-sizing:border-box;display:flex;align-items:center;justify-content:center;font-family:${FONT};font-size:13px;color:${BRAND.muted}">Picture to add</div>` : "";

const row = (inner: string, pad = "28px 40px", bg = "#ffffff") =>
  `<tr><td class="px" style="padding:${pad};background:${bg}">${inner}</td></tr>`;

const ghost = (r: R, s: string) => (r.preview ? `<span style="color:#9aa4ab">${s}</span>` : "");

function blockHtml(b: Block, r: R): string {
  const w = wordsOf(r.lang);
  switch (b.kind) {
    case "header":
      return `<tr><td style="background:${BRAND.red};height:4px;line-height:4px;font-size:0">&nbsp;</td></tr>` + row(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="font-family:${FONT};font-size:26px;font-weight:bold;letter-spacing:-.5px;color:${BRAND.red}">${b.logoUrl ? `<img src="${esc(pictureUrl(b.logoUrl, r.origin))}" height="34" alt="APSOparts" style="display:block;height:34px;width:auto;border:0">` : `APSO<span style="color:${BRAND.ink}">parts</span>`}</td>
        <td align="right" style="font-family:${FONT};font-size:13px;color:${BRAND.muted}">${esc(b.tagline)}<br><a href="{{ view_as_page_url }}" style="font-size:11px;color:#9aa4ab;text-decoration:underline">${esc(w.browser)}</a></td></tr></table>`, "22px 40px", "#ffffff");
    case "hero":
      return `${b.imageUrl || r.preview ? `<tr><td>${image(b.imageUrl, b.imageAlt, r, 600, 300)}</td></tr>` : ""}` + row(
        `${b.eyebrow ? `<div style="font-family:${FONT};font-size:12px;font-weight:bold;letter-spacing:1.6px;text-transform:uppercase;color:${BRAND.red};margin:0 0 12px"><span style="display:inline-block;width:26px;height:3px;background:${BRAND.red};vertical-align:middle;margin-right:10px"></span>${esc(b.eyebrow)}</div>` : ""}
        <h1 style="margin:0 0 16px;font-family:${FONT};font-size:30px;line-height:36px;font-weight:bold;color:${BRAND.ink}">${esc(b.headline) || ghost(r, "The headline")}</h1>
        ${richText(b.text)}${button(b.button)}`, "34px 40px 38px");
    case "article": {
      const title = `<h2 style="margin:0 0 10px;font-family:${FONT};font-size:20px;line-height:26px;font-weight:bold;color:${BRAND.ink}">${esc(b.title) || ghost(r, "A story")}</h2>`;
      const link = b.link.label ? `<a href="${esc(safeUrl(b.link.url))}" style="font-family:${FONT};font-size:15px;font-weight:bold;color:${BRAND.red};text-decoration:none">${esc(b.link.label)} &rarr;</a>` : "";
      const pic = b.imageUrl || r.preview;
      if (b.layout === "left" || b.layout === "right") {
        const picCell = pic ? `<td class="col" valign="top" width="200" style="width:200px;padding:0 ${b.layout === "left" ? "24px" : "0"} 0 ${b.layout === "right" ? "24px" : "0"}">${image(b.imageUrl, b.imageAlt, r, 200, 200)}</td>` : "";
        const textCell = `<td class="col" valign="top" style="padding:0">${title}${richText(b.text, BRAND.ink, 15, 23)}${link}</td>`;
        return row(`<table role="presentation" class="stack" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${b.layout === "left" ? picCell + textCell : textCell + picCell}</tr></table>`, "14px 40px 26px");
      }
      return row(`${pic ? `<div style="margin:0 0 18px">${image(b.imageUrl, b.imageAlt, r, 520, 260)}</div>` : ""}${title}${richText(b.text)}${link}`, "14px 40px 30px");
    }
    case "products": {
      const items = b.items.filter((x) => x.name || r.preview).slice(0, 3);
      const wd = Math.floor(100 / Math.max(1, items.length));
      return row(`${b.title ? `<h2 style="margin:0 0 18px;font-family:${FONT};font-size:20px;font-weight:bold;color:${BRAND.ink}">${esc(b.title)}</h2>` : ""}
        <table role="presentation" class="stack" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${items.map((x) => `
          <td class="col" valign="top" width="${wd}%" style="padding:0 8px 16px">
            <div style="border:1px solid ${BRAND.line};padding:10px;background:#ffffff">${image(x.imageUrl, x.name, r, 160, 150)}</div>
            <div style="font-family:${FONT};font-size:15px;font-weight:bold;color:${BRAND.ink};margin:12px 0 4px">${esc(x.name) || ghost(r, "A product")}</div>
            <div style="font-family:${FONT};font-size:14px;line-height:20px;color:${BRAND.muted};margin:0 0 6px">${esc(x.text)}</div>
            ${x.url ? `<a href="${esc(safeUrl(x.url))}" style="font-family:${FONT};font-size:14px;font-weight:bold;color:${BRAND.red};text-decoration:none">${esc(w.view)} &rarr;</a>` : ""}
          </td>`).join("")}</tr></table>`, "14px 32px 22px");
    }
    case "banner":
      return b.imageUrl || r.preview ? `<tr><td style="padding:0">${b.url && b.imageUrl ? `<a href="${esc(safeUrl(b.url))}">` : ""}${image(b.imageUrl, b.imageAlt, r, 600, 220)}${b.url && b.imageUrl ? "</a>" : ""}</td></tr>` : "";
    case "text":
      return row(richText(b.text) || (r.preview ? `<p style="margin:0;font-family:${FONT};color:#9aa4ab">Some text</p>` : ""), "14px 40px 20px");
    case "facts": {
      const items = b.items.filter((x) => x.big || x.label).slice(0, 3);
      if (!items.length) return "";
      return row(`<table role="presentation" class="stack" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${items.map((x, i) => `
        <td class="col" valign="top" width="${Math.floor(100 / items.length)}%" style="padding:4px 12px;${i ? "border-left:1px solid rgba(255,255,255,.18);" : ""}">
          <div style="font-family:${FONT};font-size:26px;line-height:32px;font-weight:bold;color:#ffffff">${esc(x.big)}</div>
          <div style="font-family:${FONT};font-size:13px;line-height:19px;color:#c9dbe4;margin-top:4px">${esc(x.label)}</div>
        </td>`).join("")}</tr></table>`, "30px 28px", BRAND.petrol);
    }
    case "cta":
      return row(`<div style="text-align:center">${b.text ? `<p style="margin:0 0 6px;font-family:${FONT};font-size:20px;line-height:28px;font-weight:bold;color:${BRAND.ink}">${esc(b.text)}</p>` : ""}${button(b.button, "center")}</div>`, "36px 40px 38px", BRAND.pale);
    case "divider":
      return `<tr><td style="padding:10px 40px;background:#ffffff"><div style="border-top:1px solid ${BRAND.line};font-size:0;line-height:0">&nbsp;</div></td></tr>`;
    case "footer":
      return `<tr><td class="px" style="padding:30px 40px 36px;background:#ffffff;border-top:1px solid ${BRAND.line};font-family:${FONT};font-size:12px;line-height:18px;color:${BRAND.muted};text-align:center">
        <div style="font-size:16px;font-weight:bold;color:${BRAND.red};margin:0 0 10px">APSO<span style="color:${BRAND.ink}">parts</span></div>${esc(b.text)}<br><br>
        <a href="{{ unsubscribe_link }}" style="color:${BRAND.muted};text-decoration:underline">${esc(w.unsubscribe)}</a> &middot; <a href="https://www.apsoparts.com" style="color:${BRAND.muted};text-decoration:underline">apsoparts.com</a></td></tr>`;
  }
}

/**
 * The newsletter as e-mail HTML. `preview` shows where pictures and words are still missing (never in the real e-mail),
 * and marks each block so a click in the preview picks it (`selected` is outlined); `origin` is the hub's address, for
 * the pictures kept in it. The unsubscribe link carries HubSpot's own token, filled in by HubSpot when it sends.
 */
export function renderEmail(docIn: unknown, opts: { preview?: boolean; origin?: string; selected?: string | null } = {}): string {
  const d = asNewsletter(docIn);
  const r: R = { preview: !!opts.preview, origin: opts.origin, lang: d.language };
  const lang = (d.language || "en").toLowerCase();
  const body = d.blocks.map((b) => {
    const h = blockHtml(b, r);
    // in the preview each block is its own row, to point at and to click
    return r.preview && h ? `<tr><td data-block="${esc(b.id)}" class="blk${opts.selected === b.id ? " sel" : ""}" style="padding:0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${h}</table></td></tr>` : h;
  }).join("\n");
  return `<!doctype html>
<html lang="${esc(lang)}" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${esc(d.subject)}</title>
<style>
  body { margin:0; padding:0; background:${BRAND.page}; }
  img { -ms-interpolation-mode:bicubic; }
  @media (max-width: 620px) {
    .w { width:100% !important; }
    .px { padding-left:22px !important; padding-right:22px !important; }
    .stack td.col { display:block !important; width:100% !important; box-sizing:border-box; padding:0 0 16px !important; border-left:0 !important; }
    h1 { font-size:25px !important; line-height:31px !important; }
  }${r.preview ? `
  .blk { cursor:pointer; position:relative; outline:2px solid transparent; outline-offset:-2px; transition:outline-color .12s; }
  .blk:hover { outline:2px dashed rgba(36,89,209,.55); }
  .blk.sel { outline:2px solid #2459d1; }
  a { pointer-events:none; }` : ""}
</style>
</head>
<body style="margin:0;padding:0;background:${BRAND.page}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(d.preheader)}${"&nbsp;&zwnj;".repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.page}">
  <tr><td align="center" style="padding:28px 12px">
    <table role="presentation" class="w" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#ffffff">
${body}
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/** The newsletter's words, plain - for the version, the library and the search. */
export function newsletterText(doc: unknown): string {
  const d = asNewsletter(doc);
  const out: string[] = [`Subject: ${d.subject}`, `Preheader: ${d.preheader}`, ""];
  for (const b of d.blocks) {
    if (b.kind === "hero") out.push(b.eyebrow, b.headline, b.text, b.button.label ? `[${b.button.label}]` : "", "");
    else if (b.kind === "article") out.push(b.title, b.text, b.link.label ? `[${b.link.label}]` : "", "");
    else if (b.kind === "products") out.push(b.title, ...b.items.filter((x) => x.name).map((x) => `- ${x.name}: ${x.text}`), "");
    else if (b.kind === "text") out.push(b.text, "");
    else if (b.kind === "facts") out.push(...b.items.filter((x) => x.big || x.label).map((x) => `${x.big} ${x.label}`), "");
    else if (b.kind === "cta") out.push(b.text, b.button.label ? `[${b.button.label}]` : "", "");
  }
  return out.filter((x, i, a) => x !== "" || a[i - 1] !== "").join("\n").trim();
}

export type Check = { level: "warn" | "bad"; text: string };

/** Every picture of the newsletter that lives in the hub. */
export function hubPictures(doc: unknown): string[] {
  const d = asNewsletter(doc);
  const urls = d.blocks.flatMap((b) => (b.kind === "products" ? b.items.map((x) => x.imageUrl) : "imageUrl" in b ? [b.imageUrl] : b.kind === "header" ? [b.logoUrl] : []));
  return urls.filter((u) => u && u.startsWith("/api/content/picture/"));
}

/** What a sender should fix before it goes out. */
export function checks(doc: unknown): Check[] {
  const d = asNewsletter(doc);
  const out: Check[] = [];
  if (!d.subject.trim()) out.push({ level: "bad", text: "No subject yet." });
  else if (d.subject.length > SUBJECT_MAX) out.push({ level: "warn", text: `The subject is ${d.subject.length - SUBJECT_MAX} characters too long for most inboxes.` });
  if (!d.preheader.trim()) out.push({ level: "warn", text: "No preheader - the inbox shows the first words of the e-mail instead." });
  else if (d.preheader.length > PREHEADER_MAX) out.push({ level: "warn", text: `The preheader is ${d.preheader.length - PREHEADER_MAX} characters too long.` });
  else if (d.subject && d.preheader.toLowerCase().startsWith(d.subject.toLowerCase().slice(0, 20))) out.push({ level: "warn", text: "The preheader repeats the subject." });
  const pics = d.blocks.flatMap((b) => (b.kind === "hero" || b.kind === "article" || b.kind === "banner" ? [b] : []));
  if (pics.some((b) => b.imageUrl && !b.imageAlt)) out.push({ level: "warn", text: "A picture has no alternative text (many inboxes block pictures at first)." });
  if (!d.blocks.some((b) => b.kind === "footer")) out.push({ level: "bad", text: "No footer - a newsletter must carry the unsubscribe link." });
  const links = d.blocks.flatMap((b) => (b.kind === "hero" || b.kind === "cta" ? [b.button] : b.kind === "article" ? [b.link] : []));
  if (links.some((l) => l.label && safeUrl(l.url) === "#")) out.push({ level: "bad", text: "A button or link has no valid address." });
  if (/\b\d{1,2}\s?%/.test(newsletterText(d)) && /(rabatt|discount|remise|sconto|off)\b/i.test(newsletterText(d))) out.push({ level: "bad", text: "A discount value is named - we never show one." });
  // the brand's rules, as the blog checks them: never Chemours; chemical compatibility only with its line
  for (const w of brandWarnings(newsletterText(d))) if (!/discount/.test(w)) out.push({ level: /Chemours/.test(w) ? "bad" : "warn", text: w });
  return out;
}

/** The draft's answer laid into the document: words into the blocks, pictures and addresses kept; picture ideas noted. */
export type DraftAnswer = {
  subject: string; preheader: string; eyebrow: string; headline: string; lead: string; button: string; picture?: string;
  stories: { title: string; text: string; link: string; picture?: string }[]; intro?: string; cta: string; ctaButton: string;
};

export function applyDraft(docIn: unknown, a: DraftAnswer): NewsletterDoc {
  const d = asNewsletter(docIn);
  let story = 0;
  let wroteText = false;
  const blocks: Block[] = d.blocks.map((b) => {
    if (b.kind === "hero") return { ...b, eyebrow: a.eyebrow || b.eyebrow, headline: a.headline || b.headline, text: a.lead || b.text, button: { ...b.button, label: a.button || b.button.label }, imagePrompt: a.picture || b.imagePrompt };
    if (b.kind === "article" && a.stories[story]) { const x = a.stories[story++]; return { ...b, title: x.title, text: x.text, link: { ...b.link, label: x.link || b.link.label }, imagePrompt: x.picture || b.imagePrompt }; }
    if (b.kind === "text" && a.intro && !wroteText) { wroteText = true; return { ...b, text: a.intro }; }
    if (b.kind === "banner" && a.picture && !b.imagePrompt) return { ...b, imagePrompt: a.picture };
    if (b.kind === "cta") return { ...b, text: a.cta || b.text, button: { ...b.button, label: a.ctaButton || b.button.label } };
    return b;
  });
  return { ...d, subject: a.subject || d.subject, preheader: a.preheader || d.preheader, blocks };
}

/** "YYYY-MM-DD" as "Thu 3 Dec 2026". */
export function sendDay(iso: string | null | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`)).replace(",", "");
}
