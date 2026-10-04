// Names for what a customer looked at.
//
// The detail panel took its descriptions from the ORDER lines, so anything
// merely looked at had none - a row of bare numbers, and the product pages read
// "product page, no size chosen" with nothing beside them. The shop records what
// was looked at, not what it is called, so the name has to be fetched.
//
// Ten digits is an ARTICLE (article_number); eight is the product PAGE that its
// variants share (product_number). Different columns, so both are asked for.

import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { describeIntegrationError, integrationStatus } from "@/lib/integrations/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PP_OBJ = "2-200042439";
/** One panel at a time; a request longer than this is not a panel. */
const MAX = 200;

async function lookup(property: string, values: string[], pick: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (let i = 0; i < values.length; i += 100) {
    const res = await hubspotFetchJson<{ results?: { properties?: Record<string, string | null> }[] }>({
      path: `/crm/v3/objects/${PP_OBJ}/search`,
      method: "POST",
      body: {
        filterGroups: [{ filters: [{ propertyName: property, operator: "IN", values: values.slice(i, i + 100) }] }],
        properties: [property, ...pick],
        limit: 100,
      },
    });
    for (const r of res.results ?? []) {
      const p = r.properties ?? {};
      const key = p[property];
      if (!key || out[key]) continue;          // the first variant names the page
      const text = pick.map((f) => p[f]).find((v) => v && v.trim());
      if (text) out[key] = text.trim();
    }
  }
  return out;
}

export async function GET(req: NextRequest) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hubspot = integrationStatus().hubspot;
  if (!hubspot.configured) return NextResponse.json({ configured: false, missing: hubspot.missing });

  const split = (v: string | null) => (v ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const articles = [...new Set(split(req.nextUrl.searchParams.get("articles")).filter((a) => /^\d{10}$/.test(a)))].slice(0, MAX);
  const products = [...new Set(split(req.nextUrl.searchParams.get("products")).filter((p) => /^\d{8}$/.test(p)))].slice(0, MAX);
  if (!articles.length && !products.length) {
    return NextResponse.json({ configured: true, ok: true, data: {} });
  }

  try {
    const [a, p] = await Promise.all([
      articles.length ? lookup("article_number", articles, ["article_description", "product_description"]) : {},
      // A page has no article description of its own, so its name comes from the
      // product line - the same text the shop shows above the size chooser.
      products.length ? lookup("product_number", products, ["product_description", "article_description"]) : {},
    ]);
    return NextResponse.json({ configured: true, ok: true, data: { ...a, ...p } });
  } catch (err) {
    // A name is a nicety; losing it must not take the panel down with it.
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) }, { status: 200 });
  }
}
