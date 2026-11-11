// PAGE - ELEMENTS ADDED INSIDE A MODULE (Content v13, 11.11.2026). Pure: relative imports only
// (tests/studio-page-cv13-elements.test.ts).
//
// SARCLA 11.11.2026: "I should be able to add another button, take out elements ... allow element create inside of the
// block". A module of the library draws a fixed set of words from its settings (a headline, a line, one or two buttons...).
// What a person adds inside it - a third and a fourth button, a line of text, a small line above, a headline, a picture -
// is kept in its settings' `adds` and drawn HERE, for every one of the ~100 modules alike, by drawModule (./registry.ts):
// the preview, the gallery's picture and Magento's copy are the same HTML.
//
// Where it goes, without touching the module's own renderer: right after the module's own words - after its last own
// button (an added button follows it, in its look: the same classes), else after its line, else after its headline; a
// small line above goes before its headline. A module whose words are not found (none written yet) takes them at its end.
// Each added element carries its own class (am-x-<id>): a click on it in the page finds it (./elements.ts), its look is
// laid over it (./looks.ts rules).

import { esc, href, marked } from "./kit";
import { pictureAddress, shopAddress } from "./address";
import { cleanButtonLook, cleanTextLook, unpackLook } from "../style";
import type { AddKind, Added, Drawn, ModuleRef, Opts } from "./types";

export type { AddKind, Added } from "./types";

/** At most this many elements added inside one module. */
export const ADDS_MAX = 8;
export const ADD_KINDS: AddKind[] = ["button", "text", "eyebrow", "title", "picture"];
/** The words each kind takes at most (a picture's: its alt text). */
export const ADD_MAX: Record<AddKind, number> = { button: 60, text: 600, eyebrow: 60, title: 140, picture: 200 };
/** What each kind is called in the popups. */
export const ADD_NAME: Record<AddKind, string> = { button: "Button", text: "Line of text", eyebrow: "Small line above", title: "Headline", picture: "Picture" };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/** A new added element's id - letters and digits, a letter first (it is part of a CSS class). */
export const addId = () => `x${Math.random().toString(36).slice(2, 7).padEnd(5, "0")}`;

/** Any stored list as added elements: unknown kinds, bad ids, a second use of an id left out; at most ADDS_MAX. */
export function addsOf(v: unknown): Added[] {
  if (!Array.isArray(v)) return [];
  const out: Added[] = [];
  const seen = new Set<string>();
  for (const x of v) {
    if (!isObj(x)) continue;
    const id = String(x.id ?? "");
    const kind = ADD_KINDS.find((k) => k === x.kind);
    if (!kind || !/^[a-z][a-z0-9]{2,11}$/.test(id) || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id, kind, text: str(x.text, ADD_MAX[kind]),
      url: kind === "button" ? shopAddress(x.url) : "",
      img: kind === "picture" ? pictureAddress(x.img) : "",
      look: str(x.look, 160).replace(/[^\w#=;.-]/g, ""),
    });
    if (out.length >= ADDS_MAX) break;
  }
  return out;
}

/* ── drawn ────────────────────────────────────────────────────────────── */

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Words as a pattern that also finds them where the module never breaks them (a hyphen drawn as U+2011, a no-break space). */
const looseRe = (s: string) => escRe(s).replace(/-/g, "[-‑]").replace(/ /g, "[  ]");

/** Where an element holding these words (exactly, or as its last line) ends in the HTML - -1 when it is not there. */
function endOfWords(html: string, words: string, close: string): number {
  const t = words.replace(/\r\n?/g, "\n").trim();
  if (!t) return -1;
  const lines = t.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const w of [marked(t), esc(t), marked(lines[lines.length - 1] ?? ""), esc(lines[lines.length - 1] ?? "")]) {
    if (!w) continue;
    const m = new RegExp(`${looseRe(w)}(?:\\s*</(?:span|b|strong|em|i|small)>)*\\s*</(${close})>`).exec(html);
    if (m) return m.index + m[0].length;
  }
  return -1;
}
/** Where the element holding the module's headline starts - -1 when it is not there. */
function startOfTitle(html: string, title: string): number {
  const t = title.trim();
  if (!t) return -1;
  for (const w of [marked(t), esc(t)]) {
    const m = new RegExp(`<(h[1-6]|p|div|span|strong|b)(?:\\s[^>]*)?>\\s*${looseRe(w)}`).exec(html);
    if (m) return m.index;
  }
  return -1;
}
/** The module's own button with these words: where it ends and its classes (an added button takes them - its look). */
function ownButton(html: string, label: string): { end: number; cls: string } | null {
  const t = label.trim();
  if (!t) return null;
  const m = new RegExp(`<a((?:\\s[^>]*)?)>\\s*${looseRe(esc(t))}\\s*</a>`).exec(html);
  if (!m) return null;
  const cls = /\sclass="([^"]*)"/.exec(m[1] ?? "")?.[1] ?? "";
  return { end: m.index + m[0].length, cls: cls.split(/\s+/).filter((c) => /^am-[\w-]+$|^is-[\w-]+$/.test(c) && !/^am-(b1|b2|l-)/.test(c)).join(" ") };
}

