// OWNER REDIRECTION - the hub's safety net (step "owner_rules", sweep lane, every 15
// minutes, under the hub's live/preview switch - off = preview: it reads and reports,
// writes nothing).
//
// The instant reaction is the HubSpot app function (a webhook on country, country_custom
// and owner). This catches what it could not: a delivery that failed for good, a time-out,
// the app being down, and the companies a NEW owner rule takes over (adding a rule fires
// no webhook). It applies the very same rules (rules.ts), read from the very same
// published document (hubspot.ts) - when that cannot be read, it does nothing.
//
// Per run: find the companies that differ from what a rule says (searches narrowed to
// "owner or region_responsibility is not the target", so a settled portal costs a handful
// of searches), resolve each with the rules, then write - changed-only, as the function:
//   country rule  the company first, then its contacts / open ESO+TSA tickets / open tasks
//                 (tickets in Back Office, GQS or any other pipeline never move - rules.ts
//                 CASCADE_TICKET_PIPELINES, SARCLA 19.10.2026)
//   owner rule    the children first, the company last: a failure half-way leaves the
//                 company on the old owner, so the next run (or webhook retry) starts over
// At most MAX_PER_RUN companies a run; the rest wait for the next one.

import { hubspotRetry as hs } from "@/lib/connectors/steps/hs";
import { IntegrationError } from "@/lib/integrations/status";
import type { StepResult } from "@/lib/connectors/steps/companyFacts";
import { COMPANY_PROPS, TICKET_PROPS, childMoves, groupKey, resolve, ticketMoves, type ChildType, type PubRule, type Resolution } from "./rules";
import { readOwners, readPublished } from "./hubspot";
import { logCorrections } from "./store";

type Beat = () => Promise<void>;
type Obj = { id: string; properties?: Record<string, string | null> };
type Page = { results?: Obj[]; paging?: { next?: { after?: string } } };
type Apply = Extract<Resolution, { kind: "apply" }>;
type Plan = { id: string; name: string | null; fromOwner: string; res: Apply };
type Counts = Record<ChildType, number>;

const MAX_PER_RUN = 1000;
const msg = (e: unknown) => String((e as Error)?.message ?? e).replace(/\s+/g, " ").slice(0, 200);
const zero = (): Counts => ({ contacts: 0, tickets: 0, tasks: 0 });

/* ── reads ─────────────────────────────────────────────────────────────── */

/** Every company id a search finds, by id cursor (HubSpot's search stops at 10,000). */
async function searchIds(groups: object[][], beat: Beat): Promise<string[]> {
  const out: string[] = [];
  let cursor = "0";
  for (let pages = 1; ; pages++) {
    const j = await hs<Page>({
      path: "/crm/v3/objects/companies/search", method: "POST",
      body: {
        filterGroups: groups.map((filters) => ({ filters: [...filters, { propertyName: "hs_object_id", operator: "GT", value: cursor }] })),
        sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }], properties: ["hs_object_id"], limit: 200,
      },
    });
    const res = j.results ?? [];
    if (!res.length) return out;
    for (const r of res) out.push(String(r.id));
    cursor = String(res[res.length - 1].id);
    if (pages % 20 === 0) await beat();
  }
}

/**
 * The companies a rule might correct. Country: the value is in the list - lower-cased
 * (HubSpot compares IN on text in lower case) and as written (in case country_custom is a
 * dropdown with "France" as its value) - AND owner or region_responsibility is not the
 * target, or empty. Owner: owned by the person. resolve() then decides each one.
 */
async function candidates(r: PubRule, beat: Beat): Promise<string[]> {
  if (r.kind === "owner") return searchIds([[{ propertyName: "hubspot_owner_id", operator: "EQ", value: r.fromOwner }]], beat);
  const ids = new Set<string>();
  for (const [field, values] of [["country", r.countries], ["country_custom", r.customCountries]] as const) {
    if (!values.length) continue;
    const spellings = [[...new Set(values.map((v) => v.trim().toLowerCase()))], [...new Set(values.map((v) => v.trim()))]];
    for (const vals of spellings[0].join() === spellings[1].join() ? [spellings[0]] : spellings) {
      const inList = { propertyName: field, operator: "IN", values: vals };
      const groups = [
        [inList, { propertyName: "hubspot_owner_id", operator: "NEQ", value: r.toOwner }],
        [inList, { propertyName: "hubspot_owner_id", operator: "NOT_HAS_PROPERTY" }],
        [inList, { propertyName: "region_responsibility", operator: "NEQ", value: r.toOwner }],
        [inList, { propertyName: "region_responsibility", operator: "NOT_HAS_PROPERTY" }],
      ];
      for (const id of await searchIds(groups, beat)) ids.add(id);
    }
  }
  return [...ids];
}

