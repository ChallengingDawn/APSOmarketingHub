// The erosion forecast - the tickets the detector expects to raise from here to
// the end of the year. It lives on the Compass connector, not in HubSpot, and is
// read with the connector's read-only key.

import { NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { fetchErosionForecast } from "@/lib/integrations/erosion";
import { connectorReadKey, describeIntegrationError } from "@/lib/integrations/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
