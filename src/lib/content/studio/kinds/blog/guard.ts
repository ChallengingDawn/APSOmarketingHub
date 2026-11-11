// BLOG POST - THE SHOP'S WORD RULES ON EVERY AI TEXT (cv16, SARCLA 11.11.2026: "compare the evolution of this page to the
// other content types and improve them"). Pure: relative imports only - tests/studio-blog-cv16.test.ts.
//
// The Page builder reads every AI text against the shop's word rules before it lands (page/plan/newpage.ts guardText). The
// blog only told the AI the rules and warned at the last step. Now each AI answer of the blog studio (the whole post, a
// section, a part, the questions, Google's texts) is read sentence by sentence here, on the server, and a sentence that
// breaks a rule is taken out - and said, in the change's line:
//   - a stock or delivery promise ("ab Lager", "in stock", "within 48 h", "next-day delivery") - the banner's STOCK_WORDS
//   - a price (CHF 12.50, 12 €) - the blog never has one
//   - a discount value, Chemours - banner/brand.ts brandFlags, the same words as every studio
//   - a certificate or approval claimed for us (our / APSOparts / "in our range") that the brief, the topic, the person's
//     words or the post itself never named. Explaining what FDA or EHEDG mean stays: a blog explains; it never claims.
// Norms (ISO 3601, DIN EN 681) are general engineering knowledge: kept. Markdown keeps its shape: a list item, a table
// row, a heading is read whole and goes whole; a paragraph loses only the sentence.
// cv17 (12.11.2026): a whole post - a translation into a new language tab too - is read part by part (guardOutline), the
// author's role and the topics with it; its sources are the post it was made from.

import { STOCK_WORDS, brandFlags } from "../banner/brand";

