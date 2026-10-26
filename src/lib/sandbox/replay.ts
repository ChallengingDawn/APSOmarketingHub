// THE SANDBOX ANSWERS ITS PAGES FROM WHAT THE HUB SENT - installed by startSandbox, after the network guard.
//
// HubSpot: every call to api.hubapi.com is answered here and never leaves. A read the hub already sent (coded) is
// replayed; a read it has not is written down as a miss and answered "not in the sandbox yet" (Bring data fetches it);
// a write is answered "done" and only listed under "would have written" - nothing reaches HubSpot.
// Database: a read the hub sent is replayed; any other goes to the sandbox's own database, and an empty or missing
// table there is a miss too. Once the sandbox writes a table itself, that table is its own (dropReplaysOf).
//
// Both hooks sit on globalThis: instrumentation and the routes are separate bundles, and only globalThis is shared
// (the same reason as the HubSpot search queue).

import { NEVER_FROM_HUB, hubspotKey, isHubspotRead, isSqlRead, sqlKey } from "./canon";
import { dropReplaysOf, noteMiss, noteWouldWrite, replayed } from "./store";

type Rows = { rows: unknown[] };
export type QueryHook = (text: string, params: unknown[] | undefined, run: () => Promise<Rows>) => Promise<Rows>;

const HUBSPOT_HOST = "api.hubapi.com";

// The sandbox's own tables, and every table the hub refuses (logins, key store), are never replayed and never asked
// of the hub - asking would only fill the bar with reads that can never be brought.
const OWN = new RegExp(`\\b(sandbox_\\w+|${NEVER_FROM_HUB.join("|")}|pg_\\w+|information_schema)\\b`, "i");

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function bodyText(input: RequestInfo | URL, init?: RequestInit): Promise<unknown> {
  if (init?.body !== undefined && init.body !== null) return typeof init.body === "string" ? init.body : String(init.body);
  if (input instanceof Request) { const t = await input.clone().text(); return t || null; }
  return null;
}

export function hubspotFetch(original: typeof fetch): typeof fetch {
  return async function sandboxFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname !== HUBSPOT_HOST) return original(input, init);
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const path = `${url.pathname}${url.search}`;
    const body = await bodyText(input, init);
    if (!isHubspotRead(method, path)) {
      await noteWouldWrite(method, path, body).catch(() => {});
      return json(200, { id: "sandbox", results: [], status: "COMPLETE", sandbox: "would have written - nothing was sent" });
    }
    const key = hubspotKey(method, path, body);
    const hit = (await replayed(key)) as { status: number; body: unknown } | undefined;
    if (hit) return json(hit.status, hit.body);
    await noteMiss("hs", key, { method, url: path, body }).catch(() => {});
    return json(503, { status: "error", category: "SANDBOX", message: "Not in the sandbox yet - press Bring data" });
  } as typeof fetch;
}

function writtenTable(text: string): string | null {
  const m = /^\s*(?:with\b[\s\S]*?\)\s*)?(?:insert\s+into|update|delete\s+from)\s+("?[\w$.]+"?)/i.exec(text);
  return m ? m[1].split(".").pop()!.replace(/"/g, "").toLowerCase() : null;
}

export const sqlHook: QueryHook = async (text, params, run) => {
  if (OWN.test(text)) return run();
  if (!isSqlRead(text)) {
    const table = writtenTable(text);
    const r = await run();
    if (table) await dropReplaysOf(table).catch(() => {});
    return r;
  }
  const key = sqlKey(text, params);
  const hit = (await replayed(key)) as { rows: unknown[] } | undefined;
  if (hit) return { rows: hit.rows };
  try {
    const r = await run();
    if (r.rows.length === 0) await noteMiss("sql", key, { text, params: params ?? [] }).catch(() => {});
    return r;
  } catch (e) {
    // a table the sandbox does not have yet: the page sees it empty, Bring data fills it
    if ((e as { code?: string }).code === "42P01") {
      await noteMiss("sql", key, { text, params: params ?? [] }).catch(() => {});
      return { rows: [] };
    }
    throw e;
  }
};

const FETCH_INSTALLED = Symbol.for("apsohub.sandbox.fetch");

export function installReplay(): void {
  const g = globalThis as typeof globalThis & { [FETCH_INSTALLED]?: boolean; __apsoSandboxQuery?: QueryHook };
  if (!g[FETCH_INSTALLED]) {
    g.fetch = hubspotFetch(g.fetch.bind(g));
    g[FETCH_INSTALLED] = true;
  }
  g.__apsoSandboxQuery = sqlHook;
}
