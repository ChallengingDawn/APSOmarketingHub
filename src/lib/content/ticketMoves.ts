// A TO-DO'S TICKET FOLLOWS ITS PIECE (SARCLA 10.11.2026: "on clicking the ticket I should be able to move it from stage /
// automatically when planned on the content calendar -> Ready to roll, and then when live -> go to Live automatically, and
// fill the go-live properties as well").
//
//   by hand   a click on the to-do's ticket chip picks any stage of the pipeline - HubSpot is asked at once
//             (todos.ts moveTodoTicket, scrollToSale.ts moveTicket)
//   planned   the piece gets a date on the content calendar: its ticket goes to the stage named "Ready to roll"
//   live      the piece goes live: its ticket goes to the stage named "Live", and its go-live date is the day it went live
//
// The automatic moves only ever go FORWARD in the pipeline's order and do nothing when the ticket is already there or past
// it (a ticket kept as Maintaining Internally, or Killed, stays). The stages are found by their NAME in the pipeline as
// HubSpot answers it. They change the sub-action; the plan's two-way sync takes them on to the ticket - one writer
// (actionPlanHubspot.ts), as a sub-action ticked done already did. The piece's other status changes move it as before
// (pieceRules.STATUS_STAGE), forward only too - except a piece opened again after it was live (a person taking it back),
// and changes asked on a piece in review: from Waiting on APSO back to In Progress, the writer's again (Content v11).
//
// Pure: no database, no HubSpot - the pipeline and the ticket's stage come in, the move goes out
// (tests/content-ticket-moves.test.ts).

import { STATUS_STAGE, type PieceStatus } from "./pieceRules";

/** A stage of the pipeline, in its order; `open` false for the closed ones (Live, Maintaining Internally, Killed). */
export type PipeStage = { value: string; label: string; open?: boolean };

export const READY_NAME = "Ready to roll";
export const LIVE_NAME = "Live";

/** "Ready to Roll", "ready to roll" and "Ready-to-roll" are one name. */
const nameKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** The pipeline's stage of that name, or null when it has none. */
export function stageNamed(stages: readonly PipeStage[], name: string): PipeStage | null {
  const k = nameKey(name);
  return stages.find((s) => nameKey(s.label) === k) ?? null;
}

const placeOf = (stages: readonly PipeStage[], id: string | null | undefined) => (id ? stages.findIndex((s) => s.value === id) : -1);

/**
 * `to`, when the ticket stands before it in the pipeline's order; null when it is already there or past it. A ticket with
 * no stage yet takes it; one whose stage is not of this pipeline is left alone.
 */
export function forward(stages: readonly PipeStage[], current: string | null | undefined, to: PipeStage | null): PipeStage | null {
  if (!to) return null;
  const want = placeOf(stages, to.value);
  if (want < 0) return null;
  if (!current) return to;
  const now = placeOf(stages, current);
  return now >= 0 && now < want ? to : null;
}

export const isDay = (v: string | null | undefined): v is string =>
  !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

