"use client";
// A STUDIO'S DATA IN THE BROWSER (08.11.2026): the to-do, its document, and saving without a Save button.
// The studio changes its document freely (setDoc); 700 ms after the last change what changed since the last save goes to
// the server as small ops (studio/doc.ts), in batches under the 8 KB limit, one after another. "Saved" means the server
// has every change; the page warns before closing while it has not.

import { useCallback, useEffect, useRef, useState } from "react";
import { batches, diffOps } from "@/lib/content/studio/doc";
import { readAnswer } from "@/lib/http/answer";
import { wholeTaskLabel } from "@/lib/content/studio/versionNames";
import type { StudioKind } from "@/lib/content/studio/kinds";
import type { Brief, PersonOpt, Piece } from "../work/types";
import { useWorking, whileWorking, type Working } from "./working";

export type StudioData = {
  ok: boolean; error?: string; kind: StudioKind; me: string; isAdmin: boolean;
  access: { role: string; canEdit: boolean; canComment: boolean; canShare: boolean };
  /** `brief`: the project's notes as written (its ideas' lines "[idea seo:12] ...", a marker) */
  project: { id: number; title: string; createdBy: string | null; dueDate: string | null; brief?: string | null } | null;
  brief: Brief; piece: Piece; doc: unknown; rev: number; updatedBy: string | null; updatedAt: string;
  versions: { id: number; label: string | null; by: string | null; at: string }[];
  people: PersonOpt[]; ai: boolean; tasks: { key: string; label: string }[];
  /** who reviews unless someone else is picked (SARCLA 09.11.2026: "the reviewer is Claudio") */
  defaultReviewer?: string | null;
};

export type SaveState = "saved" | "saving" | "waiting" | "error";

export type StudioApi = {
  data: StudioData;
  doc: unknown;
  setDoc: (next: unknown | ((cur: unknown) => unknown)) => void;
  save: SaveState;
  saveError: string | null;
  /** The AI (or a slow action) at work right now - the frame shows it, a kind studio may too (parts.tsx AiWorking). */
  working: Working | null;
  /** One of the kind's AI tasks; the answer comes back cleaned, for the studio to apply. */
  ai: <T = unknown>(task: string, input?: Record<string, unknown>) => Promise<{ ok: true; result: T } | { ok: false; error: string }>;
  /** One of the kind's server actions. */
  act: <T = unknown>(name: string, input?: Record<string, unknown>) => Promise<{ ok: true; result: T } | { ok: false; error: string }>;
  saveVersion: (label?: string) => Promise<boolean>;
  restore: (versionId: number) => Promise<boolean>;
  /** A version kept quietly (no event on the project's feed, the studio not read again) - its id, or null. For an
   *  AI change a studio may want to take back after a reload (the social studio's "Changes made here", 09.11.2026). */
  keepVersion?: (label: string) => Promise<number | null>;
  reload: () => Promise<void>;
  /** Moves the to-do through its statuses (the project's route), then reads the studio again. */
  move: (to: string, note?: string, reviewer?: string) => Promise<{ ok: boolean; error?: string }>;
  /** Changes the to-do itself - its title, its day on the calendar, who writes or reviews it - shown at once. */
  edit: (fields: { title?: string; dueDate?: string | null; writer?: string | null; reviewer?: string | null }) => Promise<{ ok: boolean; error?: string }>;
  /** Moves on each time a version is brought back: the frame opens the kind's studio again on it, so a studio that keeps
   *  its own state takes the brought-back document at once (SARCLA 09.11.2026: "Versions is not working correctly"). */
  epoch?: number;
  /** A version being looked at, read-only (lookApi): its id - a studio that draws on the server says it (page preview). */
  looking?: number | null;
};

/** The actions a studio may still call while a version is looked at: they only read. */
const READ_ACTS = new Set(["stores", "pages", "convert", "candidates", "inserts", "winner", "features", "ping", "counterpart", "paste", "export"]);
const LOOKING = "You are looking at a version - close it (or bring it back) to change things.";

/**
 * The studio's api for LOOKING at a version (SARCLA 09.11.2026): its document, read-only - nothing saved, no AI, no
 * move; the kind's studio draws it in the middle as it draws the to-do. "Bring it back" / "Close" are the frame's.
 */
export function lookApi(api: StudioApi, version: { id: number }, doc: unknown): StudioApi {
  const refuse = async () => ({ ok: false as const, error: LOOKING });
  return {
    ...api, doc, looking: version.id, save: "saved", saveError: null, working: null,
    data: { ...api.data, access: { ...api.data.access, canEdit: false } },
    setDoc: () => undefined,
    ai: refuse,
    act: (async (name: string, input?: Record<string, unknown>) => (READ_ACTS.has(name) ? api.act(name, input) : refuse())) as StudioApi["act"],
    saveVersion: async () => false, restore: async () => false, keepVersion: async () => null,
    reload: async () => undefined, move: refuse, edit: refuse,
  };
}

/** What the frame says while an AI task runs. */
const AI_SAYS: Record<string, string> = { translate: "AI is translating…", design: "AI is laying it out…", variants: "AI is finding words…", subjects: "AI is finding words…", hashtags: "AI is finding words…", ideas: "AI is thinking…", plan: "AI is planning the page with modules…" };

