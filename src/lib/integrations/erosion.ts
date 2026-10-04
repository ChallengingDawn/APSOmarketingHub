// EROSION ON ARTICLE LEVEL - where the two halves come from.
//
// The tickets are read straight out of HubSpot: every ticket that carries an
// `erosion_key`, with its live stage, owner and resolution. That needs
// crm.objects.tickets.read on the hub's private app (or TICKETS_TOKEN).
//
// The FORECAST is not in HubSpot. The detector computes it on the Compass
// connector, from last year's invoiced orders, and keeps it there; it is read
// with the connector's read-only key. Either half can fail without taking the
// other with it.

import { hubspotFetchJson } from "./hubspot";
import { IntegrationError, connectorReadKey, connectorUrl } from "./status";
import {
  TICKET_PROPERTIES, isClosed, mapTicket, noteText, parseForecast,
  type ErosionForecast, type ErosionTickets, type StageInfo,
} from "../erosion/model";
import { ESO_OWNERS, TSA_OWNERS } from "../datatracker/rosters";

/* ── tickets ──────────────────────────────────────────────────────────── */

const TICKETS_TTL_MS = 5 * 60_000;
/** HubSpot search stops at 10,000 results - 100 pages of 100. */
const MAX_PAGES = 100;
/** Closing notes are read for the most recent closed tickets only, as the connector did. */
const NOTE_TICKETS = 25;

let ticketsCache: { at: number; p: Promise<ErosionTickets> } | null = null;

type SearchPage = {
  results?: { id: string; properties?: Record<string, unknown> }[];
  paging?: { next?: { after?: string } };
};

async function ticketStages(signal?: AbortSignal): Promise<Map<string, StageInfo>> {
  const res = await hubspotFetchJson<{
    results?: { label?: string; stages?: { id: string; label?: string; metadata?: { isClosed?: unknown } }[] }[];
  }>({ path: "/crm/v3/pipelines/tickets", useTicketsToken: true, signal });
  const out = new Map<string, StageInfo>();
  for (const p of res.results ?? []) {
    for (const s of p.stages ?? []) {
      const closed = s.metadata?.isClosed;
      out.set(s.id, { label: s.label ?? s.id, pipeline: p.label ?? "", closed: closed === true || closed === "true" });
    }
  }
  return out;
}

let ownersCache: { at: number; map: Map<string, string> } | null = null;

/**
 * Owner id -> name, active AND archived, paged to the end - an unpaged read
 * drops whoever was added last, and a rep who has left still owns tickets.
 * Only asked for when a ticket's owner is on neither roster. A failure here is
 * a raw id in one cell, not an error page.
 */
export async function ownerNames(signal?: AbortSignal): Promise<Map<string, string>> {
  if (ownersCache && Date.now() - ownersCache.at < 60 * 60_000) return ownersCache.map;
  const map = new Map<string, string>();
  try {
    for (const archived of ["false", "true"]) {
      let after: string | undefined;
      for (let page = 0; page < 50; page++) {
        const res = await hubspotFetchJson<{
          results?: { id: string; userId?: number; firstName?: string; lastName?: string; email?: string }[];
          paging?: { next?: { after?: string } };
        }>({ path: `/crm/v3/owners?limit=100&archived=${archived}${after ? `&after=${after}` : ""}`, signal });
        for (const o of res.results ?? []) {
          const name = `${o.firstName ?? ""} ${o.lastName ?? ""}`.trim() || o.email || o.id;
          map.set(String(o.id), name);
          if (o.userId) map.set(String(o.userId), name);
        }
        after = res.paging?.next?.after;
        if (!after) break;
      }
    }
  } catch {
    return map;
  }
  ownersCache = { at: Date.now(), map };
  return map;
}

/** The rep's latest note on a closed ticket - the outcome, when no resolution field was filled. */
async function closingNote(ticketId: string, signal?: AbortSignal): Promise<string | null> {
  const assoc = await hubspotFetchJson<{ results?: { toObjectId: number | string }[] }>({
    path: `/crm/v4/objects/tickets/${ticketId}/associations/notes`, useTicketsToken: true, signal,
  });
  const ids = (assoc.results ?? []).map((r) => String(r.toObjectId)).slice(0, 10);
  if (!ids.length) return null;
  const notes = await hubspotFetchJson<{ results?: { properties?: { hs_note_body?: string; hs_timestamp?: string } }[] }>({
    path: "/crm/v3/objects/notes/batch/read",
    method: "POST",
    body: { inputs: ids.map((id) => ({ id })), properties: ["hs_note_body", "hs_timestamp"] },
    useTicketsToken: true,
    signal,
  });
  const latest = (notes.results ?? [])
    .map((n) => n.properties ?? {})
    .sort((a, b) => (b.hs_timestamp ?? "").localeCompare(a.hs_timestamp ?? ""))[0];
  const body = latest?.hs_note_body ? noteText(latest.hs_note_body) : "";
  return body || null;
}

