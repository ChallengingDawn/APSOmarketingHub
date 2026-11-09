// WORDS EDITED AS THEY LOOK (Content v4, 09.11.2026 - the flow standard: "Bold / red key words show AS bold / red while
// editing, never raw ** or == marks in front of the person"). A part of a blog post or a newsletter is edited in place in
// the page itself (EditFrame): the person sees the bold words bold and the red key words red, and Ctrl+B / the label's
// buttons change them. What is kept is still the light markdown the post and the newsletter store - this turns the edited
// HTML back into it:
//   **bold**  *slanted*  ==red key word==  [words](address)  `code`  - a list  1. a list  ### a heading  > a tip box
// Pure (no DOM): the HTML is read by a small reader of its own, so the round trip is tested in node
// (tests/studio-rich-edit.test.ts).

export type RichMode = "inline" | "blocks";

type El = { tag: string; attrs: Record<string, string>; kids: Nd[] };
type Nd = string | El;

const VOID = new Set(["br", "hr", "img", "input", "wbr", "meta", "link", "col", "source"]);
const BLOCK = new Set(["p", "div", "section", "article", "header", "footer", "aside", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "table", "thead", "tbody", "tr", "td", "th", "hr", "figure", "pre"]);

function attrsOf(src: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "";
  return out;
}

/** The HTML as a tree (lenient: an unclosed tag closes at its parent's end, a stray closing tag is skipped). */
export function readHtml(html: string): Nd[] {
  const root: El = { tag: "#root", attrs: {}, kids: [] };
  const stack: El[] = [root];
  const re = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)([^>]*?)(\/?)>|([^<]+|<)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const top = stack[stack.length - 1];
    if (m[0].startsWith("<!--")) continue;
    if (m[1]) {
      const tag = m[1].toLowerCase();
      const at = stack.map((x) => x.tag).lastIndexOf(tag);
      if (at > 0) stack.length = at;
      continue;
    }
    if (m[2]) {
      const el: El = { tag: m[2].toLowerCase(), attrs: attrsOf(m[3] ?? ""), kids: [] };
      top.kids.push(el);
      if (!VOID.has(el.tag) && !m[4]) stack.push(el);
      continue;
    }
    top.kids.push(m[5]);
  }
  return root.kids;
}

