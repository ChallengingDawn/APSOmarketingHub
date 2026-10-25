// OWNER REDIRECTION - where the hub keeps the rules (its own Postgres) and the
// corrections its 15-minute check made. Two tables, made on first use - NOT in
// ensureSchema (a failure here must never hold up every page of the hub).
//
//   apsomh_owner_rules       one row per rule, in order; the rule itself as JSON
//   apsomh_owner_rule_log    one row per company the sweep corrected (live runs only)
//
// The first time the table is made it gets today's France rule, once: a flag in the
// key-value table says it was seeded, so deleting the rule later does not bring it back.

import { randomUUID } from "node:crypto";
import { getPool, query } from "@/lib/db/client";
import { ensureSchema, kvGet, kvSet } from "@/lib/db/init";
import { SEED_RULE, checkRule, newRuleId, type Rule } from "./rules";

const KV_SEEDED = "ownerRules:seeded";
/** the leavers' rules of 25.10.2026 13:43, taken out again once (Map assignment moves a leaver's records) */
const KV_LEAVERS_GONE = "ownerRules:leaversRemoved20261025";
const LEAVER_IDS = ["leaver-stahl", "leaver-bozek", "leaver-kulczyk", "leaver-nitschke", "leaver-codognola", "leaver-pirzad"];
const LOG_KEEP_DAYS = 180;

let ready: Promise<void> | null = null;

/** The two tables and the France seed, once per process. A failure is retried on the next call. */
export function ensureOwnerRules(): Promise<void> {
  ready ??= (async () => {
    await ensureSchema(); // the key-value table must exist; this is not called FROM ensureSchema
    await query(`
      CREATE TABLE IF NOT EXISTS apsomh_owner_rules (
        id          TEXT PRIMARY KEY,
        position    INTEGER NOT NULL,
        rule        JSONB NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_by  TEXT
      );
      CREATE TABLE IF NOT EXISTS apsomh_owner_rule_log (
        id            BIGSERIAL PRIMARY KEY,
        at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        source        TEXT NOT NULL,
        rule_id       TEXT NOT NULL,
        company_id    TEXT NOT NULL,
        company_name  TEXT,
        from_owner    TEXT,
        to_owner      TEXT NOT NULL,
        contacts      INTEGER NOT NULL DEFAULT 0,
        tickets       INTEGER NOT NULL DEFAULT 0,
        tasks         INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS apsomh_owner_rule_log_at_idx ON apsomh_owner_rule_log (at DESC);
    `);
    if (!(await kvGet<boolean>(KV_SEEDED))) {
      // a fixed id: two copies of the hub starting together still make one row
      const { id, ...rule } = SEED_RULE;
      await query(
        `INSERT INTO apsomh_owner_rules (id, position, rule, updated_by) VALUES ($1, 1, $2::jsonb, 'seed: sarcla-france-owner') ON CONFLICT (id) DO NOTHING`,
        [id, JSON.stringify(rule)],
      );
      await kvSet(KV_SEEDED, true);
    }
    if (!(await kvGet<boolean>(KV_LEAVERS_GONE))) {
      // the leavers' rules added 25.10.2026 13:43 (never published) are Map assignment's job since 14:30 the same day
      // (SARCLA: "the override on the map is the redirection, nothing more - everything is redirected, tickets and tasks
      // too"): out of this list, once
      await query(`DELETE FROM apsomh_owner_rules WHERE id = ANY($1::text[])`, [LEAVER_IDS]);
      await kvSet(KV_LEAVERS_GONE, true);
    }
  })().catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}

type Row = { id: string; position: number; rule: Omit<Rule, "id">; updated_at: string; updated_by: string | null };
export type StoredRule = Rule & { updatedAt: string; updatedBy: string | null };

