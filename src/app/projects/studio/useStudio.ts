"use client";
// A STUDIO'S DATA IN THE BROWSER (08.11.2026): the to-do, its document, and saving without a Save button.
// The studio changes its document freely (setDoc); 700 ms after the last change what changed since the last save goes to
// the server as small ops (studio/doc.ts), in batches under the 8 KB limit, one after another. "Saved" means the server
// has every change; the page warns before closing while it has not.

import { useCallback, useEffect, useRef, useState } from "react";
import { batches, diffOps } from "@/lib/content/studio/doc";
import type { StudioKind } from "@/lib/content/studio/kinds";
import type { Brief, PersonOpt, Piece } from "../work/types";
import { useWorking, whileWorking, type Working } from "./working";

export type StudioData = {
  ok: boolean; error?: string; kind: StudioKind; me: string; isAdmin: boolean;
  access: { role: string; canEdit: boolean; canComment: boolean; canShare: boolean };
  project: { id: number; title: string; createdBy: string | null; dueDate: string | null } | null;
  brief: Brief; piece: Piece; doc: unknown; rev: number; updatedBy: string | null; updatedAt: string;
  versions: { id: number; label: string | null; by: string | null; at: string }[];
  people: PersonOpt[]; ai: boolean; tasks: { key: string; label: string }[];
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
  reload: () => Promise<void>;
  /** Moves the to-do through its statuses (the project's route), then reads the studio again. */
  move: (to: string, note?: string, reviewer?: string) => Promise<{ ok: boolean; error?: string }>;
  /** Changes the to-do itself - its title, its day on the calendar, who writes or reviews it - shown at once. */
  edit: (fields: { title?: string; dueDate?: string | null; writer?: string | null; reviewer?: string | null }) => Promise<{ ok: boolean; error?: string }>;
};

/** What the frame says while an AI task runs. */
const AI_SAYS: Record<string, string> = { translate: "AI is translating…", design: "AI is laying it out…", variants: "AI is finding words…", subjects: "AI is finding words…", hashtags: "AI is finding words…", ideas: "AI is thinking…" };

async function post(pieceId: number, body: Record<string, unknown>) {
  const r = await fetch(`/api/content/pieces/${pieceId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json().catch(() => ({ ok: false, error: `The hub answered ${r.status}.` }));
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

  const load = useCallback(async () => {
    const j = (await fetch(`/api/content/pieces/${pieceId}`).then((r) => r.json()).catch((e) => ({ ok: false, error: String(e) }))) as StudioData;
    if (!j.ok) { setError(j.error ?? "The studio could not open."); return; }
    setData(j);
    saved.current = j.doc;
    latest.current = j.doc;
    setDocState(j.doc);
    setSave("saved");
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

  const api: StudioApi = {
    data, doc, setDoc, save, saveError, working,
    // the AI is shown at work from the click (the save before it included); an action only when it takes a moment
    ai: (task, input = {}) => whileWorking({ label: AI_SAYS[task] ?? "AI is writing…", kind: "ai" }, async () => {
      await flush();
      const r = await post(pieceId, { action: "ai", task, input });
      return r.ok ? { ok: true as const, result: r.result } : { ok: false as const, error: r.error ?? "The AI did not answer." };
    }),
    act: (name, input = {}) => whileWorking({ label: "Working…", kind: "work" }, async () => {
      await flush();
      const r = await post(pieceId, { action: "act", name, input });
      return r.ok ? { ok: true as const, result: r.result } : { ok: false as const, error: r.error ?? "That did not work." };
    }, 600),
    saveVersion: async (label) => {
      await flush();
      const r = await post(pieceId, { action: "version", label: label ?? null });
      if (r.ok) await load();
      return !!r.ok;
    },
    restore: async (versionId) => {
      await flush();
      const r = await post(pieceId, { action: "restore", versionId });
      if (r.ok) await load();
      return !!r.ok;
    },
    reload: load,
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
