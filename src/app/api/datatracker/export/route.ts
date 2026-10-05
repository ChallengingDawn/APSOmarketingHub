// "Export to Excel" on every Datatracker tab (SARCLA, 05.10). The page sends
// exactly what it shows - its filters, sort and units already applied - and this
// writes it as a formatted .xlsx: title and filter lines, a banded header that
// names each column's source, the header frozen, an autofilter.
//
// Nothing is read here: the rows are the signed-in user's own screen, so the
// file can never hold more than they could already see. The limits below keep a
// malformed or oversized body from tying up the server.

import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { xlsx, type Cell, type Column, type Group, type Sheet } from "@/lib/xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SHEETS = 4;
const MAX_COLUMNS = 40;
const MAX_ROWS = 60_000;
const FORMATS = new Set(["int", "money", "pct1"]);
const TONES = new Set(["navy", "blue", "green", "slate"]);

const text = (v: unknown, max = 300) => (typeof v === "string" ? v.slice(0, max) : "");

function cleanSheet(raw: unknown): Sheet | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  const columns: Column[] = (Array.isArray(s.columns) ? s.columns : []).slice(0, MAX_COLUMNS).map((c) => {
    const o = (c ?? {}) as Record<string, unknown>;
    const width = typeof o.width === "number" && o.width > 0 && o.width < 120 ? o.width : undefined;
    const format = FORMATS.has(String(o.format)) ? (o.format as Column["format"]) : undefined;
    return { header: text(o.header, 80), width, format };
  });
  if (!columns.length) return null;
  const rows: Cell[][] = (Array.isArray(s.rows) ? s.rows : []).slice(0, MAX_ROWS).map((r) =>
    (Array.isArray(r) ? r : []).slice(0, columns.length).map((v): Cell =>
      typeof v === "number" ? (Number.isFinite(v) ? v : null) : typeof v === "string" ? v.slice(0, 2000) : null));
  const groups: Group[] = (Array.isArray(s.groups) ? s.groups : []).slice(0, MAX_COLUMNS).map((g) => {
    const o = (g ?? {}) as Record<string, unknown>;
    return {
      label: text(o.label, 120),
      span: Math.max(1, Math.min(MAX_COLUMNS, Math.floor(Number(o.span) || 1))),
      tone: TONES.has(String(o.tone)) ? (o.tone as Group["tone"]) : undefined,
    };
  });
  // bands that do not add up to the columns would sit over the wrong ones - drop them
  const spanned = groups.reduce((n, g) => n + g.span, 0);
  return {
    name: text(s.name, 31) || "Sheet",
    columns,
    rows,
    preamble: (Array.isArray(s.preamble) ? s.preamble : []).slice(0, 5).map((p) => text(p, 500)),
    groups: spanned === columns.length ? groups : undefined,
  };
}

export async function POST(req: NextRequest) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { filename?: unknown; sheets?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "The export request was not valid JSON." }, { status: 400 });
  }
  const sheets = (Array.isArray(body.sheets) ? body.sheets : []).slice(0, MAX_SHEETS).map(cleanSheet).filter((s): s is Sheet => !!s);
  if (!sheets.length) return NextResponse.json({ error: "Nothing to export." }, { status: 400 });

  const name = text(body.filename, 100);
  const filename = /^[\w.-]{1,90}\.xlsx$/.test(name) ? name : "datatracker.xlsx";
  return new NextResponse(new Uint8Array(xlsx(sheets)), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
