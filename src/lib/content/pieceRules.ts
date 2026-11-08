// CONTENT PROJECTS AS A TEAM'S WORK: THE RULES (SARCLA 07.11.2026: "this should look like a collaborative project";
// "tag and status should also trigger mails to needed users").
//
// A project puts out PIECES (a landing page in Italian, a LinkedIn post, three Google ads). Each piece has a writer,
// a reviewer, a status and a date. The project's stage is never set by hand: it is where its pieces are, so the board
// cannot say "In review" while every piece is still being written.
//
// Pure functions only - no database, no mail - so every rule here is tested (tests/content-pieces.test.ts).

export const PIECE_STATUSES = ["todo", "writing", "review", "changes", "approved", "live"] as const;
export type PieceStatus = (typeof PIECE_STATUSES)[number];
export const isPieceStatus = (s: unknown): s is PieceStatus => typeof s === "string" && (PIECE_STATUSES as readonly string[]).includes(s);

export const STATUS_LABEL: Record<PieceStatus, string> = {
  todo: "To do", writing: "Writing", review: "In review", changes: "Changes asked", approved: "Approved", live: "Live",
};

export const STAGES = ["planned", "making", "review", "approved", "live"] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_LABEL: Record<Stage, string> = {
  planned: "Planned", making: "In progress", review: "In review", approved: "Approved", live: "Live",
};

/** How far along a piece is. "Changes asked" is back to writing. */
const RANK: Record<PieceStatus, number> = { todo: 0, writing: 1, changes: 1, review: 2, approved: 3, live: 4 };

/**
 * The project's stage, from its pieces: Live when all are live, Approved when all are at least approved, In review when
 * all are at least in review, In progress as soon as one is started, else Planned. A project with no piece is Planned.
 */
export function stageOf(statuses: PieceStatus[]): Stage {
  if (!statuses.length) return "planned";
  const low = Math.min(...statuses.map((s) => RANK[s]));
  const high = Math.max(...statuses.map((s) => RANK[s]));
  if (low >= 4) return "live";
  if (low >= 3) return "approved";
  if (low >= 2) return "review";
  if (high >= 1) return "making";
  return "planned";
}

/** Who is moving a piece, as far as the rules care. */
export type Mover = {
  username: string;
  /** May change the project (owner, editor, admin). */
  canEdit: boolean;
  /** Owner of the project or an admin: may decide in a reviewer's place. */
  lead: boolean;
};

export type PieceRef = { status: PieceStatus; writer: string | null; reviewer: string | null };

/**
 * May this person move the piece to that status? Null when yes, else the reason in the words the page shows.
 * Writing and asking for review are the writer's (or any editor's); approving and asking for changes are the reviewer's,
 * or the project's owner's - never the writer approving their own piece, unless they are its reviewer too.
 */
export function moveError(p: PieceRef, to: PieceStatus, who: Mover): string | null {
  if (p.status === to) return "It is already there.";
  if (to === "approved" || to === "changes") {
    if (p.status !== "review") return "Only a piece in review can be approved or sent back.";
    const isReviewer = !!p.reviewer && p.reviewer === who.username;
    if (!isReviewer && !who.lead) return p.reviewer ? "Only its reviewer or the project's owner decides." : "Only the project's owner decides.";
    return null;
  }
  if (!who.canEdit) return "You can comment on this project, not change it.";
  if (to === "review") {
    if (!p.reviewer) return "Give it a reviewer first.";
    if (p.status !== "writing" && p.status !== "changes" && p.status !== "todo") return "Only a piece being written goes to review.";
    return null;
  }
  if (to === "live" && p.status !== "approved") return "Only an approved piece goes live.";
  return null;
}

/** What happened, for the activity stream and the mails. */
export type PieceEvent =
  | { kind: "status"; to: PieceStatus; note?: string | null }
  | { kind: "assign"; role: "writer" | "reviewer"; username: string };

/** "todo": a to-do given to someone; "todo_done": a to-do done, the project owner's news. */
export type MailKind = "write" | "review_assigned" | "review" | "approved" | "changes" | "live" | "mention" | "stage" | "todo" | "todo_done";
export type MailTo = { username: string; kind: MailKind };

/**
 * Who hears about it by mail. Never the person who did it; nobody twice for one event.
 *   assigned writer -> "please write it"; assigned reviewer -> "you will review it"
 *   to review       -> the reviewer
 *   approved/changes-> the writer
 *   live            -> the writer and the project's owner
 */
