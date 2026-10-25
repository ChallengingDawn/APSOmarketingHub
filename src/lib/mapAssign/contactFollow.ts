// MAP ASSIGNMENT - contacts follow their company (SARCLA 24.10.2026: "On the contact page I don't see yet the steering
// module for the contact associations (when a contact's properties differ from the company's it should be corrected
// instantly as associated)" and "Can we correct all 'The latest that do not follow the rules'? If we are 100% sure
// that they don't follow the rules."). A contact gets its OWN company's owner and region responsibility as HubSpot has
// them now - nothing else: never the SAE, never the company, never a ticket. Three passes:
//   all     the companies whose contacts differ (contacts_mism > 0, the nightly full read's count), biggest first, at
//           most FOLLOW_COMPANIES; each company and its contacts read again first, only what differs written; the row's
//           contacts_mism then holds what is left (a contact HubSpot refused waits for the next nightly read)
//   new     the contacts created since the last pass (createdate, 10 minutes overlap, cursor in kv), read again by id -
//           on every engine run (15 minutes) while Automatic is on: "instantly as associated"
//   latest  the SURE ones among the new contacts of the last 30 days that do not follow the rules (sureClass: the
//           company follows the rules, the contact does not) - the company and the contact read again first; the not
//           sure ones are counted, never written; the KPI is then counted again from the same read
// At most FOLLOW_CAP contacts written a pass. A+P people are never touched; a company with no owner (or an owner who has
// left) keeps its contacts as they are; a company with no region leaves the contacts' region alone. Every write is
// logged in apsomh_map_assign_log (kind "contact-follow", before / after, by) - an undo puts "before" back.
// kv: mapAssign:contactFollow {auto, by, at} (default off), mapAssign:contactFollowLast (the last pass),
// mapAssign:contactFollowCursor (how far the "new" pass has read). One pass at a time over both copies of the hub:
// advisory lock 4107234 (the engine's run is 4107233). The pure part: follow.ts; the sure ones: contacts.ts sureClass.

import type { PoolClient } from "pg";
import { getPool, query } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
// used inside functions only - engine.ts calls followOnRun() from its run(), a cycle that is safe at runtime
import { batchRead, companyContacts, ensureMapAssign, internal as internalPeople, owners, writeBatch } from "./engine";
import { companiesOf, readNewContacts, saveNewContacts } from "./contactsKpi";
import { sureClass, type NewContactRow, type NewContactsKpi } from "./contacts";
import { isInternal, ownContacts, type Internal } from "./plan";
import {
  FOLLOW_CAP, FOLLOW_COMPANIES, companyFollowsRules, followTarget, notSureTotal, ownCompanyOf, planFollow,
  type ContactFollow, type FollowContact, type FollowLast, type FollowNow, type FollowPending, type FollowScope, type FollowSwitch, type FollowTarget, type FollowWrite,
} from "./follow";

const LOCK = 4_107_234;
const KV = {
  switch: "mapAssign:contactFollow", last: "mapAssign:contactFollowLast", cursor: "mapAssign:contactFollowCursor",
  /** the pass going: how far it is (SARCLA 24.10.2026: "A pass is going ... No pass yet - this is not moving") */
  now: "mapAssign:contactFollowNow",
  /** "Correct now" not finished yet (cut by its time limit or a restart): {by, at} - the engine's runs carry on until no
   *  contact is left (SARCLA 24.10.2026: "it doesn't progress?" - one pass stopped at 2,000 and nothing went on) */
  rest: "mapAssign:contactFollowRest",
};
/** "new": HubSpot's search index trails a create, and the company is often associated a few minutes after the contact. */
const NEW_OVERLAP_MS = 10 * 60_000;
/** The first "new" pass (no cursor yet) looks back an hour - the older ones are the "all" pass's; never more than a day. */
const NEW_FIRST_MS = 60 * 60_000;
const NEW_MAX_BACK_MS = 24 * 3600_000;
/** "new": 200 a page - past this the pass stops short and the next one reads the same window again. */
const NEW_PAGES = 25;
/** A "Correct now" is stopped after this long (its lock dropped); it works batch after batch for MANUAL_WORK_MS, then
 *  the engine's runs carry on (REST_WORK_MS a run) until none is left. */
