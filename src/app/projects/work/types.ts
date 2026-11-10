// What the project page reads (GET /api/content/projects/[id]/work) and its tickets (…/work?tickets).
import type { PieceStatus, Stage } from "@/lib/content/pieceRules";

export type Piece = {
  id: number; projectId: number; contentType: string | null; language: string | null; title: string; writer: string | null; reviewer: string | null;
  status: PieceStatus; dueDate: string | null; versions: number; lastVersionAt: string | null; lastVersionBy: string | null;
  taskId: number | null;
  /** Shown before the hub answered (a to-do just added). */
  pending?: boolean;
};
export type Brief = { goal: string; audience: string; message: string; keywords: string[]; channels: string[] };
export type EventRow = { id: number; pieceId: number | null; actor: string; kind: string; detail: Record<string, unknown>; createdAt: string };
export type CommentRow = { id: number; author: string; body: string; createdAt: string };
export type Place = { id: number; title: string; path: string; dg: boolean };
export type Member = { username: string; name: string; role: string };
export type PersonOpt = { username: string; name: string };

export type Work = {
  ok: boolean; error?: string; me: string; isAdmin: boolean;
  access: { role: string; canEdit: boolean; canComment: boolean; canShare: boolean };
  project: { id: number; title: string; brief: string | null; createdBy: string | null; contentType: string | null; dueDate: string | null };
  comments: CommentRow[]; pieces: Piece[]; events: EventRow[]; brief: Brief; source: string | null; stage: Stage;
  members: Member[]; place: Place | null; people: PersonOpt[];
  /** who reviews a new to-do unless someone else is picked (SARCLA 09.11.2026: "the reviewer is Claudio") */
  defaultReviewer?: string | null;
};

/** A to-do's ticket: `stage` is its stage's id in the From Scroll to Sale pipeline. */
export type TodoTicket = { id: string; subject: string; stage: string; stageLabel: string; open: boolean; url: string };
/** A stage of the pipeline, in its order; `open` false for Live, Maintaining Internally and Killed. */
export type TicketStage = { value: string; label: string; open?: boolean };
export type Tickets = { tickets: Record<number, TodoTicket>; takes: Record<number, boolean>; place: Place | null; error: string | null;
  /** to-dos whose due date was just copied from their ticket - the page reads the to-dos again */
  filled?: number;
  /** the pipeline's stages, for the ticket chip's menu (SARCLA 10.11.2026: "on clicking the ticket I should be able to move it from stage") */
  stages?: TicketStage[] };
/** A ticket moved by the hub with its piece (planned -> Ready to roll, live -> Live), as a save answers it. */
export type TicketMovedRow = { pieceId: number; id: string; stage: string; stageLabel: string; open: boolean; why: string };
