// DUPLICATES - the ticket properties the hub writes (SARCLA 02.11.2026, "a new clean group"): what a duplicate is, of
// which ticket, why, and the decision a person takes on the card (or in the ticket's left sidebar). The DUPS workflow's
// own - dup_detected, dup_reason_and_id ("No duplicates found" on every ticket) and Comment for Back Office (people's
// notes, written over) - stay as they are until views and reports have moved; the hub never writes them.
// Made by the hub when asked (Settings, "Create the properties"): the group, then each property missing. Creating a
// property needs the app's crm.schemas.tickets.write.

import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { IntegrationError } from "@/lib/integrations/status";

export const GROUP = { name: "duplicates", label: "Duplicates (APSOhub)" };
type Opt = { label: string; value: string };
type Def = { name: string; label: string; description: string; type: "enumeration" | "string" | "datetime"; fieldType: "select" | "text" | "textarea" | "date"; options?: Opt[]; formField?: boolean };

export const STATUS_OPTIONS: Opt[] = [
  { value: "possible", label: "Possible duplicate" },
  { value: "related", label: "Same order - another open ticket" },
  { value: "merged", label: "Merged" },
  { value: "not_duplicate", label: "Not a duplicate" },
];
export const TYPE_OPTIONS: Opt[] = [
  { value: "twice", label: "Same request twice" },
  { value: "order", label: "Same order" },
  { value: "erosion", label: "Same erosion win-back" },
];
export const DECISION_OPTIONS: Opt[] = [
  { value: "merge", label: "Merge them" },
  { value: "not_duplicate", label: "Not a duplicate" },
];

export const PROPS: Def[] = [
  { name: "dup_status", label: "Duplicate", type: "enumeration", fieldType: "select", options: STATUS_OPTIONS,
    description: "APSOhub: a possible duplicate (a person decides), another open ticket on the same order, merged, or not a duplicate." },
  { name: "dup_type", label: "Duplicate type", type: "enumeration", fieldType: "select", options: TYPE_OPTIONS,
    description: "APSOhub: why it is one - the same request twice, the same order, or the same erosion win-back." },
  { name: "dup_of_ticket", label: "Duplicate of ticket", type: "string", fieldType: "text",
    description: "APSOhub: the other ticket ids, the one to merge into first (separated by ;)." },
  { name: "dup_why", label: "Duplicate - why", type: "string", fieldType: "textarea",
    description: "APSOhub: one sentence - what the tickets share, and when." },
  { name: "dup_checked_at", label: "Duplicate checked at", type: "datetime", fieldType: "date",
    description: "APSOhub: when the hub last looked for this ticket's duplicates." },
  { name: "dup_decision", label: "Duplicate - decision", type: "enumeration", fieldType: "select", options: DECISION_OPTIONS, formField: true,
    description: "Set it to merge the tickets or to say they are not duplicates - APSOhub does it within a minute and empties it again." },
  { name: "dup_decided_by", label: "Duplicate - decided by", type: "string", fieldType: "text",
    description: "APSOhub: who took the last decision on the card." },
];
export const PROP_NAMES = PROPS.map((p) => p.name);

export type PropsState = { ready: boolean; have: string[]; missing: string[]; checkedAt: string; error?: string };
let cache: PropsState | null = null;

/** Which of the hub's properties HubSpot has (read at most every 10 minutes). */
export async function propsState(fresh = false): Promise<PropsState> {
  if (!fresh && cache && Date.now() - Date.parse(cache.checkedAt) < 10 * 60_000) return cache;
  try {
    const r = await hubspotRetry<{ results?: { name: string }[] }>({ path: "/crm/v3/properties/tickets" });
    const names = new Set((r.results ?? []).map((p) => p.name));
    const have = PROP_NAMES.filter((n) => names.has(n));
    cache = { ready: have.length === PROP_NAMES.length, have, missing: PROP_NAMES.filter((n) => !names.has(n)), checkedAt: new Date().toISOString() };
  } catch (e) {
    cache = { ready: false, have: [], missing: PROP_NAMES, checkedAt: new Date().toISOString(), error: (e as Error).message.slice(0, 200) };
  }
  return cache;
}

/** The group and every property missing - nothing that exists is changed. */
export async function createProps(): Promise<PropsState> {
  const st = await propsState(true);
  if (st.error) throw new Error(st.error);
  try {
    await hubspotRetry({ path: "/crm/v3/properties/tickets/groups", method: "POST", body: { name: GROUP.name, label: GROUP.label, displayOrder: -1 } });
  } catch (e) {
    // already there
    if (!(e instanceof IntegrationError && e.status === 409)) throw e;
  }
  for (const p of PROPS.filter((x) => st.missing.includes(x.name))) {
    await hubspotRetry({
      path: "/crm/v3/properties/tickets", method: "POST",
      body: { name: p.name, label: p.label, description: p.description, groupName: GROUP.name, type: p.type, fieldType: p.fieldType, formField: !!p.formField,
        ...(p.options ? { options: p.options.map((o, i) => ({ ...o, displayOrder: i, hidden: false })) } : {}) },
    });
  }
  return propsState(true);
}
