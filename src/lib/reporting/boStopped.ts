// BACK-OFFICE REPORTS > STOPPED ORDERS - the eShop orders Performis stopped after the shop passed them on, and why, from
// the Back Office's own evaluation (SARCLA 11.11.2026: "Auswertung Aufgaben 2026"): its overview gives each month's orders
// transferred, those stopped and the tickets; its month sheets list every stopped order with its mandant, the reasons
// ticked, who released it and, from June 2026, who was responsible. Neither the ERP's nightly file nor the shop keeps the
// stops (checked 07.11.2026), so this file is the source; the data is ./boStoppedFile.ts, generated from it.
// The reasons are counted as its overview counts them: the twelve columns it shows, the order margin only where it is the
// order's one reason ("only unique ones"). Months the file does not have yet fall back to the figures typed in on the page.
// Pure: no HubSpot, no clock. Tests: tests/bo-stopped.test.ts.

/** The Back Office's target: at most this share of the orders transferred stopped. */
export const STOP_TARGET = 0.15;

export type ReasonId = "head" | "denomination" | "price" | "credit" | "open" | "reservation" | "prepayment" | "moq" | "supplier" | "conformity" | "margin" | "value";
/** In the overview's order; `de` = the column of the month sheets. */
export const STOP_REASONS: { id: ReasonId; label: string; de: string }[] = [
  { id: "head", label: "Note on the order head", de: "Bemerkungen zum Kopf" },
  { id: "denomination", label: "Denomination", de: "Stückelung" },
  { id: "price", label: "Price missing", de: "Definitiver Preis" },
  { id: "credit", label: "Credit limit", de: "Kreditlimite überschritten" },
  { id: "open", label: "Open accounts", de: "Überfällige OPs vorhanden" },
  { id: "reservation", label: "Reservation", de: "kann nicht reserviert werden" },
  { id: "prepayment", label: "Prepayment", de: "Vorauszahlung" },
  { id: "moq", label: "MOQ", de: "MOQ" },
  { id: "supplier", label: "Main supplier missing", de: "Hauptlieferant" },
  { id: "conformity", label: "Declaration of conformity", de: "Konformitätserklärung" },
  { id: "margin", label: "Order margin", de: "Mindest-Auftragsmarge" },
  { id: "value", label: "Order value", de: "Auftragswert" },
];
export const reasonLabel = (id: string) => STOP_REASONS.find((r) => r.id === id)?.label ?? id;

export type Mandant = "100" | "110";
export type StoppedMonth = {
  transferred: number | null; stopped: number | null; tickets?: number | null;
  reasons: Partial<Record<ReasonId, number>>;
  /** 2026: the orders listed in the month sheet (the overview's count can differ by one) */
  listed?: number;
  /** the orders by how many reasons stopped them: one (or none of the twelve), two, three or more */
  perOrder?: [number, number, number];
  mandant?: Record<Mandant, number>;
  reasonsByMandant?: Record<Mandant, Partial<Record<ReasonId, number>>>;
  /** who released them ("Geändert von"), by their login */
  handledBy?: Record<string, number>;
  /** from June 2026: who was responsible ("Verantwortlicher") */
  responsible?: Record<string, number>;
  /** a remark of the file on the month */
  note?: string;
  /** where the month comes from */
  from?: "file" | "typed";
};
export type StoppedFile = { name: string; read: string; months: Record<string, StoppedMonth> };
export type TypedFigures = Record<string, Record<string, number>>;

/** A month: the file's, else what was typed in on the page (orders transferred and stopped, three reasons). */
export function stoppedMonth(file: StoppedFile, typed: TypedFigures | null | undefined, ym: string): StoppedMonth | null {
  const m = file.months[ym];
  if (m) return { ...m, from: "file" };
  const t = (row: string) => typed?.[`stopped.${row}`]?.[ym] ?? null;
  const transferred = t("transferred"), stopped = t("stopped");
  if (transferred == null && stopped == null) return null;
  const reasons: Partial<Record<ReasonId, number>> = {};
  for (const id of ["credit", "denomination", "price"] as const) { const v = t(id); if (v != null) reasons[id] = v; }
  return { transferred, stopped, reasons, from: "typed" };
}

