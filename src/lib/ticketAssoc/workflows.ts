// WHICH HUBSPOT WORKFLOWS STILL USE THE TICKETS APP'S SECRET (SARCLA, 17.10.2026: "tell me the
// workflow that I need to stop"). A workflow's custom-code action names the secrets it reads; the
// Tickets app (sarcla-tickets) can only be deleted once none of them reads TICKETS_TOKEN - the
// "Ticket associations" workflow first, which the hub has replaced. Needs the hub app's
// "automation" scope (build #24); until that is approved, HubSpot answers 403 and the page says so.

import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { IntegrationError } from "@/lib/integrations/status";

export type SecretFlow = { id: string; name: string; enabled: boolean; objectTypeId: string | null; url: string };
export type SecretFlows = { ok: true; flows: SecretFlow[]; checked: number; at: string } | { ok: false; error: string; at: string };

const PORTAL = "26492587";
const CACHE_MS = 20 * 60_000;
let cache: { key: string; at: number; value: SecretFlows } | null = null;

type Flow = { id: string | number; name?: string; isEnabled?: boolean; objectTypeId?: string; actions?: { type?: string; actionTypeId?: string; secretNames?: string[] }[] };

export async function flowsUsingSecret(secret = "TICKETS_TOKEN", refresh = false): Promise<SecretFlows> {
  if (!refresh && cache && cache.key === secret && Date.now() - cache.at < CACHE_MS) return cache.value;
  const at = new Date().toISOString();
  let value: SecretFlows;
  try {
    const ids: string[] = [];
    let after: string | undefined;
    do {
      const j = await hubspotFetchJson<{ results?: Flow[]; paging?: { next?: { after?: string } } }>({ path: `/automation/v4/flows?limit=100${after ? `&after=${after}` : ""}` });
      ids.push(...(j.results ?? []).map((f) => String(f.id)));
      after = j.paging?.next?.after;
    } while (after && ids.length < 5000);
    const flows: SecretFlow[] = [];
    for (let i = 0; i < ids.length; i += 50) {
      const j = await hubspotFetchJson<{ results?: Flow[] }>({
        path: "/automation/v4/flows/batch/read", method: "POST",
        body: { inputs: ids.slice(i, i + 50).map((flowId) => ({ flowId, type: "FLOW_ID" })) },
      });
      for (const f of j.results ?? []) {
        if (!(f.actions ?? []).some((a) => (a.secretNames ?? []).includes(secret))) continue;
        flows.push({
          id: String(f.id), name: f.name ?? `Workflow ${f.id}`, enabled: !!f.isEnabled, objectTypeId: f.objectTypeId ?? null,
          url: `https://app-eu1.hubspot.com/workflows/${PORTAL}/platform/flow/${f.id}/edit`,
        });
      }
    }
    value = { ok: true, flows: flows.sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name)), checked: ids.length, at };
  } catch (e) {
    const st = e instanceof IntegrationError ? e.status : null;
    value = {
      ok: false, at,
      error: st === 403
        ? "HubSpot refused: the hub app's \"automation\" scope (build #24) is not approved yet - approve it on the app's page in HubSpot."
        : (e as Error).message.slice(0, 200),
    };
  }
  cache = { key: secret, at: Date.now(), value };
  return value;
}

/**
 * The workflows that look at a ticket property - in their enrollment criteria, a branch or an action -
 * found by its internal name in the workflow's definition. Before the hub fills Article(s) on 12,000
 * older tickets at once (SARCLA 17.10.2026), this says which workflows could start for each of them.
 */
let propCache: { key: string; at: number; value: SecretFlows } | null = null;

export async function flowsUsingProperty(property: string, refresh = false): Promise<SecretFlows> {
  if (!refresh && propCache && propCache.key === property && Date.now() - propCache.at < CACHE_MS) return propCache.value;
  const at = new Date().toISOString();
  const needle = new RegExp(`"(?:property|propertyName|targetProperty)"\\s*:\\s*"${property.replace(/[^a-z0-9_]/gi, "")}"`);
  let value: SecretFlows;
  try {
    const ids: string[] = [];
    let after: string | undefined;
    do {
      const j = await hubspotFetchJson<{ results?: Flow[]; paging?: { next?: { after?: string } } }>({ path: `/automation/v4/flows?limit=100${after ? `&after=${after}` : ""}` });
      ids.push(...(j.results ?? []).map((f) => String(f.id)));
      after = j.paging?.next?.after;
    } while (after && ids.length < 5000);
    const flows: SecretFlow[] = [];
    for (let i = 0; i < ids.length; i += 50) {
      const j = await hubspotFetchJson<{ results?: Flow[] }>({
        path: "/automation/v4/flows/batch/read", method: "POST",
        body: { inputs: ids.slice(i, i + 50).map((flowId) => ({ flowId, type: "FLOW_ID" })) },
      });
      for (const f of j.results ?? []) {
        if (f.objectTypeId && f.objectTypeId !== "0-5") continue; // ticket workflows only
        if (!needle.test(JSON.stringify(f))) continue;
        flows.push({
          id: String(f.id), name: f.name ?? `Workflow ${f.id}`, enabled: !!f.isEnabled, objectTypeId: f.objectTypeId ?? null,
          url: `https://app-eu1.hubspot.com/workflows/${PORTAL}/platform/flow/${f.id}/edit`,
        });
      }
    }
    value = { ok: true, flows: flows.sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name)), checked: ids.length, at };
  } catch (e) {
    const st = e instanceof IntegrationError ? e.status : null;
    value = {
      ok: false, at,
      error: st === 403
        ? "HubSpot refused: the hub app's \"automation\" scope (build #24) is not approved yet - approve it on the app's page in HubSpot."
        : (e as Error).message.slice(0, 200),
    };
  }
  propCache = { key: property, at: Date.now(), value };
  return value;
}
