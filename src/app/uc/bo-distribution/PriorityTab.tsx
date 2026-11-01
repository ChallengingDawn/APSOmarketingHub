"use client";

// BACK OFFICE DISTRIBUTION - the Priority tab (SARCLA 19.10.2026: "a new tab, priority settings, to set the priority more
// accurately"; 01.11.2026: "priority still really confusing, can you redo that one as well"). It read as one long
// settings form: a "would change" count, two bar lists side by side, the table, three switches and a list, all on the
// last 7 days whatever period was picked, under a column called "Workflow". Now it reads like the other tabs:
//   1. the period's tickets by the priority they have in HubSpot - four counts, month by month (day by day for a short
//      period), by topic, and the ones a person set - from the same count as Overview (src/lib/boDetection);
//   2. how a priority is set, in three steps, and the table and the three signals to change it;
//   3. before saving: what the rules on the page would do to the last 7 days' tickets (rules.ts priorityFor, the hub's own).

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import CloseIcon from "@mui/icons-material/Close";
import PriorityHighOutlinedIcon from "@mui/icons-material/PriorityHighOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import CompareArrowsOutlinedIcon from "@mui/icons-material/CompareArrowsOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import RuleOutlinedIcon from "@mui/icons-material/RuleOutlined";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import ArrowDownwardOutlinedIcon from "@mui/icons-material/ArrowDownwardOutlined";
import RemoveOutlinedIcon from "@mui/icons-material/RemoveOutlined";
import { LoadingPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { DEEMPHASIS, DELTA, SERIES } from "@/app/charts/palette";
import { DimChart } from "@/app/reporting/marketing-kpis/DimChart";
import { ChartBox, FullTable, TWO, type Col } from "@/app/reporting/eso-benchmark/Figures";
import { CardTitle, GlassCard, HAIRLINE, INK, KpiTile, MUTED, RED, bodyCell, clip, headCell, hsTicket } from "@/app/uc/report/ui";
import { Chip, usePaged, when } from "@/app/connectors/parts";
import { PRIORITIES, SUB, priorityFor, type Priority, type PrioritySettings } from "@/lib/boDistribution/rules";
import type { Row } from "@/lib/boDistribution/engine";
import { previousWindow, rangeLabel, type PrioBy } from "@/lib/boDetection/figures";
import { pct, type Data } from "./shared";
import { TicketList, useFigures, type Figures } from "./BoOverview";

const TINT: Record<Priority, "slate" | "blue" | "amber" | "pink"> = { LOW: "slate", MEDIUM: "blue", HIGH: "amber", URGENT: "pink" };
/** highest first - the tiles, the table's columns; the chart stacks URGENT at the bottom, where it is read first */
const ORDER: Priority[] = ["URGENT", "HIGH", "MEDIUM", "LOW"];
const COLOR: Record<Priority, string> = { URGENT: DELTA.bad, HIGH: SERIES[1], MEDIUM: SERIES[0], LOW: DEEMPHASIS };
const ICON: Record<Priority, React.ReactNode> = { URGENT: <BoltOutlinedIcon />, HIGH: <PriorityHighOutlinedIcon />, MEDIUM: <RemoveOutlinedIcon />, LOW: <ArrowDownwardOutlinedIcon /> };
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (ym: string) => `${MON[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;
const catName = (c: string) => (!c || c === "(empty)" ? "No category" : c);
const sum = (m: Record<string, number> | undefined) => Object.values(m ?? {}).reduce((a, n) => a + n, 0);

/* ── 1. the period's tickets by their priority ── */

type Pick = { kind: "prio" | "today" | "by"; key: string; label: string };
/** Who set a ticket's priority (figures.ts setterOf) - the inbox gives every new ticket MEDIUM */
const BY: Record<Exclude<PrioBy, "none">, string> = { rule: "The routing's rules", default: "As created (the inbox's default)", person: "A person" };

/** The days before are all inside the Back Office's history - else a comparison reads a partial year as growth. */
const comparable = (f: Figures) => !!f.since && previousWindow(f.now.from, f.now.to).from >= f.since;

function Figures_({ f, label }: { f: Figures; label: string }) {
  const [pick, setPick] = useState<Pick | null>(null);
  const prev = previousWindow(f.now.from, f.now.to);
  const before = rangeLabel(prev.from, prev.to);
  const single = !comparable(f);
  const pr = f.now.pr ?? {}, prB = f.before.pr ?? {}, prp = f.now.prp ?? {}, prd = f.now.prd ?? {}, prs = f.now.prs ?? {}, prsB = f.before.prs ?? {};
  const n = f.now.n;
  const none = pr[""] ?? 0;
  const byDay = f.byDay.length <= 62;
  const data = byDay
    ? f.byDay.map((x) => ({ x: x.d, ...Object.fromEntries(ORDER.map((k) => [k, x.pr[k] ?? 0])) }))
    : f.byMonth.map((m) => ({ x: m.ym, ...Object.fromEntries(ORDER.map((k) => [k, m.pr[k] ?? 0])) }));
  const tpr = f.now.tpr ?? {}, tprB = f.before.tpr ?? {};
  const topics = [...new Set([...Object.keys(tpr), ...Object.keys(tprB)])].map((c) => ({ id: c, label: catName(c), n: sum(tpr[c]), b: sum(tprB[c]), p: tpr[c] ?? {}, hot: (tpr[c]?.URGENT ?? 0) + (tpr[c]?.HIGH ?? 0), hotB: (tprB[c]?.URGENT ?? 0) + (tprB[c]?.HIGH ?? 0) }))
    .filter((x) => x.n || x.b);
  const setters = (Object.keys(BY) as (keyof typeof BY)[]).map((k) => ({ id: k, label: BY[k], n: prs[k] ?? 0, b: prsB[k] ?? 0 })).filter((x) => x.n || x.b);
  const withPrio = n - (pr[""] ?? 0);
  const choose = (kind: Pick["kind"], key: string, l: string) => {
    setPick(pick?.kind === kind && pick.key === key ? null : { kind, key, label: l });
    if (typeof document !== "undefined") setTimeout(() => document.getElementById("bo-priority-tickets")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };
  const cell = (v: number, of: number) => (v ? `${full(v)} · ${pct(v, of)}` : "—");
  type T = (typeof topics)[number];
  const cols: Col<T>[] = [
    { key: "n", head: "Tickets", cell: (x) => full(x.n), sort: (x) => x.n },
    ...ORDER.map((k): Col<T> => ({ key: k, head: k, cell: (x) => cell(x.p[k] ?? 0, x.n), sort: (x) => x.p[k] ?? 0 })),
    ...(none ? [{ key: "none", head: "No priority", cell: (x: T) => cell(x.p[""] ?? 0, x.n), sort: (x: T) => x.p[""] ?? 0 }] : []),
  ];
  const total: T = { id: "", label: "All Back Office tickets", n, b: f.before.n, p: pr, hot: (pr.URGENT ?? 0) + (pr.HIGH ?? 0), hotB: 0 };
  const listFixed: Record<string, string> = !pick ? {} : pick.kind === "prio" ? { prio: pick.key } : pick.kind === "today" ? { today: pick.key } : { prioBy: pick.key };
  return (
    <>
      <Grid container spacing={2}>
        {ORDER.map((k) => (
          <Grid key={k} size={{ xs: 12, sm: 6, lg: 3 }}>
            <Box component="button" type="button" onClick={() => choose("prio", k, k)} sx={{ all: "unset", display: "block", width: "100%", cursor: "pointer", borderRadius: "18px", outline: pick?.kind === "prio" && pick.key === k ? "2px solid #2459d1" : "none" }}>
              <KpiTile icon={ICON[k]} tint={TINT[k]} label={k} value={full(pr[k] ?? 0)}
                delta={!single && prB[k] ? { ratio: (pr[k] ?? 0) / prB[k] - 1, versus: before, goodWhenUp: k === "LOW" || k === "MEDIUM" } : undefined}
                note={`${pct(pr[k] ?? 0, n)} of the ${full(n)} tickets created ${label}${prd[k] ? `; ${full(prd[k])} ${k === "MEDIUM" ? "only the inbox's MEDIUM, nothing changed it" : "as the ticket was created"}` : ""}${prp[k] ? `; ${full(prp[k])} set by a person` : ""}${k === "LOW" && none ? `. ${full(none)} have no priority` : ""}.`} />
            </Box>
          </Grid>
        ))}
      </Grid>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<InsightsOutlinedIcon />} tint="blue" title={byDay ? "Day by day" : "Month by month"}
          note={`The ${full(n)} Back Office tickets created ${label}, by the priority each has in HubSpot today. The inbox gives every new ticket MEDIUM - until February 2026 nothing changed it${byDay ? "" : ". The first and last month count only the days inside the period"}`} />
        <StackedColumns data={data} parts={ORDER.map((k) => ({ key: k, label: k, color: COLOR[k] }))} format={(v) => full(v ?? 0)}
          xFormat={byDay ? (x) => `${x.slice(8, 10)}.${x.slice(5, 7)}` : monthLabel} />
      </GlassCard>
      <Box sx={TWO}>
        <DimChart title={`URGENT and HIGH, by topic, ${label}`} rows={topics.filter((x) => x.hot || x.hotB)} cur={(x) => x.hot} prev={(x) => x.hotB} curLabel={label} prevLabel={before}
          fmt={full} labelWidth={190} single={single} curNote={(x) => (x.n ? { text: `${pct(x.hot, x.n)} of its ${full(x.n)}`, color: MUTED } : null)}
          selected={pick?.kind === "today" ? [pick.label] : undefined} onPick={(l) => { const x = topics.find((y) => y.label === l); if (x) choose("today", x.id, l); }} />
        <DimChart title={`Who set the priority, ${label}`} rows={setters} cur={(x) => x.n} prev={(x) => x.b} curLabel={label} prevLabel={before}
          fmt={full} labelWidth={190} single={single} fixedOrder curNote={(x) => ({ text: `${pct(x.n, withPrio)}`, color: MUTED })}
          selected={pick?.kind === "by" ? [pick.label] : undefined} onPick={(l) => { const x = setters.find((y) => y.label === l); if (x) choose("by", x.id, l); }} />
      </Box>
      <ChartBox title={`All the figures, ${label}, by topic`} hint="Each topic's tickets by the priority they have in HubSpot today - a click on a row lists its tickets">
        <FullTable first="Topic" cols={cols} rows={topics} total={total} onPick={(l) => { const x = topics.find((y) => y.label === l); if (x) choose("today", x.id, l); }}
          selected={pick?.kind === "today" ? [pick.label] : undefined} />
      </ChartBox>
      {pick && (
        <Box id="bo-priority-tickets" sx={{ scrollMarginTop: 16, minWidth: 0 }}>
          <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
            <CardTitle icon={<HistoryOutlinedIcon />} tint="slate" title={pick.kind === "prio" ? `${pick.label} tickets` : pick.kind === "by" ? `Priority set by: ${pick.label}` : `Topic: ${pick.label}`}
              note={`Created ${label}, newest first - a row shows the hub's reasons and HubSpot now`}
              right={<Button size="small" onClick={() => setPick(null)} startIcon={<CloseIcon sx={{ fontSize: 16 }} />} sx={{ textTransform: "none" }}>Close</Button>} />
            <TicketList key={JSON.stringify(listFixed)} from={f.now.from} to={f.now.to} names={f.owners} fixed={listFixed} />
          </GlassCard>
        </Box>
      )}
    </>
  );
}

