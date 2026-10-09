// THE COMPASS STEPS - what each one reads, what it writes, and who runs it:
// the hub, or (until it is switched over) the old Compass connector on Railway.
//
// Read from the connector's code on 06.10.2026 (service/*.py, every write and
// every association traced), not from its mappings.py, which describes the old
// PC scripts and no longer matches what runs. The Connectors & Integration app
// draws its pages from this list. A step moves only after the hub's test run has
// matched the connector row for row and SARCLA has said go - never both writers
// on, never both off; the switch itself is kept in the hub (steps/run.ts).

export type Runs = "railway" | "hub";

/** Where a step is on its way to the hub: "preview" = the connector still runs it, the hub's copy is ready to test. */
export type Phase = "railway" | "porting" | "preview" | "hub";

export type Group = "company" | "tickets" | "revenue" | "orders" | "engines";

export type Write = { object: string; props: string[]; how?: string };

export type Step = {
  /** The chain's own name for the step (state.sftp.last_processing.processing[].step). */
  key: string;
  name: string;
  group: Group;
  /** In plain words. */
  what: string;
  when: string;
  reads: string;
  writes: Write[];
  associations?: string[];
  phase: Phase;
  /** Weak spots of the connector's code - found in the code, not guessed. */
  fix?: string[];
};

export const GROUPS: { key: Group; name: string; order: number; note: string }[] = [
  { key: "company", name: "Company facts", order: 1, note: "Small, company-level, easy to check - moves first" },
  { key: "tickets", name: "Ticket owners", order: 2, note: "Owner and pipeline fixes on support tickets" },
  { key: "revenue", name: "Revenue and KPIs", order: 3, note: "The revenue stack on companies and the monthly KPI series" },
  { key: "orders", name: "Orders and articles", order: 4, note: "The biggest files and the most sensitive writes - moves last" },
  { key: "engines", name: "Already in the hub", order: 0, note: "Moved before this app existed" },
];

export const OBJECTS = {
  company: "Company (0-2)",
  contact: "Contact (0-1)",
  order: "Order (0-123)",
  ticket: "Ticket (0-5)",
  pp: "Products & Pricing (2-200042439)",
  kpi: "KPI (2-201387076)",
} as const;

/** The PERFORMIS order pipeline the connector moves orders through. */
export const ORDER_PIPELINE = { id: "3687945443", name: "PERFORMIS" };
export const ORDER_STAGES: [string, string][] = [
  ["5093087452", "Entered"],
  ["5093087453", "Being delivered"],
  ["5093087454", "Pending"],
  ["5093087455", "Provisional"],
  ["5093087456", "Credit note (read, never set by the chain)"],
  ["5093092549", "Ready for delivery / ready for tour"],
  ["5093092550", "Partially called off"],
  ["5093092551", "Ready for invoicing"],
  ["5093092552", "Invoiced / completed"],
  ["5676846286", "Cancelled"],
];

const MONTHS = "jan … dec";

