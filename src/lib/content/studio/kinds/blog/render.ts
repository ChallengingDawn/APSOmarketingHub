// BLOG POST - THE POST, THE BLOG'S HOME AND A TOPIC PAGE AS THE SHOP SHOWS THEM (08.11.2026). Pure: tested.
//
// SARCLA 08.11.2026: "The blog is just ridiculous on the site" (the home was a title, a chip and "1 Min. Lesezeit").
// Now a real B2B blog in the shop's look: futura-pt (Jost after it), ink #1d2326, petrol #274e64 for the bands and links,
// red #d80901 only on the small topic line, the rules and the buttons, squared corners everywhere.
//   the home     a petrol band (crumbs, "Blog", one line), the topics as tabs, the newest post as a wide feature, then a
//                grid of cards (picture, topic, title, lead, author, date, reading time), the newsletter band
//   a post       crumbs, topic, title, lead, the author's line, a wide picture, then contents on the side and the article:
//                "In short", sections with their pictures and pull quotes, the band to the shop, questions, products,
//                topics, the author; then more posts and the newsletter band
// The same HTML goes into the paste for Magento (the shop's own header and footer go around it there). The preview adds
// the shop's header and footer around it, keeps links in the frame, and - for the team only - each post's state on its
// card and a marked free slot where the grid has room: never a made-up post, and none of that in the paste.

