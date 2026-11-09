"use client";
// THE MODULE GALLERY IN THE PAGE BUILDER (Content v6, SARCLA 09.11.2026 points 7, 8, 9): "On this CMS we should be able to
// add new modules and replace the old one - a gallery of forms like bentos and much more", "fill the product ... by
// hierarchy, most viewed / most bought, automatically or by article or product number, with AI", "we should really be
// able to add elements".
//
// A module on a page of the shop is a CHANGE (the shared interface of Content v6, ../../../../../lib/content/studio/kinds/
// page/model.ts): insertChange at a place, or replaceChange of an element (the element hidden, kept - builder A applies
// it), its settings beside it (`module`) so it opens again here. While it still lacks what it needs (no products yet, no
// headline) it is kept OFF (`off`: not in the preview, not in Magento) and its panel says what is missing.
// This hook holds the gallery (open for a place) and the module being edited; ./Gallery.tsx and ./Panel.tsx draw them.

import { useRef, useState } from "react";
import { insertChange, replaceChange, withChange, type PageChange, type PageDoc } from "@/lib/content/studio/kinds/page/model";
import { kindOf, moduleGap, moduleOfChange, newModule, type ModuleRef, type ModuleType } from "@/lib/content/studio/kinds/page/modules/model";
import { renderModule } from "@/lib/content/studio/kinds/page/modules/render";

export type Where = "before" | "after" | "prepend" | "append";
/** Where the gallery's module goes: at a place of the page, or in place of an element. */
export type GalleryAsk = { how: "insert"; selector: string; where: Where; label?: string } | { how: "replace"; selector: string; label?: string };

export type ModulesCtl = {
  gallery: GalleryAsk | null;
  openGallery: (a: GalleryAsk) => void;
  closeGallery: () => void;
  /** a module picked in the gallery: put on the page, its panel opened (it fills itself where it can) */
  pick: (type: ModuleType) => void;
  /** the change being edited (its id), and its module */
  editing: string | null;
  edit: (id: string | null) => void;
  current: () => { change: PageChange; module: ModuleRef } | null;
  /** the module saved again: drawn, put in its change (`label` = a line in "Changes made here") */
  save: (m: ModuleRef, label?: string) => void;
  remove: () => void;
  /** a fill to run once the panel opens (a module just added) */
  autoFill: string | null;
  clearAutoFill: () => void;
  store: string;
  canEdit: boolean;
};

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

  const current = () => {
    if (!editing) return null;
    const change = ref.current.view().changes.find((c) => c.id === editing);
    const module = change ? moduleOfChange(change) : null;
    return change && module ? { change, module } : null;
  };

  const pick = (type: ModuleType) => {
    const a = gallery;
    if (!a) return;
    const m = newModule(type, ref.current.store);
    const name = kindOf(type).name;
    const html = renderModule(m);
    const base = a.how === "replace" ? replaceChange(a.selector, html, { module: m }) : insertChange(a.selector, a.where, html, { module: m });
    const c = moduleChangeOf(base, m);
    const d = ref.current.view();
    ref.current.put({ ...d, changes: withChange(d.changes, c) }, a.how === "replace" ? `Replaced an element with a ${name.toLowerCase()}` : `Added a ${name.toLowerCase()}`);
    setGallery(null);
    setEditing(c.id ?? null);
    setAutoFill(c.id ?? null);
  };

  const save = (m: ModuleRef, label?: string) => {
    const d = ref.current.view();
    const old = d.changes.find((c) => c.id === editing);
    if (!old) return;
    ref.current.put({ ...d, changes: withChange(d.changes, moduleChangeOf(old, m)) }, label ?? `Changed the ${kindOf(m.type).name.toLowerCase()}`);
  };

  const remove = () => {
    const d = ref.current.view();
    const cur = current();
    if (!cur) return;
    ref.current.put({ ...d, changes: d.changes.filter((c) => c.id !== editing) }, `Took the ${kindOf(cur.module.type).name.toLowerCase()} out${cur.change.op === "replace" ? " - the page's element is back" : ""}`);
    setEditing(null);
  };

  return {
    gallery, openGallery: setGallery, closeGallery: () => setGallery(null), pick,
    editing, edit: setEditing, current, save, remove,
    autoFill, clearAutoFill: () => setAutoFill(null),
    store: o.store, canEdit: o.canEdit,
  };
}
