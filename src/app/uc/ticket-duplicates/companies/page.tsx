"use client";

// DUPLICATES & MERGES > Companies (SARCLA 10.11.2026: "COMPANIES FULL DUPLICATE CHECK - then we need to migrate it to the
// hub; can we rework duplicates and merges to include a company duplicate check"; then "company duplicates should go
// inside of duplicates and merges, a main toggle on top to toggle between tickets and companies", "possible duplicates
// much more detailed ... allow to filter and to play with the table", "take out all mention of ERP" - the customer
// number). Overview = what the hub finds in every company now and the merges of the period; a tab per kind (the same
// customer number: merged by the hub once Live; possible duplicates: a person's Merge or Not duplicates); Left alone;
// Decisions; Settings.

import { useCallback, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import TextField from "@mui/material/TextField";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import RefreshIcon from "@mui/icons-material/Refresh";
import CloseIcon from "@mui/icons-material/Close";
import DomainOutlinedIcon from "@mui/icons-material/DomainOutlined";
import VerifiedOutlinedIcon from "@mui/icons-material/VerifiedOutlined";
import CallMergeOutlinedIcon from "@mui/icons-material/CallMergeOutlined";
import HourglassEmptyOutlinedIcon from "@mui/icons-material/HourglassEmptyOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import LabelOffOutlinedIcon from "@mui/icons-material/LabelOffOutlined";
import ErrorOutlineOutlinedIcon from "@mui/icons-material/ErrorOutlineOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import RuleOutlinedIcon from "@mui/icons-material/RuleOutlined";
import ManageSearchOutlinedIcon from "@mui/icons-material/ManageSearchOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, KpiTile, MUTED, RED, TINT, type Tint } from "@/app/uc/report/ui";
import { ReportTabs, useHashTab } from "@/app/uc/report/Tabs";
import { Chip, Info } from "@/app/connectors/parts";
import { ChartBox } from "@/app/reporting/eso-benchmark/Figures";
import { DimChart } from "@/app/reporting/marketing-kpis/DimChart";
import { ListCard, StatusCard, dayTime } from "@/app/uc/segmentation/lists";
import type { CompanySource } from "@/app/reporting/CompanyList";
import { WindowPicker, useReportingWindow } from "@/app/window/ReportingWindow";
import type { LogEntry, Mode, RunInfo, Settings, Snapshot } from "@/lib/companyDuplicates/engine";
import type { Company, Group, MergeEvent, Rules } from "@/lib/companyDuplicates/rules";
import { DupToggle } from "../DupToggle";
import { GroupTable } from "./GroupTable";
import { Decide, Decisions, useDecisionState } from "./decide";
import { PerformisView } from "./Performis";
import { KIND_LABEL, cap, dmy, kindOf, link, numberText, place, type Kind } from "./parts";

type Merge = MergeEvent & { name: string };
type Data = {
  settings: Settings; last: RunInfo | null; snapshot: Snapshot | null; workflow: boolean | null; log: LogEntry[]; apart: number; everyMinutes: number;
  from: string; to: string; days: number;
  history: { at: string; survivors: number; read: number; error: string | null; merges: Merge[] } | null;
  admin: boolean;
};
type TabId = "overview" | "erp" | "possible" | "left" | "decisions" | "settings";
const TAB_HASH: Record<TabId, string> = { overview: "#overview", erp: "#same-customer-number", possible: "#possible", left: "#left-alone", decisions: "#decisions", settings: "#settings" };
const COLOR = { both: "#1b7a55", place: "#2d6fa8", website: "#7c5cd6", other: "#c47a00", workflow: "#8a94a6", hub: "#2459d1", person: "#7c5cd6", rest: "#c9cfd8" };
const small = { fontSize: "0.8rem" } as const;
const POSSIBLE_KINDS: Kind[] = ["both", "place", "website", "other"];

type Answer = { ok: boolean; error?: string; data?: { text?: string; into?: string } };
async function send(method: "PUT" | "POST", body: object): Promise<Answer> {
  const r = await fetch("/api/uc/company-duplicates", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return (await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }))) as Answer;
}

const decideCell = (g: Group) => <Decide g={g} />;

