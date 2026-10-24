"use client";

// TICKET VALUE - a HubSpot app (UC & HubSpot Apps > HubSpot apps). The hub gives every ESO and TSA ticket its sales
// potential, how sure it is (confidence) and the path the value came from, and writes them on the ticket (live since
// 21.10.2026; SARCLA: "take out all reference to the past workflow"). Overview, Tickets, How it works and Settings as
// UC tabs; the time frame is the hub's reporting window in the header, like the other apps (SARCLA 24.10.2026); only ESO
// and TSA tickets are shown, amounts in EUR. Figures from src/lib/ticketValue/figures.ts (by day) and list.ts (ticket by
// ticket), the rules in rules.ts (decideHub), the writing in live.ts.

import { Fragment, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TablePagination from "@mui/material/TablePagination";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import RefreshIcon from "@mui/icons-material/Refresh";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import AltRouteOutlinedIcon from "@mui/icons-material/AltRouteOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import ManageSearchOutlinedIcon from "@mui/icons-material/ManageSearchOutlined";
import ScheduleIcon from "@mui/icons-material/ScheduleOutlined";
import AutoFixHighOutlinedIcon from "@mui/icons-material/AutoFixHighOutlined";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, KpiTile, MUTED, RED, TINT, TRACK, bodyCell, clip, headCell, hsTicket, type Tint } from "@/app/uc/report/ui";
import { ReportTabs, useHashTab } from "@/app/uc/report/Tabs";
import { Chip, Choice, Info, when } from "@/app/connectors/parts";
import { WindowPicker, useReportingWindow } from "@/app/window/ReportingWindow";
import type { RunInfo, Settings } from "@/lib/ticketValue/engine";
import type { PipelineValue } from "@/lib/ticketValue/live";
import type { ListRow } from "@/lib/ticketValue/list";
import { pickPipe, type PeriodSum, type Pipe, type Values } from "@/lib/ticketValue/model";
import { HUB_RULES, REENROL_STAGES } from "@/lib/ticketValue/rules";

type BetterInfo = { firstOrder: number | null; firstOrderMedian: number | null; firstOrderN: number; firstOrderAt: string | null; pricedArticles: number; firstOrderProgress: { done: number; of: number } | null };
type LiveInfo = { workflowOn: boolean | null; writing: boolean };
type Period = { from: string; to: string; readFrom: string | null; computing: boolean; progress: string | null; error: string | null; computedAt: string | null; sums: { ESO: PeriodSum; TSA: PeriodSum } | null };
type Data = { settings: Settings; last: RunInfo | null; everyMinutes: number; better?: BetterInfo; live?: LiveInfo; pipeline?: PipelineValue | null; period: Period; admin: boolean };
type List = { total: number; page: number; rows: ListRow[] };
/** The hub writes. */
const writing = (d: Data) => !!d.live?.writing;
type View = "overview" | "tickets" | "how" | "settings";
const VIEW_HASH: Record<View, string> = { overview: "#overview", tickets: "#tickets", how: "#how-it-works", settings: "#settings" };
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
const pipeLabel = (p: Pipe) => (p === "both" ? "ESO and TSA" : p);
/** The header's window in a sentence: "in the last 28 days", "this month so far", "1 Oct – 24 Oct 2026". */
const inWindow = (label: string) => (/^Last \d+ days$/.test(label) ? `in the ${label.toLowerCase()}` : /^(This month so far|Last month)$/.test(label) ? label.toLowerCase() : label);
const small = { fontSize: "0.8rem" } as const;
/** Amounts in EUR, as the other apps write them. */
const eur = (n: number) => `${full(n)} EUR`;

