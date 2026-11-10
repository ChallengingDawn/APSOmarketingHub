// A CONTENT PROJECT'S TO-DOS ARE ACTION PLAN SUB-ACTIONS, WITH THEIR TICKET (SARCLA 07.11.2026: "on to-dos in projects
// we should have the ticket or the associated ticket per task, association to the action plan, this whole logic as well").
//
// A to-do is a row of apsomh_kpi_tasks - the table the plan's sub-actions are - with the tile "content:<project>" and,
// once the project has its place in the plan, plan_item = that action. So it shows under the action on the Gantt, takes
// ONE "From Scroll to Sale" ticket (made here, or an existing one linked), and the plan's two-way sync keeps the ticket
// and the to-do in step (title, stage, owner, dates, status note). The plan's rules hold here too:
//   - a to-do takes a ticket only when its action is led by Digital Growth, or it is a Digital Growth person's (takesTicket);
//   - one ticket per to-do; unlink it to give it another.
// The plan's own routes are admins only; these functions are called from the project's route, behind the project's
// own access (owner, editors), so the people of the project can work their to-dos.

import { query } from "@/lib/db/client";
import { addTask, deleteTask, forgetTaskSync, linkTickets, taskById, taskTickets, tasksOf, ticketsOf, unlinkTicket, updateTask, type KpiTask } from "@/lib/reporting/kpiActions";
import { itemById, planItems } from "@/lib/reporting/actionPlan";
import { flushPlanSync, planInHubspot, queuePlanSync } from "@/lib/reporting/actionPlanHubspot";
import { IDEA, IN_PROGRESS, LIVE, PLAN_PROPS, STAGES, planOptions, takesTicket, ticketFromAction, type PlanItem } from "@/lib/reporting/actionPlanRules";
import { createTicket, moveTicket, ownerOf, readTickets, s2sForm, searchTickets, ticketUrl, type S2sTicket, type TicketState } from "@/lib/reporting/scrollToSale";
import { PLAN_FIELDS, S2S_FIELDS, missingRequired } from "@/lib/reporting/scrollToSaleRules";
import { describeIntegrationError } from "@/lib/integrations/status";
import { hubPublicUrl } from "@/lib/content/shareMail";
import { STATUS_STAGE, statusOfStage, type PieceStatus } from "@/lib/content/pieceRules";
import { addPieceForTask, listPieces, setPieceTask, updatePiece, type Piece } from "@/lib/content/workflow";
import { moveLine, pieceMove, refusalText, swissDay, type PieceChange, type PipeStage, type SubMove, type Why } from "@/lib/content/ticketMoves";

export const todoTile = (projectId: number) => `content:${projectId}`;

/** A to-do's ticket as the page shows it: `stage` its stage's id in the pipeline, for the chip's menu. */
export type TodoTicket = { id: string; subject: string; stage: string; stageLabel: string; open: boolean; url: string };

export type Todo = {
  id: number;
  title: string;
  note: string;
  done: boolean;
  stage: string | null;
  stageLabel: string;
  /** The hub person it is given to - null when it was given in HubSpot to somebody without a hub account. */
  assignee: string | null;
  assigneeName: string;
  due: string | null;
  ticket: TodoTicket | null;
  /** May it take a Scroll to Sale ticket (the plan's rule)? */
  takesTicket: boolean;
};

export type PlanPlace = { id: number; title: string; path: string; dg: boolean };

const stageLabel = (s: string | null) => STAGES.find((x) => x.id === s)?.label ?? "Idea box";

/** The project's action in the plan, or null. */
async function planActionOf(projectId: number): Promise<PlanItem | null> {
  const r = await query<{ plan_item: number | null }>(`SELECT plan_item FROM apsomh_content_projects WHERE id = $1`, [projectId]);
  const id = r.rows[0]?.plan_item ?? null;
  return id == null ? null : itemById(id);
}

/** Hub people by e-mail and by username, for the people a to-do can be given to. */
async function hubPeople(): Promise<{ username: string; name: string; email: string | null }[]> {
  const r = await query<{ username: string; full_name: string | null; email: string | null }>(
    `SELECT username, full_name, email FROM apsomh_users WHERE is_active`);
  return r.rows.map((u) => ({ username: u.username, name: u.full_name || u.username, email: u.email ? u.email.toLowerCase() : null }));
}

