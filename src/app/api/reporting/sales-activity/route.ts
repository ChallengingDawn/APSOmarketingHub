// The Sales activity page's read (src/lib/reporting/salesActivityReport.ts): started by the first request, answered from the
// finished read after that. Advanced reporting's own grant, like the page. Every company in HubSpot is ~4 MB of JSON, so the
// answer goes out gzipped (~5x smaller) when the browser takes it - compressed once per read, not per request.
import { gzipSync } from "node:zlib";
import { NextResponse, type NextRequest } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { salesActivity } from "@/lib/reporting/salesActivityReport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** the last answer compressed, by what it was made from */
let packed: { key: string; body: Buffer } | null = null;

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("reporting")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const state = await salesActivity();
    if (!/\bgzip\b/.test(req.headers.get("accept-encoding") ?? "")) return NextResponse.json({ ok: true, state });
    const key = `${state.value?.generatedAt ?? ""}|${!!state.computing}|${state.progress ?? ""}|${state.error ?? ""}`;
    if (packed?.key !== key) packed = { key, body: gzipSync(JSON.stringify({ ok: true, state })) };
    return new Response(new Uint8Array(packed.body), { headers: { "Content-Type": "application/json", "Content-Encoding": "gzip", Vary: "Accept-Encoding", "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}
