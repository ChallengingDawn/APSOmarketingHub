// CONTENT - THE ONE NEXT STEP (09.11.2026). Pure: tests/content-next-step.test.ts.
//
// SARCLA 08.11.2026: "the features are there, but the editing and the flow is not logical yet". Every to-do and every
// project card says ONE thing to do next, by where it stands and who is looking: "Write it" while nothing is written,
// "Ask for review" once a version exists, "Review it" for its reviewer, "Make the changes" when changes were asked,
// "Publish it" once approved. What someone else has to do is said, not offered ("With Anna for review").

import { TASK_KIND, type PieceStatus } from "./pieceRules";

export type StepKind = "write" | "ask" | "review" | "changes" | "publish" | "do" | "wait" | "done";
export type NextStep = {
  kind: StepKind;
  /** the button's words ("Write it") - or, for a "wait", what is happening ("With Anna for review") */
  label: string;
  /** a step done in the studio (open it there); else a move made on the line ("Ask for review", "Done") */
  inStudio: boolean;
  /** this person's to do (a button), or someone else's (a line of text) */
  mine: boolean;
};

export type StepPiece = { status: PieceStatus; contentType: string | null; writer: string | null; reviewer?: string | null; versions?: number | null };

/** The one next step on a to-do, for the person looking (`canEdit`: they may change the project). */
export function pieceStep(p: StepPiece, me: string, canEdit: boolean, name: (u: string) => string = (u) => u): NextStep {
  const who = (u: string | null | undefined) => (u ? (u === me ? "you" : name(u)) : null);
  if (p.contentType === TASK_KIND) {
    if (p.status === "live") return { kind: "done", label: "Done", inStudio: false, mine: false };
    return { kind: "do", label: "Done", inStudio: false, mine: canEdit };
  }
  switch (p.status) {
    case "todo":
    case "writing": {
      const written = (p.versions ?? 0) > 0;
      if (written) return { kind: "ask", label: "Ask for review", inStudio: false, mine: canEdit };
      return canEdit ? { kind: "write", label: "Write it", inStudio: true, mine: true }
        : { kind: "wait", label: p.writer ? `${who(p.writer)} writes it` : "Nobody writes it yet", inStudio: false, mine: false };
    }
    case "changes":
      return canEdit ? { kind: "changes", label: "Make the changes", inStudio: true, mine: true }
        : { kind: "wait", label: `Changes asked${p.writer ? ` - ${who(p.writer)}` : ""}`, inStudio: false, mine: false };
    case "review":
      if (p.reviewer === me) return { kind: "review", label: "Review it", inStudio: true, mine: true };
      return { kind: "wait", label: p.reviewer ? `With ${who(p.reviewer)} for review` : "Waiting for a reviewer", inStudio: false, mine: false };
    case "approved":
      return canEdit ? { kind: "publish", label: "Publish it", inStudio: true, mine: true } : { kind: "wait", label: "Approved - to publish", inStudio: false, mine: false };
    case "live":
    default:
      return { kind: "done", label: "Live", inStudio: false, mine: false };
  }
}

export type ProjectStepPiece = StepPiece & { id: number; title: string };

/**
 * A project's one next step for the person looking: what waits for THEM first (a review asked of them, changes on their
 * piece, their piece to write), then what the project needs next (a piece to publish, to write, to review), else that
 * it is live. Returns the piece it is about, so the card can open it.
 */
export function projectStep(pieces: ProjectStepPiece[], me: string, canEdit: boolean, name: (u: string) => string = (u) => u): (NextStep & { piece: ProjectStepPiece | null }) {
  const content = pieces.filter((p) => p.contentType !== TASK_KIND);
  const all = content.length ? content : pieces;
  if (!all.length) return { kind: "write", label: "Add a first to-do", inStudio: false, mine: canEdit, piece: null };
  const rank = (p: ProjectStepPiece): number => {
    const s = pieceStep(p, me, canEdit, name);
    const own = p.writer === me;
    if (s.kind === "review") return 0;
    if (s.kind === "changes" && own) return 1;
    if ((s.kind === "write" || s.kind === "ask") && own) return 2;
    if (s.kind === "publish") return 3;
    if (s.kind === "changes") return 4;
    if (s.kind === "write" || s.kind === "ask") return 5;
    if (s.kind === "do") return 6;
    if (s.kind === "wait") return 7;
    return 9;
  };
  const best = [...all].sort((a, b) => rank(a) - rank(b))[0];
  const step = pieceStep(best, me, canEdit, name);
  if (step.kind === "done") return { kind: "done", label: "Live", inStudio: false, mine: false, piece: null };
  return { ...step, piece: best };
}
