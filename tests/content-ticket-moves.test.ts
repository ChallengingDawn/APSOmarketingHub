import assert from "node:assert/strict";
import { test } from "node:test";
import { forward, goLiveProps, moveLine, pieceMove, refusalText, stageNamed, swissDay, type PipeStage } from "../src/lib/content/ticketMoves";
import { IN_PROGRESS, LIVE, STAGES } from "../src/lib/reporting/actionPlanRules";
import { S2S_FIELDS } from "../src/lib/reporting/scrollToSaleRules";

// SARCLA 10.11.2026: "automatically when planned on the content calendar -> Ready to roll, and then when live -> go to Live
// automatically, and fill the go-live properties as well". A made-up pipeline in the real one's order: Ready to Roll and
// Live carry ids that are not HubSpot's, so the rules must find them by their name; In Progress and Waiting on APSO keep
// theirs, as the piece's other statuses go by id (pieceRules.STATUS_STAGE). No HubSpot here at all.
const PIPE: PipeStage[] = [
  { value: "s-idea", label: "Idea box", open: true },
  { value: "6161860808", label: "In Progress", open: true },
  { value: "6161845476", label: "Waiting on APSO", open: true },
  { value: "s-agency", label: "Waiting on Agency", open: true },
  { value: "s-ready", label: "Ready to Roll", open: true },
  { value: "s-live", label: "Live", open: false },
  { value: "s-kept", label: "Maintaining Internally", open: false },
  { value: "s-killed", label: "Killed", open: false },
];
const FORM = ["subject", "hs_pipeline_stage", "mkt_planned_date", "mkt_golive_date", "mkt_status_note"];
const TODAY = "2026-11-12";
const planned = (stage: string | null, dueDate: string | null = "2026-11-14") =>
  pieceMove(PIPE, { stage, due: dueDate }, { status: "todo", dueDate, changed: { due: true } }, TODAY, FORM);
const wentLive = (stage: string | null, due: string | null = "2026-11-14") =>
  pieceMove(PIPE, { stage, due }, { status: "live", was: "approved", dueDate: "2026-11-14", changed: { status: true } }, TODAY, FORM);

test("the stages are found by their name, whatever the case or the dashes", () => {
  assert.equal(stageNamed(PIPE, "Ready to roll")?.value, "s-ready");
  assert.equal(stageNamed(PIPE, "ready-to-ROLL")?.value, "s-ready");
  assert.equal(stageNamed(PIPE, "Live")?.value, "s-live");
  assert.equal(stageNamed(PIPE, "Published"), null);
});

test("planned on the calendar: the ticket goes to Ready to roll - from any stage before it", () => {
  for (const s of [null, "s-idea", "6161860808", "6161845476", "s-agency"]) assert.equal(planned(s)?.to?.value, "s-ready", `from ${s}`);
  assert.equal(planned("s-idea")?.why, "planned");
});

test("planned: never backwards - at Ready to roll or past it, nothing moves", () => {
  for (const s of ["s-ready", "s-live", "s-kept", "s-killed"]) assert.equal(planned(s), null, `from ${s}`);
  // a stage that is not of this pipeline is left alone
  assert.equal(planned("999"), null);
});

test("planned: the date taken away, or a live piece's date moved, moves nothing", () => {
  assert.equal(planned("s-idea", null), null);
  assert.equal(pieceMove(PIPE, { stage: "s-idea", due: null }, { status: "live", dueDate: "2026-11-20", changed: { due: true } }, TODAY, FORM), null);
});

test("the same change twice: the second time nothing moves (idempotent)", () => {
  const first = planned("6161860808")!;
  assert.equal(planned(first.to!.value), null);
  const live = wentLive("s-ready")!;
  assert.equal(wentLive(live.to!.value, live.fields.due!), null);
});

test("a pipeline without a stage of that name: nothing moves", () => {
  const other = PIPE.filter((s) => s.label !== "Ready to Roll");
  assert.equal(pieceMove(other, { stage: "s-idea", due: null }, { status: "todo", dueDate: "2026-11-14", changed: { due: true } }, TODAY, FORM), null);
});

test("live: the ticket goes to Live and its go-live date is the day it went live", () => {
  const m = wentLive("s-ready")!;
  assert.equal(m.to?.value, "s-live");
  assert.equal(m.why, "live");
  assert.deepEqual(m.fields, { due: TODAY });
  // straight from the idea box too
  assert.equal(wentLive("s-idea")?.to?.value, "s-live");
});

test("live: already Live - only the go-live date, and only when it is not that day yet", () => {
  assert.deepEqual(wentLive("s-live"), { to: null, why: "live", fields: { due: TODAY } });
  assert.equal(wentLive("s-live", TODAY), null);
});

test("live: never backwards - a ticket kept as Maintaining Internally or Killed stays, its dates too", () => {
  assert.equal(wentLive("s-kept"), null);
  assert.equal(wentLive("s-killed"), null);
});

