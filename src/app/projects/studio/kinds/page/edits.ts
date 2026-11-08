"use client";
// AN ELEMENT OF AN EXISTING PAGE, EDITED (08.11.2026) - what a click and an edit in the preview become in the change list.
//
//   an element a change put in (insert / replace)  -> that change's HTML, edited where the element is in it
//   inside an element whose content a change set  -> that change's HTML
//   the shop's own element                        -> a change aimed at it by its selector: its words (text, or html when
//                                                    it holds other elements), an attribute (a picture, a link), its look
//                                                    (one stylesheet per element), hidden or shown again
// A change already aimed at the same element the same way is updated, never doubled.

import { validateChanges, type Change } from "@/lib/convert/versions";
import { fillTexts, type PageDoc } from "@/lib/content/studio/kinds/page/model";
import type { Picked } from "./Frame";

export type ElementEdit =
  | { kind: "words"; text: string; inner?: string }
  | { kind: "attr"; name: string; value: string }
  | { kind: "look"; css: string }
  | { kind: "hide"; on: boolean };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const lookNote = (selector: string) => `Look of ${selector}`.slice(0, 300);

/** The element at a path inside parsed HTML (element-child indexes); null when it is not there any more. */
function walk(root: ParentNode, path: number[]): Element | null {
  let cur: ParentNode | Element | null = root;
  for (const i of path) {
    cur = (cur as ParentNode).children[i] ?? null;
    if (!cur) return null;
  }
  return cur as Element;
}

function editIn(target: Element, e: ElementEdit) {
  if (e.kind === "words") { if (e.inner !== undefined && /<[a-z]/i.test(e.inner)) target.innerHTML = e.inner; else target.textContent = e.text; }
  else if (e.kind === "attr") target.setAttribute(e.name, e.value);
  else if (e.kind === "look") (target as HTMLElement).setAttribute("style", `${(target.getAttribute("style") ?? "").replace(/;?\s*$/, "")};${e.css.replace(/!important/g, "")}`.replace(/^;/, ""));
  else if (e.kind === "hide" && e.on) target.remove();
}

/** The look as one stylesheet for an element: `selector{...}`. */
export function lookCss(selector: string, rules: Record<string, string>): string {
  const body = Object.entries(rules).filter(([, v]) => v).map(([k, v]) => `${k}:${v}!important`).join(";");
  return body ? `${selector}{${body}}` : "";
}

/** The rules of an element's look as stored (to show what is set). */
export function lookOf(changes: Change[], selector: string): Record<string, string> {
  const c = changes.find((x) => x.op === "css" && x.note === lookNote(selector)) as Extract<Change, { op: "css" }> | undefined;
  const out: Record<string, string> = {};
  const body = c ? /\{([^}]*)\}/.exec(c.css)?.[1] ?? "" : "";
  for (const part of body.split(";")) { const [k, v] = part.split(":"); if (k && v) out[k.trim()] = v.replace(/!important/g, "").trim(); }
  return out;
}

export function applyElementEdit(view: PageDoc, p: Picked, e: ElementEdit): { changes: Change[]; label: string } | { error: string } {
  const changes = [...view.changes];
  const check = (c: unknown): Change | string => {
    const v = validateChanges([c]);
    return v.changes[0] ?? (v.problems[0] ?? "That change is not allowed").replace(/^change 1: /, "");
  };

  // 1. inside HTML a change put in
  if (p.frag) {
    const c = changes[p.frag.change] as { html?: string } | undefined;
    if (!c || typeof c.html !== "string") return { error: "The change that made this element is gone - read the preview again." };
    const tpl = document.createElement("template");
    tpl.innerHTML = fillTexts(c.html, view.texts);
    const top = tpl.content.children[p.frag.k];
    const target = top ? walk(top, p.frag.path) : null;
    if (!target) return { error: "This element is not in its change any more - read the preview again." };
    editIn(target, e);
    const next = check({ ...c, html: tpl.innerHTML });
    if (typeof next === "string") return { error: next };
    changes[p.frag.change] = next;
    return { changes, label: `Edited change ${p.frag.change + 1}` };
  }

  // 2. inside an element whose content a change set (op html)
  if (p.host) {
    const own = p.host.changes.find((i) => changes[i]?.op === "html");
    if (own !== undefined) {
      const c = changes[own] as Extract<Change, { op: "html" }>;
      if (!p.host.path.length && e.kind === "words") {
        const next = check({ ...c, html: e.inner !== undefined && /<[a-z]/i.test(e.inner) ? e.inner : esc(e.text) });
        if (typeof next === "string") return { error: next };
        changes[own] = next;
        return { changes, label: `Edited change ${own + 1}` };
      }
      if (p.host.path.length) {
        const tpl = document.createElement("template");
        tpl.innerHTML = fillTexts(c.html, view.texts);
        const target = walk(tpl.content, p.host.path);
        if (target) {
          editIn(target, e);
          const next = check({ ...c, html: tpl.innerHTML });
          if (typeof next === "string") return { error: next };
          changes[own] = next;
          return { changes, label: `Edited change ${own + 1}` };
        }
      }
    }
  }

  // 3. the shop's own element, by its selector
  const selector = p.selector;
  if (!selector) return { error: "This element cannot be found again on the page." };
  const same = (pred: (c: Change & { selector?: string }) => boolean) => changes.findIndex((c) => (c as { selector?: string }).selector === selector && pred(c));
  if (e.kind === "words") {
    const rich = e.inner !== undefined && /<[a-z]/i.test(e.inner);
    const c = rich ? { op: "html", selector, html: e.inner, note: "New words" } : { op: "text", selector, text: e.text, note: "New words" };
    const next = check(c);
    if (typeof next === "string") return { error: next };
    const i = same((x) => x.op === "text" || x.op === "html");
    if (i >= 0) changes[i] = { ...next, note: (changes[i] as { note?: string }).note ?? "New words" } as Change; else changes.push(next);
    return { changes, label: `New words for ${p.tag}` };
  }
  if (e.kind === "attr") {
    const next = check({ op: "attr", selector, name: e.name, value: e.value, note: e.name === "src" ? "Another picture" : e.name === "href" ? "Another link" : `Its ${e.name}` });
    if (typeof next === "string") return { error: next };
    const i = same((x) => x.op === "attr" && (x as { name?: string }).name === e.name);
    if (i >= 0) changes[i] = next; else changes.push(next);
    return { changes, label: e.name === "src" ? "Another picture" : e.name === "href" ? "Another link" : `Its ${e.name}` };
  }
  if (e.kind === "look") {
    const i = changes.findIndex((c) => c.op === "css" && c.note === lookNote(selector));
    if (!e.css) { if (i >= 0) changes.splice(i, 1); return { changes, label: "Its look put back" }; }
    const next = check({ op: "css", css: e.css, note: lookNote(selector) });
    if (typeof next === "string") return { error: next };
    if (i >= 0) changes[i] = next; else changes.push(next);
    return { changes, label: "A new look" };
  }
  const i = same((x) => x.op === "hide");
  if (e.on) { if (i < 0) { const next = check({ op: "hide", selector, note: "Hidden" }); if (typeof next === "string") return { error: next }; changes.push(next); } return { changes, label: `Hid the ${p.tag}` }; }
  if (i >= 0) changes.splice(i, 1);
  return { changes, label: `Showed the ${p.tag} again` };
}