/** A figure's groups in the table, in a window over the page. */
function useGroups() {
  const [open, setOpen] = useState<{ title: string; groups: Group[]; decide: boolean } | null>(null);
  return {
    show: (title: string, groups: Group[], decide = true) => { if (groups.length) setOpen({ title, groups, decide }); },
    dialog: (
      <Dialog open={!!open} onClose={() => setOpen(null)} maxWidth="xl" fullWidth>
        {open && (
          <Box sx={{ position: "relative", p: { xs: 1, md: 1.5 }, bgcolor: "#f6f8fb" }}>
            <IconButton onClick={() => setOpen(null)} aria-label="Close" size="small" sx={{ position: "absolute", top: 10, right: 10, zIndex: 1 }}><CloseIcon fontSize="small" /></IconButton>
            <GroupTable title={open.title} hint="A click on a company opens it in HubSpot - the one marked keeps, the others go into it" groups={open.groups} file="company-duplicates" icon={<ContentCopyOutlinedIcon />} decide={open.decide ? decideCell : undefined} />
          </Box>
        )}
      </Dialog>
    ),
  };
}

const Tiles = ({ items }: { items: { label: string; value: number; icon: React.ReactNode; tint: Tint; note: string }[] }) => (
  <Grid container spacing={2}>
    {items.map((k) => <Grid key={k.label} size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={k.icon} tint={k.tint} label={k.label} value={full(k.value)} note={k.note} /></Grid>)}
  </Grid>
);

// ---------------------------------------------------------------- the line every tab starts with

/** The hub merges: Live chosen and the workflow off. */
const merging = (d: Data) => d.settings.mode === "live" && d.workflow === false;
/** What Live merges by itself, as the rules stand - said on the switch, its question and the status line. */
const MERGE_HOUR = 60;
function liveWhat(r: Rules): string {
  const kinds = [r.erp.on && r.erp.autoMerge ? "the same customer number (into the oldest company)" : null, r.both.autoMerge ? "the same name, postcode and website (into the company with the customer number)" : null].filter(Boolean);
  return kinds.length ? `${kinds.join(" and ")} - at most ${MERGE_HOUR} merges an hour` : "nothing by itself - both automatic rules are off";
}
function Status({ d }: { d: Data }) {
  const s = d.settings, l = d.last;
  const live = merging(d), waiting = s.mode === "live" && !live;
  const tone = live ? "#1f8a4c" : waiting ? "#c47a00" : s.mode === "off" ? "#8a94a6" : TINT.blue.fg;
  const title = live ? `Live - the hub merges ${liveWhat(s.rules)}`
    : waiting ? (d.workflow === null ? "Live is chosen - the workflow's state cannot be read, the hub waits" : "Live is chosen - the hub waits for the COMPANIES FULL DUPLICATE CHECK workflow to be switched off")
    : s.mode === "off" ? "Off - nothing is read" : "Shadow - every company read every hour, nothing merged by itself";
  const line = [
    l ? (l.error ? `last read ${dayTime(l.at)} failed: ${l.error}` : `last read ${dayTime(l.at)}: ${full(l.read)} companies, ${full(l.sure)} the same customer number, ${full(l.possible)} possible${l.merged ? `, ${full(l.merged)} merged` : ""}`) : "first read about 3 minutes after the hub starts",
    // the workflow is named while it still runs - once off, the hub is the only one (no workflow words then)
    d.workflow !== false ? `the workflow ${d.workflow === null ? "not readable" : "still ON"}` : null,
    d.history ? `merges read back ${dayTime(d.history.at)}` : "merges read back after the first read",
  ].filter(Boolean).join(" · ");
  return <StatusCard tone={tone} beat={live || s.mode === "shadow"} title={title} line={line} />;
}

// ---------------------------------------------------------------- Overview

/** a person's name, or "A person" - an app's id ("App 123") or HubSpot's own source (lower case) is another app */
const who = (by: string) => (by === "The workflow" ? "workflow" : by === "APSOhub" ? "hub" : /^App \d/.test(by) || /^[a-z]/.test(by) ? "rest" : "person");
type WhoPart = "workflow" | "hub" | "person" | "rest";
const WHO_LABEL: Record<WhoPart, string> = { workflow: "The workflow (COMPANIES FULL DUPLICATE CHECK)", hub: "APSOhub", person: "A person in HubSpot", rest: "Another app or import" };
const axis = (x: string) => (x.length === 10 ? `${x.slice(8, 10)}.${x.slice(5, 7)}` : `${x.slice(5, 7)}.${x.slice(2, 4)}`);
const zDay = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Zurich" });

