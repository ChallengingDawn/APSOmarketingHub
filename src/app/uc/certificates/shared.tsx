"use client";

// CERTIFICATES - what the tabs share: the page's data, the phases and stages as people know them, a ticket's link, the
// admins' PUT (src/app/api/uc/certificates).

import Box from "@mui/material/Box";
import { INK, clip, hsTicket, type Tint } from "@/app/uc/report/ui";
import type { BoardRow, OpenTicket, OthersRow, RemindState, Row, RunInfo, Settings, Stats } from "@/lib/certificates/engine";
import type { DateRow } from "@/lib/certificates/erpData";
import type { ShopRow } from "@/lib/certificates/shopIntake";
import type { Phase, StepName, Timing } from "@/lib/certificates/rules";

export type Data = {
  settings: Settings; last: RunInfo | null; rows: Row[]; open: OpenTicket[]; stats: Stats | null;
  names: Record<string, string>; choices: { id: string; name: string }[];
  workflowOn: boolean | null; writing: boolean; offAt: string; admin: boolean;
  remind: (RemindState & { offAt: string | null }) | null; mailReady: boolean;
  others: { offAt: string | null; rows: OthersRow[] };
  board: BoardRow[];
  /** the ERP's delivery dates followed (or listed); the shop's orders with the declaration; ERP orders with a request */
  dates: DateRow[]; shop: ShopRow[]; erpRequests: number;
};

export const PHASE: Record<Phase, { label: string; tint: Tint }> = {
  start: { label: "New request", tint: "slate" },
  avor: { label: "AVOR - new article", tint: "amber" },
  backOffice: { label: "Back Office", tint: "blue" },
  merged: { label: "Back Office (merged)", tint: "blue" },
  expert: { label: "Conformity expert", tint: "purple" },
  sent: { label: "Sent out", tint: "green" },
};
export const STAGE_LABEL: Record<string, string> = {
  "2338266325": "New", "2554860732": "Redirected from Chat/Helpline", "2338266326": "Assigned", "2473210048": "Waiting on Customer",
  "2726922455": "Waiting Internally", "2728031473": "Customer/Internal replied", "5948837104": "CHAT/C2S Issue",
  "2338266327": "Remind Back Office", "3640065212": "Certificates", "2338266328": "Resolved",
};
export const LATE: StepName[] = ["late", "late96", "lateWeek", "lateRose", "bo48", "bo96", "boWeek", "boRose"];
export const isLate = (t: OpenTicket) => !!t.step && LATE.includes(t.step);
export const BO_STEPS: StepName[] = ["bo3days", "boToday", "bo48", "bo96", "boWeek", "boRose"];
/** the steps that mail the owner (when the owners' mails are on) */
export const MAIL_STEPS: StepName[] = BO_STEPS;
export const REMIND_NAME = "Back Office Ticket Remind | Notification";

export const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;
export const span = (h: number) => (h % 24 === 0 ? `${h / 24} day${h === 24 ? "" : "s"}` : `${h} h`);

export function TicketLink({ id, subject, max = 360 }: { id: string; subject: string | null; max?: number }) {
  return (
    <Box component="a" href={hsTicket(id)} target="_blank" rel="noopener" sx={{ color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(max) }}>
      {subject || `Ticket ${id}`}
    </Box>
  );
}

export const dueText = (d: string | null) => (d ? d.split("-").reverse().join(".") : "no date");

/** The admins' changes - mode, people, mails, timing, hold / release. */
export async function put(body: object): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch("/api/uc/certificates", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = (await r.json()) as { ok: boolean; error?: string };
    return j.ok ? { ok: true } : { ok: false, error: j.error ?? `HTTP ${r.status}` };
  } catch (e) { return { ok: false, error: String((e as Error).message) }; }
}

export type { Timing };
