import { z } from "zod";
import { designDocumentSchema } from "./design-document";

export const contentPatchSchema = z.object({
  expectedRevision: z.number().int().positive(),
  title: z.string().max(300).nullable().optional(),
  body: z.string().max(200000).refine((s) => s.trim().length > 0, "Content cannot be empty").optional(),
  imageUrl: z.string().max(8 * 1024 * 1024).nullable().optional(),
  designDocument: designDocumentSchema.nullable().optional(),
  status: z.enum(["draft", "approved", "published", "archived"]).optional(),
  scheduledFor: z.string().datetime({ offset: true }).nullable().optional(),
}).strict().refine((p) => Object.keys(p).length > 1, "Nothing to update");

export type ContentEdit = z.infer<typeof contentPatchSchema>;

export function canEditContent(role: string): boolean {
  return role === "admin" || role === "user";
}

export function changesCreative(patch: Omit<ContentEdit, "expectedRevision">): boolean {
  return ["title", "body", "imageUrl", "designDocument"].some((key) => key in patch);
}

// Kept independent of Next.js so the real PostgreSQL update can be exercised in
// isolation. The row lock, revision comparison and history write are one atomic
// statement; two writers starting at the same revision cannot both succeed.
export function contentUpdateStatement(id: number, edit: ContentEdit, actor: string) {
  const values: unknown[] = [id, edit.expectedRevision, actor];
  const sets: string[] = [];
  const add = (column: string, value: unknown, cast = "") => {
    values.push(value);
    sets.push(`${column} = $${values.length}${cast}`);
  };
  if (edit.title !== undefined) add("title", edit.title);
  if (edit.body !== undefined) add("body", edit.body);
  if (edit.imageUrl !== undefined) add("image_url", edit.imageUrl);
  if (edit.designDocument !== undefined) add("design_document", JSON.stringify(edit.designDocument), "::jsonb");
  if (edit.scheduledFor !== undefined) add("scheduled_for", edit.scheduledFor, "::timestamptz");
  // A creative edit always requires fresh approval, including edits to a piece
  // previously marked published. Its previous approved/published state is kept
  // in history. Do not allow a PATCH to change copy and approve it together.
  if (changesCreative(edit)) sets.push("status = CASE WHEN current.status = 'archived' THEN 'archived' ELSE 'draft' END");
  else if (edit.status !== undefined) add("status", edit.status);
  return {
    values,
    text: `WITH current AS MATERIALIZED (
      SELECT * FROM apsomh_content WHERE id = $1 AND revision = $2 FOR UPDATE
    ), history AS (
      INSERT INTO apsomh_content_revisions (content_id, revision, snapshot, replaced_by)
      SELECT id, revision, to_jsonb(current), $3 FROM current
      RETURNING content_id
    )
    UPDATE apsomh_content AS target SET ${sets.join(", ")},
      revision = current.revision + 1, updated_by = $3, updated_at = NOW()
    FROM current, history
    WHERE target.id = current.id AND history.content_id = current.id
    RETURNING target.*`,
  };
}
