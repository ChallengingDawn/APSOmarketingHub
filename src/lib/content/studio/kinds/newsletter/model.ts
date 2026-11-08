// NEWSLETTER - THE STUDIO'S DOCUMENT AND ITS E-MAIL (SARCLA 08.11.2026: "newsletter - learn from our newsletters in HS
// and here you should be able to build our newsletter, push to HubSpot, plan to send; everything on the content calendar").
//
// A newsletter is a subject, a preheader and blocks (header, hero, articles, products, banner, text, call to action,
// divider, footer). renderEmail turns it into e-mail HTML that survives Outlook and phones: tables, inline styles, a
// 600 px column, a bulletproof button, the preheader hidden at the top - no script, no web font, no CSS grid.
// Pure and shared with the browser (relative imports only): tests/studio-newsletter.test.ts.

export type Link = { label: string; url: string };
export type Block =
  | { id: string; kind: "header"; tagline: string; logoUrl: string }
  | { id: string; kind: "hero"; eyebrow: string; headline: string; text: string; imageUrl: string; imageAlt: string; button: Link }
  | { id: string; kind: "article"; title: string; text: string; imageUrl: string; imageAlt: string; link: Link }
  | { id: string; kind: "products"; title: string; items: { name: string; text: string; imageUrl: string; url: string }[] }
  | { id: string; kind: "banner"; imageUrl: string; imageAlt: string; url: string }
  | { id: string; kind: "text"; text: string }
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
  /** What happened in HubSpot - set by the server action, shown in the studio. */
  hubspot?: { emailId?: string; url?: string; state?: string; at?: string };
};

export const SUBJECT_MAX = 55;
export const PREHEADER_MAX = 90;

export const BLOCK_LABEL: Record<BlockKind, string> = {
  header: "Header", hero: "Lead story", article: "Story", products: "Products", banner: "Banner", text: "Text",
  cta: "Call to action", divider: "Divider", footer: "Footer",
};

let seq = 0;
const rid = () => `b${Date.now().toString(36)}${(seq++).toString(36)}`;

/** A new block of a kind, with empty fields (and an id). */
export function newBlock(kind: BlockKind, id = rid()): Block {
  switch (kind) {
    case "header": return { id, kind, tagline: "Technical parts, delivered", logoUrl: "" };
    case "hero": return { id, kind, eyebrow: "", headline: "", text: "", imageUrl: "", imageAlt: "", button: { label: "Discover more", url: "https://www.apsoparts.com" } };
    case "article": return { id, kind, title: "", text: "", imageUrl: "", imageAlt: "", link: { label: "Read more", url: "https://www.apsoparts.com" } };
    case "products": return { id, kind, title: "", items: [{ name: "", text: "", imageUrl: "", url: "" }, { name: "", text: "", imageUrl: "", url: "" }, { name: "", text: "", imageUrl: "", url: "" }] };
    case "banner": return { id, kind, imageUrl: "", imageAlt: "", url: "" };
    case "text": return { id, kind, text: "" };
    case "cta": return { id, kind, text: "", button: { label: "Order on apsoparts.com", url: "https://www.apsoparts.com" } };
    case "divider": return { id, kind };
    case "footer": return { id, kind, text: "APSOparts - Angst+Pfister. You receive this newsletter because you subscribed on apsoparts.com." };
  }
}

/** The newsletter a to-do starts with: the usual shape, its words still to write. */
export function emptyNewsletter(language = "EN"): NewsletterDoc {
  return {
    v: 1, subject: "", preheader: "", fromName: "APSOparts", language,
    blocks: [newBlock("header", "header"), newBlock("hero", "hero"), newBlock("article", "story1"), newBlock("article", "story2"), newBlock("cta", "cta"), newBlock("footer", "footer")],
  };
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
    hubspot: isObj(d.hubspot) ? (d.hubspot as NewsletterDoc["hubspot"]) : undefined,
  };
}

/* ── the e-mail ─────────────────────────────────────────────────────────────────────────────────────────────────── */

export const BRAND = { petrol: "#274e64", red: "#d80901", ink: "#1d2326", muted: "#5b6670", line: "#e3e8ec", page: "#f4f6f8", pale: "#e6eef2" };
const FONT = "Arial, Helvetica, sans-serif";

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** A link the e-mail may carry: http(s) or mailto, or HubSpot's own tokens; anything else becomes "#". */
export const safeUrl = (u: string) => {
  const t = (u ?? "").trim();
  return /^(https?:\/\/|mailto:)/i.test(t) || /^\{\{\s*[\w.]+\s*\}\}$/.test(t) ? t : "#";
};

