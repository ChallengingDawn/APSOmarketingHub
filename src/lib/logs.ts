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

type LogsFile = {
  version: number;
  userDefaults: string;
  entries: LogEntry[];
};

const EMPTY: LogsFile = { version: 1, userDefaults: "", entries: [] };

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