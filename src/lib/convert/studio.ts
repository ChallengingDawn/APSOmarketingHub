// APSOconvert > PREVIEW - per page: the live preview, the AI's ideas (a person approves or drops each), and for an
// approved idea a VERSION (src/lib/convert/versions.ts) the AI writes and a person reshapes in plain words until it is
// right, then approves. Every revision is kept, so a version can be read back step by step. Nothing here reaches the
// shop: the test (the A/B testing section) and Magento come after an approval.
//
// Tables: apsomh_convert_ideas, apsomh_convert_versions (A, B, C... per idea - SARCLA 09.11.2026: "always multiple or 1
// version for a/b testing"), apsomh_convert_revisions. An idea is SENT TO A PROJECT (Content) with its versions - "so
// approve is more sent to project" (SARCLA 09.11.2026): the send approves its versions and keeps the project's id.

import type Anthropic from "@anthropic-ai/sdk";
import { getPool, query } from "@/lib/db/client";
import { shopGet } from "./assets";
import { claudeText, getAnthropic } from "@/lib/ai/claude";
import { buildPageFlow } from "@/lib/journeys/read";
import { ENVS, classify, storeCase, type Env, type PageKind } from "./model";
import { outline, type Outline } from "./preview";
import { validateChanges, type Change } from "./versions";
import { cleanChangeType, typeOfBlock, typeOfIdea, type ChangeType } from "./changeTypes";
import { SAFETY_RULES, qualityOf, riskOf, safePart } from "./safety";
import { looksEnglish } from "./lang";
import { moduleVersion } from "./modular";
import { usesModules } from "./modularRules";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS apsomh_convert_ideas (
  id bigserial PRIMARY KEY,
  env text NOT NULL,
  path text NOT NULL,
  page_key text NOT NULL,
  kind text NOT NULL,
  title text NOT NULL,
  why text NOT NULL DEFAULT '',
  change text NOT NULL DEFAULT '',
  expect text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'ai',
  status text NOT NULL DEFAULT 'proposed',
  numbers jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_by text,
  decided_at timestamptz
);
CREATE INDEX IF NOT EXISTS apsomh_convert_ideas_page ON apsomh_convert_ideas (env, path);
ALTER TABLE apsomh_convert_ideas ADD COLUMN IF NOT EXISTS impact int;
ALTER TABLE apsomh_convert_ideas ADD COLUMN IF NOT EXISTS confidence int;
ALTER TABLE apsomh_convert_ideas ADD COLUMN IF NOT EXISTS effort int;
ALTER TABLE apsomh_convert_ideas ADD COLUMN IF NOT EXISTS target text;
CREATE TABLE IF NOT EXISTS apsomh_convert_analyses (
  env text NOT NULL,
  path text NOT NULL,
  text text NOT NULL DEFAULT '',
  by_whom text,
  at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (env, path)
);
CREATE TABLE IF NOT EXISTS apsomh_convert_versions (
  id bigserial PRIMARY KEY,
  idea_id bigint NOT NULL UNIQUE REFERENCES apsomh_convert_ideas(id) ON DELETE CASCADE,
  env text NOT NULL,
  path text NOT NULL,
  rev int NOT NULL DEFAULT 1,
  changes jsonb NOT NULL,
  summary text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  approved_by text,
  approved_at timestamptz
);
CREATE TABLE IF NOT EXISTS apsomh_convert_revisions (
  version_id bigint NOT NULL REFERENCES apsomh_convert_versions(id) ON DELETE CASCADE,
  rev int NOT NULL,
  changes jsonb NOT NULL,
  summary text NOT NULL DEFAULT '',
  request text,
  by_whom text,
  at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (version_id, rev)
);
ALTER TABLE apsomh_convert_versions ADD COLUMN IF NOT EXISTS letter text NOT NULL DEFAULT 'A';
ALTER TABLE apsomh_convert_versions DROP CONSTRAINT IF EXISTS apsomh_convert_versions_idea_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS apsomh_convert_versions_idea_letter ON apsomh_convert_versions (idea_id, letter);
ALTER TABLE apsomh_convert_ideas ADD COLUMN IF NOT EXISTS sent_by text;
ALTER TABLE apsomh_convert_ideas ADD COLUMN IF NOT EXISTS sent_at timestamptz;
ALTER TABLE apsomh_convert_ideas ADD COLUMN IF NOT EXISTS project_id bigint;
ALTER TABLE apsomh_convert_ideas ADD COLUMN IF NOT EXISTS content_type text;
ALTER TABLE apsomh_convert_ideas ADD COLUMN IF NOT EXISTS block text;
ALTER TABLE apsomh_convert_ideas ADD COLUMN IF NOT EXISTS scope text;
ALTER TABLE apsomh_convert_ideas ADD COLUMN IF NOT EXISTS part text;
`;

let schemaReady: Promise<void> | null = null;
export function ensureStudioSchema(): Promise<void> {
  schemaReady ??= getPool().query(SCHEMA).then(() => undefined).catch((e) => { schemaReady = null; throw e; });
  return schemaReady;
}

// ---------------------------------------------------------------------------------------------------------------------
// THE SHOP'S PAGE - read once and kept ten minutes, so the preview, the outline and the AI see the same page and the
// shop is read at a person's pace, never in a loop.

export type ShopPage = { env: Env; path: string; url: string; status: number; html: string; at: number; kind: PageKind; product: string | null };
const HELD = new Map<string, ShopPage>();
const INFLIGHT = new Map<string, Promise<ShopPage>>();
const TTL = 10 * 60_000;
const MAX_HELD = 40;

/** A page address the studio may read: a path on the shop, no query, no shop function (cart, account, search). */
export function cleanPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let p = raw.trim();
  if (/^https?:\/\//i.test(p)) {
    try {
      const u = new URL(p);
      if (u.origin !== ENVS.prod.base && u.origin !== ENVS.acc.base) return null;
      p = u.pathname;
    } catch { return null; }
  }
  p = p.split(/[?#]/)[0];
  if (!p.startsWith("/") || p.startsWith("//") || p.length > 400 || /[\s<>"'\\]|\.\.\//.test(p)) return null;
  p = storeCase(p);
  return classify(p).kind === "system" ? null : p;
}

export async function shopPage(env: Env, path: string, fresh = false): Promise<ShopPage> {
  const key = `${env}${path}`;
  const held = HELD.get(key);
  if (held && !fresh && Date.now() - held.at < TTL) return held;
  const running = INFLIGHT.get(key);
  if (running) return running;
  const url = `${ENVS[env].base}${path}`;
  // shopGet follows the shop's own redirects (an old address, a store view) and never leaves the shop
  const p = shopGet(url, 25_000, 4_000_000).then((r) => {
    const c = classify(path);
    const page: ShopPage = { env, path, url, status: r.status, html: r.body.toString("utf8").slice(0, 4_000_000), at: Date.now(), kind: c.kind, product: c.product };
    if (r.status === 200) {
      HELD.set(key, page);
      while (HELD.size > MAX_HELD) HELD.delete(HELD.keys().next().value as string);
    }
    return page;
  }).finally(() => INFLIGHT.delete(key));
  INFLIGHT.set(key, p);
  return p;
}

// THE THEME'S ICONS - a frame with an origin of its own may not take the shop's icon font (no CORS header) nor <use>
// its icon sprite from another origin, so both are read once per theme version and put inside the page: the font as a
// data: address, the sprite in the body (src/lib/convert/preview.ts cleanPage).
export type ThemeAssets = { css: string; sprite: { url: string; svg: string } | null };
const THEME = new Map<string, { at: number; p: Promise<ThemeAssets> }>();

async function getFile(url: string, max: number): Promise<Buffer | null> {
  try {
    const r = await shopGet(url, 15_000, max);
    if (r.status !== 200) return null;
    return r.body.length > 0 && r.body.length <= max ? r.body : null;
  } catch {
    return null;
  }
}

export function themeAssets(base: string | null): Promise<ThemeAssets> {
  if (!base) return Promise.resolve({ css: "", sprite: null });
  const held = THEME.get(base);
  if (held && Date.now() - held.at < 24 * 3600_000) return held.p;
  const p = (async (): Promise<ThemeAssets> => {
    const [font, svg] = await Promise.all([getFile(`${base}fonts/Luma-Icons.woff2`, 400_000), getFile(`${base}images/icons.svg`, 1_500_000)]);
    const css = font
      ? `@font-face{font-family:'luma-icons';src:url(data:font/woff2;base64,${font.toString("base64")}) format('woff2');font-weight:400;font-style:normal;font-display:block}`
      : "";
    const text = svg?.toString("utf8") ?? "";
    return { css, sprite: /<svg\b/i.test(text) && !/<script\b/i.test(text) ? { url: `${base}images/icons.svg`, svg: text } : null };
  })();
  THEME.set(base, { at: Date.now(), p });
  while (THEME.size > 6) THEME.delete(THEME.keys().next().value as string);
  return p;
}

export function pageOutline(page: ShopPage): Outline {
  return outline(page.html);
}

// ---------------------------------------------------------------------------------------------------------------------
// IDEAS AND VERSIONS

export type IdeaStatus = "proposed" | "approved" | "dropped";
export type Numbers = {
  views?: number | null; addToCarts?: number | null; rate?: number | null; typical?: number | null;
  reasons?: string[]; companies?: number | null; lost?: number | null; topLoss?: string | null; from?: string; to?: string;
};
export type Idea = {
  id: string; env: Env; path: string; pageKey: string; kind: PageKind; title: string; why: string; change: string; expect: string;
  source: "ai" | "person"; status: IdeaStatus; numbers: Numbers | null; createdBy: string | null; createdAt: string;
  decidedBy: string | null; decidedAt: string | null;
  /** The AI's ranking, 1-5 each (ICE): how much it should move, how sure the numbers make it, how much work. null = by hand. */
  impact?: number | null; confidence?: number | null; effort?: number | null;
  /** The block of the page it is about, as the AI read it from the drawn page (a CSS selector) - the preview marks it
   *  with the idea's number (SARCLA 08.11.2026: "ideas should underline the block"). null = the whole page / by hand. */
  target?: string | null;
  /** Sent to a Content project (with its versions, approved by the send): who, when, which project. */
  sentBy?: string | null; sentAt?: string | null; projectId?: string | null;
  /** The type of content change it proposes - Content's own type (./changeTypes.ts): Page builder, SEO landing page,
   *  Banner, Newsletter. And the shop block it is about, when it was asked for one (./blocks.ts key). */
  contentType: ChangeType; block?: string | null;
  /** "block" = an optimization of ONE block of the page, its versions modules that replace it (./blockRules.ts, SARCLA
   *  10.11.2026: "we cannot say where it is"); "page" = one about the page as a whole (before 10.11.2026). And the
   *  block's name as a person finds it: "Block 4 of 9 · Warum unsere Kunden immer wieder bestellen". */
  scope?: "page" | "block"; part?: string | null;
};
/** The AI's reading of one page, written with its ideas: what works, what stops buyers. */
export type Analysis = { text: string; at: string; by: string | null };
export type VersionStatus = "draft" | "approved";
export type Version = {
  id: string; ideaId: string; env: Env; path: string; rev: number; changes: Change[]; summary: string; status: VersionStatus;
  createdBy: string | null; createdAt: string; updatedAt: string; approvedBy: string | null; approvedAt: string | null;
  /** A, B, C... - an optimization's versions, the first "A". */
  letter: string;
};
export type Revision = { rev: number; summary: string; request: string | null; by: string | null; at: string; count: number };

type IdeaRow = {
  id: string; env: Env; path: string; page_key: string; kind: PageKind; title: string; why: string; change: string; expect: string;
  source: "ai" | "person"; status: IdeaStatus; numbers: Numbers | null; created_by: string | null; created_at: Date;
  decided_by: string | null; decided_at: Date | null; impact: number | null; confidence: number | null; effort: number | null; target: string | null;
  sent_by?: string | null; sent_at?: Date | null; project_id?: string | null; content_type?: string | null; block?: string | null;
  scope?: string | null; part?: string | null;
};
type VersionRow = {
  id: string; idea_id: string; env: Env; path: string; rev: number; changes: Change[]; summary: string; status: VersionStatus;
  created_by: string | null; created_at: Date; updated_at: Date; approved_by: string | null; approved_at: Date | null; letter: string | null;
};
const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);
const toIdea = (r: IdeaRow): Idea => ({
  id: String(r.id), env: r.env, path: r.path, pageKey: r.page_key, kind: r.kind, title: r.title, why: r.why, change: r.change, expect: r.expect,
  source: r.source, status: r.status, numbers: r.numbers, createdBy: r.created_by, createdAt: iso(r.created_at)!, decidedBy: r.decided_by, decidedAt: iso(r.decided_at),
  impact: r.impact ?? null, confidence: r.confidence ?? null, effort: r.effort ?? null, target: r.target ?? null,
  sentBy: r.sent_by ?? null, sentAt: iso(r.sent_at ?? null), projectId: r.project_id ? String(r.project_id) : null,
  contentType: typeOfIdea({ contentType: r.content_type, block: r.block }), block: r.block ?? null,
  scope: r.scope === "block" ? "block" : "page", part: r.part ?? null,
});
const toVersion = (r: VersionRow): Version => ({
  id: String(r.id), ideaId: String(r.idea_id), env: r.env, path: r.path, rev: r.rev, changes: r.changes, summary: r.summary, status: r.status,
  createdBy: r.created_by, createdAt: iso(r.created_at)!, updatedAt: iso(r.updated_at)!, approvedBy: r.approved_by, approvedAt: iso(r.approved_at),
  letter: r.letter || "A",
});

/** The key ideas share across a product's languages (like Problems): "product:<8 digits>", else "page:<path>". */
export function pageKeyOf(path: string): string {
  const c = classify(path);
  return c.kind === "product" && c.product ? `product:${c.product}` : `page:${path}`;
}

export async function pageWork(env: Env, path: string): Promise<{ ideas: Idea[]; versions: Version[]; analysis: Analysis | null }> {
  await ensureStudioSchema();
  const [ideas, versions, analysis] = await Promise.all([
    query<IdeaRow>(`SELECT * FROM apsomh_convert_ideas WHERE env = $1 AND path = $2 ORDER BY (status = 'dropped'), id DESC`, [env, path]),
    query<VersionRow>(`SELECT * FROM apsomh_convert_versions WHERE env = $1 AND path = $2 ORDER BY idea_id DESC, letter`, [env, path]),
    query<{ text: string; by_whom: string | null; at: Date }>(`SELECT text, by_whom, at FROM apsomh_convert_analyses WHERE env = $1 AND path = $2`, [env, path]),
  ]);
  const a = analysis.rows[0];
  return { ideas: ideas.rows.map(toIdea), versions: versions.rows.map(toVersion), analysis: a && a.text ? { text: a.text, by: a.by_whom, at: iso(a.at)! } : null };
}

export type BoardRow = Idea & { version: Pick<Version, "id" | "rev" | "status" | "updatedAt"> | null; versions: number };
export async function board(): Promise<BoardRow[]> {
  await ensureStudioSchema();
  // an idea once, with its first version (A) and how many it has
  const r = await query<IdeaRow & { v_id: string | null; v_rev: number | null; v_status: VersionStatus | null; v_updated: Date | null; v_n: number | null }>(
    `SELECT i.*, v.id AS v_id, v.rev AS v_rev, v.status AS v_status, v.updated_at AS v_updated,
            (SELECT count(*)::int FROM apsomh_convert_versions x WHERE x.idea_id = i.id) AS v_n
       FROM apsomh_convert_ideas i
       LEFT JOIN LATERAL (SELECT * FROM apsomh_convert_versions y WHERE y.idea_id = i.id ORDER BY y.letter LIMIT 1) v ON true
      ORDER BY COALESCE(v.updated_at, i.decided_at, i.created_at) DESC LIMIT 500`,
  );
  return r.rows.map((x) => ({ ...toIdea(x), version: x.v_id ? { id: String(x.v_id), rev: x.v_rev ?? 1, status: x.v_status ?? "draft", updatedAt: iso(x.v_updated)! } : null, versions: Number(x.v_n ?? 0) }));
}

export async function setIdeaStatus(id: string, status: IdeaStatus, by: string): Promise<Idea | null> {
  await ensureStudioSchema();
  const r = await query<IdeaRow>(`UPDATE apsomh_convert_ideas SET status = $2, decided_by = $3, decided_at = now() WHERE id = $1 RETURNING *`, [id, status, by]);
  return r.rows[0] ? toIdea(r.rows[0]) : null;
}

/** A block's selector as the AI gave it: short, one line, no markup - else none (the idea stays, unmarked). */
export function cleanTarget(x: unknown): string | null {
  if (typeof x !== "string") return null;
  const t = x.trim();
  if (!t || t.length > 200 || /[<>{}]|javascript:/i.test(t) || t.includes(String.fromCharCode(10))) return null;
  return t;
}

export async function addIdea(env: Env, path: string, idea: { title: string; why: string; change: string; expect: string; impact?: number; confidence?: number; effort?: number; target?: string | null; type?: unknown; block?: string | null; scope?: "page" | "block"; part?: string | null }, by: string, source: "ai" | "person", numbers: Numbers | null): Promise<Idea> {
  await ensureStudioSchema();
  const c = classify(path);
  const one = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? Math.max(1, Math.min(5, Math.round(x))) : null);
  const r = await query<IdeaRow>(
    `INSERT INTO apsomh_convert_ideas (env, path, page_key, kind, title, why, change, expect, source, status, numbers, created_by, impact, confidence, effort, target, content_type, block, scope, part)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, $14, $15, $16, $17, $18, $19, $20) RETURNING *`,
    [env, path, pageKeyOf(path), c.kind, idea.title.slice(0, 200), idea.why.slice(0, 1500), idea.change.slice(0, 2000), idea.expect.slice(0, 600), source,
      source === "person" ? "approved" : "proposed", numbers ? JSON.stringify(numbers) : null, by, one(idea.impact), one(idea.confidence), one(idea.effort), cleanTarget(idea.target),
      cleanChangeType(idea.type, idea.block ?? null), idea.block ?? null, idea.scope === "block" ? "block" : "page", idea.part ? idea.part.slice(0, 160) : null],
  );
  return toIdea(r.rows[0]);
}

/** A version the hub made with the optimization (a block's versions come with it - ./blockIdeas.ts). */
export function saveVersionOf(idea: Idea, changes: Change[], summary: string, by: string, letter: string): Promise<Version> {
  return saveRevision(idea, changes, summary.slice(0, 600), null, by, letter);
}

/**
 * Optimizations are per block since 10.11.2026 (SARCLA chose "Redo as block ones"): the AI's page-wide optimizations
 * still waiting for a yes or no are set aside - dropped, so "Bring back" still finds them - and their pages are read
 * again for block ones (./scan.ts). What a person approved, sent or wrote stays. Returns the pages set aside.
 */
export const SET_ASIDE_BY = "set aside: optimizations are per block now (10.11.2026)";
export async function setAsidePageIdeas(): Promise<{ env: Env; path: string }[]> {
  await ensureStudioSchema();
  const r = await query<{ env: Env; path: string }>(
    `UPDATE apsomh_convert_ideas SET status = 'dropped', decided_by = $1, decided_at = now()
      WHERE status = 'proposed' AND source = 'ai' AND COALESCE(scope, 'page') = 'page' AND COALESCE(content_type, '') <> 'landing-page'
      RETURNING env, path`, [SET_ASIDE_BY]);
  const seen = new Set<string>();
  return r.rows.filter((x) => { const k = `${x.env} ${x.path}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

