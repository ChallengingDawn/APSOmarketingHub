// PICTURES KEPT IN THE HUB (SARCLA 08.11.2026: "on pictures frame you should be able to upload a photo or generate one",
// "a gallery of the photos that I've generated", "it doesn't create the photo"). One table for every studio:
//   generated  made by the image model from a prompt, in the house style (imagePrompt.ts)
//   upload     a photo someone brought - shrunk in the browser, sent in small parts (the 8 KB body limit), joined here
//   logo       a brand mark (the Brand panel's gallery)
// The bytes live here, not in a studio's document - a document carries the picture's address (/api/content/picture/<id>-<key>),
// never its data (the old canvas kept base64 in JSONB). Pictures are re-encoded on the way in: at most 2400 px, JPEG
// when opaque (e-mail clients read it), PNG when it has transparency. Created on first use.

import { randomBytes } from "node:crypto";
import { query } from "@/lib/db/client";
import { readBrain } from "@/lib/brain";
import { buildImagePrompt, type ImagePromptInput } from "@/lib/imagePrompt";
import { generateApsoImage } from "@/lib/images";

export type AssetKind = "generated" | "upload" | "logo";
export type Asset = {
  id: number; kind: AssetKind; mime: string; size: number; width: number | null; height: number | null;
  name: string | null; prompt: string | null; projectId: number | null; pieceId: number | null; by: string | null; at: string; url: string;
};

export const ASSET_MAX_BYTES = 8 * 1024 * 1024;
/** An upload's parts: base64 text, each well under the 8 KB body (the JSON around it included). */
export const PART_CHARS = 6000;
const MAX_PARTS = Math.ceil((ASSET_MAX_BYTES * 4) / 3 / PART_CHARS) + 2;

let ready: Promise<void> | null = null;
export function ensureAssets(): Promise<void> {
  ready ??= (async () => {
    await query(`
      CREATE TABLE IF NOT EXISTS apsomh_content_assets (
        id SERIAL PRIMARY KEY,
        kind VARCHAR(16) NOT NULL,
        mime VARCHAR(48) NOT NULL,
        data BYTEA NOT NULL,
        size INTEGER NOT NULL,
        width INTEGER,
        height INTEGER,
        name TEXT,
        prompt TEXT,
        key VARCHAR(24) NOT NULL,
        project_id INTEGER,
        piece_id INTEGER,
        created_by VARCHAR(255),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_content_assets_by ON apsomh_content_assets (created_by, created_at DESC)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_content_assets_project ON apsomh_content_assets (project_id)`);
    await query(`
      CREATE TABLE IF NOT EXISTS apsomh_content_asset_parts (
        token VARCHAR(40) NOT NULL,
        n INTEGER NOT NULL,
        data TEXT NOT NULL,
        created_by VARCHAR(255),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (token, n)
      )`);
  })().catch((e) => { ready = null; throw e; });
  return ready;
}

type Row = {
  id: number; key: string; kind: AssetKind; mime: string; size: number; width: number | null; height: number | null; name: string | null;
  prompt: string | null; project_id: number | null; piece_id: number | null; created_by: string | null; created_at: Date;
};
const COLS = `id, key, kind, mime, size, width, height, name, prompt, project_id, piece_id, created_by, created_at`;
/** A picture's address: its number and a key nobody guesses - previews, e-mails and frames read it without a hub cookie. */
export const assetUrl = (id: number, key: string) => `/api/content/picture/${id}-${key}`;
const toAsset = (r: Row): Asset => ({
  id: r.id, kind: r.kind, mime: r.mime, size: r.size, width: r.width, height: r.height, name: r.name, prompt: r.prompt,
  projectId: r.project_id, pieceId: r.piece_id, by: r.created_by, at: new Date(r.created_at).toISOString(), url: assetUrl(r.id, r.key),
});

/** The picture as the hub keeps it: turned upright, at most 2400 px, JPEG or PNG. SVG (a logo) is kept as it is. */
async function normalise(bytes: Buffer, mime: string): Promise<{ data: Buffer; mime: string; width: number | null; height: number | null }> {
  if (mime === "image/svg+xml") return { data: bytes, mime, width: null, height: null };
  const sharp = (await import("sharp")).default;
  const img = sharp(bytes, { failOn: "none" }).rotate();
  const meta = await img.metadata();
  const resized = img.resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true });
  const out = meta.hasAlpha
    ? await resized.png({ compressionLevel: 9, palette: false }).toBuffer({ resolveWithObject: true })
    : await resized.jpeg({ quality: 86, mozjpeg: true }).toBuffer({ resolveWithObject: true });
  return { data: out.data, mime: meta.hasAlpha ? "image/png" : "image/jpeg", width: out.info.width, height: out.info.height };
}

