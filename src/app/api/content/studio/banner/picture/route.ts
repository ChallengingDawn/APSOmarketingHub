// A SHOP PICTURE, PASSED THROUGH THE HUB (08.11.2026) - for the PNGs the banner and social studios make in the browser.
//
// A PNG is drawn on a canvas, and a canvas that has drawn a picture from another site without that site's permission
// (CORS) refuses to give its pixels back. The shop sends no such permission, and the hub's own rules let the browser
// fetch nothing but the hub. So the studio asks here: GET ?u=<the picture's address> answers with the picture's bytes,
// from the hub's own address. Only the shop's pictures - never an address inside the network.

import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;
const allowedHost = (h: string) => h === "apsoparts.com" || h.endsWith(".apsoparts.com");

function shopUrl(raw: string | null): URL | null {
  if (!raw || raw.length > 1500) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && allowedHost(u.hostname.toLowerCase()) && !u.username && !u.password && (!u.port || u.port === "443") ? u : null;
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  if (!(await getOptionalUser())) return NextResponse.json({ ok: false, error: "Sign in again." }, { status: 401 });
  let url = shopUrl(req.nextUrl.searchParams.get("u"));
  if (!url) return NextResponse.json({ ok: false, error: "Only the shop's pictures (www.apsoparts.com) can be used here." }, { status: 400 });
  try {
    // redirects followed by hand, each one checked - a redirect may not lead out of the shop
    for (let hop = 0; hop < 4; hop++) {
      const r = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(10000), headers: { Accept: "image/*" } });
      if (r.status >= 300 && r.status < 400) {
        const next = shopUrl(r.headers.get("location") ? new URL(r.headers.get("location")!, url).toString() : null);
        if (!next) return NextResponse.json({ ok: false, error: "The picture moved outside the shop." }, { status: 400 });
        url = next;
        continue;
      }
      if (!r.ok) return NextResponse.json({ ok: false, error: `The shop answered ${r.status} for that picture.` }, { status: 404 });
      const type = (r.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      if (!type.startsWith("image/") || type === "image/svg+xml") return NextResponse.json({ ok: false, error: "That address is not a picture." }, { status: 415 });
      const declared = Number(r.headers.get("content-length") ?? 0);
      if (declared > MAX_BYTES) return NextResponse.json({ ok: false, error: "That picture is too heavy (over 8 MB)." }, { status: 413 });
      const bytes = Buffer.from(await r.arrayBuffer());
      if (bytes.length > MAX_BYTES) return NextResponse.json({ ok: false, error: "That picture is too heavy (over 8 MB)." }, { status: 413 });
      return new NextResponse(bytes, { headers: { "Content-Type": type, "Content-Length": String(bytes.length), "Cache-Control": "private, max-age=86400" } });
    }
    return NextResponse.json({ ok: false, error: "The picture kept moving." }, { status: 508 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: `The shop did not send the picture (${e instanceof Error ? e.message : String(e)}).` }, { status: 502 });
  }
}
