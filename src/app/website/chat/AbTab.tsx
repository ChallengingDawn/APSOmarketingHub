"use client";

// APSOassistant Chat > A/B test (SARCLA 27.10.2026: "per country, 50% of the time when the customer is not logged in,
// a transparent black screen to enter the e-mail at the start to be able to chat at all; the other 50% the address is
// asked during the conversation. We should be able to fine-tune it. The target is to measure if we lose customers by
// asking the e-mail from the start; if positive we make it mandatory"). The test runs in the shop chat's widget and
// its gateway (chatab.ts); this tab sets it (admins) and reads it: per country, e-mail first against e-mail later -
// do we lose chats, do we gain e-mails (src/lib/chat/abStats.ts).

import { useState } from "react";
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
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import AlternateEmailOutlinedIcon from "@mui/icons-material/AlternateEmailOutlined";
import GavelOutlinedIcon from "@mui/icons-material/GavelOutlined";
import { full } from "@/app/charts/format";
import { Chip } from "@/app/connectors/parts";
import { CardTitle, GREEN, GlassCard, HAIRLINE, INK, KpiTile, MUTED, Notice, bodyCell, headCell, type Tint } from "@/app/uc/report/ui";
import { DimChart } from "@/app/reporting/marketing-kpis/DimChart";
import { MIN_VISITORS, type Comparison, type Rate, type Verdict } from "@/lib/chat/abStats";
import type { AbData } from "@/lib/chat/abtest";
import { Loaded, pill, post, when } from "./shared";

type AbPage = AbData & { isAdmin: boolean };
const COUNTRIES = ["CH", "DE", "AT", "FR", "IT", "NL", "PL", "INT"];
const VERDICT: Record<Verdict, { text: string; tint: Tint }> = {
  "too-early": { text: `Too early - under ${MIN_VISITORS} visitors in a variant`, tint: "slate" },
  "keep-later": { text: "Asking first loses chats - keep asking later", tint: "pink" },
  mandatory: { text: "Asking first keeps the chats and brings more e-mails - make it mandatory", tint: "green" },
  "no-difference": { text: "No clear difference yet", tint: "amber" },
};
const pctOf = (x: number | null) => (x === null ? "–" : `${Math.round(x * 1000) / 10}%`);
const sig = (r: Rate) => (r.p === null ? "" : r.p < 0.05 ? " · clear" : " · not clear yet");

export default function AbTab() {
  const [n, setN] = useState(0);
  return (
    <Loaded<AbPage> key={`ab-${n}`} url="/api/website/chat?part=ab" what="the A/B test">
      {(d) => <Body d={d} reload={() => setN((x) => x + 1)} />}
    </Loaded>
  );
}

function Body({ d, reload }: { d: AbPage; reload: () => void }) {
  const all = d.comparisons[0];
  const countries = d.comparisons.slice(1);
  return (
    <>
      <Settings d={d} reload={reload} />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<GroupsOutlinedIcon />} tint="purple" label="Visitors in the test" value={full(all.first.visitors + all.later.visitors)}
          note={`E-mail first ${full(all.first.visitors)} · E-mail later ${full(all.later.visitors)}${d.firstAt ? ` · counted from ${when(d.firstAt).slice(0, 5)}` : ""}`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<ForumOutlinedIcon />} tint="blue" label="Wrote to the chat" value={`${pctOf(all.chatRate.first)} · ${pctOf(all.chatRate.later)}`}
          note={`of the visitors who opened it - e-mail first · e-mail later${sig(all.chatRate)}`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<AlternateEmailOutlinedIcon />} tint="green" label="Gave an e-mail" value={`${pctOf(all.emailRate.first)} · ${pctOf(all.emailRate.later)}`}
          note={`of the visitors - e-mail first · e-mail later (the leads)${sig(all.emailRate)}`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<GavelOutlinedIcon />} tint={VERDICT[all.verdict].tint} label="So far" value={all.verdict === "mandatory" ? "Make it mandatory" : all.verdict === "keep-later" ? "Keep asking later" : all.verdict === "too-early" ? "Too early" : "No difference yet"}
          note={VERDICT[all.verdict].text} /></Grid>
      </Grid>
      {countries.length > 0 && (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <DimChart<Comparison & { label: string }> title="Wrote to the chat - % of the visitors who opened it" rows={countries.map((c) => ({ ...c, label: c.country }))}
              cur={(r) => Math.round((r.chatRate.first ?? 0) * 100)} prev={(r) => Math.round((r.chatRate.later ?? 0) * 100)}
              curLabel="E-mail first" prevLabel="E-mail later" fmt={(v) => `${v}%`} labelWidth={60} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <DimChart<Comparison & { label: string }> title="Gave an e-mail - % of the visitors" rows={countries.map((c) => ({ ...c, label: c.country }))}
              cur={(r) => Math.round((r.emailRate.first ?? 0) * 100)} prev={(r) => Math.round((r.emailRate.later ?? 0) * 100)}
              curLabel="E-mail first" prevLabel="E-mail later" fmt={(v) => `${v}%`} labelWidth={60} curColor="#198038" />
          </Grid>
        </Grid>
      )}
      <GlassCard sx={{ display: "grid", gap: 1 }}>
        <CardTitle icon={<ScienceOutlinedIcon />} tint="purple" title="Per country"
          note={`E-mail first against e-mail later. "Clear" = a difference this size by chance is under 5% likely; a verdict needs ${MIN_VISITORS} visitors in each variant.`} />
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 820 }}>
            <TableHead><TableRow>
              {["Country", "Visitors (first · later)", "Wrote (first · later)", "E-mail (first · later)", "Hand-overs (first · later)", "So far"].map((h, i) => <TableCell key={h} sx={{ ...headCell, textAlign: i > 0 && i < 5 ? "right" : "left" }}>{h}</TableCell>)}
            </TableRow></TableHead>
            <TableBody>
              {d.comparisons.map((c) => (
                <TableRow key={c.country}>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontWeight: c.country === "All" ? 700 : 600, color: INK }}>{c.country}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{full(c.first.visitors)} · {full(c.later.visitors)}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", textAlign: "right" }}>{pctOf(c.chatRate.first)} · {pctOf(c.chatRate.later)}<span style={{ color: MUTED }}>{sig(c.chatRate)}</span></TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", textAlign: "right" }}>{pctOf(c.emailRate.first)} · {pctOf(c.emailRate.later)}<span style={{ color: MUTED }}>{sig(c.emailRate)}</span></TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", textAlign: "right" }}>{full(c.first.handovers)} · {full(c.later.handovers)}</TableCell>
                  <TableCell sx={bodyCell}><Chip tint={VERDICT[c.verdict].tint}>{VERDICT[c.verdict].text}</Chip></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
        {!d.rows.length && <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>No visitor counted in this test yet.</Typography>}
      </GlassCard>
    </>
  );
}

