// The Use Cases Overview's cards: three KPIs per UC for the period asked - the
// lifecycle UCs from their cached reads, UC16 Erosion and UC17 Price checks from
// their own ticket reads. A UC never read yet says so; the page asks again.
// UC & HubSpot Apps' own grant, like the pages.

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { hubspotToken } from "@/lib/integrations/status";
import { UCS } from "@/lib/lifecycle/config";
import { ucState } from "@/lib/lifecycle/build";
import { cardOf, hubCard } from "@/lib/lifecycle/cards";
import { parseWin, toDay } from "@/lib/lifecycle/rules";
import type { UcCard } from "@/lib/lifecycle/types";
import { fetchErosionTickets } from "@/lib/integrations/erosion";
import { fetchPriceCheckTickets } from "@/lib/integrations/priceCheckOutcomes";
import { VALUE_FLOOR_ACTIVE } from "@/lib/datatracker/rules";
import type { ErosionTicket } from "@/lib/erosion/model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A ticket read, or null when it takes longer than the page should wait (it carries on and is cached). */
async function within<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);
}

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  if (!hubspotToken()) return NextResponse.json({ ok: false, configured: false, missing: ["HUBSPOT_TOKEN"] });

  const today = toDay(Date.now()) as string;
  const sp = req.nextUrl.searchParams;
  const win = parseWin(sp.get("from"), sp.get("to"), today);
  const cards: UcCard[] = [];
  for (const u of UCS) {
    try {
      const s = await ucState(u.key);
      cards.push(cardOf(u.key, s.value ?? null, win));
    } catch (e) {
      cards.push({ code: u.code, title: u.title, href: u.href, a: null, top: null, b: null, error: String((e as Error)?.message ?? e) });
    }
  }
  const hub = async (code: "UC16" | "UC17", read: () => Promise<{ tickets: ErosionTicket[] }>) => {
    try {
      const r = await within(read(), 20_000);
      return hubCard(code, r ? r.tickets : null, win, { valuesShown: VALUE_FLOOR_ACTIVE });
    } catch (e) {
      return hubCard(code, null, win, { valuesShown: VALUE_FLOOR_ACTIVE, error: String((e as Error)?.message ?? e) });
    }
  };
  cards.push(await hub("UC16", () => fetchErosionTickets()), await hub("UC17", () => fetchPriceCheckTickets()));
  return NextResponse.json({ ok: true, cards, reading: cards.some((c) => c.reading) });
}
