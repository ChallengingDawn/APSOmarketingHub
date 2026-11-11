// THE LAST STEP AS A PUBLISHING VIEW (Content v14, 11.11.2026). Pure: no "@/" imports - the last step
// (src/app/projects/studio/kinds/page/Publish.tsx) and the tests.
//
// SARCLA 11.11.2026, ~13:40, after publishing the first official page (Kalrez) with the new picture storage: "On the
// Magento last step we should be able to see the current links in one tab, and in one click update them all"; "we should
// see the setup as today"; "pictures should be a new tab"; "the A/B test on the publish modal: we need to control it from
// here". The view has its sections - Pages, Pictures, A/B test (Setup folded into Pages since v14b). This file says, from what the last step already
// reads (the versions with their `since`, the to-do's records of what it wrote), what each page is on each shop, what
// "Update all" writes there and why it cannot, and which A/B tests are the page's.

import { liveOn, pathOf, SHOP_LABEL, type LivePage, type ShopEnv, type Since, type WrittenRecord } from "./published";
import { answerSaid, isHtmlAnswer } from "../../../../convert/magentoSaid";

// Content v14b (SARCLA 11.11.2026, 15:35: "Setup and Pages do the same as a tab"): Setup is part of Pages - its ticks and
// targets folded under "Where it goes", its rights one line on top, the calendar and the hand-over at the foot.
export type PubSection = "pages" | "pictures" | "ab";
export const PUB_SECTIONS: { key: PubSection; label: string }[] = [
  { key: "pages", label: "Pages" }, { key: "pictures", label: "Pictures" }, { key: "ab", label: "A/B test" },
];

/** ACC first (the server's own words, lib .../server.ts ACC_FIRST): production is refused until the page is on ACC. */
export const ACC_FIRST = "ACC first: publish it on ACC and look at it there - then production.";

/** A language version as the last step reads it (Publish.tsx StatusView - only what is read here). */
export type PubVersion = {
  view: string; label?: string; cms: boolean; why?: string | null; blocked?: string | null;
  stores?: { view: string }[]; since?: Partial<Record<ShopEnv, Since>>;
};

/** A version on one shop: its pages there (one per store view, as links), and whether it changed since it was written. */
export type RowState = "changed" | "same" | "on" | "none";
export type RowEnv = { env: ShopEnv; pages: LivePage[]; state: RowState; at: string | null };
export type PageRow = { view: string; label: string; stores: string[]; writable: boolean; envs: Record<ShopEnv, RowEnv> };

export const ENVS_SHOWN: ShopEnv[] = ["acc", "prod"];

/** The store views a version goes to (its main one alone when the hub does not list them). */
export const storesOfRow = (v: PubVersion): string[] => (v.stores?.length ? v.stores.map((s) => s.view) : [v.view]);

/**
 * One row per language version: on each shop, its pages there (the to-do's newest record per store view, switched-off ones
 * left out), and its state - "changed" since the publish, the "same" as published, "on" the shop but not compared (a page
 * of the shop: its change list is laid into Magento's own content), or "none" (never written there).
 */
export function pageRows(views: readonly PubVersion[], records: readonly WrittenRecord[]): PageRow[] {
  const live: Record<ShopEnv, LivePage[]> = { acc: liveOn(records, "acc"), prod: liveOn(records, "prod") };
  return views.map((v) => {
    const stores = storesOfRow(v);
    const envs = {} as Record<ShopEnv, RowEnv>;
    for (const env of ENVS_SHOWN) {
      const pages = live[env].filter((p) => stores.includes(p.store));
      const since = v.since?.[env];
      const state: RowState = since ? (since.changed ? "changed" : "same") : pages.length ? "on" : "none";
      const at = since?.at ?? (pages.map((p) => p.at).sort().at(-1) ?? null);
      envs[env] = { env, pages, state, at };
    }
    return { view: v.view, label: v.label ?? v.view, stores, writable: v.cms && !v.why && !v.blocked, envs };
  });
}

/** What one "Update all" button writes on a shop: the versions, their store views, its words - or why it cannot. */
export type UpdateAll = { env: ShopEnv; views: string[]; pages: number; storeViews: number; verb: "Update" | "Publish"; label: string; why: string | null };

/**
 * "Update all on ACC (n pages)": every version that changed since its publish there - or, `all` ticked, every version that
 * can be written (the ones never written there too). Production is refused until the page is on ACC (`accLive`), as the
 * server refuses it; `held` is what holds every write (the review, the grant, the key, the pictures), said instead.
 */