const DELIVERY = [
  /\b(in|within|innerhalb( von)?|innert|en|entro|binnen|w ciągu|sous)\s+\d+(\s*[/-]\s*\d+)?\s*(h\b|std\b|stunden|hours?|heures|ore\b|uur|godzin\w*|tage[n]?|werktage[n]?|days?|business days|jours?|giorni|dagen|dni)/i,
  /\b48\s*\/\s*72\b|\b\d+\s*[/-]\s*\d+\s*(h|std|stunden|hours?)\b/i,
  /\b(same[- ]day|next[- ]day|overnight)\s+(delivery|shipping|dispatch)\b/i,
  /\b(lieferung|versand)\s+(am\s+)?(selben|gleichen|nächsten|naechsten)\s+tag\b/i,
  /\blivraison\s+(le\s+)?(jour\s+même|lendemain)\b/i,
  /\b(sofort|immediately|immédiatement|subito|direct)\s+(lieferbar|available|disponible|disponibile|leverbaar)\b/i,
];
const PRICE = /\b(CHF|EUR|USD|PLN|GBP|Fr\.)\s?\d|\d[\d'.,]*\s?(CHF|EUR|USD|PLN|GBP|€|zł)(?![\p{L}\d])|[€$£]\s?\d/iu;
/** Certificates and approvals - a claim of one for us needs a source. Norms are not in it (general knowledge). */
const APPROVALS = /\b(FDA|KTW|W\s?270|WRAS|ACS|NSF(?:\/ANSI)?(?:\s?\d+)?|USP\s*Class\s*VI|EC\s*1935\/2004|1935\/2004|10\/2011|DVGW|3-A|EHEDG|ATEX|UL\s?\d+|BAM|ADI[- ]free|REACH|RoHS)\b/gi;
/** Words that claim something for us (the shop, its range) - in the shop's languages. */
const OURS = /\b(our|ours|we|we're|apsoparts|angst\s*\+\s*pfister|unser\w*|wir|notre|nos|nous|nostr[aoie]|noi|onze|ons|wij|nasz\w*|oferujemy)\b/i;

export type GuardOut = { text: string; said: string[] };

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&").replace(/\s+/g, "\\s*");

/** Why a sentence may not stay (null: it may). `sources`: what the brief, the topic, the person and the post said. */
export function ruleBroken(sentence: string, sources: string): string | null {
  const t = sentence.replace(/<[^>]*>/g, " ");
  if (!t.trim()) return null;
  if (STOCK_WORDS.test(t) || DELIVERY.some((re) => re.test(t))) return "a stock or delivery promise";
  if (PRICE.test(t)) return "a price";
  const flags = brandFlags(t);
  if (flags.some((f) => /chemours/i.test(f))) return "Chemours named";
  if (flags.length) return "a discount value";
  if (OURS.test(t)) {
    for (const m of t.matchAll(APPROVALS)) {
      if (!new RegExp(esc(m[0]), "i").test(sources)) return `${m[0].trim()} claimed for us - nothing given names it`;
    }
  }
  return null;
}

/** One line's sentences, each kept or taken out (a decimal point or "e.g." is no end of a sentence). */
function sentencesOf(line: string): string[] {
  return line.split(/(?<=[.!?])\s+(?=[\p{Lu}\d"„«(*=[])/u);
}

/**
 * A text (markdown or plain) under the rules: a sentence that breaks one goes; a list item, a table row or a heading that
 * breaks one goes whole; a paragraph left empty goes. What went is said once per reason.
 */
export function guardPost(text: string, sources: string): GuardOut {
  const said: string[] = [];
  const say = (why: string, what: string) => said.push(`"${what.replace(/\s+/g, " ").trim().slice(0, 60)}${what.trim().length > 60 ? "…" : ""}" left out (${why})`);
  if (!String(text ?? "").trim()) return { text: text ?? "", said };
  const lines = text.split("\n").map((line): string | null => {
    if (!line.trim()) return line;
    // a table row, a heading: whole
    if (/^\s*(\||#{1,6}\s)/.test(line)) {
      const why = /^\s*\|\s*:?-{2,}/.test(line) ? null : ruleBroken(line.replace(/\|/g, " "), sources);
      if (why) { say(why, line.replace(/[|#]/g, " ")); return null; }
      return line;
    }
    const m = /^(\s*(?:[-*+•]\s+|\d+[.)]\s+|>\s*)?)(.*)$/.exec(line)!;
    const mark = m[1] ?? "";
    const body = m[2] ?? "";
    // a list item: whole
    if (mark && !mark.trim().startsWith(">")) {
      const why = ruleBroken(body, sources);
      if (why) { say(why, body); return null; }
      return line;
    }
    const kept = sentencesOf(body).filter((s) => {
      const why = ruleBroken(s, sources);
      if (why) say(why, s);
      return !why;
    });
    return kept.length ? `${mark}${kept.join(" ")}` : null;
  });
  const out = lines.filter((l): l is string => l !== null).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return { text: out, said };
}

/** Several texts under the rules, what went said once. */
export function guardAll<T extends Record<string, string>>(texts: T, sources: string): { texts: T; said: string[] } {
  const said: string[] = [];
  const out = Object.fromEntries(Object.entries(texts).map(([k, v]) => {
    const g = guardPost(v, sources);
    said.push(...g.said);
    return [k, g.text];
  })) as T;
  return { texts: out, said };
}

/** The words of a whole post as the AI writes or translates it (server.ts "outline"). */
export type OutlineTexts = {
  title: string; metaTitle: string; metaDescription: string; excerpt: string; takeaways: string[];
  sections: { heading: string; body: string; quote: string; image: { alt: string; caption: string } }[];
  faq: { q: string; a: string }[];
  cta: { title: string; text: string; label: string };
  pictureAlt: string; heroCaption: string; authorRole: string; tags: string[];
};

/**
 * A whole post under the rules (cv17: a translation is one too - "+ Language" makes a tab from it): EVERY text of it - the
 * title, Google's texts, the lead, "in short", each section's heading, text, pull quote, what its picture shows and the
 * line under it, the questions and answers, the band's words, the post's picture's words, the author's role, the topics.
 * A section, a question, a line or a topic left empty goes. `sources`: what the post it was made from (and the brief, the
 * person) said - a certificate claimed for us in the new language needs one there too.
 */
export function guardOutline<T extends OutlineTexts>(x: T, sources: string): { x: T; said: string[] } {
  const said: string[] = [];
  const k = (t: string) => { const g = guardPost(t, sources); said.push(...g.said); return g.text; };
  const out = {
    ...x,
    title: k(x.title), metaTitle: k(x.metaTitle), metaDescription: k(x.metaDescription), excerpt: k(x.excerpt),
    takeaways: x.takeaways.map(k).filter((t) => t.trim()),
    sections: x.sections
      .map((s) => ({ ...s, heading: k(s.heading), body: k(s.body), quote: k(s.quote), image: { ...s.image, alt: k(s.image.alt), caption: k(s.image.caption) } }))
      .filter((s) => s.heading || s.body),
    faq: x.faq.map((f) => ({ ...f, q: k(f.q), a: k(f.a) })).filter((f) => f.q && f.a),
    cta: { ...x.cta, title: k(x.cta.title), text: k(x.cta.text), label: k(x.cta.label) },
    pictureAlt: k(x.pictureAlt), heroCaption: k(x.heroCaption), authorRole: k(x.authorRole),
    tags: x.tags.map(k).filter((t) => t.trim()),
  };
  return { x: out as T, said };
}

/** What a change's line says of the sentences taken out ("" = none). */
export function saidLine(said: string[]): string {
  const u = [...new Set(said)];
  if (!u.length) return "";
  return ` ${u.length === 1 ? "One sentence was" : `${u.length} sentences were`} left out by the shop's word rules: ${u.slice(0, 3).join("; ")}${u.length > 3 ? "; …" : ""}.`;
}
