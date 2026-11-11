// THE REVENUE DROP CARD'S FIGURES - worked out inside HubSpot, from the ticket's own Revenue drop fields and its
// company's monthly fields, so the card needs nothing from APSOhub (Diana 11.11.2026: "populate all those properties
// and take all info from hubspot so we dont need to grab it from apsohub"). The ticket's fields are the day it was
// written; the company's rev_<y>_pc_monthly and oi_<y>_<month> are refreshed every night and give today, to the last
// month before "ERP figures as of" (erp_rev_as_of).
// No imports: the card is built in the hub's HubSpot project, which cannot reach the hub's code. It mirrors UC12's
// rules in src/lib/lifecycle/revenueDrop.ts; tests/revenue-drop-card-figures.test.ts checks that they agree.

export type Month = string;
export type Props = Record<string, string | null | undefined>;
export type Step = 1 | 2;

const MON = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MON_LABEL = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Step 2: 30% or more below the 12 months before. */
export const DROP_LINE = 0.3;
/** How many months the card's chart shows, to today's end. */
export const CARD_MONTHS = 24;
/** How many years before this one the card reads: the 12 months before a ticket written a year ago, and its chart. */
export const YEARS_BACK = 3;

const PC_NAME: Record<string, string> = {
  dt: "Sealing Technology", kt: "Engineering Plastics", ft: "Fluid Technology", st: "Antivibration Technology",
  at: "Drive Technology", sp: "Sensors & Power", pw: "Sensors & Power", other: "Other", unknown: "Unknown",
};
export const pcLabel = (code: string) => `${PC_NAME[code] ?? code.toUpperCase()} (${code.toUpperCase()})`;

