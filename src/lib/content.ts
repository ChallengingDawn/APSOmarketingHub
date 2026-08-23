import { query } from "./db/client";
import { ensureSchema } from "./db/init";

export const CONTENT_STATUSES = ["draft", "approved", "published", "archived"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export function isContentStatus(value: unknown): value is ContentStatus {
  return typeof value === "string" && (CONTENT_STATUSES as readonly string[]).includes(value);
}

export type ContentItem = {
  id: number;
  channel: string;
  title: string | null;
  body: string;
  imageUrl: string | null;
  filters: Record<string, unknown> | null;
  status: ContentStatus;
  createdBy: string | null;
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
  id: number;
  channel: string;
  title: string | null;
  body: string;
  image_url: string | null;
  filters: Record<string, unknown> | null;
  status: string;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function toItem(row: ContentRow): ContentItem {
  return {
    id: row.id,
    channel: row.channel,
    title: row.title,
    body: row.body,
    imageUrl: row.image_url,
    filters: row.filters,
    status: isContentStatus(row.status) ? row.status : "draft",
    createdBy: row.created_by,
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
  const r = await query<ContentRow>(
    `SELECT * FROM apsomh_content
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY created_at DESC, id DESC
     LIMIT $${params.length}`,
    params
  );
  return r.rows.map(toItem);
}

export async function getContent(id: number): Promise<ContentItem | null> {
  await ensureSchema();
  const r = await query<ContentRow>(`SELECT * FROM apsomh_content WHERE id = $1 LIMIT 1`, [id]);
  return r.rows.length ? toItem(r.rows[0]) : null;
}

export async function updateContentStatus(
  id: number,
  status: ContentStatus
): Promise<ContentItem | null> {
  await ensureSchema();
  const r = await query<ContentRow>(
    `UPDATE apsomh_content SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id, status]
  );
  return r.rows.length ? toItem(r.rows[0]) : null;
}
