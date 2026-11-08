// ONE CONTENT PROJECT AS THE TEAM'S WORK (SARCLA 07.11.2026): its brief, its to-dos and the stream of what happened.
// A to-do IS a piece (SARCLA 08.11.2026: "for me a piece is a to-do"): a piece of content of a type (page, social post,
// newsletter, blog post, banner, video) or a plain task, each with a writer, a reviewer, a status and a date, and each
// an Action plan sub-action with its "From Scroll to Sale" ticket. Status changes and tags mail the people concerned.
// The page reads fast (GET: no HubSpot); the tickets come after (GET ?tickets). The AI helps into the plan (ai-place,
// ai-tickets, ai-fill) as the plan's own windows do.
// Behind the project's own access (src/lib/content/sharing.ts): owner and editors change it, commenters comment - and a
// piece's reviewer decides on it whatever their role.

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { accessFor, membersOf, share, shareCandidates } from "@/lib/content/sharing";
import { addComment } from "@/lib/content/projects";
import {
  addEvent, addPiece, cleanBrief, getPiece, listEvents, projectBrief, projectHead, removePiece, setBrief, setPlanItem,
  updatePiece, type Piece,
} from "@/lib/content/workflow";
import { isPieceStatus, mailsFor, mentionsIn, moveError, stageMail, stageOf, STATUS_LABEL, TASK_KIND, taskMoveError, type MailTo } from "@/lib/content/pieceRules";
import { sendContentMails, type MailContext } from "@/lib/content/workflowMail";
import {
  createTodoTicket, findTickets, linkTodoTicket, movePlace, piecesTickets, planPlaces, pushPieceToTask, removeTodo,
  syncPieceTasks, ticketDraft, unlinkTodoTicket, whyNoTicket,
} from "@/lib/content/todos";
import { fillTicket, placesFor, ticketsFor, type ProjectSketch } from "@/lib/content/assist";
import { describeIntegrationError } from "@/lib/integrations/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });
const idOf = (raw: string) => { const n = Number.parseInt(raw, 10); return Number.isFinite(n) && n > 0 ? n : null; };
const day = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const text = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const errText = (e: unknown) => describeIntegrationError(e).error;

