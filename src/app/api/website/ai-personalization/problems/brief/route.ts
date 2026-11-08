// APSOconvert > Problems > WHAT STOPS BUYERS (src/lib/convert/brief.ts). GET ?from&to = the kept answer for that period
// (or none); POST {from, to} asks the AI - Problems' write level; the answer is streamed, a space every few seconds
// until the JSON, so no proxy on the way closes the line.
import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { getOptionalUser } from "@/lib/auth/guard";
import { getBrief, makeBrief } from "@/lib/convert/brief";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PAGE = "/website/ai-personalization/problems";
const day = (x: unknown) => (typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : null);

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("website")) return NextResponse.json({ error: "No access" }, { status: 403 });
  const from = day(req.nextUrl.searchParams.get("from"));
  const to = day(req.nextUrl.searchParams.get("to"));
  if (!from || !to) return NextResponse.json({ configured: true, ok: false, error: "from and to, please" }, { status: 400 });
  try {
    return NextResponse.json({ configured: true, ok: true, data: { brief: await getBrief(from, to), canAsk: access.levelAt(PAGE) === "write", ai: Boolean(process.env.ANTHROPIC_API_KEY) } });
  } catch (e) {
    return NextResponse.json({ configured: true, ok: false, error: String((e as Error)?.message ?? e) });
  }
}

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.levelAt(PAGE) !== "write") return NextResponse.json({ ok: false, error: "Asking the AI needs the Problems write access." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { from?: unknown; to?: unknown };
  const from = day(b.from);
  const to = day(b.to);
  if (!from || !to) return NextResponse.json({ ok: false, error: "from and to, please" }, { status: 400 });
  const user = await getOptionalUser();
  const by = user?.full_name || user?.username || "someone";
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const beat = setInterval(() => { try { ctrl.enqueue(enc.encode(" ")); } catch { /* the reader left */ } }, 8000);
      let out: unknown;
      try { out = await makeBrief(from, to, by); } catch (e) { out = { ok: false, error: String((e as Error)?.message ?? e) }; }
      clearInterval(beat);
      try { ctrl.enqueue(enc.encode(JSON.stringify(out))); ctrl.close(); } catch { /* kept anyway */ }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