/** The chain, in the order it runs (sftp_pull._pull_and_process_inner), then the loops beside it. */
export const STEPS: Step[] = [
  {
    key: "magento_stamp", name: "Web orders get their A-number", group: "orders", phase: "preview",
    what: "Shop orders that the ERP has taken over are stamped with their A-number, linked to the person who ordered, and that person's company is corrected when the email domain proves it wrong.",
    when: "When a new Magento export (export.xml) arrives",
    reads: "export.xml (Magento order grid: ID, Status, A+P order and customer number, email) · orders in state web_provisional",
    writes: [{ object: OBJECTS.order, props: ["order_order_number", "hs_order_name", "order_reconcile_state (→ erp_linked)"] }],
    associations: [
      "Order → Contact (default type), existing contacts only, found by email",
      "Contact → Company 279 + Primary 1, after DELETING the contact's other company links - only when the email domain matches the true company",
    ],
    fix: [
      "Deletes the old contact→company links before creating the new one, without checking the create - a contact can end up with no company",
      "No check for another order already carrying the same A-number",
      "Retries only on 429; any network error aborts the run",
    ],
  },
  {
    key: "articles", name: "Article master into Products & Pricing", group: "orders", phase: "preview",
    what: "Updates every article that already exists in HubSpot with the ERP's description, material, groups, units, origin and profit centre. Never creates articles on its own.",
    when: "When a new dim_article.csv arrives",
    reads: "dim_article.csv (best row per article: active, then newest) · every Products & Pricing record's article_number",
    writes: [{
      object: OBJECTS.pp,
      props: [
        "article_description", "material", "colour", "hardness", "conformities", "main_group_number", "main_group_description",
        "product_number", "product_description", "sub_group_number", "sub_group_description", "ap_compound_designation",
        "supplier_compound_designation", "tarifs_number", "assortment_description", "compass_article_type", "compass_profit_center",
        "replenishment_days", "country_of_origin", "sales_unit", "consumption_driven", "profit_center", "article_type", "compass_article_inactive",
      ],
      how: "update only; empty source values never clear a field; missing dropdown options are added",
    }],
    fix: ["The change cache is saved before the write succeeds, so a failed batch is never retried", "No retry on HubSpot 5xx"],
  },
  {
    key: "stock_load", name: "ERP stock into Products & Pricing", group: "orders", phase: "hub",
    what: "Puts the ERP's stock on every article: its stock value, unit cost, consumption and movement - and, for articles held in one unit and sold in another (PTFE plate: kg held, sold by the piece), the stock in KILOGRAMS. The piece count for those comes from the shop's own availability, written by the APSOAssistant gateway into Stock Sales. New in the hub - the connector never loaded this file on a schedule.",
    when: "When a new fct_article_quantity_and_consumption.csv arrives (it needs dim_article.csv on disk for its keys)",
    reads: "fct_article_quantity_and_consumption.csv (a rolling refresh: the newest snapshot per article and warehouse is kept between deliveries, the warehouses summed) · dim_article.csv (key → article number) · every Products & Pricing record's article_number, stock_unit and sales_unit",
    writes: [
      {
        object: OBJECTS.pp,
        props: ["stock_value_chf", "stock_value_eur", "unit_cost_chf", "consumption", "stock_movement"],
        how: "every article in the file; only what differs from HubSpot is sent",
      },
      {
        object: OBJECTS.pp,
        props: ["stock_quantity"],
        how: "kilograms (the stock unit) - ONLY where stock_unit and sales_unit differ; everywhere else the gateway owns it",
      },
    ],
  },
  {
    key: "stages", name: "Order stage from the ERP status", group: "orders", phase: "preview",
    what: "Moves every order to the PERFORMIS stage its ERP status says - forwards or backwards. Deleted or inactive orders go to Cancelled.",
    when: "When a new dim_order.csv arrives (a full ~480 MB snapshot every day)",
    reads: "dim_order.csv (current rows, mandant 100/110) · a snapshot of ~800,000 orders' stages",
    writes: [{ object: OBJECTS.order, props: ["hs_pipeline_stage"], how: "PERFORMIS pipeline 3687945443 only" }],
    fix: [
      "A full pull that fails half way is saved as the snapshot",
      "\"Completed\" means Invoiced here but is left blank by the title step - one rule for both",
      "No dry run",
    ],
  },
  {
    key: "revenue", name: "Revenue per company per month", group: "revenue", phase: "preview",
    what: "Writes each company's revenue by month, quarter and profit centre from the ERP rollup. Customers it cannot match go to the review queue - it never creates a company.",
    when: "When a new revenue_oi_rollup.csv arrives",
    reads: "revenue_oi_rollup.csv (mandant 100/110) · the customer-number → company map",
    writes: [{
      object: OBJECTS.company,
      props: [`rev_<year>_<${MONTHS}>`, "rev_<year>_<month>_pc_<at|dt|ft|kt|st|other>", "rev_<year>_q1 … q4 (+ _pc_<…>)", "rev_<year>_pc_monthly (JSON)", "revenue_<year>", "oi_<year>_<month>, oi_<year> - only with OI_FROM_CSV=1 (off: the ERP workbook owns order intake)"],
    }],
    fix: [
      "The change cache is saved before the write succeeds",
      "rev_*_q* may be calculation properties in the portal - writing them may be refused",
      "Months or profit centres missing from the file are never zeroed",
    ],
  },
  {
    key: "customer_agents", name: "Sales agent from the ERP", group: "company", phase: "preview",
    what: "Sets each company's sales agent (and the SAE) from the ERP customer file, choosing only from the dropdown's existing names.",
    when: "When a new dim_customer.csv arrives",
    reads: "dim_customer.csv (CustomerNumberUnique, SA, SAE) · the sa__sales_agent options",
    writes: [{ object: OBJECTS.company, props: ["sa__sales_agent", "sae_performis"], how: "never clears an agent, never invents a name" }],
  },
  {
    key: "erosion", name: "Erosion tickets", group: "engines", phase: "hub",
    what: "Lapsed reorders become one ticket per customer per month. Runs in the hub since 05.10 (EROSION_ENABLED=0 on the connector).",
    when: "Daily, after the chain", reads: "Orders since 2025", writes: [{ object: OBJECTS.ticket, props: ["erosion_*", "subject", "hubspot_owner_id", "hs_pipeline", "hs_pipeline_stage"] }],
  },
  {
    key: "revenue_kpi", name: "Monthly revenue KPIs", group: "revenue", phase: "preview",
    what: "Builds the monthly revenue, order-intake, country and year-on-year series from the companies' monthly revenue.",
    when: "After any file was processed",
    reads: "Every company's rev_<year>_pc_monthly (~60,000) · the ERP order-intake rows",
    writes: [{ object: OBJECTS.kpi, props: ["revenue_monthly", "oi_monthly", "revenue_geo_monthly", "revenue_delta_monthly", "revenue_delta_country"], how: "series, upserted by name; stale rows archived" }],
    fix: ["Years 2025/2026 are written into the code", "In January it archives every revenue_delta_monthly row (no complete month yet)"],
  },
  {
    key: "erp_revenue", name: "The ERP morning workbook", group: "revenue", phase: "preview",
    what: "Reads the ERP revenue workbook: month and year to date against last year per customer, order intake, forecast, profit centre, country and priority series. Runs after the KPI step so its figures win.",
    when: "When revenue_profit_center.xlsx arrives or changes (about 11 minutes)",
    reads: "revenue_profit_center.xlsx - sheets FIGURES (3) and (4)",
    writes: [
      { object: OBJECTS.company, props: ["erp_rev_{mtd,ytd}_{cy,py,delta,delta_pct}", "erp_oi_{mtd,ytd}_{cy,py,delta,delta_pct}", "erp_oi_ytd_pct_of_rev", "erp_rev_rank_{ytd,growth,decline}", "erp_rev_as_of"] },
      { object: OBJECTS.kpi, props: ["forecast_monthly", "oi_erp_monthly", "revenue_pc_monthly", "revenue_geo_erp_monthly", "oi_geo_monthly", "revenue_prio_monthly", "oi_prio_monthly", "revenue_monthly (realigned)"] },
    ],
    fix: ["Companies that drop out of the file keep yesterday's figures", "KPI rows are never archived"],
  },
  {
    key: "revenue_history", name: "12-year revenue and customer cohorts", group: "revenue", phase: "preview",
    what: "Full years since 2015, this year to date, profit centre and country by year, and new and reactivated customers by month.",
    when: "After any file was processed (about 6 minutes)",
    reads: "Every company's yearly revenue blobs · this year's realigned monthly rows",
    writes: [{ object: OBJECTS.kpi, props: ["revenue_year", "revenue_pc_year", "revenue_geo_pc_yearly", "newcust_revenue_monthly", "newcust_monthly", "reactivated_monthly"] }],
  },
  {
    key: "mandant_sweep", name: "Mandant from the customer key", group: "company", phase: "preview",
    what: "Sets each company's mandant (M100 / M110) from the first part of its customer key.",
    when: "On EVERY 30-minute poll, files or not",
    reads: "Every company with a company_unique_number",
    writes: [{ object: OBJECTS.company, props: ["mandant"] }],
    fix: ["The write has no retry", "A key prefix other than 100/110 fails a whole batch of 100"],
  },
  {
    key: "wrong_owners", name: "Tickets with the wrong owner", group: "tickets", phase: "preview",
    what: "A ticket in Back Office owned by an ESO or TSA person moves to that person's pipeline (and the other way round); a Back Office owner in ESO/TSA goes back to Back Office. The subject is flagged until someone corrects it.",
    when: "On EVERY 30-minute poll",
    reads: "Owners and their teams · every ticket in BO, ESO and TSA",
    writes: [{ object: OBJECTS.ticket, props: ["subject (\"WRONG OWNER PLEASE CORRECT IT - …\")", "hs_pipeline", "hs_pipeline_stage", "hubspot_owner_id", "wrong_owner_original_subject", "wrong_owner_flagged_at", "wrong_owner_reason", "wrong_owner_owner_at_flag"] }],
    fix: ["Runs every 30 minutes, though its own comment says nightly"],
  },
  {
    key: "segmentation", name: "Smart Segmentation", group: "engines", phase: "hub",
    what: "Sales priority, potential and classification. Runs in the hub since 05.10 (SEGMENTATION_ENABLED=0 on the connector).",
    when: "Watcher every 2 minutes, nightly after the chain", reads: "Companies", writes: [{ object: OBJECTS.company, props: ["sales_priority", "yearly_customer_potential", "apso_customer"], how: "and more - see Smart Segmentation" }],
  },
  {
    key: "orders_daily", name: "New ERP orders", group: "orders", phase: "preview",
    what: "Creates the orders that are new in the ERP file, fills web orders that have no lines yet, and removes an order entry (.000) once its deliveries carry the same amount.",
    when: "When a new fct_orderlinehist.csv arrives",
    reads: "fct_orderlinehist.csv (mandant 100/110, latest row per line) · dim_article.csv · the customer-number → company map",
    writes: [{
      object: OBJECTS.order,
      props: [
        "order_order_number", "hs_order_name", "order_mandant", "hs_pipeline", "hs_pipeline_stage (→ Entered)", "order_order_type", "order_customer_number",
        "order_total_qty", "order_total_net_revenue", "hs_total_price", "order_avg_gm_pct", "order_margin_eur", "order_line_count", "order_order_date",
        "order_profit_center", "order_positions_json", "order_line_01…80_{article,qty,revenue,pc,gm}",
        "order_web_order_number (copied to deliveries)", "order_doc_request (copied to deliveries)", "order_doc_status (copied to deliveries)",
      ],
      how: "creates new orders; enriches line-less web orders; ARCHIVES a .000 entry its deliveries fully cover",
    }],
    associations: ["Order → Company 509 (HubSpot-defined), new orders only", "Order → Contact (default), copied from the .000 entry to its deliveries"],
    fix: ["The customer map is not refreshed here - a company created after it gets no link", "The delivery search stops at 50 results"],
  },
  {
    key: "stages_new_orders", name: "Stages for the orders just created", group: "orders", phase: "preview",
    what: "A second stage pass right after new orders are created, so they do not wait a day for their stage.",
    when: "After new orders", reads: "dim_order.csv", writes: [{ object: OBJECTS.order, props: ["hs_pipeline_stage"] }],
  },
  {
    key: "order_sync", name: "Order title, shipment date and ERP status", group: "orders", phase: "preview",
    what: "Titles every order \"A# | Person | Company\", and fills its shipment date and ERP status. Never blanks a value.",
    when: "When dim_order.csv or fct_orderlinehist.csv arrives (first run about an hour)",
    reads: "dim_order.csv (YourReference, ShipmentDate, OrderStatus) · a snapshot of ~800,000 orders",
    writes: [{ object: OBJECTS.order, props: ["hs_order_name", "order_shipment_date", "order_order_status"] }],
    fix: ["A title not starting with the A-number loses its company part"],
  },
  {
    key: "company_stats", name: "Order facts on the company", group: "company", phase: "preview",
    what: "Each company's first and last order, last shipment, number of orders and average days between orders - recomputed from all its orders.",
    when: "After the title step",
    reads: "Orders changed since the last run, their companies, and those companies' orders · the pre-2020 baseline",
    writes: [{ object: OBJECTS.company, props: ["order_first_order_date", "order_last_order_date", "order_last_shipment_date", "order_total_orders", "order_avg_days_between_orders"] }],
  },
  {
    key: "contact_shipment", name: "Last shipment date on the contact", group: "company", phase: "preview",
    what: "The latest shipment date of the orders each contact is linked to - only ever moved later.",
    when: "After the company facts",
    reads: "Orders shipped per month since the watermark · their contacts",
    writes: [{ object: OBJECTS.contact, props: ["last_shipment_date (the property is created if missing)"] }],
    fix: ["A month with more than 10,000 shipments would stop the run (search cap)"],
  },
  {
    key: "deputy_sweep", name: "Holiday redirection", group: "tickets", phase: "preview",
    what: "An ESO ticket whose owner is out of office goes to the first deputy who is in, with a note on the ticket. Campaign tickets stay.",
    when: "Every 15 minutes (DEPUTY_SWEEP=1), beside the chain",
    reads: "ESO tickets in New, Redirected and Customer replied · owners' out-of-office and deputies",
    writes: [{ object: OBJECTS.ticket, props: ["hubspot_owner_id", "hs_pipeline_stage (Customer replied → New)", "note (\"DEPUTY REASSIGNMENT\", on the ticket)"] }],
    fix: ["Out of office with no hours window moves every ticket in those stages, not only the new ones"],
  },
  {
    key: "ticket_assoc", name: "Ticket ↔ order and article links", group: "tickets", phase: "preview",
    what: "Finds order and article numbers in a ticket's text and emails and links them; flags cut-to-size tickets. The live path is a HubSpot workflow action - this one only runs by hand.",
    when: "By hand (and a webhook that may no longer be used - to check in the portal)",
    reads: "Ticket text and up to 5 emails · orders and articles by number",
    writes: [{ object: OBJECTS.ticket, props: ["order_number", "articles_on_the_ticket (when empty)", "c2s_ticket"] }],
    associations: ["Ticket → Order (default)", "Ticket → Products & Pricing 154 \"Referenced article\""],
  },
];

