// THE CLI'S RAILWAY TOKEN, REPLACED EVERY DAY (SARCLA 26.10.2026: Railway access "via TOTP" on the CLI). Railway's own
// tokens carry no TOTP, so nobody holds one for long: the hub makes a new one for the sandbox environment only, hands
// it to the sandbox (which gives it out after password + TOTP), and deletes the ones older than 36 hours - a day's
// overlap, so a token handed out yesterday evening still works this morning. RAILWAY_SANDBOX_TOKEN (a workspace token,
// AWS apso-dev/RAILWAY_SANDBOX_TOKEN) is what makes and deletes them; it never leaves the hub.

import { kvGet, kvSet } from "@/lib/db/init";

const GQL = "https://backboard.railway.com/graphql/v2";
const PROJECT = process.env.RAILWAY_SANDBOX_PROJECT ?? "30bd5735-8463-4dc5-9b6a-ab43baabdc66"; // APSOAssistant
const ENVIRONMENT = process.env.RAILWAY_SANDBOX_ENV ?? "a8472f7f-7ddd-4f49-8506-53246f8dab8d"; // its "sandbox"
const KV = "sandbox:railway-token";
const PREFIX = "sbx-auto ";
const EVERY_MS = 23 * 3_600_000;
const KEEP_MS = 36 * 3_600_000;

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const key = process.env.RAILWAY_SANDBOX_TOKEN;
  if (!key) throw new Error("RAILWAY_SANDBOX_TOKEN is not set");
  // Railway's edge refuses a request without a User-Agent (Cloudflare 1010)
  const res = await fetch(GQL, {
    method: "POST", signal: AbortSignal.timeout(20_000),
    headers: { "content-type": "application/json", authorization: `Bearer ${key}`, "user-agent": "apsohub-sandbox-feed/1.0" },
    body: JSON.stringify({ query, variables }),
  });
  const j = (await res.json().catch(() => ({}))) as { data?: T; errors?: { message?: string }[] };
  if (!res.ok || j.errors?.length || !j.data) throw new Error(`Railway: ${j.errors?.[0]?.message ?? res.status}`);
  return j.data;
}

/** Today's token: the one made in the last 23 hours, or a new one (and yesterday's-but-one deleted). */
export async function currentRailwayToken(now = Date.now()): Promise<{ token: string; at: string }> {
  const held = await kvGet<{ token: string; at: string }>(KV);
  if (held?.token && now - Date.parse(held.at) < EVERY_MS) return held;
  const at = new Date(now).toISOString();
  const token = (await gql<{ projectTokenCreate: string }>(
    `mutation($i: ProjectTokenCreateInput!) { projectTokenCreate(input: $i) }`,
    { i: { projectId: PROJECT, environmentId: ENVIRONMENT, name: `${PREFIX}${at}` } })).projectTokenCreate;
  await kvSet(KV, { token, at });
  console.log(`[sandbox-feed] new Railway token for the sandbox environment (${at})`);
  await dropOld(now).catch((e) => console.warn(`[sandbox-feed] old Railway tokens not deleted: ${(e as Error).message}`));
  return { token, at };
}

async function dropOld(now: number): Promise<void> {
  const list = await gql<{ projectTokens: { edges: { node: { id: string; name: string; environmentId: string } }[] } }>(
    `query($p: String!) { projectTokens(projectId: $p) { edges { node { id name environmentId } } } }`, { p: PROJECT });
  for (const { node } of list.projectTokens.edges) {
    if (!node.name.startsWith(PREFIX) || node.environmentId !== ENVIRONMENT) continue;
    const made = Date.parse(node.name.slice(PREFIX.length));
    if (Number.isFinite(made) && now - made > KEEP_MS) {
      await gql(`mutation($id: String!) { projectTokenDelete(id: $id) }`, { id: node.id });
      console.log(`[sandbox-feed] deleted the Railway token of ${node.name.slice(PREFIX.length)}`);
    }
  }
}