function MergesChart({ d }: { d: Data }) {
  const ev = d.history?.merges ?? [];
  const byDay = d.days <= 31;
  const series = useMemo(() => {
    const m = new Map<string, Record<WhoPart, number>>();
    for (let t = Date.parse(`${d.from}T00:00:00Z`); t <= Date.parse(`${d.to}T00:00:00Z`); t += 86400_000) {
      const x = new Date(t).toISOString().slice(0, byDay ? 10 : 7);
      if (!m.has(x)) m.set(x, { workflow: 0, hub: 0, person: 0, rest: 0 });
    }
    for (const e of ev) { const x = zDay(e.at).slice(0, byDay ? 10 : 7); const row = m.get(x); if (row) row[who(e.by) as WhoPart] += e.n; }
    return [...m.entries()].map(([x, v]) => ({ x, ...v }));
  }, [ev, d.from, d.to, byDay]);
  const parts = (["workflow", "hub", "person", "rest"] as WhoPart[]).filter((p) => series.some((s) => s[p]));
  return (
    <ChartBox title={byDay ? "Companies merged away, day by day" : "Companies merged away, month by month"}
      hint={d.history ? `Read back from HubSpot's history of every company others went into - ${full(d.history.survivors)} of them` : "Read back once a day, after the first read"}>
      {parts.length
        ? <StackedColumns data={series} parts={parts.map((p) => ({ key: p, label: WHO_LABEL[p], color: COLOR[p] }))} height={240} format={(n) => full(n ?? 0)} xFormat={axis} />
        : <Typography sx={{ ...small, color: FAINT }}>No merge in this period.</Typography>}
    </ChartBox>
  );
}

function CameChart({ groups, show }: { groups: Group[]; show: ReturnType<typeof useGroups>["show"] }) {
  // the last 12 months by the day the younger company came; earlier in one column
  const months: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) months.push(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)).toISOString().slice(0, 7));
  const data = ["before", ...months].map((x) => {
    const row: Record<string, number | string> = { x, both: 0, place: 0, website: 0, other: 0 };
    for (const g of groups) { const m = (g.newest ?? "").slice(0, 7); if ((x === "before" && m < months[0]) || m === x) (row[kindOf(g)] as number)++; }
    return row as { x: string } & Record<string, number>;
  });
  return (
    <ChartBox title="When the possible duplicates came" hint="By the month the younger company was created - the companies of February 2026's load show up here">
      <StackedColumns data={data} parts={POSSIBLE_KINDS.map((k) => ({ key: k, label: KIND_LABEL[k], color: COLOR[k as keyof typeof COLOR] }))}
        height={240} format={(n) => full(n ?? 0)} xFormat={(x) => (x === "before" ? "earlier" : axis(x))} />
      <Box sx={{ mt: 1 }}><Button size="small" onClick={() => show("Possible duplicates, newest first", groups)} sx={{ textTransform: "none" }}>List them</Button></Box>
    </ChartBox>
  );
}

function Overview({ d }: { d: Data }) {
  const f = d.snapshot?.found;
  const t = useGroups();
  if (!f) return <Info>The first read of every company starts about three minutes after the hub starts and takes a few minutes.</Info>;
  const merged = (d.history?.merges ?? []).reduce((a, e) => a + e.n, 0);
  const byWho = (p: WhoPart) => (d.history?.merges ?? []).filter((e) => who(e.by) === p).reduce((a, e) => a + e.n, 0);
  const countries = new Map<string, Group[]>();
  for (const g of f.possible) { const k = cap(g.members[0].country); (countries.get(k) ?? countries.set(k, []).get(k)!).push(g); }
  const kinds = POSSIBLE_KINDS.map((k) => ({ label: KIND_LABEL[k], n: f.possible.filter((g) => kindOf(g) === k).length, k }));
  return (
    <>
      <Tiles items={[
        { label: "Companies read", value: f.counts.read, icon: <DomainOutlinedIcon />, tint: "blue", note: `${full(f.counts.withErp)} with a customer number · ${full(f.counts.placeholders)} with "no customer number" written in it` },
        { label: "The same customer number", value: f.sure.length, icon: <VerifiedOutlinedIcon />, tint: "green", note: `${full(f.sure.reduce((a, g) => a + g.members.length, 0))} companies · ${merging(d) ? "merged by the hub" : "the hub merges these once Live"}` },
        { label: "Possible duplicates", value: f.possible.length, icon: <HourglassEmptyOutlinedIcon />, tint: "purple", note: `${full(f.possible.reduce((a, g) => a + g.members.length, 0))} companies · for a person: Merge or Not duplicates` },
        { label: "Merged away in the period", value: merged, icon: <CallMergeOutlinedIcon />, tint: "slate", note: `${d.days} days · ${full(byWho("workflow"))} by the workflow, ${full(byWho("hub"))} by the hub, ${full(byWho("person"))} by people` },
      ]} />
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 6 }}><MergesChart d={d} /></Grid>
        <Grid size={{ xs: 12, lg: 6 }}><CameChart groups={f.possible} show={t.show} /></Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <DimChart title="Possible duplicates by what they share" rows={kinds} cur={(r) => r.n} prev={() => 0} curLabel="Groups" prevLabel="" fmt={(n) => full(n)} single fixedOrder
            onPick={(label) => { const k = kinds.find((x) => x.label === label)?.k; if (k) t.show(`Possible duplicates - ${label.toLowerCase()}`, f.possible.filter((g) => kindOf(g) === k)); }} pickHint="Click a bar for its companies" labelWidth={190} />
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <DimChart title="Possible duplicates by country" rows={[...countries.entries()].map(([label, g]) => ({ label, n: g.length }))} cur={(r) => r.n} prev={() => 0} curLabel="Groups" prevLabel="" fmt={(n) => full(n)} single
            onPick={(label) => t.show(`Possible duplicates - ${label}`, countries.get(label) ?? [])} pickHint="Click a bar for its companies" pageSize={8} labelWidth={150} />
        </Grid>
      </Grid>
      {t.dialog}
    </>
  );
}

