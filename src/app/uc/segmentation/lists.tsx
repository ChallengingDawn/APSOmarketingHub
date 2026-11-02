"use client";

// SMART SEGMENTATION - the companies, as on the reporting pages (SARCLA 02.11.2026: "you don't have the button on the
// modal, and the design changes from page to page - uniformize"). Every chart and every count has the Companies button
// beside its title and opens the same window (src/app/reporting/CompanyList.tsx): a name search, the columns sortable,
// 25 a page, each name to its HubSpot record; a list that stays on the page is the same table. Here: where each tab's
// companies come from, the card a list stays on, and the line every run and the scan start with - alive or not.

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { full } from "@/app/charts/format";
import { ChartBox } from "@/app/reporting/eso-benchmark/Figures";
import { CompanyList, type CompanySource } from "@/app/reporting/CompanyList";
import { GlassCard, INK, MUTED } from "@/app/uc/report/ui";
import { SEARCH_CAP, type CompaniesPage, type CompanyFilter, type CompanyRow, type SortKey } from "@/lib/segmentation/companies";
import { NEW_SORTS, SET_BY_LABEL, countryName, sourceLabel, type NewCo } from "@/lib/segmentation/newCompanies";
import type { Stage, StageRow } from "@/lib/integrations/newCompanies";

