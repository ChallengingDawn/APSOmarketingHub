// BESPOKE'S TECHNICAL CHECK IN THE ACTION PLAN (SARCLA 04.11.2026: "we need tracking per Bespoke request"; "if we bring
// the list as a sub app via the header we could update it automatically, ready to export"). Bespoke's SEO/GEO technical
// check of apsoparts.com (June 2026, 137 checks) lives in src/data/bespokeChecks.json - each open check has one
// sub-action of "Bespoke technical plan - implementation", with its own Scroll to Sale ticket. A check's status follows
// that sub-action: Live or Maintaining makes it OK, Killed makes it N/A. The export writes Bespoke's own columns back.
// Rules only, no database: bespoke.ts reads and writes, tests/bespoke.test.ts holds them.

/** One row of Bespoke's tab "SEO Technical Check (step by step)", its comments back on their own row. */
export type BespokeCheck = {
  id: number; topic: string; page: string; scope: string; desc: string; prio: string; status: string;
  observation: string; who: string; solved: string; next: string; resolved: string; validation: string; feedback: string;
  /** Bespoke's Priority MAP: "TIER 1".."TIER 4", its rank, Easy / Medium / Hard */
  tier: string; rank: number | null; difficulty: string;
  /** in plain words, for the open ones: what Bespoke found, what Bespoke asks */
  found: string; ask: string;
};
/** One sub-action as planned on 04.11.2026; `check` null for the one that is not a Bespoke request (this tab). */
export type BespokeSub = {
  key: string; check: number | null; title: string; stage: string; priority: string; owner: string; ownerName: string;
  planned: string | null; golive: string | null; agency: string[]; work: string; speed: string; why: string; basis: string;
  /** an existing ticket it takes over, instead of a new one */
  ticket: string | null;
};
export type BespokeData = {
  source: string; website: string; columns: Record<string, string>; category: number;
  study: { title: string; detail: string; statusNote: string; ticket: string;
    sub: { title: string; stage: string; priority: string; owner: string; ownerName: string; planned: string; golive: string; note: string; statusNote: string } };
  action: { title: string; detail: string };
  owners: { id: string; name: string }[];
  checks: BespokeCheck[];
  subs: BespokeSub[];
};

/** A sub-action as the plan has it now (its ticket keeps it in step). */
export type LiveSub = {
  taskId: number; title: string; stage: string | null; owner: string; ownerName: string;
  start: string | null; due: string | null; statusNote: string; ticketId: string | null;
};
/** What the team typed for Bespoke's own two columns. */
export type Typed = { validation?: string; feedback?: string };

const OK_STAGES = ["6161856758", "6161856759"]; // Live, Maintaining Internally
const KILLED = "6161860810";
export const STAGE_LABEL: Record<string, string> = {
  "6161860807": "Idea box", "6161860808": "In Progress", "6161845476": "Waiting on APSO", "6161845477": "Waiting on Agency",
  "6161860809": "Ready to Roll", "6161856758": "Live", "6161856759": "Maintaining Internally", "6161860810": "Killed",
};
/** The team's codes as Bespoke's "Who?" column writes them. */
const CODES: Record<string, string> = { "1229976033": "SARCLA", "754305239": "WIDA", "32991392": "PYTALE", "1694460619": "FEHDIA" };

/** Open in Bespoke's sheet: KO or Incomplete. */
export const isOpenCheck = (c: Pick<BespokeCheck, "status">) => c.status === "KO" || c.status === "Incomplete";

export type CheckState = "open" | "ok" | "na";
/** Where a check stands: its sub-action decides; a check without one keeps Bespoke's status. */
export function stateOf(c: Pick<BespokeCheck, "status">, sub: Pick<LiveSub, "stage"> | null): CheckState {
  if (sub?.stage && OK_STAGES.includes(sub.stage)) return "ok";
  if (sub?.stage === KILLED) return "na";
  if (sub) return "open";
  if (c.status === "N/A") return "na";
  return isOpenCheck(c) ? "open" : "ok";
}

/** A check is late when its sub-action is open and its planned date has passed (the plan's own rule). */
export function lateOf(sub: Pick<LiveSub, "stage" | "start"> | null, today: string): boolean {
  if (!sub || !sub.start || (sub.stage && (OK_STAGES.includes(sub.stage) || sub.stage === KILLED))) return false;
  return sub.start < today;
}

