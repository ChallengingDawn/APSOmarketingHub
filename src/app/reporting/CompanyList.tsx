"use client";
// THE COMPANIES BEHIND A GRAPH (SARCLA 31.10.2026: "next to each report in every sub app where there are companies a new
// icon Company appears next to the filter (the filter inside the graph, not the general) and allows to see the companies -
// paginated by 25"; 01.11.2026: "instead of extending the graphs with the companies open a popup that we can close with the
// companies - tables should be sortable and allow search for a specific company").
//
// A graph's card takes the button beside its own filter; the button opens the list in a window over the page, closed by
// its cross, Escape or a click beside it. A page hands a graph its companies either directly (`companies` on the card) or
// around it (<CompaniesFor>), so one place on a page can serve every card it draws; a card's own children see none (a
// chart inside a card has no second button).

import { createContext, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import Dialog from "@mui/material/Dialog";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import CloseIcon from "@mui/icons-material/Close";
import { FAINT, HAIRLINE, INK, MUTED, TINT } from "@/app/uc/report/ui";
import { Pager, Table, type TableSort } from "@/app/reporting/marketing-kpis/ExplorerKit";

/** A company on a list: its HubSpot id (its name links to it), its name, its figures - and, where a cell is not plain text
 *  or a number, what the cell sorts by (one per cell, after the name; null: the cell itself). */
export type CompanyItem = { id: string | null; name: string; cells: React.ReactNode[]; values?: (string | number | null)[] };
/** A page of a list read from the server; "pending" while the read it comes from is not there yet. */
export type CompanyPageOut = { total: number; rows: CompanyItem[]; foot?: React.ReactNode };
/** The column clicked, counted with the company's name as 0. */
export type CompanySortBy = TableSort;
export type CompanySource = {
  /** what decides the list - when it changes, the list starts again from its first page */
  key: string;
  /** the columns after the company's name */
  head: string[];
  /** a page at a time (25), with a part of a name typed and the column clicked */
  load?: (page: number, q: string, sort: CompanySortBy | null) => Promise<CompanyPageOut | "pending">;
  /** with `load`: the columns it sorts by (the name is 0) - none sortable when not given */
  sorts?: number[];
  /** or every company at once - a report that holds them (made when the list opens, when a function): the search, the
   *  sorting and the pages here */
  rows?: CompanyItem[] | (() => CompanyItem[]);
  /** under the list's title: what the figures are */
  note?: string;
  /** the columns read as text, left-aligned like the name (counted with the name as 0) */
  left?: number[];
};

export const PAGE = 25;
export const hsCompany = (id: string) => `https://app-eu1.hubspot.com/contacts/26492587/record/0-2/${id}`;

const Ctx = createContext<CompanySource | null>(null);
/** Every graph card drawn inside gets this list of companies. */
export function CompaniesFor({ source, children }: { source: CompanySource | null; children: React.ReactNode }) {
  return <Ctx.Provider value={source}>{children}</Ctx.Provider>;
}

/** A graph card's companies: its button, beside its own filter, and the window it opens (`list`, anywhere in the card). */
export function useChartCompanies(given?: CompanySource | null, title?: string) {
  const around = useContext(Ctx);
  const source = given === undefined ? around : given;
  const [open, setOpen] = useState(false);
  return {
    source, open: !!source && open,
    button: source ? <CompaniesButton open={open} onClick={() => setOpen((o) => !o)} /> : null,
    list: source && open ? <CompanyDialog source={source} title={title} onClose={() => setOpen(false)} /> : null,
    /** the card's own content: no second list inside */
    inner: (node: React.ReactNode) => <Ctx.Provider value={null}>{node}</Ctx.Provider>,
  };
}

const NAV = { width: 30, height: 30, border: "1px solid rgba(21,34,58,.12)", borderRadius: "9px" };
export function CompaniesButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <IconButton size="small" aria-label={open ? "Hide the companies" : "Show the companies"} title={open ? "Hide the companies" : "The companies behind this graph"} aria-pressed={open} onClick={onClick}
      sx={{ ...NAV, color: open ? TINT.blue.fg : MUTED, bgcolor: open ? TINT.blue.bg : "transparent" }}>
      <BusinessOutlinedIcon sx={{ fontSize: 17 }} />
    </IconButton>
  );
}

