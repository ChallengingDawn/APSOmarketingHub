// PAGE - A NEW PAGE'S MODULES TRANSLATED WITH IT (Content v13, 11.11.2026). Pure: relative imports only - the
// translation task (../server.ts translate) and tests/studio-page-translate-modules.test.ts.
//
// SARCLA 11.11.2026 (screenshot 29, the Kalrez page in German: the questions, "REPLACEMENTS", "Two products side by side",
// "Last order date" all still in English): "translation didn't translate the modules in any languages". A new page's
// translation sent its own fields only (../fields.ts fieldStrings) - its modules (fields.modules) kept the main
// language's words. Now each module's WORDS go with it, by id "mod.<module id>.<path>": its small line, headline, line,
// buttons' words, points / tiles, questions and answers, table words, its tiles' button words ("w-..."), the free words
// among its own settings and the elements added in it. Never translated: dates, addresses, colours, looks, a choice
// among options, products (they are the shop's - read again in the store view, ./Panel "Finding the same products").

import { kindOf } from "./model";
import type { ModuleRef } from "./types";

export type ModItem = { id: string; text: string };

const DATE_KEYS = new Set(["from", "to", "until", "date", "start", "end"]);
/** settings kept as they are: looks, a button's look, open / split, the ground, a flag */
const KEEP = /^(look-|btn-|open$|split$|bg$|bgpic$|reword$)/;
const WORDY = /\p{L}{2,}/u;

/** Is this own setting of the module words to translate (not a date, a look, a choice among options)? */
function wordExtra(m: ModuleRef, key: string, value: string): boolean {
  if (!WORDY.test(value) || KEEP.test(key) || DATE_KEYS.has(key)) return false;
  if (key.startsWith("w-")) return true;
  const spec = kindOf(m.type).fields.find((f) => f.kind === "extra" && f.key === key) as { options?: unknown[]; label?: string } | undefined;
  if (!spec || (Array.isArray(spec.options) && spec.options.length)) return false;
  return !/^(starts?|ends?|date|until)\b/i.test(spec.label ?? "");
}

/** One module's words, by id. */
export function moduleStrings(id: string, m: ModuleRef): ModItem[] {
  const s = m.settings;
  const out: ModItem[] = [];
  const add = (path: string, t: unknown) => { if (typeof t === "string" && t.trim()) out.push({ id: `mod.${id}.${path}`, text: t }); };
  add("eyebrow", s.eyebrow); add("title", s.title); add("text", s.text);
  add("link.label", s.link?.label); add("link2.label", s.link2?.label);
  (s.points ?? []).forEach((p, i) => { add(`points.${i}.title`, p.title); add(`points.${i}.text`, p.text); });
  (s.faq ?? []).forEach((q, i) => { add(`faq.${i}.q`, q.q); add(`faq.${i}.a`, q.a); });
  (s.table ?? []).forEach((r, i) => r.forEach((c, j) => { if (WORDY.test(c)) add(`table.${i}.${j}`, c); }));
  for (const [k, v] of Object.entries(s.extra ?? {})) if (wordExtra(m, k, String(v ?? ""))) add(`extra.${k}`, v);
  (s.adds ?? []).forEach((a, i) => add(`adds.${i}.text`, a.text));
  return out;
}

/** All the modules' words of a page. */
export function modulesStrings(mods: readonly { id: string; module: ModuleRef }[] | undefined): ModItem[] {
  return (mods ?? []).flatMap((pm) => moduleStrings(pm.id, pm.module));
}

/** One module with its words put back by path - only paths it lists as words (never an address, a date or a look). */
export function withModuleStrings(id: string, m: ModuleRef, items: readonly ModItem[]): ModuleRef {
  const allowed = new Set(moduleStrings(id, m).map((x) => x.id));
  const mine = items.filter((x) => allowed.has(x.id) && typeof x.text === "string" && x.text.trim());
  if (!mine.length) return m;
  const s = {
    ...m.settings,
    link: { ...m.settings.link }, link2: { ...m.settings.link2 },
    points: (m.settings.points ?? []).map((p) => ({ ...p })), faq: (m.settings.faq ?? []).map((q) => ({ ...q })),
    table: (m.settings.table ?? []).map((r) => [...r]), extra: { ...(m.settings.extra ?? {}) },
    ...(m.settings.adds ? { adds: m.settings.adds.map((a) => ({ ...a })) } : {}),
  };
  for (const it of mine) {
    const path = it.id.slice(`mod.${id}.`.length).split(".");
    const t = it.text.trim();
    const [a, b, c] = path;
    if (a === "eyebrow" || a === "title" || a === "text") s[a] = t;
    else if ((a === "link" || a === "link2") && b === "label") s[a].label = t;
    else if (a === "points" && s.points[+b] && (c === "title" || c === "text")) s.points[+b][c] = t;
    else if (a === "faq" && s.faq[+b] && (c === "q" || c === "a")) s.faq[+b][c] = t;
    else if (a === "table" && s.table[+b] && s.table[+b][+c] !== undefined) s.table[+b][+c] = t;
    else if (a === "extra" && b) s.extra[path.slice(1).join(".")] = t;
    else if (a === "adds" && s.adds?.[+b] && c === "text") s.adds[+b].text = t;
  }
  return { ...m, settings: s };
}

/** The page's modules with their words translated (the list as it was, each module in its place). */
export function withModulesStrings<T extends { id: string; module: ModuleRef }>(mods: readonly T[] | undefined, items: readonly ModItem[]): T[] | undefined {
  if (!mods) return mods as undefined;
  return mods.map((pm) => ({ ...pm, module: withModuleStrings(pm.id, pm.module, items) }));
}
