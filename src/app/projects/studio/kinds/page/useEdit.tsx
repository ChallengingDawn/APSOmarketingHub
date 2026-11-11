"use client";
// THE PAGE STUDIO'S EDITING TOOLS OF CONTENT v10 (SARCLA 10.11.2026, points 2-5) - kept here so the studio itself only asks:
//
//   a text's look      a new page's field (its looks), a page of the shop's element (its look change: one stylesheet for
//                      it), a module's words (its settings' `extra`) - colour, size, weight, italic, underline, alignment,
//                      each checked against the ground it stands on (lib .../style.ts readCheck)
//   a module's button  its words, its page, its style, colour, size, arrow, new tab (lib .../modules/looks.ts)
//   switching          a block into another COMPATIBLE module of the library, its content kept (lib .../modules/switch.ts);
//                      the bar over the switched module says so, with its Undo
//   resizing           what a drag in the preview sets (./Resize.tsx): a text-and-picture block's or the hero's picture
//                      share, a tile's span, a module's two columns

import { useState } from "react";
import { removeRow, moveRow, moduleKeyOf, newPageRows, moduleFieldEdit, moduleFieldLabel, moduleWordsAt, takeOutOfModule, type BlockRow } from "@/lib/content/studio/kinds/page/blocklist";
import { SPLITS, setLook, type Fields } from "@/lib/content/studio/kinds/page/fields";
import type { PageChange, PageDoc } from "@/lib/content/studio/kinds/page/model";
import { kindOf, moduleId, moduleOfChange, type ModuleRef } from "@/lib/content/studio/kinds/page/modules/model";
import { BUTTON_LOOK_KEY, SPLIT_GRID, TEXT_LOOK_KEY, TILES_LOOK_KEY, buttonLookOf, canSplit, splitOf, textLookOf, withSplit, type ButtonField, type LookField } from "@/lib/content/studio/kinds/page/modules/looks";
import { FAMILY_WORDS, blockFamily, compatibleModules, compatibleWithBlock, familyOf, moduleFromBlock, switchModule, type SwitchOption } from "@/lib/content/studio/kinds/page/modules/switch";
import { moduleDef } from "@/lib/content/studio/kinds/page/modules/registry";
import {
  cleanButtonLook, fieldPatchOf, groundOfField, groundsOfLook, lookOfShopRules, packLook, textLookOfField, unpackLook, withShopLook,
  type ButtonLook, type TextLook,
} from "@/lib/content/studio/kinds/page/style";
import { applyElementEdit, lookCss, lookOf as elementRules } from "./edits";
import type { Picked } from "./Frame";
import type { ButtonPopProps, TextLookCtl } from "./pops";
import type { ResizeSpec } from "./Resize";
import { SwitchedBar } from "./Switch";
import { moduleChangeOf } from "./modules/useModules";
import type { StudioApi } from "../../useStudio";

export type EditCtx = {
  api: StudioApi;
  isNew: boolean;
  canEdit: boolean;
  /** the store view shown, as it is now */
  view: () => PageDoc;
  setView: (next: PageDoc, label?: string) => void;
  rows: BlockRow[];
  /** the newest change with this line in "Changes made here" undone (the switched bar's Undo) */
  undoLabel: (label: string) => void;
  /** a module's settings opened beside it ("np:<id>", or its change's id) */
  editModule: (key: string | null) => void;
};

/** A heading, or words 24 px and more: 3:1 is enough for them (WCAG's large text). */
export const isLarge = (p: Pick<Picked, "tag" | "box" | "look">) =>
  /^h[1-3]$/.test(p.tag) || /^h[1-3]$/.test(p.box?.tag ?? "") || Number.parseFloat(p.look?.size ?? "0") >= 24;
/** A new page's field that is a heading. */
const fieldLarge = (path: string) => /(^|\.)title$|Title$/.test(path);

