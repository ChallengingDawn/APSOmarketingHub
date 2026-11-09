"use client";
// THE MODULE GALLERY IN THE PAGE STUDIO (Content v6, SARCLA 09.11.2026 points 7, 8, 9): "On this CMS we should be able to
// add new modules and replace the old one - a gallery of forms like bentos and much more", "fill the product ... by
// hierarchy, most viewed / most bought, automatically or by article or product number, with AI", "we should really be
// able to add elements".
//
// Where a module lives:
//   a page of the shop  a CHANGE (the shared interface of Content v6, src/lib/content/studio/kinds/page/model.ts):
//                       insertChange at a place, or replaceChange of an element (the element hidden, kept - builder A
//                       applies it), its settings beside it (`module`) so it opens again here. While it still lacks what
//                       it needs (no products yet, no headline) it is kept OFF (`off`: not in the preview, not in Magento)
//   a new page          one of its fields' modules (fields.ts PageModule), after one of its blocks - drawn by the new
//                       page's renderer (newpage.ts); one that lacks something shows as a quiet slot, never in Magento
// This hook holds the gallery (open for a place) and the module being edited; ./Gallery.tsx and ./Panel.tsx draw them.

import { useRef, useState } from "react";
import type { PageModule } from "@/lib/content/studio/kinds/page/fields";
import { insertChange, isLive, replaceChange, withChange, type PageChange, type PageDoc } from "@/lib/content/studio/kinds/page/model";
import { kindOf, moduleGap, moduleId, moduleOfChange, newModule, type ModuleRef, type ModuleType } from "@/lib/content/studio/kinds/page/modules/model";
import { renderModule } from "@/lib/content/studio/kinds/page/modules/render";

export type Where = "before" | "after" | "prepend" | "append";
/** Where the gallery's module goes: at a place of a page of the shop, in place of one of its elements, or after a block of
 * a new page ("" = above them all). */
export type GalleryAsk =
  | { how: "insert"; selector: string; where: Where; label?: string }
  | { how: "replace"; selector: string; label?: string }
  | { how: "block"; after: string; label?: string };

/** The module being edited, wherever it lives. */
export type Editing = { module: ModuleRef; replace: boolean; live: boolean };

export type ModulesCtl = {
  gallery: GalleryAsk | null;
  openGallery: (a: GalleryAsk) => void;
  closeGallery: () => void;
  /** a module picked in the gallery: put on the page, its panel opened (it fills itself where it can) */
  pick: (type: ModuleType) => void;
  /** what is edited: a change's id, or "np:<id>" for a new page's module */
  editing: string | null;
  edit: (id: string | null) => void;
  current: () => Editing | null;
  /** the module saved again: drawn, put in its place (`label` = a line in "Changes made here") */
  save: (m: ModuleRef, label?: string) => void;
  remove: () => void;
  /** a fill to run once the panel opens (a module just added) */
  autoFill: string | null;
  clearAutoFill: () => void;
  store: string;
  canEdit: boolean;
};

const NP = "np:";

/** The change a module stands in, drawn again: its HTML, its line, and OFF while it lacks what it needs. */
export function moduleChangeOf(old: PageChange, m: ModuleRef): PageChange {
  const gap = moduleGap(m);
  const note = `${kindOf(m.type).name}${m.settings.title.trim() ? `: ${m.settings.title.trim().slice(0, 80)}` : ""}`;
  const next = { ...old, html: renderModule(m), note, module: m } as PageChange & { off?: string };
  if (gap) next.off = `Not on the page yet: ${gap.toLowerCase()}.`;
  else delete next.off;
  return next;
}

export function useModules(o: {
  /** the store view shown, as a whole page document */
  view: () => PageDoc;
  /** the view put back, with a line for "Changes made here" */
  put: (next: PageDoc, label: string) => void;
  store: string;
  canEdit: boolean;
}): ModulesCtl {
  const [gallery, setGallery] = useState<GalleryAsk | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [autoFill, setAutoFill] = useState<string | null>(null);
  const ref = useRef(o);
  ref.current = o;

  const pageModules = (d: PageDoc): PageModule[] => d.fields.modules ?? [];
  const withModules = (d: PageDoc, modules: PageModule[]): PageDoc => ({ ...d, fields: { ...d.fields, modules } });

  const current = (): Editing | null => {
    if (!editing) return null;
    const d = ref.current.view();
    if (editing.startsWith(NP)) {
      const pm = pageModules(d).find((x) => x.id === editing.slice(NP.length));
      return pm ? { module: pm.module, replace: false, live: !moduleGap(pm.module) } : null;
    }
    const change = d.changes.find((c) => c.id === editing);
    const module = change ? moduleOfChange(change) : null;
    return change && module ? { module, replace: change.op === "replace", live: isLive(change) } : null;
  };

  const pick = (type: ModuleType) => {
    const a = gallery;
    if (!a) return;
    const m = newModule(type, ref.current.store);
    const name = kindOf(type).name.toLowerCase();
    const d = ref.current.view();
    let key: string;
    if (a.how === "block") {
      const id = moduleId();
      key = `${NP}${id}`;
      ref.current.put(withModules(d, [...pageModules(d), { id, after: a.after, module: m }]), `Added a ${name}`);
    } else {
      const html = renderModule(m);
      const c = moduleChangeOf(a.how === "replace" ? replaceChange(a.selector, html, { module: m }) : insertChange(a.selector, a.where, html, { module: m }), m);
      key = c.id ?? "";
      ref.current.put({ ...d, changes: withChange(d.changes, c) }, a.how === "replace" ? `Replaced an element with a ${name}` : `Added a ${name}`);
    }
    setGallery(null);
    setEditing(key);
    setAutoFill(key);
  };

  const save = (m: ModuleRef, label?: string) => {
    const d = ref.current.view();
    const line = label ?? `Changed the ${kindOf(m.type).name.toLowerCase()}`;
    if (editing?.startsWith(NP)) {
      const id = editing.slice(NP.length);
      if (!pageModules(d).some((x) => x.id === id)) return;
      ref.current.put(withModules(d, pageModules(d).map((x) => (x.id === id ? { ...x, module: m } : x))), line);
      return;
    }
    const old = d.changes.find((c) => c.id === editing);
    if (!old) return;
    ref.current.put({ ...d, changes: withChange(d.changes, moduleChangeOf(old, m)) }, line);
  };

  const remove = () => {
    const d = ref.current.view();
    const cur = current();
    if (!cur || !editing) return;
    const name = kindOf(cur.module.type).name.toLowerCase();
    if (editing.startsWith(NP)) ref.current.put(withModules(d, pageModules(d).filter((x) => x.id !== editing.slice(NP.length))), `Took the ${name} out`);
    else ref.current.put({ ...d, changes: d.changes.filter((c) => c.id !== editing) }, `Took the ${name} out${cur.replace ? " - the page's element is back" : ""}`);
    setEditing(null);
  };

  return {
    gallery, openGallery: setGallery, closeGallery: () => setGallery(null), pick,
    editing, edit: setEditing, current, save, remove,
    autoFill, clearAutoFill: () => setAutoFill(null),
    store: o.store, canEdit: o.canEdit,
  };
}
