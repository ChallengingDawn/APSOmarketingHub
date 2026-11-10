// APSOconvert > Journeys > Visits > THE VISIT REPLAY (src/lib/convert/replays.ts).
//   GET ?company=<HubSpot id>&from&to  -> the switch, the company's recorded page views
//   GET ?pv=<id>                       -> one page view with its moments
//   POST {on}                          -> switch the recording on the shop on or off (write access of Visits)
import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { companyReplays, replayOf, setReplay } from "@/lib/convert/replays";
import { who } from "@/lib/convert/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PAGE = "/website/ai-personalization/journeys/visits";
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("website")) return NextResponse.json({ error: "No access" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  try {
    const pv = sp.get("pv");
    if (pv) {
      const one = await replayOf(pv);
      return one ? NextResponse.json({ configured: true, ok: true, data: one }) : NextResponse.json({ configured: true, ok: false, error: "No such recorded page view." }, { status: 404 });
    }
    const company = sp.get("company") ?? "", from = sp.get("from") ?? "", to = sp.get("to") ?? "";
    if (!/^\d{1,20}$/.test(company) || !ISO.test(from) || !ISO.test(to) || from > to) {
      return NextResponse.json({ configured: true, ok: false, error: "company, from and to, please." }, { status: 400 });
    }
    const data = await companyReplays(company, from, to);
    return NextResponse.json({ configured: true, ok: true, data: { ...data, canSwitch: access.levelAt(PAGE) === "write" } });
  } catch (e) {
    return NextResponse.json({ configured: true, ok: false, error: String((e as Error)?.message ?? e).slice(0, 300) });
  }
}

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.levelAt(PAGE) !== "write") return NextResponse.json({ ok: false, error: "Switching the recording needs the write access of Visits." }, { status: 403 });
  const b = (await req.json().catch(() => null)) as { on?: unknown } | null;
  if (!b || typeof b.on !== "boolean") return NextResponse.json({ ok: false, error: "on: true or false" }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, data: await setReplay(b.on, await who()) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e).slice(0, 300) }, { status: 502 });
  }
}
