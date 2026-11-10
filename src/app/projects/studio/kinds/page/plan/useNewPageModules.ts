"use client";
// A NEW PAGE'S MODULES, WRITTEN WITH IT - the studio's side (Content v8, 10.11.2026; SARCLA point 5: "When the AI is
// generating a new page it should also generate the modules").
//
// The whole-page write (`fill_page`, src/lib/content/studio/kinds/page/plan/newpage.ts) answers with the text blocks AND
// 2 to 4 modules of the library. Here:
//   1. in the same save as the words: each module put on the page after its block (or in place of one), its words in -
//      a module of the shop's products, categories or photos marked "Filling it from the shop…" at once, so the page
//      shows its skeleton moving in its place from the first moment (never an empty gap, never "nothing happened")
//   2. filled from the shop one after the other (the `plan_fill` action: the category, most bought, most viewed - the
//      clearance filter applies, ../../../../../lib/content/studio/kinds/page/plan/fill.ts), each landing as it comes,
//      with a line in "Changes made here" (its Undo)
//   3. one that cannot be filled is tried another way (lib .../plan/newpage.ts fillTries), else taken off the page with the reason in
//      plain words and its Undo (Content v9: no "not on the page yet" module from the AI)

import { useRef, useState } from "react";
import type { StudioApi } from "../../../useStudio";
import type { Fields } from "@/lib/content/studio/kinds/page/fields";
import { pageDoc, viewOf, withView, type PageDoc } from "@/lib/content/studio/kinds/page/model";
import { fitModuleOf, libModule, moduleGapOf } from "@/lib/content/studio/kinds/page/plan/library";
import { composeModules, fillTries, moduleOfStep, needsShop, type NewPageModule } from "@/lib/content/studio/kinds/page/plan/newpage";
import { withFill } from "@/lib/content/studio/kinds/page/plan/plan";
import type { Card } from "@/lib/content/studio/kinds/page/modules/types";

const FILLING = "Filling it from the shop…";
const WAITING = "Waiting for its turn…";

type Placed = { id: string; step: NewPageModule };
type ByLang = Record<string, Record<string, string>>;

/** A page module id the AI's modules carry ("ai" + letters and digits - ./newpage.ts isAiModule). */
const aiId = () => `ai${Math.random().toString(36).slice(2, 9)}`;

export function useNewPageModules(o: {
  api: StudioApi;
  /** a line in "Changes made here", with the document before it (its Undo) */
  record: (label: string, before: PageDoc, note?: string) => void;
}) {
  const [busy, setBusy] = useState<ByLang>({});
  const [why, setWhy] = useState<ByLang>({});
  const ref = useRef(o);
  ref.current = o;

  const put = (set: (f: (x: ByLang) => ByLang) => void, lang: string, id: string, text: string | null) => set((x) => {
    const l = { ...(x[lang] ?? {}) };
    if (text) l[id] = text; else delete l[id];
    return { ...x, [lang]: l };
  });

  /** The write's modules laid into its fields (pure, for the same save as the words); those that need the shop are marked
   * at once, so their skeleton moves from the first drawing. */
  const place = (fields: Fields, mods: NewPageModule[], lang: string): { fields: Fields; placed: Placed[]; problems: string[] } => {
    const c = composeModules(fields, mods, lang, aiId);
    const shop = c.placed.filter((p) => needsShop(p.step.module));
    if (shop.length) setBusy((x) => ({ ...x, [lang]: { ...(x[lang] ?? {}), ...Object.fromEntries(shop.map((p, i) => [p.id, i ? WAITING : FILLING])) } }));
    return c;
  };

  /** Each module of the shop's products, categories or photos filled, one after the other, landing as it comes - FULL, or
   * not on the page (Content v9, SARCLA 10.11.2026: the AI's modules filled fully; no "not on the page yet" module from
   * the AI): the AI's own fill first, then the other ways ./newpage.ts fillTries gives; none fills it: it is taken off the
   * page, with its line in "Changes made here" (its Undo) and the reason said. */
  const fillAll = async (lang: string, placed: Placed[]): Promise<string[]> => {
    const said: string[] = [];
    const todo = placed.filter((p) => needsShop(p.step.module));
    for (const p of todo) {
      put(setBusy, lang, p.id, FILLING);
      const name = (libModule(p.step.module)?.name ?? "module").toLowerCase();
      let done = false;
      let gone = false;
      let last = "";
      for (const t of fillTries(p.step)) {
        const r = await ref.current.api.act<{ items: Card[]; feature: Card | null; note: string; missing: string[] }>("plan_fill", {
          lang, module: t.module, shop: true, fill: t.fill, count: t.fill.count,
        });
        if (!r.ok) { last = r.error; continue; }
        // what it would be with this fill - on the page only when it is full
        const base = t.module === p.step.module ? null : moduleOfStep({ ...p.step, module: t.module, layout: t.layout }, lang);
        let full = false;
        ref.current.api.setDoc((raw: unknown) => {
          const cur = pageDoc(raw, ref.current.api.data.piece.language);
          const v = viewOf(cur, lang);
          const list = v.fields.modules ?? [];
          const pm = list.find((x) => x.id === p.id);
          // taken out meanwhile: it stays out
          if (!pm) { gone = true; return raw; }
          const m = fitModuleOf(withFill(base ?? pm.module, r.result, t.fill)).m;
          const gap = moduleGapOf(m);
          if (gap) { last = gap; return raw; }
          full = true;
          const what = t.why ? `${t.why} (its own fill gave nothing)` : r.result.note;
          ref.current.record(`AI filled the ${name} from the shop`, cur, what.slice(0, 160) || undefined);
          return withView(cur, lang, { ...v, fields: { ...v.fields, modules: list.map((x) => (x.id === p.id ? { ...x, module: m } : x)) } });
        });
        if (gone || full) { done = full; break; }
      }
      put(setBusy, lang, p.id, null);
      put(setWhy, lang, p.id, null);
      if (done || gone) continue;
      // none filled it: off the page (its Undo in "Changes made here"), and said
      const why = last ? `${last.charAt(0).toLowerCase()}${last.slice(1).replace(/[.\s]+$/, "")}` : "the shop gave nothing for it";
      ref.current.api.setDoc((raw: unknown) => {
        const cur = pageDoc(raw, ref.current.api.data.piece.language);
        const v = viewOf(cur, lang);
        const list = v.fields.modules ?? [];
        if (!list.some((x) => x.id === p.id)) return raw;
        ref.current.record(`AI left out the ${name}`, cur, `The shop could not fill it: ${why}.`.slice(0, 160));
        return withView(cur, lang, { ...v, fields: { ...v.fields, modules: list.filter((x) => x.id !== p.id) } });
      });
      said.push(`The ${name} was left out: the shop could not fill it (${why}).`);
    }
    return said;
  };

  return {
    place, fillAll,
    /** what fills now in a store view (page module id -> words), and why one could not */
    busyFor: (lang: string) => busy[lang] ?? {},
    whyFor: (lang: string) => why[lang] ?? {},
  };
}

export type NewPageModulesCtl = ReturnType<typeof useNewPageModules>;
