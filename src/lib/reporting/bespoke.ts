// BESPOKE CHECKS, the Action plan's fourth tab (SARCLA 04.11.2026: "if we bring the list as a sub app via the header we
// could update automatically, ready to export"; "sub-action not only one - we need tracking per Bespoke request").
// Bespoke's technical SEO/GEO check (src/data/bespokeChecks.json, its comments back on their own rows) set up once in the
// plan, under the category "Increase APSOparts branding - visibility - foundability":
//   - "Technical Plan from Bespoke", the study, closed: its one sub-action is the ticket that held it (442645087480);
//   - "Bespoke technical plan - implementation": one sub-action per open Bespoke request, each with its own Scroll to
//     Sale ticket (an existing one taken over where the plan says so), and one for this tab.
// The set-up runs by itself the first time the plan or this tab is opened after the release (SARCLA: "deploy the
// sub-actions and everything so we can start following it"), in the background, one copy of the hub at a time; each
// step is remembered (apsomh_bespoke_links), so a run cut short goes on where it stopped. The tab reads each check's
// state from its sub-action; Bespoke's two columns (validated, feedback) are typed in the tab. Rules: bespokeRules.ts.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { query } from "@/lib/db/client";
import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { addItem, forgetTicketSync, mainsFollowSubs, moveSub, planItems, updateItem } from "./actionPlan";
import { syncPlanToHubspot } from "./actionPlanHubspot";
import { IN_PROGRESS, LIVE, type PlanFields, type PlanOwner } from "./actionPlanRules";
import { addTask, linkTickets, markTaskSync, planTasks, taskById, taskTickets, tasksOf, unlinkTicket, updateTask } from "./kpiActions";
import { createTicket, s2sForm } from "./scrollToSale";
import { nextRoadmapId } from "./scrollToSaleRules";
import {
  dmy, isOpenCheck, lateOf, stateOf, subNote, subStatusNote, ticketValues,
  type BespokeCheck, type BespokeData, type BespokeSub, type CheckState, type LiveSub, type Typed,
} from "./bespokeRules";

const LINKS = "apsomh_bespoke_links";
const ANSWERS = "apsomh_bespoke_answers";
/** The plan's own tables (kpiActions.ts): which sub-action an existing ticket sits under. */
const TICKET_LINKS = "apsomh_kpi_ticket_links";
const HUB = (process.env.HUB_PUBLIC_URL ?? "https://apsomarketinghub-dev.awssandbox.angst-pfister.com").replace(/\/+$/, "");
const BY = "Bespoke plan";
/** A run that left its mark this long ago without finishing is taken over. */
const STALE_MIN = 15;

