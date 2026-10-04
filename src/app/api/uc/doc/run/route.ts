// Run a DoC job now instead of waiting for the timer: ?job=capture or ?job=sweep.
//
// Admins, or a scheduler carrying INTERNAL_API_KEY. It takes the same lock as the
// timer, so a click can never race the hourly sweep into a second email, and it
// refuses a job this deployment does not own - the switches are DOC_CAPTURE_FROM
// and DOC_SEND_EMAIL, never a button.

import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { capture, sweep } from "@/lib/doc/engine";
import { withDocLock } from "@/lib/doc/scheduler";
import { captureOn, sendingOn } from "@/lib/doc/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const key = process.env.INTERNAL_API_KEY;
  const viaKey = !!key && req.headers.get("x-internal-key") === key;
  if (!viaKey) {
    const user = await getOptionalUser();
    if (!user) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  }

  const job = req.nextUrl.searchParams.get("job");
  if (job !== "capture" && job !== "sweep") {
    return NextResponse.json({ ok: false, error: "job=capture or job=sweep." }, { status: 400 });
  }
  if (job === "capture" && !captureOn()) {
    return NextResponse.json({ ok: false, error: "Capture is off here: DOC_CAPTURE_FROM is not set." }, { status: 409 });
  }
  if (job === "sweep" && !sendingOn()) {
    return NextResponse.json({ ok: false, error: "Sending is off here: DOC_SEND_EMAIL is not 1." }, { status: 409 });
  }

  try {
    const result = await withDocLock<unknown>(() => (job === "capture" ? capture() : sweep()));
    if (result === null) {
      return NextResponse.json({ ok: false, error: "Another run holds the lock - try again in a minute." }, { status: 409 });
    }
    return NextResponse.json({ ok: true, job, result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 502 });
  }
}
