// THE CUSTOMER JOURNEY, as the business defines it.
//
// The definition lives in a workbook that Alexandre maintains
// ("Customer Journey APSOparts-260923.xlsx"): five stages, fifteen concrete
// steps a buyer takes, and for each stage the objective, the touchpoints, the
// drop-off risks, the questions the business wants answered and the KPIs it
// wants in place. This file is the shape that workbook becomes once it is in
// the application, and nothing else in the app may invent a stage or a step.
//
// The numbers that fill it come from elsewhere (GA4, HubSpot, the shop). The
// workbook says WHAT to measure; the integrations say HOW MUCH.

/** One row of the workbook, keyed by the label in its first column. */
export const JOURNEY_ROWS = {
  description: "Description",
  mindset: "Buyer Mindset",
  action: "Buyer Action",
  behaviour: "Buyer Behaviour",
  objective: "APSOparts Objective",
  steps: "Journey with APSOparts",
  lifecycle: "Life cycles Hubspot",
  upcoming: "Additional/Update UC to come",
  questions: "Questions to answer",
  touchpoints: "Critical Touchpoints",
  risks: "Typical Drop-off Risks",
  ideas: "Optimization Ideas",
  channels: "Key Channels / UX Focus",
  kpis: "KPIs to put in place",
} as const;

export type JourneyRowKey = keyof typeof JOURNEY_ROWS;

export type JourneyStage = {
  id: string;                    // slug of the name, stable across imports
  name: string;
  /** First workbook column of the stage, and how many it spans. */
  column: number;
  span: number;
  description: string | null;
  mindset: string | null;
  action: string | null;
  behaviour: string | null;
  objective: string | null;
  lifecycle: string | null;
  upcoming: string | null;
  questions: string | null;
  touchpoints: string | null;
  risks: string | null;
  ideas: string | null;
  channels: string | null;
  kpis: string | null;
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
  fileName: string;
  sheet: string;
  importedAt: string;
  importedBy: string;
  /** Which row of the sheet each field came from, so the mapping is visible in the app. */
  rowMap: { field: JourneyRowKey; label: string; row: number }[];
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
  funnels: JourneyFunnel[];
  source: JourneySource;
  issues: JourneyIssue[];
};

export const slug = (name: string): string =>
  name.toLowerCase().normalize("NFKD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

/** What an import would change, shown before anything is written. */
export type ImportPreview = {
  ok: boolean;
  model: JourneyModel;
  counts: {
    stagesCreated: number;
    stagesUpdated: number;
    stagesUnchanged: number;
    stagesRemoved: number;
    stepsCreated: number;
    stepsUpdated: number;
    stepsUnchanged: number;
    stepsRemoved: number;
    funnels: number;
  };
  /** Field-level changes, so a reviewer sees exactly what moves. */
  changes: { stage: string; field: string; before: string | null; after: string | null }[];
  issues: JourneyIssue[];
};

/** The stage fields compared on import. "steps" is not one: steps are their own rows. */
const FIELDS = ["description", "mindset", "action", "behaviour", "objective", "lifecycle", "upcoming", "questions", "touchpoints", "risks", "ideas", "channels", "kpis"] as const satisfies readonly (keyof JourneyStage & JourneyRowKey)[];

/** Compare an incoming model with what is stored, without touching either. */
export function previewImport(next: JourneyModel, current: JourneyModel | null): ImportPreview {
  const counts = {
    stagesCreated: 0, stagesUpdated: 0, stagesUnchanged: 0, stagesRemoved: 0,
    stepsCreated: 0, stepsUpdated: 0, stepsUnchanged: 0, stepsRemoved: 0,
    funnels: next.funnels.length,
  };
  const changes: ImportPreview["changes"] = [];
  const before = new Map((current?.stages ?? []).map((s) => [s.id, s]));

  for (const stage of next.stages) {
    const old = before.get(stage.id);
    if (!old) { counts.stagesCreated++; continue; }
    let moved = false;
    for (const field of FIELDS) {
      const a = old[field] ?? null;
      const b = stage[field] ?? null;
      if (a !== b) {
        moved = true;
        changes.push({ stage: stage.name, field: JOURNEY_ROWS[field], before: a, after: b });
      }
    }
    if (moved) counts.stagesUpdated++;
    else counts.stagesUnchanged++;
  }
  counts.stagesRemoved = (current?.stages ?? []).filter((s) => !next.stages.some((n) => n.id === s.id)).length;

  const oldSteps = new Map((current?.steps ?? []).map((s) => [s.index, s]));
  for (const step of next.steps) {
    const old = oldSteps.get(step.index);
    if (!old) counts.stepsCreated++;
    else if (old.label !== step.label || old.stageId !== step.stageId) {
      counts.stepsUpdated++;
      changes.push({ stage: step.stageId, field: `Step ${step.index}`, before: old.label, after: step.label });
    } else counts.stepsUnchanged++;
  }
  counts.stepsRemoved = (current?.steps ?? []).filter((s) => !next.steps.some((n) => n.index === s.index)).length;

  return { ok: !next.issues.some((i) => i.severity === "error"), model: next, counts, changes, issues: next.issues };
}
