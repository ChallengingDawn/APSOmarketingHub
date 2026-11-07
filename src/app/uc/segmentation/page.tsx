"use client";

// SMART SEGMENTATION - every company's sales priority, kept alive.
//
// Moved from the APSOAssistant micro apps (05.10.2026). The engine is ported to
// the hub (src/lib/integrations/segmentation.ts) and takes over from the Compass
// connector at the switch (SEGMENTATION_ENGINE=live); until then this page shows
// the portfolio and runs previews, and the connector keeps writing.

import { useCallback, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import RefreshIcon from "@mui/icons-material/Refresh";
import StarOutlineIcon from "@mui/icons-material/StarOutline";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import LanguageOutlinedIcon from "@mui/icons-material/LanguageOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, NotConnectedPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { INK, KpiTile, MUTED, TINT } from "@/app/uc/report/ui";
import { DimChart } from "@/app/reporting/marketing-kpis/DimChart";
import { Table as KitTable } from "@/app/reporting/marketing-kpis/ExplorerKit";
import { ChartBox, TWO } from "@/app/reporting/eso-benchmark/Figures";
import { CompanyDialog } from "@/app/reporting/CompanyList";
import { Choice } from "@/app/connectors/parts";
import { NO_SEGMENT } from "@/lib/segmentation/companies";
import Collapse from "@mui/material/Collapse";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { ReportTabs, useHashTab } from "@/app/uc/report/Tabs";
import ProfitCentre, { type PcRun } from "./ProfitCentre";
import { pctText } from "@/app/uc/oneshot/parts";
import { WindowPicker } from "@/app/window/ReportingWindow";
import { PotentialChanges } from "./PotentialChanges";
import { HowItWorks } from "./HowItWorks";
import { NewCompanies } from "./NewCompanies";
import { RunTopic, type Run, type Status, type Topic } from "./Runs";
import { ProfitCentreKpis } from "./ProfitCentreKpis";
import { ListCard, PRIO_LABEL, hubSource, type Fixed } from "./lists";

type Breakdown = {
  total: number; with_apso_customer: number; empty: number; by_value: Record<string, number>; other: number; lost_with_current_revenue: number;
  without_segment?: { id: string; name: string }[];
};
type Data = { status: Status; breakdown: Breakdown; last: Record<string, Run> };

type TabId = "overview" | "new" | "profit-centre" | "changes" | "sweep" | "web" | "yearly" | "properties";
const TAB_HASH: Record<TabId, string> = { overview: "#overview", new: "#new-companies", "profit-centre": "#profit-centre", changes: "#potential-changes", sweep: "#nightly-sweep", web: "#websites", yearly: "#yearly", properties: "#how-it-works" };

const PROPERTY_ROWS: [string, string, string][] = [
  ["sales_priority", "New-company watcher (about 3 min after creation) · the buttons · nightly sweep · the yearly reclassification",
    "MAX(yearly potential, best revenue year) → P1 ≥ 25'000 € · P2 ≥ 2'500 € · P3 ≥ 500 €. The nightly sweep never lowers it; when a rep changes a potential, the priority follows it up or down; once a year every priority is set exactly to the rule, up or down."],
  ["yearly_customer_potential", "Watcher seeds a starter value ONLY when empty · nightly recalculation of machine-written values",
    "300 € micro · 500–800 € by APIC product fit · revenue × multiplier when revenue exists. A person's value is never overwritten; values > 1 M € without matching revenue are ignored in the maths."],
  ["max_pot_or_turnover", "Wherever the priority is computed", "= MAX(yearly potential, best revenue year) - the basis behind the priority."],
  ["max_revenue_2015_2026", "Wherever the priority is computed", "Best Performis revenue year since 2015."],
  ["max_revenue_bucket", "Wherever the priority is computed", "Fine 0–8 revenue scale (0 = no turnover … 8 = ≥ 100 k€)."],
  ["apso_customer", "New companies: the hub's scan, 20 minutes after creation (since 02.11.2026 - the HubSpot workflow is off) · nightly lost-recovery · the yearly reclassification",
    "20 minutes after creation APSOmicro (free mail domain or 1–5 employees) or APSOprospect; APSOlost that bought this year becomes APSOcore (≥ 500 €) or APSOprospect; once a year the 14-rule waterfall decides every segment again - ERP segments (ESO, DS, Growth Engine) never."],
  ["apic_ap / industry / hs_keywords", "Watcher and full runs, when empty · the yearly reclassification",
    "From the industry mapping or DE/FR/IT/EN keywords in the name, description and website - only valid portal values. Once a year a generic 1.1 APIC is corrected or cleared from the industry; resellers (3.x) never change."],
  ["description / employees / address / website", "Website enrichment, when empty", "Read from the company's own site (meta description, schema.org); country falls back to the domain (.ch → Switzerland). Each site at most once per 30 days."],
  ["revenue_2015 … revenue_<this year>", "Compass daily sync", "Input only - segmentation never writes revenue."],
];

/**
 * Notes, folded away.
 *
 * They used to stack as full-width coloured bars above the page, so the first
 * thing anyone saw was a wall of warnings about things that fix themselves -
 * "the next sweep recovers them", "(preview) started". One quiet line that says
 * how many there are, and opens if you want them (SARCLA, 20.10.2026).
 */
function Notes({ items }: { items: { tone: "bad" | "warn"; text: React.ReactNode }[] }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  const bad = items.filter((i) => i.tone === "bad").length;
  return (
    <Box sx={{ mb: 2 }}>
      <Box
        component="button"
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        sx={{
          display: "flex", alignItems: "center", gap: 1, width: "100%", textAlign: "left",
          border: `1px solid ${TINT}`, borderRadius: "10px", bgcolor: "#fff", cursor: "pointer",
          px: 1.5, py: 0.9, font: "inherit", color: INK,
          "&:hover": { bgcolor: "#fafbfc" },
        }}
      >
        <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: bad ? "#c5221f" : "#eda100", flexShrink: 0 }} />
        <Typography sx={{ fontSize: 13, color: MUTED }}>
          {items.length === 1 ? "1 note" : `${items.length} notes`}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <KeyboardArrowDownIcon sx={{ fontSize: 18, color: MUTED, transform: open ? "rotate(180deg)" : "none", transition: "transform .18s ease" }} />
      </Box>
      <Collapse in={open}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, mt: 1 }}>
          {items.map((i, k) => (
            <Box key={k} sx={{ display: "flex", gap: 1, alignItems: "flex-start", px: 1.5 }}>
              <Box component="span" sx={{ width: 6, height: 6, mt: 0.8, borderRadius: "50%", flexShrink: 0, bgcolor: i.tone === "bad" ? "#c5221f" : "#eda100" }} />
              <Typography sx={{ fontSize: 13, color: MUTED, lineHeight: 1.55 }}>{i.text}</Typography>
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}

type Prio = { p1: number; p2: number; p3: number; p4: number };

/**
 * What each APSO segment means, in a line under its bar (07.11.2026: "peux-tu ajouter la def de APSOprospect... à
 * côté"). The rules behind them: the first segment at creation (lib/segmentation/newCompanies firstSegment) and the
 * yearly waterfall (lib/segmentation/yearly YEARLY_RULES) - a segment says how big a company is and what it buys,
 * never its potential; that is the priority's job.
 */
const SEGMENT_MEANS: Record<string, string> = {
  APSOprospect: "New, or buys under 500 € a year",
  APSOlost: "Bought before, nothing in 3 years",
  APSOcore: "Buys 500 € or more a year",
  APSOgrowth: "Buys 500 €+, potential 30 % higher",
  APSOmicro: "1–5 employees or a free mail",
  "Growth Engine Customer": "From the ERP, never changed here",
  "ESO-Customer": "From the ERP, never changed here",
  "DS Customer": "From the ERP, never changed here",
  "No sales focus": "2+ years old, never bought",
  [NO_SEGMENT]: "Not classified yet",
  "Other values": "More than one segment",
};

/**
 * The portfolio: the priorities and the segments as the reporting pages draw a breakdown - a click on a bar opens its
 * companies in the window - and every company below, live from HubSpot (SARCLA 02.11.2026: "you don't have the button
 * on the modal and the design changes from page to page").
 */
function Portfolio({ st, bd, p }: { st: Status; bd: Breakdown; p: Prio }) {
  const [pick, setPick] = useState<{ fixed: Fixed; label: string } | null>(null);
  const [seg, setSeg] = useState("all"), [prio, setPrio] = useState("all");
  const all = hubSource({});
  const prios = [
    { id: "1", label: "P1 · 25,000 € or more", n: p.p1 }, { id: "2", label: "P2 · 2,500 – 24,999 €", n: p.p2 }, { id: "3", label: "P3 · 500 – 2,499 €", n: p.p3 },
    { id: "4", label: "No priority · under 500 €", n: p.p4 }, ...(st.empty ? [{ id: "", label: "No priority yet", n: st.empty }] : []),
  ];
  const segs = [
    ...Object.entries(bd.by_value).map(([k, n]) => ({ id: k, label: k, n })),
    ...(bd.empty > 0 ? [{ id: NO_SEGMENT, label: NO_SEGMENT, n: bd.empty }] : []),
    // more than one value: no single list to open
    ...(bd.other > 0 ? [{ id: "", label: "Other values", n: bd.other }] : []),
  ];
  const open = (rows: { id: string; label: string }[], fixed: (id: string) => Fixed | null, what: string) => (l: string) => {
    const x = rows.find((y) => y.label === l), f = x && fixed(x.id);
    if (f) setPick({ fixed: f, label: `${what}: ${l}` });
  };
  return (
    <Box id="segmentation-panel-overview" role="tabpanel" sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>
      <Box sx={TWO}>
        <DimChart title="Sales priority, every company" rows={prios} cur={(x) => x.n} prev={() => 0} curLabel="Companies" prevLabel="" fmt={full} single fixedOrder labelWidth={210}
          curNote={(x) => ({ text: pctText(x.n, st.total), color: MUTED })} companies={all} pickHint="From the higher of the yearly potential and the best revenue year since 2015 - it follows every change of the potential within minutes · a click on a bar lists its companies"
          selected={pick?.fixed.prio !== undefined ? [prios.find((x) => x.id === pick.fixed.prio)?.label ?? ""] : undefined} onPick={open(prios, (id) => ({ prio: id }), "Sales priority")} />
        <DimChart title="APSO segment, every company" rows={segs} cur={(x) => x.n} prev={() => 0} curLabel="Companies" prevLabel="" fmt={full} single labelWidth={210}
          labelNote={(x) => SEGMENT_MEANS[x.label]}
          curNote={(x) => ({ text: pctText(x.n, bd.total), color: MUTED })} companies={all}
          pickHint="Set when a company is created and again once a year, from its size and what it buys - not from its potential, so a small company can have a high priority · a click on a bar lists its companies"
          selected={pick?.fixed.seg !== undefined ? [pick.fixed.seg] : undefined} onPick={open(segs, (id) => (id ? { seg: id } : null), "APSO segment")} />
      </Box>
      <ListCard title="The companies" hint="Every company in HubSpot, live - the largest basis first; narrow it by segment, priority or a name, a click on a column orders by it"
        source={hubSource({ ...(seg !== "all" ? { seg } : {}), ...(prio !== "all" ? { prio } : {}) })}>
        <Choice<string> value={seg} onChange={setSeg} options={[{ key: "all", label: "Every segment" }, ...segs.filter((x) => x.id).map((x) => ({ key: x.id, label: `${x.label} · ${full(x.n)}` }))]} />
        <Choice<string> value={prio} onChange={setPrio} options={[{ key: "all", label: "Every priority" }, ...prios.map((x) => ({ key: x.id, label: `${PRIO_LABEL[x.id]} · ${full(x.n)}` }))]} />
      </ListCard>
      {pick && <CompanyDialog source={hubSource(pick.fixed)} title={pick.label} onClose={() => setPick(null)} />}
    </Box>
  );
}

export default function SmartSegmentation() {
  const [tab, selectTab] = useHashTab<TabId>(TAB_HASH, "overview");
  const [tick, setTick] = useState(0);
  const [role, setRole] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/me/access").then((r) => (r.ok ? r.json() : null)).then((j) => setRole(j?.role ?? null)).catch(() => {});
  }, []);
  const url = `/api/uc/segmentation${tick ? `?refresh=1&n=${tick}` : ""}`;
  const held = useHeld<Data>(url, [url]);
  const r = held.result;
  const d = r?.state === "ok" ? r.data : null;
  const st = d?.status;
  const running = !!st?.running;

  // while a run is going, look again every 10 seconds
  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => setTick((n) => n + 1), 10_000);
    return () => clearTimeout(t);
  }, [running, tick]);

  // "profit-centre started" used to sit there for ever: it was set on the press
  // and cleared only by the NEXT press, so a finished run still said "started"
  // and the page read as stuck (SARCLA, 20.10.2026).
  const wasRunning = useRef(false);
  useEffect(() => {
    if (wasRunning.current && !running) setNote(null);
    wasRunning.current = running;
  }, [running]);

  const act = useCallback(async (what: string, dry: boolean, extra = "") => {
    setNote(null);
    const j = await fetch(`/api/uc/segmentation/action?do=${what}&dry=${dry ? 1 : 0}${extra}`, { method: "POST" }).then((x) => x.json()).catch(() => null);
    const ok = Boolean(j?.ok);
    setNote(ok ? j.data.note : j?.error ?? "Could not start.");
    setTimeout(() => setTick((n) => n + 1), 1500);
    // A run short enough to finish between two polls never flips `running`, so
    // the effect above never fires. An error stays until the next press.
    // Only a note about a run that ACTUALLY started expires. A refusal comes
    // back as ok:true with started:false, and used to be wiped by this timer -
    // so the one message explaining why nothing happened disappeared.
    if (ok && j.data?.started) setTimeout(() => setNote((cur) => (cur === j.data.note ? null : cur)), 90_000);
  }, []);
  const toggleWeb = useCallback(async (on: boolean) => {
    const j = await fetch(`/api/uc/segmentation/web-toggle?enabled=${on ? 1 : 0}`, { method: "POST" }).then((x) => x.json()).catch(() => null);
    if (!j?.ok) setNote(j?.error ?? "Could not switch.");
    setTick((n) => n + 1);
  }, []);

  const header = (
    <PageHeader
      title="Smart Segmentation"
      subtitle="Every company's sales priority from its potential and its best revenue year - new companies within minutes, the whole portfolio every night"
      rightSlot={
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {(r === null || held.stale) && <CircularProgress size={14} sx={{ color: MUTED }} />}
          {(tab === "changes" || tab === "new") && <WindowPicker />}
          <Tooltip title="Count again in HubSpot">
            <IconButton size="small" onClick={() => setTick((n) => n + 1)} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton>
          </Tooltip>
        </Box>
      }
    />
  );
  const shell = (children: React.ReactNode) => (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>{header}{children}</Box>
  );
  if (r === null) return shell(<LoadingPanel label="Counting the portfolio in HubSpot…" />);
  if (r.state === "not-configured") return shell(<NotConnectedPanel source="HubSpot" missing={r.missing} />);
  if (r.state === "error") return shell(<UpstreamPanel source="HubSpot (segmentation)" error={r.error} status={r.status} onRetry={() => setTick((n) => n + 1)} />);
  if (!d || !st) return shell(null);

  const bd = d.breakdown;
  const p = { p1: st.prio_1 ?? 0, p2: st.prio_2 ?? 0, p3: st.prio_3 ?? 0, p4: st.prio_4 ?? 0 };
  const prioritised = p.p1 + p.p2 + p.p3;
  const live = st.engine === "hub";
  const admin = role === "admin";

  const run = (topic: Topic) => <RunTopic topic={topic} st={st} admin={admin} live={live} running={running} act={act} toggleWeb={toggleWeb} />;
  return shell(
    <>
      <Notes items={[
        ...(!live ? [{ tone: "warn" as const, text: "The Compass connector still runs the engine (watcher, nightly sweep). This page shows the portfolio live and runs previews; the hub takes over at the switch." }] : []),
        ...(bd.lost_with_current_revenue > 0 ? [{ tone: "bad" as const, text: `${full(bd.lost_with_current_revenue)} companies are marked APSOlost but bought this year - the next sweep recovers them.` }] : []),
        ...(note ? [{ tone: "warn" as const, text: note }] : []),
      ]} />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<StarOutlineIcon />} tint="green" label="Prioritised" value={full(prioritised)}
            note={`${pctText(prioritised, st.total)} of ${full(st.total)} companies · P1 ${full(p.p1)} · P2 ${full(p.p2)} · P3 ${full(p.p3)}`} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<RemoveCircleOutlineIcon />} tint="amber" label="No priority" value={full(p.p4)}
            note={`basis under 500 € · ${st.no_prio_share_pct ?? "—"}% of the portfolio`} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<HelpOutlineIcon />} tint={st.empty ? "pink" : "green"} label="No priority yet" value={full(st.empty)}
            note={st.empty ? "no sales_priority yet - the watcher or the next run fills them" : "every company has a sales priority"} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<LanguageOutlinedIcon />} tint="purple" label="Websites to read" value={full(st.web_candidates)}
            note={`a domain but no description · new companies ${st.web_new_enabled ? "read automatically" : "not read automatically"}`} />
        </Grid>
      </Grid>

      <Box>
        <ReportTabs name="segmentation" tab={tab} onSelect={selectTab} tabs={[
          { id: "overview", label: "Portfolio", count: null },
          { id: "new", label: "New companies", count: null },
          { id: "profit-centre", label: "Profit center", count: null },
          { id: "changes", label: "Potential changes", count: null },
          { id: "sweep", label: "Nightly sweep", count: running && st.running?.what === "sweep" ? "running" : null },
          { id: "web", label: "Websites", count: null },
          { id: "yearly", label: "Yearly", count: null },
          { id: "properties", label: "How it works", count: null },
        ]} />
      </Box>

      {tab === "profit-centre" && <ProfitCentreKpis />}
      {tab === "profit-centre" && (
        <ProfitCentre
          last={(st?.last_profit_centre ?? null) as PcRun}
          windowYears={Number(st?.pc_window_years ?? 3)}
          running={running}
          runningWhat={st?.running?.what ?? null}
          runningSince={st?.running?.started ?? null}
          note={note}
          progress={st?.pc_progress ?? null}
          lastOutcome={(d?.last?.["profit-centre"] ?? null) as { error?: string; notStarted?: boolean; at?: string } | null}
          canRun={role === "admin"}
          onRun={(dry) => void act("profit-centre", dry)}
        />
      )}
      {tab === "overview" && <Portfolio st={st} bd={bd} p={p} />}

      {tab === "new" && <NewCompanies steering={run("new")} />}

      {tab === "changes" && (
        <Box id="segmentation-panel-changes" role="tabpanel" sx={{ minWidth: 0 }}>
          <Box sx={{ display: "grid", gap: 2.5 }}>{run("potential")}<PotentialChanges /></Box>
        </Box>
      )}

      {(tab === "sweep" || tab === "web" || tab === "yearly") && <Box role="tabpanel" sx={{ minWidth: 0 }}>{run(tab)}</Box>}

      {tab === "properties" && (
        <Box id="segmentation-panel-properties" role="tabpanel" sx={{ minWidth: 0, display: "grid", gap: 2.5 }}>
          <HowItWorks />
          <ChartBox title="Every property it writes - and nothing else" hint="These are ALL the fields the engine changes; everything else on a company is only read. A person's value is never overwritten">
            <KitTable head={["Property", "Written by", "Rule"]} left={[1, 2]} firstWidth="minmax(190px, 0.8fr)" widths={["minmax(220px, 1.2fr)", "minmax(280px, 2fr)"]} minWidth={820}
              rows={PROPERTY_ROWS.map(([prop, who, rule]) => ({ key: prop, cells: [
                <Box key="p" component="span" sx={{ fontFamily: "monospace", fontSize: "0.78rem" }}>{prop}</Box>,
                <Box key="w" component="span" sx={{ fontSize: "0.82rem", fontWeight: 400 }}>{who}</Box>,
                <Box key="r" component="span" sx={{ fontSize: "0.82rem", color: MUTED, fontWeight: 400 }}>{rule}</Box>,
              ] }))} />
          </ChartBox>
        </Box>
      )}
    </>,
  );
}
