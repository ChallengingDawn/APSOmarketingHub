import type { DesignDocument } from "./design-document";
import { contentUpdateStatement, type ContentEdit } from "./content-edit";
import { query } from "./db/client";
import { ensureSchema } from "./db/init";

export const CONTENT_STATUSES = ["draft", "approved", "published", "archived"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export function isContentStatus(value: unknown): value is ContentStatus {
  return typeof value === "string" && (CONTENT_STATUSES as readonly string[]).includes(value);
}

export type ContentItem = {
  revision: number;
  updatedBy: string | null;
  designDocument?: DesignDocument | null;
  hasDesign: boolean;
  id: number;
  channel: string;
  title: string | null;
  body: string;
  imageUrl: string | null;
  filters: Record<string, unknown> | null;
  status: ContentStatus;
  createdBy: string | null;
  /** Planned publication date. Null means the piece is not scheduled yet. */
  scheduledFor: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NewContentItem = {
  channel: string;
  title?: string | null;
  body: string;
  imageUrl?: string | null;
  filters?: Record<string, unknown> | null;
  status?: ContentStatus;
  createdBy?: string | null;
};

export type ContentFilter = {
  channel?: string;
  status?: string;
  limit?: number;
};

type ContentRow = {
  revision: number;
  updated_by: string | null;
  design_document: DesignDocument | null;
  id: number;
  channel: string;
  title: string | null;
  body: string;
  image_url: string | null;
  filters: Record<string, unknown> | null;
  status: string;
  created_by: string | null;
  scheduled_for: Date | null;
  created_at: Date;
  updated_at: Date;
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * A list row never carries the image bytes. Visuals are base64 data URLs that
 * run to hundreds of kilobytes each, and a 200-row list was shipping all of
 * them on every page load. Lists get a boolean and hand back a URL to the
 * per-piece image endpoint instead; the full data URL is only returned by
 * getContent() for a single piece.
 */
type ListRow = Omit<ContentRow, "image_url" | "design_document"> & { has_image: boolean; has_design: boolean };

const LIST_COLUMNS = `revision, updated_by, (design_document IS NOT NULL AND design_document <> 'null'::jsonb) AS has_design, id, channel, title, body, filters, status, created_by, scheduled_for, created_at, updated_at,
       (image_url IS NOT NULL AND image_url <> '') AS has_image`;

/** Stable per-version URL, so the browser may cache the bytes as immutable. */
function imageRef(id: number, updatedAt: Date): string {
  return `/api/content/${id}/image?v=${new Date(updatedAt).getTime()}`;
}

function toListItem(row: ListRow): ContentItem {
  return {
    revision: row.revision, updatedBy: row.updated_by, hasDesign: row.has_design,
    id: row.id,
    channel: row.channel,
    title: row.title,
    body: row.body,
    imageUrl: row.has_image ? imageRef(row.id, row.updated_at) : null,
    filters: row.filters,
    status: isContentStatus(row.status) ? row.status : "draft",
    createdBy: row.created_by,
    scheduledFor: row.scheduled_for ? new Date(row.scheduled_for).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function toItem(row: ContentRow): ContentItem {
  return {
    revision: row.revision, updatedBy: row.updated_by, designDocument: row.design_document, hasDesign: Boolean(row.design_document),
    id: row.id,
    channel: row.channel,
    title: row.title,
    body: row.body,
    imageUrl: row.image_url,
    filters: row.filters,
    status: isContentStatus(row.status) ? row.status : "draft",
    createdBy: row.created_by,
    scheduledFor: row.scheduled_for ? new Date(row.scheduled_for).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function saveContent(item: NewContentItem): Promise<ContentItem> {
  await ensureSchema();
  const r = await query<ContentRow>(
    `INSERT INTO apsomh_content (channel, title, body, image_url, filters, status, created_by)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
     RETURNING *`,
    [
      item.channel.slice(0, 32),
      item.title ?? null,
      item.body,
      item.imageUrl ?? null,
      item.filters ? JSON.stringify(item.filters) : null,
      item.status ?? "draft",
      item.createdBy ?? null,
    ]
  );
  return toItem(r.rows[0]);
}

export async function listContent(filter: ContentFilter = {}): Promise<ContentItem[]> {
  await ensureSchema();
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.channel) {
    params.push(filter.channel);
    where.push(`channel = $${params.length}`);
  }
  if (filter.status) {
    params.push(filter.status);
    where.push(`status = $${params.length}`);
  }
  const limit = Math.min(Math.max(Math.trunc(filter.limit ?? DEFAULT_LIMIT), 1), MAX_LIMIT);
  params.push(limit);
  const r = await query<ListRow>(
    `SELECT ${LIST_COLUMNS} FROM apsomh_content
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY created_at DESC, id DESC
     LIMIT $${params.length}`,
    params
  );
  return r.rows.map(toListItem);
}

export async function getContent(id: number): Promise<ContentItem | null> {
  await ensureSchema();
  const r = await query<ContentRow>(`SELECT * FROM apsomh_content WHERE id = $1 LIMIT 1`, [id]);
  return r.rows.length ? toItem(r.rows[0]) : null;
}

export async function updateContent(id: number, edit: ContentEdit, actor: string): Promise<ContentItem | null> {
  await ensureSchema();
  const statement = contentUpdateStatement(id, edit, actor);
  const result = await query<ContentRow>(statement.text, statement.values);
  return result.rows.length ? toItem(result.rows[0]) : null;
}

export async function contentHistory(id: number) {
  await ensureSchema();
  const result = await query<{ revision: number; title: string | null; status: string; replaced_by: string; replaced_at: string }>(
    `SELECT revision, snapshot->>'title' AS title, snapshot->>'status' AS status,
       replaced_by, replaced_at FROM apsomh_content_revisions
       WHERE content_id = $1 ORDER BY revision DESC LIMIT 50`, [id]);
  return result.rows;
}
