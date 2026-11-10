// PAGE - A MODULE'S OWN LOOKS (Content v10, 10.11.2026). Pure: relative imports only.
//
// SARCLA 10.11.2026: "when I click element I should have option to change text color, custom color, some kind of editing"
// (point 2), "also on button settings better, also color" (point 3), "on Q&A also allow all closed, only the button for
// drop-down, or all open" (point 4), "drag and drop to scale object inside of the block" (point 5). A module draws itself
// from its settings (./lib/*.ts); what a person changes ON it is kept in its `extra` (short words only) and laid over what
// it drew, here, in one place - drawModule (./registry.ts) - so the preview, the thumbnail and Magento's copy agree:
//
//   look-title · look-eyebrow · look-text   its words' look ("c=#274e64;z=l;w=b;i=1;u=1;a=center", ../style.ts packLook)
//   btn-link · btn-link2                    its buttons' look ("s=outline;c=petrol;z=l;r=0;t=1")
//   open                                    its questions: "1" all open, "0" all closed (each opens on a click)
//   split                                   its two columns: "<layout>:<the left one's share>" ("right:33") - desktop only,
//                                           a phone stacks as before

import { esc } from "./kit";
import { cleanButtonLook, cleanTextLook, hexOfColor, labelOn, unpackLook, type ButtonLook, type TextLook } from "../style";
import type { Drawn, ModuleRef } from "./types";

export const TEXT_LOOK_KEY = { title: "look-title", eyebrow: "look-eyebrow", text: "look-text" } as const;
export type LookField = keyof typeof TEXT_LOOK_KEY;
export const BUTTON_LOOK_KEY = { link: "btn-link", link2: "btn-link2" } as const;
export type ButtonField = keyof typeof BUTTON_LOOK_KEY;

/** The modules whose two columns can be dragged (point 5): the grid that holds them, the layouts where it is one. */
export const SPLIT_GRID: Record<string, { sel: string; not?: string[]; needs?: "feature" }> = {
  textpic: { sel: ".am-tp", needs: "feature" },
  "hero-split": { sel: ".am-sp" },
  banner: { sel: ".am-bb", not: ["behind", "picture"] },
  "story-feature": { sel: ".am-sf", not: ["top"] },
  "tool-spotlight": { sel: ".am-ts", not: ["stacked"] },
};
/** The left column's share a split snaps to (%). */
export const MODULE_SPLITS = [25, 33, 50, 66, 75] as const;

/** Can this module's two columns be dragged, as it is laid out now? */
export function canSplit(m: ModuleRef): boolean {
  const g = SPLIT_GRID[m.type];
  if (!g) return false;
  if (g.not?.includes(m.settings.layout)) return false;
  if (g.needs === "feature" && !m.settings.feature) return false;
  return true;
}

/** Its left column's share for the layout it has now - null when it is the module's own. */
export function splitOf(m: ModuleRef): number | null {
  const raw = m.settings.extra.split ?? "";
  const [layout, v] = raw.split(":");
  const n = Number(v);
  return layout === m.settings.layout && (MODULE_SPLITS as readonly number[]).includes(n) ? n : null;
}

/** The module with its left column's share set for its layout (null = the module's own again). */
export function withSplit(m: ModuleRef, left: number | null): ModuleRef {
  const extra = { ...m.settings.extra };
  if (left === null || !(MODULE_SPLITS as readonly number[]).includes(left)) delete extra.split;
  else extra.split = `${m.settings.layout}:${left}`;
  return { ...m, settings: { ...m.settings, extra } };
}

/** A look kept in the module (a text's, a button's) - read back. */
export const textLookOf = (m: ModuleRef, f: LookField): TextLook => cleanTextLook(unpackLook(m.settings.extra[TEXT_LOOK_KEY[f]]));
export const buttonLookOf = (m: ModuleRef, f: ButtonField): ButtonLook => cleanButtonLook(unpackLook(m.settings.extra[BUTTON_LOOK_KEY[f]]));

/** Its questions: true all open, false all closed, null as the module draws them. */
export function openOf(m: ModuleRef): boolean | null {
  const v = m.settings.extra.open;
  return v === "1" ? true : v === "0" ? false : null;
}

/* ── laid over what the module drew ───────────────────────────────────── */

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const marked = (t: string) => esc(t).replace(/==([^=]{1,60})==/g, '<span class="am-red">$1</span>');

