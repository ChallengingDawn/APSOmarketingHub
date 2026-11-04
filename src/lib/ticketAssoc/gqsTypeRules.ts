// GQS FOLLOW-UPS - the rule (SARCLA 04.11.2026: "migrate this to association tickets as another simple table SARCLA |
// GQS ESO/TSA SETS ASSOCIATION"). The HubSpot workflow (flow 3887968475, on since 06.03.2026): an ESO or TSA ticket
// linked to a ticket of the GQS pipeline gets "Type of sales ticket" = GQS - once, when the link appears or when the
// ticket moves into ESO / TSA; whoever changes it afterwards is left alone. Pure, for the tests.

export const GQS_PIPELINE = "1726786775";
export const SALES_PIPELINES: Record<string, "ESO" | "TSA"> = { "1726599376": "ESO", "1726599377": "TSA" };
export const GQS_TYPE = "GQS";

/** already: it carries GQS; set: the hub writes GQS; would: preview, the hub would; left: it carried GQS here, a person changed it since. */
export type GqsWhat = "already" | "set" | "would" | "left";

/**
 * One ticket linked to a GQS request. `prev` is what the hub remembers of it: the pipeline it last saw it carry GQS
 * in (or set it), with ":would" (preview listed it) or ":left" (a person changed it, listed once). Returns what to
 * list (null: nothing new) and what to remember next - for "set", only once the write went through.
 */
export function planGqs(t: { pipeline: string | null; type: string | null }, prev: string | undefined, live: boolean): { what: GqsWhat | null; next: string | undefined } {
  if (!t.pipeline || !SALES_PIPELINES[t.pipeline]) return { what: null, next: prev };
  const [pipe, flag] = (prev ?? "").split(":");
  const same = pipe === t.pipeline;
  if (t.type === GQS_TYPE) return { what: same ? null : "already", next: t.pipeline };
  // preview listed it and nothing set it since: live writes it now, preview says nothing new
  if (same && flag === "would") return live ? { what: "set", next: t.pipeline } : { what: null, next: prev };
  // it carried GQS in this pipeline: a person changed it - as the workflow, the hub leaves it (listed once)
  if (same) return { what: flag === "left" ? null : "left", next: `${t.pipeline}:left` };
  // a new link, or the ticket moved into ESO / TSA since
  return live ? { what: "set", next: t.pipeline } : { what: "would", next: `${t.pipeline}:would` };
}
