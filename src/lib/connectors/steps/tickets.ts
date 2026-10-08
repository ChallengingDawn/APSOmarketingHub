// GROUP 2 - TICKETS, moved from the Compass connector into the hub:
//   wrong_owners   a ticket in the wrong pipeline for its owner is moved, renamed and
//                  given back its title once a human has taken it over (every 30 minutes)
//   deputy_sweep   ESO customer tickets of an out-of-office owner -> deputy 1 -> deputy 2
//   ticket_assoc   tickets linked to their orders and P&P articles, empty reference
//                  fields filled, C2S flagged - a sweep over a window, and one ticket
// Each runs as a PREVIEW (reads, reports what it would write, writes nothing) or LIVE
// (writes only what changes, 100 at a time, a failing batch counted and the rest still
// going). Rules in ./ticketRules.ts, tested; this file is the I/O, ported from
// service/wrong_owners.py, deputy_sweep.py and ticket_assoc.py.

import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { IntegrationError } from "@/lib/integrations/status";
import type { StepResult } from "./companyFacts";
import {
  ASSOC_FIELDS, ASSOC_PIPELINES, BO, DEPUTY_PIPELINE, DEPUTY_STAGES, ESO, ORDER_PROPS, PIPE_NAME, PP_ASSOC_TYPE, PP_OBJ, TSA, USER_PROPS,
  WRONG_OWNER_PROPS, absorbArticles, addOwners, articleCandidates, articleSearchValues, articlesFromCache, articlesToCheck, assocPlan,
  companyKey, createdMsIso, deputyDecision, deputyNote, foundOrder, hasArticleType, hasDefaultType, mentionsC2S, offerHit, offerSearch,
  orderRefs, pySlice, pySorted, rememberMissing, stageIndex, ticketBlob, userState, utcDay, wantedOrderNumbers, wrongOwnerAction,
  wrongOwnerSearch, type AssocPlan, type FoundOrder, type OfferHit, type OwnerInfo, type Props, type UserState,
} from "./ticketRules";

type Obj = { id: string; properties?: Props };
type Page<T = Obj> = { results?: T[]; total?: number; paging?: { next?: { after?: string } } };
type Beat = () => Promise<void>;
type Row = { id: string; properties: Record<string, string> };

const statusOf = (e: unknown): number | null => (e instanceof IntegrationError ? e.status : null);
const msg = (e: unknown): string => (e as Error)?.message?.slice(0, 160) ?? String(e);

/** Ticket calls go with TICKETS_TOKEN when one is set (the connector's TICKETS_TOKEN / DEPUTY_TICKETS_TOKEN), else the hub's own. */
const tix = <T>(path: string, method: "GET" | "POST" | "PATCH" | "PUT" = "GET", body?: unknown) =>
  hubspotFetchJson<T>({ path, method, body, useTicketsToken: true });
const crm = <T>(path: string, method: "GET" | "POST" = "GET", body?: unknown) => hubspotFetchJson<T>({ path, method, body });

/**
 * Tickets batch update, 100 at a time. A failing batch is counted and the rest still go;
 * a 207 names the rows that went through. Returns the ids written.
 */
async function updateTickets(rows: Row[]): Promise<{ ok: Set<string>; written: number; failed: number; errors: string[] }> {
  const ok = new Set<string>();
  let failed = 0;
  const errors: string[] = [];
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    try {
      const j = await tix<{ results?: { id: string }[] }>("/crm/v3/objects/tickets/batch/update", "POST", { inputs: chunk });
      const got = j.results ? new Set(j.results.map((r) => String(r.id))) : null;
      for (const r of chunk) {
        if (!got || got.has(r.id)) ok.add(r.id);
        else failed += 1;
      }
      if (got && got.size < chunk.length && errors.length < 3) errors.push(`batch ${i / 100 + 1}: ${chunk.length - got.size} not written`);
    } catch (e) {
      failed += chunk.length;
      if (errors.length < 3) errors.push(msg(e));
    }
  }
  return { ok, written: ok.size, failed, errors };
}

/* ── 1. wrong owners ───────────────────────────────────────────────────── */

/**
 * The four wrong_owner_* ticket properties. The connector created them when missing;
 * the hub's app only reads ticket schemas (crm.schemas.tickets.read), so it cannot.
 */