/* ── 2. the rules, and 3. what they would do before saving ── */

const SUBS: Record<string, string> = { "Website Issue": SUB.website, "Product Price": SUB.price, Delivery: SUB.delivery, "Invoicing & Accounting": SUB.invoicing, "Product Information": SUB.product };
const catOf = (r: Row) => r.route?.sets.enquiry_category ?? r.actual?.category ?? null;
const subOf = (r: Row) => { const c = catOf(r); const k = c ? SUBS[c] : undefined; return k ? r.route?.sets[k] ?? r.actual?.subCategory ?? null : null; };
const base = (r: Row) => (r.route?.sets.hs_ticket_priority as Priority | undefined) ?? null;
const lineOf = (r: Row, table: Data["priorityTable"]) => {
  const c = catOf(r), s = subOf(r);
  return table.find((l) => l.category === c && l.sub === s) ?? table.find((l) => l.category === c && l.sub === null) ?? null;
};
const words = (s: string) => s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
const glassBox = { boxShadow: "0 1px 2px rgba(21,34,58,.04)" } as const;
const step = { fontSize: "0.86rem", color: INK, display: "grid", gridTemplateColumns: "26px minmax(0, 1fr)", gap: 0.75, alignItems: "start" } as const;
const num = (i: number) => <Box sx={{ width: 22, height: 22, borderRadius: "50%", bgcolor: "rgba(36,89,209,.1)", color: "#2459d1", fontSize: "0.76rem", fontWeight: 800, display: "grid", placeItems: "center" }}>{i}</Box>;