/** Already moved, for the overview - each runs and is shown in its own hub page. */
export const IN_HUB: { name: string; href: string; note: string }[] = [
  { name: "Erosion tickets", href: "/uc/erosion", note: "since 05.10" },
  { name: "Smart Segmentation", href: "/uc/segmentation", note: "since 05.10" },
  { name: "Articles CY/LY", href: "/uc/articles", note: "since 05.10" },
  { name: "Price-check tickets", href: "/uc/price-checks", note: "created by the hub" },
  { name: "DoC declarations", href: "/uc/doc", note: "emailed by the hub" },
  { name: "One-shot boards", href: "/uc/sept-push", note: "September, Marc and Nancy push" },
];

export const ASSOCIATIONS: { from: string; to: string; type: string; by: string }[] = [
  { from: "Order", to: "Company", type: "509 (HubSpot-defined)", by: "New ERP orders" },
  { from: "Order", to: "Contact", type: "default", by: "Web orders get their A-number · New ERP orders (copied to deliveries)" },
  { from: "Contact", to: "Company", type: "279 + Primary 1 (old links deleted first)", by: "Web orders get their A-number" },
  { from: "Ticket", to: "Order", type: "default", by: "Ticket ↔ order and article links · Erosion (hub)" },
  { from: "Ticket", to: "Products & Pricing", type: "154 \"Referenced article\"", by: "Ticket ↔ order and article links" },
  { from: "Ticket", to: "Products & Pricing", type: "152 \"Erosion article\"", by: "Erosion (hub)" },
  { from: "Order", to: "Products & Pricing", type: "119 (user-defined)", by: "Only the old PC scripts - nothing in the connector keeps it up" },
  { from: "Products & Pricing", to: "Company", type: "114 \"companies who bought this article\"", by: "Only the old PC scripts - nothing in the connector keeps it up" },
];