/** One added element as HTML ("" when it is empty - a button without words or page, a picture without its file). */
export function addHtml(a: Added, o: Opts, btnCls = ""): string {
  const c = `am-x am-x-${a.id}`;
  const t = a.text.trim();
  if (a.kind === "button") return t && a.url ? `<a class="${btnCls ? `${btnCls} ` : ""}${c} am-xb" href="${href(a.url)}">${esc(t)}</a>` : "";
  if (a.kind === "text") return t ? `<p class="${c} am-xt">${esc(t).replace(/\n/g, "<br>")}</p>` : "";
  if (a.kind === "eyebrow") return t ? `<p class="am-ey ${c} am-xe">${esc(t)}</p>` : "";
  if (a.kind === "title") return t ? `<h3 class="${c} am-xh">${marked(t)}</h3>` : "";
  return a.img ? `<figure class="${c} am-xp"><img src="${esc(o.picture ? o.picture(a.img) : a.img)}" alt="${esc(t)}" loading="lazy"></figure>` : "";
}

const ADD_CSS = `
@@ a.am-xb{display:inline-flex;align-items:center;gap:10px;margin:10px 10px 0 0;text-decoration:none!important;vertical-align:middle}
@@ a.am-xb:not([class*="am-btn"]):not(.am-all):not(.am-lk){height:48px;padding:0 22px;border-radius:6px;background:var(--red);color:#fff!important;font:600 16px/1 var(--head);white-space:nowrap}
@@ .am-xr{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:18px}
@@ .am-xr>a.am-xb{margin:0}
@@ p.am-xt{margin-top:12px!important;max-width:680px;font-size:16px;line-height:1.55;color:var(--txt)}
@@ p.am-xe{margin-top:12px!important}
@@ h3.am-xh{margin-top:20px!important;font-size:clamp(19px,1.7vw,24px)!important;line-height:1.2!important}
@@ figure.am-xp{display:block;width:100%;margin-top:16px!important;border-radius:14px;overflow:hidden;background:var(--tile)}
@@ figure.am-xp img{display:block;width:100%;height:auto;max-height:420px;object-fit:cover}
@@ .am-xg{display:flex;flex-direction:column;align-items:flex-start;margin-top:14px}
@media (max-width:900px){@@ a.am-xb:not([class*="am-btn"]):not(.am-all):not(.am-lk){height:46px;padding:0 18px;font-size:15px}}
`;

/**
 * What the module drew with the elements added inside it: buttons after its last own button (in its look), lines,
 * headlines and pictures after its own words, small lines above before its headline - at its end when its words are not
 * found. Their looks come as rules from `rules` (./looks.ts: the same as a module's own words and buttons).
 */
export function withAdds(m: ModuleRef, d: Drawn, o: Opts, rules: { text: (look: string, kind: AddKind) => string; button: (look: string, cls: string) => string }): Drawn {
  const adds = (m.settings.adds ?? []).filter((a) => addHtml(a, o));
  if (!adds.length) return d;
  const s = m.settings;
  let html = d.html;
  // the module's own words: where they end, where its headline starts
  const b2 = ownButton(html, s.link2.label);
  const b1 = ownButton(html, s.link.label);
  const btn = [b1, b2].filter((x): x is { end: number; cls: string } => !!x).sort((a, b) => b.end - a.end)[0] ?? null;
  const textEnd = endOfWords(html, s.text, "p|div|span|li|h[1-6]");
  const titleEnd = endOfWords(html, s.title, "h[1-6]|p|div|span|strong|b");
  const at = btn ? btn.end : textEnd >= 0 ? textEnd : titleEnd;
  const titleAt = startOfTitle(html, s.title);
  // what goes after the words: the buttons right after the module's own (in its look), the rest in order
  const after = adds.filter((a) => a.kind !== "eyebrow");
  let group = "";
  let row: string[] = [];
  const flush = () => { if (row.length) { group += btn && !group ? row.join(" ") : `<div class="am-xr">${row.join("")}</div>`; row = []; } };
  for (const a of after) {
    if (a.kind === "button") { row.push(addHtml(a, o, btn?.cls ?? "")); continue; }
    flush();
    group += addHtml(a, o);
  }
  flush();
  const above = adds.filter((a) => a.kind === "eyebrow").map((a) => addHtml(a, o)).join("");
  // put in from the end first, so the earlier place does not move
  const puts: { at: number; html: string }[] = [];
  if (group) puts.push(at >= 0 ? { at, html: btn ? ` ${group}` : group } : { at: html.length, html: `<div class="am-xg">${group}</div>` });
  if (above) puts.push(titleAt >= 0 ? { at: titleAt, html: above } : at >= 0 ? { at, html: above } : { at: html.length, html: `<div class="am-xg">${above}</div>` });
  for (const p of puts.sort((x, y) => y.at - x.at)) html = html.slice(0, p.at) + p.html + html.slice(p.at);
  // their looks
  const css: string[] = [ADD_CSS];
  for (const a of adds) {
    if (!a.look) continue;
    const r = a.kind === "button" ? rules.button(a.look, `am-x-${a.id}`) : a.kind === "picture" ? "" : rules.text(a.look, a.kind);
    if (r) css.push(a.kind === "button" ? r : `@@ :is(h3,p).am-x-${a.id}{${r}}`);
  }
  return { html, css: `${d.css}\n${css.join("\n")}` };
}

/** A look kept for an added element, read back. */
export const addTextLook = (a: Added) => cleanTextLook(unpackLook(a.look));
export const addButtonLook = (a: Added) => cleanButtonLook(unpackLook(a.look));
