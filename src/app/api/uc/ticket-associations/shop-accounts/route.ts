// TICKET/ORDER/ARTICLE ASSOCIATIONS > Contacts without a company: the shop accounts whose HubSpot
// contact has no company (src/lib/ticketAssoc/shopAccounts.ts).
// GET: the accounts, the companies on each one's e-mail domain, and the links made here.
// POST { contact, company }: link that contact to that company as its primary - a person's click,
// UC app users; only a company the read offered for that contact.
// POST { all: "orders" }: link every account whose orders are all booked on one company, to it.

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { describeIntegrationError } from "@/lib/integrations/status";
import { linkAccount, linkAllByOrder, linked, shopAccounts } from "@/lib/ticketAssoc/shopAccounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID = /^\d{1,20}$/;

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const [state, links] = await Promise.all([shopAccounts(), linked()]);
    // a contact linked here is done, even before the next read shows it
    const done = new Set(links.map((l) => l.contact));
    const value = state.value ? { ...state.value, rows: state.value.rows.filter((r) => !done.has(r.id)) } : undefined;
    return NextResponse.json({ configured: true, ok: true, data: { ...state, value, links: links.slice(0, 50), linkedCount: links.length } });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) });
  }
}

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { contact?: string; company?: string; all?: string };
  if (b.all === "orders") {
    try { return NextResponse.json({ ok: true, data: await linkAllByOrder(`user ${access.userId}`) }); }
    catch (err) { return NextResponse.json({ ok: false, ...describeIntegrationError(err) }, { status: 500 }); }
  }
  if (!ID.test(String(b.contact ?? "")) || !ID.test(String(b.company ?? ""))) return NextResponse.json({ ok: false, error: "A contact and a company are needed" }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, data: await linkAccount(String(b.contact), String(b.company), `user ${access.userId}`) });
  } catch (err) {
    return NextResponse.json({ ok: false, ...describeIntegrationError(err) }, { status: 500 });
  }
}
