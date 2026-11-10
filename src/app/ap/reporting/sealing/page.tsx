"use client";
// SEALING BUSINESS REVIEW - the Angst+Pfister hub's first report (SARCLA 10.11.2026), from the Executive Committee's
// pilot of the same name: who buys, what sells, which materials and compounds lead, which approvals are written - and
// the three commercial priorities, found in the figures. Every business unit's sealing (profit centre DT) invoices from
// the ERP's BI model, read each morning (src/lib/apHub).
//
// Drawn with the hub's accepted report parts - figure tiles, one tab per breakdown, the bars this year against the same
// months a year before, then "All the figures" - never a look of its own.

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import CircularProgress from "@mui/material/CircularProgress";
import EuroOutlinedIcon from "@mui/icons-material/EuroOutlined";
import PercentOutlinedIcon from "@mui/icons-material/PercentOutlined";
import SavingsOutlinedIcon from "@mui/icons-material/SavingsOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";

import { HomeBar } from "@/app/HomeBar";
import { riseKeyframes } from "@/app/reporting/ui";
import { CardTitle, FAINT, GlassCard, INK, KpiTile, MUTED, eur } from "@/app/uc/report/ui";
import { ReportTabs, useHashTab } from "@/app/uc/report/Tabs";
import { DimChart } from "@/app/reporting/marketing-kpis/DimChart";
import { FullTable, H1, TWO, type Col } from "@/app/reporting/eso-benchmark/Figures";
import type { SealingView } from "@/lib/apHub/sealingStore";
import type { Figure, Priority } from "@/lib/apHub/sealingRules";

