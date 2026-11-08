// THE AI THAT HELPS A CONTENT PROJECT INTO THE ACTION PLAN (SARCLA 08.11.2026: "action plan and association should also
// be assisted and AI assistant as in the other model" - the plan's own + windows with "Create with AI").
//
//   placesFor     which action of the plan the project belongs under - three, best first, each with its reason
//   ticketsFor    which existing "From Scroll to Sale" tickets a to-do is - found by search, ranked by the AI
//   fillTicket    a new ticket's form filled from a few words, as the plan's "Create with AI" fills it
// The AI only proposes: every id it returns is one it was shown, every choice one the form offers; nothing is written.

import { claudeText, getAnthropic } from "@/lib/ai/claude";
import { searchTickets, type S2sTicket } from "@/lib/reporting/scrollToSale";
import { aiFillSchema, cleanAiFill, type AiFill, type AiForm } from "@/lib/reporting/scrollToSaleRules";
import type { PlanPlace } from "@/lib/content/todos";

export type ProjectSketch = { title: string; goal: string; message: string; audience: string; pieces: string[] };

const sketch = (p: ProjectSketch) => [
  `Project: ${p.title}`, p.goal && `Goal: ${p.goal}`, p.audience && `Who it is for: ${p.audience}`,
  p.message && `Key message: ${p.message}`, p.pieces.length ? `What it puts out: ${p.pieces.join("; ")}` : "",
].filter(Boolean).join("\n");

async function ask<T>(system: string, user: string, schema: Record<string, unknown>, maxTokens = 1500): Promise<T | null> {
  const client = getAnthropic();
  if (!client) return null;
  const r = await claudeText({ client, system: [{ type: "text", text: system }], user, budget: { maxTokens, effort: "low" }, outputFormat: { type: "json_schema", schema } });
  if (!r.ok) throw new Error(r.failure.error);
  try { return JSON.parse(r.text) as T; } catch { return null; }
}

export type PlaceHint = PlanPlace & { why: string };

/** The plan's actions this project most likely belongs under. Null when the hub has no AI key. */
export async function placesFor(p: ProjectSketch, places: PlanPlace[]): Promise<PlaceHint[] | null> {
  if (!places.length) return [];
  const ids = places.map((x) => String(x.id));
  const out = await ask<{ picks: { id: string; why: string }[] }>(
    `You help the marketing team of APSOparts (an online shop for technical parts: seals, O-rings, hoses, plastics) file a content project under the right action of their business action plan. You get the project and every action of the plan with where it sits. Pick the three actions it most plainly serves, best first, each with one short sentence (at most 20 words) on why - in English, naming what in the project matches the action. Only ids from the list.`,
    `${sketch(p)}\n\nThe plan's actions (id | where | action | led by Digital Growth):\n${places.map((x) => `${x.id} | ${x.path} | ${x.title} | ${x.dg ? "yes" : "no"}`).join("\n")}`,
    { type: "object", properties: { picks: { type: "array", items: { type: "object", properties: { id: { type: "string", enum: ids }, why: { type: "string" } }, required: ["id", "why"], additionalProperties: false } } }, required: ["picks"], additionalProperties: false },
  );
  if (!out) return null;
  const seen = new Set<number>();
  return out.picks.map((k) => ({ place: places.find((x) => String(x.id) === k.id), why: k.why.slice(0, 200) }))
    .filter((x): x is { place: PlanPlace; why: string } => !!x.place && !seen.has(x.place.id) && !!seen.add(x.place.id))
    .slice(0, 3).map((x) => ({ ...x.place, why: x.why }));
}

const STOP = new Set(["the", "and", "for", "with", "from", "into", "this", "that", "our", "your", "der", "die", "das", "und", "les", "des", "pour", "page", "post", "piece"]);
const words = (s: string) => [...new Set(s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2 && !STOP.has(w)))];

export type TicketHint = S2sTicket & { why: string };

