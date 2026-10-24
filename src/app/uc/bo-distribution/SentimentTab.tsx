"use client";

// BACK OFFICE DISTRIBUTION - the Sentiment tab (SARCLA 24.10.2026: a tab to replace the HubSpot
// workflow "SARCLA | BO SENTIMENT AND TONE", "improve it a lot because today results are not that
// great", able to report, and able to "disqualify some that are not real ticket").
//
// The page leads with the denominator, because that is the finding: half of what the workflow has
// been scoring is not a customer talking at all. Then what the answers are, how they differ from
// the workflow's own, and - for the cases where the model overruled the words - why.

import { useEffect, useState } from "react";
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
import Tooltip from "@mui/material/Tooltip";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import CircularProgress from "@mui/material/CircularProgress";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import MoodIcon from "@mui/icons-material/Mood";
import BlockIcon from "@mui/icons-material/Block";
import PsychologyOutlinedIcon from "@mui/icons-material/PsychologyOutlined";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import TuneIcon from "@mui/icons-material/Tune";
import SearchIcon from "@mui/icons-material/Search";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import { BarList } from "@/app/charts/BarList";
import { full } from "@/app/charts/format";
import {
  ACCENT, CardTitle, GlassCard, HAIRLINE, INK, KpiTile, MUTED, bodyCell, clip, headCell, hsTicket,
} from "@/app/uc/report/ui";

type Bucket = "positive" | "neutral" | "negative" | "unknown";
type Reason = { reason: string; label: string; n: number };
type Row = {
  ticketId: string; subject: string; at: string;
  real: boolean; reasons: string[];
  keywords: { tone: Bucket; toneConfidence: number; resolution: Bucket; urgency: number; lang: string; hits: string[] };
  ai?: { tone: string; resolution: string; machine: boolean; why: string; tokens: number } | null;
  answer: { tone: Bucket; resolution: Bucket; source: "keywords" | "model" | "none" };
  workflow: { tone: string | null; resolution: string | null };
  replay: { tone: string; resolution: string };
  written?: Record<string, string> | null;
  skipped?: string;
  error?: string;
};
type Summary = {
  looked: number; excluded: number; scored: number; reasons: Reason[];
  tone: Record<Bucket, number>; resolution: Record<Bucket, number>;
  source: { keywords: number; model: number; none: number };
  urgent: number;
  versusWorkflow: { agree: number; differ: number; workflowBlank: number; moves: { from: string; to: string; n: number }[] };
  modelChanged: { ticketId: string; subject: string; from: string; to: string; why: string }[];
  written: number; skipped: number;
};
export type SentimentData = {
  settings: { mode: "off" | "shadow" | "live"; aiOn: boolean; templateRepliesCount: boolean; by: string | null; at: string | null };
  last: { at: string; seconds: number; looked: number; excluded: number; scored: number; asked: number; wrote: number; mode: string; heldBy?: string; error?: string } | null;
  rows: Row[];
  summary: Summary;
  headline: string;
  workflowOn: boolean | null;
  everyMinutes: number;
  ai: { usedToday: number; perRun: number; perDay: number; available: boolean };
  admin: boolean;
};

const pc = (n: number, d: number) => (d ? `${Math.round((1000 * n) / d) / 10}%` : "—");
const TONE_WORD: Record<Bucket, string> = {
  positive: "Pleased", neutral: "Ordinary business", negative: "Unhappy", unknown: "Nothing to go on",
};
const toneColour = (b: string) =>
  b === "negative" ? "#c5221f" : b === "positive" ? "#1b7a55" : b === "unknown" ? MUTED : INK;

