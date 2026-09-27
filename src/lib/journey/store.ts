// Where the journey lives.
//
// One current definition plus the last few versions, in the key-value table the
// hub already has. The history matters: this is a business document several
// people edit, and "who changed the drop-off risks, and when" gets asked.

import { query } from "@/lib/db/client";
import type { JourneyModel } from "./model";
import { JOURNEY_SEED } from "./seed";

const CURRENT = "journey:current";
const HISTORY = "journey:history";
const HISTORY_KEEP = 10;

export type JourneyHistoryEntry = {
  at: string;
  by: string;
  stages: number;
  steps: number;
  items: number;
};

/**
 * The journey in force. An imported workbook always wins; when none has been
 * imported the application falls back to the version shipped with it, so the
 * screens are never empty and the numbers have something to hang on.
 */
export async function loadJourney(): Promise<JourneyModel | null> {
  try {
    const res = await query<{ v: JourneyModel }>("SELECT v FROM apsomh_kv WHERE k = $1", [CURRENT]);
    const stored = res.rows[0]?.v;
    return stored ? withNewLanes(stored) : JOURNEY_SEED;
  } catch {
    return JOURNEY_SEED;                           // no database reachable: the definition still stands
  }
}

/**
 * A board saved before a lane existed would never show it, because the stored
 * version wins over the shipped one — so the first edit anybody made would have
 * frozen the journey's shape for good. When the stored board has NO card at all
 * of a kind the definition ships, those cards are added; a kind with even one
 * card is left completely alone, so nothing anybody deleted comes back.
 */
function withNewLanes(stored: JourneyModel): JourneyModel {
  const present = new Set(stored.items.map((i) => i.kind));
  const stages = new Set(stored.stages.map((s) => s.id));
  const missing = JOURNEY_SEED.items.filter((i) => !present.has(i.kind) && stages.has(i.stageId));
  if (missing.length === 0 && stored.title) return stored;
  return {
    ...stored,
    title: stored.title ?? JOURNEY_SEED.title,
    items: missing.length ? [...stored.items, ...missing] : stored.items,
  };
}

/** True when nobody has edited anything and the shipped definition is in use. */
export async function isSeeded(): Promise<boolean> {
  try {
    const res = await query<{ k: string }>("SELECT k FROM apsomh_kv WHERE k = $1", [CURRENT]);
    return res.rows.length === 0;
  } catch {
    return true;
  }
}

export async function saveJourney(model: JourneyModel): Promise<void> {
  await query(
    `INSERT INTO apsomh_kv (k, v, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v, updated_at = NOW()`,
    [CURRENT, JSON.stringify(model)],
  );
  const history = await loadHistory();
  const entry: JourneyHistoryEntry = {
    at: model.source.lastEditedAt ?? new Date().toISOString(),
    by: model.source.lastEditedBy ?? "unknown",
    stages: model.stages.length,
    steps: model.steps.length,
    items: model.items.length,
  };
  const next = [entry, ...history].slice(0, HISTORY_KEEP);
  await query(
    `INSERT INTO apsomh_kv (k, v, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v, updated_at = NOW()`,
    [HISTORY, JSON.stringify(next)],
  );
}

export async function loadHistory(): Promise<JourneyHistoryEntry[]> {
  try {
    const res = await query<{ v: JourneyHistoryEntry[] }>("SELECT v FROM apsomh_kv WHERE k = $1", [HISTORY]);
    return res.rows[0]?.v ?? [];
  } catch {
    return [];
  }
}
