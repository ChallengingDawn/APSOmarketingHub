// OWNER REDIRECTION, as HubSpot sees it - read on its own so the page opens fast:
// the rules HubSpot holds right now (read exactly as the HubSpot app function reads
// them), and the last owner changes onto the rules' owners with who made each one
// (HubSpot's property history) - the instant corrections the hub itself never sees.

import { NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { describeIntegrationError } from "@/lib/integrations/status";
import { publishedRules } from "@/lib/ownerRules/rules";
import { listRules } from "@/lib/ownerRules/store";
import { readPublished, recentOwnerChanges, type OwnerChange } from "@/lib/ownerRules/hubspot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const pub = await readPublished();
    const rules = pub.ok ? pub.doc.rules : publishedRules(await listRules());
    let changes: OwnerChange[] | null = null;
    let changesError: string | null = null;
    try {
      changes = await recentOwnerChanges(rules);
    } catch (e) {
      changesError = describeIntegrationError(e).error;
    }
    return NextResponse.json({ configured: true, ok: true, data: {
      hubspot: pub.ok
        ? { ok: true, publishedAt: pub.doc.publishedAt, publishedBy: pub.doc.publishedBy, rules: pub.doc.rules.length, hash: pub.doc.hash, recordId: pub.recordId, records: pub.records }
        : { ok: false, error: pub.error },
      changes, changesError,
    } });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) });
  }
}
