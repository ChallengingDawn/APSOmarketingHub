// APSOconvert > WHAT THE HUB HANDS THE SHOP'S GATEWAY - the test's configuration and the results it reads back, as
// the contract with the DirectUp gateway has them (C:\dev\convert-contract.md, 07-08.11.2026). The gateway's shop
// runtime (head.js -> /convert/t/:id.js) lays variant "b"'s change list over the listed pages of the listed host for a
// share of the visitors (split, or more of them to the better one as results come in - bandit), or for everyone in an
// audience (a personalisation), and counts visitors and add-to-carts per variant.
//
// Pure (no "@/" imports), so it is tested.

import type { Env } from "./model";
import { validateChanges, type Change } from "./versions";

export type Host = "www.apsoparts.com" | "acc.apsoparts.com";
export const HOST: Record<Env, Host> = { prod: "www.apsoparts.com", acc: "acc.apsoparts.com" };
export const envOfHost = (h: string): Env => (h === HOST.acc ? "acc" : "prod");

export type TestKind = "test" | "personalisation";
/** The hub's own life of a test; the gateway knows running / paused / stopped. */
export type TestStatus = "draft" | "running" | "paused" | "stopped" | "shipped";
export type GatewayStatus = "running" | "paused" | "stopped";
export const STATUS_LABEL: Record<TestStatus, string> = {
  draft: "Not started", running: "Running", paused: "Paused", stopped: "Stopped", shipped: "Shipped",
};
export const STATUS_TINT: Record<TestStatus, "slate" | "green" | "amber" | "blue" | "purple"> = {
  draft: "slate", running: "green", paused: "amber", stopped: "blue", shipped: "purple",
};

export type Allocation = { mode: "split" | "bandit"; split: { a: number; b: number }; floor: number };
export type Audience = {
  stores: string[];
  device: "any" | "desktop" | "phone";
  visitor: "any" | "new" | "returning";
  login: "any" | "guest" | "customer";
  source: "any" | "search" | "ads" | "direct" | "email" | "other";
};
export type Goal = "add_to_cart";

export type TestConfig = {
  id: string;
  v: number;
  kind: TestKind;
  status: GatewayStatus;
  name: string;
  host: Host;
  pages: string[];
  variants: { key: "a" | "b"; name: string; changes: Change[] }[];
  allocation: Allocation;
  audience: Audience;
  goal: Goal;
  weights?: { a: number; b: number };
};

export type SegmentCount = { value: string; key: "a" | "b"; visitors: number; carts: number };
export type Results = {
  id: string; v: number; since: string | null;
  variants: { key: "a" | "b"; visitors: number; carts: number; views: number; applyMisses: number }[];
  daily: { day: string; key: "a" | "b"; visitors: number; carts: number }[];
  segments: Record<"device" | "store" | "login" | "visitor" | "source", SegmentCount[]>;
  weights: { a: number; b: number } | null;
  weightsHistory: { at: string; a: number; b: number }[];
};

export const ANY_AUDIENCE: Audience = { stores: [], device: "any", visitor: "any", login: "any", source: "any" };
export const DEFAULT_ALLOCATION: Allocation = { mode: "split", split: { a: 50, b: 50 }, floor: 10 };

const pick = <T extends string>(v: unknown, list: readonly T[], def: T): T => (typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : def);
const STORE = /^[a-z]{2}-[A-Z]{2,3}(\/[a-z]{3})?$/;

/** An audience from whatever was handed in: unknown values fall back to "any", store views kept when they look like one. */
export function normAudience(x: unknown): Audience {
  const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  const stores = Array.isArray(o.stores) ? [...new Set(o.stores.filter((s): s is string => typeof s === "string" && STORE.test(s)))].slice(0, 30) : [];
  return {
    stores,
    device: pick(o.device, ["any", "desktop", "phone"] as const, "any"),
    visitor: pick(o.visitor, ["any", "new", "returning"] as const, "any"),
    login: pick(o.login, ["any", "guest", "customer"] as const, "any"),
    source: pick(o.source, ["any", "search", "ads", "direct", "email", "other"] as const, "any"),
  };
}
export const isEveryone = (a: Audience) => !a.stores.length && a.device === "any" && a.visitor === "any" && a.login === "any" && a.source === "any";

/** A split that adds up to 100 (each side 5..95), a floor of 0..45% for the bandit. */
export function normAllocation(x: unknown): Allocation {
  const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  const s = (o.split && typeof o.split === "object" ? o.split : {}) as Record<string, unknown>;
  const b = Math.round(Number(s.b));
  const bb = Number.isFinite(b) ? Math.min(95, Math.max(5, b)) : 50;
  const f = Math.round(Number(o.floor));
  return { mode: o.mode === "bandit" ? "bandit" : "split", split: { a: 100 - bb, b: bb }, floor: Number.isFinite(f) ? Math.min(45, Math.max(0, f)) : 10 };
}