async function batchRead(obj: string, ids: string[], properties: readonly string[]): Promise<Map<string, Record<string, string | null>>> {
  const out = new Map<string, Record<string, string | null>>();
  for (let i = 0; i < ids.length; i += 100) {
    const j = await hs<{ results?: Obj[] }>({
      path: `/crm/v3/objects/${obj}/batch/read`, method: "POST",
      body: { properties: [...properties], inputs: ids.slice(i, i + 100).map((id) => ({ id })) },
    });
    for (const r of j.results ?? []) out.set(String(r.id), r.properties ?? {});
  }
  return out;
}

type AssocRow = { from: { id: string }; to?: { toObjectId: string | number }[]; paging?: { next?: { after?: string } } };

/** from id -> its associated `to` ids, every page of each. */
async function assoc(from: string, to: string, ids: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  for (let i = 0; i < ids.length; i += 100) {
    const j = await hs<{ results?: AssocRow[] }>({
      path: `/crm/v4/associations/${from}/${to}/batch/read`, method: "POST",
      body: { inputs: ids.slice(i, i + 100).map((id) => ({ id })) },
    });
    for (const r of j.results ?? []) {
      const list = (r.to ?? []).map((x) => String(x.toObjectId));
      let next = r.paging?.next?.after;
      while (next) {
        const g = await hs<{ results?: { toObjectId: string | number }[]; paging?: { next?: { after?: string } } }>({
          path: `/crm/v4/objects/${from}/${r.from.id}/associations/${to}?limit=500&after=${encodeURIComponent(next)}`,
        });
        list.push(...(g.results ?? []).map((x) => String(x.toObjectId)));
        next = g.paging?.next?.after;
      }
      out.set(String(r.from.id), list);
    }
  }
  return out;
}

let closedCache: { at: number; ids: Set<string> } | null = null;
async function closedStages(): Promise<Set<string>> {
  if (closedCache && Date.now() - closedCache.at < 3_600_000) return closedCache.ids;
  type P = { stages?: { id: string; metadata?: { isClosed?: string | boolean } }[] };
  const d = await hs<{ results?: P[] }>({ path: "/crm/v3/pipelines/tickets" });
  const ids = new Set<string>();
  for (const p of d.results ?? []) for (const s of p.stages ?? []) if (s.metadata?.isClosed === true || s.metadata?.isClosed === "true") ids.add(s.id);
  if (!ids.size) throw new Error("no closed ticket stages found - cannot tell open tickets from closed ones");
  closedCache = { at: Date.now(), ids };
  return ids;
}

/* ── writes ────────────────────────────────────────────────────────────── */

/** Batch update, 100 at a time; a failing batch is counted and the rest still go. */
async function update(obj: string, rows: { id: string; properties: Record<string, string> }[]): Promise<{ ok: Set<string>; errors: string[] }> {
  const ok = new Set<string>();
  const errors: string[] = [];
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    try {
      const j = await hs<{ results?: { id: string }[] }>({ path: `/crm/v3/objects/${obj}/batch/update`, method: "POST", body: { inputs: chunk } });
      const got = j.results ? new Set(j.results.map((r) => String(r.id))) : null;
      for (const r of chunk) if (!got || got.has(r.id)) ok.add(r.id);
      if (got && got.size < chunk.length && errors.length < 3) errors.push(`${obj}: ${chunk.length - got.size} of a batch not written`);
    } catch (e) {
      if (e instanceof IntegrationError && (e.status === 401 || e.status === 403)) throw new Error(`${obj}: HubSpot refused the write (${e.status}) - ${msg(e)}`);
      if (errors.length < 3) errors.push(`${obj}: ${msg(e)}`);
    }
  }
  return { ok, errors };
}