/** The HubSpot object type behind each object, for reading the properties' own labels. */
export const OBJECT_TYPE: Record<string, string> = {
  [OBJECTS.company]: "companies",
  [OBJECTS.contact]: "contacts",
  [OBJECTS.order]: "orders",
  [OBJECTS.ticket]: "tickets",
  [OBJECTS.pp]: "2-200042439",
};

/**
 * Plain names for what HubSpot cannot label: the name patterns (one line stands for
 * many properties), the KPI series (records of the KPI object, not properties), and
 * the note on a ticket.
 */
export const PROP_LABEL: Record<string, string> = {
  "rev_<year>_<jan … dec>": "Revenue per month",
  "rev_<year>_<month>_pc_<at|dt|ft|kt|st|other>": "Revenue per month and profit centre",
  "rev_<year>_q1 … q4": "Revenue per quarter",
  "rev_<year>_pc_monthly": "Monthly revenue by profit centre, one field per year",
  "revenue_<year>": "Revenue per year",
  "oi_<year>_<month>, oi_<year>": "Order intake per month and per year",
  "erp_rev_{mtd,ytd}_{cy,py,delta,delta_pct}": "ERP revenue: month and year to date, against last year",
  "erp_oi_{mtd,ytd}_{cy,py,delta,delta_pct}": "ERP order intake: month and year to date, against last year",
  "erp_rev_rank_{ytd,growth,decline}": "Rank by revenue, by growth and by decline",
  "order_line_01…80_{article,qty,revenue,pc,gm}": "Order lines 1-80: article, quantity, revenue, profit centre, margin",
  "erosion_*": "The erosion fields: customer, article, last order …",
  note: "A note on the ticket (not a property)",
  revenue_monthly: "Series: revenue by month",
  oi_monthly: "Series: order intake by month",
  revenue_geo_monthly: "Series: revenue by country by month",
  revenue_delta_monthly: "Series: revenue against last year, by month",
  revenue_delta_country: "Series: revenue against last year, by country",
  forecast_monthly: "Series: forecast by month",
  oi_erp_monthly: "Series: order intake by month (ERP workbook)",
  revenue_pc_monthly: "Series: revenue by profit centre by month",
  revenue_geo_erp_monthly: "Series: revenue by country by month (ERP workbook)",
  oi_geo_monthly: "Series: order intake by country by month",
  revenue_prio_monthly: "Series: revenue by sales priority by month",
  oi_prio_monthly: "Series: order intake by sales priority by month",
  revenue_year: "Series: revenue by year",
  revenue_pc_year: "Series: revenue by profit centre by year",
  revenue_geo_pc_yearly: "Series: revenue by country and profit centre by year",
  newcust_revenue_monthly: "Series: revenue from new customers by month",
  newcust_monthly: "Series: new customers by month",
  reactivated_monthly: "Series: reactivated customers by month",
};

