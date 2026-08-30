import { NextRequest, NextResponse } from "next/server";
import { getContent } from "@/lib/content";

export const runtime = "nodejs";

// Generated visuals are stored as base64 data URLs, and they are large. Sending
// them inline with every list response made the Overview, Library and GEO
// pages pull tens of megabytes on each visit. This endpoint serves the bytes
// for ONE piece instead, so lists carry a short reference and the browser
// fetches images lazily and caches them. The list puts the piece's updated_at
// in ?v=, which is why the response can be marked immutable.

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

const DATA_URL = /^data:([^;,]+)?((?:;[^;,]+)*?)(;base64)?,([\s\S]*)$/;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  let stored: string | null;
  try {
    const item = await getContent(id);
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    stored = item.imageUrl;
  } catch (err) {
    console.error("[content:id:image] GET error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  if (!stored) return NextResponse.json({ error: "No visual" }, { status: 404 });

  // Older rows hold a path or an absolute URL rather than inline bytes.
  if (!stored.startsWith("data:")) {
    return NextResponse.redirect(new URL(stored, req.nextUrl.origin), 302);
  }

  const m = DATA_URL.exec(stored);
  if (!m) return NextResponse.json({ error: "Unreadable visual" }, { status: 422 });
  const mime = m[1] || "application/octet-stream";
  const bytes = m[3] ? Buffer.from(m[4], "base64") : Buffer.from(decodeURIComponent(m[4]), "utf8");

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
