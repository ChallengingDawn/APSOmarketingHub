"use client";

// SATISFACTION - what the customers' survey answers say (SARCLA 27.10.2026: "the happiness per country - based on
// locales - and languages and locale"), in the reports' design: the figures first, then the breakdowns as the other
// KPI pages draw them (DimChart + All the figures), and the customers' own words. Used by Reporting > Satisfaction
// KPIs (every survey) and by APSOassistant Chat > Satisfaction (the chats' surveys). Data: src/lib/satisfaction.

import { useRef, useState } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import Grid from "@mui/material/Grid";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import SentimentSatisfiedAltOutlinedIcon from "@mui/icons-material/SentimentSatisfiedAltOutlined";
import SentimentVeryDissatisfiedOutlinedIcon from "@mui/icons-material/SentimentVeryDissatisfiedOutlined";
import QuestionAnswerOutlinedIcon from "@mui/icons-material/QuestionAnswerOutlined";
import ThumbsUpDownOutlinedIcon from "@mui/icons-material/ThumbsUpDownOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import FormatQuoteOutlinedIcon from "@mui/icons-material/FormatQuoteOutlined";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import { full } from "@/app/charts/format";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { DELTA, SERIES } from "@/app/charts/palette";
import { Chip } from "@/app/connectors/parts";
import { CardTitle, GlassCard, INK, KpiTile, MUTED, bodyCell, headCell, type Tint } from "@/app/uc/report/ui";
import { ReportTabs } from "@/app/uc/report/Tabs";
import { DimChart } from "@/app/reporting/marketing-kpis/DimChart";
import type { Group, SatisfactionData } from "@/lib/satisfaction/figures";

type View = "overview" | "countries" | "languages" | "touchpoints" | "comments";
const pctOf = (x: number | null) => (x === null ? "–" : `${Math.round(x * 100)}%`);
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (k: string) => `${MONTH[Number(k.slice(5, 7)) - 1] ?? k.slice(5, 7)} ${k.slice(2, 4)}`;
const SENT: Record<string, { label: string; tint: Tint }> = {
  happy: { label: "Happy", tint: "green" }, neutral: { label: "Neutral", tint: "amber" }, unhappy: { label: "Unhappy", tint: "pink" },
  promoter: { label: "Promoter", tint: "green" }, passive: { label: "Passive", tint: "amber" }, detractor: { label: "Detractor", tint: "pink" },
};
/**
 * A breakdown's chart: the CSAT of each group, the groups with the most answers first (fixedOrder) - ranked by the
 * CSAT itself, a country with one happy answer would lead Switzerland's thousands. Each bar names its answers. Groups
 * with no CSAT answer (NPS only) are left out of it.
 */
const csatRows = (gs: Group[]) => gs.filter((g) => g.csat !== null).map((g) => ({ ...g, label: g.label, n: Math.round((g.csat ?? 0) * 100) }))
  .sort((a, b) => b.tally.answers - a.tally.answers || a.label.localeCompare(b.label));
const answersNote = (g: Group) => ({ text: `${full(g.tally.answers)} answer${g.tally.answers === 1 ? "" : "s"}`, color: MUTED });
const plural = (n: number, one: string, many: string) => `${full(n)} ${n === 1 ? one : many}`;
/** happy green, neutral amber, unhappy red - the sentiment's own colour, not a categorical slot */
const SENT_COLOR = { happy: DELTA.good, neutral: SERIES[3], unhappy: DELTA.bad };

