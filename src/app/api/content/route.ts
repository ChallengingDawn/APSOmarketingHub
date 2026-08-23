import { NextRequest, NextResponse } from "next/server";
import { isContentStatus, listContent, saveContent } from "@/lib/content";
import { getOptionalUser } from "@/lib/auth/guard";
import { BODY_LIMIT_LARGE, tooLarge } from "@/lib/httpGuard";

export const runtime = "nodejs";

const TITLE_CAP = 8 * 1024;
// Body may carry a full blog article; image URLs may be inline data URLs from
// the Gemini generator, hence the large caps (the request itself is bounded by
// BODY_LIMIT_LARGE).
const BODY_CAP = 256 * 1024;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const channel = sp.get("channel") ?? undefined;
  const status = sp.get("status") ?? undefined;
  const rawLimit = sp.get("limit");
  const limit = rawLimit ? Number.parseInt(rawLimit, 10) : undefined;
  const items = await listContent({
    channel: channel ? channel.slice(0, 32) : undefined,
    status: status ? status.slice(0, 24) : undefined,
    limit: Number.isFinite(limit) ? limit : undefined,
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  if (tooLarge(req, BODY_LIMIT_LARGE)) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const asRecord = body as Record<string, unknown>;

  const channel = typeof asRecord?.channel === "string" ? asRecord.channel.trim() : "";
  if (!channel) {
    return NextResponse.json({ error: "channel is required" }, { status: 400 });
  }
  const text = typeof asRecord?.body === "string" ? asRecord.body : "";
  if (!text.trim()) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }
  if (asRecord.status !== undefined && !isContentStatus(asRecord.status)) {
    return NextResponse.json(
      { error: "status must be 'draft', 'approved', 'published' or 'archived'" },
      { status: 400 }
    );
  }

  const user = await getOptionalUser();

  const item = await saveContent({
    channel: channel.slice(0, 32),
    title: typeof asRecord.title === "string" ? asRecord.title.slice(0, TITLE_CAP) : null,
    body: text.slice(0, BODY_CAP),
    imageUrl: typeof asRecord.imageUrl === "string" ? asRecord.imageUrl : null,
    filters:
      asRecord.filters && typeof asRecord.filters === "object" && !Array.isArray(asRecord.filters)
        ? (asRecord.filters as Record<string, unknown>)
        : null,
    status: isContentStatus(asRecord.status) ? asRecord.status : undefined,
    createdBy: user?.username ?? null,
  });

  return NextResponse.json({ item });
}
