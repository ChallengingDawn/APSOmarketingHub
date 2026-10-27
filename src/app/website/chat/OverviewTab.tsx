"use client";

// Chat > Overview: the old dashboard's Mission Control and Analytics on one tab - how many chats, how many the AI
// handed to a person and to which team, what they were about, in which language, and whether the orchestrator
// can reach what it needs.

import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import SupportAgentOutlinedIcon from "@mui/icons-material/SupportAgentOutlined";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import RepeatOutlinedIcon from "@mui/icons-material/RepeatOutlined";
import MonitorHeartOutlinedIcon from "@mui/icons-material/MonitorHeartOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import { full } from "@/app/charts/format";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { Chip } from "@/app/connectors/parts";
import { CardTitle, FAINT, GlassCard, HsLink, KpiTile, MUTED, Notice, bodyCell, headCell } from "@/app/uc/report/ui";
import { FILING_CATEGORIES, NO_REQUEST, num, type Conversation, type Health, type Stats } from "@/lib/chat/shape";
import { DimChart } from "@/app/reporting/marketing-kpis/DimChart";
import { HandlerChip, category, pct, when } from "./shared";

export type OverviewData = {
  stats: Stats; recent: Conversation[]; health: Health | null; liveFrom?: string; cappedAtLive?: boolean;
  /** the hub's own filing (Topics), when it has filed any chat of the period */
  topics?: { rows: { topic: string; chats: number }[]; filed: number } | null;
};

type CountRow = { label: string; n: number };
/** a topic of the chart: one of the real Enquiry Categories only (SARCLA 27.10.2026: "real option only") - "No request",
 *  "could not be read" and Others are counted under the chart, not drawn as topics */
const isTopic = (v: string | null | undefined) => !!v && FILING_CATEGORIES.some((c) => c.value === v);
const LANGUAGE: Record<string, string> = { de: "German", fr: "French", it: "Italian", en: "English", nl: "Dutch", pl: "Polish" };
const languageName = (code: string | null | undefined) => (code ? LANGUAGE[code.toLowerCase()] ?? code.toUpperCase() : "Unknown");

const CHECKS: [keyof Health, string][] = [
  ["postgres", "Database"], ["redis", "Chat memory"], ["hubspot", "HubSpot"], ["claude", "AI model"], ["embedding", "Knowledge search"],
];