async function missingWrongOwnerProps(): Promise<string[]> {
  const missing: string[] = [];
  for (const name of WRONG_OWNER_PROPS) {
    try {
      await tix(`/crm/v3/properties/tickets/${name}`);
    } catch (e) {
      if (statusOf(e) === 404) missing.push(name);
      else throw e;
    }
  }
  return missing;
}

async function allOwners(): Promise<Map<string, OwnerInfo>> {
  const out = new Map<string, OwnerInfo>();
  let after: string | undefined;
  for (;;) {
    const j = await crm<Page<Parameters<typeof addOwners>[1][number]>>(`/crm/v3/owners?limit=100&archived=false${after ? `&after=${after}` : ""}`);
    addOwners(out, j.results ?? []);
    after = j.paging?.next?.after;
    if (!after) return out;
  }
}

export async function wrongOwners(live: boolean, beat: Beat): Promise<StepResult> {
  const t0 = Date.now();
  const missing = await missingWrongOwnerProps();
  if (live && missing.length) {
    throw new Error(
      `ticket properties missing: ${missing.join(", ")} - the hub's app cannot create ticket properties (crm.schemas.tickets.read only). ` +
      `Create them in HubSpot (group "wrong_owner", single-line text) and run again; nothing was written.`,
    );
  }
  const who = await allOwners();
  const stages = stageIndex((await tix<{ results?: Parameters<typeof stageIndex>[0] }>("/crm/v3/pipelines/tickets")).results ?? []);
  if (!who.size || !stages.size) throw new Error("could not read owners or pipelines");
  const nowIso = `${new Date().toISOString().slice(0, 19)}Z`;
  const flags: (Row & { from: string; to: string; reason: string; subject: string })[] = [];
  const restores: (Row & { why: string; subject: string })[] = [];
  let read = 0, skippedCampaign = 0, pages = 0;
  for (const pid of [BO, ESO, TSA]) {
    let cursor = "0";
    for (;;) {
      // an id cursor instead of paging: HubSpot's search stops at 10,000 results
      const j = await tix<Page>("/crm/v3/objects/tickets/search", "POST", wrongOwnerSearch(pid, stages, cursor, !missing.includes("wrong_owner_flagged_at")));
      const res = j.results ?? [];
      if (!res.length) break;
      for (const t of res) {
        read += 1;
        const a = wrongOwnerAction(t.properties ?? {}, stages, who, nowIso);
        if (a.kind === "campaign") skippedCampaign += 1;
        else if (a.kind === "restore") restores.push({ id: t.id, properties: a.props, why: a.why, subject: a.subject });
        else if (a.kind === "flag") flags.push({ id: t.id, properties: a.props, from: a.from, to: a.to, reason: a.reason, subject: a.subject });
      }
      cursor = res[res.length - 1].id;
      if (++pages % 20 === 0) await beat();
    }
  }
  const out: StepResult = {
    scope: [BO, ESO, TSA].map((p) => PIPE_NAME[p]), dry_run: !live, missing_properties: missing,
    tickets_open_or_flagged: read, flagged: flags.length, restored: restores.length, skipped_campaign: skippedCampaign, failed: 0,
  };
  let flagged = flags, restored = restores;
  if (live && (flags.length || restores.length)) {
    const w = await updateTickets([...restores, ...flags].map(({ id, properties }) => ({ id, properties })));
    flagged = flags.filter((f) => w.ok.has(f.id));
    restored = restores.filter((r) => w.ok.has(r.id));
    Object.assign(out, { flagged: flagged.length, restored: restored.length, failed: w.failed, errors: w.errors });
  }
  const byMove: Record<string, number> = {};
  for (const f of flagged) byMove[`${f.from} -> ${f.to}`] = (byMove[`${f.from} -> ${f.to}`] ?? 0) + 1;
  out.by_move = byMove;
  out.examples = [
    ...flagged.slice(0, 20).map((f) => ({ action: "flag", id: f.id, from: f.from, to: f.to, reason: f.reason, subject: f.subject })),
    ...restored.slice(0, 20).map((r) => ({ action: "restore", id: r.id, why: r.why, subject: r.subject })),
  ];
  return { ...out, seconds: Math.round((Date.now() - t0) / 1000) };
}

/* ── 2. deputy sweep ───────────────────────────────────────────────────── */

