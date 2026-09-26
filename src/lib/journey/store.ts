// Where the imported journey lives.
//
// One current version plus the previous ones, in the key-value table the hub
// already has. The history matters: the journey is a business document that
// several people edit, and "who changed the drop-off risks, and when" is a
// question that will be asked.

import { query } from "@/lib/db/client";
import type { JourneyModel } from "./model";

const CURRENT = "journey:current";
const HISTORY = "journey:history";
const HISTORY_KEEP = 10;

export type JourneyHistoryEntry = {
  importedAt: string;
  importedBy: string;
  fileName: string;
  stages: number;
  steps: number;
};

export async function loadJourney(): Promise<JourneyModel | null> {
  try {
    const res = await query<{ v: JourneyModel }>("SELECT v FROM apsomh_kv WHERE k = $1", [CURRENT]);
    return res.rows[0]?.v ?? null;
  } catch {
    return null;                                   // no database configured: the app still renders, empty
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
    importedAt: model.source.importedAt,
    importedBy: model.source.importedBy,
    fileName: model.source.fileName,
    stages: model.stages.length,
    steps: model.steps.length,
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
