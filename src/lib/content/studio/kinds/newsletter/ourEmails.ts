// OUR E-MAILS IN HUBSPOT, READ - the pure part of hubspotEmails.ts (relative imports only, shared with the tests):
// grouping the e-mails we sent by campaign, reading one e-mail's parts in the order it shows, turning them into the
// studio's blocks, and its words in short for the assistant. tests/newsletter-our-emails.test.ts.

import type { Block } from "./model";

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
  const isHeading = (t: string) => t.length <= 80 && !t.includes("\n") && !/[.!]$/.test(t) && !/\{\{/.test(t);
  const flushHeading = () => { if (heading) { out.push({ id: nid(), kind: "text", text: heading }); heading = null; } };
  const body = parts.filter((p) => p.kind !== "chrome");
  let pendingImage: Extract<EmailPart, { kind: "image" }> | null = null;
  let greeting: string | null = null;
  const lastWithLink = () => [...out].reverse().find((b) => b.kind === "hero" || b.kind === "article");
  for (const p of body) {
    if (p.kind === "image") {
      if (pendingImage) out.push({ id: nid(), kind: "banner", imageUrl: pendingImage.src, imageAlt: pendingImage.alt, url: pendingImage.url });
      pendingImage = p;
      continue;
    }
    if (p.kind === "text") {
      if (!p.text) continue;
      // the greeting between the header picture and the first words waits for the lead story
      if (pendingImage && !out.some((b) => b.kind === "hero") && /\{\{\s*contact\./.test(p.text) && p.text.length < 140) { greeting = p.text; continue; }
      if (isHeading(p.text) && out.some((b) => b.kind === "hero")) { flushHeading(); heading = p.text; continue; }
      const { title, rest } = split(p.text);
      if (pendingImage) {
        const img = pendingImage;
        pendingImage = null;
        if (!out.some((b) => b.kind === "hero")) {
          // no short first line to be its headline: the e-mail's subject is (the header picture carries its own)
          const text = [greeting, title ? rest : p.text].filter(Boolean).join("\n\n");
          greeting = null;
          out.push({ id: nid(), kind: "hero", eyebrow: "", headline: title || subject || rest.slice(0, 70), text, imageUrl: img.src, imageAlt: img.alt, button: { label: "", url: "" } });
        } else {
          out.push({ id: nid(), kind: "article", title: title || heading || "", text: rest, imageUrl: img.src, imageAlt: img.alt, link: { label: "", url: "" }, layout: "stacked" });
          if (!title) heading = null;
        }
      } else if (title && rest.length > 60) {
        flushHeading();
        out.push({ id: nid(), kind: "article", title, text: rest, imageUrl: "", imageAlt: "", link: { label: "", url: "" }, layout: "stacked" });
      } else if (heading) {
        out.push({ id: nid(), kind: "article", title: heading, text: p.text, imageUrl: "", imageAlt: "", link: { label: "", url: "" }, layout: "stacked" });
        heading = null;
      } else {
        out.push({ id: nid(), kind: "text", text: p.text });
      }
      continue;
    }
    if (p.kind === "button") {
      flushHeading();
      const host = lastWithLink();
      if (host && host.kind === "hero" && !host.button.url) host.button = { label: p.text, url: p.url };
      else if (host && host.kind === "article" && !host.link.url) host.link = { label: p.text, url: p.url };
      else out.push({ id: nid(), kind: "cta", text: "", button: { label: p.text, url: p.url } });
      continue;
    }
    if (p.kind === "divider" && out.length && out[out.length - 1].kind !== "divider") out.push({ id: nid(), kind: "divider" });
  }
  if (pendingImage) out.push({ id: nid(), kind: "banner", imageUrl: pendingImage.src, imageAlt: pendingImage.alt, url: pendingImage.url });
  flushHeading();
  if (greeting) out.unshift({ id: nid(), kind: "text", text: greeting });
  return out.slice(0, 30);
}

/** Its words in short (subject, preheader, then the texts and buttons) - for the assistant to write in their voice. */
export function digestOf(e: { subject: string; preheader: string; parts: EmailPart[] }, max = 900): string {
  const words = e.parts.map((p) => (p.kind === "text" ? p.text : p.kind === "button" ? `[button: ${p.text}]` : "")).filter(Boolean).join("\n");
  return `Subject: ${e.subject}\nPreheader: ${e.preheader}\n${words}`.replace(/\{\{[^}]*\}\}/g, "").slice(0, max);
}
