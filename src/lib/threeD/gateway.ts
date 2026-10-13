// The 3D gateway's address: one setting, kept in the hub's database (SARCLA, 13.10.2026: "a
// settings tab"). The hub's 3D page reads the service through it, and the settings tab checks every
// place on the shop, in the served files and in HubSpot against it. Until somebody sets it, it is
// the DoC backend's address (DOC_BACKEND_URL, or the Railway default) - the same service today.

import https from "node:https";
import zlib from "node:zlib";
import { kvGet, kvSet } from "@/lib/db/init";
import { backend } from "@/lib/doc/config";
import { CAD_LOCALES, apiAddress, cadPageUrl, cadSnippet, headerSnippet, iframeOrigin, judge, originOf, scriptOrigin, type PlaceState } from "./places";

const KV = "threeD:gateway";

export type GatewaySetting = { url: string; by: string | null; at: string | null; fromDefault: boolean };

export async function gatewaySetting(): Promise<GatewaySetting> {
  const s = await kvGet<{ url: string; by: string; at: string }>(KV).catch(() => null);
  return s?.url ? { url: s.url, by: s.by, at: s.at, fromDefault: false } : { url: backend().url, by: null, at: null, fromDefault: true };
}

export async function gatewayUrl(): Promise<string> {
  return (await gatewaySetting()).url;
}

/** https only, no path: the address of the service, as the shop's tags put it in front of /cad and /pdp3d.js. */
export async function setGateway(raw: string, by: string): Promise<GatewaySetting> {
  const origin = originOf(raw.trim());
  if (!origin || !origin.startsWith("https://")) throw new Error("Give the service's https address, e.g. https://gateway.apsoparts.com");
  const s = { url: origin, by, at: new Date().toISOString() };
  await kvSet(KV, s);
  return { ...s, fromDefault: false };
}

export type Place = {
  key: string;
  group: "Shop (Magento)" | "Served by the gateway" | "HubSpot" | "Hub";
  label: string;
  where: string;
  found: string | null;
  state: PlaceState;
  /** What to paste, with the gateway's address in it. */
  snippet?: string;
  /** The page or file the check read. */
  url?: string;
  note?: string;
};

const UA = "Mozilla/5.0 (compatible; APSOhub settings check)";

/**
 * A page or file, read with Node's LENIENT HTTP parser. The shop's server sends its large pages with a
 * malformed chunk size: curl reads them, Node's fetch stops with "terminated" (HPE_INVALID_CHUNK_SIZE,
 * 14.10.2026 - every row of this tab said "Could not read"). Gzip asked for and unpacked tolerantly.
 */
function read(url: string, timeoutMs = 20_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { insecureHTTPParser: true, headers: { "User-Agent": UA, "Accept-Encoding": "gzip" } }, (res) => {
      if ((res.statusCode ?? 0) >= 400) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      const chunks: Buffer[] = [];
      res.on("data", (d: Buffer) => chunks.push(d));
      res.on("error", reject);
      res.on("end", () => {
        let body = Buffer.concat(chunks);
        if (res.headers["content-encoding"] === "gzip") {
          try { body = zlib.gunzipSync(body, { finishFlush: zlib.constants.Z_SYNC_FLUSH }); } catch (e) { return reject(e as Error); }
        }
        resolve(body.toString("utf8"));
      });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`timeout after ${timeoutMs} ms`)));
    req.on("error", reject);
  });
}

/** Every place that names the gateway, read live: six shop pages, two served files, plus the two set by hand. */
export async function checkPlaces(gateway: string): Promise<Place[]> {
  const pages = await Promise.all(CAD_LOCALES.map((l) => read(cadPageUrl(l)).then((html) => ({ l, html }), (e: Error) => ({ l, error: e.message }))));
  const [pdp, cad] = await Promise.all([read(`${gateway}/pdp3d.js`).then((t) => ({ t }), (e: Error) => ({ error: e.message })),
    read(`${gateway}/cad`).then((t) => ({ t }), (e: Error) => ({ error: e.message }))]);
  const out: Place[] = [];

  // the header is the same on every page of a store view; the first page that answered tells
  const first = pages.find((p) => "html" in p) as { l: string; html: string } | undefined;
  const headerFound = first ? scriptOrigin(first.html) : null;
  out.push({
    key: "header", group: "Shop (Magento)", label: "3D button on product pages (pdp3d.js)",
    where: "Content > Design > Configuration > HTML Head > Scripts and Style Sheets, each store view",
    found: headerFound, state: first ? judge(headerFound, gateway) : "error", snippet: headerSnippet(gateway),
    url: first ? cadPageUrl(first.l) : undefined, ...(first ? {} : { note: "No shop page answered." }),
  });
  for (const p of pages) {
    const found = "html" in p ? iframeOrigin(p.html) : null;
    out.push({
      key: `cad:${p.l}`, group: "Shop (Magento)", label: `3D CAD data page · ${p.l}`,
      where: `Content > Pages > "3D CAD data" (service/3d-cad-data), store view ${p.l}`,
      found, state: "html" in p ? judge(found, gateway) : "error", snippet: cadSnippet(gateway, p.l), url: cadPageUrl(p.l),
      ...("error" in p ? { note: `The page could not be read: ${p.error}` } : {}),
    });
  }
  for (const [key, label, res, url] of [["pdp3d", "Inside pdp3d.js", pdp, `${gateway}/pdp3d.js`], ["cadhtml", "Inside the catalogue (cad.html)", cad, `${gateway}/cad`]] as const) {
    const a = "t" in res ? apiAddress(res.t) : { origin: null, follows: false };
    out.push({
      key, group: "Served by the gateway", label, where: "C:\\dev\\APSOPricingHub, packages/backend/public (const API)",
      found: a.origin, url,
      state: "error" in res ? "error" : a.follows ? "follows" : judge(a.origin, gateway),
      note: "error" in res ? `Not served at this address: ${res.error}` : a.follows ? "Takes the address it is served from - nothing to change." : "Written into the file: change it in the repo and push (Railway deploys).",
    });
  }
  out.push({
    key: "card", group: "HubSpot", label: "AP-Link 3D card", where: "C:\\dev\\AP-Link 3D Files\\hubspot-project (fetch3d.js, Fetch3dCard.jsx, app.json)",
    found: null, state: "manual", note: "Written into the card - change the three files and upload the project after a move.",
  });
  return out;
}
