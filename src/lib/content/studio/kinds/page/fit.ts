// PAGE - EVERY FIELD WITHIN ITS LIMIT (09.11.2026). Pure: tests/studio-page-fit.test.ts.
//
// SARCLA's night list: the AI respects the fields' length limits - never "21 too many" under a field it just wrote. The
// AI is told each limit; what still comes back too long (or grows in a translation - German runs longer than English) is
// brought within it here, on the server, before it reaches the page: whole paragraphs or list lines first, then whole
// sentences, then a clause ("... - FDA-conform"), and only then a cut at a word - never in the middle of one, never
// ending on "and", a comma or a dash. The meaning of what is kept is never changed.

import { LIMIT, fieldStrings, setField, type Fields } from "./fields";

/** The limit a field is written to, by its path (null: no limit - an address, a URL key). */
export function limitOf(path: string): number | null {
  const p = path.split(".");
  const last = p[p.length - 1];
  if (last === "alt") return LIMIT.alt;
  if (path === "hero.button.label" || path === "cta.button.label") return LIMIT.button;
  switch (path) {
    case "hero.eyebrow": return LIMIT.eyebrow;
    case "hero.title": return LIMIT.heroTitle;
    case "hero.sub": return LIMIT.heroSub;
    case "intro": return LIMIT.intro;
    case "benefitsTitle": case "linksTitle": case "faqTitle": return LIMIT.blockTitle;
    case "cta.title": return LIMIT.ctaTitle;
    case "cta.text": return LIMIT.ctaText;
    case "seo.title": return LIMIT.seoTitle;
    case "seo.description": return LIMIT.seoDescription;
  }
  if (p.length === 3) {
    const k = `${p[0]}.${last}`;
    const by: Record<string, number> = {
      "benefits.title": LIMIT.benefitTitle, "benefits.text": LIMIT.benefitText, "sections.title": LIMIT.sectionTitle, "sections.text": LIMIT.sectionText,
      "links.label": LIMIT.linkLabel, "links.note": LIMIT.linkNote, "faq.q": LIMIT.faqQ, "faq.a": LIMIT.faqA,
    };
    if (by[k]) return by[k];
  }
  return null;
}

// words a cut must not end on (they promise more): the shop's languages
const DANGLING = new Set([
  "and", "or", "but", "with", "for", "the", "a", "an", "of", "to", "in", "on", "at", "by", "from", "your", "our", "its",
  "und", "oder", "aber", "mit", "für", "der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "von", "zu", "im", "in", "am", "auf", "bei", "ihr", "ihre", "unsere",
  "et", "ou", "mais", "avec", "pour", "le", "la", "les", "un", "une", "des", "de", "du", "à", "au", "aux", "en", "sur", "par", "votre", "vos", "nos",
  "e", "o", "ma", "con", "per", "il", "lo", "gli", "le", "uno", "di", "da", "nel", "sul", "dal", "del", "della", "vostro", "nostro",
  "en", "of", "met", "voor", "het", "een", "van", "naar", "op", "uw", "onze",
  "i", "lub", "z", "ze", "dla", "na", "w", "we", "do", "od", "po", "przez",
]);

/** The end of a cut tidied: no dangling joiner word, no trailing comma, dash, colon or open bracket. */
function tidyEnd(s: string): string {
  let out = s.trimEnd();
  for (let k = 0; k < 4; k++) {
    const before = out;
    out = out.replace(/[\s,;:–—\-/(&+]+$/u, "").trimEnd();
    const m = /(\s)(\S+)$/u.exec(out);
    if (m && DANGLING.has(m[2].toLowerCase())) out = out.slice(0, m.index).trimEnd();
    if (out === before) break;
  }
  return out;
}

/** Whole parts kept while they fit (paragraphs split by a blank line, or list lines). */
function byParts(text: string, max: number, sep: RegExp, join: string): string | null {
  const parts = text.split(sep).map((x) => x.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  let out = "";
  for (const p of parts) {
    const next = out ? `${out}${join}${p}` : p;
    if (next.length > max) break;
    out = next;
  }
  return out && out.length >= max * 0.45 ? out : null;
}

/** The text within `max` characters, its meaning kept: the whole text when it fits, else cut where it reads whole. */
export function fitText(text: string, max: number | null): string {
  const t = (text ?? "").trim();
  if (!max || t.length <= max) return t;
  // paragraphs, then list lines
  const paras = byParts(t, max, /\n\s*\n/, "\n\n");
  if (paras) return paras;
  if (/\n/.test(t)) {
    const lines = byParts(t, max, /\n/, "\n");
    if (lines) return lines;
  }
  const head = t.slice(0, max + 1);
  // whole sentences
  const ends = [...head.slice(0, max).matchAll(/[.!?…](?=\s|$)["»”’)]?/gu)].map((m) => m.index! + m[0].length);
  const sentence = ends.length ? ends[ends.length - 1] : -1;
  if (sentence >= max * 0.5) return t.slice(0, sentence).trim();
  // a clause: before a dash, colon, semicolon or comma
  const clauses = [...head.slice(0, max).matchAll(/\s[–—-]\s|[:;,]\s/gu)].map((m) => m.index!);
  const clause = clauses.length ? clauses[clauses.length - 1] : -1;
  if (clause >= max * 0.55) { const c = tidyEnd(t.slice(0, clause)); if (c.length >= max * 0.5) return c; }
  // a word
  const space = head.lastIndexOf(" ", max);
  const cut = tidyEnd(space > max * 0.3 ? t.slice(0, space) : t.slice(0, max));
  return cut || t.slice(0, max).trim();
}

/** A field's words within its limit, by its path. */
export const fitField = (path: string, text: string) => fitText(text, limitOf(path));

/** Every field of a page within its limit (a translation, a page from before the limits). */
export function fitFields(f: Fields): Fields {
  let out = f;
  for (const it of fieldStrings(f)) {
    const fitted = fitField(it.id, it.text);
    if (fitted !== it.text) out = setField(out, it.id, fitted);
  }
  return out;
}

/** The fields over their limit (path, length, limit) - none after fitFields. */
export function overLimit(f: Fields): { path: string; length: number; max: number }[] {
  return fieldStrings(f).flatMap((it) => { const max = limitOf(it.id); return max && it.text.trim().length > max ? [{ path: it.id, length: it.text.trim().length, max }] : []; });
}
