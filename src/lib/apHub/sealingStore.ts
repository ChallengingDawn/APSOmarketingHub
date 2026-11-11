// SEALING BUSINESS REVIEW - kept and read (the rules: ./sealingRules.ts).
//
// The morning ERP workbook's sealing sheet replaces the table whole each morning (it is a cube query, not a delta), in
// one transaction, so a page never reads half a morning. An empty sheet replaces nothing: yesterday's figures stay.
// The figures are the Angst+Pfister group's (every business unit, with margins) - read only by the Angst+Pfister hub's
// people and the admins (src/app/api/ap/guard.ts).

import type { PoolClient } from "pg";
import { getPool, query } from "@/lib/db/client";
import {
  approvalKinds, approvalRefs, commercialCandidates, compoundsKept, keyMonths, materialOf, monthsBetween, noApproval, noCompound, priorities, sealingPeriod, sumBy, topShare, yearBefore,
  type CompoundCustomer, type DetailKind, type ListAsk, type ListKind, type Figure, type KeyMonth, type Priority, type SealingRow,
} from "./sealingRules";

const TABLE = "apsomh_ap_sealing";
let ready: Promise<void> | null = null;

export function ensureSealingTable(): Promise<void> {
  ready ??= (async () => {
    await query(`
      CREATE TABLE IF NOT EXISTS ${TABLE} (
        month CHAR(7) NOT NULL,
        bu VARCHAR(20) NOT NULL DEFAULT '',
        channel VARCHAR(60) NOT NULL DEFAULT '',
        customer VARCHAR(40) NOT NULL DEFAULT '',
        customer_name VARCHAR(200) NOT NULL DEFAULT '',
        article VARCHAR(60) NOT NULL DEFAULT '',
        article_text VARCHAR(300) NOT NULL DEFAULT '',
        compound VARCHAR(200) NOT NULL DEFAULT '',
        approval TEXT NOT NULL DEFAULT '',
        rev NUMERIC(16,2) NOT NULL DEFAULT 0,
        gp NUMERIC(16,2) NOT NULL DEFAULT 0
      )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_${TABLE}_month ON ${TABLE}(month)`);
    await query(`
      CREATE TABLE IF NOT EXISTS ${TABLE}_meta (
        id INT PRIMARY KEY DEFAULT 1,
        file TEXT, sheet TEXT, rows INT, skipped INT, first_month CHAR(7), last_month CHAR(7),
        loaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
  })().catch((e) => { ready = null; throw e; });
  return ready;
}

const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s);

/** Replace the table with this morning's rows. */
export async function saveSealing(rows: SealingRow[], from: { file: string; sheet: string | null; skipped: number }) {
  if (!rows.length) return { kept: false, reason: "the sheet had no rows - yesterday's figures stay" };
  await ensureSealingTable();
  const client: PoolClient = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM ${TABLE}`);
    const COLS = 11, CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const part = rows.slice(i, i + CHUNK);
      const vals: unknown[] = [];
      const tuples = part.map((r, j) => {
        vals.push(r.month, cut(r.bu, 20), cut(r.channel, 60), cut(r.customer, 40), cut(r.customerName, 200), cut(r.article, 60),
          cut(r.articleText, 300), cut(r.compound, 200), r.approval, Math.round(r.rev * 100) / 100, Math.round(r.gp * 100) / 100);
        const b = j * COLS;
        return `(${Array.from({ length: COLS }, (_, k) => `$${b + k + 1}`).join(",")})`;
      });
      await client.query(
        `INSERT INTO ${TABLE} (month, bu, channel, customer, customer_name, article, article_text, compound, approval, rev, gp) VALUES ${tuples.join(",")}`,
        vals,
      );
    }
    const months = rows.map((r) => r.month).sort();
    await client.query(
      `INSERT INTO ${TABLE}_meta (id, file, sheet, rows, skipped, first_month, last_month, loaded_at) VALUES (1, $1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (id) DO UPDATE SET file = $1, sheet = $2, rows = $3, skipped = $4, first_month = $5, last_month = $6, loaded_at = NOW()`,
      [from.file, from.sheet, rows.length, from.skipped, months[0], months[months.length - 1]],
    );
    await client.query("COMMIT");
    return { kept: true, rows: rows.length, skipped: from.skipped, first_month: months[0], last_month: months[months.length - 1] };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/* -- reading ------------------------------------------------------------------------------------------------------ */

export type SealingFilter = {
  /** first and last month, YYYY-MM */
  from: string;
  to: string;
  /** the business units to keep - all when none */
  bus?: string[];
  /** the selling organisations to keep (the query's Channel) - all when none */
  channels?: string[];
};

/**
 * A month of the period: its figures, and the same month a year before (`prev...` null: before the first month the
 * figures hold). customers / articles: the distinct ones invoiced that month; noCompound / noApproval: the net revenue
 * whose article names no compound / has no approval written.
 */
export type SealingMonth = {
  month: string; rev: number; gp: number; prevRev: number | null; prevGp: number | null;
  customers: number; articles: number; noCompound: number; noApproval: number;
  prevCustomers: number | null; prevArticles: number | null; prevNoCompound: number | null; prevNoApproval: number | null;
};

export type SealingView = {
  meta: {
    loadedAt: string | null; firstMonth: string | null; lastMonth: string | null; rows: number; bus: string[]; channels: string[];
    /** the morning delivery's file and sheet the figures were read from */
    file: string | null; sheet: string | null;
    /** the Filters window's lists: each business unit's net revenue in the period under the sales organisations chosen,
     *  each sales organisation's under the business units chosen - so a value chosen never hides the others */
    buFigures: { key: string; rev: number }[];
    channelFigures: { key: string; rev: number }[];
  };
  period: { from: string; to: string; prevFrom: string; prevTo: string };
  totals: {
    rev: number; gp: number; margin: number; customers: number; articles: number;
    /** named compounds invoiced, approvals written (distinct texts) */
    compounds: number; approvals: number;
    prev: { rev: number; gp: number; margin: number; customers: number; articles: number; compounds: number; approvals: number };
  };
  /** the period month by month */
  months: SealingMonth[];
  /** the period month by month for each business unit, sales organisation and material family */
  unitMonths: KeyMonth[];
  channelMonths: KeyMonth[];
  familyMonths: KeyMonth[];
  byBu: Figure[];
  /** by sales organisation (the query's Channel) */
  byChannel: Figure[];
  byFamily: Figure[];
  compounds: Figure[];
  customers: Figure[];
  articles: (Figure & { compound: string })[];
  approvals: Figure[];
  /** the share of revenue with no approval written on the article */
  noApprovalShare: number;
  /** the share of revenue whose article names no compound */
  noCompoundShare: number;
  /** the share of the net revenue the 10 largest customers and articles carry - a year earlier: the 10 largest then;
   *  customer1 / article1: the largest one's share (the pilot's concentration) */
  concentration: {
    customers: number | null; prevCustomers: number | null; articles: number | null; prevArticles: number | null;
    customer1: number | null; prevCustomer1: number | null; article1: number | null; prevArticle1: number | null;
  };
  priorities: Priority[];
  /** every commercial priority the figures hold, ranked, each with its stable key - the overview takes the open ones */
  candidates: Priority[];
  /** the compound entries that name none ("No info", "Unknown", "TBD", a drawing) - the pilot's unresolved entries */
  unresolved: Figure[];
  /** the net revenue of the approval texts naming each reference the pilot ranks (FDA, WRAS ...) - they overlap */
  approvalRefs: Figure[];
  /** the pilot's indicative categories of the approval texts: none written, a datasheet, explicit references, other */
  approvalKinds: Figure[];
  /** the customers and the articles with a negative gross margin (net revenue above zero, gross profit below) - a year
   *  earlier only when the whole of those months is in the figures */
  negative: { customers: Negative; articles: Negative; prevCustomers: Negative | null; prevArticles: Negative | null };
};

/** How many, and their net revenue. */
export type Negative = { count: number; rev: number };

type Raw = { key: string; name: string | null; rev: string; gp: string };

function where(f: SealingFilter, from: string, to: string): { sql: string; vals: unknown[] } {
  const vals: unknown[] = [from, to];
  let sql = `month >= $1 AND month <= $2`;
  if (f.bus?.length) { vals.push(f.bus); sql += ` AND bu = ANY($${vals.length})`; }
  if (f.channels?.length) { vals.push(f.channels); sql += ` AND channel = ANY($${vals.length})`; }
  return { sql, vals };
}

/** The columns a page breaks the figures down by - never a value from the request. */
type KeyCol = "bu" | "channel" | "compound" | "customer" | "article" | "approval";
type NameCol = "bu" | "channel" | "compound" | "customer_name" | "article_text" | "approval";

async function grouped(key: KeyCol, name: NameCol, f: SealingFilter, from: string, to: string, limit?: number): Promise<Figure[]> {
  const w = where(f, from, to);
  const r = await query<Raw>(
    `SELECT ${key} AS key, MAX(${name}) AS name, SUM(rev) AS rev, SUM(gp) AS gp FROM ${TABLE}
      WHERE ${w.sql} GROUP BY ${key} ORDER BY SUM(rev) DESC${limit ? ` LIMIT ${Math.floor(limit)}` : ""}`,
    w.vals,
  );
  return r.rows.map((x) => {
    const rev = Number(x.rev), gp = Number(x.gp);
    return { key: x.key, name: x.name || x.key, rev, gp, margin: rev ? gp / rev : 0 };
  });
}

/** This period's figures with last year's beside them (`prev`, `prevGp`), by key. */
function withPrev(now: Figure[], before: Figure[]): Figure[] {
  const b = new Map(before.map((x) => [x.key, x]));
  return now.map((x) => ({ ...x, prev: b.get(x.key)?.rev ?? 0, prevGp: b.get(x.key)?.gp ?? 0 }));
}

type MonthKeyRow = { key: string; month: string; rev: number; gp: number };

/** The figures by month and business unit, or by month and sales organisation. */
async function byMonth(col: "bu" | "channel", f: SealingFilter, from: string, to: string): Promise<MonthKeyRow[]> {
  const w = where(f, from, to);
  const r = await query<{ month: string; key: string; rev: string; gp: string }>(
    `SELECT month, ${col} AS key, SUM(rev) AS rev, SUM(gp) AS gp FROM ${TABLE} WHERE ${w.sql} GROUP BY month, ${col}`, w.vals,
  );
  return r.rows.map((x) => ({ month: String(x.month).trim(), key: x.key, rev: Number(x.rev), gp: Number(x.gp) }));
}

/** The named compounds' figures by month and material family - each compound's family handed in as a list beside it. */
async function familyByMonth(f: SealingFilter, from: string, to: string, compounds: string[], families: string[]): Promise<MonthKeyRow[]> {
  if (!compounds.length) return [];
  const w = where(f, from, to);
  const n = w.vals.length;
  const r = await query<{ month: string; key: string; rev: string; gp: string }>(
    `SELECT month, m.family AS key, SUM(rev) AS rev, SUM(gp) AS gp
       FROM ${TABLE} JOIN unnest($${n + 1}::text[], $${n + 2}::text[]) AS m(cname, family) ON compound = m.cname
      WHERE ${w.sql} GROUP BY month, m.family`,
    [...w.vals, compounds, families],
  );
  return r.rows.map((x) => ({ month: String(x.month).trim(), key: x.key, rev: Number(x.rev), gp: Number(x.gp) }));
}

type MonthRow = { rev: number; gp: number; customers: number; articles: number; noCompound: number; noApproval: number };

/** The period month by month: the figures, the distinct customers and articles, the revenue with no compound or no approval. */
async function monthFigures(f: SealingFilter, from: string, to: string, noComp: string[], noAppr: string[]): Promise<Map<string, MonthRow>> {
  const w = where(f, from, to);
  const n = w.vals.length;
  const r = await query<{ month: string; rev: string; gp: string; customers: string; articles: string; no_compound: string | null; no_approval: string | null }>(
    `SELECT month, SUM(rev) AS rev, SUM(gp) AS gp, COUNT(DISTINCT customer) AS customers, COUNT(DISTINCT article) AS articles,
            SUM(rev) FILTER (WHERE compound = ANY($${n + 1})) AS no_compound,
            SUM(rev) FILTER (WHERE approval = ANY($${n + 2})) AS no_approval
       FROM ${TABLE} WHERE ${w.sql} GROUP BY month`,
    [...w.vals, noComp, noAppr],
  );
  return new Map(r.rows.map((x) => [String(x.month).trim(), {
    rev: Number(x.rev), gp: Number(x.gp), customers: Number(x.customers), articles: Number(x.articles),
    noCompound: Number(x.no_compound ?? 0), noApproval: Number(x.no_approval ?? 0),
  }]));
}

const NO_MONTH: MonthRow = { rev: 0, gp: 0, customers: 0, articles: 0, noCompound: 0, noApproval: 0 };

/** The customers or the articles whose gross margin is negative over the months, and their net revenue. */
async function negativeOf(col: "customer" | "article", f: SealingFilter, from: string, to: string): Promise<Negative> {
  const w = where(f, from, to);
  const r = (await query<{ n: string; rev: string | null }>(
    `SELECT COUNT(*) AS n, SUM(x.rev) AS rev FROM (SELECT SUM(rev) AS rev, SUM(gp) AS gp FROM ${TABLE} WHERE ${w.sql} GROUP BY ${col}) x
      WHERE x.rev > 0 AND x.gp < 0`,
    w.vals,
  )).rows[0];
  return { count: Number(r?.n ?? 0), rev: Number(r?.rev ?? 0) };
}

export async function readSealing(f: SealingFilter): Promise<SealingView> {
  await ensureSealingTable();
  const prevFrom = yearBefore(f.from), prevTo = yearBefore(f.to);
  const meta = (await query<{ loaded_at: Date | null; first_month: string | null; last_month: string | null; rows: number | null; file: string | null; sheet: string | null }>(
    `SELECT loaded_at, first_month, last_month, rows, file, sheet FROM ${TABLE}_meta WHERE id = 1`,
  )).rows[0];
  const bus = (await query<{ bu: string }>(`SELECT DISTINCT bu FROM ${TABLE} WHERE bu <> '' ORDER BY bu`)).rows.map((r) => r.bu);
  const channels = (await query<{ channel: string }>(`SELECT DISTINCT channel FROM ${TABLE} WHERE channel <> '' ORDER BY channel`)).rows.map((r) => r.channel);

  const [buNow, buBefore, chNow, chBefore, compNow, compBefore, custNow, custBefore, artNow, artBefore, appr, apprBefore, unitsNow, unitsBefore, chMonthsNow, chMonthsBefore, buList, chList] = await Promise.all([
    grouped("bu", "bu", f, f.from, f.to), grouped("bu", "bu", f, prevFrom, prevTo),
    grouped("channel", "channel", f, f.from, f.to), grouped("channel", "channel", f, prevFrom, prevTo),
    grouped("compound", "compound", f, f.from, f.to), grouped("compound", "compound", f, prevFrom, prevTo),
    grouped("customer", "customer_name", f, f.from, f.to, 200), grouped("customer", "customer_name", f, prevFrom, prevTo),
    grouped("article", "article_text", f, f.from, f.to, 200), grouped("article", "article_text", f, prevFrom, prevTo),
    grouped("approval", "approval", f, f.from, f.to), grouped("approval", "approval", f, prevFrom, prevTo),
    byMonth("bu", f, f.from, f.to), byMonth("bu", f, prevFrom, prevTo),
    byMonth("channel", f, f.from, f.to), byMonth("channel", f, prevFrom, prevTo),
    // the Filters window's lists: a business unit chosen never hides the others, nor a sales organisation the others
    grouped("bu", "bu", { ...f, bus: [] }, f.from, f.to), grouped("channel", "channel", { ...f, channels: [] }, f.from, f.to),
  ]);
  const w = where(f, f.from, f.to);
  const counts = (await query<{ customers: string; articles: string }>(
    `SELECT COUNT(DISTINCT customer) AS customers, COUNT(DISTINCT article) AS articles FROM ${TABLE} WHERE ${w.sql}`, w.vals,
  )).rows[0];
  const wb = where(f, prevFrom, prevTo);
  const countsBefore = (await query<{ customers: string; articles: string }>(
    `SELECT COUNT(DISTINCT customer) AS customers, COUNT(DISTINCT article) AS articles FROM ${TABLE} WHERE ${wb.sql}`, wb.vals,
  )).rows[0];
  // each article's compound, for the articles' list
  const artCompound = new Map((await query<{ article: string; compound: string }>(
    `SELECT article, MAX(compound) AS compound FROM ${TABLE} WHERE ${w.sql} GROUP BY article`, w.vals,
  )).rows.map((r) => [r.article, r.compound]));
  // the leading compounds' customers, for the priorities
  const topCompounds = compNow.filter((c) => !noCompound(c.name)).slice(0, 20).map((c) => c.key);
  const pairs: CompoundCustomer[] = topCompounds.length ? (await query<{ compound: string; customer: string; name: string; rev: string; gp: string }>(
    `SELECT compound, customer, MAX(customer_name) AS name, SUM(rev) AS rev, SUM(gp) AS gp FROM ${TABLE}
      WHERE ${w.sql} AND compound = ANY($${w.vals.length + 1}) GROUP BY compound, customer`,
    [...w.vals, topCompounds],
  )).rows.map((r) => ({ compound: r.compound, customer: r.customer, customerName: r.name || r.customer, rev: Number(r.rev), gp: Number(r.gp) })) : [];

  const sum = (a: Figure[]) => a.reduce((t, x) => ({ rev: t.rev + x.rev, gp: t.gp + x.gp }), { rev: 0, gp: 0 });
  const now = sum(buNow), before = sum(buBefore);
  const named = compNow.filter((c) => !noCompound(c.name));
  const namedBefore = compBefore.filter((c) => !noCompound(c.name));
  const familyNow = sumBy(named, (c) => materialOf(c.name));
  const familyBefore = sumBy(namedBefore, (c) => materialOf(c.name));
  const noAppr = appr.filter((a) => noApproval(a.name)).reduce((t, a) => t + a.rev, 0);
  const noComp = compNow.filter((c) => noCompound(c.name)).reduce((t, c) => t + c.rev, 0);

  // month by month, the period and the year before - "no compound" and "no approval" as the rules name them
  const noCompKeys = [...new Set([...compNow, ...compBefore].filter((c) => noCompound(c.name)).map((c) => c.key))];
  const noApprKeys = [...new Set([...appr, ...apprBefore].filter((a) => noApproval(a.name)).map((a) => a.key))];
  const familyOf = new Map([...named, ...namedBefore].map((c) => [c.key, materialOf(c.name)]));
  const [mNow, mBefore, famNow, famBefore] = await Promise.all([
    monthFigures(f, f.from, f.to, noCompKeys, noApprKeys), monthFigures(f, prevFrom, prevTo, noCompKeys, noApprKeys),
    familyByMonth(f, f.from, f.to, [...familyOf.keys()], [...familyOf.values()]),
    familyByMonth(f, prevFrom, prevTo, [...familyOf.keys()], [...familyOf.values()]),
  ]);
  // a month a year before the figures' first month is not known, never a zero
  const firstHeld = meta?.first_month ?? null;
  const period = monthsBetween(f.from, f.to);
  const months: SealingMonth[] = period.map((month) => {
    const py = yearBefore(month), known = !!firstHeld && py >= firstHeld;
    const x = mNow.get(month) ?? NO_MONTH, y = known ? mBefore.get(py) ?? NO_MONTH : null;
    return {
      month, rev: x.rev, gp: x.gp, customers: x.customers, articles: x.articles, noCompound: x.noCompound, noApproval: x.noApproval,
      prevRev: y?.rev ?? null, prevGp: y?.gp ?? null, prevCustomers: y?.customers ?? null, prevArticles: y?.articles ?? null,
      prevNoCompound: y?.noCompound ?? null, prevNoApproval: y?.noApproval ?? null,
    };
  });
  // the 10 largest a year earlier only when the whole of those months is in the figures
  const prevAll = !!firstHeld && prevFrom >= firstHeld;
  const [negCust, negArt, negCustBefore, negArtBefore] = await Promise.all([
    negativeOf("customer", f, f.from, f.to), negativeOf("article", f, f.from, f.to),
    prevAll ? negativeOf("customer", f, prevFrom, prevTo) : null, prevAll ? negativeOf("article", f, prevFrom, prevTo) : null,
  ]);

  return {
    meta: {
      loadedAt: meta?.loaded_at ? new Date(meta.loaded_at).toISOString() : null,
      firstMonth: meta?.first_month ?? null, lastMonth: meta?.last_month ?? null, rows: meta?.rows ?? 0, bus, channels,
      file: meta?.file ?? null, sheet: meta?.sheet ?? null,
      buFigures: buList.map((x) => ({ key: x.key, rev: x.rev })), channelFigures: chList.map((x) => ({ key: x.key, rev: x.rev })),
    },
    period: { from: f.from, to: f.to, prevFrom, prevTo },
    totals: {
      rev: now.rev, gp: now.gp, margin: now.rev ? now.gp / now.rev : 0,
      customers: Number(counts?.customers ?? 0), articles: Number(counts?.articles ?? 0),
      compounds: named.length, approvals: appr.filter((a) => !noApproval(a.name)).length,
      prev: {
        rev: before.rev, gp: before.gp, margin: before.rev ? before.gp / before.rev : 0,
        customers: Number(countsBefore?.customers ?? 0), articles: Number(countsBefore?.articles ?? 0),
        compounds: namedBefore.length, approvals: apprBefore.filter((a) => !noApproval(a.name)).length,
      },
    },
    months,
    unitMonths: keyMonths(period, unitsNow, unitsBefore, firstHeld),
    channelMonths: keyMonths(period, chMonthsNow, chMonthsBefore, firstHeld),
    familyMonths: keyMonths(period, famNow, famBefore, firstHeld),
    byBu: withPrev(buNow, buBefore),
    byChannel: withPrev(chNow, chBefore),
    byFamily: withPrev(familyNow, familyBefore),
    compounds: withPrev(named, namedBefore),
    customers: withPrev(custNow, custBefore),
    articles: withPrev(artNow, artBefore).map((a) => ({ ...a, compound: artCompound.get(a.key) ?? "" })),
    approvals: withPrev(appr.filter((a) => !noApproval(a.name)), apprBefore).slice(0, 200),
    noApprovalShare: now.rev ? noAppr / now.rev : 0,
    noCompoundShare: now.rev ? noComp / now.rev : 0,
    concentration: {
      customers: topShare(custNow, 10, now.rev), prevCustomers: prevAll ? topShare(custBefore, 10, before.rev) : null,
      articles: topShare(artNow, 10, now.rev), prevArticles: prevAll ? topShare(artBefore, 10, before.rev) : null,
      customer1: topShare(custNow, 1, now.rev), prevCustomer1: prevAll ? topShare(custBefore, 1, before.rev) : null,
      article1: topShare(artNow, 1, now.rev), prevArticle1: prevAll ? topShare(artBefore, 1, before.rev) : null,
    },
    priorities: priorities(named, pairs),
    candidates: commercialCandidates(named, pairs),
    unresolved: withPrev(compNow.filter((c) => noCompound(c.name)), compBefore.filter((c) => noCompound(c.name))),
    approvalRefs: approvalRefs(appr),
    approvalKinds: approvalKinds(appr),
    negative: { customers: negCust, articles: negArt, prevCustomers: negCustBefore, prevArticles: negArtBefore },
  };
}

/* -- the API's filter, read the same way by both routes ----------------------------------------------------------- */

/** The values of a repeated parameter, trimmed, each cut to the column's width. */
const many = (p: URLSearchParams, key: string, width: number) =>
  [...new Set(p.getAll(key).map((x) => x.trim().slice(0, width)).filter(Boolean))].slice(0, 40);

/**
 * ?from=YYYY-MM&to=YYYY-MM&bu=APCH&bu=APDE&channel=... - bu and channel (the selling organisation) may repeat, all of
 * them when none. The months are kept within those the figures hold; without a period: the year so far, up to the last
 * month the morning delivery carries.
 */
export async function sealingFilterOf(p: URLSearchParams): Promise<SealingFilter> {
  await ensureSealingTable();
  const held = (await query<{ first_month: string | null; last_month: string | null }>(
    `SELECT first_month, last_month FROM ${TABLE}_meta WHERE id = 1`,
  )).rows[0];
  const { from, to } = sealingPeriod(
    { from: p.get("from"), to: p.get("to") },
    { first: held?.first_month ?? null, last: held?.last_month ?? null },
    new Date().toISOString().slice(0, 7),
  );
  return { from, to, bus: many(p, "bu", 20), channels: many(p, "channel", 60) };
}

/* -- one customer, article or compound: the pilot's drawer ("Click an entry to inspect its available detail") ----- */

/** A detail's row: an article of the customer, a customer of the article or of the compound. */
export type DetailRow = Figure & { bus: string; compound: string };

export type SealingDetail = {
  kind: DetailKind; key: string; name: string; rev: number; gp: number; margin: number;
  /** the business units that invoiced it; an article's compounds */
  bus: string[]; compounds: string[];
  /** how many articles (a customer) or customers (an article, a compound) - `rows` the 100 largest of them */
  count: number;
  rows: DetailRow[];
};

/** The column naming the one asked, the column it breaks down by, its rows' names - never a value from the request. */
const DETAIL: Record<DetailKind, { match: "customer" | "article" | "compound"; by: "article" | "customer"; rowName: "article_text" | "customer_name"; own: "customer_name" | "article_text" | "compound" }> = {
  customer: { match: "customer", by: "article", rowName: "article_text", own: "customer_name" },
  article: { match: "article", by: "customer", rowName: "customer_name", own: "article_text" },
  compound: { match: "compound", by: "customer", rowName: "customer_name", own: "compound" },
};

export async function readSealingDetail(f: SealingFilter, kind: DetailKind, key: string): Promise<SealingDetail> {
  await ensureSealingTable();
  const d = DETAIL[kind];
  const w = where(f, f.from, f.to);
  const vals = [...w.vals, key];
  const at = `$${vals.length}`;
  const head = (await query<{ name: string | null; rev: string | null; gp: string | null; n: string; bus: string[] | null; compounds: string[] | null }>(
    `SELECT MAX(${d.own}) AS name, SUM(rev) AS rev, SUM(gp) AS gp, COUNT(DISTINCT ${d.by}) AS n,
            array_agg(DISTINCT bu::text) AS bus, array_agg(DISTINCT compound::text) AS compounds
       FROM ${TABLE} WHERE ${w.sql} AND ${d.match} = ${at}`,
    vals,
  )).rows[0];
  const rows = (await query<{ key: string; name: string | null; rev: string; gp: string; bus: string[] | null; compound: string | null }>(
    `SELECT ${d.by} AS key, MAX(${d.rowName}) AS name, SUM(rev) AS rev, SUM(gp) AS gp,
            array_agg(DISTINCT bu::text) AS bus, MAX(compound) AS compound
       FROM ${TABLE} WHERE ${w.sql} AND ${d.match} = ${at} GROUP BY ${d.by} ORDER BY SUM(rev) DESC LIMIT 100`,
    vals,
  )).rows;
  const rev = Number(head?.rev ?? 0), gp = Number(head?.gp ?? 0);
  const list = (a: string[] | null | undefined) => (a ?? []).filter(Boolean).sort();
  return {
    kind, key, name: head?.name || key, rev, gp, margin: rev ? gp / rev : 0,
    bus: list(head?.bus), compounds: kind === "article" ? list(head?.compounds) : [], count: Number(head?.n ?? 0),
    rows: rows.map((r) => {
      const rr = Number(r.rev), g = Number(r.gp);
      return { key: r.key, name: r.name || r.key, rev: rr, gp: g, margin: rr ? g / rr : 0, bus: list(r.bus).join(", "), compound: r.compound ?? "" };
    }),
  };
}

/* -- a whole list a page at a time: "All" in a ranking, the All tabs (SARCLA 11.11.2026: "pagination at 30") ------- */

export type ListRow = Figure & { compound: string };
export type SealingList = { kind: ListKind; total: number; offset: number; limit: number; rows: ListRow[] };

/** The column a list is of, and its rows' names - never a value from the request. */
const LIST: Record<ListKind, { key: KeyCol; name: NameCol }> = {
  customer: { key: "customer", name: "customer_name" },
  article: { key: "article", name: "article_text" },
  compound: { key: "compound", name: "compound" },
  approval: { key: "approval", name: "approval" },
};
/** Ranked by revenue or by gross profit - the order from this list only, the key breaking a tie. */
const LIST_ORDER = { rev: "SUM(rev) DESC", gp: "SUM(gp) DESC" } as const;

/**
 * One page of every customer, article, compound or approval of the period and the filters: ranked by revenue or gross
 * profit, found by a search over the key and the name (an article's compound too), a family's compounds only, the
 * unnamed compounds and the empty approvals left out as the pages show them - with the same keys a year earlier, and
 * how many there are in all. Every value from the request is a bound parameter.
 */
export async function readSealingList(f: SealingFilter, a: ListAsk): Promise<SealingList> {
  await ensureSealingTable();
  const L = LIST[a.kind];
  const w = where(f, f.from, f.to);
  const vals: unknown[] = [...w.vals];
  let extra = "";
  if (a.kind === "compound" || a.kind === "article") {
    const all = (await query<{ compound: string }>(`SELECT DISTINCT compound FROM ${TABLE} WHERE ${w.sql}`, w.vals)).rows.map((r) => r.compound);
    const keep = compoundsKept(all, a);
    if (keep) { vals.push(keep); extra += ` AND compound = ANY($${vals.length})`; }
  }
  if (a.kind === "approval") {
    const empty = (await query<{ approval: string }>(`SELECT DISTINCT approval FROM ${TABLE} WHERE ${w.sql}`, w.vals)).rows.map((r) => r.approval).filter((x) => noApproval(x));
    if (empty.length) { vals.push(empty); extra += ` AND approval <> ALL($${vals.length})`; }
  }
  let having = "";
  const q = a.q.trim().toLowerCase();
  if (q) {
    vals.push(q);
    const words = a.kind === "article" ? `${L.key} || ' ' || COALESCE(MAX(${L.name}), '') || ' ' || COALESCE(MAX(compound), '')` : `${L.key} || ' ' || COALESCE(MAX(${L.name}), '')`;
    having = ` HAVING strpos(lower(${words}), $${vals.length}) > 0`;
  }
  const base = `FROM ${TABLE} WHERE ${w.sql}${extra} GROUP BY ${L.key}${having}`;
  const total = Number((await query<{ n: string }>(`SELECT COUNT(*) AS n FROM (SELECT 1 ${base}) x`, vals)).rows[0]?.n ?? 0);
  const page = await query<{ key: string; name: string | null; rev: string; gp: string; compound: string | null }>(
    `SELECT ${L.key} AS key, MAX(${L.name}) AS name, SUM(rev) AS rev, SUM(gp) AS gp, MAX(compound) AS compound ${base}
      ORDER BY ${LIST_ORDER[a.by]}, ${L.key} LIMIT $${vals.length + 1} OFFSET $${vals.length + 2}`,
    [...vals, a.limit, a.offset],
  );
  const keys = page.rows.map((r) => r.key);
  // the same keys a year earlier - all of each key's invoices then
  const wb = where(f, yearBefore(f.from), yearBefore(f.to));
  const before = keys.length ? new Map((await query<{ key: string; rev: string; gp: string }>(
    `SELECT ${L.key} AS key, SUM(rev) AS rev, SUM(gp) AS gp FROM ${TABLE} WHERE ${wb.sql} AND ${L.key} = ANY($${wb.vals.length + 1}) GROUP BY ${L.key}`,
    [...wb.vals, keys],
  )).rows.map((r) => [r.key, { rev: Number(r.rev), gp: Number(r.gp) }])) : new Map<string, { rev: number; gp: number }>();
  return {
    kind: a.kind, total, offset: a.offset, limit: a.limit,
    rows: page.rows.map((r) => {
      const rev = Number(r.rev), gp = Number(r.gp), b = before.get(r.key);
      return { key: r.key, name: r.name || r.key, rev, gp, margin: rev ? gp / rev : 0, prev: b?.rev ?? 0, prevGp: b?.gp ?? 0, compound: r.compound ?? "" };
    }),
  };
}
