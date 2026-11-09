// APSOconvert > CLICK MAP (src/lib/convert/clicks.ts): GET ?env&path[&days][&dev] = one page's clicks made into heat for
// the Preview; GET without a path = every page the shop's gateway counts. POST {env, path, on} switches counting on for
// 30 days (or off) - the Preview's write level, as it changes what the shop's head.js does on that page.
import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { isEnv } from "@/lib/convert/model";
import { clickMaps, clicksOf, pageTotals, switchClicks } from "@/lib/convert/clicks";
import { swissNow } from "@/lib/convert/scanRules";
import { CLICKMAP, type Dev } from "@/lib/convert/clickRules";
import { body, fail, failOf, ok, who } from "@/lib/convert/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

const PAGE = "/website/ai-personalization/preview";
const cleanPath = (p: unknown) => (typeof p === "string" && /^\/[^\s?#<>"'`\\]{0,300}$/.test(p) ? p : null);

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("website")) return NextResponse.json({ error: "No access" }, { status: 403 });
  const q = req.nextUrl.searchParams;
  const canEdit = access.levelAt(PAGE) === "write";
  try {
    const raw = q.get("path");
    if (raw === null) {
      const st = await clickMaps();
      const totals = st.deployed ? await pageTotals() : null;
      // a map past its end day stays in the gateway's list but counts no more (the Swiss day)
      const today = swissNow().day;
      const maps = st.maps.map((m) => ({ ...m, counting: m.until === null || m.until >= today }));
      return ok({ ...st, maps, totals, canEdit });
    }
    const path = cleanPath(raw);
    if (!path) return fail("Which page?", 400);
    const env = isEnv(q.get("env")) ? (q.get("env") as "acc" | "prod") : "prod";
    const days = Number(q.get("days")) || CLICKMAP.days;
    const dv = q.get("dev");
    const dev: Dev = dv === "d" || dv === "m" ? dv : "all";
    return ok({ ...(await clicksOf(env, path, days, dev)), canEdit });
  } catch (e) {
    return failOf(e);
  }
}

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.levelAt(PAGE) !== "write") return fail("Counting clicks on a page needs the write access of Preview.", 403);
  try {
    const b = await body(req);
    const path = cleanPath(b.path);
    if (!path || !isEnv(b.env)) return fail("Which page?", 400);
    const by = await who();
    const map = await switchClicks(b.env, path, b.on === true, by);
    console.log(`[convert-clicks] ${b.on === true ? "on" : "off"} ${b.env} ${path} by ${by}`);
    return ok({ map });
  } catch (e) {
    return failOf(e);
  }
}
