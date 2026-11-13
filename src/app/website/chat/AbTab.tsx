"use client";

// APSOassistant Chat > A/B test (SARCLA 27.10.2026: "per country, 50% of the time when the customer is not logged in,
// a transparent black screen to enter the e-mail at the start to be able to chat at all; the other 50% the address is
// asked during the conversation. We should be able to fine-tune it. The target is to measure if we lose customers by
// asking the e-mail from the start; if positive we make it mandatory"). The test runs in the shop chat's widget and
// its gateway (chatab.ts); this tab sets it (admins) and reads it (src/lib/chat/abStats.ts).
//
// Version 3 (13.11.2026: "launch version 3 and be more specific on the graphs"): a third variant - the conversation's
// summary offered by e-mail after the AI's 2nd answer (sent by the hub, summaryMail.ts) - and the figures say exactly
// what they count: every rate is "out of 100 visitors who opened the chat" with its 95% range, the absolute numbers sit
// next to it ("combien d'emails récupère-t-on en valeur absolue dans chaque cas ?"), each challenger is set against
// today's chat, the e-mails are drawn as they came in, and a country's figures are greyed while too few to read.
// Earlier rounds stay readable.

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import Slider from "@mui/material/Slider";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import AlternateEmailOutlinedIcon from "@mui/icons-material/AlternateEmailOutlined";
import MarkEmailReadOutlinedIcon from "@mui/icons-material/MarkEmailReadOutlined";
import GavelOutlinedIcon from "@mui/icons-material/GavelOutlined";
import LeaderboardOutlinedIcon from "@mui/icons-material/LeaderboardOutlined";
import ShowChartOutlinedIcon from "@mui/icons-material/ShowChartOutlined";
import CompareArrowsOutlinedIcon from "@mui/icons-material/CompareArrowsOutlined";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import { Bar, BarChart, CartesianGrid, ErrorBar, LabelList, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { full } from "@/app/charts/format";
import { Chip } from "@/app/connectors/parts";
import { CardTitle, FAINT, GREEN, GlassCard, HAIRLINE, INK, KpiTile, MUTED, Notice, RED, bodyCell, headCell, type Tint } from "@/app/uc/report/ui";
import {
  CHALLENGERS, FEW, MIN_VISITORS, VARIANTS, VARIANT_HOW, VARIANT_LABEL, VARIANT_SHORT,
  type ArmFigures, type Comparison, type Rate, type Test, type Variant, type Verdict,
} from "@/lib/chat/abStats";
import type { AbData, Shares } from "@/lib/chat/abtest";
import type { SummaryRun } from "@/lib/chat/summaryMail";
import { Loaded, pill, post, when } from "./shared";

type AbPage = AbData & { isAdmin: boolean; lastSummaryRun: SummaryRun | null };
const COUNTRIES = ["CH", "DE", "AT", "FR", "IT", "NL", "PL", "INT"];

/** One colour per variant, everywhere on the tab (validated: CVD ΔE ≥ 9.2 all pairs; the aqua is under 3:1 on white,
 *  so every bar carries its number and the table repeats them). */
const COLOR: Record<Variant, string> = { later: "#1baf7a", first: "#2a78d6", mid: "#eb6834" };
const VERDICT: Record<Verdict, { short: string; text: string; tint: Tint }> = {
  "too-early": { short: "Too early", text: `Under ${MIN_VISITORS} visitors in a variant - wait before reading anything into it`, tint: "slate" },
  "keep-later": { short: "Keep asking later", text: "Asking for the e-mail costs chats, and no variant wins e-mails without that - keep today's chat", tint: "pink" },
  "go-first": { short: "Ask first", text: "Asking first keeps the chats and clearly brings more e-mails - make it mandatory", tint: "green" },
  "go-mid": { short: "Offer the summary", text: "The summary offer keeps the chats and clearly brings more e-mails - use it for everyone", tint: "green" },
  "no-difference": { short: "No difference yet", text: "No clear difference yet - keep the test running", tint: "amber" },
};
const pctOf = (x: number | null, d = 1) => (x === null ? "–" : `${(Math.round(x * 100 * 10 ** d) / 10 ** d).toFixed(d)}%`);
const per100 = (x: number | null) => (x === null ? "–" : String(Math.round(x * 100)));
const range = (r: Rate) => (r.lo === null || r.hi === null ? "" : `${Math.round(r.lo * 100)}–${Math.round(r.hi * 100)}`);
const pts = (d: number | null) => (d === null ? "–" : `${d > 0 ? "+" : d < 0 ? "−" : "±"}${Math.abs(Math.round(d * 100))}`);
const clear = (t: Test) => t.p !== null && t.p < 0.05;
const day = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;

export default function AbTab() {
  const [n, setN] = useState(0);
  const [round, setRound] = useState<number | null>(null);
  return (
    <Loaded<AbPage> key={`ab-${n}-${round ?? "now"}`} url={`/api/website/chat?part=ab${round ? `&v=${round}` : ""}`} what="the A/B test">
      {(d) => <Body d={d} reload={() => setN((x) => x + 1)} round={round} setRound={setRound} />}
    </Loaded>
  );
}

function Body({ d, reload, round, setRound }: { d: AbPage; reload: () => void; round: number | null; setRound: (v: number | null) => void }) {
  const all = d.comparisons[0];
  const countries = d.comparisons.slice(1);
  const vs = all.variants.length ? all.variants : VARIANTS.filter((v) => d.setting.shares[v] > 0);
  const current = d.v === d.setting.v;
  const visitors = vs.reduce((s, v) => s + all.arms[v].arm.visitors, 0);
  const emails = vs.reduce((s, v) => s + all.arms[v].arm.emails, 0);
  return (
    <>
      <Settings d={d} reload={reload} />
      <Rounds d={d} round={round} setRound={setRound} />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<GroupsOutlinedIcon />} tint="purple" label="Opened the chat" value={full(visitors)}
          note={`${vs.map((v) => `${VARIANT_SHORT[v]} ${full(all.arms[v].arm.visitors)}`).join(" · ")} - visitors not logged in, round ${d.v}${d.firstAt ? `, from ${when(d.firstAt).slice(0, 5)}` : ""}`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<AlternateEmailOutlinedIcon />} tint="green" label="E-mails collected" value={full(emails)}
          note={`${vs.map((v) => `${VARIANT_SHORT[v]} ${full(all.arms[v].arm.emails)}`).join(" · ")} - each a visitor who gave an address`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>{vs.includes("mid") || d.setting.shares.mid > 0
          ? <KpiTile icon={<MarkEmailReadOutlinedIcon />} tint="blue" label="Summaries sent" value={full(d.summaries.sent)}
            note={`card shown ${full(all.arms.mid.arm.asked)} · asked ${full(all.arms.mid.arm.summaries)} · waiting ${full(d.summaries.waiting)}${d.summaries.failed ? ` · failed ${full(d.summaries.failed)}` : ""}${d.lastSummaryRun ? ` · last run ${when(d.lastSummaryRun.at)}${d.lastSummaryRun.error ? ` (${d.lastSummaryRun.error})` : ""}` : ""}`} />
          : <KpiTile icon={<LeaderboardOutlinedIcon />} tint="blue" label="Wrote to the chat" value={full(vs.reduce((s, v) => s + all.arms[v].arm.chats, 0))}
            note={vs.map((v) => `${VARIANT_SHORT[v]} ${full(all.arms[v].arm.chats)}`).join(" · ")} />}</Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<GavelOutlinedIcon />} tint={VERDICT[all.verdict].tint} label={current ? "So far" : `Round ${d.v} ended`} value={VERDICT[all.verdict].short}
          note={VERDICT[all.verdict].text} /></Grid>
      </Grid>
      {visitors > 0 ? (
        <>
          <Scoreboard all={all} vs={vs} />
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, lg: 7 }}><Per100Chart all={all} vs={vs} /></Grid>
            <Grid size={{ xs: 12, lg: 5 }}><AgainstToday all={all} /></Grid>
          </Grid>
          <OverTime d={d} vs={vs} />
          <PerCountry countries={countries} vs={vs} all={all} />
        </>
      ) : (
        <GlassCard><Typography sx={{ fontSize: "0.86rem", color: MUTED }}>No visitor counted in round {d.v} yet{current && d.setting.on ? " - the shop chat picks up a change within a minute." : "."}</Typography></GlassCard>
      )}
      {d.isAdmin && (vs.includes("mid") || d.setting.shares.mid > 0) && <SummaryRunButton reload={reload} />}
    </>
  );
}