export type DeputyOptions = { tsaFallback?: boolean };

export async function deputySweep(live: boolean, beat: Beat, opts: DeputyOptions = {}): Promise<StepResult> {
  const t0 = Date.now();
  const tsaFallback = opts.tsaFallback ?? process.env.DEPUTY_TSA_FALLBACK === "1";
  const tickets: Obj[] = [];
  let cursor = "0";
  for (;;) {
    const j = await tix<Page>("/crm/v3/objects/tickets/search", "POST", {
      filterGroups: [{ filters: [
        { propertyName: "hs_pipeline", operator: "EQ", value: DEPUTY_PIPELINE },
        { propertyName: "hs_pipeline_stage", operator: "IN", values: DEPUTY_STAGES },
        { propertyName: "hs_object_id", operator: "GT", value: cursor },
      ] }],
      sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }],
      properties: ["subject", "hubspot_owner_id", "hs_pipeline_stage", "createdate"],
      limit: 200,
    });
    const res = j.results ?? [];
    if (!res.length) break;
    tickets.push(...res);
    cursor = res[res.length - 1].id;
  }
  await beat();

  // users, looked up as the rules ask for them; a user that cannot be read is unusable
  const users = new Map<string, UserState>();
  let lookups = 0, lookupFailed = 0;
  const load = async (id: string) => {
    lookups += 1;
    let props: Props | null = null;
    try {
      const j = await crm<Page>("/crm/v3/objects/users/search", "POST", {
        filterGroups: [{ filters: [{ propertyName: "hubspot_owner_id", operator: "EQ", value: id }] }], properties: USER_PROPS, limit: 1,
      });
      props = j.results?.[0]?.properties ?? null;
    } catch (e) {
      const st = statusOf(e);
      if (st === 401 || st === 403) {
        throw new Error(`users search refused (${st}): the hub's app needs crm.objects.users.read to see who is out of office - nothing was moved`);
      }
      lookupFailed += 1;
    }
    users.set(id, userState(id, props, Date.now()));
  };

  const moves: (Row & { from: string; to: string; reason: string; subject: string })[] = [];
  let system = 0, beforeWindow = 0, noWindow = 0;
  for (const t of tickets) {
    const p = t.properties ?? {};
    let d = deputyDecision(p, (id) => users.get(id), tsaFallback);
    while ("need" in d) {
      await load(d.need);
      d = deputyDecision(p, (id) => users.get(id), tsaFallback);
    }
    if (d.kind === "system") system += 1;
    else if (d.kind === "before_window") beforeWindow += 1;
    else if (d.kind === "no_window") noWindow += 1;
    else if (d.kind === "move") {
      moves.push({ id: t.id, properties: d.props, from: p.hubspot_owner_id ?? "", to: d.to, reason: d.reason, subject: pySlice(p.subject || "", 70) });
    }
  }
  const out: StepResult = {
    dry: !live, scanned: tickets.length, moved: moves.length, system_kept: system, older_than_absence: beforeWindow,
    // DELIBERATE: out of office without an absence window holding "now" - the connector moved them all
    no_absence_window: noWindow, tsa_fallback: tsaFallback, user_lookups: lookups, user_lookup_failed: lookupFailed,
  };
  if (live && moves.length) {
    const w = await updateTickets(moves.map(({ id, properties }) => ({ id, properties })));
    const done = moves.filter((m) => w.ok.has(m.id));
    // the note, now on the v3 notes API: note -> ticket, HUBSPOT_DEFINED 228
    let notes = 0, notesFailed = 0;
    for (let i = 0; i < done.length; i += 100) {
      const chunk = done.slice(i, i + 100);
      try {
        await tix("/crm/v3/objects/notes/batch/create", "POST", {
          inputs: chunk.map((m) => ({
            properties: { hs_timestamp: new Date().toISOString(), hs_note_body: deputyNote(m.from, m.to, m.reason) },
            associations: [{ to: { id: m.id }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 228 }] }],
          })),
        });
        notes += chunk.length;
      } catch (e) {
        notesFailed += chunk.length;
        if (w.errors.length < 3) w.errors.push(`notes: ${msg(e)}`);
      }
    }
    Object.assign(out, { moved: done.length, failed: w.failed, notes_written: notes, notes_failed: notesFailed, errors: w.errors });
  }
  out.examples = moves.slice(0, 50).map(({ id, from, to, reason, subject }) => ({ ticket: id, from, to, reason, subject }));
  return { ...out, ran_at: new Date().toISOString(), seconds: Math.round((Date.now() - t0) / 1000) };
}

