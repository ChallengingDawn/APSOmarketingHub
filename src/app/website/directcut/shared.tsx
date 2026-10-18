"use client";

// DirectCut's page: the pieces its tabs share. Same kit as DirectUP, 3D files and DoC.
//
// The words are the ones SARCLA settled on for the Railway dashboard's workshop board (15.10.2026), carried
// over deliberately: the same line must not be called two different things in two places.
//   "Needs the saw" / "Pick & ship" / "Not recorded"      — what the workshop has to do with it
//   "Still to cut" / "Cut done"                            — where it is

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { FAINT, INK, MUTED } from "@/app/uc/report/ui";
import type { Line } from "@/lib/directcut/gateway";

export type { Board, Line, StockRow, Status, Registry, RegistryRow, Holds, Hold } from "@/lib/directcut/gateway";
export type { Broken, BrokenOrder, BrokenLine } from "@/lib/directcut/tickets";
import type { Broken } from "@/lib/directcut/tickets";
/** the shortages, with each order's existing ticket id - so the page can say so without a rehearsal */
export type BrokenWithTickets = Broken & { ticketed?: Record<string, string> };

/** "16.10.2026 07:12" in local time. */
export function when(iso: string | null | undefined, seconds = false): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}${seconds ? `:${p(d.getSeconds())}` : ""}`;
}

/** The date a customer was given is a day, not a moment. */
export function day(iso: string | null | undefined): string {
  if (!iso) return "–";
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split("-");
  return y && m && d ? `${d}.${m}.${y}` : s;
}

export type Work = "saw" | "pick" | "unknown";

/* WHAT THE WORKSHOP HAS TO DO WITH A LINE. `kind` is the widget's own word and only exists for lines the
   widget booked ("wholePiece" at reserve time); `sawNeeded` is computed from the shelf and exists for every
   line that has a basis and a size. So kind wins where we have it, sawNeeded answers the rest, and anything
   with neither says so rather than guessing — the dashboard's needsSaw(), same order. */
export function workOf(l: Line): Work {
  if (l.kind === "leftover" || l.kind === "wholePiece") return "pick";
  if (l.kind === "cut" || l.kind === "plate") return "saw";
  if (l.sawNeeded === true) return "saw";
  if (l.sawNeeded === false) return "pick";
  return "unknown";
}

export const WORK_LABEL: Record<Work, string> = { saw: "Needs the saw", pick: "Pick & ship", unknown: "Not recorded" };
export const WORK_TONE: Record<Work, { bg: string; fg: string }> = {
  saw: { bg: "#e8f0f6", fg: "#274e64" },
  pick: { bg: "#e9f4ed", fg: "#1e7e45" },
  unknown: { bg: "#f4f1e8", fg: "#8a6d1f" },
};

/* "NOT RECORDED" WAS ONE LABEL DOING TWO JOBS (18.10.2026).
   A line we cannot place is either OUR data gap — nothing on the line — or a material the saw shop has
   never had on its books, which is a final answer and not a fault. Of the 14 lines left in that column
   after the empty-shelf rule, 13 were Elastomerplatte 1-6 mm, PTFE film five hundredths of a millimetre
   thick and PTFE-coated glass fabric thirty metres long: soft goods no panel saw would touch, cut by
   other means. The 14th was PEEK 40 mm, which IS saw material and which HOMAG does not list — a real gap
   that was hidden among the rubber.

   The COLUMNS do not change: SARCLA asked for three and a fourth was already removed once. Only the pill
   on the card, so the same column reads as an answer where it is one. `sawWhy` comes from the middleware
   (cut-ledger.sawWhyFor) and is absent on an older gateway, which falls back to the plain label. */
export function workLabelOf(l: Line): string {
  if (workOf(l) !== "unknown") return WORK_LABEL[workOf(l)];
  if (l.sawWhy === "not-a-saw-material") return "Not on the saw's books";
  if (l.sawWhy === "no-basis") return "No article on the line";
  if (l.sawWhy === "no-size") return "No size on the line";
  return WORK_LABEL.unknown;
}

/** true where the column is a final answer rather than something to go and fix */
export const isOffSaw = (l: Line) => workOf(l) === "unknown" && l.sawWhy === "not-a-saw-material";

export const STAGE_LABEL: Record<string, string> = {
  reserved: "In a cart",
  lapsed: "Cart expired",
  ordered: "Ordered",
  "to-cut": "Still to cut",
  "cut-done": "Cut done",
  closed: "Closed",
};

/** A small coloured pill — the dashboard's stage/kind chips, in the hub's type scale. */
export function Pill({ text, bg, fg, title }: { text: string; bg: string; fg: string; title?: string }) {
  return (
    <Box
      component="span"
      title={title}
      sx={{ display: "inline-block", px: 0.75, py: 0.125, borderRadius: 1, bgcolor: bg, color: fg,
        fontSize: "0.7rem", fontWeight: 600, whiteSpace: "nowrap", lineHeight: 1.6 }}
    >
      {text}
    </Box>
  );
}

/** The A-number if the ERP has reconciled the order, else the shop's own number, said as such. */
export function OrderRef({ l }: { l: Line }) {
  if (l.erpNo) return <Typography component="span" sx={{ fontSize: "0.84rem", color: INK, whiteSpace: "nowrap" }}>{l.erpNo}</Typography>;
  if (l.orderNo) return (
    <Typography component="span" sx={{ fontSize: "0.84rem", color: MUTED, whiteSpace: "nowrap" }} title="The shop's order number — the ERP has not reconciled it yet, so there is no A-number">
      {l.orderNo}
    </Typography>
  );
  return <Typography component="span" sx={{ fontSize: "0.84rem", color: FAINT }}>–</Typography>;
}

export async function post(body: unknown): Promise<{ ok: boolean; error?: string; data?: unknown }> {
  const r = await fetch("/api/website/directcut", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  return (await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }))) as { ok: boolean; error?: string; data?: unknown };
}
