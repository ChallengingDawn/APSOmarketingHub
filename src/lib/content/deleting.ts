// DELETING A CONTENT PROJECT, AND BRINGING IT BACK (SARCLA 08.11.2026: "I should be able to delete projects").
// The rules are deleteRules.ts. A soft delete: the row stays with deleted_at / deleted_by / the status it had, and its
// status becomes 'archived' meanwhile - so every list that already leaves archived projects out (the board, what waits
// for whom, the blog's home, the old project list) leaves it out as well, and accessFor refuses it to everyone, which
// closes its page, its studios and its routes. Nothing else is changed: its to-dos, their studio documents, their plan
// sub-actions and their HubSpot tickets stay exactly as they are, so bringing it back brings all of it back.

import { query } from "@/lib/db/client";
import { ensureSharing } from "@/lib/content/sharing";
import { ensureWorkflow } from "@/lib/content/workflow";
import { ensureStudio } from "@/lib/content/studio/store";
import { ticketsOf } from "@/lib/reporting/kpiActions";
import { todoTile } from "@/lib/content/todos";
import { restoredStatus, type DeleteCounts } from "@/lib/content/deleteRules";

/** The project as the rules need it - null when there is no such project, or it is deleted already. */
export async function liveProject(id: number): Promise<{ id: number; title: string; createdBy: string | null } | null> {
  await ensureSharing();
  const r = await query<{ id: number; title: string; created_by: string | null }>(
    `SELECT id, title, created_by FROM apsomh_content_projects WHERE id = $1 AND deleted_at IS NULL`, [id]);
  const x = r.rows[0];
  return x ? { id: x.id, title: x.title, createdBy: x.created_by } : null;
}

/** What would go and what would stay: its to-dos, the studio documents made, its tickets, the versions kept. */
export async function deleteCounts(id: number): Promise<DeleteCounts> {
  await ensureStudio();
  const r = await query<{ todos: string; documents: string; versions: string }>(
    `SELECT (SELECT COUNT(*) FROM apsomh_content_pieces pc WHERE pc.project_id = $1) AS todos,
            (SELECT COUNT(*) FROM apsomh_content_piece_docs d JOIN apsomh_content_pieces pc ON pc.id = d.piece_id WHERE pc.project_id = $1) AS documents,
            (SELECT COUNT(*) FROM apsomh_content c WHERE c.project_id = $1) AS versions`, [id]);
  // the tickets are only counted, from the hub's own links - HubSpot is not asked
  const tickets = await ticketsOf(todoTile(id)).then((t) => t.length).catch(() => 0);
  const x = r.rows[0];
  return { todos: Number(x?.todos ?? 0), documents: Number(x?.documents ?? 0), versions: Number(x?.versions ?? 0), tickets };
}

export async function softDeleteProject(id: number, by: string): Promise<boolean> {
  await ensureSharing();
  const r = await query<{ id: number }>(
    `UPDATE apsomh_content_projects
        SET deleted_at = NOW(), deleted_by = $2, deleted_status = status, status = 'archived'
      WHERE id = $1 AND deleted_at IS NULL RETURNING id`, [id, by]);
  if (!r.rows.length) return false;
  await ensureWorkflow();
  await query(`INSERT INTO apsomh_content_events (project_id, piece_id, actor, kind, detail) VALUES ($1, NULL, $2, 'deleted', '{}')`, [id, by]);
  return true;
}

export async function restoreProject(id: number, by: string): Promise<boolean> {
  await ensureSharing();
  const before = await query<{ deleted_status: string | null }>(
    `SELECT deleted_status FROM apsomh_content_projects WHERE id = $1 AND deleted_at IS NOT NULL`, [id]);
  if (!before.rows.length) return false;
  await query(
    `UPDATE apsomh_content_projects
        SET status = $2, deleted_at = NULL, deleted_by = NULL, deleted_status = NULL, updated_at = NOW()
      WHERE id = $1`, [id, restoredStatus(before.rows[0].deleted_status)]);
  await ensureWorkflow();
  await query(`INSERT INTO apsomh_content_events (project_id, piece_id, actor, kind, detail) VALUES ($1, NULL, $2, 'restored', '{}')`, [id, by]);
  return true;
}

export type DeletedProject = {
  id: number; title: string; owner: string | null; ownerName: string | null; deletedAt: string; deletedBy: string | null;
  deletedByName: string | null; todos: number;
};

/** Every deleted project, the newest first - for an admin to bring one back. */
export async function deletedProjects(): Promise<DeletedProject[]> {
  await ensureWorkflow();
  const r = await query<{ id: number; title: string; created_by: string | null; owner_name: string | null; deleted_at: Date; deleted_by: string | null; by_name: string | null; todos: string }>(
    `SELECT p.id, p.title, p.created_by, ou.full_name AS owner_name, p.deleted_at, p.deleted_by, du.full_name AS by_name,
            (SELECT COUNT(*) FROM apsomh_content_pieces pc WHERE pc.project_id = p.id) AS todos
       FROM apsomh_content_projects p
       LEFT JOIN apsomh_users ou ON ou.username = p.created_by
       LEFT JOIN apsomh_users du ON du.username = p.deleted_by
      WHERE p.deleted_at IS NOT NULL
      ORDER BY p.deleted_at DESC LIMIT 200`);
  return r.rows.map((x) => ({
    id: x.id, title: x.title, owner: x.created_by, ownerName: x.owner_name || x.created_by, deletedAt: new Date(x.deleted_at).toISOString(),
    deletedBy: x.deleted_by, deletedByName: x.by_name || x.deleted_by, todos: Number(x.todos),
  }));
}