/** Light text formatting: **bold**, [label](url), blank line = new paragraph. Everything else is escaped. */
export function richText(text: string, color: string = BRAND.ink): string {
  const paras = (text ?? "").trim().split(/\n{2,}/).filter(Boolean);
  return paras.map((p) => {
    let h = esc(p);
    h = h.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    h = h.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, url: string) => `<a href="${esc(safeUrl(url.replace(/&amp;/g, "&")))}" style="color:${BRAND.petrol};text-decoration:underline">${label}</a>`);
    h = h.replace(/\n/g, "<br>");
    return `<p style="margin:0 0 14px;font-family:${FONT};font-size:16px;line-height:24px;color:${color}">${h}</p>`;
  }).join("");
}

const button = (l: Link, align: "left" | "center" = "left") => !l.label ? "" : `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="${align}" style="margin:8px ${align === "center" ? "auto" : "0"} 0">
  <tr><td bgcolor="${BRAND.red}" style="border-radius:6px">
    <a href="${esc(safeUrl(l.url))}" target="_blank" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:6px">${esc(l.label)}</a>
  </td></tr>
</table>`;

/** In the preview a missing picture shows as a grey box saying so; in the e-mail it is left out. */
const image = (url: string, alt: string, preview: boolean, width = 600, height = 260) =>
  url ? `<img src="${esc(safeUrl(url))}" width="${width}" alt="${esc(alt)}" style="display:block;width:100%;max-width:${width}px;height:auto;border:0">`
    : preview ? `<div style="height:${height}px;background:${BRAND.pale};display:flex;align-items:center;justify-content:center;font-family:${FONT};font-size:13px;color:${BRAND.muted}">Picture to add</div>` : "";

const row = (inner: string, pad = "28px 40px", bg = "#ffffff") =>
  `<tr><td class="px" style="padding:${pad};background:${bg}">${inner}</td></tr>`;