/** The rounds: the current one, and every earlier one still readable (a restart counts from zero). */
function Rounds({ d, round, setRound }: { d: AbPage; round: number | null; setRound: (v: number | null) => void }) {
  if (d.rounds.length < 2) return null;
  return (
    <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", flexWrap: "wrap" }}>
      <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em", mr: 0.5 }}>Round</Typography>
      {d.rounds.map((r) => {
        const sel = (round ?? d.setting.v) === r.v;
        return (
          <Box key={r.v} component="button" type="button" aria-pressed={sel} onClick={() => setRound(r.v === d.setting.v ? null : r.v)} sx={{
            all: "unset", cursor: "pointer", px: 1.25, py: 0.5, borderRadius: "999px", fontSize: "0.8rem", fontWeight: 600,
            border: `1px solid ${sel ? "#2459d1" : HAIRLINE}`, color: sel ? "#2459d1" : MUTED, bgcolor: sel ? "rgba(36,89,209,.08)" : "rgba(255,255,255,.7)",
            "&:focus-visible": { outline: "2px solid #2459d1", outlineOffset: 2 },
          }}>
            {r.v}{r.v === d.setting.v ? " · now" : ""} · {full(r.visitors)} visitors{r.first_at ? ` · ${when(r.first_at).slice(0, 5)}${r.last_at ? `–${when(r.last_at).slice(0, 5)}` : ""}` : ""}
            {r.variants?.length ? ` · ${(r.variants as Variant[]).filter((v) => VARIANTS.includes(v)).map((v) => VARIANT_SHORT[v]).join("/")}` : ""}
          </Box>
        );
      })}
    </Box>
  );
}

