// A "FROM SCROLL TO SALE" TICKET PREFILLED FROM A KPI TILE - the rules, with no HubSpot in them.
// SARCLA 18.10.2026: "ensure that every property for ticket creation is also on the hub form, but
// prefilled at the maximum". The fields are the ones the pipeline's 108 tickets carry (read 18.10):
// always subject, priority, owner, stage; nearly always business goal, channel, implementation
// country; often team, roadmap year + id, description, planned date, next steps; sometimes go-live,
// agency, KPIs, status note. None of the tickets is linked to a contact or a company.

import { PLAN_PROPS } from "./actionPlanRules";

export const S2S_PIPELINE = "4197562568";
export const S2S_FIRST_STAGE = "6161860807"; // Idea box

export type S2sField = {
  name: string; label: string; kind: "text" | "textarea" | "select" | "multi" | "date" | "owner" | "team" | "stage";
  required?: boolean; options?: { value: string; label: string }[];
};

/** The form, in the order the tickets are worked: what, who, why, where, when, how it is measured. */
export const S2S_FIELDS: readonly Omit<S2sField, "options">[] = [
  // the ticket is named by the action (SARCLA 18.10: "ticket name should really be an action")
  { name: "subject", label: "Action (the ticket's name)", kind: "text", required: true },
  { name: "content", label: "Description", kind: "textarea" },
  { name: "hs_pipeline_stage", label: "Status", kind: "stage", required: true },
  { name: "hs_ticket_priority", label: "Priority", kind: "select", required: true },
  { name: "hubspot_owner_id", label: "Owner", kind: "owner", required: true },
  { name: "mkt_business_goal", label: "Business goal", kind: "multi", required: true },
  // the plan's place, three properties the hub keeps in HubSpot (SARCLA 01.11.2026: "create new properties in HubSpot to
  // populate the action plan's main categories and sub and so forth") - on the form of the plan's sub-actions only
  ...PLAN_PROPS.map((p) => ({ name: p.name, label: p.label, kind: "select" as const })),
  { name: "mkt_channel", label: "Marketing channel", kind: "multi", required: true },
  { name: "mkt_implementation_country", label: "Implementation country", kind: "multi", required: true },
  { name: "mkt_roadmap_year", label: "Roadmap year", kind: "select" },
  { name: "mkt_roadmap_id", label: "Roadmap ID", kind: "text" },
  { name: "mkt_planned_date", label: "Planned date", kind: "date" },
  { name: "mkt_golive_date", label: "Go-live date", kind: "date" },
  { name: "mkt_agency", label: "Agency", kind: "multi" },
  { name: "mkt_kpis", label: "KPIs", kind: "textarea" },
  { name: "mkt_next_steps", label: "Next steps / milestones", kind: "textarea" },
  { name: "mkt_status_note", label: "Status note", kind: "textarea" },
  // in HubSpot since the agency's set-up, on no ticket yet (01.11.2026) - "all properties for creation"
  { name: "mkt_report_link", label: "Report link", kind: "text" },
];
export const PLAN_FIELDS: readonly string[] = PLAN_PROPS.map((p) => p.name);

/** What the tile tells the form. */
export type TileContext = {
  page: string; tab?: string; kpiId?: string; title: string;
  /** one line of what the KPI shows now, e.g. "1,234 clicks this year so far, -28% vs last year" */
  summary?: string;
  /** the page's filters, e.g. { country: ["DE"] } */
  filters?: Record<string, string[]>;
  /** the page with its filters, so the ticket leads back to the figure */
  href?: string;
};

const pick = (options: { value: string; label: string }[] | undefined, wanted: string[]): string[] => {
  if (!options?.length) return [];
  const out: string[] = [];
  for (const w of wanted) {
    const o = options.find((x) => x.value.toLowerCase() === w.toLowerCase() || x.label.toLowerCase() === w.toLowerCase());
    if (o && !out.includes(o.value)) out.push(o.value);
  }
  return out;
};

/** The channel a page (and tab) is about. */
export function channelsFor(page: string, tab = ""): string[] {
  const t = tab.toLowerCase();
  if (page === "reach") {
    // whole words: "Search (SEO)" holds the letters "sea" too
    if (/\b(sea|ads)\b/.test(t)) return ["SEA"];
    if (/\b(email|newsletter)\b/.test(t)) return ["Newsletter"];
    if (/\blinkedin\b/.test(t)) return ["LinkedIn"];
    return ["SEO/GEO"];
  }
  if (["visit", "engage", "cart", "purchase"].includes(page)) return ["Website"];
  if (["lead", "handover", "customers"].includes(page)) return ["HubSpot"];
  if (page === "retain") return ["HubSpot", "Newsletter"];
  return [];
}

