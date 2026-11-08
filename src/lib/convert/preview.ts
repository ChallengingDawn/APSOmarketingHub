// APSOconvert > THE LIVE PREVIEW - a shop page shown inside the hub, as it is or with a version laid over it
// (src/lib/convert/versions.ts). The hub reads the page's HTML; this file makes it safe to show:
//  - nothing it shows is counted: Google Tag Manager (and with it Google Analytics and Webyn), the shop's own tools
//    from the gateways and every other outside script are left out, and the frame may not send a single request -
//    no add-to-cart, no stock hold, no search log (connect-src 'none', forms off);
//  - it cannot touch the hub: the frame has an origin of its own (sandbox), so the shop's scripts see no hub cookie;
//  - links stay inside: a click is handed to the hub's window, which opens that page in the preview.
// Pictures, styles and the theme's scripts still come from the shop itself, so the page looks like the page.
//
// Pure (no "@/" imports), so it is tested.

export const PREVIEW_MARK = "apsoPreview";

/** The frame's rules: the shop's own files only, no request out, no form, no frame inside, shown only by the hub. */
export function previewCsp(origin: string, hub?: string): string {
  const files = hub ? ` ${hub}/api/website/ai-personalization/asset/` : "";
  const shop = [origin, "https://www.apsoparts.com"].filter((v, i, a) => a.indexOf(v) === i).join(" ") + files;
  return [
    "sandbox allow-scripts",
    "default-src 'none'",
    `script-src 'unsafe-inline' 'unsafe-eval' ${shop}`,
    `style-src 'unsafe-inline' ${shop} https://use.typekit.net`,
    `font-src data: ${shop} https://use.typekit.net`,
    `img-src data: blob: ${shop}`,
    `media-src ${shop}`,
    hub ? `connect-src${files}` : "connect-src 'none'",
    "frame-src 'none'",
    "worker-src 'none'",
    "object-src 'none'",
    "form-action 'none'",
    `base-uri ${shop}`,
    "frame-ancestors 'self'",
  ].join("; ");
}

/**
 * The first script of the page: a memory in place of the browser storage and cookies the frame may not have (the
 * theme's scripts stop on them otherwise), links and forms kept in the preview, and a word to the hub's window when
 * the page is drawn.
 */
