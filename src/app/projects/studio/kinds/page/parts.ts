"use client";
// A MODULE'S ELEMENTS IN THE PAGE (Content v13, SARCLA 11.11.2026: "You should allow editing per element, therefore also
// the AI per element, like a text, a button ... we need to dig into element also"). The page in the studio's frame is
// the module's HTML as Magento gets it - no studio marks in it. A click inside a module is read here: from the element
// it landed on outwards, the first one that is one of the module's elements (lib .../modules/elements.ts partAt: its
// headline, a button, a date, a point, a product's card, its picture, an element added) is selected on its own; only its
// own ground (its padding, its empty area) is the whole block. And the other way: a module's element found in the page
// (an element just added, a row of the block popup's list), to select it and open its popup at it.

import { partAt, type Probe } from "@/lib/content/studio/kinds/page/modules/elements";
import type { ModuleRef } from "@/lib/content/studio/kinds/page/modules/model";

const TEXTISH = /^(H[1-6]|P|A|SPAN|LI|BUTTON|SUMMARY|SMALL|STRONG|B|EM|I|LABEL|FIGCAPTION|DT|DD|TD|TH|BLOCKQUOTE)$/;
const SVG = new Set(["svg", "path", "use", "g", "circle", "rect", "line", "polyline", "polygon"]);

/** What an element tells about itself (partAt's probe). */
export function probeOf(el: Element, root: Element): Probe {
  const tag = el.tagName.toLowerCase();
  const text = ((el as HTMLElement).innerText ?? el.textContent ?? "").replace(/ /g, " ").trim().slice(0, 1500);
  const pic = tag === "img" || !!el.querySelector("img,picture,video");
  const link = el.closest("a");
  return {
    tag, text, words: TEXTISH.test(el.tagName) && !!text && !pic,
    href: tag === "a" ? el.getAttribute("href") : null,
    src: tag === "img" ? el.getAttribute("src") ?? "" : null,
    inLink: link && root.contains(link) ? link.getAttribute("href") : null,
    cls: el.getAttribute("class") ?? "",
    srcs: Array.from(el.querySelectorAll("img")).slice(0, 6).map((i) => i.getAttribute("src") ?? ""),
    hrefs: Array.from(el.querySelectorAll("a[href]")).slice(0, 6).map((a) => a.getAttribute("href") ?? ""),
  };
}

/** A product's or a category's card: the link around its photo and its name, when there is one. */
const cardOf = (el: Element, root: Element): Element => { const a = el.closest("a"); return a && a !== root && root.contains(a) ? a : el; };

/** A card: the whole card - the biggest box around it that is still only that card. */
function wholeCard(from: Element, root: Element, m: ModuleRef, part: string): Element {
  let el: Element = cardOf(from, root);
  while (el.parentElement && el.parentElement !== root && partAt(m, probeOf(el.parentElement, root)) === part) el = el.parentElement;
  return el;
}

/** The element of a module a click landed in, and which of the module's elements it is (null: the module's own ground). */
export function partIn(target: Element, root: Element, m: ModuleRef): { el: Element; part: string | null } {
  let cur: Element | null = target;
  while (cur && cur !== root && SVG.has(cur.tagName.toLowerCase())) cur = cur.parentElement;
  for (; cur && cur !== root && root.contains(cur); cur = cur.parentElement) {
    const part = partAt(m, probeOf(cur, root));
    if (part) return { el: /^items\./.test(part) ? wholeCard(cur, root, m, part) : cur, part };
  }
  return { el: root, part: null };
}

/** A module's element found in the page by what it is ("title", "add.x1abc", "items.2") - the innermost that is it. */
export function findPart(root: Element, m: ModuleRef, part: string): Element | null {
  const ad = /^add\.([a-z0-9]+)$/.exec(part);
  if (ad) return root.querySelector(`.am-x-${ad[1]}`);
  // Content v14: a card's photo - the picture in its card
  const ip = /^items\.(\d+)\.img$/.exec(part);
  if (ip) { const card = findPart(root, m, `items.${ip[1]}`); return card?.querySelector("img") ?? card; }
  let hit: Element | null = null;
  for (const el of Array.from(root.querySelectorAll("*"))) {
    if (el.tagName === "STYLE" || SVG.has(el.tagName.toLowerCase())) continue;
    // the last in the page's order: the innermost of the elements around it that are it too
    if (partAt(m, probeOf(el, root)) === part) hit = el;
  }
  return hit && /^items\./.test(part) ? wholeCard(hit, root, m, part) : hit;
}
