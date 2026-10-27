// THE SANDBOXES' ERRANDS (SARCLA 26.10.2026) - the sandbox on Railway cannot reach the hub, so the hub goes to it.
// Every minute, one copy of the hub at a time (advisory lock 4107250), for each sandbox in SANDBOX_URLS: its reviews
// mailed to the reviewer, its new people's sign-up links mailed, the CLI's Railway token replaced once a day. It never
// runs a read: data leaves only when somebody presses Bring data on the hub's Sandbox app (feed.ts bring()).
// Never beside an ERP chain. Needs SANDBOX_URLS + SANDBOX_LINK_KEY; SANDBOX_FEED=off stops it.

import { getPool } from "../db/client";
import { hubChain } from "../connectors/chainStatus";
import { feedOne } from "./feed";
import { sandboxTargets } from "./policy";
import { currentRailwayToken } from "./railway";
import { sendReview } from "./review";
import { sendInvite } from "./invite";
import { ensureHubPeople } from "./hubPeople";

const LOCK = 4_107_250;
const EVERY_MS = 60_000;

async function chainRunning(): Promise<boolean> {
  try {
    const c = await hubChain();
    return c?.status === "running" && Date.now() / 1000 - (c.ts ?? 0) < 3 * 3600;
  } catch {
    return false;
  }
}

async function round(targets: string[], linkKey: string): Promise<void> {
  if (await chainRunning()) return;
  const client = await getPool().connect();
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [LOCK]);
    if (!got.rows[0]?.ok) return;
    try {
      // the builders' hub accounts (SANDBOX_HUB_PEOPLE), once per start of this copy - under the lock, so the two
      // copies of the hub never both create the same account
      if (!peopleDone) {
        peopleDone = true;
        for (const line of await ensureHubPeople(process.env.SANDBOX_HUB_PEOPLE).catch((e: Error) => [`hub accounts: ${e.message.slice(0, 200)}`])) {
          console.log(`[sandbox-feed] ${line}`);
        }
      }
      // one Railway token a day for every sandbox (the CLI gets the same one from each); none without the workspace token
      const railway = process.env.RAILWAY_SANDBOX_TOKEN
        ? await currentRailwayToken().catch((e: Error) => { console.warn(`[sandbox-feed] Railway token: ${e.message.slice(0, 200)}`); return undefined; })
        : undefined;
      for (const t of targets) {
        const line = await feedOne(t, linkKey, { railway, sendReview, sendInvite })
          .catch((e: Error) => `${t.replace(/^https?:\/\//, "")}: ${e.message.slice(0, 200)}`);
        if (!line.endsWith("nothing to do")) console.log(`[sandbox-feed] ${line}`);
      }
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [LOCK]).catch(() => {});
    }
  } finally {
    client.release();
  }
}

let started = false, running = false, peopleDone = false;
export function startSandboxFeed(): void {
  if (started || process.env.SANDBOX_FEED === "off") return;
  const targets = sandboxTargets(process.env.SANDBOX_URLS);
  const linkKey = process.env.SANDBOX_LINK_KEY;
  if (!targets.length || !linkKey) return;
  started = true;
  console.log(`[sandbox-feed] feeding ${targets.length} sandbox${targets.length === 1 ? "" : "es"} every minute`);
  const tick = () => {
    if (running) return;
    running = true;
    void round(targets, linkKey).catch((e) => console.warn(`[sandbox-feed] ${(e as Error).message}`)).finally(() => { running = false; });
  };
  setTimeout(tick, 90_000).unref?.();
  setInterval(tick, EVERY_MS).unref?.();
}
