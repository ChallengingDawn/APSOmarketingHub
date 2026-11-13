// APSOconvert > Pages: the shop's pages on production and ACC (src/lib/convert/pages.ts). GET the list (filters, a page
// of 50) with the summary and each environment's last read; GET ?published=1 the pages the hub itself published; POST {env} reads that environment's sitemaps again - in the
// background, the page asks again until the read has finished. Reading needs the page's write level.
import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { getOptionalUser } from "@/lib/auth/guard";
import { isEnv, isKind } from "@/lib/convert/model";
import { hubPublished, isWhere, lastReads, listPages, pagesSummary, readShop } from "@/lib/convert/pages";
import { optimizationsOn } from "@/lib/convert/studio";
import { testsOfPages } from "@/lib/convert/tests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE = "/website/ai-personalization/pages";
const PER_PAGE = 50;

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("website")) return NextResponse.json({ error: "No access" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const kind = sp.get("kind");
  const where = sp.get("where") ?? "all";
  const store = sp.get("store");
  const page = Math.max(0, Math.min(10_000, Number.parseInt(sp.get("page") ?? "0", 10) || 0));
  try {
    // ?published=1: the pages the hub itself put on the shop (Content's Page builder), with their optimizations
    if (sp.get("published") === "1") {
      const pages = await hubPublished();
      const [prodWork, accWork, tests] = await Promise.all([
        optimizationsOn("prod", pages.filter((p) => p.env === "prod").map((p) => p.path)).catch(() => ({})),
        optimizationsOn("acc", pages.filter((p) => p.env === "acc").map((p) => p.path)).catch(() => ({})),
        testsOfPages(pages).catch(() => ({})),
      ]);
      return NextResponse.json({ configured: true, ok: true, data: { pages, work: { prod: prodWork, acc: accWork }, tests } });
    }
    const [reads, summary, list] = await Promise.all([
      lastReads(),
      pagesSummary(),
      listPages({
        kind: isKind(kind) ? kind : null,
        store: store && /^[a-z]{2}-[A-Z]{2,3}(\/[a-z]{3})?$/.test(store) ? store : null,
        where: isWhere(where) ? where : "all",
        q: sp.get("q") ?? "",
        page,
        perPage: PER_PAGE,
      }),
    ]);
    // each listed page's optimizations (its production address), for the row's chip
    const paths = list.rows.map((r) => { try { return new URL((r.prod ?? r.acc)!.url).pathname; } catch { return ""; } }).filter(Boolean);
    const work = await optimizationsOn("prod", paths).catch(() => ({}));
    return NextResponse.json({ configured: true, ok: true, data: { reads, summary, list, work, canRead: access.levelAt(PAGE) === "write" } });
  } catch (e) {
    return NextResponse.json({ configured: true, ok: false, error: String((e as Error)?.message ?? e) }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.levelAt(PAGE) !== "write") return NextResponse.json({ ok: false, error: "Reading the shop again needs the Pages write access." }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { env?: unknown };
  if (!isEnv(body.env)) return NextResponse.json({ ok: false, error: "env must be prod or acc." }, { status: 400 });
  const user = await getOptionalUser();
  const env = body.env;
  // in the background: a read takes half a minute or more; the page asks again until it has finished
  void readShop(env, user?.full_name || user?.username || "someone").then((r) => {
    if (r === null) console.log(`[convert] ${env} read asked while one was running - skipped`);
  }).catch((e) => console.warn(`[convert] ${env} read failed: ${(e as Error).message}`));
  return NextResponse.json({ ok: true, started: true });
}
