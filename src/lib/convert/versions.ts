// APSOconvert > A VERSION OF A PAGE = a short list of changes laid over the shop's page in the browser: a stylesheet,
// a piece of HTML in place of another, a line of text, an element hidden. The same list drives the live preview in the
// hub (src/lib/convert/preview.ts) and, later, the test on the shop - so what a person approves is exactly what
// visitors get. Product and category pages are the theme's code, not Magento CMS pages (SARCLA 07.11.2026: "product
// page is hard code and we need to propose a different code"): for them this list IS the proposal.
//
// Declarative on purpose: no script of its own, no event handler, no javascript: address - a version only reshapes
// what the page already shows. Pure (no "@/" imports), so it is tested.

import { withoutTrustedScripts } from "./trustedScripts";

export type Where = "before" | "after" | "prepend" | "append";
export type Change =
  | { op: "css"; css: string; note?: string }
  | { op: "html"; selector: string; html: string; all?: boolean; note?: string }
  | { op: "replace"; selector: string; html: string; all?: boolean; note?: string }
  | { op: "insert"; selector: string; where: Where; html: string; all?: boolean; note?: string }
  | { op: "text"; selector: string; text: string; all?: boolean; note?: string }
  | { op: "hide"; selector: string; all?: boolean; note?: string }
  | { op: "attr"; selector: string; name: string; value: string; all?: boolean; note?: string };
export type Op = Change["op"];

export const OPS: Op[] = ["css", "html", "replace", "insert", "text", "hide", "attr"];
export const OP_LABEL: Record<Op, string> = {
  css: "Style", html: "New content", replace: "Replaced", insert: "Added", text: "New text", hide: "Hidden", attr: "Changed",
};
const WHERE: Where[] = ["before", "after", "prepend", "append"];

export const LIMITS = { changes: 40, css: 20_000, html: 20_000, text: 2_000, selector: 300, note: 300, total: 80_000 };

/** What a version may not carry: its own script, an event handler, a javascript: address, a frame. The ONE trusted tag
 * (./trustedScripts.ts - the Black Friday voucher's engine from the hub's own storage, exactly as written) is let through. */