/** The test's setting - who is in it and how they are split; an admin changes it, everyone sees it. */
function Settings({ d, reload }: { d: AbPage; reload: () => void }) {
  const s = d.setting;
  const [on, setOn] = useState(s.on);
  const [countries, setCountries] = useState<string[]>(s.countries);
  const [split, setSplit] = useState(s.split);
  const [restart, setRestart] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = on !== s.on || split !== s.split || countries.slice().sort().join() !== s.countries.slice().sort().join() || restart;
  const save = async () => {
    if (!confirm(`${on ? "Run" : "Stop"} the test${on ? ` in ${countries.join(", ")} - e-mail first for ${split}% of the visitors who are not logged in` : ""}${restart ? ", counting again from zero" : ""}?`)) return;
    setBusy(true); setMsg(null);
    const r = await post({ action: "ab-save", ab: { on, countries, split, restart } });
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: "Saved - the shop chat picks it up within a minute." } : { ok: false, text: r.error ?? "Did not work." });
    if (r.ok) reload();
  };
  const toggle = (c: string) => setCountries((l) => (l.includes(c) ? l.filter((x) => x !== c) : [...l, c]));
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25 }}>
      <CardTitle icon={<TuneOutlinedIcon />} tint="blue" title="The test"
        note="Visitors of the shop chat who are not logged in (a logged-in customer's e-mail is known): e-mail first = a dark screen asks for the e-mail before they can write; e-mail later = today's chat, the e-mail asked when needed. A visitor keeps the variant." />
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
        {s.on ? <Chip tint="green">Running</Chip> : <Chip tint="slate">Off</Chip>}
        {s.on && <Chip tint="blue">{s.countries.join(" · ")}</Chip>}
        {s.on && <Chip tint="purple">E-mail first for {s.split}%</Chip>}
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
          <Box sx={{ display: "grid", gap: 0.25, maxWidth: 520 }}>
            <Typography sx={{ fontSize: "0.82rem", color: INK }}>E-mail first for <b>{split}%</b> of the visitors · e-mail later for {100 - split}%</Typography>
            <Slider value={split} min={0} max={100} step={5} onChange={(_, v) => setSplit(v as number)} aria-label="Share asked for the e-mail first" size="small" />
          </Box>
          <FormControlLabel control={<Checkbox size="small" checked={restart} onChange={(e) => setRestart(e.target.checked)} />}
            label={<Typography sx={{ fontSize: "0.8rem", color: MUTED }}>Count again from zero (everyone gets a new variant)</Typography>} />
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
            <Button size="small" variant="contained" disableElevation sx={pill} disabled={!dirty || busy} onClick={() => void save()}
              startIcon={busy ? <CircularProgress size={14} color="inherit" /> : undefined}>{busy ? "Saving…" : "Save"}</Button>
            {msg && (msg.ok ? <Typography sx={{ fontSize: "0.8rem", color: GREEN }}>{msg.text}</Typography> : <Notice tone="bad">{msg.text}</Notice>)}
          </Box>
        </Box>
      )}
    </GlassCard>
  );
}
