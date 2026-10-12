// OWNER REDIRECTION - the rules in HubSpot, where the app function can read them.
//
// The hub is reachable only inside the A+P network, so HubSpot cannot ask it for the
// rules. The hub therefore PUBLISHES them, on every save, as one JSON document on one
// record of the KPI custom object (2-201387076), in a text property of its own
// (apsohub_config_json). Why there:
//   - the hub's app (SARCLA - APSOMarketingHub) already holds crm.objects.custom.read/
//     write and crm.schemas.custom.write - no new scope, no re-approval;
//   - the HubSpot function runs on that same app's token, so whatever the hub can write,
//     the function can read - one GET, no CMS, no HubDB (no scope for either);
//   - every KPI reader filters on kpi_category / metric / snapshot_date, and this record
//     carries none of them, so no report or series can pick it up.
// Found by name (RECORD_NAME); the document carries its own checksum, so a hand edit or
// a cut-off value is refused by every reader, who then does nothing.
//
// Publishing runs under its own advisory lock (4107212): two admins saving at once
// would otherwise both create the record.

import { getPool } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry as hs } from "@/lib/connectors/steps/hs";
import { IntegrationError } from "@/lib/integrations/status";
import { DOC_PROPERTY, KPI_OBJECT, RECORD_NAME, buildDoc, otherRecords, parseDoc, recordIdOf, type Doc, type PubRule, type Rule } from "./rules";

/** 4107201-4107211 are taken (DoC, erosion, articles, segmentation, looks, notify, steps, price checks, sweeps, Magento x2). */
const PUBLISH_LOCK = 4_107_212;
const KV_PUBLISHED = "ownerRules:published";
const KV_RECORD = "ownerRules:record";
const KV_PUBLISH_ERROR = "ownerRules:publish-error";

/** The app the hub and the HubSpot function write as, and the France app it replaces. */
export const HUB_APP_ID = "50521064";
export const FRANCE_APP_ID = "51504878";

type Obj = { id: string; properties?: Record<string, string | null> };
type Page = { results?: Obj[]; total?: number; paging?: { next?: { after?: string } } };

const statusOf = (e: unknown) => (e instanceof IntegrationError ? e.status : null);
const msg = (e: unknown) => String((e as Error)?.message ?? e).replace(/\s+/g, " ").slice(0, 300);

/* ── reading what is published ─────────────────────────────────────────── */

async function findRecords(): Promise<string[]> {
  const j = await hs<Page>({
    path: `/crm/v3/objects/${KPI_OBJECT}/search`, method: "POST",
    body: {
      filterGroups: [{ filters: [{ propertyName: "name", operator: "EQ", value: RECORD_NAME }] }],
      properties: ["name"], sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }], limit: 10,
    },
  });
  return (j.results ?? []).map((r) => String(r.id));
}

async function readRecords(ids: string[]): Promise<Obj[]> {
  if (!ids.length) return [];
  const j = await hs<{ results?: Obj[] }>({
    path: `/crm/v3/objects/${KPI_OBJECT}/batch/read`, method: "POST",
    body: { properties: ["name", DOC_PROPERTY], inputs: ids.map((id) => ({ id })) },
  });
  return j.results ?? [];
}

export type Published = { ok: true; doc: Doc; recordId: string; records: number } | { ok: false; error: string };

/**
 * The rules as HubSpot holds them - exactly what the HubSpot function reads, the same
 * way (search by name, then the record itself). With more than one record, the valid
 * document published last wins; none valid = an error, and the caller does nothing.
 */
export async function readPublished(): Promise<Published> {
  let ids: string[];
  try {
    ids = await findRecords();
  } catch (e) {
    return { ok: false, error: `the rules record cannot be searched: ${msg(e)}` };
  }
  if (!ids.length) return { ok: false, error: "no rules are published in HubSpot yet" };
  let recs: Obj[];
  try {
    recs = await readRecords(ids);
  } catch (e) {
    return { ok: false, error: `the rules record cannot be read: ${msg(e)}` };
  }
  let best: { doc: Doc; id: string } | null = null;
  let firstError = "";
  for (const r of recs) {
    if (r.properties?.name !== RECORD_NAME) continue;
    const p = parseDoc(r.properties?.[DOC_PROPERTY]);
    if (!p.ok) {
      firstError ||= p.error;
      continue;
    }
    if (!best || p.doc.publishedAt > best.doc.publishedAt) best = { doc: p.doc, id: String(r.id) };
  }
  if (!best) return { ok: false, error: firstError || "the rules record holds no rules" };
  return { ok: true, doc: best.doc, recordId: best.id, records: ids.length };
}

