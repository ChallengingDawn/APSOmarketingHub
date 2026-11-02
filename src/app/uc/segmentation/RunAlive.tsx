"use client";

// SMART SEGMENTATION - is a run alive, and what did it do (SARCLA 02.11.2026: "with this steering I don't know if it's live
// and working, reworking the priority as it should - 'Live - the hub gives every new company its first APSO segment' is a
// good example; Websites and Yearly the same, they are really incomplete"). Above each run's figures: its pulse and when
// it ran last and runs next, its days one by one, and the companies it changed. Reads /api/uc/segmentation/history.

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { full } from "@/app/charts/format";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { DEEMPHASIS } from "@/app/charts/palette";
import { FAINT, GlassCard, INK, MUTED, bodyCell, clip, headCell } from "@/app/uc/report/ui";
import { Choice, usePaged } from "@/app/connectors/parts";
import { YEARLY_RULES } from "@/lib/segmentation/yearly";
import type { Move, RunAction, RunDay } from "@/lib/integrations/segmentation";
import type { Run, Status, Topic } from "./Runs";

const hsCompany = (id: string) => `https://app-eu1.hubspot.com/contacts/26492587/record/0-2/${id}`;
const HOUR = 3_600_000;
const ago = (ms: number) => (ms < 90_000 ? `${Math.max(0, Math.round(ms / 1000))} s ago` : ms < 2 * HOUR ? `${Math.round(ms / 60_000)} min ago` : ms < 48 * HOUR ? `${Math.round(ms / HOUR)} h ago` : `${Math.round(ms / 86_400_000)} days ago`);
const at = (iso: string) => new Date(iso).toLocaleString("de-CH", { timeZone: "Europe/Zurich", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const eur = (v: string) => (v && Number.isFinite(Number(v)) ? `${full(Math.round(Number(v)))} €` : v || "none");
const prio = (v: string) => (v ? `P${v[0]}${v[0] === "4" ? " (no priority)" : ""}` : "none");

type Part = { key: string; label: string; color: string; of: (d: RunDay) => number };
type Cfg = {
  action: RunAction; last: (st: Status) => Run; every: number; what: string; next: string;
  parts: Part[]; whyLabel?: Record<string, string>; from?: (v: string) => string; to?: (v: string) => string; movesTitle?: string;
};
const s = (d: RunDay, k: string) => d.stats[k] ?? 0;
const CFG: Record<Topic, Cfg> = {
  new: {
    action: "watch", last: (st) => st.watcher_last, every: 6 * 60_000, what: "every 2 minutes: the companies created in the last 48 hours get a priority and a starter potential", next: "the next pass within 2 minutes",
    parts: [
      { key: "prio", label: "Priority set", color: "#1b7a55", of: (d) => ["P1", "P2", "P3", "P4"].reduce((a, k) => a + s(d, k), 0) },
      { key: "seed", label: "Starter potential", color: "#5b8def", of: (d) => s(d, "potential_seeded") },
    ],
  },
  sweep: {
    action: "sweep", last: (st) => st.last_sweep, every: 30 * HOUR, what: "every night after the ERP chain: every company's priority from its potential and its best revenue year - raised when it should be, never lowered", next: "the next tonight, after the ERP chain",
    parts: [
      { key: "up", label: "Priority raised", color: "#1b7a55", of: (d) => s(d, "upgrade") },
      { key: "fill", label: "Filled or bought again", color: "#eda100", of: (d) => s(d, "fill_empty") + s(d, "unlost") },
      { key: "facts", label: "Helper fields refreshed", color: DEEMPHASIS, of: (d) => s(d, "facts_only") },
    ],
    whyLabel: { upgrade: "Priority raised", fill: "Had no priority", unlost: "APSOlost bought again" }, from: prio, to: prio, movesTitle: "What the last night changed",
  },
  potential: {
    action: "potential", last: (st) => st.last_potential, every: 30 * HOUR, what: "every night: the potentials the engine set itself recalculated from revenue and product fit - raised, never lowered, a person's value never touched", next: "the next tonight, after the ERP chain",
    parts: [
      { key: "recalc", label: "Raised to the formula", color: "#1b7a55", of: (d) => s(d, "machine_recalc") },
      { key: "filled", label: "Filled (was empty)", color: "#eda100", of: (d) => s(d, "filled") },
      { key: "restored", label: "A person's value restored", color: "#9a7bf0", of: (d) => s(d, "human_restored") },
    ],
    whyLabel: { machine_recalc: "Raised to the formula", filled: "Was empty", human_restored: "A person's value restored" }, from: eur, to: eur, movesTitle: "What the last run changed",
  },
  web: {
    action: "web", last: (st) => st.last_web, every: 30 * HOUR, what: "every night 200 companies, and every new company within minutes: its own website read for an empty description, size and address - each site once in 30 days", next: "new companies as they come, the next batch tonight",
    parts: [
      { key: "ok", label: "Something learned", color: "#1b7a55", of: (d) => s(d, "site_ok") },
      { key: "no", label: "Tried, nothing to learn", color: DEEMPHASIS, of: (d) => Math.max(0, s(d, "attempted") - s(d, "site_ok")) },
    ],
    whyLabel: { web: "From its website" }, from: (v) => v, to: (v) => v.replace("numberofemployees", "employees").replace("apic_ap", "APIC"), movesTitle: "The websites read lately",
  },
  yearly: {
    action: "yearly", last: (st) => st.last_yearly, every: 400 * 24 * HOUR, what: "once a year, in January, by hand after a preview: every APSO segment decided again by 14 rules, every priority set exactly to the rule - up or down", next: "January, after a preview and its Excel",
    parts: [{ key: "written", label: "Companies written", color: "#9a7bf0", of: (d) => d.written }],
  },
};

function Pulse({ tone, beat }: { tone: string; beat: boolean }) {
  return (
    <Box sx={{ position: "relative", width: 14, height: 14, mt: 0.6, flexShrink: 0 }}>
      <Box sx={{ position: "absolute", inset: 0, borderRadius: "50%", bgcolor: tone }} />
      {beat && <Box sx={{ position: "absolute", inset: -4, borderRadius: "50%", border: `2px solid ${tone}`, animation: "runPulse 1.8s ease-out infinite", "@keyframes runPulse": { "0%": { transform: "scale(.6)", opacity: 0.9 }, "100%": { transform: "scale(1.6)", opacity: 0 } } }} />}
    </Box>
  );
}

export function RunAlive({ topic, st, live }: { topic: Topic; st: Status; live: boolean }) {
  const c = CFG[topic];
  const r = useHeld<{ days: Record<string, RunDay>; moves: { at: string; rows: Move[] } | null }>(`/api/uc/segmentation/history?action=${c.action}`, [c.action]).result;
  const h = r?.state === "ok" ? r.data : null;
  const [why, setWhy] = useState("all");
  const last = c.last(st);
  const lastAt = last && typeof last.at === "string" ? last.at : null;
  const age = lastAt ? Date.now() - Date.parse(lastAt) : Infinity;
  // the nightly runs the sweep, the potentials and a website batch one after the other under one name
  const isRunning = !!st.running && (st.running.what === topic || (topic === "new" && st.running.what === "watch") || (st.running.what === "nightly" && ["sweep", "potential", "web"].includes(topic)));
  const yearlyDone = topic === "yearly" && st.yearly_done === st.year;
  const ok = topic === "yearly" ? yearlyDone : !!lastAt && !last?.dry && age < c.every;
  const tone = !live ? FAINT : isRunning ? "#eda100" : ok ? "#1b7a55" : topic === "yearly" ? "#eda100" : "#c5221f";
  const title = !live ? "The Compass connector runs it here, not the hub"
    : isRunning ? `Running now - since ${at(st.running!.started)}`
    : topic === "yearly" ? (yearlyDone ? `Done for ${st.year}` : `Not run for ${st.year} - due in January, by hand`)
    : ok ? "Live - working as it should"
    : lastAt ? `Late - the last real run was ${ago(age)}` : "Not run yet";
  const days = h ? Object.keys(h.days).sort().slice(-30) : [];
  const moves = (h?.moves?.rows ?? []).filter((m) => why === "all" || m.why === why);
  const whys = [...new Set((h?.moves?.rows ?? []).map((m) => m.why))];
  const { slice, pager } = usePaged(moves, 15);
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
      <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
        <Pulse tone={tone} beat={live && (ok || isRunning) && topic !== "yearly"} />
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: "1.02rem", fontWeight: 800, color: INK }}>{title}</Typography>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED, lineHeight: 1.5 }}>
            {lastAt ? `Last run ${at(lastAt)} - ${ago(age)}${last?.dry ? " (a preview, nothing written)" : ""}. ` : ""}It runs {c.what}. Next: {c.next}.
          </Typography>
        </Box>
      </Box>

      {topic === "yearly" ? <YearlyRules st={st} /> : (
        <Box sx={{ mt: 2 }}>
          <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>Day by day</Typography>
          {days.length ? (
            <StackedColumns height={180} data={days.map((k) => ({ x: k, ...Object.fromEntries(c.parts.map((p) => [p.key, p.of(h!.days[k])])) }))}
              parts={c.parts.map(({ key, label, color }) => ({ key, label, color }))} format={(v) => full(v ?? 0)} xFormat={(x) => `${x.slice(8, 10)}.${x.slice(5, 7)}`} />
          ) : (
            <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>Counted from 02.11.2026 on - the first day shows after its next run.</Typography>
          )}
        </Box>
      )}

      {c.movesTitle && (
        <Box sx={{ mt: 2, display: "grid", gap: 1 }}>
          <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>
            {c.movesTitle}{h?.moves ? ` - ${full(h.moves.rows.length)} ${h.moves.rows.length === 1 ? "company" : "companies"}, ${at(h.moves.at)}` : ""}
          </Typography>
          {whys.length > 1 && (
            <Choice<string> value={why} onChange={setWhy} options={[{ key: "all", label: "All", count: h?.moves?.rows.length ?? 0 }, ...whys.map((k) => ({ key: k, label: c.whyLabel?.[k] ?? k, count: (h?.moves?.rows ?? []).filter((m) => m.why === k).length }))]} />
          )}
          {moves.length ? (
            <>
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead><TableRow>{["Company", topic === "web" ? "Website" : "Was", topic === "web" ? "Filled" : "Now", "Why"].map((x) => <TableCell key={x} sx={headCell}>{x}</TableCell>)}</TableRow></TableHead>
                  <TableBody>
                    {slice.map((m, i) => (
                      <TableRow key={`${m.id}-${i}`} hover>
                        <TableCell sx={bodyCell}><Box component="a" href={hsCompany(m.id)} target="_blank" rel="noopener" sx={{ color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(260) }}>{m.n || m.id}</Box></TableCell>
                        <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED, whiteSpace: "nowrap" }}>{c.from ? c.from(m.from) : m.from}</TableCell>
                        <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", fontWeight: 700, color: INK, ...clip(260) }}>{c.to ? c.to(m.to) : m.to}</TableCell>
                        <TableCell sx={{ ...bodyCell, fontSize: "0.78rem", color: MUTED, whiteSpace: "nowrap" }}>{c.whyLabel?.[m.why] ?? m.why}{topic === "web" ? ` · ${at(m.at)}` : ""}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
              {pager}
            </>
          ) : (
            <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{h?.moves ? "Nothing changed." : "Kept from 02.11.2026 on - the companies show after the next run."}</Typography>
          )}
        </Box>
      )}
    </GlassCard>
  );
}

/** The yearly run's 14 rules in the order they are tried, with the companies each took in the last preview or run. */
function YearlyRules({ st }: { st: Status }) {
  const ys = st.yearly_summary;
  const by = ys?.byRule ?? {};
  return (
    <Box sx={{ mt: 2, display: "grid", gap: 1 }}>
      <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>
        The 14 rules, the first that fits decides{ys ? ` - the companies each took in the last ${ys.dry ? "preview" : "run"}, ${at(ys.at)}` : ""}
      </Typography>
      {!ys && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>Not previewed yet: a preview reads every company and writes nothing - it shows here how many each rule would take, and the Excel lists them.</Typography>}
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead><TableRow>{["#", "When", "Gives", "Companies"].map((x) => <TableCell key={x} sx={headCell}>{x}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {YEARLY_RULES.map((rule, i) => (
              <TableRow key={rule.key} hover>
                <TableCell sx={{ ...bodyCell, fontSize: "0.78rem", color: FAINT }}>{i + 1}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: INK }}>{rule.text}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", fontWeight: 700, whiteSpace: "nowrap" }}>{rule.segment}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{ys ? full(by[rule.key] ?? 0) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Box>
  );
}
