// APSOconvert > Problem pages > Blocks: the shop's blocks (src/lib/convert/blocks.ts) and what can be counted for them
// in the window - the newsletter band's sign-ups from HubSpot (src/lib/convert/blocksRead.ts), kept ten minutes.
import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { SHOP_BLOCKS } from "@/lib/convert/blocks";
import { newsletterSignups, type Signups } from "@/lib/convert/blocksRead";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const TTL_MS = 10 * 60_000;
const cache: Map<string, { at: number; p: Promise<Signups> }> =
  ((globalThis as { __convertBlocks?: Map<string, { at: number; p: Promise<Signups> }> }).__convertBlocks ??= new Map());

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
    const p = newsletterSignups(from, to, controller.signal).finally(() => clearTimeout(timer)).then((d) => { if (d.error) cache.delete(key); return d; });
    hit = { at: Date.now(), p };
    cache.set(key, hit);
    if (cache.size > 30) for (const [k, v] of cache) if (Date.now() - v.at > TTL_MS) cache.delete(k);
  }
  return NextResponse.json({ configured: true, ok: true, data: { blocks: SHOP_BLOCKS, signups: await hit.p } });
}
