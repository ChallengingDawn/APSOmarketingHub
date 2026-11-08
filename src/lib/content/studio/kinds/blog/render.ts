// BLOG POST - THE POST, THE BLOG'S HOME AND A TOPIC PAGE AS THE SHOP WOULD SHOW THEM (08.11.2026). Pure: tested.
//
// One stylesheet, scoped to .apx-blog, in the shop's look: futura-pt (Jost and the system's geometric faces after it),
// ink #1d2326, petrol #274e64 for links and headings' accents, red #d80901 only on key words (==word== in the text) and
// the small topic line, generous white space. The same HTML goes to the preview and into the paste for Magento - the
// preview only adds a quiet strip above it and keeps links from leaving the frame.

import {
  LIMITS, SHOP, homePath, postPath, readingMinutes, slugify, tagPath, wordsOf,
  type BlogCard, type BlogDoc,
} from "./model";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** An address a post may link to: the web, the shop's own paths, an anchor, a mail. */
function safeUrl(raw: string): string | null {
  const u = raw.replace(/&amp;/g, "&").trim();
  return /^(https?:\/\/|\/(?!\/)|#|mailto:)/i.test(u) ? esc(u) : null;
}

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

/** A section's markdown as HTML: sub-headings (h3/h4 - the section's own heading is the h2), lists, tables, quotes. */
export function md(src: string): string {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const h = /^\s*(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (h) { const tag = h[1].length >= 4 ? "h4" : "h3"; out.push(`<${tag}>${inline(h[2])}</${tag}>`); i++; continue; }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { out.push("<hr>"); i++; continue; }
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(cells(lines[i++]));
      out.push(`<div class="apx-table"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${head.map((_, k) => `<td>${inline(r[k] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
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
      out.push(`<${tag}>${items.map((x) => `<li>${inline(x)}</li>`).join("")}</${tag}>`);
      continue;
    }
    if (/^\s*>/.test(line)) {
      const q: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, ""));
      out.push(`<blockquote><p>${inline(q.join(" "))}</p></blockquote>`);
      continue;
    }
    const p: string[] = [];
    while (i < lines.length && lines[i].trim() && !(p.length && BLOCK.test(lines[i]))) p.push(lines[i++].trim());
    out.push(`<p>${p.map(inline).join("<br>")}</p>`);
  }
  return out.join("\n");
}

/* ── the look ─────────────────────────────────────────────────────────── */

export const BLOG_CSS = `.apx-blog{--ink:#1d2326;--petrol:#274e64;--red:#d80901;--muted:#6b7479;--line:#e3e7e9;font-family:futura-pt,Jost,"Century Gothic","Avenir Next",Avenir,system-ui,sans-serif;color:var(--ink);font-size:18px;line-height:1.65;-webkit-font-smoothing:antialiased}
.apx-blog *{box-sizing:border-box}
.apx-post{max-width:760px;margin:0 auto;padding:40px 20px 80px}
.apx-blog .apx-crumbs{font-size:14px;color:var(--muted);margin:0 0 40px}
.apx-blog .apx-crumbs a{color:var(--petrol);text-decoration:none}
.apx-blog .apx-crumbs span{margin:0 8px}
.apx-blog .apx-eyebrow{display:block;color:var(--red);font-size:13px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;margin:0 0 12px}
.apx-blog h1{font-size:46px;line-height:1.1;font-weight:500;letter-spacing:-.015em;margin:0 0 20px}
.apx-blog .apx-meta{color:var(--muted);font-size:14px;margin:0}
.apx-blog .apx-hero{margin:40px 0 0}
.apx-blog .apx-hero img{display:block;width:100%;height:auto;border-radius:4px;background:#f2f4f5}
.apx-blog .apx-lead{font-size:22px;line-height:1.5;color:#3c464b;margin:40px 0 8px}
.apx-blog h2{font-size:30px;line-height:1.2;font-weight:500;letter-spacing:-.01em;margin:56px 0 16px}
.apx-blog h3{font-size:22px;line-height:1.3;font-weight:600;margin:36px 0 10px}
.apx-blog h4{font-size:18px;font-weight:600;margin:28px 0 8px}
.apx-blog p{margin:0 0 18px}
.apx-blog ul,.apx-blog ol{margin:0 0 20px;padding-left:24px}
.apx-blog li{margin:0 0 8px}
.apx-blog a{color:var(--petrol);text-underline-offset:3px}
.apx-blog mark{background:none;color:var(--red);font-weight:600}
.apx-blog code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.88em;background:#f2f4f5;padding:1px 5px;border-radius:3px}
.apx-blog blockquote{margin:28px 0;padding:4px 0 4px 22px;border-left:3px solid var(--petrol);color:#3c464b;font-size:20px}
.apx-blog hr{border:0;border-top:1px solid var(--line);margin:40px 0}
.apx-blog .apx-table{overflow-x:auto;margin:0 0 24px}
.apx-blog table{border-collapse:collapse;width:100%;font-size:16px}
.apx-blog th,.apx-blog td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:top}
.apx-blog th{color:var(--petrol);font-weight:600;border-bottom:2px solid var(--petrol)}
.apx-blog .apx-faq details{border-top:1px solid var(--line);padding:18px 0}
.apx-blog .apx-faq details:last-child{border-bottom:1px solid var(--line)}
.apx-blog .apx-faq summary{cursor:pointer;font-weight:600;font-size:19px;list-style:none}
.apx-blog .apx-faq summary::-webkit-details-marker{display:none}
.apx-blog .apx-faq summary:after{content:"+";float:right;color:var(--petrol);font-weight:400}
.apx-blog .apx-faq details[open] summary:after{content:"\\2212"}
.apx-blog .apx-faq details>div{padding-top:10px;color:#3c464b}
.apx-blog .apx-related ul{list-style:none;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
.apx-blog .apx-related li{margin:0}
.apx-blog .apx-related a{display:block;padding:16px 18px;border:1px solid var(--line);border-radius:4px;text-decoration:none;font-weight:600;color:var(--petrol)}
.apx-blog .apx-tags{margin:48px 0 0}
.apx-blog .apx-tags a,.apx-blog .apx-topics a{display:inline-block;margin:0 8px 8px 0;padding:5px 14px;border:1px solid #d5dbde;border-radius:999px;font-size:14px;color:var(--petrol);text-decoration:none}
.apx-blog .apx-topics a.apx-on{background:var(--petrol);border-color:var(--petrol);color:#fff}
.apx-blog .apx-back{margin:40px 0 0;font-size:15px}
.apx-home{max-width:1180px;margin:0 auto;padding:48px 20px 88px}
.apx-home h1{margin-bottom:28px}
.apx-home .apx-topics{margin:0 0 40px}
.apx-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:40px 32px}
.apx-card{display:flex;flex-direction:column;text-decoration:none;color:var(--ink)}
.apx-card .apx-img{display:block;aspect-ratio:16/9;background:#f2f4f5;border-radius:4px;overflow:hidden;margin:0 0 18px}
.apx-card .apx-img img{width:100%;height:100%;object-fit:cover;display:block}
.apx-card .apx-rule{display:block;height:3px;width:48px;background:var(--petrol);margin:0 0 18px}
.apx-card .apx-card-title{font-size:23px;line-height:1.25;font-weight:500;color:var(--ink);margin:0 0 10px}
.apx-card .apx-card-text{font-size:16px;line-height:1.55;color:#3c464b;margin:0 0 12px}
.apx-card .apx-meta{margin-top:auto}
.apx-card .apx-state{display:inline-block;font-size:12px;font-weight:600;color:#7a5a00;background:#fff1b8;border-radius:4px;padding:1px 8px;margin:0 0 10px;align-self:flex-start}
.apx-empty{color:var(--muted);font-size:17px}
@media (max-width:767px){.apx-blog{font-size:17px}.apx-post,.apx-home{padding:28px 16px 56px}.apx-blog h1{font-size:33px}.apx-blog h2{font-size:25px;margin-top:44px}.apx-blog .apx-lead{font-size:19px}.apx-cards{grid-template-columns:1fr;gap:36px}}`;

/** The preview's own strip and rules: a quiet line above the page, links that stay in the frame. */
const PREVIEW_CSS = `body{margin:0;background:#fff}
.apx-chrome{font:13px/1 system-ui,sans-serif;color:#8a949b;padding:14px 20px;border-bottom:1px solid #eef1f3;letter-spacing:.02em}
a{pointer-events:none}`;

export function fmtDate(iso: string | null, store: string): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat(store, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
  } catch { return iso; }
}

