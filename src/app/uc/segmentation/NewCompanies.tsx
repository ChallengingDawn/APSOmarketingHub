"use client";

// SMART SEGMENTATION - New companies (SARCLA 02.11.2026: "give Smart Segmentation a fully new tab for the scanning of
// new companies and their evolution"). Two parts: the scan - the first APSO segment of every new company, the HubSpot
// workflow "SARCLA | COMPANY SMARTSEGMENTATION" brought into the watcher (Off / Paused / Live, writes only once the
// workflow is off) - and the evolution: every company created in the period, where it came from, who gave it its first
// segment and what became of it since, against the days before. Advanced reporting's cards: DimChart, "All the
// figures", a click lists the companies. Reads /api/uc/segmentation/new-companies (src/lib/integrations/newCompanies.ts).

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import CircularProgress from "@mui/material/CircularProgress";
import CloseIcon from "@mui/icons-material/Close";
import DomainAddOutlinedIcon from "@mui/icons-material/DomainAddOutlined";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import HourglassEmptyOutlinedIcon from "@mui/icons-material/HourglassEmptyOutlined";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import ListAltIcon from "@mui/icons-material/ListAlt";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { DEEMPHASIS } from "@/app/charts/palette";
import { DimChart } from "@/app/reporting/marketing-kpis/DimChart";
import { ChartBox, FullTable, TWO, type Col } from "@/app/reporting/eso-benchmark/Figures";
import { CardTitle, FAINT, GlassCard, INK, KpiTile, MUTED, RED, bodyCell, clip, headCell } from "@/app/uc/report/ui";
import { Chip, Choice, Info, usePaged, when } from "@/app/connectors/parts";
import { useReportingWindow } from "@/app/window/ReportingWindow";
import { rangeLabel } from "@/lib/boDetection/figures";
import type { BuildInfo, LiveState, ScanDoc, ScanRow, Settings, Unsegmented } from "@/lib/integrations/newCompanies";
import { RULES, RULE_LABEL, SET_BY_LABEL, countryName, previousWindow, sourceLabel, type NewCo, type NewFigures, type RuleKey, type Side } from "@/lib/segmentation/newCompanies";
import { SEGMENT_COLOR } from "./PortfolioCharts";

const API = "/api/uc/segmentation/new-companies";
type Data = {
  figures: NewFigures | null; imported: number; settings: Settings; workflowOn: boolean | null; writing: boolean; scan: ScanDoc; build: BuildInfo | null; unsegmented: Unsegmented | null;
  admin: boolean; engineLive: boolean;
};

