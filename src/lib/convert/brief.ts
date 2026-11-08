// APSOconvert > WHAT STOPS BUYERS - the AI reads the period's problem pages (Problems: views, cart rate against the
// typical one, the customers who opened a page and did not order, where they stopped, why each page is on the list) and
// groups them into a few themes: what they share, the numbers that say so, and what to test first - each with its
// pages. Asked at a person's click only; the answer is kept per period (apsomh_convert_briefs), so it is paid for once.

import { getPool, query } from "@/lib/db/client";
import { KIND_LABEL, STEP_LABEL, sortProblems, type Step } from "./model";
import { buildProblems } from "./problems";
import { RULES, SHOP_FACTS, ask, type AiResult } from "./studio";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS apsomh_convert_briefs (
  win text PRIMARY KEY,
  data jsonb NOT NULL,
  by_whom text,
  at timestamptz NOT NULL DEFAULT now()
);`;
let ready: Promise<void> | null = null;
function ensure(): Promise<void> {
  ready ??= getPool().query(SCHEMA).then(() => undefined).catch((e) => { ready = null; throw e; });
  return ready;
}

export type BriefTheme = { title: string; why: string; test: string; keys: string[] };
export type Brief = { from: string; to: string; headline: string; themes: BriefTheme[]; pages: number; at: string; by: string | null };

const win = (from: string, to: string) => `${from}..${to}`;

export async function getBrief(from: string, to: string): Promise<Brief | null> {
  await ensure();
  const r = await query<{ data: Brief; by_whom: string | null; at: Date }>(`SELECT data, by_whom, at FROM apsomh_convert_briefs WHERE win = $1`, [win(from, to)]);
  const x = r.rows[0];
  return x ? { ...x.data, by: x.by_whom, at: new Date(x.at).toISOString() } : null;
}

const BRIEF_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "themes"],
  properties: {
    headline: { type: "string", description: "What stops buyers this period, in one plain sentence with the main number, English" },
    themes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "why", "test", "keys"],
        properties: {
          title: { type: "string", description: "The theme in under 8 words, English" },
          why: { type: "string", description: "What these pages share and the numbers that show it (views, cart rate vs typical, customers lost, the step they stop at), English, 1-2 sentences" },
          test: { type: "string", description: "What to test first on these pages, concretely, English, 1 sentence" },
          keys: { type: "array", items: { type: "string" }, description: "The page keys from the list (e.g. product:12202510) that belong to this theme, most important first" },
        },
      },
    },
  },
};

const pct = (r: number | null) => (r === null ? "-" : `${(r * 100).toFixed(1)}%`);

export async function makeBrief(from: string, to: string, by: string): Promise<AiResult<Brief>> {
  await ensure();
  const data = await buildProblems(from, to);
  const flagged = (sortProblems(data.pages.filter((p) => p.reasons.length > 0), "missed") as typeof data.pages).slice(0, 40);
  if (!flagged.length) return { ok: false, error: "No page is on the problem list for this period." };
  const lines = flagged.map((p) => [
    p.key, KIND_LABEL[p.kind], (p.name || p.path).slice(0, 80), `views ${p.views}`, `cart rate ${pct(p.rate)} (typical ${pct(p.typical)})`,
    `add-to-carts missed ${p.missed}`,
    p.shop ? `customers ${p.shop.companies}, lost ${p.shop.lost}${p.shop.topLoss ? `, most stopped at "${STEP_LABEL[p.shop.topLoss as Step]}"` : ""}` : "no signed-in customer seen",
    p.reasons[0] ?? "",
  ].join(" | "));
  const system = `You are the conversion analyst of a B2B web shop. You get the period's problem pages - pages with a lot of
traffic and little buying, or signed-in customers who opened them and did not order - and group them into 3 to 5 THEMES
a team can act on (for example the same missing information, the same step where customers stop, the same kind of page).
Each theme names the pages that belong to it by their key, exactly as given. Put the theme that loses the most first.

${SHOP_FACTS}

${RULES}`;
  const user = `PERIOD: ${data.from} to ${data.to}
Typical cart rate: product pages ${pct(data.typical.product)}, categories ${pct(data.typical.category)}
${data.ga4.ok ? "" : "Google Analytics did not answer - the views and cart rates are missing; the customers' steps are there.\n"}
THE PROBLEM PAGES (key | kind | name | views | cart rate | missed | customers | why on the list), most add-to-carts missed first:
${lines.join("\n")}`;
  const r = await ask<{ headline: string; themes: BriefTheme[] }>(system, user, BRIEF_SCHEMA, 8000);
  if (!r.ok) return r;
  const known = new Set(flagged.map((p) => p.key));
  const themes = (r.data.themes ?? []).slice(0, 5).map((t) => ({
    title: String(t.title ?? "").slice(0, 120), why: String(t.why ?? "").slice(0, 600), test: String(t.test ?? "").slice(0, 400),
    keys: [...new Set((t.keys ?? []).filter((k) => known.has(k)))].slice(0, 12),
  })).filter((t) => t.title && t.keys.length);
  if (!themes.length) return { ok: false, error: "The AI's answer named none of the pages - ask again." };
  const brief: Brief = { from: data.from, to: data.to, headline: String(r.data.headline ?? "").slice(0, 300), themes, pages: flagged.length, at: new Date().toISOString(), by };
  await query(
    `INSERT INTO apsomh_convert_briefs (win, data, by_whom) VALUES ($1, $2::jsonb, $3)
     ON CONFLICT (win) DO UPDATE SET data = EXCLUDED.data, by_whom = EXCLUDED.by_whom, at = now()`,
    [win(from, to), JSON.stringify(brief), by],
  );
  return { ok: true, data: brief };
}