/** The window over the page: the graph's name, the list, a cross to close it. */
export function CompanyDialog({ source, title, onClose }: { source: CompanySource; title?: string; onClose: () => void }) {
  const id = useId();
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="lg" aria-labelledby={id}
      slotProps={{ paper: { sx: { borderRadius: { xs: 0, sm: "18px" }, height: { xs: "100%", sm: "auto" }, maxHeight: { xs: "100%", sm: "88vh" }, m: { xs: 0, sm: 2 }, width: { xs: "100%", sm: undefined } } } }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, px: { xs: 2, sm: 2.5 }, pt: 2, pb: 1 }}>
        <Box id={id} sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.05em" }}>The companies</Typography>
          {title && <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: INK }}>{title}</Typography>}
        </Box>
        <IconButton onClick={onClose} aria-label="Close the companies" sx={{ mt: -0.5, mr: -1 }}><CloseIcon /></IconButton>
      </Box>
      <Box sx={{ px: { xs: 2, sm: 2.5 }, pb: 2, overflowY: "auto", minHeight: 0 }}>
        <CompanyList source={source} />
      </Box>
    </Dialog>
  );
}

type State = { busy: boolean; data?: CompanyPageOut; pending?: boolean; error?: string };

/** What a cell sorts by: its value given, or the cell itself when it is text or a number ("€1,234", "12.5%" by the figure). */
function valueOf(r: CompanyItem, col: number): string | number | null {
  if (col === 0) return r.name;
  const given = r.values?.[col - 1];
  if (given != null) return given;
  const c = r.cells[col - 1];
  if (typeof c === "number") return c;
  if (typeof c !== "string") return null;
  const t = c.trim();
  if (/^[−+-]?[€$]?\s?[\d,.']+\s?%?$/.test(t)) return Number(t.replace(/[€$%,'\s+]/g, "").replace("−", "-")) || 0;
  return t;
}
const compare = (a: string | number | null, b: string | number | null) =>
  a == null ? (b == null ? 0 : 1) : b == null ? -1 : typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), "en", { sensitivity: "base", numeric: true });

