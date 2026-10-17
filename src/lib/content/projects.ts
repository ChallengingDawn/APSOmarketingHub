// CONTENT PROJECTS — the shared thing a draft belongs to.
//
// Create Studio produced one draft at a time, living in the browser of
// whoever pressed generate. A second opinion meant pasting into Teams; a
// second language meant starting over; comparing two openings meant two tabs
// and a memory. None of that is collaboration, and none of it is recoverable
// the next morning.
//
// A project is one brief with every variation under it and a conversation
// beside them. Variants are ordinary apsomh_content rows carrying a
// project_id, so everything the library already does to a piece of content —
// list it, render it, edit it, publish it — keeps working on a variation
// without a second model to maintain.
//
// Nothing is deleted. A rejected variation is half the record of why the
// chosen one is the chosen one.

import { query } from "@/lib/db/client";
import { ensureSchema } from "@/lib/db/init";

export type ProjectStatus = "open" | "decided" | "archived";

export type Project = {
  id: number;
  title: string;
  brief: string | null;
  /** The content type this project is for, from CONTENT_TYPES. */
  contentType: string | null;
  status: ProjectStatus;
  chosenVariantId: number | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  /** Filled by listProjects so a card can say "6 variations, 2 languages". */
  variantCount?: number;
  languages?: string[];
  commentCount?: number;
};

export type Variant = {
  id: number;
  projectId: number | null;
  contentType: string | null;
  channel: string;
  language: string | null;
  label: string | null;
  title: string | null;
  body: string;
  imageUrl: string | null;
  status: string;
  createdBy: string | null;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
};

export type Comment = {
  id: number;
  projectId: number;
  variantId: number | null;
  author: string;
  body: string;
  createdAt: string;
};

type ProjectRow = {
  id: number; title: string; brief: string | null; status: string;
  chosen_variant_id: number | null; created_by: string | null; content_type: string | null;
  created_at: Date; updated_at: Date;
  variant_count?: string; comment_count?: string; languages?: (string | null)[];
};

function toProject(r: ProjectRow): Project {
  return {
    id: r.id,
    title: r.title,
    brief: r.brief,
    contentType: r.content_type ?? null,
    status: (r.status as ProjectStatus) ?? "open",
    chosenVariantId: r.chosen_variant_id,
    createdBy: r.created_by,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
    variantCount: r.variant_count === undefined ? undefined : Number(r.variant_count),
    commentCount: r.comment_count === undefined ? undefined : Number(r.comment_count),
    languages: r.languages?.filter((l): l is string => !!l),
  };
}

type VariantRow = {
  id: number; project_id: number | null; content_type: string | null; channel: string;
  language: string | null; label: string | null; title: string | null; body: string;
  image_url: string | null; status: string; created_by: string | null;
  created_at: Date; updated_by: string | null; updated_at: Date;
};