const MANUAL_LIMIT_MS = 50 * 60_000;
const MANUAL_WORK_MS = 40 * 60_000;
const REST_WORK_MS = 8 * 60_000;
const AUTO_BY = "contacts follow (automatic)";
const CONTACT_PROPS = ["email", "hubspot_owner_id", "region_responsibility", "associatedcompanyid"];
const COMPANY_PROPS = ["hubspot_owner_id", "region_responsibility"];

type Props = Record<string, string | null>;
type Page = { results?: { id: string; properties?: Props }[] };
const nz = (x: unknown) => { const s = String(x ?? "").trim(); return s ? s : null; };
const msg = (e: unknown) => String((e as Error)?.message ?? e).replace(/\s+/g, " ").slice(0, 200);

/* ── the switch ────────────────────────────────────────────────────────── */

export async function getFollow(): Promise<FollowSwitch> {
  const x = await kvGet<Partial<FollowSwitch>>(KV.switch);
  return { auto: x?.auto === true, by: x?.by ?? null, at: x?.at ?? null };
}
/** PUT {contactFollow: {auto}} - from the next engine run on (or off). */
export async function saveFollow(auto: boolean, by: string): Promise<FollowSwitch> {
  const next: FollowSwitch = { auto, by, at: new Date().toISOString() };
  await kvSet(KV.switch, next);
  return next;
}
/** "Correct now" still to finish: who asked, when; null = nothing left to carry on. */
export async function getRest(): Promise<{ by: string; at: string } | null> {
  const x = await kvGet<{ by?: string; at?: string } | null>(KV.rest);
  return x?.at ? { by: String(x.by ?? ""), at: String(x.at) } : null;
}
/** PUT {contactFollow: {rest: false}} - stop carrying on (an admin); a pass going ends after its batch. */
export async function stopRest(): Promise<void> { await kvSet(KV.rest, null); }

/* ── one pass ──────────────────────────────────────────────────────────── */

type Pass = {
  scope: FollowScope | "auto"; by: string; signal?: AbortSignal; internal: Internal;
  /** the owners who have not left: a company owned by someone else keeps its contacts as they are */
  active: Set<string>;
  /** contacts still to be written this pass (FOLLOW_CAP at the start) */
  budget: number;
  checked: number; wrote: number; failed: number; left: number; companies: number; notSure: number;
  /** when it started (ISO) */
  at: string;
  /** the companies looked at in this pass - a batch never takes one twice */
  seen: Set<string>;
};
const stop = (p: Pass) => { if (p.signal?.aborted) throw new Error("stopped: the time limit"); };

const contactOf = (id: string, x: Props | undefined): FollowContact =>
  ({ id: String(id), email: nz(x?.email), owner: nz(x?.hubspot_owner_id), region: nz(x?.region_responsibility) });

/** A company as HubSpot has it now -> what its contacts should have; null = not found, no owner, or one who has left. */
function targetOf(p: Pass, co: Props | undefined): FollowTarget | null {
  const t = co ? followTarget({ owner: co.hubspot_owner_id, region: co.region_responsibility }) : null;
  return t && p.active.has(t.owner) ? t : null;
}

/** One company's plan counted into the pass. */
function plan(p: Pass, companyId: string, t: FollowTarget | null, list: FollowContact[]): FollowWrite[] {
  const x = planFollow(companyId, t, list, p.internal, p.budget);
  p.checked += x.checked; p.left += x.left; p.budget -= x.writes.length; p.companies++;
  return x.writes;
}

