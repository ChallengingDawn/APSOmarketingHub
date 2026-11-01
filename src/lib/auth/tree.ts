// THE ACCESS TREE - every app and, beneath it, every sub-app its menu lists.
//
// SARCLA, 01.11.2026: "rework hierarchy settings because we have to have more roles and sub hierarchy that needs to
// be updated at each new sub app". So the tree is not written out here: it is READ from the two lists the menus draw -
// the apps' sub-apps (src/app/hubApps.ts) and Advanced reporting's categories (src/lib/reporting/categories.ts). A
// sub-app added to either is in Settings > People, and under the guard, the moment it is in the menu.
//
// A grant sits on any node: an app, a heading (Microservices, a connector, Other reports), a report category, a page.
// A node without one takes its parent's; an app without one takes the role's default (access.ts roleDefault). A page
// opens at the level of the most specific node that lists it - and when two menus list the same page (Articles CY/LY
// is Products Reports' and lives at UC's address), at the better of the two.
//
// Keys, as stored in apsomh_user_app_access.app_key: an app's own key ("uc"), "<app>:<address>" for a page
// ("uc:/uc/map-assignment"), "<parent>#<heading>" for a heading. An address that moves keeps no grant - its page then
// takes its parent's, which is never more than the parent gave.
//
// Pure, no database: the guard, the side panel and Settings read the same answer.

import { APPS } from "../../app/hubApps"; // relative: the unit tests compile this file
import { REPORT_CATEGORIES } from "../reporting/categories";
import { APP_KEYS, appForPath, roleDefault, type AppKey, type Level, type Role } from "./access";

export type AccessNode = {
  key: string;
  name: string;
  app: AppKey;
  parent: string | null;
  depth: number;
  /** The addresses it answers for; `exact`: that page alone, not the pages beneath it (a page borrowed from another app). */
  paths: { p: string; exact: boolean }[];
  /** A heading in the menu, not a page: it answers for no address, its pages beneath it do. */
  heading?: boolean;
};

export type Grants = Record<string, Level>;

const RANK: Record<Level, number> = { none: 0, read: 1, write: 2 };
const better = (a: Level, b: Level): Level => (RANK[a] >= RANK[b] ? a : b);