const langOf = (store: string) => store.slice(0, 2).toLowerCase();

/* ── the post ─────────────────────────────────────────────────────────── */

/** The post's page content, as it is pasted: the article with its links to the blog's home and topics. */
export function postArticle(d: BlogDoc): string {
  const w = wordsOf(d.language);
  const meta = [d.author, fmtDate(d.publishAt || null, d.store), `${readingMinutes(d)} ${w.read}`].filter(Boolean).map(esc).join(" · ");
  const hero = d.hero.url && safeUrl(d.hero.url) ? `<figure class="apx-hero"><img src="${safeUrl(d.hero.url)}" alt="${esc(d.hero.alt)}" width="1200" height="675"></figure>` : "";
  const sections = d.sections.map((s) => `<section>${s.heading.trim() ? `<h2 id="${slugify(s.heading)}">${inline(s.heading)}</h2>` : ""}\n${md(s.body)}</section>`).join("\n");
  const faq = d.faq.filter((f) => f.q.trim()).length
    ? `<section class="apx-faq"><h2>${esc(w.faq)}</h2>${d.faq.filter((f) => f.q.trim()).map((f) => `<details><summary>${inline(f.q)}</summary><div>${md(f.a)}</div></details>`).join("")}</section>`
    : "";
  const products = d.relatedProducts.filter((p) => p.name.trim() && safeUrl(p.url));
  const related = products.length ? `<section class="apx-related"><h2>${esc(w.related)}</h2><ul>${products.map((p) => `<li><a href="${safeUrl(p.url)}">${esc(p.name)}</a></li>`).join("")}</ul></section>` : "";
  const tags = d.tags.length ? `<p class="apx-tags">${d.tags.map((t) => `<a href="${tagPath(d.store, t)}">${esc(t)}</a>`).join("")}</p>` : "";
  return `<article class="apx-blog apx-post" lang="${langOf(d.store)}">
<nav class="apx-crumbs"><a href="${homePath(d.store)}">${esc(w.home)}</a><span>›</span>${esc(d.title)}</nav>
${d.tags[0] ? `<span class="apx-eyebrow">${esc(d.tags[0])}</span>` : ""}<h1>${esc(d.title || "…")}</h1>
<p class="apx-meta">${meta}</p>
${hero}
${d.excerpt.trim() ? `<p class="apx-lead">${inline(d.excerpt.trim())}</p>` : ""}
${sections}
${faq}
${related}
${tags}
<p class="apx-back"><a href="${homePath(d.store)}">← ${esc(w.back)}</a></p>
</article>`;
}

