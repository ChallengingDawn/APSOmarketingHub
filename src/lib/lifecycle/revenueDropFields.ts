// UC12 REVENUE DROP - the ticket's own fields in HubSpot: a "Revenue drop" group beside the "Erosion" group, its ten
// fields and the `revenue_drop` choice on Tags, so a UC12 ticket reads like an article-erosion ticket (Diana
// 11.11.2026: "ticket looks good and yes, you should create all the needed properties"). Pure: the definitions and
// what is missing against what HubSpot has; revenueDropFieldsHubspot.ts reads and writes.

/** The ticket property group, as the "erosion" group. */
export const RD_GROUP = { name: "revenue_drop", label: "Revenue drop", displayOrder: -1 } as const;
/** The Tags choice every UC12 ticket carries, as `erosion` on erosion tickets. */
export const RD_TAG = { value: "revenue_drop", label: "Revenue drop" } as const;

export type FieldDef = {
  name: string; label: string; description: string;
  type: "string" | "number" | "enumeration"; fieldType: "text" | "number" | "select";
  options?: { label: string; value: string }[];
};

const KEPT = "Written by APSOhub on UC12 Revenue drop tickets.";

/** The fields, in the order the ticket shows them. */
export const RD_FIELDS: FieldDef[] = [
  { name: "revenue_drop_key", label: "Revenue Drop Key", type: "string", fieldType: "text",
    description: `Customer number | step | last month of the window - one ticket per company, step and window. ${KEPT}` },
  { name: "revenue_drop_step", label: "Revenue Drop Step", type: "enumeration", fieldType: "select",
    description: `Lost business: nothing in the last 12 months. Revenue drop: 30% or more below the 12 months before. ${KEPT}`,
    options: [{ label: "Lost business", value: "lost_business" }, { label: "Revenue drop", value: "revenue_drop" }] },
  { name: "revenue_drop_amount_at_risk", label: "Revenue Drop Amount at Risk (EUR)", type: "number", fieldType: "number",
    description: `The 12 months before minus the last 12 months, revenue plus order intake. ${KEPT}` },
  { name: "revenue_drop_change_pct", label: "Revenue Drop Change (%)", type: "number", fieldType: "number",
    description: `The last 12 months against the 12 before, revenue plus order intake. ${KEPT}` },
  { name: "revenue_drop_last_12", label: "Revenue Drop Last 12 Months (EUR)", type: "number", fieldType: "number",
    description: `Revenue plus order intake in the last 12 months. ${KEPT}` },
  { name: "revenue_drop_prev_12", label: "Revenue Drop 12 Months Before (EUR)", type: "number", fieldType: "number",
    description: `Revenue plus order intake in the 12 months before. ${KEPT}` },
  { name: "revenue_drop_window", label: "Revenue Drop Window", type: "string", fieldType: "text",
    description: `The last 12 months the ticket compares, e.g. Nov 2025 - Oct 2026. ${KEPT}` },
  { name: "revenue_drop_company", label: "Revenue Drop Customer", type: "string", fieldType: "text",
    description: `The company's name when the ticket is written. ${KEPT}` },
  { name: "revenue_drop_customer_number", label: "Revenue Drop Customer Number", type: "string", fieldType: "text",
    description: `The company's unique number (100-... / 110-...). ${KEPT}` },
  { name: "revenue_drop_major_profit_center", label: "Revenue Drop Major Profit Center", type: "string", fieldType: "text",
    description: `The company's Major Profit Center when the ticket is written. ${KEPT}` },
];

/** One ticket property as HubSpot lists it. */
export type HsProp = { name: string; type?: string; groupName?: string; options?: { value?: string }[] };

/** What is missing in HubSpot - and what has the name but another type, which is left alone and named. */
export type FieldPlan = {
  group: boolean; create: string[]; clash: { name: string; has: string; wants: string }[]; tag: boolean;
  /** nothing to create and no clash */
  ok: boolean;
};

export function planFields(groupThere: boolean, props: HsProp[]): FieldPlan {
  const byName = new Map(props.map((p) => [p.name, p]));
  const create: string[] = [];
  const clash: FieldPlan["clash"] = [];
  for (const f of RD_FIELDS) {
    const p = byName.get(f.name);
    if (!p) create.push(f.name);
    else if (p.type && p.type !== f.type) clash.push({ name: f.name, has: p.type, wants: f.type });
  }
  const tag = !(byName.get("tags")?.options ?? []).some((o) => o.value === RD_TAG.value);
  return { group: !groupThere, create, clash, tag, ok: groupThere && !create.length && !clash.length && !tag };
}

/** HubSpot's definition to POST for a field. */
export const createBody = (f: FieldDef) => ({
  name: f.name, label: f.label, description: f.description, groupName: RD_GROUP.name, type: f.type, fieldType: f.fieldType,
  formField: false, ...(f.options ? { options: f.options.map((o, i) => ({ ...o, displayOrder: i, hidden: false })) } : {}),
});