function Dot({ v }: { v: Variant }) {
  return <Box component="span" sx={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", bgcolor: COLOR[v], mr: 0.75, flexShrink: 0 }} />;
}

/** The absolute numbers per variant: what happened to the visitors who opened the chat, step by step. */
function Scoreboard({ all, vs }: { all: Comparison; vs: Variant[] }) {
  const cols: { h: string; note: string; get: (f: ArmFigures) => { x: number; r: Rate } | null }[] = [
    { h: "Wrote a message", note: "sent at least one message", get: (f) => ({ x: f.arm.chats, r: f.wrote }) },
    { h: "Gave an e-mail", note: "the leads - wherever it was given", get: (f) => ({ x: f.arm.emails, r: f.email }) },
    { h: "E-mail and wrote", note: "a lead with a request", get: (f) => ({ x: f.arm.chatsWithEmail, r: f.lead }) },
    { h: "Handed over", note: "to the team", get: (f) => ({ x: f.arm.handovers, r: f.handover }) },
  ];
  const maxRate = 1;
  return (
    <GlassCard sx={{ display: "grid", gap: 1 }}>
      <CardTitle icon={<LeaderboardOutlinedIcon />} tint="purple" title="Per variant - the absolute numbers"
        note="Out of the visitors who opened the chat: how many wrote, how many left an e-mail address, how many did both, how many were handed to the team. The percentage is of the visitors who opened it; in brackets its 95% range." />
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 860 }}>
          <TableHead><TableRow>
            <TableCell sx={headCell}>Variant</TableCell>
            <TableCell sx={{ ...headCell, textAlign: "right" }}>Opened the chat</TableCell>
            {cols.map((c) => <TableCell key={c.h} sx={{ ...headCell, textAlign: "right" }} title={c.note}>{c.h}</TableCell>)}
            <TableCell sx={headCell}>Where the e-mail came from</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {vs.map((v) => {
              const f = all.arms[v];
              const from = [
                f.arm.emailsFirst ? `${full(f.arm.emailsFirst)} on the screen before the chat` : "",
                f.arm.emailsMid ? `${full(f.arm.emailsMid)} in the summary card` : "",
                f.arm.emailsTyped ? `${full(f.arm.emailsTyped)} typed in the conversation` : "",
              ].filter(Boolean).join(" · ");
              const known = f.arm.emailsFirst + f.arm.emailsMid + f.arm.emailsTyped;
              return (
                <TableRow key={v}>
                  <TableCell sx={{ ...bodyCell, minWidth: 210 }}>
                    <Box sx={{ display: "flex", alignItems: "center" }}><Dot v={v} /><Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>{VARIANT_LABEL[v]}</Typography></Box>
                    <Typography sx={{ fontSize: "0.74rem", color: MUTED, ml: "18px", lineHeight: 1.35 }}>{VARIANT_HOW[v]}</Typography>
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: "1.05rem", fontWeight: 700, color: INK }}>{full(f.arm.visitors)}</TableCell>
                  {cols.map((c) => {
                    const g = c.get(f)!;
                    return (
                      <TableCell key={c.h} sx={{ ...bodyCell, textAlign: "right", fontVariantNumeric: "tabular-nums", minWidth: 130 }}>
                        <Typography component="span" sx={{ fontSize: "1.05rem", fontWeight: 700, color: INK }}>{full(g.x)}</Typography>
                        <Typography component="span" sx={{ fontSize: "0.78rem", color: MUTED }}> · {pctOf(g.r.rate)}</Typography>
                        <Box sx={{ height: 6, borderRadius: 3, bgcolor: "#edf0f5", mt: 0.5, overflow: "hidden" }} aria-hidden>
                          <Box sx={{ height: "100%", width: `${Math.min(100, ((g.r.rate ?? 0) / maxRate) * 100)}%`, bgcolor: COLOR[v], borderRadius: 3 }} />
                        </Box>
                        <Typography sx={{ fontSize: "0.7rem", color: FAINT }}>{range(g.r) ? `(${range(g.r)}%)` : ""}</Typography>
                      </TableCell>
                    );
                  })}
                  <TableCell sx={{ ...bodyCell, fontSize: "0.78rem", color: MUTED, maxWidth: 240 }}>
                    {from || (f.arm.emails ? "–" : "no e-mail yet")}{f.arm.emails > known && known > 0 ? ` · ${full(f.arm.emails - known)} other` : ""}
                    {v === "mid" && f.arm.asked > 0 && <Box component="span" sx={{ display: "block", color: FAINT }}>card shown to {full(f.arm.asked)} ({pctOf(f.arm.visitors ? f.arm.asked / f.arm.visitors : null, 0)} reached a 2nd answer) · {full(f.arm.emailsMid)} gave it there ({pctOf(f.arm.asked ? f.arm.emailsMid / f.arm.asked : null, 0)} of those shown)</Box>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>
    </GlassCard>
  );
}

/** Out of 100 visitors who open the chat: wrote, gave an e-mail, both - per variant, with the 95% range as a whisker. */
function Per100Chart({ all, vs }: { all: Comparison; vs: Variant[] }) {
  const metrics: { label: string; key: "wrote" | "email" | "lead" }[] = [
    { label: "Wrote a message", key: "wrote" }, { label: "Gave an e-mail", key: "email" }, { label: "E-mail and wrote", key: "lead" },
  ];
  const data = metrics.map((m) => {
    const row: Record<string, unknown> = { label: m.label };
    for (const v of vs) {
      const r = all.arms[v][m.key];
      const val = r.rate === null ? 0 : r.rate * 100;
      row[v] = Math.round(val * 10) / 10;
      row[`${v}_err`] = r.lo === null || r.hi === null ? [0, 0] : [val - r.lo * 100, r.hi * 100 - val];
      row[`${v}_hi`] = r.hi === null ? val : r.hi * 100;
      row[`${v}_of`] = `${full(r.x)} of ${full(r.n)}`;
      row[`${v}_range`] = range(r);
    }
    return row;
  });
  return (
    <GlassCard sx={{ display: "grid", gap: 0.5, height: "100%" }}>
      <CardTitle icon={<LeaderboardOutlinedIcon />} tint="blue" title="Out of 100 visitors who open the chat"
        note="Bar = how many of 100 did it; whisker = the 95% range. Where two variants' whiskers do not overlap, the difference is real, not chance." />
      <ResponsiveContainer width="100%" height={Math.max(220, metrics.length * (vs.length * 22 + 34) + 50)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 48, bottom: 4, left: 4 }} barGap={2} barCategoryGap="20%">
          <CartesianGrid horizontal={false} stroke="#e6e8ec" />
          <XAxis type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: FAINT }} />
          <YAxis type="category" dataKey="label" width={120} tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 12.5, fill: INK }} />
          <Tooltip cursor={{ fill: "rgba(21,34,58,.04)" }} contentStyle={{ fontSize: "0.8rem", borderRadius: 10, border: "1px solid rgba(21,34,58,.1)" }}
            formatter={(val: unknown, name: unknown, item: { dataKey?: unknown; payload?: Record<string, unknown> }) => {
              const k = String(item?.dataKey ?? "");
              return [`${Math.round(Number(val))} of 100 (${String(item?.payload?.[`${k}_of`] ?? "")}; range ${String(item?.payload?.[`${k}_range`] ?? "")})`, String(name)];
            }} />
          <Legend verticalAlign="top" align="left" height={26} iconType="circle" wrapperStyle={{ fontSize: "0.78rem" }} />
          {vs.map((v) => (
            <Bar key={v} dataKey={v} name={VARIANT_LABEL[v]} fill={COLOR[v]} radius={[0, 4, 4, 0]} isAnimationActive={false} maxBarSize={18}>
              <ErrorBar dataKey={`${v}_err`} direction="x" width={5} strokeWidth={1.5} stroke={INK} />
              <LabelList dataKey={v} content={(p: { x?: number | string; y?: number | string; width?: number | string; height?: number | string; index?: number; value?: unknown }) => {
                const row = data[p.index ?? -1];
                if (!row) return <g />;
                const val = Number(p.value ?? 0), w = Number(p.width ?? 0), hi = Number(row[`${v}_hi`] ?? val);
                const end = Number(p.x ?? 0) + (val > 0 ? (w * hi) / val : 0);
                return <text x={end + 6} y={Number(p.y ?? 0) + Number(p.height ?? 0) / 2} dy={4} fontSize={11.5} fontWeight={700} fill={INK}>{Math.round(val)}</text>;
              }} />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </GlassCard>
  );
}

/** Each challenger set against today's chat: points more or fewer per 100 visitors, and whether it is clear. */
function AgainstToday({ all }: { all: Comparison }) {
  const rows = CHALLENGERS.filter((v) => all.tests[v]);
  return (
    <GlassCard sx={{ display: "grid", gap: 1, height: "100%", alignContent: "start" }}>
      <CardTitle icon={<CompareArrowsOutlinedIcon />} tint="amber" title="Against today's chat"
        note={`Per 100 visitors who open the chat, compared with "${VARIANT_LABEL.later}". Clear = a difference this size by chance is under 5% likely.`} />
      {!rows.length && <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Nothing to compare in this round - today&apos;s chat or a challenger has no visitor yet.</Typography>}
      {rows.map((v) => {
        const t = all.tests[v]!;
        const line = (label: string, x: Test, goodUp: boolean) => {
          const good = x.diff === null ? null : goodUp ? x.diff > 0 : x.diff < 0;
          return (
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
              <Typography sx={{ fontSize: "1.35rem", fontWeight: 700, minWidth: 64, fontVariantNumeric: "tabular-nums", color: !clear(x) || good === null ? INK : good ? GREEN : RED }}>{pts(x.diff)}</Typography>
              <Typography sx={{ fontSize: "0.84rem", color: INK }}>{label}</Typography>
              <Chip tint={clear(x) ? (good ? "green" : "pink") : "slate"}>{clear(x) ? "clear" : "not clear yet"}</Chip>
            </Box>
          );
        };
        return (
          <Box key={v} sx={{ borderTop: `1px solid ${HAIRLINE}`, pt: 1, display: "grid", gap: 0.5 }}>
            <Box sx={{ display: "flex", alignItems: "center" }}><Dot v={v} /><Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: INK }}>{VARIANT_LABEL[v]}</Typography></Box>
            {line("chats (wrote a message)", t.wrote, true)}
            {line("e-mails", t.email, true)}
            <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>
              In absolute terms this round: {full(all.arms[v].arm.emails)} e-mails from {full(all.arms[v].arm.visitors)} visitors, against {full(all.arms.later.arm.emails)} from {full(all.arms.later.arm.visitors)} with today&apos;s chat.
            </Typography>
          </Box>
        );
      })}
    </GlassCard>
  );
}

