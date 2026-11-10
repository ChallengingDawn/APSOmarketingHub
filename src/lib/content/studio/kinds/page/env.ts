// PAGE - WHICH SHOP A TO-DO WORKS ON: PRODUCTION OR ACC (Content v8, 10.11.2026). Pure: relative imports only
// (tests/studio-page-env.test.ts).
//
// SARCLA 10.11.2026 (point 7): "Page builder i can't select acc" - the page picker listed production's pages only (an ACC
// page showed only when production had no such page). Now the picker offers the environment first (Production | ACC, a
// squared choice above STORE): ACC lists ACC's own pages from the page index (each row says when it is "only on ACC"),
// opens them from acc.apsoparts.com, and the to-do then works on ACC (doc.env = "acc") - its preview, its store views
// (the index's ACC pages) and the last step's publish target follow it: a page of ACC is written to ACC.
//
// What stays production's on purpose: the products, categories and photos a module is filled with (modules/source.ts
// reads the live shop - ACC's catalogue lags behind); the links a module writes are relative, so they follow the page's
// own host.

import type { Env } from "../../../../convert/model";

export const ENV_LABEL: Record<Env, string> = { prod: "Production", acc: "ACC" };
export const ENV_HOST: Record<Env, string> = { prod: "https://www.apsoparts.com", acc: "https://acc.apsoparts.com" };

/** The picker's squared choice, in its order. */
export const ENV_OPTIONS: { key: Env; label: string }[] = [{ key: "prod", label: "Production" }, { key: "acc", label: "ACC" }];

/** A typed address as a path on the shop: a full address of production or ACC (its environment said), or a path (the
 * environment the picker shows). Cart, account and search stay out (`isPage` - model.ts pathInfo). */
export function typedPath(raw: string, isPage: (path: string) => boolean): { env: Env | null; path: string } | null {
  let t = raw.trim();
  let env: Env | null = null;
  const m = /^https?:\/\/(www|acc)\.apsoparts\.com(\/.*)?$/i.exec(t);
  if (m) { env = m[1].toLowerCase() === "acc" ? "acc" : "prod"; t = m[2] ?? "/"; }
  t = t.split(/[?#]/)[0];
  return isPage(t) ? { env, path: t } : null;
}

/** Where a page picked from the picker opens: the row's environment, else (a typed path) the picker's. */
export const pickedEnv = (typed: Env | null, shown: Env): Env => typed ?? shown;

/** The store views the picker offers for an environment: those the index holds pages for there (all of them while the
 * index has not said - the picker's own order stands in). */
export function storesFor(env: Env, stores: { store: string; prod: number; acc: number }[], fallback: readonly string[]): string[] {
  if (!stores.length) return [...fallback];
  const have = stores.filter((s) => (env === "acc" ? s.acc : s.prod) > 0).map((s) => s.store);
  return have.length ? have : stores.map((s) => s.store);
}

/** The row's note in the picker: an ACC page production does not have. */
export const rowNote = (r: { env: Env; onlyAcc?: boolean }) => (r.env === "acc" && r.onlyAcc ? "only on ACC" : "");

/**
 * Where the last step may write the page: a page of the shop on ACC goes to ACC (production may not have it - and its
 * changes were made on ACC's page); a page of production to ACC and/or production as before (ACC first, to check); a new
 * page made here to either.
 */
export function publishTargets(d: { source: string; env: Env }): Env[] {
  return d.source !== "new" && d.env === "acc" ? ["acc"] : ["acc", "prod"];
}

/** Why a write to this environment is refused for this to-do ("" = it may go there). */
export function targetWhy(d: { source: string; env: Env }, env: Env): string {
  if (publishTargets(d).includes(env)) return "";
  return "This to-do works on ACC's page - it is written to ACC. To change production's page, pick it on Production.";
}

/** The SQL filter of the page index for an environment (findPages): production's pages, ACC's, or - an older caller
 * with none - production's first and ACC's where a page is only there. */
export type EnvFilter = { env: Env | null; onlyAcc: boolean };
export function envFilter(input: { env?: unknown; only?: unknown }): EnvFilter {
  const env: Env | null = input.env === "acc" ? "acc" : input.env === "prod" ? "prod" : null;
  return { env, onlyAcc: env === "acc" && input.only === true };
}