/* ── one group: the same target, order and cascade ─────────────────────── */

type GroupOut = { per: Map<string, Counts>; childFailed: Set<string>; errors: string[] };

/**
 * The children of a group of companies that move with them, and (live) their writes.
 * A ticket or task is kept only when its OWN company list still holds one of the group's
 * companies (the France app's lesson: an Italian ticket once came back under a French
 * company); a task with no company at all hangs off a contact and counts. A contact
 * follows only when its primary company is one of the group's (or it has none).
 */
async function cascade(plans: Plan[], live: boolean): Promise<GroupOut> {
  const { to, filters } = plans[0].res;
  const set = new Set(plans.map((p) => p.id));
  const ids = [...set];
  const per = new Map(ids.map((id) => [id, zero()]));
  const childFailed = new Set<string>();
  const errors: string[] = [];

  const run = async (type: ChildType, rows: { id: string; company: string }[]) => {
    const moved = live ? (await update(type, rows.map((r) => ({ id: r.id, properties: { hubspot_owner_id: to } })))) : null;
    if (moved) errors.push(...moved.errors);
    for (const r of rows) {
      if (moved && !moved.ok.has(r.id)) childFailed.add(r.company);
      else per.get(r.company)![type] += 1;
    }
  };
  const firstCompany = (map: Map<string, string[]>) => {
    const of = new Map<string, string>();
    for (const [co, list] of map) for (const x of list) if (!of.has(x)) of.set(x, co);
    return of;
  };
  /** child -> does its own company list hold one of ours; and the ones with no company at all. */
  const confirm = async (type: "tickets" | "tasks", childIds: string[]) => {
    const back = await assoc(type, "companies", childIds);
    const ours = new Set<string>();
    const none = new Set<string>();
    for (const id of childIds) {
      const cos = back.get(id) ?? [];
      if (!cos.length) none.add(id);
      else if (cos.some((c) => set.has(c))) ours.add(id);
    }
    return { ours, none };
  };

  if (filters.contacts !== "none") {
    const map = await assoc("companies", "contacts", ids);
    const of = firstCompany(map);
    const props = await batchRead("contacts", [...of.keys()], ["hubspot_owner_id", "associatedcompanyid"]);
    const rows: { id: string; company: string }[] = [];
    for (const [id, p] of props) {
      const primary = p.associatedcompanyid || "";
      if (primary && !set.has(primary)) continue;
      if (childMoves(p.hubspot_owner_id, filters.contacts, to)) rows.push({ id, company: primary || of.get(id)! });
    }
    await run("contacts", rows);
  }
  if (filters.tickets !== "none") {
    const map = await assoc("companies", "tickets", ids);
    const of = firstCompany(map);
    if (of.size) {
      const closed = await closedStages();
      const props = await batchRead("tickets", [...of.keys()], TICKET_PROPS);
      // open, ESO / TSA only (CASCADE_TICKET_PIPELINES): Back Office, GQS and the rest keep their owner
      const moving = [...props].filter(([, p]) => ticketMoves(p, closed, filters.tickets, to));
      const { ours } = await confirm("tickets", moving.map(([id]) => id));
      await run("tickets", moving.filter(([id]) => ours.has(id)).map(([id]) => ({ id, company: of.get(id)! })));
    }
  }
  if (filters.tasks !== "none") {
    const map = await assoc("companies", "tasks", ids);
    const of = firstCompany(map);
    if (of.size) {
      const props = await batchRead("tasks", [...of.keys()], ["hs_task_status", "hubspot_owner_id"]);
      const open = [...props].filter(([, p]) => p.hs_task_status !== "COMPLETED");
      const { ours, none } = await confirm("tasks", open.map(([id]) => id));
      await run("tasks", open.filter(([id, p]) => (ours.has(id) || none.has(id)) && childMoves(p.hubspot_owner_id, filters.tasks, to)).map(([id]) => ({ id, company: of.get(id)! })));
    }
  }
  return { per, childFailed, errors };
}