type LogRow = { kind: "contact-follow"; object_id: string; company_id: string; before: unknown; after: unknown; error: string | null; by: string };
async function log(rows: LogRow[]): Promise<void> {
  if (!rows.length) return;
  await query(
    `INSERT INTO apsomh_map_assign_log (kind, object_id, company_id, before, after, error, by)
     SELECT x.kind, x.object_id, x.company_id, x.before, x.after, x.error, x.by
     FROM jsonb_to_recordset($1::jsonb) AS x(kind text, object_id text, company_id text, before jsonb, after jsonb, error text, by text)`,
    [JSON.stringify(rows)],
  );
}

/** How far the pass is, for the page (kv, after every hundred): started, by whom, counted so far. */
const progress = (p: Pass) => kvSet(KV.now, { at: p.at, scope: p.scope, by: p.by, checked: p.checked, wrote: p.wrote, failed: p.failed, companies: p.companies, seen: new Date().toISOString() } satisfies FollowNow).catch(() => {});

/** Written 100 at a time (writeBatch: a failed batch record by record), each hundred logged at once - a refusal
 *  (401/403) stops the pass with everything written before it logged. The ids HubSpot did not take come back. */
async function write(p: Pass, writes: FollowWrite[]): Promise<Set<string>> {
  const failed = new Set<string>();
  for (let i = 0; i < writes.length; i += 100) {
    stop(p);
    const chunk = writes.slice(i, i + 100);
    const res = await writeBatch("contacts", chunk.map((w) => ({ id: w.id, properties: w.properties })));
    await log(chunk.map((w) => ({ kind: "contact-follow", object_id: w.id, company_id: w.company, before: w.before, after: w.properties, error: res.get(w.id) ?? null, by: p.by })));
    for (const w of chunk) {
      if (res.get(w.id)) { failed.add(w.id); p.failed++; } else p.wrote++;
    }
    await progress(p);
  }
  if (!writes.length) await progress(p); // a hundred companies looked at, nothing to write: still moving
  return failed;
}

/** "all", one batch: the companies whose contacts differ, biggest first (none looked at before in this pass) - each read
 *  again with its own contacts (ownContacts). Answers how many companies it took: 0 = none is left. */
async function passAll(p: Pass, maxCompanies: number): Promise<number> {
  if (p.budget <= 0) return 0;
  const r = await query<{ company_id: string }>(
    `SELECT company_id FROM apsomh_map_assign WHERE contacts_mism > 0 AND owner_now = ANY($1::text[]) AND NOT (company_id = ANY($3::text[]))
     ORDER BY contacts_mism DESC, company_id LIMIT $2`,
    [[...p.active], maxCompanies, [...p.seen]],
  );
  const ids = r.rows.map((x) => String(x.company_id));
  for (const id of ids) p.seen.add(id);
  for (let i = 0; i < ids.length && p.budget > 0; i += 100) {
    stop(p);
    const part = ids.slice(i, i + 100);
    const fresh = await batchRead("companies", part, COMPANY_PROPS);
    const assoc = await companyContacts(part);
    const props = await batchRead("contacts", [...new Set([...assoc.values()].flat())], CONTACT_PROPS);
    const mine = ownContacts(part, assoc, (id) => { const x = props.get(id); return x ? nz(x.associatedcompanyid) : undefined; });
    const writes: FollowWrite[] = [];
    const left = new Map<string, number>();
    for (const id of part) {
      const t = targetOf(p, fresh.get(id));
      // gone, nobody, or someone who has left (the table's owner is older than HubSpot's): nothing to correct here - the
      // next nightly read counts it again, so the batches end
      if (!t) { left.set(id, 0); continue; }
      const before = p.left;
      writes.push(...plan(p, id, t, (mine.get(id) ?? []).map((c) => contactOf(c, props.get(c)))));
      left.set(id, p.left - before);
    }
    await write(p, writes);
    // what is left to correct; a contact HubSpot refused is not counted - it waits for the next nightly read instead of
    // being tried every 15 minutes (the nightly read counts again, by its own measure)
    if (left.size) {
      await query(
        `UPDATE apsomh_map_assign m SET contacts_mism = x.n FROM jsonb_to_recordset($1::jsonb) AS x(id text, n int) WHERE m.company_id = x.id`,
        [JSON.stringify([...left].map(([id, n]) => ({ id, n })))],
      );
      // a company the batch's 2,000 ran out on is taken again by the next batch (which starts with 2,000 more)
      for (const [id, n] of left) if (n > 0) p.seen.delete(id);
    }
  }
  return ids.length;
}