// the answer in plain words, never "The hub answered 200." (SARCLA 10.11.2026 - lib/http/answer.ts): a slow action's
// status is always 200 (keepAlive), so an answer cut on the way is said as such; a network failure is said, not thrown
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function post(pieceId: number, body: Record<string, unknown>): Promise<any> {
  return readAnswer(fetch(`/api/content/pieces/${pieceId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
}

export function useStudio(pieceId: number): { api: StudioApi | null; error: string | null } {
  const [data, setData] = useState<StudioData | null>(null);
  const [doc, setDocState] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const saved = useRef<unknown>(null);
  const latest = useRef<unknown>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushing = useRef<Promise<void> | null>(null);
  const working = useWorking();
  const [epoch, setEpoch] = useState(0);

  /** Reads the to-do and its document; `remount` (a version brought back) opens the kind's studio again on it - in the same
   *  render as the new document, so no studio's own list ("Changes made here", Undo) outlives the document it was made on. */
  const load = useCallback(async (remount = false) => {
    const j = (await readAnswer(fetch(`/api/content/pieces/${pieceId}`))) as unknown as StudioData;
    if (!j.ok) { setError(j.error ?? "The studio could not open."); return; }
    setData(j);
    saved.current = j.doc;
    latest.current = j.doc;
    setDocState(j.doc);
    setSave("saved");
    if (remount) setEpoch((n) => n + 1);
  }, [pieceId]);
  useEffect(() => { void load(); }, [load]);

  const flush = useCallback(async () => {
    if (flushing.current) { await flushing.current; }
    const run = (async () => {
      const ops = diffOps(saved.current, latest.current);
      if (!ops.length) { setSave("saved"); return; }
      setSave("saving");
      const target = latest.current;
      for (const one of batches(ops)) {
        const r = await post(pieceId, { action: "ops", ops: one });
        if (!r.ok) { setSave("error"); setSaveError(r.error ?? "Not saved."); return; }
      }
      saved.current = target;
      setSaveError(null);
      setSave(diffOps(saved.current, latest.current).length ? "waiting" : "saved");
    })();
    flushing.current = run;
    await run;
    flushing.current = null;
    if (diffOps(saved.current, latest.current).length) void flush();
  }, [pieceId]);

  const setDoc = useCallback((next: unknown | ((cur: unknown) => unknown)) => {
    const value = typeof next === "function" ? (next as (cur: unknown) => unknown)(latest.current) : next;
    latest.current = value;
    setDocState(value);
    setSave("waiting");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 700);
  }, [flush]);

  // never leave with changes not saved
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (diffOps(saved.current, latest.current).length) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  if (!data) return { api: null, error };

  /** A version kept quietly (no event on the project's feed, the studio not read again): its id, or null. */
  const keepQuiet = async (label: string): Promise<number | null> => {
    await flush();
    const r = await post(pieceId, { action: "version", label, quiet: true });
    if (!r.ok || typeof r.id !== "number") return null;
    setData((d) => (d ? { ...d, versions: [{ id: r.id as number, label, by: d.me, at: new Date().toISOString() }, ...d.versions] } : d));
    return r.id as number;
  };

  const api: StudioApi = {
    data, doc, setDoc, save, saveError, working, epoch,
    // the AI is at work from the click (the save before it included) - the frame shows it; an action counts once it
    // takes over 1.2 s (kind "work": the frame leaves it to its studio - a quick read as a studio opens never shows)
    ai: (task, input = {}) => whileWorking({ label: AI_SAYS[task] ?? "AI is writing…", kind: "ai" }, async () => {
      await flush();
      // before an AI writes the whole thing, the thing as it is is kept in Versions ("Before the AI wrote the page")
      const before = data.access.canEdit ? wholeTaskLabel(data.kind, task, input) : null;
      if (before) await keepQuiet(before).catch(() => null);
      const r = await post(pieceId, { action: "ai", task, input });
      return r.ok ? { ok: true as const, result: r.result } : { ok: false as const, error: r.error ?? "The AI did not answer." };
    }),
    act: (name, input = {}) => whileWorking({ label: "Working…", kind: "work" }, async () => {
      await flush();
      const r = await post(pieceId, { action: "act", name, input });
      return r.ok ? { ok: true as const, result: r.result } : { ok: false as const, error: r.error ?? "That did not work." };
    }, 1200),
    saveVersion: async (label) => {
      await flush();
      const r = await post(pieceId, { action: "version", label: label ?? null });
      if (r.ok) await load();
      return !!r.ok;
    },
    keepVersion: keepQuiet,
    restore: async (versionId) => {
      await flush();
      const r = await post(pieceId, { action: "restore", versionId });
      if (r.ok) await load(true);
      return !!r.ok;
    },
    reload: () => load(),
    move: async (to, note, reviewer) => {
      await flush();
      const r = await fetch(`/api/content/projects/${data.piece.projectId}/work`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "piece-move", pieceId, to, note: note ?? null, ...(reviewer ? { reviewer } : {}) }) })
        .then((x) => x.json()).catch(() => ({ ok: false, error: "The hub did not answer." }));
      if (r.ok) await load();
      return r;
    },
    edit: async (fields) => {
      const before = data.piece;
      setData((d) => (d ? { ...d, piece: { ...d.piece, ...fields, title: fields.title?.trim() || d.piece.title } as Piece } : d));
      const r = await fetch(`/api/content/projects/${data.piece.projectId}/work`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "piece-edit", pieceId, ...fields }) })
        .then((x) => x.json()).catch(() => ({ ok: false, error: "The hub did not answer." }));
      if (!r.ok) setData((d) => (d ? { ...d, piece: before } : d));
      return r;
    },
  };
  return { api, error };
}