/** dd.mm.yyyy, as Bespoke's sheet writes dates. */
export const dmy = (iso: string | null | undefined) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "");

/** A sub-action's description: what Bespoke found and asks, who does it, where its date comes from. */
export function subNote(s: BespokeSub, c: BespokeCheck | null): string {
  if (!c) return [s.why, s.basis ? `Planned date: ${s.basis}` : ""].filter(Boolean).join("\n");
  return [
    `Bespoke check #${c.id} (${c.topic}${c.page ? ` · ${c.page}` : ""}): ${c.desc}`,
    c.found ? `Bespoke found: ${c.found}` : "",
    c.ask ? `Bespoke asks: ${c.ask}` : "",
    s.work ? `Who does it: ${s.work}` : "",
    s.basis ? `Planned date: ${s.basis}` : "",
    `Done when Bespoke marks check #${c.id} OK.`,
  ].filter(Boolean).join("\n");
}

/** Its status note: can we go fast, and why (SARCLA 04.11.2026: "a comment saying why we can go fast or not"). */
export const subStatusNote = (s: BespokeSub) => `${s.speed === "Done" || s.speed === "Killed" ? s.speed : `Speed: ${s.speed}`} - ${s.why}`.slice(0, 4000);

/** The roadmap year of a sub-action: its planned date's, else this year. */
export const yearOf = (s: Pick<BespokeSub, "planned">, today: string) => (s.planned ?? today).slice(0, 4);

/** A new ticket's fields for a sub-action, in the pipeline's terms (scrollToSaleRules.S2S_FIELDS). */
export function ticketValues(s: BespokeSub, note: string, openIt: string, roadmapId: string, today: string): Record<string, string> {
  return {
    subject: s.title,
    content: `${note}\n\nOpen it: ${openIt}`,
    hs_pipeline_stage: s.stage,
    hs_ticket_priority: s.priority,
    hubspot_owner_id: s.owner,
    mkt_channel: "SEO/GEO",
    mkt_implementation_country: "All",
    mkt_agency: s.agency.join(";"),
    mkt_roadmap_year: yearOf(s, today),
    mkt_roadmap_id: roadmapId,
    mkt_planned_date: s.planned ?? "",
    mkt_golive_date: s.golive ?? "",
    mkt_status_note: subStatusNote(s),
  };
}

/** Bespoke's "validation?" column holds 0 or 1 (a tick box): typed Yes / No as theirs, else as they left it. */
export function validationCell(typed: string | undefined, theirs: string): string | number {
  if (typed === "Yes") return 1;
  if (typed === "No") return 0;
  return /^\d+$/.test(theirs) ? Number(theirs) : theirs;
}

/** Bespoke's columns A..N, in their order, for the export. */
export const EXPORT_COLUMNS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"] as const;

/**
 * One check as Bespoke's sheet row, our answers in: status, who, problem solved, next steps and resolution date from its
 * sub-action; Bespoke's validation and feedback as typed in the tab, else as they wrote them.
 */
export function exportRow(c: BespokeCheck, sub: LiveSub | null, typed: Typed | undefined): (string | number)[] {
  const st = stateOf(c, sub);
  const status = !sub ? c.status : st === "ok" ? "OK" : st === "na" ? "N/A" : c.status;
  const who = sub ? CODES[sub.owner] ?? sub.ownerName ?? c.who : c.who;
  const solved = !sub ? c.solved : st === "ok" ? "Yes" : st === "na" ? "N/A" : "No";
  const next = !sub ? c.next : [
    [STAGE_LABEL[sub.stage ?? ""] ?? "", sub.ownerName, sub.start && st === "open" ? `planned ${dmy(sub.start)}` : "", st === "ok" && sub.due ? `live ${dmy(sub.due)}` : ""].filter(Boolean).join(" · "),
    sub.statusNote,
  ].filter(Boolean).join(": ");
  const resolved = sub && st === "ok" ? dmy(sub.due) || c.resolved : c.resolved;
  return [
    c.id, c.topic, c.page, c.scope, c.desc, c.prio ? Number(c.prio) || c.prio : "", status, c.observation, who, solved, next, resolved,
    validationCell(typed?.validation, c.validation), typed?.feedback ?? c.feedback,
  ];
}
