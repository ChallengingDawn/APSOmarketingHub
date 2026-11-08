// PAGE - A VERSION LAID OVER THE PAGE ON THE SERVER (08.11.2026). Pure: no "@/" imports, so it is tested.
//
// APSOconvert lays a version over the page in the browser, with a script (src/lib/convert/versions.ts runtimeSource).
// The studio's preview cannot run one: it is a srcDoc frame without scripts, inside the hub's own rules. So the same
// change list is applied here, to the page's HTML, the way that script applies it:
//   - the stylesheets go in at once; each element change finds its element(s) by the selector, in page order;
//   - html = new inner HTML, replace = the element replaced, insert = before / after / prepend / append, text = new text,
//     hide = display:none !important, attr = an attribute set;
//   - what replace and insert put in is marked data-apso-v, and later changes do not touch marked parts;
//   - changes run one after the other, so a change may aim at what an earlier "html" change wrote.
// The page's own text is kept as it was: the tree only says WHERE each element starts and ends, and the changes are
// spliced into the original string. A selector this reader does not know (:hover, :has()) is said, never guessed.

/* ── the tree ─────────────────────────────────────────────────────────── */

export type Attr = { name: string; value: string | null; from: number; to: number };
export type Node = {
  tag: string;
  attrs: Attr[];
  /** where the open tag starts, where it ends, where the close tag starts, where the element ends */
  start: number; openEnd: number; closeStart: number; end: number;
  parent: Node | null;
  children: Node[];
  index: number;
};

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "keygen", "link", "meta", "param", "source", "track", "wbr"]);
const RAW = new Set(["script", "style", "textarea", "title", "xmp", "noscript", "iframe", "noembed", "noframes"]);
const CLOSES_P = new Set([
  "address", "article", "aside", "blockquote", "center", "details", "dialog", "dir", "div", "dl", "fieldset", "figcaption", "figure",
  "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hgroup", "hr", "main", "menu", "nav", "ol", "p", "pre", "section",
  "table", "ul", "li", "dd", "dt", "summary", "search",
]);
const SCOPE = new Set(["#root", "html", "table", "td", "th", "caption", "template", "object", "marquee", "applet"]);

