// One article on AP-Link, asked through the 3D service on Railway: is there a 3D model (stp),
// a 2D drawing (pdf) and a technical data sheet (tds). Read-only, Website's grant.

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { checkArticle } from "@/lib/threeD/read";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("website")) return NextResponse.json({ error: "No access" }, { status: 403 });
  const article = String(req.nextUrl.searchParams.get("article") ?? "").replace(/\s+/g, "");
  // the ERP's ten-digit article (leading zeros kept); a product page's eight digits has no model
  if (!/^\d{10}$/.test(article)) return NextResponse.json({ ok: false, error: "An article number has 10 digits." }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, data: await checkArticle(article) });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String((err as Error)?.message ?? err) }, { status: 502 });
  }
}
