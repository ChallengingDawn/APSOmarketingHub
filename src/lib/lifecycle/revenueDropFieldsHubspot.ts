// UC12 REVENUE DROP - the ticket fields in HubSpot: reads what is there and creates what is missing - the "Revenue
// drop" group, its fields and the revenue_drop choice on Tags (the definitions and the plan: revenueDropFields.ts).
// Nothing is ever changed or deleted: a field with the right name and another type is named, not touched. Run from
// the UC12 page by an admin; proof in the log: `[uc12-fields]`.
import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { IntegrationError } from "@/lib/integrations/status";
import { RD_FIELDS, RD_GROUP, RD_TAG, createBody, planFields, type FieldPlan, type HsProp } from "./revenueDropFields";

type Opt = { label?: string; value?: string; displayOrder?: number; hidden?: boolean };

async function readNow(): Promise<{ plan: FieldPlan; tagOptions: Opt[] }> {
  const all = await hubspotFetchJson<{ results?: (HsProp & { options?: Opt[] })[] }>({ path: "/crm/v3/properties/tickets", useTicketsToken: true });
  let groupThere = true;
  try {
    await hubspotFetchJson({ path: `/crm/v3/properties/tickets/groups/${RD_GROUP.name}`, useTicketsToken: true });
  } catch (e) {
    if (!(e instanceof IntegrationError && e.status === 404)) throw e;
    groupThere = false;
  }
  const props = all.results ?? [];
  return { plan: planFields(groupThere, props), tagOptions: props.find((p) => p.name === "tags")?.options ?? [] };
}

/** What HubSpot has and lacks - reads only. */
export async function revenueDropFieldsPlan(): Promise<FieldPlan> {
  return (await readNow()).plan;
}

export type FieldsRun = { before: FieldPlan; group: boolean; created: string[]; tag: boolean };

/** Creates the group, the missing fields and the Tags choice; returns what it sent. */
export async function createRevenueDropFields(): Promise<FieldsRun> {
  const { plan, tagOptions } = await readNow();
  const run: FieldsRun = { before: plan, group: false, created: [], tag: false };
  if (plan.group) {
    await hubspotFetchJson({ path: "/crm/v3/properties/tickets/groups", method: "POST", useTicketsToken: true, body: RD_GROUP });
    run.group = true;
  }
  for (const name of plan.create) {
    const f = RD_FIELDS.find((x) => x.name === name)!;
    await hubspotFetchJson({ path: "/crm/v3/properties/tickets", method: "POST", useTicketsToken: true, body: createBody(f) });
    run.created.push(name);
  }
  if (plan.tag) {
    const options = [...tagOptions.map((o) => ({ label: o.label ?? o.value, value: o.value, displayOrder: o.displayOrder ?? -1, hidden: !!o.hidden })),
      { label: RD_TAG.label, value: RD_TAG.value, displayOrder: -1, hidden: false }];
    await hubspotFetchJson({ path: "/crm/v3/properties/tickets/tags", method: "PATCH", useTicketsToken: true, body: { options } });
    run.tag = true;
  }
  console.log(`[uc12-fields] group ${run.group ? "created" : "there"} · fields created ${run.created.length ? run.created.join(", ") : "none"} · Tags choice ${run.tag ? "added" : "there"}${plan.clash.length ? ` · left alone (other type): ${plan.clash.map((c) => c.name).join(", ")}` : ""}`);
  return run;
}