function blockHtml(b: Block, preview: boolean): string {
  switch (b.kind) {
    case "header":
      return row(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="font-family:${FONT};font-size:24px;font-weight:bold;color:${BRAND.petrol}">${b.logoUrl ? `<img src="${esc(safeUrl(b.logoUrl))}" height="32" alt="APSOparts" style="display:block;height:32px;border:0">` : "APSOparts"}</td>
        <td align="right" style="font-family:${FONT};font-size:13px;color:${BRAND.muted}">${esc(b.tagline)}</td></tr></table>`, "22px 40px", "#ffffff");
    case "hero":
      return `${b.imageUrl || preview ? `<tr><td>${image(b.imageUrl, b.imageAlt, preview, 600, 280)}</td></tr>` : ""}` + row(
        `${b.eyebrow ? `<div style="font-family:${FONT};font-size:13px;font-weight:bold;color:${BRAND.red};margin:0 0 10px"><span style="display:inline-block;width:26px;height:3px;background:${BRAND.red};vertical-align:middle;margin-right:8px"></span>${esc(b.eyebrow)}</div>` : ""}
        <h1 style="margin:0 0 14px;font-family:${FONT};font-size:30px;line-height:36px;font-weight:bold;color:${BRAND.ink}">${esc(b.headline) || (preview ? `<span style="color:${BRAND.muted}">The headline</span>` : "")}</h1>
        ${richText(b.text)}${button(b.button)}`, "30px 40px 34px");
    case "article":
      return row(`${b.imageUrl || preview ? `<div style="margin:0 0 16px">${image(b.imageUrl, b.imageAlt, preview, 520, 200)}</div>` : ""}
        <h2 style="margin:0 0 10px;font-family:${FONT};font-size:21px;line-height:27px;font-weight:bold;color:${BRAND.ink}">${esc(b.title) || (preview ? `<span style="color:${BRAND.muted}">A story</span>` : "")}</h2>
        ${richText(b.text)}${b.link.label ? `<a href="${esc(safeUrl(b.link.url))}" style="font-family:${FONT};font-size:15px;font-weight:bold;color:${BRAND.petrol};text-decoration:none">${esc(b.link.label)} &rarr;</a>` : ""}`, "8px 40px 28px");
    case "products": {
      const items = b.items.filter((x) => x.name || preview).slice(0, 3);
      const w = Math.floor(100 / Math.max(1, items.length));
      return row(`${b.title ? `<h2 style="margin:0 0 16px;font-family:${FONT};font-size:21px;font-weight:bold;color:${BRAND.ink}">${esc(b.title)}</h2>` : ""}
        <table role="presentation" class="stack" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${items.map((x) => `
          <td valign="top" width="${w}%" style="padding:0 8px 16px">
            ${image(x.imageUrl, x.name, preview, 160, 120)}
            <div style="font-family:${FONT};font-size:15px;font-weight:bold;color:${BRAND.ink};margin:10px 0 4px">${esc(x.name) || (preview ? "A product" : "")}</div>
            <div style="font-family:${FONT};font-size:14px;line-height:20px;color:${BRAND.muted}">${esc(x.text)}</div>
            ${x.url ? `<a href="${esc(safeUrl(x.url))}" style="font-family:${FONT};font-size:14px;font-weight:bold;color:${BRAND.petrol};text-decoration:none">View &rarr;</a>` : ""}
          </td>`).join("")}</tr></table>`, "8px 32px 20px");
    }
    case "banner":
      return b.imageUrl || preview ? `<tr><td style="padding:0 0 8px">${b.url && b.imageUrl ? `<a href="${esc(safeUrl(b.url))}">` : ""}${image(b.imageUrl, b.imageAlt, preview, 600, 180)}${b.url && b.imageUrl ? "</a>" : ""}</td></tr>` : "";
    case "text":
      return row(richText(b.text) || (preview ? `<p style="font-family:${FONT};color:${BRAND.muted}">Some text</p>` : ""), "8px 40px 20px");
    case "cta":
      return row(`<div style="text-align:center">${b.text ? `<p style="margin:0 0 14px;font-family:${FONT};font-size:18px;line-height:26px;font-weight:bold;color:${BRAND.ink}">${esc(b.text)}</p>` : ""}${button(b.button, "center")}</div>`, "30px 40px", BRAND.pale);
    case "divider":
      return `<tr><td style="padding:8px 40px;background:#ffffff"><div style="border-top:1px solid ${BRAND.line};font-size:0;line-height:0">&nbsp;</div></td></tr>`;
    case "footer":
      return `<tr><td class="px" style="padding:26px 40px 34px;font-family:${FONT};font-size:12px;line-height:18px;color:${BRAND.muted};text-align:center">${esc(b.text)}<br><br>
        <a href="{{ unsubscribe_link }}" style="color:${BRAND.muted};text-decoration:underline">Unsubscribe</a> &middot; <a href="https://www.apsoparts.com" style="color:${BRAND.muted};text-decoration:underline">apsoparts.com</a></td></tr>`;
  }
}

/**
 * The newsletter as e-mail HTML. `preview` shows where pictures and words are still missing (never in the real e-mail);
 * the unsubscribe link carries HubSpot's own token, filled in by HubSpot when it sends.
 */
export function renderEmail(docIn: unknown, opts: { preview?: boolean } = {}): string {
  const d = asNewsletter(docIn);
  const preview = !!opts.preview;
  const lang = (d.language || "en").toLowerCase();
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
    .stack td { display:block !important; width:100% !important; box-sizing:border-box; }
    h1 { font-size:25px !important; line-height:31px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${BRAND.page}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(d.preheader)}${"&nbsp;&zwnj;".repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.page}">
  <tr><td align="center" style="padding:24px 12px">
    <table role="presentation" class="w" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:10px;overflow:hidden">
${d.blocks.map((b) => blockHtml(b, preview)).join("\n")}
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
    else if (b.kind === "cta") out.push(b.text, b.button.label ? `[${b.button.label}]` : "", "");
  }
  return out.filter((x, i, a) => x !== "" || a[i - 1] !== "").join("\n").trim();
}

export type Check = { level: "warn" | "bad"; text: string };

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
  return out;
}

/** The draft's answer laid into the document: words into the blocks, pictures and addresses kept. */
export type DraftAnswer = { subject: string; preheader: string; eyebrow: string; headline: string; lead: string; button: string; stories: { title: string; text: string; link: string }[]; cta: string; ctaButton: string };

export function applyDraft(docIn: unknown, a: DraftAnswer): NewsletterDoc {
  const d = asNewsletter(docIn);
  let story = 0;
  const blocks: Block[] = d.blocks.map((b) => {
    if (b.kind === "hero") return { ...b, eyebrow: a.eyebrow || b.eyebrow, headline: a.headline || b.headline, text: a.lead || b.text, button: { ...b.button, label: a.button || b.button.label } };
    if (b.kind === "article" && a.stories[story]) { const x = a.stories[story++]; return { ...b, title: x.title, text: x.text, link: { ...b.link, label: x.link || b.link.label } }; }
    if (b.kind === "cta") return { ...b, text: a.cta || b.text, button: { ...b.button, label: a.ctaButton || b.button.label } };
    return b;
  });
  return { ...d, subject: a.subject || d.subject, preheader: a.preheader || d.preheader, blocks };
}