export function updateAllOf(rows: readonly PageRow[], env: ShopEnv, opts: { all: boolean; accLive: boolean; held?: string | null }): UpdateAll {
  const can = rows.filter((r) => r.writable);
  const pick = opts.all ? can : can.filter((r) => r.envs[env].state === "changed");
  const fresh = pick.length > 0 && pick.every((r) => r.envs[env].state === "none");
  const verb: UpdateAll["verb"] = fresh ? "Publish" : "Update";
  const n = pick.length;
  const shop = SHOP_LABEL[env];
  const label = `${verb} all on ${shop}${n ? ` (${n} page${n === 1 ? "" : "s"})` : ""}`;
  const onShop = can.some((r) => r.envs[env].state !== "none");
  const why = env === "prod" && !opts.accLive ? ACC_FIRST
    : opts.held ? opts.held
      : !can.length ? "No page can be written - see Where it goes."
        : !n ? (onShop ? `Nothing changed since the publish on ${shop} - tick "all" to write every page again.` : `Not on ${shop} yet - tick "all" to publish every page.`)
          : null;
  return { env, views: pick.map((r) => r.view), pages: n, storeViews: pick.reduce((s, r) => s + r.stores.length, 0), verb, label, why };
}

/** The line a version's state says on one shop. */
export function stateLine(e: RowEnv, when: (iso: string) => string): string {
  const at = e.at ? when(e.at) : "";
  if (e.state === "changed") return `changed since the publish${at ? ` (${at})` : ""}`;
  if (e.state === "same") return `as published${at ? ` · ${at}` : ""}`;
  if (e.state === "on") return `on the shop${at ? ` since ${at}` : ""}`;
  return "not published here";
}

/** "Writing German into ACC · 2 of 6" - the one progress line of an "Update all". */
export const progressLine = (label: string, shop: string, i: number, n: number) => `Writing ${label} into ${shop} · ${i} of ${n}…`;

/* ── the page's A/B tests (Website > A/B testing > Page tests, src/lib/convert/tests.ts) ── */

/** A test as GET /api/website/ab-testing/pages lists it - only what is read here. `piece`: the to-do it was made from,
 * once the app records it (until then a test is the page's when it runs on one of the page's addresses). */
export type AbTestLite = { id: string; env: ShopEnv; pages: string[]; status: "draft" | "running" | "paused" | "stopped" | "shipped"; updatedAt?: string; piece?: number | string | null };

/** The page's tests: made from this to-do, or on one of its published addresses on that test's shop. */
export function testsOfPage<T extends AbTestLite>(tests: readonly T[], records: readonly WrittenRecord[], pieceId: number | string): T[] {
  const paths: Record<ShopEnv, Set<string>> = { acc: new Set(liveOn(records, "acc").map((p) => p.path)), prod: new Set(liveOn(records, "prod").map((p) => p.path)) };
  return tests.filter((t) => (t.piece != null && String(t.piece) === String(pieceId)) || (paths[t.env]?.size && t.pages.some((p) => paths[t.env].has(pathOf(p)))));
}

/** A published store view and its A/B state on one shop: the test that holds it (live first, then a draft, then the
 * newest ended one), or none. */
