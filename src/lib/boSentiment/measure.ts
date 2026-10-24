// THE FIGURES THE TAB SHOWS - pure, so they can be tested and cannot drift from the page.
//
// SARCLA asked to be able to report on this. The one rule these figures follow: a ticket that is
// not a real customer conversation is counted in the exclusions and NOWHERE ELSE. The old
// workflow's averages included ERP warnings, newsletters and order confirmations, which is a
// large part of why they could not be trusted - half of what it scored was not a customer.

import type { Bucket } from "./detect";
import type { Row } from "./engine";
import { REASON_LABEL, type DisqualifyReason } from "./realTicket";

export type Counts = Record<Bucket, number>;
const empty = (): Counts => ({ positive: 0, neutral: 0, negative: 0, unknown: 0 });

export type Summary = {
  looked: number;
  excluded: number;
  scored: number;
  /** Why tickets were left out, most common first, with the words the page prints. */
  reasons: { reason: DisqualifyReason; label: string; n: number }[];
  tone: Counts;
  resolution: Counts;
  /** Who answered: the free scorer, the model, or nobody. */
  source: { keywords: number; model: number; none: number };
  /** Tickets whose customer asked for speed - reported instead of being called unhappy. */
  urgent: number;
  /** How the answer compares with what the workflow itself wrote on the same tickets. */
  versusWorkflow: { agree: number; differ: number; workflowBlank: number; moves: { from: string; to: string; n: number }[] };
  /** Where the model disagreed with the free scorer - the cases worth reading. */
  modelChanged: { ticketId: string; subject: string; from: Bucket; to: Bucket; why: string }[];
  /** live mode: written, and left alone because the property has no word for the answer. */
  written: number;
  skipped: number;
};

const pctOf = (n: number, d: number) => (d ? Math.round((1000 * n) / d) / 10 : 0);
export const pct = pctOf;

export function summarise(rows: Row[]): Summary {
  const s: Summary = {
    looked: rows.length, excluded: 0, scored: 0, reasons: [],
    tone: empty(), resolution: empty(),
    source: { keywords: 0, model: 0, none: 0 },
    urgent: 0,
    versusWorkflow: { agree: 0, differ: 0, workflowBlank: 0, moves: [] },
    modelChanged: [], written: 0, skipped: 0,
  };
  const reasons = new Map<DisqualifyReason, number>();
  const moves = new Map<string, number>();

  for (const r of rows) {
    if (r.written) s.written += 1;
    if (r.skipped) s.skipped += 1;
    if (!r.real) {
      s.excluded += 1;
      for (const x of r.reasons) reasons.set(x, (reasons.get(x) ?? 0) + 1);
      continue; // counted here and nowhere else
    }
    s.scored += 1;
    s.tone[r.answer.tone] += 1;
    s.resolution[r.answer.resolution] += 1;
    s.source[r.answer.source] += 1;
    if (r.keywords.urgency > 0) s.urgent += 1;

    // against the workflow's own value on the same ticket
    if (!r.workflow.tone) s.versusWorkflow.workflowBlank += 1;
    else if (r.workflow.tone === r.answer.tone) s.versusWorkflow.agree += 1;
    else s.versusWorkflow.differ += 1;
    if (r.workflow.tone) {
      const key = `${r.workflow.tone}>${r.answer.tone}`;
      moves.set(key, (moves.get(key) ?? 0) + 1);
    }

    if (r.ai && r.ai.tone !== r.keywords.tone) {
      s.modelChanged.push({
        ticketId: r.ticketId, subject: r.subject,
        from: r.keywords.tone, to: r.ai.tone, why: r.ai.why,
      });
    }
  }

  s.reasons = [...reasons.entries()]
    .map(([reason, n]) => ({ reason, label: REASON_LABEL[reason] ?? reason, n }))
    .sort((a, b) => b.n - a.n);
  s.versusWorkflow.moves = [...moves.entries()]
    .map(([k, n]) => ({ from: k.split(">")[0], to: k.split(">")[1], n }))
    .sort((a, b) => b.n - a.n);
  s.modelChanged = s.modelChanged.slice(0, 40);
  return s;
}

/**
 * The one-line verdict the tab puts at the top.
 *
 * Deliberately says how much was NOT a customer: it is the number that explains why the old
 * figures looked the way they did, and the first thing anybody reading a sentiment report should
 * know about its denominator.
 */
export function headline(s: Summary): string {
  if (!s.looked) return "Nothing looked at yet.";
  const parts = [
    `${s.scored} of ${s.looked} tickets were a customer talking`,
    `${s.excluded} were not (${pctOf(s.excluded, s.looked)}%)`,
  ];
  if (s.scored) {
    parts.push(`${pctOf(s.tone.negative, s.scored)}% of them sound unhappy`);
    if (s.tone.unknown) parts.push(`${pctOf(s.tone.unknown, s.scored)}% give nothing to go on`);
  }
  return parts.join(", ") + ".";
}
