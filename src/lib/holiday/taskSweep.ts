// THE TASK DEPUTY SWEEP - the other half of Holiday redirection.
//
// Brings the HubSpot workflow "SARCLA | DEPUTY TASK" into the hub (SARCLA,
// 21.10.2026), beside the ticket sweep that already replaced "SARCLA | TICKET
// DEPUTY SYSTEM". Tickets and tasks now answer to the same rules: the chain
// itself lives in connectors/steps/ticketRules.ts and is imported, never
// copied, so a change to who stands in for whom cannot drift between the two.
//
// Two things the workflow did worse, fixed here rather than carried over:
//
//  1. It read only `hs_is_out_of_office`. That boolean is HubSpot chat presence
//     as much as real absence - somebody who never opens the chat tab reads as
//     away for ever. The ticket sweep therefore ALSO requires an
//     `hs_out_of_office_hours` window containing now, and so does this one.
//     (The requirement lives in the caller, not in `userState`: `userState.ooo`
//     is the bare boolean, and `deputyDecision` is where tickets add the window.
//     Tasks cannot reuse `deputyDecision` - it is full of ticket stages and
//     subjects - so the window check is repeated here, deliberately and
//     visibly, rather than being quietly left out.)
//
//     What tasks do NOT copy is the ticket rule that skips anything created
//     BEFORE the absence began. For a ticket that is right: an old ticket is
//     not new work arriving while somebody is away. For a task it is wrong -
//     a "Mark Company as Qualified" sitting in an absent person's list is
//     exactly what should move, and leaving it would recreate the gap this
//     port exists to close.
//
//  2. It fired on enrolment. A task created while its owner was in office, who
//     then went on holiday, was never looked at again - the one case the whole
//     feature exists for. A sweep re-reads every open task in scope on each
//     run, so a holiday that starts after the task does is still caught.
//
// The scope is the workflow's, unchanged: three task subjects, nothing else.
// Everything outside it keeps its owner.

import { hubspotFetchJson } from "../integrations/hubspot";
import {
  TSA_OWNER, USER_PROPS, deputyTarget, userState,
  type UserState,
} from "../connectors/steps/ticketRules";

type Props = Record<string, string | null>;
type Obj = { id: string; properties?: Props };
type Page = { results?: Obj[]; paging?: { next?: { after?: string } } };
type Beat = () => Promise<void>;

const hs = <T>(path: string, method: "GET" | "POST" | "PATCH" = "GET", body?: unknown) =>
  hubspotFetchJson<T>({ path, method, body });

/**
 * The subjects the workflow redirects, and only these.
 *
 * "New registrant" is a PREFIX because HubSpot appends a customer code to it
 * ("New registrant KOLE"); the two "Pending:" subjects come from templated
 * workflow actions, so they are matched exactly. A task outside this list is
 * somebody's own work and is left where it is, holiday or not.
 */
export const EXACT_SUBJECTS = [
  "Pending: Mark Company as Qualified or Not",
  "Pending: Select Disqualification Reason",
];
export const PREFIX_SUBJECTS = ["New registrant"];

export function subjectInScope(subject: string | null | undefined): boolean {
  const s = (subject ?? "").trim();
  if (!s) return false;
  return EXACT_SUBJECTS.includes(s) || PREFIX_SUBJECTS.some((p) => s.startsWith(p));
}

/** A finished task is nobody's problem. The workflow skipped these too. */
export const OPEN_STATUSES = ["NOT_STARTED", "WAITING", "IN_PROGRESS"];

export type TaskMove = { id: string; from: string; to: string; reason: string; subject: string };

/**
 * Every open task in scope, by search.
 *
 * Three filter groups ORed: the two exact subjects, and a token match for the
 * "New registrant" family. The token match is deliberately WIDER than the rule
 * - it finds "New registrant KOLE" but would also find other subjects carrying
 * that word - so `subjectInScope` is applied again to every row that comes
 * back. The search narrows; the rule decides.
 */
async function openTasksInScope(beat: Beat): Promise<Obj[]> {
  const props = ["hs_task_subject", "hubspot_owner_id", "hs_task_status"];
  const status = { propertyName: "hs_task_status", operator: "IN", values: OPEN_STATUSES };
  const groups = [
    ...EXACT_SUBJECTS.map((v) => ({ filters: [{ propertyName: "hs_task_subject", operator: "EQ", value: v }, status] })),
    ...PREFIX_SUBJECTS.map((v) => ({ filters: [{ propertyName: "hs_task_subject", operator: "CONTAINS_TOKEN", value: `${v}*` }, status] })),
  ];
  const out: Obj[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    let after: string | undefined;
    for (let page = 0; page < 60; page++) {
      const j = await hs<Page>("/crm/v3/objects/tasks/search", "POST", {
        filterGroups: [group], properties: props, limit: 100, ...(after ? { after } : {}),
      });
      for (const t of j.results ?? []) {
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        out.push(t);
      }
      after = j.paging?.next?.after;
      if (!after) break;
      await beat();
    }
  }
  return out;
}

export type TaskSweepResult = {
  dry: boolean;
  scanned: number;
  in_scope: number;
  moved: number;
  no_owner: number;
  owner_in_office: number;
  away_no_deputy: number;
  /** Flagged out of office, but with no absence window holding now - left alone. */
  no_absence_window: number;
  /** The owner has left: left to Owner redirection's leaver rules, not handed to a deputy. */
  owner_has_left: number;
  /** Somebody else moved or closed it between the search and the write. */
  changed_under_us: number;
  write_failed: number;
  tsa_fallback: boolean;
  user_lookups: number;
  user_lookup_failed: number;
  moves: TaskMove[];
  seconds: number;
};