const page = (lang: string, title: string, body: string, chrome: string) => `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${BLOG_CSS}\n${PREVIEW_CSS}</style></head><body><div class="apx-chrome">${esc(chrome)}</div>${body}</body></html>`;

/** The post as a whole page, for the preview frame. */
export function postDocument(d: BlogDoc): string {
  return page(langOf(d.store), d.metaTitle || d.title, postArticle(d), `apsoparts.com${postPath(d)}`);
}

/* ── the blog's home and its topics ───────────────────────────────────── */

const STATE: Record<string, string> = { todo: "To do", writing: "Writing", review: "In review", changes: "Changes asked", approved: "Approved" };

function cardHtml(c: BlogCard, withState: boolean): string {
  const lang = c.language || "EN";
  const img = c.hero.url && safeUrl(c.hero.url) ? `<span class="apx-img"><img src="${safeUrl(c.hero.url)}" alt="${esc(c.hero.alt)}" loading="lazy"></span>` : `<span class="apx-rule"></span>`;
  const state = withState && STATE[c.status] ? `<span class="apx-state">${STATE[c.status]}</span>` : "";
  const meta = [fmtDate(c.date, c.store), `${c.minutes} ${wordsOf(lang).read}`].filter(Boolean).join(" · ");
  return `<a class="apx-card" href="/${c.store}/blog/${esc(c.slug)}">${img}${state}${c.tags[0] ? `<span class="apx-eyebrow">${esc(c.tags[0])}</span>` : ""}<span class="apx-card-title">${esc(c.title || "…")}</span>${c.excerpt ? `<span class="apx-card-text">${esc(c.excerpt)}</span>` : ""}<span class="apx-meta">${esc(meta)}</span></a>`;
}

