"use client";
// "FILL IT WITH AI" FOR ONE MODULE - the studio's side (Content v11, SARCLA 10.11.2026: "I can't see launch the AI to fill
// me the block").
//
// One way to have the AI fill a module, whoever asks: the pink button at the top of its settings, the chip's "Ask AI" (and
// the assistant's asks) with the module selected, and the pass after "Write it all again" that leaves no module "Not on
// the page yet". The AI writes its words from the page (the `module_words` task, lib .../modules/words.ts); then:
//   1. AT ONCE on the page: the module with its new words - one line in "Changes made here", its Undo bringing the old
//      settings back (a click shows its result at once)
//   2. a module of the shop's products, categories, photo or teasers still lacking them: filled from the shop the way a
//      plan's module is (`plan_fill`, then the other ways lib .../plan/newpage.ts fillTries gives), landing as it comes
// While it works, its row, its settings' button and its block on the page say so (`busy`).

import { useRef } from "react";
import type { StudioApi } from "../../../useStudio";
import { pageDoc, viewOf, withChange, withView, type PageDoc } from "@/lib/content/studio/kinds/page/model";
import { kindOf, moduleGap, moduleOfChange, type Card, type ModuleRef } from "@/lib/content/studio/kinds/page/modules/model";
import { applyModuleWords, nowWords, type ModuleWords } from "@/lib/content/studio/kinds/page/modules/words";
import { fitModuleOf } from "@/lib/content/studio/kinds/page/plan/library";
import { shopFills } from "@/lib/content/studio/kinds/page/plan/fillable";
import { fillTries } from "@/lib/content/studio/kinds/page/plan/newpage";
import { withFill } from "@/lib/content/studio/kinds/page/plan/plan";
import { moduleChangeOf } from "./useModules";

const NP = "np:";
export const AI_FILLING = "Filling it with AI…";
export const AI_WRITING = "Writing it again with AI…";

/** What a fill ended with: whether the module stands full, and what to tell the person. */
export type ModuleAiOut = { ok: boolean; full: boolean; text: string };

/** The module at a key in a store view's version: a new page's ("np:<id>") or a change's (its id). */
export function moduleAt(d: PageDoc, key: string): ModuleRef | null {
  if (key.startsWith(NP)) return (d.fields.modules ?? []).find((x) => x.id === key.slice(NP.length))?.module ?? null;
  const c = d.changes.find((x) => x.id === key);
  return c ? moduleOfChange(c) : null;
}
/** The version with the module at a key put back (a change drawn again). */
export function withModuleAt(d: PageDoc, key: string, m: ModuleRef): PageDoc {
  if (key.startsWith(NP)) return { ...d, fields: { ...d.fields, modules: (d.fields.modules ?? []).map((x) => (x.id === key.slice(NP.length) ? { ...x, module: m } : x)) } };
  const c = d.changes.find((x) => x.id === key);
  return c ? { ...d, changes: withChange(d.changes, moduleChangeOf(c, m)) } : d;
}
const lower = (t: string) => (t ? `${t.charAt(0).toLowerCase()}${t.slice(1)}` : t);