/** The share stopped of the orders transferred. */
export const stopShare = (m: StoppedMonth | null): number | null => (m && m.transferred && m.stopped != null ? m.stopped / m.transferred : null);

const add = <K extends string>(into: Partial<Record<K, number>>, from: Partial<Record<K, number>> | undefined) => {
  for (const [k, v] of Object.entries(from ?? {}) as [K, number][]) into[k] = (into[k] ?? 0) + (v ?? 0);
};

/** Months added up: the counts, the reasons, and - over the months that have them - the breakdowns of the month sheets. */
export function sumStopped(months: (StoppedMonth | null)[]) {
  const ms = months.filter((m): m is StoppedMonth => !!m);
  const both = ms.filter((m) => m.transferred != null && m.stopped != null);
  const reasons: Partial<Record<ReasonId, number>> = {};
  const byMandant: Record<Mandant, Partial<Record<ReasonId, number>>> = { "100": {}, "110": {} };
  const mandant: Record<Mandant, number> = { "100": 0, "110": 0 };
  const handledBy: Record<string, number> = {}, responsible: Record<string, number> = {};
  const perOrder: [number, number, number] = [0, 0, 0];
  let listed = 0, detailed = 0, tickets = 0, ticketMonths = 0, ticketOrders = 0;
  for (const m of ms) {
    add(reasons, m.reasons);
    if (m.tickets != null && m.transferred) { tickets += m.tickets; ticketOrders += m.transferred; ticketMonths++; }
    if (!m.perOrder) continue;
    detailed++;
    listed += m.listed ?? m.perOrder.reduce((a, b) => a + b, 0);
    m.perOrder.forEach((v, i) => { perOrder[i] += v; });
    for (const k of ["100", "110"] as const) { mandant[k] += m.mandant?.[k] ?? 0; add(byMandant[k], m.reasonsByMandant?.[k]); }
    add(handledBy, m.handledBy); add(responsible, m.responsible);
  }
  return {
    months: ms.length,
    transferred: both.reduce((a, m) => a + (m.transferred ?? 0), 0), stopped: both.reduce((a, m) => a + (m.stopped ?? 0), 0),
    /** the stopped orders of every month with a figure, whether or not its transferred one is known */
    stoppedAll: ms.reduce((a, m) => a + (m.stopped ?? 0), 0),
    reasons, tickets: ticketMonths ? tickets : null, ticketOrders, detailed, listed, perOrder, mandant, byMandant, handledBy, responsible,
  };
}
export type StoppedSum = ReturnType<typeof sumStopped>;
export const sumShare = (s: StoppedSum) => (s.transferred ? s.stopped / s.transferred : null);

/** The reasons, the most frequent first, with their count. */
export const reasonsRanked = (r: Partial<Record<ReasonId, number>>) =>
  STOP_REASONS.map((x) => ({ id: x.id, label: x.label, value: r[x.id] ?? 0 })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value);

/** The logins of the Back Office team as the file writes them, by name (as the certificates' declarations sign them). */
export const STOP_PEOPLE: Record<string, string> = {
  CACL: "Claudia Cagnoni", GASHSA: "Sara Gashi", ZIMMAR: "Mark Zimin", DEBADR: "Adriana Deblander", OSMA: "Maida Osmani",
  GAB: "Claudio Gabinato", ASLLEA: "Leart Asllani", BATVAN: "Vanessa Battaglia", BEDAYL: "Ayla Bediji", RARO: "Rose Rasteiro", WIDA: "Daniel Wieland",
  APSO: "APSOparts (the system)",
};
export const personOf = (login: string) => STOP_PEOPLE[login] ?? login;
