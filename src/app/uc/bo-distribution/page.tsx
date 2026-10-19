"use client";

// BACK OFFICE DISTRIBUTION - a HubSpot app (UC & HubSpot Apps > HubSpot apps), in SHADOW MODE (SARCLA 18.10.2026: move the
// distribution to the hub, "really vital ... it should work seamlessly"; then "really raw - much more: people, GQS, the
// flow, the detection, changing people without changing the code"). For every ticket entering Back Office "New" or GQS
// "New for Back-Office" the hub works out what the HubSpot workflows decide and puts it next to what HubSpot did; the
// last 7 days are replayed. Nothing is written to HubSpot. Tabs: Overview, Tickets, Flow, Detection, People, GQS, Settings.

import { Fragment, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import RefreshIcon from "@mui/icons-material/Refresh";
import CloseIcon from "@mui/icons-material/Close";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import CompareArrowsOutlinedIcon from "@mui/icons-material/CompareArrowsOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import AltRouteOutlinedIcon from "@mui/icons-material/AltRouteOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import ManageSearchOutlinedIcon from "@mui/icons-material/ManageSearchOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import PriorityHighOutlinedIcon from "@mui/icons-material/PriorityHighOutlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { BarList } from "@/app/charts/BarList";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { CardTitle, GlassCard, HAIRLINE, INK, KpiTile, MUTED, RED, bodyCell, clip, headCell, hsTicket } from "@/app/uc/report/ui";
import { ReportTabs, useHashTab } from "@/app/uc/report/Tabs";
import { Chip, Choice, Info, usePaged, when } from "@/app/connectors/parts";
import type { PersonRow, Row, RunInfo, Settings } from "@/lib/boDistribution/engine";
import type { Classification } from "@/lib/boDistribution/classifier";
import type { Person, RosterKey } from "@/lib/boDistribution/rules";

import {
  CHAT_LABEL, Detail, STEP, TicketTable, VIEW_HASH, count, fixesDiffer, gave, measure, pct, sameOwner,
  type Data, type PeopleData, type View,
} from "./shared";
import { FlowTab } from "./FlowTab";
import { GqsTab } from "./GqsTab";
import { PriorityTab } from "./PriorityTab";
import { SettingsTab } from "./SettingsTab";
/* ── Overview ── */

function Overview({ d }: { d: Data }) {
  const m = measure(d.rows);
  const days = useMemo(() => {
    const by = new Map<string, { same: number; different: number; none: number; waiting: number }>();
    for (const r of d.rows) {
      const k = r.enteredAt.slice(0, 10);
      const b = by.get(k) ?? { same: 0, different: 0, none: 0, waiting: 0 };
      if (!r.legacy) b.none++; else if (!r.actual) b.waiting++; else if (sameOwner(r)) b.same++; else b.different++;
      by.set(k, b);
    }
    return [...by].sort((a, b) => a[0].localeCompare(b[0])).map(([x, v]) => ({ x: x.slice(8, 10) + "." + x.slice(5, 7), ...v }));
  }, [d.rows]);
  const kpis = [
    { label: "Tickets, 7 days", value: full(m.total), note: `${full(m.bo)} Back Office, ${full(m.gqs)} GQS${d.backfill && !d.backfill.done ? " - replay still running" : ""}`, icon: <ConfirmationNumberOutlinedIcon />, tint: "blue" as const },
    { label: "Same owner as HubSpot", value: pct(m.liveSame, m.live), note: `${full(m.liveSame)} of ${full(m.live)} live tickets; replayed days ${pct(m.replaySame, m.replay)} (availability of today)`, icon: <PersonOutlineOutlinedIcon />, tint: "green" as const },
    { label: "Same category", value: pct(m.catSame, m.cat), note: `${full(m.catSame)} of ${full(m.cat)}; same priority ${pct(m.prioSame, m.prio)}`, icon: <CategoryOutlinedIcon />, tint: "purple" as const },
    { label: "Fixes change the owner", value: full(m.fixes), note: "The hub's fixed rules would pick someone else than the copy", icon: <CompareArrowsOutlinedIcon />, tint: "amber" as const },
  ];
  const owners = count(d.rows.filter((r) => r.actual), (r) => gave(r)!.name);
  const steps = count(d.rows.filter((r) => r.route?.assigner), (r) => STEP[r.route!.assigner!]);
  const cats = count(d.rows.filter((r) => r.actual), (r) => r.actual!.category ?? "No category");
  const [cat, setCat] = useState<string | null>(null);
  const inCat = cat ? d.rows.filter((r) => r.actual && (r.actual.category ?? "No category") === cat) : [];
  return (
    <>
      <Info>
        Shadow mode - the hub writes nothing to HubSpot. For each ticket entering Back Office &quot;New&quot; or GQS &quot;New for Back-Office&quot; it works out
        what the workflows decide (<b>copy</b>: their rules, quirks included) and what it would decide with the faults fixed (<b>hub</b>), and reads what
        HubSpot really did. The last 7 days are replayed: their category and path compare exactly; their owner only roughly, as today&apos;s availability is used.
      </Info>
      <Grid container spacing={2}>
        {kpis.map((k) => <Grid key={k.label} size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={k.icon} tint={k.tint} label={k.label} value={k.value} note={k.note} /></Grid>)}
      </Grid>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<InsightsOutlinedIcon />} tint="blue" title="Day by day" note="Copy against HubSpot: same owner, another owner, no distribution on the path, not settled yet" />
        <StackedColumns data={days} parts={[{ key: "same", label: "Same owner" }, { key: "different", label: "Another owner" }, { key: "none", label: "No distribution" }, { key: "waiting", label: "Not settled" }]} format={(v) => full(v ?? 0)} />
      </GlassCard>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 4 }}><GlassCard sx={{ p: { xs: 2, md: 2.5 }, height: "100%" }}><CardTitle icon={<PersonOutlineOutlinedIcon />} tint="green" title="Who got them" note="Owner in HubSpot" /><BarList rows={owners} labelWidth={150} format={(v) => full(v ?? 0)} /></GlassCard></Grid>
        <Grid size={{ xs: 12, lg: 4 }}><GlassCard sx={{ p: { xs: 2, md: 2.5 }, height: "100%" }}><CardTitle icon={<AltRouteOutlinedIcon />} tint="purple" title="Which step picked" note="The workflow step on each ticket's path" /><BarList rows={steps} labelWidth={170} format={(v) => full(v ?? 0)} /></GlassCard></Grid>
        <Grid size={{ xs: 12, lg: 4 }}><GlassCard sx={{ p: { xs: 2, md: 2.5 }, height: "100%" }}><CardTitle icon={<CategoryOutlinedIcon />} tint="amber" title="Categories" note="As HubSpot has them now - click one to see its tickets" /><BarList rows={cats} labelWidth={150} format={(v) => full(v ?? 0)} onSelect={(l) => setCat(cat === l ? null : l)} selectedLabel={cat} /></GlassCard></Grid>
      </Grid>
      {cat && (
        <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
          <CardTitle icon={<CategoryOutlinedIcon />} tint="amber" title={`${cat} - ${full(inCat.length)} tickets`}
            note={cat === "Others" ? "Others = the keyword classifier recognised nothing in the e-mail (or a form / hub ticket came without a known category) - the workflow then sets Others and the Load Balancer picks. Detection > Not recognised shows why." : "Click the category again to close"} />
          <TicketTable rows={inCat} empty="No ticket." />
        </GlassCard>
      )}
    </>
  );
}