/**
 * ONE NEW PAGE PER PAGE (SARCLA 11.11.2026: "you should not have multiple optimizations to create a new page - this should
 * be only one; on the current page they could have multiple optimizations"): once, a page's new landing pages beyond its
 * first are set aside - dropped, so "Bring back" still finds them. The one kept: one a person approved or sent, else the
 * best ranked (ICE), else the newest. Returns how many were set aside.
 */
export const ONE_NEW_PAGE_BY = "set aside: one new page per page (11.11.2026)";
export async function setAsideExtraNewPages(): Promise<number> {
  await ensureStudioSchema();
  const r = await query<{ id: string }>(
    `WITH ranked AS (
       SELECT id, status, row_number() OVER (PARTITION BY env, path ORDER BY (status <> 'proposed') DESC,
              (COALESCE(impact, 0) * COALESCE(confidence, 0))::float / GREATEST(COALESCE(effort, 1), 1) DESC, created_at DESC) AS k
         FROM apsomh_convert_ideas WHERE content_type = 'landing-page' AND status <> 'dropped')
     UPDATE apsomh_convert_ideas i SET status = 'dropped', decided_by = $1, decided_at = now()
       FROM ranked WHERE i.id = ranked.id AND ranked.k > 1 AND ranked.status = 'proposed'
     RETURNING i.id`, [ONE_NEW_PAGE_BY]);
  return r.rows.length;
}

