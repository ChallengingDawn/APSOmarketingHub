// WHAT THE SANDBOX COPY STARTS - instrumentation.ts calls this INSTEAD of the hub's schedulers when APSOHUB_SANDBOX=1.
//
// Every job is OFF. SANDBOX_JOBS=mapAssign,ticketValue switches named ones on to test them, and even then they reach
// nothing real: the network guard goes in first (src/lib/sandbox/netGuard.ts) and the copy holds no credentials.
// A job added to instrumentation.ts later is off here until it is listed below - the safe default.

import { looksLikeHubDatabase, pickJobs } from "./jobs";
import { installSandboxGuard } from "./netGuard";

type Start = () => Promise<void>;

export const SANDBOX_JOBS: Record<string, Start> = {
  doc: async () => (await import("../doc/scheduler")).startDocScheduler(),
  erosion: async () => (await import("../erosion/scheduler")).startErosionScheduler(),
  articles: async () => (await import("../articles/scheduler")).startArticlesScheduler(),
  segmentation: async () => (await import("../segmentation/scheduler")).startSegmentationScheduler(),
  notify: async () => (await import("../notify/scheduler")).startNotifyScheduler(),
  shopLooks: async () => (await import("../shopLooks/scheduler")).startShopLooksScheduler(),
  priceChecks: async () => (await import("../datatracker/priceCheckScheduler")).startPriceCheckScheduler(),
  avor: async () => (await import("../directcut/avorScheduler")).startAvorScheduler(),
  connectors: async () => (await import("../connectors/scheduler")).startConnectorsWatch(),
  magento: async () => (await import("../connectors/magento/sync")).startMagentoSync(),
  lifecycleWarm: async () => (await import("../lifecycle/scheduler")).startLifecycleWarm(),
  leadsWarm: async () => (await import("../marketingKpis/leadsWarm")).startLeadsWarm(),
  threeD: async () => (await import("../threeD/calls")).startThreeDCollector(),
  ticketAssoc: async () => (await import("../ticketAssoc/run")).startTicketAssoc(),
  partnerStock: async () => (await import("../partnerStock/engine")).startPartnerStock(),
  boDistribution: async () => (await import("../boDistribution/engine")).startBoDistribution(),
  mapAssign: async () => (await import("../mapAssign/engine")).startMapAssign(),
  ticketDuplicates: async () => (await import("../ticketDuplicates/engine")).startTicketDuplicates(),
  ticketValue: async () => (await import("../ticketValue/engine")).startTicketValue(),
  chatTopics: async () => (await import("../chat/topics")).startChatTopics(),
};

export async function startSandbox(env: NodeJS.ProcessEnv = process.env): Promise<void> {
  if (looksLikeHubDatabase(env)) {
    throw new Error("sandbox: DATABASE_URL points at the hub's own database - a sandbox only ever runs on its own");
  }
  const allowed = installSandboxGuard(env);
  // then the pages' answers: HubSpot and database reads from what the hub sent, HubSpot writes only listed
  const { installReplay } = await import("./replay");
  installReplay();
  const { markSandboxDatabase } = await import("./store");
  await markSandboxDatabase().catch((e) => console.error("[sandbox] could not mark the database:", e));
  const { on, unknown } = pickJobs(env.SANDBOX_JOBS, Object.keys(SANDBOX_JOBS));
  console.log(`[sandbox] guard on - reaches only ${[...allowed].join(", ")}; jobs on: ${on.length ? on.join(", ") : "none"}`);
  if (unknown.length) console.warn(`[sandbox] SANDBOX_JOBS names no such job: ${unknown.join(", ")}`);
  for (const name of on) {
    try { await SANDBOX_JOBS[name](); } catch (e) { console.error(`[sandbox] job ${name} did not start:`, e); }
  }
}
