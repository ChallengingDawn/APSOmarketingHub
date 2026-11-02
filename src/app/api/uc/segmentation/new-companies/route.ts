// Smart Segmentation > New companies: the period's new companies and what became of them (?from&to), the companies
// behind a pick (?list=1&...), the scan's switch and its last decisions. Admins switch it and read the companies again.

import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { followDoc, liveState, saveSettings, scanState, startFollow, type Mode } from "@/lib/integrations/newCompanies";
import { RULES, SET_BYS, newFigures, newList, type NewPick, type RuleKey, type SetBy } from "@/lib/segmentation/newCompanies";
import { describeIntegrationError } from "@/lib/integrations/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const to = DAY.test(sp.get("to") ?? "") ? sp.get("to")! : new Date().toISOString().slice(0, 10);
  const from = DAY.test(sp.get("from") ?? "") ? sp.get("from")! : new Date(Date.now() - 364 * 86_400_000).toISOString().slice(0, 10);
  try {
    if (sp.get("live") === "1") return NextResponse.json({ configured: true, ok: true, data: { ...(await liveState()), admin: user.role === "admin", engineLive: process.env.SEGMENTATION_ENGINE === "live" } });
    const all = await followDoc();
    // the bulk imports (14.02.2026: 12,006 companies at once) hide the companies that came one by one - a choice on the tab
    const doc = all && sp.get("imports") === "0" ? { ...all, rows: all.rows.filter((x) => x.src !== "import") } : all;
    const imported = all ? all.rows.filter((x) => x.src === "import" && x.d >= from && x.d <= to).length : 0;
    if (sp.get("list") === "1") {
      if (!doc) return NextResponse.json({ configured: true, ok: true, data: { rows: [], total: 0 } });
      const opt = (k: string) => sp.get(k) ?? undefined;
      const flag = (k: string) => (sp.get(k) === "1" ? true : sp.get(k) === "0" ? false : undefined);
      const pick: NewPick = {
        seg: opt("seg"), first: opt("first"), move: opt("move"), src: opt("src"), country: opt("country"), owner: opt("owner"), prio: opt("prio"), bucket: opt("bucket"),
        who: (SET_BYS as string[]).includes(sp.get("who") ?? "") ? (sp.get("who") as SetBy) : undefined,
        rule: (RULES as string[]).includes(sp.get("rule") ?? "") ? (sp.get("rule") as RuleKey) : undefined,
        byRules: flag("byRules"), fast: flag("fast"), changed: flag("changed"), customer: flag("customer"),
        bought: sp.get("bought") === "1" ? true : sp.get("bought") === "0" ? false : undefined,
        q: opt("q")?.slice(0, 80),
      };
      return NextResponse.json({ configured: true, ok: true, data: newList(doc, from, to, pick) });
    }
    const state = await scanState();
    return NextResponse.json({
      configured: true, ok: true,
      data: { figures: doc ? newFigures(doc, from, to) : null, imported, ...state, admin: user.role === "admin", engineLive: process.env.SEGMENTATION_ENGINE === "live" },
    });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) });
  }
}

export async function POST(req: NextRequest) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ ok: false, error: "Admins only" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { action?: string; mode?: string };
  const by = user.full_name || user.username;
  if (body.action === "mode") {
    if (!["off", "shadow", "live"].includes(body.mode ?? "")) return NextResponse.json({ ok: false, error: "mode: off, shadow or live" }, { status: 400 });
    return NextResponse.json({ ok: true, data: await saveSettings(body.mode as Mode, by) });
  }
  if (body.action === "follow") {
    const r = await startFollow(by);
    return NextResponse.json({ ok: r.started, ...(r.started ? { data: r } : { error: `Not started - ${r.why}` }) });
  }
  return NextResponse.json({ ok: false, error: "action: mode or follow" }, { status: 400 });
}