// ---------------------------------------------------------------- the rules, at the top of their tab

const BOX = { border: `1px solid ${HAIRLINE}`, borderRadius: "12px", p: 1.5, height: "100%", boxSizing: "border-box" } as const;
function SwitchRow({ title, text, checked, disabled, onChange, chips }: { title: string; text: React.ReactNode; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void; chips?: React.ReactNode }) {
  return (
    <Box sx={{ ...BOX, borderColor: checked ? "rgba(36,89,209,.35)" : HAIRLINE }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
        <Typography sx={{ fontSize: "0.88rem", fontWeight: 800, color: INK }}>{title}</Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
          {chips}
          <Switch checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} slotProps={{ input: { "aria-label": title } }} />
        </Box>
      </Box>
      <Typography component="div" sx={{ fontSize: "0.76rem", color: MUTED, mt: 0.25, lineHeight: 1.45 }}>{text}</Typography>
    </Box>
  );
}
function useSave(onSaved: () => void) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const save = async (body: { mode?: Mode; rules?: Partial<Rules> }, ask?: string) => {
    if (ask && !window.confirm(ask)) return;
    setBusy(true); setMsg(null);
    try { const j = await send("PUT", body); setMsg(j.ok ? "Saved - the next read uses it." : j.error ?? "Failed"); onSaved(); } finally { setBusy(false); }
  };
  return { busy, msg, save };
}

function NumberTab({ d, onSaved }: { d: Data; onSaved: () => void }) {
  const r = d.settings.rules, f = d.snapshot?.found;
  const { busy, msg, save } = useSave(onSaved);
  const AUTO_ASK = `Let the hub merge the same customer number by itself?\n\nOnce Live, every hour: two companies with the same customer number in the same Mandant merged into the oldest (at most ${MERGE_HOUR} merges an hour, with the other automatic rule). A merge cannot be undone in HubSpot.`;
  return (
    <>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<RuleOutlinedIcon />} tint="green" title="The rule" note="The same customer number in the same Mandant is one customer - the others go into the oldest company" />
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, md: 6 }}>
            <SwitchRow title="Find the same customer number" checked={r.erp.on} disabled={!d.admin || busy} onChange={(v) => void save({ rules: { erp: { ...r.erp, on: v } } })}
              text={<>Only a real number counts: <b>{full(f?.counts.placeholders ?? 0)}</b> companies carry a text saying they have none (a lead, created by ESO) - those are never one customer. The same number in two Mandants (AG and GmbH) is two ledgers: never merged.</>} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <SwitchRow title="Merge them by itself, once Live" checked={r.erp.autoMerge} disabled={!d.admin || busy || !r.erp.on} onChange={(v) => void save({ rules: { erp: { ...r.erp, autoMerge: v } } }, v ? AUTO_ASK : undefined)}
              chips={merging(d) && r.erp.autoMerge ? <Chip tint="pink">LIVE</Chip> : undefined}
              text={`Every company read again first. A group of more than ${r.erp.maxGroup} companies is never merged by itself - a person looks. Off: listed here, Merge by a click.`} />
          </Grid>
        </Grid>
        {msg && <Typography sx={{ ...small, color: MUTED, mt: 1 }}>{msg}</Typography>}
      </GlassCard>
      <GroupTable title="The same customer number, now" hint={`From the read of ${d.snapshot ? dayTime(d.snapshot.at) : "—"} - the company marked keeps, the others go into it`}
        groups={f?.sure ?? []} file="same-customer-number" icon={<VerifiedOutlinedIcon />} decide={decideCell} review />
    </>
  );
}

