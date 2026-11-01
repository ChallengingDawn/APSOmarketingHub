// "Create with AI" - a new task (on the plan: a sub-action) and its "From Scroll to Sale" ticket filled in from a
// description (SARCLA 01.11.2026: "create with AI should be a button where you describe to the AI and the AI helps fill
// out the form"):
//   POST {tile, describe, ctx?: {title, summary}, values?: the ticket form so far}  ->  {ok, fill}
// The AI only proposes: each choice must be one the form offers (aiFillSchema, cleanAiFill), nothing is made up, and
// the person checks the form before anything is saved. Nothing is written here.
import { NextRequest, NextResponse } from "next/server";
import { claudeText, getAnthropic } from "@/lib/ai/claude";
import { planItems } from "@/lib/reporting/actionPlan";
import { PLAN_PROPS, planOptions, priorityLabel, stageOf, type PlanItem } from "@/lib/reporting/actionPlanRules";
import { planIdOf } from "@/lib/reporting/kpiActions";
import { ownerOf, s2sForm } from "@/lib/reporting/scrollToSale";
import { PLAN_FIELDS, aiFillSchema, cleanAiFill, type AiForm } from "@/lib/reporting/scrollToSaleRules";
import { fail, whoForTile } from "../guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM = `You help the marketing team of APSOparts (an online shop for technical parts: seals, O-rings, hoses, plastics) fill in a form in their hub: a new task - on their action plan, a sub-action of an action - and, when one is wanted, its ticket in HubSpot's "From Scroll to Sale" marketing pipeline. You get the person's description, what the task belongs to, the form as it is now, and every field with the choices it allows.

Rules:
- Fill a field only with what the description says or what the context states plainly. Leave everything else empty ("" or []). Never invent dates, people, figures, budgets, agencies or KPIs.
- A choice is one of the values listed for its field - the value, not its label.
- A person is chosen only when the description names them; "I" or "me" is the person writing.
- Dates are YYYY-MM-DD. A month or a quarter means its last day; "next week", "end of the month" are counted from today.
- The title says what will be done, as an action (a verb first), at most 120 characters, in the description's language. The other texts are in the description's language too.
- ticket is "new" only when the description asks for a ticket, or describes a marketing job for the agency or the Digital Growth team.
- On the ticket: the description says what and why; the planned date is when the work starts; the go-live date is when it should be live; KPIs say how success is measured, only when the description says it.
- Keep what the form already holds unless the description says otherwise: give those fields back as they are.`;

/** An action of the plan, as the AI reads it. */
function actionText(a: PlanItem, items: PlanItem[]): string {
  const byId = new Map(items.map((i) => [i.id, i]));
  const path: string[] = [];
  for (let p = a.parentId == null ? undefined : byId.get(a.parentId); p && path.length < 6; p = p.parentId == null ? undefined : byId.get(p.parentId)) path.unshift(p.title);
  return [
    `The action plan's action "${a.title}"${path.length ? ` (in ${path.join(" > ")})` : ""}.`,
    a.detail && a.detail !== a.title ? `Its description: ${a.detail.slice(0, 1500)}` : "",
    [stageOf(a.stage) ? `status ${stageOf(a.stage)!.label}` : "", a.priority ? `priority ${priorityLabel(a.priority)}` : "", a.start ? `planned ${a.start}` : "", a.due ? `go-live ${a.due}` : "",
      a.owners.length ? `assigned to ${a.owners.map((o) => o.name).join(", ")}` : ""].filter(Boolean).join(", "),
    a.kpis ? `Its KPIs: ${a.kpis.slice(0, 800)}` : "",
  ].filter(Boolean).join("\n");
}