function Tickets({ d }: { d: Data }) {
  const [filter, setFilter] = useState<"all" | "different" | "fixes" | "live">("all");
  const [pipe, setPipe] = useState<"all" | "bo" | "gqs">("all");
  const [id, setId] = useState("");
  const [check, setCheck] = useState<string | null>(null);
  const checked = useHeld<Row>(check ? `/api/uc/bo-distribution?ticket=${check}` : null, [check]);
  const rows = d.rows.filter((r) => (pipe === "all" || r.pipeline === pipe) && (filter === "all" || (filter === "different" ? r.actual && r.legacy && !sameOwner(r) : filter === "fixes" ? fixesDiffer(r) : !r.approx)));
  return (
    <>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<ManageSearchOutlinedIcon />} tint="blue" title="Check a ticket" note="Any ticket number: the copy, the hub and HubSpot side by side, now - nothing stored, nothing written" />
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
          <TextField size="small" placeholder="ticket number" value={id} onChange={(e) => setId(e.target.value.replace(/\D/g, ""))} sx={{ width: 220 }} />
          <Button variant="outlined" size="small" disabled={!id} onClick={() => setCheck(id)} sx={{ textTransform: "none" }}>Check</Button>
          {check && checked.result === null && <CircularProgress size={14} />}
        </Box>
        {check && checked.result?.state === "ok" && <Box sx={{ mt: 1.5 }}><Detail r={checked.result.data} /></Box>}
        {check && checked.result && checked.result.state !== "ok" && <Typography sx={{ mt: 1, fontSize: "0.82rem", color: RED }}>{checked.result.state === "error" ? checked.result.error : "not configured"}</Typography>}
      </GlassCard>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<HistoryOutlinedIcon />} tint="slate" title="Ticket by ticket" note={d.last ? `Last look ${when(d.last.at)}: ${full(d.last.read)} read, ${full(d.last.decided)} new, ${full(d.last.checked)} checked${d.last.error ? ` - ${d.last.error}` : ""}` : "Not run yet"} />
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 1.5 }}>
          <Choice<"all" | "different" | "fixes" | "live"> value={filter} onChange={setFilter} options={[
            { key: "all", label: "All", count: d.rows.length },
            { key: "different", label: "HubSpot did otherwise", count: d.rows.filter((r) => r.actual && r.legacy && !sameOwner(r)).length },
            { key: "fixes", label: "Fixes change it", count: d.rows.filter(fixesDiffer).length },
            { key: "live", label: "Live only", count: d.rows.filter((r) => !r.approx).length },
          ]} />
          <Choice<"all" | "bo" | "gqs"> value={pipe} onChange={setPipe} options={[{ key: "all", label: "Both" }, { key: "bo", label: "Back Office" }, { key: "gqs", label: "GQS" }]} />
        </Box>
        <TicketTable rows={rows} empty={`Nothing yet - tickets appear within ${d.everyMinutes} minutes of entering the stage; the replay fills the last 7 days.`} />
      </GlassCard>
    </>
  );
}

