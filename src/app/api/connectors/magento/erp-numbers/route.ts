// SHOP ORDERS - ERP NUMBERS: the magento_link step on its own page (SARCLA 15.10.2026). How
// many web orders wait for their A-number in HubSpot right now, whether the step runs live,
// and its last test run and live run. Switching and running go through /api/connectors/steps.

import { NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { describeIntegrationError } from "@/lib/integrations/status";
import { lastRun, liveSteps } from "@/lib/connectors/steps/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY = "magento_link";

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("connectors")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const [live, preview, run] = await Promise.all([liveSteps(), lastRun("preview", KEY), lastRun("live", KEY)]);
    let waiting: number | null = null;
    try {
      const j = await hubspotFetchJson<{ total?: number }>({
        path: "/crm/v3/objects/orders/search", method: "POST",
        body: { filterGroups: [{ filters: [{ propertyName: "order_reconcile_state", operator: "EQ", value: "web_provisional" }] }], limit: 1, properties: ["hs_object_id"] },
      });
      waiting = typeof j.total === "number" ? j.total : null;
    } catch {
      // the count is a nicety: the runs still show
    }
    return NextResponse.json({ ok: true, data: { live: live.has(KEY), admin: access.role === "admin", waiting, preview, run } });
  } catch (err) {
    return NextResponse.json({ ok: false, ...describeIntegrationError(err) });
  }
}
