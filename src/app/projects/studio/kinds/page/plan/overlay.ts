"use client";
// A STEP SHOWN AT ONCE IN THE PAGE (Content v7, 10.11.2026). The brief's rule after v6 ("Add a module" did nothing
// visible): a click shows its result AT ONCE. The preview is the server's picture of the page (a few seconds after a
// save); so a plan's step is drawn into the frame itself the moment it is applied - its module's SKELETON while the hub
// fills it from the shop, then the module itself while it is checked - until the server's picture has it. Drawn the way
// the server lays a change (./apply.ts): the element found by the step's selector (the first, what a change put in left
// aside), the block before / after / in it, or in place of it (it hidden, kept). Then scrolled to and briefly lit.
//
// Only the studio's preview: nothing here is saved or goes to Magento.

export type PendWhere = "before" | "after" | "prepend" | "append" | "replace";
export type Pending = {
  key: string;
  /** a place of the page: its selector and where; or what the hub put there (the change's index on the page): in place of it */
  selector: string; where: PendWhere; change?: number;
  html: string;
};
export type Flash = { key?: string; index?: number; nonce: number };

const STYLE = `[data-apx-pend]{display:contents}
[data-apx-pend] *{pointer-events:none!important}
[data-apx-flash]{outline:3px solid rgba(194,44,110,.95)!important;outline-offset:6px!important;animation:apxflash 2.2s ease-out forwards!important}
@keyframes apxflash{0%{outline-color:rgba(194,44,110,.95);box-shadow:0 0 0 10px rgba(194,44,110,.18)}70%{outline-color:rgba(194,44,110,.75);box-shadow:0 0 0 0 rgba(194,44,110,0)}100%{outline-color:rgba(194,44,110,0);box-shadow:none}}`;

type PendDoc = Document & { __apxPend?: string };

/** The element a selector finds as a change finds it: the first in page order outside what a change put in. */
function target(d: Document, selector: string): Element | null {
  try {
    return Array.from(d.querySelectorAll(selector)).find((el) => !el.closest("[data-apso-v],[data-apx-pend]")) ?? null;
  } catch { return null; }
}

/** The steps drawn in the frame's page (each time the list changes; the same list is not drawn twice). Returns the keys
 * whose place was not found - said by the studio in plain words. */
export function drawPending(d: Document, list: Pending[]): string[] {
  const pd = d as PendDoc;
  const sig = JSON.stringify(list.map((p) => [p.key, p.selector, p.where, p.change ?? -1, p.html.length, p.html.slice(-200)]));
  if (pd.__apxPend === sig && (!list.length || d.querySelector("[data-apx-pend]"))) return [];
  pd.__apxPend = sig;
  if (!d.getElementById("apx-pend-css")) {
    const st = d.createElement("style");
    st.id = "apx-pend-css";
    st.textContent = STYLE;
    (d.head ?? d.documentElement).appendChild(st);
  }
  // what was drawn before goes; what it hid shows again
  d.querySelectorAll("[data-apx-pend]").forEach((x) => x.remove());
  d.querySelectorAll<HTMLElement>("[data-apx-pend-hid]").forEach((el) => {
    const old = el.getAttribute("data-apx-pend-hid") ?? "";
    if (old) el.setAttribute("style", old); else el.removeAttribute("style");
    el.removeAttribute("data-apx-pend-hid");
  });
  const lost: string[] = [];
  for (const p of list) {
    // its own element (not a <div>): a place by position ("div:nth-of-type(3)") stays the same while it is drawn
    const box = d.createElement("apx-pend");
    box.setAttribute("data-apx-pend", p.key);
    const t = d.createElement("template");
    t.innerHTML = p.html;
    box.appendChild(t.content);
    const hide = (el: Element) => {
      const h = el as HTMLElement;
      if (!h.hasAttribute("data-apx-pend-hid")) h.setAttribute("data-apx-pend-hid", h.getAttribute("style") ?? "");
      h.style.setProperty("display", "none", "important");
    };
    if (p.change !== undefined && p.change >= 0) {
      // in place of what the hub put there before (a module swapped, its words changed)
      const tops = Array.from(d.querySelectorAll(`[data-apx-c="${p.change}"]`)).filter((x) => x.tagName !== "STYLE");
      if (!tops.length) { lost.push(p.key); continue; }
      tops[0].before(box);
      tops.forEach(hide);
      continue;
    }
    const el = target(d, p.selector);
    if (!el) { lost.push(p.key); continue; }
    if (p.where === "before") el.before(box);
    else if (p.where === "after") el.after(box);
    else if (p.where === "prepend") el.prepend(box);
    else if (p.where === "append") el.append(box);
    else { el.before(box); hide(el); }
  }
  return lost;
}

/** The element a step stands as now: drawn here (pending), or the server's picture of its change (data-apx-c). */
export function stepElement(d: Document, f: { key?: string; index?: number }): Element | null {
  if (f.key) {
    const box = d.querySelector(`[data-apx-pend="${CSS.escape(f.key)}"]`);
    const first = box ? Array.from(box.children).find((x) => x.tagName !== "STYLE") : null;
    if (first) return first;
  }
  if (f.index !== undefined && f.index >= 0) return Array.from(d.querySelectorAll(`[data-apx-c="${f.index}"]`)).find((x) => x.tagName !== "STYLE") ?? null;
  return null;
}

/** Briefly lit (the pink outline fades out). */
export function flashEl(el: Element): void {
  el.removeAttribute("data-apx-flash");
  void (el as HTMLElement).offsetWidth;
  el.setAttribute("data-apx-flash", "");
  setTimeout(() => el.removeAttribute("data-apx-flash"), 2400);
}

/** Can the person see it? Its size, its display - "" when it shows, else why not, in plain words. */
export function shownWhy(el: Element | null): string {
  if (!el) return "It is not in the page - its place was not found.";
  const w = el.ownerDocument.defaultView;
  const r = el.getBoundingClientRect();
  const cs = w?.getComputedStyle(el);
  if (cs && (cs.display === "none" || cs.visibility === "hidden")) return "It is in the page but hidden by the page's own styles.";
  if (r.width < 2 || r.height < 2) return "It is in the page but takes no room - nothing of it shows.";
  return "";
}
