// SEALING BUSINESS REVIEW - the commercial priorities' statuses (SARCLA 11.11.2026: "should be able to accept, refuse,
// and more come, or give it a status"). A card is found in the figures each time the page is read (sealingRules
// commercialCandidates, reviewCandidates ...); only what a cross-admin decided about it is kept here, under its stable
// key - its kind, what it is about, the rule that found it - with who set it and when. No status: proposed.
// Created at runtime as the figures' own table is (sealingStore ensureSealingTable).

import { query } from "@/lib/db/client";
import { canMove, isPriorityStatus, type PriorityStatus } from "./sealingRules";

const TABLE = "apsomh_ap_sealing_priorities";
let ready: Promise<void> | null = null;

export function ensurePrioritiesTable(): Promise<void> {
  ready ??= (async () => {
    await query(`
      CREATE TABLE IF NOT EXISTS ${TABLE} (
        id TEXT PRIMARY KEY,
        kind VARCHAR(20) NOT NULL,
        entity VARCHAR(400) NOT NULL,
        rule VARCHAR(60) NOT NULL,
        status VARCHAR(20) NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        set_by VARCHAR(200) NOT NULL DEFAULT '',
        set_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
  })().catch((e) => { ready = null; throw e; });
  return ready;
}

export type PriorityMark = { id: string; status: PriorityStatus; setBy: string; setAt: string };

/** Every status given - the pages lay them over the cards they find. */
export async function readPriorityMarks(): Promise<PriorityMark[]> {
  await ensurePrioritiesTable();
  const r = await query<{ id: string; status: string; set_by: string; set_at: Date }>(`SELECT id, status, set_by, set_at FROM ${TABLE}`);
  return r.rows.filter((x) => isPriorityStatus(x.status)).map((x) => ({ id: x.id, status: x.status as PriorityStatus, setBy: x.set_by, setAt: new Date(x.set_at).toISOString() }));
}

/**
 * A card's new status - null: back to proposed (its row goes). Refused when the move is not one its status allows
 * (sealingRules nextStatuses): `moved` false and the status it has.
 */
export async function setPriorityMark(k: { id: string; kind: string; entity: string; rule: string }, to: PriorityStatus | null, title: string, by: string): Promise<{ moved: boolean; status: PriorityStatus | null }> {
  await ensurePrioritiesTable();
  const cur = (await query<{ status: string }>(`SELECT status FROM ${TABLE} WHERE id = $1`, [k.id])).rows[0];
  const from = cur && isPriorityStatus(cur.status) ? cur.status : null;
  if (!canMove(from, to)) return { moved: false, status: from };
  if (to === null) {
    await query(`DELETE FROM ${TABLE} WHERE id = $1`, [k.id]);
  } else {
    await query(
      `INSERT INTO ${TABLE} (id, kind, entity, rule, status, title, set_by, set_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (id) DO UPDATE SET status = $5, title = $6, set_by = $7, set_at = NOW()`,
      [k.id, k.kind, k.entity.slice(0, 400), k.rule, to, title.slice(0, 500), by.slice(0, 200)],
    );
  }
  return { moved: true, status: to };
}
