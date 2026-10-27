// The way into a sandbox copy: /sso?t=<ticket> from the hub's Sandbox app (src/lib/sandbox/door.ts). A ticket opens a
// session once, within a minute, for a person the sandbox names; anything else goes to the sign-in page, which on a
// sandbox only says to open it from the hub. 404 on the hub itself.

import { NextRequest, NextResponse } from "next/server";
import { isSandbox } from "@/lib/sandbox/mode";
import { useTicket, userFor } from "@/lib/sandbox/door";
import { publicUrl } from "@/lib/sandbox/peopleList";
import { beginSession } from "@/lib/auth/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Where to send the browser: the sandbox's public address - on Railway req.url is the server's own 0.0.0.0:3000. */
function here(req: NextRequest, path: string): URL {
  const pub = publicUrl(process.env);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const base = pub ?? (host ? `${req.headers.get("x-forwarded-proto") ?? "https"}://${host}` : req.url);
  return new URL(path, base);
}

export async function GET(req: NextRequest) {
  if (!isSandbox()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const person = await useTicket(req.nextUrl.searchParams.get("t") ?? "");
  if (!person) return NextResponse.redirect(here(req, "/signin?expired=1"));
  const u = await userFor(person);
  await beginSession(u, req);
  return NextResponse.redirect(here(req, "/"));
}