export type AbRow = { env: ShopEnv; store: string; path: string; url: string; test: AbTestLite | null };
const RANK: Record<AbTestLite["status"], number> = { running: 0, paused: 1, draft: 2, stopped: 3, shipped: 4 };
export function abRows<T extends AbTestLite>(records: readonly WrittenRecord[], tests: readonly T[]): (AbRow & { test: T | null })[] {
  const out: (AbRow & { test: T | null })[] = [];
  for (const env of ENVS_SHOWN) {
    for (const p of liveOn(records, env)) {
      const mine = tests.filter((t) => t.env === env && t.pages.some((x) => pathOf(x) === p.path))
        .sort((a, b) => RANK[a.status] - RANK[b.status] || String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")));
      out.push({ env, store: p.store, path: p.path, url: p.url, test: mine[0] ?? null });
    }
  }
  return out;
}

/** What a person may do with a test from here: start a draft, pause or stop a live one, resume a paused one. Starting and
 * resuming put the version on the shop - always confirmed, never by itself. */
export type AbAction = "start" | "pause" | "resume" | "stop";
export function abActionsOf(status: AbTestLite["status"]): AbAction[] {
  return status === "draft" ? ["start"] : status === "running" ? ["pause", "stop"] : status === "paused" ? ["resume", "stop"] : [];
}

/* ── a test made from this page (AI testing & personalization's version from the Page builder's own changes) ── */

/**
 * ONE flag: "Create a test from this page" and the page's tests read by its to-do (GET ?piece=). Off until AI testing &
 * personalization's release with POST /api/website/ai-personalization/work {action:"version"} and tests' `piece` is live
 * (hubspot-orders-cf, 11.11.2026, commit 42c2eb51 on feat/apsoconvert-night) - until then the tests are matched on the
 * page's published addresses and the button says it comes with that release.
 */
// ON since AI testing & personalization's 6b387678 (with 42c2eb51) is live (SARCLA 11.11.2026: "control it from here")
export const AB_FROM_PAGE = true;
export const AB_FROM_PAGE_WAIT = "Comes with the next A/B testing release";

/** A change of the page (lib/convert/versions.ts Change, with the studio's id/module/off) - only what is read here. */
export type ChangeLite = { op: string; selector?: string; where?: string; html?: string; text?: string; css?: string; name?: string; value?: string; all?: boolean; note?: string; id?: string; module?: unknown; off?: string };
const keyOf = (c: ChangeLite) => JSON.stringify([c.op, c.selector ?? "", c.where ?? "", c.html ?? "", c.text ?? "", c.css ?? "", c.name ?? "", c.value ?? "", !!c.all]);
/** A change as the test's version takes it: the shop's change alone (the studio's id, module and check left here). */
export function plainChange(c: ChangeLite): ChangeLite {
  const { id: _i, module: _m, off: _o, ...rest } = c;
  return rest;
}

/**
 * The variant's changes: the version picked (B ...) laid over the page as it is on the shop - which already carries the
 * version published (A, written into Magento). A change both have is already live, so it is left out (else an "insert"
 * would stand twice); a change the studio's check kept off is left out as it is from the preview and from Magento.
 */
export function variantChanges(live: readonly ChangeLite[], variant: readonly ChangeLite[]): ChangeLite[] {
  const there = new Set(live.filter((c) => !c.off).map(keyOf));
  return variant.filter((c) => !c.off && !there.has(keyOf(c))).map(plainChange);
}

/** A change in a few words, for the person to pick it ("Added before .hero", "New text in h1"). */
export function changeWords(c: ChangeLite): string {
  const at = c.selector ? ` ${c.op === "insert" ? `${c.where ?? "after"} ` : "in "}${c.selector}` : "";
  const what = ({ css: "Style", html: "New content", replace: "Replaced", insert: "Added", text: "New text", hide: "Hidden", attr: "Changed" } as Record<string, string>)[c.op] ?? c.op;
  return `${what}${at}${c.note ? ` - ${c.note}` : ""}`;
}

/* ── a write refused (Content v14b, SARCLA 11.11.2026, 15:35: production's "Update all" said "Magento answered 403:
 *    <!doctype html>…" for en-INT, it-CH, nl-NL and pl-PL while de-CH and fr-CH were created) ── */

/** A refusal in plain words: an HTML page Magento's address answered with is said by its title and its HTTP status (an
 * older message that kept the page's first characters, whose title was cut, says that it was an HTML page). */
export function readableError(error: string | null | undefined): { text: string; status: number | null; html: boolean } {
  const e = String(error ?? "").trim();
  const status = Number(/answered (\d{3})/.exec(e)?.[1] ?? "") || null;
  const at = e.search(/<!doctype\s+html|<html[\s>]|<head[\s>]|<body[\s>]/i);
  if (at < 0) return { text: e || "Not written.", status, html: /an HTML page/.test(e) };
  const head = e.slice(0, at).replace(/[:\s]+$/, "");
  const rest = e.slice(at);
  const said = isHtmlAnswer(rest) && /<title/i.test(rest) && /<\/title>/i.test(rest) ? answerSaid(rest) : "an HTML page instead of Magento's API answer (its title was cut off)";
  return { text: `${head || "Magento answered"}${status && !head ? ` ${status}` : ""}: ${said}`, status, html: true };
}

/** The pages to write again after a run: each failed result's page - a version by its key, a store view of a page of the
 * shop by the version it belongs to - once each, in the rows' order; a failure of the whole call (no view) is not one. */
export function retryViews(results: readonly { view: string; ok: boolean }[], rows: readonly Pick<PageRow, "view" | "stores">[]): string[] {
  const failed = new Set<string>();
  for (const r of results) {
    if (r.ok || !r.view) continue;
    const row = rows.find((x) => x.view === r.view) ?? rows.find((x) => x.stores.includes(r.view));
    if (row) failed.add(row.view);
  }
  // a page that failed in one store view and was written in another (a page of the shop) is written again whole
  return rows.map((r) => r.view).filter((v) => failed.has(v));
}
