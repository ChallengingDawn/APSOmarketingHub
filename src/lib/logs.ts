import fs from "node:fs/promises";
import path from "node:path";

const LOGS_PATH = path.join(process.cwd(), "src", "data", "logs.json");

export type LogEntry = {
  id: string;
  ts: string;
  type: "like" | "dislike";
  channel: string;
  headline?: string;
  body?: string;
  prompt?: string;
  filters?: Record<string, unknown>;
  correction?: string;
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

export async function readLogs(): Promise<LogsFile> {
  try {
    const raw = await fs.readFile(LOGS_PATH, "utf8");
    return JSON.parse(raw) as LogsFile;
  } catch {
    return EMPTY;
  }
}

export async function writeLogs(next: LogsFile): Promise<void> {
  await fs.writeFile(LOGS_PATH, JSON.stringify(next, null, 2), "utf8");
}

export async function addLogEntry(entry: Omit<LogEntry, "id" | "ts">): Promise<LogEntry> {
  const file = await readLogs();
  const full: LogEntry = {
    id: Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
    ts: new Date().toISOString(),
    ...entry,
  };
  file.entries.unshift(full);
  if (file.entries.length > 500) file.entries = file.entries.slice(0, 500);
  await writeLogs(file);
  return full;
}

export async function setUserDefaults(text: string): Promise<LogsFile> {
  const file = await readLogs();
  file.userDefaults = text;
  await writeLogs(file);
  return file;
}

export async function saveCurrentBatch(batch: CurrentBatch): Promise<void> {
  const file = await readLogs();
  file.currentBatch = batch;
  await writeLogs(file);
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
  file.currentBatch = { ...file.currentBatch, proposals };
  await writeLogs(file);
  return file.currentBatch;
}