async function readTickets(signal?: AbortSignal): Promise<ErosionTickets> {
  const stages = await ticketStages(signal);

  // Every page or none: a scan that stops at a failed page would show the
  // tickets after it as never raised.
  const raw: NonNullable<SearchPage["results"]> = [];
  let after: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await hubspotFetchJson<SearchPage>({
      path: "/crm/v3/objects/tickets/search",
      method: "POST",
      body: {
        filterGroups: [{ filters: [{ propertyName: "erosion_key", operator: "HAS_PROPERTY" }] }],
        properties: TICKET_PROPERTIES,
        sorts: [{ propertyName: "createdate", direction: "DESCENDING" }],
        limit: 100,
        ...(after ? { after } : {}),
      },
      useTicketsToken: true,
      signal,
    });
    raw.push(...(res.results ?? []));
    after = res.paging?.next?.after;
    if (!after) break;
  }

  const offRoster = raw.some((t) => {
    const id = String(t.properties?.hubspot_owner_id ?? "").trim();
    return id && !ESO_OWNERS[id] && !TSA_OWNERS[id];
  });
  const names = offRoster ? await ownerNames(signal) : new Map<string, string>();
  const tickets = raw.map((t) => mapTicket(t, stages, names));

  let notesError: string | null = null;
  for (const t of tickets.filter(isClosed).slice(0, NOTE_TICKETS)) {
    try {
      t.closingNote = await closingNote(t.id, signal);
    } catch (err) {
      // A refusal will refuse every ticket alike - say so once and stop asking.
      if (err instanceof IntegrationError && (err.status === 401 || err.status === 403)) {
        notesError = `Closing notes could not be read (HTTP ${err.status}): ${err.message}`;
        break;
      }
      if (signal?.aborted) throw err;
    }
  }

  return { generatedAt: new Date().toISOString(), tickets, notesError };
}

/** Five minutes, shared by every viewer; `refresh` asks HubSpot again. */
export function fetchErosionTickets(opts: { refresh?: boolean; signal?: AbortSignal } = {}): Promise<ErosionTickets> {
  if (!opts.refresh && ticketsCache && Date.now() - ticketsCache.at < TICKETS_TTL_MS) return ticketsCache.p;
  const p: Promise<ErosionTickets> = readTickets(opts.signal).catch((err) => {
    if (ticketsCache?.p === p) ticketsCache = null;
    throw err;
  });
  ticketsCache = { at: Date.now(), p };
  return p;
}

/**
 * A 403 here almost always means the token lacks crm.objects.tickets.read - and
 * the hub's app is a CLI project, so the remedy is NOT a checkbox in HubSpot.
 * (The legacy `tickets` scope is no longer accepted on upload.)
 */
export function describeTicketsError(err: unknown): { error: string; status: number | null } {
  if (err instanceof IntegrationError) {
    if (err.status === 403) {
      return {
        status: 403,
        error:
          "HubSpot refused to read tickets. The hub's private app needs crm.objects.tickets.read: add it to " +
          "app-hsmeta.json in C:\\dev\\hubspot-apsomarketinghub and run `hs project upload --account 26492587` " +
          "(it is a CLI project, so the scope cannot be ticked in HubSpot's settings) - or set TICKETS_TOKEN. " +
          `HubSpot said: ${err.message}`,
      };
    }
    return { error: err.message, status: err.status };
  }
  if (err instanceof Error) {
    if (err.name === "AbortError" || err.name === "TimeoutError") return { error: "HubSpot did not answer in time.", status: null };
    return { error: err.message, status: null };
  }
  return { error: "Unknown failure reading tickets.", status: null };
}

/* ── forecast ─────────────────────────────────────────────────────────── */

export async function fetchErosionForecast(signal?: AbortSignal): Promise<ErosionForecast> {
  const key = connectorReadKey();
  if (!key) throw new IntegrationError("CONNECTOR_READ_KEY is not set.");
  let res: Response;
  try {
    res = await fetch(`${connectorUrl()}/erosion/outlook`, {
      headers: { "x-connector-key": key },
      signal,
      cache: "no-store",
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new IntegrationError(`The Compass connector could not be reached: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!res.ok) {
    // The key travels in a header and is never repeated back.
    const why =
      res.status === 401
        ? "it does not accept this key - CONNECTOR_READ_KEY must be set to the same value on the connector"
        : res.status === 404 || res.status === 405
          ? "this connector has no read route for the forecast (GET /erosion/outlook) yet"
          : "it answered with an error";
    throw new IntegrationError(`Compass connector: HTTP ${res.status} - ${why}.`, res.status);
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new IntegrationError("Compass connector: the forecast was not JSON.", res.status);
  }
  return parseForecast(body);
}
