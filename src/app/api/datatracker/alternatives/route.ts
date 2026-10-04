// What we could have offered instead.
//
// A customer who wanted 20 of something we only sell by the hundred, or wanted
// something the shelf was empty of, is a sale we lost for a reason we can answer.
// The shop's search bar already proposes neighbours; this is the same idea with
// the data the hub has: the same sub-group, in stock, and - for the MOQ case -
// something we will actually sell in the quantity they asked for.
//
// Fetched when a row is opened rather than for every row in the table: one
// search per article is cheap once, and ruinous four hundred times.

import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { describeIntegrationError, integrationStatus } from "@/lib/integrations/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROPS = [
  "article_number", "article_description", "sub_group_number", "main_group_description",
  "stock_quantity", "stock_unit", "sales_unit", "moq", "moq_minimum_quantity",
  "art_price__m100__listed_price", "art_price__m110__listed_price",
];

export type Alternative = {
  article: string;
  description: string | null;
  stock: number | null;
  stockUnit: string | null;
  salesUnit: string | null;
  moq: string | null;
  moqMinimum: number | null;
  price: number | null;
  /** Covers what the customer asked for, out of stock we actually hold. */
  covers: boolean;
};

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export async function GET(req: NextRequest) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hubspot = integrationStatus().hubspot;
  if (!hubspot.configured) return NextResponse.json({ configured: false, missing: hubspot.missing });

  const sp = req.nextUrl.searchParams;
  const article = (sp.get("article") ?? "").trim();
  if (!/^\d{10}$/.test(article)) {
    return NextResponse.json({ ok: false, error: "article must be a ten-digit article number." }, { status: 400 });
  }
  const need = num(sp.get("need"));
  const mandant = sp.get("mandant") ?? "";
  const priceKey = mandant === "M110" ? "art_price__m110__listed_price" : "art_price__m100__listed_price";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    // 1. What is this article, and which sub-group does it sit in?
    const self = await hubspotFetchJson<{ results?: { properties?: Record<string, string | null> }[] }>({
      path: "/crm/v3/objects/2-200042439/search",
      method: "POST",
      signal: controller.signal,
      body: {
        filterGroups: [{ filters: [{ propertyName: "article_number", operator: "EQ", value: article }] }],
        properties: PROPS,
        limit: 1,
      },
    });
    const me = self.results?.[0]?.properties ?? null;
    const subGroup = me?.sub_group_number ?? null;
    if (!subGroup) {
      // A special has no record at all, so there is no neighbourhood to search.
      return NextResponse.json({ configured: true, ok: true, data: { subGroup: null, rows: [] as Alternative[] } });
    }

    // 2. Its neighbours that are actually on the shelf. Stock first, because an
    //    alternative nobody can ship is not an alternative.
    const res = await hubspotFetchJson<{ results?: { properties?: Record<string, string | null> }[] }>({
      path: "/crm/v3/objects/2-200042439/search",
      method: "POST",
      signal: controller.signal,
      body: {
        filterGroups: [{ filters: [
          { propertyName: "sub_group_number", operator: "EQ", value: subGroup },
          { propertyName: "stock_quantity", operator: "GT", value: "0" },
        ] }],
        properties: PROPS,
        sorts: [{ propertyName: "stock_quantity", direction: "DESCENDING" }],
        limit: 12,
      },
    });

    const rows: Alternative[] = (res.results ?? [])
      .map((r) => r.properties ?? {})
      .filter((p) => p.article_number && p.article_number !== article)
      .map((p) => {
        const stock = num(p.stock_quantity);
        const moqMinimum = num(p.moq_minimum_quantity);
        const hasMoq = /^y/i.test(String(p.moq ?? ""));
        return {
          article: String(p.article_number),
          description: p.article_description ?? null,
          stock,
          stockUnit: p.stock_unit ?? null,
          salesUnit: p.sales_unit ?? null,
          moq: p.moq ?? null,
          moqMinimum,
          price: num(p[priceKey]),
          // Enough on the shelf, and we will sell it in the quantity they wanted.
          covers: need == null
            ? (stock ?? 0) > 0
            : (stock ?? 0) >= need && !(hasMoq && moqMinimum != null && need < moqMinimum),
        };
      })
      .sort((a, b) => Number(b.covers) - Number(a.covers) || (b.stock ?? 0) - (a.stock ?? 0))
      .slice(0, 8);

    return NextResponse.json({
      configured: true, ok: true,
      data: { subGroup, group: me?.main_group_description ?? null, rows },
    });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) }, { status: 200 });
  } finally {
    clearTimeout(timer);
  }
}