/** The to-dos of a project, each with its ticket when it has one. A HubSpot read that fails leaves the ticket's number. */
export async function listTodos(projectId: number): Promise<{ todos: Todo[]; place: PlanPlace | null; ticketsError: string | null }> {
  const tile = todoTile(projectId);
  const [tasks, links, action, people] = await Promise.all([tasksOf(tile), ticketsOf(tile), planActionOf(projectId), hubPeople()]);
  let ticketsError: string | null = null;
  let read: S2sTicket[] = [];
  if (links.length) {
    try { read = await readTickets(links.map((l) => l.ticketId)); } catch (e) { ticketsError = e instanceof Error ? e.message : String(e); }
  }
  let form: Awaited<ReturnType<typeof s2sForm>> | null = null;
  if (tasks.some((t) => /^\d+$/.test(t.owner))) form = await s2sForm().catch(() => null);
  const own = (t: KpiTask) => {
    const email = (/^\d+$/.test(t.owner) ? form?.owners.find((o) => o.id === t.owner)?.email : t.owner)?.toLowerCase() ?? null;
    return email ? people.find((p) => p.email === email) ?? null : null;
  };
  const todos = tasks.filter((t) => t.tile === tile).map((t): Todo => {
    const l = links.find((x) => x.taskId === t.id);
    const tk = l ? read.find((x) => x.id === l.ticketId) : undefined;
    const who = own(t);
    return {
      id: t.id, title: t.title, note: t.note, done: t.status === "done", stage: t.stage, stageLabel: stageLabel(t.stage),
      assignee: who?.username ?? null, assigneeName: t.ownerName || who?.name || "",
      due: t.due, takesTicket: !!action && takesTicket(action, t.ownerName),
      ticket: l ? { id: l.ticketId, subject: tk?.subject ?? `Ticket ${l.ticketId}`, stage: tk?.stage ?? "", stageLabel: tk?.stageLabel ?? "", open: tk?.open ?? true, url: tk?.url ?? ticketUrl(l.ticketId) } : null,
    };
  });
  return { todos, place: action ? await placeOf(action) : null, ticketsError };
}

async function placeOf(a: PlanItem, items?: PlanItem[]): Promise<PlanPlace> {
  const all = items ?? (await planItems());
  const byId = new Map(all.map((i) => [i.id, i]));
  const path: string[] = [];
  for (let p = a.parentId != null ? byId.get(a.parentId) : undefined; p && p.kind !== "goal"; p = p.parentId != null ? byId.get(p.parentId) : undefined) path.unshift(p.title);
  return { id: a.id, title: a.title, path: path.join(" › "), dg: a.dg };
}

/** Every action of the plan, with where it sits - for "Its place in the plan". */
export async function planPlaces(): Promise<PlanPlace[]> {
  const items = await planItems();
  const out: PlanPlace[] = [];
  for (const a of items) if (a.kind === "action") out.push(await placeOf(a, items));
  return out.sort((x, y) => x.path.localeCompare(y.path) || x.title.localeCompare(y.title));
}

/** The person a to-do is given to, as the plan stores it: their HubSpot owner id when they have one, else their e-mail. */
export async function ownerFields(username: string | null): Promise<{ owner: string; ownerName: string }> {
  if (!username) return { owner: "", ownerName: "" };
  const p = (await hubPeople()).find((x) => x.username === username);
  if (!p) return { owner: "", ownerName: "" };
  const form = await s2sForm().catch(() => null);
  const o = form ? ownerOf(form, p.email) : null;
  return { owner: o?.id ?? p.email ?? "", ownerName: o?.name ?? p.name };
}

export async function addTodo(projectId: number, t: { title: string; assignee: string | null; due: string | null; by: string }): Promise<KpiTask> {
  const action = await planActionOf(projectId);
  const made = await addTask({
    tile: todoTile(projectId), page: "content", title: t.title.slice(0, 300), ...(await ownerFields(t.assignee)),
    due: t.due, href: `/projects/${projectId}`, planItem: action?.id ?? null, stage: IDEA, by: t.by,
  });
  if (action) queuePlanSync("content to-do added");
  return made;
}

/** The to-do, when it is this project's - never another tile's task through this project's door. */
export async function todoOf(projectId: number, todoId: number): Promise<KpiTask | null> {
  const t = await taskById(todoId);
  return t && t.tile === todoTile(projectId) ? t : null;
}

