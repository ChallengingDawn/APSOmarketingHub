// BLACK FRIDAY 2026 - the hub's page Website > Black Friday. The promotion's settings and codes live on the Ads
// Gateway (src/lib/promo/blackFriday.ts); who holds and who used a code is read from HubSpot.
//   GET  ?fresh=1                          -> { status, report | null, reportError | null, testers, isAdmin }
//   POST { action: "settings", on?, start?, end?, discount?, testers? }  (admins; testers = e-mails: the hub keeps
//        them, the gateway gets only the salted hashes the shop page sends)
//   POST { action: "settings", env: "acc", on?, start?, end?, discount? }  the ACC shop's own settings (admins)
//   POST { action: "acc-reset" }   ACC's test hand-outs cleared, the TEST- codes back in the pool       (admins)
//   POST { action: "codes", discount, codes: [...] }                 (admins; the page sends 300 a call - the
//        8 KB request limit in front of the hub)

import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet } from "@/lib/db/init";
import { myAccess } from "@/lib/auth/appAccess";
import { requireUser } from "@/lib/auth/guard";
import { adminToken, loadPromoCodes, promoReport, promoStatus, resetAccTests, setPromoSettings } from "@/lib/promo/blackFriday";
import { wrongRate } from "@/lib/promo/report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// the salt of the search bar's and the Ads Gateway's buyer keys (ADS_BUCKET_SALT unset there) - the page hashes the same way
const SALT = "apso-bb1:";
const TESTERS_KV = "promo:bf26:testers";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const keyOf = (email: string) => createHash("sha256").update(SALT + email.trim().toLowerCase()).digest("hex");

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("website")) return NextResponse.json({ error: "No access" }, { status: 403 });
  if (!adminToken()) return NextResponse.json({ configured: false, missing: ["SMART_BAR_ADMIN_TOKEN"] });
  try {
    const status = await promoStatus();
    let report = null, reportError: string | null = null;
    try { report = await promoReport(status, req.nextUrl.searchParams.get("fresh") === "1"); }
    catch (e) { reportError = String((e as Error)?.message ?? e); }
    const testers = (await kvGet<string[]>(TESTERS_KV).catch(() => null)) ?? [];
    return NextResponse.json({ configured: true, ok: true, data: { status, report, reportError, testers, isAdmin: access.role === "admin" } });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, error: String((err as Error)?.message ?? err), status: (err as { status?: number })?.status ?? null });
  }
}

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  if (!adminToken()) return NextResponse.json({ ok: false, error: "SMART_BAR_ADMIN_TOKEN is not set on the hub." }, { status: 503 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const me = await requireUser();
  const who = me.full_name || me.username;
  try {
    if (body.action === "acc-reset") {
      const data = await resetAccTests();
      console.log(`[black-friday] ACC test hand-outs cleared by ${who}: ${data.cleared} (${data.codes_back} TEST codes back)`);
      return NextResponse.json({ ok: true, data });
    }
    if (body.action === "settings") {
      const env = body.env === "acc" ? "acc" : "prod";
      const patch: Record<string, unknown> = {};
      for (const k of ["on", "start", "end", "discount"]) if (body[k] !== undefined) patch[k] = body[k];
      let testers: string[] | null = null;
      if (env === "prod" && body.testers !== undefined) {
        const list = Array.isArray(body.testers) ? body.testers.map((x) => String(x).trim().toLowerCase()).filter(Boolean) : null;
        if (!list || list.length > 20 || list.some((x) => !EMAIL.test(x))) return NextResponse.json({ ok: false, error: "Test accounts: up to 20 e-mail addresses." }, { status: 400 });
        testers = [...new Set(list)];
        patch.testers = testers.map(keyOf);
      }
      const data = await setPromoSettings(patch, env);
      if (testers) await kvSet(TESTERS_KV, testers);
      console.log(`[black-friday] ${env} settings set by ${who}: ${JSON.stringify({ ...patch, testers: testers ? testers.length : undefined })}`);
      return NextResponse.json({ ok: true, data });
    }
    if (body.action === "codes") {
      const codes = Array.isArray(body.codes) ? body.codes.map(String) : [];
      if (!codes.length || codes.length > 800) return NextResponse.json({ ok: false, error: "Send 1 to 800 codes at a time." }, { status: 400 });
      // BLACKFRIDAY10... is the 10 % rule's: never loaded under another rate
      const bad = wrongRate(codes, Number(body.discount));
      if (bad.length) return NextResponse.json({ ok: false, error: `${bad.length} codes belong to another rate (e.g. ${bad[0]}).` }, { status: 400 });
      const data = await loadPromoCodes(Number(body.discount), codes);
      console.log(`[black-friday] ${data.added} codes at ${Number(body.discount)} % loaded by ${who} (${data.already} already there)`);
      return NextResponse.json({ ok: true, data });
    }
    return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
  } catch (err) {
    const st = (err as { status?: number })?.status;
    return NextResponse.json({ ok: false, error: String((err as Error)?.message ?? err) }, { status: st && st < 500 ? st : 502 });
  }
}