/** How many optimizations each page has (Pages' rows): waiting for a yes or no, approved or sent, and of those per block. */
export async function optimizationsOn(env: Env, paths: string[]): Promise<Record<string, { waiting: number; approved: number; blocks: number }>> {
  if (!paths.length) return {};
  await ensureStudioSchema();
  const r = await query<{ path: string; waiting: number; approved: number; blocks: number }>(
    `SELECT path, count(*) FILTER (WHERE status = 'proposed')::int AS waiting, count(*) FILTER (WHERE status = 'approved')::int AS approved,
            count(*) FILTER (WHERE status <> 'dropped' AND scope = 'block')::int AS blocks
       FROM apsomh_convert_ideas WHERE env = $1 AND path = ANY($2::text[]) GROUP BY path`, [env, paths.slice(0, 200)]);
  return Object.fromEntries(r.rows.map((x) => [x.path, { waiting: x.waiting, approved: x.approved, blocks: x.blocks }]));
}

/** Pages whose page-wide optimizations were set aside and that have no block optimization yet - to read again. */
export async function pagesToRedo(limit: number): Promise<{ env: Env; path: string; kind: PageKind }[]> {
  await ensureStudioSchema();
  const r = await query<{ env: Env; path: string; kind: PageKind }>(
    `SELECT i.env, i.path, min(i.kind) AS kind FROM apsomh_convert_ideas i
      WHERE i.decided_by = $1 AND i.kind IN ('home', 'category', 'cms')
        AND NOT EXISTS (SELECT 1 FROM apsomh_convert_ideas b WHERE b.env = i.env AND b.path = i.path AND b.scope = 'block')
      GROUP BY i.env, i.path ORDER BY count(*) DESC, i.path LIMIT $2`, [SET_ASIDE_BY, limit]);
  return r.rows;
}