/* ── 3. ticket associations ────────────────────────────────────────────── */

const KV_ASSOC = "connectors:hub:ticket_assoc";
const KV_DONE = "connectors:hub:ticket_assoc:done";
const STAT_KEYS = ["scanned", "order_assoc", "article_assoc", "offer_order_match", "offer_converted", "fields_filled", "c2s_flagged",
  "email_mined", "email_blocked", "write_failed", "read_failed"] as const;
type Stats = Record<(typeof STAT_KEYS)[number], number> & {
  samples: unknown[]; truncated?: boolean; error?: string;
  // what a preview would write / what a live run found to write, after "changed only"
  fields_to_fill: number; c2s_to_set: number; order_links_new: number; article_links_new: number;
};
const newStats = (): Stats => ({
  ...(Object.fromEntries(STAT_KEYS.map((k) => [k, 0])) as Record<(typeof STAT_KEYS)[number], number>),
  samples: [], fields_to_fill: 0, c2s_to_set: 0, order_links_new: 0, article_links_new: 0,
});

/** sales-email-read: unknown until probed; false after a 403, then the email path stops (a new sweep probes again). */
let emailScopeOk: boolean | null = null;

/** The ticket's email exchange (at most 5): [text, count]; count -1 = could not be read. */
async function emailText(tid: string): Promise<[string, number]> {
  if (emailScopeOk === false) return ["", -1];
  let ids: string[];
  try {
    const r = await tix<{ results?: { toObjectId: string | number }[] }>(`/crm/v4/objects/tickets/${tid}/associations/emails`);
    ids = (r.results ?? []).map((x) => String(x.toObjectId)).slice(0, 5);
  } catch (e) {
    // the connector read a refused association list as "no emails"; here it is "could not read"
    if (statusOf(e) === 403) emailScopeOk = false;
    return ["", -1];
  }
  if (!ids.length) return ["", 0];
  let res: Obj[];
  try {
    res = (await tix<{ results?: Obj[] }>("/crm/v3/objects/emails/batch/read", "POST", {
      inputs: ids.map((id) => ({ id })), properties: ["hs_email_text", "hs_email_subject"],
    })).results ?? [];
  } catch (e) {
    if (statusOf(e) === 403) emailScopeOk = false;
    return ["", -1];
  }
  emailScopeOk = true;
  return [res.map((o) => `${o.properties?.hs_email_subject || ""}\n${pySlice(o.properties?.hs_email_text || "", 6000)}`).join("\n"), ids.length];
}

async function resolveOrders(numbers: string[]): Promise<Map<string, FoundOrder>> {
  const found = new Map<string, FoundOrder>();
  for (let i = 0; i < numbers.length; i += 50) {
    const j = await crm<Page>("/crm/v3/objects/orders/search", "POST", {
      filterGroups: [{ filters: [{ propertyName: "order_order_number", operator: "IN", values: numbers.slice(i, i + 50) }] }],
      properties: ORDER_PROPS, limit: 100,
    });
    for (const o of j.results ?? []) {
      const [n, f] = foundOrder(o);
      found.set(n, f);
    }
  }
  return found;
}

/** Validate article candidates against P&P -> {article: P&P id}; `cache` lives for one run. */
async function resolveArticles(arts: string[], cache: Map<string, string | null>): Promise<Map<string, string>> {
  const { out, missing } = articlesFromCache(arts, cache);
  const cands = articleSearchValues(missing);
  for (let i = 0; i < cands.length; i += 100) {
    const j = await crm<Page>(`/crm/v3/objects/${PP_OBJ}/search`, "POST", {
      filterGroups: [{ filters: [{ propertyName: "article_number", operator: "IN", values: cands.slice(i, i + 100) }] }],
      properties: ["article_number"], limit: 100,
    });
    absorbArticles(missing, j.results ?? [], cache, out);
  }
  rememberMissing(missing, cache);
  return out;
}

const firstTo = (j: { results?: { toObjectId: string | number }[] }): string | null =>
  j.results?.length ? String(j.results[0].toObjectId) : null;

