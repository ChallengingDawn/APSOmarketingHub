// A "FROM SCROLL TO SALE" TICKET PREFILLED FROM A KPI TILE - the rules, with no HubSpot in them.
// SARCLA 18.10.2026: "ensure that every property for ticket creation is also on the hub form, but
// prefilled at the maximum". The fields are the ones the pipeline's 108 tickets carry (read 18.10):
// always subject, priority, owner, stage; nearly always business goal, channel, implementation
// country; often team, roadmap year + id, description, planned date, next steps; sometimes go-live,
// agency, KPIs, status note. None of the tickets is linked to a contact or a company.

export const S2S_PIPELINE = "4197562568";
export const S2S_FIRST_STAGE = "6161860807"; // Idea box

export type S2sField = {
  name: string; label: string; kind: "text" | "textarea" | "select" | "multi" | "date" | "owner" | "team" | "stage";
  required?: boolean; options?: { value: string; label: string }[];
};

/** The form, in the order the tickets are worked: what, who, why, where, when, how it is measured. */
export const S2S_FIELDS: readonly Omit<S2sField, "options">[] = [
  { name: "subject", label: "Ticket name", kind: "text", required: true },
  { name: "content", label: "Description", kind: "textarea" },
  { name: "hs_pipeline_stage", label: "Status", kind: "stage", required: true },
  { name: "hs_ticket_priority", label: "Priority", kind: "select", required: true },
  { name: "hubspot_owner_id", label: "Owner", kind: "owner", required: true },
  { name: "hubspot_team_id", label: "Team", kind: "team" },
  { name: "mkt_business_goal", label: "Business goal", kind: "multi", required: true },
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
];

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
  ownerId?: string; teamId?: string; year: number; takenRoadmapIds: (string | null | undefined)[];
}): Record<string, string> {
  const o = ctx.options;
  const kpi = [tile.kpiId, tile.title].filter(Boolean).join(" ");
  const countries = (tile.filters?.country ?? []).map((c) => c.toUpperCase());
  const country = pick(o.mkt_implementation_country, countries);
  const year = pick(o.mkt_roadmap_year, [String(ctx.year)]);
  const v: Record<string, string> = {
    subject: `${kpi}${tile.summary ? ` - ${tile.summary}` : ""}`.slice(0, 200),
    content: [
      `From the Digital Growth KPIs tile "${tile.title}"${tile.tab ? ` (${tile.page}, ${tile.tab})` : ` (${tile.page})`}.`,
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
  if (ctx.teamId) v.hubspot_team_id = ctx.teamId;
  return v;
}

/** The properties a create sends: only the form's fields, never an empty one, the pipeline always. */
export function ticketProperties(values: Record<string, string | null | undefined>): Record<string, string> {
  const out: Record<string, string> = { hs_pipeline: S2S_PIPELINE };
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