/** Where a value comes from, in words (sales_potential_source). */
const SOURCE: Record<string, string> = {
  direct_field: "on the ticket", child_gqs: "its GQS ticket", text_qty_price: "quantity × price in the text", product_lookup: "article × quantity",
  company_baseline: "the company's potential", unknown: "no signal (0)", unqualified: "not a sales ticket", manual_override: "typed by a person", "(none)": "no value",
};
const srcLabel = (s: string | null | undefined) => SOURCE[s ?? "(none)"] ?? s ?? "no value";
/** A ticket's value in EUR, to the cent when it has cents. */
const amount = (v: string | null | undefined) => {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} EUR` : v;
};
const valueText = (v: Values) => v.sales_potential_source || v.sales_potential_estimate ? `${amount(v.sales_potential_estimate)} · ${srcLabel(v.sales_potential_source)}` : "no value";
const hasValue = (v: Values) => !!(v.sales_potential_source || v.sales_potential_estimate);
/** The confidence of a value, as a chip. */
const CONF_TINT: Record<string, Tint> = { high: "green", medium: "blue", low: "amber", unqualified: "slate" };
function Conf({ c }: { c: string | null | undefined }) {
  if (!c || c === "-") return null;
  return <Chip tint={CONF_TINT[c] ?? "slate"}>{c}</Chip>;
}
const ruleOf = (k: string | undefined) => HUB_RULES.find((x) => x.rule === k);
const pathLabel = (k: string) => (k === "none" ? "No value yet" : ruleOf(k)?.label ?? k);
const confLabel = (k: string) => (k === "(none)" ? "no value yet" : k);
const CONF_ORDER = ["high", "medium", "low", "unqualified", "(none)"];
const PATH_ORDER = [...HUB_RULES.map((x) => x.rule as string), "none"];
const byOrder = (order: string[]) => (a: [string, unknown], b: [string, unknown]) => (order.indexOf(a[0]) + 1 || 99) - (order.indexOf(b[0]) + 1 || 99);

function SmallTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Table size="small">
        <TableHead><TableRow>{head.map((h, i) => <TableCell key={i} sx={{ ...headCell, textAlign: i > 0 ? "right" : "left" }}>{h}</TableCell>)}</TableRow></TableHead>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>{r.map((c, j) => <TableCell key={j} sx={{ ...bodyCell, fontSize: "0.84rem", textAlign: j > 0 ? "right" : "left", fontVariantNumeric: "tabular-nums" }}>{typeof c === "number" ? full(c) : c}</TableCell>)}</TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

/** While the days are being read from HubSpot, or when they could not be. */
function PeriodWait({ p }: { p: Period }) {
  return (
    <GlassCard>
      <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>
        {p.error ? `The tickets could not be read from HubSpot: ${p.error}` : `Reading the ESO and TSA tickets of the last 400 days from HubSpot${p.progress ? ` - ${p.progress}` : ""} (a minute or two, then kept 2 hours).`}
      </Typography>
    </GlassCard>
  );
}
/** The days asked for before the first day read. */
const before = (p: Period) => (p.readFrom && p.from < p.readFrom ? ` Tickets are read back to ${p.readFrom}.` : "");

// ---------------------------------------------------------------- Overview

/** The open pipeline as a funnel: all of it, then the part the hub is surer of - one hue, darker as it gets surer. */
function Funnel({ steps }: { steps: { label: string; n: number; value: number; shade: number }[] }) {
  const max = Math.max(1, steps[0]?.value ?? 0);
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      {steps.map((x, i) => (
        <Box key={x.label} sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "210px minmax(0, 1fr) 170px" }, alignItems: "center", gap: { xs: 0.5, md: 1.5 } }}>
          <Box>
            <Typography sx={{ fontSize: "0.88rem", fontWeight: 650, color: INK }}>{x.label}</Typography>
            <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{full(x.n)} open tickets</Typography>
          </Box>
          <Box sx={{ display: "flex", justifyContent: "center" }}>
            <Box sx={{
              width: `${Math.max(14, (x.value / max) * 100)}%`, height: 44, borderRadius: "10px", display: "grid", placeItems: "center", whiteSpace: "nowrap",
              bgcolor: `rgba(36, 89, 209, ${x.shade})`, color: x.shade > 0.6 ? "#fff" : INK, fontWeight: 700, fontSize: "0.98rem", fontVariantNumeric: "tabular-nums", transition: "width .3s",
            }}>
              {eur(x.value)}
            </Box>
          </Box>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED, textAlign: { xs: "left", md: "right" } }}>{`${i === 0 ? "100%" : pct(x.value, steps[0].value)} of the open value`}</Typography>
        </Box>
      ))}
    </Box>
  );
}

const PIPES: { key: Pipe; label: string }[] = [{ key: "both", label: "ESO and TSA" }, { key: "ESO", label: "ESO" }, { key: "TSA", label: "TSA" }];

function Overview({ d, pipe, setPipe, label }: { d: Data; pipe: Pipe; setPipe: (p: Pipe) => void; label: string }) {
  const name = pipeLabel(pipe);
  // the open pipeline today, by confidence
  const open = (d.pipeline?.pipes ?? []).filter((x) => pipe === "both" || x.pipeline === pipe).reduce((t, x) => {
    const c = (k: string) => x.byConf[k] ?? { n: 0, value: 0 };
    return { n: t.n + x.open, value: t.value + x.value, mhN: t.mhN + c("high").n + c("medium").n, mh: t.mh + c("high").value + c("medium").value, hN: t.hN + c("high").n, h: t.h + c("high").value };
  }, { n: 0, value: 0, mhN: 0, mh: 0, hN: 0, h: 0 });
  // the days chosen, from every ticket's own value
  const s = d.period.sums ? pickPipe(d.period.sums, pipe) : null;
  const conf = (k: string) => s?.byConf[k] ?? { n: 0, value: 0 };
  const paths = s ? Object.entries(s.byPath).sort(byOrder(PATH_ORDER)) : [];
  const confRows = s ? Object.entries(s.byConf).sort(byOrder(CONF_ORDER)) : [];
  const created = `${name} tickets created ${inWindow(label)}`;
  return (
    <>
      {!writing(d) && <Info>Paused - the hub works each ticket&apos;s value out but writes nothing to HubSpot. Settings switches it back to Live.</Info>}
      <GlassCard>
        <CardTitle icon={<PaidOutlinedIcon />} tint="blue" title={`Open ${name} pipeline`}
          note={d.pipeline ? `Today - every open ticket's value, and how much of it the hub is sure of · worked out ${when(d.pipeline.at)}, every 30 minutes` : "Worked out within minutes"}
          right={<Choice<Pipe> value={pipe} onChange={setPipe} options={PIPES} />} />
        {d.pipeline ? (
          <Funnel steps={[
            { label: "All open tickets", n: open.n, value: open.value, shade: 0.14 },
            { label: "Medium or high confidence", n: open.mhN, value: open.mh, shade: 0.42 },
            { label: "High confidence", n: open.hN, value: open.h, shade: 0.88 },
          ]} />
        ) : <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Being worked out.</Typography>}
      </GlassCard>
      {!s ? <PeriodWait p={d.period} /> : (
        <>
          <Grid container spacing={2}>
            {[
              { label: "Tickets", value: full(s.total.n), note: created, icon: <ConfirmationNumberOutlinedIcon />, tint: "blue" as const },
              { label: "Their value", value: eur(s.total.value), note: "Their sales potential added up, as it is on them now", icon: <PaidOutlinedIcon />, tint: "purple" as const },
              { label: "High confidence", value: eur(conf("high").value), note: `${full(conf("high").n)} tickets · ${pct(conf("high").value, s.total.value)} of the value`, icon: <AutoFixHighOutlinedIcon />, tint: "green" as const },
              { label: "Medium / low", value: `${full(conf("medium").value)} / ${full(conf("low").value)} EUR`, note: `${full(conf("medium").n)} / ${full(conf("low").n)} tickets`, icon: <EditNoteOutlinedIcon />, tint: "amber" as const },
            ].map((k) => <Grid key={k.label} size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={k.icon} tint={k.tint} label={k.label} value={k.value} note={k.note} /></Grid>)}
          </Grid>
          <GlassCard>
            <CardTitle icon={<AltRouteOutlinedIcon />} tint="purple" title="Where each value comes from" note={`${created} - the path that gave the value, how many tickets, how much, how sure.${before(d.period)}`} />
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead><TableRow>{["Path", "The value is", "Confidence", "Tickets", "Value", "Per ticket"].map((h, i) => <TableCell key={h} sx={{ ...headCell, textAlign: i > 2 ? "right" : "left" }}>{h}</TableCell>)}</TableRow></TableHead>
                <TableBody>
                  {paths.map(([k, x]) => {
                    const r = ruleOf(k);
                    return (
                      <TableRow key={k}>
                        <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontWeight: 600, whiteSpace: "nowrap" }}>{pathLabel(k)}{r?.automated ? <Box component="span" sx={{ color: FAINT, fontWeight: 400 }}> · automated</Box> : null}</TableCell>
                        <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED }}>{k === "none" ? "Not valued yet - picked up within minutes" : r?.from ?? ""}</TableCell>
                        <TableCell sx={bodyCell}><Conf c={r?.confidence} /></TableCell>
                        <TableCell sx={{ ...bodyCell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{full(x.n)}</TableCell>
                        <TableCell sx={{ ...bodyCell, textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{eur(x.value)}</TableCell>
                        <TableCell sx={{ ...bodyCell, textAlign: "right", fontVariantNumeric: "tabular-nums", color: MUTED, whiteSpace: "nowrap" }}>{x.n ? eur(x.value / x.n) : "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
            {!paths.length && <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>No ticket in these days.</Typography>}
          </GlassCard>
          <GlassCard>
            <CardTitle icon={<AutoFixHighOutlinedIcon />} tint="green" title="By confidence" note={`How sure the hub is of the values - ${created}`} />
            <SmallTable head={["Confidence", "Tickets", "Value", "Share"]} rows={confRows.map(([k, x]) => [confLabel(k), x.n, eur(x.value), pct(x.value, s.total.value)])} />
          </GlassCard>
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------- Tickets

/** The ESO and TSA tickets of the days chosen, newest first, read from HubSpot page by page. */
function TicketsTab({ d, pipe, setPipe, label }: { d: Data; pipe: Pipe; setPipe: (p: Pipe) => void; label: string }) {
  const [conf, setConf] = useState("all");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [list, setList] = useState<{ key: string; data?: List; error?: string } | null>(null);
  const { from, to } = d.period;
  const key = `${from}|${to}|${pipe}|${conf}|${page}`;
  useEffect(() => {
    const ctl = new AbortController();
    fetch(`/api/uc/ticket-value?list=1&from=${from}&to=${to}&pipe=${pipe}&conf=${encodeURIComponent(conf)}&page=${page}`, { signal: ctl.signal })
      .then((r) => r.json() as Promise<{ ok: boolean; data?: List; error?: string }>)
      .then((j) => setList(j.ok && j.data ? { key, data: j.data } : { key, error: j.error ?? "could not be read" }))
      .catch((e: Error) => { if (e.name !== "AbortError") setList({ key, error: e.message }); });
    return () => ctl.abort();
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const sums = d.period.sums;
  const s = sums ? pickPipe(sums, pipe) : null;
  const confs = s ? Object.entries(s.byConf).sort(byOrder(CONF_ORDER)) : [];
  const loading = !list || list.key !== key;
  const rows = list?.data?.rows ?? [];
  const l = d.last;
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
      <CardTitle icon={<HistoryOutlinedIcon />} tint="slate" title="Ticket by ticket"
        note={`${pipeLabel(pipe)} tickets created ${inWindow(label)}, newest first - the value on each one now${l ? ` · the hub last looked ${when(l.at)}` : ""}.${before(d.period)}`} />
      <Box sx={{ mb: 1.5, display: "grid", gap: 1 }}>
        <Choice<Pipe> value={pipe} onChange={(p) => { setPipe(p); setPage(0); }} options={PIPES.map((x) => ({ ...x, count: sums ? pickPipe(sums, x.key).total.n : undefined }))} />
        <Choice<string> value={conf} onChange={(c) => { setConf(c); setPage(0); }} options={[
          { key: "all", label: "All", count: s?.total.n }, ...confs.map(([k, x]) => ({ key: k, label: k === "(none)" ? "No value yet" : k === "unqualified" ? "Not a sales ticket" : k[0].toUpperCase() + k.slice(1), count: x.n })),
        ]} />
      </Box>
      <Box sx={{ overflowX: "auto", opacity: loading && list ? 0.55 : 1, transition: "opacity .15s" }}>
        <Table size="small">
          <TableHead><TableRow>{["Created", "Ticket", "Value, confidence, path", "Before", "The hub", ""].map((h, i) => <TableCell key={i} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {rows.map((r) => (
              <Fragment key={r.id}>
                <TableRow hover onClick={() => setOpen(open === r.id ? null : r.id)} sx={{ cursor: "pointer" }}>
                  <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap", color: MUTED, fontSize: "0.8rem" }}>{when(r.created)}</TableCell>
                  <TableCell sx={bodyCell}>
                    <Box component="a" href={hsTicket(r.id)} target="_blank" rel="noopener" onClick={(e: React.MouseEvent) => e.stopPropagation()} sx={{ color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(320) }}>{r.subject || r.id}</Box>
                    <Box sx={{ fontSize: "0.74rem", color: MUTED }}>{r.pipeline}</Box>
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, ...small }}>
                    {hasValue(r.now) ? (
                      <Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                          <Box sx={{ fontWeight: 600, color: INK, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{amount(r.now.sales_potential_estimate)}</Box>
                          <Conf c={r.now.sales_potential_confidence} />
                        </Box>
                        <Box sx={{ fontSize: "0.74rem", color: MUTED, whiteSpace: "nowrap" }}>{pathLabel(r.path)}</Box>
                      </Box>
                    ) : <Box component="span" sx={{ color: FAINT }}>no value yet</Box>}
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, ...small, color: MUTED, whiteSpace: "nowrap" }}>{r.hub ? (hasValue(r.hub.before) ? amount(r.hub.before.sales_potential_estimate) : "no value") : "—"}</TableCell>
                  <TableCell sx={{ ...bodyCell, ...small, color: MUTED, whiteSpace: "nowrap" }}>{r.hub ? when(r.hub.at) : "—"}</TableCell>
                  <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}>
                    {r.hub ? (r.hub.error ? <Chip tint="pink">not written</Chip> : r.hub.changed ? <Chip tint="green">written</Chip> : <Chip tint="slate">no change</Chip>) : null}
                  </TableCell>
                </TableRow>
                {open === r.id && (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ ...bodyCell, bgcolor: "rgba(36,89,209,.04)", fontSize: "0.8rem" }}>
                      <b>On the ticket now:</b> {valueText(r.now)} · confidence {r.now.sales_potential_confidence ?? "—"} · path: {pathLabel(r.path)}
                      {r.hub
                        ? <> · <b>the hub</b> {when(r.hub.at)} ({r.hub.why}): {r.hub.changed ? `wrote it - before: ${valueText(r.hub.before)}` : "nothing to change"}{r.hub.error ? ` - not written: ${r.hub.error}` : ""}</>
                        : " · the hub's change log keeps 21 days - Settings, Check a ticket, shows its whole history"}
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </Box>
      {list?.data && list.data.total > 15 && (
        <TablePagination component="div" count={Math.min(list.data.total, 9990)} page={page} onPageChange={(_, n) => setPage(n)} rowsPerPage={15} rowsPerPageOptions={[15]}
          labelDisplayedRows={({ from: a, to: b }) => `${a}-${b} of ${full(list.data!.total)}`} sx={{ borderTop: `1px solid ${HAIRLINE}` }} />
      )}
      {loading && !list && <Box sx={{ py: 2, display: "flex", gap: 1, alignItems: "center", color: MUTED, fontSize: "0.84rem" }}><CircularProgress size={14} /> Reading HubSpot…</Box>}
      {list?.error && list.key === key && <Typography sx={{ fontSize: "0.85rem", color: RED, mt: 1 }}>{list.error}</Typography>}
      {!loading && list?.data && !rows.length && <Typography sx={{ fontSize: "0.85rem", color: MUTED, mt: 1 }}>No ticket in these days.</Typography>}
    </GlassCard>
  );
}

// ---------------------------------------------------------------- How it works

function Step({ n, tint, title, text, count, of, last, aside }: { n: number; tint: Tint; title: string; text: React.ReactNode; count?: number; of?: number; last?: boolean; aside?: React.ReactNode }) {
  const t = TINT[tint];
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "34px minmax(0, 1fr) auto", columnGap: 1.75 }}>
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Box sx={{ width: 30, height: 30, borderRadius: "50%", display: "grid", placeItems: "center", bgcolor: t.bg, color: t.fg, fontSize: "0.82rem", fontWeight: 700, flexShrink: 0 }}>{n}</Box>
        {!last && <Box sx={{ flex: 1, width: "2px", bgcolor: HAIRLINE, my: 0.5, minHeight: 18 }} />}
      </Box>
      <Box sx={{ pb: last ? 0 : 2.25, minWidth: 0 }}>
        <Typography sx={{ fontSize: "0.92rem", fontWeight: 650, color: INK }}>{title}</Typography>
        <Typography component="div" sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45, mt: 0.25 }}>{text}</Typography>
        {count !== undefined && of !== undefined && (
          <Box sx={{ height: 6, borderRadius: 99, bgcolor: TRACK, mt: 0.9, maxWidth: 520, overflow: "hidden" }}>
            <Box sx={{ height: "100%", width: `${of ? Math.max(count ? 1.5 : 0, (count / of) * 100) : 0}%`, bgcolor: t.fg, opacity: 0.75, borderRadius: 99 }} />
          </Box>
        )}
        {aside && <Box sx={{ mt: 0.9 }}>{aside}</Box>}
      </Box>
      <Box sx={{ textAlign: "right", pt: 0.25 }}>
        {count !== undefined && <>
          <Typography sx={{ fontSize: "1.25rem", fontWeight: 700, color: INK, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{full(count)}</Typography>
          <Typography sx={{ fontSize: "0.72rem", color: FAINT, whiteSpace: "nowrap" }}>{of ? pct(count, of) : ""}</Typography>
        </>}
      </Box>
    </Box>
  );
}

function HowTab({ d, label }: { d: Data; label: string }) {
  const bi: BetterInfo = d.better ?? { firstOrder: null, firstOrderMedian: null, firstOrderN: 0, firstOrderAt: null, pricedArticles: 0, firstOrderProgress: null };
  const s = d.period.sums ? pickPipe(d.period.sums, "both") : null;
  const n = (k: string) => s?.byPath[k]?.n ?? 0;
  const tickets = `ESO and TSA tickets created ${inWindow(label)}`;
  const auto = HUB_RULES.filter((x) => x.automated);
  const path = HUB_RULES.filter((x) => !x.automated && x.rule !== "not-eso-tsa");
  const requests = path.reduce((t, x) => t + n(x.rule), 0);
  const tint = (c: string): Tint => CONF_TINT[c] ?? "slate";
  return (
    <>
      <GlassCard>
        <CardTitle icon={<ScheduleIcon />} tint="blue" title="When the value is worked out" note="Every 2 minutes, for the ESO and TSA tickets of these moments" />
        <Box sx={{ display: "grid", gap: 0.75 }}>
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>• <b>A new ticket</b>, 4 minutes after it is created.</Typography>
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>• <b>A ticket entering</b> {Object.values(REENROL_STAGES).join(", ")} - worked out again.</Typography>
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>• <b>Any ESO or TSA ticket without a value</b> - for example one handed over from Back Office - picked up within minutes.</Typography>
        </Box>
      </GlassCard>
      <GlassCard>
        <CardTitle icon={<AutoFixHighOutlinedIcon />} tint="amber" title="Automated tickets: the value their automation gives" note={`Checked first - a ticket of one of these kinds never goes down the path below unless its value is missing · ${tickets}`} />
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>{["Ticket", "Its value", "Confidence", "Tickets"].map((h, i) => <TableCell key={h} sx={{ ...headCell, textAlign: i === 3 ? "right" : "left" }}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {auto.map((x) => (
                <TableRow key={x.rule}>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontWeight: 600, whiteSpace: "nowrap" }}>{x.label}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", color: MUTED }}>{x.from}</TableCell>
                  <TableCell sx={bodyCell}><Conf c={x.confidence} /></TableCell>
                  <TableCell sx={{ ...bodyCell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{s ? full(n(x.rule)) : "…"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
        <Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: 1.25 }}>
          The average first order: {bi.firstOrder ? <><b>{eur(bi.firstOrder)}</b> (median {eur(bi.firstOrderMedian ?? 0)}) - the first orders of the newest {full(bi.firstOrderN)} customers of the last 12 months, worked out {when(bi.firstOrderAt)}, again every week.</> : bi.firstOrderProgress ? `being worked out - ${bi.firstOrderProgress.done} of ${bi.firstOrderProgress.of} customers read.` : "worked out within the hour."}
          {" "}What an article sells for per piece: its revenue ÷ quantity this year and last ({full(bi.pricedArticles)} articles, from last night&apos;s orders).
        </Typography>
      </GlassCard>
      <GlassCard>
        <CardTitle icon={<AltRouteOutlinedIcon />} tint="purple" title="Customer requests: the path, in order" note={`E-mails, forms, chats - the first rule that finds a value wins · ${s ? `${full(requests)} ` : ""}${tickets}`} />
        <Box sx={{ maxWidth: 940 }}>
          {path.map((x, i) => (
            <Step key={x.rule} n={i + 1} tint={tint(x.confidence)} title={x.label} count={s ? n(x.rule) : undefined} of={s ? requests : undefined} last={i === path.length - 1}
              text={<>{x.from}{x.rule === "product" ? ". Products & Pricing's list price is per price unit (1, 100 or 1,000 pieces) and never says which - so the hub uses what the article really sold for. “1120036838 x 100”, “100 Stk”, “Menge: 100” count, and every article is added up." : x.rule === "company" ? ". The ticket is linked to the company when it was found through its contact or the e-mail domain." : ""}</>}
              aside={<Conf c={x.confidence} />} />
          ))}
        </Box>
      </GlassCard>
      <GlassCard>
        <CardTitle icon={<TuneOutlinedIcon />} tint="green" title="What it writes" note="Every change kept with what was there before" />
        <Box sx={{ display: "grid", gap: 0.75 }}>
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>• On the ticket: <b>Sales potential estimate</b> (EUR), <b>its source</b> and <b>its confidence</b> - only when one of them changes.</Typography>
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>• The ticket&apos;s <b>link to its company</b>, when the company was found through the contact or the e-mail domain.</Typography>
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>• Rows in the <b>KPI object</b> (ticket created, value created, closed, won / lost, open) - the Customer journey KPIs read them.</Typography>
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>• Only ESO and TSA tickets get a value; no other pipeline is valued.</Typography>
        </Box>
      </GlassCard>
    </>
  );
}

// ---------------------------------------------------------------- Settings

type Checked = {
  ticketId: string; subject: string; pipeline: string; now: Values;
  company: { id: string; via: string; mandant: string; yp: number; tickets12m: number } | null;
  history: { prop: string; entries: { value: string | null; at: string | null; by: string }[] }[];
  better?: { rule?: string; ruleLabel?: string; action: string; final: Values; changes: boolean; company?: { id: string; via: string; mandant: string; yp: number; tickets12m: number } | null };
};
/** Who wrote a value, in words. */
const byLabel = (by: string) => (by === "app 50521064" ? "the hub" : by === "workflow" || by === "app 30109717" ? "earlier" : by === "crm_ui" ? "a person" : by);

function SettingsTab({ d, onChanged }: { d: Data; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [tid, setTid] = useState("");
  const [check, setCheck] = useState<{ row?: Checked; error?: string } | null>(null);
  const call = async (what: string, method: "PUT" | "POST", body: unknown) => {
    setBusy(what); setMsg(null);
    try {
      const r = await fetch("/api/uc/ticket-value", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await r.json()) as { ok: boolean; error?: string; data?: { skipped?: string } };
      setMsg(j.ok ? (j.data?.skipped ? `Not run: ${j.data.skipped}.` : "Done.") : j.error ?? `HTTP ${r.status}`);
      onChanged();
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(null); }
  };
  const doCheck = async () => {
    setBusy("check"); setCheck(null);
    try {
      const r = await fetch(`/api/uc/ticket-value?ticket=${encodeURIComponent(tid.trim())}`);
      const j = (await r.json()) as { ok: boolean; data?: Checked; error?: string };
      setCheck(j.ok && j.data ? { row: j.data } : { error: j.error ?? `HTTP ${r.status}` });
    } catch (e) { setCheck({ error: (e as Error).message }); } finally { setBusy(null); }
  };
  const c = check?.row;
  const company = c?.better?.company ?? c?.company;
  return (
    <>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<TuneOutlinedIcon />} tint="blue" title="How it runs" note={`Every ${d.everyMinutes} minutes`} />
        <Box sx={{ display: "grid", gap: 1.5 }}>
          <Choice<"off" | "shadow" | "live"> value={d.settings.mode} onChange={(m) => {
            if (!d.admin || m === d.settings.mode) return;
            if (m === "live" && !window.confirm("Switch Ticket value to live? The hub writes each ESO and TSA ticket's value again. Every change is kept with what was there before.")) return;
            void call("mode", "PUT", { mode: m });
          }} options={[{ key: "live", label: "Live - the hub writes" }, { key: "shadow", label: "Paused - works values out, writes nothing" }, { key: "off", label: "Off" }]} />
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>
            {d.live?.writing
              ? <>Writing{d.settings.liveFrom ? ` since ${when(d.settings.liveFrom)}` : ""}.</>
              : d.settings.mode === "live"
                ? <><b>Waiting:</b> the old HubSpot workflow “SARCLA | TICKET VALUE CALCULATION” is {d.live?.workflowOn ? "switched on again" : "not readable"} - the hub writes nothing while it runs. Switch it off in HubSpot (Automation → Workflows) and the hub goes on within 2 minutes.</>
                : d.settings.mode === "shadow" ? "Paused: values are worked out, nothing is written." : "Off."}
          </Typography>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Button variant="outlined" size="small" disabled={!d.admin || !!busy} onClick={() => void call("run", "POST", { action: "run" })} sx={{ textTransform: "none" }}>Look now</Button>
            {busy === "run" && <CircularProgress size={14} />}
          </Box>
          {msg && <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>{msg}</Typography>}
        </Box>
      </GlassCard>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<ManageSearchOutlinedIcon />} tint="purple" title="Check a ticket" note="Read only - what the hub's rules give it now, next to what is on it. Nothing is written" />
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); if (tid.trim() && !busy) void doCheck(); }} sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
          <TextField size="small" value={tid} onChange={(e) => setTid(e.target.value)} placeholder="Ticket id, e.g. 440083382514" inputProps={{ "aria-label": "Ticket id", inputMode: "numeric" }} sx={{ minWidth: 260 }} />
          <Button type="submit" variant="contained" disableElevation size="small" disabled={!/^\d+$/.test(tid.trim()) || !!busy} sx={{ textTransform: "none" }}>
            {busy === "check" ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : "Check"}
          </Button>
        </Box>
        {check?.error && <Typography sx={{ fontSize: "0.84rem", color: RED, mt: 1.5 }}>{check.error}</Typography>}
        {c && (
          <Box sx={{ mt: 1.5, display: "grid", gap: 0.6 }}>
            <Typography sx={{ fontSize: "0.86rem", fontWeight: 600 }}>
              <Box component="a" href={hsTicket(c.ticketId)} target="_blank" rel="noopener" sx={{ color: INK }}>{c.subject || c.ticketId}</Box>
              <Box component="span" sx={{ color: MUTED, fontWeight: 400 }}> - {c.pipeline}</Box>
            </Typography>
            <Typography sx={{ ...small, color: INK }}><b>On it now:</b> {valueText(c.now)} · confidence {c.now.sales_potential_confidence ?? "—"}</Typography>
            {c.better && <Typography sx={{ ...small, color: INK }}><b>The hub&apos;s rules give:</b> {c.better.rule === "not-eso-tsa" ? "no value - only ESO and TSA tickets get one" : <>{valueText(c.better.final)} · confidence {c.better.final.sales_potential_confidence ?? "—"} · path: {c.better.ruleLabel ?? "—"} ({c.better.action}){c.better.changes ? "" : " - already on the ticket"}</>}</Typography>}
            {company && <Typography sx={{ ...small, color: INK }}><b>Company:</b> {company.id} (found through the {company.via}) · {company.mandant} · yearly potential {eur(company.yp)} · {full(company.tickets12m)} tickets in 12 months</Typography>}
            <Box sx={{ overflowX: "auto", mt: 0.5 }}>
              <Table size="small">
                <TableHead><TableRow>{["Property", "Value", "When", "By"].map((h) => <TableCell key={h} sx={{ ...headCell, py: 0.5 }}>{h}</TableCell>)}</TableRow></TableHead>
                <TableBody>
                  {c.history.flatMap((h) => h.entries.map((e, i) => (
                    <TableRow key={`${h.prop}${i}`}>
                      <TableCell sx={{ ...bodyCell, py: 0.5, ...small, color: i ? FAINT : INK }}>{i ? "" : h.prop.replace("sales_potential_", "")}</TableCell>
                      <TableCell sx={{ ...bodyCell, py: 0.5, ...small }}>{h.prop.endsWith("source") ? srcLabel(e.value) : h.prop.endsWith("estimate") ? amount(e.value) : e.value ?? "—"}</TableCell>
                      <TableCell sx={{ ...bodyCell, py: 0.5, ...small, whiteSpace: "nowrap" }}>{when(e.at)}</TableCell>
                      <TableCell sx={{ ...bodyCell, py: 0.5, ...small, color: MUTED }}>{byLabel(e.by)}</TableCell>
                    </TableRow>
                  )))}
                </TableBody>
              </Table>
            </Box>
          </Box>
        )}
      </GlassCard>
    </>
  );
}

export default function TicketValue() {
  const [view, setView] = useHashTab<View>(VIEW_HASH, "overview");
  const [n, setN] = useState(0);
  const [pipe, setPipe] = useState<Pipe>("both");
  const { window: win, label } = useReportingWindow();
  const url = `/api/uc/ticket-value?from=${win.from}&to=${win.to}${n ? `&n=${n}` : ""}`;
  const held = useHeld<Data>(url, [url]);
  const r = held.result;
  const again = () => setN((x) => x + 1);
  const ok = r?.state === "ok" ? r.data : null;
  // the days' figures are read in the background: ask again until they are in
  const computing = !!ok?.period.computing && !ok.period.sums;
  useEffect(() => {
    if (!computing) return;
    const t = setTimeout(() => setN((x) => x + 1), 15_000);
    return () => clearTimeout(t);
  }, [computing, n]);
  let body: React.ReactNode;
  if (r === null) body = <LoadingPanel label="Reading the tickets…" />;
  else if (r.state !== "ok") body = <UpstreamPanel source="Ticket value" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? r.status : null} onRetry={again} />;
  else if (view === "settings") body = <SettingsTab d={r.data} onChanged={again} />;
  else if (view === "tickets") body = <TicketsTab d={r.data} pipe={pipe} setPipe={setPipe} label={label} />;
  else if (view === "how") body = <HowTab d={r.data} label={label} />;
  else body = <Overview d={r.data} pipe={pipe} setPipe={setPipe} label={label} />;
  const total = ok?.period.sums ? pickPipe(ok.period.sums, "both").total.n : null;
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader
        title="Ticket value"
        rightSlot={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {(r === null || held.stale || computing) && <CircularProgress size={14} sx={{ color: MUTED }} />}
            {view !== "settings" && <WindowPicker />}
            <Tooltip title="Read again"><IconButton size="small" onClick={again} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton></Tooltip>
          </Box>
        }
      />
      <Box>
        <ReportTabs name="ticketvalue" tab={view} onSelect={setView} tabs={[
          { id: "overview", label: "Overview", count: null },
          { id: "tickets", label: "Tickets", count: total !== null ? full(total) : null },
          { id: "how", label: "How it works", count: null },
          { id: "settings", label: "Settings", count: null },
        ]} />
      </Box>
      <Box id={`ticketvalue-panel-${view}`} role="tabpanel" sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>{body}</Box>
    </Box>
  );
}