/* ── Detection ── */

const WEAK_UNUSED = [
  "\"received\" is a Delivery keyword, so a forwarded \"Invoice not received\" goes to Delivery",
  "\"reach\" is listed several times, so \"reach out\" files a ticket as a certificate request",
  "Short lines with \"inc\", \"ltd\", \"co.\" or \"kg\" are dropped as company lines - \"incorrect delivery\", \"50 kg…\" only count from the subject",
  "\"Regards\", \"Met vriendelijke groet\", \"Pozdrawiam\", \"Viele Grüsse\" do not start the signature, so signatures are read as text",
  "A curly apostrophe (’) never matches \"demande d'offre\"",
  "\"Request for quotation\" is not among its own sub-category's keywords",
  "An empty subject or body makes the step write nothing (the ticket then goes to Others)",
];
function Detection({ d }: { d: Data }) {
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [res, setRes] = useState<{ v1: Classification; v2: Classification & { fixes: string[] } } | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/uc/bo-distribution", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "classify", subject, content: content.slice(0, 6000) }) });
      const j = (await r.json()) as { ok: boolean; data?: { v1: Classification; v2: Classification & { fixes: string[] } } };
      setRes(j.ok && j.data ? j.data : null);
    } finally { setBusy(false); }
  };
  const read = d.rows.filter((r) => r.route?.classified && r.actual);
  const recognised = read.filter((r) => r.route!.classified!.category);
  const notRecognised = read.filter((r) => !r.route!.classified!.category);
  // the truth: a category a PERSON set afterwards (HubSpot's own category is this classifier's answer - comparing with it measures nothing)
  const corrected = read.filter((r) => r.actual!.catByPerson);
  const right = corrected.filter((r) => r.actual!.catByPerson === (r.route!.classified!.category ?? "Others"));
  const withV2 = read.filter((r) => r.v2);
  const v2Recognised = withV2.filter((r) => r.v2!.category);
  const rightV2 = corrected.filter((r) => r.v2 && r.actual!.catByPerson === (r.v2.category ?? "Others"));
  const v2Changes = withV2.filter((r) => (r.v2!.category ?? null) !== (r.route!.classified!.category ?? null));
  const byCat = new Map<string, { n: number; same: number }>();
  for (const r of recognised) {
    const c = r.route!.classified!.category!;
    const b = byCat.get(c) ?? { n: 0, same: 0 };
    b.n++; if (r.actual!.category === c) b.same++;
    byCat.set(c, b);
  }
  return (
    <>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}><KpiTile icon={<CategoryOutlinedIcon />} tint="purple" label="Read by the classifier" value={full(read.length)} note="E-mails of the last 7 days that went through it" /></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><KpiTile icon={<PriorityHighOutlinedIcon />} tint="green" label="Recognised: workflow → improved" value={`${pct(recognised.length, read.length)} → ${pct(v2Recognised.length, withV2.length)}`} note={`${full(read.length - recognised.length)} not recognised today → Others, Load Balancer`} /></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><KpiTile icon={<CompareArrowsOutlinedIcon />} tint="blue" label="Right when a person changed it" value={`${pct(right.length, corrected.length)} → ${pct(rightV2.length, corrected.length)}`} note={`Workflow → improved, on the ${full(corrected.length)} tickets whose category a person set afterwards. On 30 days: 10% → 26%; on the 90 before: 13% → 46%`} /></Grid>
      </Grid>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<ManageSearchOutlinedIcon />} tint="blue" title="Try it" note="Paste a subject and an e-mail: what the workflow's classifier makes of it, and why (up to 6,000 characters)" />
        <Box sx={{ display: "grid", gap: 1, maxWidth: 900 }}>
          <TextField size="small" label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <TextField size="small" label="E-mail text" multiline minRows={4} value={content} onChange={(e) => setContent(e.target.value.slice(0, 6000))} />
          <Box><Button variant="contained" size="small" disabled={busy || (!subject && !content)} onClick={() => void run()} sx={{ textTransform: "none" }}>Classify</Button></Box>
        </Box>
        {res && (
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {([["The workflow's classifier (today)", res.v1, [] as string[]], ["The improved classifier", res.v2, res.v2.fixes]] as const).map(([title, c, fx]) => (
              <Grid key={title} size={{ xs: 12, md: 6 }}>
                <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "12px", p: 1.5, display: "grid", gap: 0.5 }}>
                  <Typography sx={{ fontSize: "0.74rem", color: MUTED, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>{title}</Typography>
                  <Typography sx={{ fontWeight: 800, color: INK }}>{c.category ?? "Nothing recognised → Others"}{c.subCategory ? ` / ${c.subCategory}` : ""}</Typography>
                  <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>{c.explanation}{c.orderNumber ? ` · order ${c.orderNumber}` : ""}</Typography>
                  {!!fx.length && <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>{fx.map((f) => <Chip key={f} tint="green">{d.fixes.find((x) => x.id === f)?.title ?? f}</Chip>)}</Box>}
                  {!!c.matched.length && <Box sx={{ display: "flex", gap: 0.4, flexWrap: "wrap" }}>{c.matched.slice(0, 20).map((k) => <Chip key={k} tint="purple">{k}</Chip>)}</Box>}
                </Box>
              </Grid>
            ))}
          </Grid>
        )}
      </GlassCard>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <GlassCard sx={{ p: { xs: 2, md: 2.5 }, height: "100%" }}>
            <CardTitle icon={<InsightsOutlinedIcon />} tint="green" title="What it recognised" note="Last 7 days; second figure = how often HubSpot still has it (high by nature: HubSpot's category IS this answer unless a person changes it)" />
            <BarList rows={[...byCat].sort((a, b) => b[1].n - a[1].n).map(([label, v]) => ({ label, value: v.n, secondary: pct(v.same, v.n) }))} labelWidth={170} format={(v) => full(v ?? 0)} />
          </GlassCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <GlassCard sx={{ p: { xs: 2, md: 2.5 }, height: "100%" }}>
            <CardTitle icon={<ReportProblemOutlinedIcon />} tint="green" title="What the improved classifier fixes" note="Each fix can be switched off on its own; all off = exactly the workflow's answer" />
            <Box component="ol" sx={{ m: 0, pl: 2.5, display: "grid", gap: 0.4 }}>{d.fixes.map((f) => <Typography component="li" key={f.id} sx={{ fontSize: "0.78rem", color: INK }}><b>{f.title}</b> - {f.description}</Typography>)}</Box>
          </GlassCard>
        </Grid>
      </Grid>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<CompareArrowsOutlinedIcon />} tint="green" title={`The improved classifier changes ${full(v2Changes.length)} of ${full(withV2.length)}`} note="Workflow → improved, last 7 days - not used for routing while the workflow files the category" />
        <BarList rows={count(v2Changes, (r) => `${r.route!.classified!.category ?? "Others"} → ${r.v2!.category ?? "Others"}`)} labelWidth={320} format={(v) => full(v ?? 0)} />
      </GlassCard>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<ReportProblemOutlinedIcon />} tint="amber" title={`Not recognised - ${full(notRecognised.length)} e-mails`} note="No keyword matched: the workflow sets Others and the Load Balancer picks. These are what the improved classifier has to catch" />
        <TicketTable rows={notRecognised} empty="None." />
      </GlassCard>
      {!!corrected.length && (
        <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
          <CardTitle icon={<CompareArrowsOutlinedIcon />} tint="blue" title="Changed by a person" note="The classifier's category against the one a person set afterwards" />
          <BarList rows={count(corrected, (r) => `${r.route!.classified!.category ?? "Others"} → ${r.actual!.catByPerson}`)} labelWidth={320} format={(v) => full(v ?? 0)} />
        </GlassCard>
      )}
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<CategoryOutlinedIcon />} tint="purple" title="The keyword lists" note="Six languages; the subject counts ten times; the highest score wins, then the sub-category" />
        <Grid container spacing={2}>
          {d.classifier.map((c) => (
            <Grid key={c.category} size={{ xs: 12, md: 6, xl: 4 }}>
              <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "12px", p: 1.5, height: "100%" }}>
                <Typography sx={{ fontWeight: 800, fontSize: "0.88rem", color: INK }}>{c.category} <span style={{ color: MUTED, fontWeight: 500 }}>· {full(c.keywords)} keywords</span></Typography>
                <Box sx={{ display: "flex", gap: 0.4, flexWrap: "wrap", my: 0.75 }}>{c.sample.map((k) => <Chip key={k} tint="slate">{k}</Chip>)}</Box>
                {c.subs.map((s) => <Typography key={s.key} sx={{ fontSize: "0.76rem", color: MUTED }}>→ {s.value} <span style={{ color: INK }}>({s.keywords})</span></Typography>)}
              </Box>
            </Grid>
          ))}
        </Grid>
      </GlassCard>
    </>
  );
}