/**
 * Existing tickets this to-do may already be: the pipeline searched with the to-do's words and the project's, then the
 * AI keeps the ones that really are the same work. Without an AI key, the search's own order.
 */
export async function ticketsFor(p: ProjectSketch, todo: string): Promise<TicketHint[]> {
  const queries = [todo, `${words(todo).slice(0, 3).join(" ")}`, `${words(p.title).slice(0, 3).join(" ")}`].map((q) => q.trim()).filter((q, i, a) => q && a.indexOf(q) === i);
  const found = new Map<string, S2sTicket>();
  for (const q of queries) {
    for (const t of await searchTickets(q, "all").catch(() => [] as S2sTicket[])) found.set(t.id, t);
    if (found.size >= 30) break;
  }
  const list = [...found.values()].slice(0, 30);
  if (!list.length) return [];
  const ids = list.map((t) => t.id);
  const out = await ask<{ picks: { id: string; why: string }[] }>(
    `You help the marketing team of APSOparts link a to-do of a content project to the HubSpot ticket that already tracks the same work, so it is not tracked twice. You get the project, the to-do and the tickets a search found. Keep only tickets that are the same piece of work (at most three, best first), each with one short reason in English (at most 18 words). An empty list is right when none is.`,
    `${sketch(p)}\nThe to-do: ${todo}\n\nTickets (id | subject | stage | owner):\n${list.map((t) => `${t.id} | ${t.subject} | ${t.stageLabel} | ${t.ownerName}`).join("\n")}`,
    { type: "object", properties: { picks: { type: "array", items: { type: "object", properties: { id: { type: "string", enum: ids }, why: { type: "string" } }, required: ["id", "why"], additionalProperties: false } } }, required: ["picks"], additionalProperties: false },
  ).catch(() => null);
  if (!out) return list.slice(0, 5).map((t) => ({ ...t, why: "Found by its words" }));
  return out.picks.map((k) => { const t = found.get(k.id); return t ? { ...t, why: k.why.slice(0, 200) } : null; }).filter((x): x is TicketHint => !!x).slice(0, 3);
}

/** A new ticket's form, filled from what the person says and what the to-do and its action already give. */
export async function fillTicket(form: AiForm, values: Record<string, string>, describe: string, context: string, me: string): Promise<AiFill | null> {
  const now = Object.fromEntries(Object.entries(values).filter(([k, v]) => v && k !== "subject"));
  const choices = form.fields.filter((f) => f.name !== "subject" && f.kind !== "team").map((f) => {
    const opts = f.kind === "stage" ? form.stages : f.kind === "owner" ? [] : f.options ?? [];
    return `- ${f.name} (${f.label})${opts.length ? `: ${opts.map((o) => (o.value === o.label ? o.value : `${o.value} = ${o.label}`)).join("; ")}` : f.kind === "owner" ? ": a person's id" : ""}`;
  });
  const out = await ask<unknown>(
    `You help the marketing team of APSOparts fill in a ticket in HubSpot's "From Scroll to Sale" pipeline for a to-do of a content project. Fill a field only with what the description or the context states plainly; keep what the form already holds unless the description says otherwise; leave the rest empty. A choice is one of the listed values. Never invent dates, people, figures or agencies. Dates are YYYY-MM-DD. Write in English. The title says what will be done, verb first, at most 120 characters. ticket is "new".`,
    `Today is ${new Date().toISOString().slice(0, 10)}. The person writing is ${me}.\n${context}\n\nThe description:\n${describe || "(none - use the context)"}\n\nThe form so far: ${JSON.stringify(now)}\n\nThe people (id = name): ${form.owners.map((o) => `${o.value} = ${o.label}`).join("; ")}\n\nThe fields:\n${choices.join("\n")}`,
    aiFillSchema(form, true), 5000,
  );
  return out ? cleanAiFill(out, form, true) : null;
}