const hsCompany = (id: string) => `https://app-eu1.hubspot.com/contacts/26492587/record/0-2/${id}`;
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
const eur = (n: number) => `${full(Math.round(n))} €`;
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (ym: string) => `${MON[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;
const bucketLabel = (x: string) => (x.length === 7 ? monthLabel(x) : `${x.slice(8, 10)}.${x.slice(5, 7)}`);
/** "Last 365 days" inside a sentence */
const inSentence = (l: string) => l.replace(/^Last /, "the last ");
const PRIO: Record<string, string> = { "1": "P1", "2": "P2", "3": "P3", "4": "No priority (under 500 €)", "": "No priority yet" };
/** the segments a customer is in - the ERP's and the engine's */
const CUSTOMER = new Set(["APSOcore", "APSOgrowth", "Growth Engine Customer"]);

/** Four stacks at most (the palette is never cycled): still a prospect, micro, a customer segment, the rest. */
const STACK = [
  { key: "prospect", label: "Still APSOprospect", color: SEGMENT_COLOR.APSOprospect, has: (s: string) => s === "APSOprospect" },
  { key: "micro", label: "APSOmicro", color: SEGMENT_COLOR.APSOmicro, has: (s: string) => s === "APSOmicro" },
  { key: "customer", label: "A customer segment (core, growth, Growth Engine)", color: SEGMENT_COLOR.APSOcore, has: (s: string) => CUSTOMER.has(s) },
  { key: "other", label: "Lost, no sales focus, other or none", color: DEEMPHASIS, has: () => true },
];
const stackOf = (seg: Record<string, number>) => {
  const out: Record<string, number> = { prospect: 0, micro: 0, customer: 0, other: 0 };
  for (const [s, n] of Object.entries(seg)) out[STACK.find((p) => p.has(s))!.key] += n;
  return out;
};

type Kind = "src" | "who" | "move" | "seg" | "country" | "owner" | "bucket" | "rule" | "byRules" | "fast" | "bought" | "customer";
type Pick = { kind: Kind; key: string; label: string };
type DimRow = { id: string; label: string; n: number; b: number };

export function NewCompanies({ steering }: { steering?: React.ReactNode }) {
  const { window: win, label } = useReportingWindow();
  const [n, setN] = useState(0);
  const [imports, setImports] = useState<"all" | "without">("all");
  const url = `${API}?from=${win.from}&to=${win.to}${imports === "without" ? "&imports=0" : ""}${n ? `&n=${n}` : ""}`;
  const r = useHeld<Data>(url, [url]).result;
  const d = r?.state === "ok" ? r.data : null;
  const building = !!d?.build?.running;
  useEffect(() => {
    if (!building) return;
    const t = setTimeout(() => setN((x) => x + 1), 10_000);
    return () => clearTimeout(t);
  }, [building, n]);
  const [pick, setPick] = useState<Pick | null>(null);
  useEffect(() => setPick(null), [win.from, win.to, imports]);

  if (r === null) return <LoadingPanel label="Reading the new companies…" />;
  if (!d) return <UpstreamPanel source="New companies" error={r.state === "error" ? r.error : "not there yet - this tab fills in once the hub is deployed"} status={r.state === "error" ? r.status : null} onRetry={() => setN((x) => x + 1)} />;
  const reload = () => setN((x) => x + 1);
  const f = d.figures;
  return (
    <Box id="segmentation-panel-new" role="tabpanel" sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>
      <LiveScan steering={steering} />
      {f && (d.imported > 0 || imports === "without") && (
        <Choice<"all" | "without"> value={imports} onChange={setImports} options={[
          { key: "all", label: "All new companies", count: imports === "without" ? f.now.n + d.imported : f.now.n },
          { key: "without", label: "Without the imports", count: imports === "without" ? f.now.n : f.now.n - d.imported },
        ]} />
      )}
      {f ? <Evolution f={f} label={label} pick={pick} setPick={setPick} imports={imports === "without" ? "0" : null} /> : (
        <Info>{building ? `Reading every company created in the last two years - ${d.build?.progress ?? ""}. The figures appear here when it is done, in a few minutes.` : "The companies of the last two years have not been read yet - the hub reads them a few minutes after it starts, and every night after the nightly sweep."}</Info>
      )}
      <FollowFooter build={d.build} admin={d.admin} reload={reload} />
    </Box>
  );
}

/* ── the evolution ─────────────────────────────────────────────────────── */

function Evolution({ f, label, pick, setPick, imports }: { f: NewFigures; label: string; pick: Pick | null; setPick: (p: Pick | null) => void; imports: string | null }) {
  const now = f.now, was = f.before;
  const prev = previousWindow(now.from, now.to);
  const before = rangeLabel(prev.from, prev.to);
  // the companies are read two years back - a period whose days before reach further has nothing whole to compare with
  const single = prev.from < f.since;
  const delta = (a: number, b: number) => (!single && b ? { ratio: a / b - 1, versus: before, goodWhenUp: true } : undefined);
  const prospects = now.seg.APSOprospect ?? 0;
  const owner = (id: string) => (id ? f.owners[id] ?? `Owner ${id}` : "No owner");
  const srcName = (k: string) => (k.startsWith("person:") ? sourceLabel("person", k.slice(7) || undefined, f.users) : sourceLabel(k, undefined, f.users));
  const dim = (cur: Record<string, number>, prv: Record<string, number>, name: (k: string) => string): DimRow[] =>
    [...new Set([...Object.keys(cur), ...Object.keys(prv)])].map((k) => ({ id: k, label: name(k), n: cur[k] ?? 0, b: prv[k] ?? 0 })).filter((x) => x.n || x.b);
  const srcs = dim(now.src, was.src, srcName);
  const moves = dim(now.moves, was.moves, (k) => k);
  const segs = dim(now.seg, was.seg, (k) => k);
  const countries = dim(now.country, was.country, (k) => k);
  const owners = dim(now.owner, was.owner, owner);
  const choose = (kind: Kind, rows: { id: string; label: string }[]) => (l: string) => {
    const x = rows.find((y) => y.label === l);
    if (!x) return;
    setPick(pick?.kind === kind && pick.key === x.id ? null : { kind, key: x.id, label: l });
    if (typeof document !== "undefined") setTimeout(() => document.getElementById("new-companies-list")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };
  const sel = (kind: Kind) => (pick?.kind === kind ? [pick.label] : undefined);
  const data = f.buckets.map((b) => ({ x: b.x, ...stackOf(b.seg) }));
  type MRow = { id: string; label: string; n: number; micro: number; prospect: number; changed: number; still: number; customer: number; bought: number; revenue: number; prio: number };
  const mrow = (id: string, l: string, x: { n: number; first: Record<string, number>; seg: Record<string, number>; changed: number; bought: number; revenue: number; prio: Record<string, number> }): MRow => ({
    id, label: l, n: x.n, micro: x.first.APSOmicro ?? 0, prospect: x.first.APSOprospect ?? 0, changed: x.changed, still: x.seg.APSOprospect ?? 0,
    customer: [...CUSTOMER].reduce((a, s) => a + (x.seg[s] ?? 0), 0), bought: x.bought, revenue: x.revenue, prio: (x.prio["1"] ?? 0) + (x.prio["2"] ?? 0) + (x.prio["3"] ?? 0),
  });
  const mrows = f.buckets.map((b) => mrow(b.x, bucketLabel(b.x), b));
  const cols: Col<MRow>[] = [
    { key: "n", head: "New companies", cell: (x) => full(x.n), sort: (x) => x.n },
    { key: "micro", head: "Came as APSOmicro", cell: (x) => (x.micro ? `${full(x.micro)} · ${pct(x.micro, x.n)}` : "—"), sort: (x) => x.micro },
    { key: "prospect", head: "Came as APSOprospect", cell: (x) => (x.prospect ? `${full(x.prospect)} · ${pct(x.prospect, x.n)}` : "—"), sort: (x) => x.prospect },
    { key: "changed", head: "Segment changed since", cell: (x) => (x.changed ? `${full(x.changed)} · ${pct(x.changed, x.n)}` : "—"), sort: (x) => x.changed },
    { key: "still", head: "Still APSOprospect", cell: (x) => (x.still ? `${full(x.still)} · ${pct(x.still, x.n)}` : "—"), sort: (x) => x.still },
    { key: "customer", head: "A customer segment today", cell: (x) => (x.customer ? `${full(x.customer)} · ${pct(x.customer, x.n)}` : "—"), sort: (x) => x.customer },
    { key: "prio", head: "P1 to P3 today", cell: (x) => (x.prio ? `${full(x.prio)} · ${pct(x.prio, x.n)}` : "—"), sort: (x) => x.prio },
    { key: "bought", head: "Bought since", cell: (x) => (x.bought ? `${full(x.bought)} · ${pct(x.bought, x.n)}` : "—"), sort: (x) => x.bought },
    { key: "revenue", head: "Revenue since", cell: (x) => (x.revenue ? eur(x.revenue) : "—"), sort: (x) => x.revenue },
  ];
  const total = mrow("", `All the new companies, ${label}`, now);
  return (
    <>
      <Tiles now={now} was={was} label={label} delta={delta} prospects={prospects} />
      <Funnel now={now} label={label} picked={pick} onPick={(kind, key, l) => {
        setPick(pick?.kind === kind && pick.key === key ? null : { kind, key, label: l });
        if (typeof document !== "undefined") setTimeout(() => document.getElementById("new-companies-list")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      }} />
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<InsightsOutlinedIcon />} tint="blue" title={f.byDay ? "Day by day" : "Month by month"}
          note={`The ${full(now.n)} companies created ${inSentence(label)}, by the APSO segment each has today${f.byDay ? "" : ". The first and last month count only the days inside the period"}`} />
        <StackedColumns data={data} parts={STACK.map(({ key, label: l, color }) => ({ key, label: l, color }))} format={(v) => full(v ?? 0)} xFormat={bucketLabel} />
      </GlassCard>
      <Box sx={TWO}>
        <DimChart title={`Where they came from, ${label}`} rows={srcs} cur={(x) => x.n} prev={(x) => x.b} curLabel={label} prevLabel={before} fmt={full} labelWidth={230} single={single}
          selected={sel("src")} onPick={choose("src", srcs)} />
        <DimChart title={`Their segment today, ${label}`} rows={segs} cur={(x) => x.n} prev={(x) => x.b} curLabel={label} prevLabel={before} fmt={full} labelWidth={190} single={single}
          curNote={(x) => ({ text: pct(x.n, now.n), color: MUTED })} selected={sel("seg")} onPick={choose("seg", segs)} />
      </Box>
      <Box sx={TWO}>
        <DimChart title={`From their first segment to today, ${label}`} rows={moves} cur={(x) => x.n} prev={(x) => x.b} curLabel={label} prevLabel={before} fmt={full} labelWidth={260} single={single}
          selected={sel("move")} onPick={choose("move", moves)} />
        <DimChart title={`By country, ${label}`} rows={countries} cur={(x) => x.n} prev={(x) => x.b} curLabel={label} prevLabel={before} fmt={full} labelWidth={170} single={single}
          selected={sel("country")} onPick={choose("country", countries)} />
      </Box>
      <Box sx={TWO}>
        <DimChart title={`Their owner today, ${label}`} rows={owners} cur={(x) => x.n} prev={(x) => x.b} curLabel={label} prevLabel={before} fmt={full} labelWidth={190} single={single}
          selected={sel("owner")} onPick={choose("owner", owners)} />
      </Box>
      <ChartBox title={`All the figures, ${label}, by ${f.byDay ? "day" : "month"} of creation`}
        hint={`What the companies created each ${f.byDay ? "day" : "month"} came as, and what they are today · bought and revenue: invoiced since the year each was created · a click on a row lists its companies`}>
        <FullTable first={f.byDay ? "Day" : "Month"} cols={cols} rows={mrows} total={total} natural onPick={choose("bucket", mrows)} selected={sel("bucket")} />
      </ChartBox>
      <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: -1 }}>
        Read {when(f.at)} - every company created since {rangeLabel(f.since, f.since)}, each with the first value its APSO segment ever had, who wrote it and when; its segment, priority, owner and revenue as HubSpot has them today.
      </Typography>
      {pick && (
        <Box id="new-companies-list" sx={{ scrollMarginTop: 16, minWidth: 0 }}>
          <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
            <CardTitle icon={<ListAltIcon />} tint="slate" title={pick.label} note={`Created ${inSentence(label)} - newest first`}
              right={<Button size="small" onClick={() => setPick(null)} startIcon={<CloseIcon sx={{ fontSize: 16 }} />} sx={{ textTransform: "none" }}>Close</Button>} />
            <CompanyList from={now.from} to={now.to} pick={pick} f={f} imports={imports} />
          </GlassCard>
        </Box>
      )}
    </>
  );
}

/** Four counts, one unit - companies: the period's new ones, then three of what became of them (shares of the first). */
function Tiles({ now, was, label, delta, prospects }: { now: Side; was: Side; label: string; delta: (a: number, b: number) => { ratio: number; versus: string; goodWhenUp: boolean } | undefined; prospects: number }) {
  const w = now.who;
  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<DomainAddOutlinedIcon />} tint="blue" label="New companies" value={full(now.n)} delta={delta(now.n, was.n)}
        note={`Created ${inSentence(label)}${delta(now.n, was.n) ? `; ${full(was.n)} the days before` : ""}.`} /></Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<BoltOutlinedIcon />} tint="green" label="Segmented within the hour" value={full(now.fast)}
        note={`${pct(now.fast, now.n)} of them got their APSO segment within an hour of being created${w.none ? `; ${full(w.none)} have none yet` : ""}.`} /></Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<HourglassEmptyOutlinedIcon />} tint="amber" label="Still APSOprospect" value={full(prospects)}
        note={`${pct(prospects, now.n)} of them have the segment they came with or got no other; ${full(now.changed)} changed segment since.`} /></Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<ShoppingCartOutlinedIcon />} tint="purple" label="Bought since" value={full(now.bought)}
        note={`${pct(now.bought, now.n)} of them have an invoice since the year they were created - ${eur(now.revenue)} in all.`} /></Grid>
    </Grid>
  );
}

/** The companies behind a pick: newest first, the 300 newest of any number. */
function CompanyList({ from, to, pick, f, imports }: { from: string; to: string; pick: Pick; f: NewFigures; imports: string | null }) {
  const [q, setQ] = useState(""), [asked, setAsked] = useState("");
  const params = new URLSearchParams({ list: "1", from, to, [pick.kind]: pick.key, ...(imports ? { imports } : {}), ...(asked ? { q: asked } : {}) });
  const url = `${API}?${params}`;
  const r = useHeld<{ rows: NewCo[]; total: number }>(url, [url]).result;
  const rows = r?.state === "ok" ? r.data.rows : [];
  const { slice, pager } = usePaged(rows, 25);
  return (
    <>
      <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); setAsked(q.trim()); }} sx={{ display: "flex", gap: 0.75, mb: 1.5, alignItems: "center" }}>
        <TextField size="small" placeholder="a word of the name, or a company id" value={q} onChange={(e) => setQ(e.target.value)} sx={{ width: 280 }} />
        <Button type="submit" size="small" variant="outlined" sx={{ textTransform: "none" }}>Find</Button>
        {asked && <Button size="small" onClick={() => { setQ(""); setAsked(""); }} sx={{ textTransform: "none" }}>Clear</Button>}
        {r === null && <CircularProgress size={14} />}
      </Box>
      {r?.state === "ok" && r.data.total > rows.length && <Typography sx={{ fontSize: "0.78rem", color: MUTED, mb: 1 }}>The {full(rows.length)} newest of {full(r.data.total)} - a word of the name or a shorter period narrows them.</Typography>}
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead><TableRow>{["Created", "Company", "Country", "Came from", "First segment", "Today", "Bought since", "Owner"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {slice.map((x) => (
              <TableRow key={x.id} hover>
                <TableCell sx={{ ...bodyCell, color: MUTED, fontSize: "0.78rem", whiteSpace: "nowrap" }}>{rangeLabel(x.d, x.d)}</TableCell>
                <TableCell sx={bodyCell}>
                  <Box component="a" href={hsCompany(x.id)} target="_blank" rel="noopener" sx={{ color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(260) }}>{x.n || x.id}</Box>
                  <Typography sx={{ fontSize: "0.7rem", color: FAINT }}>{x.c ? `${full(x.c)} contact${x.c === 1 ? "" : "s"}` : "no contact"}{x.dom ? "" : " · no domain"}</Typography>
                </TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap" }}>{x.k ? countryName(x.k) : "—"}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.78rem", ...clip(220) }}>{sourceLabel(x.src, x.by, f.users)}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                  {x.f || <Box component="span" sx={{ color: FAINT }}>none</Box>}
                  {x.f && <Typography sx={{ fontSize: "0.7rem", color: MUTED }}>{SET_BY_LABEL[x.fb]}{x.fm !== null ? `, ${x.fm < 120 ? `${x.fm} min` : x.fm < 2880 ? `${Math.round(x.fm / 60)} h` : `${Math.round(x.fm / 1440)} days`} after` : ""}</Typography>}
                </TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap", fontWeight: x.s !== x.f ? 700 : 400 }}>
                  {x.s || <Box component="span" sx={{ color: FAINT }}>none</Box>}
                  <Typography sx={{ fontSize: "0.7rem", color: MUTED }}>{PRIO[x.p] ?? x.p}</Typography>
                </TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap", color: x.r > 0 ? INK : FAINT }}>{x.r > 0 ? eur(x.r) : "—"}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap" }}>{x.o ? f.owners[x.o] ?? `Owner ${x.o}` : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      {pager}
      {r?.state === "ok" && !rows.length && <Typography sx={{ fontSize: "0.85rem", color: MUTED, mt: 1 }}>No company.</Typography>}
      {r?.state === "error" && <Typography sx={{ fontSize: "0.85rem", color: RED, mt: 1 }}>{r.error}</Typography>}
    </>
  );
}

/* ── the scan, live ───────────────────────────────────────────────────── */

/** Every company in HubSpot without an APSO segment, read when asked - the one figure that says the job is done. */
function Unsegmented({ u }: { u: Unsegmented | null }) {
  if (!u) return <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>The companies without an APSO segment could not be read just now.</Typography>;
  if (!u.total) return null;
  return (
    <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>
      {u.rows.map((x, i) => (
        <span key={x.id}>{i ? ", " : ""}<Box component="a" href={hsCompany(x.id)} target="_blank" rel="noopener" sx={{ color: "#2459d1" }}>{x.n || x.id}</Box> ({when(x.t)})</span>
      ))}
      {u.total > u.rows.length ? ` and ${full(u.total - u.rows.length)} more` : ""}
    </Typography>
  );
}

type Filter = "all" | "micro" | "prospect" | "differs";

function Status({ x }: { x: ScanRow }) {
  if (x.w === "written") return <Chip tint="green">written</Chip>;
  if (x.w === "error") return <Chip tint="pink">not written</Chip>;
  return <Chip tint={x.w === "waiting" ? "amber" : "slate"}>{x.w === "waiting" ? "waits for the workflow" : "would write"}</Chip>;
}

type Live = LiveState & { admin: boolean; engineLive: boolean };
const ago = (ms: number) => (ms < 90_000 ? `${Math.max(0, Math.round(ms / 1000))} s ago` : ms < 5_400_000 ? `${Math.round(ms / 60_000)} min ago` : `${Math.round(ms / 3_600_000)} h ago`);
const hm = (iso: string) => new Date(iso).toLocaleTimeString("de-CH", { timeZone: "Europe/Zurich", hour: "2-digit", minute: "2-digit", second: "2-digit" });
const RULE_SHORT: Record<RuleKey, string> = { freemail: "Free mail → APSOmicro", small: "1–5 employees → APSOmicro", other: "Any other → APSOprospect" };
const RULE_COLOR: Record<RuleKey, string> = { freemail: SEGMENT_COLOR.APSOmicro, small: "#c3b2f7", other: SEGMENT_COLOR.APSOprospect };

/** One stage of today's funnel. */
function Stage({ label, value, note, tint, children, last }: { label: string; value: string; note: string; tint: string; children?: React.ReactNode; last?: boolean }) {
  return (
    <Box sx={{ display: "flex", alignItems: "stretch", gap: 1, minWidth: 0 }}>
      <Box sx={{ flex: 1, minWidth: 0, borderRadius: "16px", border: "1px solid rgba(21,34,58,.08)", borderTop: `3px solid ${tint}`, bgcolor: "rgba(255,255,255,.75)", p: 1.75, display: "grid", gap: 0.5, alignContent: "start" }}>
        <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: MUTED }}>{label}</Typography>
        <Typography sx={{ fontSize: "1.9rem", fontWeight: 800, color: INK, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{value}</Typography>
        <Typography sx={{ fontSize: "0.74rem", color: MUTED, lineHeight: 1.45 }}>{note}</Typography>
        {children}
      </Box>
      {!last && <Box sx={{ display: { xs: "none", lg: "flex" }, alignItems: "center", color: FAINT, fontSize: "1.3rem" }}>→</Box>}
    </Box>
  );
}

/**
 * The scan as it happens (SARCLA 02.11.2026: "it doesn't look alive - track it like a funnel, by the rules and the
 * stages"): its pulse and switch, today's funnel - created, in the 20 minutes' wait, given a segment by the hub (by rule),
 * none without one - the days since the hub took over, and every decision. Asks again every 30 seconds.
 */
function LiveScan({ steering }: { steering?: React.ReactNode }) {
  const [tick, setTick] = useState(0), [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const a = setInterval(() => setTick((x) => x + 1), 30_000), b = setInterval(() => setClock(Date.now()), 1000);
    return () => { clearInterval(a); clearInterval(b); };
  }, []);
  const url = `${API}?live=1${tick ? `&t=${tick}` : ""}`;
  const r = useHeld<Live>(url, [url]).result;
  // the last answer stays on screen while the next one is on its way
  const [d, setD] = useState<Live | null>(null);
  useEffect(() => { if (r?.state === "ok") setD(r.data); }, [r]);
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const rowsAll = d?.rows ?? [];
  const test: Record<Filter, (x: ScanRow) => boolean> = {
    all: () => true, micro: (x) => x.seg === "APSOmicro", prospect: (x) => x.seg === "APSOprospect", differs: (x) => !!x.actual && x.actual.seg !== x.seg,
  };
  const { slice, pager } = usePaged(rowsAll.filter(test[filter]), 10);
  if (!d) return r?.state === "error" ? <Typography sx={{ color: RED, fontSize: "0.86rem" }}>{r.error}</Typography> : <LoadingPanel label="Reading the scan…" />;
  const setMode = async (m: "off" | "shadow" | "live") => {
    if (!d.admin || m === d.settings.mode) return;
    if (m === "live" && !window.confirm("Switch the scan to live? The hub writes the first APSO segment of every new company once the HubSpot workflow is switched off.")) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "mode", mode: m }) });
      const j = (await res.json()) as { ok: boolean; error?: string };
      setMsg(j.ok ? null : j.error ?? `HTTP ${res.status}`);
      setTick((x) => x + 1);
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };
  const mode = d.settings.mode, last = d.last;
  const since = last ? clock - Date.parse(last.at) : Infinity;
  const alive = d.writing && since < 5 * 60_000 && !last?.error;
  const tone = last?.error ? RED : alive ? "#1b7a55" : mode === "off" ? FAINT : "#eda100";
  const today = d.days[d.today] ?? { written: 0, freemail: 0, small: 0, other: 0, errors: 0 };
  const none = d.unsegmented?.total ?? null;
  const dayKeys = Object.keys(d.days).sort().slice(-21);
  const compared = rowsAll.filter((x) => x.actual), agree = compared.filter((x) => x.actual!.seg === x.seg).length;
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
      <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", flexWrap: "wrap", mb: 2 }}>
        <Box sx={{ position: "relative", width: 14, height: 14, mt: 0.6, flexShrink: 0 }}>
          <Box sx={{ position: "absolute", inset: 0, borderRadius: "50%", bgcolor: tone }} />
          {alive && <Box sx={{ position: "absolute", inset: -4, borderRadius: "50%", border: `2px solid ${tone}`, animation: "scanPulse 1.8s ease-out infinite", "@keyframes scanPulse": { "0%": { transform: "scale(.6)", opacity: 0.9 }, "100%": { transform: "scale(1.6)", opacity: 0 } } }} />}
        </Box>
        <Box sx={{ flex: 1, minWidth: 260 }}>
          <Typography sx={{ fontSize: "1.02rem", fontWeight: 800, color: INK }}>
            {!d.engineLive ? "The scan runs where the hub runs Smart Segmentation" : mode === "off" ? "The scan is off" : mode === "shadow" ? "Paused - the hub works each new company out, writes nothing" : d.writing ? "Live - the hub gives every new company its first APSO segment" : "Live - waiting for the HubSpot workflow to be switched off"}
          </Typography>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
            {last ? `Last pass ${hm(last.at)} - ${ago(since)}: ${full(last.found)} without a segment, ${full(last.written)} written${last.error ? ` - ${last.error}` : ""}. ` : "No pass yet. "}
            Every 2 minutes; a company is decided 20 minutes after it is created. The HubSpot workflow is {d.workflowOn === null ? "not readable" : d.workflowOn ? "switched ON" : "switched off"}{d.writing && d.settings.liveFrom ? `; the hub writes since ${when(d.settings.liveFrom)}` : ""}.
          </Typography>
        </Box>
        {d.admin && <Choice<"off" | "shadow" | "live"> value={mode} onChange={(m) => void setMode(m)} options={[{ key: "live", label: "Live" }, { key: "shadow", label: "Paused" }, { key: "off", label: "Off" }]} />}
        {busy && <CircularProgress size={14} />}
      </Box>
      {msg && <Typography sx={{ fontSize: "0.82rem", color: RED, mb: 1 }}>{msg}</Typography>}

      <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK, mb: 1 }}>Today, {rangeLabel(d.today, d.today)}</Typography>
      <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" } }}>
        <Stage label="1 · Created" value={d.createdToday === null ? "—" : full(d.createdToday)} tint={SEGMENT_COLOR["Growth Engine Customer"]} note="new companies in HubSpot since midnight" />
        <Stage label="2 · In the 20 minutes' wait" value={d.waiting === null ? "—" : full(d.waiting)} tint="#eda100" note="created in the last 20 minutes with no segment yet - decided when the 20 minutes are up" />
        <Stage label="3 · Segmented by the hub" value={full(today.written)} tint="#1b7a55"
          note={today.errors ? `${full(today.errors)} refused by HubSpot` : "by the three rules, written to HubSpot"}>
          <Box sx={{ display: "grid", gap: 0.5, mt: 0.5 }}>
            {RULES.map((k) => (
              <Box key={k} sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 36px", gap: 1, alignItems: "center" }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.7rem", color: MUTED, ...clip(220) }}>{RULE_SHORT[k]}</Typography>
                  <Box sx={{ height: 5, borderRadius: 3, bgcolor: "rgba(21,34,58,.06)", overflow: "hidden" }}><Box sx={{ height: "100%", width: `${today.written ? (100 * today[k]) / today.written : 0}%`, bgcolor: RULE_COLOR[k] }} /></Box>
                </Box>
                <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: INK, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{full(today[k])}</Typography>
              </Box>
            ))}
          </Box>
        </Stage>
        <Stage last label="4 · Missed - no segment after the wait" value={none === null ? "—" : full(none)} tint={none ? RED : "#1b7a55"}
          note={none === null ? "could not be read just now" : none === 0 ? "none: every company in HubSpot past its 20 minutes has an APSO segment - read just now" : "past their 20 minutes and still without one, in all of HubSpot - the hub picks them up at its next pass"}>
          <Unsegmented u={d.unsegmented} />
        </Stage>
      </Box>

      {dayKeys.length > 0 && (
        <Box sx={{ mt: 2.5 }}>
          <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>Day by day since the hub took over</Typography>
          <Typography sx={{ fontSize: "0.74rem", color: MUTED, mb: 1 }}>The companies the hub gave their first segment each day, by the rule that decided</Typography>
          <StackedColumns height={170} data={dayKeys.map((k) => ({ x: k, freemail: d.days[k].freemail, small: d.days[k].small, other: d.days[k].other }))}
            parts={RULES.map((k) => ({ key: k, label: RULE_LABEL[k], color: RULE_COLOR[k] }))} format={(v) => full(v ?? 0)} xFormat={(x) => `${x.slice(8, 10)}.${x.slice(5, 7)}`} />
        </Box>
      )}

      <Box sx={{ mt: 2.5, display: "grid", gap: 1 }}>
        <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>Every decision, the newest first</Typography>
        {compared.length > 0 && (
          <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>
            Before the switch the hub only worked each company out: of the {full(compared.length)} the workflow (or someone) segmented, it would have given the same to {full(agree)} ({pct(agree, compared.length)}).
          </Typography>
        )}
        <Choice<Filter> value={filter} onChange={setFilter} options={[
          { key: "all", label: "All", count: rowsAll.length }, { key: "prospect", label: "APSOprospect", count: rowsAll.filter(test.prospect).length },
          { key: "micro", label: "APSOmicro", count: rowsAll.filter(test.micro).length }, { key: "differs", label: "Someone gave another", count: rowsAll.filter(test.differs).length },
        ]} />
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>{["Created", "Company", "Domain", "Employees", "The rule", "", "Given in HubSpot"].map((h, i) => <TableCell key={i} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {slice.map((x) => (
                <TableRow key={x.id} hover>
                  <TableCell sx={{ ...bodyCell, color: MUTED, fontSize: "0.78rem", whiteSpace: "nowrap" }}>{when(x.t)}</TableCell>
                  <TableCell sx={bodyCell}><Box component="a" href={hsCompany(x.id)} target="_blank" rel="noopener" sx={{ color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(220) }}>{x.n || x.id}</Box></TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: x.dom ? INK : FAINT, ...clip(170) }}>{x.dom || "none"}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: x.emp ? INK : FAINT }}>{x.emp || "—"}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap" }}>{x.seg}<Typography sx={{ fontSize: "0.7rem", color: MUTED }}>{x.why}</Typography></TableCell>
                  <TableCell sx={bodyCell}><Status x={x} />{x.err && <Typography sx={{ fontSize: "0.7rem", color: RED }}>{x.err}</Typography>}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap", color: !x.actual ? FAINT : x.actual.seg === x.seg ? INK : RED, fontWeight: x.actual && x.actual.seg !== x.seg ? 700 : 400 }}>
                    {x.actual ? <>{x.actual.seg}<Typography sx={{ fontSize: "0.7rem", color: MUTED }}>{SET_BY_LABEL[x.actual.by]}</Typography></> : x.w === "written" ? `by the hub, ${hm(x.at)}` : "not yet"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
        {pager}
        {!rowsAll.length && <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{mode === "off" ? "Off - no company is looked at." : "No decision yet - the next new company shows here 20 minutes after it is created."}</Typography>}
      </Box>
      {steering && (
        <Box sx={{ mt: 2.5, display: "grid", gap: 1 }}>
          <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>Their priority and potential - the watcher</Typography>
          {steering}
        </Box>
      )}
    </GlassCard>
  );
}

/**
 * The period's funnel (SARCLA 02.11.2026: "track it like a funnel, by the rules and the different stages"): of the
 * companies created, how many the rules segmented (and by which rule), how many within the hour, how many have a P1 to P3
 * priority today, bought since, are in a customer segment today. Each bar is a share of the companies created; a click
 * lists them.
 */
function Funnel({ now, label, onPick, picked }: { now: Side; label: string; onPick: (kind: Kind, key: string, l: string) => void; picked: Pick | null }) {
  const n = now.n, others = n - now.byRules - (now.who.none ?? 0);
  const top = (now.prio["1"] ?? 0) + (now.prio["2"] ?? 0) + (now.prio["3"] ?? 0);
  type Row = { label: string; value: number; note: string; kind?: Kind; key?: string; color: string; indent?: boolean };
  const rows: Row[] = [
    { label: "Created", value: n, note: `the new companies, ${inSentence(label)}`, color: SEGMENT_COLOR["Growth Engine Customer"] },
    { label: "Segmented by the rules", value: now.byRules, note: `the workflow until 02.11.2026, the hub since; ${full(others)} got theirs another way (an import, a data sync, a person), ${full(now.who.none ?? 0)} none yet`, kind: "byRules", key: "1", color: "#1b7a55" },
    ...RULES.map((k) => ({ label: RULE_LABEL[k], value: now.rules[k] ?? 0, note: "", kind: "rule" as Kind, key: k, color: RULE_COLOR[k], indent: true })),
    { label: "Within the hour", value: now.fast, note: "their first segment came within an hour of the creation", kind: "fast", key: "1", color: "#5b8def" },
    { label: "A priority P1 to P3 today", value: top, note: "a basis of 500 € or more - worth a salesperson's time", color: "#eda100" },
    { label: "Bought since", value: now.bought, note: `an invoice since the year they were created - ${full(Math.round(now.revenue))} € in all`, kind: "bought", key: "1", color: "#13866a" },
    { label: "A customer segment today", value: now.customer, note: "APSOcore, APSOgrowth or Growth Engine", kind: "customer", key: "1", color: SEGMENT_COLOR.APSOcore },
  ];
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
      <CardTitle icon={<FilterAltOutlinedIcon />} tint="green" title={`From created to customer, ${label}`}
        note="Every stage is a share of the companies created; the three rules are the ones the workflow and now the hub decide by. A click on a stage lists its companies" />
      <Box sx={{ display: "grid", gap: 0.75 }}>
        {rows.map((x) => {
          const on = !!x.kind && picked?.kind === x.kind && picked.key === x.key;
          return (
            <Box key={x.label} component={x.kind ? "button" : "div"} type={x.kind ? "button" : undefined} onClick={x.kind ? () => onPick(x.kind!, x.key!, x.label) : undefined}
              sx={{ all: "unset", display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "250px minmax(0, 1fr) 120px" }, gap: { xs: 0.5, md: 1.5 }, alignItems: "center", cursor: x.kind ? "pointer" : "default",
                pl: x.indent ? { xs: 2, md: 3 } : 0, py: 0.5, borderRadius: "10px", bgcolor: on ? "rgba(36,89,209,.06)" : "transparent", "&:hover": x.kind ? { bgcolor: "rgba(21,34,58,.03)" } : undefined }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: x.indent ? "0.8rem" : "0.88rem", fontWeight: x.indent ? 500 : 700, color: INK }}>{x.label}</Typography>
                {x.note && <Typography sx={{ fontSize: "0.72rem", color: MUTED, lineHeight: 1.4 }}>{x.note}</Typography>}
              </Box>
              <Box sx={{ height: x.indent ? 10 : 18, borderRadius: "6px", bgcolor: "rgba(21,34,58,.05)", overflow: "hidden" }}>
                <Box sx={{ height: "100%", width: `${n ? Math.max(0.4, (100 * x.value) / n) : 0}%`, bgcolor: x.color, borderRadius: "6px", transition: "width .4s ease" }} />
              </Box>
              <Typography sx={{ fontSize: x.indent ? "0.8rem" : "0.9rem", fontWeight: 700, color: INK, textAlign: { xs: "left", md: "right" }, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                {full(x.value)} <Box component="span" sx={{ color: MUTED, fontWeight: 500 }}>· {pct(x.value, n)}</Box>
              </Typography>
            </Box>
          );
        })}
      </Box>
    </GlassCard>
  );
}

/** When the two years' companies were read, and an admin's "read them again". */
function FollowFooter({ build, admin, reload }: { build: BuildInfo | null; admin: boolean; reload: () => void }) {
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState<string | null>(null);
  const again = async () => {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "follow" }) });
      const j = (await res.json()) as { ok: boolean; error?: string };
      setMsg(j.ok ? "Reading them again - a few minutes." : j.error ?? `HTTP ${res.status}`);
      reload();
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
      <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>
        {build?.running ? `Reading the last two years' companies - ${build.progress}.` : build?.at ? `The two years' companies read ${when(build.at)}${build.rows ? ` (${full(build.rows)} in ${full(build.seconds)} s)` : ""}, every night after the sweep.` : ""}
        {build?.error ? ` The last read failed: ${build.error}` : ""}
      </Typography>
      {admin && <Button variant="outlined" size="small" disabled={busy || !!build?.running} onClick={() => void again()} sx={{ textTransform: "none" }}>Read them again</Button>}
      {(busy || build?.running) && <CircularProgress size={14} />}
      {msg && <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>{msg}</Typography>}
    </Box>
  );
}
