// Who was logged in: the email (and name) behind the contact ids on a customer's
// activity lines. The gateway writes the HubSpot contact id on every line it
// records (`u`), so the open row can say which person looked, not only which
// company. One batch read when a row opens - no search, so no rate-limit queue.

import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { describeIntegrationError, integrationStatus } from "@/lib/integrations/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One open row's worth; a request longer than this is not a panel. */
const MAX = 100;

export type ContactCard = {
  email: string | null;
  name: string | null;
  phone: string | null;
  mobile: string | null;
  /** Street, postcode and town, country - whatever the contact carries. */
  address: string | null;
};

export async function GET(req: NextRequest) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hubspot = integrationStatus().hubspot;
  if (!hubspot.configured) return NextResponse.json({ configured: false, missing: hubspot.missing });

  const ids = [...new Set((req.nextUrl.searchParams.get("ids") ?? "").split(",").map((x) => x.trim()).filter((x) => /^\d{1,20}$/.test(x)))].slice(0, MAX);
  if (!ids.length) return NextResponse.json({ configured: true, ok: true, data: {} });

  try {
    const res = await hubspotFetchJson<{ results?: { id: string; properties?: Record<string, string | null> }[] }>({
      path: "/crm/v3/objects/contacts/batch/read",
      method: "POST",
      body: {
        properties: ["email", "firstname", "lastname", "phone", "mobilephone", "address", "zip", "city", "country"],
        inputs: ids.map((id) => ({ id })),
      },
    });
    const data: Record<string, ContactCard> = {};
    for (const r of res.results ?? []) {
      const p = r.properties ?? {};
      const name = [p.firstname, p.lastname].map((x) => (x ?? "").trim()).filter(Boolean).join(" ");
      const t = (v: string | null | undefined) => (v ?? "").trim();
      const town = [t(p.zip), t(p.city)].filter(Boolean).join(" ");
      const address = [t(p.address), town, t(p.country)].filter(Boolean).join(", ");
      data[r.id] = {
        email: t(p.email) || null, name: name || null,
        phone: t(p.phone) || null, mobile: t(p.mobilephone) || null, address: address || null,
      };
    }
    return NextResponse.json({ configured: true, ok: true, data });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) });
  }
}
