// BACK OFFICE DISTRIBUTION > Available or Away - the rule, pure (the engine in engine.ts). Replaces the HubSpot workflow
// "SARCLA | DISPLAY AVAILABITY BO" (3712821446, app SARCLA | AUTOMATIC DISTRIBUITION BO, secret DISTRIBUTION),
// SARCLA 12.11.2026: "let's start with DISPLAY AVAILABITY BO".
//
// The workflow read each Back Office person's HubSpot status (the chat dot: available / away) and wrote it as
// "Available" / "Away" into six ticket properties - one per person - on the ticket that enrolled, then copied them onto
// every open Back Office and GQS ticket, so a ticket shows who is there. No workflow and no card reads them: they are
// for the people looking at the tickets. The hub writes the same six values on the same open tickets, with two faults
// fixed: the workflow read only the first 100 HubSpot users (Vanessa Battaglia is not among them, so her status was
// never written), and it looked for a GQS stage "Article number requested" that no longer exists.

export const WORKFLOW_ID = "3712821446";

/** The six people and their ticket property, as the workflow had them. */
export const PEOPLE: { owner: string; name: string; prop: string }[] = [
  { owner: "76134337", name: "Claudia Cagnoni", prop: "claudia_cagnoni" },
  { owner: "1229976030", name: "Claudio Gabinato", prop: "claudio_gabinato_status" },
  { owner: "1207485931", name: "Maida Osmani", prop: "maida_osmani_status" },
  { owner: "76134388", name: "Vanessa Battaglia", prop: "vanessa_battaglia_status" },
  { owner: "76134415", name: "Adriana Deblander", prop: "adriana_deblander_status" },
  { owner: "30050251", name: "Sara Gashi", prop: "sara_gashi" },
];
export const PROPS = PEOPLE.map((p) => p.prop);

/** The open stages the workflow copied onto (by their labels, read 12.11.2026). */
export const BO_STAGES: Record<string, string> = {
  "2338266326": "Assigned", "2473210048": "Waiting on Customer", "2726922455": "Waiting Internally",
  "2728031473": "Customer/Internal replied", "2338266327": "Remind Back Office",
};
export const GQS_STAGES: Record<string, string> = {
  "4704538856": "Waiting on GQS", "6078992599": "Waiting on APSO", "2964068584": "Remind Back-Office",
};
export const STAGES = [...Object.keys(BO_STAGES), ...Object.keys(GQS_STAGES)];

export type Status = "Available" | "Away";

/** HubSpot's status -> the dropdown's value, as the workflow: nothing or "unknown" counts as there. */
export function statusOf(availability: string | null | undefined): Status {
  const a = String(availability ?? "").trim().toLowerCase();
  if (!a || a === "unknown") return "Available";
  return a === "available" ? "Available" : "Away";
}

/** What one ticket needs written so its six values are today's (nothing when they already are). */
export function changesFor(current: Record<string, string | null | undefined>, statuses: Record<string, Status>): Record<string, Status> {
  const out: Record<string, Status> = {};
  for (const [prop, want] of Object.entries(statuses)) if ((current[prop] ?? "") !== want) out[prop] = want;
  return out;
}