/** An href as an address: no query, no tab, no trailing slash. */
export const addressOf = (href: string) => href.split(/[?#]/)[0].replace(/(.)\/+$/, "$1");

function build(): AccessNode[] {
  const nodes: AccessNode[] = [];
  const keys = new Set<string>();
  const add = (n: AccessNode) => {
    if (keys.has(n.key)) return false;
    keys.add(n.key);
    nodes.push(n);
    return true;
  };
  const at = (app: AppKey, p: string) => ({ p, exact: appForPath(p) !== app });
  const headingOf = (app: AppKey, parent: string, depth: number, group: string) => {
    const key = `${parent}#${group}`;
    add({ key, name: group, app, parent, depth, paths: [], heading: true });
    return key;
  };
  // pages under a parent, a heading per group, in the menu's order
  const pages = (app: AppKey, parent: string, depth: number, items: { name: string; href: string; group?: string }[], skip: Set<string>) => {
    for (const it of items) {
      // a tab of a page (the Datatracker's #articles) is that page: it cannot be opened without it
      if (it.href.includes("#")) continue;
      const p = addressOf(it.href);
      if (skip.has(p)) continue;
      const under = it.group ? headingOf(app, parent, depth, it.group) : parent;
      add({ key: `${app}:${p}`, name: it.name, app, parent: under, depth: it.group ? depth + 1 : depth, paths: [at(app, p)] });
    }
  };

  for (const a of APPS) {
    if (!(APP_KEYS as readonly string[]).includes(a.key)) continue;
    const app = a.key as AppKey;
    // the app answers for its own addresses (access.ts ROUTES) - including the page it opens on, which is the app itself
    add({ key: app, name: a.name, app, parent: null, depth: 0, paths: [] });
    if (app !== "reporting") {
      pages(app, app, 1, a.subs, new Set([addressOf(a.href)]));
      continue;
    }
    // Advanced reporting: a category per team, its report's pages beneath it - the side panel's own tree
    for (const c of REPORT_CATEGORIES) {
      const key = `reporting:/reporting/${c.slug}`;
      const own = new Set([`/reporting/${c.slug}`]);
      const single = c.reports.length === 1 ? c.reports[0] : null;
      const kids = single?.children ?? [];
      if (single) {
        // the report's overview, and the report itself when it is not one of its own pages, are the category's
        for (const h of [single.overviewHref, single.href]) {
          if (h && !kids.some((k) => addressOf(k.href) === addressOf(h))) own.add(addressOf(h));
        }
      }
      add({ key, name: c.name, app, parent: "reporting", depth: 1, paths: [...own].map((p) => at(app, p)) });
      if (single) pages(app, key, 2, kids, own);
      else {
        for (const r of c.reports) {
          const p = addressOf(r.overviewHref ?? r.href);
          const rk = `reporting:${p}`;
          const rKids = r.children ?? [];
          const rOwn = new Set([p, addressOf(r.href)].filter((h) => !rKids.some((k) => addressOf(k.href) === h)));
          add({ key: rk, name: r.name, app, parent: key, depth: 2, paths: [...rOwn].map((q) => at(app, q)) });
          pages(app, rk, 3, rKids, rOwn);
        }
      }
    }
  }
  return nodes;
}

/** Every node, each parent before its children, in the menus' order. */
export const ACCESS_TREE: AccessNode[] = build();

const BY_KEY = new Map(ACCESS_TREE.map((n) => [n.key, n]));
export const nodeByKey = (key: string) => BY_KEY.get(key) ?? null;
export const isNodeKey = (key: string) => BY_KEY.has(key);
export const childrenOf = (key: string | null) => ACCESS_TREE.filter((n) => n.parent === key);

/** What each node comes to for this person: their grant, else their parent's, else the role's - within the role. */
export function levelsOf(role: Role, grants: Grants): Record<string, Level> {
  const out: Record<string, Level> = {};
  for (const n of ACCESS_TREE) {
    if (role === "admin") { out[n.key] = "write"; continue; }
    let l: Level = grants[n.key] ?? (n.parent ? out[n.parent] : roleDefault(role));
    // a sales leader views everything not taken from them, and edits only the Advanced reports given to them
    // (SARCLA 01.11.2026: "i can't deny one of the reports - that's the point")
    if (role === "sales_leader" && n.app !== "reporting" && l === "write") l = "read";
    out[n.key] = l;
  }
  return out;
}

/**
 * The node of this app's tree that answers for a page: the most specific one listing it, else the app itself when the
 * page is at one of its addresses, else none (the app does not list it).
 */
export function nodeFor(app: AppKey, path: string): AccessNode | null {
  const p = addressOf(path);
  let hit: { n: AccessNode; len: number } | null = null;
  for (const n of ACCESS_TREE) {
    if (n.app !== app) continue;
    for (const q of n.paths) {
      if (p === q.p || (!q.exact && p.startsWith(`${q.p}/`))) {
        if (!hit || q.p.length > hit.len || (q.p.length === hit.len && n.depth > hit.n.depth)) hit = { n, len: q.p.length };
      }
    }
  }
  if (hit) return hit.n;
  return appForPath(p) === app ? (BY_KEY.get(app) ?? null) : null;
}

/** An API's address read as the page it serves: /api/uc/map-assignment answers to /uc/map-assignment. */
export const pageOfRequest = (path: string) => (path.startsWith("/api/") ? path.slice(4) : path);

export type PathAccess = {
  /** The level the page opens at. */
  level: Level;
  /** Did a sub-app answer (true), or only an app's own address (false)? Nothing listed it at all: null. */
  specific: boolean | null;
};

/** How far this person may go on this page: the best of every tree that lists it. */
export function accessAt(path: string, levels: Record<string, Level>): PathAccess {
  const p = addressOf(pageOfRequest(path));
  let level: Level = "none";
  let specific: boolean | null = null;
  for (const app of APP_KEYS) {
    const n = nodeFor(app, p);
    if (!n) continue;
    const isSub = n.parent !== null;
    specific = specific || isSub;
    level = better(level, levels[n.key] ?? "none");
  }
  return { level, specific };
}

/** May the person open anything at all in this app - its front page, one sub-app? What an app's tile asks. */
export function appOpen(app: AppKey, levels: Record<string, Level>): boolean {
  return ACCESS_TREE.some((n) => n.app === app && (levels[n.key] ?? "none") !== "none");
}

/**
 * What an app's APIs ask when no sub-app answers for them: anything open in the app, or a report of Advanced
 * reporting that lives at this app's address (Use Cases Overview, Articles CY/LY, the Website reports) - its page
 * reads its data from here. A report, not a Datatracker tab: Price checks opens its page and nothing of UC's.
 */
export function appReachable(app: AppKey, levels: Record<string, Level>): boolean {
  return appOpen(app, levels) || ACCESS_TREE.some((n) =>
    n.app === "reporting" && n.app !== app && (levels[n.key] ?? "none") !== "none" && n.paths.some((q) => q.exact && appForPath(q.p) === app));
}

/** The first page of an app this person may open, in the menu's order - where its tile leads when its front page is not theirs. */
export function firstOpenPage(app: AppKey, levels: Record<string, Level>): string | null {
  if ((levels[app] ?? "none") !== "none") return null;
  for (const n of ACCESS_TREE) {
    if (n.app !== app || n.heading || n.parent === null || (levels[n.key] ?? "none") === "none") continue;
    const p = n.paths[0]?.p;
    if (p) return p;
  }
  return null;
}

/**
 * The page of Advanced reporting a tile or a view belongs to, from the key its page gives it ("eso-new-customers",
 * "tsa-calls", "reach", "nutshell:eso-shop") - so editing it asks for edit on that report, not on all of them
 * (SARCLA 01.11.2026: a sales leader "can be editor on certain advanced reports but not all").
 */
export function reportPathOfPage(page: string | null | undefined): string | null {
  if (!page) return null;
  const k = page.replace(/^nutshell:/, "").split(":")[0];
  const team = /^(eso|tsa)-(.+)$/.exec(k);
  if (team) return `/reporting/${team[1]}-benchmark/${team[2]}`;
  // Digital Growth's own: its BUC View, its stage pages
  if (k === "nutshell") return "/reporting/marketing-kpis";
  if (/^[a-z-]+$/.test(k)) return `/reporting/marketing-kpis/${k}`;
  return null;
}