export async function updateTodo(projectId: number, todoId: number, p: { title?: string; assignee?: string | null; due?: string | null; done?: boolean }): Promise<KpiTask | null> {
  const t = await todoOf(projectId, todoId);
  if (!t) return null;
  const patch: Parameters<typeof updateTask>[1] = {};
  if (p.title !== undefined) patch.title = p.title.slice(0, 300);
  if (p.due !== undefined) patch.due = p.due;
  if (p.assignee !== undefined) Object.assign(patch, await ownerFields(p.assignee));
  // done = Live on the ticket's pipeline; opened again = In progress
  if (p.done !== undefined) patch.stage = p.done ? LIVE : t.stage && t.stage !== LIVE ? t.stage : IN_PROGRESS;
  const out = await updateTask(todoId, patch);
  if (t.planItem != null) queuePlanSync("content to-do changed");
  return out;
}

export async function removeTodo(projectId: number, todoId: number): Promise<boolean> {
  const t = await todoOf(projectId, todoId);
  if (!t) return false;
  await deleteTask(todoId);
  return true;
}

/** The project moved in the plan: its to-dos move with it. */
export async function movePlace(projectId: number, planItem: number | null): Promise<void> {
  for (const t of (await tasksOf(todoTile(projectId))).filter((x) => x.tile === todoTile(projectId))) {
    if (t.planItem !== planItem) await updateTask(t.id, { planItem });
  }
  queuePlanSync("content project placed in the plan");
}

/** Why this to-do may not take a ticket now, or null. */
async function ticketRefusal(projectId: number, todoId: number): Promise<string | null> {
  const [t, action] = await Promise.all([todoOf(projectId, todoId), planActionOf(projectId)]);
  if (!t) return "That to-do is not in this project.";
  if (!action) return "Give the project its place in the action plan first - its to-dos' tickets sit under that action.";
  if (!takesTicket(action, t.ownerName)) return "Only a to-do under an action led by Digital Growth, or a Digital Growth person's, takes a Scroll to Sale ticket.";
  if ((await taskTickets()).some((x) => x.task === todoId)) return "This to-do has its ticket - unlink it first to give it another.";
  return null;
}

/** The ticket form for a to-do, filled from its action (as the plan fills it) and from the to-do itself. */
export async function ticketDraft(projectId: number, todoId: number) {
  const refused = await ticketRefusal(projectId, todoId);
  if (refused) return { ok: false as const, error: refused };
  const [t, action, form, items] = await Promise.all([todoOf(projectId, todoId), planActionOf(projectId), s2sForm(), planItems()]);
  const options = Object.fromEntries(form.fields.filter((f) => f.options).map((f) => [f.name, f.options!]));
  const ready = await planInHubspot().then(() => true, () => false);
  const fields = form.fields
    .filter((f) => ready || !PLAN_FIELDS.includes(f.name))
    .map((f) => {
      const p = PLAN_PROPS.find((x) => x.name === f.name);
      return p ? { ...f, options: planOptions(items, p.kind).map((o) => ({ value: o.value, label: o.label })) } : f;
    });
  const values: Record<string, string> = action ? ticketFromAction(action, items, options) : {};
  if (!ready) for (const k of PLAN_FIELDS) delete values[k];
  values.subject = t!.title;
  if (/^\d+$/.test(t!.owner)) values.hubspot_owner_id = t!.owner;
  if (t!.due) values.mkt_golive_date = t!.due;
  values.hs_pipeline_stage = t!.stage || IDEA;
  values.content = [values.content, `Open it: ${hubPublicUrl()}/projects/${projectId}`].filter(Boolean).join("\n\n");
  return {
    ok: true as const,
    form: { fields, stages: form.stages.map((s) => ({ value: s.value, label: s.label })), owners: form.owners.map((o) => ({ value: o.id, label: o.name })), teams: form.teams },
    values,
  };
}