/* ── People ── */

function RosterEditor({ k, d, owners, onSaved }: { k: RosterKey; d: Data; owners: Person[]; onSaved: () => void }) {
  const current = d.settings.rosters[k] ?? d.legacy[k];
  const [list, setList] = useState<Person[]>(current);
  const [busy, setBusy] = useState(false);
  const changed = JSON.stringify(list.map((x) => x.id)) !== JSON.stringify(current.map((x) => x.id));
  const custom = !!d.settings.rosters[k];
  const off = new Set(d.deactivated.map((x) => x.id));
  const move = (i: number, dir: -1 | 1) => setList((l) => { const n = [...l]; const j = i + dir; if (j < 0 || j >= n.length) return l; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const save = async (value: Person[] | null) => {
    setBusy(true);
    try { await fetch("/api/uc/bo-distribution", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rosters: { [k]: value } }) }); onSaved(); } finally { setBusy(false); }
  };
  return (
    <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "12px", p: 1.5 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "center" }}>
        <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK }}>{d.labels[k]}</Typography>
        {custom ? <Chip tint="amber">changed here</Chip> : <Chip tint="slate">as in the workflow</Chip>}
      </Box>
      <Box sx={{ display: "grid", gap: 0.5, my: 1 }}>
        {list.map((p, i) => (
          <Box key={p.id} sx={{ display: "flex", alignItems: "center", gap: 0.5, fontSize: "0.8rem" }}>
            <Typography sx={{ fontSize: "0.72rem", color: MUTED, width: 16 }}>{i + 1}</Typography>
            <Typography sx={{ fontSize: "0.82rem", flex: 1, color: off.has(p.id) ? RED : INK, textDecoration: off.has(p.id) ? "line-through" : "none" }}>{p.name}{off.has(p.id) ? " - deactivated" : ""}</Typography>
            {d.admin && <>
              <IconButton size="small" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Up"><ArrowUpwardIcon sx={{ fontSize: 14 }} /></IconButton>
              <IconButton size="small" onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label="Down"><ArrowDownwardIcon sx={{ fontSize: 14 }} /></IconButton>
              <IconButton size="small" onClick={() => setList((l) => l.filter((x) => x.id !== p.id))} aria-label="Remove"><CloseIcon sx={{ fontSize: 14 }} /></IconButton>
            </>}
          </Box>
        ))}
      </Box>
      {d.admin && (
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
          <Autocomplete size="small" options={owners.filter((o) => !list.some((x) => x.id === o.id))} getOptionLabel={(o) => o.name} sx={{ minWidth: 220, flex: 1 }}
            onChange={(_, o) => o && setList((l) => [...l, o])} value={null} renderInput={(p) => <TextField {...p} placeholder="add a person" />} />
          <Button size="small" variant="contained" disabled={!changed || busy} onClick={() => void save(list)} sx={{ textTransform: "none" }}>Save</Button>
          {custom && <Button size="small" disabled={busy} onClick={() => void save(null)} sx={{ textTransform: "none" }}>Back to the workflow&apos;s</Button>}
        </Box>
      )}
    </Box>
  );
}
function People({ d, onSaved }: { d: Data; onSaved: () => void }) {
  const [n, setN] = useState(0);
  const held = useHeld<PeopleData>(`/api/uc/bo-distribution?people=1&n=${n}`, [n]);
  const r = held.result;
  if (r === null) return <LoadingPanel label="Reading everyone's status and open tickets…" />;
  if (r.state !== "ok") return <UpstreamPanel source="Back Office distribution - people" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? r.status : null} onRetry={() => setN((x) => x + 1)} />;
  const p = r.data;
  const got = (id: string) => d.rows.filter((x) => x.actual && gave(x)!.id === id).length;
  const copy = (id: string) => d.rows.filter((x) => x.legacy?.ownerId === id).length;
  const hub = (id: string) => d.rows.filter((x) => x.hub?.ownerId === id).length;
  return (
    <>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<GroupsOutlinedIcon />} tint="green" title="The people" note={`Everyone in a team - chat status and open tickets now (${when(p.at)}); tickets of the last 7 days`} />
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>{["Person", "Status", "Open Back Office", "Open GQS", "Got (HubSpot)", "Copy gives", "Hub gives", "Teams"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {[...p.people].sort((a, b) => Number(a.deactivated) - Number(b.deactivated) || a.name.localeCompare(b.name)).map((x) => (
                <TableRow key={x.id}>
                  <TableCell sx={{ ...bodyCell, fontWeight: 700, color: x.deactivated ? RED : INK }}>{x.name}</TableCell>
                  <TableCell sx={bodyCell}>{x.deactivated ? <Chip tint="pink">deactivated</Chip> : x.chat === "available" ? <Chip tint="green">available</Chip> : <Chip tint="slate">{x.chat ? CHAT_LABEL[x.chat] ?? x.chat : "no status"}</Chip>}</TableCell>
                  <TableCell sx={bodyCell}>{x.boOpen ?? "—"}</TableCell>
                  <TableCell sx={bodyCell}>{x.gqsOpen ?? "—"}{x.gqsOpenFixed !== null && x.gqsOpenFixed !== x.gqsOpen ? <Tooltip title="Counting the real 'Waiting on APSO' stage instead of the deleted one the workflow counts"><span style={{ color: MUTED }}> ({x.gqsOpenFixed})</span></Tooltip> : null}</TableCell>
                  <TableCell sx={bodyCell}>{got(x.id) || ""}</TableCell>
                  <TableCell sx={bodyCell}>{copy(x.id) || ""}</TableCell>
                  <TableCell sx={bodyCell}>{hub(x.id) || ""}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.72rem", color: MUTED }}>{x.lists.length} list{x.lists.length === 1 ? "" : "s"}{x.inWorkflow.length !== x.lists.length ? " (changed here)" : ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
        <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 1 }}>&quot;Available&quot; is the green dot of HubSpot chat - what the workflows use today. In brackets: GQS open tickets counted with the right &quot;Waiting on APSO&quot; stage.</Typography>
      </GlassCard>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<TuneOutlinedIcon />} tint="purple" title="The teams - change them here, not in code" note="The hub's answer uses these lists now; the copy keeps the workflow's. Order matters: it breaks ties and sets who is tried first" />
        <Grid container spacing={2}>
          {(Object.keys(d.labels) as RosterKey[]).map((k) => <Grid key={k} size={{ xs: 12, md: 6, xl: 4 }}><RosterEditor k={k} d={d} owners={p.owners} onSaved={() => { onSaved(); setN((x) => x + 1); }} /></Grid>)}
        </Grid>
      </GlassCard>
    </>
  );
}

