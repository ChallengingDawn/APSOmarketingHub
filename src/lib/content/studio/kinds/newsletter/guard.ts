// NEWSLETTER - THE SHOP'S WORD RULES ON EVERY AI TEXT (cv16, 11.11.2026). Pure: relative imports only - the server's
// AI tasks (./server.ts clean) and tests/studio-newsletter-cv16.test.ts.
//
// The Page builder passes every AI text through the shop's rules (../page/plan/newpage.ts guardText): a sentence with a
// price, a discount, a stock or delivery promise ("ab Lager", "in 48 h"), a certificate nobody named, "Chemours" or a
// placeholder is taken out, and said. The newsletter's prompt asked for the same, but nothing checked the answer. Now the
// same guard runs on the newsletter's words, line by line (its paragraphs and **bold** stay), with two things of its own:
//   - HubSpot's personal words ({{ contact.firstname }}, {{ unsubscribe_link }}) are the e-mail's, never a placeholder
//   - the shop's facts block keeps its figures: they are the brand brain's (model.ts SHOP_FACTS), not the AI's

import { guardText } from "../page/plan/newpage";
import { textFields, type Block, type DraftAnswer, type Edits, type NewsletterDoc } from "./model";

/** A HubSpot token, kept apart while the rules read the words (the rules take "{{ x }}" for a placeholder). */
const TOKEN = /\{\{\s*[\w.]+\s*\}\}/g;
const MARK = (i: number) => `⟦${i}⟧`;

/** One text under the shop's rules: what may stay; what was taken out is added to `said`. */
export function guardWords(text: string, known: string, said: string[], lang: string): string {
  if (!text || !text.trim()) return text;
  const tokens: string[] = [];
  const masked = text.replace(TOKEN, (t) => { tokens.push(t); return MARK(tokens.length - 1); });
  const kept = guardText(masked, known, said, lang.slice(0, 2).toLowerCase());
  return kept.replace(/⟦(\d+)⟧/g, (_m, i: string) => tokens[Number(i)] ?? "");
}

/** The fields the rules never touch: the shop's facts (the brand's own figures) - its words are translated, not judged. */
const exempt = (b: Block | undefined, name: string) => b?.kind === "facts" && /^item\d(Big|Label)$/.test(name);

/** The assistant's changed words under the rules; a field left empty by them is dropped (its words stay as they were). */
export function guardEdits<T extends Edits>(e: T, doc: NewsletterDoc, known: string): { edits: T; left: string[] } {
  const said: string[] = [];
  const lang = doc.language;
  const g = (t: string) => guardWords(t, known, said, lang);
  const blocks = e.blocks.map((x) => {
    const b = doc.blocks.find((y) => y.id === x.id);
    const fields = x.fields.map((f) => (exempt(b, f.name) ? f : { ...f, value: g(f.value) }))
      // a field whose every sentence broke a rule keeps its words as they were - never an empty headline
      .filter((f) => f.value.trim() || !b || !textFields(b).find((t) => t.name === f.name)?.value.trim());
    return { ...x, fields };
  }).filter((x) => x.fields.length);
  return { edits: { ...e, subject: e.subject ? g(e.subject) : e.subject, preheader: e.preheader ? g(e.preheader) : e.preheader, blocks }, left: [...new Set(said)].slice(0, 8) };
}

/** The whole newsletter written from the brief, under the rules. */
export function guardDraft(a: DraftAnswer, known: string, lang: string): { answer: DraftAnswer; left: string[] } {
  const said: string[] = [];
  const g = (t: string) => guardWords(t, known, said, lang);
  const answer: DraftAnswer = {
    ...a, subject: g(a.subject), preheader: g(a.preheader), eyebrow: g(a.eyebrow), headline: g(a.headline), lead: g(a.lead), button: g(a.button),
    stories: a.stories.map((s) => ({ ...s, title: g(s.title), text: g(s.text), link: g(s.link) })).filter((s) => s.title || s.text),
    intro: a.intro ? g(a.intro) : a.intro, cta: g(a.cta), ctaButton: g(a.ctaButton),
    ...(a.extra ? { extra: a.extra.map((x) => ({ ...x, fields: x.fields.map((f) => ({ ...f, value: g(f.value) })).filter((f) => f.value.trim()) })) } : {}),
  };
  return { answer, left: [...new Set(said)].slice(0, 8) };
}