type Tab = "overview" | "units" | "customers" | "articles" | "materials" | "approvals";
const HASHES: Record<Tab, string> = {
  overview: "#overview", units: "#business-units", customers: "#customers", articles: "#articles", materials: "#materials", approvals: "#approvals",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "Jan – Oct 2026" */
const periodName = (from: string, to: string) => {
  const [fy, fm] = from.split("-").map(Number), [ty, tm] = to.split("-").map(Number);
  return fy === ty ? `${MONTHS[fm - 1]} – ${MONTHS[tm - 1]} ${ty}` : `${MONTHS[fm - 1]} ${fy} – ${MONTHS[tm - 1]} ${ty}`;
};
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const ratio = (now: number, before: number) => (before ? now / before - 1 : null);

type Row = { label: string; key: string; rev: number; gp: number; margin: number; prev: number; compound?: string };
const rowsOf = (a: (Figure & { compound?: string })[]): Row[] => a.map((x) => ({ label: x.name, key: x.key, rev: x.rev, gp: x.gp, margin: x.margin, prev: x.prev ?? 0, compound: x.compound }));

export default function SealingBusinessReview() {
  const [tab, setTab] = useHashTab<Tab>(HASHES, "overview");
  const [year, setYear] = useState<string>("");
  const [bu, setBu] = useState("");
  const [channel, setChannel] = useState(""); // the query's Channel is the selling organisation (dim_customer[Channel], 10.11.2026), not OEM - all by default
  const [d, setD] = useState<SealingView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    const q = new URLSearchParams();
    // a past year: the whole year; the latest: the year so far (the server's default)
    if (year && d?.meta.lastMonth && year !== d.meta.lastMonth.slice(0, 4)) { q.set("from", `${year}-01`); q.set("to", `${year}-12`); }
    if (bu) q.set("bu", bu);
    if (channel) q.set("channel", channel);
    setBusy(true);
    fetch(`/api/ap/sealing?${q}`)
      .then((r) => r.json())
      .then((j) => { if (j?.ok) { setD(j as SealingView); setError(null); } else setError(j?.error ?? "The figures could not be read."); })
      .catch((e) => setError(String(e)))
      .finally(() => setBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, bu, channel]);

  const years = useMemo(() => {
    if (!d?.meta.firstMonth || !d.meta.lastMonth) return [];
    const out: string[] = [];
    for (let y = Number(d.meta.lastMonth.slice(0, 4)); y >= Number(d.meta.firstMonth.slice(0, 4)); y--) out.push(String(y));
    return out;
  }, [d?.meta.firstMonth, d?.meta.lastMonth]);

  const empty = d !== null && d.meta.rows === 0;
  const now = d ? periodName(d.period.from, d.period.to) : "";
  const before = d ? periodName(d.period.prevFrom, d.period.prevTo) : "";
  const curLabel = d ? d.period.to.slice(0, 4) : "";
  const prevLabel = d ? d.period.prevTo.slice(0, 4) : "";

  const select = (value: string, set: (v: string) => void, options: [string, string][], label: string) => (
    <Select size="small" value={value} onChange={(e) => set(String(e.target.value))} displayEmpty aria-label={label}
      sx={{ fontSize: "0.85rem", borderRadius: "12px", bgcolor: "rgba(255,255,255,.8)", minWidth: 150 }}>
      {options.map(([v, t]) => <MenuItem key={v} value={v} sx={{ fontSize: "0.85rem" }}>{t}</MenuItem>)}
    </Select>
  );

  return (
    <Box sx={{ maxWidth: 1480, mx: "auto", px: { xs: 2, md: 3 }, py: { xs: 2, md: 2.5 }, ...riseKeyframes }}>
      <HomeBar hub="ap" />

      <Box sx={{ mt: { xs: 2, md: 3 }, display: "flex", alignItems: "flex-end", gap: 2, flexWrap: "wrap" }}>
        <Box sx={{ flex: 1, minWidth: 260 }}>
          <Typography component="h1" sx={H1}>Sealing Business Review</Typography>
          <Typography sx={{ fontSize: "0.92rem", color: MUTED, mt: 0.75 }}>
            {d && !empty
              ? `Every business unit's sealing invoices (profit centre DT), ${now}, against ${before}.`
              : "Every business unit's sealing invoices (profit centre DT)."}
          </Typography>
        </Box>
        {d && !empty && (
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            {select(year || curLabel, setYear, years.map((y) => [y, y === years[0] ? `${y} so far` : y]), "Year")}
            {select(bu, setBu, [["", "All business units"], ...d.meta.bus.map((b): [string, string] => [b, b])], "Business unit")}
            {select(channel, setChannel, [["", "All sales organisations"], ...d.meta.channels.map((c): [string, string] => [c, c])], "Sales organisation")}
          </Box>
        )}
      </Box>

      {error && <Typography sx={{ mt: 2, color: "#c5221f", fontSize: "0.9rem" }}>{error}</Typography>}
      {!d && !error && <Box sx={{ display: "grid", placeItems: "center", py: 10 }}><CircularProgress size={28} /></Box>}

      {empty && (
        <GlassCard sx={{ mt: 2.5 }}>
          <CardTitle icon={<SavingsOutlinedIcon />} tint="amber" title="The figures arrive with the morning ERP workbook"
            note="One more query sheet in the workbook - the sealing invoices of every business unit from the BI model. The hub finds it by its columns and fills this page the same morning." />
          <Typography sx={{ fontSize: "0.86rem", color: MUTED, lineHeight: 1.6 }}>
            Columns: Month · Company · Channel · CustomerNumberUnique · CustomerName · Article · ArticleText · CompoundDesignationAP · Approval · NetRevenueEUR · GrossProfitEUR
          </Typography>
        </GlassCard>
      )}

      {d && !empty && (
        <Box sx={{ opacity: busy ? 0.55 : 1, transition: "opacity .2s ease" }}>
          <Box sx={{ display: "grid", gap: 1.5, mt: 2.25, gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "repeat(2, minmax(0,1fr))", lg: "repeat(4, minmax(0,1fr))" } }}>
            <KpiTile icon={<EuroOutlinedIcon />} tint="green" label={`Net revenue, ${now}`} value={eur(d.totals.rev)}
              delta={{ ratio: ratio(d.totals.rev, d.totals.prev.rev), versus: `vs ${before}` }} />
            <KpiTile icon={<PercentOutlinedIcon />} tint="blue" label={`Gross margin, ${now}`} value={pct(d.totals.margin)}
              note={`${pct(d.totals.prev.margin)} in ${before}`} />
            <KpiTile icon={<SavingsOutlinedIcon />} tint="purple" label={`Gross profit, ${now}`} value={eur(d.totals.gp)}
              delta={{ ratio: ratio(d.totals.gp, d.totals.prev.gp), versus: `vs ${before}` }} />
            <KpiTile icon={<GroupsOutlinedIcon />} tint="slate" label={`Customers invoiced, ${now}`} value={d.totals.customers.toLocaleString("de-CH")}
              note={`${d.totals.articles.toLocaleString("de-CH")} articles`} />
          </Box>

          <Box sx={{ mt: 2.5 }}>
            <ReportTabs name="sealing" tab={tab} onSelect={setTab} tabs={[
              { id: "overview", label: "Overview", count: null },
              { id: "units", label: "Business units", count: String(d.byBu.length) },
              { id: "customers", label: "Customers", count: d.totals.customers.toLocaleString("de-CH") },
              { id: "articles", label: "Articles", count: d.totals.articles.toLocaleString("de-CH") },
              { id: "materials", label: "Materials & compounds", count: String(d.compounds.length) },
              { id: "approvals", label: "Approvals", count: String(d.approvals.length) },
            ]} />
          </Box>

          <Box sx={{ mt: 2, display: "grid", gap: 2 }}>
            {tab === "overview" && <Overview d={d} now={now} curLabel={curLabel} prevLabel={prevLabel} />}
            {tab === "units" && <Breakdown title={`Net revenue ${now}, by business unit`} rows={rowsOf(d.byBu)} first="Business unit" curLabel={curLabel} prevLabel={prevLabel} />}
            {tab === "customers" && <Breakdown title={`Net revenue ${now}, by customer`} rows={rowsOf(d.customers)} first="Customer" curLabel={curLabel} prevLabel={prevLabel} find="a customer" />}
            {tab === "articles" && <Breakdown title={`Net revenue ${now}, by article`} rows={rowsOf(d.articles)} first="Article" curLabel={curLabel} prevLabel={prevLabel} find="an article" withCompound />}
            {tab === "materials" && (
              <>
                <Breakdown title={`Net revenue ${now}, by material family`} rows={rowsOf(d.byFamily)} first="Material family" curLabel={curLabel} prevLabel={prevLabel}
                  note={`Named compounds only - ${pct(d.noCompoundShare)} of the revenue names none. The family follows the pilot's rule (FFKM, HNBR, FKM, EPDM, NBR, VMQ, PTFE).`} />
                <Breakdown title={`Net revenue ${now}, by compound`} rows={rowsOf(d.compounds)} first="Compound" curLabel={curLabel} prevLabel={prevLabel} find="a compound" />
              </>
            )}
            {tab === "approvals" && <Approvals d={d} now={now} />}
          </Box>

          <Typography sx={{ mt: 2.5, fontSize: "0.76rem", color: FAINT }}>
            Source: the ERP&apos;s BI model, sealing (profit centre DT) invoices in EUR, read with the morning workbook
            {d.meta.loadedAt ? ` · last read ${new Date(d.meta.loadedAt).toLocaleString("de-CH", { dateStyle: "short", timeStyle: "short" })}` : ""}.
            Gross margin = gross profit over net revenue of the same rows. The priorities are illustrative, never a forecast.
          </Typography>
        </Box>
      )}
    </Box>
  );
}

