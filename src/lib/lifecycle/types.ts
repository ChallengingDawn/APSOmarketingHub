// What the lifecycle reads keep (one dataset per page, plus the email sends
// every page shares), and what a page is sent (its view). Pure types.

import type { UcKey, ViewKey } from "./config";
import type { Entry, Send, Src, Win } from "./rules";

/** A company as the pages need it. Only the fields its own page reads are filled in. */
export type Co = {
  id: string;
  name: string;
  /** lifecyclestage now */
  stage: string | null;
  /** the hub's real ERP order facts */
  first: string | null;
  last: string | null;
  orders: number | null;
  avgDays?: number | null;
  /** lifecycle stages entered since the horizon, oldest first */
  entries?: Entry[];
  /** ERP revenue by month, "2026-07" -> EUR */
  rev?: Record<string, number>;
  /** the day it entered the UC's flow (or the latest entry into the UC's stage) */
  enrolled?: string | null;
  /** the workflow's own outcome and revenue - a side note, never the headline */
  outcome?: string | null;
  outcomeRevenue?: number | null;
  /** the second real order's day (UC9) */
  second?: string | null;
  segment?: string | null;
  reason?: string | null;
  nps?: number | null;
};

export type Ticket = {
  id: string;
  created: string;
  closed: boolean;
  closedOn: string | null;
  stage: string;
  team: string;
  resolution: string | null;
  subject: string;
  workflow: string;
  companyId: string | null;
};

export type Task = { id: string; created: string; done: boolean; workflow: string; companyId: string | null };

/** How many records each source gave, printed under the page so a short read is obvious. */
export type Source = { label: string; n: number };

export type UcData = {
  uc: UcKey;
  generatedAt: string;
  today: string;
  horizon: string;
  companies: Co[];
  tickets: Ticket[];
  tasks: Task[];
  /** The latest task each era ever created - "none since". */
  lastTask: { era: string; day: string | null }[];
  /** UC6: the day of every first order since the horizon. */
  firstDays?: string[];
  /** UC10+11: why companies did not buy again. */
  reasons?: { label: string; n: number }[];
  /** The workflow's own outcome, counted over every company that carries it. */
  outcomeTally?: { label: string; n: number }[];
  outcomeRevenue?: { sum: number; n: number };
  /** UC4: [cart day, company] per contact's latest abandoned cart. */
  carts?: [string, string | null][];
  /** UC4: web-shop order days per company. */
  webOrders?: Record<string, string[]>;
  /** UC12: companies with an erosion ticket. */
  erosion?: string[];
  sources: Source[];
};

export type OverviewData = {
  generatedAt: string;
  today: string;
  horizon: string;
  now: { stage: string; n: number }[];
  noStage: number;
  total: number;
  /** stage entries per day and who set them */
  entries: { day: string; stage: string; src: Src; n: number }[];
  lastTask: { era: string; day: string | null }[];
  sources: Source[];
};

export type EmailData = {
  generatedAt: string;
  horizon: string;
  contactsRead: number;
  names: string[];
  companies: string[];
  sends: Send[];
  /** sent / opened / clicked per email name - only with the email-statistics token */
  stats: Record<string, { sent: number; open: number; click: number }> | null;
  statsError: string | null;
};

/* ── what a page is sent ───────────────────────────────────────────────── */

export type Fmt = "n" | "pct" | "eur" | "days" | "text" | "date" | "stage" | "yesno";
export type IconKey = "companies" | "ticket" | "task" | "order" | "euro" | "percent" | "email" | "stage" | "time" | "cart" | "star" | "warning" | "up" | "down";
export type TintKey = "blue" | "green" | "purple" | "amber" | "pink" | "slate";

export type Tile = { label: string; value: number | string | null; fmt: Fmt; note?: string; icon: IconKey; tint: TintKey };

export type Row = Record<string, string | number | null>;

export type ChartView =
  | { kind: "stack"; title: string; note: string; parts: { key: string; label: string }[]; rows: Row[]; fmt: Fmt; footnote?: string }
  | { kind: "lines"; title: string; note: string; parts: { key: string; label: string }[]; rows: Row[]; fmt: Fmt; footnote?: string }
  | { kind: "grouped"; title: string; note: string; current: string; prior: string; rows: { x: string; current: number | null; prior: number | null }[]; fmt: Fmt; footnote?: string }
  | { kind: "trend"; title: string; note: string; label: string; points: { x: string; value: number | null }[]; fmt: Fmt; footnote?: string; extra?: { columns: string[]; rows: (string | number)[][] } }
  | { kind: "bars"; title: string; note: string; rows: { label: string; value: number; secondary?: string }[]; fmt: Fmt; footnote?: string };

export type Col = { key: string; label: string; fmt: Fmt; hint?: string };

export type ListView = {
  title: string;
  note: string;
  cols: Col[];
  rows: Row[];
  total: number;
  /** what the row's `id` opens in HubSpot */
  link: "company" | "ticket" | null;
  empty: string;
};

export type EmailRow = {
  step: string;
  version: string;
  variants: number;
  sendsWin: number;
  companiesWin: number;
  sendsAll: number;
  lastSent: string | null;
  stats: { sent: number; open: number; click: number } | null;
};

export type EmailView = {
  rows: EmailRow[];
  /** steps the flow is built to send that no contact has received */
  unseen: string[];
  contactsRead: number;
  horizon: string;
  statsOn: boolean;
  statsError: string | null;
};

export type View = {
  key: ViewKey;
  /** when the HubSpot read behind it finished */
  generatedAt: string;
  code: string;
  title: string;
  does: string;
  converted: string;
  window: Win;
  tiles: Tile[];
  charts: ChartView[];
  list: ListView | null;
  findings: string[];
  notes: string[];
  sources: Source[];
};