function toVariant(r: VariantRow): Variant {
  return {
    id: r.id,
    projectId: r.project_id,
    contentType: r.content_type,
    channel: r.channel,
    language: r.language,
    label: r.label,
    title: r.title,
    body: r.body,
    imageUrl: r.image_url,
    status: r.status,
    createdBy: r.created_by,
    createdAt: new Date(r.created_at).toISOString(),
    updatedBy: r.updated_by,
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

export async function listProjects(limit = 50): Promise<Project[]> {
  await ensureSchema();
  const r = await query<ProjectRow>(
    `SELECT p.*,
            COUNT(DISTINCT c.id)                      AS variant_count,
            COUNT(DISTINCT m.id)                      AS comment_count,
            ARRAY_AGG(DISTINCT c.language)            AS languages
       FROM apsomh_content_projects p
       LEFT JOIN apsomh_content          c ON c.project_id = p.id
       LEFT JOIN apsomh_content_comments m ON m.project_id = p.id
      WHERE p.status <> 'archived'
      GROUP BY p.id
      ORDER BY p.updated_at DESC
      LIMIT $1`,
    [limit],
  );
  return r.rows.map(toProject);
}

export async function createProject(
  title: string,
  brief: string | null,
  by: string,
  contentType: string | null = null,
): Promise<Project> {
  await ensureSchema();
  const r = await query<ProjectRow>(
    `INSERT INTO apsomh_content_projects (title, brief, created_by, content_type)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [title.slice(0, 200), brief, by, contentType],
  );
  return toProject(r.rows[0]);
}

export async function getProject(
  id: number,
): Promise<{ project: Project; variants: Variant[]; comments: Comment[] } | null> {
  await ensureSchema();
  const p = await query<ProjectRow>(`SELECT * FROM apsomh_content_projects WHERE id = $1`, [id]);
  if (p.rows.length === 0) return null;

  const v = await query<VariantRow>(
    `SELECT * FROM apsomh_content WHERE project_id = $1 ORDER BY created_at ASC`,
    [id],
  );
  const c = await query<{ id: number; project_id: number; variant_id: number | null; author: string; body: string; created_at: Date }>(
    `SELECT * FROM apsomh_content_comments WHERE project_id = $1 ORDER BY created_at ASC`,
    [id],
  );

  return {
    project: toProject(p.rows[0]),
    variants: v.rows.map(toVariant),
    comments: c.rows.map((r) => ({
      id: r.id,
      projectId: r.project_id,
      variantId: r.variant_id,
      author: r.author,
      body: r.body,
      createdAt: new Date(r.created_at).toISOString(),
    })),
  };
}

/**
 * Saves a draft into a project as one more variation.
 *
 * The label is what a person calls it — "Shorter hero", "Marc's version" —
 * so a column of six reads without opening any of them. Defaulted to the
 * content type and language rather than "Variant 4", which tells a reader
 * only that there were three before it.
 */
export async function addVariant(v: {
  projectId: number;
  channel: string;
  contentType: string | null;
  language: string | null;
  label: string | null;
  title: string | null;
  body: string;
  imageUrl?: string | null;
  by: string;
}): Promise<Variant> {
  await ensureSchema();
  const r = await query<VariantRow>(
    `INSERT INTO apsomh_content
       (channel, content_type, language, label, title, body, image_url, project_id, created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)
     RETURNING *`,
    [
      v.channel, v.contentType, v.language, v.label, v.title, v.body,
      v.imageUrl ?? null, v.projectId, v.by,
    ],
  );
  await touch(v.projectId);
  return toVariant(r.rows[0]);
}

/**
 * Puts a draft that ALREADY EXISTS into a project.
 *
 * Create Studio writes every draft to apsomh_content as it generates, so the
 * row is there before anybody decides it is worth keeping. Attaching sets its
 * parent rather than inserting a copy — two rows with the same text and
 * different ids is how a library fills up with things nobody can tell apart.
 */
export async function attachVariant(
  projectId: number,
  contentId: number,
  label: string | null,
  by: string,
): Promise<Variant | null> {
  await ensureSchema();
  const r = await query<VariantRow>(
    `UPDATE apsomh_content
        SET project_id = $1,
            label = COALESCE($3, label),
            updated_by = $4,
            updated_at = NOW()
      WHERE id = $2
      RETURNING *`,
    [projectId, contentId, label, by],
  );
  if (r.rows.length === 0) return null;
  await touch(projectId);
  return toVariant(r.rows[0]);
}

export async function addComment(
  projectId: number,
  variantId: number | null,
  author: string,
  body: string,
): Promise<Comment> {
  await ensureSchema();
  const r = await query<{ id: number; created_at: Date }>(
    `INSERT INTO apsomh_content_comments (project_id, variant_id, author, body)
     VALUES ($1,$2,$3,$4) RETURNING id, created_at`,
    [projectId, variantId, author, body.slice(0, 4000)],
  );
  await touch(projectId);
  return {
    id: r.rows[0].id,
    projectId,
    variantId,
    author,
    body,
    createdAt: new Date(r.rows[0].created_at).toISOString(),
  };
}

/**
 * Marks which variation won.
 *
 * Choosing does not delete the others, and the project stays readable: the
 * argument for the chosen one is the comments under the ones that lost.
 */
/** Rename a project, or fix the brief it was started with. */
export async function updateProject(
  id: number,
  fields: { title?: string; brief?: string | null },
): Promise<void> {
  await ensureSchema();
  const sets: string[] = [];
  const values: unknown[] = [id];
  if (fields.title !== undefined) {
    values.push(fields.title.slice(0, 200));
    sets.push(`title = ${values.length}`);
  }
  if (fields.brief !== undefined) {
    values.push(fields.brief);
    sets.push(`brief = ${values.length}`);
  }
  if (sets.length === 0) return;
  await query(
    `UPDATE apsomh_content_projects SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $1`,
    values,
  );
}

/**
 * Put a project away, or bring it back.
 *
 * Archived, never deleted. A finished project is the record of why the thing
 * that shipped looks the way it does, and deleting it to tidy a list throws
 * that away permanently to save one row of screen.
 */
export async function archiveProject(id: number, archived: boolean): Promise<void> {
  await ensureSchema();
  await query(
    `UPDATE apsomh_content_projects
        SET status = $2, updated_at = NOW()
      WHERE id = $1`,
    [id, archived ? "archived" : "open"],
  );
}

/** Rename one version, so a column of six reads without opening any. */
export async function labelVariant(variantId: number, label: string, by: string): Promise<void> {
  await ensureSchema();
  await query(
    `UPDATE apsomh_content SET label = $2, updated_by = $3, updated_at = NOW() WHERE id = $1`,
    [variantId, label.slice(0, 120) || null, by],
  );
}

/**
 * Take a version out of a project.
 *
 * It leaves the project rather than being destroyed: project_id goes null and
 * the row stays in the library. Somebody removing the wrong one from a list
 * of six near-identical drafts is a question of when, not if, and a DELETE
 * would make that unrecoverable.
 */
export async function removeVariant(projectId: number, variantId: number): Promise<void> {
  await ensureSchema();
  await query(
    `UPDATE apsomh_content SET project_id = NULL, updated_at = NOW()
      WHERE id = $1 AND project_id = $2`,
    [variantId, projectId],
  );
  // A chosen version that has just left cannot still be the chosen one.
  await query(
    `UPDATE apsomh_content_projects SET chosen_variant_id = NULL, status = 'open'
      WHERE id = $1 AND chosen_variant_id = $2`,
    [projectId, variantId],
  );
  await touch(projectId);
}

/** Copy a version, as the starting point for a variation on it. */
export async function duplicateVariant(
  projectId: number,
  variantId: number,
  by: string,
): Promise<Variant | null> {
  await ensureSchema();
  const r = await query<VariantRow>(
    `INSERT INTO apsomh_content
       (channel, content_type, language, label, title, body, image_url, design_document, pages,
        project_id, created_by, updated_by)
     SELECT channel, content_type, language,
            COALESCE(label, 'Version') || ' (copy)',
            title, body, image_url, design_document, pages,
            project_id, $3, $3
       FROM apsomh_content
      WHERE id = $1 AND project_id = $2
     RETURNING *`,
    [variantId, projectId, by],
  );
  if (r.rows.length === 0) return null;
  await touch(projectId);
  return toVariant(r.rows[0]);
}

export async function chooseVariant(projectId: number, variantId: number | null): Promise<void> {
  await ensureSchema();
  await query(
    `UPDATE apsomh_content_projects
        SET chosen_variant_id = $2,
            status = CASE WHEN $2 IS NULL THEN 'open' ELSE 'decided' END,
            updated_at = NOW()
      WHERE id = $1`,
    [projectId, variantId],
  );
}

async function touch(projectId: number): Promise<void> {
  await query(`UPDATE apsomh_content_projects SET updated_at = NOW() WHERE id = $1`, [projectId]);
}
