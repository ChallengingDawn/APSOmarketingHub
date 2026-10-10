// ONE EROSION RUN IN THE HUB - preview or live - and what it leaves behind.
//
// Live is guarded twice before anything is written: the connector's memory (every
// article key it ever ticketed or was told to skip - 4 of them are on no live
// ticket) must have been imported, and the `tags` dropdown must carry `erosion`,
// or the ESO rename workflow would wipe every subject. Each ticket's keys are saved
// the moment it is written, so a run that dies half-way never raises the same
// ticket twice - HubSpot's search index can lag a fresh ticket by minutes.

import { kvGet, kvSet } from "@/lib/db/init";
import { IntegrationError, connectorReadKey, connectorUrl } from "@/lib/integrations/status";
import { previewDetector } from "@/lib/integrations/erosionDetector";
import { erosionTagExists, writeErosionTicket, type WriteResult } from "@/lib/integrations/erosionWriter";
import { WATERMARK } from "./detector";
import { hubChain, hubRunsChainSteps } from "@/lib/connectors/chainStatus";
import { CONNECTOR_RETIRED } from "@/lib/connectors/retired";

export const KV = {
  imported: "erosion:imported-keys",
  written: "erosion:written-keys",
  last: "erosion:hub:last",
  lastPreview: "erosion:hub:last-preview",
  outlook: "erosion:hub:outlook",
  tried: "erosion:hub:tried",
} as const;

/** The detector's day is the UTC day, as on the connector (a UTC host's date.today()). */
export const utcToday = () => new Date().toISOString().slice(0, 10);