const OPEN = /<([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/y;
const CLOSE = /<\/([a-zA-Z][\w:-]*)[^>]*>/y;
const ATTR = /([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function attrsOf(text: string, offset: number): Attr[] {
  const out: Attr[] = [];
  ATTR.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ATTR.exec(text))) {
    if (m[1] === "/") continue;
    out.push({ name: m[1].toLowerCase(), value: m[2] ?? m[3] ?? m[4] ?? null, from: offset + m.index, to: offset + m.index + m[0].length });
  }
  return out;
}

const rawEnd = new Map<string, RegExp>();

/** The page as a tree of elements with their places in the text. Forgiving the way browsers are, for what pages do. */
export function parseHtml(html: string): Node {
  const n = html.length;
  const root: Node = { tag: "#root", attrs: [], start: 0, openEnd: 0, closeStart: n, end: n, parent: null, children: [], index: 0 };
  const stack: Node[] = [root];
  let foreign = 0;
  const top = () => stack[stack.length - 1];
  const close = (at: number) => { const x = stack.pop()!; x.closeStart = at; x.end = at; if (x.tag === "svg" || x.tag === "math") foreign--; };
  /** closes the nearest open `tags` element (and what is open inside it) unless a `stop` element comes first */
  const closeNearest = (tags: Set<string> | string, stop: Set<string>, at: number) => {
    for (let k = stack.length - 1; k > 0; k--) {
      const t = stack[k].tag;
      if (typeof tags === "string" ? t === tags : tags.has(t)) { while (stack.length > k) close(at); return; }
      if (stop.has(t)) return;
    }
  };
  let i = 0;
  while (i < n) {
    const lt = html.indexOf("<", i);
    if (lt < 0) break;
    const c1 = html.charCodeAt(lt + 1);
    if (html.startsWith("<!--", lt)) { const e = html.indexOf("-->", lt + 4); i = e < 0 ? n : e + 3; continue; }
    if (c1 === 33 /* ! */ || c1 === 63 /* ? */) { const e = html.indexOf(">", lt); i = e < 0 ? n : e + 1; continue; }
    if (c1 === 47 /* / */) {
      CLOSE.lastIndex = lt;
      const m = CLOSE.exec(html);
      if (!m) { i = lt + 1; continue; }
      const tag = m[1].toLowerCase();
      const end = lt + m[0].length;
      let k = stack.length - 1;
      while (k > 0 && stack[k].tag !== tag) k--;
      if (k > 0) {
        while (stack.length > k + 1) close(lt);
        const x = stack.pop()!;
        x.closeStart = lt; x.end = end;
        if (x.tag === "svg" || x.tag === "math") foreign--;
      }
      i = end;
      continue;
    }
    OPEN.lastIndex = lt;
    const m = OPEN.exec(html);
    if (!m) { i = lt + 1; continue; }
    const tag = m[1].toLowerCase();
    const openEnd = lt + m[0].length;
    const attrText = m[2] ?? "";
    // what this tag closes, as a browser would
    if (!foreign) {
      if (CLOSES_P.has(tag)) closeNearest("p", new Set([...SCOPE, "button"]), lt);
      if (tag === "li") closeNearest("li", new Set([...SCOPE, "ol", "ul"]), lt);
      else if (tag === "dt" || tag === "dd") closeNearest(new Set(["dt", "dd"]), new Set([...SCOPE, "dl"]), lt);
      else if (tag === "td" || tag === "th") closeNearest(new Set(["td", "th"]), new Set(["#root", "html", "tr", "table", "template"]), lt);
      else if (tag === "tr") closeNearest("tr", new Set(["#root", "html", "table", "thead", "tbody", "tfoot", "template"]), lt);
      else if (tag === "thead" || tag === "tbody" || tag === "tfoot") closeNearest(new Set(["thead", "tbody", "tfoot"]), new Set(["#root", "html", "table", "template"]), lt);
      else if (tag === "option" && top().tag === "option") close(lt);
      else if (tag === "optgroup") closeNearest(new Set(["option", "optgroup"]), new Set(["#root", "select"]), lt);
    }
    const parent = top();
    const el: Node = { tag, attrs: attrsOf(attrText, lt + 1 + m[1].length), start: lt, openEnd, closeStart: openEnd, end: openEnd, parent, children: [], index: parent.children.length };
    parent.children.push(el);
    const selfClosed = /\/\s*$/.test(attrText);
    if (VOID.has(tag) || (foreign && selfClosed)) { i = openEnd; continue; }
    if (RAW.has(tag) && !foreign) {
      let re = rawEnd.get(tag);
      if (!re) { re = new RegExp(`</${tag}\\s*>`, "ig"); rawEnd.set(tag, re); }
      re.lastIndex = openEnd;
      const e = re.exec(html);
      el.closeStart = e ? e.index : n;
      el.end = e ? e.index + e[0].length : n;
      i = el.end;
      continue;
    }
    if (tag === "svg" || tag === "math") foreign++;
    stack.push(el);
    i = openEnd;
  }
  while (stack.length > 1) close(n);
  return root;
}

/* ── selectors ────────────────────────────────────────────────────────── */

type AttrSel = { name: string; op: string; value: string; i: boolean };
type Pseudo =
  | { kind: "nth"; a: number; b: number; last: boolean; type: boolean }
  | { kind: "only"; type: boolean }
  | { kind: "not"; list: Compound[] }
  | { kind: "root" };
type Compound = { tag: string | null; id: string | null; classes: string[]; attrs: AttrSel[]; pseudos: Pseudo[] };
type Complex = { parts: Compound[]; combs: string[] };

class Unreadable extends Error {}

function readSelector(src: string): Complex[] {
  let p = 0;
  const s = src.trim();
  const ws = () => { while (p < s.length && /\s/.test(s[p])) p++; };
  const ident = (): string => {
    let out = "";
    while (p < s.length) {
      const ch = s[p];
      if (ch === "\\") {
        const hex = /^[0-9a-fA-F]{1,6}\s?/.exec(s.slice(p + 1, p + 8));
        if (hex) { out += String.fromCodePoint(Number.parseInt(hex[0].trim(), 16)); p += 1 + hex[0].length; }
        else { out += s[p + 1] ?? ""; p += 2; }
        continue;
      }
      if (/[\w-]/.test(ch) || ch.charCodeAt(0) > 127) { out += ch; p++; continue; }
      break;
    }
    if (!out) throw new Unreadable();
    return out;
  };
  const quoted = (): string => {
    const q = s[p];
    if (q !== '"' && q !== "'") return ident();
    p++;
    let out = "";
    while (p < s.length && s[p] !== q) { if (s[p] === "\\") { out += s[p + 1] ?? ""; p += 2; } else out += s[p++]; }
    if (s[p] !== q) throw new Unreadable();
    p++;
    return out;
  };
  const nth = (arg: string): { a: number; b: number } => {
    const t = arg.replace(/\s+/g, "").toLowerCase();
    if (t === "odd") return { a: 2, b: 1 };
    if (t === "even") return { a: 2, b: 0 };
    const m = /^([+-]?\d*)n([+-]\d+)?$/.exec(t);
    if (m) return { a: m[1] === "" || m[1] === "+" ? 1 : m[1] === "-" ? -1 : Number(m[1]), b: m[2] ? Number(m[2]) : 0 };
    if (/^[+-]?\d+$/.test(t)) return { a: 0, b: Number(t) };
    throw new Unreadable();
  };
  const compound = (inner = false): Compound => {
    const c: Compound = { tag: null, id: null, classes: [], attrs: [], pseudos: [] };
    let any = false;
    if (s[p] === "*") { p++; any = true; }
    else if (p < s.length && /[\w\\-]/.test(s[p])) { c.tag = ident().toLowerCase(); any = true; }
    for (;;) {
      const ch = s[p];
      if (ch === "#") { p++; c.id = ident(); any = true; continue; }
      if (ch === ".") { p++; c.classes.push(ident()); any = true; continue; }
      if (ch === "[") {
        p++; ws();
        const name = ident().toLowerCase(); ws();
        let op = "", value = "", i = false;
        const opm = /^([~|^$*]?=)/.exec(s.slice(p));
        if (opm) { op = opm[1]; p += op.length; ws(); value = quoted(); ws(); if (/[iI]/.test(s[p] ?? "") && s[p + 1] !== "=") { i = true; p++; ws(); } }
        if (s[p] !== "]") throw new Unreadable();
        p++;
        c.attrs.push({ name, op, value, i });
        any = true;
        continue;
      }
      if (ch === ":") {
        if (s[p + 1] === ":") throw new Unreadable();
        p++;
        const name = ident().toLowerCase();
        let arg: string | null = null;
        if (s[p] === "(") {
          let depth = 1, k = p + 1;
          while (k < s.length && depth) { if (s[k] === "(") depth++; else if (s[k] === ")") depth--; k++; }
          if (depth) throw new Unreadable();
          arg = s.slice(p + 1, k - 1);
          p = k;
        }
        if (name === "first-child") c.pseudos.push({ kind: "nth", a: 0, b: 1, last: false, type: false });
        else if (name === "last-child") c.pseudos.push({ kind: "nth", a: 0, b: 1, last: true, type: false });
        else if (name === "first-of-type") c.pseudos.push({ kind: "nth", a: 0, b: 1, last: false, type: true });
        else if (name === "last-of-type") c.pseudos.push({ kind: "nth", a: 0, b: 1, last: true, type: true });
        else if (name === "only-child") c.pseudos.push({ kind: "only", type: false });
        else if (name === "only-of-type") c.pseudos.push({ kind: "only", type: true });
        else if (name === "root") c.pseudos.push({ kind: "root" });
        else if (arg !== null && (name === "nth-child" || name === "nth-last-child" || name === "nth-of-type" || name === "nth-last-of-type")) {
          c.pseudos.push({ kind: "nth", ...nth(arg), last: name.includes("last"), type: name.includes("of-type") });
        } else if (arg !== null && name === "not" && !inner) {
          const sub = readSelector(arg);
          if (sub.some((x) => x.parts.length !== 1)) throw new Unreadable();
          c.pseudos.push({ kind: "not", list: sub.map((x) => x.parts[0]) });
        } else throw new Unreadable();
        any = true;
        continue;
      }
      break;
    }
    if (!any) throw new Unreadable();
    return c;
  };
  const groups: Complex[] = [];
  ws();
  for (;;) {
    const cx: Complex = { parts: [compound()], combs: [] };
    for (;;) {
      const before = p;
      ws();
      const ch = s[p];
      if (p >= s.length || ch === ",") break;
      if (ch === ">" || ch === "+" || ch === "~") { p++; ws(); cx.combs.push(ch); cx.parts.push(compound()); continue; }
      if (p > before) { cx.combs.push(" "); cx.parts.push(compound()); continue; }
      throw new Unreadable();
    }
    groups.push(cx);
    if (p >= s.length) break;
    p++; // the comma
    ws();
  }
  return groups;
}

/** The selector as this reader matches it, or null when it uses what the reader does not know. */
export function parseSelector(sel: string): Complex[] | null {
  try { return readSelector(sel); } catch { return null; }
}

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decodeAttr = (v: string) => v.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, e: string) =>
  e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? Number.parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENT[e.toLowerCase()] ?? all);

