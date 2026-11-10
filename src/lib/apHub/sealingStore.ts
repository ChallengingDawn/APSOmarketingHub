// SEALING BUSINESS REVIEW - kept and read (the rules: ./sealingRules.ts).
//
// The morning ERP workbook's sealing sheet replaces the table whole each morning (it is a cube query, not a delta), in
// one transaction, so a page never reads half a morning. An empty sheet replaces nothing: yesterday's figures stay.
// The figures are the Angst+Pfister group's (every business unit, with margins) - read only by the Angst+Pfister hub's
// people and the admins (src/app/api/ap/guard.ts).

import type { PoolClient } from "pg";
import { getPool, query } from "@/lib/db/client";
import { materialOf, monthsBetween, noApproval, noCompound, priorities, sumBy, yearBefore, type CompoundCustomer, type Figure, type Priority, type SealingRow } from "./sealingRules";

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

/** A month of the period: its figures, and the same month a year before (null: before the first month the figures hold). */
export type SealingMonth = { month: string; rev: number; gp: number; prevRev: number | null; prevGp: number | null };

export type SealingView = {
  meta: {
    loadedAt: string | null; firstMonth: string | null; lastMonth: string | null; rows: number; bus: string[]; channels: string[];
    /** the morning delivery's file and sheet the figures were read from */
    file: string | null; sheet: string | null;
  };
  period: { from: string; to: string; prevFrom: string; prevTo: string };
  totals: { rev: number; gp: number; margin: number; customers: number; articles: number; prev: { rev: number; gp: number; margin: number; customers: number } };
  /** the period month by month */
  months: SealingMonth[];
  /** the period month by month and business unit */
  buMonths: { month: string; bu: string; rev: number; gp: number }[];
  byBu: Figure[];
  byFamily: Figure[];
  compounds: Figure[];
  customers: Figure[];
  articles: (Figure & { compound: string })[];
  approvals: Figure[];
  /** the share of revenue with no approval written on the article */
  noApprovalShare: number;
  /** the share of revenue whose article names no compound */
  noCompoundShare: number;
  priorities: Priority[];
};

type Raw = { key: string; name: string | null; rev: string; gp: string };

function where(f: SealingFilter, from: string, to: string): { sql: string; vals: unknown[] } {
  const vals: unknown[] = [from, to];
  let sql = `month >= $1 AND month <= $2`;
  if (f.bus?.length) { vals.push(f.bus); sql += ` AND bu = ANY($${vals.length})`; }
  if (f.channels?.length) { vals.push(f.channels); sql += ` AND channel = ANY($${vals.length})`; }
  return { sql, vals };
}