function Overview({ d, now, curLabel, prevLabel }: { d: SealingView; now: string; curLabel: string; prevLabel: string }) {
  return (
    <>
      <GlassCard>
        <CardTitle icon={<LightbulbOutlinedIcon />} tint="amber" title="Commercial priorities"
          note={`Found in ${now}'s figures - evidence, then a next move. Validate before acting.`} />
        {d.priorities.length === 0
          ? <Typography sx={{ fontSize: "0.88rem", color: MUTED }}>Nothing in this selection meets the thresholds.</Typography>
          : (
            <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "minmax(0,1fr)", lg: `repeat(${d.priorities.length}, minmax(0,1fr))` } }}>
              {d.priorities.map((p, i) => <PriorityCard key={p.kind} p={p} i={i} />)}
            </Box>
          )}
      </GlassCard>
      <Box sx={TWO}>
        <GlassCard>
          <DimChart title={`Net revenue ${now}, by business unit`} rows={rowsOf(d.byBu)} cur={(r) => r.rev} prev={(r) => r.prev}
            curLabel={curLabel} prevLabel={prevLabel} fmt={eur} pickHint="" />
        </GlassCard>
        <GlassCard>
          <DimChart title={`Net revenue ${now}, by material family`} rows={rowsOf(d.byFamily)} cur={(r) => r.rev} prev={(r) => r.prev}
            curLabel={curLabel} prevLabel={prevLabel} fmt={eur} pickHint="" />
        </GlassCard>
      </Box>
    </>
  );
}