import {
  LIMITS, SHOP, homePath, initials, newsletterUrl, postPath, readingMinutes, shopUrl, slugify, tagPath, wordsOf,
  type BlogCard, type BlogDoc, type BlogPicture,
} from "./model";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** An address a post may link to: the web, the shop's own paths, an anchor, a mail. */
function safeUrl(raw: string): string | null {
  const u = raw.replace(/&amp;/g, "&").trim();
  return /^(https?:\/\/|\/(?!\/)|#|mailto:)/i.test(u) ? esc(u) : null;
}

/**
 * A picture's address as the page carries it. A picture kept in the hub has a path (/api/content/picture/...): the
 * preview reads it from the hub itself; the paste gets the hub's full address (`origin`), so Magento is never handed a
 * path that means something else on the shop.
 */
function picUrl(raw: string, origin?: string): string | null {
  const u = raw.trim();
  if (origin && u.startsWith("/api/content/picture/")) return safeUrl(`${origin.replace(/\/+$/, "")}${u}`);
  return safeUrl(u);
}

/** True when a picture lives in the hub (its visitors on the shop cannot reach it). */
export const inHub = (url: string) => /^(\/api\/content\/picture\/|https?:\/\/[^/]*apsomarketinghub)/i.test(url.trim());

/* ── markdown, the part posts use ─────────────────────────────────────── */

export function inline(src: string): string {
  const codes: string[] = [];
  let t = esc(src).replace(/`([^`]+)`/g, (_, c: string) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (all, text: string, url: string) => { const u = safeUrl(url); return u ? `<a href="${u}">${text}</a>` : text; });
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, "$1<em>$2</em>");
  t = t.replace(/==([^=]+)==/g, "<mark>$1</mark>");
  return t.replace(/\u0000(\d+)\u0000/g, (_, i: string) => `<code>${codes[Number(i)]}</code>`);
}

const BLOCK = /^(\s*#{1,6}\s|\s*[-*+]\s+|\s*\d+[.)]\s+|\s*>|\s*\|)/;
const FINE = /^\*{0,2}(for information only|nur zur information|à titre (purement )?informatif|a titolo (puramente )?informativo|wyłącznie informacyjnie|tylko w celach informacyjnych|uitsluitend ter informatie|alleen ter informatie)/i;

/**
 * A section's markdown as its blocks - each block's HTML and the markdown it was made from (Content v3: a click on one
 * paragraph, list or table in the preview edits that block's own words, in place). Sub-headings are h3/h4 (the section's
 * own heading is the h2), lists, tables, quotes (shown as a callout in a post).
 */
export function mdParts(src: string): { raw: string; html: string }[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const out: { raw: string; html: string }[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const start = i;
    const push = (html: string) => out.push({ raw: lines.slice(start, i).join("\n").trim(), html });
    const h = /^\s*(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (h) { const tag = h[1].length >= 4 ? "h4" : "h3"; i++; push(`<${tag}>${inline(h[2])}</${tag}>`); continue; }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { i++; push("<hr>"); continue; }
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(cells(lines[i++]));
      push(`<div class="apx-table"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${head.map((_, k) => `<td>${inline(r[k] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }
    const ul = /^\s*[-*+]\s+/;
    const ol = /^\s*\d+[.)]\s+/;
    if (ul.test(line) || ol.test(line)) {
      const re = ul.test(line) ? ul : ol;
      const tag = re === ul ? "ul" : "ol";
      const items: string[] = [];
      while (i < lines.length && (re.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && items.length))) {
        if (re.test(lines[i])) items.push(lines[i].replace(re, "")); else items[items.length - 1] += ` ${lines[i].trim()}`;
        i++;
      }
      push(`<${tag}>${items.map((x) => `<li>${inline(x)}</li>`).join("")}</${tag}>`);
      continue;
    }
    if (/^\s*>/.test(line)) {
      const q: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, ""));
      push(`<blockquote><p>${inline(q.join(" "))}</p></blockquote>`);
      continue;
    }
    const p: string[] = [];
    while (i < lines.length && lines[i].trim() && !(p.length && BLOCK.test(lines[i]))) p.push(lines[i++].trim());
    // the line every word on chemical compatibility carries ("for information only, no guarantee, no liability"), in small type
    const fine = p.length === 1 && p[0].length < 200 && FINE.test(p[0]);
    push(`<p${fine ? ' class="apx-fine"' : ""}>${p.map(inline).join("<br>")}</p>`);
  }
  return out;
}

/** A section's markdown as HTML blocks. */
export const mdBlocks = (src: string): string[] => mdParts(src).map((x) => x.html);

/** A section's markdown as the markdown of each of its blocks (what one click in the preview edits). */
export const mdChunks = (src: string): string[] => mdParts(src).map((x) => x.raw);

export const md = (src: string): string => mdBlocks(src).join("\n");

/* ── the look ─────────────────────────────────────────────────────────── */

export const BLOG_CSS = `.apx-blog{--ink:#1d2326;--petrol:#274e64;--deep:#1b3a4b;--red:#d80901;--muted:#5f6a70;--line:#e3e7e9;--paper:#f4f6f7;font-family:futura-pt,Jost,"Century Gothic","Avenir Next",Avenir,system-ui,sans-serif;color:var(--ink);font-size:18px;line-height:1.65;-webkit-font-smoothing:antialiased;background:#fff}
.apx-blog *{box-sizing:border-box}
.apx-blog a{color:var(--petrol);text-underline-offset:3px}
.apx-blog .apx-wrap{max-width:1200px;margin:0 auto;padding:0 24px}
.apx-blog .apx-narrow{max-width:880px}
.apx-blog .apx-crumbs{font-size:14px;line-height:1.4;color:var(--muted);margin:0 0 28px}
.apx-blog .apx-crumbs a{color:inherit;text-decoration:none}
.apx-blog .apx-crumbs span{margin:0 10px;color:#aab3b8}
.apx-blog .apx-eyebrow{display:inline-block;color:var(--red);font-size:13px;line-height:1.3;font-weight:600;letter-spacing:.14em;text-transform:uppercase;margin:0 0 14px}
.apx-blog h1{font-size:48px;line-height:1.08;font-weight:500;letter-spacing:-.02em;margin:0 0 22px}
.apx-blog h2{font-size:32px;line-height:1.18;font-weight:500;letter-spacing:-.012em;margin:56px 0 18px}
.apx-blog h3{font-size:23px;line-height:1.3;font-weight:600;margin:36px 0 10px}
.apx-blog h4{font-size:19px;font-weight:600;margin:28px 0 8px}
.apx-blog p{margin:0 0 20px}
.apx-blog ul,.apx-blog ol{margin:0 0 22px;padding-left:24px}
.apx-blog li{margin:0 0 8px}
.apx-blog li::marker{color:var(--red)}
.apx-blog mark{background:none;color:var(--red);font-weight:600}
.apx-blog code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.86em;background:var(--paper);padding:1px 5px}
.apx-blog blockquote{margin:30px 0;padding:18px 24px 18px 22px;background:var(--paper);border-left:4px solid var(--petrol);font-size:17px;line-height:1.6;color:#2f393e}
.apx-blog blockquote p{margin:0}
.apx-blog blockquote.apx-pull{margin:44px 0;padding:6px 0 6px 30px;background:none;border-left:4px solid var(--red);font-size:28px;line-height:1.34;font-weight:500;letter-spacing:-.012em;color:var(--ink)}
.apx-blog hr{border:0;border-top:1px solid var(--line);margin:44px 0}
.apx-blog .apx-table{overflow-x:auto;margin:8px 0 28px;border:1px solid var(--line)}
.apx-blog table{border-collapse:collapse;width:100%;font-size:16px;line-height:1.5}
.apx-blog th,.apx-blog td{text-align:left;padding:12px 16px;border-bottom:1px solid var(--line);vertical-align:top}
.apx-blog th{background:var(--paper);color:var(--petrol);font-weight:600;font-size:14px;letter-spacing:.04em;text-transform:uppercase}
.apx-blog tr:last-child td{border-bottom:0}
.apx-blog .apx-btn{display:inline-block;background:var(--red);color:#fff;text-decoration:none;padding:15px 28px;font-weight:600;font-size:16px;line-height:1.2;letter-spacing:.02em;border-radius:2px;white-space:nowrap}
.apx-blog .apx-btn:hover{background:#b00700}
.apx-blog .apx-byline{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:14px;line-height:1.35;color:var(--muted)}
.apx-blog .apx-byline b{color:var(--ink);font-weight:600}
.apx-blog .apx-avatar{width:34px;height:34px;border-radius:50%;background:var(--petrol);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;letter-spacing:.05em;flex-shrink:0}
.apx-blog .apx-dot{width:3px;height:3px;border-radius:50%;background:#aab3b8;display:inline-block}
.apx-blog .apx-pic{display:block;position:relative;aspect-ratio:16/10;overflow:hidden;background:var(--paper)}
.apx-blog .apx-pic img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .5s ease}
.apx-blog a:hover .apx-pic img{transform:scale(1.035)}
.apx-blog .apx-pic-none{background:linear-gradient(135deg,var(--petrol) 0%,var(--deep) 100%);display:flex;align-items:flex-end;padding:22px}
.apx-blog .apx-pic-none.apx-t1{background:linear-gradient(135deg,#2b3a42 0%,#1d2326 100%)}
.apx-blog .apx-pic-none.apx-t2{background:linear-gradient(135deg,#3e6a80 0%,#274e64 100%)}
.apx-blog .apx-pic-none:before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.07) 1px,transparent 1px);background-size:32px 32px}
.apx-blog .apx-pic-none:after{content:"";position:absolute;left:22px;top:22px;width:40px;height:4px;background:var(--red)}
.apx-blog .apx-pic-none b{position:relative;color:#fff;font-size:24px;line-height:1.15;font-weight:500;letter-spacing:-.01em}
.apx-home .apx-band{background:linear-gradient(115deg,var(--deep) 0%,var(--petrol) 70%,#2e5f78 100%);color:#fff;padding:34px 0 52px;position:relative;overflow:hidden}
.apx-home .apx-band:after{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px);background-size:56px 56px;-webkit-mask-image:linear-gradient(90deg,transparent 35%,#000 100%);mask-image:linear-gradient(90deg,transparent 35%,#000 100%)}
.apx-home .apx-band .apx-wrap{position:relative;z-index:1}
.apx-home .apx-band .apx-crumbs{color:rgba(255,255,255,.72)}
.apx-home .apx-band .apx-crumbs span{color:rgba(255,255,255,.4)}
.apx-home .apx-band .apx-rule{display:block;width:56px;height:4px;background:var(--red);margin:0 0 22px}
.apx-home .apx-band h1{color:#fff;font-size:64px;margin:0 0 12px}
.apx-home .apx-band p{font-size:21px;line-height:1.5;color:rgba(255,255,255,.86);max-width:660px;margin:0}
.apx-blog .apx-topics{border-bottom:1px solid var(--line);background:#fff}
.apx-blog .apx-topics .apx-wrap{display:flex;overflow-x:auto;scrollbar-width:none}
.apx-blog .apx-topics a{padding:17px 18px 14px;font-size:15px;line-height:1.3;font-weight:500;color:var(--ink);text-decoration:none;border-bottom:3px solid transparent;white-space:nowrap}
.apx-blog .apx-topics a:first-child{padding-left:0}
.apx-blog .apx-topics a.apx-on{border-bottom-color:var(--red);font-weight:600}
.apx-blog .apx-feature{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);margin:48px 0 0;text-decoration:none;color:var(--ink);border:1px solid var(--line);background:#fff;position:relative}
.apx-blog .apx-feature .apx-pic{aspect-ratio:auto;min-height:380px;height:100%}
.apx-blog .apx-feature-body{padding:44px 48px;display:flex;flex-direction:column;justify-content:center}
.apx-blog .apx-feature-title{display:block;font-size:38px;line-height:1.1;font-weight:500;letter-spacing:-.018em;margin:0 0 16px}
.apx-blog .apx-feature .apx-card-text{-webkit-line-clamp:4;font-size:18px;margin-bottom:24px}
.apx-blog .apx-more{display:inline-block;margin-top:24px;font-size:15px;font-weight:600;color:var(--red);letter-spacing:.02em}
.apx-blog .apx-h-sec{display:flex;align-items:center;gap:16px;font-size:14px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin:64px 0 28px}
.apx-blog .apx-h-sec:after{content:"";flex:1;height:1px;background:var(--line)}
.apx-blog .apx-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:44px 28px}
.apx-blog .apx-card{display:flex;flex-direction:column;text-decoration:none;color:var(--ink);position:relative;min-width:0}
.apx-blog .apx-card .apx-eyebrow{margin:20px 0 8px}
.apx-blog .apx-card-title{display:block;font-size:23px;line-height:1.22;font-weight:500;letter-spacing:-.01em;margin:0 0 10px}
.apx-blog .apx-card-text{font-size:16px;line-height:1.55;color:#424c51;margin:0 0 18px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.apx-blog .apx-card .apx-byline{margin-top:auto}
.apx-blog .apx-nl{margin:80px 0 0;background:var(--paper);border-top:4px solid var(--red)}
.apx-blog .apx-nl .apx-wrap{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:32px;align-items:center;padding-top:44px;padding-bottom:48px}
.apx-blog .apx-nl h2{font-size:30px;margin:0 0 6px}
.apx-blog .apx-nl p{margin:0;color:#424c51;font-size:17px;max-width:620px}
.apx-post .apx-post-head{padding:40px 0 0}
.apx-post .apx-post-head .apx-wrap{display:grid;grid-template-columns:230px minmax(0,740px);gap:0 80px;justify-content:center}
.apx-post .apx-head-in{grid-column:2;min-width:0}
.apx-post.apx-solo .apx-post-head .apx-wrap{grid-template-columns:minmax(0,760px)}
.apx-post.apx-solo .apx-head-in{grid-column:1}
.apx-blog p.apx-fine{font-size:14px;line-height:1.5;color:var(--muted);margin:-6px 0 22px}
.apx-post .apx-lead{font-size:23px;line-height:1.5;color:#3c464b;margin:0 0 30px}
.apx-post .apx-post-head .apx-byline{padding:18px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.apx-blog .apx-byline .apx-who{display:flex;flex-direction:column;line-height:1.3;min-width:0}
.apx-blog .apx-byline small{font-size:13px;color:var(--muted)}
.apx-post .apx-hero{max-width:1200px;margin:44px auto 0;padding:0 24px}
.apx-post .apx-hero img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;background:var(--paper)}
.apx-post figcaption{font-size:14px;line-height:1.5;color:var(--muted);margin-top:10px}
.apx-post .apx-body{max-width:1200px;margin:60px auto 0;padding:0 24px;display:grid;grid-template-columns:230px minmax(0,740px);gap:80px;justify-content:center}
.apx-post .apx-body-solo{grid-template-columns:minmax(0,760px)}
.apx-post .apx-toc{position:sticky;top:24px;align-self:start;font-size:15px}
.apx-post .apx-toc b{display:block;font-size:12px;line-height:1.3;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin:0 0 14px;font-weight:600}
.apx-post .apx-toc ol{list-style:none;margin:0;padding:0;border-left:2px solid var(--line)}
.apx-post .apx-toc li{margin:0}
.apx-post .apx-toc a{display:block;padding:8px 0 8px 16px;margin-left:-2px;border-left:2px solid transparent;color:#3c464b;text-decoration:none;line-height:1.35}
.apx-post .apx-toc li:first-child a{border-left-color:var(--red);color:var(--ink);font-weight:600}
.apx-post .apx-short{background:var(--paper);border-left:4px solid var(--petrol);padding:24px 28px 8px;margin:0 0 48px}
.apx-post .apx-short b{display:block;font-size:13px;line-height:1.3;letter-spacing:.12em;text-transform:uppercase;color:var(--petrol);margin:0 0 12px;font-weight:600}
.apx-post .apx-short ul{padding-left:20px;margin:0 0 16px}
.apx-post .apx-main>section>h2:first-child{scroll-margin-top:24px}
.apx-post .apx-main>section:first-of-type>h2:first-child{margin-top:0}
.apx-post .apx-fig{margin:36px 0}
.apx-post .apx-fig img{display:block;width:100%;height:auto;background:var(--paper)}
.apx-post .apx-cta{display:flex;align-items:center;justify-content:space-between;gap:28px;background:linear-gradient(115deg,var(--deep),var(--petrol));color:#fff;padding:34px 38px;margin:60px 0}
.apx-post .apx-cta b{display:block;font-size:25px;line-height:1.2;font-weight:500;margin:0 0 6px}
.apx-post .apx-cta p{margin:0;color:rgba(255,255,255,.84);font-size:16px;line-height:1.5}
.apx-post .apx-faq h2{margin-bottom:22px}
.apx-post .apx-faq details{border:1px solid var(--line);margin:0 0 -1px;background:#fff}
.apx-post .apx-faq summary{cursor:pointer;list-style:none;padding:20px 64px 20px 24px;position:relative;font-weight:600;font-size:19px;line-height:1.4}
.apx-post .apx-faq summary::-webkit-details-marker{display:none}
.apx-post .apx-faq summary:after{content:"+";position:absolute;right:20px;top:50%;margin-top:-15px;width:30px;height:30px;border:1px solid var(--line);display:flex;align-items:center;justify-content:center;color:var(--petrol);font-weight:400;font-size:20px;line-height:1}
.apx-post .apx-faq details[open] summary:after{content:"\\2212"}
.apx-post .apx-faq details>div{padding:0 24px 8px;color:#3c464b}
.apx-post .apx-related{margin-top:56px}
.apx-post .apx-related ul{list-style:none;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.apx-post .apx-related li{margin:0}
.apx-post .apx-related a{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;column-gap:16px;padding:20px 22px;border:1px solid var(--line);border-top:3px solid var(--petrol);text-decoration:none;color:var(--ink);background:#fff;line-height:1.35;height:100%}
.apx-post .apx-related a b{font-weight:600;font-size:18px}
.apx-post .apx-related a small{grid-column:1;font-size:13px;color:var(--muted);margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.apx-post .apx-related a:after{content:"\\2192";grid-column:2;grid-row:1/span 2;width:40px;height:40px;display:flex;align-items:center;justify-content:center;background:var(--red);color:#fff;font-size:18px}
.apx-post .apx-related a:hover{border-color:var(--petrol)}
.apx-blog .apx-tags{margin:44px 0 0;display:flex;flex-wrap:wrap;gap:8px}
.apx-blog .apx-tags a{display:inline-block;padding:7px 14px;border:1px solid #cfd6da;font-size:14px;line-height:1.3;color:var(--petrol);text-decoration:none;border-radius:2px}
.apx-blog .apx-tags a:hover{border-color:var(--petrol)}
.apx-post .apx-author{display:flex;gap:16px;align-items:center;margin:44px 0 0;padding:26px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.apx-post .apx-author .apx-avatar{width:56px;height:56px;font-size:17px}
.apx-post .apx-author b{display:block;font-size:18px;font-weight:600;line-height:1.3}
.apx-post .apx-author div>span{display:block;font-size:15px;color:var(--muted)}
.apx-post .apx-back{margin:36px 0 0;font-size:15px}
.apx-post .apx-back a{text-decoration:none;font-weight:600}
.apx-post .apx-others{margin:88px 0 0;padding:0}
.apx-post .apx-others .apx-h-sec{margin-top:0}
.apx-empty{color:var(--muted);font-size:17px}
@media (max-width:1023px){.apx-post .apx-post-head .apx-wrap{grid-template-columns:minmax(0,1fr)}.apx-post .apx-head-in{grid-column:1}.apx-blog .apx-cards{grid-template-columns:repeat(2,minmax(0,1fr))}.apx-post .apx-body{grid-template-columns:minmax(0,1fr);gap:0}.apx-post .apx-toc{position:static;background:var(--paper);padding:20px 22px;margin:0 0 40px}.apx-post .apx-toc ol{border:0}.apx-post .apx-toc a{padding-left:0;border:0!important}}
@media (max-width:767px){.apx-blog{font-size:17px}.apx-blog .apx-wrap,.apx-post .apx-hero,.apx-post .apx-body{padding-left:16px;padding-right:16px}.apx-blog h1,.apx-home .apx-band h1{font-size:34px}.apx-blog h2{font-size:26px;margin-top:44px}.apx-post .apx-lead{font-size:19px}.apx-blog blockquote.apx-pull{font-size:22px}.apx-blog .apx-cards{grid-template-columns:minmax(0,1fr);gap:40px}.apx-blog .apx-feature{grid-template-columns:minmax(0,1fr)}.apx-blog .apx-feature .apx-pic{min-height:0;aspect-ratio:16/10}.apx-blog .apx-feature-body{padding:24px}.apx-blog .apx-feature-title{font-size:27px}.apx-blog .apx-nl .apx-wrap{grid-template-columns:minmax(0,1fr)}.apx-post .apx-cta{flex-direction:column;align-items:flex-start;padding:26px}.apx-post .apx-related ul{grid-template-columns:minmax(0,1fr)}.apx-home .apx-band p{font-size:18px}}`;

/* ── the shop around it (preview only) ────────────────────────────────── */

const CATEGORIES: Record<string, string[]> = {
  DE: ["Dichtungstechnik", "Kunststofftechnik", "Fluidtechnik", "Schwingungstechnik", "Antriebstechnik", "Sensoren & Power"],
  FR: ["Étanchéité", "Matières plastiques", "Fluides", "Antivibration", "Transmission", "Capteurs et énergie"],
  IT: ["Tenute", "Materie plastiche", "Fluidi", "Antivibrazione", "Trasmissioni", "Sensori e potenza"],
  EN: ["Sealing technology", "Engineering plastics", "Fluid handling", "Antivibration", "Drive technology", "Sensors & power"],
  NL: ["Afdichtingstechniek", "Kunststoftechniek", "Industriële slangen", "Trillingisolatie", "Aandrijftechniek", "Sensoren en voeding"],
  PL: ["Uszczelnienia", "Tworzywa sztuczne", "Płyny", "Antywibracja", "Napędy", "Czujniki i zasilanie"],
};
const SEARCH: Record<string, string> = { DE: "Suchen", FR: "Rechercher", IT: "Cerca", EN: "Search", NL: "Zoeken", PL: "Szukaj" };
const PRODUCTS: Record<string, string> = { DE: "Produkte", FR: "Produits", IT: "Prodotti", EN: "Products", NL: "Producten", PL: "Produkty" };

/** The preview's own look: the shop's header and footer drawn around the page, Jost in place of futura-pt, links kept in the frame. */
const PREVIEW_CSS = `@font-face{font-family:Jost;font-weight:400 500;src:url(/video/fonts/jost-latin-500-normal.woff2) format("woff2")}
@font-face{font-family:Jost;font-weight:600 700;src:url(/video/fonts/jost-latin-700-normal.woff2) format("woff2")}
body{margin:0;background:#fff}
a{pointer-events:none}
.apx-shop{font-family:futura-pt,Jost,system-ui,sans-serif;color:#1d2326;border-bottom:1px solid #e3e7e9;background:#fff}
.apx-shop-row{max-width:1200px;margin:0 auto;padding:16px 24px;display:flex;align-items:center;gap:32px}
.apx-shop-row img{height:46px;width:auto;display:block;margin:-6px 0}
.apx-shop-search{flex:1;display:flex;height:44px;border:1px solid #cfd6da;max-width:620px}
.apx-shop-search span{flex:1;display:flex;align-items:center;padding:0 16px;color:#8a949a;font-size:15px}
.apx-shop-search b{width:52px;background:#d80901;display:flex;align-items:center;justify-content:center}
.apx-shop-icons{display:flex;gap:22px;margin-left:auto}
.apx-shop-icons svg{width:24px;height:24px;display:block}
.apx-shop-nav{max-width:1200px;margin:0 auto;padding:0 24px;display:flex;gap:28px;font-size:15px;font-weight:500;white-space:nowrap;overflow:hidden}
.apx-shop-nav span{padding:12px 0 13px;border-bottom:3px solid transparent}
.apx-shop-nav span.on{border-bottom-color:#d80901;color:#d80901}
.apx-shop-foot{margin-top:0;background:#1d2326;color:rgba(255,255,255,.7);font-family:futura-pt,Jost,system-ui,sans-serif;font-size:14px}
.apx-shop-foot div{max-width:1200px;margin:0 auto;padding:36px 24px;display:flex;align-items:center;justify-content:space-between;gap:24px}
.apx-shop-foot img{height:40px;width:auto;display:block;margin:-6px 0}
.apx-state{position:absolute;top:12px;left:12px;z-index:2;font:600 12px/1 system-ui,sans-serif;letter-spacing:.02em;padding:7px 10px;border-radius:2px;background:#fff;color:#1d2326;box-shadow:0 1px 3px rgba(0,0,0,.18)}
.apx-state.s-todo{background:#eef1f3;color:#4a5257}.apx-state.s-writing{background:#fff1b8;color:#6b4e00}.apx-state.s-review{background:#dbe8ff;color:#1e4aa8}.apx-state.s-changes{background:#ffe1dc;color:#9a2a12}.apx-state.s-approved{background:#d6f2e4;color:#11603e}.apx-state.s-live{background:#1b7a55;color:#fff}
.apx-this{position:absolute;top:12px;right:12px;z-index:2;font:600 12px/1 system-ui,sans-serif;padding:7px 10px;border-radius:2px;background:#d80901;color:#fff}
.apx-slot{border:2px dashed #c3ccd1;background:repeating-linear-gradient(135deg,#fafbfb 0 12px,#f3f5f6 12px 24px);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:8px;padding:32px 28px;min-height:360px;color:#5f6a70;font-family:system-ui,sans-serif}
.apx-slot b{font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#4a5257}
.apx-slot span{font-size:14px;line-height:1.5;max-width:260px}
.apx-slot i{width:40px;height:40px;border:2px solid #c3ccd1;display:flex;align-items:center;justify-content:center;font-style:normal;font-size:24px;color:#8a949a;margin-bottom:6px}
.apx-feature.apx-slot{min-height:380px;display:flex}
.apx-unwritten{font:italic 14px/1.5 system-ui,sans-serif!important;color:#8a949a!important}
@media (max-width:767px){.apx-shop-row{gap:14px;padding:12px 16px}.apx-shop-row img{height:34px}.apx-shop-icons{display:none}.apx-shop-nav{padding:0 16px;gap:18px;font-size:14px}}`;

const ICON_USER = `<svg viewBox="0 0 24 24" fill="none" stroke="#1d2326" stroke-width="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>`;
const ICON_CART = `<svg viewBox="0 0 24 24" fill="none" stroke="#1d2326" stroke-width="1.6"><path d="M3 4h2.5l2.2 11h10.6L20.5 7H7"/><circle cx="9.5" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/></svg>`;
const ICON_SEARCH = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>`;

function shopHeader(language: string): string {
  const L = language.toUpperCase();
  const cats = CATEGORIES[L] ?? CATEGORIES.EN;
  return `<div class="apx-shop">
<div class="apx-shop-row"><img src="/brand/apsoparts-logo.svg" alt="APSOparts"><div class="apx-shop-search"><span>${esc(SEARCH[L] ?? SEARCH.EN)}</span><b>${ICON_SEARCH}</b></div><div class="apx-shop-icons">${ICON_USER}${ICON_CART}</div></div>
<nav class="apx-shop-nav"><span>${esc(PRODUCTS[L] ?? PRODUCTS.EN)}</span>${cats.map((c) => `<span>${esc(c)}</span>`).join("")}<span class="on">Blog</span></nav></div>`;
}

const shopFooter = () => `<footer class="apx-shop-foot"><div><img src="/brand/apsoparts-logo-white.svg" alt="APSOparts"><span>APSOparts - Angst+Pfister</span></div></footer>`;

export function fmtDate(iso: string | null, store: string): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat(store, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
  } catch { return iso; }
}

const langOf = (store: string) => store.slice(0, 2).toLowerCase();

/* ── the pieces both pages use ────────────────────────────────────────── */

/** A card's picture: the post's own, or a petrol block with its topic (designed, never a stock picture). */
function picture(c: { hero: { url: string; alt: string }; tags: string[]; title: string }, origin?: string): string {
  const u = c.hero.url ? picUrl(c.hero.url, origin) : null;
  if (u) return `<span class="apx-pic"><img src="${u}" alt="${esc(c.hero.alt || c.title)}" loading="lazy"></span>`;
  const topic = c.tags[0] ?? "APSOparts";
  // one of three of the brand's dark tones, the same for the same topic
  const tone = [...topic].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) % 997, 7) % 3;
  return `<span class="apx-pic apx-pic-none apx-t${tone}"><b>${esc(topic)}</b></span>`;
}

const STATE: Record<string, string> = { todo: "To do", writing: "Writing", review: "In review", changes: "Changes asked", approved: "Approved", live: "Live" };

type CardOpts = { withState?: boolean; currentId?: number; origin?: string };

function stateTag(c: BlogCard, o: CardOpts): string {
  if (!o.withState) return "";
  const s = STATE[c.status] ? `<span class="apx-state s-${esc(c.status)}">${STATE[c.status]}</span>` : "";
  return `${s}${o.currentId === c.pieceId ? `<span class="apx-this">This post</span>` : ""}`;
}

/** A card's author line: their mark, their name, and under it the day and the reading time. */
function byline(c: { author: string; date: string | null; store: string; minutes: number; language: string }): string {
  const w = wordsOf(c.language || "EN");
  const when = [fmtDate(c.date, c.store), `${c.minutes} ${w.read}`].filter(Boolean).map(esc).join(" · ");
  const name = c.author.trim();
  return `<span class="apx-byline">${name ? `<span class="apx-avatar">${esc(initials(name))}</span>` : ""}<span class="apx-who">${name ? `<b>${esc(name)}</b>` : ""}<small>${when}</small></span></span>`;
}

const cardPath = (c: BlogCard) => `/${c.store}/blog/${esc(c.slug)}`;

function cardHtml(c: BlogCard, o: CardOpts): string {
  const text = c.excerpt ? `<span class="apx-card-text">${esc(c.excerpt)}</span>` : o.withState ? `<span class="apx-card-text apx-unwritten">Not written yet.</span>` : "";
  return `<a class="apx-card" href="${cardPath(c)}">${picture(c, o.origin)}${stateTag(c, o)}${c.tags[0] ? `<span class="apx-eyebrow">${esc(c.tags[0])}</span>` : `<span class="apx-eyebrow">&nbsp;</span>`}<span class="apx-card-title">${esc(c.title || "…")}</span>${text}${byline(c)}</a>`;
}

function featureHtml(c: BlogCard, o: CardOpts): string {
  const w = wordsOf(c.language || "EN");
  return `<a class="apx-feature" href="${cardPath(c)}">${picture(c, o.origin)}${stateTag(c, o)}<span class="apx-feature-body"><span class="apx-eyebrow">${esc(w.latest)}${c.tags[0] ? ` · ${esc(c.tags[0])}` : ""}</span><span class="apx-feature-title">${esc(c.title || "…")}</span>${c.excerpt ? `<span class="apx-card-text">${esc(c.excerpt)}</span>` : ""}${byline(c)}<span class="apx-more">${esc(w.readPost)} &rarr;</span></span></a>`;
}

/** A free place in the grid - for the team, in the preview only: where the next post lands. Never a made-up post. */
const slotHtml = (feature = false) => `<div class="${feature ? "apx-feature " : ""}apx-slot"><i>+</i><b>Free slot</b><span>${feature ? "No blog post yet. The first one written shows here as the blog's lead story." : "The next blog post shows here. Plan more under Publish › More posts."}</span></div>`;

function newsletterBand(store: string, language: string): string {
  const w = wordsOf(language);
  return `<aside class="apx-nl"><div class="apx-wrap"><div><h2>${esc(w.nlTitle)}</h2><p>${esc(w.nlText)}</p></div><a class="apx-btn" href="${newsletterUrl(store)}">${esc(w.nlButton)}</a></div></aside>`;
}

/* ── the post ─────────────────────────────────────────────────────────── */

/**
 * The studio's marks on the post (Content v3, SARCLA 08.11.2026: "the editing is really not yet fully clear"). In the
 * studio's preview only - never in the paste: each part says what it is, so a click on it edits its words right there
 * (data-ed), picks a picture (data-pic) or a part with no words of its own (data-sel); an empty part shows what goes
 * there (data-ph), and a picture the post plans but does not have yet shows as its empty frame.
 */
export type PostEdit = {
  /** Parts shown empty to be filled although nothing is in them yet: "s:<id>:q" (a pull quote), "s:<id>:img" (a picture). */
  open?: string[];
};

const ed = (o: PostOpts, key: string, ph?: string) => (o.edit ? ` data-ed="${esc(key)}"${ph ? ` data-ph="${esc(ph)}"` : ""}` : "");
const pick = (o: PostOpts, key: string) => (o.edit ? ` data-sel="${esc(key)}"` : "");
const isOpen = (o: PostOpts, key: string) => !!o.edit?.open?.includes(key);

/** A picture of the post; in the studio, a picture planned but not made yet is its empty frame with the idea for it. */
function figure(p: BlogPicture, o: PostOpts, cls: string, key: string, open = false): string {
  const u = p.url ? picUrl(p.url, o.origin) : null;
  const mark = o.edit ? ` data-pic="${esc(key)}"` : "";
  if (!u) {
    if (!o.edit || !(open || p.prompt.trim())) return "";
    const what = cls === "apx-hero" ? "The post's picture" : "A picture";
    return `<figure class="${cls} apx-ph"${mark}><span class="apx-ph-box"><b>${what}</b>${p.prompt.trim() ? `<span>${esc(p.prompt.trim().slice(0, 220))}</span>` : ""}<i>Click - make it or upload one</i></span></figure>`;
  }
  const cap = p.caption.trim() ? `<figcaption${ed(o, `${key}:cap`)}>${esc(p.caption.trim())}</figcaption>` : "";
  // the post's own picture is the first thing seen - never lazy
  return `<figure class="${cls}"${mark}><img src="${u}" alt="${esc(p.alt)}"${cls === "apx-hero" ? ' fetchpriority="high"' : ' loading="lazy"'}>${cap}</figure>`;
}

/** A section: its heading, its text - its picture after the first block, its pull quote after the second. */
function sectionHtml(s: BlogDoc["sections"][number], o: PostOpts): string {
  const k = `s:${s.id}`;
  const parts = mdParts(s.body);
  const blocks = o.edit
    ? (parts.length ? parts : [{ raw: "", html: "" }]).map((b, i) => `<div class="apx-chunk"${ed(o, `${k}:b:${i}`, "Write this section here - or ask the assistant on the right")}>${b.html}</div>`)
    : parts.map((b) => b.html);
  const fig = figure(s.image, o, "apx-fig", `${k}:img`, isOpen(o, `${k}:img`));
  const quoteOn = s.quote.trim() || (o.edit && isOpen(o, `${k}:q`));
  const quote = quoteOn ? `<blockquote class="apx-pull"><p${ed(o, `${k}:q`, "One sentence worth reading twice")}>${inline(s.quote.trim())}</p></blockquote>` : "";
  const out = [...blocks];
  if (quote) out.splice(Math.min(2, out.length), 0, quote);
  if (fig) out.splice(Math.min(1, out.length), 0, fig);
  const head = s.heading.trim() || o.edit ? `<h2 id="${slugify(s.heading)}"${ed(o, `${k}:h`, "The section's heading")}>${inline(s.heading)}</h2>` : "";
  return `<section${o.edit ? ` data-sec="${esc(s.id)}"` : ""}>${head}\n${out.join("\n")}</section>`;
}

export type PostOpts = {
  /** Other posts to show under it (the studio shows none: SARCLA 08.11.2026 "on the preview, show just the blog page"). */
  related?: BlogCard[];
  /** The hub's address, for pictures kept in the hub - the paste only. */
  origin?: string;
  withState?: boolean;
  /** Its day on the content calendar - shown when the post has no publishing day of its own. */
  due?: string | null;
  /** The studio's preview, edited in place. */
  edit?: PostEdit;
};

/** A product's address, short, as the card shows it under its name. */
const shortUrl = (u: string) => u.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

/** The post's page content, as it is pasted: the article with its links to the blog's home and topics. */
export function postArticle(d: BlogDoc, o: PostOpts = {}): string {
  const w = wordsOf(d.language);
  const meta = [fmtDate(d.publishAt || o.due || null, d.store), `${readingMinutes(d)} ${w.read}`].filter(Boolean).map(esc).join(`<span class="apx-dot"></span>`);
  const author = d.author.trim();
  const who = author ? `<span class="apx-avatar">${esc(initials(author))}</span><span class="apx-who"><b>${esc(author)}</b>${d.authorRole.trim() ? `<small>${esc(d.authorRole.trim())}</small>` : ""}</span><span class="apx-dot"></span>` : "";
  const hero = figure(d.hero, o, "apx-hero", "hero", true);
  const heads = d.sections.filter((s) => s.heading.trim());
  const toc = heads.length >= 2 ? `<aside class="apx-toc"><b>${esc(w.toc)}</b><ol>${heads.map((s) => `<li><a href="#${slugify(s.heading)}">${inline(s.heading)}</a></li>`).join("")}</ol></aside>` : "";
  const lines = d.takeaways.length ? `<ul>${d.takeaways.map((t) => `<li>${inline(t)}</li>`).join("")}</ul>` : "";
  const short = o.edit
    ? `<div class="apx-short"><b>${esc(w.inShort)}</b><div${ed(o, "short", "Three or four lines a reader takes away - one per line")}>${lines}</div></div>`
    : lines ? `<div class="apx-short"><b>${esc(w.inShort)}</b>${lines}</div>` : "";
  const sections = d.sections.map((s) => sectionHtml(s, o)).join("\n");
  const ctaUrl = safeUrl(d.cta.url.trim() || shopUrl(d.store)) ?? esc(shopUrl(d.store));
  const cta = d.sections.length
    ? `<aside class="apx-cta"${pick(o, "cta")}><div><b${ed(o, "cta:t")}>${esc(d.cta.title.trim() || w.ctaTitle)}</b><p${ed(o, "cta:x")}>${esc(d.cta.text.trim() || w.ctaText)}</p></div><a class="apx-btn" href="${ctaUrl}"${ed(o, "cta:l")}>${esc(d.cta.label.trim() || w.ctaLabel)}</a></aside>`
    : "";
  const qs = o.edit ? d.faq : d.faq.filter((f) => f.q.trim());
  // in the studio every answer shows, to be edited where it is read
  const faq = qs.length
    ? o.edit
      ? `<section class="apx-faq"${pick(o, "faq")}><h2 id="faq">${esc(w.faq)}</h2>${qs.map((f) => `<div class="apx-qa"><div class="apx-q"${ed(o, `faq:${f.id}:q`, "The question")}>${inline(f.q)}</div><div class="apx-a"${ed(o, `faq:${f.id}:a`, "Its answer")}>${md(f.a)}</div></div>`).join("")}</section>`
      : `<section class="apx-faq"><h2 id="faq">${esc(w.faq)}</h2>${qs.map((f, i) => `<details${i === 0 ? " open" : ""}><summary>${inline(f.q)}</summary><div>${md(f.a)}</div></details>`).join("")}</section>`
    : o.edit && d.sections.length ? `<section class="apx-faq apx-slot-sec"${pick(o, "faq")}><h2>${esc(w.faq)}</h2><p class="apx-slot-line">No questions yet - the assistant writes them from the post.</p></section>` : "";
  const products = o.edit ? d.relatedProducts : d.relatedProducts.filter((p) => p.name.trim() && safeUrl(p.url));
  const card = (p: BlogDoc["relatedProducts"][number]) => {
    const u = safeUrl(p.url);
    return `<li><a href="${u ?? "#"}"${pick(o, `prod:${p.id}`)}><b${ed(o, `prod:${p.id}`, "The product's name")}>${esc(p.name)}</b><small>${u ? esc(shortUrl(p.url)) : o.edit ? "No address on the shop yet" : ""}</small></a></li>`;
  };
  const related = products.length
    ? `<section class="apx-related"${pick(o, "prods")}><h2>${esc(w.related)}</h2><ul>${products.map(card).join("")}</ul></section>`
    : o.edit && d.sections.length ? `<section class="apx-related apx-slot-sec"${pick(o, "prods")}><h2>${esc(w.related)}</h2><p class="apx-slot-line">The shop pages this post leads to - click to add them.</p></section>` : "";
  const tags = d.tags.length ? `<p class="apx-tags"${pick(o, "tags")}>${d.tags.map((t) => `<a href="${tagPath(d.store, t)}">${esc(t)}</a>`).join("")}</p>` : "";
  const authorBox = author
    ? `<div class="apx-author"${pick(o, "author")}><span class="apx-avatar">${esc(initials(author))}</span><div><b>${esc(author)}</b>${d.authorRole.trim() ? `<span>${esc(d.authorRole.trim())}</span>` : ""}</div></div>`
    : "";
  const others = (o.related ?? []).slice(0, 3);
  const more = others.length ? `<section class="apx-others"><div class="apx-wrap"><h2 class="apx-h-sec">${esc(w.more)}</h2><div class="apx-cards">${others.map((c) => cardHtml(c, { withState: o.withState, origin: o.origin })).join("\n")}</div></div></section>` : "";
  const crumbs = `<nav class="apx-crumbs"><a href="/${d.store}/">${esc(w.shopHome)}</a><span>/</span><a href="${homePath(d.store)}">${esc(w.home)}</a>${d.tags[0] ? `<span>/</span><a href="${tagPath(d.store, d.tags[0])}">${esc(d.tags[0])}</a>` : ""}</nav>`;
  const eyebrow = d.tags[0] ? `<span class="apx-eyebrow"${pick(o, "tags")}>${esc(d.tags[0])}</span>` : o.edit ? `<span class="apx-eyebrow apx-ghost"${pick(o, "tags")}>Its topic</span>` : "";
  const title = o.edit ? `<h1${ed(o, "title", "The post's title")}>${esc(d.title)}</h1>` : `<h1>${esc(d.title || "…")}</h1>`;
  const lead = d.excerpt.trim() || o.edit ? `<p class="apx-lead"${ed(o, "lead", "The lead: the answer at once, in one or two sentences")}>${inline(d.excerpt.trim())}</p>` : "";
  const byline = who || meta ? `<div class="apx-byline apx-meta"${pick(o, "author")}>${who || (o.edit ? `<span class="apx-ghost">Its author</span><span class="apx-dot"></span>` : "")}${meta}</div>` : "";
  return `<article class="apx-blog apx-post${toc ? "" : " apx-solo"}" lang="${langOf(d.store)}">
<header class="apx-post-head"><div class="apx-wrap"><div class="apx-head-in">
${crumbs}
${eyebrow}${title}
${lead}
${byline}
</div></div></header>
${hero}
<div class="apx-body${toc ? "" : " apx-body-solo"}">
${toc}<div class="apx-main">
${short}
${sections}
${cta}
${faq}
${related}
${tags}
${authorBox}
<p class="apx-back"><a href="${homePath(d.store)}">&larr; ${esc(w.back)}</a></p>
</div>
</div>
${more}
${newsletterBand(d.store, d.language)}
</article>`;
}

/** The studio's own look in the preview: the empty frames and slots, the words still to write. */
const EDIT_CSS = `.apx-post .apx-ph{position:relative;margin:36px 0;aspect-ratio:3/2;border:2px dashed #b9c3c9;background:repeating-linear-gradient(135deg,#f7f9fa 0 14px,#f0f3f5 14px 28px);display:flex;align-items:center;justify-content:center;text-align:center}
.apx-post .apx-hero.apx-ph{aspect-ratio:16/9;width:calc(100% - 48px);max-width:1152px;margin:44px auto 0}
.apx-post .apx-ph-box{display:flex;flex-direction:column;align-items:center;gap:8px;max-width:520px;padding:24px;font-family:system-ui,sans-serif}
.apx-post .apx-ph-box b{font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#4a5257}
.apx-post .apx-ph-box span{font-size:15px;line-height:1.5;color:#5f6a70;font-style:italic}
.apx-post .apx-ph-box i{font-style:normal;font-size:14px;font-weight:600;color:#fff;background:#c22c6e;padding:8px 14px;border-radius:4px;margin-top:4px}
.apx-blog .apx-ghost{color:#9aa4ab!important;font-style:italic}
.apx-post .apx-slot-sec{border:2px dashed #c9d1d6;padding:22px 26px;margin-top:48px}
.apx-post .apx-slot-sec h2{margin:0 0 6px;font-size:22px;color:#5f6a70}
.apx-post .apx-slot-line{margin:0;font:italic 15px/1.5 system-ui,sans-serif;color:#7b858b}
.apx-post .apx-qa{border:1px solid var(--line);margin:0 0 -1px;background:#fff;padding:18px 24px 8px}
.apx-post .apx-q{font-weight:600;font-size:19px;line-height:1.4;margin:0 0 8px}
.apx-post .apx-a{color:#3c464b}
.apx-post [data-ph]:empty{min-height:1.4em}
[data-ph]:empty:before{content:attr(data-ph);color:#9aa4ab;font-style:italic;font-weight:400;pointer-events:none}
@media (max-width:767px){.apx-post .apx-hero.apx-ph{width:calc(100% - 32px);margin:32px auto 0}}`;

const page = (lang: string, title: string, body: string, language: string, extraCss = "") =>
  `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${BLOG_CSS}\n${PREVIEW_CSS}${extraCss ? `\n${extraCss}` : ""}</style></head><body>${shopHeader(language)}${body}${shopFooter()}</body></html>`;

/** The post as a whole page in the shop, for the preview frame (the studio's marks on it when `edit` is given). */
export function postDocument(d: BlogDoc, o: PostOpts = {}): string {
  return page(langOf(d.store), d.metaTitle || d.title, postArticle(d, { ...o, origin: undefined }), d.language, o.edit ? EDIT_CSS : "");
}

/* ── the blog's home and its topics ───────────────────────────────────── */

export type HomeOpts = {
  store: string; language: string; topics: string[]; tag?: string | null;
  /** The team's view (the preview): each post's state on its card, the post open in the studio marked, free slots marked. */
  withState?: boolean; currentId?: number; origin?: string;
};

/** The blog's home (or one topic's page): the band, the topics, the newest post with a picture as the lead story, a card
 *  per other post, newest first. */
export function homeSection(cards: BlogCard[], o: HomeOpts): string {
  const w = wordsOf(o.language);
  const list = o.tag ? cards.filter((c) => c.tags.includes(o.tag!)) : cards;
  const co: CardOpts = { withState: o.withState, currentId: o.currentId, origin: o.origin };
  const topics = o.topics.length
    ? `<nav class="apx-topics"><div class="apx-wrap"><a href="${homePath(o.store)}"${o.tag ? "" : ' class="apx-on"'}>${esc(w.all)}</a>${o.topics.map((t) => `<a href="${tagPath(o.store, t)}"${o.tag === t ? ' class="apx-on"' : ""}>${esc(t)}</a>`).join("")}</div></nav>`
    : "";
  const crumbs = `<nav class="apx-crumbs"><a href="/${o.store}/">${esc(w.shopHome)}</a><span>/</span>${o.tag ? `<a href="${homePath(o.store)}">${esc(w.home)}</a><span>/</span>${esc(o.tag)}` : esc(w.home)}</nav>`;
  // the lead story: the newest post with a picture, else the newest with a lead, else the newest
  const leadAt = Math.max(0, [(c: BlogCard) => !!c.hero.url, (c: BlogCard) => !!c.excerpt.trim()].map((f) => list.findIndex(f)).find((i) => i >= 0) ?? 0);
  const first = list[leadAt];
  const rest = list.filter((_, i) => i !== leadAt);
  const lead = first ? featureHtml(first, co) : o.withState ? slotHtml(true) : `<p class="apx-empty">…</p>`;
  // the grid's free places, for the team: the row filled up, at least one
  const free = o.withState ? (rest.length % 3 === 0 ? (rest.length ? 0 : 3) : 3 - (rest.length % 3)) : 0;
  const grid = rest.length || free
    ? `<h2 class="apx-h-sec">${esc(w.more)}</h2><div class="apx-cards">${rest.map((c) => cardHtml(c, co)).join("\n")}${Array.from({ length: free }, () => slotHtml()).join("")}</div>`
    : "";
  return `<section class="apx-blog apx-home" lang="${langOf(o.store)}">
<header class="apx-band"><div class="apx-wrap">${crumbs}<span class="apx-rule"></span><h1>${esc(o.tag ?? w.home)}</h1><p>${esc(o.tag ? `${w.topics}: ${o.tag}` : w.lead)}</p></div></header>
${topics}
<div class="apx-wrap">
${lead}
${grid}
</div>
${newsletterBand(o.store, o.language)}
</section>`;
}

export function homeDocument(cards: BlogCard[], o: HomeOpts): string {
  return page(langOf(o.store), o.tag ?? "Blog", homeSection(cards, { ...o, withState: o.withState ?? true, origin: undefined }), o.language);
}

/* ── Google ───────────────────────────────────────────────────────────── */

/** Cut at a word, as Google does, with its ellipsis. */
export function cut(s: string, max: number): { text: string; cut: boolean } {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return { text: t, cut: false };
  return { text: `${t.slice(0, max).replace(/\s+\S*$/, "").replace(/[,;:.\-–]$/, "")} …`, cut: true };
}

export function serp(d: BlogDoc): { title: string; titleCut: boolean; crumbs: string; description: string; descriptionCut: boolean; fromText: boolean } {
  const t = cut(d.metaTitle.trim() || d.title, LIMITS.metaTitle);
  const fromText = !d.metaDescription.trim();
  const desc = cut(d.metaDescription.trim() || d.excerpt || (d.sections[0]?.body ?? "").replace(/[#*=>|`_[\]()-]/g, " "), LIMITS.metaDescription + 3);
  return {
    title: t.text, titleCut: t.cut, crumbs: `www.apsoparts.com › ${d.store} › blog › ${d.slug || slugify(d.title)}`,
    description: desc.text, descriptionCut: desc.cut, fromText,
  };
}

/** The post's structured data: an Article, and its questions as a FAQPage. Only what the post says. */
export function jsonLd(d: BlogDoc, origin?: string): Record<string, unknown>[] {
  const url = `${SHOP}${postPath(d)}`;
  const img = d.hero.url ? (d.hero.url.startsWith("/api/") && origin ? `${origin.replace(/\/+$/, "")}${d.hero.url}` : d.hero.url.startsWith("/") ? `${SHOP}${d.hero.url}` : d.hero.url) : "";
  const article: Record<string, unknown> = {
    "@context": "https://schema.org", "@type": "Article",
    headline: d.title.slice(0, 110),
    ...(d.metaDescription || d.excerpt ? { description: d.metaDescription || d.excerpt } : {}),
    ...(img ? { image: [img] } : {}),
    author: d.author.trim() ? { "@type": "Person", name: d.author.trim() } : { "@type": "Organization", name: "APSOparts" },
    publisher: { "@type": "Organization", name: "APSOparts", url: SHOP },
    ...(d.publishAt ? { datePublished: d.publishAt } : {}),
    inLanguage: d.store,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    ...(d.tags.length ? { keywords: d.tags.join(", ") } : {}),
  };
  const qs = d.faq.filter((f) => f.q.trim() && f.a.trim());
  if (!qs.length) return [article];
  return [article, {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: qs.map((f) => ({ "@type": "Question", name: f.q.trim(), acceptedAnswer: { "@type": "Answer", text: f.a.trim() } })),
  }];
}

export const jsonLdScript = (d: BlogDoc, origin?: string) => { const ld = jsonLd(d, origin); return `<script type="application/ld+json">${JSON.stringify(ld.length === 1 ? ld[0] : ld).split("<").join("\\u003c")}</script>`; };

/* ── for Magento ──────────────────────────────────────────────────────── */

export type PasteBlock = { key: string; label: string; steps: string[]; code: string };

/** Every picture of the post that lives in the hub (to be put on the shop before it goes live). */
export function hubPictures(d: BlogDoc): string[] {
  return [d.hero.url, ...d.sections.map((s) => s.image.url)].filter((u) => u && inHub(u));
}

export function pastePost(d: BlogDoc, o: PostOpts = {}): PasteBlock[] {
  const key = `blog/${d.slug || slugify(d.title)}`;
  return [
    {
      key: "post-fields", label: "The post's page",
      steps: ["Content > Pages > Add New Page.", `Store View: ${d.store}. Copy each value into its field.`],
      code: [`Page Title: ${d.title}`, `URL Key: ${key}`, `Meta Title: ${d.metaTitle || d.title}`, `Meta Description: ${d.metaDescription}`].join("\n"),
    },
    {
      key: "post-content", label: "The post's content",
      steps: ["In Content, drag one HTML Code element (Elements) onto the stage.", "Paste this into it and Save. Leave the page disabled until it is read on the shop."],
      code: `<style>\n${BLOG_CSS}\n</style>\n${postArticle(d, { ...o, withState: false, edit: undefined })}\n${jsonLdScript(d, o.origin)}`,
    },
  ];
}

export function pasteHome(cards: BlogCard[], o: HomeOpts): PasteBlock {
  return {
    key: "home", label: "The blog's home",
    steps: [
      `Content > Pages: open the page with URL Key "blog" (store view ${o.store}); the first time, Add New Page with that key and the title "Blog".`,
      "Replace its HTML Code element's content with this, and Save.",
    ],
    code: `<style>\n${BLOG_CSS}\n</style>\n${homeSection(cards, { ...o, withState: false })}`,
  };
}

export function pasteTopic(cards: BlogCard[], o: HomeOpts, tag: string): PasteBlock {
  return {
    key: `tag-${slugify(tag)}`, label: `Topic page: ${tag}`,
    steps: [`Content > Pages: the page with URL Key "blog/tag/${slugify(tag)}" (store view ${o.store}) - add it the first time, title "${tag}".`, "Its HTML Code element holds this."],
    code: `<style>\n${BLOG_CSS}\n</style>\n${homeSection(cards, { ...o, tag, withState: false })}`,
  };
}