/** The running total, day by day: e-mails (or chats, visitors) collected by each variant since the round began. */
function OverTime({ d, vs }: { d: AbPage; vs: Variant[] }) {
  const [what, setWhat] = useState<"emails" | "chats" | "visitors">("emails");
  const data = useMemo(() => d.cum.map((p) => ({ ...p, label: day(p.day) })), [d.cum]);
  const unequal = new Set(vs.map((v) => d.setting.shares[v])).size > 1 && d.v === d.setting.v;
  if (data.length < 2) return null;
  const WHAT = { emails: "E-mails collected", chats: "Visitors who wrote", visitors: "Visitors who opened the chat" } as const;
  return (
    <GlassCard sx={{ display: "grid", gap: 0.75 }}>
      <CardTitle icon={<ShowChartOutlinedIcon />} tint="green" title={`${WHAT[what]} - running total`}
        note={`Absolute numbers since the round began, by the day each one happened (Zurich time).${unequal ? " The variants get different shares of the visitors - compare the rates above, not these totals." : ""}`}
        right={
          <Box sx={{ display: "flex", gap: 0.5 }}>
            {(["emails", "chats", "visitors"] as const).map((k) => (
              <Button key={k} size="small" variant={what === k ? "contained" : "outlined"} disableElevation sx={{ ...pill, minWidth: 0 }} onClick={() => setWhat(k)} aria-pressed={what === k}>
                {k === "emails" ? "E-mails" : k === "chats" ? "Wrote" : "Opened"}
              </Button>
            ))}
          </Box>
        } />
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 8, right: 56, bottom: 4, left: 0 }}>
          <CartesianGrid vertical={false} stroke="#e6e8ec" />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: HAIRLINE }} tick={{ fontSize: 11, fill: FAINT }} minTickGap={18} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} tick={{ fontSize: 11, fill: FAINT }} />
          <Tooltip contentStyle={{ fontSize: "0.8rem", borderRadius: 10, border: "1px solid rgba(21,34,58,.1)" }} formatter={(val: unknown, name: unknown) => [full(Number(val)), String(name)]} />
          <Legend verticalAlign="top" align="left" height={26} iconType="circle" wrapperStyle={{ fontSize: "0.78rem" }} />
          {vs.map((v) => (
            <Line key={v} type="monotone" dataKey={`${v}_${what}`} name={VARIANT_LABEL[v]} stroke={COLOR[v]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false}>
              <LabelList dataKey={`${v}_${what}`} content={(p: { x?: number | string; y?: number | string; index?: number; value?: unknown }) =>
                p.index === data.length - 1 ? <text x={Number(p.x ?? 0) + 6} y={Number(p.y ?? 0)} dy={4} fontSize={11.5} fontWeight={700} fill={INK}>{full(Number(p.value ?? 0))}</text> : <g />} />
            </Line>
          ))}
        </LineChart>
      </ResponsiveContainer>
    </GlassCard>
  );
}