async function ideaById(id: string): Promise<Idea | null> {
  const r = await query<IdeaRow>(`SELECT * FROM apsomh_convert_ideas WHERE id = $1`, [id]);
  return r.rows[0] ? toIdea(r.rows[0]) : null;
}
export async function versionById(id: string): Promise<Version | null> {
  await ensureStudioSchema();
  const r = await query<VersionRow>(`SELECT * FROM apsomh_convert_versions WHERE id = $1`, [id]);
  return r.rows[0] ? toVersion(r.rows[0]) : null;
}
export async function revisionChanges(versionId: string, rev: number): Promise<Change[] | null> {
  await ensureStudioSchema();
  const r = await query<{ changes: Change[] }>(`SELECT changes FROM apsomh_convert_revisions WHERE version_id = $1 AND rev = $2`, [versionId, rev]);
  return r.rows[0]?.changes ?? null;
}
export async function revisions(versionId: string): Promise<Revision[]> {
  await ensureStudioSchema();
  const r = await query<{ rev: number; summary: string; request: string | null; by_whom: string | null; at: Date; n: number }>(
    `SELECT rev, summary, request, by_whom, at, jsonb_array_length(changes) AS n FROM apsomh_convert_revisions WHERE version_id = $1 ORDER BY rev DESC`, [versionId]);
  return r.rows.map((x) => ({ rev: x.rev, summary: x.summary, request: x.request, by: x.by_whom, at: iso(x.at)!, count: Number(x.n) }));
}

/** A new revision of a version (or its first): the list replaced, the old one kept in the revisions. */
async function saveRevision(idea: Idea, changes: Change[], summary: string, request: string | null, by: string, letter = "A"): Promise<Version> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cur = await client.query<VersionRow>(`SELECT * FROM apsomh_convert_versions WHERE idea_id = $1 AND letter = $2 FOR UPDATE`, [idea.id, letter]);
    let v: VersionRow;
    if (cur.rows[0]) {
      const u = await client.query<VersionRow>(
        `UPDATE apsomh_convert_versions SET rev = rev + 1, changes = $2::jsonb, summary = $3, status = 'draft', approved_by = NULL, approved_at = NULL, updated_at = now()
          WHERE id = $1 RETURNING *`, [cur.rows[0].id, JSON.stringify(changes), summary]);
      v = u.rows[0];
    } else {
      const i = await client.query<VersionRow>(
        `INSERT INTO apsomh_convert_versions (idea_id, env, path, changes, summary, created_by, letter) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7) RETURNING *`,
        [idea.id, idea.env, idea.path, JSON.stringify(changes), summary, by, letter]);
      v = i.rows[0];
    }
    await client.query(`INSERT INTO apsomh_convert_revisions (version_id, rev, changes, summary, request, by_whom) VALUES ($1, $2, $3::jsonb, $4, $5, $6)`,
      [v.id, v.rev, JSON.stringify(changes), summary, request, by]);
    await client.query("COMMIT");
    return toVersion(v);
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function setVersionStatus(id: string, status: VersionStatus, by: string): Promise<Version | null> {
  await ensureStudioSchema();
  const r = await query<VersionRow>(
    status === "approved"
      ? `UPDATE apsomh_convert_versions SET status = 'approved', approved_by = $2, approved_at = now(), updated_at = now() WHERE id = $1 RETURNING *`
      : `UPDATE apsomh_convert_versions SET status = 'draft', approved_by = NULL, approved_at = NULL, updated_at = now() WHERE id = $1 AND $2::text IS NOT NULL RETURNING *`,
    [id, by]);
  return r.rows[0] ? toVersion(r.rows[0]) : null;
}

/** A person's own edit of the list (the JSON beside the preview). */
export async function editVersion(versionId: string, input: unknown, by: string): Promise<{ version: Version | null; problems: string[] }> {
  const v = await versionById(versionId);
  if (!v) return { version: null, problems: ["no such version"] };
  const idea = await ideaById(v.ideaId);
  if (!idea) return { version: null, problems: ["its idea is gone"] };
  const { changes, problems } = validateChanges(input);
  if (!changes.length) return { version: null, problems: problems.length ? problems : ["the list is empty"] };
  return { version: await saveRevision(idea, changes, v.summary, "edited by hand", by, v.letter), problems };
}

// ---------------------------------------------------------------------------------------------------------------------
// THE AI - asked at a person's click only, and at most AI_PER_DAY times a day on this hub.

export const AI_PER_DAY = 150;
let spent = { day: "", n: 0 };
/** How many times the AI may still be asked today on this hub (the night and hourly batches keep some for people). */
export function aiLeft(): number {
  const day = new Date().toISOString().slice(0, 10);
  return spent.day === day ? Math.max(0, AI_PER_DAY - spent.n) : AI_PER_DAY;
}
function spend(): boolean {
  const day = new Date().toISOString().slice(0, 10);
  if (spent.day !== day) spent = { day, n: 0 };
  if (spent.n >= AI_PER_DAY) return false;
  spent.n++;
  return true;
}

export const SHOP_FACTS = `APSOparts (apsoparts.com) is the online shop of Angst+Pfister: technical parts for industry - seals and O-rings,
plastics, fluid handling (hoses), drive technology (belts), anti-vibration, sensors. Buyers are companies (engineers,
purchasers, maintenance). Store views are language-COUNTRY (de-CH, fr-CH, it-CH, en-CH, fr-FR, it-IT, nl-NL, pl-PL, en-...).
The shop's look: petrol #274e64 (headers, main buttons), red #d80901 (small accents, the logo), text #5e5e5e, font futura-pt,
white cards on a light grey (#f2f4f5) ground, product photos on white. Product pages list ARTICLES (sizes/variants) in a table
with quantity, availability, delivery date and total price; prices can depend on quantity and on the customer.`;

export const RULES = `Hard rules:
- Use only what the page and the numbers show. NEVER invent prices, discounts, stock, delivery times, certificates,
  approvals (FDA, KTW, ...), test results, customer names or quotes. If an idea needs a fact the page does not give,
  say so in the idea ("needs: ...") instead of making it up.
- EVERYTHING you write is in ENGLISH, whatever the page's language (SARCLA 10.11.2026: "the recommendations should
  always be in English"): the reading, the optimizations, the notes, and any new words on the page - a label, a message,
  an example. Name a label the shop shows by its English meaning; Content translates for each store view.
- Keep what the page needs for search engines: its H1 text, its links, its product data.
- Plain, concrete, human words; no slogans, no hype, no exclamation marks.`;

