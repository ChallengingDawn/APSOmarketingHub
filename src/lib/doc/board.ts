// Where one web order stands, decided from what HubSpot holds - pure, so it is tested.
//
// A web order can have several records carrying the request (the .000 and its
// deliveries), each with its own status; the most advanced one speaks for the order.

import { CANCELLED, INVOICED } from "./config";

export type Phase =
  | "awaiting-erp" | "awaiting-invoice" | "due" | "sending" | "sent" | "back-office" | "cancelled" | "expired";

export type BoardRow = {
  web: string;
  aNumber: string | null;
  company: string;
  orderedAt: string | null;
  erpStage: string | null;
  phase: Phase;
  status: string;
  sentAt: string | null;
  hubspotIds: string[];
  steps: { ordered: boolean; linked: boolean; invoiced: boolean; emailed: boolean };
};

const ERP_STAGE: Record<string, string> = {
  "5093087452": "Entered", "5093087453": "Being delivered", "5093087454": "Pending", "5093087455": "Provisional",
  "5093092549": "Ready for delivery", "5093092550": "Partial called off", "5093092551": "Ready for invoicing",
  [INVOICED]: "Invoiced", [CANCELLED]: "Cancelled",
};
const STAGE_ORDER = ["5093087455", "5093087452", "5093087454", "5093087453", "5093092549", "5093092550", "5093092551", INVOICED];

const rank = (s: string) =>
  s.startsWith("sent") ? 6 : s.startsWith("sending") ? 5 : s.startsWith("back office") ? 4
    : s.startsWith("cancelled") ? 3 : s.startsWith("expired") ? 2 : 1;

/** The status that speaks for the order: the most advanced of its records. */
export function leadingStatus(statuses: string[]): string {
  return [...statuses].sort((a, b) => rank(b) - rank(a))[0] ?? "waiting";
}

export function phaseOf(p: { statuses: string[]; stages: string[]; base: string | null }): Phase {
  const status = leadingStatus(p.statuses);
  if (status.startsWith("sent")) return "sent";
  if (status.startsWith("sending")) return "sending";
  if (status.startsWith("back office")) return "back-office";
  if (status.startsWith("cancelled")) return "cancelled";
  if (status.startsWith("expired")) return "expired";
  if (p.stages.includes(INVOICED)) return "due"; // goes out with the next sweep
  return p.base ? "awaiting-invoice" : "awaiting-erp";
}

export function boardRow(p: {
  web: string;
  ids: string[];
  statuses: string[];
  stages: string[];
  base: string | null;
  company: string;
  orderedAt: string | null;
}): BoardRow {
  const status = leadingStatus(p.statuses);
  const phase = phaseOf(p);
  const invoiced = p.stages.includes(INVOICED);
  const furthest = [...p.stages].sort((a, b) => STAGE_ORDER.indexOf(b) - STAGE_ORDER.indexOf(a))[0];
  return {
    web: p.web,
    aNumber: p.base,
    company: p.company,
    orderedAt: p.orderedAt,
    erpStage: furthest ? (ERP_STAGE[furthest] ?? furthest) : null,
    phase,
    status,
    sentAt: (/^sent (\S+)/.exec(status) ?? [])[1] ?? null,
    hubspotIds: p.ids,
    steps: {
      ordered: true,
      linked: !!p.base,
      invoiced: invoiced || phase === "sent" || phase === "sending" || phase === "back-office",
      emailed: phase === "sent",
    },
  };
}
