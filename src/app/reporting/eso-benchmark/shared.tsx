"use client";
// THE ESO REPORTS' SHARED PARTS - one read of HubSpot (esoBenchmark.ts), the
// chosen reps as one, and the numbers' formats. The pages themselves are drawn
// as Digital Growth's (EsoKit.tsx, pages.tsx - SARCLA 21.10.2026).
//
// Every figure is a sum over the selected reps, so the selection is just an
// addition - except medians, which are taken again over the selected reps'
// raw durations.

import { useEffect, useState } from "react";

import type { EsoBenchmark, RepBenchmark } from "@/lib/reporting/esoBenchmark";
import { sturdyMedians, type Pair } from "@/lib/reporting/esoRules";

export type { EsoBenchmark, RepBenchmark, Pair };

/* ── numbers ───────────────────────────────────────────────────────────── */

export const n0 = (n: number) => Math.round(n).toLocaleString("en");
export const money = (n: number) => `€${n0(n)}`;
export const moneyShort = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e6) return `€${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e4) return `€${Math.round(n / 1e3).toLocaleString("en")}K`;
  return money(n);
};
export const pct = (x: number | null) => (x === null || !Number.isFinite(x) ? "—" : `${(x * 100).toFixed(1)}%`);
export const ratio = (a: number, b: number) => (b ? a / b : null);
export const change = (p: Pair) => (p.py ? (p.cy - p.py) / Math.abs(p.py) : null);
export const hours = (h: number | null) => (h === null || !Number.isFinite(h) ? "—" : h < 48 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} d`);
export const days = (d: number | null) => (d === null || !Number.isFinite(d) ? "—" : `${d.toFixed(1)} d`);
export const sumPairs = (ps: Pair[]): Pair => ps.reduce((t, p) => ({ cy: t.cy + p.cy, py: t.py + p.py }), { cy: 0, py: 0 });
// as the Datatracker names them (src/lib/datatracker/rules.ts PROFIT_CENTRES) - AT is drive belts (Conti Synchroflex), ST
// anti-vibration (APSOvib); until 30.10.2026 these two read "Anti-vibration" and "Silicone & rubber"
const PC: Record<string, string> = { dt: "DT · Sealing", kt: "KT · Plastics", ft: "FT · Hoses & fluid", at: "AT · Drive belts", st: "ST · Anti-vibration", pw: "PW · Power & electronics", unknown: "Not assigned", other: "Other" };
export const pcLabel = (k: string) => PC[k] ?? k.toUpperCase();
const TYPE: Record<string, string> = {
  "Original Equipment Manufacture (OEM)": "OEM", "Turning & Miling Workshop (C2S)": "C2S workshop", "Maintenance, Repair, Operations (MRO)": "MRO",
};
export const typeLabel = (k: string) => TYPE[k] ?? k;

/* ── the data, and the selection ───────────────────────────────────────── */

type State = { ok?: boolean; value?: EsoBenchmark; computing?: boolean; progress?: string; computedAt?: string; error?: string };

export function useEso(): State | null {
  const [state, setState] = useState<State | null>(null);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () => fetch("/api/reporting/eso-benchmark")
      .then((r) => r.json())
      .then((j: State) => { if (!alive) return; setState(j); if (j.computing) timer = setTimeout(load, 5000); })
      .catch((e) => { if (alive) setState({ error: String(e) }); });
    load();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, []);
  return state;
}

function addInto(t: unknown, s: unknown): unknown {
  if (typeof s === "number") return (typeof t === "number" ? t : 0) + s;
  if (s === null || s === undefined) return t ?? s;
  if (Array.isArray(s)) {
    const out = Array.isArray(t) ? t.slice() : [];
    s.forEach((v, i) => { out[i] = addInto(out[i], v); });
    return out;
  }
  if (typeof s === "object") {
    const out: Record<string, unknown> = t && typeof t === "object" ? { ...(t as Record<string, unknown>) } : {};
    for (const [k, v] of Object.entries(s as Record<string, unknown>)) out[k] = addInto(out[k], v);
    return out;
  }
  return t ?? s;
}

/** The selected reps as one: their figures added, their medians taken again. */
export function combine(b: EsoBenchmark, ids: string[]): RepBenchmark {
  const picked = b.reps.filter((r) => ids.includes(r.ownerId));
  if (!picked.length) return b.team;
  if (picked.length === 1) return picked[0];
  const lists: RepBenchmark["lists"] = { firstReplyH: { cy: [], py: [] }, offerH: { cy: [], py: [] }, closeD: { cy: [], py: [] }, regDays: { cy: [], py: [] } };
  let acc: unknown = null;
  for (const r of picked) {
    const { lists: l, ...rest } = r;
    acc = addInto(acc, rest);
    for (const k of Object.keys(lists) as (keyof RepBenchmark["lists"])[]) { lists[k].cy.push(...l[k].cy); lists[k].py.push(...l[k].py); }
  }
  const out = acc as RepBenchmark;
  out.ownerId = "selection";
  out.name = picked.map((p) => p.name).join(", ");
  out.lists = lists;
  out.tickets.firstReplyH = sturdyMedians(lists.firstReplyH);
  out.tickets.offerH = sturdyMedians(lists.offerH);
  out.tickets.closeD = sturdyMedians(lists.closeD);
  out.registrations.daysToOrder = sturdyMedians(lists.regDays);
  return out;
}