/** Exact shop paths: no host, no query, no fragment; at most 20. */
export function cleanPages(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const raw of list) {
    if (typeof raw !== "string") continue;
    let p = raw.trim();
    if (/^https?:\/\//i.test(p)) { try { p = new URL(p).pathname; } catch { continue; } }
    p = p.split(/[?#]/)[0];
    if (!p.startsWith("/") || p.startsWith("//") || p.length > 400 || /[\s<>"'\\]/.test(p)) continue;
    if (!out.includes(p)) out.push(p);
  }
  return out.slice(0, 20);
}

const DEVICE: Record<Audience["device"], string> = { any: "", desktop: "on a desktop", phone: "on a phone" };
const VISITOR: Record<Audience["visitor"], string> = { any: "", new: "new to the shop", returning: "who came before" };
const LOGIN: Record<Audience["login"], string> = { any: "", guest: "not signed in", customer: "signed-in customers" };
const SOURCE: Record<Audience["source"], string> = { any: "", search: "from a search engine", ads: "from an ad", direct: "who typed the address", email: "from an e-mail", other: "from another site" };

/** The audience in a line: "Signed-in customers in de-CH and fr-CH, on a phone, from an ad". */
export function audienceWords(a: Audience): string {
  if (isEveryone(a)) return "Everyone";
  const who = a.login === "customer" ? "Signed-in customers" : a.login === "guest" ? "Guests (not signed in)" : "Visitors";
  const stores = a.stores.length > 1 ? `${a.stores.slice(0, -1).join(", ")} and ${a.stores[a.stores.length - 1]}` : a.stores[0] ?? "";
  const parts = [DEVICE[a.device], VISITOR[a.visitor], SOURCE[a.source]].filter(Boolean);
  return `${who}${stores ? ` in ${stores}` : ""}${parts.length ? `, ${parts.join(", ")}` : ""}`;
}

/** Who gets the version when it starts, for the confirm: "half of the visitors", "30% of the visitors"... */
export function shareWords(a: Allocation): string {
  if (a.mode === "bandit") return `half of the visitors at first, then more to the better one (at least ${a.floor}% each)`;
  return a.split.b === 50 ? "half of the visitors" : `${a.split.b}% of the visitors`;
}

/** The split in words: "Half and half", "30% get the version", "More to the better one (at least 10% each)". */
export function allocationWords(a: Allocation): string {
  if (a.mode === "bandit") return `More visitors to the better one as results come in (at least ${a.floor}% each)`;
  return a.split.b === 50 ? "Half and half" : `${a.split.b}% get the version, ${a.split.a}% the page as it is`;
}

/**
 * The configuration the gateway stores and the shop runs: "a" = the page as it is (no change), "b" = the version's
 * changes - checked again here with the same rules the gateway applies (no script, no handler, no javascript:).
 * A personalisation gives everyone in its audience "b": its split is 0/100.
 */
export function buildConfig(t: {
  id: string; v: number; kind: TestKind; status: GatewayStatus; name: string; host: Host; pages: string[];
  allocation: Allocation; audience: Audience;
}, changes: Change[]): { config: TestConfig; problems: string[] } {
  const { changes: safe, problems } = validateChanges(changes);
  const allocation = t.kind === "personalisation" ? { mode: "split" as const, split: { a: 0, b: 100 }, floor: 0 } : normAllocation(t.allocation);
  return {
    config: {
      id: String(t.id), v: Math.max(1, Math.floor(t.v)), kind: t.kind, status: t.status, name: t.name.slice(0, 200), host: t.host,
      pages: cleanPages(t.pages),
      variants: [{ key: "a", name: "The page as it is", changes: [] }, { key: "b", name: "The version", changes: safe }],
      allocation, audience: normAudience(t.audience), goal: "add_to_cart",
    },
    problems,
  };
}

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };
const keyOf = (v: unknown): "a" | "b" => (v === "b" ? "b" : "a");

/** The gateway's answer read defensively: counts as numbers (Postgres sends them as text), the keys a or b. */
export function normResults(x: unknown, id: string, v: number): Results {
  const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  const arr = (y: unknown) => (Array.isArray(y) ? y : []) as Record<string, unknown>[];
  const segIn = (o.segments && typeof o.segments === "object" ? o.segments : {}) as Record<string, unknown>;
  const seg = (k: string): SegmentCount[] => arr(segIn[k]).map((r) => ({ value: r.value === null || r.value === undefined ? "" : String(r.value).slice(0, 40), key: keyOf(r.key), visitors: num(r.visitors), carts: num(r.carts) }));
  const w = o.weights && typeof o.weights === "object" ? (o.weights as Record<string, unknown>) : null;
  return {
    id: String(o.id ?? id), v: Number(o.v ?? v) || v, since: typeof o.since === "string" ? o.since : null,
    variants: arr(o.variants).map((r) => ({ key: keyOf(r.key), visitors: num(r.visitors), carts: num(r.carts), views: num(r.views), applyMisses: num(r.applyMisses) })),
    daily: arr(o.daily).map((r) => ({ day: String(r.day ?? "").slice(0, 10), key: keyOf(r.key), visitors: num(r.visitors), carts: num(r.carts) })),
    segments: { device: seg("device"), store: seg("store"), login: seg("login"), visitor: seg("visitor"), source: seg("source") },
    weights: w ? { a: num(w.a), b: num(w.b) } : null,
    weightsHistory: arr(o.weightsHistory).map((r) => ({ at: String(r.at ?? ""), a: num(r.a), b: num(r.b) })).filter((r) => r.at),
  };
}

/** Two configurations on the same host sharing a page would fight over it: the pages they share. */
export function sharedPages(a: { host: string; pages: string[] }, b: { host: string; pages: string[] }): string[] {
  if (a.host !== b.host) return [];
  return a.pages.filter((p) => b.pages.includes(p));
}
