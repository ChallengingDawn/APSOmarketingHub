// APSOconvert > Problem pages > SEO pages: the shop's pages as Google shows them (src/lib/convert/seo.ts), for the
// reporting window - one Search Console read per window at a time, kept ten minutes.
import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { buildSeo, type SeoData } from "@/lib/convert/seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const TTL_MS = 10 * 60_000;
const cache: Map<string, { at: number; p: Promise<SeoData> }> =
  ((globalThis as { __convertSeo?: Map<string, { at: number; p: Promise<SeoData> }> }).__convertSeo ??= new Map());

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("website")) return NextResponse.json({ error: "No access" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from") ?? "", to = sp.get("to") ?? "";
  if (!ISO.test(from) || !ISO.test(to) || from > to) return NextResponse.json({ configured: true, ok: false, error: "from and to must be YYYY-MM-DD, from first.", status: 400 });
  const key = `${from}:${to}`;
  let hit = cache.get(key);
  if (!hit || Date.now() - hit.at > TTL_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 40_000);
    const p = buildSeo(from, to, controller.signal).finally(() => clearTimeout(timer)).then((d) => { if (d.error) cache.delete(key); return d; });
    hit = { at: Date.now(), p };
    cache.set(key, hit);
    if (cache.size > 30) for (const [k, v] of cache) if (Date.now() - v.at > TTL_MS) cache.delete(k);
  }
  try {
    return NextResponse.json({ configured: true, ok: true, data: await hit.p });
  } catch (e) {
    cache.delete(key);
    return NextResponse.json({ configured: true, ok: false, error: String((e as Error)?.message ?? e) });
  }
}
