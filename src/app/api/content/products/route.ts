// THE SHOP'S PRODUCTS AS PICTURES (Content v7, 10.11.2026; SARCLA point 11: "on pictures we should have all of our products
// as well") - lib/content/productPictures.ts. The picture panel's "Products" source, in every studio.
//   GET ?q=<words or numbers>&store=<de-CH>     the products the shop's own search finds (or the numbers' products)
//   GET ?category=<the shop's address>&store=   a category's products and subcategories
//   GET ?tree=1&store=                          the shop's technologies and their categories, to browse by
// Read only: nothing is written anywhere; the shop is read at a person's pace through the hub's page reader.

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { categoryProducts, findProducts, productTree } from "@/lib/content/productPictures";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } });
const ok = (body: Record<string, unknown>) => NextResponse.json({ ok: true, ...body }, { headers: { "Cache-Control": "private, max-age=300" } });

export async function GET(req: NextRequest) {
  await requireUser();
  const sp = req.nextUrl.searchParams;
  const store = sp.get("store") ?? "de-CH";
  try {
    if (sp.get("tree")) return ok({ tree: await productTree(store) });
    const category = sp.get("category");
    if (category) {
      if (!/^https:\/\/www\.apsoparts\.com\/[^\s"'<>]+\.html$/i.test(category)) return fail("That is not a category of the shop.");
      return ok(await categoryProducts(category, store));
    }
    const q = sp.get("q") ?? "";
    return ok(await findProducts(q, store));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return fail(/sandbox/i.test(msg) ? "This hub does not reach the shop - the products cannot be read here." : msg, 502);
  }
}