/** Per country: "x of n" per variant - a figure from fewer than FEW visitors is greyed (one visitor reads as 100%). */
function PerCountry({ countries, vs, all }: { countries: Comparison[]; vs: Variant[]; all: Comparison }) {
  const cell = (f: ArmFigures, r: Rate) => {
    const few = f.arm.visitors < FEW;
    return (
      <Box component="span" sx={{ display: "block", whiteSpace: "nowrap", color: f.arm.visitors === 0 ? FAINT : few ? FAINT : INK }} title={few && f.arm.visitors ? `Only ${f.arm.visitors} visitors - too few to read` : undefined}>
        {f.arm.visitors === 0 ? "–" : <>{pctOf(r.rate, 0)} <Box component="span" sx={{ color: FAINT, fontSize: "0.74rem" }}>{full(r.x)}/{full(r.n)}</Box></>}
      </Box>
    );
  };
  const rows = [all, ...countries];
  return (
    <GlassCard sx={{ display: "grid", gap: 1 }}>
      <CardTitle icon={<PublicOutlinedIcon />} tint="purple" title="Per country"
        note={`Each figure: the rate and "x of visitors" per variant. Greyed: fewer than ${FEW} visitors in that variant - too few to read (one visitor shows as 0% or 100%). A verdict needs ${MIN_VISITORS} visitors in each variant.`} />
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 900 }}>
          <TableHead><TableRow>
            <TableCell sx={headCell}>Country</TableCell>
            <TableCell sx={headCell}>Variant</TableCell>
            {["Opened", "Wrote", "Gave an e-mail", "E-mail and wrote", "Handed over"].map((h) => <TableCell key={h} sx={{ ...headCell, textAlign: "right" }}>{h}</TableCell>)}
            <TableCell sx={headCell}>So far</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {rows.map((c) => vs.map((v, i) => {
              const f = c.arms[v];
              return (
                <TableRow key={`${c.country}-${v}`} sx={i === vs.length - 1 ? undefined : { "& td": { borderBottom: "none" } }}>
                  {i === 0 && <TableCell rowSpan={vs.length} sx={{ ...bodyCell, fontSize: "0.86rem", fontWeight: c.country === "All" ? 800 : 700, color: INK, verticalAlign: "top" }}>{c.country}</TableCell>}
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap" }}><Box sx={{ display: "flex", alignItems: "center" }}><Dot v={v} />{VARIANT_SHORT[v]}</Box></TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", textAlign: "right", fontVariantNumeric: "tabular-nums", color: f.arm.visitors < FEW ? FAINT : INK, fontWeight: 600 }}>{f.arm.visitors ? full(f.arm.visitors) : "–"}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{cell(f, f.wrote)}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{cell(f, f.email)}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{cell(f, f.lead)}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{f.arm.visitors ? full(f.arm.handovers) : "–"}</TableCell>
                  {i === 0 && <TableCell rowSpan={vs.length} sx={{ ...bodyCell, verticalAlign: "top" }}><Chip tint={VERDICT[c.verdict].tint}>{VERDICT[c.verdict].short}</Chip></TableCell>}
                </TableRow>
              );
            }))}
          </TableBody>
        </Table>
      </Box>
    </GlassCard>
  );
}