export function shimSource(): string {
  return `(function(){
function mem(){var d={};return{getItem:function(k){return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null},setItem:function(k,v){d[k]=String(v)},removeItem:function(k){delete d[k]},clear:function(){d={}},key:function(i){return Object.keys(d)[i]||null},get length(){return Object.keys(d).length}};}
["localStorage","sessionStorage"].forEach(function(n){try{window[n].getItem("x");}catch(e){try{Object.defineProperty(window,n,{value:mem(),configurable:true});}catch(_){}}});
try{document.cookie;}catch(e){var jar={};try{Object.defineProperty(document,"cookie",{configurable:true,get:function(){return Object.keys(jar).map(function(k){return k+"="+jar[k]}).join("; ")},set:function(v){var p=String(v).split(";")[0],i=p.indexOf("=");if(i>0)jar[p.slice(0,i).trim()]=p.slice(i+1);}});}catch(_){}}
window.open=function(){return null;};
try{Object.defineProperty(Navigator.prototype,"cookieEnabled",{configurable:true,get:function(){return true;}});}catch(e){}
function tell(m){try{m.${PREVIEW_MARK}=m.t;delete m.t;parent.postMessage(m,"*");}catch(e){}}
document.addEventListener("click",function(e){if(picking||e.defaultPrevented)return;var a=e.target&&e.target.closest?e.target.closest("a[href]"):null;if(!a)return;e.preventDefault();
var raw=a.getAttribute("href")||"";if(raw.charAt(0)==="#"){var t=document.getElementById(raw.slice(1));if(t&&t.scrollIntoView)t.scrollIntoView({block:"start"});return;}
if(/^(javascript|mailto|tel):/i.test(raw))return;tell({t:"go",href:a.href});},true);
document.addEventListener("submit",function(e){e.preventDefault();},true);
function ready(){tell({t:"ready",title:document.title,height:document.documentElement.scrollHeight});}
var WS=new RegExp("["+String.fromCharCode(32,9,10,13,160)+"]+","g"),SKIPT={SCRIPT:1,STYLE:1,SVG:1,NOSCRIPT:1,TEMPLATE:1,IFRAME:1,SELECT:1,OPTION:1};
function shortSel(el){if(el.id&&el.id.length<60&&el.id.indexOf("ui-id-")!==0&&el.id.indexOf("ko_")!==0)return"#"+el.id;var cls=[].slice.call(el.classList||[]).filter(function(c){return c.length<40&&/^[A-Za-z_-]/.test(c)&&c.indexOf(":")<0&&c!=="active"&&c!=="_active"&&c!=="clearfix"&&c.indexOf("apx-")!==0;}).slice(0,2);return el.tagName.toLowerCase()+(cls.length?"."+cls.join("."):"");}
function ownText(el){var t="";for(var n=el.firstChild;n;n=n.nextSibling)if(n.nodeType===3)t+=n.nodeValue;return t.replace(WS," ").trim();}
function drawnPage(){var root=document.getElementById("maincontent")||document.body,out=[],chars=0;
function walk(el,d){if(out.length>=160||chars>5200||!el||el.nodeType!==1||SKIPT[el.tagName])return;if(el.hasAttribute("data-apso-v"))return;var st=getComputedStyle(el);if(st.display==="none"||st.visibility==="hidden")return;
var t=ownText(el);if(!t&&el.tagName==="IMG"&&el.alt)t="[picture: "+el.alt+"]";if(!t&&el.tagName==="INPUT"&&el.type!=="hidden")t="[field: "+(el.placeholder||el.name||el.type)+"]";if(!t&&el.tagName==="BUTTON"&&el.title)t="[button: "+el.title+"]";
if(t){var line=new Array(Math.min(d,10)+1).join("  ")+shortSel(el)+" · "+(t.length>120?t.slice(0,120)+"…":t);out.push(line);chars+=line.length+1;}
for(var c=el.firstElementChild;c;c=c.nextElementSibling)walk(c,d+1);}
walk(root,0);return out;}
addEventListener("load",function(){setTimeout(function(){try{tell({t:"drawn",lines:drawnPage()});}catch(e){}},1800);});
addEventListener("load",function(){var ls=document.querySelectorAll('link[rel="stylesheet"]'),bad=[],n=0;for(var i=0;i<ls.length;i++){if(ls[i].media==="print")continue;n++;if(!ls[i].sheet)bad.push(String(ls[i].href).slice(0,160));}tell({t:"styles",total:n,failed:bad.slice(0,8),nfailed:bad.length});});
function sel(el){if(!el||el.nodeType!==1)return"";if(el.id&&/^[A-Za-z][\\w-]*$/.test(el.id)&&!/^(ui-id-|ko_)/.test(el.id))return"#"+el.id;var path=[],cur=el,depth=0;
while(cur&&cur.nodeType===1&&cur!==document.body&&depth<5){var part=cur.tagName.toLowerCase();if(cur.id&&/^[A-Za-z][\\w-]*$/.test(cur.id)&&!/^(ui-id-|ko_)/.test(cur.id)){path.unshift("#"+cur.id);break;}
var cls=[].slice.call(cur.classList||[]).filter(function(c){return /^[A-Za-z_-][\\w-]*$/.test(c)&&!/^(active|_active|selected|clearfix|hidden|visible|apx-pick)/.test(c);}).slice(0,2);if(cls.length)part+="."+cls.join(".");
var sib=cur.parentNode?[].slice.call(cur.parentNode.children).filter(function(x){return x.tagName===cur.tagName;}):[];if(sib.length>1&&!cls.length)part+=":nth-of-type("+(sib.indexOf(cur)+1)+")";
path.unshift(part);try{if(document.querySelectorAll(path.join(" > ")).length===1)break;}catch(e){}cur=cur.parentNode;depth++;}return path.join(" > ");}
var picking=false,hov=null,pst=document.createElement("style");pst.textContent=".apx-pick{outline:2px solid #7c4dff!important;outline-offset:2px!important;cursor:crosshair!important}";
function unhov(){if(hov){hov.classList.remove("apx-pick");hov=null;}}
document.addEventListener("mouseover",function(e){if(!picking)return;unhov();hov=e.target;if(hov&&hov.classList)hov.classList.add("apx-pick");},true);
document.addEventListener("click",function(e){if(!picking)return;e.preventDefault();e.stopPropagation();var el=e.target;unhov();picking=false;
tell({t:"picked",selector:sel(el),tag:el.tagName.toLowerCase(),text:String(el.textContent||"").replace(/\\s+/g," ").trim().slice(0,160)});},true);
var mst=document.createElement("style");mst.textContent="[data-apso-c],[data-apso-v]{outline:2px dashed #7c4dff!important;outline-offset:3px!important;box-shadow:0 0 0 6px rgba(124,77,255,.12)!important}";
addEventListener("message",function(e){if(e.source!==parent||!e.data)return;
if(typeof e.data.${PREVIEW_MARK}Pick==="boolean"){picking=e.data.${PREVIEW_MARK}Pick;if(picking&&!pst.parentNode)(document.head||document.documentElement).appendChild(pst);if(!picking)unhov();}
if(typeof e.data.${PREVIEW_MARK}Marks==="boolean"){if(e.data.${PREVIEW_MARK}Marks)(document.head||document.documentElement).appendChild(mst);else if(mst.parentNode)mst.parentNode.removeChild(mst);}});
var quiet=0,sent=0;function ratio(){var h=document.documentElement.scrollHeight-innerHeight;return h>0?scrollY/h:0;}
addEventListener("scroll",function(){if(Date.now()<quiet)return;var n=Date.now();if(n-sent<60)return;sent=n;tell({t:"scroll",y:ratio()});},{passive:true});
addEventListener("message",function(e){if(e.source!==parent||!e.data||typeof e.data.${PREVIEW_MARK}Scroll!=="number")return;quiet=Date.now()+250;var h=document.documentElement.scrollHeight-innerHeight;scrollTo(0,Math.round(e.data.${PREVIEW_MARK}Scroll*Math.max(0,h)));});
var SPRITE=window.__apsoSprite;if(SPRITE&&window.MutationObserver){var fix=function(root){var u=root.querySelectorAll?root.querySelectorAll("use"):[];for(var i=0;i<u.length;i++){["href","xlink:href"].forEach(function(a){var v=u[i].getAttribute(a);if(v&&v.indexOf(SPRITE+"#")===0)u[i].setAttribute(a,v.slice(SPRITE.length));});}};
new MutationObserver(function(ms){ms.forEach(function(m){if(m.type==="attributes"){var t=m.target;if(t&&t.parentNode)fix(t.parentNode);return;}m.addedNodes.forEach(function(n){if(n.nodeType===1)fix(n);});});}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:["href","xlink:href"]});}
if(!document.body&&window.MutationObserver){var bo=new MutationObserver(function(){if(document.body){bo.disconnect();tell({t:"body"});}});bo.observe(document.documentElement,{childList:true});}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",ready);else ready();
})();`;
}

