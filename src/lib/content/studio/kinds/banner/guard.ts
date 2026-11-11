// BANNER - THE SHOP'S WORD RULES ON EVERY AI TEXT (cv16, 11.11.2026). Pure: tests/studio-banner-cv16.test.ts.
//
// SARCLA 11.11.2026: "compare the evolution of this page [the Page builder] to the other content types and improve them".
// The Page builder takes out, before anything reaches the page, a sentence with a price, a discount, a stock or delivery
// promise, "Chemours", a certificate nobody named, or words in another language (page/plan/plan.ts safeWords) - and says
// so. The banner only flagged some of it afterwards (checks.ts, brand.ts brandFlags). Now every text the AI writes for a
// banner - its words, each place's own shorter ones, the three other headlines - goes through the same rules on the
// server, the same way: a text that breaks one is left out, and the studio says what was left out.
//
// "Known" is what the person gave: the brief, the banner's notes and words, the ask - a certificate named there may stay.

import { safeWords } from "../page/plan/plan";
import type { CopyAnswer, Variant } from "./ai";

/** One text under the rules: kept, or "" when it broke one (`said` gets why). */
export function guardWords(text: string, known: string, said: string[], lang: string): string {
  const t = String(text ?? "");
  if (!t.trim()) return "";
  return safeWords(t, known, said, lang);
}

/** The AI's words for a banner under the rules; what was left out is said once each. */
export function guardCopy(a: CopyAnswer, known: string, lang: string): CopyAnswer & { said: string[] } {
  const said: string[] = [];
  const g = (t: string) => guardWords(t, known, said, lang);
  const content = {
    eyebrow: g(a.content.eyebrow),
    headline: g(a.content.headline),
    rotatingWords: a.content.rotatingWords.map(g).filter(Boolean),
    line: g(a.content.line),
    button: g(a.content.button),
  };
  const own: CopyAnswer["own"] = {};
  for (const [k, w] of Object.entries(a.own) as [keyof CopyAnswer["own"], NonNullable<CopyAnswer["own"][keyof CopyAnswer["own"]]>][]) {
    const next = { eyebrow: g(w.eyebrow), headline: g(w.headline), line: g(w.line), button: g(w.button) };
    if (next.eyebrow || next.headline || next.line || next.button) own[k] = next;
  }
  return { content, own, said: [...new Set(said)].slice(0, 6) };
}

/** The three other headlines under the rules: a headline that breaks one is not offered. */
export function guardVariants(list: Variant[], known: string, lang: string): { headlines: Variant[]; said: string[] } {
  const said: string[] = [];
  const headlines = list.map((v) => ({ headline: guardWords(v.headline, known, said, lang), angle: v.angle })).filter((v) => v.headline);
  return { headlines, said: [...new Set(said)].slice(0, 6) };
}

/** What the person gave, for the certificate rule: the brief, the notes, the banner's own words, the ask. */
export function knownText(parts: (string | null | undefined)[]): string {
  return parts.filter((x): x is string => typeof x === "string" && !!x.trim()).join("\n").slice(0, 20000);
}
