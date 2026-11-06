// CERTIFICATES - the ERP's side, read and followed (the rules in erpRules.ts).
//
// The requests: the Compass chain's order_sync reads the ERP's order file (dim_order, every order) and hands each row
// to requestCollector(); the orders whose internal comment asks for a Declaration of Conformity are kept in kv
// certificates:erpRequests by A-number (the last 200 days).
// The delivery dates (SARCLA 06.11.2026, "update the date as it goes"): for each open certificate ticket the HubSpot
// records of its ERP order (the chain keeps order_shipment_date on each delivery), read again every 30 minutes; when the
// ERP's date differs from the ticket's, the hub writes it (Console: Show only / Write), changes the date in the subject,
// leaves a note - and the steps go by the new date in the same look.

import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { articlesIn, baseOf, dateCheck, parseRequests, subjectWithDate, type Delivery, type ErpRequest } from "./erpRules";
import type { Facts } from "./rules";

type Obj = { id: string; properties: Record<string, string | null>; propertiesWithHistory?: Record<string, { value: string; timestamp: string }[]> };
const hs = <T>(path: string, method: "GET" | "POST" | "PATCH" = "GET", body?: unknown) => hubspotRetry<T>({ path, method, body });
const KV = { requests: "certificates:erpRequests", dates: "certificates:erpDates", dateRows: "certificates:dateRows" };

// ---------------- the ERP's requests ----------------
export type ErpRequests = Record<string, { reqs: ErpRequest[]; seen: string }>;

/** One per order_sync run: give it each row of the ERP's order file, then saveErpRequests(found). */
export function requestCollector(minYear: number) {
  const found = new Map<string, ErpRequest[]>();
  return {
    found,
    row(orderNumber: string, year: string, comment: string) {
      if (!comment || !(Number(year) >= minYear) || !/Konformit/i.test(comment)) return;
      const base = baseOf(orderNumber);
      if (!base) return;
      const reqs = parseRequests(comment);
      if (!reqs.length) return;
      const cur = found.get(base) ?? [];
      for (const r of reqs) if (!cur.some((x) => x.pos === r.pos && x.type === r.type)) cur.push(r);
      found.set(base, cur);
    },
  };
}
export async function saveErpRequests(found: Map<string, ErpRequest[]>): Promise<number> {
  const cur = (await kvGet<ErpRequests>(KV.requests)) ?? {};
  const now = new Date().toISOString();
  for (const [a, reqs] of found) cur[a] = { reqs, seen: now };
  const keep = Date.now() - 200 * 86400_000;
  for (const [a, v] of Object.entries(cur)) if (!(Date.parse(v.seen) >= keep)) delete cur[a];
  await kvSet(KV.requests, cur);
  return found.size;
}
export const erpRequests = async (): Promise<ErpRequests> => (await kvGet<ErpRequests>(KV.requests)) ?? {};

// ---------------- the ERP's records of an order ----------------
const LINE_PROPS = Array.from({ length: 30 }, (_, i) => `order_line_${String(i + 1).padStart(2, "0")}_article`);
const day = (v: string | null | undefined): string | null => (!v ? null : /^\d+$/.test(v) ? new Date(Number(v)).toISOString().slice(0, 10) : v.slice(0, 10));

/** Every HubSpot record of these ERP orders (A26.x.000, .001 ...): the date, the status, the date's history, the lines. */
export async function deliveriesOf(bases: string[]): Promise<Map<string, Delivery[]>> {
  const out = new Map<string, Delivery[]>(bases.map((a) => [a, []]));
  for (let i = 0; i < bases.length; i += 5) {
    const chunk = bases.slice(i, i + 5);
    const j = await hs<{ results?: Obj[] }>("/crm/v3/objects/orders/search", "POST", {
      filterGroups: chunk.map((a) => ({ filters: [{ propertyName: "order_order_number", operator: "CONTAINS_TOKEN", value: `${a}*` }] })),
      properties: ["order_order_number"], limit: 100,
    });
    const ids = (j.results ?? []).filter((o) => chunk.includes(baseOf(o.properties.order_order_number) ?? "")).map((o) => String(o.id));
    for (let k = 0; k < ids.length; k += 50) {
      const b = await hs<{ results?: Obj[] }>("/crm/v3/objects/orders/batch/read", "POST", {
        inputs: ids.slice(k, k + 50).map((id) => ({ id })), properties: ["order_order_number", "order_shipment_date", "order_order_status", ...LINE_PROPS], propertiesWithHistory: ["order_shipment_date"],
      });
      for (const o of b.results ?? []) {
        const p = o.properties;
        const a = baseOf(p.order_order_number);
        if (!a || !out.has(a)) continue;
        const hist = o.propertiesWithHistory?.order_shipment_date ?? [];
        const stamps = hist.map((h) => Date.parse(h.timestamp)).filter((x) => !Number.isNaN(x));
        out.get(a)!.push({
          num: String(p.order_order_number).trim(), ship: day(p.order_shipment_date), status: p.order_order_status || null,
          history: [...new Set(hist.map((h) => day(h.value)).filter((x): x is string => !!x))],
          lines: LINE_PROPS.map((k) => (p[k] ?? "").trim()).filter(Boolean),
          changedAt: stamps.length ? Math.max(...stamps) : null,
        });
      }
    }
  }
  for (const v of out.values()) v.sort((x, y) => x.num.localeCompare(y.num));
  return out;
}