export async function createTodoTicket(projectId: number, todoId: number, values: Record<string, string>, by: string): Promise<{ ok: true; id: string; url: string } | { ok: false; error: string }> {
  const refused = await ticketRefusal(projectId, todoId);
  if (refused) return { ok: false, error: refused };
  const missing = missingRequired(values);
  if (missing.length) return { ok: false, error: `Still to fill in: ${missing.join(", ")}` };
  const v = { ...values };
  if (PLAN_FIELDS.some((k) => v[k])) await flushPlanSync();
  const id = await createTicket(v);
  await linkTickets(todoTile(projectId), [id], by, true, todoId);
  await forgetTaskSync(todoId);
  queuePlanSync("content to-do ticket made");
  await flushPlanSync().catch(() => undefined);
  console.log(`[content] ticket ${id} created for to-do ${todoId} of project ${projectId} by ${by}`);
  return { ok: true, id, url: ticketUrl(id) };
}

export async function linkTodoTicket(projectId: number, todoId: number, ticketId: string, by: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const refused = await ticketRefusal(projectId, todoId);
  if (refused) return { ok: false, error: refused };
  // only a ticket of the pipeline: what HubSpot returns for the id
  const found = await readTickets([ticketId]);
  if (!found.length) return { ok: false, error: "That is not a ticket of From Scroll to Sale." };
  await linkTickets(todoTile(projectId), [found[0].id], by, false, todoId);
  await forgetTaskSync(todoId);
  queuePlanSync("content to-do ticket linked");
  await flushPlanSync().catch(() => undefined);
  return { ok: true };
}

export async function unlinkTodoTicket(projectId: number, todoId: number, ticketId: string): Promise<boolean> {
  if (!(await todoOf(projectId, todoId))) return false;
  await unlinkTicket(todoTile(projectId), ticketId);
  return true;
}

export const findTickets = (q: string, state: TicketState) => searchTickets(q, state);

/* ── a piece IS a to-do (SARCLA 08.11.2026: "for me a piece is a to-do") ──────────────────────────────────────────────
 * Each piece has its sub-action (pieces.task_id); a sub-action of the project met without its piece - a to-do made before
 * - gets a piece of kind "task", so the page has one list. The piece leads: its title, writer, date and status are pushed
 * to the sub-action, and the plan's sync takes them on to the ticket. */

/** Every piece with its sub-action, every sub-action with its piece. Cheap when nothing is missing (one read of each). */
export async function syncPieceTasks(projectId: number, by: string): Promise<Piece[]> {
  const tile = todoTile(projectId);
  let pieces = await listPieces(projectId);
  const tasks = (await tasksOf(tile)).filter((t) => t.tile === tile);
  const action = pieces.some((p) => !p.taskId) ? await planActionOf(projectId) : null;
  let changed = false;
  for (const p of pieces.filter((x) => !x.taskId || !tasks.some((t) => t.id === x.taskId))) {
    const made = await addTask({
      tile, page: "content", title: p.title.slice(0, 300), ...(await ownerFields(p.writer)), due: p.dueDate,
      href: `/projects/${projectId}#piece-${p.id}`, planItem: action?.id ?? null, stage: STATUS_STAGE[p.status], by,
    });
    await setPieceTask(p.id, made.id);
    changed = true;
  }
  const people = tasks.some((t) => !pieces.some((p) => p.taskId === t.id)) ? await hubPeople() : [];
  const form = people.length && tasks.some((t) => /^\d+$/.test(t.owner)) ? await s2sForm().catch(() => null) : null;
  for (const t of tasks.filter((x) => !pieces.some((p) => p.taskId === x.id))) {
    const email = (/^\d+$/.test(t.owner) ? form?.owners.find((o) => o.id === t.owner)?.email : t.owner)?.toLowerCase() ?? null;
    const writer = email ? people.find((u) => u.email === email)?.username ?? null : null;
    await addPieceForTask({ projectId, taskId: t.id, title: t.title, status: statusOfStage(t.stage), writer, dueDate: t.due, by });
    changed = true;
  }
  if (changed) {
    pieces = await listPieces(projectId);
    if (action) queuePlanSync("content pieces became to-dos");
  }
  return pieces;
}

/** A move of a to-do's ticket the page shows at once on its chip. */
export type TicketMoved = { pieceId: number; id: string; stage: string; stageLabel: string; open: boolean; why: Why };

/** The pipeline's stages and the form's fields as HubSpot has them (read at most once an hour), else as the plan knows them. */
async function pipeline(): Promise<{ stages: PipeStage[]; fields: string[] }> {
  const form = await s2sForm().catch(() => null);
  return form
    ? { stages: form.stages, fields: form.fields.map((f) => f.name) }
    : { stages: STAGES.map((s) => ({ value: s.id, label: s.label, open: !s.closed })), fields: S2S_FIELDS.map((f) => f.name) };
}