/* ── publishing ────────────────────────────────────────────────────────── */

export type PublishState = {
  at: string; by: string; hash: string; rules: number; recordId: string;
  /** False when HubSpot's search did not find the record within ~15 s - the function looks it up that way. */
  searchable: boolean;
};

export async function publishState(): Promise<PublishState | null> {
  return (await kvGet<PublishState>(KV_PUBLISHED)) ?? null;
}

const missingProperty = (e: unknown) => /PROPERTY_DOESNT_EXIST|does not exist|doesn't exist/i.test(msg(e));

async function createDocProperty(): Promise<void> {
  try {
    await hs({
      path: `/crm/v3/properties/${KPI_OBJECT}`, method: "POST",
      body: {
        name: DOC_PROPERTY, label: "APSOhub settings (JSON)", type: "string", fieldType: "textarea", groupName: "kpi_information",
        description: "Written by APSOMarketingHub (Owner redirection). Read by the HubSpot app SARCLA - APSOMarketingHub. Do not edit: a changed value is refused and the rules stop.",
      },
    });
  } catch (e) {
    if (statusOf(e) === 409) return; // made meanwhile
    throw new Error(`the KPI object has no property ${DOC_PROPERTY} and the hub could not create it (${msg(e)}). ` +
      `Create it in HubSpot: Settings > Data management > Objects > KPI > Create property - internal name ${DOC_PROPERTY}, multi-line text - then save again.`);
  }
}

/** Write the document onto the record (creating the property once if HubSpot says it is missing). */
async function writeDoc(recordId: string | null, json: string): Promise<string> {
  const props = { name: RECORD_NAME, [DOC_PROPERTY]: json };
  const once = async () => {
    if (recordId) {
      await hs({ path: `/crm/v3/objects/${KPI_OBJECT}/${recordId}`, method: "PATCH", body: { properties: props } });
      return recordId;
    }
    // a create is never retried by hubspotRetry: a second try could make a second record
    const r = await hs<Obj>({ path: `/crm/v3/objects/${KPI_OBJECT}`, method: "POST", body: { properties: props } });
    return String(r.id);
  };
  try {
    return await once();
  } catch (e) {
    if (!missingProperty(e)) throw e;
    await createDocProperty();
    return await once();
  }
}

/** Run a save and its publish as one: no other save can come between them (across both hub copies). */
export async function underPublishLock<T>(fn: () => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    let got = false;
    for (let i = 0; i < 20 && !got; i++) {
      got = !!(await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [PUBLISH_LOCK])).rows[0]?.ok;
      if (!got) await new Promise((r) => setTimeout(r, 500));
    }
    if (!got) throw new Error("another save is being published right now - try again in a moment");
    try {
      return await fn();
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [PUBLISH_LOCK]).catch(() => {});
    }
  } finally {
    client.release();
  }
}

export type PublishResult = { ok: true; state: PublishState; note: string } | { ok: false; error: string };

/**
 * Publish the rules to HubSpot and prove it: write, read the record back and compare,
 * then check HubSpot's search finds it (the HubSpot function's way in). Call it inside
 * underPublishLock. A failure is recorded and returned - the saved rules stay saved, and
 * HubSpot keeps running the last rules that were published.
 */