/** The ticket's company - or its first contact's. */
async function companyOf(tid: string): Promise<string | null> {
  const co = firstTo(await tix(`/crm/v4/objects/tickets/${tid}/associations/companies`));
  if (co) return co;
  const contact = firstTo(await tix(`/crm/v4/objects/tickets/${tid}/associations/contacts`));
  return contact ? firstTo(await crm(`/crm/v4/objects/contacts/${contact}/associations/companies`)) : null;
}

/** Orders of the company that carry the article, from 30 days before to 90 after the ticket: at most 3 hits in 3 pages. */
async function offerOrderMatch(cid: string, article: string, createdMs: number): Promise<OfferHit[]> {
  let un: string | null | undefined;
  try {
    un = (await crm<Obj>(`/crm/v3/objects/companies/${cid}?properties=company_unique_number`)).properties?.company_unique_number;
  } catch (e) {
    if (statusOf(e) === 404) return [];
    throw e;
  }
  const key = companyKey(un);
  if (!key) return [];
  const body = offerSearch(key[0], key[1], createdMs);
  const createdDay = utcDay(createdMs);
  const hits: OfferHit[] = [];
  for (let page = 0; page < 3; page++) {
    const j = await crm<Page>("/crm/v3/objects/orders/search", "POST", body);
    for (const o of j.results ?? []) {
      const h = offerHit(o, article, createdDay);
      if (h) {
        hits.push(h);
        if (hits.length >= 3) return hits;
      }
    }
    const after = j.paging?.next?.after;
    if (!after) break;
    body.after = after;
  }
  return hits;
}

type Detail = { orders: string[]; articles: string[]; offer_orders: string[]; c2s: boolean; emails: number; filled: string[]; write_ok: boolean };
type Gathered = { tid: string; p: Props; detail: Detail; plan: AssocPlan | null; error?: string };

/**
 * ticket_assoc._process, the reading half: every piece of evidence for ONE ticket and
 * what it would write. A read that fails leaves the ticket out (plan null, counted) so
 * the next sweep tries it again - the connector carried on with less evidence and
 * marked it done.
 */
async function gather(tid: string, p: Props, name: string, stats: Stats, pp: Map<string, string | null>): Promise<Gathered> {
  stats.scanned += 1;
  const blob = ticketBlob(p);
  const [etext, ecount] = await emailText(tid);
  if (ecount > 0) stats.email_mined += 1;
  else if (ecount < 0) stats.email_blocked += 1;
  const detail: Detail = { orders: [], articles: [], offer_orders: [], c2s: false, emails: Math.max(ecount, 0), filled: [], write_ok: true };
  try {
    const all = `${blob}\n${etext}`;
    const refs = orderRefs(all);
    const orders = refs.length ? await resolveOrders(wantedOrderNumbers(refs)) : new Map<string, FoundOrder>();
    const cands = articlesToCheck(articleCandidates(all), orders);
    const arts = cands.length ? await resolveArticles(cands, pp) : new Map<string, string>();
    let c2s = mentionsC2S(all) || [...orders.values()].some((o) => o.c2s);
    // ESO / TSA: the article -> an order of the ticket's company in the time frame
    const offer: [string, string, boolean][] = [];
    if ((name === "ESO" || name === "TSA") && arts.size) {
      const cid = await companyOf(tid);
      if (cid) {
        const created = createdMsIso(p.createdate);
        const textIds = new Set([...orders.values()].map((o) => o.id));
        for (const a of pySorted(arts.keys()).slice(0, 3)) {
          for (const h of await offerOrderMatch(cid, a, created)) {
            if (!textIds.has(h.id)) offer.push([h.id, h.number, h.converted]);
            c2s = c2s || h.c2s;
          }
        }
        if (offer.length) {
          stats.offer_order_match += 1;
          if (offer.some(([, , c]) => c)) stats.offer_converted += 1;
        }
      }
    }
    if (orders.size) stats.order_assoc += 1;
    if (arts.size) stats.article_assoc += 1;
    if (c2s) stats.c2s_flagged += 1;
    if (stats.samples.length < 4 && (orders.size || arts.size || offer.length)) {
      stats.samples.push({
        subject: pySlice(p.subject || "", 48), orders: pySorted(orders.keys()).slice(0, 3), articles: pySorted(arts.keys()).slice(0, 4),
        offer_orders: offer.slice(0, 3).map(([, n, c]) => [n, c]),
      });
    }
    Object.assign(detail, { orders: pySorted(orders.keys()), articles: pySorted(arts.keys()), offer_orders: offer.map(([, n]) => n), c2s });
    return { tid, p, detail, plan: assocPlan(p, orders, arts, offer, c2s) };
  } catch (e) {
    stats.read_failed += 1;
    return { tid, p, detail: { ...detail, write_ok: false }, plan: null, error: msg(e) };
  }
}

