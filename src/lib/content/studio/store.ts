// A TO-DO'S STUDIO DOCUMENT, STORED (08.11.2026). One row per piece: its kind, the document, a revision number that moves
// with every save. Changes arrive as small ops (doc.ts) and are laid over the document as it is now, in one transaction,
// so two people saving at once both keep their change. "Save a version" copies the document into the project's versions
// (apsomh_content, with piece_id) - the versions the project page counts and the versions page lists.
// Created on first use, after the workflow's tables - never from inside ensureSchema.

import { getPool, query } from "@/lib/db/client";
import { ensureWorkflow } from "@/lib/content/workflow";
import { DOC_MAX_BYTES, applyWithRoot, type Op } from "./doc";
import type { StudioKind } from "./kinds";

let ready: Promise<void> | null = null;

export function ensureStudio(): Promise<void> {
  ready ??= (async () => {
    await ensureWorkflow();
    await query(`
      CREATE TABLE IF NOT EXISTS apsomh_content_piece_docs (
        piece_id INTEGER PRIMARY KEY REFERENCES apsomh_content_pieces(id) ON DELETE CASCADE,
        kind VARCHAR(16) NOT NULL,
        doc JSONB NOT NULL,
        rev INTEGER NOT NULL DEFAULT 1,
        updated_by VARCHAR(255),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    // a version made in a studio carries the studio's document beside its text
    await query(`ALTER TABLE apsomh_content ADD COLUMN IF NOT EXISTS piece_doc JSONB`);
  })().catch((e) => { ready = null; throw e; });
  return ready;
}

export type StoredDoc = { kind: StudioKind; doc: unknown; rev: number; updatedBy: string | null; updatedAt: string };

export async function readDoc(pieceId: number): Promise<StoredDoc | null> {
  await ensureStudio();
  const r = await query<{ kind: StudioKind; doc: unknown; rev: number; updated_by: string | null; updated_at: Date }>(
    `SELECT kind, doc, rev, updated_by, updated_at FROM apsomh_content_piece_docs WHERE piece_id = $1`, [pieceId]);
  const x = r.rows[0];
  return x ? { kind: x.kind, doc: x.doc, rev: x.rev, updatedBy: x.updated_by, updatedAt: new Date(x.updated_at).toISOString() } : null;
}

/** The document, made from the kind's empty one the first time the studio opens. */
export async function docOrNew(pieceId: number, kind: StudioKind, empty: () => unknown, by: string): Promise<StoredDoc> {
  const found = await readDoc(pieceId);
  if (found && found.kind === kind) return found;
  await query(
    `INSERT INTO apsomh_content_piece_docs (piece_id, kind, doc, rev, updated_by) VALUES ($1, $2, $3, 1, $4)
     ON CONFLICT (piece_id) DO UPDATE SET kind = EXCLUDED.kind, doc = EXCLUDED.doc, rev = apsomh_content_piece_docs.rev + 1, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
    [pieceId, kind, JSON.stringify(empty()), by]);
  return (await readDoc(pieceId))!;
}

/** Lays the changes over the stored document; refuses one that would make it too heavy. */
export async function saveOps(pieceId: number, ops: Op[], by: string): Promise<{ ok: true; rev: number; doc: unknown } | { ok: false; error: string }> {
  await ensureStudio();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const r = await client.query<{ doc: unknown; rev: number }>(`SELECT doc, rev FROM apsomh_content_piece_docs WHERE piece_id = $1 FOR UPDATE`, [pieceId]);
    if (!r.rows[0]) { await client.query("ROLLBACK"); return { ok: false, error: "The studio has no document for this to-do yet - open it again." }; }
    const next = applyWithRoot(r.rows[0].doc, ops);
    const text = JSON.stringify(next);
    if (text.length > DOC_MAX_BYTES) { await client.query("ROLLBACK"); return { ok: false, error: "This would make the document too heavy - put big pictures in the file library, not in the text." }; }
    const u = await client.query<{ rev: number }>(
      `UPDATE apsomh_content_piece_docs SET doc = $2, rev = rev + 1, updated_by = $3, updated_at = NOW() WHERE piece_id = $1 RETURNING rev`,
      [pieceId, text, by]);
    await client.query("COMMIT");
    return { ok: true, rev: u.rows[0].rev, doc: next };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}

/** A version of the piece: the document as it is now, with its text, in the project's versions. */
export async function saveVersion(p: {
  projectId: number; pieceId: number; contentType: string | null; language: string | null; label: string | null;
  title: string; text: string; doc: unknown; channel: string; by: string;
}): Promise<number> {
  await ensureStudio();
  const r = await query<{ id: number }>(
    `INSERT INTO apsomh_content (channel, title, body, status, created_by, project_id, piece_id, content_type, language, label, piece_doc)
     VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
    [p.channel, p.title.slice(0, 300), p.text || " ", p.by, p.projectId, p.pieceId, p.contentType, p.language, p.label, JSON.stringify(p.doc)]);
  await query(`UPDATE apsomh_content_projects SET updated_at = NOW() WHERE id = $1`, [p.projectId]);
  return r.rows[0].id;
}

/**
 * A studio's automatic version, kept just before an AI change so its "Changes made here" can take it back after a
 * reload (09.11.2026). Its label starts with this; the Content Library leaves these out, and a piece keeps its newest
 * AUTO_KEEP of them.
 */
export const AUTO_VERSION = "Before the AI:";
export const AUTO_KEEP = 20;
export async function pruneAutoVersions(pieceId: number, keep = AUTO_KEEP): Promise<void> {
  await ensureStudio();
  await query(
    `DELETE FROM apsomh_content WHERE piece_id = $1 AND piece_doc IS NOT NULL AND label LIKE $2
       AND id NOT IN (SELECT id FROM apsomh_content WHERE piece_id = $1 AND piece_doc IS NOT NULL AND label LIKE $2 ORDER BY id DESC LIMIT $3)`,
    [pieceId, `${AUTO_VERSION}%`, keep]);
}

/** The piece's versions made in its studio, newest first - their document, to look back or restore. */
export async function studioVersions(pieceId: number): Promise<{ id: number; label: string | null; by: string | null; at: string; doc: unknown }[]> {
  await ensureStudio();
  const r = await query<{ id: number; label: string | null; created_by: string | null; created_at: Date; piece_doc: unknown }>(
    `SELECT id, label, created_by, created_at, piece_doc FROM apsomh_content WHERE piece_id = $1 AND piece_doc IS NOT NULL ORDER BY created_at DESC LIMIT 50`, [pieceId]);
  return r.rows.map((x) => ({ id: x.id, label: x.label, by: x.created_by, at: new Date(x.created_at).toISOString(), doc: x.piece_doc }));
}
