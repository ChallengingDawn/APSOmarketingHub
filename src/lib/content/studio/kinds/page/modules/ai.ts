// PAGE - "FILL WITH AI" FOR A MODULE (Content v6, 09.11.2026). Pure: tests/studio-page-modules.test.ts proves the parsing
// with a canned answer.
//
// SARCLA 09.11.2026: "we should also be able to fill with AI the product on the bento or other". The AI never names a
// product of its own: it is shown CANDIDATES - the shop's most viewed and most bought products and, when a category is
// chosen, that category's products, each with its number, name and figures (./source.ts aiCandidates) - and picks among
// them for the page's subject, in an order. A number it was not shown is dropped. It may also write the block's small
// line and title in the page's language - no prices, no discounts, no claims.

import { kindOf, isModuleType } from "./model";

export type Candidate = { number: string; name: string; views: number; bought: number; from: string };
export type AiPick = { picks: string[]; eyebrow: string; title: string; why: string };

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** The candidates handed in by the studio, put right (a number is 8 digits). */
export function candidatesIn(v: unknown): Candidate[] {
  if (!Array.isArray(v)) return [];
  const out: Candidate[] = [];
  for (const x of v.slice(0, 80)) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const number = String(o.number ?? "");
    if (!/^\d{8}$/.test(number) || out.some((c) => c.number === number)) continue;
    out.push({ number, name: str(o.name, 160), views: Number(o.views) || 0, bought: Number(o.bought) || 0, from: str(o.from, 20) });
  }
  return out;
}

/** The answer kept: only numbers the AI was shown, once each, at most `count`; the words short, no price or discount. */
export function cleanPick(raw: unknown, candidates: Candidate[], count: number): AiPick {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const allowed = new Set(candidates.map((c) => c.number));
  const picks: string[] = [];
  for (const p of Array.isArray(o.picks) ? o.picks : []) {
    const n = String((p && typeof p === "object" ? (p as Record<string, unknown>).number : p) ?? "").replace(/\D/g, "");
    if (allowed.has(n) && !picks.includes(n)) picks.push(n);
    if (picks.length >= count) break;
  }
  const clean = (t: string) => (/\d+\s*%|CHF|EUR|€|rabatt|discount|remise|sconto/i.test(t) ? "" : t);
  return { picks, eyebrow: clean(str(o.eyebrow, 40)), title: clean(str(o.title, 90)), why: str(o.why, 400) };
}

export const MODULE_FILL_SCHEMA = {
  type: "object", additionalProperties: false, required: ["picks", "eyebrow", "title", "why"],
  properties: {
    picks: { type: "array", items: { type: "object", additionalProperties: false, required: ["number"], properties: { number: { type: "string" } } } },
    eyebrow: { type: "string" },
    title: { type: "string" },
    why: { type: "string" },
  },
};

export const MODULE_FILL_SYSTEM = `You choose the products one block of a page of the APSOparts shop shows (a product row, a bento of
product cards). You pick ONLY among the CANDIDATES below, by their 8-digit number - never a number that is not in the list,
never a product you know from elsewhere. Pick the ones that fit the page's subject and the person's ask best; among
equally fitting ones prefer those bought more, then those viewed more. Put the strongest first. Pick as many as asked when
enough fit; fewer when fewer fit.
Then write, in the page's language, a short small line above the block (1-3 words, e.g. "Beliebt", "Sortiment") and the
block's title (at most 6 words) - plain words about what the products are. No prices, no discounts, no stock or delivery
promises, no claims the candidates' names do not carry. "why": one sentence in English for the person (why these).`;

/** The question: the page, the block, the ask, the candidates with their figures. */
export function moduleFillUser(page: string, input: Record<string, unknown>): string {
  const cands = candidatesIn(input.candidates);
  const type = isModuleType(input.type) ? input.type : "row";
  const count = Math.max(1, Math.min(12, Number(input.count) || 5));
  return `${page}

THE BLOCK: ${kindOf(type).name} - it shows ${count} products.${str(input.ask, 400) ? `\nTHE PERSON'S ASK: ${str(input.ask, 400)}` : ""}${str(input.category, 200) ? `\nTHE CATEGORY CHOSEN: ${str(input.category, 200)}` : ""}

CANDIDATES (number · name · page views · articles bought online, last months · where it comes from):
${cands.map((c) => `${c.number} · ${c.name} · ${c.views} views · ${c.bought} bought · ${c.from}`).join("\n") || "(none)"}`;
}