export type AiResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function ask<T>(system: string, user: string, schema: Record<string, unknown>, maxTokens: number): Promise<AiResult<T>> {
  const client = getAnthropic();
  if (!client) return { ok: false, error: "No Anthropic key on this hub (ANTHROPIC_API_KEY)." };
  if (!spend()) return { ok: false, error: `The AI was asked ${AI_PER_DAY} times today on this hub - again tomorrow.` };
  const sys: Anthropic.TextBlockParam[] = [{ type: "text", text: system }];
  const r = await claudeText({ client, system: sys, user, budget: { maxTokens, effort: "medium" }, outputFormat: { type: "json_schema", schema } });
  if (!r.ok) return { ok: false, error: r.failure.error };
  try {
    return { ok: true, data: JSON.parse(r.text) as T };
  } catch {
    return { ok: false, error: "The AI's answer could not be read - ask again." };
  }
}

/** The page as the browser drew it (the preview frame's outline): strings only, capped - it travels in a request body. */
export function cleanDrawn(x: unknown): string[] | null {
  if (!Array.isArray(x)) return null;
  const out: string[] = [];
  let chars = 0;
  for (const l of x) {
    if (typeof l !== "string") continue;
    const line = l.slice(0, 200);
    if (out.length >= 160 || chars + line.length > 5600) break;
    out.push(line);
    chars += line.length + 1;
  }
  return out.length ? out : null;
}

function pageBrief(page: ShopPage, o: Outline, drawn: string[] | null = null): string {
  const store = classify(page.path).store ?? "?";
  const seen = drawn?.length
    ? `

THE MAIN COLUMN AS THE BROWSER DREW IT (after the theme's scripts - the articles table, prices, availability, buttons are
here; aim at these selectors when a change concerns those parts):
${drawn.join("\n")}`
    : "";
  return `PAGE: ${page.url}
Kind: ${page.kind}${page.product ? ` (product ${page.product})` : ""} · store view ${store} · environment ${page.env}
Title: ${o.title}
Description: ${o.description}
H1: ${o.h1.join(" | ") || "-"}

MAIN COLUMN (indented lines "selector · text"; a line ending in "…" was shortened HERE, for length - the page shows it
whole; parts drawn by the theme's scripts after loading, like the articles' prices and availability, are NOT in it):
${o.lines.join("\n")}${o.truncated ? "\n(... cut here)" : ""}${seen}`;
}

function numbersBrief(n: Numbers | null): string {
  if (!n) return "NUMBERS: none for this page yet.";
  const pct = (x: number | null | undefined) => (x === null || x === undefined ? "-" : `${(x * 100).toFixed(1)}%`);
  return `NUMBERS${n.from ? ` (${n.from} to ${n.to})` : ""}:
- Google Analytics: ${n.views ?? "-"} views, ${n.addToCarts ?? "-"} add-to-carts, cart rate ${pct(n.rate)} (typical for this kind of page ${pct(n.typical)})
- Signed-in customers who opened it: ${n.companies ?? "-"}, did not order: ${n.lost ?? "-"}, most stopped at: ${n.topLoss ?? "-"}
- Why it is on the problem list: ${(n.reasons ?? []).join(" / ") || "-"}`;
}

const IDEAS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["analysis", "ideas"],
  properties: {
    analysis: { type: "string", description: "Your reading of the page for the marketing team, English, 2-3 sentences: what the page does well, and the one thing that most likely stops buyers here - grounded in the numbers and what is on the page" },
    ideas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "why", "change", "expect", "impact", "confidence", "effort", "target", "type"],
        properties: {
          title: { type: "string", description: "The idea in under 10 words, English" },
          why: { type: "string", description: "Which number or which part of the page points to it, English, 1-2 sentences" },
          change: { type: "string", description: "What changes on the page, concretely, English, 1-3 sentences" },
          expect: { type: "string", description: "What should move if it works (add-to-carts, orders, fewer customers stopping at a step), English, 1 sentence" },
          impact: { type: "integer", description: "1-5: how much add-to-carts should move if it works (5 = it removes the main reason buyers stop)" },
          confidence: { type: "integer", description: "1-5: how strongly THIS page's numbers and content point to it (5 = the numbers say it plainly; 1 = a general hunch)" },
          effort: { type: "integer", description: "1-5: how much the version takes (1 = a style or a moved block; 5 = new content or data the page does not have)" },
          target: { type: "string", description: "The block of the page this idea changes, as a CSS selector copied EXACTLY from the page as drawn (the part before ' · ' of one of its lines, e.g. '#maincontent' or 'div.product-info-main'); empty when it is about the whole page" },
          type: { type: "string", enum: ["page-refresh", "landing-page", "banner", "newsletter"], description: "The kind of content the marketing team makes for it: page-refresh = a change of THIS page or block as it is (layout, texts, order, emphasis, a block added or moved); landing-page = a NEW page for searches the shop does not answer (only when the evidence is what people search on Google); banner = the home slider or a banner; newsletter = the newsletter band or its sign-up" },
        },
      },
    },
  },
};

/**
 * Where a page's visitors come from and go next (Visitor journeys' page flow, Google Analytics) as lines for the AI -
 * "56% left the shop after it" is the kind of evidence an idea should stand on. Empty when Google Analytics does not
 * answer in time; the ideas go on without it.
 */
async function flowBrief(path: string, numbers: Numbers | null): Promise<string> {
  const day = (t: number) => new Date(t).toISOString().slice(0, 10);
  const to = numbers?.to ?? day(Date.now() - 86_400_000);
  const from = numbers?.from ?? day(Date.parse(to) - 27 * 86_400_000);
  try {
    const d = await Promise.race([
      buildPageFlow(path, from, to),
      new Promise<never>((_, no) => setTimeout(() => no(new Error("late")), 25_000)),
    ]);
    const f = d.flow;
    if (!f.views) return "";
    const share = (n: number) => `${Math.round((n / f.views) * 100)}%`;
    const came = f.from.slice(0, 6).map((s) => `${s.label} ${share(s.views)}`).join(", ");
    const sides = f.to.slice(0, 6).map((s) => `${s.label} ${share(s.views)}`);
    if (!f.to.some((s) => String(s.kind) === "left") && f.left) sides.push(`left the shop ${share(f.left)}`);
    const landing = d.landing.sessions ? ` Visits that came in on it: ${d.landing.sessions}; ${d.landing.carts} of them put something in the cart, ${d.landing.orders} ordered.` : "";
    return `
WHERE ITS VISITORS COME FROM AND GO NEXT (Google Analytics, ${from} to ${to}, ${f.views} views): came from ${came || "-"}; went next to ${sides.join(", ") || "-"}.${landing}`;
  } catch {
    return "";
  }
}

/** A block of the shop shown on many pages (the newsletter band, the home slider...): ./blocks.ts. */
export type BlockFocus = { key?: string; name: string; selector: string; about: string; goal: string; focus?: string };

/**
 * NEW LANDING PAGES for what Google shows a page for and the page does not answer (SARCLA 10.11.2026: "we should have
 * already SEO pages waiting for design") - the SEO landing page type: each optimization is a NEW page for Content to
 * write, not a change of this one, so it needs no version on this page.
 */
const LANDING_SYSTEM = `You are the SEO and conversion specialist of a B2B web shop. Google shows THIS page for searches it
answers badly - the numbers below say how often it was shown, how few clicked, and the searches. Propose exactly ONE NEW
LANDING PAGE the shop should have: for the biggest group of those searches (one search intent - the page this page's
searchers miss most). Of it:
- title: the new page's H1, under 10 words
- why: the searches it is for, with their numbers, and why this page does not answer them
- change: what the new page holds - its opening line, the shop's ranges and products that answer the search (only ones
  this page or the shop's ranges name), the questions a buyer has there, and the links to it (from this page, from the
  category) and from it (into the products)
- expect: more clicks from Google on those searches, and what buyers do next
- type: always landing-page; target: empty
A short reading first: which searches Google shows the page for, and what the page lacks for them. When the numbers name
no search, propose from the page's own subject and say in why that the searches are to be checked.`;

