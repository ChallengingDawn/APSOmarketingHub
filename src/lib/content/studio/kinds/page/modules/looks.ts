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
//   bg · bgpic                              Content v13 (SARCLA 11.11.2026: "can not change the background of some block"):
//                                           its ground - one of the shop's (petrol, light grey, red, white) or "#rrggbb" -
//                                           and a picture of the hub's under it; its words and buttons switch for contrast

import { esc } from "./kit";
import { cleanButtonLook, cleanTextLook, hexOfColor, labelOn, normHex, readCheck, unpackLook, type ButtonLook, type TextLook } from "../style";
import { pictureAddress } from "./address";
import { tileWordsOf } from "./tilewords";
import type { Drawn, ModuleRef, Opts } from "./types";

export const TEXT_LOOK_KEY = { title: "look-title", eyebrow: "look-eyebrow", text: "look-text" } as const;
export type LookField = keyof typeof TEXT_LOOK_KEY;
export const BUTTON_LOOK_KEY = { link: "btn-link", link2: "btn-link2" } as const;
/** Content v13b (SARCLA 11.11.2026: "some buttons still don't have button options"): the look of its tiles' buttons -
 * every tile's "View product" / "Alle anzeigen" alike (each still leads to its own tile's product or category) */
export const TILES_LOOK_KEY = "btn-tiles";
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
/** Words as a pattern that also finds them where the module never breaks them (Content v12): a hyphen drawn as U+2011
 * ("O‑Ring" - the library's part 2, ./library2/kit.ts own()), a space as a no-break one. A button of "Zur O-Ring
 * Auswahlhilfe" kept its look nowhere before. */
const looseRe = (s: string) => escRe(s).replace(/-/g, "[-‑]").replace(/ /g, "[  ]");
const marked = (t: string) => esc(t).replace(/==([^=]{1,60})==/g, '<span class="am-red">$1</span>');

