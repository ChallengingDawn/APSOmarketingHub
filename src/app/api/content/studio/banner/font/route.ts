// THE BRAND'S TYPE FOR THE STUDIOS' PREVIEWS AND PNGS (08.11.2026).
//
// The shop sets its headings in futura-pt (Adobe Fonts, loaded by the shop itself). The hub cannot load it, and its own
// security rules let a font in only from the hub or as data: - so a banner or a slide drawn in the hub, and the PNG made
// from it, would fall back to Arial. Jost is the free look-alike the shop's previews have always used: this route fetches
// it once from Google Fonts (latin + latin-ext, one variable file each, 400-700) and hands it over as CSS with the fonts
// inlined. Kept in memory; on failure the studios say so and draw in Arial.

import { NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CSS_URL = "https://fonts.googleapis.com/css2?family=Jost:wght@400..700&display=swap";
// Google answers with woff2 only to a browser it knows
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

let cached: Promise<string> | null = null;

async function build(): Promise<string> {
  const r = await fetch(CSS_URL, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`Google Fonts answered ${r.status}`);
  const css = await r.text();
  const out: string[] = [];
  for (const block of css.split("/*").slice(1)) {
    const subset = block.slice(0, block.indexOf("*/")).trim();
    if (subset !== "latin" && subset !== "latin-ext") continue;
    const url = /src:\s*url\((https:\/\/fonts\.gstatic\.com\/[^)\s]+\.woff2)\)/.exec(block)?.[1];
    if (!url) continue;
    const range = /unicode-range:\s*([^;]+);/.exec(block)?.[1]?.trim();
    const weight = /font-weight:\s*([^;]+);/.exec(block)?.[1]?.trim() ?? "400 700";
    const f = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!f.ok) throw new Error(`The font file answered ${f.status}`);
    const b64 = Buffer.from(await f.arrayBuffer()).toString("base64");
    out.push(`@font-face{font-family:"Jost";font-style:normal;font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${b64}) format("woff2")${range ? `;unicode-range:${range}` : ""}}`);
  }
  if (!out.length) throw new Error("Google Fonts sent no Jost file");
  return out.join("\n");
}

export async function GET() {
  if (!(await getOptionalUser())) return NextResponse.json({ ok: false, error: "Sign in again." }, { status: 401 });
  cached ??= build().catch((e) => { cached = null; throw e; });
  try {
    const css = await cached;
    return new NextResponse(css, { headers: { "Content-Type": "text/css; charset=utf-8", "Cache-Control": "private, max-age=86400" } });
  } catch (e) {
    console.warn(`[studio] brand font not loaded: ${e instanceof Error ? e.message : String(e)}`);
    return NextResponse.json({ ok: false, error: "The brand font could not be loaded - previews use Arial." }, { status: 503 });
  }
}
