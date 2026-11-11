// APSOconvert - THE SHOP'S PAGES, KEPT (Website > AI testing & personalization > Pages). Every page production and ACC
// publish in their sitemaps (./model.ts says which sitemaps and why), one row per environment and address, in the hub's
// own Postgres. Read once a day and on the page's button; read-only against the shop - static files under /media/, read
// one after the other, a second and a half apart.
//
// A page missing from a read is marked gone only when that read was COMPLETE: a sitemap that did not answer would
// otherwise turn its whole store view into "gone" pages - a confident false finding (a partial read looks exactly like
// pages taken down).

import { getPool, query } from "@/lib/db/client";
import { readPage } from "@/lib/directup/check";
import { ENVS, classify, isKind, parseSitemap, sitemapList, sitemapName, type Env, type PageKind } from "./model";
import { liveOn, type WrittenRecord } from "@/lib/content/studio/kinds/page/published";

/** 4107261: the reading of the shop's pages - one copy of the hub at a time, the schedule and the button alike. */
const LOCK = 4_107_261;
const GAP_MS = 1_500;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS apsomh_convert_pages (
  env        text        NOT NULL,
  url        text        NOT NULL,
  store      text        NOT NULL DEFAULT '',
  rest       text        NOT NULL DEFAULT '',
  kind       text        NOT NULL,
  product    text,
  lastmod    text,
  sitemap    text        NOT NULL,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen  timestamptz NOT NULL DEFAULT now(),
  gone_at    timestamptz,
  PRIMARY KEY (env, url)
);
CREATE INDEX IF NOT EXISTS apsomh_convert_pages_key_idx ON apsomh_convert_pages (store, rest);
CREATE TABLE IF NOT EXISTS apsomh_convert_reads (
  id          bigserial   PRIMARY KEY,
  env         text        NOT NULL,
  started_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  by_whom     text,
  sitemaps    jsonb       NOT NULL DEFAULT '[]',
  urls        integer     NOT NULL DEFAULT 0,
  added       integer     NOT NULL DEFAULT 0,
  gone        integer     NOT NULL DEFAULT 0,
  complete    boolean     NOT NULL DEFAULT false,
  error       text
);
CREATE INDEX IF NOT EXISTS apsomh_convert_reads_env_idx ON apsomh_convert_reads (env, started_at DESC);`;

let schemaReady: Promise<void> | null = null;
export function ensureConvertSchema(): Promise<void> {
  schemaReady ??= getPool().query(SCHEMA).then(() => undefined).catch((e) => { schemaReady = null; throw e; });
  return schemaReady;
}

/** One sitemap as the read found it. */
export type SitemapRead = { name: string; url: string; status: number | null; urls: number; note: string | null };

export type ReadResult = {
  env: Env;
  startedAt: string;
  finishedAt: string | null;
  by: string | null;
  sitemaps: SitemapRead[];
  urls: number;
  added: number;
  gone: number;
  complete: boolean;
  error: string | null;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Read one environment's sitemaps and keep what they list. Takes the lock; null when a read already runs. */
export async function readShop(env: Env, by: string): Promise<ReadResult | null> {
  await ensureConvertSchema();
  const client = await getPool().connect();
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [LOCK]);
    if (!got.rows[0]?.ok) return null;
    try {
      return await readLocked(env, by);
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [LOCK]).catch(() => {});
    }
  } finally {
    client.release();
  }
}

async function readLocked(env: Env, by: string): Promise<ReadResult> {
  const base = ENVS[env].base;
  const started = new Date();
  const run = await query<{ id: string }>(`INSERT INTO apsomh_convert_reads (env, started_at, by_whom) VALUES ($1, $2, $3) RETURNING id`, [env, started.toISOString(), by]);
  const id = run.rows[0].id;
  const sitemaps: SitemapRead[] = [];
  const found = new Map<string, { lastmod: string | null; sitemap: string }>();
  let error: string | null = null;
  try {
    const robots = await readPage(`${base}/robots.txt`, 20_000).then((r) => (r.status === 200 ? r.body : "")).catch(() => "");
    const queue = sitemapList(robots, base);
    const fromRobots = new Set(queue.filter((u) => robots.includes(new URL(u).pathname)));
    for (let i = 0; i < queue.length && i < 60; i++) {
      const url = queue[i];
      if (i > 0) await sleep(GAP_MS);
      const name = sitemapName(url);
      try {
        const r = await readPage(url, 90_000);
        if (r.status !== 200) {
          sitemaps.push({ name, url, status: r.status, urls: 0, note: `answered ${r.status}` });
          continue;
        }
        const parsed = parseSitemap(r.body);
        if (parsed.kind === "not-a-sitemap") {
          // the shop answers a name it does not have with its placeholder picture
          sitemaps.push({ name, url, status: 200, urls: 0, note: fromRobots.has(url) ? "robots.txt names it, but it is not a sitemap" : "not on this environment" });
          continue;
        }
        if (parsed.kind === "index") {
          for (const e of parsed.entries) if (!queue.includes(e.loc)) queue.push(e.loc);
          sitemaps.push({ name, url, status: 200, urls: 0, note: `index of ${parsed.entries.length} sitemaps` });
          continue;
        }
        for (const e of parsed.entries) if (!found.has(e.loc)) found.set(e.loc, { lastmod: e.lastmod, sitemap: name });
        sitemaps.push({ name, url, status: 200, urls: parsed.entries.length, note: null });
      } catch (e) {
        sitemaps.push({ name, url, status: null, urls: 0, note: String((e as Error)?.message ?? e).slice(0, 200) });
      }
    }
  } catch (e) {
    error = String((e as Error)?.message ?? e).slice(0, 300);
  }

  // complete = every sitemap that exists on this environment was read: a network failure or a non-200 is a gap,
  // a name this environment does not have is not
  const gap = sitemaps.some((s) => s.status !== 200 || s.note === "robots.txt names it, but it is not a sitemap");
  const complete = !error && !gap && found.size > 0;

  let added = 0;
  let gone = 0;
  if (found.size) {
    const urls: string[] = [], stores: string[] = [], rests: string[] = [], kinds: string[] = [], products: (string | null)[] = [], lastmods: (string | null)[] = [], maps: string[] = [];
    for (const [url, v] of found) {
      const c = classify(url);
      urls.push(url); stores.push(c.store ?? ""); rests.push(c.rest); kinds.push(c.kind); products.push(c.product); lastmods.push(v.lastmod); maps.push(v.sitemap);
    }
    const r = await query<{ inserted: boolean }>(
      `INSERT INTO apsomh_convert_pages (env, url, store, rest, kind, product, lastmod, sitemap, first_seen, last_seen, gone_at)
         SELECT $1, u, s, r, k, p, l, m, now(), now(), NULL
           FROM unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[]) AS t(u, s, r, k, p, l, m)
       ON CONFLICT (env, url) DO UPDATE SET store = EXCLUDED.store, rest = EXCLUDED.rest, kind = EXCLUDED.kind, product = EXCLUDED.product,
         lastmod = EXCLUDED.lastmod, sitemap = EXCLUDED.sitemap, last_seen = now(), gone_at = NULL
       RETURNING (xmax = 0) AS inserted`,
      [env, urls, stores, rests, kinds, products, lastmods, maps],
    );
    added = r.rows.filter((x) => x.inserted).length;
  }
  if (complete) {
    const g = await query<{ n: string }>(
      `WITH g AS (UPDATE apsomh_convert_pages SET gone_at = now() WHERE env = $1 AND gone_at IS NULL AND last_seen < $2 RETURNING 1)
       SELECT count(*)::text AS n FROM g`,
      [env, started.toISOString()],
    );
    gone = Number(g.rows[0]?.n ?? 0);
  }
  const finished = new Date();
  await query(
    `UPDATE apsomh_convert_reads SET finished_at = $2, sitemaps = $3::jsonb, urls = $4, added = $5, gone = $6, complete = $7, error = $8 WHERE id = $1`,
    [id, finished.toISOString(), JSON.stringify(sitemaps), found.size, added, gone, complete, error],
  );
  console.log(`[convert] ${env} pages read: ${found.size} addresses, ${added} new, ${gone} gone, ${complete ? "complete" : "INCOMPLETE"}`);
  return { env, startedAt: started.toISOString(), finishedAt: finished.toISOString(), by, sitemaps, urls: found.size, added, gone, complete, error };
}

/** The last read of each environment, and the last complete one. */
export async function lastReads(): Promise<Record<Env, { last: ReadResult | null; lastComplete: string | null }>> {
  await ensureConvertSchema();
  type Row = { env: Env; started_at: string; finished_at: string | null; by_whom: string | null; sitemaps: SitemapRead[]; urls: number; added: number; gone: number; complete: boolean; error: string | null };
  const r = await query<Row>(
    `SELECT DISTINCT ON (env) env, to_char(started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS started_at,
            to_char(finished_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS finished_at, by_whom, sitemaps, urls, added, gone, complete, error
       FROM apsomh_convert_reads ORDER BY env, started_at DESC`,
  );
  const c = await query<{ env: Env; at: string }>(
    `SELECT env, to_char(max(started_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS at FROM apsomh_convert_reads WHERE complete GROUP BY env`,
  );
  const out: Record<Env, { last: ReadResult | null; lastComplete: string | null }> = { prod: { last: null, lastComplete: null }, acc: { last: null, lastComplete: null } };
  for (const x of r.rows) {
    out[x.env] = {
      last: { env: x.env, startedAt: x.started_at, finishedAt: x.finished_at, by: x.by_whom, sitemaps: x.sitemaps ?? [], urls: x.urls, added: x.added, gone: x.gone, complete: x.complete, error: x.error },
      lastComplete: null,
    };
  }
  for (const x of c.rows) if (out[x.env]) out[x.env].lastComplete = x.at;
  return out;
}

/* ── the page's list ──────────────────────────────────────────────────── */

export type Where = "all" | "both" | "prod" | "acc";
export const isWhere = (x: unknown): x is Where => x === "all" || x === "both" || x === "prod" || x === "acc";

export type PageRow = {
  store: string; rest: string; kind: PageKind; product: string | null;
  prod: { url: string; lastmod: string | null } | null;
  acc: { url: string; lastmod: string | null } | null;
};
export type PagesSummary = {
  /** per kind and store: on production, on ACC, on ACC only, on production only */
  cells: { kind: PageKind; store: string; prod: number; acc: number; accOnly: number; prodOnly: number }[];
};
export type PagesList = { rows: PageRow[]; total: number; page: number; perPage: number };

// "on one only" counts in the store views BOTH publish: ACC has no Swiss French or Swiss Italian sitemap (07.11.2026), and
// its 4,000 pages there are not missing from ACC - they are not listed (st = the store views each environment publishes)
const JOINED = `
  WITH st AS (SELECT env, store FROM apsomh_convert_pages WHERE gone_at IS NULL GROUP BY env, store),
       p AS (SELECT store, rest, kind, product, url, lastmod FROM apsomh_convert_pages WHERE env = 'prod' AND gone_at IS NULL),
       a AS (SELECT store, rest, kind, product, url, lastmod FROM apsomh_convert_pages WHERE env = 'acc' AND gone_at IS NULL),
       j AS (SELECT COALESCE(p.store, a.store) AS store, COALESCE(p.rest, a.rest) AS rest, COALESCE(p.kind, a.kind) AS kind,
                    COALESCE(p.product, a.product) AS product, p.url AS prod_url, p.lastmod AS prod_lastmod, a.url AS acc_url, a.lastmod AS acc_lastmod
               FROM p FULL OUTER JOIN a ON p.store = a.store AND p.rest = a.rest)`;

export async function pagesSummary(): Promise<PagesSummary> {
  await ensureConvertSchema();
  const r = await query<{ kind: string; store: string; prod: string; acc: string; acc_only: string; prod_only: string }>(
    `${JOINED}
     SELECT kind, store, count(prod_url)::text AS prod, count(acc_url)::text AS acc,
            count(*) FILTER (WHERE prod_url IS NULL AND store IN (SELECT store FROM st WHERE env = 'prod'))::text AS acc_only,
            count(*) FILTER (WHERE acc_url IS NULL AND store IN (SELECT store FROM st WHERE env = 'acc'))::text AS prod_only
       FROM j GROUP BY kind, store`,
  );
  return {
    cells: r.rows.filter((x) => isKind(x.kind)).map((x) => ({
      kind: x.kind as PageKind, store: x.store, prod: Number(x.prod), acc: Number(x.acc), accOnly: Number(x.acc_only), prodOnly: Number(x.prod_only),
    })),
  };
}

export async function listPages(f: { kind: PageKind | null; store: string | null; where: Where; q: string; page: number; perPage: number }): Promise<PagesList> {
  await ensureConvertSchema();
  const q = f.q.trim().slice(0, 120).replace(/[\\%_]/g, (m) => `\\${m}`);
  const r = await query<{ store: string; rest: string; kind: string; product: string | null; prod_url: string | null; prod_lastmod: string | null; acc_url: string | null; acc_lastmod: string | null; total: string }>(
    `${JOINED}
     SELECT *, count(*) OVER ()::text AS total FROM j
      WHERE ($1::text IS NULL OR kind = $1) AND ($2::text IS NULL OR store = $2)
        AND ($3 = 'all' OR ($3 = 'both' AND prod_url IS NOT NULL AND acc_url IS NOT NULL)
             OR ($3 = 'prod' AND acc_url IS NULL AND store IN (SELECT store FROM st WHERE env = 'acc'))
             OR ($3 = 'acc' AND prod_url IS NULL AND store IN (SELECT store FROM st WHERE env = 'prod')))
        AND ($4 = '' OR rest ILIKE '%' || $4 || '%' OR product = $4)
      ORDER BY (kind <> 'home'), (store <> 'de-CH'), store, CASE kind WHEN 'home' THEN 0 WHEN 'cms' THEN 1 WHEN 'category' THEN 2 WHEN 'product' THEN 3 ELSE 4 END, rest
      LIMIT $5 OFFSET $6`,
    [f.kind, f.store, f.where, q, f.perPage, f.page * f.perPage],
  );
  return {
    rows: r.rows.filter((x) => isKind(x.kind)).map((x) => ({
      store: x.store, rest: x.rest, kind: x.kind as PageKind, product: x.product,
      prod: x.prod_url ? { url: x.prod_url, lastmod: x.prod_lastmod } : null,
      acc: x.acc_url ? { url: x.acc_url, lastmod: x.acc_lastmod } : null,
    })),
    total: Number(r.rows[0]?.total ?? 0),
    page: f.page,
    perPage: f.perPage,
  };
}

/** Is this address in production's index - for the Problems page, which starts from Google Analytics' paths. */
export async function indexedPaths(): Promise<Set<string>> {
  await ensureConvertSchema();
  const r = await query<{ url: string }>(`SELECT url FROM apsomh_convert_pages WHERE env = 'prod' AND gone_at IS NULL`);
  return new Set(r.rows.map((x) => { try { return new URL(x.url).pathname; } catch { return x.url; } }));
}

/* ── the schedule ─────────────────────────────────────────────────────── */

const TICK_MS = 60 * 60_000;
/** an environment whose last complete read is older than this is read again */
const DUE_MS = 20 * 60 * 60_000;

async function tick() {
  for (const env of ["prod", "acc"] as Env[]) {
    try {
      const reads = await lastReads();
      const at = reads[env].lastComplete ? Date.parse(reads[env].lastComplete!) : 0;
      // an incomplete read in the last hour is not retried at once - the shop or the network needs the time
      const lastTry = reads[env].last ? Date.parse(reads[env].last!.startedAt) : 0;
      if (Date.now() - at < DUE_MS || Date.now() - lastTry < 55 * 60_000) continue;
      await readShop(env, "schedule");
    } catch (e) {
      console.warn(`[convert] ${env} pages not read: ${(e as Error).message}`);
    }
  }
}

let started = false;
/** Once a day per environment (checked every hour). CONVERT_PAGES=off stops it. */
export function startConvertPages() {
  if (started || String(process.env.CONVERT_PAGES ?? "").toLowerCase() === "off") return;
  started = true;
  const timer = setInterval(() => void tick(), TICK_MS);
  timer.unref?.();
  setTimeout(() => void tick(), 4 * 60_000).unref?.();
}

/** A page the hub itself put on the shop: Content's Page builder wrote it into Magento (its last step, "To Magento"). */
export type HubPage = {
  env: Env; store: string; path: string; url: string; at: string; action: WrittenRecord["action"]; kind: PageKind;
  pieceId: number; projectId: number; title: string;
};

/**
 * PUBLISHED BY THE HUB (SARCLA 11.11.2026: "own pages should also be a tab, to measure only the pages that have been
 * published via the hub"): every Page builder to-do's pages on production and ACC now - from its own record of what it
 * wrote into Magento (the to-do's document, "magento", newest first: Content's published.ts liveOn - one per store view,
 * the ones switched off left out). Read only; none when Content has never written a page.
 */
export async function hubPublished(): Promise<HubPage[]> {
  const r = await query<{ piece_id: number; project_id: number; title: string; magento: unknown }>(
    `SELECT d.piece_id, p.project_id, p.title, d.doc->'magento' AS magento
       FROM apsomh_content_piece_docs d JOIN apsomh_content_pieces p ON p.id = d.piece_id
      WHERE jsonb_typeof(d.doc->'magento') = 'array' AND jsonb_array_length(d.doc->'magento') > 0`,
  ).catch(() => ({ rows: [] as { piece_id: number; project_id: number; title: string; magento: unknown }[] }));
  const out: HubPage[] = [];
  for (const row of r.rows) {
    const records = (Array.isArray(row.magento) ? row.magento : []).filter((x): x is WrittenRecord => !!x && typeof x === "object" && (x.env === "acc" || x.env === "prod"));
    for (const env of ["prod", "acc"] as const) {
      for (const p of liveOn(records, env)) {
        out.push({ env, store: p.store, path: p.path, url: p.url, at: p.at, action: p.action, kind: classify(p.path).kind, pieceId: Number(row.piece_id), projectId: Number(row.project_id), title: row.title });
      }
    }
  }
  return out.sort((a, b) => (a.env === b.env ? 0 : a.env === "prod" ? -1 : 1) || b.at.localeCompare(a.at));
}