/** The business goal a page serves. */
export function goalsFor(page: string): string[] {
  if (["reach", "visit", "engage"].includes(page)) return ["Visibility & Demand"];
  if (["lead", "handover", "cart", "purchase"].includes(page)) return ["Acquisition"];
  if (page === "retain") return ["Retention", "Reactivation"];
  if (page === "customers") return ["Acquisition", "Retention"];
  return [];
}

/** The next free roadmap id of a year: MKT26-46 taken -> MKT26-47. */
export function nextRoadmapId(taken: (string | null | undefined)[], year: number): string {
  const pre = `MKT${String(year).slice(-2)}-`;
  let max = 0;
  for (const t of taken) {
    const m = String(t ?? "").trim().match(/^MKT(\d{2})-(\d+)$/i);
    if (m && `MKT${m[1]}-` === pre) max = Math.max(max, Number(m[2]));
  }
  return `${pre}${String(max + 1).padStart(2, "0")}`;
}

/**
 * The form's starting values. Nothing is invented: a choice is set only when the tile says it
 * and the property offers it; the person sees all of it and changes what is wrong.
 */
export function prefill(tile: TileContext, ctx: {
  options: Record<string, { value: string; label: string }[]>;
  ownerId?: string; year: number; takenRoadmapIds: (string | null | undefined)[];
}): Record<string, string> {
  const o = ctx.options;
  const kpi = [tile.kpiId, tile.title].filter(Boolean).join(" ");
  const countries = (tile.filters?.country ?? []).map((c) => c.toUpperCase());
  const country = pick(o.mkt_implementation_country, countries);
  const year = pick(o.mkt_roadmap_year, [String(ctx.year)]);
  const v: Record<string, string> = {
    // the action names the ticket - it comes from the task; the KPI goes into KPIs and the description
    subject: "",
    content: [
      tile.page === "plan"
        ? `From the action plan: "${tile.title}".`
        : `From the Digital Growth KPIs tile "${tile.title}"${tile.tab ? ` (${tile.page}, ${tile.tab})` : ` (${tile.page})`}.`,
      tile.summary ? `Now: ${tile.summary}.` : "",
      Object.keys(tile.filters ?? {}).length ? `Filters: ${Object.entries(tile.filters ?? {}).filter(([, x]) => x.length).map(([k, x]) => `${k} ${x.join(", ")}`).join("; ")}.` : "",
      tile.href ? `Open it: ${tile.href}` : "",
    ].filter(Boolean).join("\n"),
    hs_pipeline_stage: S2S_FIRST_STAGE,
    hs_ticket_priority: pick(o.hs_ticket_priority, ["MEDIUM"])[0] ?? "MEDIUM",
    mkt_business_goal: pick(o.mkt_business_goal, goalsFor(tile.page)).join(";"),
    mkt_channel: pick(o.mkt_channel, channelsFor(tile.page, tile.tab)).join(";"),
    // the country the page is filtered on, else every country
    mkt_implementation_country: (country.length ? country : pick(o.mkt_implementation_country, ["All"])).join(";"),
    mkt_roadmap_year: year[0] ?? "",
    mkt_roadmap_id: nextRoadmapId(ctx.takenRoadmapIds, ctx.year),
    mkt_kpis: [kpi, tile.summary].filter(Boolean).join(": "),
  };
  if (ctx.ownerId) v.hubspot_owner_id = ctx.ownerId;
  return v;
}

/**
 * The properties a create sends: only the form's fields, never an empty one, the pipeline always -
 * and what the hub adds itself (the task's shared users as hs_shared_user_ids).
 */
export function ticketProperties(values: Record<string, string | null | undefined>, extra: Record<string, string> = {}): Record<string, string> {
  const out: Record<string, string> = { hs_pipeline: S2S_PIPELINE };
  for (const [k, v] of Object.entries(extra)) if (v) out[k] = v;
  for (const f of S2S_FIELDS) {
    const v = String(values[f.name] ?? "").trim();
    if (v) out[f.name] = v;
  }
  if (!out.hs_pipeline_stage) out.hs_pipeline_stage = S2S_FIRST_STAGE;
  return out;
}

