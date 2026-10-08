// HubSpot for the connector steps: hubspotFetchJson (which already waits out a
// 429), also tried again on a 5xx or a dropped connection - the Compass
// connector did, and a single bad gateway should not stop a nightly step. A
// create is never tried twice: the record may have been made, and a second try
// would make it again.

import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { IntegrationError } from "@/lib/integrations/status";

type Req = Parameters<typeof hubspotFetchJson>[0];

const isCreate = (r: Req) => (r.method ?? "GET") === "POST" && /\/batch\/create$|\/crm\/v3\/objects\/[^/]+$/.test(r.path.split("?")[0]);

export async function hubspotRetry<T>(req: Req, tries = 4): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await hubspotFetchJson<T>(req);
    } catch (e) {
      const st = e instanceof IntegrationError ? e.status : undefined;
      const transient = st === undefined || st === null || st >= 500;
      if (!transient || isCreate(req) || attempt >= tries) throw e;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
}