export async function proposeIdeas(env: Env, path: string, numbers: Numbers | null, by: string, drawn: string[] | null = null, block: BlockFocus | null = null, landing = false): Promise<AiResult<Idea[]>> {
  // one new page per page: a page that has its new page already gets no other
  const work = await pageWork(env, path);
  if (landing && work.ideas.some((i) => i.contentType === "landing-page" && i.status !== "dropped")) return { ok: false, error: "This page has its new page already - drop it first for another one." };
  const page = await shopPage(env, path);
  if (page.status !== 200) return { ok: false, error: `The shop answered ${page.status} for this page.` };
  const o = pageOutline(page);
  const existing = work.ideas.map((i) => `- ${i.title} (${i.status})`).join("\n");
  const system = landing ? `${LANDING_SYSTEM}

${SHOP_FACTS}

${RULES}` : block
    ? `You are the conversion specialist of a B2B web shop. You look at ONE BLOCK the shop shows on many pages - not the
page around it - and propose 3 to 5 optimizations of that block to test, each one a clearly different direction a
version can make (layout, order, emphasis, a picture, the call to action, its words). Rank them: the one most likely to
move the block's goal first - it leads. Every idea's target is the block's selector or a selector inside it, copied from
the page as drawn. Write a short reading of the block first: what it does well and what most likely holds it back.

${SHOP_FACTS}

${RULES}`
    : `You are the conversion specialist of a B2B web shop. You look at one page and its numbers and propose
3 to 5 ideas to test, each one a change on THIS page that a version can make (layout, wording, order, emphasis, a missing
piece of information the page already has elsewhere). Rank them: the one most likely to move add-to-carts first - it
leads. Say for each the block of the page it is about (its selector, copied from the page as drawn), and write a short
reading of the page first: what it does well and what most likely stops buyers.

${SHOP_FACTS}

${RULES}`;
  const flow = block || landing ? "" : await flowBrief(path, numbers);
  const focus = block ? `

THE BLOCK TO OPTIMIZE: ${block.name} - selector ${block.selector}
What it is: ${block.about}
Its goal: ${block.goal}
Look at the lines of the page under that selector; the rest of the page is only its surroundings.` : "";
  const user = `${pageBrief(page, o, drawn)}

${numbersBrief(numbers)}${flow}${focus}
${existing ? `\nIDEAS ALREADY ON THIS PAGE (do not repeat them):\n${existing}` : ""}`;
  const r = await ask<{ analysis?: string; ideas: { title: string; why: string; change: string; expect: string; impact: number; confidence: number; effort: number; target?: string; type?: string }[] }>(system, user, IDEAS_SCHEMA, 8000);
  if (!r.ok) return r;
  const reading = (r.data.analysis ?? "").trim().slice(0, 1200);
  // Google's reading for new landing pages is not the page's reading (it read as one of the page's on Preview)
  if (reading && !landing) {
    await query(`INSERT INTO apsomh_convert_analyses (env, path, text, by_whom, at) VALUES ($1, $2, $3, $4, now())
                 ON CONFLICT (env, path) DO UPDATE SET text = EXCLUDED.text, by_whom = EXCLUDED.by_whom, at = now()`, [env, path, reading, by]);
  }
  const out: Idea[] = [];
  for (const i of (r.data.ideas ?? []).slice(0, landing ? 1 : 5)) {
    if (!i.title?.trim()) continue;
    // a new landing page is one by nature; a block's optimizations are the block's type (the slider a banner, the
    // newsletter band the newsletter) - the AI's own type only for a page's optimizations
    const type = landing ? "landing-page" : block?.key ? typeOfBlock(block.key) : i.type;
    out.push(await addIdea(env, path, { ...i, type, target: landing ? null : i.target, block: block?.key ?? null }, by, "ai", numbers));
  }
  return { ok: true, data: out };
}

// ---------------------------------------------------------------------------------------------------------------------
// EVERYTHING IN ENGLISH, ALSO WHAT WAS WRITTEN BEFORE (SARCLA 10.11.2026: "still text in German"): the optimizations, the
// pages' readings and the versions' summaries that do not read as English (./lang.ts) are put into English by the AI,
// a few at a time, inside the day's AI budget. Run by ./scan.ts after a start and every hour; a text already English is
// never touched, so it costs nothing once done.

const ENGLISH_SYSTEM = `You put a web shop team's notes into plain English. Translate faithfully: the same meaning, the
same facts and numbers, about the same length - nothing added, nothing left out. A label, button or category the shop
shows is given by its English meaning, with the shop's own words once in quotes where that helps to find it on the page
(e.g. Sealing technology ("Dichtungstechnik")). CSS selectors, addresses, product numbers and figures stay exactly as they
are. Plain, concrete words. Answer with the same ids.`;

const IDEAS_EN_SCHEMA = {
  type: "object", additionalProperties: false, required: ["items"],
  properties: { items: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "title", "why", "change", "expect"],
    properties: { id: { type: "string" }, title: { type: "string" }, why: { type: "string" }, change: { type: "string" }, expect: { type: "string" } } } } },
};
const TEXTS_EN_SCHEMA = {
  type: "object", additionalProperties: false, required: ["items"],
  properties: { items: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "text"],
    properties: { id: { type: "string" }, text: { type: "string" } } } } },
};

