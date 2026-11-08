// OUR E-MAILS IN HUBSPOT, READ - the pure part of hubspotEmails.ts (relative imports only, shared with the tests):
// grouping the e-mails we sent by campaign, reading one e-mail's parts in the order it shows, turning them into the
// studio's blocks, and its words in short for the assistant. tests/newsletter-our-emails.test.ts.

import type { Block, NewsletterDoc } from "./model";

export type RawEmail = {
  id: string | number; name?: string; subject?: string; language?: string; type?: string; state?: string; publishDate?: string;
  stats?: { counters?: { sent?: number; delivered?: number; open?: number; click?: number } };
  webversion?: { url?: string; enabled?: boolean };
};
export type EmailVariant = {
  id: string; language: string; subject: string; date: string; sent: number;
  /** null when the e-mail's opens are not tracked (FR and IT show 0 opens on thousands sent) */
  openRate: number | null; clickRate: number | null; webUrl: string | null;
};
export type EmailGroup = { key: string; label: string; kind: "campaign" | "survey" | "other"; date: string; variants: EmailVariant[] };

const LANG = /^(DE|EN|FR|IT|NL|PL|ES)_/i;
const keyOf = (name: string) => name.replace(LANG, "").trim().toLowerCase();
const kindOf = (e: RawEmail): EmailGroup["kind"] =>
  /FEEDBACK|SURVEY/i.test(e.type ?? "") ? "survey" : LANG.test(e.name ?? "") && !/REDIRECTION|ESO_Change|Address_Change/i.test(e.name ?? "") ? "campaign" : "other";
const sentState = (s?: string) => s === "PUBLISHED" || s === "AUTOMATED";
const ORDER = ["EN", "DE", "FR", "IT", "NL", "PL", "ES"];

/** The e-mails we sent (drafts and never-sent ones left out), one group per campaign across its languages, newest first. */
export function groupEmails(rows: RawEmail[]): EmailGroup[] {
  const groups = new Map<string, EmailGroup>();
  for (const e of rows) {
    if (!sentState(e.state) || !e.publishDate || !e.subject) continue;
    const c = e.stats?.counters ?? {};
    const sent = c.sent ?? c.delivered ?? 0;
    const base = c.delivered || sent;
    const tracked = !(sent > 50 && !c.open && !c.click);
    const v: EmailVariant = {
      id: String(e.id), language: (e.language ?? "").toUpperCase().slice(0, 2) || (LANG.exec(e.name ?? "")?.[1] ?? "").toUpperCase(),
      subject: e.subject, date: e.publishDate.slice(0, 10), sent,
      openRate: tracked && base ? (c.open ?? 0) / base : null, clickRate: tracked && base ? (c.click ?? 0) / base : null,
      webUrl: e.webversion?.enabled !== false ? e.webversion?.url ?? null : null,
    };
    // the e-mail's own language when its name says it (DE_..., FR_...) - HubSpot marks some e-mails "en" whatever they are
    const named = LANG.exec(e.name ?? "")?.[1]?.toUpperCase();
    if (named) v.language = named;
    const key = keyOf(e.name ?? e.subject);
    const g = groups.get(key);
    if (g) { g.variants.push(v); if (v.date > g.date) g.date = v.date; }
    else groups.set(key, { key, label: e.subject, kind: kindOf(e), date: v.date, variants: [v] });
  }
  return [...groups.values()].map((g) => {
    g.variants.sort((a, b) => ORDER.indexOf(a.language) - ORDER.indexOf(b.language));
    // named by its English subject when there is one - the language everyone here reads
    g.label = (g.variants.find((v) => v.language === "EN") ?? g.variants[0]).subject;
    return g;
  }).sort((a, b) => b.date.localeCompare(a.date));
}

export type EmailPart =
  | { kind: "text"; widget: string; html: string; text: string }
  | { kind: "image"; widget: string; src: string; alt: string; url: string }
  | { kind: "button"; widget: string; text: string; url: string }
  | { kind: "divider"; widget: string }
  | { kind: "chrome"; widget: string; module: string };

export type RawEmailFull = {
  id: string | number; name?: string; subject?: string; language?: string;
  content?: { widgets?: Record<string, { type?: string; body?: Record<string, unknown> }>; flexAreas?: { main?: { sections?: { columns?: { widgets?: string[] }[] }[] } } };
};
export type ReadEmail = { id: string; subject: string; preheader: string; language: string; name: string; parts: EmailPart[] };

const plain = (html: string) => html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|h\d|li|div)>/gi, "\n").replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&rsquo;/g, "'")
  .replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();

