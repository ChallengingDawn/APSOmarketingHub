// APSOconvert > PREVIEW - per page: the live preview, the AI's ideas (a person approves or drops each), and for an
// approved idea a VERSION (src/lib/convert/versions.ts) the AI writes and a person reshapes in plain words until it is
// right, then approves. Every revision is kept, so a version can be read back step by step. Nothing here reaches the
// shop: the test (the A/B testing section) and Magento come after an approval.
//
// Tables: apsomh_convert_ideas, apsomh_convert_versions (one per idea), apsomh_convert_revisions.

import type Anthropic from "@anthropic-ai/sdk";
import { getPool, query } from "@/lib/db/client";
import { readPage } from "@/lib/directup/check";
import { shopGet } from "./assets";
import { claudeText, getAnthropic } from "@/lib/ai/claude";
import { buildPageFlow } from "@/lib/journeys/read";
import { ENVS, classify, type Env, type PageKind } from "./model";
import { outline, type Outline } from "./preview";
import { validateChanges, type Change } from "./versions";

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
  return classify(p).kind === "system" ? null : p;
}

export async function shopPage(env: Env, path: string, fresh = false): Promise<ShopPage> {
  const key = `${env}${path}`;
  const held = HELD.get(key);
  if (held && !fresh && Date.now() - held.at < TTL) return held;
  const running = INFLIGHT.get(key);
  if (running) return running;
  const url = `${ENVS[env].base}${path}`;
  const p = readPage(url, 25_000).then((r) => {
    const c = classify(path);
    const page: ShopPage = { env, path, url, status: r.status, html: r.body.slice(0, 4_000_000), at: Date.now(), kind: c.kind, product: c.product };
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
};
export type VersionStatus = "draft" | "approved";
export type Version = {
  id: string; ideaId: string; env: Env; path: string; rev: number; changes: Change[]; summary: string; status: VersionStatus;
  createdBy: string | null; createdAt: string; updatedAt: string; approvedBy: string | null; approvedAt: string | null;
};
export type Revision = { rev: number; summary: string; request: string | null; by: string | null; at: string; count: number };

type IdeaRow = {
  id: string; env: Env; path: string; page_key: string; kind: PageKind; title: string; why: string; change: string; expect: string;
  source: "ai" | "person"; status: IdeaStatus; numbers: Numbers | null; created_by: string | null; created_at: Date;
  decided_by: string | null; decided_at: Date | null; impact: number | null; confidence: number | null; effort: number | null;
};
type VersionRow = {
  id: string; idea_id: string; env: Env; path: string; rev: number; changes: Change[]; summary: string; status: VersionStatus;
  created_by: string | null; created_at: Date; updated_at: Date; approved_by: string | null; approved_at: Date | null;
};
const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);
const toIdea = (r: IdeaRow): Idea => ({
  id: String(r.id), env: r.env, path: r.path, pageKey: r.page_key, kind: r.kind, title: r.title, why: r.why, change: r.change, expect: r.expect,
  source: r.source, status: r.status, numbers: r.numbers, createdBy: r.created_by, createdAt: iso(r.created_at)!, decidedBy: r.decided_by, decidedAt: iso(r.decided_at),
  impact: r.impact ?? null, confidence: r.confidence ?? null, effort: r.effort ?? null,
});
const toVersion = (r: VersionRow): Version => ({
  id: String(r.id), ideaId: String(r.idea_id), env: r.env, path: r.path, rev: r.rev, changes: r.changes, summary: r.summary, status: r.status,
  createdBy: r.created_by, createdAt: iso(r.created_at)!, updatedAt: iso(r.updated_at)!, approvedBy: r.approved_by, approvedAt: iso(r.approved_at),
});

/** The key ideas share across a product's languages (like Problems): "product:<8 digits>", else "page:<path>". */
export function pageKeyOf(path: string): string {
  const c = classify(path);
  return c.kind === "product" && c.product ? `product:${c.product}` : `page:${path}`;
}

export async function pageWork(env: Env, path: string): Promise<{ ideas: Idea[]; versions: Version[] }> {
  await ensureStudioSchema();
  const [ideas, versions] = await Promise.all([
    query<IdeaRow>(`SELECT * FROM apsomh_convert_ideas WHERE env = $1 AND path = $2 ORDER BY (status = 'dropped'), id DESC`, [env, path]),
    query<VersionRow>(`SELECT * FROM apsomh_convert_versions WHERE env = $1 AND path = $2 ORDER BY id DESC`, [env, path]),
  ]);
  return { ideas: ideas.rows.map(toIdea), versions: versions.rows.map(toVersion) };
}

export type BoardRow = Idea & { version: Pick<Version, "id" | "rev" | "status" | "updatedAt"> | null };
export async function board(): Promise<BoardRow[]> {
  await ensureStudioSchema();
  const r = await query<IdeaRow & { v_id: string | null; v_rev: number | null; v_status: VersionStatus | null; v_updated: Date | null }>(
    `SELECT i.*, v.id AS v_id, v.rev AS v_rev, v.status AS v_status, v.updated_at AS v_updated
       FROM apsomh_convert_ideas i LEFT JOIN apsomh_convert_versions v ON v.idea_id = i.id
      ORDER BY COALESCE(v.updated_at, i.decided_at, i.created_at) DESC LIMIT 500`,
  );
  return r.rows.map((x) => ({ ...toIdea(x), version: x.v_id ? { id: String(x.v_id), rev: x.v_rev ?? 1, status: x.v_status ?? "draft", updatedAt: iso(x.v_updated)! } : null }));
}

export async function setIdeaStatus(id: string, status: IdeaStatus, by: string): Promise<Idea | null> {
  await ensureStudioSchema();
  const r = await query<IdeaRow>(`UPDATE apsomh_convert_ideas SET status = $2, decided_by = $3, decided_at = now() WHERE id = $1 RETURNING *`, [id, status, by]);
  return r.rows[0] ? toIdea(r.rows[0]) : null;
}

export async function addIdea(env: Env, path: string, idea: { title: string; why: string; change: string; expect: string; impact?: number; confidence?: number; effort?: number }, by: string, source: "ai" | "person", numbers: Numbers | null): Promise<Idea> {
  await ensureStudioSchema();
  const c = classify(path);
  const one = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? Math.max(1, Math.min(5, Math.round(x))) : null);
  const r = await query<IdeaRow>(
    `INSERT INTO apsomh_convert_ideas (env, path, page_key, kind, title, why, change, expect, source, status, numbers, created_by, impact, confidence, effort)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, $14, $15) RETURNING *`,
    [env, path, pageKeyOf(path), c.kind, idea.title.slice(0, 200), idea.why.slice(0, 1500), idea.change.slice(0, 2000), idea.expect.slice(0, 600), source,
      source === "person" ? "approved" : "proposed", numbers ? JSON.stringify(numbers) : null, by, one(idea.impact), one(idea.confidence), one(idea.effort)],
  );
  return toIdea(r.rows[0]);
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
async function saveRevision(idea: Idea, changes: Change[], summary: string, request: string | null, by: string): Promise<Version> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cur = await client.query<VersionRow>(`SELECT * FROM apsomh_convert_versions WHERE idea_id = $1 FOR UPDATE`, [idea.id]);
    let v: VersionRow;
    if (cur.rows[0]) {
      const u = await client.query<VersionRow>(
        `UPDATE apsomh_convert_versions SET rev = rev + 1, changes = $2::jsonb, summary = $3, status = 'draft', approved_by = NULL, approved_at = NULL, updated_at = now()
          WHERE id = $1 RETURNING *`, [cur.rows[0].id, JSON.stringify(changes), summary]);
      v = u.rows[0];
    } else {
      const i = await client.query<VersionRow>(
        `INSERT INTO apsomh_convert_versions (idea_id, env, path, changes, summary, created_by) VALUES ($1, $2, $3, $4::jsonb, $5, $6) RETURNING *`,
        [idea.id, idea.env, idea.path, JSON.stringify(changes), summary, by]);
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
  return { version: await saveRevision(idea, changes, v.summary, "edited by hand", by), problems };
}

// ---------------------------------------------------------------------------------------------------------------------
// THE AI - asked at a person's click only, and at most AI_PER_DAY times a day on this hub.

export const AI_PER_DAY = 150;
let spent = { day: "", n: 0 };
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
- Words a visitor reads are in the page's own language (from the store view: de-CH = German, fr-CH = French, ...).
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
  required: ["ideas"],
  properties: {
    ideas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "why", "change", "expect", "impact", "confidence", "effort"],
        properties: {
          title: { type: "string", description: "The idea in under 10 words, English" },
          why: { type: "string", description: "Which number or which part of the page points to it, English, 1-2 sentences" },
          change: { type: "string", description: "What changes on the page, concretely, English, 1-3 sentences" },
          expect: { type: "string", description: "What should move if it works (add-to-carts, orders, fewer customers stopping at a step), English, 1 sentence" },
          impact: { type: "integer", description: "1-5: how much add-to-carts should move if it works (5 = it removes the main reason buyers stop)" },
          confidence: { type: "integer", description: "1-5: how strongly THIS page's numbers and content point to it (5 = the numbers say it plainly; 1 = a general hunch)" },
          effort: { type: "integer", description: "1-5: how much the version takes (1 = a style or a moved block; 5 = new content or data the page does not have)" },
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

export async function proposeIdeas(env: Env, path: string, numbers: Numbers | null, by: string, drawn: string[] | null = null): Promise<AiResult<Idea[]>> {
  const page = await shopPage(env, path);
  if (page.status !== 200) return { ok: false, error: `The shop answered ${page.status} for this page.` };
  const o = pageOutline(page);
  const existing = (await pageWork(env, path)).ideas.map((i) => `- ${i.title} (${i.status})`).join("\n");
  const system = `You are the conversion specialist of a B2B web shop. You look at one page and its numbers and propose
3 to 5 ideas to test, each one a change on THIS page that a version can make (layout, wording, order, emphasis, a missing
piece of information the page already has elsewhere). Rank them: the one most likely to move add-to-carts first.

${SHOP_FACTS}

${RULES}`;
  const flow = await flowBrief(path, numbers);
  const user = `${pageBrief(page, o, drawn)}

${numbersBrief(numbers)}${flow}
${existing ? `\nIDEAS ALREADY ON THIS PAGE (do not repeat them):\n${existing}` : ""}`;
  const r = await ask<{ ideas: { title: string; why: string; change: string; expect: string; impact: number; confidence: number; effort: number }[] }>(system, user, IDEAS_SCHEMA, 8000);
  if (!r.ok) return r;
  const out: Idea[] = [];
  for (const i of (r.data.ideas ?? []).slice(0, 5)) {
    if (!i.title?.trim()) continue;
    out.push(await addIdea(env, path, i, by, "ai", numbers));
  }
  return { ok: true, data: out };
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
- WORDS: the page's texts are written in Content Studio, not here. Reuse the page's own words; a new label (a heading,
  a button, a column name) of at most six words is fine. Anything longer - a sentence, a paragraph, a description -
  goes in as a visible placeholder <span class="apx-text">[Text from Content: what it must say]</span>, and the
  note says so.
- WORDS: the page's texts are written in Content Studio, not here. Reuse the page's own words; a new label (a heading,
  a button, a column name) of at most six words is fine. Anything longer - a sentence, a paragraph, a description -
  goes in as a visible placeholder <span class="apx-text">[Text from Content: what it must say]</span>, and the
  note says so.
- New HTML: no <script>, no on...= handlers, no javascript: links, no frames. Use the shop's look (below); class names
  you add start with "apx-". Every new block also reads well on a phone (390 px): give it a mobile rule in the CSS.
- Parts the theme draws after loading (articles' prices, availability) are not in the outline: you may aim at their
  known containers but say so in the note.

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

/** The first version of an approved idea, or a new revision from a person's request in plain words. */
export async function writeVersion(ideaId: string, request: string | null, by: string, drawn: string[] | null = null): Promise<AiResult<{ version: Version; problems: string[] }>> {
  await ensureStudioSchema();
  const idea = await ideaById(ideaId);
  if (!idea) return { ok: false, error: "No such idea." };
  if (idea.status !== "approved") return { ok: false, error: "Approve the idea first." };
  const page = await shopPage(idea.env, idea.path);
  if (page.status !== 200) return { ok: false, error: `The shop answered ${page.status} for this page.` };
  const o = pageOutline(page);
  const cur = (await query<VersionRow>(`SELECT * FROM apsomh_convert_versions WHERE idea_id = $1`, [idea.id])).rows[0];
  const user = `${pageBrief(page, o, drawn)}

${numbersBrief(idea.numbers)}

THE IDEA (approved): ${idea.title}
Why: ${idea.why}
Change: ${idea.change}
Expected: ${idea.expect}
${cur && request ? `
THE VERSION AS IT IS NOW (revision ${cur.rev}):
${JSON.stringify(cur.changes, null, 1)}

THE PERSON ASKS: ${request}
Answer with the WHOLE new list (keep what they did not ask to change).` : request ? `\nTHE PERSON ADDS: ${request}` : ""}`;
  const r = await ask<{ summary: string; changes: AiChange[] }>(VERSION_SYSTEM, user, CHANGE_SCHEMA, 16000);
  if (!r.ok) return r;
  const { changes, problems } = validateChanges(fromAi(r.data.changes));
  if (!changes.length) return { ok: false, error: `The AI's version had no usable change${problems.length ? `: ${problems.join("; ")}` : ""} - ask again.` };
  const version = await saveRevision(idea, changes, (r.data.summary ?? "").slice(0, 600), request, by);
  return { ok: true, data: { version, problems } };
}