export async function englishPass(maxCalls = 8): Promise<{ ideas: number; readings: number; summaries: number; left: number; note: string }> {
  await ensureStudioSchema();
  let calls = 0, ideas = 0, readings = 0, summaries = 0, left = 0, stop = "";
  const spentToday = (e: string) => /times today/.test(e);

  const rows = (await query<IdeaRow>(`SELECT * FROM apsomh_convert_ideas WHERE status <> 'dropped' ORDER BY id DESC LIMIT 800`)).rows
    .filter((r) => !looksEnglish(`${r.title}\n${r.why}\n${r.change}\n${r.expect}`));
  for (let k = 0; k < rows.length; k += 8) {
    if (calls >= maxCalls || stop) { left += rows.length - k; break; }
    const batch = rows.slice(k, k + 8);
    calls++;
    const r = await ask<{ items: { id: string; title: string; why: string; change: string; expect: string }[] }>(ENGLISH_SYSTEM,
      `Put these optimizations into English:\n${JSON.stringify(batch.map((b) => ({ id: String(b.id), title: b.title, why: b.why, change: b.change, expect: b.expect })), null, 1)}`,
      IDEAS_EN_SCHEMA, 12000);
    if (!r.ok) { if (spentToday(r.error)) stop = r.error; left += batch.length; continue; }
    for (const it of r.data.items ?? []) {
      const src = batch.find((b) => String(b.id) === String(it.id));
      const t = { title: (it.title ?? "").trim(), why: (it.why ?? "").trim(), change: (it.change ?? "").trim(), expect: (it.expect ?? "").trim() };
      if (!src || !t.title || !looksEnglish(`${t.title}\n${t.why}\n${t.change}\n${t.expect}`)) continue;
      await query(`UPDATE apsomh_convert_ideas SET title = $2, why = $3, change = $4, expect = $5 WHERE id = $1`,
        [src.id, t.title.slice(0, 200), (t.why || src.why).slice(0, 1500), (t.change || src.change).slice(0, 2000), (t.expect || src.expect).slice(0, 600)]);
      ideas++;
    }
  }

  // the pages' readings and the versions' summaries: plain texts, by a made-up id
  const texts = async (list: { id: string; text: string }[], save: (id: string, text: string) => Promise<void>): Promise<number> => {
    let n = 0;
    for (let k = 0; k < list.length; k += 12) {
      if (calls >= maxCalls || stop) { left += list.length - k; break; }
      const batch = list.slice(k, k + 12);
      calls++;
      const r = await ask<{ items: { id: string; text: string }[] }>(ENGLISH_SYSTEM, `Put these notes into English:\n${JSON.stringify(batch, null, 1)}`, TEXTS_EN_SCHEMA, 10000);
      if (!r.ok) { if (spentToday(r.error)) stop = r.error; left += batch.length; continue; }
      for (const it of r.data.items ?? []) {
        const text = (it.text ?? "").trim();
        if (!batch.some((b) => b.id === it.id) || !text || !looksEnglish(text)) continue;
        await save(it.id, text);
        n++;
      }
    }
    return n;
  };
  const an = (await query<{ env: Env; path: string; text: string }>(`SELECT env, path, text FROM apsomh_convert_analyses WHERE text <> ''`)).rows.filter((a) => !looksEnglish(a.text));
  readings = await texts(an.map((a, i) => ({ id: String(i), text: a.text })), async (id, text) => {
    const a = an[Number(id)];
    if (a) await query(`UPDATE apsomh_convert_analyses SET text = $3 WHERE env = $1 AND path = $2`, [a.env, a.path, text.slice(0, 1200)]);
  });
  const vs = (await query<{ id: string; summary: string }>(`SELECT id, summary FROM apsomh_convert_versions WHERE summary <> ''`)).rows.filter((v) => !looksEnglish(v.summary));
  summaries = await texts(vs.map((v) => ({ id: String(v.id), text: v.summary })), async (id, text) => {
    await query(`UPDATE apsomh_convert_versions SET summary = $2 WHERE id = $1`, [id, text.slice(0, 600)]);
  });

  const note = `${ideas} optimizations, ${readings} readings, ${summaries} version summaries put into English${left ? `; ${left} still to do` : ""}${stop ? ` (${stop})` : ""}`;
  return { ideas, readings, summaries, left, note };
}

const CHANGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "changes"],
  properties: {
    summary: { type: "string", description: "What the version does, for the person approving it, English, 1-2 sentences" },
    changes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["op", "selector", "where", "html", "css", "text", "name", "value", "all", "note"],
        properties: {
          op: { type: "string", enum: ["css", "html", "replace", "insert", "text", "hide", "attr"] },
          selector: { type: "string", description: "CSS selector of the element (empty for op css)" },
          where: { type: "string", enum: ["", "before", "after", "prepend", "append"], description: "only for op insert" },
          html: { type: "string", description: "for html (inner HTML), replace (the element), insert (the new block); else empty" },
          css: { type: "string", description: "only for op css: the stylesheet" },
          text: { type: "string", description: "only for op text" },
          name: { type: "string", description: "only for op attr" },
          value: { type: "string", description: "only for op attr" },
          all: { type: "boolean", description: "true = every element the selector finds, false = the first" },
          note: { type: "string", description: "What this change does, English, under 12 words" },
        },
      },
    },
  },
};

const VERSION_SYSTEM = `You write a VERSION of a shop page for an A/B test: a list of changes laid over the page in the
browser after it loads. Kinds of change: css (a stylesheet added to the page), html (new inner HTML of an element),
replace (an element replaced by new HTML), insert (new HTML before/after/prepended/appended to an element), text (new
text of an element), hide (an element hidden), attr (an attribute set).

How to write it:
- Aim at selectors from the page's outline (ids first, then tag.class). Scope CSS to the page's own classes - never
  restyle body, html or the whole header.
- Few, clean changes that make exactly the idea, nothing else. Prefer adding and reshaping to hiding.
- SHOW THE FINISHED THING, WHERE IT HAPPENS (SARCLA 10.11.2026 on a version with a floating box of placeholders: "this
  proposal is pure shit"): the change sits exactly where a buyer would meet it - a message in the article row goes into
  the FIRST row of the articles as a worked example (class apx-example), a note under the price goes under the price,
  a button beside the button it helps. Never a box floating in empty space, never a block "about" the change.
- REAL WORDS, IN ENGLISH: write the actual text the finished page would show - short, concrete, one or two lines - with
  example values taken from the page (an article it lists, a quantity, a date the page shows). No placeholder, no
  "[Text from ...]", no note to the reader inside the page. Never invent a fact (see the hard rules): where the page
  does not give a value, word the example so it needs none ("Need more? Ask for this quantity").
- WHERE A NEW BLOCK GOES (SARCLA 10.11.2026, a tile block squeezed into the page's coloured title band: "still not up
  to expected"): inside the page's CONTENT - the main column, between the page's own content blocks - never inside the
  title band (.page-title-wrapper, the heading's coloured band, the h1 itself), the breadcrumbs, the header, the menus
  or the footer. "Under the section X" means after the whole section - its text and pictures - not right after its
  heading. Insert after/before a content block of the page (a Page Builder row, a text block), not into a heading.
- A NEW BLOCK IS FINISHED DESIGN, NOT A WIREFRAME - it looks like the shop made it: a heading in the shop's style
  (petrol #274e64, 20-22px, weight 600, 24px above, 12px below), then the content with room around it (24-32px from
  its neighbours). Link tiles are white cards (1px solid #dde3e6, 4px corners, padding 14px 16px) with the name in 15px
  semi-bold petrol and a "›" at the right, in a grid of 3 (2 on a tablet, 1 on a phone), hover background #f2f4f5,
  the whole card the link; a picture only when its address is on the page. Never grey boxes, tiny text or a bare list
  of links pretending to be tiles.
- THE SHOP'S LOOK: font inherit, the colours below, 4px corners, 13-15px text (headings above), no dashed borders, no
  shadows; a new button looks like the shop's own (petrol, white text) or a plain text link. Class names you add start
  with "apx-". Every new block also reads well on a phone (390 px): give it a mobile rule in the CSS.
- New HTML: no <script>, no on...= handlers, no javascript: links, no frames.
- Parts the theme draws after loading (articles' prices, availability) are not in the outline: you may aim at their
  known containers but say so in the note.

${SAFETY_RULES}

${SHOP_FACTS}

${RULES}`;

type AiChange = { op: string; selector: string; where: string; html: string; css: string; text: string; name: string; value: string; all: boolean; note: string };
function fromAi(list: AiChange[]): unknown[] {
  return (list ?? []).map((c) => {
    const o: Record<string, unknown> = { op: c.op };
    if (c.note) o.note = c.note;
    if (c.all) o.all = true;
    if (c.op === "css") o.css = c.css;
    else {
      o.selector = c.selector;
      if (c.op === "html" || c.op === "replace" || c.op === "insert") o.html = c.html;
      if (c.op === "insert") o.where = c.where || "after";
      if (c.op === "text") o.text = c.text;
      if (c.op === "attr") { o.name = c.name; o.value = c.value; }
    }
    return o;
  });
}

/** The letters an optimization's versions take, in order: A first, at most four. */
export const VERSION_LETTERS = ["A", "B", "C", "D"] as const;
export const nextLetter = (taken: string[]): string | null => VERSION_LETTERS.find((l) => !taken.includes(l)) ?? null;