export function useModuleAi(o: {
  api: StudioApi;
  /** the store view shown */
  lang: () => string;
  /** a line in "Changes made here" with the document before it (its Undo) */
  record: (label: string, before: PageDoc, note?: string) => void;
  /** what the module's row, its settings and its block say while it works ("" / null: done) */
  busy: (key: string, text: string | null) => void;
}) {
  const ref = useRef(o);
  ref.current = o;
  const running = useRef(new Set<string>());

  /** The module's version put back - the latest document, its store view. `label`: a line in "Changes made here". */
  const put = (forLang: string, key: string, make: (m: ModuleRef) => ModuleRef, label?: string, note?: string): boolean => {
    let done = false;
    ref.current.api.setDoc((raw: unknown) => {
      const cur = pageDoc(raw, ref.current.api.data.piece.language);
      const v = viewOf(cur, forLang);
      const m = moduleAt(v, key);
      // taken out meanwhile: it stays out
      if (!m) return raw;
      done = true;
      if (label) ref.current.record(label, cur, note);
      return withView(cur, forLang, withModuleAt(v, key, make(m)));
    });
    return done;
  };

  /**
   * The module at `key` filled by the AI from the page (`request`: what the person asked, if anything). Its words land at
   * once; a module of the shop's products or categories then fills from the shop. Returns what to tell the person.
   */
  const fill = async (key: string, request = ""): Promise<ModuleAiOut> => {
    const api = ref.current.api;
    if (!api.data.ai || !api.data.access.canEdit) return { ok: false, full: false, text: "The AI is not set up on this hub." };
    if (running.current.has(key)) return { ok: false, full: false, text: "The AI is filling it already." };
    const forLang = ref.current.lang();
    const m0 = moduleAt(viewOf(pageDoc(latestRaw(api), api.data.piece.language), forLang), key);
    if (!m0) return { ok: false, full: false, text: "That module is not on the page any more." };
    const name = kindOf(m0.type).name;
    const again = !moduleGap(m0);
    running.current.add(key);
    ref.current.busy(key, again ? AI_WRITING : AI_FILLING);
    try {
      const r = await api.ai<ModuleWords>("module_words", { lang: forLang, key, type: m0.type, now: nowWords(m0), request: request.slice(0, 1500) });
      if (!r.ok) return { ok: false, full: false, text: r.error };
      const a = r.result;
      // 1. its words, at once
      let m1: ModuleRef | null = null;
      const landed = put(forLang, key, (m) => (m1 = applyModuleWords(m, a)), `AI ${again ? "wrote" : "filled"} the ${lower(name)}`, (a.note || request || "").slice(0, 160) || undefined);
      if (!landed || !m1) return { ok: false, full: false, text: "The module was taken out meanwhile." };
      // 2. its products, categories, photo or teasers from the shop, when it still lacks them
      let lack = moduleGap(m1);
      const lib = kindOf(m0.type);
      if (lack && shopFills(lib)) {
        ref.current.busy(key, "Filling it from the shop…");
        for (const t of fillTries({ module: m0.type, fill: a.fill, layout: (m1 as ModuleRef).settings.layout })) {
          // the person's module keeps its kind: only the ways that fill THIS module
          if (t.module !== m0.type) continue;
          const f = await api.act<{ items: Card[]; feature: Card | null; note: string; missing: string[] }>("plan_fill", { lang: forLang, module: t.module, shop: true, fill: t.fill, count: t.fill.count });
          if (!f.ok) { lack = f.error; continue; }
          let full = false;
          put(forLang, key, (m) => { const next = fitModuleOf(withFill(m, f.result, t.fill)).m; lack = moduleGap(next); full = !lack; return full ? next : m; });
          if (full) break;
        }
      }
      const said = [a.note, ...a.problems.map((p) => `${p.replace(/[.\s]+$/, "")}.`)].filter(Boolean).join(" ");
      if (lack) return { ok: true, full: false, text: `${said ? `${said} ` : ""}It still lacks something: ${lower(lack).replace(/[.\s]+$/, "")}.` };
      return { ok: true, full: true, text: said || `The AI ${again ? "wrote" : "filled"} the ${lower(name)} from the page.` };
    } finally {
      running.current.delete(key);
      ref.current.busy(key, null);
    }
  };

  /**
   * After a whole-page write (Content v11, SARCLA 10.11.2026: a "Campaign with its dates" stayed "Not on the page yet"
   * after "Write it all again"): every module of the page still lacking something is filled by the AI, one after the
   * other; one it cannot fill is taken off the page (its line in "Changes made here" has the Undo). Returns what was said.
   */
  const fillLeft = async (forLang: string): Promise<string[]> => {
    const said: string[] = [];
    const api = ref.current.api;
    const keys = (viewOf(pageDoc(latestRaw(api), api.data.piece.language), forLang).fields.modules ?? []).filter((x) => moduleGap(x.module)).map((x) => `${NP}${x.id}`);
    for (const key of keys) {
      const now = moduleAt(viewOf(pageDoc(latestRaw(api), api.data.piece.language), forLang), key);
      if (!now || !moduleGap(now)) continue;
      const r = await fill(key);
      if (r.full) continue;
      const name = kindOf(now.type).name;
      const why = r.text.replace(/^.*It still lacks something: /, "").replace(/[.\s]+$/, "") || "the page gives nothing to fill it with";
      ref.current.api.setDoc((raw: unknown) => {
        const cur = pageDoc(raw, ref.current.api.data.piece.language);
        const v = viewOf(cur, forLang);
        const list = v.fields.modules ?? [];
        const id = key.slice(NP.length);
        if (!list.some((x) => x.id === id && moduleGap(x.module))) return raw;
        ref.current.record(`AI left out the ${lower(name)}`, cur, `The AI could not fill it: ${lower(why)}.`.slice(0, 160));
        return withView(cur, forLang, { ...v, fields: { ...v.fields, modules: list.filter((x) => x.id !== id) } });
      });
      said.push(`The ${lower(name)} was left out: the AI could not fill it (${lower(why)}).`);
    }
    return said;
  };

  return { fill, fillLeft };
}

/** The document as last set (setDoc's own latest), even before React has drawn it. */
function latestRaw(api: StudioApi): unknown {
  let raw: unknown = api.doc;
  api.setDoc((r: unknown) => { raw = r; return r; });
  return raw;
}

export type ModuleAiCtl = ReturnType<typeof useModuleAi>;
