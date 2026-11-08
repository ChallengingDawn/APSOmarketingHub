// CONTENT PROJECTS AS A TEAM'S WORK: THE DATA (SARCLA 07.11.2026: "this should look like a collaborative project").
//
//   pieces   what a project puts out - each with a writer, a reviewer, a status and a date (apsomh_content_pieces).
//            Its versions are the apsomh_content rows the studio already saves, now carrying the piece's id.
//   events   what happened, for the project's activity stream beside its comments (apsomh_content_events).
//   brief    the brief as fields everybody writes against (goal, who for, key message, keywords, channels).
//
// The project's stage is never stored: it is where its pieces are (pieceRules.stageOf).
// Tables are created here on first use, after ensureSharing - never from inside ensureSchema.

import { query } from "@/lib/db/client";
import { ensureSharing } from "@/lib/content/sharing";
import { isPieceStatus, stageOf, type PieceStatus, type Stage } from "@/lib/content/pieceRules";
import { CONTENT_BY_KEY } from "@/lib/content/contentTypes";
import { contentTypeForPage, markerOf } from "@/lib/convert/handoff";
import { classify } from "@/lib/convert/model";

export type Brief = {
  goal: string;
  audience: string;
  message: string;
  keywords: string[];
  channels: string[];
};
export const EMPTY_BRIEF: Brief = { goal: "", audience: "", message: "", keywords: [], channels: [] };

export type Piece = {
  id: number;
  projectId: number;
  contentType: string | null;
  language: string | null;
  title: string;
  writer: string | null;
  reviewer: string | null;
  status: PieceStatus;
  /** "YYYY-MM-DD" or null. */
  dueDate: string | null;
  versions: number;
  lastVersionAt: string | null;
  lastVersionBy: string | null;
  /** Its Action plan sub-action (apsomh_kpi_tasks.id), which carries its ticket. */
  taskId: number | null;
};

export type ContentEvent = {
  id: number;
  projectId: number;
  pieceId: number | null;
  actor: string;
  kind: string;
  detail: Record<string, unknown>;
  createdAt: string;
};

let ready: Promise<void> | null = null;

export function ensureWorkflow(): Promise<void> {
  ready ??= (async () => {
    await ensureSharing();
    await query(`ALTER TABLE apsomh_content_projects ADD COLUMN IF NOT EXISTS brief_fields JSONB`);
    // where the idea came from (seo, geo, aeo, sea, team) - shown on the board
    await query(`ALTER TABLE apsomh_content_projects ADD COLUMN IF NOT EXISTS source VARCHAR(16)`);
    // the Action plan action its to-dos sit under (apsomh_action_plan.id) - the to-dos are that action's sub-actions
    await query(`ALTER TABLE apsomh_content_projects ADD COLUMN IF NOT EXISTS plan_item INTEGER`);
    await query(`
      CREATE TABLE IF NOT EXISTS apsomh_content_pieces (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES apsomh_content_projects(id) ON DELETE CASCADE,
        content_type VARCHAR(48),
        language VARCHAR(8),
        title TEXT NOT NULL,
        writer VARCHAR(255),
        reviewer VARCHAR(255),
        status VARCHAR(16) NOT NULL DEFAULT 'todo',
        due_date DATE,
        sort INTEGER NOT NULL DEFAULT 0,
        created_by VARCHAR(255),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_apsomh_content_pieces_project ON apsomh_content_pieces(project_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_apsomh_content_pieces_writer ON apsomh_content_pieces(writer)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_apsomh_content_pieces_reviewer ON apsomh_content_pieces(reviewer)`);
    await query(`ALTER TABLE apsomh_content ADD COLUMN IF NOT EXISTS piece_id INTEGER`);
    // a piece IS a to-do (08.11.2026): its Action plan sub-action, the row of apsomh_kpi_tasks that carries its ticket
    await query(`ALTER TABLE apsomh_content_pieces ADD COLUMN IF NOT EXISTS task_id INTEGER`);
    await query(`
      CREATE TABLE IF NOT EXISTS apsomh_content_events (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES apsomh_content_projects(id) ON DELETE CASCADE,
        piece_id INTEGER,
        actor VARCHAR(255) NOT NULL,
        kind VARCHAR(24) NOT NULL,
        detail JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_apsomh_content_events_project ON apsomh_content_events(project_id, created_at)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_apsomh_content_events_mention ON apsomh_content_events((detail->>'to')) WHERE kind = 'mention'`);
  })().catch((e) => { ready = null; throw e; });
  return ready;
}

