// The Lifecycle reports: one page's view for the period asked, computed from
// its cached HubSpot read (src/lib/lifecycle/build.ts) and the shared email
// sends. The first request starts a read and is told it is running; the page
// asks again until it is done. UC & HubSpot Apps' own grant, like the pages.

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { hubspotToken } from "@/lib/integrations/status";
import { isViewKey, ucOf } from "@/lib/lifecycle/config";
import { emailState, overviewState, ucState } from "@/lib/lifecycle/build";
import { parseWin, toDay } from "@/lib/lifecycle/rules";
import { VIEWS, emailUcsOf, emailView, overviewView } from "@/lib/lifecycle/views";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type State = { computing: boolean; progress?: string; computedAt?: string; error?: string };
const stateOf = (s: State) => ({ computing: s.computing, progress: s.progress ?? null, computedAt: s.computedAt ?? null, error: s.error ?? null });

export async function GET(req: NextRequest, { params }: { params: Promise<{ view: string }> }) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  const { view: key } = await params;
  if (!isViewKey(key)) return NextResponse.json({ error: "Unknown report" }, { status: 404 });
  if (!hubspotToken()) return NextResponse.json({ ok: false, configured: false, missing: ["HUBSPOT_TOKEN"] });

  const today = toDay(Date.now()) as string;
  const sp = req.nextUrl.searchParams;
  const win = parseWin(sp.get("from"), sp.get("to"), today);
  try {
    // UC12 sends no email, so it does not wait for the email read
    const wantsEmails = key !== "uc12";
    if (key === "overview") {
      const main = await overviewState();
      const emails = await emailState();
      const view = main.value ? overviewView(main.value, emails.value ?? null, win) : null;
      return NextResponse.json({ ok: true, configured: true, view, emails: null, state: stateOf(main), emailState: stateOf(emails) });
    }
    const main = await ucState(key);
    const emails = wantsEmails ? await emailState() : null;
    const ev = emails?.value ?? null;
    const view = main.value ? VIEWS[key](main.value, ev, win) : null;
    const section = wantsEmails ? emailView(ev, emailUcsOf(key), win, ucOf(key).expectedSteps) : null;
    return NextResponse.json({
      ok: true, configured: true, view, emails: section, state: stateOf(main),
      emailState: emails ? stateOf(emails) : null,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, configured: true, error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}