type Links = Map<string, { toObjectId: string | number; associationTypes?: { category?: string; typeId?: number }[] }[]>;

/** Existing ticket -> `to` associations with their types (v4 batch read, each ticket's own paging followed). */
async function existingLinks(to: string, tids: string[]): Promise<Links> {
  const out: Links = new Map();
  type R = { from: { id: string }; to?: { toObjectId: string | number; associationTypes?: { category?: string; typeId?: number }[] }[]; paging?: { next?: { after?: string } } };
  for (let i = 0; i < tids.length; i += 1000) {
    const j = await tix<{ results?: R[] }>(`/crm/v4/associations/tickets/${to}/batch/read`, "POST", { inputs: tids.slice(i, i + 1000).map((id) => ({ id })) });
    for (const r of j.results ?? []) {
      const list = [...(r.to ?? [])];
      let next = r.paging?.next?.after;
      while (next) {
        const g = await tix<{ results?: R["to"]; paging?: { next?: { after?: string } } }>(`/crm/v4/objects/tickets/${r.from.id}/associations/${to}?limit=500&after=${next}`);
        list.push(...(g.results ?? []));
        next = g.paging?.next?.after;
      }
      out.set(String(r.from.id), list);
    }
  }
  return out;
}

/** v4 association batch writes, 100 pairs at a time; a batch that fails (or reports errors) fails all its tickets. */
async function linkBatches(path: string, pairs: { tid: string; input: object }[], failedTickets: Set<string>, errors: string[]): Promise<number> {
  let written = 0;
  for (let i = 0; i < pairs.length; i += 100) {
    const chunk = pairs.slice(i, i + 100);
    try {
      const j = await tix<{ errors?: unknown[]; numErrors?: number }>(path, "POST", { inputs: chunk.map((c) => c.input) });
      if ((j.numErrors ?? j.errors?.length ?? 0) > 0) throw new Error(`${j.numErrors ?? j.errors?.length} association error(s) in the batch`);
      written += chunk.length;
    } catch (e) {
      for (const c of chunk) failedTickets.add(c.tid);
      if (errors.length < 3) errors.push(msg(e));
    }
  }
  return written;
}

/**
 * The writing half for a page of gathered tickets, changed-only: fields and the C2S flag
 * as planned (only empty fields, only an unset flag), and only the associations the
 * ticket does not carry yet. Returns the tickets whose writes all went through.
 */