/** "hs_pipeline_stage (→ Entered)" -> name and note; the name is what HubSpot calls it. */
export function splitProp(raw: string): { name: string; note: string } {
  const cut = [raw.indexOf(" ("), raw.indexOf(" - ")].filter((i) => i > 0);
  if (!cut.length) return { name: raw, note: "" };
  const i = Math.min(...cut);
  let note = raw.slice(i).trim().replace(/^- /, "");
  if (note.startsWith("(") && note.endsWith(")")) note = note.slice(1, -1);
  return { name: raw.slice(0, i), note };
}

export type PropRow = { object: string; name: string; by: { step: Step; note: string }[] };

/** One row per object and property, with every step that writes it - "What it writes". */
export function writesByProperty(): PropRow[] {
  const rows = new Map<string, PropRow>();
  for (const step of STEPS) {
    for (const w of step.writes) {
      for (const raw of w.props) {
        const { name, note } = splitProp(raw);
        const k = `${w.object}|${name}`;
        const row = rows.get(k) ?? { object: w.object, name, by: [] };
        if (!row.by.some((b) => b.step.key === step.key)) row.by.push({ step, note });
        rows.set(k, row);
      }
    }
  }
  return [...rows.values()];
}

/** The plain name of a step, for notices - the registry's keys are the connector's. */
export function stepName(key: string): string {
  if (key === "articles_create_missing") return "Create the missing articles";
  return STEPS.find((s) => s.key === key)?.name ?? key.replace(/_/g, " ");
}

/**
 * How far the move is (`live` = steps switched on in the hub): run by the hub, ready
 * in the hub while the connector still runs them, and on the connector alone.
 */
export function progress(live: Set<string> = new Set()): { hub: number; ready: number; connector: number; total: number } {
  const hub = STEPS.filter((s) => s.phase === "hub" || live.has(s.key)).length;
  const ready = STEPS.filter((s) => s.phase === "preview" && !live.has(s.key)).length;
  return { hub, ready, connector: STEPS.length - hub - ready, total: STEPS.length };
}

/** A step's phase now: the code's own, or "hub" once it is switched on there. */
export function phaseOf(step: Step, live: Set<string>): Phase {
  return live.has(step.key) ? "hub" : step.phase;
}