/** The blog's home (or one topic's page): its topics, then a card per post, newest first. */
export function homeSection(cards: BlogCard[], o: { store: string; language: string; topics: string[]; tag?: string | null; withState?: boolean }): string {
  const w = wordsOf(o.language);
  const list = o.tag ? cards.filter((c) => c.tags.includes(o.tag!)) : cards;
  const topics = o.topics.length
    ? `<p class="apx-topics"><a href="${homePath(o.store)}"${o.tag ? "" : ' class="apx-on"'}>${esc(w.all)}</a>${o.topics.map((t) => `<a href="${tagPath(o.store, t)}"${o.tag === t ? ' class="apx-on"' : ""}>${esc(t)}</a>`).join("")}</p>`
    : "";
  const crumbs = o.tag ? `<nav class="apx-crumbs"><a href="${homePath(o.store)}">${esc(w.home)}</a><span>›</span>${esc(o.tag)}</nav>` : "";
  return `<section class="apx-blog apx-home" lang="${langOf(o.store)}">
${crumbs}<h1>${esc(o.tag ?? w.home)}</h1>
${topics}
<div class="apx-cards">${list.map((c) => cardHtml(c, !!o.withState)).join("\n")}</div>
</section>`;
}

export function homeDocument(cards: BlogCard[], o: { store: string; language: string; topics: string[]; tag?: string | null }): string {
  const path = o.tag ? tagPath(o.store, o.tag) : homePath(o.store);
  return page(langOf(o.store), o.tag ?? "Blog", homeSection(cards, { ...o, withState: true }), `apsoparts.com${path}`);
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
export function jsonLd(d: BlogDoc): Record<string, unknown>[] {
  const url = `${SHOP}${postPath(d)}`;
  const article: Record<string, unknown> = {
    "@context": "https://schema.org", "@type": "Article",
    headline: d.title.slice(0, 110),
    ...(d.metaDescription || d.excerpt ? { description: d.metaDescription || d.excerpt } : {}),
    ...(d.hero.url ? { image: [d.hero.url.startsWith("/") ? `${SHOP}${d.hero.url}` : d.hero.url] } : {}),
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

export const jsonLdScript = (d: BlogDoc) => `<script type="application/ld+json">${JSON.stringify(jsonLd(d).length === 1 ? jsonLd(d)[0] : jsonLd(d)).split("<").join("\\u003c")}</script>`;

/* ── for Magento ──────────────────────────────────────────────────────── */

export type PasteBlock = { key: string; label: string; steps: string[]; code: string };

export function pastePost(d: BlogDoc): PasteBlock[] {
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
      code: `<style>\n${BLOG_CSS}\n</style>\n${postArticle(d)}\n${jsonLdScript(d)}`,
    },
  ];
}

export function pasteHome(cards: BlogCard[], o: { store: string; language: string; topics: string[] }): PasteBlock {
  return {
    key: "home", label: "The blog's home",
    steps: [
      `Content > Pages: open the page with URL Key "blog" (store view ${o.store}); the first time, Add New Page with that key and the title "Blog".`,
      "Replace its HTML Code element's content with this, and Save.",
    ],
    code: `<style>\n${BLOG_CSS}\n</style>\n${homeSection(cards, o)}`,
  };
}

export function pasteTopic(cards: BlogCard[], o: { store: string; language: string; topics: string[] }, tag: string): PasteBlock {
  return {
    key: `tag-${slugify(tag)}`, label: `Topic page: ${tag}`,
    steps: [`Content > Pages: the page with URL Key "blog/tag/${slugify(tag)}" (store view ${o.store}) - add it the first time, title "${tag}".`, "Its HTML Code element holds this."],
    code: `<style>\n${BLOG_CSS}\n</style>\n${homeSection(cards, { ...o, tag })}`,
  };
}
