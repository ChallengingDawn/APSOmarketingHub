// Connectors & Integration: the Compass connector's status for the app's pages
// and the front page's panel. Read-only; held 30 seconds.

import { NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { compassSnapshot } from "@/lib/integrations/compassConnector";
import { connectorReadKey, describeIntegrationError } from "@/lib/integrations/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("connectors")) return NextResponse.json({ error: "No access to Connectors & Integration" }, { status: 403 });
  if (!connectorReadKey()) return NextResponse.json({ configured: false, missing: ["CONNECTOR_READ_KEY"] });
  try {
    const fresh = new URL(req.url).searchParams.get("refresh") === "1";
    return NextResponse.json({ configured: true, ok: true, data: await compassSnapshot(fresh) });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) });
  }
}