/** "all" batch after batch (FOLLOW_CAP contacts, FOLLOW_COMPANIES companies each) until none is left or `workMs` has
 *  gone (or "stop" was asked); true = none is left. */
async function passAllUntil(p: Pass, workMs: number, stopped: () => Promise<boolean>): Promise<boolean> {
  const until = Date.now() + workMs;
  for (;;) {
    p.budget = FOLLOW_CAP;
    const n = await passAll(p, FOLLOW_COMPANIES);
    if (n === 0) return true;
    if (Date.now() > until || (await stopped())) return false;
  }
}

/** contact id -> the companies that list it (v4), in HubSpot's order. */
async function contactCompanies(ids: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  for (let i = 0; i < ids.length; i += 100) {
    const j = await hubspotRetry<{ results?: { from: { id: string }; to?: { toObjectId: string | number }[] }[] }>({
      path: "/crm/v4/associations/contacts/companies/batch/read", method: "POST", body: { inputs: ids.slice(i, i + 100).map((id) => ({ id })) },
    });
    for (const r of j.results ?? []) out.set(String(r.from.id), (r.to ?? []).map((x) => String(x.toObjectId)));
  }
  return out;
}

/** "new": the contacts created since the last pass, read again by id, each against its own company read now. */
async function passNew(p: Pass): Promise<void> {
  const t0 = Date.now();
  const cur = Number(await kvGet<number>(KV.cursor));
  const since = Math.max(Number.isFinite(cur) && cur > 0 ? cur - NEW_OVERLAP_MS : t0 - NEW_FIRST_MS, t0 - NEW_MAX_BACK_MS);
  const found: string[] = [];
  let after = "0", complete = false;
  for (let page = 0; page < NEW_PAGES; page++) {
    stop(p);
    const j = await hubspotRetry<Page>({
      path: "/crm/v3/objects/contacts/search", method: "POST",
      body: {
        filterGroups: [{ filters: [
          { propertyName: "createdate", operator: "GTE", value: String(since) },
          { propertyName: "hs_object_id", operator: "GT", value: after },
        ] }],
        sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }], properties: ["createdate"], limit: 200,
      },
    });
    const res = j.results ?? [];
    found.push(...res.map((o) => String(o.id)));
    if (res.length < 200) { complete = true; break; }
    after = String(res[res.length - 1].id);
  }
  const leftBefore = p.left;
  if (found.length) {
    // read again by id - the search index trails a write (HubSpot's own owner copy lands within seconds)
    const props = await batchRead("contacts", [...new Set(found)], CONTACT_PROPS);
    const loose = [...props].filter(([, x]) => !nz(x.associatedcompanyid)).map(([id]) => id);
    const listed = loose.length ? await contactCompanies(loose) : new Map<string, string[]>();
    const byCompany = new Map<string, FollowContact[]>();
    for (const [id, x] of props) {
      const co = ownCompanyOf(x.associatedcompanyid, listed.get(id) ?? []);
      if (!co) continue; // no company: the No company tab
      const list = byCompany.get(co) ?? [];
      list.push(contactOf(id, x));
      byCompany.set(co, list);
    }
    const ids = [...byCompany.keys()];
    for (let i = 0; i < ids.length && p.budget > 0; i += 100) {
      stop(p);
      const part = ids.slice(i, i + 100);
      const fresh = await batchRead("companies", part, COMPANY_PROPS);
      const writes: FollowWrite[] = [];
      for (const id of part) writes.push(...plan(p, id, targetOf(p, fresh.get(id)), byCompany.get(id) ?? []));
      await write(p, writes);
    }
  }
  // read up to here - unless the pass stopped short (the page limit, the cap): the next one reads the window again
  if (complete && p.left === leftBefore && p.budget > 0) await kvSet(KV.cursor, t0);
}