const attrOf = (el: Node, name: string): string | null => {
  const a = el.attrs.find((x) => x.name === name);
  return a ? decodeAttr(a.value ?? "") : null;
};

function nthOk(pos: number, a: number, b: number): boolean {
  if (a === 0) return pos === b;
  const k = (pos - b) / a;
  return Number.isInteger(k) && k >= 0;
}

/** An element's place among its siblings (of its type, or all), and how many there are - counted once per parent, so a
 * page with 20,000 rows is not read 20,000 times over (:last-child, :nth-of-type). */
const TYPES = new WeakMap<Node, { lists: Map<string, number>; pos: Map<Node, number> }>();
function placeOf(el: Node, type: boolean): { at: number; len: number } {
  const parent = el.parent;
  if (!parent) return { at: 0, len: 1 };
  if (!type) return { at: el.index, len: parent.children.length };
  let c = TYPES.get(parent);
  if (!c) {
    c = { lists: new Map(), pos: new Map() };
    for (const ch of parent.children) { const n = c.lists.get(ch.tag) ?? 0; c.pos.set(ch, n); c.lists.set(ch.tag, n + 1); }
    TYPES.set(parent, c);
  }
  return { at: c.pos.get(el) ?? 0, len: c.lists.get(el.tag) ?? 1 };
}

