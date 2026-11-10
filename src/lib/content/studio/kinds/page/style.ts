// PAGE - COLOURS, TEXT LOOKS AND BUTTONS (Content v10, 10.11.2026). Pure: relative imports only - the tests run it in node.
//
// SARCLA 10.11.2026 (points 2 and 3): "when I click element I should have option to change text color, custom color, some
// kind of editing" and "also on button settings better, also color". One vocabulary for every place a text or a button is
// changed - a new page's field (kept in its looks, drawn by ./newpage.ts), a page of the shop's element (its look change:
// one stylesheet for it, ../../../../../app/projects/studio/kinds/page/edits.ts) and a module's words or button (kept in
// the module's `extra`, drawn by ./modules/looks.ts):
//
//   the shop's palette   red #d80901, petrol #274e64, ink #1d2326, grey #66727a, white - or a colour of its own (#rrggbb)
//   a text               colour, size (S M L XL), weight, italic, underline, alignment
//   a button             style (filled / outline / link), colour, size, the arrow on or off, a new tab or not
//
// The readability guard of Content v6 (./readable.ts, WCAG) still applies: a colour that cannot be read on its ground is
// FLAGGED before it is put on the page (readCheck), never applied silently.

import { contrast, parseColor, type Rgba } from "./readable";

/* ── the palette ──────────────────────────────────────────────────────── */

export type Swatch = { key: PaletteKey; label: string; hex: string };
export type PaletteKey = "red" | "petrol" | "ink" | "muted" | "white";

/** The shop's colours, in the order the popups show them. */
export const PALETTE: Swatch[] = [
  { key: "red", label: "Red", hex: "#d80901" },
  { key: "petrol", label: "Petrol", hex: "#274e64" },
  { key: "ink", label: "Ink", hex: "#1d2326" },
  { key: "muted", label: "Grey", hex: "#66727a" },
  { key: "white", label: "White", hex: "#ffffff" },
];
const BY_KEY = new Map(PALETTE.map((s) => [s.key, s]));
export const isPaletteKey = (v: unknown): v is PaletteKey => typeof v === "string" && BY_KEY.has(v as PaletteKey);

