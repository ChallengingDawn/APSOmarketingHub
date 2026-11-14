"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ── Per-user saved preferences ───────────────────────────────────────────────────────
// Filters (and the row-detail view mode) are saved to the LOGGED-IN USER via /api/prefs, so
// they survive a reload, a new tab and another machine, and only go away when the user
// presses "Clear all". localStorage is a same-browser cache so the page paints the saved
// filters at once; the server copy is the truth and wins when it arrives.

const LS = (k: string) => `apsoph-pref:${k}`;
function readLocal(k: string): unknown {
  try { const raw = window.localStorage.getItem(LS(k)); return raw == null ? undefined : JSON.parse(raw); } catch { return undefined; }
}
function writeLocal(k: string, v: unknown) {
  try { window.localStorage.setItem(LS(k), JSON.stringify(v)); } catch { /* private mode */ }
}
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
// Saved values are merged OVER the defaults so a filter added to a page later still has its
// default, and a value of the wrong type (an older shape) falls back instead of crashing.
function merge<T>(def: T, saved: unknown): T {
  if (saved === undefined || saved === null) return def;
  if (isObj(def)) {
    if (!isObj(saved)) return def;
    const out: Record<string, unknown> = { ...def };
    for (const k of Object.keys(def)) {
      const dv = (def as Record<string, unknown>)[k], sv = saved[k];
      if (sv === undefined) continue;
      if (Array.isArray(dv) ? Array.isArray(sv) : typeof sv === typeof dv) out[k] = sv;
    }
    return out as T;
  }
  return typeof saved === typeof def ? (saved as T) : def;
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();
function saveServer(key: string, value: unknown) {
  const t = timers.get(key);
  if (t) clearTimeout(t);
  timers.set(key, setTimeout(() => {
    timers.delete(key);
    fetch("/api/pricing/prefs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, value }) }).catch(() => { /* offline: the local copy still holds it */ });
  }, 400));
}

/** A value saved per user under `key`. `ready` turns true once the server copy is in
 *  (or failed) — pages gate their first data fetch on it so they never load twice. */
export function usePref<T>(key: string, def: T): [T, (v: T | ((p: T) => T)) => void, boolean] {
  const defRef = useRef(def);
  const [val, setVal] = useState<T>(def);
  const [ready, setReady] = useState(false);
  const touched = useRef(false);

  useEffect(() => {
    let alive = true;
    touched.current = false;
    const local = readLocal(key);
    if (local !== undefined) setVal(merge(defRef.current, local));
    const ctl = new AbortController();
    const giveUp = setTimeout(() => ctl.abort(), 2500);
    fetch(`/api/pricing/prefs?key=${encodeURIComponent(key)}`, { signal: ctl.signal })
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (!alive || touched.current) return;  // the user already changed something: keep it
        if (j && j.value !== null && j.value !== undefined) { const v = merge(defRef.current, j.value); setVal(v); writeLocal(key, v); }
      })
      .catch(() => { /* keep the local copy */ })
      .finally(() => { clearTimeout(giveUp); if (alive) setReady(true); });
    return () => { alive = false; clearTimeout(giveUp); ctl.abort(); };
  }, [key]);

  const set = useCallback((v: T | ((p: T) => T)) => {
    touched.current = true;
    setVal(prev => {
      const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v;
      writeLocal(key, next);
      saveServer(key, next);
      return next;
    });
  }, [key]);

  return [val, set, ready];
}

/** All the filters of one page, saved per user. `bind("pc")` gives a [value, setter] pair
 *  so a page swaps `useState("")` for it without restructuring; `reset()` = "Clear all". */
export function useSavedFilters<T extends Record<string, unknown>>(page: string, defaults: T) {
  const defRef = useRef(defaults);
  const [f, setF, ready] = usePref<T>(`filters:${page}`, defaults);
  const set = useCallback(<K extends keyof T>(k: K, v: T[K]) => setF(p => ({ ...p, [k]: v })), [setF]);
  const setMany = useCallback((patch: Partial<T>) => setF(p => ({ ...p, ...patch })), [setF]);
  const reset = useCallback((keep?: Partial<T>) => setF({ ...defRef.current, ...(keep || {}) }), [setF]);
  const bind = useCallback(<K extends keyof T>(k: K) => [f[k], (v: T[K]) => set(k, v)] as const, [f, set]);
  const active = useMemo(
    () => Object.keys(defRef.current).some(k => JSON.stringify(f[k]) !== JSON.stringify(defRef.current[k])),
    [f],
  );
  return { f, set, setMany, reset, bind, ready, active };
}

// ── Row detail view: pop-up (default) or in-row drop-down ───────────────────────────────
export type DetailMode = "popup" | "inline";
/** One setting for the whole platform, saved per user. */
export function useDetailMode() {
  return usePref<DetailMode>("view:detail-mode", "popup");
}
