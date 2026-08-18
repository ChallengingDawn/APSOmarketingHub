import { NextRequest, NextResponse } from "next/server";
import { addLogEntry, readLogs, setUserDefaults, type LogEntry } from "@/lib/logs";
import { getOptionalUser } from "@/lib/auth/guard";
import { BODY_LIMIT_MEDIUM, tooLarge } from "@/lib/httpGuard";

export const runtime = "nodejs";

const FIELD_CAP = 8 * 1024;

function cap(s: string | undefined): string | undefined {
  return typeof s === "string" ? s.slice(0, FIELD_CAP) : undefined;
}

export async function GET() {
  const file = await readLogs();
  return NextResponse.json(file);
}

export async function POST(req: NextRequest) {
  if (tooLarge(req, BODY_LIMIT_MEDIUM)) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const asRecord = body as Record<string, unknown>;

  if (asRecord?.action === "setUserDefaults" && typeof asRecord.text === "string") {
    // userDefaults is injected into the LLM system prompt for every user —
    // restrict editing to admins to prevent cross-user prompt injection.
    const u = await getOptionalUser();
    if (!u || u.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const file = await setUserDefaults(asRecord.text.slice(0, FIELD_CAP));
    return NextResponse.json(file);
  }

  const type = asRecord?.type;
  if (type !== "like" && type !== "dislike" && type !== "comment") {
    return NextResponse.json(
      { error: "type must be 'like', 'dislike' or 'comment'" },
      { status: 400 }
    );
  }

  const entry = await addLogEntry({
    type,
    channel: String(asRecord.channel ?? "").slice(0, 64),
    headline: cap(typeof asRecord.headline === "string" ? asRecord.headline : undefined),
    body: cap(typeof asRecord.body === "string" ? asRecord.body : undefined),
    prompt: cap(typeof asRecord.prompt === "string" ? asRecord.prompt : undefined),
    filters: (asRecord.filters as Record<string, unknown>) ?? undefined,
    correction: cap(typeof asRecord.correction === "string" ? asRecord.correction : undefined),
    note: cap(typeof asRecord.note === "string" ? asRecord.note : undefined),
  } as Omit<LogEntry, "id" | "ts">);

  return NextResponse.json({ entry });
}