/**
 * Hand every open task in scope to the deputy of whoever is away.
 *
 * `live` false plans and writes nothing, which is how the page previews it.
 */
export async function taskDeputySweep(
  live: boolean,
  beat: Beat = async () => {},
  opts: { tsaFallback?: boolean } = {},
): Promise<TaskSweepResult> {
  const t0 = Date.now();
  const tsaFallback = opts.tsaFallback ?? process.env.DEPUTY_TSA_FALLBACK === "1";
  const tasks = await openTasksInScope(beat);
  await beat();

  // Users are looked up only when the rules ask for one, and cached: a sweep
  // over hundreds of tasks owned by a dozen people must not be a dozen hundred
  // searches.
  const users = new Map<string, UserState>();
  /** Owners HubSpot says have left. Filled from the same read, so it costs no extra call. */
  const gone = new Set<string>();
  let lookups = 0, lookupFailed = 0;
  const load = async (id: string) => {
    lookups += 1;
    let props: Props | null = null;
    try {
      const j = await hs<Page>("/crm/v3/objects/users/search", "POST", {
        filterGroups: [{ filters: [{ propertyName: "hubspot_owner_id", operator: "EQ", value: id }] }],
        properties: USER_PROPS, limit: 1,
      });
      props = j.results?.[0]?.properties ?? null;
      if (props?.hs_deactivated === "true") gone.add(id);
    } catch (e) {
      const st = (e as { status?: number })?.status;
      if (st === 401 || st === 403) {
        throw new Error("users search refused: the hub's app needs crm.objects.users.read to see who is out of office - nothing was moved");
      }
      lookupFailed += 1;
    }
    users.set(id, userState(id, props, Date.now()));
  };

  const moves: TaskMove[] = [];
  let inScope = 0, noOwner = 0, inOffice = 0, awayNoDeputy = 0, noWindow = 0, left = 0;
  for (const t of tasks) {
    const p = t.properties ?? {};
    if (!subjectInScope(p.hs_task_subject)) continue; // the token search is wider than the rule
    inScope += 1;
    const owner = p.hubspot_owner_id ?? "";
    if (!owner) { noOwner += 1; continue; }

    let d = deputyTarget(owner, (id) => users.get(id), tsaFallback);
    while ("need" in d) {
      await load(d.need);
      d = deputyTarget(owner, (id) => users.get(id), tsaFallback);
    }
    // LEFT BEATS AWAY (agreed with f5, 25.10.2026). Owner redirection moves the open work of
    // people who have left, and its leaver rules target a company or team owner. This sweep only
    // knows about absence, and a deactivated account often still carries an out-of-office flag
    // nobody cleared - so without this guard the two would move the same task to different owners
    // every 15 minutes, for ever. A deputy standing in for somebody who is never coming back is
    // the wrong answer anyway: their work belongs to whoever took the job over.
    if (gone.has(owner)) { left += 1; continue; }
    if (!d.to) { if (d.reason) awayNoDeputy += 1; else inOffice += 1; continue; }
    if (d.to === owner) { inOffice += 1; continue; }
    // Out of office, but no absence window holding now: the boolean on its own
    // is not evidence of a holiday, so the task stays put and is counted.
    if (!users.get(owner)?.window) { noWindow += 1; continue; }
    moves.push({ id: t.id, from: owner, to: d.to, reason: d.reason, subject: (p.hs_task_subject ?? "").slice(0, 70) });
  }

  let moved = 0, stale = 0, failed = 0;
  if (live && moves.length) {
    // One at a time, on purpose: a task that refuses the write must not take
    // the rest of the sweep with it, and there are tens of these, not tens of
    // thousands.
    for (const m of moves) {
      try {
        // Re-read the owner immediately before writing. The search that found
        // this task may be a minute old, and the ticket sweep runs beside this
        // one: if anything has moved it since, that decision is newer than
        // ours and we leave it alone (f5, 21.10.2026).
        const fresh = await hs<Obj>(`/crm/v3/objects/tasks/${m.id}?properties=hubspot_owner_id,hs_task_status`);
        const ownerNow = fresh.properties?.hubspot_owner_id ?? "";
        if (ownerNow !== m.from) { stale += 1; continue; }
        if (!OPEN_STATUSES.includes(fresh.properties?.hs_task_status ?? "")) { stale += 1; continue; }
        await hs(`/crm/v3/objects/tasks/${m.id}`, "PATCH", { properties: { hubspot_owner_id: m.to } });
        moved += 1;
      } catch {
        failed += 1; // the next sweep tries again in 15 minutes
      }
      await beat();
    }
  }

  return {
    dry: !live, scanned: tasks.length, in_scope: inScope, moved: live ? moved : moves.length,
    no_owner: noOwner, owner_in_office: inOffice, away_no_deputy: awayNoDeputy, no_absence_window: noWindow, owner_has_left: left,
    changed_under_us: stale, write_failed: failed,
    tsa_fallback: tsaFallback, user_lookups: lookups, user_lookup_failed: lookupFailed,
    moves: moves.slice(0, 50), seconds: Math.round((Date.now() - t0) / 100) / 10,
  };
}

export { TSA_OWNER };