export default function BoDistribution() {
  const [view, setView] = useHashTab<View>(VIEW_HASH, "overview");
  const [n, setN] = useState(0);
  const url = `/api/uc/bo-distribution${n ? `?n=${n}` : ""}`;
  const held = useHeld<Data>(url, [url]);
  const r = held.result;
  const reload = () => setN((x) => x + 1);
  let body: React.ReactNode;
  if (r === null) body = <LoadingPanel label="Reading the Back Office tickets…" />;
  else if (r.state !== "ok") body = <UpstreamPanel source="Back Office distribution" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? r.status : null} onRetry={reload} />;
  else if (view === "tickets") body = <Tickets d={r.data} />;
  else if (view === "flow") body = <FlowTab d={r.data} />;
  else if (view === "detection") body = <Detection d={r.data} />;
  else if (view === "people") body = <People d={r.data} onSaved={reload} />;
  else if (view === "gqs") body = <GqsTab d={r.data} />;
  else if (view === "settings") body = <SettingsTab key={r.data.settings.at ?? "s"} d={r.data} onChanged={reload} />;
  else if (view === "priority") body = <PriorityTab key={r.data.settings.at ?? "p"} d={r.data} onSaved={reload} />;
  else body = <Overview d={r.data} />;
  const rows = r?.state === "ok" ? r.data.rows : [];
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader
        title="Back Office distribution"
        subtitle="Who gets each new Back Office and GQS ticket, and why - the workflows side by side with the hub (shadow mode)"
        rightSlot={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {(r === null || held.stale) && <CircularProgress size={14} sx={{ color: MUTED }} />}
            <Tooltip title="Read again"><IconButton size="small" onClick={reload} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton></Tooltip>
          </Box>
        }
      />
      <Box>
        <ReportTabs name="bodist" tab={view} onSelect={setView} tabs={[
          { id: "overview", label: "Overview", count: null },
          { id: "tickets", label: "Tickets", count: rows.length ? full(rows.length) : null },
          { id: "flow", label: "Flow", count: null },
          { id: "detection", label: "Detection", count: null },
          { id: "priority", label: "Priority", count: null },
          { id: "people", label: "People", count: null },
          { id: "gqs", label: "GQS", count: rows.filter((x) => x.pipeline === "gqs").length ? full(rows.filter((x) => x.pipeline === "gqs").length) : null },
          { id: "settings", label: "Settings", count: null },
        ]} />
      </Box>
      <Box role="tabpanel" sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>{body}</Box>
    </Box>
  );
}