const str = (v: unknown, max = 600) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const list = (v: unknown) => (Array.isArray(v) ? v : []).map((x) => str(x, 80)).filter(Boolean).slice(0, 20);

/** A brief from whatever was posted or stored - unknown keys dropped, lengths capped. */
export function cleanBrief(v: unknown): Brief {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return { goal: str(o.goal), audience: str(o.audience), message: str(o.message), keywords: list(o.keywords), channels: list(o.channels) };
}

type PieceRow = {
  id: number; project_id: number; content_type: string | null; language: string | null; title: string;
  writer: string | null; reviewer: string | null; status: string; due_iso: string | null;
  versions: string; last_at: Date | null; last_by: string | null; task_id: number | null;
};
const toPiece = (r: PieceRow): Piece => ({
  id: r.id, projectId: r.project_id, contentType: r.content_type, language: r.language, title: r.title,
  writer: r.writer, reviewer: r.reviewer, status: isPieceStatus(r.status) ? r.status : "todo", dueDate: r.due_iso,
  versions: Number(r.versions ?? 0), lastVersionAt: r.last_at ? new Date(r.last_at).toISOString() : null, lastVersionBy: r.last_by,
  taskId: r.task_id ?? null,
});

const PIECE_SELECT = `
  SELECT pc.id, pc.project_id, pc.content_type, pc.language, pc.title, pc.writer, pc.reviewer, pc.status, pc.task_id,
         TO_CHAR(pc.due_date, 'YYYY-MM-DD') AS due_iso,
         (SELECT COUNT(*) FROM apsomh_content c WHERE c.piece_id = pc.id) AS versions,
         (SELECT MAX(c.created_at) FROM apsomh_content c WHERE c.piece_id = pc.id) AS last_at,
         (SELECT c.created_by FROM apsomh_content c WHERE c.piece_id = pc.id ORDER BY c.created_at DESC LIMIT 1) AS last_by
    FROM apsomh_content_pieces pc`;

/**
 * A project made before pieces existed has versions and no piece: give it one piece per kind and language of its
 * versions, once, so nothing written before is lost from the new page.
 */
async function piecesFromVersions(projectId: number): Promise<void> {
  const have = await query(`SELECT 1 FROM apsomh_content_pieces WHERE project_id = $1 LIMIT 1`, [projectId]);
  if (have.rows.length) return;
  const groups = await query<{ content_type: string | null; language: string | null; n: string }>(
    `SELECT COALESCE(c.content_type, p.content_type) AS content_type, c.language, COUNT(*) AS n
       FROM apsomh_content c JOIN apsomh_content_projects p ON p.id = c.project_id
      WHERE c.project_id = $1 AND c.piece_id IS NULL
      GROUP BY 1, 2 ORDER BY MIN(c.created_at)`,
    [projectId],
  );
  let sort = 0;
  for (const g of groups.rows) {
    const made = await query<{ id: number }>(
      `INSERT INTO apsomh_content_pieces (project_id, content_type, language, title, status, sort, writer, created_by)
       SELECT $1, $2, $3, $4, 'writing', $5, p.created_by, p.created_by FROM apsomh_content_projects p WHERE p.id = $1
       RETURNING id`,
      [projectId, g.content_type, g.language, pieceTitle(g.content_type, g.language), sort++],
    );
    await query(
      `UPDATE apsomh_content c SET piece_id = $1
         FROM apsomh_content_projects p
        WHERE c.project_id = $2 AND p.id = c.project_id AND c.piece_id IS NULL
          AND COALESCE(c.content_type, p.content_type) IS NOT DISTINCT FROM $3 AND c.language IS NOT DISTINCT FROM $4`,
      [made.rows[0].id, projectId, g.content_type, g.language],
    );
  }
}