function matchCompound(el: Node, c: Compound): boolean {
  if (c.tag && c.tag !== el.tag) return false;
  if (c.id !== null && attrOf(el, "id") !== c.id) return false;
  if (c.classes.length) {
    const cls = (attrOf(el, "class") ?? "").split(/\s+/);
    for (const k of c.classes) if (!cls.includes(k)) return false;
  }
  for (const a of c.attrs) {
    let v = attrOf(el, a.name);
    if (v === null) return false;
    if (!a.op) continue;
    let want = a.value;
    if (a.i) { v = v.toLowerCase(); want = want.toLowerCase(); }
    const ok = a.op === "=" ? v === want
      : a.op === "~=" ? v.split(/\s+/).includes(want)
        : a.op === "|=" ? v === want || v.startsWith(`${want}-`)
          : a.op === "^=" ? !!want && v.startsWith(want)
            : a.op === "$=" ? !!want && v.endsWith(want)
              : !!want && v.includes(want);
    if (!ok) return false;
  }
  for (const ps of c.pseudos) {
    if (ps.kind === "root") { if (el.parent?.tag !== "#root") return false; continue; }
    if (ps.kind === "not") { if (ps.list.some((x) => matchCompound(el, x))) return false; continue; }
    const { at, len } = placeOf(el, ps.type);
    if (ps.kind === "only") { if (len !== 1) return false; continue; }
    const pos = ps.last ? len - at : at + 1;
    if (!nthOk(pos, ps.a, ps.b)) return false;
  }
  return true;
}

function matchFrom(el: Node, cx: Complex, k: number): boolean {
  if (!matchCompound(el, cx.parts[k])) return false;
  if (k === 0) return true;
  const comb = cx.combs[k - 1];
  if (comb === ">") return !!el.parent && el.parent.tag !== "#root" && matchFrom(el.parent, cx, k - 1);
  if (comb === " ") {
    for (let p = el.parent; p && p.tag !== "#root"; p = p.parent) if (matchFrom(p, cx, k - 1)) return true;
    return false;
  }
  const sib = el.parent ? el.parent.children : [];
  if (comb === "+") return el.index > 0 && matchFrom(sib[el.index - 1], cx, k - 1);
  for (let j = el.index - 1; j >= 0; j--) if (matchFrom(sib[j], cx, k - 1)) return true;
  return false;
}

