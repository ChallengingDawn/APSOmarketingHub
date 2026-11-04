// "Bespoke checks" beside the action plan (SARCLA 04.11.2026), admins only as the plan (../guard.ts):
//   GET                                       Bespoke's 137 checks, each with the sub-action that tracks it as the plan has it
//                                             now; the set-up of the plan (bespoke.ts) starts by itself while something is
//                                             still to make, and the page shows how far it got
//   POST  {action:"setup"}                    the missing sub-actions and tickets made now ("Make the missing sub-actions")
//   PATCH {id, validation?, feedback?}        Bespoke's own two columns, typed when they answer
import { NextRequest, NextResponse } from "next/server";
import { bespokeView, isCheck, setAnswer, startBespokeSetup } from "@/lib/reporting/bespoke";
import { freshFromTickets } from "@/lib/reporting/actionPlanHubspot";
import { fail } from "../../reporting/kpi-actions/guard";
import { planWho as who } from "../guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const w = await who();
  if (w instanceof NextResponse) return w;
  try {
    // what changed on the tickets comes in first (at most once a minute, a few seconds at most)
    await freshFromTickets();
    let view = await bespokeView();
    if (!view) return fail("Bespoke's check is not in this copy of the hub", 404);
    if (view.setup.missing && !view.setup.running) {
      startBespokeSetup(w.name);
      view = { ...view, setup: { ...view.setup, running: true } };
    }
    return NextResponse.json(view);
  } catch (e) { return fail(e); }
}

export async function POST(req: NextRequest) {
  const w = await who(true);
  if (w instanceof NextResponse) return w;
  const b = (await req.json().catch(() => ({}))) as { action?: string };
  if (b.action !== "setup") return fail("action is setup", 400);
  try {
    startBespokeSetup(w.name);
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e); }
}

export async function PATCH(req: NextRequest) {
  const w = await who(true);
  if (w instanceof NextResponse) return w;
  const b = (await req.json().catch(() => ({}))) as { id?: unknown; validation?: unknown; feedback?: unknown };
  const id = Number(b.id);
  if (!Number.isInteger(id) || !(await isCheck(id))) return fail("id is one of Bespoke's checks", 400);
  for (const k of ["validation", "feedback"] as const) if (b[k] !== undefined && typeof b[k] !== "string") return fail(`${k} is text`, 400);
  if (b.validation === undefined && b.feedback === undefined) return fail("nothing to save", 400);
  try {
    await setAnswer(id, {
      ...(typeof b.validation === "string" ? { validation: b.validation.slice(0, 40) } : {}),
      ...(typeof b.feedback === "string" ? { feedback: b.feedback.slice(0, 4000) } : {}),
    }, w.name);
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e); }
}