export const PRIO_LABEL: Record<string, string> = { "1": "P1", "2": "P2", "3": "P3", "4": "No priority", "": "No priority yet" };
const eur = (n: number | null) => (n === null ? "—" : `${full(Math.round(n))} €`);
/** a day and a time in Zurich, "02.11. 14:02" */
export const dayTime = (iso: string) => (iso ? new Date(iso).toLocaleString("de-CH", { timeZone: "Europe/Zurich", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
const dmy = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
/** a value with a second, smaller line under it */
export const twoLines = (top: React.ReactNode, under: React.ReactNode, strong = false) => (
  <Box component="span" sx={{ display: "grid", minWidth: 0 }}>
    <Box component="span" sx={{ fontWeight: strong ? 700 : 500 }}>{top}</Box>
    <Box component="span" sx={{ fontSize: "0.72rem", color: MUTED, fontWeight: 400 }}>{under}</Box>
  </Box>
);

async function get<T>(url: string): Promise<T> {
  const r = await fetch(url);
  const j = (await r.json().catch(() => null)) as { ok?: boolean; data?: T; error?: string } | null;
  if (!j?.ok || j.data === undefined) throw new Error(j?.error ?? `HTTP ${r.status}`);
  return j.data;
}

/* ── HubSpot's companies, live (Portfolio, Profit center) ──────────────── */

export type Fixed = Pick<CompanyFilter, "seg" | "prio" | "major" | "split">;
/** the columns HubSpot sorts by, counted with the name as 0 */
const HUB_SORT: Record<number, SortKey> = { 0: "name", 6: "potential", 7: "basis", 8: "best", 9: "revenue" };
const centre = (x: CompanyRow) => (!x.major ? "—" : x.split && x.split !== x.major ? twoLines(x.major, x.split) : x.major);

/** Every company in HubSpot a chart or a choice narrows to, live, 25 a page - the largest basis first. */
export function hubSource(fixed: Fixed, note = "Live from HubSpot, the largest basis first - the basis is the higher of the yearly potential and the best revenue year since 2015, what the priority is taken from"): CompanySource {
  const given = Object.fromEntries(Object.entries(fixed).filter(([, v]) => v !== undefined)) as Record<string, string>;
  return {
    key: `hub|${JSON.stringify(given)}`, note,
    head: ["APSO segment", "Priority", "Profit centre", "Owner", "Country", "Potential", "Basis", "Best year", "Revenue this year"],
    left: [1, 2, 3, 4, 5], sorts: [0, 6, 7, 8, 9],
    widths: ["minmax(120px, 1fr)", "minmax(90px, 0.6fr)", "minmax(150px, 1.2fr)", "minmax(130px, 1fr)", "minmax(100px, 0.8fr)", ...Array(4).fill("minmax(105px, 0.8fr)")],
    load: async (page, q, sort) => {
      const by = sort ? HUB_SORT[sort.col] : undefined;
      const p = new URLSearchParams({ ...given, page: String(page), ...(q ? { q } : {}), ...(by ? { sort: by, dir: sort!.desc ? "desc" : "asc" } : {}) });
      const d = await get<CompaniesPage>(`/api/uc/segmentation/companies?${p}`);
      return {
        total: d.total,
        rows: d.rows.map((x) => ({
          id: x.id, name: x.name || x.id,
          cells: [x.segment || "—", PRIO_LABEL[x.prio] ?? x.prio, centre(x), x.owner || "—", x.country ? countryName(x.country) : "—", eur(x.potential), eur(x.basis), eur(x.best), eur(x.revenue)],
        })),
        foot: d.total > SEARCH_CAP
          ? <Typography sx={{ fontSize: "0.76rem", color: MUTED, pt: 1 }}>HubSpot lists the first {full(SEARCH_CAP)} of any order - a name, or a bar of a chart, finds the others.</Typography>
          : undefined,
      };
    },
  };
}

/* ── the companies created in a period (New companies) ─────────────────── */

export const NEW_API = "/api/uc/segmentation/new-companies";
const after = (m: number) => (m < 120 ? `${m} min` : m < 2880 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} days`);

/** The period's new companies behind a chart, a stage or a row - read from the hub's follow of the last two years. */
export function newSource(win: { from: string; to: string }, pick: Record<string, string>, imports: string | null, names: { owners: Record<string, string>; users: Record<string, string> }, note: string): CompanySource {
  return {
    key: `new|${win.from}|${win.to}|${JSON.stringify(pick)}|${imports ?? ""}`, note,
    head: ["Created", "Country", "Came from", "First segment", "Segment today", "Priority", "Bought since", "Owner"],
    left: [2, 3, 4, 5, 6, 8], sorts: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    // where it came from is a workflow's or a form's whole name: the room for it, the figures narrower
    widths: ["minmax(100px, 0.7fr)", "minmax(110px, 0.8fr)", "minmax(240px, 2fr)", "minmax(180px, 1.3fr)", "minmax(130px, 1fr)", "minmax(90px, 0.6fr)", "minmax(110px, 0.8fr)", "minmax(140px, 1.1fr)"],
    load: async (page, q, sort) => {
      const p = new URLSearchParams({ list: "1", from: win.from, to: win.to, ...pick, ...(imports ? { imports } : {}), page: String(page), ...(q ? { q } : {}), ...(sort ? { sort: NEW_SORTS[sort.col], desc: sort.desc ? "1" : "0" } : {}) });
      const d = await get<{ rows: NewCo[]; total: number }>(`${NEW_API}?${p}`);
      return {
        total: d.total,
        rows: d.rows.map((x) => ({
          id: x.id, name: x.n || x.id,
          cells: [
            dmy(x.d), countryName(x.k), sourceLabel(x.src, x.by, names.users),
            x.f ? twoLines(x.f, `${SET_BY_LABEL[x.fb]}${x.fm !== null ? `, ${after(x.fm)} after` : ""}`) : "none",
            x.s ? (x.s !== x.f ? <b>{x.s}</b> : x.s) : "none",
            PRIO_LABEL[x.p] ?? x.p, x.r > 0 ? eur(x.r) : "—", x.o ? names.owners[x.o] ?? `Owner ${x.o}` : "—",
          ],
        })),
      };
    },
  };
}

/** A stage of today's scan - created, in the 20 minutes' wait, past it without a segment - live from HubSpot. */
export function stageSource(stage: Stage, note: string): CompanySource {
  return {
    key: `stage|${stage}`, note, head: ["Created", "Domain", "Employees", "APSO segment"], left: [2, 4],
    load: async (page, q) => {
      const p = new URLSearchParams({ stage, page: String(page), ...(q ? { q } : {}) });
      const d = await get<{ total: number; rows: StageRow[] }>(`${NEW_API}?${p}`);
      return { total: d.total, rows: d.rows.map((x) => ({ id: x.id, name: x.n || x.id, cells: [dayTime(x.t), x.dom || "none", x.emp || "—", x.seg || "none yet"] })) };
    },
  };
}

/* ── the card a list stays on, the line a run starts with ──────────────── */

/** A list that stays on the page: a chart's card with the window's table in it (its own choices above it). */
export function ListCard({ title, hint, source, children }: { title: string; hint?: string; source: CompanySource; children?: React.ReactNode }) {
  return (
    <ChartBox title={title} hint={hint}>
      {children}
      <CompanyList source={source} autoFocus={false} />
    </ChartBox>
  );
}

export function Pulse({ tone, beat }: { tone: string; beat: boolean }) {
  return (
    <Box sx={{ position: "relative", width: 14, height: 14, mt: 0.6, flexShrink: 0 }}>
      <Box sx={{ position: "absolute", inset: 0, borderRadius: "50%", bgcolor: tone }} />
      {beat && <Box sx={{ position: "absolute", inset: -4, borderRadius: "50%", border: `2px solid ${tone}`, animation: "segPulse 1.8s ease-out infinite", "@keyframes segPulse": { "0%": { transform: "scale(.6)", opacity: 0.9 }, "100%": { transform: "scale(1.6)", opacity: 0 } } }} />}
    </Box>
  );
}

/** Is it alive: the pulse, what it is doing in one line, when it ran and runs next - the scan's and every run's, the same. */
export function StatusCard({ tone, beat, title, line, right, children }: { tone: string; beat: boolean; title: string; line: React.ReactNode; right?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
      <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", flexWrap: "wrap" }}>
        <Pulse tone={tone} beat={beat} />
        <Box sx={{ flex: 1, minWidth: 240 }}>
          <Typography sx={{ fontSize: "1.02rem", fontWeight: 800, color: INK }}>{title}</Typography>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED, lineHeight: 1.5 }}>{line}</Typography>
        </Box>
        {right}
      </Box>
      {children}
    </GlassCard>
  );
}
