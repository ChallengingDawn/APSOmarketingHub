// Importing the customer-journey workbook.
//
// Two steps on purpose, because this file is a business document and an import
// that silently replaces it would be worse than no import at all:
//
//   POST /api/journey/import            → read the file, say what would change
//   POST /api/journey/import?apply=1    → the same, and then write it
//
// Nothing is stored by the preview, and the apply step re-reads the file rather
// than trusting anything the browser sends back.

import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { parseJourneyWorkbook } from "@/lib/journey/workbook";
import { previewImport } from "@/lib/journey/model";
import { loadJourney, saveJourney } from "@/lib/journey/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 12 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Attach the workbook as the field \"file\"." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: `The file is ${(file.size / 1e6).toFixed(1)} MB; the limit is 12 MB.` }, { status: 413 });
  }
  if (!/\.xlsx$/i.test(file.name)) {
    return NextResponse.json({ ok: false, error: "Only .xlsx workbooks can be read. Export the sheet from Excel first." }, { status: 415 });
  }

  let model;
  try {
    model = await parseJourneyWorkbook(await file.arrayBuffer(), {
      fileName: file.name,
      importedBy: user.email ?? "unknown",
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `The workbook could not be read: ${String((err as Error)?.message ?? err)}` },
      { status: 422 },
    );
  }

  const current = await loadJourney();
  const preview = previewImport(model, current);
  const apply = req.nextUrl.searchParams.get("apply") === "1";

  if (!apply) return NextResponse.json({ ok: true, applied: false, preview });

  if (!preview.ok) {
    return NextResponse.json(
      { ok: false, applied: false, preview, error: "The workbook has errors; fix them and upload again." },
      { status: 422 },
    );
  }

  try {
    await saveJourney(model);
  } catch (err) {
    return NextResponse.json(
      { ok: false, applied: false, preview, error: `Read fine, but storing it failed: ${String((err as Error)?.message ?? err)}` },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, applied: true, preview });
}