/** Every element the selector finds, in page order - leaving out what a version put in (data-apso-v), as the script does. */
export function selectAll(root: Node, groups: Complex[]): Node[] {
  const out: Node[] = [];
  const walk = (el: Node, marked: boolean) => {
    for (const ch of el.children) {
      const m = marked || ch.attrs.some((a) => a.name === "data-apso-v");
      if (!m && groups.some((g) => matchFrom(ch, g, g.parts.length - 1))) out.push(ch);
      walk(ch, m);
    }
  };
  walk(root, false);
  return out;
}

/* ── the changes ──────────────────────────────────────────────────────── */

type Where = "before" | "after" | "prepend" | "append";
/** The shape of one change (src/lib/convert/versions.ts Change) - repeated here so this file stands alone. */
export type AnyChange =
  | { op: "css"; css: string }
  | { op: "html" | "replace"; selector: string; html: string; all?: boolean }
  | { op: "insert"; selector: string; where: Where; html: string; all?: boolean }
  | { op: "text"; selector: string; text: string; all?: boolean }
  | { op: "hide"; selector: string; all?: boolean }
  | { op: "attr"; selector: string; name: string; value: string; all?: boolean };

/** What each change found: a stylesheet, its element(s), nothing, or a selector this reader does not know. */
export type Hit = { state: "css" | "found" | "missing" | "unread"; count: number };

const escText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

/** HTML put in by replace / insert, its top elements marked data-apso-v so later changes leave them alone - in the
 * studio's preview also with the change they came from (`from`, data-apx-c) and their place in it (data-apx-k), so a
 * click on them edits that change. */
export function markFragment(html: string, from?: number): string {
  const root = parseHtml(html);
  let out = html;
  const tops = root.children;
  for (let k = tops.length - 1; k >= 0; k--) {
    const el = tops[k];
    const at = el.start + 1 + el.tag.length;
    out = `${out.slice(0, at)} data-apso-v=""${from === undefined ? "" : ` data-apx-c="${from}" data-apx-k="${k}"`}${out.slice(at)}`;
  }
  return out;
}

/** The top-level elements of a fragment, as [start, end) places in it - for putting one edited element back. */
export function fragmentTops(html: string): { start: number; end: number; tag: string }[] {
  return parseHtml(html).children.map((el) => ({ start: el.start, end: el.end, tag: el.tag }));
}

/** A fragment with its k-th top element replaced (an element edited in the preview); null when it has no such one. */
export function replaceTop(html: string, k: number, next: string): string | null {
  const tops = fragmentTops(html);
  const t = tops[k];
  if (!t) return null;
  return html.slice(0, t.start) + next + html.slice(t.end);
}

type Edit = { from: number; to: number; text: string; seq: number };

/** The open tag with one attribute set (added after the tag name when it is not there). */
function withAttr(el: Node, name: string, value: (old: string | null) => string): Edit {
  const a = el.attrs.find((x) => x.name === name);
  if (a) return { from: a.from, to: a.to, text: `${name}="${escAttr(value(a.value === null ? "" : decodeAttr(a.value)))}"`, seq: 0 };
  const at = el.start + 1 + el.tag.length;
  return { from: at, to: at, text: ` ${name}="${escAttr(value(null))}"`, seq: 0 };
}