/** One e-mail (HubSpot's drag-and-drop shape), read in the order it shows. */
export function readEmail(e: RawEmailFull): ReadEmail {
  const widgets = e.content?.widgets ?? {};
  const order = (e.content?.flexAreas?.main?.sections ?? []).flatMap((s) => (s.columns ?? []).flatMap((c) => c.widgets ?? []));
  const parts: EmailPart[] = [];
  for (const wid of order) {
    const b = widgets[wid]?.body ?? {};
    const path = String(b.path ?? b.module_id ?? "");
    const html = typeof b.html === "string" ? b.html : "";
    const img = (b.img ?? null) as { src?: string; alt?: string } | null;
    const link = (b.link ?? null) as { url?: { href?: string } } | null;
    if (/button_email/.test(path)) parts.push({ kind: "button", widget: wid, text: String(b.text ?? ""), url: String(b.destination ?? "") });
    else if (img?.src) parts.push({ kind: "image", widget: wid, src: img.src, alt: img.alt ?? "", url: link?.url?.href ?? "" });
    else if (html && !/email_footer|web_version|follow_me/.test(path)) parts.push({ kind: "text", widget: wid, html, text: plain(html) });
    else if (/divider|spacer/.test(path) || (b.style && !html && !img)) parts.push({ kind: "divider", widget: wid });
    else parts.push({ kind: "chrome", widget: wid, module: path });
  }
  const pre = widgets.preview_text?.body?.value;
  return { id: String(e.id), subject: e.subject ?? "", preheader: typeof pre === "string" ? pre : "", language: (e.language ?? "en").toUpperCase().slice(0, 2), name: e.name ?? "", parts };
}

let seq = 0;
const nid = () => `h${Date.now().toString(36)}${(seq++).toString(36)}`;
/** A text's first line as a title when it reads like one (short, no full stop), the rest as the text. */
function split(text: string): { title: string; rest: string } {
  const [first, ...more] = text.split("\n").map((x) => x.trim()).filter(Boolean);
  if (first && first.length <= 90 && !/[.:]$/.test(first) && more.length) return { title: first, rest: more.join("\n\n") };
  return { title: "", rest: text };
}

/** The e-mail as the studio's blocks: the first picture with its words a hero, each picture + words a story, a button
 *  on the block above it, words alone a text block; the greeting ("{{ contact.lastname }}") opens the lead story's text,
 *  HubSpot's tokens kept; the footer ours. */