function Rules({ d, onSaved }: { d: Data; onSaved: () => void }) {
  const [p, setP] = useState<PrioritySettings>(d.settings.priority);
  const [urgent, setUrgent] = useState(d.settings.priority.urgentWords.join(", "));
  const [news, setNews] = useState(d.settings.priority.newsletterWords.join(", "));
  const [keys, setKeys] = useState(d.settings.priority.keyCustomerPriorities.join(", "));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [edit, setEdit] = useState<string | null>(null);
  const [list, setList] = useState(false);
  const draft: PrioritySettings = { ...p, urgentWords: words(urgent).map((x) => x.toLowerCase()), newsletterWords: words(news).map((x) => x.toLowerCase()), keyCustomerPriorities: words(keys).map((x) => x.toUpperCase()) };
  const rows = d.rows.filter((r) => r.pipeline === "bo" && base(r));
  const results = useMemo(() => rows.map((r) => ({ r, hub: priorityFor(base(r), catOf(r), subOf(r), r.priorityFacts, draft) })), [rows, JSON.stringify(draft)]); // eslint-disable-line react-hooks/exhaustive-deps
  const changed = results.filter((x) => x.hub && x.hub.value !== base(x.r));
  const { slice, pager } = usePaged(changed, 10);
  const hit = {
    urgent: rows.filter((r) => r.priorityFacts?.urgentHits.some((w) => draft.urgentWords.includes(w))),
    news: rows.filter((r) => r.priorityFacts?.newsletterHits.some((w) => draft.newsletterWords.includes(w))),
    key: rows.filter((r) => r.priorityFacts?.salesPriority && draft.keyCustomerPriorities.includes(r.priorityFacts.salesPriority)),
  };
  const dirty = JSON.stringify(draft) !== JSON.stringify(d.settings.priority);
  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/uc/bo-distribution", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ priority: draft }) });
      const j = (await r.json()) as { ok: boolean; error?: string };
      setMsg(j.ok ? "Saved - the next ticket gets these priorities." : j.error ?? `HTTP ${r.status}`);
      onSaved();
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };
  const count = (line: Data["priorityTable"][number]) => rows.filter((r) => lineOf(r, d.priorityTable)?.key === line.key).length;
  const signal = (id: string, on: boolean, set: (v: boolean) => void, title: string, text: string, matches: Row[], why: (r: Row) => string, field: React.ReactNode) => (
    <Box sx={{ ...glassBox, border: `1px solid ${on ? "#1b7a55" : HAIRLINE}`, bgcolor: on ? "rgba(236,247,241,.9)" : "rgba(255,255,255,.7)", borderRadius: "18px", p: 2, display: "grid", gap: 1, alignContent: "start" }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: "0.9rem", color: INK }}>{title}</Typography>
          <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{text}</Typography>
        </Box>
        <Box sx={{ textAlign: "right" }}>
          <Switch size="small" checked={on} onChange={(e) => set(e.target.checked)} disabled={!d.admin} />
          <Typography sx={{ fontSize: "0.68rem", color: on ? "#1b7a55" : MUTED, fontWeight: 700 }}>{on ? "ON" : "off"}</Typography>
        </Box>
      </Box>
      <Typography sx={{ fontSize: "0.8rem", color: INK }}><b>{full(matches.length)}</b> of the last 7 days&apos; {full(rows.length)} tickets {on ? "are moved by it" : "would be moved by it"}</Typography>
      {matches.slice(0, 3).map((r) => (
        <Box key={r.key} component="a" href={hsTicket(r.ticketId)} target="_blank" rel="noopener" sx={{ textDecoration: "none", display: "block", borderTop: `1px solid ${HAIRLINE}`, pt: 0.5 }}>
          <Typography sx={{ fontSize: "0.76rem", color: INK, ...clip(360) }}>{r.subject || r.ticketId}</Typography>
          <Typography sx={{ fontSize: "0.7rem", color: MUTED }}>{why(r)}</Typography>
        </Box>
      ))}
      <Box>
        <Button size="small" onClick={() => setEdit(edit === id ? null : id)} sx={{ textTransform: "none", p: 0 }}>{edit === id ? "Close" : "Edit the words"}</Button>
        <Collapse in={edit === id}><Box sx={{ mt: 1 }}>{field}</Box></Collapse>
      </Box>
    </Box>
  );
  return (
    <>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<RuleOutlinedIcon />} tint="purple" title="How a ticket gets its priority" note={d.admin ? "Three steps, in this order - the table and the signals below change them" : "Three steps, in this order - admins can change them below"} />
        <Box sx={{ display: "grid", gap: 1 }}>
          <Box sx={step}>{num(1)}<span><b>Its topic.</b> Each topic and sub-category has a priority - the table below.</span></Box>
          <Box sx={step}>{num(2)}<span><b>A few e-mails, whatever the topic:</b> a C2S problem order is URGENT; a PERFORMIS or AVOR stopped order, a billing address change and an ERP export warning are HIGH.</span></Box>
          <Box sx={step}>{num(3)}<span><b>Three signals, each only when switched on:</b> urgent words and key customers raise it one level, a newsletter or advertising sets it LOW.</span></Box>
        </Box>
      </GlassCard>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
            <CardTitle icon={<TuneOutlinedIcon />} tint="purple" title="1. Priority by topic" note="'any other' is the rest of the topic; the tickets are the last 7 days'" />
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead><TableRow>{["Topic", "Sub-category", "Priority", "Tickets"].map((h, i) => <TableCell key={h} sx={{ ...headCell, textAlign: i === 3 ? "right" : "left" }}>{h}</TableCell>)}</TableRow></TableHead>
                <TableBody>
                  {d.priorityTable.map((l) => {
                    const v = p.overrides[l.key] ?? l.priority;
                    return (
                      <TableRow key={l.key}>
                        <TableCell sx={{ ...bodyCell, fontWeight: 700, whiteSpace: "nowrap" }}>{l.category}</TableCell>
                        <TableCell sx={{ ...bodyCell, color: l.sub ? INK : MUTED }}>{l.sub ?? "any other"}</TableCell>
                        <TableCell sx={bodyCell}>
                          {d.admin ? (
                            <TextField select size="small" value={v} sx={{ minWidth: 120 }}
                              onChange={(e) => setP((x) => { const o = { ...x.overrides }; if (e.target.value === l.priority) delete o[l.key]; else o[l.key] = e.target.value as Priority; return { ...x, overrides: o }; })}>
                              {PRIORITIES.map((pr) => <MenuItem key={pr} value={pr}>{pr}</MenuItem>)}
                            </TextField>
                          ) : <Chip tint={TINT[v]}>{v}</Chip>}
                          {v !== l.priority && <Typography sx={{ fontSize: "0.7rem", color: MUTED }}>was {l.priority}</Typography>}
                        </TableCell>
                        <TableCell sx={{ ...bodyCell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{count(l) || "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
      </GlassCard>
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(3, minmax(0, 1fr))" }, alignItems: "start" }}>
            {signal("urgent", p.raiseOnUrgentWords, (v) => setP({ ...p, raiseOnUrgentWords: v }), "3a. Urgent words: one level up", "The subject or the e-mail says it is urgent, in any of the six languages.", hit.urgent, (r) => `“${r.priorityFacts!.urgentHits[0]}” · ${base(r)} → one level up`,
              <TextField size="small" multiline minRows={2} fullWidth value={urgent} onChange={(e) => setUrgent(e.target.value)} disabled={!d.admin} helperText="Comma-separated" />)}
            {signal("key", p.raiseKeyCustomers, (v) => setP({ ...p, raiseKeyCustomers: v }), "3b. Key customers: one level up", "The ticket's company has one of these sales priorities (Smart Segmentation).", hit.key, (r) => `${r.company?.name ?? "company"} · ${r.priorityFacts!.salesPriority}`,
              <TextField size="small" fullWidth value={keys} onChange={(e) => setKeys(e.target.value)} disabled={!d.admin} helperText="e.g. P1, P2" />)}
            {signal("news", p.lowerNewsletters, (v) => setP({ ...p, lowerNewsletters: v }), "3c. Newsletters and advertising: LOW", "A newsletter, an unsubscribe link or a webinar invitation never needs HIGH.", hit.news, (r) => `“${r.priorityFacts!.newsletterHits[0]}” · ${base(r)} → LOW`,
              <TextField size="small" multiline minRows={2} fullWidth value={news} onChange={(e) => setNews(e.target.value)} disabled={!d.admin} helperText="Comma-separated" />)}
      </Box>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<CompareArrowsOutlinedIcon />} tint="amber" title="Before you save: the last 7 days with these rules"
          note={`The rules as they stand on this page${dirty ? ", with your changes" : " - the ones in use"}, tried on the ${full(rows.length)} Back Office tickets of the last 7 days`} />
        <Typography sx={{ fontSize: "0.92rem", color: INK }}>
          {changed.length ? <><b>{full(changed.length)}</b> of {full(rows.length)} tickets ({pct(changed.length, rows.length)}) would get another priority. URGENT: {full(results.filter((x) => base(x.r) === "URGENT").length)} today → {full(results.filter((x) => x.hub?.value === "URGENT").length)} with these rules.</>
            : <>Every ticket keeps its priority - nothing to change.</>}
        </Typography>
        {!!changed.length && (
          <Box sx={{ mt: 1 }}>
            <Button size="small" onClick={() => setList((x) => !x)} sx={{ textTransform: "none", p: 0 }}>{list ? "Hide the tickets" : `Show the ${full(changed.length)} tickets`}</Button>
            <Collapse in={list}>
              <Box sx={{ overflowX: "auto", mt: 1 }}>
                <Table size="small">
                  <TableHead><TableRow>{["Entered", "Ticket", "Today", "With these rules", "Why"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
                  <TableBody>
                    {slice.map(({ r, hub }) => (
                      <TableRow key={r.key}>
                        <TableCell sx={{ ...bodyCell, color: MUTED, fontSize: "0.8rem", whiteSpace: "nowrap" }}>{when(r.enteredAt)}</TableCell>
                        <TableCell sx={bodyCell}><Box component="a" href={hsTicket(r.ticketId)} target="_blank" rel="noopener" sx={{ color: INK, fontWeight: 600, textDecoration: "none", display: "block", ...clip(320) }}>{r.subject || r.ticketId}</Box></TableCell>
                        <TableCell sx={bodyCell}><Chip tint={TINT[base(r)!]}>{base(r)}</Chip></TableCell>
                        <TableCell sx={bodyCell}><Chip tint={TINT[hub!.value]}>{hub!.value}</Chip></TableCell>
                        <TableCell sx={{ ...bodyCell, fontSize: "0.78rem", color: MUTED }}>{hub!.why.join("; ")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
              {pager}
            </Collapse>
          </Box>
        )}
        {d.admin && (
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", mt: 1.5 }}>
            <Button variant="contained" size="small" disabled={busy || !dirty} onClick={() => void save()} sx={{ textTransform: "none" }}>Save the priority rules</Button>
            {busy && <CircularProgress size={14} />}
            {!dirty && !msg && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>Change the table or a signal above to save.</Typography>}
            {msg && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{msg}</Typography>}
          </Box>
        )}
      </GlassCard>
    </>
  );
}

export function PriorityTab({ d, onSaved, from, to, label }: { d: Data; onSaved: () => void; from: string; to: string; label: string }) {
  const r = useFigures(from, to);
  return (
    <>
      {r === null ? <LoadingPanel label={`Counting the Back Office tickets ${label}…`} />
        : r.state !== "ok" ? <Typography sx={{ color: RED, fontSize: "0.86rem" }}>{r.state === "error" ? r.error : "not configured"}</Typography>
        : !r.data.now.pr ? <LoadingPanel label="The priorities are counted after a release - the first count takes a few minutes" />
        : <Figures_ f={r.data} label={label} />}
      <Rules d={d} onSaved={onSaved} />
    </>
  );
}