function editsFor(c: AnyChange, els: Node[], from?: number): Edit[] {
  const out: Edit[] = [];
  els.forEach((el, seq) => {
    const isVoid = VOID.has(el.tag);
    let e: Edit | null = null;
    // the preview's mark: the shop's element a change works on says which change(s) (data-apx-x="2 5")
    if (from !== undefined && c.op !== "replace" && c.op !== "insert" && (c.op === "attr" || c.op === "hide" || !isVoid)) {
      out.push({ ...withAttr(el, "data-apx-x", (old) => (old ? `${old} ${from}` : String(from))), seq: seq + 0.5 });
    }
    switch (c.op) {
      case "html": if (!isVoid) e = { from: el.openEnd, to: el.closeStart, text: c.html, seq }; break;
      case "text": if (!isVoid) e = { from: el.openEnd, to: el.closeStart, text: escText(c.text), seq }; break;
      case "replace": e = { from: el.start, to: el.end, text: markFragment(c.html, from), seq }; break;
      case "insert": {
        const f = markFragment(c.html, from);
        if (c.where === "before") e = { from: el.start, to: el.start, text: f, seq };
        else if (c.where === "after") e = { from: el.end, to: el.end, text: f, seq };
        else if (!isVoid) e = c.where === "prepend" ? { from: el.openEnd, to: el.openEnd, text: f, seq } : { from: el.closeStart, to: el.closeStart, text: f, seq };
        break;
      }
      case "hide": e = { ...withAttr(el, "style", (old) => `${old ? `${old.replace(/;\s*$/, "")};` : ""}display:none !important`), seq }; break;
      case "attr": e = { ...withAttr(el, c.name.toLowerCase(), () => c.value), seq }; break;
    }
    if (e) out.push(e);
  });
  // an element inside one whose content another edit of this change replaces is gone with it (as in the browser)
  return out.filter((e) => !out.some((o) => o !== e && o.to > o.from && o.from <= e.from && e.to <= o.to && (o.from < e.from || e.to < o.to)));
}

function splice(html: string, edits: Edit[]): string {
  // from the end, so each place is still right; at one place, the later element's edit first (it ends up after)
  const sorted = [...edits].sort((a, b) => b.from - a.from || b.seq - a.seq);
  let out = html;
  for (const e of sorted) out = out.slice(0, e.from) + e.text + out.slice(e.to);
  return out;
}

/**
 * The page with the changes laid over it, and what each change found. `marks` (the studio's preview only): the
 * document's index of each change - the elements a change wrote or works on say so (data-apx-c / data-apx-x), so a
 * click in the preview edits that change.
 */
export function applyChanges(html: string, changes: AnyChange[], opts: { marks?: number[] } = {}): { html: string; hits: Hit[] } {
  const hits: Hit[] = [];
  const css: string[] = [];
  let out = html;
  for (let i = 0; i < changes.length; i++) {
    const c = changes[i];
    if (c.op === "css") { css.push(c.css); hits.push({ state: "css", count: 1 }); continue; }
    const groups = parseSelector(c.selector);
    if (!groups) { hits.push({ state: "unread", count: 0 }); continue; }
    const found = selectAll(parseHtml(out), groups);
    const els = c.all ? found : found.slice(0, 1);
    if (!els.length) { hits.push({ state: "missing", count: 0 }); continue; }
    const mark = opts.marks?.[i];
    out = splice(out, editsFor(c, els, mark !== undefined && mark >= 0 ? mark : undefined));
    hits.push({ state: "found", count: els.length });
  }
  if (css.length) {
    const block = `<style data-apso-version>${css.join("\n").replace(/<\/style/gi, "<\\/style")}</style>`;
    const head = out.search(/<\/head\s*>/i);
    out = head >= 0 ? out.slice(0, head) + block + out.slice(head) : block + out;
  }
  return { html: out, hits };
}

/** The inner HTML of the first element a selector finds - null when there is none. */
export function innerOf(html: string, selector: string): string | null {
  const groups = parseSelector(selector);
  if (!groups) return null;
  const el = selectAll(parseHtml(html), groups)[0];
  return el ? html.slice(el.openEnd, el.closeStart) : null;
}

/** Is the element a selector finds inside the one another finds? (a change outside the CMS content cannot be pasted) */
export function insideOf(html: string, selector: string, container: string): boolean | null {
  const g = parseSelector(selector);
  const box = parseSelector(container);
  if (!g || !box) return null;
  const root = parseHtml(html);
  const els = selectAll(root, g);
  const boxes = selectAll(root, box);
  if (!els.length || !boxes.length) return null;
  return els.every((e) => boxes.some((b) => b.start <= e.start && e.end <= b.end));
}

/* ── the page as a still picture ──────────────────────────────────────── */