/** A colour typed by a person ("#274E64", "274e64", "#abc") as "#rrggbb" - null when it is not one. */
export function normHex(v: unknown): string | null {
  const s = String(v ?? "").trim().toLowerCase().replace(/^#/, "");
  if (/^[0-9a-f]{6}$/.test(s)) return `#${s}`;
  if (/^[0-9a-f]{3}$/.test(s)) return `#${[...s].map((c) => c + c).join("")}`;
  return null;
}

/** A colour as stored (a palette key or "#rrggbb") as its code - null when it is neither. */
export function hexOfColor(v: unknown): string | null {
  if (isPaletteKey(v)) return BY_KEY.get(v)!.hex;
  return normHex(v);
}

/** A code named back: the palette's own key when it is one of the shop's colours, else the code itself. */
export function colorKeyOf(hex: string | null | undefined): PaletteKey | string | null {
  const h = normHex(hex);
  if (!h) return null;
  return PALETTE.find((s) => s.hex === h)?.key ?? h;
}

/** A colour in plain words: "Petrol", "Red", or its code. */
export function colorLabel(v: unknown): string {
  if (isPaletteKey(v)) return BY_KEY.get(v)!.label;
  const h = normHex(v);
  const p = h ? PALETTE.find((s) => s.hex === h) : null;
  return p ? p.label : h ?? "Standard";
}

/** The words' colour on a filled button of this colour: white, or ink on a light one. */
export function labelOn(hex: string): string {
  const c = parseColor(hex);
  if (!c) return "#ffffff";
  const white: Rgba = { r: 255, g: 255, b: 255, a: 1 };
  const ink: Rgba = { r: 29, g: 35, b: 38, a: 1 };
  return contrast(c, white) >= contrast(c, ink) ? "#ffffff" : "#1d2326";
}

/* ── can it be read? ──────────────────────────────────────────────────── */

/** A new page's grounds by its blocks' backgrounds (./newpage.ts). */
export const GROUND: Record<string, string> = { white: "#ffffff", grey: "#f2f4f5", sand: "#f7f2ea", petrol: "#274e64" };

export type ReadCheck = {
  ok: boolean;
  /** its contrast on the worst of its grounds, 1 to 21 */
  ratio: number;
  /** what it needs: 4.5:1, or 3:1 for large words (a heading, 24 px and more) */
  need: number;
  ground: string;
  /** said to the person when it is not ok */
  why: string;
};

const nameOf = (hex: string) => { const p = PALETTE.find((s) => s.hex === hex); return p ? `${p.label.toLowerCase()} ${hex}` : hex; };

/**
 * A colour on its grounds (one or several, a gradient's stops): ok when it reads on every one - WCAG's 4.5:1, 3:1 for
 * large words. No ground known (a picture under it): ok, with the reason to look.
 */
export function readCheck(color: string, grounds: string[], large = false): ReadCheck {
  const c = parseColor(hexOfColor(color) ?? color);
  const need = large ? 3 : 4.5;
  const gs = grounds.map((g) => parseColor(hexOfColor(g) ?? g)).filter((g): g is Rgba => !!g && g.a > 0.5);
  if (!c) return { ok: true, ratio: 21, need, ground: "", why: "" };
  if (!gs.length) return { ok: true, ratio: 21, need, ground: "", why: "It stands on a picture - look that it reads." };
  let worst = { ratio: 22, g: gs[0] };
  for (const g of gs) { const r = contrast(c, g); if (r < worst.ratio) worst = { ratio: r, g }; }
  const toHex = (x: Rgba) => `#${[x.r, x.g, x.b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
  const fg = toHex(c), bg = toHex(worst.g);
  const ratio = Math.round(worst.ratio * 10) / 10;
  if (worst.ratio >= need) return { ok: true, ratio, need, ground: bg, why: "" };
  const same = worst.ratio < 1.25;
  return {
    ok: false, ratio, need, ground: bg,
    why: same
      ? `${cap(nameOf(fg))} on ${nameOf(bg)}: the colour of its ground - it cannot be read.`
      : `${cap(nameOf(fg))} on ${nameOf(bg)}: ${ratio.toFixed(1)}:1 - words need ${need}:1 to be read.`,
  };
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* ── a text's look ────────────────────────────────────────────────────── */

export type TextSize = "s" | "m" | "l" | "xl";
export type TextAlign = "left" | "center" | "right";
/** What a text's look can say - every value optional (unset = as the block draws it). */
export type TextLook = {
  /** a palette key or "#rrggbb" */
  color?: string;
  size?: TextSize;
  weight?: "regular" | "bold";
  italic?: boolean;
  underline?: boolean;
  align?: TextAlign;
};

export const SIZES: { key: TextSize; label: string }[] = [{ key: "s", label: "S" }, { key: "m", label: "M" }, { key: "l", label: "L" }, { key: "xl", label: "XL" }];

/** A text look kept as it may be (unknown values left out). */
export function cleanTextLook(v: unknown): TextLook {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const out: TextLook = {};
  const color = isPaletteKey(o.color) ? o.color : normHex(o.color);
  if (color) out.color = color;
  if (["s", "m", "l", "xl"].includes(String(o.size)) && o.size !== "m") out.size = o.size as TextSize;
  if (o.weight === "bold" || o.weight === "regular") out.weight = o.weight;
  if (o.italic === true) out.italic = true;
  if (o.underline === true) out.underline = true;
  if (o.align === "left" || o.align === "center" || o.align === "right") out.align = o.align;
  return out;
}

/** "Petrol · Large · Bold" - what is set, for a line in the popup and in "Changes made here". */
export function lookWords(l: TextLook): string {
  const parts: string[] = [];
  if (l.color) parts.push(colorLabel(l.color));
  if (l.size) parts.push({ s: "Small", m: "Normal", l: "Large", xl: "Extra large" }[l.size]);
  if (l.weight) parts.push(l.weight === "bold" ? "Bold" : "Regular");
  if (l.italic) parts.push("Italic");
  if (l.underline) parts.push("Underlined");
  if (l.align) parts.push({ left: "Left", center: "Centred", right: "Right" }[l.align]);
  return parts.join(" · ");
}

/* ── a page of the shop's element: its look as CSS rules (edits.ts lookCss) ── */

const SHOP_SIZE: Record<TextSize, string> = { s: "0.88em", m: "", l: "1.2em", xl: "1.45em" };

/** A page of the shop's element: the CSS rules of its look ("color", "font-size"...), as edits.ts keeps them. */
export function shopRulesOf(l: TextLook): Record<string, string> {
  const out: Record<string, string> = {};
  const hex = l.color ? hexOfColor(l.color) : null;
  if (hex) out.color = hex;
  if (l.size && SHOP_SIZE[l.size]) out["font-size"] = SHOP_SIZE[l.size];
  if (l.weight) out["font-weight"] = l.weight === "bold" ? "700" : "400";
  if (l.italic) out["font-style"] = "italic";
  if (l.underline) out["text-decoration"] = "underline";
  if (l.align) out["text-align"] = l.align;
  return out;
}

/** The rules of a page of the shop's element read back as a look (what the popup shows as set). */
export function lookOfShopRules(r: Record<string, string>): TextLook {
  const out: TextLook = {};
  const hex = normHex(r.color);
  if (hex) out.color = colorKeyOf(hex) ?? hex;
  const size = (Object.entries(SHOP_SIZE) as [TextSize, string][]).find(([, v]) => v && v === r["font-size"])?.[0];
  if (size) out.size = size;
  if (r["font-weight"] === "700" || r["font-weight"] === "bold") out.weight = "bold";
  else if (r["font-weight"] === "400" || r["font-weight"] === "normal") out.weight = "regular";
  if (r["font-style"] === "italic") out.italic = true;
  if (/underline/.test(r["text-decoration"] ?? "")) out.underline = true;
  if (r["text-align"] === "left" || r["text-align"] === "center" || r["text-align"] === "right") out.align = r["text-align"];
  return out;
}

/** The rules a look sets, merged into an element's rules as stored (the look's own rules replaced, others kept). */
export function withShopLook(rules: Record<string, string>, l: TextLook): Record<string, string> {
  const own = ["color", "font-size", "font-weight", "font-style", "text-decoration", "text-align"];
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(rules)) if (!own.includes(k) && v) out[k] = v;
  return { ...out, ...shopRulesOf(l) };
}

/* ── a button ─────────────────────────────────────────────────────────── */

export type ButtonStyle = "filled" | "outline" | "link";
export type ButtonSize = "s" | "m" | "l";
export type ButtonLook = {
  style?: ButtonStyle;
  /** a palette key or "#rrggbb" */
  color?: string;
  size?: ButtonSize;
  /** false = no arrow, true = an arrow (unset: a new page's button has one, a module's as the module draws it) */
  arrow?: boolean;
  /** true = the page opens in a new tab */
  tab?: boolean;
};

export const BUTTON_STYLES: { key: ButtonStyle; label: string }[] = [{ key: "filled", label: "Filled" }, { key: "outline", label: "Outline" }, { key: "link", label: "Link" }];
export const BUTTON_SIZES: { key: ButtonSize; label: string }[] = [{ key: "s", label: "S" }, { key: "m", label: "M" }, { key: "l", label: "L" }];

export function cleanButtonLook(v: unknown): ButtonLook {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const out: ButtonLook = {};
  if (o.style === "filled" || o.style === "outline" || o.style === "link") out.style = o.style;
  const color = isPaletteKey(o.color) ? o.color : normHex(o.color);
  if (color) out.color = color;
  if (o.size === "s" || o.size === "l") out.size = o.size;
  if (typeof o.arrow === "boolean") out.arrow = o.arrow;
  if (o.tab === true) out.tab = true;
  return out;
}

/** The colour a button's words stand out in: the fill (filled), or the line and words (outline, link). */
export function buttonColor(b: ButtonLook, fallback: string): string {
  return hexOfColor(b.color) ?? hexOfColor(fallback) ?? "#d80901";
}

/** Can the button be read on its ground? A filled one carries its own words' colour (white or ink); an outline or a
 * link must read on the block's ground itself. */
export function buttonCheck(b: ButtonLook, fallback: string, grounds: string[]): ReadCheck {
  const hex = buttonColor(b, fallback);
  if ((b.style ?? "filled") === "filled") {
    // the fill must stand out from the ground a little (3:1, as a control); its words are made to read on it
    const r = readCheck(hex, grounds, true);
    return r.ok ? r : { ...r, why: r.why.replace("words need 3:1 to be read", "the button needs 3:1 to stand out").replace("it cannot be read", "the button disappears") };
  }
  return readCheck(hex, grounds, false);
}

/* ── a compact string of a look (a module's `extra` holds words only) ─── */

/** A look kept as one short string ("c=#274e64;z=l;w=b;i=1;u=1;a=center;s=outline;r=0;t=1") - a module's `extra` value. */
export function packLook(l: TextLook & ButtonLook & { size?: string }): string {
  const parts: string[] = [];
  if (l.color) parts.push(`c=${l.color}`);
  if (l.size) parts.push(`z=${l.size}`);
  if ((l as TextLook).weight) parts.push(`w=${(l as TextLook).weight === "bold" ? "b" : "r"}`);
  if ((l as TextLook).italic) parts.push("i=1");
  if ((l as TextLook).underline) parts.push("u=1");
  if ((l as TextLook).align) parts.push(`a=${(l as TextLook).align}`);
  if ((l as ButtonLook).style) parts.push(`s=${(l as ButtonLook).style}`);
  if (typeof (l as ButtonLook).arrow === "boolean") parts.push(`r=${(l as ButtonLook).arrow ? 1 : 0}`);
  if ((l as ButtonLook).tab) parts.push("t=1");
  return parts.join(";");
}

/** A packed look read back: a text's and a button's values (each cleaned by its own reader). */
export function unpackLook(s: unknown): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const part of String(s ?? "").split(";")) {
    const [k, v] = part.split("=");
    if (!k || v === undefined) continue;
    if (k === "c") o.color = v;
    else if (k === "z") o.size = v;
    else if (k === "w") o.weight = v === "b" ? "bold" : v === "r" ? "regular" : undefined;
    else if (k === "i") o.italic = v === "1";
    else if (k === "u") o.underline = v === "1";
    else if (k === "a") o.align = v;
    else if (k === "s") o.style = v;
    else if (k === "r") o.arrow = v !== "0";
    else if (k === "t") o.tab = v === "1";
  }
  return o;
}
