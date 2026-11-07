// APSOconvert > what the page-test, personalise and ship routes share: the person asking, the three honest answers,
// and a test as a row of a list (its figures in short - the daily line and the segments are the detail page's).

import { NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { ConvertError, resultsOf, baseRateOf, type Test } from "./tests";
import type { ArmStats, Interval, VerdictKey } from "./stats";

export async function who(): Promise<string> {
  const u = await getOptionalUser();
  return u?.full_name || u?.username || "someone";
}

export const ok = (data: unknown) => NextResponse.json({ configured: true, ok: true, data });
export const fail = (error: string, status = 200, missing: string[] | null = null) =>
  NextResponse.json({ configured: missing ? false : true, ok: false, error, ...(missing ? { missing } : {}) }, { status });
export function failOf(e: unknown) {
  if (e instanceof ConvertError) return fail(e.message, e.missing ? 200 : e.status >= 500 ? 200 : e.status, e.missing);
  return fail(String((e as Error)?.message ?? e));
}

/** The request body, refused above the hub's 8 KB rule (the WAF answers a bare 403 before us; this says it). */
export async function body(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (text.length > 8000) throw new ConvertError("Too much at once - the hub takes 8 KB per request.", 413);
  try { return (JSON.parse(text || "{}") ?? {}) as Record<string, unknown>; } catch { throw new ConvertError("Not JSON.", 400); }
}

export const idOf = (v: unknown) => (typeof v === "string" && /^\d{1,12}$/.test(v) ? v : typeof v === "number" && Number.isInteger(v) && v > 0 ? String(v) : null);

export type Figures = {
  /** false: nothing read from the gateway yet - the page shows dashes, never zeros it did not count */
  counted: boolean;
  a: ArmStats; b: ArmStats; uplift: Interval; pB: number | null; days: number;
  verdict: { key: VerdictKey; text: string; why: string; decided: boolean; moreDays: number | null } | null;
  at: string | null; live: boolean; error: string | null; applyMisses: number;
  weights: { a: number; b: number } | null;
};

/** A test's figures in short, for a list - read from the gateway for a live one, the last ones kept otherwise. */
export async function figuresOf(t: Test): Promise<Figures | null> {
  if (t.status === "draft") return null;
  const r = await resultsOf(t, { baseRate: await baseRateOf(t).catch(() => null) });
  const an = r.analysis;
  if (!an) return { counted: false, a: empty(), b: empty(), uplift: { mid: null, low: null, high: null }, pB: null, days: 0, verdict: null, at: r.at, live: r.live, error: r.error, applyMisses: 0, weights: null };
  return {
    counted: true, a: an.comparison.a, b: an.comparison.b, uplift: an.comparison.uplift, pB: an.comparison.pBest?.b ?? null, days: an.days,
    verdict: t.kind === "test" ? { key: an.verdict.key, text: an.verdict.text, why: an.verdict.why, decided: an.verdict.decided, moreDays: an.verdict.moreDays } : null,
    at: r.at, live: r.live, error: r.error, applyMisses: (r.results?.variants ?? []).reduce((s, v) => s + v.applyMisses, 0), weights: r.results?.weights ?? null,
  };
}
const empty = (): ArmStats => ({ visitors: 0, carts: 0, rate: null, low: null, high: null });

/** Run over a list a few at a time - the gateway is asked at a person's pace, never all at once. */
export async function inTurns<T, R>(list: T[], n: number, f: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(list.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, list.length) }, async () => {
    while (i < list.length) { const k = i++; out[k] = await f(list[k]); }
  }));
  return out;
}
