"use client";
// THE MODULE LIBRARY IN THE PAGE STUDIO (Content v6, SARCLA 09.11.2026 points 7-9; Content v7, 10.11.2026 points 1, 3, 6).
//
// Where a module lives:
//   a page of the shop  a CHANGE (the shared interface, src/lib/content/studio/kinds/page/model.ts): insertChange at a place,
//                       or replaceChange of an element (the element hidden, kept), its settings beside it (`module`) so it
//                       opens again here. While it still lacks what it needs (no products yet, no headline) the change is
//                       held back (`off`: not in the server's preview, never in Magento) - and drawn in the frame AT ONCE as
//                       its SKELETON with the reason (modulePending below, through the frame's overlay ./plan/overlay.ts)
//   a new page          one of its fields' modules (fields.ts PageModule), after one of its blocks - drawn by the new page's
//                       renderer (newpage.ts); one that lacks something draws as its skeleton there, never in Magento
//
// SARCLA 10.11.2026 point 6: "added a module didn't appear" - v6 kept a module without products `off` and so never drew it.
// Now a click shows it at once: the skeleton in its own shape fills in front of the person ("Filling it from the shop…"),
// then the module itself until the server's picture of the page has it; if it cannot fill, it stays with the reason in
// plain words and its panel open on the left with the one-click ways to fill it.
//
// This hook holds where a click in the Modules tab puts a module (`place`), the module being edited, what is filling, and
// asks the side bar to show the Modules tab (`tabNonce`).

import { useRef, useState } from "react";
import type { PageModule } from "@/lib/content/studio/kinds/page/fields";
import { insertChange, replaceChange, withChange, type PageChange, type PageDoc } from "@/lib/content/studio/kinds/page/model";
import { kindOf, moduleGap, moduleId, moduleOfChange, newModule, type ModuleRef, type ModuleType } from "@/lib/content/studio/kinds/page/modules/model";
import { renderModule, renderSkeleton } from "@/lib/content/studio/kinds/page/modules/render";
import type { Flash, Pending } from "../plan/overlay";

export type Where = "before" | "after" | "prepend" | "append";
/** Where a module goes: at a place of a page of the shop, in place of one of its elements, in place of a module already
 * there (its words and products kept), or after a block of a new page ("" = above them all). */
export type Place =
  | { how: "insert"; selector: string; where: Where; label: string }
  | { how: "replace"; selector: string; label: string }
  | { how: "swap"; key: string; label: string }
  | { how: "block"; after: string; label: string };
/** v6's name for it */
export type GalleryAsk = Place;

/** The module being edited, wherever it lives. */
export type Editing = { module: ModuleRef; replace: boolean; live: boolean };

/** A held-back module change's reason starts so (v6 wrote "Not on the page yet"): the skeleton is drawn for those only. */
export const WAIT = "Not filled yet";
const isWait = (off: unknown) => typeof off === "string" && (off.startsWith(WAIT) || off.startsWith("Not on the page yet"));

export type ModulesCtl = {
  /** a place asked for from the page (its "+", a new page's "+") - the Modules tab's next click puts a module there */
  place: Place | null;
  setPlace: (p: Place | null) => void;
  /** v6: the "+" in the page opened the gallery - now it sets the place and shows the Modules tab */
  openGallery: (p: Place) => void;
  /** the side bar shows the Modules tab when this changes */
  tabNonce: number;
  showTab: () => void;
  /** a module put on the page at a place: drawn at once, its panel opened, filled where it can */
  add: (type: ModuleType, place: Place) => void;
  /** the module being edited switched to another of the library, its words, items and place kept */
  swapType: (type: ModuleType) => void;
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
  /** what is filling now, by change id: "Filling it from the shop…" - its skeleton moves */
  busy: Record<string, string>;
  setBusy: (key: string, text: string | null) => void;
  /** a module drawn here, lit (the frame scrolls to it) */
  flash: Flash | null;
  /** the frame could not show one (its place not found): why, by change id */
  lost: Record<string, string>;
  onShown: (key: string, why: string) => void;
  store: string;
  canEdit: boolean;
};

