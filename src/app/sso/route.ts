// The way into a sandbox copy: /sso?t=<ticket> from the hub's Sandbox app (src/lib/sandbox/door.ts). A ticket opens a
// session once, within a minute, for a person the sandbox names; anything else goes to the sign-in page, which on a
// sandbox only says to open it from the hub. 404 on the hub itself.

import { NextRequest, NextResponse } from "next/server";
import { isSandbox } from "@/lib/sandbox/mode";
import { useTicket, userFor } from "@/lib/sandbox/door";
import { beginSession } from "@/lib/auth/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isSandbox()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const person = await useTicket(req.nextUrl.searchParams.get("t") ?? "");
  if (!person) return NextResponse.redirect(new URL("/signin?expired=1", req.url));
  const u = await userFor(person);
  await beginSession(u, req);
  return NextResponse.redirect(new URL("/", req.url));
}
