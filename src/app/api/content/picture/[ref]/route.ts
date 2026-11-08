// ONE PICTURE'S BYTES (08.11.2026) - what <img src="/api/content/picture/<id>-<key>"> reads. The key in the address opens
// it (a preview frame, a rendered e-mail or a sandboxed page sends no hub cookie - as APSOconvert's asset route); the hub
// itself answers only the whitelisted addresses. Never changes once kept, so the browser keeps it; an SVG logo is served
// so that nothing in it can run.

import { NextRequest, NextResponse } from "next/server";
import { assetBytes } from "@/lib/content/assets";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, c: { params: Promise<{ ref: string }> }) {
  const m = /^(\d{1,9})-([a-f0-9]{18})(?:\.[a-z]{3,4})?$/.exec((await c.params).ref);
  const found = m ? await assetBytes(Number(m[1]), m[2]) : null;
  if (!found) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(found.data), {
    headers: {
      "Content-Type": found.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
      "Cross-Origin-Resource-Policy": "cross-origin",
    },
  });
}