export default function OverviewTab({ d, label, onOpenConversations }: { d: OverviewData; label: string; onOpenConversations: () => void }) {
  const s = d.stats;
  const total = num(s.totals.total), handed = num(s.totals.escalated);
  const team = (want: "BO" | "TSA") => s.escalationByTeam
    .filter((t) => (["back_office", "finance", "marketing"].includes(t.routing_team ?? "") ? "BO" : "TSA") === want)
    .reduce((a, t) => a + num(t.count), 0);
  const byDay = [...s.byDay].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  // past two months a bar a day is a hairline: a bar a week (SARCLA 18.10.2026: "hard to read")
  const weekly = byDay.length > 62;
  const bars = weekly ? byWeek(byDay) : byDay.map((r) => ({ day: String(r.date).slice(0, 10), total: num(r.total), handed: num(r.escalated) }));
  const perMessage = s.unit === "messages";
  // the hub's filing when it has run, by the real Enquiry Categories only ("could not be read" and Others are no topic);
  // until then the chat's own guess, read the same way
  const filed = d.topics && d.topics.filed > 0;
  const topicRows: CountRow[] = filed
    ? d.topics!.rows.filter((t) => isTopic(t.topic)).map((t) => ({ label: t.topic, n: t.chats }))
    : s.byCategory.filter((c) => isTopic(c.category)).map((c) => ({ label: c.category as string, n: num(c.count) }));
  const languageRows: CountRow[] = s.byLanguage.map((l) => ({ label: languageName(l.language), n: num(l.count) }));
  const leftOut = filed ? d.topics!.rows.filter((t) => !isTopic(t.topic)) : [];
  const noRequest = leftOut.filter((t) => t.topic === NO_REQUEST).reduce((a, t) => a + t.chats, 0);
  const gone = leftOut.filter((t) => t.topic === "unreadable").reduce((a, t) => a + t.chats, 0);
  const notYet = filed ? Math.max(0, total - d.topics!.filed) : 0;
  return (
    <>
      {perMessage && <Notice tone="warn">These numbers count messages, not chats: the orchestrator has not had its update yet (APSOAssistant feat/chat-dry-run). A chat of four messages counts four times, so chats look 2-3 times more and hand-overs look rarer than they are.</Notice>}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<ForumOutlinedIcon />} tint="purple" label="Chats" value={full(total)} note={label} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<SmartToyOutlinedIcon />} tint="slate" label="Answered by the AI alone" value={pct(total - handed, total)} note={`${full(total - handed)} chats`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<SupportAgentOutlinedIcon />} tint="green" label="Handed to a person" value={full(handed)} note={`${full(team("TSA"))} TSA · ${full(team("BO"))} Back Office`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<RepeatOutlinedIcon />} tint="blue" label="Messages per chat" value={total && !perMessage ? num(s.totals.avg_turns).toFixed(1) : "–"} note="the customer's, on average" /></Grid>
      </Grid>

      <GlassCard sx={{ display: "grid", gap: 1.25 }}>
        <CardTitle icon={<ScheduleOutlinedIcon />} tint="purple" title={weekly ? "Chats per week" : "Chats per day"}
          note={`Each column is the chats of that ${weekly ? "week" : "day"} - hover for the numbers, or switch to the table.${d.cappedAtLive ? ` From go-live (${when(d.liveFrom ?? "").slice(0, 10)}): the test phase before is left out.` : ""}`} />
        <ChartFrame
          empty={bars.length ? null : "No chats in this period."}
          table={{ columns: [weekly ? "Week of" : "Day", "AI alone", "Handed to a person", "All chats"], numeric: [1, 2, 3],
            rows: bars.map((b) => [ddmm(b.day), full(b.total - b.handed), full(b.handed), full(b.total)]) }}>
          <StackedColumns height={260} format={(v) => full(v)} xFormat={(x) => x}
            parts={[{ key: "ai", label: "Answered by the AI alone" }, { key: "handed", label: "Handed to a person" }]}
            data={bars.map((b) => ({ x: ddmm(b.day), ai: b.total - b.handed, handed: b.handed }))} />
        </ChartFrame>
      </GlassCard>

      {/* the topics and the languages drawn as the reports draw a breakdown (SARCLA 27.10.2026: "show languages as a
          diagram as in reports"; the topics by the classification rules - the real Enquiry Categories, no Others) */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }} sx={{ display: "grid", gap: 0.75, alignContent: "start" }}>
          <DimChart<CountRow> single title="What the chats were about" rows={topicRows} cur={(r) => r.n} prev={() => 0}
            curLabel="Chats" prevLabel="" fmt={full} curColor="#a96a12" labelWidth={180} />
          {(noRequest > 0 || gone > 0 || notYet > 0) && (
            <Typography sx={{ fontSize: "0.76rem", color: MUTED, px: 1 }}>
              The Enquiry Categories only. Not drawn: {[noRequest ? `${full(noRequest)} chats that asked nothing` : "", gone ? `${full(gone)} HubSpot no longer holds` : "", notYet ? `${full(notYet)} not filed yet` : ""].filter(Boolean).join(", ")}.
            </Typography>
          )}
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <DimChart<CountRow> single title="Languages" rows={languageRows} cur={(r) => r.n} prev={() => 0}
            curLabel="Chats" prevLabel="" fmt={full} labelWidth={120} />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <GlassCard sx={{ height: "100%" }}>
            <CardTitle icon={<ForumOutlinedIcon />} tint="purple" title="Latest chats"
              right={<Typography component="button" onClick={onOpenConversations} sx={{ border: 0, bgcolor: "transparent", cursor: "pointer", color: "#2459d1", fontSize: "0.8rem", fontWeight: 600 }}>All conversations →</Typography>} />
            <Table size="small">
              <TableHead><TableRow>
                {["Last message", "Language", "About", "Handled by", "Messages", "Ticket"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}
              </TableRow></TableHead>
              <TableBody>
                {d.recent.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap" }}>{when(c.last_at ?? c.started_at)}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.8rem" }}>{(c.language_code || "?").toUpperCase()}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.8rem" }}>{category(c.category_code)}{c.sub_l1 ? <Box component="span" sx={{ color: FAINT }}> · {c.sub_l1}</Box> : null}</TableCell>
                    <TableCell sx={bodyCell}><HandlerChip c={c} /></TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", textAlign: "right" }}>{c.messages ?? c.turns_count}</TableCell>
                    <TableCell sx={bodyCell}>{c.hubspot_ticket_id ? <HsLink id={c.hubspot_ticket_id} /> : <Box component="span" sx={{ color: FAINT }}>–</Box>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </GlassCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <GlassCard sx={{ height: "100%", display: "grid", gap: 1, alignContent: "start" }}>
            <CardTitle icon={<MonitorHeartOutlinedIcon />} tint={d.health?.status === "healthy" ? "green" : "amber"} title="The orchestrator"
              note={d.health ? `It is ${d.health.status}. It answers every chat message the HubSpot chatflow hands it.` : "It did not answer its health check."} />
            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
              {CHECKS.map(([k, name]) => {
                const v = d.health?.[k];
                return <Chip key={k} tint={v === "ok" ? "green" : "pink"}>{name}{v === "ok" ? "" : ": not reached"}</Chip>;
              })}
            </Box>
          </GlassCard>
        </Grid>
      </Grid>
    </>
  );
}

/** Days folded into weeks (Monday first). */
function byWeek(days: Stats["byDay"]): { day: string; total: number; handed: number }[] {
  const m = new Map<string, { day: string; total: number; handed: number }>();
  for (const r of days) {
    const d = new Date(`${String(r.date).slice(0, 10)}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    const k = d.toISOString().slice(0, 10);
    const w = m.get(k) ?? { day: k, total: 0, handed: 0 };
    w.total += num(r.total); w.handed += num(r.escalated);
    m.set(k, w);
  }
  return [...m.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/** "2026-10-12" -> "12.10" */
const ddmm = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