/* ── the people who have left: their own open tickets and tasks ───────── */

/** At most this many tickets and as many tasks a run, all leavers together. */
const LEAVER_MAX = 1000;

/** Every id a search on one object finds, by id cursor. */
async function searchAll(obj: "tickets" | "tasks", filters: object[], props: string[], beat: Beat): Promise<Obj[]> {
  const out: Obj[] = [];
  let cursor = "0";
  for (let pages = 1; out.length < 5 * LEAVER_MAX; pages++) {
    const j = await hs<Page>({
      path: `/crm/v3/objects/${obj}/search`, method: "POST",
      body: { filterGroups: [{ filters: [...filters, { propertyName: "hs_object_id", operator: "GT", value: cursor }] }], sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }], properties: props, limit: 200 },
    });
    const res = j.results ?? [];
    if (!res.length) break;
    out.push(...res);
    cursor = String(res[res.length - 1].id);
    if (pages % 20 === 0) await beat();
  }
  return out;
}

/**
 * For an owner rule whose person has LEFT (SARCLA 25.10.2026: the HubSpot redirection workflows STACHR, Paulina, NIBE,
 * Andrea to Luca, PIRAHM "as overrides on the hub"): every open ticket - any pipeline, as those workflows did - and every
 * open task they still own goes to the rule's person, wherever it hangs (the company cascade only moves the children
 * of their companies). Someone still here (Sandra Kuridza -> James Koeremez) keeps the company cascade only.
 */
async function leavers(rules: PubRule[], live: boolean, beat: Beat): Promise<{ byRule: Record<string, { tickets: number; tasks: number }>; errors: string[] }> {
  const byRule: Record<string, { tickets: number; tasks: number }> = {};
  const errors: string[] = [];
  const owners = await readOwners();
  const gone = new Set(owners.filter((o) => !o.active).map((o) => String(o.id)));
  let budget = { tickets: LEAVER_MAX, tasks: LEAVER_MAX };
  for (const r of rules) {
    if (r.kind !== "owner" || !gone.has(String(r.fromOwner))) continue;
    const t = (byRule[r.id] = { tickets: 0, tasks: 0 });
    if (r.cascade.tickets && budget.tickets > 0) {
      const closed = await closedStages();
      const open = (await searchAll("tickets", [{ propertyName: "hubspot_owner_id", operator: "EQ", value: r.fromOwner }], ["hs_pipeline_stage", "hubspot_owner_id"], beat))
        .filter((x) => !closed.has(String(x.properties?.hs_pipeline_stage ?? ""))).slice(0, budget.tickets);
      const w = live ? await update("tickets", open.map((x) => ({ id: String(x.id), properties: { hubspot_owner_id: r.toOwner } }))) : null;
      if (w) errors.push(...w.errors);
      t.tickets = w ? w.ok.size : open.length;
      budget = { ...budget, tickets: budget.tickets - open.length };
    }
    if (r.cascade.tasks && budget.tasks > 0) {
      const open = (await searchAll("tasks", [{ propertyName: "hubspot_owner_id", operator: "EQ", value: r.fromOwner }, { propertyName: "hs_task_status", operator: "NEQ", value: "COMPLETED" }], ["hs_task_status", "hubspot_owner_id"], beat))
        .slice(0, budget.tasks);
      const w = live ? await update("tasks", open.map((x) => ({ id: String(x.id), properties: { hubspot_owner_id: r.toOwner } }))) : null;
      if (w) errors.push(...w.errors);
      t.tasks = w ? w.ok.size : open.length;
      budget = { ...budget, tasks: budget.tasks - open.length };
    }
    await beat();
  }
  return { byRule, errors };
}

/* ── the step ──────────────────────────────────────────────────────────── */