async function sketchOf(id: number, title: string): Promise<ProjectSketch> {
  const [{ brief }, pieces] = await Promise.all([projectBrief(id), syncPieceTasks(id, "system")]);
  return { title, goal: brief.goal, audience: brief.audience, message: brief.message, pieces: pieces.map((p) => p.title) };
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const id = idOf((await ctx.params).id);
  if (id === null) return fail("Bad id");
  const access = await accessFor(id, me);
  if (!access) return fail("No such project.", 404);
  const sp = req.nextUrl.searchParams;

  // after the page is drawn: the to-dos' tickets, read from HubSpot
  if (sp.get("tickets") !== null) {
    try { return NextResponse.json({ ok: true, ...(await piecesTickets(id)) }); } catch (e) { return fail(errText(e), 502); }
  }
  // the ticket form for one to-do, filled from its action
  if (sp.get("ticketDraft")) {
    const piece = await getPiece(Number(sp.get("ticketDraft")));
    if (!piece || piece.projectId !== id) return fail("That to-do is not in this project.", 404);
    try {
      const d = await ticketDraft(id, piece.taskId ?? 0);
      return d.ok ? NextResponse.json(d) : fail(d.error);
    } catch (e) { return fail(errText(e), 502); }
  }
  if (sp.get("search") !== null) {
    try {
      const state = sp.get("state") === "closed" ? "closed" : sp.get("state") === "all" ? "all" : "open";
      return NextResponse.json({ ok: true, tickets: await findTickets(sp.get("search") ?? "", state) });
    } catch (e) { return fail(errText(e), 502); }
  }
  if (sp.get("places") !== null) {
    if (me.role !== "admin") return fail("Placing a project in the action plan is for admins, as the plan is.", 403);
    return NextResponse.json({ ok: true, places: await planPlaces() });
  }

  // the page itself: database only, nothing from HubSpot - so it opens at once
  const [head, pieces, events, brief, members, candidates] = await Promise.all([
    projectHead(id), syncPieceTasks(id, me.username), listEvents(id), projectBrief(id), membersOf(id), shareCandidates(),
  ]);
  if (!head) return fail("No such project.", 404);
  const place = brief.planItem != null ? (await planPlaces()).find((p) => p.id === brief.planItem) ?? null : null;
  return NextResponse.json({
    ok: true, me: me.username, isAdmin: me.role === "admin", access,
    project: head.project, comments: head.comments, pieces, events, brief: brief.brief, source: brief.source,
    stage: stageOf(pieces.map((p) => p.status)), members, place,
    people: candidates.map((p) => ({ username: p.username, name: p.name })),
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const id = idOf((await ctx.params).id);
  if (id === null) return fail("Bad id");
  const access = await accessFor(id, me);
  if (!access) return fail("No such project.", 404);
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = typeof b.action === "string" ? b.action : "";
  const head = await projectHead(id);
  if (!head) return fail("No such project.", 404);
  const owner = head.project.createdBy;
  const lead = me.role === "admin" || owner === me.username;
  const base: MailContext = { actorName: me.full_name || me.username, actorEmail: me.email, projectId: id, projectTitle: head.project.title };

  // a person given a piece joins the project, so the link in their mail opens; never downgraded
  const join = async (username: string | null, role: "editor" | "commenter") => {
    if (!username || username === owner) return;
    const m = (await membersOf(id)).find((x) => x.username === username);
    if (!m) await share(id, me.username, [username], role, null);
    else if (role === "editor" && m.role === "commenter") await share(id, me.username, [username], "editor", m.message);
  };
  const stageNow = async () => stageOf((await syncPieceTasks(id, me.username)).map((p) => p.status));
  const mailStage = async (before: ReturnType<typeof stageOf>) => {
    const after = await stageNow();
    if (after !== before) {
      await addEvent(id, null, me.username, "stage", { from: before, to: after });
      await sendContentMails(stageMail(before, after, owner, me.username), { ...base, stage: after });
    }
  };
  const pieceOf = async (raw: unknown): Promise<Piece | null> => {
    const p = await getPiece(Number(raw));
    return p && p.projectId === id ? p : null;
  };

  // talking - everyone in the project; tags mail the people tagged
  if (action === "comment") {
    const body = text(b.body, 4000);
    if (!body) return fail("An empty comment helps nobody.");
    const pieceId = typeof b.pieceId === "number" ? b.pieceId : null;
    const comment = await addComment(id, null, me.username, body);
    const people = (await membersOf(id)).map((m) => ({ username: m.username, name: m.name }));
    const extra = (await shareCandidates()).filter((p) => !people.some((x) => x.username === p.username));
    const tagged = mentionsIn(body, [...people, ...extra.map((p) => ({ username: p.username, name: p.name }))], me.username);
    for (const u of tagged) {
      await join(u, "commenter");
      await addEvent(id, pieceId, me.username, "mention", { to: u, text: body.slice(0, 400), comment: comment.id });
    }
    const mailed = await sendContentMails(tagged.map((u): MailTo => ({ username: u, kind: "mention" })), { ...base, note: body });
    return NextResponse.json({ ok: true, comment, tagged, mailed });
  }

  // a reviewer decides on their piece, whatever their role in the project
  if (action === "piece-move") {
    const found = await pieceOf(b.pieceId);
    if (!found) return fail("That to-do is not in this project.", 404);
    if (!isPieceStatus(b.to)) return fail("Which status?");
    const to = b.to;
    // "Ask for review" names its reviewer in the same click (08.11.2026): they get one mail, "please review", not two
    const named = to === "review" && access.canEdit && typeof b.reviewer === "string" && b.reviewer ? b.reviewer.slice(0, 255) : null;
    const piece = named ? { ...found, reviewer: named } : found;
    const mover = { username: me.username, canEdit: access.canEdit, lead };
    const why = piece.contentType === TASK_KIND ? taskMoveError(to, mover) : moveError(piece, to, mover);
    if (why) return fail(why, 403);
    if (named && named !== found.reviewer) {
      await updatePiece(piece.id, { reviewer: named });
      await join(named, "commenter");
      await addEvent(id, piece.id, me.username, "assign", { role: "reviewer", to: named, piece: piece.title });
    }
    const note = text(b.note, 2000) || null;
    const before = await stageNow();
    await updatePiece(piece.id, { status: to });
    await pushPieceToTask(id, { ...piece, status: to }, { status: true }).catch((e) => console.warn(`[content] sub-action of piece ${piece.id}: ${errText(e)}`));
    await addEvent(id, piece.id, me.username, "status", { from: piece.status, to, note, piece: piece.title });
    if (note) await addComment(id, null, me.username, `${STATUS_LABEL[to]} - ${piece.title}: ${note}`);
    const mailed = await sendContentMails(mailsFor({ kind: "status", to, note }, piece, owner, me.username),
      { ...base, pieceTitle: piece.title, dueDate: piece.dueDate, note });
    await mailStage(before);
    return NextResponse.json({ ok: true, mailed });
  }

  // finding matches is reading - anyone in the project may ask
  if (action === "ai-tickets") {
    const piece = await pieceOf(b.pieceId);
    if (!piece) return fail("That to-do is not in this project.", 404);
    try { return NextResponse.json({ ok: true, hints: await ticketsFor(await sketchOf(id, head.project.title), piece.title) }); } catch (e) { return fail(errText(e), 502); }
  }

  if (!access.canEdit) return fail("You can comment on this project, not change it.", 403);

  if (action === "brief") {
    await setBrief(id, cleanBrief(b.brief));
    await addEvent(id, null, me.username, "brief", {});
    return NextResponse.json({ ok: true });
  }

  if (action === "place" || action === "ai-place") {
    if (me.role !== "admin") return fail("Placing a project in the action plan is for admins, as the plan is.", 403);
    if (action === "ai-place") {
      try {
        const hints = await placesFor(await sketchOf(id, head.project.title), await planPlaces());
        return hints ? NextResponse.json({ ok: true, hints }) : fail("The AI is not set up on this hub.", 503);
      } catch (e) { return fail(errText(e), 502); }
    }
    const planItem = b.planItem == null ? null : Number(b.planItem);
    if (planItem != null && !(await planPlaces()).some((p) => p.id === planItem)) return fail("That is not an action of the plan.");
    await setPlanItem(id, planItem);
    await movePlace(id, planItem);
    await addEvent(id, null, me.username, "place", { planItem });
    return NextResponse.json({ ok: true });
  }

  if (action === "piece-add" || action === "piece-edit") {
    const person = (v: unknown) => (typeof v === "string" && v ? v : null);
    const fields = {
      title: text(b.title, 200), contentType: text(b.contentType, 48) || null, language: text(b.language, 8).toUpperCase() || null,
      writer: person(b.writer), reviewer: person(b.reviewer), dueDate: day(b.dueDate),
    };
    // an edit changes only what was sent (the calendar sends a date, a picker one person)
    const sent = Object.fromEntries(Object.entries(fields).filter(([k]) => b[k] !== undefined)) as Partial<typeof fields>;
    let piece: Piece;
    let before: { writer: string | null; reviewer: string | null } = { writer: null, reviewer: null };
    if (action === "piece-add") {
      if (fields.contentType === TASK_KIND && !fields.title) return fail("A to-do needs a few words.");
      const made = await addPiece({ projectId: id, ...fields, language: fields.contentType === TASK_KIND ? null : fields.language, title: fields.title || null, by: me.username });
      await addEvent(id, made.id, me.username, "piece", { piece: made.title });
      // its sub-action, at once
      piece = (await syncPieceTasks(id, me.username)).find((x) => x.id === made.id) ?? made;
    } else {
      const old = await pieceOf(b.pieceId);
      if (!old) return fail("That to-do is not in this project.", 404);
      before = { writer: old.writer, reviewer: old.reviewer };
      await updatePiece(old.id, { ...sent, ...(sent.title !== undefined ? { title: sent.title || old.title } : {}) });
      piece = (await getPiece(old.id))!;
      await pushPieceToTask(id, piece, { title: sent.title !== undefined, writer: sent.writer !== undefined, due: sent.dueDate !== undefined })
        .catch((e) => console.warn(`[content] sub-action of piece ${piece.id}: ${errText(e)}`));
    }
    await join(piece.writer, "editor");
    await join(piece.reviewer, "commenter");
    const mails: MailTo[] = [];
    if (piece.writer && piece.writer !== before.writer) {
      await addEvent(id, piece.id, me.username, "assign", { role: "writer", to: piece.writer, piece: piece.title });
      mails.push(...mailsFor({ kind: "assign", role: "writer", username: piece.writer }, piece, owner, me.username));
    }
    if (piece.reviewer && piece.reviewer !== before.reviewer) {
      await addEvent(id, piece.id, me.username, "assign", { role: "reviewer", to: piece.reviewer, piece: piece.title });
      mails.push(...mailsFor({ kind: "assign", role: "reviewer", username: piece.reviewer }, piece, owner, me.username));
    }
    const mailed = await sendContentMails(mails, { ...base, pieceTitle: piece.title, dueDate: piece.dueDate });
    return NextResponse.json({ ok: true, piece, mailed });
  }

  if (action === "piece-remove") {
    const piece = await pieceOf(b.pieceId);
    if (!piece) return fail("That to-do is not in this project.", 404);
    const before = await stageNow();
    if (piece.taskId) await removeTodo(id, piece.taskId);
    await removePiece(piece.id);
    await addEvent(id, null, me.username, "piece-removed", { piece: piece.title });
    await mailStage(before);
    return NextResponse.json({ ok: true });
  }

  // a to-do's ticket: made here, filled with the AI, an existing one linked, or unlinked
  if (action === "ticket-create" || action === "ticket-link" || action === "ticket-unlink" || action === "ai-fill") {
    const piece = await pieceOf(b.pieceId);
    if (!piece) return fail("That to-do is not in this project.", 404);
    try {
      if (action === "ticket-unlink") {
        return piece.taskId && (await unlinkTodoTicket(id, piece.taskId, String(b.ticketId ?? ""))) ? NextResponse.json({ ok: true }) : fail("That to-do has no such ticket.", 404);
      }
      const refused = await whyNoTicket(id, piece.taskId);
      if (refused) return fail(refused);
      if (action === "ai-fill") {
        const d = await ticketDraft(id, piece.taskId!);
        if (!d.ok) return fail(d.error);
        const values = { ...d.values, ...((b.values && typeof b.values === "object" ? b.values : {}) as Record<string, string>) };
        const s = await sketchOf(id, head.project.title);
        const fill = await fillTicket({ fields: d.form.fields, owners: d.form.owners, stages: d.form.stages }, values, text(b.describe, 3000),
          `The to-do: ${piece.title}\nIts project: ${s.title}${s.goal ? ` - ${s.goal}` : ""}${s.message ? `\nKey message: ${s.message}` : ""}`, me.full_name || me.username);
        return fill ? NextResponse.json({ ok: true, fill }) : fail("The AI is not set up on this hub.", 503);
      }
      if (action === "ticket-create") {
        const values = (b.values && typeof b.values === "object" ? b.values : {}) as Record<string, string>;
        const r = await createTodoTicket(id, piece.taskId!, values, me.full_name || me.username);
        if (r.ok) await addEvent(id, piece.id, me.username, "ticket", { piece: piece.title, ticket: r.id, made: true });
        return r.ok ? NextResponse.json(r) : fail(r.error);
      }
      const r = await linkTodoTicket(id, piece.taskId!, String(b.ticketId ?? ""), me.full_name || me.username);
      if (r.ok) await addEvent(id, piece.id, me.username, "ticket", { piece: piece.title, ticket: String(b.ticketId ?? ""), made: false });
      return r.ok ? NextResponse.json(r) : fail(r.error);
    } catch (e) {
      return fail(errText(e), 502);
    }
  }

  return fail(`Unknown action "${action}".`);
}