test("the go-live properties are only the form's real ones", () => {
  assert.deepEqual(goLiveProps(TODAY, FORM), { mkt_golive_date: TODAY });
  assert.deepEqual(goLiveProps(TODAY, ["subject"]), {});
  assert.deepEqual(goLiveProps("12.11.2026", FORM), {});
  // a form without the go-live date: the stage moves, no date is written
  assert.deepEqual(pieceMove(PIPE, { stage: "s-ready", due: null }, { status: "live", dueDate: null, changed: { status: true } }, TODAY, ["subject"])?.fields, {});
});

test("the other status changes move the ticket forward as before, never back", () => {
  const status = (to: "writing" | "review" | "changes" | "approved", stage: string | null) =>
    pieceMove(PIPE, { stage, due: null }, { status: to, was: "todo", dueDate: null, changed: { status: true } }, TODAY, FORM);
  assert.equal(status("writing", "s-idea")?.to?.label, "In Progress");
  assert.equal(status("review", "6161860808")?.to?.label, "Waiting on APSO");
  // planned (Ready to roll) and then written: it stays at Ready to roll
  assert.equal(status("writing", "s-ready"), null);
  assert.equal(status("changes", "6161845476"), null);
});

test("changes asked on a piece in review: from Waiting on APSO back to In Progress - the writer's again", () => {
  const changes = (stage: string | null) => pieceMove(PIPE, { stage, due: null }, { status: "changes", was: "review", dueDate: null, changed: { status: true } }, TODAY, FORM);
  const m = changes("6161845476");
  assert.equal(m?.to?.label, "In Progress");
  assert.equal(m?.why, "changes");
  assert.equal(changes("s-ready"), null, "planned at Ready to roll: it stays");
  assert.equal(changes("s-live"), null);
});

test("opened again after it was live: the one move back, as a person asked it", () => {
  const m = pieceMove(PIPE, { stage: "s-live", due: TODAY }, { status: "writing", was: "live", dueDate: null, changed: { status: true } }, TODAY, FORM);
  assert.equal(m?.to?.label, "In Progress");
  assert.equal(m?.why, "reopened");
});

test("forward: before it moves, at or past it stays", () => {
  const ready = stageNamed(PIPE, "Ready to roll");
  assert.equal(forward(PIPE, "s-agency", ready)?.value, "s-ready");
  assert.equal(forward(PIPE, "s-ready", ready), null);
  assert.equal(forward(PIPE, "s-idea", null), null);
});

test("one log line per move, in the team's words", () => {
  const m = planned("s-idea")!;
  assert.equal(moveLine(m, { ticketId: "123", taskId: 77, pieceId: 45, status: "todo", dueDate: "2026-11-14" }), "[content] ticket 123 -> Ready to Roll (piece 45 planned 14.11)");
  const l = wentLive("s-ready")!;
  assert.equal(moveLine(l, { ticketId: "123", taskId: 77, pieceId: 45, status: "live", dueDate: "2026-11-14" }), "[content] ticket 123 -> Live, go-live date 2026-11-12 (piece 45 live 12.11)");
  assert.equal(moveLine(m, { ticketId: null, taskId: 77, pieceId: 45, status: "todo", dueDate: "2026-11-14" }), "[content] to-do 77 (no ticket) -> Ready to Roll (piece 45 planned 14.11)");
});

test("HubSpot's refusal in plain words, with where the ticket stays", () => {
  assert.equal(refusalText("HubSpot: Property values were not valid.", "Live", "In Progress"),
    "HubSpot did not move the ticket to Live: Property values were not valid. It stays at In Progress.");
});

test("the live day is Switzerland's", () => {
  // 23:30 UTC on 11.11 is already 12.11 in Zurich
  assert.equal(swissDay(new Date("2026-11-11T23:30:00Z")), "2026-11-12");
});

test("with the real pipeline and the real form: Ready to Roll and Live by name, the go-live date a real property", () => {
  const real = STAGES.map((x) => ({ value: x.id, label: x.label, open: !x.closed }));
  const form = S2S_FIELDS.map((f) => f.name);
  assert.equal(stageNamed(real, "Ready to roll")?.value, "6161860809");
  assert.equal(pieceMove(real, { stage: IN_PROGRESS, due: null }, { status: "writing", dueDate: "2026-11-14", changed: { due: true } }, TODAY, form)?.to?.value, "6161860809");
  const live = pieceMove(real, { stage: "6161860809", due: "2026-11-14" }, { status: "live", was: "approved", dueDate: "2026-11-14", changed: { status: true } }, TODAY, form);
  assert.equal(live?.to?.value, LIVE);
  assert.deepEqual(live?.fields, { due: TODAY });
  assert.deepEqual(goLiveProps(TODAY, form), { mkt_golive_date: TODAY });
});