export async function ownerRulesSweep(live: boolean, beat: Beat): Promise<StepResult> {
  const t0 = Date.now();
  const pub = await readPublished();
  // never a guess: no readable rules, no run
  if (!pub.ok) throw new Error(`${pub.error} - nothing was read or written`);
  const rules = pub.doc.rules;
  const out: StepResult = { dry: !live, rules_on: rules.length, published_at: pub.doc.publishedAt, records: pub.records };
  if (!rules.length) return { ...out, note: "no rule is on", seconds: 0 };

  const ids = new Set<string>();
  for (const r of rules) for (const id of await candidates(r, beat)) ids.add(id);
  await beat();
  const props = await batchRead("companies", [...ids], COMPANY_PROPS);

  const plans: Plan[] = [];
  const loops: { company: string; name: string | null; rules: string[] }[] = [];
  for (const [id, p] of props) {
    const res = resolve(p, rules);
    if (res.kind === "loop") loops.push({ company: id, name: p.name ?? null, rules: res.chain });
    else if (res.kind === "apply" && Object.keys(res.changes).length) plans.push({ id, name: p.name ?? null, fromOwner: p.hubspot_owner_id ?? "", res });
  }
  plans.sort((a, b) => Number(a.id) - Number(b.id));
  const now = plans.slice(0, MAX_PER_RUN);
  Object.assign(out, { candidates: ids.size, to_change: plans.length, left_for_next_run: plans.length - now.length, loops: loops.length });

  const byRule: Record<string, { companies: number } & Counts> = {};
  const tally = (rule: string) => (byRule[rule] ??= { companies: 0, ...zero() });
  const done: { plan: Plan; counts: Counts }[] = [];
  const errors: string[] = [];
  let failed = 0;

  const groups = new Map<string, Plan[]>();
  for (const p of now) groups.set(groupKey(p.res), [...(groups.get(groupKey(p.res)) ?? []), p]);
  for (const group of groups.values()) {
    for (let i = 0; i < group.length; i += 100) {
      const part = group.slice(i, i + 100);
      const writeCompanies = async (which: Plan[]) => {
        if (!live) return new Set(which.map((p) => p.id));
        const w = await update("companies", which.map((p) => ({ id: p.id, properties: p.res.changes })));
        errors.push(...w.errors);
        return w.ok;
      };
      let companiesOk: Set<string>;
      let kids: GroupOut;
      if (part[0].res.companyFirst) {
        companiesOk = await writeCompanies(part);
        // the children of the companies that were written (in a preview: of all of them)
        const written = part.filter((p) => companiesOk.has(p.id));
        kids = written.length ? await cascade(written, live) : { per: new Map(), childFailed: new Set(), errors: [] };
      } else {
        kids = await cascade(part, live);
        // children first; a company whose children did not all move stays on its owner for the next run
        companiesOk = await writeCompanies(part.filter((p) => !kids.childFailed.has(p.id)));
      }
      errors.push(...kids.errors);
      for (const p of part) {
        if (!companiesOk.has(p.id)) {
          failed += 1;
          continue;
        }
        const counts = kids.per.get(p.id) ?? zero();
        done.push({ plan: p, counts });
        const t = tally(p.res.rule);
        t.companies += 1;
        for (const k of Object.keys(counts) as ChildType[]) t[k] += counts[k];
      }
      await beat();
    }
  }

  // the people who have left: their own open tickets and tasks, wherever they hang
  const lv = await leavers(rules, live, beat).catch((e) => ({ byRule: {}, errors: [`leavers: ${msg(e)}`] }));
  errors.push(...lv.errors);

  if (live && done.length) {
    await logCorrections(done.map(({ plan, counts }) => ({
      source: "sweep", ruleId: plan.res.rule, companyId: plan.id, companyName: plan.name,
      fromOwner: plan.fromOwner || null, toOwner: plan.res.to, ...counts,
    }))).catch((e) => errors.push(`log: ${msg(e)}`));
  }
  return {
    ...out,
    [live ? "changed" : "would_change"]: done.length, failed, by_rule: byRule,
    [live ? "leavers_moved" : "leavers_would_move"]: lv.byRule,
    ...(errors.length ? { errors: [...new Set(errors)].slice(0, 5) } : {}),
    loop_examples: loops.slice(0, 10),
    examples: done.slice(0, 50).map(({ plan, counts }) => ({
      company: plan.id, name: plan.name, rule: plan.res.rule, from: plan.fromOwner || null, to: plan.res.to,
      fields: Object.keys(plan.res.changes), ...counts,
    })),
    seconds: Math.round((Date.now() - t0) / 1000),
  };
}
