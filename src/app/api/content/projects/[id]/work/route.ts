// ONE CONTENT PROJECT AS THE TEAM'S WORK (SARCLA 07.11.2026): its brief, its pieces (writer, reviewer, status, date),
// its to-dos (Action plan sub-actions with their Scroll to Sale ticket), and the stream of what happened. Status changes
// and tags mail the people concerned (pieceRules decides who, workflowMail writes it).
// Behind the project's own access (src/lib/content/sharing.ts): owner and editors change it, commenters comment - and a
// piece's reviewer decides on it whatever their role.

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { accessFor, membersOf, share, shareCandidates } from "@/lib/content/sharing";
import { addComment, getProject } from "@/lib/content/projects";
import {
  addEvent, addPiece, cleanBrief, getPiece, listEvents, listPieces, projectBrief, removePiece, setBrief, setPlanItem,
  stageOfProject, updatePiece,
} from "@/lib/content/workflow";
import { isPieceStatus, mailsFor, mentionsIn, moveError, stageMail, STATUS_LABEL, type MailTo } from "@/lib/content/pieceRules";
import { sendContentMails, type MailContext } from "@/lib/content/workflowMail";
import {
  addTodo, createTodoTicket, findTickets, linkTodoTicket, listTodos, movePlace, planPlaces, removeTodo, ticketDraft,
  todoOf, unlinkTodoTicket, updateTodo,
} from "@/lib/content/todos";
import { describeIntegrationError } from "@/lib/integrations/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });
const idOf = (raw: string) => { const n = Number.parseInt(raw, 10); return Number.isFinite(n) && n > 0 ? n : null; };
const day = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const text = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const id = idOf((await ctx.params).id);
  if (id === null) return fail("Bad id");
  const access = await accessFor(id, me);
  if (!access) return fail("No such project.", 404);
  const sp = req.nextUrl.searchParams;

  // the ticket form for one to-do, and the ticket search for linking one
  if (sp.get("ticketDraft")) {
    try {
      const d = await ticketDraft(id, Number(sp.get("ticketDraft")));
      return d.ok ? NextResponse.json(d) : fail(d.error);
    } catch (e) { return fail(describeIntegrationError(e).error, 502); }
  }
  if (sp.get("search") !== null) {
    try {
      const state = sp.get("state") === "closed" ? "closed" : sp.get("state") === "all" ? "all" : "open";
      return NextResponse.json({ ok: true, tickets: await findTickets(sp.get("search") ?? "", state) });
    } catch (e) { return fail(describeIntegrationError(e).error, 502); }
  }
  if (sp.get("places") !== null) {
    if (me.role !== "admin") return fail("Placing a project in the action plan is for admins, as the plan is.", 403);
    return NextResponse.json({ ok: true, places: await planPlaces() });
  }

  const [found, pieces, events, brief, members, todos, candidates] = await Promise.all([
    getProject(id), listPieces(id), listEvents(id), projectBrief(id), membersOf(id),
    listTodos(id).catch((e) => ({ todos: [], place: null, ticketsError: describeIntegrationError(e).error })),
    shareCandidates(),
  ]);
  if (!found) return fail("No such project.", 404);
  return NextResponse.json({
    ok: true, me: me.username, isAdmin: me.role === "admin", access,
    project: found.project, comments: found.comments, pieces, events, brief: brief.brief, source: brief.source,
    stage: await stageOfProject(id), members, todos: todos.todos, place: todos.place, ticketsError: todos.ticketsError,
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
  const found = await getProject(id);
  if (!found) return fail("No such project.", 404);
  const owner = found.project.createdBy;
  const lead = me.role === "admin" || owner === me.username;
  const base: MailContext = { actorName: me.full_name || me.username, actorEmail: me.email, projectId: id, projectTitle: found.project.title };

  // a person given a piece joins the project, so the link in their mail opens; never downgraded
  const join = async (username: string | null, role: "editor" | "commenter") => {
    if (!username || username === owner) return;
    const m = (await membersOf(id)).find((x) => x.username === username);
    if (!m) await share(id, me.username, [username], role, null);
    else if (role === "editor" && m.role === "commenter") await share(id, me.username, [username], "editor", m.message);
  };
  const mailStage = async (before: Awaited<ReturnType<typeof stageOfProject>>) => {
    const after = await stageOfProject(id);
    if (after !== before) {
      await addEvent(id, null, me.username, "stage", { from: before, to: after });
      await sendContentMails(stageMail(before, after, owner, me.username), { ...base, stage: after });
    }
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
    const pieceId = Number(b.pieceId);
    const piece = await getPiece(pieceId);
    if (!piece || piece.projectId !== id) return fail("That piece is not in this project.", 404);
    if (!isPieceStatus(b.to)) return fail("Which status?");
    const to = b.to;
    const why = moveError(piece, to, { username: me.username, canEdit: access.canEdit, lead });
    if (why) return fail(why, 403);
    const note = text(b.note, 2000) || null;
    const before = await stageOfProject(id);
    await updatePiece(pieceId, { status: to });
    await addEvent(id, pieceId, me.username, "status", { from: piece.status, to, note, piece: piece.title });
    if (note) await addComment(id, null, me.username, `${STATUS_LABEL[to]} - ${piece.title}: ${note}`);
    const mailed = await sendContentMails(mailsFor({ kind: "status", to, note }, piece, owner, me.username),
      { ...base, pieceTitle: piece.title, dueDate: piece.dueDate, note });
    await mailStage(before);
    return NextResponse.json({ ok: true, mailed });
  }

  if (!access.canEdit) return fail("You can comment on this project, not change it.", 403);

  if (action === "brief") {
    await setBrief(id, cleanBrief(b.brief));
    await addEvent(id, null, me.username, "brief", {});
    return NextResponse.json({ ok: true });
  }

  if (action === "place") {
    if (me.role !== "admin") return fail("Placing a project in the action plan is for admins, as the plan is.", 403);
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
    let piece;
    let before: { writer: string | null; reviewer: string | null } = { writer: null, reviewer: null };
    if (action === "piece-add") {
      piece = await addPiece({ projectId: id, ...fields, title: fields.title || null, by: me.username });
      await addEvent(id, piece.id, me.username, "piece", { piece: piece.title });
    } else {
      const old = await getPiece(Number(b.pieceId));
      if (!old || old.projectId !== id) return fail("That piece is not in this project.", 404);
      before = { writer: old.writer, reviewer: old.reviewer };
      await updatePiece(old.id, { ...sent, ...(sent.title !== undefined ? { title: sent.title || old.title } : {}) });
      piece = (await getPiece(old.id))!;
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
    const piece = await getPiece(Number(b.pieceId));
    if (!piece || piece.projectId !== id) return fail("That piece is not in this project.", 404);
    const before = await stageOfProject(id);
    await removePiece(piece.id);
    await addEvent(id, null, me.username, "piece-removed", { piece: piece.title });
    await mailStage(before);
    return NextResponse.json({ ok: true });
  }

  // to-dos: the plan's sub-actions, with their ticket
  try {
    if (action === "todo-add") {
      const title = text(b.title);
      if (!title) return fail("A to-do needs a few words.");
      const assignee = typeof b.assignee === "string" && b.assignee ? b.assignee : null;
      const t = await addTodo(id, { title, assignee, due: day(b.due), by: me.username });
      await addEvent(id, null, me.username, "todo", { todo: title, to: assignee });
      if (assignee) {
        await join(assignee, "editor");
        await sendContentMails(assignee !== me.username ? [{ username: assignee, kind: "todo" }] : [], { ...base, pieceTitle: title, dueDate: day(b.due) });
      }
      return NextResponse.json({ ok: true, todo: t });
    }
    if (action === "todo-edit" || action === "todo-done") {
      const todoId = Number(b.todoId);
      const old = await todoOf(id, todoId);
      if (!old) return fail("That to-do is not in this project.", 404);
      const assignee = b.assignee === undefined ? undefined : typeof b.assignee === "string" && b.assignee ? b.assignee : null;
      const t = await updateTodo(id, todoId, {
        ...(b.title !== undefined ? { title: text(b.title) || old.title } : {}),
        ...(b.due !== undefined ? { due: day(b.due) } : {}),
        ...(assignee !== undefined ? { assignee } : {}),
        ...(typeof b.done === "boolean" ? { done: b.done } : {}),
      });
      if (typeof b.done === "boolean") {
        await addEvent(id, null, me.username, b.done ? "todo-done" : "todo-open", { todo: old.title });
        // done is the owner's news
        if (b.done) await sendContentMails(owner && owner !== me.username ? [{ username: owner, kind: "todo_done" }] : [], { ...base, pieceTitle: old.title });
      }
      if (assignee) {
        await join(assignee, "editor");
        if (assignee !== me.username) await sendContentMails([{ username: assignee, kind: "todo" }], { ...base, pieceTitle: t?.title ?? old.title, dueDate: t?.due ?? null });
      }
      return NextResponse.json({ ok: true, todo: t });
    }
    if (action === "todo-remove") {
      return (await removeTodo(id, Number(b.todoId))) ? NextResponse.json({ ok: true }) : fail("That to-do is not in this project.", 404);
    }
    if (action === "ticket-create") {
      const values = (b.values && typeof b.values === "object" ? b.values : {}) as Record<string, string>;
      const r = await createTodoTicket(id, Number(b.todoId), values, me.full_name || me.username);
      return r.ok ? NextResponse.json(r) : fail(r.error);
    }
    if (action === "ticket-link") {
      const r = await linkTodoTicket(id, Number(b.todoId), String(b.ticketId ?? ""), me.full_name || me.username);
      return r.ok ? NextResponse.json(r) : fail(r.error);
    }
    if (action === "ticket-unlink") {
      return (await unlinkTodoTicket(id, Number(b.todoId), String(b.ticketId ?? ""))) ? NextResponse.json({ ok: true }) : fail("That to-do is not in this project.", 404);
    }
  } catch (e) {
    return fail(describeIntegrationError(e).error, 502);
  }

  return fail(`Unknown action "${action}".`);
}