export const shift = (m: Month, k: number): Month => {
  const i = Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1 + k;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
};
export const monthName = (m: Month) => `${MON_LABEL[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
export const spanName = (from: Month, to: Month) => `${monthName(from)} - ${monthName(to)}`;
const cents = (n: number) => Math.round(n * 100) / 100;
const num = (v: string | null | undefined) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

/** The ticket's fields the card reads (UC12 writes them, revenueDropFields.ts). */
export const TICKET_PROPS = [
  "revenue_drop_key", "revenue_drop_step", "revenue_drop_amount_at_risk", "revenue_drop_change_pct",
  "revenue_drop_last_12", "revenue_drop_prev_12", "revenue_drop_window",
];

/** The company's fields the card reads, for the years from YEARS_BACK before `year` to `year`. */
export function companyProps(year: number): string[] {
  const out = ["name", "company_unique_number", "major_profit_center", "order_last_order_date", "erp_rev_as_of"];
  for (let y = year - YEARS_BACK; y <= year; y++) {
    out.push(`rev_${y}_pc_monthly`, `oi_${y}_pc_monthly`, ...MON.map((m) => `oi_${y}_${m}`));
  }
  return out;
}

/** The ticket's step and window end from its Revenue Drop Key ("100-123456|2|2026-10"); null: no UC12 ticket. */
export function keyOf(key: string | null | undefined): { un: string; step: Step; end: Month } | null {
  const m = /^(.+)\|([12])\|(\d{4}-\d{2})$/.exec((key ?? "").trim());
  return m ? { un: m[1], step: Number(m[2]) as Step, end: m[3] } : null;
}

/** A HubSpot date as yyyy-mm-dd - it comes as a date or as milliseconds. */
export function dayOf(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return new Date(Number(s)).toISOString().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
}

/** Today's window ends the month before the ERP figures' date; without one, the month before today. */
export function todayEndOf(asOf: string | null | undefined, today: string): Month {
  return shift((dayOf(asOf) ?? today).slice(0, 7), -1);
}

/** The company's months: revenue (all profit centres and by profit centre) and order intake, from its own fields. */
export function seriesOf(p: Props, years: number[]) {
  const months: Month[] = [], rev: number[] = [], oi: number[] = [], byPc: Record<string, number>[] = [];
  for (const y of years) {
    const blob = (kind: "rev" | "oi"): Record<string, number>[] => {
      const out = MON.map(() => ({} as Record<string, number>));
      let j: unknown = null;
      try { j = JSON.parse(p[`${kind}_${y}_pc_monthly`] ?? "null"); } catch { j = null; }
      if (!j || typeof j !== "object") return out;
      for (const [m, v] of Object.entries(j as Record<string, unknown>)) {
        const i = MON.indexOf(m.toLowerCase());
        if (i < 0 || !v || typeof v !== "object") continue;
        for (const [pc, n] of Object.entries(v as Record<string, unknown>)) {
          const x = Number(n);
          if (Number.isFinite(x)) out[i][pc.toLowerCase()] = (out[i][pc.toLowerCase()] ?? 0) + x;
        }
      }
      return out;
    };
    const r = blob("rev"), o = blob("oi");
    MON.forEach((m, i) => {
      months.push(`${y}-${String(i + 1).padStart(2, "0")}`);
      byPc.push(r[i]);
      rev.push(cents(Object.values(r[i]).reduce((a, b) => a + b, 0)));
      // order intake: the ERP workbook's monthly total, the blob only where the total is empty - as UC12 reads it
      oi.push(cents(num(p[`oi_${y}_${m}`]) ?? Object.values(o[i]).reduce((a, b) => a + b, 0)));
    });
  }
  return { months, rev, oi, byPc };
}

export type CardWindow = { end: Month; window: string; last: number; prev: number; change: number | null };
export type CardStatus = "lost" | "down" | "back";
export const STATUS_TEXT: Record<CardStatus, string> = {
  lost: "Still no revenue or order intake",
  down: "Still down 30% or more",
  back: "No longer down 30%",
};

export type Figures = {
  company: string; un: string | null; major: string | null; lastOrder: string | null; asOf: string | null;
  step: Step; atRisk: number | null;
  /** when the ticket was written (its own fields) and today (the company's fields) */
  ticket: CardWindow; today: CardWindow;
  status: CardStatus; statusText: string;
  /** percentage points from the ticket to today, + = better */
  points: number | null;
  since: { from: Month; to: Month; rev: number; oi: number; total: number } | null;
  months: { month: Month; label: string; value: number; after: boolean }[];
  pcs: { code: string; label: string; before: number; last: number; change: number | null }[];
};

/** The card's figures; null when the ticket is no UC12 ticket. `today` is yyyy-mm-dd. */
export function figuresOf(t: Props, c: Props, today: string): Figures | null {
  const k = keyOf(t.revenue_drop_key);
  if (!k) return null;
  const end = todayEndOf(c.erp_rev_as_of, today);
  const y = Number(end.slice(0, 4));
  const years: number[] = [];
  for (let x = y - YEARS_BACK; x <= y; x++) years.push(x);
  const s = seriesOf(c, years);
  const sum = (from: Month, to: Month, xs: number[]) => cents(s.months.reduce((a, m, i) => (m >= from && m <= to ? a + xs[i] : a), 0));
  const both = s.rev.map((r, i) => r + s.oi[i]);

  const last = sum(shift(end, -11), end, both), prev = sum(shift(end, -23), shift(end, -12), both);
  const todayW: CardWindow = { end, window: spanName(shift(end, -11), end), last, prev, change: prev > 0 ? (last - prev) / prev : null };
  const tl = num(t.revenue_drop_last_12) ?? 0, tp = num(t.revenue_drop_prev_12) ?? 0;
  const ticketW: CardWindow = {
    end: k.end, window: t.revenue_drop_window || spanName(shift(k.end, -11), k.end), last: tl, prev: tp,
    change: tp > 0 ? (tl - tp) / tp : null,
  };

  const down = prev > 0 && Math.round(last * 100) * 100 <= Math.round(prev * 100) * Math.round((1 - DROP_LINE) * 100);
  const status: CardStatus = last <= 0 ? "lost" : down ? "down" : "back";
  const points = todayW.change != null && ticketW.change != null ? Math.round(todayW.change * 100) - Math.round(ticketW.change * 100) : null;

  const from = shift(k.end, 1);
  const since = from <= end
    ? { from, to: end, rev: sum(from, end, s.rev), oi: sum(from, end, s.oi), total: sum(from, end, both) }
    : null;

  const chart: Figures["months"] = [];
  for (let i = CARD_MONTHS - 1; i >= 0; i--) {
    const m = shift(end, -i), at = s.months.indexOf(m);
    chart.push({ month: m, label: monthName(m), value: at < 0 ? 0 : cents(both[at]), after: m > k.end });
  }

  // revenue by profit center: the 12 months before the ticket against the last 12 months (order intake has no split)
  const pcs = new Map<string, { before: number; last: number }>();
  s.months.forEach((m, i) => {
    const b = m >= shift(k.end, -23) && m <= shift(k.end, -12), l = m >= shift(end, -11) && m <= end;
    if (!b && !l) return;
    for (const [code, v] of Object.entries(s.byPc[i])) {
      const x = pcs.get(code) ?? { before: 0, last: 0 };
      if (b) x.before += v;
      if (l) x.last += v;
      pcs.set(code, x);
    }
  });

  return {
    company: (c.name ?? "").trim(), un: c.company_unique_number?.trim() || null, major: c.major_profit_center?.trim() || null,
    lastOrder: dayOf(c.order_last_order_date), asOf: dayOf(c.erp_rev_as_of), step: k.step, atRisk: num(t.revenue_drop_amount_at_risk),
    ticket: ticketW, today: todayW, status, statusText: STATUS_TEXT[status], points, since, months: chart,
    pcs: [...pcs.entries()]
      .map(([code, x]) => ({ code, label: pcLabel(code), before: cents(x.before), last: cents(x.last), change: x.before > 0 ? x.last / x.before - 1 : null }))
      .filter((x) => Math.round(x.before) !== 0 || Math.round(x.last) !== 0)
      .sort((a, b) => b.before - a.before || b.last - a.last),
  };
}