/** Hosts whose scripts the preview keeps: the shop's own (production or ACC). Everything else is left out. */
function ownScript(src: string, origin: string): boolean {
  if (/^\/\//.test(src)) src = `https:${src}`;
  if (!/^https?:/i.test(src)) return true; // relative = the shop's own
  try {
    const u = new URL(src);
    return u.origin === origin || u.origin === "https://www.apsoparts.com";
  } catch {
    return false;
  }
}

export type Cleaned = { html: string; removed: { scripts: number; trackers: number; prefetch: number } };

/**
 * The page made safe for the frame: outside scripts out, the tag manager's fallback frame out, prefetch rules out
 * (they would open real pages on the shop when the mouse rests on a link - learnt on the home page work), the page's
 * own address as the base for its relative links, then `head` first in <head> and `tail` last.
 */
export function cleanPage(html: string, opts: { pageUrl: string; head: string; tail: string; sprite?: { url: string; svg: string } | null }): Cleaned {
  const origin = new URL(opts.pageUrl).origin;
  const removed = { scripts: 0, trackers: 0, prefetch: 0 };
  let out = html;
  // outside scripts (gateways, tag manager, anything else)
  out = out.replace(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi, (all, attrs: string, body: string) => {
    const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1];
    if (/type\s*=\s*["']?speculationrules/i.test(attrs)) { removed.prefetch++; return ""; }
    if (src && !ownScript(src.replace(/&amp;/g, "&"), origin)) { removed.scripts++; return ""; }
    if (!src && /googletagmanager\.com|gtag\s*\(|fbq\s*\(|hs-scripts\.com|webyn/i.test(body)) { removed.trackers++; return ""; }
    return all;
  });
  out = out.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript\s*>/gi, (all) => {
    if (/googletagmanager|facebook\.com\/tr|hubspot/i.test(all)) { removed.trackers++; return ""; }
    return all;
  });
  // prefetch / preconnect hints and the page's own <base>
  out = out.replace(/<link\b[^>]*\brel\s*=\s*["']?(prefetch|prerender|preconnect|dns-prefetch)["']?[^>]*>/gi, () => { removed.prefetch++; return ""; });
  out = out.replace(/<base\b[^>]*>/gi, "");
  // the theme's icon sprite: a frame of its own origin may not <use> it from the shop, so it comes inside the page
  if (opts.sprite) {
    const sp = opts.sprite;
    out = out.split(`${sp.url}#`).join("#");
    const svg = sp.svg.replace(/<\?xml[^>]*>/i, "").replace(/<!DOCTYPE[^>]*>/i, "");
    const bodyOpen = /<body\b[^>]*>/i.exec(out);
    if (bodyOpen) out = out.slice(0, bodyOpen.index + bodyOpen[0].length) + `<div hidden aria-hidden="true" style="display:none">${svg}</div>` + out.slice(bodyOpen.index + bodyOpen[0].length);
  }
  const sprite = opts.sprite ? `<script>window.__apsoSprite=${JSON.stringify(opts.sprite.url).split("<").join("")};</script>` : "";
  const base = `<base href="${opts.pageUrl.replace(/"/g, "&quot;")}"><meta name="referrer" content="no-referrer">${sprite}`;
  const headOpen = /<head\b[^>]*>/i.exec(out);
  if (headOpen) out = out.slice(0, headOpen.index + headOpen[0].length) + base + opts.head + out.slice(headOpen.index + headOpen[0].length);
  else out = base + opts.head + out;
  const headClose = out.search(/<\/head\s*>/i);
  if (headClose >= 0) out = out.slice(0, headClose) + opts.tail + out.slice(headClose);
  else out += opts.tail;
  return { html: out, removed };
}

/** The theme's static folder the page loads its files from (Magento: /static/version<n>/frontend/<vendor>/<theme>/<locale>/). */
export function staticBase(html: string): string | null {
  return /https:\/\/[a-z0-9.-]+\/static\/version\d+\/frontend\/[\w-]+\/[\w-]+\/[a-z]{2}_[A-Z]{2}\//.exec(html)?.[0] ?? null;
}

// ---------------------------------------------------------------------------------------------------------------------
// THE PAGE'S OUTLINE - what the AI is shown to propose ideas and write a version: the page's title and description, its
// headings, and the main column as indented lines "selector · text", the selectors it may aim its changes at.

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const SKIP = new Set(["script", "style", "template", "svg", "noscript", "iframe", "select", "textarea"]);
const KEEP_TAG = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "a", "button", "li", "td", "th", "label", "img", "span", "strong", "b", "div", "dd", "dt", "form", "input", "section", "table", "ul", "ol", "figure"]);

const OWNS_TEXT = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "a", "button"]);

export type Outline = { title: string; description: string; h1: string[]; lines: string[]; text: string; truncated: boolean };

function attr(attrs: string, name: string): string | null {
  const m = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(attrs);
  return m ? (m[1] ?? m[2] ?? m[3] ?? "") : null;
}
// the named characters the shop's pages use (German, French, Italian letters, signs, dashes, quotes), as code points
const NAMED: Record<string, number> = {
  nbsp: 160, amp: 38, lt: 60, gt: 62, quot: 34, apos: 39, reg: 174, copy: 169, trade: 8482, deg: 176, plusmn: 177, times: 215, micro: 181,
  euro: 8364, ndash: 8211, mdash: 8212, hellip: 8230, laquo: 171, raquo: 187, lsquo: 8216, rsquo: 8217, sbquo: 8218, ldquo: 8220, rdquo: 8221, bdquo: 8222,
  auml: 228, ouml: 246, uuml: 252, Auml: 196, Ouml: 214, Uuml: 220, szlig: 223, eacute: 233, egrave: 232, ecirc: 234, euml: 235, Eacute: 201,
  agrave: 224, aacute: 225, acirc: 226, ccedil: 231, Ccedil: 199, iacute: 237, igrave: 236, icirc: 238, iuml: 239, oacute: 243, ograve: 242,
  ocirc: 244, uacute: 250, ugrave: 249, ucirc: 251, oelig: 339, sup2: 178, sup3: 179, frac12: 189, middot: 183, bull: 8226,
};
export function decode(s: string): string {
  return s
    .replace(/&([a-zA-Z][a-zA-Z0-9]{1,7});/g, (all, n: string) => (NAMED[n] !== undefined ? String.fromCodePoint(NAMED[n]) : all))
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(Number.parseInt(n, 16)));
}
const squash = (s: string) => decode(s).replace(/\s+/g, " ").trim();

