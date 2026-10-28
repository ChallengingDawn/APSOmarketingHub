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

/**
 * The sandbox copies share one Postgres on Railway, each with a database of its own (sandbox_base, sandbox_diana...),
 * so one person's Delete all or new table never touches another's. The first boot creates it.
 */
async function ensureOwnDatabase(env: NodeJS.ProcessEnv): Promise<void> {
  const url = env.DATABASE_URL;
  if (!url) return;
  const name = decodeURIComponent(new URL(url).pathname.slice(1));
  if (!/^sandbox_[a-z0-9_]+$/.test(name)) return;
  const { Client } = await import("pg");
  const ssl = url.includes("railway") ? { rejectUnauthorized: false } : undefined;
  const probe = new Client({ connectionString: url, ssl });
  try {
    await probe.connect();
    await probe.end();
    return;
  } catch (e) {
    await probe.end().catch(() => {});
    if ((e as { code?: string }).code !== "3D000") throw e;          // only "no such database" is ours to fix
  }
  const server = new URL(url);
  server.pathname = "/railway";
  const admin = new Client({ connectionString: server.toString(), ssl });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    console.log(`[sandbox] created its own database ${name}`);
  } finally {
    await admin.end();
  }
}

export async function startSandbox(env: NodeJS.ProcessEnv = process.env): Promise<void> {
  if (looksLikeHubDatabase(env)) {
    throw new Error("sandbox: DATABASE_URL points at the hub's own database - a sandbox only ever runs on its own");
  }
  const allowed = installSandboxGuard(env);
  await ensureOwnDatabase(env);
  // then the pages' answers: HubSpot and database reads from what the hub sent, HubSpot writes only listed
  const { installReplay } = await import("./replay");
  installReplay();
  const { markSandboxDatabase } = await import("./store");
  await markSandboxDatabase().catch((e) => console.error("[sandbox] could not mark the database:", e));
  // people come in through the hub (door.ts): the sign-up links it once handed out, and the Railway token its CLI once
  // deployed with, are dropped
  const { dropOldLinks } = await import("./door");
  await dropOldLinks().then((n) => { if (n) console.log(`[sandbox] ${n} old link${n === 1 ? "" : "s"} or token${n === 1 ? "" : "s"} dropped - people come in through the hub`); })
    .catch((e) => console.error("[sandbox] could not drop the old links:", e));
  const { on, unknown } = pickJobs(env.SANDBOX_JOBS, Object.keys(SANDBOX_JOBS));
  console.log(`[sandbox] guard on - reaches only ${[...allowed].join(", ")}; jobs on: ${on.length ? on.join(", ") : "none"}`);
  if (unknown.length) console.warn(`[sandbox] SANDBOX_JOBS names no such job: ${unknown.join(", ")}`);
  for (const name of on) {
    try { await SANDBOX_JOBS[name](); } catch (e) { console.error(`[sandbox] job ${name} did not start:`, e); }
  }
}
