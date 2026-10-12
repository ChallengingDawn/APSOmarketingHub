// THE LIFECYCLE USE CASES - one table of what each UC is, which HubSpot
// workflows act for it and which stages it moves (SARCLA, 13.10.2026).
//
// Reporting only: the UCs run as HubSpot workflows, the hub never sends and
// never writes. A workflow is found by the name HubSpot stamps on what it
// creates (hs_object_source_detail_1 on a ticket or task), so when a workflow
// is cloned to a new version (UC2 2504 -> 2609) the new name goes in HERE and
// nowhere else. Emails are found by their name pattern in the contacts'
// "last marketing email" history: <LANG>[_<CC>]_UC<n>[_v2]_<kind>_<k>_<yymm>.
//
// Pure: no database, no HubSpot - tests/lifecycle.test.ts reads it.

export const PORTAL = "26492587";

/** The first day every lifecycle read goes back to. */
export const HORIZON = "2025-01-01";

/** Every stage jumps at once in this month - shown, and marked, never removed (SARCLA 13.10). */
export const FEB_RESTAGE = "2026-02";

/** The company lifecycle stages (pipeline companies-lifecycle-pipeline), in the portal's order. */
export const STAGE = {
  chat: "878465262",
  subscriber: "subscriber",
  mql: "lead",
  sql: "901300437",
  lostLead: "878465265",
  newCustomer: "878465266",
  newCustomerLost: "878465467",
  grow: "878452935",
  loyalty: "878452936",
  churn: "878452944",
  notReactivated: "919493864",
  reactivated: "919493865",
} as const;

export const STAGES: { id: string; label: string }[] = [
  { id: STAGE.chat, label: "Chat potential lead" },
  { id: STAGE.subscriber, label: "Newsletter subscriber" },
  { id: STAGE.mql, label: "MQL" },
  { id: STAGE.sql, label: "SQL" },
  { id: STAGE.lostLead, label: "Lost lead" },
  { id: STAGE.newCustomer, label: "New customer" },
  { id: STAGE.newCustomerLost, label: "New customer lost" },
  { id: STAGE.grow, label: "Grow / Nurture" },
  { id: STAGE.loyalty, label: "Loyalty / Retain" },
  { id: STAGE.churn, label: "Churn / Reactivate" },
  { id: STAGE.notReactivated, label: "Not reactivated" },
  { id: STAGE.reactivated, label: "Reactivated" },
];

/** A company in one of these has bought from us at least once. */
export const CUSTOMER_STAGES: readonly string[] = [
  STAGE.newCustomer, STAGE.newCustomerLost, STAGE.grow, STAGE.loyalty, STAGE.churn, STAGE.notReactivated, STAGE.reactivated,
];

export function stageLabel(id: string | null | undefined): string {
  if (!id) return "No stage";
  return STAGES.find((s) => s.id === id)?.label ?? id;
}

/** The ticket pipelines the UC tickets land in. Stage labels and open/closed are read live. */
export const PIPELINE = { eso: "1726599376", tsa: "1726599377" } as const;

export type UcKey = "uc2" | "uc15" | "uc6" | "uc9" | "uc10" | "uc13" | "uc4" | "uc12";
export type ViewKey = UcKey | "overview";

export type Uc = {
  key: UcKey;
  /** As people say it: "UC10+11". */
  code: string;
  title: string;
  href: string;
  /** One plain line: what the UC does. */
  does: string;
  /** One plain line: what "converted" means on its page. */
  converted: string;
  /** Workflows whose TICKETS belong to the UC, newest version first. */
  tickets: { name: string; era?: string }[];
  /** Workflows whose TASKS belong to the UC. */
  tasks: { name: string; era?: string }[];
  /** The UC numbers in its email names (UC10+11 has two). */
  emailUcs: string[];
  /** Email steps the flow is built to send - a step never seen is a finding. */
  expectedSteps?: string[];
  /** What the mapping found, said where it belongs. */
  findings: string[];
};

