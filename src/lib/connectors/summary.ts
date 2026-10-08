// A STEP'S RESULT IN PLAIN WORDS - "3 to change · 56,086 companies checked"
// instead of the raw counters ("seconds 276"). The same reading for the
// connector's results and the hub's: the ports report the connector's own names.
// Kept pure (no imports) so the pages and the tests share it.

type Obj = Record<string, unknown>;

/** What a run wrote, most telling first. */
const DONE: [string, string][] = [
  ["created", "created"],
  ["stamped", "web orders stamped"],
  ["stage_updates", "stages moved"],
  ["companies_changed", "companies changed"],
  ["written", "written"],
  ["updated", "updated"],
  ["enriched", "filled in"],
  ["moved", "tickets redirected"],
  ["flagged", "tickets flagged"],
  ["restored", "tickets restored"],
  ["contacts_associated", "contacts linked"],
  ["company_mismatch_fixed", "companies corrected"],
  ["archived", "archived"],
];

/** What a test run found to do - or a live run planned before writing. */
const TODO: [string, string][] = [
  ["to_fix", "to fix"],
  ["to_create", "to create"],
  ["would_create", "to create"],
  ["to_update", "to change"],
  ["would_update", "to change"],
  ["planned", "to change"],
  ["to_enrich", "to fill in"],
  ["would_archive", "to archive"],
];

/** What it looked at - said after the result, so "nothing to change" has a size. */
const SCOPE: [string, string][] = [
  ["companies_with_a_key", "companies checked"],
  ["companies_read", "companies read"],
  ["orders_in_snapshot", "orders checked"],
  ["export_rows", "web orders in the export"],
  ["articles_in_file", "articles in the file"],
  ["erp_orders", "orders in the file"],
  ["targets", "orders in the file"],
  ["orders_in_delta", "orders in the file"],
  ["customers", "customers in the file"],
  ["scanned", "tickets checked"],
  ["tickets_open_or_flagged", "tickets checked"],
  ["orders_shipped", "orders shipped"],
  ["contacts", "contacts"],
  ["companies", "companies"],
  ["rows", "rows read"],
];

const FAILED = ["failed", "errors", "stamp_failed", "contact_assoc_failed", "company_assocs_failed"];

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const fmt = (n: number) => Math.round(n).toLocaleString("en-US"); // as the hub's full()
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

/** Sum a list's counters over the result and the objects inside it (the KPI steps report per series). */
function totals(r: Obj, list: [string, string][], depth = 0): Map<string, number> {
  const out = new Map<string, number>();
  for (const [k, label] of list) {
    const n = num(r[k]);
    if (n !== null) out.set(label, (out.get(label) ?? 0) + n);
  }
  if (out.size || depth >= 2) return out;
  for (const v of Object.values(r)) {
    if (!isObj(v)) continue;
    for (const [label, n] of totals(v, list, depth + 1)) out.set(label, (out.get(label) ?? 0) + n);
  }
  return out;
}

const GENERIC = new Set(["written", "updated"]);

/** The two biggest news; a generic "updated" only when nothing more specific says it. */
function phrase(m: Map<string, number>, max = 2): string {
  let hits = [...m].filter(([, n]) => n > 0);
  if (hits.some(([l]) => !GENERIC.has(l) && l !== "created" && l !== "archived")) hits = hits.filter(([l]) => !GENERIC.has(l));
  return hits.slice(0, max).map(([label, n]) => `${fmt(n)} ${label}`).join(" · ");
}

/**
 * One line for a step's result. `live` = a run that writes (the connector's runs,
 * the hub's live runs); otherwise a test run that only reports what it would do.
 */
export function summarize(r: Obj | null | undefined, live: boolean): string {
  if (!r) return "No result";
  if (typeof r.skipped === "string") return `Skipped - ${r.skipped}`;
  const done = totals(r, DONE);
  const todo = totals(r, TODO);
  const scopeHit = SCOPE.find(([k]) => (num(r[k]) ?? 0) > 0);
  const scope = scopeHit ? `${fmt(num(r[scopeHit[0]])!)} ${scopeHit[1]}` : "";
  const failed = FAILED.reduce((a, k) => a + (num(r[k]) ?? 0), 0);

  let main = "";
  if (live && phrase(done)) main = phrase(done);
  else if (phrase(todo)) main = live ? `${phrase(todo)} (not written)` : phrase(todo);
  else if (done.size || todo.size) main = "Nothing to change";
  const parts = [main || (scope ? "" : "Done"), scope, failed ? `${fmt(failed)} failed` : ""].filter(Boolean);
  return parts.join(" · ");
}

/** "orders_in_snapshot" -> "orders in snapshot", for counters no list above names. */
export const humanize = (k: string) => k.replace(/_/g, " ").replace(/\bpp\b/g, "Products & Pricing").replace(/\bhs\b/g, "HubSpot");

/** An example row from a test run, readable: "contact 123: (empty) → 2026-10-01". */
export function exampleLine(e: unknown): string {
  if (!isObj(e)) return String(e);
  const show = (v: unknown) => (v === "" || v === null || v === undefined ? "(empty)" : typeof v === "object" ? JSON.stringify(v) : String(v));
  const rest = Object.entries(e).filter(([k]) => k !== "was" && k !== "now").map(([k, v]) => `${humanize(k)} ${show(v)}`).join(" · ");
  if ("was" in e || "now" in e) return `${rest}${rest ? ": " : ""}${show(e.was)} → ${show(e.now)}`;
  return rest;
}
