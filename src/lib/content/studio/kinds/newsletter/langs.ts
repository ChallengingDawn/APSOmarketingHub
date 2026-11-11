// NEWSLETTER - ITS LANGUAGES, EACH A VERSION OF ITS OWN, AND THE LAST STEP'S HUBSPOT DRAFTS (cv16, 11.11.2026). Pure:
// relative imports only - the studio, the server and tests/studio-newsletter-cv16.test.ts.
//
// SARCLA 11.11.2026 ~18:25: "compare the evolution of this page [the Page builder] to the other content types' generators,
// and improve them". The Page builder keeps every language as a tab of its own; the newsletter was ONE e-mail whose
// translation replaced it (its first language gone but for Undo) - though it is sent PER LANGUAGE, one HubSpot draft each.
// Now: the newsletter's own language is its top level (as before: the library, the calendar, an older newsletter read it
// so), each other language a version under `langs` - its subject, preview text, blocks and its own HubSpot draft.
//   versionIn / withVersion   a language's e-mail as the studio edits it, and back into the document
//   followLanguage            what a translation takes along besides the words: the shop's facts and our footer in the
//                             new language, the default button words, a Page builder page's address in the language's
//                             store view (another address of the shop is never guessed - "Before it goes out" says it)
//   draftRows / makeAll       the last step: per language its draft in HubSpot (none / up to date / changed since), what
//                             "Make the drafts" makes, and the refusals in plain words with the ones to try again

import { SHOP_FACTS, asNewsletter, checks, wordsOf, type Block, type Check, type LangVersion, type NewsletterDoc } from "./model";
import { linkFor, linksOf, linkIssues, newsletterStore, type PageLinkRow, type Tone } from "./pageLinks";

/** The languages a newsletter is written in, in the studio's order. */
export const LANG_ORDER = ["DE", "FR", "IT", "EN", "NL", "PL"];
const rank = (l: string) => { const i = LANG_ORDER.indexOf(l); return i < 0 ? 99 : i; };

/** The newsletter's own language (its top level). */
export const mainLanguage = (doc: unknown) => asNewsletter(doc).language.toUpperCase();

/** Every language the newsletter has: its own first, then the others in the studio's order. */
export function languagesOf(doc: unknown): string[] {
  const d = asNewsletter(doc);
  return [d.language.toUpperCase(), ...Object.keys(d.langs ?? {}).sort((a, b) => rank(a) - rank(b))];
}

/** A language's version as the newsletter the studio edits: its own words and blocks, the newsletter's settings. The
 * newsletter's own language (or one it has not) is the newsletter itself. */
export function versionIn(doc: unknown, lang?: string | null): NewsletterDoc {
  const d = asNewsletter(doc);
  const L = String(lang ?? "").toUpperCase();
  const v = L ? d.langs?.[L] : undefined;
  if (!v || L === d.language.toUpperCase()) return d;
  return { ...d, language: L, subject: v.subject, preheader: v.preheader, fromName: v.fromName || d.fromName, blocks: v.blocks, hubspot: v.hubspot, changes: v.changes ?? [] };
}

/** What a version keeps of the e-mail edited in its tab. */
const fieldsOf = (v: NewsletterDoc): LangVersion => ({
  subject: v.subject, preheader: v.preheader, ...(v.fromName ? { fromName: v.fromName } : {}), blocks: v.blocks,
  ...(v.hubspot ? { hubspot: v.hubspot } : {}), changes: v.changes ?? [],
});

/** The newsletter with one language's e-mail put back (its own language: the top level; another: its version). */
export function withVersion(doc: unknown, lang: string, view: NewsletterDoc): NewsletterDoc {
  const d = asNewsletter(doc);
  const L = lang.toUpperCase();
  if (L === d.language.toUpperCase()) {
    // the top level: the e-mail as edited - its language and its other languages as the newsletter has them
    const { langs: _l, ...rest } = view;
    return { ...rest, language: d.language, ...(d.langs ? { langs: d.langs } : {}) };
  }
  return { ...d, langs: { ...(d.langs ?? {}), [L]: fieldsOf(view) } };
}

/** The newsletter without one of its other languages (its own stays). */
export function withoutLanguage(doc: unknown, lang: string): NewsletterDoc {
  const d = asNewsletter(doc);
  const L = lang.toUpperCase();
  if (!d.langs?.[L]) return d;
  const { [L]: _gone, ...langs } = d.langs;
  const { langs: _l, ...rest } = d;
  return Object.keys(langs).length ? { ...rest, langs } : rest;
}

/* ── a translation: what it takes along besides the words ─────────────────────────────────────────────────────── */