export const UCS: Uc[] = [
  {
    key: "uc2", code: "UC2", title: "Welcome", href: "/uc/lifecycle/welcome",
    does: "New registrants get a welcome discount; ESO qualifies the company (a task until 1 October 2026, a ticket since).",
    converted: "Converted = the company's first real order within 90 days of becoming an MQL.",
    tickets: [{ name: "UC2_v2_New_Leads_Tickets_2609", era: "Tickets" }],
    tasks: [
      { name: "UC2_v2_New_Leads_Notifications_2504", era: "Tasks" },
      { name: "UC2_v2_New_Leads_2504", era: "Tasks" },
      { name: "FRANCE_UC2_v2_New_Leads_2504", era: "Tasks" },
      { name: "UC2_Welcome_New_Registrants_Notification_2402", era: "Tasks" },
    ],
    emailUcs: ["2"],
    findings: ["UC2 moved from tasks to tickets on 1-2 October 2026 - both eras are counted, side by side."],
  },
  {
    key: "uc15", code: "UC15", title: "Lost Leads", href: "/uc/lifecycle/lost-leads",
    does: "Lost leads get a series of emails and an ESO ticket, pushing for a first purchase.",
    converted: "Converted = a first real order on or after the day the company entered the flow.",
    tickets: [{ name: "UC15_Lost_Leads_TICKETS_2607_FEHDIA" }],
    tasks: [],
    emailUcs: ["15"],
    expectedSteps: ["Email 1", "Email 2", "Email 3", "Email 4", "Email 5"],
    findings: [],
  },
  {
    key: "uc6", code: "UC6", title: "Thank You", href: "/uc/lifecycle/thank-you",
    does: "First purchasers are thanked and asked how it went; a poor rating opens a ticket.",
    converted: "Converted = another order after the poor-rating ticket was raised.",
    tickets: [{ name: "UC6_v2_FIRST_PURCHASE_NPS_TICKETS_2604" }],
    tasks: [],
    emailUcs: ["6"],
    findings: [],
  },
  {
    key: "uc9", code: "UC9", title: "Second Purchase", href: "/uc/lifecycle/second-purchase",
    does: "New customers get emails and an ESO ticket, pushing for a second order.",
    converted: "Converted = a second real order within 9 months of the first.",
    tickets: [{ name: "UC9_v2_Drive_Second_Purchase_TICKETS_2605_FEHDIA" }],
    tasks: [],
    emailUcs: ["9"],
    findings: [],
  },
  {
    key: "uc10", code: "UC10+11", title: "Repeat Purchase", href: "/uc/lifecycle/repeat-purchase",
    does: "Repeat buyers in Grow / Nurture are reminded to reorder; at 12 orders they move to Loyalty / Retain.",
    converted: "Converted = promoted to Loyalty / Retain (the workflow's own rule: 12 orders or more).",
    tickets: [],
    tasks: [
      { name: "UC_10_Retention_2023_1_2-3_2404", era: "UC10" },
      { name: "UC_10_Retention_2023_1_4-5_2404", era: "UC10" },
      { name: "UC_10_Retention_2023_1_6-9_2404", era: "UC10" },
      { name: "UC_10_Retention_2023_1_10plus_2404", era: "UC10" },
      { name: "UC_11_Retention_2022_1_4-6_2405", era: "UC11" },
      { name: "UC_11_Retention_2022_2_7-11_2405", era: "UC11" },
      { name: "UC_11_Retention_2022_3_12-18_2405", era: "UC11" },
      { name: "UC_11_Retention_2022_3_19plus_2405", era: "UC11" },
    ],
    emailUcs: ["10", "11"],
    findings: [],
  },
  {
    key: "uc13", code: "UC13", title: "Reactivation", href: "/uc/lifecycle/reactivation",
    does: "Customers in Churn / Reactivate get a discount code by email; no reaction opens an ESO task.",
    converted: "Converted = moved from Churn / Reactivate to Reactivated (the stage, i.e. the workflow's own rule).",
    tickets: [],
    tasks: [
      { name: "UC13_v2_Reactivation_2503", era: "Follow-up" },
      { name: "Austria_TSA_UC13_v2_Outreach_2503", era: "Country outreach" },
      { name: "Austria_MANTAM_UC13_v2_Outreach_2503", era: "Country outreach" },
      { name: "Netherlands_Nigel_UC13_v2_Outreach_2503", era: "Country outreach" },
      { name: "Poland_Paulina_UC13_v2_Outreach_2503", era: "Country outreach" },
      { name: "Switzerland_Saraiva_UC13_v2_Outreach_2503", era: "Country outreach" },
    ],
    emailUcs: ["13"],
    findings: [],
  },
  {
    key: "uc4", code: "UC4", title: "Abandoned Cart", href: "/uc/lifecycle/abandoned-cart",
    does: "A cart left in the shop gets an email; a cart over 500 EUR also opens an ESO ticket.",
    converted: "Converted = a web-shop order by the company within 30 days of the cart (or of the ticket).",
    tickets: [
      { name: "FEHDIA |Abandoned Cart +500EUR|2511", era: "Since Nov 2025" },
      { name: "SARCLA | 🛒💶 BASKET +500EUR 🛒💶", era: "Oct 2025" },
    ],
    tasks: [],
    emailUcs: ["4"],
    findings: [],
  },
  {
    key: "uc12", code: "UC12", title: "Revenue Drop", href: "/uc/lifecycle/revenue-drop",
    does: "High- and medium-value customers whose revenue drops are flagged to their owner as a task. Being rebuilt (H2 2026).",
    converted: "Converted = revenue in the 3 months after the flag at or above the same 3 months a year earlier.",
    tickets: [],
    tasks: [
      { name: "UC12_v2_Revenue Drop_High_Value", era: "High value" },
      { name: "UC12_v2_Revenue Drop_Medium_Value", era: "Medium value" },
      { name: "UC12_Revenue Drop_Batch_1", era: "First version" },
      { name: "UC12_Revenue Drop_Batch_2", era: "First version" },
      { name: "UC12_Revenue Drop_Batch_3", era: "First version" },
      { name: "UC12_Revenue Drop_Batch_4", era: "First version" },
    ],
    emailUcs: ["12"],
    findings: ["UC12 sends no email - the flag is a task for the company's owner."],
  },
];