/** The rules in order. A row that no longer reads as a rule is a hard error, never skipped. */
export async function listRules(): Promise<StoredRule[]> {
  await ensureOwnerRules();
  const r = await query<Row>(`SELECT id, position, rule, updated_at, updated_by FROM apsomh_owner_rules ORDER BY position, id`);
  return r.rows.map((row) => {
    const c = checkRule({ ...row.rule, id: row.id });
    if (!c.ok) throw new Error(`stored rule ${row.id} is unreadable: ${c.error}`);
    return { ...c.rule, updatedAt: new Date(row.updated_at).toISOString(), updatedBy: row.updated_by };
  });
}

export const freshRuleId = (existing: Iterable<string>) => newRuleId(existing, () => randomUUID());

/**
 * Replace the whole list in one transaction: the order is the list's order. Rows not in
 * the list are deleted. Only rules that changed get a new updated_at/by.
 */
export async function saveRules(rules: Rule[], by: string): Promise<void> {
  await ensureOwnerRules();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const cur = await client.query<{ id: string }>(`SELECT id FROM apsomh_owner_rules FOR UPDATE`);
    const before = new Set(cur.rows.map((r) => r.id));
    const keep = new Set(rules.map((r) => r.id));
    for (const id of before) if (!keep.has(id)) await client.query(`DELETE FROM apsomh_owner_rules WHERE id = $1`, [id]);
    for (let i = 0; i < rules.length; i++) {
      const { id, ...rule } = rules[i];
      const json = JSON.stringify(rule);
      if (!before.has(id)) {
        await client.query(`INSERT INTO apsomh_owner_rules (id, position, rule, updated_by) VALUES ($1, $2, $3::jsonb, $4)`, [id, i + 1, json, by]);
      } else {
        // jsonb equality is by content, not key order: an unchanged rule keeps who/when
        await client.query(
          `UPDATE apsomh_owner_rules SET position = $2, rule = $3::jsonb,
             updated_at = CASE WHEN rule = $3::jsonb THEN updated_at ELSE NOW() END,
             updated_by = CASE WHEN rule = $3::jsonb THEN updated_by ELSE $4 END
           WHERE id = $1 AND (position <> $2 OR rule <> $3::jsonb)`,
          [id, i + 1, json, by],
        );
      }
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export type Correction = {
  at: string; source: string; ruleId: string; companyId: string; companyName: string | null;
  fromOwner: string | null; toOwner: string; contacts: number; tickets: number; tasks: number;
};

export async function logCorrections(rows: Omit<Correction, "at">[]): Promise<void> {
  if (!rows.length) return;
  await ensureOwnerRules();
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const v: unknown[] = [];
    const tuples = chunk.map((r, j) => {
      v.push(r.source, r.ruleId, r.companyId, r.companyName, r.fromOwner, r.toOwner, r.contacts, r.tickets, r.tasks);
      const b = j * 9;
      return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9})`;
    });
    await query(
      `INSERT INTO apsomh_owner_rule_log (source, rule_id, company_id, company_name, from_owner, to_owner, contacts, tickets, tasks) VALUES ${tuples.join(",")}`,
      v,
    );
  }
  await query(`DELETE FROM apsomh_owner_rule_log WHERE at < NOW() - make_interval(days => $1::int)`, [LOG_KEEP_DAYS]).catch(() => {});
}

export async function recentCorrections(limit = 100): Promise<Correction[]> {
  await ensureOwnerRules();
  const r = await query<{
    at: string; source: string; rule_id: string; company_id: string; company_name: string | null;
    from_owner: string | null; to_owner: string; contacts: number; tickets: number; tasks: number;
  }>(`SELECT at, source, rule_id, company_id, company_name, from_owner, to_owner, contacts, tickets, tasks
      FROM apsomh_owner_rule_log ORDER BY at DESC, id DESC LIMIT $1`, [limit]);
  return r.rows.map((x) => ({
    at: new Date(x.at).toISOString(), source: x.source, ruleId: x.rule_id, companyId: x.company_id, companyName: x.company_name,
    fromOwner: x.from_owner, toOwner: x.to_owner, contacts: x.contacts, tickets: x.tickets, tasks: x.tasks,
  }));
}
