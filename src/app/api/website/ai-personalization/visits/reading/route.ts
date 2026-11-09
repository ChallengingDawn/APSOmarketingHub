// APSOconvert > Journeys > Visits - ASK THE AI (src/lib/convert/visitsAi.ts): POST {scope: "customer", id, from, to}
// reads one customer's visits, {scope: "period", from, to} every customer of the period. The Visits page's write level;
// the answer is kept, and streamed - a space every few seconds until the JSON, so no proxy on the way closes the line.
import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { getOptionalUser } from "@/lib/auth/guard";
import { makeCustomerReading, makePeriodReading } from "@/lib/convert/visitsAi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PAGE = "/website/ai-personalization/journeys/visits";
const day = (x: unknown) => (typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : null);

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.levelAt(PAGE) !== "write") return NextResponse.json({ ok: false, error: "Asking the AI needs the write access of APSOconvert's Journeys." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { scope?: unknown; id?: unknown; from?: unknown; to?: unknown };
  const from = day(b.from);
  const to = day(b.to);
  const scope = b.scope === "customer" ? "customer" : b.scope === "period" ? "period" : null;
  const id = typeof b.id === "string" && /^\d{1,20}$/.test(b.id) ? b.id : null;
  if (!from || !to || from > to || !scope || (scope === "customer" && !id)) return NextResponse.json({ ok: false, error: "scope, from and to (and id for a customer), please" }, { status: 400 });
  const user = await getOptionalUser();
  const by = user?.full_name || user?.username || "someone";
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const beat = setInterval(() => { try { ctrl.enqueue(enc.encode(" ")); } catch { /* the reader left */ } }, 8000);
      let out: unknown;
      try {
        out = scope === "customer" ? await makeCustomerReading(id!, from, to, by) : await makePeriodReading(from, to, by);
      } catch (e) { out = { ok: false, error: String((e as Error)?.message ?? e) }; }
      clearInterval(beat);
      try { ctrl.enqueue(enc.encode(JSON.stringify(out))); ctrl.close(); } catch { /* kept anyway */ }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