/** "latest": the sure ones among the new contacts of the last 30 days that do not follow the rules. */
async function passLatest(p: Pass): Promise<void> {
  const read = await readNewContacts(p.signal);
  const companies = await companiesOf(read.rows);
  const sure = new Map<string, NewContactRow[]>(); // company -> its sure new contacts
  for (const r of read.rows) {
    if (isInternal(r.email, p.internal)) continue;
    const cid = nz(r.companyId);
    const s = sureClass(r, cid ? companies.get(cid) : undefined);
    if (s === "sure") { const list = sure.get(cid!) ?? []; list.push(r); sure.set(cid!, list); }
    else if (s) p.notSure++;
  }
  const byId = new Map(read.rows.map((r) => [String(r.id), r]));
  const ids = [...sure.keys()];
  try {
    await correctSure(p, ids, sure, companies, byId);
  } finally {
    // counted again from the same read, also when the pass stopped short: the corrected ones follow the rules now, the
    // button shows what is left
    await saveNewContacts(read, p.internal, companies).catch((e) => console.warn(`[map-assign] new contacts not counted again: ${msg(e)}`));
  }
}

/** The sure ones, 100 companies at a time: the company and its sure contacts read again, written only while still sure;
 *  the read's rows take what HubSpot has now and what was written (the count after the pass starts from them). */
async function correctSure(p: Pass, ids: string[], sure: Map<string, NewContactRow[]>, companies: Map<string, { decided: string }>, byId: Map<string, NewContactRow>): Promise<void> {
  for (let i = 0; i < ids.length && p.budget > 0; i += 100) {
    stop(p);
    const part = ids.slice(i, i + 100);
    const fresh = await batchRead("companies", part, COMPANY_PROPS);
    const props = await batchRead("contacts", part.flatMap((id) => (sure.get(id) ?? []).map((r) => String(r.id))), CONTACT_PROPS);
    // the count below starts from what HubSpot has now
    for (const [id, x] of props) {
      const r = byId.get(id);
      if (r) { r.owner = nz(x.hubspot_owner_id); r.region = nz(x.region_responsibility); r.companyId = nz(x.associatedcompanyid); }
    }
    const writes: FollowWrite[] = [];
    for (const id of part) {
      const list = sure.get(id) ?? [];
      const co = fresh.get(id);
      // still sure: the company, read again, still has the owner and region the rules give it
      if (!co || !companyFollowsRules({ owner: co.hubspot_owner_id, region: co.region_responsibility }, companies.get(id)?.decided)) { p.notSure += list.length; continue; }
      // and each contact, read again, still has it as its company
      const mine = list.filter((r) => nz(props.get(String(r.id))?.associatedcompanyid) === id).map((r) => contactOf(String(r.id), props.get(String(r.id))));
      writes.push(...plan(p, id, targetOf(p, co), mine));
    }
    const failed = await write(p, writes);
    for (const w of writes) {
      const r = byId.get(w.id);
      if (!r || failed.has(w.id)) continue;
      if (w.properties.hubspot_owner_id) r.owner = w.properties.hubspot_owner_id;
      if (w.properties.region_responsibility) r.region = w.properties.region_responsibility;
    }
  }
}

let busy = false;