export const VIEW_KEYS: ViewKey[] = ["overview", ...UCS.map((u) => u.key)];
export const isViewKey = (k: string): k is ViewKey => (VIEW_KEYS as string[]).includes(k);
export const ucOf = (k: UcKey): Uc => UCS.find((u) => u.key === k)!;

/** Which page an email's UC number belongs to. */
export function ucForEmailNumber(n: string): UcKey | null {
  return UCS.find((u) => u.emailUcs.includes(n))?.key ?? null;
}

/** The overview's findings box, the same facts the pages carry, in one place. */
export const OVERVIEW_FINDINGS: { text: string; href: string }[] = [
  { text: "UC10+11: the \"No repeated purchase\" tasks stopped on 18 November 2025 - none since.", href: "/uc/lifecycle/repeat-purchase" },
  { text: "UC13: the \"did not react to the discount code\" tasks stopped on 27 April 2026 - none since.", href: "/uc/lifecycle/reactivation" },
  { text: "UC6: the v2 thank-you / rating email has never been seen in any contact's email history.", href: "/uc/lifecycle/thank-you" },
  { text: "UC15: email 5 of the flow has never been seen in any contact's email history.", href: "/uc/lifecycle/lost-leads" },
  { text: "February 2026: every stage jumps at once - a mass re-stage, not the normal flow. It is shown, and marked, on every chart.", href: "/uc/lifecycle" },
];

/** UC15 back-filled every existing lost lead when it started: that month is shown apart. */
export const UC15_BACKFILL_MONTH = "2026-07";

/** UC2: the first order counts when it comes within this many days of becoming an MQL. */
export const UC2_DAYS = 90;
/** UC9: the second order counts when it comes within this many months of the first. */
export const UC9_MONTHS = 9;
/** UC4: a web order counts when it comes within this many days of the cart or ticket. */
export const UC4_DAYS = 30;
/** UC12: months compared after the flag, against the same months a year earlier. */
export const UC12_MONTHS = 3;