function PossibleTab({ d, onSaved }: { d: Data; onSaved: () => void }) {
  const r = d.settings.rules, f = d.snapshot?.found;
  const { busy, msg, save } = useSave(onSaved);
  const BOTH_ASK = "Let the hub merge the same name, postcode and website by itself?\n\nOnce Live, every hour: companies with all three the same and at most one customer number merged into the company with the number (else the oldest) - at most 40 groups a read. A merge cannot be undone in HubSpot.";
  return (
    <>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<RuleOutlinedIcon />} tint="purple" title="The rules" note="Never two customer numbers (a group's companies), never one website in two countries (its sites) - those are under Left alone. Merge puts the others into the company with the customer number, else the oldest" />
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, md: 6, lg: 3 }}>
            <SwitchRow title="Name, postcode and website: merge by itself" checked={r.both.autoMerge} disabled={!d.admin || busy} onChange={(v) => void save({ rules: { both: { autoMerge: v } } }, v ? BOTH_ASK : undefined)}
              chips={merging(d) && r.both.autoMerge ? <Chip tint="pink">LIVE</Chip> : undefined}
              text={`All three the same and at most one customer number: merged into the company with the number, else the oldest - every company read again first, ${f ? full(f.possible.filter((g) => g.shared.length > 1).length) : "—"} groups now. Off: they wait here for a click.`} />
          </Grid>
          <Grid size={{ xs: 12, md: 6, lg: 3 }}>
            <SwitchRow title="The same name at the same postcode" checked={r.place.on} disabled={!d.admin || busy} onChange={(v) => void save({ rules: { place: { on: v } } })}
              text='In one country, the names compared without legal forms, accents and signs - "Huwyler Klima AG" is "HUWYLER KLIMA".' />
          </Grid>
          <Grid size={{ xs: 12, md: 6, lg: 3 }}>
            <SwitchRow title="The same website" checked={r.website.on} disabled={!d.admin || busy} onChange={(v) => void save({ rules: { website: { ...r.website, on: v } } })}
              text="The company's domain, never a mail provider's (gmail, bluewin, gmx …) or ours." />
          </Grid>
          <Grid size={{ xs: 12, md: 6, lg: 3 }}>
            <SwitchRow title="Also when the names differ" checked={r.website.otherNames} disabled={!d.admin || busy || !r.website.on} onChange={(v) => void save({ rules: { website: { ...r.website, otherNames: v } } })}
              text="The same website under another name - often a sister company or a brand: look before merging." />
          </Grid>
        </Grid>
        {msg && <Typography sx={{ ...small, color: MUTED, mt: 1 }}>{msg}</Typography>}
      </GlassCard>
      <GroupTable title="Possible duplicates" hint={`The strongest first - filter, order, choose the columns, download what you filtered.${d.admin ? "" : " An admin decides."}`}
        groups={f?.possible ?? []} file="possible-company-duplicates" icon={<HourglassEmptyOutlinedIcon />} decide={decideCell} review />
    </>
  );
}