/** "Landing page · IT" - the name a piece gets when nobody gave it one. */
export function pieceTitle(contentType: string | null, language: string | null): string {
  const kind = contentType ? CONTENT_BY_KEY[contentType]?.label ?? contentType.replace(/[-_]+/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "Piece";
  return language ? `${kind} · ${language.toUpperCase()}` : kind;
}

/**
 * A page sent from AI testing & personalization (APSOconvert) arrives as a project whose brief carries the page's marker
 * and nothing else: it gets its Page to-do the first time it is read, so it opens straight into the Page studio
 * (SARCLA 08.11.2026: "pages can come from AI & Personalization ... always trigger on the to-do").
 */
async function pieceFromConvert(projectId: number): Promise<void> {
  const r = await query<{ brief: string | null; created_by: string | null; has: boolean }>(
    `SELECT p.brief, p.created_by, EXISTS (SELECT 1 FROM apsomh_content_pieces x WHERE x.project_id = p.id) AS has
       FROM apsomh_content_projects p WHERE p.id = $1`, [projectId]);
  const row = r.rows[0];
  const page = row && !row.has ? markerOf(row.brief) : null;
  if (!page) return;
  const kind = contentTypeForPage(page.path);
  // the store view's language, as the to-dos write it: de-CH -> DE
  const language = classify(page.path).store?.slice(0, 2).toUpperCase() || null;
  await query(
    `INSERT INTO apsomh_content_pieces (project_id, content_type, language, title, writer, status, sort, created_by)
     SELECT $1, $2, $3, $4, $5, 'todo', 0, $5 WHERE NOT EXISTS (SELECT 1 FROM apsomh_content_pieces WHERE project_id = $1)`,
    [projectId, kind, language, `${CONTENT_BY_KEY[kind]?.label ?? "Page"} · ${page.path}`.slice(0, 200), row.created_by]);
}

export async function listPieces(projectId: number): Promise<Piece[]> {
  await ensureWorkflow();
  await piecesFromVersions(projectId);
  await pieceFromConvert(projectId);
  const r = await query<PieceRow>(`${PIECE_SELECT} WHERE pc.project_id = $1 ORDER BY pc.sort, pc.id`, [projectId]);
  return r.rows.map(toPiece);
}

export async function getPiece(pieceId: number): Promise<Piece | null> {
  await ensureWorkflow();
  const r = await query<PieceRow>(`${PIECE_SELECT} WHERE pc.id = $1`, [pieceId]);
  return r.rows[0] ? toPiece(r.rows[0]) : null;
}

export async function projectBrief(projectId: number): Promise<{ brief: Brief; source: string | null; planItem: number | null }> {
  await ensureWorkflow();
  const r = await query<{ brief_fields: unknown; source: string | null; plan_item: number | null }>(
    `SELECT brief_fields, source, plan_item FROM apsomh_content_projects WHERE id = $1`, [projectId]);
  const row = r.rows[0];
  return { brief: cleanBrief(row?.brief_fields), source: row?.source ?? null, planItem: row?.plan_item ?? null };
}

export async function setBrief(projectId: number, brief: Brief): Promise<void> {
  await ensureWorkflow();
  await query(`UPDATE apsomh_content_projects SET brief_fields = $2, updated_at = NOW() WHERE id = $1`, [projectId, JSON.stringify(brief)]);
}

export async function setPlanItem(projectId: number, planItem: number | null): Promise<void> {
  await ensureWorkflow();
  await query(`UPDATE apsomh_content_projects SET plan_item = $2, updated_at = NOW() WHERE id = $1`, [projectId, planItem]);
}

export async function setSource(projectId: number, source: string | null): Promise<void> {
  await ensureWorkflow();
  await query(`UPDATE apsomh_content_projects SET source = $2 WHERE id = $1`, [projectId, source]);
}

export async function addPiece(p: {
  projectId: number; contentType: string | null; language: string | null; title: string | null;
  writer: string | null; reviewer: string | null; dueDate: string | null; by: string;
}): Promise<Piece> {
  await ensureWorkflow();
  const r = await query<{ id: number }>(
    `INSERT INTO apsomh_content_pieces (project_id, content_type, language, title, writer, reviewer, due_date, sort, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7::date,
             COALESCE((SELECT MAX(sort) + 1 FROM apsomh_content_pieces WHERE project_id = $1), 0), $8)
     RETURNING id`,
    [p.projectId, p.contentType, p.language, p.title?.trim() || pieceTitle(p.contentType, p.language), p.writer, p.reviewer, p.dueDate, p.by],
  );
  await touch(p.projectId);
  return (await getPiece(r.rows[0].id))!;
}

export async function updatePiece(pieceId: number, patch: Partial<{
  title: string; contentType: string | null; language: string | null; writer: string | null; reviewer: string | null;
  dueDate: string | null; status: PieceStatus;
}>): Promise<void> {
  await ensureWorkflow();
  const cols: string[] = [];
  const vals: unknown[] = [pieceId];
  const set = (col: string, v: unknown, cast = "") => { vals.push(v); cols.push(`${col} = $${vals.length}${cast}`); };
  if (patch.title !== undefined) set("title", patch.title);
  if (patch.contentType !== undefined) set("content_type", patch.contentType);
  if (patch.language !== undefined) set("language", patch.language);
  if (patch.writer !== undefined) set("writer", patch.writer);
  if (patch.reviewer !== undefined) set("reviewer", patch.reviewer);
  if (patch.dueDate !== undefined) set("due_date", patch.dueDate, "::date");
  if (patch.status !== undefined) set("status", patch.status);
  if (!cols.length) return;
  const r = await query<{ project_id: number }>(
    `UPDATE apsomh_content_pieces SET ${cols.join(", ")}, updated_at = NOW() WHERE id = $1 RETURNING project_id`, vals);
  if (r.rows[0]) await touch(r.rows[0].project_id);
}

/** Removes a piece; its versions stay in the project, without a piece (the library still has them). */
export async function removePiece(pieceId: number): Promise<void> {
  await ensureWorkflow();
  await query(`UPDATE apsomh_content SET piece_id = NULL WHERE piece_id = $1`, [pieceId]);
  await query(`DELETE FROM apsomh_content_pieces WHERE id = $1`, [pieceId]);
}

export async function attachVersionToPiece(variantId: number, pieceId: number): Promise<void> {
  await ensureWorkflow();
  await query(`UPDATE apsomh_content SET piece_id = $2 WHERE id = $1`, [variantId, pieceId]);
}

export async function addEvent(projectId: number, pieceId: number | null, actor: string, kind: string, detail: Record<string, unknown> = {}): Promise<void> {
  await ensureWorkflow();
  await query(
    `INSERT INTO apsomh_content_events (project_id, piece_id, actor, kind, detail) VALUES ($1, $2, $3, $4, $5)`,
    [projectId, pieceId, actor, kind, JSON.stringify(detail)],
  );
}

export async function listEvents(projectId: number): Promise<ContentEvent[]> {
  await ensureWorkflow();
  const r = await query<{ id: number; project_id: number; piece_id: number | null; actor: string; kind: string; detail: unknown; created_at: Date }>(
    `SELECT * FROM apsomh_content_events WHERE project_id = $1 ORDER BY created_at DESC LIMIT 300`, [projectId]);
  return r.rows.map((e) => ({
    id: e.id, projectId: e.project_id, pieceId: e.piece_id, actor: e.actor, kind: e.kind,
    detail: (e.detail && typeof e.detail === "object" ? e.detail : {}) as Record<string, unknown>,
    createdAt: new Date(e.created_at).toISOString(),
  }));
}

export async function stageOfProject(projectId: number): Promise<Stage> {
  await ensureWorkflow();
  const r = await query<{ status: string }>(`SELECT status FROM apsomh_content_pieces WHERE project_id = $1`, [projectId]);
  return stageOf(r.rows.map((x) => (isPieceStatus(x.status) ? x.status : "todo")));
}

async function touch(projectId: number): Promise<void> {
  await query(`UPDATE apsomh_content_projects SET updated_at = NOW() WHERE id = $1`, [projectId]);
}

/** The board's card for each project this person may open: its pieces in short, its people, its stage. */
export type BoardProject = {
  id: number;
  title: string;
  stage: Stage;
  source: string | null;
  owner: string | null;
  team: string[];
  dueDate: string | null;
  pieces: { id: number; title: string; status: PieceStatus; contentType: string | null; language: string | null; dueDate: string | null; writer: string | null }[];
  comments: number;
  updatedAt: string;
};

type Me = { username: string; role: string };

export async function boardFor(me: Me): Promise<BoardProject[]> {
  await ensureWorkflow();
  const member = "EXISTS (SELECT 1 FROM apsomh_content_project_members x WHERE x.project_id = p.id AND x.username = $1)";
  // an admin sees every project - the parameter is still read, or Postgres refuses the one we send
  const visible = me.role === "admin" ? "$1::text IS NOT NULL" : `(p.created_by = $1 OR ${member})`;
  const ids = await query<{ id: number }>(
    `SELECT p.id FROM apsomh_content_projects p WHERE p.status <> 'archived' AND p.deleted_at IS NULL AND ${visible} ORDER BY p.updated_at DESC LIMIT 200`,
    [me.username]);
  // a project made before pieces gets its pieces on the way to the board
  for (const { id } of ids.rows) await piecesFromVersions(id);
  const r = await query<{
    id: number; title: string; source: string | null; created_by: string | null; due_iso: string | null; updated_at: Date;
    comments: string; members: string[] | null;
    pieces: { id: number; title: string; status: string; content_type: string | null; language: string | null; due: string | null; writer: string | null; reviewer: string | null }[] | null;
  }>(
    `SELECT p.id, p.title, p.source, p.created_by, TO_CHAR(p.due_date, 'YYYY-MM-DD') AS due_iso, p.updated_at,
            (SELECT COUNT(*) FROM apsomh_content_comments k WHERE k.project_id = p.id) AS comments,
            (SELECT ARRAY_AGG(m.username ORDER BY m.invited_at) FROM apsomh_content_project_members m WHERE m.project_id = p.id) AS members,
            (SELECT JSON_AGG(JSON_BUILD_OBJECT('id', pc.id, 'title', pc.title, 'status', pc.status, 'content_type', pc.content_type,
                    'language', pc.language, 'due', TO_CHAR(pc.due_date, 'YYYY-MM-DD'), 'writer', pc.writer, 'reviewer', pc.reviewer)
                    ORDER BY pc.sort, pc.id)
               FROM apsomh_content_pieces pc WHERE pc.project_id = p.id) AS pieces
       FROM apsomh_content_projects p
      WHERE p.id = ANY($1::int[])
      ORDER BY p.updated_at DESC`,
    [ids.rows.map((x) => x.id)],
  );
  return r.rows.map((p) => {
    const pieces = (p.pieces ?? []).map((x) => ({
      id: x.id, title: x.title, status: (isPieceStatus(x.status) ? x.status : "todo") as PieceStatus, contentType: x.content_type,
      language: x.language, dueDate: x.due, writer: x.writer,
    }));
    const people = new Set<string>();
    if (p.created_by) people.add(p.created_by);
    for (const m of p.members ?? []) people.add(m);
    for (const x of p.pieces ?? []) { if (x.writer) people.add(x.writer); if (x.reviewer) people.add(x.reviewer); }
    const lastPieceDue = pieces.map((x) => x.dueDate).filter((d): d is string => !!d).sort().pop() ?? null;
    return {
      id: p.id, title: p.title, stage: stageOf(pieces.map((x) => x.status)), source: p.source, owner: p.created_by,
      team: [...people], dueDate: p.due_iso ?? lastPieceDue, pieces, comments: Number(p.comments), updatedAt: new Date(p.updated_at).toISOString(),
    };
  });
}

/** What waits for this person: reviews asked of them, pieces they write, and where they were tagged lately. */
export type Waiting = {
  kind: "review" | "write" | "changes" | "mention";
  projectId: number;
  projectTitle: string;
  pieceId: number | null;
  title: string;
  by: string | null;
  at: string | null;
  dueDate: string | null;
  text?: string;
};

export async function waitingFor(me: Me): Promise<Waiting[]> {
  await ensureWorkflow();
  const pieces = await query<{
    id: number; project_id: number; project_title: string; title: string; status: string; writer: string | null;
    reviewer: string | null; due_iso: string | null; updated_at: Date;
  }>(
    `SELECT pc.id, pc.project_id, p.title AS project_title, pc.title, pc.status, pc.writer, pc.reviewer,
            TO_CHAR(pc.due_date, 'YYYY-MM-DD') AS due_iso, pc.updated_at
       FROM apsomh_content_pieces pc JOIN apsomh_content_projects p ON p.id = pc.project_id
      WHERE p.status <> 'archived' AND p.deleted_at IS NULL
        AND ((pc.reviewer = $1 AND pc.status = 'review')
          OR (pc.writer = $1 AND pc.status IN ('todo', 'writing', 'changes')))
      ORDER BY pc.due_date NULLS LAST, pc.updated_at DESC
      LIMIT 30`,
    [me.username]);
  const out: Waiting[] = pieces.rows.map((r) => ({
    kind: r.reviewer === me.username && r.status === "review" ? "review" : r.status === "changes" ? "changes" : "write",
    projectId: r.project_id, projectTitle: r.project_title, pieceId: r.id, title: r.title,
    by: r.reviewer === me.username && r.status === "review" ? r.writer : r.reviewer,
    at: new Date(r.updated_at).toISOString(), dueDate: r.due_iso,
  }));
  const tags = await query<{ project_id: number; project_title: string; piece_id: number | null; actor: string; detail: { text?: string } | null; created_at: Date }>(
    `SELECT e.project_id, p.title AS project_title, e.piece_id, e.actor, e.detail, e.created_at
       FROM apsomh_content_events e JOIN apsomh_content_projects p ON p.id = e.project_id
      WHERE e.kind = 'mention' AND e.detail->>'to' = $1 AND e.created_at > NOW() - INTERVAL '7 days' AND p.status <> 'archived' AND p.deleted_at IS NULL
      ORDER BY e.created_at DESC LIMIT 10`,
    [me.username]);
  for (const t of tags.rows) {
    out.push({
      kind: "mention", projectId: t.project_id, projectTitle: t.project_title, pieceId: t.piece_id, title: t.project_title,
      by: t.actor, at: new Date(t.created_at).toISOString(), dueDate: null, text: typeof t.detail?.text === "string" ? t.detail.text.slice(0, 200) : "",
    });
  }
  return out;
}

export async function setPieceTask(pieceId: number, taskId: number | null): Promise<void> {
  await ensureWorkflow();
  await query(`UPDATE apsomh_content_pieces SET task_id = $2 WHERE id = $1`, [pieceId, taskId]);
}

/** A piece for a sub-action met without one (a to-do from before pieces were to-dos). */
export async function addPieceForTask(p: { projectId: number; taskId: number; title: string; status: PieceStatus; writer: string | null; dueDate: string | null; by: string }): Promise<void> {
  await ensureWorkflow();
  await query(
    `INSERT INTO apsomh_content_pieces (project_id, content_type, title, writer, status, due_date, task_id, sort, created_by)
     VALUES ($1, 'task', $2, $3, $4, $5::date, $6, COALESCE((SELECT MAX(sort) + 1 FROM apsomh_content_pieces WHERE project_id = $1), 0), $7)`,
    [p.projectId, p.title, p.writer, p.status, p.dueDate, p.taskId, p.by],
  );
}

/**
 * The project's head for its page, light: the project row and its comments - never every version's body
 * (getProject reads them all, and the page does not show them).
 */
export async function projectHead(id: number): Promise<{
  project: { id: number; title: string; brief: string | null; createdBy: string | null; contentType: string | null; dueDate: string | null; status: string };
  comments: { id: number; author: string; body: string; createdAt: string }[];
} | null> {
  await ensureWorkflow();
  const p = await query<{ id: number; title: string; brief: string | null; created_by: string | null; content_type: string | null; due_iso: string | null; status: string }>(
    `SELECT id, title, brief, created_by, content_type, status, TO_CHAR(due_date, 'YYYY-MM-DD') AS due_iso FROM apsomh_content_projects WHERE id = $1`, [id]);
  const r = p.rows[0];
  if (!r) return null;
  const c = await query<{ id: number; author: string; body: string; created_at: Date }>(
    `SELECT id, author, body, created_at FROM apsomh_content_comments WHERE project_id = $1 ORDER BY created_at DESC LIMIT 300`, [id]);
  return {
    project: { id: r.id, title: r.title, brief: r.brief, createdBy: r.created_by, contentType: r.content_type, dueDate: r.due_iso, status: r.status },
    comments: c.rows.map((x) => ({ id: x.id, author: x.author, body: x.body, createdAt: new Date(x.created_at).toISOString() })),
  };
}