/**
 * Where a piece's change takes its sub-action - and so its ticket (ticketMoves.ts: by the stages' names, forward only,
 * nothing twice). The ticket's stage is read from HubSpot now, never taken from the sub-action's last copy: a move made in
 * HubSpot meanwhile must not be taken back. HubSpot not answering: no stage moves now (the next change catches up).
 */
async function followPiece(projectId: number, t: KpiTask, pieceId: number, c: PieceChange, dueNow: string | null): Promise<{ move: SubMove; ticketId: string | null } | null> {
  const link = (await ticketsOf(todoTile(projectId))).find((l) => l.taskId === t.id);
  let stage = t.stage;
  let ticketId: string | null = null;
  // only a sub-action in the plan has its ticket carried by the plan's sync
  if (link && t.planItem != null) {
    try {
      const [tk] = await readTickets([link.ticketId]);
      if (tk) { stage = tk.stage; ticketId = tk.id; }
    } catch (e) {
      console.warn(`[content] ticket ${link.ticketId} not read - piece ${pieceId} moves no stage now: ${describeIntegrationError(e).error}`);
      return null;
    }
  }
  const { stages, fields } = await pipeline();
  const move = pieceMove(stages, { stage, due: dueNow, start: t.start }, c, swissDay(), fields);
  return move ? { move, ticketId } : null;
}

/**
 * The piece changed: its sub-action follows (title, who, go-live date, stage) - and the plan's sync takes the ticket, the
 * one writer to HubSpot (as a sub-action ticked done did). Its stage moves by ticketMoves.ts (SARCLA 10.11.2026): planned
 * on the content calendar -> Ready to roll, live -> Live with its go-live date, never backwards. What the ticket's chip
 * shows now, when its ticket moved.
 */
export async function pushPieceToTask(projectId: number, p: { id: number; taskId: number | null; title: string; writer: string | null; dueDate: string | null; status: PieceStatus },
  fields: { title?: boolean; writer?: boolean; due?: boolean; status?: boolean }, was?: PieceStatus): Promise<TicketMoved | null> {
  if (!p.taskId) return null;
  const t = await todoOf(projectId, p.taskId);
  if (!t) return null;
  const patch: Parameters<typeof updateTask>[1] = {};
  if (fields.title) patch.title = p.title.slice(0, 300);
  if (fields.due) patch.due = p.dueDate;
  if (fields.writer) Object.assign(patch, await ownerFields(p.writer));
  const r = fields.status || (fields.due && p.dueDate)
    ? await followPiece(projectId, t, p.id, { status: p.status, was, dueDate: p.dueDate, changed: { status: fields.status, due: fields.due } }, patch.due !== undefined ? patch.due : t.due)
    : null;
  // set even when the sub-action's copy says so already: changed now, the sync gives it to the ticket, not the other way
  if (r?.move.to) patch.stage = r.move.to.value;
  if (r?.move.fields.due) patch.due = r.move.fields.due;
  if (r?.move.fields.start) patch.start = r.move.fields.start;
  if (!Object.keys(patch).length) return null;
  await updateTask(p.taskId, patch);
  if (t.planItem != null) queuePlanSync(r ? `content piece ${r.move.why}` : "content piece changed");
  if (!r) return null;
  console.log(moveLine(r.move, { ticketId: r.ticketId, taskId: t.id, pieceId: p.id, status: p.status, dueDate: p.dueDate }));
  return r.ticketId && r.move.to
    ? { pieceId: p.id, id: r.ticketId, stage: r.move.to.value, stageLabel: r.move.to.label, open: r.move.to.open ?? true, why: r.move.why }
    : null;
}

/**
 * The to-do's ticket moved by hand to a stage of the pipeline (SARCLA 10.11.2026: "on clicking the ticket I should be able
 * to move it from stage") - in HubSpot at once, so a refusal is said on the page; the sub-action takes the stage after it,
 * so the plan's sync keeps it and carries the rest.
 */