function LeftTab({ d }: { d: Data }) {
  const f = d.snapshot?.found;
  const [view, setView] = useState<"left" | "performis">("left");
  if (!f) return <Info>After the first read.</Info>;
  const toggle = (
    <Box role="tablist" aria-label="Left alone or Performis" sx={{ display: "inline-grid", gridTemplateColumns: "1fr 1fr", gap: 0.5, p: 0.5, borderRadius: "12px", border: `1px solid ${HAIRLINE}`, bgcolor: "rgba(21,34,58,.03)", width: { xs: "100%", sm: 520 } }}>
      {([["left", "Left alone", "What the rules keep apart"], ["performis", "Performis", "One company, several customer numbers - new titles"]] as const).map(([k, label, note]) => (
        <Box key={k} component="button" type="button" role="tab" aria-selected={view === k} onClick={() => setView(k)}
          sx={{ all: "unset", cursor: "pointer", px: 1.5, py: 0.9, borderRadius: "9px", bgcolor: view === k ? "#fff" : "transparent", boxShadow: view === k ? "0 1px 3px rgba(21,34,58,.12)" : "none", "&:hover": { bgcolor: view === k ? "#fff" : "rgba(21,34,58,.05)" } }}>
          <Typography sx={{ fontSize: "0.9rem", fontWeight: 800, color: view === k ? INK : MUTED }}>{label}</Typography>
          <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{note}</Typography>
        </Box>
      ))}
    </Box>
  );
  if (view === "performis") return <>{toggle}<PerformisView /></>;
  return (
    <>
      {toggle}
      <Tiles items={[
        { label: "A group's companies", value: f.counts.families, icon: <AccountTreeOutlinedIcon />, tint: "slate", note: "the same name or website, two customer numbers or more - never merged" },
        { label: "Sites in two countries", value: f.counts.sites, icon: <PublicOutlinedIcon />, tint: "slate", note: "one website, companies in different countries" },
        { label: "No customer number written in it", value: f.counts.placeholders, icon: <LabelOffOutlinedIcon />, tint: "amber", note: "a lead, created by ESO - compared by name and website only" },
        { label: "Kept apart by a person", value: d.apart, icon: <BlockOutlinedIcon />, tint: "slate", note: `pairs said not duplicates · ${full(f.counts.apart)} groups not shown` },
      ]} />
      <GroupTable title="Left alone" hint={`What the rules keep apart, with the reason - the first ${full(f.left.length)} of ${full(f.counts.families + f.counts.sites + f.counts.big)}`}
        groups={f.left} file="left-alone" icon={<AccountTreeOutlinedIcon />} />
    </>
  );
}

// ---------------------------------------------------------------- Decisions

const WHAT: Record<LogEntry["what"], string> = { merge: "Merged", apart: "Not duplicates", skip: "Waited", error: "Failed" };
function DecisionsTab({ d }: { d: Data }) {
  const merges = d.log.filter((e) => e.what === "merge");
  const source: CompanySource = {
    key: `log|${d.log.length}|${d.log[0]?.at ?? ""}`, note: "The last 300 things the hub did on companies - newest first",
    head: ["When", "What", "Details", "By"], left: [2, 3, 4], widths: ["minmax(110px, 0.6fr)", "minmax(110px, 0.6fr)", "minmax(320px, 2.5fr)", "minmax(140px, 1fr)"],
    rows: () => d.log.map((e) => ({ id: e.into ?? e.ids[0] ?? null, name: e.names[0] ?? `Company ${e.ids[0]}`, cells: [dayTime(e.at), WHAT[e.what], e.text.replace(/\bERP customer\b/g, "customer number"), e.by], values: [e.at, e.what, e.text, e.by] })),
  };
  return (
    <>
      <Tiles items={[
        { label: "Merged by the hub", value: merges.filter((e) => e.by.startsWith("APSOhub")).length, icon: <VerifiedOutlinedIcon />, tint: "green", note: "the same customer number, once Live" },
        { label: "Merged on a click", value: merges.filter((e) => !e.by.startsWith("APSOhub")).length, icon: <CallMergeOutlinedIcon />, tint: "purple", note: "Merge on this page" },
        { label: "Not duplicates", value: d.log.filter((e) => e.what === "apart").length, icon: <BlockOutlinedIcon />, tint: "slate", note: "kept apart for good" },
        { label: "Failed or waited", value: d.log.filter((e) => e.what === "error" || e.what === "skip").length, icon: <ErrorOutlineOutlinedIcon />, tint: "amber", note: "a company merged or changed meanwhile, the hour's limit" },
      ]} />
      <ListCard title="What the hub did" hint="Merges and decisions - a click on a column orders by it" source={source} />
    </>
  );
}

// ---------------------------------------------------------------- Settings

function GroupLine({ g }: { g: Group }) {
  const merges = g.kind === "erp" || g.kind === "possible";
  return (
    <Box sx={{ ...BOX, height: "auto" }}>
      <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK }}>{g.why}</Typography>
      <Typography sx={{ fontSize: "0.74rem", color: MUTED, mb: 0.5 }}>{g.kind === "erp" ? "The same customer number - merged by the hub once Live" : g.kind === "possible" ? "Possible - a person decides" : "Left alone"}</Typography>
      <Box sx={{ display: "grid", gap: 0.25 }}>
        {g.members.map((c: Company) => <Typography key={c.id} sx={{ fontSize: "0.8rem" }}>{link(c.id, c.name)} <Box component="span" sx={{ color: FAINT }}>· {numberText(c)} · {[c.address, place(c)].filter(Boolean).join(", ")} · since {dmy(c.createdate)}{merges && c.id === g.into ? " · keeps" : ""}</Box></Typography>)}
      </Box>
    </Box>
  );
}