const sameFacts = (a: { big: string; label: string }[], b: { big: string; label: string }[]) =>
  a.length === b.length && a.every((x, i) => x.big.trim() === b[i].big && x.label.trim() === b[i].label);

/** A link of the e-mail in another language: a Page builder page's address in that language's store view (its version
 * there); anything else as it is - another address of the shop is never guessed. */
export function followLink(url: string, to: string, rows: readonly PageLinkRow[] | null): string {
  const u = url.trim();
  const m = /^https?:\/\/(?:www\.)?apsoparts\.com\/([a-z]{2}-[a-z]{2,3})\/([^?#]+?)\/*$/i.exec(u);
  if (!m || !rows?.length) return url;
  const row = rows.find((r) => Object.entries(r.views).some(([store, v]) => store.toLowerCase() === m[1].toLowerCase() && v.key === m[2]));
  if (!row) return url;
  return linkFor(row, to).address ?? url;
}

/**
 * The translated e-mail with what follows the language set (each block compared with the one it was translated from):
 * the shop's facts and our footer in the new language when they were ours unchanged (never a figure the AI wrote), the
 * header's line and the default button words, every Page builder page linked in the new language's store view.
 * `moved`: the links put in the new store view.
 */
export function followLanguage(source: NewsletterDoc, translated: NewsletterDoc, rows: readonly PageLinkRow[] | null): { doc: NewsletterDoc; moved: number } {
  const from = source.language.toUpperCase();
  const to = translated.language.toUpperCase();
  const wf = wordsOf(from);
  const wt = wordsOf(to);
  const label = (was: string, now: string) => (was === wf.discover ? wt.discover : was === wf.more ? wt.more : was === wf.order ? wt.order : now);
  let moved = 0;
  const link = (u: string) => { const n = followLink(u, to, rows); if (n !== u) moved += 1; return n; };
  const blocks = translated.blocks.map((b): Block => {
    const s = source.blocks.find((x) => x.id === b.id);
    if (!s || s.kind !== b.kind) return b;
    switch (b.kind) {
      case "facts": return s.kind === "facts" && sameFacts(s.items, SHOP_FACTS[from] ?? []) && SHOP_FACTS[to] ? { ...b, items: SHOP_FACTS[to].map((x) => ({ ...x })) } : b;
      case "footer": return s.kind === "footer" && s.text.trim() === wf.footer ? { ...b, text: wt.footer } : b;
      case "header": return s.kind === "header" && s.tagline === wf.tagline ? { ...b, tagline: wt.tagline } : b;
      case "hero": return s.kind === "hero" ? { ...b, button: { label: label(s.button.label, b.button.label), url: link(b.button.url) } } : b;
      case "cta": return s.kind === "cta" ? { ...b, button: { label: label(s.button.label, b.button.label), url: link(b.button.url) } } : b;
      case "article": return s.kind === "article" ? { ...b, link: { label: label(s.link.label, b.link.label), url: link(b.link.url) } } : b;
      case "banner": return { ...b, url: link(b.url) };
      case "products": return { ...b, items: b.items.map((x) => ({ ...x, url: link(x.url) })) };
      default: return b;
    }
  });
  return { doc: { ...translated, blocks }, moved };
}

/** A language's e-mail ready to be translated into `to`: the same blocks (their ids, so the words come back to them),
 * no HubSpot draft of its own yet, no changes of its own. */
export function translationBase(source: NewsletterDoc, to: string): NewsletterDoc {
  const copy = JSON.parse(JSON.stringify(source)) as NewsletterDoc;
  return { ...copy, language: to.toUpperCase(), hubspot: undefined, changes: [] };
}

/* ── the last step: one HubSpot draft per language ─────────────────────────────────────────────────────────────── */

/** The words, pictures and links a draft is made from, as a short signature: a draft made from other ones is out of date. */
export function versionSig(v: Pick<NewsletterDoc, "subject" | "preheader" | "blocks">): string {
  const plain = JSON.stringify([v.subject, v.preheader, v.blocks.map((b) => { const { hs: _hs, ...rest } = b; return rest; })]);
  let h = 5381;
  for (let i = 0; i < plain.length; i++) h = ((h << 5) + h + plain.charCodeAt(i)) | 0;
  return `${plain.length.toString(36)}-${(h >>> 0).toString(36)}`;
}

export type DraftState = "none" | "same" | "changed";
export type DraftRow = {
  lang: string; subject: string;
  /** no draft yet, the draft made from these words, or the words changed since */
  state: DraftState;
  at: string | null; url: string | null; emailId: string | null;
  /** what "Before it goes out" says of this language's e-mail, its links too */
  issues: { tone: Tone; text: string }[];
  /** something that keeps the draft from being made (no subject, no footer) */
  blocked: string | null;
};

/** Per language, its draft in HubSpot and what stands in its way - the newsletter's own language first. */
export function draftRows(doc: unknown, rows: readonly PageLinkRow[] | null): DraftRow[] {
  return languagesOf(doc).map((lang): DraftRow => {
    const v = versionIn(doc, lang);
    const hs = v.hubspot;
    const made = !!hs?.emailId;
    const issues = [...checks(v).map((c: Check) => ({ tone: (c.level === "bad" ? "bad" : "warn") as Tone, text: c.text })), ...linkIssues(v, rows)];
    const bad = checks(v).find((c) => c.level === "bad" && /No subject|No footer/.test(c.text));
    return {
      lang, subject: v.subject,
      // a draft made before signatures were kept (no sig) counts as made from these words
      state: !made ? "none" : hs?.sig && hs.sig !== versionSig(v) ? "changed" : "same",
      at: hs?.at ?? null, url: hs?.url ?? null, emailId: hs?.emailId ?? null,
      issues, blocked: bad ? bad.text : null,
    };
  });
}

/** What "Make the drafts" makes: every language with no draft yet or changed since its draft (and nothing in its way). */
export function makeAllOf(rows: readonly DraftRow[]): { langs: string[]; label: string; why: string | null } {
  const todo = rows.filter((r) => r.state !== "same" && !r.blocked).map((r) => r.lang);
  const blocked = rows.filter((r) => r.state !== "same" && r.blocked);
  if (!todo.length) {
    return { langs: [], label: "Every draft is up to date", why: blocked.length ? `${blocked.map((r) => r.lang).join(", ")}: ${blocked[0].blocked}` : rows.length ? null : "Nothing to make yet." };
  }
  const again = todo.filter((l) => rows.find((r) => r.lang === l)?.state === "changed").length;
  const what = todo.length === 1 ? `the ${todo[0]} draft` : `${todo.length} drafts (${todo.join(", ")})`;
  return { langs: todo, label: again === todo.length ? `Make ${what} again` : `Make ${what}`, why: null };
}

/** "Making the FR draft in HubSpot · 2 of 3…" */
export const draftProgress = (lang: string, i: number, n: number) => `Making the ${lang} draft in HubSpot · ${i} of ${n}…`;

/** The languages to try again after a run: the ones that failed, in the run's order. */
export const retryLangs = (results: readonly { lang: string; ok: boolean }[]) => results.filter((r) => !r.ok).map((r) => r.lang);

/**
 * HubSpot's refusal in plain words: "HubSpot: <its message>" (the integration's error) said with what to do; an HTML page
 * answered instead of HubSpot's JSON (a proxy, a firewall) said by its title, never its markup.
 */
export function refusalSaid(error: string | null | undefined, status?: number | null): string {
  let e = String(error ?? "").trim();
  const html = e.search(/<!doctype\s+html|<html[\s>]|<head[\s>]|<body[\s>]/i);
  if (html >= 0) {
    const title = /<title[^>]*>([^<]{1,120})<\/title>/i.exec(e.slice(html))?.[1]?.trim();
    e = `${e.slice(0, html).replace(/[:\s]+$/, "") || "HubSpot answered"} with a web page${title ? ` (“${title}”)` : ""} instead of its answer`;
  }
  e = e.replace(/\s*correlationId[^,}]*[,}]?/gi, "").replace(/\s+/g, " ").slice(0, 300);
  const code = status ?? (Number(/\b(4\d\d|5\d\d)\b/.exec(e)?.[1] ?? "") || null);
  const hint = code === 401 || code === 403 ? " - the hub's HubSpot app may not write marketing e-mails (ask an admin)"
    : code === 429 ? " - HubSpot is busy: try again in a minute"
    : code && code >= 500 ? " - HubSpot's side: try again in a minute" : "";
  return `${e || "HubSpot made no draft."}${hint && !e.includes(hint.slice(3, 20)) ? hint : ""}`;
}

/** Every link of every language, for the last step's Links: per language, where it is and what is said of it. */
export function linksByLanguage(doc: unknown, rows: readonly PageLinkRow[] | null): { lang: string; store: string; links: { where: string; url: string; tone: Tone | null; line: string | null }[] }[] {
  return languagesOf(doc).map((lang) => {
    const v = versionIn(doc, lang);
    const said = new Map(linkIssues(v, rows).map((x) => [x.text.split(": ")[0], x]));
    return {
      lang, store: newsletterStore(lang),
      links: linksOf(v).map((l) => { const s = said.get(l.where); return { ...l, tone: s?.tone ?? null, line: s ? s.text.slice(l.where.length + 2) : null }; }),
    };
  });
}