const absolute = (u: string, base: string) => { try { return new URL(u.replace(/&amp;/g, "&"), base).toString(); } catch { return null; } };

/** A stylesheet's url(...) made absolute against the stylesheet's own address, so it reads the same inside the page. */
export function absoluteCss(css: string, sheetUrl: string): string {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (all, q: string, u: string) => {
    const t = u.trim();
    if (/^(data:|#|https?:|\/\/|blob:)/i.test(t)) return all;
    const abs = absolute(t, sheetUrl);
    return abs ? `url(${q}${abs}${q})` : all;
  });
}

/** The stylesheets a page links, as absolute addresses, in order. */
export function stylesheetsOf(html: string, pageUrl: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/\brel\s*=\s*["']?stylesheet/i.test(tag)) continue;
    const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    const abs = href ? absolute(href, pageUrl) : null;
    if (abs && !out.includes(abs)) out.push(abs);
  }
  return out;
}

/**
 * The page made to be looked at in a frame that runs no script and is held by the hub's own rules: no script, no
 * noscript note (a frame without scripts would show it), the shop's stylesheets put inside the page (the hub's rules
 * keep a frame from loading them), embedded frames shown as a quiet box, the page's own address as the base for its
 * links and pictures, the icon sprite inside, and `tail` (the preview's own styles) last in <head>.
 */
export function stillPage(html: string, o: { pageUrl: string; sheets: Record<string, string>; tail: string; sprite?: { url: string; svg: string } | null }): string {
  let out = html;
  out = out.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "");
  out = out.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript\s*>/gi, "");
  out = out.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe\s*>/gi,
    `<div style="display:flex;align-items:center;justify-content:center;min-height:120px;background:#f2f4f5;color:#8a949b;font:13px/1.4 sans-serif;border-radius:6px">Embedded content</div>`);
  out = out.replace(/<link\b[^>]*>/gi, (tag) => {
    if (/\brel\s*=\s*["']?stylesheet/i.test(tag)) {
      const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
      const abs = href ? absolute(href, o.pageUrl) : null;
      const css = abs ? o.sheets[abs] : undefined;
      if (css === undefined) return "";
      const media = /\bmedia\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
      return `<style${media && media !== "all" ? ` media="${escAttr(media)}"` : ""}>${css.replace(/<\/style/gi, "<\\/style")}</style>`;
    }
    if (/\brel\s*=\s*["']?(preload|prefetch|prerender|preconnect|dns-prefetch|modulepreload|manifest)/i.test(tag)) return "";
    return tag;
  });
  out = out.replace(/<base\b[^>]*>/gi, "");
  if (o.sprite) {
    const sp = o.sprite;
    out = out.split(`${sp.url}#`).join("#");
    const svg = sp.svg.replace(/<\?xml[^>]*>/i, "").replace(/<!DOCTYPE[^>]*>/i, "");
    const body = /<body\b[^>]*>/i.exec(out);
    if (body) out = out.slice(0, body.index + body[0].length) + `<div hidden aria-hidden="true" style="display:none">${svg}</div>` + out.slice(body.index + body[0].length);
  }
  const base = `<base href="${escAttr(o.pageUrl)}"><meta name="referrer" content="no-referrer">`;
  const headOpen = /<head\b[^>]*>/i.exec(out);
  out = headOpen ? out.slice(0, headOpen.index + headOpen[0].length) + base + out.slice(headOpen.index + headOpen[0].length) : base + out;
  const tail = `<style data-apx-still>${o.tail.replace(/<\/style/gi, "<\\/style")}</style>`;
  const headClose = out.search(/<\/head\s*>/i);
  out = headClose >= 0 ? out.slice(0, headClose) + tail + out.slice(headClose) : tail + out;
  return out;
}

/** The preview's own styles: links and buttons quiet (a click would leave the frame), the shop's loaders off, the
 * placeholders still to write marked. */
export const STILL_CSS = `a,button,input,select,textarea,label,summary,[role=button]{pointer-events:none!important}
[data-role="main-css-loader"],.loading-mask,.message.global.cookie,.message.global.noscript,#cookie-status,.cookie-status-message{display:none!important}
.apx-text{background:#fff1b8;outline:1px dashed #c99a12;outline-offset:1px}`;