const decode = (t: string) => t
  .replace(/&nbsp;|&#160;| /g, " ")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&amp;/g, "&");

type Marks = { b?: boolean; i?: boolean; red?: boolean; a?: boolean };

/** Marks around words, the spaces kept outside them ("** bold**" is not bold in markdown). */
function wrap(mark: string, inner: string): string {
  if (!inner.trim()) return inner;
  const lead = /^\s*/.exec(inner)![0];
  const trail = /\s*$/.exec(inner)![0];
  return `${lead}${mark}${inner.trim()}${mark}${trail}`;
}

const isBold = (e: El) => e.tag === "strong" || e.tag === "b" || /font-weight\s*:\s*(bold|[6-9]00)/i.test(e.attrs.style ?? "");
const isItalic = (e: El) => e.tag === "em" || e.tag === "i" || /font-style\s*:\s*italic/i.test(e.attrs.style ?? "");

/** Words and their marks, one line per <br>; blocks inside become new lines. */
function inline(nodes: Nd[], m: Marks = {}): string {
  let out = "";
  for (const n of nodes) {
    if (typeof n === "string") { out += decode(n.replace(/[\r\n\t ]+/g, " ")); continue; }
    if (n.tag === "br") { out += "\n"; continue; }
    if (n.tag === "img" || n.tag === "script" || n.tag === "style") continue;
    if (n.tag === "code") { const c = decode(textOf(n.kids)); out += c ? `\`${c}\`` : ""; continue; }
    if (n.tag === "a" && !m.a) {
      const words = inline(n.kids, { ...m, a: true });
      const href = (n.attrs.href ?? "").trim();
      out += href && words.trim() && href !== "#" ? `${/^\s/.test(words) ? " " : ""}[${words.trim()}](${decode(href)})${/\s$/.test(words) ? " " : ""}` : words;
      continue;
    }
    if (isBold(n) && !m.b) { out += wrap("**", inline(n.kids, { ...m, b: true })); continue; }
    if (n.tag === "mark" && !m.red) { out += wrap("==", inline(n.kids, { ...m, red: true })); continue; }
    if (isItalic(n) && !m.i) { out += wrap("*", inline(n.kids, { ...m, i: true })); continue; }
    if (BLOCK.has(n.tag)) { const t = inline(n.kids, m); out += out && !out.endsWith("\n") ? `\n${t}` : t; continue; }
    out += inline(n.kids, m);
  }
  return out;
}

const textOf = (nodes: Nd[]): string => nodes.map((n) => (typeof n === "string" ? n : n.tag === "br" ? "\n" : textOf(n.kids))).join("");

/** A paragraph's words cleaned: one space between words, no space at a line's ends, marks of nothing gone. */
function tidy(t: string): string {
  return t
    .replace(/\*\*\*\*|====/g, "")
    .split("\n").map((l) => l.replace(/ {2,}/g, " ").trim()).join("\n")
    .replace(/^\n+|\n+$/g, "");
}

const hasBlock = (nodes: Nd[]) => nodes.some((n) => typeof n !== "string" && BLOCK.has(n.tag));

function cells(tr: El): string[] {
  return tr.kids.filter((c): c is El => typeof c !== "string" && (c.tag === "td" || c.tag === "th")).map((c) => tidy(inline(c.kids)).replace(/\n/g, " ").replace(/\|/g, "/"));
}

/** Block by block: paragraphs, headings, lists, tip boxes, tables - each the markdown it was made from. */
function blocks(nodes: Nd[], out: string[]): void {
  let run: Nd[] = [];
  const flush = () => {
    if (!run.length) return;
    const t = tidy(inline(run));
    if (t) out.push(t);
    run = [];
  };
  for (const n of nodes) {
    if (typeof n === "string" || !BLOCK.has(n.tag)) { run.push(n); continue; }
    flush();
    const t = n.tag;
    if (/^h[1-6]$/.test(t)) {
      const w = tidy(inline(n.kids)).replace(/\n+/g, " ");
      if (w) out.push(`${Number(t[1]) >= 4 ? "####" : "###"} ${w}`);
    } else if (t === "ul" || t === "ol") {
      const items = n.kids.filter((k): k is El => typeof k !== "string" && k.tag === "li").map((li) => tidy(inline(li.kids)).replace(/\n+/g, " ")).filter(Boolean);
      if (items.length) out.push(items.map((x, i) => `${t === "ol" ? `${i + 1}.` : "-"} ${x}`).join("\n"));
    } else if (t === "li") {
      const w = tidy(inline(n.kids)).replace(/\n+/g, " ");
      if (w) out.push(`- ${w}`);
    } else if (t === "blockquote") {
      const w = tidy(inline(n.kids)).replace(/\n+/g, " ");
      if (w) out.push(`> ${w}`);
    } else if (t === "hr") {
      out.push("---");
    } else if (t === "table" || t === "thead" || t === "tbody") {
      const rows: El[] = [];
      const walk = (x: Nd[]) => x.forEach((k) => { if (typeof k === "string") return; if (k.tag === "tr") rows.push(k); else walk(k.kids); });
      walk([n]);
      const body = rows.map(cells).filter((r) => r.length);
      if (body.length) out.push([`| ${body[0].join(" | ")} |`, `| ${body[0].map(() => "---").join(" | ")} |`, ...body.slice(1).map((r) => `| ${r.join(" | ")} |`)].join("\n"));
    } else if (t === "figure" || t === "pre") {
      const w = tidy(inline(n.kids));
      if (w && t === "pre") out.push(w);
    } else if (hasBlock(n.kids)) {
      blocks(n.kids, out);
    } else {
      const w = tidy(inline(n.kids));
      if (w) out.push(w);
    }
  }
  flush();
}

/**
 * The edited HTML of a part as the markdown it is stored in. "inline": one run of words (a heading, the lead, a pull
 * quote, a question) - a new line stays a new line. "blocks": a part of several blocks (a section's paragraph, list or
 * table; an answer; a newsletter's text), each block the markdown it was made from, a blank line between two.
 */
export function htmlToMarks(html: string, mode: RichMode): string {
  const nodes = readHtml(html);
  if (mode === "inline") return tidy(inline(nodes)).replace(/\n{2,}/g, "\n");
  const out: string[] = [];
  blocks(nodes, out);
  return out.join("\n\n");
}