export function SatisfactionView({ d, label, showTouchpoints = true }: { d: SatisfactionData; label: string; showTouchpoints?: boolean }) {
  const [view, setView] = useState<View>("overview");
  const t = d.total.tally;
  const csatN = t.happy + t.neutral + t.unhappy;
  const npsN = t.promoters + t.passives + t.detractors;
  const tabs: { id: View; label: string; count: string | null }[] = [
    { id: "overview", label: "Overview", count: null },
    { id: "countries", label: "Countries", count: null },
    { id: "languages", label: "Languages & locales", count: null },
    ...(showTouchpoints ? [{ id: "touchpoints" as View, label: "Touchpoints", count: null }] : []),
    { id: "comments", label: "Comments", count: d.commentsTotal ? full(d.commentsTotal) : null },
  ];
  return (
    <>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<SentimentSatisfiedAltOutlinedIcon />} tint="green" label="Satisfied (CSAT)" value={pctOf(d.total.csat)}
          note={`${full(t.happy)} happy · ${full(t.neutral)} neutral · ${full(t.unhappy)} unhappy`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<QuestionAnswerOutlinedIcon />} tint="purple" label="Answers" value={full(t.answers)}
          note={`${label}${npsN ? ` · ${full(csatN)} CSAT, ${full(npsN)} NPS` : ""}`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<SentimentVeryDissatisfiedOutlinedIcon />} tint="pink" label="Unhappy" value={csatN ? pctOf(t.unhappy / csatN) : "–"}
          note={`${plural(t.unhappy, "answer", "answers")} - their words first under Comments`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>{npsN
          ? <KpiTile icon={<ThumbsUpDownOutlinedIcon />} tint="blue" label="NPS" value={d.total.nps === null ? "–" : String(d.total.nps)} note={`${plural(t.promoters, "promoter", "promoters")} · ${plural(t.passives, "passive", "passives")} · ${plural(t.detractors, "detractor", "detractors")}`} />
          : <KpiTile icon={<FormatQuoteOutlinedIcon />} tint="blue" label="Comments" value={full(d.commentsTotal)} note="customers who wrote a few words" />}</Grid>
      </Grid>
      <Box sx={{ justifySelf: "start" }}><ReportTabs name="satisfaction" tab={view} onSelect={setView} tabs={tabs} /></Box>
      {view === "overview" && <Overview d={d} showTouchpoints={showTouchpoints} />}
      {view === "countries" && <Breakdown title="Satisfied per country" groups={d.byCountry} first="Country"
        note={`The shop's store view the answer was given on (…/de-DE/…), else the answer's own country, else its contact's.${d.noCountry ? ` ${plural(d.noCountry, "answer has", "answers have")} none of the three ("Not known").` : ""}`} />}
      {view === "languages" && (
        <>
          <Breakdown title="Satisfied per language" groups={d.byLanguage} first="Language" note="The language of the survey the customer answered." />
          <Breakdown title="Satisfied per locale" groups={d.byLocale} first="Locale" note="The shop's store view the answer was given on: de-CH, fr-CH, it-IT … - else the survey's language and the country (– = not known)." />
        </>
      )}
      {view === "touchpoints" && <Breakdown title="Satisfied per touchpoint" groups={d.byTouchpoint} first="Touchpoint" note="Where the customer was asked: after an order on the shop, at the end of a chat, after a Back Office ticket or a TSA call, in the NPS e-mail." />}
      {view === "comments" && <Comments d={d} />}
      {d.run && (
        <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>
          Read from HubSpot every 30 minutes{d.run.ok ? "" : ` - the last read failed: ${d.run.error ?? ""}`}{d.run.ok && !d.run.done ? " - still catching up with older answers" : ""}.
        </Typography>
      )}
    </>
  );
}

function Overview({ d, showTouchpoints }: { d: SatisfactionData; showTouchpoints: boolean }) {
  const months = d.months.map((m) => ({ x: monthLabel(m.key), happy: m.tally.happy, neutral: m.tally.neutral, unhappy: m.tally.unhappy, csat: m.csat }));
  return (
    <>
      <GlassCard sx={{ display: "grid", gap: 1.25 }}>
        <CardTitle icon={<CalendarMonthOutlinedIcon />} tint="purple" title="Month by month" note="The CSAT answers of each month: happy, neutral, unhappy - hover for the numbers, or switch to the table." />
        <ChartFrame empty={months.length ? null : "No answer in this period."}
          table={{ columns: ["Month", "Happy", "Neutral", "Unhappy", "Satisfied"], numeric: [1, 2, 3, 4],
            rows: months.map((m) => [m.x, full(m.happy), full(m.neutral), full(m.unhappy), pctOf(m.csat)]) }}>
          <StackedColumns height={260} format={(v) => full(v)} xFormat={(x) => x}
            parts={[{ key: "happy", label: "Happy", color: SENT_COLOR.happy }, { key: "neutral", label: "Neutral", color: SENT_COLOR.neutral }, { key: "unhappy", label: "Unhappy", color: SENT_COLOR.unhappy }]}
            data={months.map((m) => ({ x: m.x, happy: m.happy, neutral: m.neutral, unhappy: m.unhappy }))} />
        </ChartFrame>
      </GlassCard>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <DimChart single fixedOrder title="Satisfied per country (CSAT %)" rows={csatRows(d.byCountry)} cur={(r) => r.n} prev={() => 0} curLabel="Satisfied" prevLabel="" fmt={(v) => `${v}%`} curColor="#198038" curNote={answersNote} labelWidth={140} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          {showTouchpoints
            ? <DimChart single fixedOrder title="Satisfied per touchpoint (CSAT %)" rows={csatRows(d.byTouchpoint)} cur={(r) => r.n} prev={() => 0} curLabel="Satisfied" prevLabel="" fmt={(v) => `${v}%`} curColor="#198038" curNote={answersNote} labelWidth={170} />
            : <DimChart single fixedOrder title="Satisfied per language (CSAT %)" rows={csatRows(d.byLanguage)} cur={(r) => r.n} prev={() => 0} curLabel="Satisfied" prevLabel="" fmt={(v) => `${v}%`} curColor="#198038" curNote={answersNote} labelWidth={120} />}
        </Grid>
      </Grid>
    </>
  );
}