async function grouped(key: string, name: string, f: SealingFilter, from: string, to: string, limit?: number): Promise<Figure[]> {
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

/** The figures by month and business unit. */
async function byMonth(f: SealingFilter, from: string, to: string): Promise<{ month: string; bu: string; rev: number; gp: number }[]> {
  const w = where(f, from, to);
  const r = await query<{ month: string; bu: string; rev: string; gp: string }>(
    `SELECT month, bu, SUM(rev) AS rev, SUM(gp) AS gp FROM ${TABLE} WHERE ${w.sql} GROUP BY month, bu`, w.vals,
  );
  return r.rows.map((x) => ({ month: String(x.month).trim(), bu: x.bu, rev: Number(x.rev), gp: Number(x.gp) }));
}

export async function readSealing(f: SealingFilter): Promise<SealingView> {
  await ensureSealingTable();
  const prevFrom = yearBefore(f.from), prevTo = yearBefore(f.to);
  const meta = (await query<{ loaded_at: Date | null; first_month: string | null; last_month: string | null; rows: number | null; file: string | null; sheet: string | null }>(
    `SELECT loaded_at, first_month, last_month, rows, file, sheet FROM ${TABLE}_meta WHERE id = 1`,
  )).rows[0];
  const bus = (await query<{ bu: string }>(`SELECT DISTINCT bu FROM ${TABLE} WHERE bu <> '' ORDER BY bu`)).rows.map((r) => r.bu);
  const channels = (await query<{ channel: string }>(`SELECT DISTINCT channel FROM ${TABLE} WHERE channel <> '' ORDER BY channel`)).rows.map((r) => r.channel);

  const [buNow, buBefore, compNow, compBefore, custNow, custBefore, artNow, artBefore, appr, monthsNow, monthsBefore] = await Promise.all([
    grouped("bu", "bu", f, f.from, f.to), grouped("bu", "bu", f, prevFrom, prevTo),
    grouped("compound", "compound", f, f.from, f.to), grouped("compound", "compound", f, prevFrom, prevTo),
    grouped("customer", "customer_name", f, f.from, f.to, 200), grouped("customer", "customer_name", f, prevFrom, prevTo),
    grouped("article", "article_text", f, f.from, f.to, 200), grouped("article", "article_text", f, prevFrom, prevTo),
    grouped("approval", "approval", f, f.from, f.to),
    byMonth(f, f.from, f.to), byMonth(f, prevFrom, prevTo),
  ]);
  const w = where(f, f.from, f.to);
  const counts = (await query<{ customers: string; articles: string }>(
    `SELECT COUNT(DISTINCT customer) AS customers, COUNT(DISTINCT article) AS articles FROM ${TABLE} WHERE ${w.sql}`, w.vals,
  )).rows[0];
  const wb = where(f, prevFrom, prevTo);
  const countsBefore = (await query<{ customers: string }>(
    `SELECT COUNT(DISTINCT customer) AS customers FROM ${TABLE} WHERE ${wb.sql}`, wb.vals,
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
  // the period month by month - a month a year before the figures' first month is not known, never a zero
  const monthSum = (rows: { month: string; rev: number; gp: number }[]) => {
    const m = new Map<string, { rev: number; gp: number }>();
    for (const r of rows) { const x = m.get(r.month) ?? { rev: 0, gp: 0 }; x.rev += r.rev; x.gp += r.gp; m.set(r.month, x); }
    return m;
  };
  const mNow = monthSum(monthsNow), mBefore = monthSum(monthsBefore);
  const firstHeld = meta?.first_month ?? null;
  const months = monthsBetween(f.from, f.to).map((month) => {
    const py = yearBefore(month), known = !!firstHeld && py >= firstHeld;
    return { month, rev: mNow.get(month)?.rev ?? 0, gp: mNow.get(month)?.gp ?? 0, prevRev: known ? mBefore.get(py)?.rev ?? 0 : null, prevGp: known ? mBefore.get(py)?.gp ?? 0 : null };
  });

  return {
    meta: {
      loadedAt: meta?.loaded_at ? new Date(meta.loaded_at).toISOString() : null,
      firstMonth: meta?.first_month ?? null, lastMonth: meta?.last_month ?? null, rows: meta?.rows ?? 0, bus, channels,
      file: meta?.file ?? null, sheet: meta?.sheet ?? null,
    },
    period: { from: f.from, to: f.to, prevFrom, prevTo },
    totals: {
      rev: now.rev, gp: now.gp, margin: now.rev ? now.gp / now.rev : 0,
      customers: Number(counts?.customers ?? 0), articles: Number(counts?.articles ?? 0),
      prev: { rev: before.rev, gp: before.gp, margin: before.rev ? before.gp / before.rev : 0, customers: Number(countsBefore?.customers ?? 0) },
    },
    months,
    buMonths: monthsNow.sort((a, b) => a.month.localeCompare(b.month) || b.rev - a.rev),
    byBu: withPrev(buNow, buBefore),
    byFamily: withPrev(familyNow, familyBefore),
    compounds: withPrev(named, namedBefore),
    customers: withPrev(custNow, custBefore),
    articles: withPrev(artNow, artBefore).map((a) => ({ ...a, compound: artCompound.get(a.key) ?? "" })),
    approvals: appr.filter((a) => !noApproval(a.name)).slice(0, 60),
    noApprovalShare: now.rev ? noAppr / now.rev : 0,
    noCompoundShare: now.rev ? noComp / now.rev : 0,
    priorities: priorities(named, pairs),
  };
}