/** The first element whose whole content is these words: its class `cls` added. */
function tagText(html: string, inner: string[], cls: string): string {
  for (const w of inner) {
    if (!w) continue;
    const re = new RegExp(`<([a-z][a-z0-9]*)((?:\\s[^>]*)?)>(${looseRe(w)})</\\1>`);
    const m = re.exec(html);
    if (!m) continue;
    const attrs = m[2] ?? "";
    const withCls = /\sclass="/.test(attrs) ? attrs.replace(/\sclass="([^"]*)"/, (_a, c: string) => ` class="${c} ${cls}"`) : `${attrs} class="${cls}"`;
    return html.slice(0, m.index) + `<${m[1]}${withCls}>${m[3]}</${m[1]}>` + html.slice(m.index + m[0].length);
  }
  return html;
}

/** A link's page without its host and store view. */
const pageOfHref = (u: string) => String(u ?? "").trim().replace(/^https?:\/\/[^/]+/i, "").replace(/^\/[a-z]{2}-[a-z]{2,3}(\/(eur|chf))?(?=\/|$)/i, "").replace(/^\/+/, "").replace(/[?#].*$/, "");

/** EVERY element whose whole content is one of these words (a tile's button: a link, or the words in one): class `cls`
 * added - never the module's own buttons (their page is the module's link), a new tab on a link when asked. */
function tagTiles(html: string, words: string[], own: string[], cls: string, tab: boolean): string {
  if (!words.length) return html;
  const re = new RegExp(`<(a|button|span|i|em|b|strong)((?:\\s[^>]*)?)>\\s*(${words.map((w) => looseRe(esc(w))).join("|")})\\s*</\\1>`, "g");
  return html.replace(re, (all, tag: string, attrs: string | undefined, said: string) => {
    const at = attrs ?? "";
    const link = /\shref="([^"]*)"/.exec(at)?.[1] ?? "";
    if (tag === "a" && link && own.includes(pageOfHref(link))) return all;
    if (/\sclass="[^"]*\bam-(b1|b2|all)\b/.test(at)) return all;
    let a = /\sclass="/.test(at) ? at.replace(/\sclass="([^"]*)"/, (_x, c: string) => ` class="${c} ${cls}"`) : `${at} class="${cls}"`;
    if (tab && tag === "a" && !/\starget=/.test(a)) a += ' target="_blank" rel="noopener"';
    return `<${tag}${a}>${said}</${tag}>`;
  });
}

/** The first link with these words: its class `cls` added, and a new tab when asked. */
function tagAnchor(html: string, label: string, cls: string, tab: boolean): string {
  const re = new RegExp(`<a((?:\\s[^>]*)?)>(${looseRe(esc(label.trim()))})</a>`);
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

export function textRules(l: TextLook, f: LookField): string {
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

export function buttonRules(b: ButtonLook, cls: string): string {
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
  // Content v11: as wide as its block, or where it stands in it
  if (b.width === "full") out.push(`${sel}{display:flex!important;width:100%!important;justify-content:center!important}`);
  else if (b.align) out.push(`${sel}{display:flex!important;width:fit-content!important;margin-left:auto!important;margin-right:${b.align === "center" ? "auto" : "0"}!important}`);
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
  // its tiles' buttons (Content v13b): every tile's alike - each still leads to its own tile's page
  const tb = cleanButtonLook(unpackLook(x[TILES_LOOK_KEY]));
  if (Object.keys(tb).length) {
    const own = [s.link, s.link2].filter((l) => l.label.trim() && l.url).map((l) => pageOfHref(l.url));
    const words = [...new Set(Object.values(tileWordsOf(s.store, x)).map((w) => w.trim()).filter(Boolean))];
    html = tagTiles(html, words, own, "am-tb", !!tb.tab);
    const rules = buttonRules(tb, "am-tb").replace(/@@ a\.am-tb/g, "@@ :is(a,button,span,i,em,b,strong).am-tb");
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

/* ── what is a look, not words (Content v13) ──────────────────────────── */

/** A key of a module's `extra` that holds a look or a setting of the studio - never words of the module (a click on the
 * page never lands on it, the AI is never told it): looks, button looks, the tiles' words, questions open, the split,
 * the ground and its picture, the "words speak of other products" mark. */
export const isLookKey = (k: string) => /^(look-|btn-|w-|open$|split$|bg$|bgpic$|reword$)/.test(k);

/* ── its ground (Content v13, SARCLA 11.11.2026: "can not change the background of some block") ── */

export const BG_KEY = "bg";
export const BG_PICTURE_KEY = "bgpic";
/** The shop's grounds a block can take, in the order the popup shows them. */
export const GROUNDS: { key: string; label: string; hex: string }[] = [
  { key: "petrol", label: "Petrol", hex: "#274e64" },
  { key: "grey", label: "Light grey", hex: "#f4f6f8" },
  { key: "red", label: "Red", hex: "#d80901" },
  { key: "white", label: "White", hex: "#ffffff" },
];
/** A ground as kept ("petrol", "#1b3a4b") as its colour - null when it is none of them. */
export function groundHex(v: unknown): string | null {
  const g = GROUNDS.find((x) => x.key === v);
  return g ? g.hex : normHex(v);
}
/** Its ground as kept: the colour (a key of the shop's or "#rrggbb", "" = the shop's own) and the hub's picture under it. */
export function groundOf(m: ModuleRef): { color: string; picture: string } {
  const x = m.settings.extra ?? {};
  const c = String(x[BG_KEY] ?? "");
  return { color: groundHex(c) ? c : "", picture: pictureAddress(x[BG_PICTURE_KEY]) };
}
/** The module with its ground changed (undefined: kept as it is; "" or null: back to the shop's own). */
export function withGroundOf(m: ModuleRef, patch: { color?: string | null; picture?: string | null }): ModuleRef {
  const extra = { ...m.settings.extra };
  if (patch.color !== undefined) { const c = patch.color && groundHex(patch.color) ? patch.color : ""; if (c) extra[BG_KEY] = c; else delete extra[BG_KEY]; }
  if (patch.picture !== undefined) { const p = pictureAddress(patch.picture ?? ""); if (p) extra[BG_PICTURE_KEY] = p; else delete extra[BG_PICTURE_KEY]; }
  return { ...m, settings: { ...m.settings, extra } };
}
/** The ground it stands on as the popups' readability check sees it ([] = a picture: not known). */
export function groundsOfModule(m: ModuleRef): string[] | null {
  const g = groundOf(m);
  if (g.picture) return [];
  const hex = groundHex(g.color);
  return hex ? [hex] : null;
}

/** The module's panel: its first element, when the module gives it a ground of its own (a campaign's grey card, the kit's
 * box) - the ground goes there; else the module itself takes it, as a rounded band. */
function panelOf(d: Drawn): string | null {
  const first = /^\s*<([a-z][a-z0-9]*)\b[^>]*?\sclass="([^"]+)"/i.exec(d.html);
  const cls = first?.[2].split(/\s+/).find((c) => /^am-[\w-]+$/.test(c));
  if (!cls) return null;
  if (cls === "am-box") return cls;
  return new RegExp(`@@ \\.${cls}\\{[^}]*\\bbackground(?:-color)?:`).test(d.css) ? cls : null;
}

/** The rules of the module that put a light ground under something (a white card, a grey tile) - their words keep the
 * shop's dark colours on a dark ground. */
function lightGrounds(css: string, skip: string | null): string[] {
  const out = new Set<string>();
  const LIGHT = /\bbackground(?:-color)?:\s*(?:#fff\b|#ffffff\b|white\b|#f[0-9a-f]{5}\b|#e[89a-f][0-9a-f]{4}\b|var\(--tile\)|linear-gradient\([^;]*?#f[0-9a-f]{2,5})/i;
  for (const r of css.matchAll(/(@@[^{}]*)\{([^{}]*)\}/g)) {
    if (!LIGHT.test(r[2])) continue;
    for (const sel of r[1].split(",").map((x) => x.trim())) {
      if (!sel.startsWith("@@") || sel === "@@" || (skip && sel === `@@ .${skip}`) || /:hover|:focus/.test(sel)) continue;
      out.add(sel);
    }
  }
  return [...out].slice(0, 40);
}

/** What the module drew on the ground a person gave it: the ground on its panel (or on it, as a rounded band), the words
 * drawn in the shop's colours switched for contrast - white on a dark ground, ink on a light one - its white cards keeping
 * their dark words, a red button on red turned white. A picture lies under a dark veil (white words). */
export function withGround(m: ModuleRef, d: Drawn, o: Opts = {}): Drawn {
  const g = groundOf(m);
  const hex = groundHex(g.color);
  if (!hex && !g.picture) return d;
  const panel = panelOf(d);
  const T = panel ? `@@ .${panel}` : "@@";
  const src = g.picture ? (o.picture ? o.picture(g.picture) : g.picture) : "";
  const fg = src ? "#ffffff" : labelOn(hex!);
  const dark = fg === "#ffffff";
  const ground = src ? `linear-gradient(rgba(21,34,58,.58),rgba(21,34,58,.58)),url("${src.replace(/["\()]/g, "")}") center/cover no-repeat${hex ? ` ${hex}` : ""}` : hex!;
  const css: string[] = [
    `${T}{background:${ground}!important;--ink:${dark ? "#ffffff" : "#1d2326"};--txt:${dark ? "rgba(255,255,255,.88)" : "#3d4448"};--mute:${dark ? "rgba(255,255,255,.78)" : "#5b6267"};color:var(--txt)}`,
  ];
  if (!panel) css.push(`@@{padding:clamp(22px,3vw,40px) clamp(16px,2.6vw,34px)!important;border-radius:24px}`, `@media (max-width:900px){@@{border-radius:18px}}`);
  if (dark) {
    css.push(`${T} :is(.am-btn2,.am-all){border-color:rgba(255,255,255,.75)!important;color:#fff!important}`);
    // an outlined button (or a link) a person made without a colour of its own: white on the dark ground
    const plain = (packed: string | undefined) => { const b = cleanButtonLook(unpackLook(packed)); return (b.style === "outline" || b.style === "link") && !b.color; };
    if (plain(m.settings.extra[BUTTON_LOOK_KEY.link])) css.push(`@@ a.am-b1.am-b1{border-color:rgba(255,255,255,.8)!important;color:#fff!important}`);
    if (plain(m.settings.extra[BUTTON_LOOK_KEY.link2])) css.push(`@@ a.am-b2.am-b2{border-color:rgba(255,255,255,.8)!important;color:#fff!important}`);
    for (const a of m.settings.adds ?? []) if (a.kind === "button" && plain(a.look)) css.push(`@@ a.am-x-${a.id}.am-xb{border-color:rgba(255,255,255,.8)!important;color:#fff!important}`);
    for (const sel of lightGrounds(d.css, panel)) css.push(`${sel}{--ink:#1d2326;--txt:#5e5e5e;--mute:#5b6267}`);
  }
  // the shop's red buttons and red words on a ground they cannot be read on: white buttons, white words
  const red = hex ? readCheck("#d80901", [hex], true).ratio : 21;
  if (red < 3) css.push(`${T} .am-red{color:${fg}!important;text-decoration:underline;text-underline-offset:.12em}`);
  if (red < 1.6) css.push(`${T} :is(.am-btn,a.am-xb):not(.is-pet):not(.am-b1):not(.am-b2){background:#fff!important;color:#d80901!important}`, `${T} .am-ey::before{background:${fg}!important}`);
  return { html: d.html, css: `${d.css}\n${css.join("\n")}` };
}