function unsafeHtml(raw: string): string | null {
  const html = withoutTrustedScripts(raw);
  if (/<\s*script\b/i.test(html)) return "a <script>";
  if (/<\s*(iframe|object|embed|frame)\b/i.test(html)) return "a frame";
  if (/\son[a-z]+\s*=/i.test(html)) return "an event handler (on...=)";
  if (/(href|src|action|formaction)\s*=\s*["']?\s*(javascript|vbscript|data:text\/html)/i.test(html)) return "a javascript: address";
  return null;
}
function unsafeCss(css: string): string | null {
  if (/<\/?\s*style/i.test(css)) return "a </style> tag";
  if (/expression\s*\(|javascript:|behavior\s*:/i.test(css)) return "script in CSS";
  if (/@import/i.test(css)) return "an @import";
  return null;
}
function badSelector(sel: string): string | null {
  if (!sel.trim()) return "an empty selector";
  if (sel.length > LIMITS.selector) return `a selector longer than ${LIMITS.selector}`;
  if (/[<{};]/.test(sel)) return "a selector with < { } or ;";
  return null;
}

const str = (v: unknown): v is string => typeof v === "string";

/** The changes a version may hold, from whatever was handed in (the AI's answer, a person's edit); every refusal said. */
export function validateChanges(input: unknown): { changes: Change[]; problems: string[] } {
  const problems: string[] = [];
  const changes: Change[] = [];
  if (!Array.isArray(input)) return { changes, problems: ["the changes are not a list"] };
  if (input.length > LIMITS.changes) problems.push(`${input.length} changes - ${LIMITS.changes} at most, the rest left out`);
  let total = 0;
  input.slice(0, LIMITS.changes).forEach((raw, i) => {
    const n = `change ${i + 1}`;
    if (!raw || typeof raw !== "object") { problems.push(`${n} is not a change`); return; }
    const c = raw as Record<string, unknown>;
    const op = c.op as Op;
    if (!OPS.includes(op)) { problems.push(`${n}: unknown kind "${String(c.op)}"`); return; }
    const note = str(c.note) ? c.note.slice(0, LIMITS.note) : undefined;
    const all = c.all === true ? true : undefined;
    const size = JSON.stringify(c).length;
    if (total + size > LIMITS.total) { problems.push(`${n}: the version is over ${LIMITS.total / 1000} KB, left out`); return; }
    if (op === "css") {
      if (!str(c.css) || !c.css.trim()) { problems.push(`${n}: no CSS`); return; }
      if (c.css.length > LIMITS.css) { problems.push(`${n}: CSS over ${LIMITS.css / 1000} KB`); return; }
      const u = unsafeCss(c.css);
      if (u) { problems.push(`${n}: ${u} is not allowed`); return; }
      changes.push({ op, css: c.css, ...(note ? { note } : {}) });
      total += size;
      return;
    }
    if (!str(c.selector)) { problems.push(`${n}: no selector`); return; }
    const sel = c.selector.trim();
    const bs = badSelector(sel);
    if (bs) { problems.push(`${n}: ${bs}`); return; }
    const base = { selector: sel, ...(all ? { all } : {}), ...(note ? { note } : {}) };
    if (op === "html" || op === "replace" || op === "insert") {
      if (!str(c.html)) { problems.push(`${n}: no HTML`); return; }
      if (c.html.length > LIMITS.html) { problems.push(`${n}: HTML over ${LIMITS.html / 1000} KB`); return; }
      const u = unsafeHtml(c.html);
      if (u) { problems.push(`${n}: ${u} is not allowed`); return; }
      if (op === "insert") {
        const where = c.where as Where;
        if (!WHERE.includes(where)) { problems.push(`${n}: "where" must be before, after, prepend or append`); return; }
        changes.push({ op, where, html: c.html, ...base });
      } else changes.push({ op, html: c.html, ...base });
    } else if (op === "text") {
      if (!str(c.text)) { problems.push(`${n}: no text`); return; }
      changes.push({ op, text: c.text.slice(0, LIMITS.text), ...base });
    } else if (op === "hide") {
      changes.push({ op, ...base });
    } else if (op === "attr") {
      if (!str(c.name) || !/^[a-zA-Z][\w:-]{0,40}$/.test(c.name) || /^on/i.test(c.name)) { problems.push(`${n}: attribute name not allowed`); return; }
      if (!str(c.value)) { problems.push(`${n}: no value`); return; }
      if (/^\s*(javascript|vbscript|data:text\/html)/i.test(c.value)) { problems.push(`${n}: a javascript: address is not allowed`); return; }
      changes.push({ op, name: c.name, value: c.value.slice(0, LIMITS.text), ...base });
    }
    total += size;
  });
  return { changes, problems };
}

/** One line per change, for the list beside the preview. */
export function describe(c: Change): string {
  if (c.note) return c.note;
  switch (c.op) {
    case "css": return `Style: ${c.css.replace(/\s+/g, " ").slice(0, 80)}`;
    case "text": return `"${c.text.slice(0, 60)}" in ${c.selector}`;
    case "hide": return `${c.selector} hidden`;
    case "attr": return `${c.name}="${c.value.slice(0, 40)}" on ${c.selector}`;
    case "insert": return `New block ${c.where} ${c.selector}`;
    default: return `${OP_LABEL[c.op]}: ${c.selector}`;
  }
}

/** JSON that is safe inside a <script>: no "</script>", no line separators that end a JS string. */
export function scriptJson(v: unknown): string {
  // written with character codes: an escape here was once turned into the character itself by an editor
  const BS = String.fromCharCode(92);
  const LS = String.fromCharCode(0x2028);
  const PS = String.fromCharCode(0x2029);
  return JSON.stringify(v).split("<").join(`${BS}u003c`).split(LS).join(`${BS}u2028`).split(PS).join(`${BS}u2029`);
}

/**
 * The script that lays the changes over the page - in the preview now, on the shop during a test later. The styles go
 * in at once (no flash of the old page); each element change waits until its element exists (the theme draws parts
 * of the page after loading) for at most `waitMs`, then the result is told to the hub's window when `report` is set:
 * which changes found their element, which did not.
 */
export function runtimeSource(changes: Change[], opts: { report: boolean; waitMs?: number }): string {
  const wait = Math.max(500, Math.min(20_000, opts.waitMs ?? 8_000));
  // a change made from a Content module carries its module beside it (./modular.ts) - the hub's own, not the browser's
  const list = changes.map((c) => { const { id: _i, module: _m, off: _o, ...rest } = c as Change & { id?: unknown; module?: unknown; off?: unknown }; return rest; });
  return `(function(C,REPORT,WAIT){
var D=document,hit=C.map(function(c){return c.op==="css"?1:0}),done=C.map(function(){return false}),seen=[];
var css=C.filter(function(c){return c.op==="css"}).map(function(c){return c.css}).join("\\n");
if(css){var st=D.createElement("style");st.setAttribute("data-apso-version","");st.textContent=css;(D.head||D.documentElement).appendChild(st);}
function frag(h){var t=D.createElement("template");t.innerHTML=h;for(var j=0;j<t.content.children.length;j++)t.content.children[j].setAttribute("data-apso-v","");return t.content;}
function one(c,el){
if(c.op==="html"){el.innerHTML=c.html;}
else if(c.op==="replace"){el.replaceWith(frag(c.html));}
else if(c.op==="insert"){var f=frag(c.html);if(c.where==="before")el.parentNode&&el.parentNode.insertBefore(f,el);else if(c.where==="after")el.parentNode&&el.parentNode.insertBefore(f,el.nextSibling);else if(c.where==="prepend")el.insertBefore(f,el.firstChild);else el.appendChild(f);}
else if(c.op==="text"){el.textContent=c.text;}
else if(c.op==="hide"){el.style.setProperty("display","none","important");}
else if(c.op==="attr"){el.setAttribute(c.name,c.value);}
}
function run(){
for(var i=0;i<C.length;i++){var c=C[i];if(c.op==="css"||done[i])continue;var els;
try{els=c.all?D.querySelectorAll(c.selector):[D.querySelector(c.selector)];}catch(e){done[i]=true;hit[i]=-1;continue;}
for(var k=0;k<els.length;k++){var el=els[k];if(!el||(el.closest&&el.closest("[data-apso-v]")))continue;seen[i]=seen[i]||[];if(seen[i].indexOf(el)>=0)continue;seen[i].push(el);try{if(c.op!=="replace"&&el.setAttribute)el.setAttribute("data-apso-c",String(i+1));one(c,el);hit[i]=1;}catch(e){hit[i]=-1;}}
if(hit[i]&&!c.all)done[i]=true;}
}
var mo,queued=false;
function soon(){if(queued)return;queued=true;(window.requestAnimationFrame||setTimeout)(function(){queued=false;run();});}
function start(){run();if(window.MutationObserver){mo=new MutationObserver(soon);mo.observe(D.documentElement,{childList:true,subtree:true});}
setTimeout(function(){if(mo)mo.disconnect();run();if(REPORT){try{parent.postMessage({apsoPreview:"applied",hit:hit},"*");}catch(e){}}},WAIT);}
if(D.readyState==="loading")D.addEventListener("DOMContentLoaded",start);else start();
})(${scriptJson(list)},${opts.report ? "true" : "false"},${wait});`;
}