/** A selector for one element: its id, else its tag and up to two classes that are not state or layout noise. */
export function selectorOf(tag: string, attrs: string): string {
  const id = attr(attrs, "id");
  if (id && /^[A-Za-z][\w-]*$/.test(id) && !/^(ui-id-|ko_|id\d)/.test(id)) return `#${id}`;
  const classes = (attr(attrs, "class") ?? "").split(/\s+/).filter((c) => /^[A-Za-z_-][\w-]*$/.test(c) && !/^(active|_?active|selected|clearfix|row|col-|hidden|visible|fs\d|ui-)/.test(c));
  return tag + classes.slice(0, 2).map((c) => `.${c}`).join("");
}

/** The outline of a page's HTML; the main column only when it has one (Magento: <main id="maincontent">). */
export function outline(html: string, opts: { maxLines?: number; maxChars?: number } = {}): Outline {
  const maxLines = opts.maxLines ?? 260;
  const maxChars = opts.maxChars ?? 14_000;
  const title = squash(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "");
  const description = squash(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i.exec(html)?.[1] ?? /<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i.exec(html)?.[1] ?? "");
  const start = html.search(/<main\b[^>]*id=["']maincontent["']/i);
  let body = start >= 0 ? html.slice(start) : (/<body\b[\s\S]*$/i.exec(html)?.[0] ?? html);
  const end = start >= 0 ? body.search(/<\/main\s*>/i) : -1;
  if (end >= 0) body = body.slice(0, end + 7);

  const h1: string[] = [];
  const slots: (string | null)[] = [];
  const text: string[] = [];
  let textLen = 0;
  // a line is reserved when its element opens (page order) and written when it closes (its own text is known then)
  type Node = { tag: string; sel: string; text: string; depth: number; slot: number };
  const stack: Node[] = [];
  let skip: string | null = null;
  const tokens = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  const close = (n: Node) => {
    const t = n.text.replace(/\s+/g, " ").trim();
    if (n.tag === "h1" && t) h1.push(t);
    if (n.slot >= 0 && t) slots[n.slot] = `${"  ".repeat(Math.min(n.depth, 12))}${n.sel} · ${t.length > 220 ? `${t.slice(0, 220)}…` : t}`;
  };
  const open = (tag: string, attrs: string, own = ""): Node => {
    const n: Node = { tag, sel: selectorOf(tag, attrs), text: own, depth: stack.length, slot: -1 };
    if (KEEP_TAG.has(tag)) { n.slot = slots.length; slots.push(null); }
    return n;
  };
  while ((m = tokens.exec(body))) {
    if (m[0].startsWith("<!--")) continue;
    if (m[4] !== undefined) {
      if (skip || !stack.length) continue;
      const t = squash(m[4]);
      if (t) {
        // a heading, link or button owns the text of what it wraps (its <span>s), so its own line reads whole
        let owner = stack.length - 1;
        for (let k = stack.length - 1; k >= 0 && k >= stack.length - 4; k--) if (OWNS_TEXT.has(stack[k].tag)) { owner = k; break; }
        stack[owner].text += ` ${t}`;
        if (textLen < 6000) { text.push(t); textLen += t.length + 1; }
      }
      continue;
    }
    const closing = m[1] === "/";
    const tag = m[2].toLowerCase();
    const attrs = m[3] ?? "";
    if (skip) { if (closing && tag === skip) skip = null; continue; }
    if (!closing && SKIP.has(tag)) { if (!/\/\s*$/.test(attrs)) skip = tag; continue; }
    if (closing) {
      const at = stack.map((n) => n.tag).lastIndexOf(tag);
      if (at < 0) continue;
      while (stack.length > at) close(stack.pop()!);
      continue;
    }
    if (tag === "input" && /\btype\s*=\s*["']?hidden/i.test(attrs)) continue;
    if (tag === "img" || tag === "input") {
      const alt = squash(attr(attrs, "alt") ?? attr(attrs, "placeholder") ?? attr(attrs, "value") ?? "");
      close(open(tag, attrs, alt ? `[${tag === "img" ? "picture" : "field"}: ${alt}]` : ""));
      continue;
    }
    if (VOID.has(tag) || /\/\s*$/.test(attrs)) continue;
    stack.push(open(tag, attrs));
  }
  while (stack.length) close(stack.pop()!);
  const lines: string[] = [];
  let chars = 0;
  let truncated = false;
  for (const l of slots) {
    if (!l) continue;
    if (lines.length >= maxLines || chars + l.length > maxChars) { truncated = true; break; }
    lines.push(l);
    chars += l.length + 1;
  }
  return { title, description, h1, lines, text: text.join(" ").slice(0, 6000), truncated };
}
