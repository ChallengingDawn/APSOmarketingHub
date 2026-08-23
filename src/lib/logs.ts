import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ensureSchema, kvGet, kvSet } from "./db/init";

// Legacy container file — only used to seed the database once on first read.
const LOGS_PATH = path.join(process.cwd(), "src", "data", "logs.json");

const KEY_ENTRIES = "logs.entries";
const KEY_USER_DEFAULTS = "logs.userDefaults";
const KEY_CURRENT_BATCH = "logs.currentBatch";
const MAX_ENTRIES = 500;

export type LogEntryType = "like" | "dislike" | "comment";

export type LogEntry = {
  id: string;
  ts: string;
  type: LogEntryType;
  channel: string;
  headline?: string;
  body?: string;
  prompt?: string;
  filters?: Record<string, unknown>;
  correction?: string;
  note?: string;
  userDefault?: string;
};

export type BatchProposal = {
  headline: string;
  body: string;
  imagePrompt: string;
  imageUrl: string;
  imageSource: "gemini" | "fallback";
  imageError?: string;
  imagePending?: boolean;
};

export type CurrentBatch = {
  channel: string;
  filters: Record<string, unknown>;
  proposals: BatchProposal[];
  generatedAt: string;
};

type LogsFile = {
  version: number;
  userDefaults: string;
  entries: LogEntry[];
  currentBatch?: CurrentBatch | null;
};

const EMPTY: LogsFile = { version: 1, userDefaults: "", entries: [], currentBatch: null };

/**
 * One-time migration: when none of the kv keys exist yet but the legacy
 * src/data/logs.json is present in the container, copy it into the database.
 * Returns the seeded file, or null when there was nothing to seed.
 */
async function seedFromLegacyFile(): Promise<LogsFile | null> {
  let file: LogsFile;
  try {
    const raw = await fs.readFile(LOGS_PATH, "utf8");
    file = JSON.parse(raw) as LogsFile;
  } catch {
    return null;
  }
  const seeded: LogsFile = {
    version: 1,
    userDefaults: file.userDefaults ?? "",
    entries: Array.isArray(file.entries) ? file.entries.slice(0, MAX_ENTRIES) : [],
    currentBatch: file.currentBatch ?? null,
  };
  await kvSet(KEY_ENTRIES, seeded.entries);
  await kvSet(KEY_USER_DEFAULTS, seeded.userDefaults);
  await kvSet(KEY_CURRENT_BATCH, seeded.currentBatch);
  return seeded;
}

export async function readLogs(): Promise<LogsFile> {
  try {
    await ensureSchema();
    const [entries, userDefaults, currentBatch] = await Promise.all([
      kvGet<LogEntry[]>(KEY_ENTRIES),
      kvGet<string>(KEY_USER_DEFAULTS),
      kvGet<CurrentBatch | null>(KEY_CURRENT_BATCH),
    ]);
    if (entries === undefined && userDefaults === undefined && currentBatch === undefined) {
      const seeded = await seedFromLegacyFile();
      if (seeded) return seeded;
    }
    return {
      version: 1,
      userDefaults: userDefaults ?? "",
      entries: entries ?? [],
      currentBatch: currentBatch ?? null,
    };
  } catch {
    return EMPTY;
  }
}

export async function writeLogs(next: LogsFile): Promise<void> {
  await ensureSchema();
  const entries = (next.entries ?? []).slice(0, MAX_ENTRIES);
  await kvSet(KEY_ENTRIES, entries);
  await kvSet(KEY_USER_DEFAULTS, next.userDefaults ?? "");
  await kvSet(KEY_CURRENT_BATCH, next.currentBatch ?? null);
}

export async function addLogEntry(entry: Omit<LogEntry, "id" | "ts">): Promise<LogEntry> {
  const file = await readLogs();
  const full: LogEntry = {
    id: randomUUID(),
    ts: new Date().toISOString(),
    ...entry,
  };
  const entries = [full, ...file.entries].slice(0, MAX_ENTRIES);
  await kvSet(KEY_ENTRIES, entries);
  return full;
}

export async function setUserDefaults(text: string): Promise<LogsFile> {
  const file = await readLogs();
  await kvSet(KEY_USER_DEFAULTS, text);
  return { ...file, userDefaults: text };
}

export async function saveCurrentBatch(batch: CurrentBatch): Promise<void> {
  // readLogs first so the legacy-file seed runs before we overwrite the batch key.
  await readLogs();
  await kvSet(KEY_CURRENT_BATCH, batch);
}

export async function updateCurrentBatchImage(
  index: number,
  patch: Partial<BatchProposal>
): Promise<CurrentBatch | null> {
  const file = await readLogs();
  if (!file.currentBatch) return null;
  const proposals = file.currentBatch.proposals.slice();
  if (index < 0 || index >= proposals.length) return file.currentBatch;
  proposals[index] = { ...proposals[index], ...patch };
  const nextBatch: CurrentBatch = { ...file.currentBatch, proposals };
  await kvSet(KEY_CURRENT_BATCH, nextBatch);
  return nextBatch;
}
