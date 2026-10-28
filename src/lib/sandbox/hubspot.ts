// HUBSPOT IN A SANDBOX: READ, NEVER WRITE - the sandbox reads HubSpot with the person's own private app (HUBSPOT_TOKEN in
// .env.local, SARCLA 28.10.2026). Every call that would change HubSpot is answered "done" here, counted on the band as
// held back, and never sent - whatever scopes that app was given. Installed by startSandbox, after the network guard.
//
// It sits on globalThis.fetch: instrumentation and the routes are separate bundles, and only globalThis is shared.

import { noteWouldWrite } from "./store";

const HUBSPOT_HOST = "api.hubapi.com";

/** HubSpot calls that only read: every GET, and the POSTs that search or read in batches. Anything else writes. */
export function isHubspotRead(method: string, url: string): boolean {
  const m = method.toUpperCase();
  if (m === "GET") return true;
  if (m !== "POST") return false;
  const path = new URL(url, "https://api.hubapi.com").pathname;
  return /\/search$/.test(path) || /\/batch\/read$/.test(path);
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
    if (isHubspotRead(method, path)) return original(input, init);
    await noteWouldWrite(method, path, await bodyText(input, init)).catch(() => {});
    return new Response(JSON.stringify({ id: "sandbox", results: [], status: "COMPLETE", sandbox: "would have written - nothing was sent" }),
      { status: 200, headers: { "content-type": "application/json" } });
  } as typeof fetch;
}

const FETCH_INSTALLED = Symbol.for("apsohub.sandbox.fetch");

export function installHubspotReadOnly(): void {
  const g = globalThis as typeof globalThis & { [FETCH_INSTALLED]?: boolean };
  if (g[FETCH_INSTALLED]) return;
  g.fetch = hubspotFetch(g.fetch.bind(g));
  g[FETCH_INSTALLED] = true;
}