export async function POST(req: NextRequest) {
  const b = (await req.json().catch(() => ({}))) as { tile?: string; describe?: string; ctx?: { title?: string; summary?: string }; values?: Record<string, string> };
  const w = await whoForTile(b.tile, true);
  if (w instanceof NextResponse) return w;
  if (typeof b.tile !== "string") return fail("tile is missing", 400);
  const describe = String(b.describe ?? "").trim();
  if (describe.length < 5) return fail("describe what will be done", 400);
  if (describe.length > 4000) return fail("keep the description under 4,000 characters", 400);
  const client = getAnthropic();
  if (!client) return fail("the AI is not set up on this hub", 503);
  try {
    const form = await s2sForm();
    const planId = planIdOf(b.tile);
    const items = planId != null ? await planItems() : [];
    const action = items.find((i) => i.id === planId);
    // the plan's place only on the plan's actions, its choices straight from the plan
    const fields = form.fields.filter((f) => planId != null || !PLAN_FIELDS.includes(f.name)).map((f) => {
      const p = PLAN_PROPS.find((x) => x.name === f.name);
      return p ? { ...f, options: planOptions(items, p.kind).filter((o) => !o.hidden).map((o) => ({ value: o.value, label: o.label })) } : f;
    });
    const aiForm: AiForm = { fields, owners: form.owners.map((o) => ({ value: o.id, label: o.name })), stages: form.stages.map((s) => ({ value: s.value, label: s.label })) };
    const tickets = planId == null || !!action?.dg;
    const me = ownerOf(form, w.email);
    const choiceLines = fields.filter((f) => f.name !== "subject" && f.kind !== "team").map((f) => {
      const opts = f.kind === "stage" ? aiForm.stages : f.kind === "owner" ? [] : f.options ?? [];
      const kind = f.kind === "multi" ? "several" : f.kind === "date" ? "date" : f.kind === "textarea" || f.kind === "text" ? "text" : "one";
      return `- ${f.name} (${f.label}, ${kind})${opts.length ? `: ${opts.map((o) => (o.value === o.label ? o.value : `${o.value} = ${o.label}`)).join("; ")}` : f.kind === "owner" ? ": a person's id" : ""}`;
    });
    const now = Object.fromEntries(Object.entries(b.values ?? {}).filter(([k, v]) => typeof v === "string" && v.trim() && k !== "subject" && fields.some((f) => f.name === k)));
    const user = [
      `Today is ${new Date().toISOString().slice(0, 10)}. The person writing is ${me ? `${me.name} (id ${me.id})` : w.name}.`,
      action ? actionText(action, items) : `A task on the KPI tile "${String(b.ctx?.title ?? "").slice(0, 200)}"${b.ctx?.summary ? ` - now: ${String(b.ctx.summary).slice(0, 300)}` : ""}.`,
      tickets ? "" : "This action takes no ticket: ticket stays \"none\" and the ticket's fields stay empty.",
      `\nThe description:\n${describe}`,
      `\nThe ticket form so far: ${JSON.stringify(now)}`,
      `\nThe people (id = name): ${aiForm.owners.map((o) => `${o.value} = ${o.label}`).join("; ")}`,
      `\nThe ticket's fields and their choices:\n${choiceLines.join("\n")}`,
    ].filter(Boolean).join("\n");
    const r = await claudeText({
      client, system: [{ type: "text", text: SYSTEM }], user, budget: { maxTokens: 6000, effort: "low" },
      outputFormat: { type: "json_schema", schema: aiFillSchema(aiForm, tickets) },
    });
    if (!r.ok) return NextResponse.json({ ok: false, error: r.failure.error }, { status: r.failure.status });
    let raw: unknown;
    try { raw = JSON.parse(r.text); } catch { return fail("the AI's answer could not be read - try again", 502); }
    const fill = cleanAiFill(raw, aiForm, tickets);
    console.log(`[kpi-actions] AI fill on ${b.tile} by ${w.name}: ${Object.keys(fill.values).length} ticket field(s), ${r.usage.input_tokens}+${r.usage.output_tokens} tokens`);
    return NextResponse.json({ ok: true, fill });
  } catch (e) { return fail(e, 502); }
}
