import { NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { envDiagnostics, integrationStatus } from "@/lib/integrations/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // env holds names, lengths and shapes only — never a secret value.
  return NextResponse.json({ integrations: integrationStatus(), env: envDiagnostics() });
}
