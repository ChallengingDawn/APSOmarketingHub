// DUPLICATES & MERGES - what each topic of the main toggle still has to go through (SARCLA 10.11.2026: "per topic put the
// number of duplicates still to go through"). Read from what the pages already keep - no new read of HubSpot, except
// the contacts' read when its 10 minutes are over (the same one the Contacts page makes).
//   tickets    flagged as the same request twice or the same order in the last 30 days, still open
//   companies  the groups waiting for a decision: the same customer number and the possible duplicates
//   contacts   shop accounts whose contact has no company, minus those linked here since the last read
//   performis  companies with two customer numbers or more in one Mandant

import { NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { performis, snapshot } from "@/lib/companyDuplicates/engine";
import { figures } from "@/lib/ticketDuplicates/figures";
import { rowsBetween } from "@/lib/ticketDuplicates/store";
import { linked, shopAccounts } from "@/lib/ticketAssoc/shopAccounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type DupCounts = { tickets: number | null; companies: number | null; contacts: number | null; performis: number | null };

const zurich = (t: number) => new Date(t).toLocaleDateString("sv-SE", { timeZone: "Europe/Zurich" });

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  // each on its own: one that fails or is still reading shows "…", the others still count
  const [tickets, companies, contacts, perf] = await Promise.all([
    rowsBetween(zurich(Date.now() - 29 * 86400_000), zurich(Date.now())).then((rows) => { const f = figures(rows, 30); return f.twice.open + f.order.open; }).catch(() => null),
    snapshot().then((s) => (s?.found ? s.found.sure.length + s.found.possible.length : null)).catch(() => null),
    Promise.all([shopAccounts(), linked()]).then(([s, l]) => {
      if (!s.value) return null;
      const done = new Set(l.map((x) => x.contact));
      return s.value.rows.filter((r) => !done.has(r.id)).length;
    }).catch(() => null),
    performis().then((p) => (p ? p.families.length : null)).catch(() => null),
  ]);
  const data: DupCounts = { tickets, companies, contacts, performis: perf };
  return NextResponse.json({ configured: true, ok: true, data });
}