/** A breakdown as the KPI pages draw one: the chart, then All the figures. */
function Breakdown({ title, groups, first, note }: { title: string; groups: Group[]; first: string; note: string }) {
  const anyNps = groups.some((g) => g.nps !== null);
  return (
    <>
      <DimChart single fixedOrder title={`${title} (CSAT %)`} rows={csatRows(groups)} cur={(r) => r.n} prev={() => 0} curLabel="Satisfied" prevLabel="" fmt={(v) => `${v}%`} curColor="#198038" curNote={answersNote} labelWidth={150} />
      <GlassCard sx={{ display: "grid", gap: 1 }}>
        <CardTitle icon={<TableChartOutlinedIcon />} tint="slate" title="All the figures" note={note} />
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 640 }}>
            <TableHead><TableRow>
              {[first, "Answers", "Satisfied", "Happy", "Neutral", "Unhappy", ...(anyNps ? ["NPS"] : [])].map((h, i) => <TableCell key={h} sx={{ ...headCell, textAlign: i ? "right" : "left" }}>{h}</TableCell>)}
            </TableRow></TableHead>
            <TableBody>
              {groups.map((g) => (
                <TableRow key={g.key}>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontWeight: 600, color: INK }}>{g.label}</TableCell>
                  <TableCell sx={{ ...bodyCell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{full(g.tally.answers)}</TableCell>
                  <TableCell sx={{ ...bodyCell, textAlign: "right", fontWeight: 700 }}>{pctOf(g.csat)}</TableCell>
                  <TableCell sx={{ ...bodyCell, textAlign: "right" }}>{full(g.tally.happy)}</TableCell>
                  <TableCell sx={{ ...bodyCell, textAlign: "right" }}>{full(g.tally.neutral)}</TableCell>
                  <TableCell sx={{ ...bodyCell, textAlign: "right" }}>{full(g.tally.unhappy)}</TableCell>
                  {anyNps && <TableCell sx={{ ...bodyCell, textAlign: "right" }}>{g.nps === null ? "–" : g.nps}</TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </GlassCard>
    </>
  );
}

/** The comments a page at a time (SARCLA 27.10.2026: "comments on satisfaction should be paginated") - the reports'
 *  own ‹ › buttons and "1–20 of N", above and below the list. */
const PER_PAGE = 20;
function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  const nav = { width: 30, height: 30, border: "1px solid rgba(21,34,58,.12)", borderRadius: "9px" };
  return (
    <Box sx={{ display: "flex", gap: 0.5 }}>
      <IconButton size="small" aria-label="The previous ones" disabled={page === 0} onClick={() => onPage(page - 1)} sx={nav}><ChevronLeftIcon sx={{ fontSize: 18 }} /></IconButton>
      <IconButton size="small" aria-label="The next ones" disabled={page >= pages - 1} onClick={() => onPage(page + 1)} sx={nav}><ChevronRightIcon sx={{ fontSize: 18 }} /></IconButton>
    </Box>
  );
}

function Comments({ d }: { d: SatisfactionData }) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(d.comments.length / PER_PAGE));
  const at = Math.min(page, pages - 1);
  const shown = d.comments.slice(at * PER_PAGE, (at + 1) * PER_PAGE);
  const range = d.comments.length ? `${full(at * PER_PAGE + 1)}–${full(at * PER_PAGE + shown.length)} of ${full(d.comments.length)}` : "";
  const top = useRef<HTMLDivElement>(null);
  const go = (p: number) => { setPage(p); top.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); };
  return (
    <GlassCard sx={{ display: "grid", gap: 1 }}>
      <Box ref={top} sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <CardTitle icon={<FormatQuoteOutlinedIcon />} tint="purple" title={`What the customers wrote: ${full(d.commentsTotal)}`}
            note={`The unhappy first, then the newest${range ? ` · ${range}` : ""}${d.commentsTotal > d.comments.length ? ` (the first ${full(d.comments.length)})` : ""}. E-mail addresses and phone numbers are hidden.`} />
        </Box>
        {pages > 1 && <Pager page={at} pages={pages} onPage={go} />}
      </Box>
      {!d.comments.length ? <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>No comment in this period.</Typography> : (
        <Box sx={{ display: "grid", gap: 1 }}>
          {shown.map((c, i) => {
            const s = SENT[c.sentiment ?? c.nps ?? ""];
            return (
              <Box key={i} sx={{ display: "grid", gap: 0.5, p: 1.25, borderRadius: "12px", bgcolor: "rgba(21,34,58,.03)" }}>
                <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
                  {s && <Chip tint={s.tint}>{s.label}</Chip>}
                  <Chip tint="slate">{c.touchpoint}</Chip>
                  {(c.language || c.country) && <Chip tint="blue">{[c.language, c.country].filter(Boolean).join("-")}</Chip>}
                  <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{new Date(c.at).toLocaleDateString("de-CH")}</Typography>
                </Box>
                <Typography sx={{ fontSize: "0.86rem", color: INK, whiteSpace: "pre-wrap" }}>{c.text}</Typography>
              </Box>
            );
          })}
        </Box>
      )}
      {pages > 1 && (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 1 }}>
          <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>{range}</Typography>
          <Pager page={at} pages={pages} onPage={go} />
        </Box>
      )}
    </GlassCard>
  );
}