/** A read-only GET on the Compass connector with its read key. */
export async function connectorGet<T>(path: string): Promise<T> {
  const key = connectorReadKey();
  if (!key) throw new IntegrationError("CONNECTOR_READ_KEY is not set.");
  const res = await fetch(`${connectorUrl()}${path}`, {
    headers: { "x-connector-key": key }, cache: "no-store", signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new IntegrationError(`Compass connector ${path}: HTTP ${res.status}`, res.status);
  return (await res.json()) as T;
}

/** Import the connector's erosion keys once - the switch-over's memory. */
export async function importConnectorKeys(): Promise<number> {
  const st = await connectorGet<{ keys?: string[]; watermark?: string }>("/erosion/state");
  const keys = Array.isArray(st.keys) ? st.keys.filter((k) => typeof k === "string") : [];
  if (!keys.length) throw new IntegrationError("The connector returned no erosion keys - nothing imported.");
  await kvSet(KV.imported, { at: new Date().toISOString(), watermark: st.watermark ?? null, keys });
  return keys.length;
}

let lastWaitLog = 0;

/**
 * Is tonight's data loaded? Erosion, articles and segmentation run after it, never before.
 * While the Compass connector moves into the hub, the night's steps can run in either:
 * the connector's chain has to be done today unless it no longer pulls the files
 * ("sftp_pull" in its HUB_STEPS), and the hub's own chain - which runs only once the
 * hub reads the files - has to be done today as soon as it runs any chain step.
 */
export async function chainDoneToday(today: string): Promise<{ done: boolean; at: string | null }> {
  // the connector is switched off: the hub pulls the files, its own chain is the only one
  const s = CONNECTOR_RETIRED
    ? { hub_steps: ["sftp_pull"] } as { delta_run?: { status?: string; ts?: number } | null; hub_steps?: string[] }
    : await connectorGet<{ delta_run?: { status?: string; ts?: number } | null; hub_steps?: string[] }>("/chain/status").catch(() => null);
  const hubPulls = !!s?.hub_steps?.includes("sftp_pull");
  let done = true;
  let at: string | null = null;
  if (!hubPulls) {
    if (!s) throw new IntegrationError("The Compass connector cannot be asked whether tonight's chain is done.");
    const dr = s.delta_run;
    at = dr?.ts ? new Date(dr.ts * 1000).toISOString() : null;
    done = dr?.status === "done" && !!at && at.slice(0, 10) === today;
  }
  // the hub's own chain runs only while it reads the files (connector/chain.ts)
  if (hubPulls && await hubRunsChainSteps()) {
    const h = await hubChain();
    const hat = h?.ts ? new Date(h.ts * 1000).toISOString() : null;
    const hubDone = h?.status === "done" && h.day === today;
    // the decision, not just the action: a gate that holds erosion back says why
    if (done && !hubDone && Date.now() - lastWaitLog > 3_600_000) {
      lastWaitLog = Date.now();
      console.log(`[chain] waiting: the hub's chain is not done today (status ${h?.status ?? "none"}, day ${h?.day ?? "-"}, step ${h?.step ?? "-"})`);
    }
    done = done && hubDone;
    if (hat && (!at || hat > at)) at = hat;
  }
  return { done, at };
}

export type HubRun = {
  at: string;
  today: string;
  mode: "preview" | "live";
  ordersScanned: number;
  candidates: number;
  heldOpenOrder: number;
  skippedOwner: { un: string; article: string; owner: string }[];
  skippedThreshold: number;
  skippedNoCompany: number;
  created: number;
  merged: number;
  failed: number;
  tickets: { title: string; un: string; keys: string[]; ticketId: string | null; action: string; errors: string[] }[];
};

/** Keys written by the hub are kept 45 days - long enough for any search-index lag, short enough to stay small. */
function prune(written: Record<string, string>, today: string): Record<string, string> {
  const cutoff = new Date(Date.parse(`${today}T00:00:00Z`) - 45 * 86_400_000).toISOString().slice(0, 10);
  return Object.fromEntries(Object.entries(written).filter(([, d]) => d >= cutoff));
}

export async function runErosion(mode: "preview" | "live", today = utcToday()): Promise<HubRun> {
  const imported = (await kvGet<{ keys: string[] }>(KV.imported))?.keys ?? [];
  if (mode === "live") {
    if (!imported.length) {
      throw new IntegrationError("The connector's erosion keys are not imported - refusing to write: it could re-raise tickets the connector already handled.");
    }
    if (!(await erosionTagExists())) {
      throw new IntegrationError("The tickets `tags` dropdown has no `erosion` option - refusing to write: the ESO rename workflow would wipe every subject.");
    }
  }
  let written = (await kvGet<Record<string, string>>(KV.written)) ?? {};
  const p = await previewDetector({ today, extraKeys: [...imported, ...Object.keys(written)] });

  const results: WriteResult[] = [];
  if (mode === "live") {
    for (const d of p.tickets) {
      const r = await writeErosionTicket(d);
      results.push(r);
      if (r.ticketId) {
        for (const k of r.keys) written[k] = today;
        written = prune(written, today);
        await kvSet(KV.written, written);
      }
    }
  }

  const run: HubRun = {
    at: new Date().toISOString(), today, mode,
    ordersScanned: p.ordersScanned, candidates: p.candidates, heldOpenOrder: p.skippedOpenOrder,
    skippedOwner: p.report.skippedOwner, skippedThreshold: p.report.skippedThreshold.length, skippedNoCompany: p.report.skippedNoCompany.length,
    created: results.filter((r) => r.action === "created").length,
    merged: results.filter((r) => r.action === "merged").length,
    failed: results.filter((r) => r.action === "failed").length,
    tickets: mode === "live"
      ? results.map((r) => ({ title: r.title, un: r.un, keys: r.keys, ticketId: r.ticketId, action: r.action, errors: r.errors }))
      : p.tickets.map((t) => ({ title: t.title, un: t.un, keys: t.keys, ticketId: t.mergeInto, action: t.mergeInto ? "would merge" : "would create", errors: [] })),
  };

  if (mode === "live") {
    await kvSet(KV.last, run);
    // the forecast and summary, in the connector's own shape, so the page reads the hub's
    // run the way it read the connector's
    await kvSet(KV.outlook, {
      outlook: p.outlook,
      summary: {
        watermark: WATERMARK, last_run: today,
        tickets_created_total: p.keysBefore + results.reduce((n, r) => n + (r.ticketId ? r.keys.length : 0), 0),
        created_today: run.created, merged_today: run.merged,
        skipped_open_order_today: run.heldOpenOrder, skipped_owner_today: run.skippedOwner.length,
      },
    });
  } else {
    await kvSet(KV.lastPreview, run);
  }
  return run;
}
