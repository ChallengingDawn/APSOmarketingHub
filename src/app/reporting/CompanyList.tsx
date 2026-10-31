"use client";
// THE COMPANIES BEHIND A GRAPH (SARCLA 31.10.2026: "next to each report in every sub app where there are companies a new
// icon Company appears next to the filter (the filter inside the graph, not the general) and allows to see the companies -
// the graphs expand to show the companies, paginated by 25").
//
// A graph's card takes the button beside its own filter and opens the list inside itself, under the graph. A page hands
// a graph its companies either directly (`companies` on the card) or around it (<CompaniesFor>), so one place on a page
// can serve every card it draws; a card's own children see none (a chart inside a card has no second button).

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import { FAINT, HAIRLINE, INK, MUTED, TINT } from "@/app/uc/report/ui";
import { Pager, Table } from "@/app/reporting/marketing-kpis/ExplorerKit";

/** A company on a list: its HubSpot id (its name links to it), its name, its figures. */
export type CompanyItem = { id: string | null; name: string; cells: React.ReactNode[] };
/** A page of a list read from the server; "pending" while the read it comes from is not there yet. */
export type CompanyPageOut = { total: number; rows: CompanyItem[]; foot?: React.ReactNode };
export type CompanySource = {
  /** what decides the list - when it changes, the list starts again from its first page */
  key: string;
  /** the columns after the company's name */
  head: string[];
  /** a page at a time (25), with a part of a name typed */
  load?: (page: number, q: string) => Promise<CompanyPageOut | "pending">;
  /** or every company at once - a report that holds them */
  rows?: CompanyItem[];
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

/** A graph card's companies: its button, beside its own filter, and its list, under the graph. */
export function useChartCompanies(given?: CompanySource | null) {
  const around = useContext(Ctx);
  const source = given === undefined ? around : given;
  const [open, setOpen] = useState(false);
  return {
    source, open: !!source && open,
    /** the card's own sx: open, it takes the whole row of its grid (SARCLA: "the graphs expand to show the companies") */
    wide: source && open ? { gridColumn: "1 / -1" } : {},
    button: source ? <CompaniesButton open={open} onClick={() => setOpen((o) => !o)} /> : null,
    list: source && open ? <CompanyList source={source} /> : null,
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

type State = { busy: boolean; data?: CompanyPageOut; pending?: boolean; error?: string };

/** The list: a name search, 25 a page, each name to its HubSpot record. */
export function CompanyList({ source }: { source: CompanySource }) {
  const [page, setPage] = useState(0);
  const [typed, setTyped] = useState("");
  const [q, setQ] = useState("");
  const [tick, setTick] = useState(0);
  const [st, setSt] = useState<State>({ busy: !!source.load });
  const load = useRef(source.load);
  load.current = source.load;
  useEffect(() => { const t = setTimeout(() => { setQ(typed.trim().toLowerCase()); setPage(0); }, 300); return () => clearTimeout(t); }, [typed]);
  useEffect(() => { setPage(0); }, [source.key]);
  useEffect(() => {
    const get = load.current;
    if (!get) return;
    let live = true;
    setSt((s) => ({ ...s, busy: true, error: undefined }));
    get(page, q)
      .then((r) => { if (live) setSt(r === "pending" ? { busy: false, pending: true } : { busy: false, data: r }); })
      .catch((e: unknown) => { if (live) setSt({ busy: false, error: String((e as Error)?.message ?? e) }); });
    return () => { live = false; };
  }, [source.key, page, q, tick]);
  // the read the list comes with is on its way: ask again in a little while
  useEffect(() => {
    if (!st.pending) return;
    const t = setTimeout(() => setTick((x) => x + 1), 20_000);
    return () => clearTimeout(t);
  }, [st.pending, tick]);

  // every company at once: the search and the pages here
  const local = useMemo(() => (source.rows ? source.rows.filter((r) => !q || r.name.toLowerCase().includes(q)) : null), [source.rows, q]);
  const total = local ? local.length : st.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const at = Math.min(page, pages - 1);
  const shown = local ? local.slice(at * PAGE, at * PAGE + PAGE) : st.data?.rows ?? [];
  const pager = { shown: [] as unknown[], page: at, pages, setPage, size: PAGE, total };

  return (
    // minmax(0, 1fr): the table may not widen its card - in half a row it scrolls sideways inside it
    <Box sx={{ borderTop: `1px solid ${HAIRLINE}`, mt: 1.5, pt: 1.5, display: "grid", gap: 1, minWidth: 0, gridTemplateColumns: "minmax(0, 1fr)" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Box sx={{ flex: "1 1 220px", minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>
            {st.busy && !local ? "Reading the companies…" : `${total.toLocaleString("en")} compan${total === 1 ? "y" : "ies"}`}
          </Typography>
          {source.note && <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{source.note}</Typography>}
        </Box>
        <InputBase value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Find a company" inputProps={{ "aria-label": "Find a company" }}
          sx={{ fontSize: "0.82rem", px: 1, py: 0.25, border: `1px solid ${HAIRLINE}`, borderRadius: "9px", bgcolor: "#fff", width: { xs: "100%", sm: 200 } }} />
        <Pager p={pager} />
      </Box>
      {st.error ? <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>The companies could not be read: {st.error}</Typography>
        : st.pending ? <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>The companies come with the next read of the figures - it is on its way, a few minutes.</Typography>
        : !shown.length && !(st.busy && !local) ? <Typography sx={{ fontSize: "0.84rem", color: FAINT }}>{q ? "No company by that name on this list." : "No company on this graph."}</Typography>
        : (
          <Box sx={{ opacity: st.busy && !local ? 0.5 : 1, transition: "opacity .15s ease" }}>
            <Table head={["Company", ...source.head]} left={source.left}
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
          </Box>
        )}
    </Box>
  );
}
