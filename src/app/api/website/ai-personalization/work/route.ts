// APSOconvert > PREVIEW, the work on one page (src/lib/convert/studio.ts). GET ?env&path = the page (title, its outline as the AI sees it),
// its ideas and versions; GET ?revisions=<version id> = that version's revisions. POST {action, ...} changes them -
// the preview's write level. The AI's actions take up to a minute: their answer is streamed, a space every few seconds
// until the JSON, so no proxy on the way closes the line (JSON.parse reads past leading spaces).
import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { getOptionalUser } from "@/lib/auth/guard";
import { isEnv } from "@/lib/convert/model";
import { blockByKey } from "@/lib/convert/blocks";
import { proposeBlocks } from "@/lib/convert/blockIdeas";
import {
  addIdea, cleanDrawn, cleanPath, editVersion, markSent, pageOutline, pageWork, proposeIdeas, revisions, setIdeaStatus, setVersionStatus, shopPage, versionFromChanges, writeVersion,
  type IdeaStatus, type Numbers,
} from "@/lib/convert/studio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PAGE = "/website/ai-personalization/preview";

const fail = (error: string, status = 200) => NextResponse.json({ configured: true, ok: false, error }, { status });

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("website")) return NextResponse.json({ error: "No access" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  try {
    const rv = sp.get("revisions");
    if (rv) {
      if (!/^\d{1,12}$/.test(rv)) return fail("bad version id", 400);
      return NextResponse.json({ configured: true, ok: true, data: { revisions: await revisions(rv) } });
    }
    const env = sp.get("env");
    const path = cleanPath(sp.get("path"));
    if (!isEnv(env) || !path) return fail("env must be prod or acc, and path a shop page", 400);
    const [page, work] = await Promise.all([shopPage(env, path, sp.get("fresh") === "1").catch((e: Error) => e), pageWork(env, path)]);
    const read = page instanceof Error
      ? { status: 0, error: page.message, title: "", h1: [] as string[], description: "", lines: [] as string[], truncated: false, kind: null, product: null, url: null }
      : (() => {
          const o = page.status === 200 ? pageOutline(page) : null;
          return { status: page.status, error: null, title: o?.title ?? "", h1: o?.h1 ?? [], description: o?.description ?? "", lines: o?.lines ?? [], truncated: o?.truncated ?? false, kind: page.kind, product: page.product, url: page.url };
        })();
    return NextResponse.json({
      configured: true,
      ok: true,
      data: { env, path, page: read, ...work, canEdit: access.levelAt(PAGE) === "write", canContent: access.canOpen("marketing"), ai: Boolean(process.env.ANTHROPIC_API_KEY) },
    });
  } catch (e) {
    return fail(String((e as Error)?.message ?? e));
  }
}

/** A slow answer kept alive: a space every 8 s, then the JSON. */
function slow(work: () => Promise<unknown>): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const beat = setInterval(() => { try { ctrl.enqueue(enc.encode(" ")); } catch { /* the reader left */ } }, 8000);
      let out: unknown;
      try { out = await work(); } catch (e) { out = { ok: false, error: String((e as Error)?.message ?? e) }; }
      clearInterval(beat);
      try { ctrl.enqueue(enc.encode(JSON.stringify(out))); ctrl.close(); } catch { /* the reader left - the work is saved anyway */ }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function numbersOf(v: unknown): Numbers | null {
  if (!v || typeof v !== "object") return null;
  const n = v as Record<string, unknown>;
  const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : null);
  return {
    views: num(n.views), addToCarts: num(n.addToCarts), rate: num(n.rate), typical: num(n.typical),
    reasons: Array.isArray(n.reasons) ? n.reasons.filter((r): r is string => typeof r === "string").slice(0, 4).map((r) => r.slice(0, 300)) : [],
    companies: num(n.companies), lost: num(n.lost), topLoss: typeof n.topLoss === "string" ? n.topLoss.slice(0, 40) : null,
    from: typeof n.from === "string" ? n.from.slice(0, 10) : undefined, to: typeof n.to === "string" ? n.to.slice(0, 10) : undefined,
  };
}

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.levelAt(PAGE) !== "write") return fail("Changing optimizations and versions needs the Preview's write access.", 403);
  const user = await getOptionalUser();
  const by = user?.full_name || user?.username || "someone";
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = (k: string) => (typeof b[k] === "string" && /^\d{1,12}$/.test(b[k] as string) ? (b[k] as string) : null);
  try {
    switch (b.action) {
      case "diag": {
        // the preview frame's own report (how many of the shop's stylesheets it could draw), for the log only
        const total = Number(b.total) || 0, failed = Number(b.nfailed) || 0;
        const first = Array.isArray(b.failed) ? String(b.failed[0] ?? "").slice(0, 160) : "";
        console.log(`[convert] preview styles ${total - failed}/${total} drawn for ${by}${failed ? ` - first refused: ${first}` : ""} (${String(req.headers.get("user-agent") ?? "").slice(0, 120)})`);
        return NextResponse.json({ ok: true, data: null });
      }
      case "ideas": {
        const path = cleanPath(b.path);
        if (!isEnv(b.env) || !path) return fail("env and path, please", 400);
        const env = b.env;
        const drawn = cleanDrawn(b.drawn);
        // a block of the shop (the newsletter band, the home slider...): the AI looks at that block only
        const blk = typeof b.block === "string" ? blockByKey(b.block) : null;
        // from Google's view of the pages (Insights > SEO landing page): new landing pages for its searches
        const landing = b.landing === true && !blk;
        // new landing pages stay the AI's page-wide proposals; everything else is per block (SARCLA 10.11.2026: "we
        // cannot say where it is" -> ONE block, its versions modules that replace it - lib/convert/blockIdeas.ts)
        if (landing) return slow(() => proposeIdeas(env, path, numbersOf(b.numbers), by, drawn, null, true));
        return slow(() => proposeBlocks(env, path, numbersOf(b.numbers), by, blk ? { key: blk.key, name: blk.name, selector: blk.selector, about: blk.about, goal: blk.goal, focus: blk.focus } : null));
      }
      case "add": {
        const path = cleanPath(b.path);
        const title = text(b.title, 200);
        if (!isEnv(b.env) || !path || !title) return fail("a page and a title, please", 400);
        const idea = await addIdea(b.env, path, { title, why: text(b.why, 1500), change: text(b.change, 2000), expect: text(b.expect, 600) }, by, "person", numbersOf(b.numbers));
        return NextResponse.json({ ok: true, data: idea });
      }
      case "idea": {
        const ideaId = id("id");
        const status = b.status as IdeaStatus;
        if (!ideaId || !["proposed", "approved", "dropped"].includes(status)) return fail("id and status, please", 400);
        const idea = await setIdeaStatus(ideaId, status, by);
        return idea ? NextResponse.json({ ok: true, data: idea }) : fail("No such optimization.", 404);
      }
      case "build": {
        const ideaId = id("ideaId");
        if (!ideaId) return fail("Which optimization?", 400);
        const request = text(b.request, 1500) || null;
        const drawn = cleanDrawn(b.drawn);
        const letter = typeof b.letter === "string" && /^[A-D]$/.test(b.letter) ? b.letter : null;
        return slow(() => writeVersion(ideaId, request, by, drawn, { letter, another: b.another === true }));
      }
      case "edit": {
        const versionId = id("versionId");
        if (!versionId) return fail("versionId, please", 400);
        const r = await editVersion(versionId, b.changes, by);
        return r.version ? NextResponse.json({ ok: true, data: r }) : fail(r.problems.join("; "));
      }
      case "version": {
        // the Page builder's own changes as a version (no AI) - {env, path, changes, title?, summary?, piece?}; then
        // "approve" and a test (Website > A/B testing > Page tests: create, start)
        const path = cleanPath(b.path);
        if (!isEnv(b.env) || !path) return fail("env and path, please", 400);
        const piece = typeof b.piece === "number" && Number.isInteger(b.piece) && b.piece > 0 ? String(b.piece) : id("piece");
        const r = await versionFromChanges(b.env, path, { changes: b.changes, title: text(b.title, 200), summary: text(b.summary, 600), piece }, by);
        if (r.version) console.log(`[convert] version ${r.version.id} rev ${r.version.rev} from the Page builder${piece ? ` (piece ${piece})` : ""} on ${b.env}${path} by ${by}`);
        return r.version ? NextResponse.json({ ok: true, data: r }) : fail(r.problems.join("; "));
      }
      case "approve":
      case "reopen": {
        const versionId = id("versionId");
        if (!versionId) return fail("versionId, please", 400);
        const v = await setVersionStatus(versionId, b.action === "approve" ? "approved" : "draft", by);
        return v ? NextResponse.json({ ok: true, data: v }) : fail("no such version", 404);
      }
      case "sent": {
        // the optimization went to a Content project (made by the page through Content's own API): it and its versions
        // are approved by the send, and the project is kept with it
        const ideaId = id("ideaId");
        if (!ideaId) return fail("Which optimization?", 400);
        const project = typeof b.projectId === "number" || typeof b.projectId === "string" ? String(b.projectId) : null;
        const r = await markSent(ideaId, project && /^\d{1,12}$/.test(project) ? project : null, by);
        return r ? NextResponse.json({ ok: true, data: r }) : fail("No such optimization (or it was dropped).", 404);
      }
      default:
        return fail("unknown action", 400);
    }
  } catch (e) {
    return fail(String((e as Error)?.message ?? e));
  }
}