function SummaryRunButton({ reload }: { reload: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = async () => {
    setBusy(true); setMsg(null);
    const r = await post<SummaryRun>({ action: "summary-run" });
    setBusy(false);
    const x = r.data;
    setMsg(r.ok && x ? { ok: true, text: `${x.sent} sent, ${x.failed} failed, ${x.skipped} skipped${x.sent + x.failed + x.skipped === 0 ? " - none due (a chat is summarised once it has been quiet 20 minutes)" : ""}.` } : { ok: false, text: r.error ?? "Did not work." });
    if (r.ok) reload();
  };
  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
      <Button size="small" variant="outlined" sx={pill} disabled={busy} onClick={() => void run()} startIcon={busy ? <CircularProgress size={14} color="inherit" /> : <MarkEmailReadOutlinedIcon sx={{ fontSize: 16 }} />}>
        {busy ? "Sending…" : "Send the due summaries now"}
      </Button>
      <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>Otherwise every 5 minutes, once a chat has been quiet for 20 minutes.</Typography>
      {msg && (msg.ok ? <Typography sx={{ fontSize: "0.8rem", color: GREEN }}>{msg.text}</Typography> : <Notice tone="bad">{msg.text}</Notice>)}
    </Box>
  );
}

/** The test's setting - who is in it and how they are split; an admin changes it, everyone sees it. */
function Settings({ d, reload }: { d: AbPage; reload: () => void }) {
  const s = d.setting;
  const [on, setOn] = useState(s.on);
  const [countries, setCountries] = useState<string[]>(s.countries);
  const [shares, setShares] = useState<Shares>(s.shares);
  const [restart, setRestart] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const sum = shares.first + shares.later + shares.mid;
  const arms = (x: Shares) => VARIANTS.filter((v) => x[v] > 0).join();
  const newArms = arms(shares) !== arms(s.shares);
  const changedShares = VARIANTS.some((v) => shares[v] !== s.shares[v]);
  const dirty = on !== s.on || changedShares || countries.slice().sort().join() !== s.countries.slice().sort().join() || restart;
  const setShare = (v: Variant, x: number) => { setShares((p) => ({ ...p, [v]: x })); };
  const thirds = () => setShares({ later: 34, first: 33, mid: 33 });
  const save = async () => {
    const r0 = restart || newArms;
    if (!confirm(`${on ? "Run" : "Stop"} the test${on ? ` in ${countries.join(", ")} - ${VARIANTS.filter((v) => shares[v] > 0).map((v) => `${VARIANT_SHORT[v]} ${shares[v]}%`).join(", ")} of the visitors who are not logged in` : ""}${r0 ? ", counting again from zero (a new round)" : ""}?`)) return;
    setBusy(true); setMsg(null);
    const r = await post({ action: "ab-save", ab: { on, countries, shares, restart: r0 } });
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: "Saved - the shop chat picks it up within a minute." } : { ok: false, text: r.error ?? "Did not work." });
    if (r.ok) reload();
  };
  const toggle = (c: string) => setCountries((l) => (l.includes(c) ? l.filter((x) => x !== c) : [...l, c]));
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25 }}>
      <CardTitle icon={<TuneOutlinedIcon />} tint="blue" title="The test"
        note="Visitors of the shop chat who are not logged in (a logged-in customer's e-mail is known) get one variant and keep it for the round. Every figure below counts the visitors who opened the chat." />
      <Box sx={{ display: "grid", gap: 0.5 }}>
        {VARIANTS.map((v) => (
          <Box key={v} sx={{ display: "flex", alignItems: "baseline", gap: 0.5, flexWrap: "wrap", opacity: s.shares[v] > 0 ? 1 : 0.55 }}>
            <Box sx={{ display: "flex", alignItems: "center", minWidth: 190 }}><Dot v={v} /><Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK }}>{VARIANT_LABEL[v]}</Typography></Box>
            <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{VARIANT_HOW[v]}{s.shares[v] > 0 ? "" : " - not in this round"}</Typography>
          </Box>
        ))}
      </Box>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
        {s.on ? <Chip tint="green">Running</Chip> : <Chip tint="slate">Off</Chip>}
        {s.on && <Chip tint="blue">{s.countries.join(" · ")}</Chip>}
        {s.on && <Chip tint="purple">{VARIANTS.filter((v) => s.shares[v] > 0).map((v) => `${VARIANT_SHORT[v]} ${s.shares[v]}%`).join(" · ")}</Chip>}
        <Typography sx={{ fontSize: "0.74rem", color: MUTED }} title={s.at ? `Last change ${when(s.at)}${s.by ? ` · ${s.by}` : ""}` : ""}>Round {s.v}</Typography>
      </Box>
      {d.isAdmin && (
        <Box sx={{ display: "grid", gap: 1.25, borderTop: `1px solid ${HAIRLINE}`, pt: 1.25 }}>
          <FormControlLabel control={<Switch checked={on} onChange={(e) => setOn(e.target.checked)} slotProps={{ input: { "aria-label": "Run the test" } }} />}
            label={<Typography sx={{ fontSize: "0.84rem", color: INK }}>Run the test</Typography>} />
          <Box sx={{ display: "grid", gap: 0.5 }}>
            <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em" }}>Countries in the test</Typography>
            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
              {COUNTRIES.map((c) => {
                const sel = countries.includes(c);
                return (
                  <Box key={c} component="button" type="button" onClick={() => toggle(c)} aria-pressed={sel} sx={{
                    all: "unset", cursor: "pointer", px: 1.25, py: 0.5, borderRadius: "999px", fontSize: "0.8rem", fontWeight: 600,
                    border: `1px solid ${sel ? "#2459d1" : HAIRLINE}`, color: sel ? "#2459d1" : MUTED, bgcolor: sel ? "rgba(36,89,209,.08)" : "rgba(255,255,255,.7)",
                    "&:focus-visible": { outline: "2px solid #2459d1", outlineOffset: 2 },
                  }}>{c}</Box>
                );
              })}
            </Box>
          </Box>
          <Box sx={{ display: "grid", gap: 0.5, maxWidth: 560 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em" }}>Share of the visitors</Typography>
              <Button size="small" variant="text" sx={{ ...pill, minWidth: 0 }} onClick={thirds}>Equal thirds</Button>
              <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: sum === 100 ? GREEN : RED }}>{sum}% {sum === 100 ? "" : "- must add up to 100%"}</Typography>
            </Box>
            {VARIANTS.map((v) => (
              <Box key={v} sx={{ display: "grid", gridTemplateColumns: "150px 1fr 48px", alignItems: "center", gap: 1.5 }}>
                <Box sx={{ display: "flex", alignItems: "center" }}><Dot v={v} /><Typography sx={{ fontSize: "0.82rem", color: INK }}>{VARIANT_SHORT[v]}</Typography></Box>
                <Slider value={shares[v]} min={0} max={100} step={1} onChange={(_, x) => setShare(v, x as number)} aria-label={`Share for ${VARIANT_LABEL[v]}`} size="small" sx={{ color: COLOR[v] }} />
                <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: INK, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{shares[v]}%</Typography>
              </Box>
            ))}
          </Box>
          <FormControlLabel control={<Checkbox size="small" checked={restart || newArms} disabled={newArms} onChange={(e) => setRestart(e.target.checked)} />}
            label={<Typography sx={{ fontSize: "0.8rem", color: MUTED }}>Count again from zero - a new round, everyone gets a new variant{newArms ? " (needed: the variants change)" : ""}</Typography>} />
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
            <Button size="small" variant="contained" disableElevation sx={pill} disabled={!dirty || busy || sum !== 100} onClick={() => void save()}
              startIcon={busy ? <CircularProgress size={14} color="inherit" /> : undefined}>{busy ? "Saving…" : "Save"}</Button>
            {msg && (msg.ok ? <Typography sx={{ fontSize: "0.8rem", color: GREEN }}>{msg.text}</Typography> : <Notice tone="bad">{msg.text}</Notice>)}
          </Box>
        </Box>
      )}
    </GlassCard>
  );
}
