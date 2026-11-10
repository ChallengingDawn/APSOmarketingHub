// A BANNER IN ITS PAGES (08.11.2026; SARCLA: "the banner design: we should be able to push it inside a page visually").
//   GET                 the project's page to-dos, with where this banner sits in each (the "Put it in a page" card)
//   GET ?page=<id>      that page as a picture with every banner it carries in its place: the shop's page read through
//                       the page studio's own reader (APSOconvert's shopPage, kept ten minutes, the shop read at a person's
//                       pace), its stored changes laid over it, each banner's markup and styles added where its insert
//                       says - then the banners' own motion script, so the word changes in the frame as on the shop.
// A GET, so a reviewer who only comments sees it too. Built from the stored documents, never from a body (8 KB limit).
// The page studio owns the page and shows its inserts in its own preview; this is the banner studio's look at it.
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { accessFor } from "@/lib/content/sharing";
import { getPiece } from "@/lib/content/workflow";
import { studioKindOf } from "@/lib/content/studio/kinds";
import { readDoc } from "@/lib/content/studio/store";
import { hubOriginOf } from "@/lib/convert/assets";
import { pageDoc } from "@/lib/content/studio/kinds/page/model";
import { previewOf } from "@/lib/content/studio/kinds/page/shop";
import { normalizeBanner } from "@/lib/content/studio/kinds/banner/model";
import { anchorOf, insertsOf, placeOf } from "@/lib/content/studio/kinds/banner/place";
import { pageParts, prefixFor } from "@/lib/content/studio/kinds/banner/render";
import { pageRows } from "@/lib/content/studio/kinds/banner/server";
import { bannerOn, hubPicturesAbsolute, moduleIdFor } from "@/lib/content/studio/kinds/banner/topage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

/** The frame's own script: its height and where this banner sits, told to the studio; links stay put. */
const TELL = (mine: string[]) => `<script>(function(){var M=${JSON.stringify(mine)};
function tell(){var b=document.body,h=Math.max(b?b.scrollHeight:0,document.documentElement.scrollHeight),t=-1;
for(var i=0;i<M.length;i++){var el=document.querySelector("."+M[i]);if(el){var r=el.getBoundingClientRect();t=r.top+scrollY;break;}}
parent.postMessage({apsoInPage:"size",h:h,top:t},"*");}
addEventListener("load",tell);setTimeout(tell,400);setTimeout(tell,1500);if("ResizeObserver"in window&&document.body)new ResizeObserver(tell).observe(document.body);
document.addEventListener("click",function(e){if(e.target.closest&&e.target.closest("a"))e.preventDefault();},true);})();</script>`;

export async function GET(req: NextRequest, c: { params: Promise<{ pieceId: string }> }) {
  const me = await requireUser();
  const pieceId = Number.parseInt((await c.params).pieceId, 10);
  const banner = Number.isFinite(pieceId) && pieceId > 0 ? await getPiece(pieceId) : null;
  if (!banner || studioKindOf(banner.contentType) !== "banner" || !(await accessFor(banner.projectId, me))) return fail("No such banner.", 404);
  const pageId = Number.parseInt(req.nextUrl.searchParams.get("page") ?? "", 10);
  if (!Number.isFinite(pageId)) return NextResponse.json({ ok: true, pages: await pageRows(banner.projectId, banner.id) }, { headers: { "Cache-Control": "no-store" } });

  const page = pageId > 0 ? await getPiece(pageId) : null;
  if (!page || page.projectId !== banner.projectId || studioKindOf(page.contentType) !== "page") return fail("That page to-do is not in this project.", 404);
  const raw = (await readDoc(page.id))?.doc ?? null;
  const d = pageDoc(raw, page.language);
  const hub = hubOriginOf(req.headers, req.nextUrl.origin);

  // every banner the page carries, as the page studio's changes; a banner since removed is left out, and said
  const extra: unknown[] = [];
  const scripts: string[] = [];
  const mine: string[] = [];
  const notes: string[] = [];
  for (const ins of insertsOf(raw)) {
    const stored = await readDoc(ins.pieceId);
    if (!stored || stored.kind !== "banner") { notes.push("A banner this page held was removed - it is left out."); continue; }
    const other = ins.pieceId === banner.id ? banner : await getPiece(ins.pieceId);
    if (!other || (other.projectId !== banner.projectId && !(await accessFor(other.projectId, me)))) continue;
    const prefix = prefixFor(ins.pieceId);
    const parts = pageParts(normalizeBanner(stored.doc), placeOf(ins), prefix, { origin: hub });
    const at = anchorOf(ins.where, d.source === "new");
    extra.push({ op: "css", css: parts.css, note: "A banner's styles" }, { op: "insert", selector: at.selector, where: at.where, html: parts.html, note: "A banner" });
    if (parts.script && !scripts.includes(parts.script)) scripts.push(parts.script);
    if (ins.pieceId === banner.id) mine.push(prefix);
  }
  // the page studio renders `inserts` itself; here they arrive as plain changes, so nothing is drawn twice
  const doc = { ...(raw && typeof raw === "object" ? raw : {}), inserts: [], changes: [...d.changes, ...extra] };
  const out = await previewOf(doc, "after", req.nextUrl.searchParams.get("fresh") === "1");
  if (!out.ok) return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
  // the banner put on the page as a module (Content v7, "Put it on a page"): scrolled to, its pictures read from the hub
  if (bannerOn(d.changes, banner.id)) mine.push(`apx-${moduleIdFor(banner.id)}`);
  const tail = `${scripts.join("\n")}${TELL([...new Set(mine)])}`;
  const drawn = hubPicturesAbsolute(out.html, hub);
  const html = /<\/body\s*>/i.test(drawn) ? drawn.replace(/<\/body\s*>(?![\s\S]*<\/body\s*>)/i, `${tail}</body>`) : `${drawn}${tail}`;
  const missing = out.hits.filter((h) => d.changes.length <= h.index && h.state === "missing").length;
  if (missing) notes.push("A banner's spot was not found on this page - it shows nowhere; pick another spot.");
  return NextResponse.json({
    ok: true, html, url: out.url, notes: [...new Set([...notes, ...out.notes])],
    page: { id: page.id, title: page.title, isNew: d.source === "new", path: d.path },
  }, { headers: { "Cache-Control": "no-store" } });
}
