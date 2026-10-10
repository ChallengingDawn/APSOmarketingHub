// SEO ACTIONS — started, measured, dropped.
//
// Reading is open to anyone who can open the Marketing app; writing needs the
// same app at write level, because starting an action puts somebody's name
// against a piece of work and a viewer should not be able to do that.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { myAccess } from "@/lib/auth/appAccess";
import { requireUser } from "@/lib/auth/guard";
import { dropAction, listActions, measureAction, startAction } from "@/lib/seo/actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Start = z.object({
  kind: z.literal("start"),
  itemId: z.string().trim().min(1).max(300),
  source: z.string().trim().min(1).max(32),
  subject: z.string().trim().min(1).max(500),
  action: z.string().trim().min(1).max(500),
  eurosEstimated: z.number().finite().nonnegative().nullable(),
  baselineClicks: z.number().int().nonnegative().nullable(),
  baselineImpressions: z.number().int().nonnegative().nullable(),
  baselinePosition: z.number().finite().positive().nullable(),
  windowDays: z.number().int().positive().max(400),
});

const Measure = z.object({
  kind: z.literal("measure"),
  id: z.number().int().positive(),
  clicks: z.number().int().nonnegative().nullable(),
  impressions: z.number().int().nonnegative().nullable(),
  position: z.number().finite().positive().nullable(),
});

const Drop = z.object({
  kind: z.literal("drop"),
  id: z.number().int().positive(),
  // The reason is required: "what we decided not to do, and why" is the half
  // that stops the same idea being proposed again next quarter.
  reason: z.string().trim().min(3).max(500),
});

const Body = z.discriminatedUnion("kind", [Start, Measure, Drop]);

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("marketing")) {
    return NextResponse.json({ error: "You do not have the Marketing app." }, { status: 403 });
  }
  return NextResponse.json({ ok: true, actions: await listActions() });
}

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canWrite("marketing")) {
    return NextResponse.json(
      { ok: false, error: "Your account can read the SEO work but not record it." },
      { status: 403 },
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "That is not a valid action." },
      { status: 400 },
    );
  }
  const body = parsed.data;

  if (body.kind === "start") {
    const { kind: _k, ...input } = body;
    void _k;
    // The name on the row is the signed-in person's, never anything the client
    // sent: this is a record of who did the work.
    const me = await requireUser();
    return NextResponse.json({ ok: true, action: await startAction(input, me.username) });
  }

  if (body.kind === "measure") {
    const action = await measureAction(body.id, {
      clicks: body.clicks, impressions: body.impressions, position: body.position,
    });
    if (!action) {
      return NextResponse.json(
        { ok: false, error: "That action was already measured or dropped." },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: true, action });
  }

  const dropped = await dropAction(body.id, body.reason);
  if (!dropped) {
    return NextResponse.json(
      { ok: false, error: "That action was already measured or dropped." },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true, action: dropped });
}