export async function moveTodoTicket(projectId: number, todoId: number, stage: string, by: string): Promise<{ ok: true; ticket: TodoTicket; was: string } | { ok: false; error: string }> {
  const t = await todoOf(projectId, todoId);
  if (!t) return { ok: false, error: "That to-do is not in this project." };
  const link = (await ticketsOf(todoTile(projectId))).find((l) => l.taskId === todoId);
  if (!link) return { ok: false, error: "This to-do has no ticket yet." };
  let tk: S2sTicket | undefined;
  let to: PipeStage | undefined;
  try {
    to = (await s2sForm()).stages.find((s) => s.value === stage);
    if (!to) return { ok: false, error: "That is not a stage of From Scroll to Sale." };
    [tk] = await readTickets([link.ticketId]);
  } catch (e) {
    return { ok: false, error: `HubSpot did not answer - the ticket stays where it is (${describeIntegrationError(e).error.replace(/^HubSpot:\s*/, "")}).` };
  }
  if (!tk) return { ok: false, error: `Ticket ${link.ticketId} is no longer in From Scroll to Sale - open it in HubSpot.` };
  if (tk.stage !== to.value) {
    try { await moveTicket(tk.id, to.value); } catch (e) { return { ok: false, error: refusalText(describeIntegrationError(e).error, to.label, tk.stageLabel) }; }
  }
  await updateTask(todoId, { stage: to.value });
  if (t.planItem != null) queuePlanSync("content to-do ticket moved");
  console.log(`[content] ticket ${tk.id} -> ${to.label} by ${by} (to-do ${todoId} of project ${projectId}, was ${tk.stageLabel || "no stage"})`);
  return { ok: true, was: tk.stageLabel, ticket: { id: tk.id, subject: tk.subject, stage: to.value, stageLabel: to.label, open: to.open ?? true, url: tk.url } };
}

/** The tickets of the project's to-dos, read from HubSpot - asked for after the page is drawn, never before. */
export async function piecesTickets(projectId: number): Promise<{ tickets: Record<number, TodoTicket>; takes: Record<number, boolean>; place: PlanPlace | null; error: string | null; filled: number;
  /** the pipeline's stages in its order, for the ticket chip's menu - empty when HubSpot did not answer */
  stages: PipeStage[] }> {
  const tile = todoTile(projectId);
  const [pieces, links, action, tasks] = await Promise.all([listPieces(projectId), ticketsOf(tile), planActionOf(projectId), tasksOf(tile)]);
  let read: S2sTicket[] = [];
  let error: string | null = null;
  let stages: PipeStage[] = [];
  if (links.length) {
    try { read = await readTickets(links.map((l) => l.ticketId)); } catch (e) { error = e instanceof Error ? e.message : String(e); }
    stages = ((await s2sForm().catch(() => null))?.stages ?? []).map((s) => ({ value: s.value, label: s.label, open: s.open }));
  }
  const tickets: Record<number, TodoTicket> = {};
  const takes: Record<number, boolean> = {};
  let filled = 0;
  for (const p of pieces) {
    const t = tasks.find((x) => x.id === p.taskId);
    takes[p.id] = !!action && takesTicket(action, t?.ownerName ?? null);
    const l = links.find((x) => x.taskId === p.taskId);
    if (!l) continue;
    const tk = read.find((x) => x.id === l.ticketId);
    tickets[p.id] = { id: l.ticketId, subject: tk?.subject ?? `Ticket ${l.ticketId}`, stage: tk?.stage ?? "", stageLabel: tk?.stageLabel ?? "", open: tk?.open ?? true, url: tk?.url ?? ticketUrl(l.ticketId) };
    // no due date yet: the ticket's (its Go-live date, else its Planned date) - copied once, a date someone set is never
    // overwritten (SARCLA 10.11.2026: "due date should be copied from the ticket if there is one")
    if (!p.dueDate && tk?.due) {
      await updatePiece(p.id, { dueDate: tk.due });
      if (t && !t.due) await updateTask(t.id, { due: tk.due });
      filled++;
    }
  }
  return { tickets, takes, place: action ? await placeOf(action) : null, error, filled, stages };
}

/** Why a piece's to-do takes no ticket, in words for the page, or null when it may take one. */
export async function whyNoTicket(projectId: number, taskId: number | null): Promise<string | null> {
  if (!taskId) return "This to-do is still being set up - try again in a moment.";
  return ticketRefusal(projectId, taskId);
}