export async function publishRules(rules: Rule[], by: string): Promise<PublishResult> {
  const doc = buildDoc(rules, by, new Date().toISOString());
  const json = JSON.stringify(doc);
  try {
    // the record: the one we made (search can lag seconds behind a create), else search
    // as text: the kv store hands a numeric-looking id back as a number (rules.ts recordIdOf)
    let recordId = recordIdOf(await kvGet<unknown>(KV_RECORD));
    let found: string[] = [];
    try {
      found = await findRecords();
    } catch (e) {
      if (!recordId) throw e; // without the search we could create a second record
    }
    if (recordId) {
      try {
        const r = await hs<Obj>({ path: `/crm/v3/objects/${KPI_OBJECT}/${recordId}?properties=name` });
        if (r.properties?.name !== RECORD_NAME) recordId = null;
      } catch (e) {
        if (statusOf(e) !== 404) throw e;
        recordId = null;
      }
    }
    recordId ??= found[0] ?? null;
    recordId = await writeDoc(recordId, json);
    await kvSet(KV_RECORD, recordId);

    // read back: what HubSpot holds must be byte for byte what was sent
    const back = await hs<Obj>({ path: `/crm/v3/objects/${KPI_OBJECT}/${recordId}?properties=name,${DOC_PROPERTY}` });
    if (back.properties?.[DOC_PROPERTY] !== json) throw new Error("HubSpot did not keep the rules as sent (read back differs)");

    // a duplicate (two saves racing before this lock existed, a hand-made copy) is archived
    const extra = otherRecords(found, recordId);
    if (extra.length) {
      await hs({ path: `/crm/v3/objects/${KPI_OBJECT}/batch/archive`, method: "POST", body: { inputs: extra.map((id) => ({ id })) } })
        .catch((e) => console.warn(`[owner-rules] archiving duplicate rules records ${extra.join(",")}: ${msg(e)}`));
    }

    // the function finds the record by search: wait until the search sees it (index lag)
    let searchable = false;
    for (let i = 0; i < 6 && !searchable; i++) {
      if (i) await new Promise((r) => setTimeout(r, 2500));
      searchable = await findRecords().then((ids) => ids.some((x) => recordIdOf(x) === recordIdOf(recordId))).catch(() => false);
    }
    const state: PublishState = { at: doc.publishedAt, by, hash: doc.hash, rules: doc.rules.length, recordId, searchable };
    await kvSet(KV_PUBLISHED, state);
    await kvSet(KV_PUBLISH_ERROR, null);
    console.log(`[owner-rules] published ${doc.rules.length} rule(s) by ${by} to KPI record ${recordId}${searchable ? "" : " - NOT yet found by search"}`);
    return { ok: true, state, note: `Published to HubSpot: ${doc.rules.length} rule${doc.rules.length === 1 ? "" : "s"} on.` };
  } catch (e) {
    const error = msg(e);
    await kvSet(KV_PUBLISH_ERROR, { at: new Date().toISOString(), error }).catch(() => {});
    console.warn(`[owner-rules] publish by ${by} FAILED: ${error}`);
    return { ok: false, error };
  }
}

/** The last publish that failed, until one succeeds. */
export async function lastPublishError(): Promise<{ at: string; error: string } | null> {
  return (await kvGet<{ at: string; error: string } | null>(KV_PUBLISH_ERROR)) ?? null;
}

/* ── owners ────────────────────────────────────────────────────────────── */

export type Owner = { id: string; name: string; email: string | null; active: boolean; team: string | null };
type OwnerRow = { id: string | number; firstName?: string | null; lastName?: string | null; email?: string | null; teams?: { name?: string | null; primary?: boolean | null }[] | null };

let ownersCache: { at: number; owners: Owner[] } | null = null;

/**
 * Every HubSpot owner - the same /crm/v3/owners list Holiday redirection reads - and the
 * deactivated ones too: a person who left has an archived owner, and their companies
 * still carry that id, so they must be choosable as "from". Cached 10 minutes.
 */
export async function readOwners(force = false): Promise<Owner[]> {
  if (!force && ownersCache && Date.now() - ownersCache.at < 10 * 60_000) return ownersCache.owners;
  const out = new Map<string, Owner>();
  for (const archived of [false, true]) {
    let after: string | undefined;
    do {
      const j = await hs<{ results?: OwnerRow[]; paging?: { next?: { after?: string } } }>({
        path: `/crm/v3/owners?limit=100&archived=${archived}${after ? `&after=${after}` : ""}`,
      });
      for (const o of j.results ?? []) {
        const id = String(o.id);
        if (out.has(id)) continue;
        const teams = o.teams ?? [];
        out.set(id, {
          id, active: !archived, email: o.email ?? null,
          name: `${o.firstName ?? ""} ${o.lastName ?? ""}`.trim() || o.email || `owner ${id}`,
          team: (teams.find((t) => t.primary)?.name ?? teams[0]?.name ?? null) || null,
        });
      }
      after = j.paging?.next?.after;
    } while (after);
  }
  const owners = [...out.values()].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
  ownersCache = { at: Date.now(), owners };
  return owners;
}