/** The list: a name search, the columns sortable, 25 a page, each name to its HubSpot record. */
export function CompanyList({ source }: { source: CompanySource }) {
  const [page, setPage] = useState(0);
  const [typed, setTyped] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<CompanySortBy | null>(null);
  const [tick, setTick] = useState(0);
  const [st, setSt] = useState<State>({ busy: !!source.load });
  const load = useRef(source.load);
  load.current = source.load;
  useEffect(() => { const t = setTimeout(() => { setQ(typed.trim().toLowerCase()); setPage(0); }, 300); return () => clearTimeout(t); }, [typed]);
  useEffect(() => { setPage(0); setSort(null); }, [source.key]);
  useEffect(() => {
    const get = load.current;
    if (!get) return;
    let live = true;
    setSt((s) => ({ ...s, busy: true, error: undefined }));
    get(page, q, sort)
      .then((r) => { if (live) setSt(r === "pending" ? { busy: false, pending: true } : { busy: false, data: r }); })
      .catch((e: unknown) => { if (live) setSt({ busy: false, error: String((e as Error)?.message ?? e) }); });
    return () => { live = false; };
  }, [source.key, page, q, sort, tick]);
  // the read the list comes with is on its way: ask again in a little while
  useEffect(() => {
    if (!st.pending) return;
    const t = setTimeout(() => setTick((x) => x + 1), 20_000);
    return () => clearTimeout(t);
  }, [st.pending, tick]);

  // every company at once: the search, the sorting and the pages here
  const rows = useRef(source.rows);
  rows.current = source.rows;
  // made once a list (its key), not at every drawing of the page under the window
  const all = useMemo(() => { const r = rows.current; return typeof r === "function" ? r() : r ?? null; }, [source.key]);
  const local = useMemo(() => {
    if (!all) return null;
    const found = all.filter((r) => !q || r.name.toLowerCase().includes(q));
    if (!sort) return found;
    const dir = sort.desc ? -1 : 1;
    return found.map((r, i) => ({ r, i, v: valueOf(r, sort.col) })).sort((a, b) => (a.v == null || b.v == null ? compare(a.v, b.v) : dir * compare(a.v, b.v)) || a.i - b.i).map((x) => x.r);
  }, [all, q, sort]);
  const sortable = useMemo(() => {
    if (!all) return source.sorts ?? [];
    return [0, ...source.head.map((_, k) => k + 1).filter((col) => all.some((r) => valueOf(r, col) != null))];
  }, [all, source.sorts, source.head]);
  // a figure first from the largest, a name or a word from A
  const onSort = (col: number) => {
    const text = col === 0 || (source.left ?? []).includes(col);
    setSort((s) => (s?.col === col ? { col, desc: !s.desc } : { col, desc: !text }));
    setPage(0);
  };

  const total = local ? local.length : st.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const at = Math.min(page, pages - 1);
  const shown = local ? local.slice(at * PAGE, at * PAGE + PAGE) : st.data?.rows ?? [];
  const pager = { shown: [] as unknown[], page: at, pages, setPage, size: PAGE, total };

  return (
    // minmax(0, 1fr): the table may not widen the window - on a phone it scrolls sideways inside it
    <Box sx={{ display: "grid", gap: 1, minWidth: 0, gridTemplateColumns: "minmax(0, 1fr)" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Box sx={{ flex: "1 1 220px", minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>
            {st.busy && !local ? "Reading the companies…" : `${total.toLocaleString("en")} compan${total === 1 ? "y" : "ies"}`}
          </Typography>
          {source.note && <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{source.note}</Typography>}
        </Box>
        <InputBase value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Find a company" autoFocus inputProps={{ "aria-label": "Find a company" }}
          sx={{ fontSize: "0.82rem", px: 1, py: 0.25, border: `1px solid ${HAIRLINE}`, borderRadius: "9px", bgcolor: "#fff", width: { xs: "100%", sm: 220 } }} />
        <Pager p={pager} />
      </Box>
      {st.error ? <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>The companies could not be read: {st.error}</Typography>
        : st.pending ? <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>The companies come with the next read of the figures - it is on its way, a few minutes.</Typography>
        : !shown.length && !(st.busy && !local) ? <Typography sx={{ fontSize: "0.84rem", color: FAINT }}>{q ? "No company by that name on this list." : "No company on this graph."}</Typography>
        : (
          <Box sx={{ opacity: st.busy && !local ? 0.5 : 1, transition: "opacity .15s ease" }}>
            <Table head={["Company", ...source.head]} left={source.left} sortable={sortable} sort={sort} onSort={onSort}
              rows={shown.map((r, i) => ({
                key: `${r.id ?? r.name}-${i}`,
                cells: [
                  r.id
                    ? <Box component="a" href={hsCompany(r.id)} target="_blank" rel="noreferrer" sx={{ color: INK, textDecoration: "none", "&:hover": { color: TINT.blue.fg, textDecoration: "underline" } }}>{r.name}</Box>
                    : r.name,
                  ...r.cells,
                ],
              }))} />
            {st.data?.foot}
            {pages > 1 && <Box sx={{ display: "flex", justifyContent: "flex-end", pt: 1 }}><Pager p={pager} /></Box>}
          </Box>
        )}
    </Box>
  );
}
