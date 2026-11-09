// The A/B tests planned in Content's Page builder, read for Website > A/B testing (Content v7, 10.11.2026 - ./abPlanned.ts
// says what a row is). One read of the page studios' documents whose test is switched on; nothing is written.

import { query } from "@/lib/db/client";
import { ensureStudio } from "@/lib/content/studio/store";
import { plannedList, type PlannedRow, type PlannedTest } from "./abPlanned";

export async function plannedTests(): Promise<PlannedTest[]> {
  await ensureStudio();
  const r = await query<{ piece_id: number; project_id: number; project: string | null; title: string | null; status: string | null; writer: string | null; language: string | null; updated_at: Date; doc: unknown }>(
    `SELECT d.piece_id, pc.project_id, p.title AS project, pc.title, pc.status, pc.writer, pc.language, d.updated_at, d.doc
       FROM apsomh_content_piece_docs d
       JOIN apsomh_content_pieces pc ON pc.id = d.piece_id
       JOIN apsomh_content_projects p ON p.id = pc.project_id
      WHERE d.kind = 'page' AND d.doc -> 'abTest' ->> 'enabled' = 'true'
      ORDER BY d.updated_at DESC
      LIMIT 200`);
  const rows: PlannedRow[] = r.rows.map((x) => ({
    pieceId: x.piece_id, projectId: x.project_id, project: x.project, title: x.title, status: x.status, writer: x.writer, language: x.language,
    updatedAt: new Date(x.updated_at).toISOString(), doc: x.doc,
  }));
  return plannedList(rows);
}