export function useEdit(c: EditCtx) {
  const [switched, setSwitched] = useState<{ key: string; label: string } | null>(null);

  /* ── a module of the page: a new page's ("np:<id>") or one the hub put on a page of the shop ("c:<change id>") ── */

  const moduleAt = (key: string): { m: ModuleRef; put: (next: ModuleRef, label: string) => void } | null => {
    const cur = c.view();
    if (key.startsWith("np:")) {
      const id = key.slice(3);
      const pm = (cur.fields.modules ?? []).find((x) => x.id === id);
      if (!pm) return null;
      return { m: pm.module, put: (next, label) => { const v = c.view(); c.setView({ ...v, fields: { ...v.fields, modules: (v.fields.modules ?? []).map((x) => (x.id === id ? { ...x, module: next } : x)) } }, label); } };
    }
    const id = key.startsWith("c:") ? key.slice(2) : key;
    const ch = cur.changes.find((x) => x.id === id);
    const m = ch ? moduleOfChange(ch) : null;
    if (!ch || !m) return null;
    return { m, put: (next, label) => { const v = c.view(); c.setView({ ...v, changes: v.changes.map((x) => (x.id === id ? redrawn(x, next) : x)) }, label); } };
  };

  /** the module a click in the page is in: a new page's ("nt:<id>:...") or a change's (its fragment) */
  const moduleKeyOfPicked = (p: Picked): string | null => {
    if (p.key.startsWith("nt:")) return `np:${p.key.split(":")[1]}`;
    if (p.frag) { const ch = c.view().changes[p.frag.change]; if (ch?.id && moduleOfChange(ch)) return `c:${ch.id}`; }
    return null;
  };

  /* ── a text's look ───────────────────────────────────────────────────── */

  /** a new page's field */
  const fieldLook = (path: string): TextLookCtl => {
    const f = c.view().fields;
    return {
      value: textLookOfField(f.looks[path]), grounds: groundOfField(f, path), large: fieldLarge(path),
      set: (next, label) => { const v = c.view(); c.setView({ ...v, fields: setLook(v.fields, path, fieldPatchOf(next)) }, label); },
    };
  };

  /** a page of the shop's own element (not inside a change's HTML): its look as one stylesheet */
  const elementLook = (p: Picked): TextLookCtl | null => {
    if (!p.selector || p.frag) return null;
    // words inside a line (a <span> in a heading): their alignment is the line's - it goes to the block they stand in
    const line = p.box?.selector && /^(span|a|strong|b|em|i|small|label)$/.test(p.tag) ? p.box.selector : null;
    const rules = elementRules(c.view().changes, p.selector);
    const lineRules = line ? elementRules(c.view().changes, line) : {};
    const own = lookOfShopRules(rules);
    return {
      value: line ? { ...own, align: lookOfShopRules(lineRules).align } : own, grounds: groundsOfLook(p.look?.ground), large: isLarge(p),
      set: (next, label) => {
        let v = c.view();
        const edit = (pk: Picked, look: TextLook, keepAlign: boolean): boolean => {
          const cur = elementRules(v.changes, pk.selector);
          const merged = withShopLook(cur, look);
          if (!keepAlign) delete merged["text-align"];
          const r = applyElementEdit(v, pk, { kind: "look", css: lookCss(pk.selector, merged) });
          if ("error" in r) { window.alert(r.error); return false; }
          v = { ...v, changes: r.changes };
          return true;
        };
        if (!edit(p, line ? { ...next, align: undefined } : next, !line)) return;
        if (line) {
          const lp: Picked = { ...p, key: `e:${line}`, selector: line, tag: p.box?.tag ?? "div", frag: null, host: null };
          const was = lookOfShopRules(elementRules(v.changes, line));
          if (!edit(lp, { ...was, align: next.align }, true)) return;
        }
        c.setView(v, label);
      },
    };
  };

  /** which of a module's settings a click hit ("title", "link", "points.2.title", "words.all") and the words it holds -
   * null: the shop's words (a product's name). Content v12: the words compared as the page shows them (capitals, a hyphen
   * that never breaks), a tile's button told from the module's own by the page it leads to. */
  const moduleField = (p: Picked): { key: string; field: string; m: ModuleRef; words: string; label: string } | null => {
    const key = moduleKeyOfPicked(p);
    const at = key ? moduleAt(key) : null;
    if (!key || !at || !p.text.trim()) return null;
    const r = moduleWordsAt(at.m, p.text, p.href ?? null);
    return r ? { key, field: r.field, m: at.m, words: r.words, label: moduleFieldLabel(at.m, r.field) } : null;
  };

  /** a module's words (its title, small line, line under it): their look kept in its settings */
  const moduleTextLook = (p: Picked): TextLookCtl | null => {
    const hit = moduleField(p);
    if (!hit || !(hit.field in TEXT_LOOK_KEY)) return null;
    const f = hit.field as LookField;
    return {
      value: textLookOf(hit.m, f), grounds: groundsOfLook(p.look?.ground), large: f === "title" || isLarge(p),
      set: (next: TextLook, label) => {
        const at = moduleAt(hit.key);
        if (!at) return;
        const extra = { ...at.m.settings.extra };
        const packed = packLook(next);
        if (packed) extra[TEXT_LOOK_KEY[f]] = packed; else delete extra[TEXT_LOOK_KEY[f]];
        at.put({ ...at.m, settings: { ...at.m.settings, extra } }, label);
      },
    };
  };

  /** a module's button clicked on the page: what its popup needs (null when the click was not on one) */
  const moduleButton = (p: Picked): Omit<ButtonPopProps, "kicker" | "api" | "store" | "canEdit" | "onClose"> | null => {
    const hit = moduleField(p);
    if (!hit) return null;
    // a tile's button ("Alle anzeigen" on a bento's big tile): its words, kept in the module (Content v12)
    if (hit.field.startsWith("words.")) {
      const name = kindOf(hit.m.type).name.toLowerCase();
      return {
        title: "The tiles' button", label: hit.words, max: 40,
        onLabel: (v) => { const at = moduleAt(hit.key); const next = at ? moduleFieldEdit(at.m, hit.field, v) : null; if (at && next) at.put(next, `Changed the ${name}'s tile button`); },
        leads: "It leads to the page of the tile it stands on - a tile's product or category is chosen in the module's settings. Every tile of this module says these words.",
        // Content v13b (SARCLA 11.11.2026: "some buttons still don't have button options"): its look, every tile's alike
        look: cleanButtonLook(unpackLook(hit.m.settings.extra[TILES_LOOK_KEY])),
        onLook: (next: ButtonLook, label: string) => {
          const at = moduleAt(hit.key);
          if (!at) return;
          const extra = { ...at.m.settings.extra };
          const packed = packLook(next);
          if (packed) extra[TILES_LOOK_KEY] = packed; else delete extra[TILES_LOOK_KEY];
          at.put({ ...at.m, settings: { ...at.m.settings, extra } }, label);
        },
        grounds: groundsOfLook(p.look?.ground), fallback: "petrol",
        hint: "Kept in the module's settings - empty, it says the shop's own words again.",
      };
    }
    if (hit.field !== "link" && hit.field !== "link2") return null;
    const f = hit.field as ButtonField;
    const s = hit.m.settings;
    const name = kindOf(hit.m.type).name.toLowerCase();
    const putLink = (patch: Partial<{ label: string; url: string }>, label: string) => {
      const at = moduleAt(hit.key);
      if (!at) return;
      at.put({ ...at.m, settings: { ...at.m.settings, [f]: { ...at.m.settings[f], ...patch } } }, label);
    };
    return {
      title: f === "link" ? "The button" : "The second button",
      label: s[f].label, max: 60, onLabel: (v) => putLink({ label: v.slice(0, 60) }, `Changed the ${name}'s button`),
      url: s[f].url, onUrl: (v) => putLink({ url: v }, `Changed where the ${name}'s button goes`),
      look: buttonLookOf(hit.m, f), grounds: groundsOfLook(p.look?.ground), fallback: f === "link" ? "red" : "petrol", arrowDefault: f === "link",
      onLook: (next: ButtonLook, label) => {
        const at = moduleAt(hit.key);
        if (!at) return;
        const extra = { ...at.m.settings.extra };
        const packed = packLook(next);
        if (packed) extra[BUTTON_LOOK_KEY[f]] = packed; else delete extra[BUTTON_LOOK_KEY[f]];
        at.put({ ...at.m, settings: { ...at.m.settings, extra } }, label);
      },
      hint: "The module's button - kept in its settings, so it stays editable there.",
    };
  };

  /** a module's part where the click landed, taken out (Content v12, SARCLA 10.11.2026: "other small elements, I should be
   * able to delete them"): its small line, a line, a button, a date, a point, a question, a product - null where none */
  const moduleTakeOut = (p: Picked): { label: string; run: () => void } | null => {
    const key = moduleKeyOfPicked(p);
    const at = key ? moduleAt(key) : null;
    if (!key || !at) return null;
    const hit = p.text.trim() ? moduleWordsAt(at.m, p.text, p.href ?? null) : null;
    const t = takeOutOfModule(at.m, hit?.field ?? null, p.text);
    if (!t) return null;
    return {
      label: t.label,
      run: () => {
        const a = moduleAt(key);
        if (!a) return;
        const h = p.text.trim() ? moduleWordsAt(a.m, p.text, p.href ?? null) : null;
        const t2 = takeOutOfModule(a.m, h?.field ?? null, p.text);
        if (t2) a.put(t2.module, t2.done);
      },
    };
  };

  /* ── switching a block into another module (point 4) ─────────────────── */

  /** the modules a row can become, and what it keeps - null when it holds content no other module holds */
  const optionsFor = (r: BlockRow): { options: SwitchOption[]; keeps: string } | null => {
    const cur = c.view();
    if (c.isNew && r.kind === "block") {
      // the page's hero: every hero module, its title (the H1), line, button and picture kept (Content v12)
      if (r.key === "hero") return { options: compatibleWithBlock(cur.fields, r.key, cur.store), keeps: "its title (the page's H1), its line, its button and its picture" };
      const fam = blockFamily(r.key);
      if (!fam) return null;
      return { options: compatibleWithBlock(cur.fields, r.key, cur.store), keeps: FAMILY_WORDS[fam] };
    }
    const key = r.module ? (r.key.startsWith("np:") ? r.key : r.changeId ? `c:${r.changeId}` : null) : null;
    const at = key ? moduleAt(key) : null;
    const def = at ? moduleDef(at.m.type) : null;
    const fam = def ? familyOf(def) : null;
    if (!at || !fam) return null;
    return { options: compatibleModules(at.m), keeps: FAMILY_WORDS[fam] };
  };

  /** the row made another module: its content kept, its settings opened beside it, the bar with its Undo over them */
  const switchRow = (r: BlockRow, type: string) => {
    if (!c.canEdit) return;
    const to = moduleDef(type);
    if (!to) return;
    const cur = c.view();
    if (c.isNew && r.kind === "block") {
      const m = moduleFromBlock(cur.fields, r.key, type, cur.store);
      if (!m) return;
      const at = newPageRows(cur.fields).findIndex((x) => x.key === r.key);
      const id = moduleId();
      let f: Fields = removeRow(cur.fields, r.key);
      f = { ...f, modules: [...(f.modules ?? []), { id, after: "", module: m }] };
      f = moveRow(f, moduleKeyOf(id), Math.max(0, at));
      const label = `Changed ${r.name.toLowerCase()} (block ${r.num}) into ${to.name.toLowerCase()}`;
      c.setView({ ...cur, fields: f }, label);
      setSwitched({ key: moduleKeyOf(id), label });
      c.editModule(moduleKeyOf(id));
      return;
    }
    const key = r.key.startsWith("np:") ? r.key : r.changeId ? `c:${r.changeId}` : null;
    const at = key ? moduleAt(key) : null;
    if (!key || !at) return;
    const label = `Changed ${kindOf(at.m.type).name.toLowerCase()} (block ${r.num}) into ${to.name.toLowerCase()}`;
    at.put(switchModule(at.m, type), label);
    setSwitched({ key: r.key, label });
    c.editModule(key.startsWith("c:") ? key.slice(2) : key);
  };

  /** over a module's settings just after a switch: what happened, and its Undo */
  const switchedBar = (rowKey: string) => (switched && switched.key === rowKey ? (
    <SwitchedBar label={switched.label} onUndo={() => { const l = switched.label; setSwitched(null); c.undoLabel(l); }} />
  ) : null);

  /* ── resizing in the preview (point 5) ────────────────────────────────── */

  /** what a drag can resize where the selection is: a text-and-picture block's or the hero's split, a tile's span, a
   * module's two columns - null when nothing there resizes */
  const resizeFor = (sel: string | null, rowKey: string | null, whole = false): ResizeSpec | null => {
    if (!c.canEdit || !sel) return null;
    const cur = c.view();
    if (c.isNew) {
      const block = rowKey ?? "";
      const sec = block.startsWith("sections.") ? cur.fields.sections.find((s) => `sections.${s.id}` === block) : null;
      // the block itself or its picture selected (a text being written keeps its popup clear)
      const whole = sel === `b:${block}` || sel === `f:${block}.picture`;
      if (whole && ((sec && sec.picture.url) || (block === "hero" && cur.fields.hero.picture.url))) {
        const left = sec ? sec.side === "left" : false;
        const pic = cur.fields.looks[block]?.split ?? 50;
        return {
          kind: "split", key: block, grid: `[data-apx-b="${block}"] > .apx-np-in`, left: left ? pic : 100 - pic, steps: [...SPLITS],
          what: (l) => (left ? `Picture ${l} % · text ${100 - l} %` : `Text ${l} % · picture ${100 - l} %`),
          commit: (l) => {
            const share = left ? l : 100 - l;
            const v = c.view();
            if ((v.fields.looks[block]?.split ?? 50) === share) return;
            c.setView({ ...v, fields: setLook(v.fields, block, { split: share === 50 ? undefined : share }) }, `Made the picture ${share} % wide (block ${numOf(block)})`);
          },
        };
      }
      const tile = /^[fb]:benefits\.([a-z0-9]+)/i.exec(sel);
      if (tile && block === "benefits") {
        const path = `benefits.${tile[1]}`;
        return {
          kind: "span", key: path, el: `[data-apx-b="${path}"]`, span: cur.fields.looks[path]?.span ?? 1,
          commit: (n) => {
            const v = c.view();
            if ((v.fields.looks[path]?.span ?? 1) === n) return;
            c.setView({ ...v, fields: setLook(v.fields, path, { span: n > 1 ? n : undefined }) }, n > 1 ? `Made a tile ${n} columns wide` : "Made a tile one column wide");
          },
        };
      }
      // a module: when it is selected itself (its words keep their popup clear)
      if (rowKey?.startsWith("np:") && sel === rowKey) return moduleResize(rowKey, `[data-apx-mod="${rowKey.slice(3)}"]`);
      return null;
    }
    const row = rowKey ? c.rows.find((x) => x.key === rowKey) : null;
    if (whole && row?.module && row.changeId) return moduleResize(`c:${row.changeId}`, `[data-apx-c="${row.change}"]:not(style)`);
    return null;
  };
  const numOf = (key: string) => c.rows.find((x) => x.key === key)?.num ?? "";
  const moduleResize = (key: string, host: string): ResizeSpec | null => {
    const at = moduleAt(key);
    if (!at || !canSplit(at.m)) return null;
    const g = SPLIT_SEL[at.m.type];
    if (!g) return null;
    const left = splitOf(at.m);
    return {
      kind: "split", key, grid: `${host} .apx-${at.m.settings.id} ${g}`, left: left ?? null, steps: [25, 33, 50, 66, 75],
      what: (l) => `${l} % · ${100 - l} %`,
      commit: (l) => {
        const a = moduleAt(key);
        if (!a || splitOf(a.m) === l) return;
        a.put(withSplit(a.m, l), `Made the ${kindOf(a.m.type).name.toLowerCase()}'s columns ${l} / ${100 - l}`);
      },
    };
  };

  return { fieldLook, elementLook, moduleTextLook, moduleButton, moduleField, moduleTakeOut, optionsFor, switchRow, switchedBar, resizeFor, moduleAt, clearSwitched: () => setSwitched(null) };
}

/** The grid of a module's two columns (lib .../modules/looks.ts SPLIT_GRID). */
const SPLIT_SEL: Record<string, string> = Object.fromEntries(Object.entries(SPLIT_GRID).map(([k, v]) => [k, v.sel]));

/** A module's change drawn again from its settings (the library's own way: modules/useModules.ts moduleChangeOf). */
const redrawn = (ch: PageChange, m: ModuleRef): PageChange => moduleChangeOf(ch, m);
