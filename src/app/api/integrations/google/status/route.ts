// Whether an OAuth client exists, and whose account the hub is borrowing.
// Never the token — only who and when.

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { oauthConfigured, userConnection } from "@/lib/integrations/googleUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdmin();
  return NextResponse.json({
    ok: true,
    configured: oauthConfigured(),
    connection: await userConnection(),
  });
}
