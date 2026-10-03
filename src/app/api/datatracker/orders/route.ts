// Orders and value per customer for the chosen period, plus enough detail to
// list a customer who ordered WITHOUT being seen browsing.
//
// The activity feed only sees a customer who opened a product page while logged
// in with the smart bar loaded. Orders are the other half of the desktop
// tracker's table and they are authoritative, so this is what makes the live
// screen agree with the desktop one.

import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { fetchOrdersByCompany } from "@/lib/integrations/eshopOrders";
import { owners } from "@/lib/integrations/eshopActivity";
import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { describeIntegrationError, integrationStatus } from "@/lib/integrations/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
/**
 * Every customer that ordered gets listed. Reading their names costs one batch
 * per hundred, which is cheap next to the order scan itself, so the old cap of
 * 600 was buying nothing and hiding thousands of rows.
 */
const MAX_DETAIL = 10_000;

export async function GET(req: NextRequest) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hubspot = integrationStatus().hubspot;
  if (!hubspot.configured) return NextResponse.json({ configured: false, missing: hubspot.missing });

  const sp = req.nextUrl.searchParams;
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  if (!ISO.test(from) || !ISO.test(to) || from > to) {
    return NextResponse.json({ ok: false, error: "from and to must be YYYY-MM-DD, from on or before to." }, { status: 400 });
  }

  // Which call failed matters more than that one did: the scopes behind each of
  // these are different, so an unlabelled message sends you looking in the
  // wrong place.
  let step = "orders search";
  try {
    const agg = await fetchOrdersByCompany(from, to);
    step = "owner names";
    const ids = Object.keys(agg.byCompany);
    const detailIds = ids.slice(0, MAX_DETAIL);

    const ownerNames = await owners().catch(() => new Map<string, string>());
    step = "company details";
    const companies: Record<string, Record<string, string | null>> = {};
    for (let i = 0; i < detailIds.length; i += 100) {
      const res = await hubspotFetchJson<{ results?: { id: string; properties?: Record<string, string | null> }[] }>({
        path: "/crm/v3/objects/companies/batch/read",
        method: "POST",
        body: {
          properties: ["name", "company_unique_number", "mandant", "country_custom",
            "apso_customer", "sales_priority", "hubspot_owner_id"],
          inputs: detailIds.slice(i, i + 100).map((id) => ({ id })),
        },
      });
      for (const c of res.results ?? []) {
        const p = c.properties ?? {};
        companies[String(c.id)] = {
          name: p.name ?? null,
          customerNumber: p.company_unique_number ?? null,
          mandant: p.mandant ?? null,
          country: p.country_custom ?? null,
          apsoCustomer: p.apso_customer ?? null,
          salesPriority: p.sales_priority ?? null,
          representative: ownerNames.get(String(p.hubspot_owner_id ?? "")) ?? null,
        };
      }
    }

    return NextResponse.json({
      ok: true, from, to,
      byCompany: agg.byCompany,
      companies,
      scanned: agg.scanned,
      capped: agg.capped,
      unattributed: agg.unattributed,
      detailTruncated: ids.length > detailIds.length ? ids.length - detailIds.length : 0,
    });
  } catch (err) {
    // 200 with ok:false, like the other datatracker routes: the client reads the
    // reason out of the body rather than guessing from a status code.
    return NextResponse.json({ ok: false, step, ...describeIntegrationError(err) }, { status: 200 });
  }
}