/* ── what HubSpot says happened ────────────────────────────────────────── */

export type OwnerChange = {
  companyId: string; name: string | null; at: string; from: string | null; to: string;
  by: string; byThisApp: boolean;
};

let recentCache: { key: string; at: number; rows: OwnerChange[] } | null = null;

function sourceLabel(type: string | undefined, id: string | undefined): { by: string; app: boolean } {
  if (type === "INTEGRATION") {
    if (id === HUB_APP_ID) return { by: "SARCLA - APSOMarketingHub (this app)", app: true };
    if (id === FRANCE_APP_ID) return { by: "France owner app (old)", app: true };
    return { by: `Integration ${id ?? "?"}`, app: false };
  }
  if (type === "AUTOMATION_PLATFORM") return { by: "A workflow", app: false };
  if (type === "CRM_UI") return { by: "Someone in HubSpot", app: false };
  if (type === "IMPORT") return { by: "An import", app: false };
  return { by: (type ?? "unknown").toLowerCase().replace(/_/g, " "), app: false };
}

/**
 * The last owner changes onto the rules' target owners in the past days, from HubSpot's
 * own property history - so the page shows the instant corrections the HubSpot function
 * made too, which the hub never sees. At most 30 companies, cached 2 minutes.
 */
export async function recentOwnerChanges(rules: PubRule[], days = 7): Promise<OwnerChange[]> {
  const to = [...new Set(rules.map((r) => r.toOwner))].sort();
  if (!to.length) return [];
  const key = `${to.join(",")}|${days}`;
  if (recentCache && recentCache.key === key && Date.now() - recentCache.at < 2 * 60_000) return recentCache.rows;
  const j = await hs<Page>({
    path: "/crm/v3/objects/companies/search", method: "POST",
    body: {
      filterGroups: [{ filters: [
        { propertyName: "hubspot_owner_assigneddate", operator: "GTE", value: String(Date.now() - days * 86_400_000) },
        { propertyName: "hubspot_owner_id", operator: "IN", values: to },
      ] }],
      sorts: [{ propertyName: "hubspot_owner_assigneddate", direction: "DESCENDING" }],
      properties: ["name"], limit: 30,
    },
  });
  const ids = (j.results ?? []).map((r) => String(r.id));
  const rows: OwnerChange[] = [];
  if (ids.length) {
    type Hist = { value?: string; timestamp?: string; sourceType?: string; sourceId?: string };
    const b = await hs<{ results?: (Obj & { propertiesWithHistory?: Record<string, Hist[]> })[] }>({
      path: "/crm/v3/objects/companies/batch/read", method: "POST",
      body: { properties: ["name"], propertiesWithHistory: ["hubspot_owner_id"], inputs: ids.map((id) => ({ id })) },
    });
    for (const r of b.results ?? []) {
      const h = [...(r.propertiesWithHistory?.hubspot_owner_id ?? [])].sort((x, y) => String(y.timestamp ?? "").localeCompare(String(x.timestamp ?? "")));
      const last = h[0];
      if (!last?.value || !to.includes(String(last.value))) continue;
      const s = sourceLabel(last.sourceType, last.sourceId ? String(last.sourceId) : undefined);
      rows.push({
        companyId: String(r.id), name: r.properties?.name ?? null, at: String(last.timestamp ?? ""),
        from: h[1]?.value ? String(h[1].value) : null, to: String(last.value), by: s.by, byThisApp: s.app,
      });
    }
  }
  rows.sort((a, b) => b.at.localeCompare(a.at));
  recentCache = { key, at: Date.now(), rows };
  return rows;
}