/**
 * An optimization's version, written by the AI: its first (A), a new revision of one of them from a person's request in
 * plain words, or ANOTHER version (B, C, D) - a different way to make the same optimization, so they can be tested
 * against the page (SARCLA 09.11.2026: "always multiple or 1 version for a/b testing"). Writing a version is a yes to
 * the optimization: a proposed one becomes approved.
 */
export async function writeVersion(ideaId: string, request: string | null, by: string, drawn: string[] | null = null, opts: { letter?: string | null; another?: boolean } = {}): Promise<AiResult<{ version: Version; problems: string[] }>> {
  await ensureStudioSchema();
  let idea = await ideaById(ideaId);
  if (!idea) return { ok: false, error: "No such optimization." };
  if (idea.status === "dropped") return { ok: false, error: "This optimization was dropped - bring it back first." };
  if (idea.status === "proposed") idea = (await setIdeaStatus(idea.id, "approved", by)) ?? idea;
  const page = await shopPage(idea.env, idea.path);
  if (page.status !== 200) return { ok: false, error: `The shop answered ${page.status} for this page.` };
  const o = pageOutline(page);
  const all = (await query<VersionRow>(`SELECT * FROM apsomh_convert_versions WHERE idea_id = $1 ORDER BY letter`, [idea.id])).rows;
  const taken = all.map((v) => v.letter || "A");
  let letter: string;
  if (opts.another && all.length) {
    const next = nextLetter(taken);
    if (!next) return { ok: false, error: `This optimization has ${VERSION_LETTERS.length} versions already - revise one of them instead.` };
    letter = next;
  } else {
    letter = opts.letter && taken.includes(opts.letter) ? opts.letter : taken[0] ?? "A";
  }
  const cur = all.find((v) => (v.letter || "A") === letter) ?? null;
  const others = all.filter((v) => (v.letter || "A") !== letter);
  // a content page: the Content studio's modules make the version (./modular.ts - SARCLA 10.11.2026: "the content agent
  // ... quality is much higher"); a product page, a block in the footer, or a plan that brings nothing: written below
  let planNote = "";
  if (usesModules(page.kind, idea.block) || idea.scope === "block") {
    const m = await moduleVersion({
      ask, page: { env: page.env, path: page.path, url: page.url, html: page.html, kind: page.kind }, outline: o.lines, letter, request,
      brief: `${numbersBrief(idea.numbers)}

THE OPTIMIZATION (approved): ${idea.title}
Why: ${idea.why}
Change: ${idea.change}
Expected: ${idea.expect}`,
      others: opts.another && others.length ? others.map((v) => ({ letter: v.letter || "A", summary: v.summary })) : null,
      current: !opts.another && cur && request ? cur.changes : null,
      target: idea.scope === "block" ? idea.target ?? null : null,
    });
    if (m.ok) {
      const version = await saveRevision(idea, m.changes, m.summary, opts.another ? (request ?? "another version") : request, by, letter);
      return { ok: true, data: { version, problems: m.problems } };
    }
    if (m.budget) return { ok: false, error: m.error };
    planNote = m.error;
    console.warn(`[convert-version] ${idea.path}: the module plan brought nothing (${m.error}) - written the other way`);
  }
  const user = `${pageBrief(page, o, drawn)}

${numbersBrief(idea.numbers)}

THE OPTIMIZATION (approved): ${idea.title}
Why: ${idea.why}
Change: ${idea.change}
Expected: ${idea.expect}${idea.target ? `\nThe block it is about: ${idea.target}` : ""}
${opts.another && others.length ? `
THE VERSIONS IT HAS ALREADY:
${others.map((v) => `Version ${v.letter || "A"}: ${v.summary}`).join("\n")}

WRITE VERSION ${letter}: ANOTHER way to make the same optimization - a clearly different layout, order or emphasis, not a
copy with small changes - so the versions can be tested against the page and against each other.${request ? `\nTHE PERSON ADDS: ${request}` : ""}` : cur && request ? `
VERSION ${letter} AS IT IS NOW (revision ${cur.rev}):
${JSON.stringify(cur.changes, null, 1)}

THE PERSON ASKS: ${request}
Answer with the WHOLE new list (keep what they did not ask to change).` : request ? `\nTHE PERSON ADDS: ${request}` : ""}`;
  const r = await ask<{ summary: string; changes: AiChange[] }>(VERSION_SYSTEM, user, CHANGE_SCHEMA, 16000);
  if (!r.ok) return r;
  let { changes, problems } = validateChanges(fromAi(r.data.changes));
  let summary = r.data.summary ?? "";
  // a version must not break the shop (./safety.ts): what moves, re-sizes, rewrites or hides the shop's own parts is
  // sent back to the AI once, with what it did; what is still risky after that is left out, and said so
  const risky = [...riskOf(changes).flatMap((x) => x.problems), ...qualityOf(changes)];
  if (risky.length) {
    const again = await ask<{ summary: string; changes: AiChange[] }>(VERSION_SYSTEM, `${user}

YOUR LAST ANSWER BROKE THE RULES:
${risky.slice(0, 8).map((p) => `- ${p}`).join("\n")}
Write the WHOLE list again: the shop's own parts stay where and as they are; the change is shown for real where a buyer
meets it, with real short words in English; only what cannot be shown becomes ONE sketch at that place (apx-sketch).`, CHANGE_SCHEMA, 16000);
    if (again.ok) {
      const v = validateChanges(fromAi(again.data.changes));
      if (v.changes.length) { changes = v.changes; problems = v.problems; summary = again.data.summary ?? summary; }
    }
  }
  const safe = safePart(changes);
  if (safe.dropped.length) problems = [...problems, ...[...new Set(safe.dropped)].slice(0, 6).map((d) => `left out - it ${d}`)];
  changes = safe.changes;
  if (!changes.length) return { ok: false, error: `The AI's version had no usable change${problems.length ? `: ${problems.join("; ")}` : ""} - ask again.` };
  const version = await saveRevision(idea, changes, summary.slice(0, 600), opts.another ? (request ?? "another version") : request, by, letter);
  return { ok: true, data: { version, problems: planNote ? [`No module fitted (${planNote}) - written as a free block`, ...problems] : problems } };
}

/**
 * SEND TO PROJECT (SARCLA 09.11.2026: "then send to project and on project is the really editor that bring to life -
 * so approve is more sent to project"): the optimization and every version it has are approved by the send, and the
 * Content project made for it is kept with them. The project itself is made by the caller (Content's own API).
 */
export async function markSent(ideaId: string, projectId: string | null, by: string): Promise<{ idea: Idea; versions: Version[] } | null> {
  await ensureStudioSchema();
  const i = await query<IdeaRow>(
    `UPDATE apsomh_convert_ideas SET status = 'approved', decided_by = COALESCE(decided_by, $2), decided_at = COALESCE(decided_at, now()),
            sent_by = $2, sent_at = now(), project_id = COALESCE($3::bigint, project_id) WHERE id = $1 AND status <> 'dropped' RETURNING *`,
    [ideaId, by, projectId]);
  if (!i.rows[0]) return null;
  const v = await query<VersionRow>(
    `UPDATE apsomh_convert_versions SET status = 'approved', approved_by = COALESCE(approved_by, $2), approved_at = COALESCE(approved_at, now()), updated_at = now()
      WHERE idea_id = $1 RETURNING *`, [ideaId, by]);
  return { idea: toIdea(i.rows[0]), versions: v.rows.map(toVersion).sort((a, b) => a.letter.localeCompare(b.letter)) };
}