/** One pass under the lock; null = another one is going (on the other copy of the hub). The last pass is kept in kv. */
async function pass(scope: FollowScope | "auto", by: string, signal?: AbortSignal, known?: Internal, carry?: "manual" | "rest"): Promise<FollowLast | null> {
  await ensureMapAssign();
  const client: PoolClient = await getPool().connect();
  let dropped = false;
  const drop = () => { dropped = true; client.release(new Error("contacts follow: time limit")); };
  if (signal?.aborted) drop(); else signal?.addEventListener("abort", drop, { once: true });
  try {
    if (dropped) return null;
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [LOCK]);
    if (!got.rows[0]?.ok) return null;
    const t0 = Date.now();
    const p: Pass = { scope, by, signal, internal: { domains: new Set(), emails: new Set() }, active: new Set(), budget: FOLLOW_CAP, checked: 0, wrote: 0, failed: 0, left: 0, companies: 0, notSure: 0, at: new Date(t0).toISOString(), seen: new Set() };
    let error: string | undefined;
    await progress(p);
    try {
      p.internal = known ?? (await internalPeople());
      p.active = (await owners()).active;
      if (scope === "new" || scope === "auto") await passNew(p);
      if (scope === "all" && carry) {
        // "Correct now": batch after batch until none is left - what is not done in time is carried on by the engine's
        // runs (kv rest) until none is left; an admin's "stop" ends it after the batch going
        // (kickFollow set kv rest before the start, so a restart mid-way is carried on too; an admin's stop clears it)
        const done = await passAllUntil(p, carry === "manual" ? MANUAL_WORK_MS : REST_WORK_MS, async () => !(await getRest()));
        if (done) await kvSet(KV.rest, null);
      } else if (scope === "all" || scope === "auto") await passAll(p, FOLLOW_COMPANIES);
      if (scope === "latest") await passLatest(p);
    } catch (e) {
      error = msg(e);
    } finally {
      if (!dropped) await client.query("SELECT pg_advisory_unlock($1)", [LOCK]).catch(() => {});
    }
    const last: FollowLast = {
      at: new Date(t0).toISOString(), scope, by, checked: p.checked, wrote: p.wrote, failed: p.failed, left: p.left, companies: p.companies,
      seconds: Math.round((Date.now() - t0) / 1000), ...(scope === "latest" ? { notSure: p.notSure } : {}), ...(error ? { error } : {}),
    };
    await kvSet(KV.last, last).catch(() => {});
    await kvSet(KV.now, null).catch(() => {});
    if (p.wrote || p.failed || error) console.log(`[map-assign] contacts follow (${scope}): ${p.wrote} written, ${p.failed} not${error ? ` - ${error}` : ""}`);
    return last;
  } finally {
    signal?.removeEventListener("abort", drop);
    if (!dropped) client.release();
  }
}

/** The engine's run (engine.ts run(), every 15 minutes, right after the new contacts' count): while Automatic is on,
 *  the contacts created since the last pass, then a batch of the rest. A "Correct now" going = skipped this time. */
export async function followOnRun(signal?: AbortSignal, known?: Internal): Promise<void> {
  if (busy) return;
  const [sw, rest] = [await getFollow(), await getRest()];
  if (!sw.auto && !rest) return;
  busy = true;
  try {
    // Automatic: the new contacts and a batch of the rest; a "Correct now" not finished: carried on until none is left
    if (sw.auto) await pass("auto", AUTO_BY, signal, known);
    if (rest) await pass("all", `${rest.by} (Correct now, carried on)`, signal, known, "rest");
  } finally {
    busy = false;
  }
}

/** "Correct now" / "Correct the sure ones": a pass in the background. False = one is going already (here). */
export function kickFollow(scope: "all" | "latest", by: string): boolean {
  if (busy) return false;
  busy = true;
  const limit = new AbortController();
  const timer = setTimeout(() => {
    console.error(`[map-assign] contacts follow still going after ${MANUAL_LIMIT_MS / 60_000} min - stopped and its lock dropped`);
    limit.abort();
    busy = false;
  }, MANUAL_LIMIT_MS);
  timer.unref?.();
  // a pass going is cut by the time limit: what is left is carried on by the engine's runs (kv rest)
  if (scope === "all") void kvSet(KV.rest, { by, at: new Date().toISOString() }).catch(() => {});
  void pass(scope, by, limit.signal, undefined, scope === "all" ? "manual" : undefined)
    .then((last) => { if (!last) console.warn("[map-assign] contacts follow: a pass is going on the other copy - not started"); })
    .catch((e) => console.warn(`[map-assign] contacts follow: ${msg(e)}`))
    .finally(() => { clearTimeout(timer); if (!limit.signal.aborted) busy = false; });
  return true;
}

