// Smart Segmentation: the companies behind a tab, 25 at a time, live from HubSpot (?seg&prio&major&split&q&sort&dir&page),
// and the profit-centre mix (?mix=pc) - how many companies hold each value of the two properties.

import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { companiesPage, pcMix } from "@/lib/integrations/segmentationCompanies";
import { SORTS, type SortKey } from "@/lib/segmentation/companies";
import { describeIntegrationError } from "@/lib/integrations/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  try {
    if (sp.get("mix") === "pc") return NextResponse.json({ configured: true, ok: true, data: await pcMix(sp.get("refresh") === "1") });
    const opt = (k: string) => (sp.has(k) ? sp.get(k)! : undefined);
    const sort = sp.get("sort") ?? "";
    const data = await companiesPage({
      seg: opt("seg"), prio: opt("prio"), major: opt("major"), split: opt("split"), q: opt("q")?.trim() || undefined,
      sort: sort in SORTS ? (sort as SortKey) : undefined, dir: sp.get("dir") === "asc" ? "asc" : "desc", page: Number(sp.get("page")) || 0,
    });
    return NextResponse.json({ configured: true, ok: true, data });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) });
  }
}