/** What is missing before a ticket can be created. */
export function missingRequired(values: Record<string, string | null | undefined>): string[] {
  return S2S_FIELDS.filter((f) => f.required && !String(values[f.name] ?? "").trim()).map((f) => f.label);
}

/* ── "Create with AI" ──────────────────────────────────────────────────────
   SARCLA 01.11.2026: "create with AI should be a button where you describe to the AI and the AI helps fill out the
   form". The AI answers in this shape; what it proposes is kept only where the form allows it, and the person
   checks every field before anything is saved. */

/** What the AI filled in: the task, and its ticket's fields (by property name). */
export type AiFill = { title: string; note: string; due: string; owner: string; shared: string[]; ticket: boolean; values: Record<string, string> };
type Choice = { value: string; label: string };
/** What the AI may choose from: each field's choices, the people (owner id = name) and the stages. */
export type AiForm = { fields: S2sField[]; owners: Choice[]; stages: Choice[]; teams?: Choice[] };

const isDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const choicesOf = (f: S2sField, form: AiForm): Choice[] =>
  f.kind === "owner" ? form.owners : f.kind === "stage" ? form.stages : f.kind === "team" ? form.teams ?? [] : f.options ?? [];

/** The answer's JSON schema: every choice an enum of what the field offers, "" or [] for nothing. */
export function aiFillSchema(form: AiForm, tickets: boolean): Record<string, unknown> {
  const people = ["", ...form.owners.map((o) => o.value)];
  const values: Record<string, unknown> = {};
  for (const f of form.fields) {
    if (f.name === "subject" || f.kind === "team") continue;
    const opts = choicesOf(f, form).map((o) => o.value);
    values[f.name] =
      f.kind === "multi" ? { type: "array", items: { type: "string", enum: opts.length ? opts : [""] }, description: f.label }
        : f.kind === "select" || f.kind === "owner" || f.kind === "stage" ? { type: "string", enum: ["", ...opts], description: f.label }
          : f.kind === "date" ? { type: "string", description: `${f.label}: YYYY-MM-DD, or "" when not said` }
            : { type: "string", description: f.label };
  }
  return {
    type: "object",
    properties: {
      title: { type: "string", description: "What will be done, written as an action (a verb first), at most 120 characters" },
      note: { type: "string", description: "A short note for the person doing it - the details of the description that fit nowhere else, or \"\"" },
      due: { type: "string", description: "By when: YYYY-MM-DD, or \"\" when the description gives no date" },
      owner: { type: "string", enum: people, description: "Who does it: the id of a person the description names, or \"\"" },
      shared: { type: "array", items: { type: "string", enum: people }, description: "Other people the description names, to inform" },
      ticket: { type: "string", enum: tickets ? ["none", "new"] : ["none"], description: "\"new\" when a marketing ticket should be made for it" },
      values: { type: "object", properties: values, required: Object.keys(values), additionalProperties: false },
    },
    required: ["title", "note", "due", "owner", "shared", "ticket", "values"],
    additionalProperties: false,
  };
}

/** What the AI proposed, kept only where the form allows it: a choice the field offers, a real date, a known person. */
export function cleanAiFill(raw: unknown, form: AiForm, tickets: boolean): AiFill {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const arr = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
  const people = new Set(form.owners.map((o) => o.value));
  const due = str(r.due);
  const owner = str(r.owner);
  const out: AiFill = {
    title: str(r.title).replace(/\s+/g, " ").slice(0, 200),
    note: str(r.note).slice(0, 2000),
    due: isDay(due) ? due : "",
    owner: people.has(owner) ? owner : "",
    shared: [...new Set(arr(r.shared).filter((x) => people.has(x) && x !== owner))],
    ticket: tickets && r.ticket === "new",
    values: {},
  };
  const given = (r.values && typeof r.values === "object" ? r.values : {}) as Record<string, unknown>;
  for (const f of form.fields) {
    if (f.name === "subject" || f.kind === "team") continue;
    const allowed = new Set(choicesOf(f, form).map((o) => o.value));
    let v = "";
    if (f.kind === "multi") v = [...new Set(arr(given[f.name]).filter((x) => allowed.has(x)))].join(";");
    else if (f.kind === "select" || f.kind === "owner" || f.kind === "stage") v = allowed.has(str(given[f.name])) ? str(given[f.name]) : "";
    else if (f.kind === "date") v = isDay(str(given[f.name])) ? str(given[f.name]) : "";
    else v = str(given[f.name]).slice(0, 5000);
    if (v) out.values[f.name] = v;
  }
  return out;
}