/** Today in Switzerland as YYYY-MM-DD - the day a piece went live, whatever the server's clock zone. */
export function swissDay(at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

/**
 * The ticket's go-live properties, for a piece live on `day`. Only real properties: the ones the From Scroll to Sale form
 * has (scrollToSaleRules.S2S_FIELDS) - today the go-live date alone. The pipeline has no property for the live page's
 * address, and its report link was taken out (SARCLA 02.11.2026: "report link - take out completely").
 */
export const GO_LIVE_PROPS: readonly { prop: string; value: (day: string) => string }[] = [
  { prop: "mkt_golive_date", value: (day) => day },
];
export function goLiveProps(day: string, formFields: readonly string[]): Record<string, string> {
  if (!isDay(day)) return {};
  const has = new Set(formFields);
  return Object.fromEntries(GO_LIVE_PROPS.filter((p) => has.has(p.prop)).map((p) => [p.prop, p.value(day)]));
}

/** The sub-action's field behind a ticket property, as the plan's sync carries it (actionPlanRules.SUB_TICKET_SYNC). */
const SUB_FIELD: Record<string, "due" | "start"> = { mkt_golive_date: "due", mkt_planned_date: "start" };

/** What changed on a piece. */
export type PieceChange = {
  status: PieceStatus;
  /** its status before - when its status changed */
  was?: PieceStatus | null;
  /** its date on the content calendar, after the change */
  dueDate: string | null;
  changed: { status?: boolean; due?: boolean };
};

export type Why = "planned" | "live" | "status" | "reopened" | "changes";
/** The sub-action's move: its stage (null = it stays) and the fields that go with it (the go-live date). */
export type SubMove = { to: PipeStage | null; why: Why; fields: { due?: string; start?: string } };

/**
 * Where the sub-action - and so its ticket - goes after a change of its piece. `now` = where the ticket stands in HubSpot
 * now (else the sub-action's own stage) and the sub-action's dates; `today` the day it happens. Null when nothing moves:
 * asked twice, the second time is null (idempotent).
 */
export function pieceMove(stages: readonly PipeStage[], now: { stage: string | null; due: string | null; start?: string | null }, c: PieceChange,
  today: string, formFields: readonly string[]): SubMove | null {
  const live = stageNamed(stages, LIVE_NAME);
  if (c.changed.status && c.status === "live") {
    const to = forward(stages, now.stage, live);
    // at Live once moved (or there already): its go-live properties; past it (Maintaining Internally, Killed) it is left
    const atLive = !!to || (!!live && now.stage === live.value);
    const fields: SubMove["fields"] = {};
    if (atLive) {
      for (const [prop, v] of Object.entries(goLiveProps(today, formFields))) {
        const f = SUB_FIELD[prop];
        if (f && (now[f] ?? null) !== v) fields[f] = v;
      }
    }
    return to || Object.keys(fields).length ? { to, why: "live", fields } : null;
  }
  if (c.changed.status) {
    const mapped = stages.find((s) => s.value === STATUS_STAGE[c.status]) ?? null;
    // opened again after it was live: a person takes it back - the one move backwards
    if (c.was === "live") return mapped && mapped.value !== now.stage ? { to: mapped, why: "reopened", fields: {} } : null;
    // changes asked by its reviewer: back to the writer - from Waiting on APSO to In Progress (SARCLA 10.11.2026: "back to
    // the user when asked for changes"); a ticket elsewhere (planned at Ready to roll, past it) stays
    if (c.status === "changes" && c.was === "review") {
      return mapped && now.stage === STATUS_STAGE.review && mapped.value !== now.stage ? { to: mapped, why: "changes", fields: {} } : null;
    }
    const to = forward(stages, now.stage, mapped);
    if (to) return { to, why: "status", fields: {} };
  }
  if (c.changed.due && isDay(c.dueDate) && c.status !== "live") {
    const to = forward(stages, now.stage, stageNamed(stages, READY_NAME));
    if (to) return { to, why: "planned", fields: {} };
  }
  return null;
}

const short = (day: string | null | undefined) => (isDay(day) ? `${day.slice(8, 10)}.${day.slice(5, 7)}` : "");

/** The log's line for an automatic move: "[content] ticket 123 -> Ready to Roll (piece 45 planned 14.11)". */
export function moveLine(m: SubMove, x: { ticketId: string | null; taskId: number; pieceId: number; status: PieceStatus; dueDate: string | null }): string {
  const who = x.ticketId ? `ticket ${x.ticketId}` : `to-do ${x.taskId} (no ticket)`;
  const what = [m.to ? `-> ${m.to.label}` : "", m.fields.due ? `go-live date ${m.fields.due}` : ""].filter(Boolean).join(", ");
  const why = m.why === "planned" ? `planned ${short(x.dueDate)}`
    : m.why === "live" ? `live${m.fields.due ? ` ${short(m.fields.due)}` : ""}`
      : m.why === "reopened" ? `opened again, ${x.status}` : m.why === "changes" ? "changes asked" : x.status;
  return `[content] ${who} ${what} (piece ${x.pieceId} ${why})`;
}

/** What the page says when HubSpot did not take a move made by hand - in plain words, with where the ticket stays. */
export function refusalText(reason: string, to: string, stays: string): string {
  const r = reason.replace(/^HubSpot:\s*/i, "").trim().replace(/\.$/, "");
  return `HubSpot did not move the ticket to ${to}${r ? `: ${r}` : ""}. It stays at ${stays || "its stage"}.`;
}