/** The first element whose whole content is these words: its class `cls` added. */
function tagText(html: string, inner: string[], cls: string): string {
  for (const w of inner) {
    if (!w) continue;
    const re = new RegExp(`<([a-z][a-z0-9]*)((?:\\s[^>]*)?)>(${escRe(w)})</\\1>`);
    const m = re.exec(html);
    if (!m) continue;
    const attrs = m[2] ?? "";
    const withCls = /\sclass="/.test(attrs) ? attrs.replace(/\sclass="([^"]*)"/, (_a, c: string) => ` class="${c} ${cls}"`) : `${attrs} class="${cls}"`;
    return html.slice(0, m.index) + `<${m[1]}${withCls}>${m[3]}</${m[1]}>` + html.slice(m.index + m[0].length);
  }
  return html;
}

/** The first link with these words: its class `cls` added, and a new tab when asked. */
function tagAnchor(html: string, label: string, cls: string, tab: boolean): string {
  const re = new RegExp(`<a((?:\\s[^>]*)?)>(${escRe(esc(label.trim()))})</a>`);
  const m = re.exec(html);
  if (!m) return html;
  let attrs = m[1] ?? "";
  attrs = /\sclass="/.test(attrs) ? attrs.replace(/\sclass="([^"]*)"/, (_a, c: string) => ` class="${c} ${cls}"`) : `${attrs} class="${cls}"`;
  if (tab && !/\starget=/.test(attrs)) attrs += ' target="_blank" rel="noopener"';
  return html.slice(0, m.index) + `<a${attrs}>${m[2]}</a>` + html.slice(m.index + m[0].length);
}

const TEXT_SIZE: Record<LookField, Record<string, string>> = {
  title: { s: "22px", l: "38px", xl: "48px" },
  eyebrow: { s: "11px", l: "14px", xl: "16px" },
  text: { s: "13.5px", l: "18px", xl: "21px" },
};

function textRules(l: TextLook, f: LookField): string {
  const r: string[] = [];
  const hex = l.color ? hexOfColor(l.color) : null;
  if (hex) r.push(`color:${hex}!important`, `-webkit-text-fill-color:${hex}`);
  if (l.size && TEXT_SIZE[f][l.size]) r.push(`font-size:${TEXT_SIZE[f][l.size]}!important`);
  if (l.weight) r.push(`font-weight:${l.weight === "bold" ? 700 : 400}!important`);
  if (l.italic) r.push("font-style:italic!important");
  if (l.underline) r.push("text-decoration:underline!important", "text-underline-offset:.16em");
  if (l.align) r.push(`text-align:${l.align}!important`);
  return r.join(";");
}

function buttonRules(b: ButtonLook, cls: string): string {
  const out: string[] = [];
  const hex = b.color ? hexOfColor(b.color) : null;
  const sel = `@@ a.${cls}`;
  if (b.style === "filled" || (!b.style && hex)) {
    const c = hex ?? "#d80901";
    out.push(`${sel}{display:inline-flex;align-items:center;background:${c}!important;color:${labelOn(c)}!important;border:0!important;box-shadow:none!important;text-decoration:none!important}`, `${sel}:hover{filter:brightness(.9)}`);
    if (!b.size && b.style === "filled") out.push(`${sel}{height:48px;padding:0 22px;border-radius:6px;font:600 16px/1 var(--head)}`);
  } else if (b.style === "outline") {
    const c = hex ?? "#274e64";
    out.push(`${sel}{display:inline-flex;align-items:center;background:transparent!important;color:${c}!important;border:2px solid ${c}!important;box-shadow:none!important;text-decoration:none!important}`);
    if (!b.size) out.push(`${sel}{height:48px;padding:0 22px;border-radius:6px;font:600 16px/1 var(--head)}`);
  } else if (b.style === "link") {
    const c = hex ?? "#274e64";
    out.push(`${sel}{background:transparent!important;color:${c}!important;border:0!important;box-shadow:none!important;height:auto!important;padding:2px 0!important;text-decoration:underline!important;text-underline-offset:5px;text-decoration-thickness:2px}`);
  }
  if (b.style !== "link" && b.size === "s") out.push(`${sel}{height:40px!important;padding:0 16px!important;font-size:14px!important}`);
  if (b.style !== "link" && b.size === "l") out.push(`${sel}{height:58px!important;padding:0 30px!important;font-size:18px!important}`);
  if (b.arrow === false) out.push(`${sel}::after{display:none!important}`);
  if (b.arrow === true) out.push(`${sel}::after{content:""!important;display:inline-block!important;flex:none;width:7px;height:7px;margin-left:10px;border:solid currentColor;border-width:2px 2px 0 0;transform:rotate(45deg)}`);
  return out.join("\n");
}

/** What the module drew, with what a person changed on it laid over (its words' and buttons' looks, its questions open
 * or closed, its columns' split) - the module's own rules untouched. */
export function withLooks(m: ModuleRef, d: Drawn): Drawn {
  const s = m.settings;
  const x = s.extra ?? {};
  let html = d.html;
  const css: string[] = [];
  // its questions (a <details> each): all open, or all closed - a click opens one
  if (x.open === "1") html = html.replace(/<details(?![^>]*\sopen\b)((?:\s[^>]*)?)>/g, "<details$1 open>");
  else if (x.open === "0") html = html.replace(/<details((?:\s[^>]*)?)>/g, (_a, at: string) => `<details${at.replace(/\sopen(="[^"]*")?(?=\s|$)/g, "")}>`);
  // its buttons
  for (const f of ["link", "link2"] as ButtonField[]) {
    const b = cleanButtonLook(unpackLook(x[BUTTON_LOOK_KEY[f]]));
    if (!Object.keys(b).length || !s[f].label.trim()) continue;
    const cls = f === "link" ? "am-b1" : "am-b2";
    html = tagAnchor(html, s[f].label, cls, !!b.tab);
    const rules = buttonRules(b, cls);
    if (rules) css.push(rules);
  }
  // its words
  for (const f of ["title", "eyebrow", "text"] as LookField[]) {
    const l = cleanTextLook(unpackLook(x[TEXT_LOOK_KEY[f]]));
    const words = s[f].trim();
    if (!Object.keys(l).length || !words) continue;
    const cls = `am-l-${f}`;
    html = tagText(html, [marked(words), esc(words)], cls);
    const rules = textRules(l, f);
    if (rules) css.push(`@@ :is(h1,h2,h3,h4,p,div,span,small,b,strong,em).${cls}{${rules}}`);
  }
  // its two columns (desktop; a phone stacks as before)
  const left = splitOf(m);
  const g = SPLIT_GRID[m.type];
  if (left !== null && g && canSplit(m)) css.push(`@media (min-width:901px){@@ ${g.sel}{grid-template-columns:minmax(0,${left}fr) minmax(0,${100 - left}fr)!important}}`);
  return css.length || html !== d.html ? { html, css: `${d.css}\n${css.join("\n")}` } : d;
}