function Bucketed({ title, counts, scored, old }: {
  title: string; counts: Record<Bucket, number>; scored: number;
  old?: { positive: number; neutral: number; negative: number };
}) {
  const order: Bucket[] = ["negative", "neutral", "positive", "unknown"];
  return (
    <Box>
      <Typography sx={{ color: MUTED, fontSize: "0.8rem", mb: 0.75 }}>{title}</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={headCell}>&nbsp;</TableCell>
            <TableCell sx={headCell} align="right">The hub</TableCell>
            {old ? <TableCell sx={headCell} align="right">The workflow</TableCell> : null}
          </TableRow>
        </TableHead>
        <TableBody>
          {order.map((b) => (
            <TableRow key={b}>
              <TableCell sx={{ ...bodyCell, color: toneColour(b), fontWeight: 600 }}>{TONE_WORD[b]}</TableCell>
              <TableCell sx={bodyCell} align="right">
                {full(counts[b])} <Typography component="span" sx={{ color: MUTED, fontSize: "0.78rem" }}>{pc(counts[b], scored)}</Typography>
              </TableCell>
              {old ? (
                <TableCell sx={{ ...bodyCell, color: MUTED }} align="right">
                  {b === "unknown" ? <Tooltip title="The workflow has no word for it - it called these neutral"><span>—</span></Tooltip>
                    : `${full(old[b as "positive" | "neutral" | "negative"])} ${pc(old[b as "positive" | "neutral" | "negative"], scored)}`}
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

function CheckOne() {
  const [id, setId] = useState("");
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const go = async () => {
    if (!/^\d+$/.test(id.trim())) { setErr("A ticket id is a number."); return; }
    setBusy(true); setErr(null); setR(null);
    try {
      const res = await fetch(`/api/uc/bo-sentiment?ticket=${id.trim()}`, { cache: "no-store" });
      const j = await res.json();
      if (j?.ok) setR(j.data); else setErr(j?.error ?? "That did not work.");
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const k = r?.keywords as { tone: Bucket; toneConfidence: number; resolution: Bucket; urgency: number; lang: string; customer?: { hits?: { term: string; dim: string; points: number }[] }; agent?: { hits?: { term: string; dim: string; points: number }[] } } | undefined;
  const ai = r?.ai as { tone: string; resolution: string; machine: boolean; why: string } | null | undefined;
  return (
    <GlassCard>
      <CardTitle icon={<SearchIcon />} tint="slate" title="Check a ticket"
        note="Scored now and stored nowhere, with the words that fired - so the answer can be argued with" />
      <Box sx={{ display: "flex", gap: 1, mt: 1.5, mb: r ? 2 : 0 }}>
        <TextField size="small" label="Ticket id" value={id} onChange={(e) => setId(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") go(); }} sx={{ maxWidth: 220 }} />
        <Button variant="contained" onClick={go} disabled={busy}>{busy ? "Reading…" : "Read it"}</Button>
      </Box>
      {err ? <Typography sx={{ color: "#c5221f", fontSize: "0.85rem" }}>{err}</Typography> : null}
      {r && k ? (
        <Box sx={{ display: "grid", gap: 1 }}>
          <Typography sx={{ color: INK, fontWeight: 600 }}>{String(r.subject || "(no subject)")}</Typography>
          {!r.real ? (
            <Typography sx={{ color: "#a96a12", fontSize: "0.88rem" }}>
              Not a customer talking: {(r.reasons as string[]).join(", ")}. It gets no sentiment.
            </Typography>
          ) : null}
          <Typography sx={{ fontSize: "0.88rem" }}>
            <b>Words</b>: tone <span style={{ color: toneColour(k.tone) }}>{k.tone}</span> (confidence {k.toneConfidence}),
            {" "}resolution {k.resolution}, urgency {k.urgency}, language {k.lang}
          </Typography>
          {ai ? (
            <Typography sx={{ fontSize: "0.88rem" }}>
              <b>Model</b>: tone <span style={{ color: toneColour(ai.tone) }}>{ai.tone}</span>, resolution {ai.resolution}
              {ai.machine ? ", and it says nobody is really talking" : ""} — &ldquo;{ai.why}&rdquo;
            </Typography>
          ) : r.wouldAsk ? <Typography sx={{ color: MUTED, fontSize: "0.85rem" }}>The model would be asked about this one.</Typography> : null}
          <Typography sx={{ fontSize: "0.88rem", color: MUTED }}>
            <b>The workflow</b> wrote tone {String((r.workflow as { tone: string | null }).tone ?? "—")}, resolution {String((r.workflow as { resolution: string | null }).resolution ?? "—")};
            its algorithm re-run here says {String((r.replay as { tone: string }).tone)}.
          </Typography>
          {(k.customer?.hits ?? []).length ? (
            <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>
              Customer&apos;s words: {(k.customer!.hits ?? []).slice(0, 10).map((h) => `${h.term} (${h.dim}, ${h.points})`).join(" · ")}
            </Typography>
          ) : null}
          {(k.agent?.hits ?? []).length ? (
            <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>
              Ours: {(k.agent!.hits ?? []).slice(0, 10).map((h) => `${h.term} (${h.dim}, ${h.points})`).join(" · ")}
            </Typography>
          ) : null}
        </Box>
      ) : null}
    </GlassCard>
  );
}

export function SentimentTab({ d, onChanged }: { d: SentimentData; onChanged: () => void }) {
  const s = d.summary;
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(null), 8000); return () => clearTimeout(t); }, [note]);

  const send = async (what: string, body: Record<string, unknown>, method: "PUT" | "POST") => {
    setBusy(what);
    try {
      const res = await fetch("/api/uc/bo-sentiment", {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const j = await res.json();
      setNote(j?.ok ? "Done." : (j?.error ?? "That did not work."));
      onChanged();
    } catch (e) { setNote((e as Error).message); } finally { setBusy(null); }
  };

  // the workflow's own answers on the same tickets, for the side-by-side
  const old = { positive: 0, neutral: 0, negative: 0 };
  for (const r of d.rows) {
    if (!r.real) continue;
    if (r.workflow.tone === "positive") old.positive += 1;
    else if (r.workflow.tone === "neutral") old.neutral += 1;
    else if (r.workflow.tone === "negative") old.negative += 1;
  }

  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      <GlassCard>
        <CardTitle icon={<MoodIcon />} tint="purple" title="Customer tone and resolution"
          note={`The HubSpot workflow's work, done here instead - every ${d.everyMinutes} minutes`} />
        <Typography sx={{ color: INK, mt: 1.25, fontSize: "1rem" }}>{d.headline}</Typography>
        <Grid container spacing={1.5} sx={{ mt: 1.5 }}>
          <Grid size={{ xs: 6, md: 2 }}><KpiTile icon={<MoodIcon />} tint="green" label="A customer talking" value={full(s.scored)} note={`of ${full(s.looked)} looked at`} /></Grid>
          <Grid size={{ xs: 6, md: 2 }}><KpiTile icon={<BlockIcon />} tint="slate" label="Not a customer" value={pc(s.excluded, s.looked)} note={`${full(s.excluded)} tickets`} /></Grid>
          <Grid size={{ xs: 6, md: 2 }}><KpiTile icon={<MoodIcon />} tint="pink" label="Sound unhappy" value={pc(s.tone.negative, s.scored)} note={`${full(s.tone.negative)} tickets`} /></Grid>
          <Grid size={{ xs: 6, md: 2 }}><KpiTile icon={<HelpOutlineIcon />} tint="slate" label="Nothing to go on" value={pc(s.tone.unknown, s.scored)} note="said, not hidden as neutral" /></Grid>
          <Grid size={{ xs: 6, md: 2 }}><KpiTile icon={<BoltOutlinedIcon />} tint="amber" label="Asked for speed" value={pc(s.urgent, s.scored)} note="urgency, not unhappiness" /></Grid>
          <Grid size={{ xs: 6, md: 2 }}><KpiTile icon={<PsychologyOutlinedIcon />} tint="blue" label="Model answered" value={full(s.source.model)} note={`${d.ai.usedToday} of ${d.ai.perDay} today`} /></Grid>
        </Grid>
      </GlassCard>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 6 }}>
          <GlassCard sx={{ height: "100%" }}>
            <CardTitle icon={<CompareArrowsIcon />} tint="blue" title="What the answers are"
              note="The same tickets, scored here and by the workflow" />
            <Box sx={{ display: "grid", gap: 2, mt: 1.5 }}>
              <Bucketed title="How the customer sounds" counts={s.tone} scored={s.scored} old={old} />
              <Bucketed title="Whether we resolved it" counts={s.resolution} scored={s.scored} />
            </Box>
          </GlassCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <GlassCard sx={{ height: "100%" }}>
            <CardTitle icon={<BlockIcon />} tint="slate" title="Why a ticket gets no sentiment"
              note="Counted here and in no other figure on this page" />
            <Box sx={{ mt: 1.5 }}>
              <BarList rows={s.reasons.map((r) => ({ label: r.label, value: r.n }))}
                emptyMessage="Nothing has been left out yet." labelWidth={260} />
            </Box>
          </GlassCard>
        </Grid>
      </Grid>

      {s.modelChanged.length ? (
        <GlassCard>
          <CardTitle icon={<PsychologyOutlinedIcon />} tint="purple" title="Where the model overruled the words"
            note="The cases worth reading: what the keywords said, what the model said, and why" />
          <Table size="small" sx={{ mt: 1 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={headCell}>Ticket</TableCell>
                <TableCell sx={headCell}>Words</TableCell>
                <TableCell sx={headCell}>Model</TableCell>
                <TableCell sx={headCell}>Why</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {s.modelChanged.map((m) => (
                <TableRow key={m.ticketId}>
                  <TableCell sx={{ ...bodyCell, ...clip(240) }}>
                    <Box component="a" href={hsTicket(m.ticketId)} target="_blank" rel="noreferrer"
                      sx={{ color: ACCENT, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                      {m.subject || m.ticketId}<OpenInNewIcon sx={{ fontSize: 13 }} />
                    </Box>
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, color: toneColour(m.from) }}>{m.from}</TableCell>
                  <TableCell sx={{ ...bodyCell, color: toneColour(m.to), fontWeight: 600 }}>{m.to}</TableCell>
                  <TableCell sx={{ ...bodyCell, color: MUTED, ...clip(360) }}>{m.why}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </GlassCard>
      ) : null}

      <CheckOne />

      <GlassCard>
        <CardTitle icon={<TuneIcon />} tint="amber" title="How it runs"
          note={d.admin ? "Shadow stores and compares; live also writes the two properties" : "Admins can change this"} />
        <Box sx={{ mt: 1.5, display: "grid", gap: 1.25 }}>
          <Typography sx={{ fontSize: "0.9rem" }}>
            Mode <b>{d.settings.mode}</b>
            {d.settings.at ? <Typography component="span" sx={{ color: MUTED }}> · set by {d.settings.by} on {new Date(d.settings.at).toLocaleString()}</Typography> : null}
          </Typography>
          {d.workflowOn === true ? (
            <Typography sx={{ color: "#a96a12", fontSize: "0.88rem" }}>
              The HubSpot workflow &ldquo;SARCLA | BO SENTIMENT AND TONE&rdquo; is still switched on, so live mode writes
              nothing - both would be writing the same two properties. Switch the workflow off in HubSpot to hand over, and
              back on to roll back.
            </Typography>
          ) : d.workflowOn === false ? (
            <Typography sx={{ color: "#1b7a55", fontSize: "0.88rem" }}>
              The HubSpot workflow is off, so live mode writes the two properties itself.
            </Typography>
          ) : (
            <Typography sx={{ color: MUTED, fontSize: "0.88rem" }}>Could not read whether the workflow is on - live mode stands down until it can.</Typography>
          )}
          {d.last ? (
            <Typography sx={{ color: MUTED, fontSize: "0.85rem" }}>
              Last pass {new Date(d.last.at).toLocaleString()} in {d.last.seconds}s: looked at {d.last.looked},
              {" "}{d.last.excluded} not a customer, {d.last.scored} scored, {d.last.asked} asked of the model, {d.last.wrote} written.
              {d.last.heldBy ? ` Held: ${d.last.heldBy}.` : ""}{d.last.error ? ` Error: ${d.last.error}` : ""}
            </Typography>
          ) : <Typography sx={{ color: MUTED, fontSize: "0.85rem" }}>It has not run yet.</Typography>}
          {!d.ai.available ? (
            <Typography sx={{ color: "#a96a12", fontSize: "0.85rem" }}>
              No model key on this server, so only the keyword layer answers and more tickets read &ldquo;nothing to go on&rdquo;.
            </Typography>
          ) : null}
          {d.admin ? (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.25, alignItems: "center", pt: 0.5, borderTop: `1px solid ${HAIRLINE}`, mt: 0.5 }}>
              <Button size="small" variant="contained" disabled={busy !== null}
                onClick={() => send("run", { action: "run" }, "POST")}>{busy === "run" ? "Looking…" : "Look now"}</Button>
              {(["off", "shadow", "live"] as const).map((m) => (
                <Button key={m} size="small" variant={d.settings.mode === m ? "contained" : "outlined"}
                  disabled={busy !== null || d.settings.mode === m}
                  onClick={() => send(m, { mode: m }, "PUT")}>{m}</Button>
              ))}
              <FormControlLabel control={<Switch size="small" checked={d.settings.aiOn} disabled={busy !== null}
                onChange={(e) => send("ai", { aiOn: e.target.checked }, "PUT")} />} label="Ask the model" />
              <Tooltip title="A template the customer replied to - an order confirmation answered with 'perfect, thanks' - counts as a real ticket">
                <FormControlLabel control={<Switch size="small" checked={d.settings.templateRepliesCount} disabled={busy !== null}
                  onChange={(e) => send("tpl", { templateRepliesCount: e.target.checked }, "PUT")} />} label="Count replies to templates" />
              </Tooltip>
              {busy ? <CircularProgress size={16} /> : null}
              {note ? <Chip size="small" label={note} /> : null}
            </Box>
          ) : null}
        </Box>
      </GlassCard>

      <GlassCard>
        <CardTitle icon={<CompareArrowsIcon />} tint="blue" title="The latest tickets"
          note="What the hub says, what the workflow wrote, and who answered" />
        <Table size="small" sx={{ mt: 1 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={headCell}>Ticket</TableCell>
              <TableCell sx={headCell}>Tone</TableCell>
              <TableCell sx={headCell}>Resolution</TableCell>
              <TableCell sx={headCell}>By</TableCell>
              <TableCell sx={headCell}>Workflow</TableCell>
              <TableCell sx={headCell}>Note</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {d.rows.slice(0, 120).map((r) => (
              <TableRow key={`${r.ticketId}-${r.at}`}>
                <TableCell sx={{ ...bodyCell, ...clip(280) }}>
                  <Box component="a" href={hsTicket(r.ticketId)} target="_blank" rel="noreferrer"
                    sx={{ color: ACCENT, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                    {r.subject || r.ticketId}<OpenInNewIcon sx={{ fontSize: 13 }} />
                  </Box>
                </TableCell>
                <TableCell sx={{ ...bodyCell, color: toneColour(r.answer.tone), fontWeight: 600 }}>
                  {r.real ? r.answer.tone : "—"}
                </TableCell>
                <TableCell sx={bodyCell}>{r.real ? r.answer.resolution : "—"}</TableCell>
                <TableCell sx={{ ...bodyCell, color: MUTED }}>{r.real ? r.answer.source : "not a customer"}</TableCell>
                <TableCell sx={{ ...bodyCell, color: MUTED }}>{r.workflow.tone ?? "—"}</TableCell>
                <TableCell sx={{ ...bodyCell, color: MUTED, ...clip(300) }}>
                  {r.error ? r.error : r.ai?.why ? r.ai.why : r.reasons.length ? r.reasons.join(", ") : r.skipped ?? ""}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!d.rows.length ? <Typography sx={{ color: MUTED, fontSize: "0.88rem", mt: 1 }}>Nothing yet - press &ldquo;Look now&rdquo;.</Typography> : null}
      </GlassCard>
    </Box>
  );
}
