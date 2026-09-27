// THE CUSTOMER JOURNEY, as the business defines it.
//
// Six stages, the steps a buyer takes through them, and for each stage the
// things that carry it: the touchpoints, the ways we lose people, the questions
// the business wants answered, the KPIs it wants in place. The definition
// started life in a spreadsheet; it lives here now, and it is edited here.
//
// The numbers that fill it come from elsewhere (GA4, HubSpot, the shop). This
// file says WHAT the journey is; the integrations say HOW MANY.

export type JourneyStage = {
  id: string;
  name: string;
  /** Order on the board, left to right. */
  position: number;
  description: string | null;
  mindset: string | null;
  objective: string | null;
  /** The HubSpot lifecycle stages this part of the journey corresponds to. */
  lifecycle: string | null;
};

/** The lanes of the board. Each is a list of things, not a paragraph. */
export const ITEM_KINDS = {
  touchpoint: "Critical touchpoints",
  risk: "Where we lose them",
  question: "Questions to answer",
  kpi: "KPIs to put in place",
  idea: "Optimisation ideas",
  channel: "Channels & UX focus",
} as const;

export type JourneyItemKind = keyof typeof ITEM_KINDS;

export type JourneyItem = {
  id: string;
  stageId: string;
  kind: JourneyItemKind;
  text: string;
  /** Where it came from: the workbook, or someone typing it here. */
  origin: "workbook" | "app";
  addedBy?: string;
  addedAt?: string;
  order: number;
  /** Set when someone ticks it off; the item stays, the board shows it done. */
  done?: boolean;
};

export type JourneyStep = {
  index: number;                 // 1..n in the order the buyer takes them
  column: number;
  stageId: string;
  label: string;
};

/** A lifecycle path the business asked to see as a funnel (sheet "KPIsNeeded"). */
export type JourneyFunnel = {
  id: string;
  path: string[];
  note: string;
};

export type JourneySource = {
  /** Where this definition originally came from, for the record. */
  origin: string;
  definedAt: string;
  lastEditedBy?: string;
  lastEditedAt?: string;
};

export type JourneyIssue = {
  severity: "error" | "warning";
  where: string;
  message: string;
};

export type JourneyModel = {
  version: number;
  stages: JourneyStage[];
  steps: JourneyStep[];
  /** The board's cards. Workbook rows become items; people add more here. */
  items: JourneyItem[];
  funnels: JourneyFunnel[];
  source: JourneySource;
  issues: JourneyIssue[];
};

export const slug = (name: string): string =>
  name.toLowerCase().normalize("NFKD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