async function flush(page: Gathered[], live: boolean, stats: Stats, errors: string[]): Promise<Set<string>> {
  const ready = page.filter((g) => g.plan);
  const wantsLinks = ready.filter((g) => g.plan!.orderIds.length || g.plan!.ppIds.length).map((g) => g.tid);
  const haveOrders = wantsLinks.length ? await existingLinks("orders", wantsLinks) : new Map() as Links;
  const havePP = wantsLinks.length ? await existingLinks(PP_OBJ, wantsLinks) : new Map() as Links;
  const updates: Row[] = [];
  const orderPairs: { tid: string; input: object }[] = [];
  const ppPairs: { tid: string; input: object }[] = [];
  for (const g of ready) {
    const plan = g.plan!;
    if (Object.keys(plan.props).length) updates.push({ id: g.tid, properties: plan.props });
    stats.fields_to_fill += plan.filled.length;
    if (plan.props.c2s_ticket) stats.c2s_to_set += 1;
    const ho = new Set((haveOrders.get(g.tid) ?? []).filter((t) => hasDefaultType(t.associationTypes)).map((t) => String(t.toObjectId)));
    const hp = new Set((havePP.get(g.tid) ?? []).filter((t) => hasArticleType(t.associationTypes)).map((t) => String(t.toObjectId)));
    for (const oid of plan.orderIds.filter((o) => !ho.has(o))) orderPairs.push({ tid: g.tid, input: { from: { id: g.tid }, to: { id: oid } } });
    for (const pid of plan.ppIds.filter((x) => !hp.has(x))) {
      ppPairs.push({ tid: g.tid, input: { from: { id: g.tid }, to: { id: pid }, types: [{ associationCategory: "USER_DEFINED", associationTypeId: PP_ASSOC_TYPE }] } });
    }
  }
  stats.order_links_new += orderPairs.length;
  stats.article_links_new += ppPairs.length;
  if (!live) return new Set();
  const failed = new Set<string>();
  const w = await updateTickets(updates);
  for (const u of updates) if (!w.ok.has(u.id)) failed.add(u.id);
  errors.push(...w.errors.slice(0, Math.max(0, 3 - errors.length)));
  await linkBatches("/crm/v4/associations/tickets/orders/batch/associate/default", orderPairs, failed, errors);
  await linkBatches(`/crm/v4/associations/tickets/${PP_OBJ}/batch/create`, ppPairs, failed, errors);
  const ok = new Set<string>();
  for (const g of ready) {
    if (failed.has(g.tid)) {
      stats.write_failed += 1;
      g.detail.write_ok = false;
    } else {
      ok.add(g.tid);
      if (w.ok.has(g.tid) && g.plan!.filled.length) {
        stats.fields_filled += g.plan!.filled.length;
        g.detail.filled = g.plan!.filled;
      }
    }
  }
  return ok;
}

/** Done-marks merged into what is stored (a webhook may have written some meanwhile); older than two years dropped. */
async function markDone(ids: Iterable<string>): Promise<void> {
  const add = [...ids];
  if (!add.length) return;
  const done = (await kvGet<Record<string, number>>(KV_DONE)) ?? {};
  const now = Math.floor(Date.now() / 1000);
  for (const id of add) done[id] = now;
  for (const [id, t] of Object.entries(done)) if (now - t > 2 * 366 * 86_400) delete done[id];
  await kvSet(KV_DONE, done);
}

export type AssocOptions = { pipelines?: string[]; limit?: number; sinceDays?: number; untilDays?: number; redo?: boolean };

/**
 * Sweep a createdate window, newest first, per pipeline. HubSpot's search pages stop at
 * 10,000 results, so a backfill slices the past with untilDays. A pipeline whose window
 * held more than `limit` pending tickets says truncated (repeat the slice). Live, a ticket
 * once fully written is done and skipped next time (redo ignores that).
 */
