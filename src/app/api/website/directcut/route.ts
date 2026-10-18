// DirectCut: what the c2s-middleware on Railway says about the cut-to-size chain — the open work, what was
// cut, the shelf, and the health of the feed behind it. Read for the hub's page (Website's grant).
//
// IT NEVER WRITES TO THE MIDDLEWARE. That one is the reservation authority and single-instance by design
// (see src/lib/directcut/gateway.ts), so nothing here reserves, cancels or moves a stage; acting on a line
// stays in the Railway dashboard. An admin can change which gateway address the hub reads, and can raise
// the Back Office ticket for a promise the shelf cannot keep - that writes to HubSpot, not to the shelf.
//
// Same three answers as every integration route: not configured, upstream failed (with the reason), or data.
//   GET  ?part=board | status | promises | registry | leftovers
//   POST { action: "gateway", url } | { action: "tickets", dry } | { action: "avor", dry, erpNo }
//        | { action: "stage", key, stage, from, note }
//
// The ticket action is the one thing here that writes anywhere, and it writes to HubSpot, not to the
// middleware: a Back Office ticket for an order whose promise the shelf can no longer keep. It is V1's job
// done from the hub (see lib/directcut/tickets.ts). Admins only, and dry by default.

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { requireUser } from "@/lib/auth/guard";
import { adminKey, board, canMove, gatewaySetting, holds, registry, setGateway, setStage, status } from "@/lib/directcut/gateway";
import { brokenWithTickets, runPromiseTickets } from "@/lib/directcut/tickets";
import { fetchLeftovers, mailLeftovers } from "@/lib/directcut/leftovers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const fail = (err: unknown) => NextResponse.json({
  configured: true,
  ok: false,
  error: String((err as Error)?.message ?? err),
  status: (err as { status?: number })?.status ?? null,
});

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("website")) return NextResponse.json({ error: "No access" }, { status: 403 });
  if (!adminKey()) return NextResponse.json({ configured: false, missing: ["C2S_ADMIN_KEY"] });
  const part = req.nextUrl.searchParams.get("part") || "board";
  try {
    const setting = await gatewaySetting();
    const isAdmin = access.role === "admin";
    if (part === "board") {
      /* the slim projection, built on the server: the middleware's own answer is 967 KB, mostly cut-done
         history and per-plate rows the page never shows (gateway.slim) */
      const done = Number(req.nextUrl.searchParams.get("done")) || undefined;
      return NextResponse.json({ configured: true, ok: true, data: { board: await board(done), setting, isAdmin } });
    }
    if (part === "status") {
      return NextResponse.json({ configured: true, ok: true, data: await status(setting, isAdmin) });
    }
    if (part === "promises") {
      /* what the shelf can no longer cover, computed on the shelf as it stands */
      return NextResponse.json({ configured: true, ok: true, data: { broken: await brokenWithTickets(), isAdmin } });
    }
    if (part === "leftovers") {
      /* orders that are a leftover and nothing else, with the Lagerplatz and the mail AVOR would get */
      return NextResponse.json({ configured: true, ok: true, data: { ...(await fetchLeftovers()), isAdmin } });
    }
    if (part === "registry") {
      /* the numbers we minted, and the area a basket is sitting on - both were on the Railway dashboard */
      const q = (req.nextUrl.searchParams.get("q") || "").slice(0, 80);
      const [reg, hold] = await Promise.all([registry(q), holds()]);
      return NextResponse.json({ configured: true, ok: true, data: { registry: reg, holds: hold } });
    }
    return NextResponse.json({ configured: true, ok: false, error: "Unknown part.", status: 400 });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as {
    action?: string; url?: unknown; dry?: unknown; erpNo?: unknown;
    key?: unknown; stage?: unknown; from?: unknown; note?: unknown;
  };
  const me = await requireUser();
  const who = me.full_name || me.username;
  try {
    if (body.action === "gateway") {
      if (typeof body.url !== "string") return NextResponse.json({ ok: false, error: "No address given." }, { status: 400 });
      const setting = await setGateway(body.url, who);
      console.log(`[directcut] gateway address set to ${setting.url} by ${who}`);
      return NextResponse.json({ ok: true, data: { setting } });
    }
    if (body.action === "stage") {
      /* MOVING A LINE BY HAND (18.10.2026). The last reason the Railway dashboard had to stay open.
         The middleware still decides: it owns MANUAL_FROM and answers 409 if the move is not allowed.
         This checks the same rule first only so the person gets a sentence instead of a refusal, and
         because a button that cannot work should not be offered. */
      const key = String(body.key ?? "").slice(0, 64);
      const stage = String(body.stage ?? "");
      const from = String(body.from ?? "");
      const note = String(body.note ?? "").slice(0, 200);
      if (!key) return NextResponse.json({ ok: false, error: "No line given." }, { status: 400 });
      if (!canMove(from, stage)) {
        return NextResponse.json({ ok: false,
          error: `A line that is "${from}" cannot be moved to "${stage}".` }, { status: 400 });
      }
      if (!note.trim()) {
        /* a stage somebody set by hand, with no reason recorded, is indistinguishable later from a bug */
        return NextResponse.json({ ok: false, error: "Say why - it is recorded on the line." }, { status: 400 });
      }
      const data = await setStage(key, stage, `${note.trim()} — ${who}`);
      console.log(`[directcut] ${key}: ${from} -> ${stage} by ${who} (${note.trim()})`);
      return NextResponse.json({ ok: true, data });
    }
    if (body.action === "avor") {
      /* DRY UNLESS ASKED OTHERWISE: this reaches a shared mailbox a person reads, and a mail cannot be
         unsent. An order already told is never told twice (the kv remembers by A-number). */
      const dry = body.dry !== false;
      const erpNo = typeof body.erpNo === "string" ? body.erpNo : undefined;
      const data = await mailLeftovers({ dry, erpNo, who });
      console.log(`[directcut] AVOR mail ${dry ? "rehearsed" : "sent"} by ${who}: ` +
        `${data.sent} sent, ${data.already} already, ${data.skipped} skipped, ${data.failed} failed`);
      return NextResponse.json({ ok: true, data });
    }
    if (body.action === "tickets") {
      /* DRY UNLESS ASKED OTHERWISE. The thing this mails about cannot be unmailed, so a run that was
         meant to be a rehearsal must never create anything by accident: only an explicit dry === false
         writes. The dedupe is the ticket's own c2s_problem_order, which V1's 68 tickets also carry, so
         an order V1 already raised is not raised twice. */
      const dry = body.dry !== false;
      const data = await runPromiseTickets({ dry });
      console.log(`[directcut] promise tickets ${dry ? "rehearsed" : "raised"} by ${who}: ` +
        `${data.created} to create, ${data.existing} already there, ${data.failed} failed`);
      return NextResponse.json({ ok: true, data });
    }
    return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String((err as Error)?.message ?? err) }, { status: 502 });
  }
}