const KIND_NAME: Record<Priority["kind"], string> = { margin: "Margin improvement", growth: "Growth focus", spread: "Account comparison" };

function PriorityCard({ p, i }: { p: Priority; i: number }) {
  return (
    <Box sx={{ border: "1px solid rgba(21,34,58,.08)", borderRadius: "16px", p: 2, bgcolor: "rgba(255,255,255,.7)", display: "grid", gap: 1, alignContent: "start" }}>
      <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: FAINT }}>
        {String(i + 1).padStart(2, "0")} / {KIND_NAME[p.kind]}
      </Typography>
      <Typography sx={{ fontSize: "1rem", fontWeight: 600, color: INK, letterSpacing: "-0.015em" }}>{p.title}</Typography>
      <Typography sx={{ fontSize: "0.86rem", color: MUTED, lineHeight: 1.5 }}>{p.evidence}</Typography>
      <Typography sx={{ fontSize: "0.86rem", color: INK, lineHeight: 1.5 }}><b>Next move.</b> {p.next}</Typography>
      <Typography sx={{ fontSize: "0.8rem", color: FAINT, mt: 0.5 }}>
        {p.effect ? `${p.effectLabel}: ${eur(p.effect)} gross profit` : p.effectLabel}
      </Typography>
    </Box>
  );
}

function Breakdown({ title, rows, first, curLabel, prevLabel, find, withCompound = false, note }: {
  title: string; rows: Row[]; first: string; curLabel: string; prevLabel: string; find?: string; withCompound?: boolean; note?: string;
}) {
  const cols: Col<Row>[] = [
    ...(withCompound ? [{ key: "compound", head: "Compound", cell: (r: Row) => r.compound || "-" }] : []),
    { key: "rev", head: `Net revenue ${curLabel}`, cell: (r) => eur(r.rev), sort: (r) => r.rev },
    { key: "prev", head: `Net revenue ${prevLabel}`, cell: (r) => eur(r.prev), sort: (r) => r.prev },
    { key: "gp", head: "Gross profit", cell: (r) => eur(r.gp), sort: (r) => r.gp },
    { key: "margin", head: "GM %", cell: (r) => pct(r.margin), sort: (r) => r.margin },
  ];
  return (
    <>
      <Box sx={TWO}>
        <GlassCard>
          <DimChart title={title} rows={rows} cur={(r) => r.rev} prev={(r) => r.prev} curLabel={curLabel} prevLabel={prevLabel} fmt={eur} pickHint="" />
        </GlassCard>
        <GlassCard>
          <DimChart title={title.replace("Net revenue", "Gross margin")} rows={rows} cur={(r) => r.margin} prev={() => 0}
            curLabel={curLabel} prevLabel="" fmt={pct} single fixedOrder pickHint="" />
        </GlassCard>
      </Box>
      {note && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{note}</Typography>}
      <GlassCard>
        <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK, mb: 1 }}>All the figures, by {first.toLowerCase()}</Typography>
        <FullTable first={first} cols={cols} rows={rows} find={find} />
      </GlassCard>
    </>
  );
}

function Approvals({ d, now }: { d: SealingView; now: string }) {
  const rows = rowsOf(d.approvals);
  return (
    <>
      <GlassCard>
        <CardTitle icon={<LightbulbOutlinedIcon />} tint="slate" title="Which approvals matter?"
          note={`${pct(d.noApprovalShare)} of the revenue ${now} has no approval written on the article. A text can name several approvals, and the figures cannot tell which approval caused a sale.`} />
        <DimChart title={`Net revenue ${now}, by the approval written`} rows={rows} cur={(r) => r.rev} prev={() => 0}
          curLabel={now} prevLabel="" fmt={eur} single pickHint="" labelWidth={260} />
      </GlassCard>
      <GlassCard>
        <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK, mb: 1 }}>All the figures, by approval</Typography>
        <FullTable first="Approval as written" cols={[
          { key: "rev", head: "Net revenue", cell: (r) => eur(r.rev), sort: (r) => r.rev },
          { key: "gp", head: "Gross profit", cell: (r) => eur(r.gp), sort: (r) => r.gp },
          { key: "margin", head: "GM %", cell: (r) => pct(r.margin), sort: (r) => r.margin },
        ]} rows={rows} find="an approval" />
      </GlassCard>
    </>
  );
}
