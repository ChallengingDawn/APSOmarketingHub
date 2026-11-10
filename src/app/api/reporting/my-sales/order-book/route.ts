// My Sales Reports > Targets: the ERP's order book by person (Bernd Rausmann, relayed by SARCLA 10.11.2026: "show the relevant
// order book and the % of order book against the target"). The morning workbook's order book sheet, each customer its
// HubSpot company (the revenue step's map) and that company's Performis SAE as the customers' cube counts it - the same
// names the Targets measure the revenue by. Advanced reporting's grant to read, as the cube itself.
import { NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { customersCube, customersLedger } from "@/lib/marketingKpis/customers";
import { bookBySae, ledgerLookups } from "@/lib/reporting/orderBookRules";
import { companiesOfCustomers, orderBookNow } from "@/lib/reporting/orderBookStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("reporting")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const kept = await orderBookNow();
    // no order book sheet in the morning workbook yet: the page shows no order book
    if (!kept) return NextResponse.json({ ok: true, none: true });
    const cube = (await customersCube()).value;
    const ledger = cube ? await customersLedger(cube) : null;
    if (!cube || !ledger) return NextResponse.json({ ok: true, pending: true });
    const companies = await companiesOfCustomers([...new Set(kept.book.map((r) => r[0]))]);
    const { saeOf, isNew } = ledgerLookups(cube, ledger, Number(kept.day.slice(0, 4)) || new Date().getUTCFullYear());
    return NextResponse.json({ ok: true, ...bookBySae(kept, (u) => companies.get(u), saeOf, isNew) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}
