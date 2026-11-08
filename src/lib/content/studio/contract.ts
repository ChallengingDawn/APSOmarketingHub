// WHAT EACH KIND OF STUDIO PROVIDES THE SERVER (08.11.2026). Each kind lives in src/lib/content/studio/kinds/<kind>/:
//   model.ts   pure, shared with the browser: the document's type, an empty one, its text (and its HTML where it has one)
//   server.ts  the KindDef below: the AI tasks the studio may ask for, and the server actions it may call
// The route /api/content/pieces/[pieceId] runs them behind the project's own access. The AI always writes in the brand's
// voice (brain.brandSystemPrompt for the kind's channel) with the project's brief and the to-do in front of it.

import type { Brief, Piece } from "@/lib/content/workflow";
import type { StudioKind } from "./kinds";

export type StudioCtx = {
  projectId: number;
  pieceId: number;
  projectTitle: string;
  /** The project's own notes, free text (the brief as first written; a page from APSOconvert carries its marker here). */
  projectNotes: string | null;
  brief: Brief;
  piece: Piece;
  /** The person working - their username and name. */
  me: { username: string; name: string; email: string | null; admin: boolean };
  canEdit: boolean;
};

export type AiTask = {
  label: string;
  /** The answer's JSON schema (the model answers in it; no free text). */
  schema: Record<string, unknown>;
  /** What the model is told about this task, after the brand's voice. */
  system: string;
  /** The question: the context, the document as it is, what the person asked. */
  user: (ctx: StudioCtx, doc: unknown, input: Record<string, unknown>) => string;
  maxTokens?: number;
  /** The answer kept only where it makes sense - the studio applies it. */
  clean?: (raw: unknown, doc: unknown, ctx: StudioCtx, input: Record<string, unknown>) => unknown;
};

export type ServerAction = (ctx: StudioCtx, doc: unknown, input: Record<string, unknown>) => Promise<unknown>;

export type KindDef = {
  kind: StudioKind;
  /** The brain's channel its words follow (brandSystemPrompt). */
  channel: string;
  empty: (ctx: StudioCtx) => unknown;
  /** The version's text - what the library, the search and the exports read. */
  toText: (doc: unknown) => string;
  tasks: Record<string, AiTask>;
  actions?: Record<string, ServerAction>;
};

/** A string out of anything, trimmed and capped - for cleaning model answers. */
export const s = (v: unknown, max = 4000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
