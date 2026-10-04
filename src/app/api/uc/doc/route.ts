// DoC board: every web order whose customer ordered the seal Declaration of
// Conformity, where it stands, and the state of the service itself. Read-only.
// The same three answers as every integration route: not configured, upstream
// failed (with the reason), or the data.

import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { describeIntegrationError, hubspotToken } from "@/lib/integrations/status";
import { declarationBoard, readRuns, sentToday, type Runs } from "@/lib/doc/engine";
import {
  CAPTURE_EVERY_MIN, SWEEP_EVERY_MIN, captureFrom, captureOn, magentoConfigured, maxPerDay,
  missingForDocuments, sendingOn, smtpConfigured,
} from "@/lib/doc/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hubspotToken()) return NextResponse.json({ configured: false, missing: ["HUBSPOT_TOKEN"] });

  // The run record lives in Postgres; a database hiccup must not hide the board.
  let runs: Runs = {};
  let sent = 0;
  try {
    runs = await readRuns();
    sent = await sentToday();
  } catch {
    /* shown as "no run recorded" */
  }

  try {
    const board = await declarationBoard(req.nextUrl.searchParams.get("refresh") === "1");
    const from = captureFrom();
    return NextResponse.json({
      configured: true,
      ok: true,
      data: {
        board,
        service: {
          captureOn: captureOn(),
          sendingOn: sendingOn(),
          captureFrom: from ? new Date(from).toISOString() : null,
          smtpConfigured: smtpConfigured(),
          magentoConfigured: magentoConfigured(),
          missingForDocuments: missingForDocuments(),
          captureEveryMin: CAPTURE_EVERY_MIN,
          sweepEveryMin: SWEEP_EVERY_MIN,
          lastCapture: runs.lastCapture ?? null,
          lastSweep: runs.lastSweep ?? null,
          sentToday: sent,
          maxPerDay: maxPerDay(),
          isAdmin: user.role === "admin",
        },
      },
    });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) });
  }
}