// ---------------- following the date ----------------
export type DateMode = "off" | "show" | "write";
type Mem = { a: string; readAt?: string; ds?: Delivery[]; listed?: string };
/** One date the hub wrote (or, in Show only, would write). */
export type DateRow = {
  at: string; ticketId: string; subject: string | null; order: string; from: string | null; to: string; delivery: string; shipped: boolean;
  what: "done" | "would" | "failed"; error?: string;
};
/** What the page shows per ticket. */
export type DateInfo = { date: string; delivery: string; shipped: boolean; state: "same" | "would" | "moved" | "kept"; why: string };
const READ_EVERY_MS = 30 * 60_000;
const READ_PER_LOOK = 15;
const ROWS_KEPT = 300;
const short = (x: string | null) => (x ? x.slice(0, 10).split("-").reverse().map((s, i) => (i === 2 ? s.slice(2) : s)).join(".") : "no date");

/**
 * Each open ticket's date against the ERP's. Write (and the certificates Live and writing): the new date, the subject's
 * date, a note - and `facts` carries the new date for this look's steps. Show only: listed once per new date.
 */
export async function datePass(facts: Facts[], mode: DateMode, writing: boolean): Promise<{ info: Map<string, DateInfo>; rows: DateRow[]; error?: string }> {
  const info = new Map<string, DateInfo>();
  const rows: DateRow[] = [];
  if (mode === "off") return { info, rows };
  const mem = (await kvGet<Record<string, Mem>>(KV.dates)) ?? {};
  const now = Date.now();
  const mine = facts.map((f) => ({ f, a: baseOf(f.order) })).filter((x): x is { f: Facts; a: string } => !!x.a);
  let error: string | undefined;
  // read again what is older than 30 minutes, the oldest first - a few per look
  const stale = mine.filter(({ f, a }) => mem[f.id]?.a !== a || !mem[f.id]?.readAt || now - Date.parse(mem[f.id]!.readAt!) > READ_EVERY_MS)
    .sort((x, y) => (mem[x.f.id]?.readAt ?? "").localeCompare(mem[y.f.id]?.readAt ?? "")).slice(0, READ_PER_LOOK);
  if (stale.length) {
    try {
      const got = await deliveriesOf([...new Set(stale.map((x) => x.a))]);
      for (const { f, a } of stale) mem[f.id] = { ...(mem[f.id]?.a === a ? mem[f.id] : {}), a, readAt: new Date().toISOString(), ds: got.get(a) ?? [] };
    } catch (e) { error = (e as Error).message.slice(0, 200); }
  }
  for (const { f, a } of mine) {
    const m = mem[f.id];
    if (!m?.ds || m.a !== a) continue;
    const chk = dateCheck(f.due, f.dueAt ?? null, articlesIn(f.articles), m.ds);
    if (!chk.erp) continue;
    const base = { date: chk.erp.date, delivery: chk.erp.delivery, shipped: chk.erp.shipped };
    if (!chk.move) { info.set(f.id, { ...base, state: chk.why.startsWith("the ticket's date was written after") ? "kept" : "same", why: chk.why }); continue; }
    const row: DateRow = { at: new Date().toISOString(), ticketId: f.id, subject: f.subject, order: a, from: chk.move.from, to: chk.move.to, delivery: chk.erp.delivery, shipped: chk.erp.shipped, what: "would" };
    if (mode === "write" && writing) {
      const subject = subjectWithDate(f.subject, chk.move.from, chk.move.to);
      try {
        await hs(`/crm/v3/objects/tickets/${f.id}`, "PATCH", { properties: { delivery_date_for_certificate: chk.move.to, ...(subject ? { subject } : {}) } });
        await hs("/crm/v3/objects/notes", "POST", {
          properties: {
            hs_timestamp: new Date().toISOString(),
            hs_note_body: `<p>Delivery date for the certificate: ${short(chk.move.from)} → ${short(chk.move.to)} - the ERP's date for ${esc(chk.erp.delivery)}${chk.erp.shipped ? " (the goods have left)" : ""}.</p><p>APSOhub - Certificates</p>`,
          },
          associations: [{ to: { id: f.id }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 228 }] }],
        }).catch(() => null);
        f.due = chk.move.to;
        f.dueAt = Date.now();
        if (subject) f.subject = subject;
        row.what = "done";
        info.set(f.id, { ...base, state: "moved", why: chk.why });
      } catch (e) {
        row.what = "failed"; row.error = (e as Error).message.slice(0, 200);
        info.set(f.id, { ...base, state: "would", why: chk.why });
      }
      rows.push(row);
    } else {
      info.set(f.id, { ...base, state: "would", why: chk.why });
      if (m.listed !== chk.move.to) { rows.push(row); mem[f.id] = { ...m, listed: chk.move.to }; }
    }
  }
  // only the open tickets are remembered
  const open = new Set(mine.map((x) => x.f.id));
  for (const id of Object.keys(mem)) if (!open.has(id)) delete mem[id];
  await kvSet(KV.dates, mem);
  if (rows.length) await kvSet(KV.dateRows, [...rows, ...((await kvGet<DateRow[]>(KV.dateRows)) ?? [])].slice(0, ROWS_KEPT));
  return { info, rows, error };
}
export const dateRows = async (): Promise<DateRow[]> => (await kvGet<DateRow[]>(KV.dateRows)) ?? [];

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