/** Is a pass going - here, or on the other copy of the hub (its advisory lock)? */
export async function isFollowRunning(): Promise<boolean> {
  if (busy) return true;
  const r = await query<{ held: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND classid = 0 AND objid = $1::bigint::oid AND objsubid = 1 AND granted) AS held`, [LOCK],
  );
  return !!r.rows[0]?.held;
}

/* ── the page (GET ?contacts=1 -> follow) ──────────────────────────────── */

/** The switch, the last pass, the contacts that differ from their company (the table, per country) and the sure / not
 *  sure ones of the new contacts' count (`kpi`, hourly). `countedAt`: the last nightly full read. No HubSpot call. */
export async function followData(kpi: NewContactsKpi | null, countedAt: string | null): Promise<ContactFollow> {
  await ensureMapAssign();
  const sw = await getFollow();
  const last = (await kvGet<FollowLast>(KV.last)) ?? null;
  const running = await isFollowRunning().catch(() => false);
  // how far the pass going is - only while one is going (a pass cut by a restart leaves its last count behind)
  const now = running ? ((await kvGet<FollowNow | null>(KV.now).catch(() => null)) ?? null) : null;
  const r = await query<{ country: string; owner: string | null; companies: number; contacts: number }>(
    `SELECT COALESCE(country, '??') AS country, owner_now AS owner, count(*)::int AS companies, COALESCE(sum(contacts_mism), 0)::int AS contacts
     FROM apsomh_map_assign WHERE contacts_mism > 0 GROUP BY 1, 2 ORDER BY 4 DESC, 1`,
  );
  // a company whose owner has left is never corrected (its contacts would get someone who has left) - counted apart,
  // so "Correct all now" can end at 0 (SARCLA 25.10.2026: "Correct all now but still 2 Polish stay" - Paulina Bozek's)
  const active = await owners().then((o) => o.active).catch(() => null);
  const pending: FollowPending = { contacts: 0, companies: 0, byCountry: {}, at: countedAt, noOwner: { contacts: 0, companies: 0 }, ownerLeft: { contacts: 0, companies: 0, owners: [] } };
  const leftBy = new Map<string, number>();
  for (const x of r.rows) {
    const n = Number(x.contacts) || 0, c = Number(x.companies) || 0;
    if (!x.owner) { pending.noOwner.contacts += n; pending.noOwner.companies += c; continue; }
    if (active && !active.has(String(x.owner))) {
      pending.ownerLeft!.contacts += n; pending.ownerLeft!.companies += c;
      leftBy.set(String(x.owner), (leftBy.get(String(x.owner)) ?? 0) + n);
      continue;
    }
    pending.contacts += n; pending.companies += c;
    pending.byCountry[String(x.country)] = (pending.byCountry[String(x.country)] ?? 0) + n;
  }
  pending.ownerLeft!.owners = [...leftBy].map(([owner, contacts]) => ({ owner, contacts })).sort((a, b) => b.contacts - a.contacts);
  const known = typeof kpi?.sure === "number" && !!kpi?.notSure;
  return {
    ...sw, last, running, now, pending, cap: FOLLOW_CAP, rest: await getRest().catch(() => null),
    latest: { sure: known ? kpi!.sure! : 0, notSure: known ? notSureTotal(kpi!.notSure) : 0, why: known ? kpi!.notSure! : null, known, at: kpi?.at ?? null },
  };
}