function SettingsTab({ d, onChanged }: { d: Data; onChanged: () => void }) {
  const s = d.settings;
  const { busy, msg, save } = useSave(onChanged);
  const [runMsg, setRunMsg] = useState<string | null>(null);
  const [cid, setCid] = useState("");
  const [check, setCheck] = useState<{ company?: Company; groups?: Group[]; error?: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const LIVE_ASK = `Switch company duplicates LIVE?\n\nEvery hour the hub merges by itself ${liveWhat(s.rules)}. Every company is read again first. A merge cannot be undone in HubSpot.`;
  const doCheck = async () => {
    setChecking(true); setCheck(null);
    try {
      const j = (await (await fetch(`/api/uc/company-duplicates?company=${encodeURIComponent(cid.trim())}`)).json()) as { ok: boolean; data?: { company: Company; groups: Group[] }; error?: string };
      setCheck(j.ok && j.data ? j.data : { error: j.error ?? "Failed" });
    } catch (e) { setCheck({ error: (e as Error).message }); } finally { setChecking(false); }
  };
  const look = async () => { const j = await send("POST", { action: "run" }); setRunMsg(j.ok ? j.data?.text ?? "Started." : j.error ?? "Failed"); };
  const wfOff = d.workflow === false;
  return (
    <>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 }, borderColor: merging(d) ? RED : undefined }}>
        <CardTitle icon={<TuneOutlinedIcon />} tint="blue" title="How it runs" note={`Every company read every ${d.everyMinutes} minutes (a few minutes a read). To stop merging: Live off`} />
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, md: wfOff ? 6 : 4 }}>
            <SwitchRow title="Read every company" checked={s.mode !== "off"} disabled={!d.admin || busy} onChange={(v) => void save({ mode: v ? "shadow" : "off" }, v ? undefined : "Stop reading the companies?")}
              chips={s.mode === "off" ? <Chip tint="slate">off</Chip> : undefined}
              text="Off: nothing is read. On: every hour every company is read and its groups kept for these pages." />
          </Grid>
          <Grid size={{ xs: 12, md: wfOff ? 6 : 4 }}>
            <SwitchRow title="Live - merge by itself" checked={s.mode === "live"} disabled={!d.admin || busy || s.mode === "off"} onChange={(v) => void save({ mode: v ? "live" : "shadow" }, v ? LIVE_ASK : undefined)}
              chips={merging(d) ? <Chip tint="pink">LIVE</Chip> : s.mode === "live" ? <Chip tint="amber">waiting</Chip> : <Chip tint="slate">shadow</Chip>}
              text={s.mode !== "live" ? "Shadow: found and listed, nothing merged by itself - Merge on a click still works." : merging(d) ? `Every hour: ${liveWhat(s.rules)}.` : `Chosen - once the workflow is off, every hour: ${liveWhat(s.rules)}.`} />
          </Grid>
          {!wfOff && (
            <Grid size={{ xs: 12, md: 4 }}>
              <Box sx={{ ...BOX, borderColor: "rgba(196,122,0,.45)" }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                  <Typography sx={{ fontSize: "0.88rem", fontWeight: 800, color: INK }}>The workflow</Typography>
                  {d.workflow === null ? <Chip tint="slate">not readable</Chip> : <Chip tint="amber">ON</Chip>}
                </Box>
                <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 0.25, lineHeight: 1.45 }}>
                  &quot;SARCLA | COMPANIES FULL DUPLICATE CHECK |&quot; still merges in HubSpot. Switch it off there: the hub then takes over, and this card goes away.
                </Typography>
              </Box>
            </Grid>
          )}
        </Grid>
        {d.admin && (
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", mt: 1.5, flexWrap: "wrap" }}>
            <Button variant="outlined" size="small" disabled={busy || s.mode === "off"} onClick={() => void look()} sx={{ textTransform: "none" }}>Read again now</Button>
            {busy && <CircularProgress size={14} />}
            {runMsg && <Typography sx={{ ...small, color: MUTED }}>{runMsg}</Typography>}
          </Box>
        )}
        {msg && <Typography sx={{ ...small, color: MUTED, mt: 1 }}>{msg}</Typography>}
      </GlassCard>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<ManageSearchOutlinedIcon />} tint="purple" title="Check a company" note="Read only - what the rules find for it now: the companies with its customer number, website or postcode. Nothing is stored or written" />
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); if (/^\d+$/.test(cid.trim()) && !checking) void doCheck(); }} sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
          <TextField size="small" value={cid} onChange={(e) => setCid(e.target.value)} placeholder="Company id, e.g. 448730978533" inputProps={{ "aria-label": "Company id", inputMode: "numeric" }} sx={{ minWidth: 260 }} />
          <Button type="submit" variant="contained" disableElevation size="small" disabled={!/^\d+$/.test(cid.trim()) || checking} sx={{ textTransform: "none" }}>
            {checking ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : "Check"}
          </Button>
        </Box>
        {check?.error && <Typography sx={{ fontSize: "0.84rem", color: RED, mt: 1.5 }}>{check.error}</Typography>}
        {check?.company && (
          <Box sx={{ mt: 1.5, display: "grid", gap: 1 }}>
            <Typography sx={{ fontSize: "0.88rem", fontWeight: 600 }}>{link(check.company.id, check.company.name)} <Box component="span" sx={{ color: MUTED, fontWeight: 400 }}>- {numberText(check.company)} · {[check.company.address, place(check.company)].filter(Boolean).join(", ")}{check.company.domain ? ` · ${check.company.domain}` : ""}</Box></Typography>
            {check.groups?.length ? check.groups.map((g) => <GroupLine key={`${g.kind}|${g.key}`} g={g} />) : <Typography sx={{ ...small, color: MUTED }}>No duplicate found by the rules.</Typography>}
          </Box>
        )}
      </GlassCard>
    </>
  );
}

