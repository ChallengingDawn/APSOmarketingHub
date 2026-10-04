// The erosion forecast - the tickets the detector expects to raise from here to
// the end of the year. Wherever the detector runs, that is where it comes from:
// once the hub owns erosion (EROSION_DETECTOR=live) and has run, its own last run;
// until then the Compass connector's, read with the connector's read-only key.

import { NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { kvGet } from "@/lib/db/init";
import { fetchErosionForecast } from "@/lib/integrations/erosion";
import { connectorReadKey, describeIntegrationError } from "@/lib/integrations/status";
import { parseForecast } from "@/lib/erosion/model";
import { KV } from "@/lib/erosion/run";
import { erosionLive } from "@/lib/erosion/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (erosionLive()) {
    const own = await kvGet<unknown>(KV.outlook).catch(() => undefined);
    if (own) return NextResponse.json({ configured: true, ok: true, data: parseForecast(own) });
    // the hub owns erosion but has not run yet: the connector's last forecast still stands
  }

  if (!connectorReadKey()) {
    return NextResponse.json({
      configured: false,
      missing: ["CONNECTOR_READ_KEY"],
      detail: "The forecast lives on the Compass connector. The tickets above do not need it.",
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const data = await fetchErosionForecast(controller.signal);
    return NextResponse.json({ configured: true, ok: true, data });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) });
  } finally {
    clearTimeout(timer);
  }
}
