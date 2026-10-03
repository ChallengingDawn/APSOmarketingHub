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
 * Every customer that ordered gets listed - but not in one wait.
 *
 * Naming them costs a batch read per hundred, so on a quarter that is a hundred
 * round trips before the table can draw. The first call names the biggest
 * spenders, which is what the table opens on, and the client asks for the rest
 * straight after. Nothing is dropped; it arrives in two steps.
 */
const FIRST_PASS = 300;
const MAX_DETAIL = 10_000;

/**
 * The follow-up call must not pay for the order scan a second time.
 *
 * The first response hands back a `scanId`; the client echoes it when asking for
 * the remaining names, and the aggregate is taken from here instead of being
 * searched again. Deliberately NOT keyed on from/to: a plain refresh carries no
 * scanId and so always re-scans, which is what someone pressing refresh on a
 * live window is asking for. A handful of entries, dropped after two minutes.
 */
const SCAN_TTL_MS = 120_000;
const SCAN_KEEP = 6;
let scanSeq = 0;
const scans = new Map<string, { at: number; agg: Awaited<ReturnType<typeof fetchOrdersByCompany>> }>();

function rememberScan(agg: Awaited<ReturnType<typeof fetchOrdersByCompany>>): string {
  const now = Date.now();
  for (const [k, v] of scans) if (now - v.at > SCAN_TTL_MS) scans.delete(k);
  while (scans.size >= SCAN_KEEP) scans.delete(scans.keys().next().value as string);
  const id = `s${++scanSeq}`;
  scans.set(id, { at: now, agg });
  return id;
}

function recallScan(id: string | null) {
  if (!id) return null;
  const hit = scans.get(id);
  if (!hit) return null;
  if (Date.now() - hit.at > SCAN_TTL_MS) { scans.delete(id); return null; }
  return hit.agg;
}

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
    const agg = recallScan(sp.get("scan")) ?? await fetchOrdersByCompany(from, to);
    const scanId = rememberScan(agg);
    step = "owner names";
    // Biggest first: the table opens sorted on value, so these are the rows a
    // reader is looking at while the rest are still coming.
    const ids = Object.entries(agg.byCompany)
      .sort((a, b) => b[1].value - a[1].value)
      .map(([id]) => id);
    const detailIds = ids.slice(0, sp.get("detail") === "all" ? MAX_DETAIL : FIRST_PASS);

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
          // The RAW owner id as well as the name: the representative filter is
          // an owner id server-side, and a customer who only ordered is filtered
          // here on the client, so both sides must compare the same thing.
          ownerId: p.hubspot_owner_id ?? null,
        };
      }
    }

    return NextResponse.json({
      ok: true, from, to, scanId,
      byCompany: agg.byCompany,
      companies,
      scanned: agg.scanned,
      capped: agg.capped,
      unattributed: agg.unattributed,
      offChannel: agg.offChannel,
      detailTruncated: ids.length > detailIds.length ? ids.length - detailIds.length : 0,
      // false means a second call with detail=all will name the remainder
      detailsComplete: detailIds.length >= ids.length,
    });
  } catch (err) {
    // 200 with ok:false, like the other datatracker routes: the client reads the
    // reason out of the body rather than guessing from a status code.
    return NextResponse.json({ ok: false, step, ...describeIntegrationError(err) }, { status: 200 });
  }
}