export function blocksFrom(parts: EmailPart[], subject = ""): Block[] {
  const out: Block[] = [];
  // a short line alone ("From your order document to your cart in 3 steps") titles the story under it
  let heading: string | null = null;
  let headingWidget: string | undefined;
  const isHeading = (t: string) => t.length <= 80 && !t.includes("\n") && !/[.!]$/.test(t) && !/\{\{/.test(t);
  const flushHeading = () => { if (heading) { out.push({ id: nid(), kind: "text", text: heading, hs: { text: headingWidget, was: heading } }); heading = null; } };
  const body = parts.filter((p) => p.kind !== "chrome");
  let pendingImage: Extract<EmailPart, { kind: "image" }> | null = null;
  let greeting: string | null = null;
  const lastWithLink = () => [...out].reverse().find((b) => b.kind === "hero" || b.kind === "article");
  for (const p of body) {
    if (p.kind === "image") {
      if (pendingImage) out.push({ id: nid(), kind: "banner", imageUrl: pendingImage.src, imageAlt: pendingImage.alt, url: pendingImage.url, hs: { image: pendingImage.widget } });
      pendingImage = p;
      continue;
    }
    if (p.kind === "text") {
      if (!p.text) continue;
      // the greeting between the header picture and the first words waits for the lead story
      if (pendingImage && !out.some((b) => b.kind === "hero") && /\{\{\s*contact\./.test(p.text) && p.text.length < 140) { greeting = p.text; continue; }
      const w = p.widget;
      if (isHeading(p.text) && out.some((b) => b.kind === "hero")) { flushHeading(); heading = p.text; headingWidget = p.widget; continue; }
      const { title, rest } = split(p.text);
      if (pendingImage) {
        const img = pendingImage;
        pendingImage = null;
        if (!out.some((b) => b.kind === "hero")) {
          // no short first line to be its headline: the e-mail's subject is (the header picture carries its own)
          const text = [greeting, title ? rest : p.text].filter(Boolean).join("\n\n");
          greeting = null;
          out.push({ id: nid(), kind: "hero", eyebrow: "", headline: title || subject || rest.slice(0, 70), text, imageUrl: img.src, imageAlt: img.alt, button: { label: "", url: "" },
            hs: { image: img.widget, text: w, title: title ? w : undefined, was: [title, title ? rest : p.text].filter(Boolean).join("\n") } });
        } else {
          out.push({ id: nid(), kind: "article", title: title || heading || "", text: rest, imageUrl: img.src, imageAlt: img.alt, link: { label: "", url: "" }, layout: "stacked",
            hs: { image: img.widget, text: w, title: title ? w : heading ? headingWidget : undefined, was: [title || heading || "", rest].filter(Boolean).join("\n") } });
          if (!title) heading = null;
        }
      } else if (title && rest.length > 60) {
        flushHeading();
        out.push({ id: nid(), kind: "article", title, text: rest, imageUrl: "", imageAlt: "", link: { label: "", url: "" }, layout: "stacked", hs: { text: w, title: w, was: `${title}\n${rest}` } });
      } else if (heading) {
        out.push({ id: nid(), kind: "article", title: heading, text: p.text, imageUrl: "", imageAlt: "", link: { label: "", url: "" }, layout: "stacked", hs: { text: w, title: headingWidget, was: `${heading}\n${p.text}` } });
        heading = null;
      } else {
        out.push({ id: nid(), kind: "text", text: p.text, hs: { text: w, was: p.text } });
      }
      continue;
    }
    if (p.kind === "button") {
      flushHeading();
      const host = lastWithLink();
      if (host && host.kind === "hero" && !host.button.url) { host.button = { label: p.text, url: p.url }; host.hs = { ...host.hs, button: p.widget }; }
      else if (host && host.kind === "article" && !host.link.url) { host.link = { label: p.text, url: p.url }; host.hs = { ...host.hs, button: p.widget }; }
      else out.push({ id: nid(), kind: "cta", text: "", button: { label: p.text, url: p.url }, hs: { button: p.widget } });
      continue;
    }
    if (p.kind === "divider" && out.length && out[out.length - 1].kind !== "divider") out.push({ id: nid(), kind: "divider" });
  }
  if (pendingImage) out.push({ id: nid(), kind: "banner", imageUrl: pendingImage.src, imageAlt: pendingImage.alt, url: pendingImage.url, hs: { image: pendingImage.widget } });
  flushHeading();
  if (greeting) out.unshift({ id: nid(), kind: "text", text: greeting });
  return out.slice(0, 30);
}

/** Its words in short (subject, preheader, then the texts and buttons) - for the assistant to write in their voice. */
export function digestOf(e: { subject: string; preheader: string; parts: EmailPart[] }, max = 900): string {
  const words = e.parts.map((p) => (p.kind === "text" ? p.text : p.kind === "button" ? `[button: ${p.text}]` : "")).filter(Boolean).join("\n");
  return `Subject: ${e.subject}\nPreheader: ${e.preheader}\n${words}`.replace(/\{\{[^}]*\}\}/g, "").slice(0, max);
}

/* ── a HubSpot draft from the newsletter (SARCLA 08.11.2026: "look at the latest we sent") ─────────────────────────────
 * The draft copies the e-mail the newsletter was started from - its template, styles, sections, footer and subscription
 * settings - and rewrites only what was changed in the studio: a block's words, its title, its button, its picture.
 * Pictures kept in the hub go to HubSpot's files first (the hub's own address is not public). What cannot be placed -
 * blocks added in the studio, parts of the original taken out - is said, never guessed. */

export type SourceEmail = RawEmailFull & {
  from?: unknown; subscriptionDetails?: unknown;
  content?: RawEmailFull["content"] & { templatePath?: string; styleSettings?: unknown };
};

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const norm = (t: string) => t.replace(/\s+/g, " ").trim();
/** Our light formatting (**bold**, [link](url), blank line = paragraph) as HubSpot rich text. */
export function toHtml(text: string): string {
  return text.trim().split(/\n{2,}/).filter(Boolean).map((p) => {
    let h = esc(p);
    h = h.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    h = h.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, (_m, label: string, url: string) => `<a href="${url.replace(/&amp;/g, "&")}">${label}</a>`);
    return `<p>${h.replace(/\n/g, "<br>")}</p>`;
  }).join("");
}
/** The greeting with HubSpot's tokens has its own widget: it is never written into the lead story's. */
const withoutGreeting = (t: string) => t.split(/\n{2,}/).filter((p) => !/\{\{\s*contact\./.test(p)).join("\n\n");

/** Hub pictures the draft needs in HubSpot's files: the changed pictures of blocks that came from the e-mail. */
export function picturesToUpload(doc: Pick<NewsletterDoc, "blocks">): string[] {
  const urls = new Set<string>();
  for (const b of doc.blocks) {
    if (!b.hs?.image || !("imageUrl" in b) || !b.imageUrl) continue;
    if (b.imageUrl.startsWith("/api/content/picture/")) urls.add(b.imageUrl);
  }
  return [...urls];
}

export type DraftBody = { body: Record<string, unknown>; changed: string[]; notes: string[] };

/** The create-request for the draft: the source e-mail's content with the changed parts rewritten. */
export function draftFrom(source: SourceEmail, doc: Pick<NewsletterDoc, "subject" | "preheader" | "language" | "blocks">, o: { name: string; uploaded: Record<string, string> }): DraftBody {
  const content = JSON.parse(JSON.stringify(source.content ?? {})) as NonNullable<SourceEmail["content"]>;
  const widgets = (content.widgets ?? {}) as Record<string, { body?: Record<string, unknown> }>;
  const changed: string[] = [];
  const notes: string[] = [];
  const body = (id: string | undefined) => (id && widgets[id]?.body ? widgets[id].body! : null);
  const used = new Set<string>();
  let added = 0;
  for (const b of doc.blocks) {
    const hs = b.hs;
    if (!hs) { if (b.kind !== "footer" && b.kind !== "divider" && b.kind !== "header") added += 1; continue; }
    for (const w of [hs.text, hs.title, hs.image, hs.button]) if (w) used.add(w);
    // the words (and a title read from the same widget, or its own)
    if (hs.text && (b.kind === "hero" || b.kind === "article" || b.kind === "text")) {
      const title = b.kind === "hero" ? (hs.title ? b.headline : "") : b.kind === "article" ? b.title : "";
      const words = b.kind === "hero" ? withoutGreeting(b.text) : b.text;
      const now = [title, words].filter(Boolean).join("\n");
      if (norm(now) !== norm(hs.was ?? "")) {
        const t = body(hs.text);
        if (t) {
          const sameWidget = hs.title && hs.title === hs.text;
          t.html = (sameWidget && title ? `<p><strong>${esc(title)}</strong></p>` : "") + toHtml(words);
          if (hs.title && !sameWidget && title) { const h = body(hs.title); if (h) h.html = `<p><strong>${esc(title)}</strong></p>`; }
          changed.push(`the words of “${(title || words).slice(0, 40)}”`);
        }
      }
    }
    // the picture
    if (hs.image && "imageUrl" in b) {
      const im = body(hs.image);
      const img = (im?.img ?? null) as { src?: string; alt?: string } | null;
      if (im && img && b.imageUrl && b.imageUrl !== img.src) {
        const src = o.uploaded[b.imageUrl] ?? (/^https:\/\//.test(b.imageUrl) ? b.imageUrl : null);
        if (src) { im.img = { ...img, src, alt: ("imageAlt" in b && b.imageAlt) || img.alt || "" }; changed.push("a picture"); }
        else notes.push(`A picture could not go to HubSpot (${b.imageUrl.slice(0, 60)}) - the original one stays.`);
      }
    }
    // the button
    if (hs.button) {
      const link = b.kind === "hero" || b.kind === "cta" ? b.button : b.kind === "article" ? b.link : null;
      const bt = body(hs.button);
      if (bt && link && (link.label !== bt.text || link.url !== bt.destination)) {
        if (link.label) bt.text = link.label;
        if (link.url) bt.destination = link.url;
        changed.push(`the button “${link.label.slice(0, 30)}”`);
      }
    }
  }
  if (added) notes.push(`${added} block${added === 1 ? "" : "s"} added in the studio ${added === 1 ? "is" : "are"} not in the draft - add ${added === 1 ? "it" : "them"} in HubSpot (the draft keeps the original's sections).`);
  // the original's parts no block points at any more (taken out in the studio) stay in the draft
  const left = Object.entries(widgets).filter(([id, w]) => {
    const p = String(w.body?.path ?? w.body?.module_id ?? "");
    const hasWords = typeof w.body?.html === "string" && !/\{\{\s*contact\./.test(String(w.body?.html));
    return !used.has(id) && id !== "preview_text" && !/footer|web_version|follow_me/.test(p) && (hasWords || !!w.body?.img || /button_email/.test(p));
  }).length;
  if (left) notes.push(`${left} part${left === 1 ? "" : "s"} of the original e-mail no block here points at (taken out, or not read) stay in the draft - check them in HubSpot.`);
  if (widgets.preview_text?.body) widgets.preview_text.body.value = doc.preheader;
  content.widgets = widgets;
  return {
    body: {
      name: o.name.slice(0, 250), subject: doc.subject, language: (doc.language || source.language || "en").toLowerCase(), subcategory: "batch",
      content: { templatePath: content.templatePath, styleSettings: content.styleSettings, flexAreas: content.flexAreas, widgets: content.widgets },
      ...(source.from ? { from: source.from } : {}), ...(source.subscriptionDetails ? { subscriptionDetails: source.subscriptionDetails } : {}),
    },
    changed, notes,
  };
}
