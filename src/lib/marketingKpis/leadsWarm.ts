// EVERY DIGITAL GROWTH READ KEEPS ITSELF FRESH (SARCLA 19.10.2026: "this should load once and then save, and be
// reloaded so nobody waits"; 20.10.2026: "pages that refresh only when someone opens them - we need to avoid
// that at all costs"). Each slow read keeps its answer in the database and shows it while a new one runs
// (slowReport), but a read was started only by a visit: after its 6-12 hours, the first person to open
// Reach, Visit, Engagements, Who are our customers... saw old figures and "reading again" for minutes. Now
// the hub reads every one of them in the background, one after the other, whenever its answer is older than
// its own time - a reader only ever sees the last finished read. Started on both servers; the database keeps
// one read running at a time, the other server finds it running and waits. Read-only against HubSpot, GA4
// and Search Console; never beside an ERP chain (its steps share HubSpot's rate limit). LEADS_WARM=off stops it.

import { hubChain } from "@/lib/connectors/chainStatus";
import { checkGoogleLogin } from "@/lib/integrations/googleLoginReminder";
import type { SlowState } from "@/lib/integrations/slowReport";
import { aeoData } from "@/lib/aeo/read";
import { marketingKpisLive } from "./live";
import { customersCube } from "./customers";
import { visitData } from "./visit";
import { engageData } from "./engage";
import { onlineCube } from "./online";
import { movements } from "./movements";
import { leadsData } from "./leads";
import { handoverData } from "./handover";
import { retainData } from "./retain";
import { retentionData } from "./retention";

const TICK_MS = 10 * 60_000;
/** One read never holds the warm-up longer than this (Retain & grow takes a quarter of an hour); the next tick picks up. */
const MAX_WAIT_MS = 30 * 60_000;
/**
 * The warm-up never starts the same read twice within this (every read keeps 6-24 hours) - a read that marks itself out of date at once
 * (a TTL of 0 while a part is missing) must not turn into a read every ten minutes.
 */
const MIN_GAP_MS = 60 * 60_000;

/** In the order people see them: the figures on every page first, then each stage's own read. */
const READS: { name: string; get: () => Promise<SlowState<unknown>> }[] = [
  { name: "KPIs (Reach, nutshell)", get: marketingKpisLive },
  { name: "Who are our customers", get: customersCube },
  { name: "Visit", get: visitData },
  { name: "Engagements", get: engageData },
  { name: "Online share", get: onlineCube },
  { name: "Segment movements", get: movements },
  { name: "AI answers", get: aeoData },
  { name: "Lead Generation", get: leadsData },
  { name: "Hand-over", get: handoverData },
  { name: "Retain & grow", get: retainData },
  // the retention workbook (d2, 20.10.2026) - the heaviest (~15 min), so last
  { name: "Retention", get: retentionData },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function chainRunning(): Promise<boolean> {
  try {
    const c = await hubChain();
    return c?.status === "running" && Date.now() / 1000 - (c.ts ?? 0) < 3 * 3600;
  } catch {
    return false;
  }
}

let busy = false;
const lastStarted = new Map<string, number>();

async function tick() {
  if (busy || process.env.LEADS_WARM === "off") return;
  busy = true;
  try {
    for (const r of READS) {
      if (await chainRunning()) return;
      if (Date.now() - (lastStarted.get(r.name) ?? 0) < MIN_GAP_MS) continue;
      try {
        // a fresh answer comes back at once; an old or missing one starts the read - wait for it to finish
        if (!(await r.get()).computing) continue;
        const t0 = Date.now();
        lastStarted.set(r.name, t0);
        let st: SlowState<unknown> = { computing: true };
        while (Date.now() - t0 < MAX_WAIT_MS && (st = await r.get()).computing) await sleep(10_000);
        console.log(st.computing
          ? `[kpi-warm] ${r.name}: still reading after ${Math.round((Date.now() - t0) / 60_000)} min - the next tick looks again`
          : `[kpi-warm] ${r.name}: read again in ${Math.round((Date.now() - t0) / 1000)} s${st.error ? ` - failed: ${String(st.error).slice(0, 160)}` : ""}`);
      } catch (e) {
        console.warn(`[kpi-warm] ${r.name}: ${(e as Error).message}`);
      }
    }
  } finally {
    busy = false;
  }
}

let started = false;

export function startLeadsWarm() {
  if (started) return;
  started = true;
  // the two servers start seconds apart: a different first tick each, so one finds the other's read running
  setTimeout(() => void tick(), 60_000 + Math.floor(Math.random() * 120_000)).unref?.();
  setInterval(() => void tick(), TICK_MS).unref?.();
  // the borrowed Google login's weekly renewal, by mail (SARCLA 20.10: "send an e-mail when I need to renew it") -
  // hourly, whether or not the reads are warmed
  const remind = () => void checkGoogleLogin().catch((e) => console.warn(`[google-login] ${(e as Error).message}`));
  setTimeout(remind, 5 * 60_000).unref?.();
  setInterval(remind, 60 * 60_000).unref?.();
}