let ready: Promise<void> | null = null;
function ensure(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      // each step done once: "action:study", "action:impl", "study:sub", "sub:<check id>", "sub:tab"; "run" while one runs
      await query(`CREATE TABLE IF NOT EXISTS ${LINKS} (
        key text PRIMARY KEY,
        item_id integer,
        task_id integer,
        ticket_id text,
        note text NOT NULL DEFAULT '',
        at timestamptz NOT NULL DEFAULT now()
      )`);
      await query(`CREATE TABLE IF NOT EXISTS ${ANSWERS} (
        check_id integer PRIMARY KEY,
        validation text,
        feedback text,
        by_name text NOT NULL DEFAULT '',
        at timestamptz NOT NULL DEFAULT now()
      )`);
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

let dataCache: Promise<BespokeData | null> | null = null;
/** Bespoke's check and the plan made of it, read from disk once (company data: not in the sandbox copy). */
export function bespokeData(): Promise<BespokeData | null> {
  if (!dataCache) {
    dataCache = readFile(path.join(process.cwd(), "src", "data", "bespokeChecks.json"), "utf8")
      .then((t) => JSON.parse(t) as BespokeData)
      .catch(() => { console.log("[bespoke] no Bespoke check here - the tab stays empty"); return null; });
  }
  return dataCache;
}

type Link = { key: string; item_id: number | null; task_id: number | null; ticket_id: string | null; note: string; at: unknown };
async function links(): Promise<Map<string, Link>> {
  await ensure();
  const r = await query<Link>(`SELECT * FROM ${LINKS}`);
  return new Map(r.rows.map((x) => [x.key, x]));
}
async function keep(key: string, v: { item?: number | null; task?: number | null; ticket?: string | null; note?: string }): Promise<void> {
  await query(
    `INSERT INTO ${LINKS} (key, item_id, task_id, ticket_id, note) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (key) DO UPDATE SET item_id = COALESCE(EXCLUDED.item_id, ${LINKS}.item_id), task_id = COALESCE(EXCLUDED.task_id, ${LINKS}.task_id),
       ticket_id = COALESCE(EXCLUDED.ticket_id, ${LINKS}.ticket_id), note = EXCLUDED.note, at = now()`,
    [key, v.item ?? null, v.task ?? null, v.ticket ?? null, v.note ?? ""],
  );
}

/** Today in Zurich, YYYY-MM-DD. */
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich" }).format(new Date());

/** The one run of this copy of the hub, if any; and whether it found nothing left to make. */
let running: Promise<void> | null = null;
let complete = false;

/** The set-up, started in the background when something is still to make (the plan or the tab opened). */
export function startBespokeSetup(by = BY): void {
  if (running || complete) return;
  running = (async () => {
    const [data, l] = await Promise.all([bespokeData(), links()]);
    if (!data) { complete = true; return; }
    if (missingOf(data, l) === 0) { complete = true; return; }
    await setup(data, by);
  })()
    .catch((e) => console.error("[bespoke] set-up failed:", (e as Error).message))
    .finally(() => { running = null; });
}

/** What is still to make: the two actions, the study's sub-action, and each sub-action with its ticket. */
function missingOf(data: BespokeData, l: Map<string, Link>): number {
  let n = 0;
  if (!l.get("action:study")?.item_id) n++;
  if (!l.get("action:impl")?.item_id) n++;
  if (!l.get("study:sub")?.ticket_id) n++;
  for (const s of data.subs) if (!l.get(`sub:${s.key}`)?.ticket_id) n++;
  return n;
}

/** Only one copy of the hub sets up at a time: a "run" mark, taken over when it is old (a copy stopped mid-run). */
async function claim(): Promise<boolean> {
  const r = await query<{ key: string }>(
    `INSERT INTO ${LINKS} (key, note) VALUES ('run', $1)
     ON CONFLICT (key) DO UPDATE SET note = EXCLUDED.note, at = now() WHERE ${LINKS}.at < now() - interval '${STALE_MIN} minutes'
     RETURNING key`,
    [`started ${new Date().toISOString()}`],
  );
  return r.rows.length > 0;
}
const release = () => query(`DELETE FROM ${LINKS} WHERE key = 'run'`);
const touch = () => query(`UPDATE ${LINKS} SET at = now() WHERE key = 'run'`);

/** A ticket's fields set in HubSpot directly (an existing ticket taken over: it then agrees with its sub-action). */
async function patchTicket(id: string, properties: Record<string, string>): Promise<void> {
  await hubspotFetchJson({ path: `/crm/v3/objects/tickets/${id}`, method: "PATCH", body: { properties } });
}

type SubFields = { title: string; note: string; owner: string; ownerName: string; start: string | null; due: string | null; stage: string; priority: string; statusNote: string };

/**
 * An existing ticket becomes a sub-action of `actionId`: the sub-action it already sits under moves there (its history
 * with it), else a new one takes it; the ticket and the sub-action are then given the same fields and marked in step.
 */
async function adopt(ticketId: string, actionId: number, f: SubFields, extra: Record<string, string>): Promise<number> {
  const r = await query<{ tile: string; task_id: number | null }>(`SELECT tile, task_id FROM ${TICKET_LINKS} WHERE ticket_id = $1 ORDER BY linked_at`, [ticketId]);
  let taskId: number | null = null;
  for (const x of r.rows) {
    const t = x.task_id != null ? await taskById(x.task_id) : null;
    if (t && t.tile.startsWith("plan:") && taskId == null) {
      if (t.planItem !== actionId && !(await moveSub(t.id, actionId, BY))) continue;
      taskId = t.id;
    } else if (x.task_id == null && /^plan:\d+$/.test(x.tile)) {
      // linked on an action itself: it leaves that action for its sub-action here
      await unlinkTicket(x.tile, ticketId);
      await forgetTicketSync(Number(x.tile.slice(5)));
    }
  }
  if (taskId == null) {
    const t = await addTask({ tile: `plan:${actionId}`, page: "plan", ...f, href: `/action-plan?item=${actionId}`, by: BY });
    await linkTickets(`plan:${actionId}`, [ticketId], BY, false, t.id);
    taskId = t.id;
  }
  await patchTicket(ticketId, {
    subject: f.title, content: `${f.note}\n\nOpen it: ${HUB}/action-plan?sub=${taskId}`, hs_pipeline_stage: f.stage,
    hs_ticket_priority: f.priority, hubspot_owner_id: f.owner, mkt_planned_date: f.start ?? "", mkt_golive_date: f.due ?? "",
    mkt_status_note: f.statusNote, ...extra,
  });
  await updateTask(taskId, f);
  await markTaskSync([taskId]);
  return taskId;
}

async function setup(data: BespokeData, by: string): Promise<void> {
  if (!(await claim())) { console.log("[bespoke] set-up already running in another copy of the hub"); return; }
  const errors: string[] = [];
  try {
    const items = await planItems();
    const cat = items.find((i) => i.id === data.category && i.kind === "topic")
      ?? items.find((i) => i.kind === "topic" && /branding/i.test(i.title) && /visibility/i.test(i.title));
    if (!cat) throw new Error("the category 'Increase APSOparts branding - visibility - foundability' is not in the plan");
    const form = await s2sForm(true);
    const names = new Map(form.owners.map((o) => [o.id, o.name]));
    const owners: PlanOwner[] = data.owners.filter((o) => names.has(o.id)).map((o) => ({ id: o.id, name: names.get(o.id) as string }));
    const l = await links();
    const day = today();
    const actionOf = async (key: string, title: string, fields: Partial<PlanFields>): Promise<number> => {
      const had = l.get(key)?.item_id;
      if (had && items.some((i) => i.id === had)) return had;
      const same = items.find((i) => i.kind === "action" && i.parentId === cat.id && i.title.trim().toLowerCase() === title.toLowerCase());
      const a = same ?? (await addItem({ parentId: cat.id, kind: "action", title, by }));
      await updateItem(a.id, fields, by);
      await keep(key, { item: a.id });
      console.log(`[bespoke] action "${title}" = row ${a.id}${same ? " (already there)" : ""}`);
      return a.id;
    };
    const common = { dg: true, owners, channel: ["SEO/GEO"], country: ["All"], roadmapYear: day.slice(0, 4) };
    const studyId = await actionOf("action:study", data.study.title, {
      ...common, detail: data.study.detail, agency: ["Bespoke"], priority: "HIGH", stage: LIVE, statusNote: data.study.statusNote,
    });
    const implId = await actionOf("action:impl", data.action.title, {
      ...common, detail: data.action.detail, agency: ["Bespoke", "dotSource"], priority: "URGENT", stage: IN_PROGRESS, statusNote: "",
    });

    // the study's one sub-action: the ticket that held it, closed
    if (!l.get("study:sub")?.ticket_id) {
      const s = data.study.sub;
      try {
        const task = await adopt(data.study.ticket, studyId, {
          title: s.title, note: s.note, owner: s.owner, ownerName: names.get(s.owner) ?? s.ownerName, start: s.planned, due: s.golive,
          stage: s.stage, priority: s.priority, statusNote: s.statusNote,
        }, { mkt_channel: "SEO/GEO", mkt_implementation_country: "All", mkt_agency: "Bespoke", mkt_roadmap_year: s.planned.slice(0, 4) });
        await keep("study:sub", { item: studyId, task, ticket: data.study.ticket });
      } catch (e) { errors.push(`${s.title}: ${(e as Error).message}`); }
    }

    // one sub-action per Bespoke request, each with its ticket
    const checks = new Map(data.checks.map((c) => [c.id, c]));
    const taken = [...form.takenRoadmapIds];
    // what is already under the action, by name, and the tickets they carry: a step whose mark was lost is found again,
    // never made twice
    const already = new Map((await tasksOf(`plan:${implId}`)).filter((t) => t.planItem === implId).map((t) => [t.title.trim().toLowerCase(), t.id]));
    const ticketOfTask = new Map((await taskTickets()).map((x) => [x.task, x.ticketId]));
    for (const s0 of data.subs) {
      const key = `sub:${s0.key}`;
      if (l.get(key)?.ticket_id) continue;
      await touch();
      // this tab is live once it sets itself up
      const s: BespokeSub = s0.key === "tab"
        ? { ...s0, stage: LIVE, planned: day, golive: day, speed: "Done", why: `Built and released ${dmy(day)}: this tab.` }
        : s0;
      const c = s.check != null ? checks.get(s.check) ?? null : null;
      const note = subNote(s, c);
      const f: SubFields = {
        title: s.title, note, owner: s.owner, ownerName: names.get(s.owner) ?? s.ownerName, start: s.planned, due: s.golive,
        stage: s.stage, priority: s.priority, statusNote: subStatusNote(s),
      };
      try {
        if (s.ticket) {
          const task = await adopt(s.ticket, implId, f, { mkt_channel: "SEO/GEO", mkt_implementation_country: "All", mkt_agency: s.agency.join(";"), mkt_roadmap_year: (s.planned ?? day).slice(0, 4) });
          await keep(key, { item: implId, task, ticket: s.ticket });
          continue;
        }
        // the sub-action first (kept at once, so a run cut short never makes it twice), then its ticket
        let taskId = l.get(key)?.task_id ?? null;
        if (taskId != null && !(await taskById(taskId))) taskId = null;
        if (taskId == null) taskId = already.get(s.title.trim().toLowerCase()) ?? null;
        const had = taskId != null ? ticketOfTask.get(taskId) : undefined;
        if (taskId != null && had) { await keep(key, { item: implId, task: taskId, ticket: had }); continue; }
        if (taskId == null) {
          const t = await addTask({ tile: `plan:${implId}`, page: "plan", ...f, href: `/action-plan?item=${implId}`, by });
          taskId = t.id;
          await keep(key, { item: implId, task: taskId });
        }
        const year = Number((s.planned ?? day).slice(0, 4));
        const roadmapId = nextRoadmapId(taken, year);
        taken.push(roadmapId);
        const id = await createTicket(ticketValues(s, note, `${HUB}/action-plan?sub=${taskId}`, roadmapId, day));
        await linkTickets(`plan:${implId}`, [id], by, true, taskId);
        await markTaskSync([taskId]);
        await keep(key, { item: implId, task: taskId, ticket: id });
      } catch (e) {
        errors.push(`${s.title}: ${(e as Error).message}`.slice(0, 300));
      }
    }
    await mainsFollowSubs().catch(() => undefined);
    // the two actions become HubSpot choices and every new ticket gets its place in the plan
    await syncPlanToHubspot("Bespoke plan set up").catch((e) => errors.push(`HubSpot plan properties: ${(e as Error).message}`));
    const after = await links();
    console.log(`[bespoke] set-up by ${by}: ${[...after.keys()].filter((k) => k.startsWith("sub:") && after.get(k)?.ticket_id).length} of ${data.subs.length} sub-actions with their ticket${errors.length ? `; ${errors.length} failed: ${errors.join(" | ")}` : ""}`);
  } catch (e) {
    errors.push((e as Error).message);
    console.error("[bespoke] set-up stopped:", (e as Error).message);
  } finally {
    await keep("errors", { note: errors.join("\n").slice(0, 4000) }).catch(() => undefined);
    await release().catch(() => undefined);
  }
}

/* ── the tab ───────────────────────────────────────────────────────────── */

export type CheckRow = BespokeCheck & {
  state: CheckState; late: boolean;
  sub: (LiveSub & { speed: string; why: string; basis: string; work: string }) | null;
  typed: Typed;
};
export type BespokeView = {
  ok: true; checks: CheckRow[]; today: string;
  setup: { missing: number; total: number; running: boolean; errors: string[] };
  actionId: number | null; studyId: number | null; source: string; website: string; columns: Record<string, string>;
};

export async function bespokeView(): Promise<BespokeView | null> {
  const data = await bespokeData();
  if (!data) return null;
  const [l, tasks, tt, typed] = await Promise.all([links(), planTasks(), taskTickets(), answers()]);
  const byTask = new Map(tasks.map((t) => [t.id, t]));
  const ticketOf = new Map<number, string>();
  for (const x of tt) if (!ticketOf.has(x.task)) ticketOf.set(x.task, x.ticketId);
  const spec = new Map(data.subs.filter((s) => s.check != null).map((s) => [s.check as number, s]));
  const day = today();
  const checks: CheckRow[] = data.checks.map((c) => {
    const s = spec.get(c.id);
    const k = s ? l.get(`sub:${s.key}`) : undefined;
    const t = k?.task_id != null ? byTask.get(k.task_id) : undefined;
    const sub = s && t ? {
      taskId: t.id, title: t.title, stage: t.stage, owner: t.owner, ownerName: t.ownerName, start: t.start, due: t.due,
      statusNote: t.statusNote, ticketId: ticketOf.get(t.id) ?? k?.ticket_id ?? null,
      speed: s.speed, why: s.why, basis: s.basis, work: s.work,
    } : null;
    return { ...c, state: stateOf(c, sub), late: lateOf(sub, day), sub, typed: typed.get(c.id) ?? {} };
  });
  const run = l.get("run");
  const runAt = run ? new Date(run.at as string | Date).getTime() : 0;
  return {
    ok: true, checks, today: day,
    setup: {
      missing: missingOf(data, l), total: data.subs.length + 3,
      running: !!running || (!!run && Date.now() - runAt < STALE_MIN * 60_000),
      errors: (l.get("errors")?.note ?? "").split("\n").filter(Boolean),
    },
    actionId: l.get("action:impl")?.item_id ?? null, studyId: l.get("action:study")?.item_id ?? null,
    source: data.source, website: data.website, columns: data.columns,
  };
}

async function answers(): Promise<Map<number, Typed>> {
  await ensure();
  const r = await query<{ check_id: number; validation: string | null; feedback: string | null }>(`SELECT check_id, validation, feedback FROM ${ANSWERS}`);
  return new Map(r.rows.map((x) => [x.check_id, { ...(x.validation != null ? { validation: x.validation } : {}), ...(x.feedback != null ? { feedback: x.feedback } : {}) }]));
}

/** Bespoke's own columns, typed in the tab when they answer: "Bespoke validation?" and "Bespoke feedback". */
export async function setAnswer(checkId: number, p: Typed, by: string): Promise<void> {
  await ensure();
  await query(
    `INSERT INTO ${ANSWERS} (check_id, validation, feedback, by_name) VALUES ($1, $2, $3, $4)
     ON CONFLICT (check_id) DO UPDATE SET validation = COALESCE(EXCLUDED.validation, ${ANSWERS}.validation),
       feedback = COALESCE(EXCLUDED.feedback, ${ANSWERS}.feedback), by_name = EXCLUDED.by_name, at = now()`,
    [checkId, p.validation ?? null, p.feedback ?? null, by],
  );
}

/** Whether a check id is one of Bespoke's. */
export async function isCheck(id: number): Promise<boolean> {
  return !!(await bespokeData())?.checks.some((c) => c.id === id);
}
export { isOpenCheck };