const NP = "np:";

/** The change a module stands in, drawn again: its HTML, its line, and held back while it lacks what it needs. */
export function moduleChangeOf(old: PageChange, m: ModuleRef): PageChange {
  const gap = moduleGap(m);
  const note = `${kindOf(m.type).name}${m.settings.title.trim() ? `: ${m.settings.title.trim().slice(0, 80)}` : ""}`;
  const next = { ...old, html: renderModule(m), note, module: m } as PageChange & { off?: string };
  if (gap) next.off = `${WAIT}: ${gap.charAt(0).toLowerCase()}${gap.slice(1)}.`;
  else delete next.off;
  return next;
}

/** The list with a module's change put next to another one: "after it" lands after it on the page whatever way the other
 * one was placed (a later insert at the same element lands nearer to it). */
function besides(changes: PageChange[], after: PageChange, c: PageChange): PageChange[] {
  const i = changes.findIndex((x) => x.id === after.id);
  if (i < 0) return withChange(changes, c);
  const w = (after as { where?: string }).where;
  // inserted after / prepended to the same element: the later one lands nearer to it - so it goes BEFORE in the list
  const first = after.op === "insert" && (w === "after" || w === "prepend");
  const out = [...changes];
  out.splice(first ? i : i + 1, 0, c);
  return out;
}

/** The frame's drawing of the page's modules (Content v7, point 6): a held-back one as its skeleton with the reason (or
 * what fills it now); one just made live as itself until the server's picture of the page has it. */
export function modulePending(changes: PageChange[], served: { changes: PageChange[] } | null, busy: Record<string, string>): Pending[] {
  const out: Pending[] = [];
  for (const c of changes) {
    const m = moduleOfChange(c);
    if (!m || !c.id) continue;
    const off = (c as { off?: string }).off;
    const sel = (c as { selector?: string }).selector ?? "";
    const where = c.op === "replace" ? "replace" as const : ((c as { where?: Where }).where ?? "after");
    if (off) {
      if (!isWait(off) && !busy[c.id]) continue;
      const gap = moduleGap(m);
      out.push({ key: `mod:${c.id}`, selector: sel, where, html: renderSkeleton(m, { busy: busy[c.id] ?? null, reason: gap ? `${gap} - in its settings (click it).` : off }) });
      continue;
    }
    const html = (c as { html?: string }).html ?? "";
    if (served?.changes.some((x) => x.id === c.id && (x as { html?: string }).html === html && !(x as { off?: string }).off)) continue;
    out.push({ key: `mod:${c.id}`, selector: sel, where, html });
  }
  return out;
}