export default function CompanyDuplicates() {
  const [tab, setTab] = useHashTab<TabId>(TAB_HASH, "overview");
  const [n, setN] = useState(0);
  const { window: win } = useReportingWindow();
  const url = `/api/uc/company-duplicates?from=${win.from}&to=${win.to}${n ? `&n=${n}` : ""}`;
  const held = useHeld<Data>(url, [url]);
  const r = held.result;
  const again = useCallback(() => setN((x) => x + 1), []);
  const d = r?.state === "ok" ? r.data : null;
  const ctx = useDecisionState(!!d?.admin, again);
  let body: React.ReactNode;
  if (r === null) body = <LoadingPanel label="Reading the companies…" />;
  else if (r.state !== "ok" || !d) body = <UpstreamPanel source="Duplicates & merges" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? r.status : null} onRetry={again} />;
  else if (tab === "settings") body = <SettingsTab d={d} onChanged={again} />;
  else if (tab === "decisions") body = <DecisionsTab d={d} />;
  else if (tab === "erp") body = <NumberTab d={d} onSaved={again} />;
  else if (tab === "possible") body = <PossibleTab d={d} onSaved={again} />;
  else if (tab === "left") body = <LeftTab d={d} />;
  else body = <Overview d={d} />;
  const f = d?.snapshot?.found;
  return (
    <Decisions.Provider value={ctx}>
      <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
        <PageHeader
          title="Duplicates & merges"
          subtitle="Companies: the same customer number twice - merged into the oldest company; the same name at one postcode or the same website - for a person to merge"
          rightSlot={
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              {(r === null || held.stale) && <CircularProgress size={14} sx={{ color: MUTED }} />}
              {tab === "overview" && <WindowPicker />}
              <Tooltip title="Read again"><IconButton size="small" onClick={again} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton></Tooltip>
            </Box>
          }
        />
        <DupToggle on="companies" />
        {d && <Status d={d} />}
        <Box>
          <ReportTabs name="companydup" tab={tab} onSelect={setTab} tabs={[
            { id: "overview", label: "Overview", count: null },
            { id: "erp", label: "Same customer number", count: f?.sure.length ? full(f.sure.length) : null },
            { id: "possible", label: "Possible duplicates", count: f?.possible.length ? full(f.possible.length) : null },
            { id: "left", label: "Left alone", count: null },
            { id: "decisions", label: "Decisions", count: null },
            { id: "settings", label: "Settings", count: null },
          ]} />
        </Box>
        <Box id={`companydup-panel-${tab}`} role="tabpanel" sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>{body}</Box>
      </Box>
    </Decisions.Provider>
  );
}
