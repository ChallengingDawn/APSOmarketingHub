// The HubSpot labels of the properties the Compass steps write ("mandant" ->
// "Mandant"), so "What it writes" says what a field is without opening HubSpot.
// One properties read per object, held 6 hours; an object that cannot be read
// just stays without labels.

import { NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { OBJECT_TYPE } from "@/lib/connectors/compass";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_MS = 6 * 3_600_000;
const PARTIAL_TTL_MS = 10 * 60_000;
let held: { until: number; labels: Record<string, Record<string, string>> } | null = null;

async function read(type: string): Promise<Record<string, string>> {
  const res = await hubspotFetchJson<{ results?: { name?: string; label?: string }[] }>({ path: `/crm/v3/properties/${type}`, signal: AbortSignal.timeout(15_000) });
  return Object.fromEntries((res.results ?? []).filter((p) => p.name && p.label).map((p) => [p.name!, p.label!]));
}

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("connectors")) return NextResponse.json({ error: "No access" }, { status: 403 });
  if (!held || Date.now() > held.until) {
    const pairs = await Promise.all(Object.entries(OBJECT_TYPE).map(async ([object, type]) => [object, await read(type).catch(() => ({}))] as const));
    // an object that could not be read is asked again in 10 minutes, not in 6 hours
    const whole = pairs.every(([, m]) => Object.keys(m).length);
    held = { until: Date.now() + (whole ? TTL_MS : PARTIAL_TTL_MS), labels: Object.fromEntries(pairs) };
  }
  return NextResponse.json({ ok: true, data: held.labels });
}