const SNIFF: [string, (b: Buffer) => boolean][] = [
  ["image/png", (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47],
  ["image/jpeg", (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
  ["image/webp", (b) => b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP"],
  ["image/gif", (b) => b.length > 6 && b.toString("ascii", 0, 3) === "GIF"],
  ["image/svg+xml", (b) => /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(b.toString("utf8", 0, Math.min(b.length, 2048)))],
];
/** What the bytes really are - never what the browser said. */
export function sniffMime(b: Buffer): string | null {
  return SNIFF.find(([, test]) => test(b))?.[0] ?? null;
}

export async function saveAsset(p: {
  bytes: Buffer; kind: AssetKind; name?: string | null; prompt?: string | null; projectId?: number | null; pieceId?: number | null; by: string;
}): Promise<Asset> {
  await ensureAssets();
  const mime = sniffMime(p.bytes);
  if (!mime) throw new Error("That file is not a picture (PNG, JPEG, WebP, GIF or SVG).");
  if (mime === "image/svg+xml" && p.kind !== "logo") throw new Error("An SVG goes in as a logo, not as a photo.");
  if (p.bytes.length > ASSET_MAX_BYTES) throw new Error("That picture is too big - at most 8 MB.");
  const n = await normalise(p.bytes, mime);
  const r = await query<Row>(
    `INSERT INTO apsomh_content_assets (kind, mime, data, size, width, height, name, prompt, project_id, piece_id, created_by, key)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING ${COLS}`,
    [p.kind, n.mime, n.data, n.data.length, n.width, n.height, p.name?.slice(0, 200) ?? null, p.prompt?.slice(0, 4000) ?? null,
      p.projectId ?? null, p.pieceId ?? null, p.by, randomBytes(9).toString("hex")]);
  return toAsset(r.rows[0]);
}

export async function assetBytes(id: number, key: string): Promise<{ data: Buffer; mime: string } | null> {
  await ensureAssets();
  const r = await query<{ data: Buffer; mime: string }>(`SELECT data, mime FROM apsomh_content_assets WHERE id = $1 AND key = $2 AND deleted_at IS NULL`, [id, key]);
  return r.rows[0] ?? null;
}

export async function getAsset(id: number): Promise<Asset | null> {
  await ensureAssets();
  const r = await query<Row>(`SELECT ${COLS} FROM apsomh_content_assets WHERE id = $1 AND deleted_at IS NULL`, [id]);
  return r.rows[0] ? toAsset(r.rows[0]) : null;
}

/** The gallery: mine, a project's, the logos - newest first. */
export async function listAssets(f: { by?: string | null; projectId?: number | null; kind?: AssetKind | null; limit?: number; before?: number | null }): Promise<Asset[]> {
  await ensureAssets();
  const where = ["deleted_at IS NULL"];
  const args: unknown[] = [];
  if (f.by) { args.push(f.by); where.push(`created_by = $${args.length}`); }
  if (f.projectId) { args.push(f.projectId); where.push(`project_id = $${args.length}`); }
  if (f.kind) { args.push(f.kind); where.push(`kind = $${args.length}`); }
  if (f.before) { args.push(f.before); where.push(`id < $${args.length}`); }
  args.push(Math.min(Math.max(f.limit ?? 60, 1), 200));
  const r = await query<Row>(`SELECT ${COLS} FROM apsomh_content_assets WHERE ${where.join(" AND ")} ORDER BY id DESC LIMIT $${args.length}`, args);
  return r.rows.map(toAsset);
}

/**
 * Where a picture is used (09.11.2026, the Pictures page): the to-dos whose studio document holds its address - newest
 * first. The caller keeps only the projects the person may open.
 */
export async function pictureUsage(id: number): Promise<{ pieceId: number; projectId: number; title: string; project: string; contentType: string | null }[]> {
  await ensureAssets();
  const r = await query<{ piece_id: number; project_id: number; title: string; project: string; content_type: string | null }>(
    `SELECT d.piece_id, p.project_id, p.title, pr.title AS project, p.content_type
       FROM apsomh_content_piece_docs d
       JOIN apsomh_content_pieces p ON p.id = d.piece_id
       JOIN apsomh_content_projects pr ON pr.id = p.project_id
      WHERE d.doc::text LIKE $1
      ORDER BY d.updated_at DESC LIMIT 30`, [`%/api/content/picture/${id}-%`]);
  return r.rows.map((x) => ({ pieceId: x.piece_id, projectId: x.project_id, title: x.title, project: x.project, contentType: x.content_type }));
}

export async function removeAsset(id: number, who: { username: string; admin: boolean }): Promise<boolean> {
  await ensureAssets();
  const r = await query<{ id: number }>(
    `UPDATE apsomh_content_assets SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL AND ($2::boolean OR created_by = $3) RETURNING id`,
    [id, who.admin, who.username]);
  return r.rows.length > 0;
}

/* ---- an upload in parts ---- */

export function newUploadToken(): string {
  return randomBytes(16).toString("hex");
}

export async function addUploadPart(token: string, n: number, data: string, by: string): Promise<void> {
  await ensureAssets();
  if (!/^[a-f0-9]{32}$/.test(token)) throw new Error("Not an upload.");
  if (!Number.isInteger(n) || n < 0 || n >= MAX_PARTS) throw new Error("That part is out of range.");
  if (data.length > PART_CHARS || !/^[A-Za-z0-9+/=]*$/.test(data)) throw new Error("That part is not a picture's text.");
  await query(
    `INSERT INTO apsomh_content_asset_parts (token, n, data, created_by) VALUES ($1, $2, $3, $4)
     ON CONFLICT (token, n) DO UPDATE SET data = EXCLUDED.data`,
    [token, n, data, by]);
}

export async function finishUpload(p: {
  token: string; parts: number; kind: AssetKind; name?: string | null; projectId?: number | null; pieceId?: number | null; by: string;
}): Promise<Asset> {
  await ensureAssets();
  const r = await query<{ n: number; data: string }>(
    `SELECT n, data FROM apsomh_content_asset_parts WHERE token = $1 AND created_by = $2 ORDER BY n`, [p.token, p.by]);
  if (r.rows.length !== p.parts || r.rows.some((x, i) => x.n !== i)) throw new Error("Some of the picture did not arrive - send it again.");
  const bytes = Buffer.from(r.rows.map((x) => x.data).join(""), "base64");
  try {
    return await saveAsset({ bytes, kind: p.kind, name: p.name, projectId: p.projectId, pieceId: p.pieceId, by: p.by });
  } finally {
    await query(`DELETE FROM apsomh_content_asset_parts WHERE token = $1 OR created_at < NOW() - INTERVAL '1 day'`, [p.token]);
  }
}

/* ---- a picture made by the image model ---- */

/** Generated pictures a day, for this process - each costs real money (APSOconvert's lesson). */
const IMAGES_PER_DAY = Number(process.env.STUDIO_IMAGES_PER_DAY ?? 150);
let imageDay = { day: "", made: 0 };
function imageAllowed(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (imageDay.day !== today) imageDay = { day: today, made: 0 };
  if (imageDay.made >= IMAGES_PER_DAY) return false;
  imageDay.made += 1;
  return true;
}

export const ASPECTS = ["1:1", "4:5", "16:9", "3:2"] as const;
export type Aspect = (typeof ASPECTS)[number];

export function imagesReady(): boolean {
  return !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
}

/** A picture in the house style, from a few words; kept in the hub and returned with its address. */
export async function generatePicture(p: {
  prompt: string; aspect?: Aspect; overlaySpace?: boolean; projectId?: number | null; pieceId?: number | null; by: string;
}): Promise<{ ok: true; asset: Asset } | { ok: false; error: string }> {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) return { ok: false, error: "Pictures cannot be made here: the image model's key (GEMINI_API_KEY) is not set." };
  const brief = p.prompt.trim().slice(0, 1500);
  if (!brief) return { ok: false, error: "Say what the picture should show." };
  if (!imageAllowed()) return { ok: false, error: `Today's ${IMAGES_PER_DAY} pictures are made - more tomorrow.` };
  const brain = await readBrain();
  const input: ImagePromptInput = { brief, aspect: p.aspect ?? "1:1", overlaySpace: p.overlaySpace ?? false };
  const made = await generateApsoImage(key, buildImagePrompt(brain, input), [], { aspect: input.aspect });
  if (!made.ok) return { ok: false, error: made.error };
  // the picture's bytes after the data URL's comma - never by a regular expression: the model's base64 can carry line
  // breaks, and /(.+)$/ over megabytes of it ended in "Maximum call stack size exceeded" (Content v4, 09.11.2026)
  const url = made.dataUrl;
  const comma = url.indexOf(",");
  if (!url.startsWith("data:") || comma < 0 || !url.slice(0, comma).includes(";base64")) return { ok: false, error: "The image model answered without a picture." };
  const asset = await saveAsset({ bytes: Buffer.from(url.slice(comma + 1), "base64"), kind: "generated", prompt: brief, projectId: p.projectId, pieceId: p.pieceId, by: p.by });
  return { ok: true, asset };
}