export async function ticketAssoc(live: boolean, beat: Beat, opts: AssocOptions = {}): Promise<StepResult> {
  const t0 = Date.now();
  const pipelines = opts.pipelines?.length ? opts.pipelines : [BO, ESO, TSA];
  const limit = Math.max(1, Math.min(opts.limit ?? 300, 3000));
  const sinceDays = Math.max(1, Math.min(opts.sinceDays ?? 120, 730));
  const untilDays = Math.max(0, Math.min(opts.untilDays ?? 0, 730));
  const redo = !!opts.redo;
  emailScopeOk = null; // probe again: a scope granted since the last sweep counts at once
  const done = (live && !redo ? await kvGet<Record<string, number>>(KV_DONE) : undefined) ?? {};
  const cutoff = Date.now() - sinceDays * 86_400_000;
  const upper = untilDays ? Date.now() - untilDays * 86_400_000 : 0;
  const pp = new Map<string, string | null>();
  const errors: string[] = [];
  const rep: Record<string, unknown> = {};
  for (const pid of pipelines) {
    const name = ASSOC_PIPELINES[pid] ?? pid;
    const stats = newStats();
    stats.truncated = false;
    let after: string | undefined;
    while (stats.scanned < limit) {
      if (after && Number(after) >= 10_000) {
        stats.error = "the window holds more than 10,000 tickets - slice it with until_days";
        break;
      }
      const filters: object[] = [
        { propertyName: "hs_pipeline", operator: "EQ", value: pid },
        { propertyName: "createdate", operator: "GTE", value: String(cutoff) },
      ];
      if (upper) filters.push({ propertyName: "createdate", operator: "LT", value: String(upper) });
      let j: Page;
      try {
        j = await tix<Page>("/crm/v3/objects/tickets/search", "POST", {
          filterGroups: [{ filters }], sorts: [{ propertyName: "createdate", direction: "DESCENDING" }], properties: ASSOC_FIELDS, limit: 100, ...(after ? { after } : {}),
        });
      } catch (e) {
        stats.error = statusOf(e) ? `HTTP ${statusOf(e)}` : "net";
        break;
      }
      const res = j.results ?? [];
      if (!res.length) break;
      const page: Gathered[] = [];
      for (const t of res) {
        if (live && !redo && done[t.id]) continue;
        if (stats.scanned >= limit) {
          stats.truncated = true;
          break;
        }
        page.push(await gather(t.id, t.properties ?? {}, name, stats, pp));
      }
      let ok = new Set<string>();
      try {
        ok = await flush(page, live, stats, errors);
      } catch (e) {
        // the existing links could not be read: nothing of this page written, nothing marked done
        stats.read_failed += page.filter((g) => g.plan).length;
        if (errors.length < 3) errors.push(`links: ${msg(e)}`);
      }
      if (live && ok.size) {
        await markDone(ok); // checkpoint per page: a crash loses at most one page of marks
        for (const id of ok) done[id] = 1;
      }
      await beat();
      after = j.paging?.next?.after;
      if (!after) break;
      if (stats.scanned >= limit) {
        stats.truncated = true;
        break;
      }
    }
    rep[name] = stats;
    if (stats.error) {
      rep.error = `${name}: tickets search failed (${stats.error}) - sweep aborted`;
      break;
    }
  }
  if (errors.length) rep.errors = errors;
  if (live) {
    const st = (await kvGet<Record<string, unknown>>(KV_ASSOC)) ?? {};
    st.last_run = new Date().toISOString().slice(0, 10);
    st.stats = Object.fromEntries(Object.entries(rep).filter(([, v]) => v && typeof v === "object" && !Array.isArray(v)).map(([k, v]) => [k, { ...(v as Stats), samples: undefined }]));
    await kvSet(KV_ASSOC, st);
  }
  return { dry: !live, limit, since_days: sinceDays, until_days: untilDays, redo, ...rep, seconds: Math.round((Date.now() - t0) / 1000) };
}

/**
 * ONE ticket - the target of the workflow webhook (ticket created or moved stage). Always
 * re-processes: a stage move usually means new evidence arrived. `error` in the result
 * means "try again" (HubSpot re-delivers on a 5xx); "ticket fetch 404" means deleted.
 */
export async function ticketAssocOne(ticketId: string, live: boolean): Promise<StepResult> {
  const tid = String(ticketId).trim();
  let p: Props;
  try {
    p = (await tix<Obj>(`/crm/v3/objects/tickets/${tid}?properties=${ASSOC_FIELDS.join(",")}`)).properties ?? {};
  } catch (e) {
    return { error: `ticket fetch ${statusOf(e) ?? "net"}`, ticket: tid };
  }
  const name = ASSOC_PIPELINES[p.hs_pipeline ?? ""];
  if (!name) return { skipped: "pipeline", ticket: tid };
  const stats = newStats();
  const errors: string[] = [];
  const g = await gather(tid, p, name, stats, new Map());
  if (!g.plan) return { error: `read failed: ${g.error}`, ticket: tid };
  let ok = new Set<string>();
  try {
    ok = await flush([g], live, stats, errors);
  } catch (e) {
    return { error: `association read failed: ${msg(e)}`, ticket: tid };
  }
  if (live) {
    if (ok.has(tid)) await markDone([tid]);
    // per-day counters, 30 days kept
    const st = (await kvGet<{ events?: Record<string, Record<string, number>> }>(KV_ASSOC)) ?? {};
    const ev = (st.events ??= {});
    const day = (ev[new Date().toISOString().slice(0, 10)] ??= {});
    for (const k of STAT_KEYS) day[k] = (day[k] ?? 0) + stats[k];
    for (const old of Object.keys(ev).sort().slice(0, -30)) delete ev[old];
    await kvSet(KV_ASSOC, st);
  }
  return {
    ...g.detail, ticket: tid, pipeline: name, dry: !live,
    to_write: { fields: g.plan.props, order_links_new: stats.order_links_new, article_links_new: stats.article_links_new },
    ...(errors.length ? { errors } : {}),
  };
}