export function useModules(o: {
  /** the store view shown, as a whole page document */
  view: () => PageDoc;
  /** the view put back, with a line for "Changes made here" */
  put: (next: PageDoc, label: string) => void;
  store: string;
  canEdit: boolean;
  /** the assistant column folded away: unfolded when the Modules tab is asked for */
  unfold?: () => void;
}): ModulesCtl {
  const [place, setPlace] = useState<Place | null>(null);
  const [tabNonce, setTabNonce] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [autoFill, setAutoFill] = useState<string | null>(null);
  const [busy, setBusyMap] = useState<Record<string, string>>({});
  const [flash, setFlash] = useState<Flash | null>(null);
  const [lost, setLost] = useState<Record<string, string>>({});
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
    return change && module ? { module, replace: change.op === "replace", live: !(change as { off?: string }).off } : null;
  };

  const showTab = () => { ref.current.unfold?.(); setTabNonce((n) => n + 1); };

  const add = (type: ModuleType, p: Place) => {
    const k = kindOf(type);
    const m = newModule(type, ref.current.store);
    const name = k.name.toLowerCase();
    const d = ref.current.view();
    let key: string;
    if (p.how === "block") {
      const id = moduleId();
      key = `${NP}${id}`;
      ref.current.put(withModules(d, [...pageModules(d), { id, after: p.after, module: m }]), `Added a ${name}`);
    } else if (p.how === "swap") {
      const old = d.changes.find((c) => c.id === p.key);
      const was = old ? moduleOfChange(old) : null;
      if (!old || !was) return;
      // its words kept; its items too when the new one takes the same (products, or categories with the same inside)
      const same = k.takes === kindOf(was.type).takes && (k.takes !== "categories" || k.kids === kindOf(was.type).kids);
      const next = { type: k.id, settings: { ...was.settings, layout: k.layouts[0]?.key ?? "", ...(same ? {} : { items: [], fill: null }) } } as ModuleRef;
      key = p.key;
      if (!same && k.takes !== "none") { setAutoFill(key); setBusyMap((bm) => ({ ...bm, [key]: "Filling it from the shop…" })); }
      ref.current.put({ ...d, changes: withChange(d.changes, moduleChangeOf(old, next)) }, `Made the ${kindOf(was.type).name.toLowerCase()} a ${name}`);
    } else {
      const html = renderModule(m);
      const base = p.how === "replace" ? replaceChange(p.selector, html, { module: m }) : insertChange(p.selector, p.where, html, { module: m });
      const c = moduleChangeOf(base, m);
      key = c.id ?? "";
      // after a module the hub put there: next to it, whatever way it was placed
      const anchor = p.how === "insert" && p.where === "after" ? d.changes.find((x) => moduleOfChange(x) && (x as { html?: string }).html && p.selector === `.apx-${moduleOfChange(x)!.settings.id}`) : undefined;
      const fixed = anchor ? { ...c, selector: (anchor as { selector: string }).selector, ...(anchor.op === "insert" ? { where: (anchor as { where: Where }).where } : { where: "after" as const }) } as PageChange : c;
      ref.current.put({ ...d, changes: anchor ? besides(d.changes, anchor, fixed) : withChange(d.changes, fixed) }, p.how === "replace" ? `Replaced an element with a ${name}` : `Added a ${name}`);
    }
    setPlace(null);
    setEditing(key);
    // a module of the shop's products or categories starts filling at once (its panel runs it); its skeleton moves
    if (k.takes !== "none" && p.how !== "swap") { setAutoFill(key); if (!key.startsWith(NP)) setBusyMap((b) => ({ ...b, [key]: "Filling it from the shop…" })); }
    if (!key.startsWith(NP)) setFlash({ key: `mod:${key}`, nonce: Date.now() });
  };

  const swapType = (type: ModuleType) => {
    if (!editing) return;
    const cur = current();
    if (!cur) return;
    const k = kindOf(type);
    const was = kindOf(cur.module.type);
    const same = k.takes === was.takes && (k.takes !== "categories" || k.kids === was.kids);
    const next = { type: k.id, settings: { ...cur.module.settings, layout: k.layouts[0]?.key ?? "", ...(same ? {} : { items: [], fill: null }) } } as ModuleRef;
    if (!same && k.takes !== "none") { setAutoFill(editing); if (!editing.startsWith(NP)) setBusyMap((bm) => ({ ...bm, [editing]: "Filling it from the shop…" })); }
    save(next, `Made the ${kindOf(cur.module.type).name.toLowerCase()} a ${k.name.toLowerCase()}`);
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
    setLost((l) => { if (!editing || !l[editing]) return l; const n = { ...l }; delete n[editing]; return n; });
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

  const setBusy = (key: string, text: string | null) => setBusyMap((b) => {
    if (text) return b[key] === text ? b : { ...b, [key]: text };
    if (!(key in b)) return b;
    const n = { ...b };
    delete n[key];
    return n;
  });

  const onShown = (key: string, why: string) => {
    const id = key.replace(/^mod:/, "");
    setLost((l) => (why ? (l[id] === why ? l : { ...l, [id]: why }) : l));
  };

  return {
    place, setPlace, openGallery: (p: Place) => { setPlace(p); showTab(); }, tabNonce, showTab,
    add, swapType, editing, edit: setEditing, current, save, remove,
    autoFill, clearAutoFill: () => setAutoFill(null), busy, setBusy, flash, lost, onShown,
    store: o.store, canEdit: o.canEdit,
  };
}
