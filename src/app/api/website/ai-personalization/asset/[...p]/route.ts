// APSOconvert > THE SHOP'S FILES FOR THE PREVIEW FRAME: GET /api/website/ai-personalization/asset/<key>/<prod|acc>/
// static|media/... answers one of the shop's public files from the hub (src/lib/convert/assets.ts). No session (the
// frame sends no hub cookie): the day's key opens it, written into the page by the signed-in preview route. Open to the
// frame's origin (CORS *) because fonts and the theme's JSON need it; nothing else is served here.
import { NextRequest } from "next/server";
import { isEnv } from "@/lib/convert/model";
import { assetPath, hubOriginOf, keyOk, shopFile } from "@/lib/convert/assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = { "Access-Control-Allow-Origin": "*", "Cross-Origin-Resource-Policy": "cross-origin", "X-Content-Type-Options": "nosniff" };
const no = (status: number, text: string) => new Response(text, { status, headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

export async function GET(req: NextRequest, ctx: { params: Promise<{ p: string[] }> }) {
  const { p } = await ctx.params;
  const [key, env, ...rest] = p ?? [];
  if (!isEnv(env) || !key || !keyOk(env, key)) return no(403, "no");
  const path = assetPath(rest.map((x) => decodeURIComponent(x)));
  if (!path) return no(404, "not a shop file");
  try {
    const f = await shopFile(env, path, hubOriginOf(req.headers, req.nextUrl.origin));
    // a type the frame may run or draw; anything else goes as plain bytes it cannot run
    const safe = /^(text\/css|text\/javascript|application\/(x-)?javascript|application\/json|image\/|font\/|application\/font|application\/x-font|application\/vnd\.ms-fontobject|application\/octet-stream)/i.test(f.type);
    return new Response(new Uint8Array(f.body), {
      status: f.status,
      headers: {
        ...CORS,
        "Content-Type": safe ? f.type : "application/octet-stream",
        "Cache-Control": f.status === 200 ? (path.startsWith("/static/version") ? "private, max-age=86400, immutable" : "private, max-age=3600") : "no-store",
      },
    });
  } catch (e) {
    return no(502, `the shop did not answer: ${(e as Error).message}`);
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...CORS, "Access-Control-Allow-Methods": "GET", "Access-Control-Max-Age": "86400" } });
}