export function mailsFor(e: PieceEvent, piece: PieceRef, owner: string | null, actor: string): MailTo[] {
  const out: MailTo[] = [];
  const add = (u: string | null, kind: MailKind) => {
    if (u && u !== actor && !out.some((m) => m.username === u)) out.push({ username: u, kind });
  };
  if (e.kind === "assign") add(e.username, e.role === "writer" ? "write" : "review_assigned");
  else if (e.to === "review") add(piece.reviewer, "review");
  else if (e.to === "approved") add(piece.writer, "approved");
  else if (e.to === "changes") add(piece.writer, "changes");
  else if (e.to === "live") { add(piece.writer, "live"); add(owner, "live"); }
  return out;
}

/** The stage moving is the owner's news (the team sees it on the board). */
export function stageMail(from: Stage, to: Stage, owner: string | null, actor: string): MailTo[] {
  return from !== to && owner && owner !== actor ? [{ username: owner, kind: "stage" }] : [];
}

/**
 * The people a comment tags: "@Diana Rossi" or "@DIAROS". Longest names first, so "@Anna Maria" does not also tag Anna;
 * case does not matter; the author never tags themselves; each person once.
 */
export function mentionsIn(text: string, people: { username: string; name: string }[], author: string): string[] {
  const hay = text.toLowerCase();
  const tokens = people.flatMap((p) => [{ u: p.username, t: p.name }, { u: p.username, t: p.username }])
    .filter((x) => x.t && x.t.trim().length > 1)
    .sort((a, b) => b.t.length - a.t.length);
  const taken: [number, number][] = [];
  const out: string[] = [];
  for (const { u, t } of tokens) {
    const needle = `@${t.toLowerCase()}`;
    let from = 0;
    for (;;) {
      const at = hay.indexOf(needle, from);
      if (at < 0) break;
      from = at + 1;
      const end = at + needle.length;
      // a whole word: "@dia" is not "@diana"
      if (end < hay.length && /[\p{L}\p{N}_]/u.test(hay[end])) continue;
      if (taken.some(([a, b]) => at < b && end > a)) continue;
      taken.push([at, end]);
      if (u !== author && !out.includes(u)) out.push(u);
    }
  }
  return out;
}

/* ── a piece IS a to-do (SARCLA 08.11.2026: "for me a piece is a to-do") ──────────────────────────────────────────────
 * Each piece is also an Action plan sub-action (apsomh_kpi_tasks) with its ticket; its status is that sub-action's
 * stage in the "From Scroll to Sale" pipeline, and back. */

/** The pipeline's stages (actionPlanRules.STAGES ids), by name - kept here so this file stays free of the plan's code. */
export const S2S_STAGE = {
  idea: "6161860807", progress: "6161860808", waitingApso: "6161845476", waitingAgency: "6161845477",
  ready: "6161860809", live: "6161856758", maintained: "6161856759", killed: "6161860810",
} as const;

/** The stage a piece's sub-action (and ticket) stands at for its status. */
export const STATUS_STAGE: Record<PieceStatus, string> = {
  todo: S2S_STAGE.idea, writing: S2S_STAGE.progress, changes: S2S_STAGE.progress,
  review: S2S_STAGE.waitingApso, approved: S2S_STAGE.ready, live: S2S_STAGE.live,
};

/** A status for a sub-action met without its piece (a to-do from before, or moved in HubSpot). */
export function statusOfStage(stage: string | null | undefined): PieceStatus {
  switch (stage) {
    case S2S_STAGE.progress: case S2S_STAGE.waitingAgency: return "writing";
    case S2S_STAGE.waitingApso: return "review";
    case S2S_STAGE.ready: return "approved";
    case S2S_STAGE.live: case S2S_STAGE.maintained: case S2S_STAGE.killed: return "live";
    default: return "todo";
  }
}

/** A to-do that is not a piece of content: a plain task ("photos of the machine"). */
export const TASK_KIND = "task";

/** A plain task has no review: whoever may edit the project ticks it off or opens it again. */
export function taskMoveError(to: PieceStatus, who: Mover): string | null {
  if (!who.canEdit) return "You can comment on this project, not change it.";
  return to === "live" || to === "writing" || to === "todo" ? null : "A task is done or not done - it has no review.";
}
