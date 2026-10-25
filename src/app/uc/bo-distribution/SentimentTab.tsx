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
import TablePagination from "@mui/material/TablePagination";
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
import { ChartFrame, type TableTwin } from "@/app/charts/ChartFrame";
import { GroupedColumns } from "@/app/charts/GroupedColumns";
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
  /** The days of DETAIL the store holds - the tables below, not the figures. */
  days: number;
  detailDays: number;
  /** Counted in HubSpot for the period asked for; null when that read failed. */
  figures: { from: string; to: string; total: number; tone: Record<string, number>; resolution: Record<string, number>; at: string } | null;
  /** Does the sweep actually have its rhythm? false with a live mode means it is NOT running. */
  stepLive: boolean | null;
  ai: { usedToday: number; perRun: number; perDay: number; available: boolean };
  admin: boolean;
};

const pc = (n: number, d: number) => (d ? `${Math.round((1000 * n) / d) / 10}%` : "—");
/** How the customer sounds. */
const TONE_WORD: Record<Bucket, string> = {
  positive: "Pleased", neutral: "Ordinary business", negative: "Unhappy", unknown: "Nothing to go on",
};
/**
 * Whether WE settled the matter - a different question with different answers.
 *
 * These were showing the tone words, so the table said "Unhappy" and "Pleased" about our own
 * resolution, which reads as nonsense (SARCLA spotted it on the live tab, 24.10.2026).
 */
const RESOL_WORD: Record<Bucket, string> = {
  positive: "We settled it", neutral: "We replied, not settled", negative: "Not settled", unknown: "Nothing to go on",
};
const toneColour = (b: string) =>
  b === "negative" ? "#c5221f" : b === "positive" ? "#1b7a55" : b === "unknown" ? MUTED : INK;

/**
 * The three modes in words rather than in jargon.
 *
 * "shadow" and "live" mean nothing to somebody opening the page (SARCLA, 24.10.2026: "I'm not
 * understanding also this steering"), and the difference between them is the only thing on this
 * page that changes data.
 */
const MODE_WORD: Record<"off" | "shadow" | "live", string> = {
  off: "Switched off - it is not looking at tickets at all.",
  shadow: "Watching only. It works out an answer for every new Back Office ticket and keeps it here, and changes nothing in HubSpot.",
  live: "Writing. Every new Back Office ticket has its tone and its outcome written into HubSpot.",
};
const MODE_BUTTON: Record<"off" | "shadow" | "live", string> = {
  off: "Switch off", shadow: "Watch only", live: "Write it to HubSpot",
};

/**
 * One question over the period asked for, drawn as the platform draws a distribution.
 *
 * Counted in HubSpot rather than from the page's 21-day store, so a year is as easy as a week.
 * There is no "before the workflow" series any more: that comparison was honest during the
 * cut-over, while HubSpot still held the old answers, and the correction of 25.10 overwrote them
 * - a second bar now would be the same numbers drawn twice.
 */
function Answers({ caption, counts, total, words }: {
  caption: string; counts: Record<string, number>; total: number; words: Record<string, string>;
}) {
  const order = ["negative", "neutral", "positive", "unknown", "not_valid_email"];
  const label = (b: string) => (b === "not_valid_email" ? "Not a customer" : words[b as Bucket] ?? b);
  const rows = order.filter((b) => (counts[b] ?? 0) > 0 || b !== "not_valid_email");
  const table: TableTwin = {
    columns: ["", "Tickets", "Share"],
    rows: rows.map((b) => [label(b), counts[b] ?? 0, pc(counts[b] ?? 0, total)]),
    numeric: [1],
  };
  return (
    <ChartFrame caption={caption} table={table} empty={total ? null : "No ticket in this period."}>
      <BarList rows={rows.map((b) => ({ label: label(b), value: counts[b] ?? 0 }))}
        labelWidth={190} format={(v) => full(v ?? 0)} />
    </ChartFrame>
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

export function SentimentTab({ d, periodLabel, onChanged }: { d: SentimentData; periodLabel: string; onChanged: () => void }) {
  const s = d.summary;
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  // the ticket list is long enough to page (SARCLA 24.10: "use pagination")
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(25);
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
      <GlassCard>
        <CardTitle icon={<TuneIcon />} tint="amber" title="What this is doing right now"
          note={d.admin ? "And how to change it" : "Admins can change this"} />
        <Box sx={{ mt: 1.5, display: "grid", gap: 1.25 }}>
          <Typography sx={{ fontSize: "1rem", color: INK }}>
            <b>{d.settings.mode !== "off" && d.stepLive === false ? "Set, but not running." : MODE_WORD[d.settings.mode]}</b>
            {d.settings.at ? <Typography component="span" sx={{ color: MUTED, fontSize: "0.85rem" }}> · set by {d.settings.by} on {new Date(d.settings.at).toLocaleString()}</Typography> : null}
          </Typography>
          {/* A mode that is set but not running. The page used to say "Writing. Every new Back
              Office ticket has its tone written into HubSpot" while the sweep had run once, by
              hand, five hours earlier - SARCLA read that and believed it, which is the worst kind
              of wrong a status line can be (25.10.2026). */}
          {d.settings.mode !== "off" && d.stepLive === false ? (
            <Typography sx={{ color: "#c5221f", fontSize: "0.9rem", fontWeight: 600 }}>
              It is not actually running. The mode above is set, but the sweep is switched off, so nothing has happened
              since the last time somebody pressed &ldquo;Look now&rdquo;. Press it once and it starts for good.
            </Typography>
          ) : null}
          {/* The one state nobody should sit in by accident: the old workflow handed over and
              nothing took the job on. Said first and in red, because new tickets are getting no
              tone at all while it lasts (SARCLA hit exactly this on 24.10.2026). */}
          {d.workflowOn === false && d.settings.mode !== "live" ? (
            <Typography sx={{ color: "#c5221f", fontSize: "0.9rem", fontWeight: 600 }}>
              Nobody is filling these two fields in. The old HubSpot workflow is switched off and this is only watching,
              so every new Back Office ticket is being left without a tone. Press &ldquo;Write it to HubSpot&rdquo; to take
              the job on, or switch the workflow back on in HubSpot.
            </Typography>
          ) : d.workflowOn === true ? (
            <Typography sx={{ color: "#a96a12", fontSize: "0.88rem" }}>
              The old HubSpot workflow is still switched on, so this will not write even if you ask it to - the two of them
              would overwrite each other. Switch the workflow off in HubSpot to hand over, and back on to undo.
            </Typography>
          ) : d.workflowOn === false ? null : (
            <Typography sx={{ color: MUTED, fontSize: "0.88rem" }}>Could not check whether the old workflow is on, so this will not write until it can.</Typography>
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
                <Tooltip key={m} title={MODE_WORD[m]}>
                  <span>
                    <Button size="small" variant={d.settings.mode === m ? "contained" : "outlined"}
                      disabled={busy !== null || d.settings.mode === m}
                      onClick={() => send(m, { mode: m }, "PUT")}>{MODE_BUTTON[m]}</Button>
                  </span>
                </Tooltip>
              ))}
              {busy ? <CircularProgress size={16} /> : null}
              {note ? <Chip size="small" label={note} /> : null}
            </Box>
          ) : null}
          {d.admin ? (
            <Box sx={{ display: "grid", gap: 0.25, pt: 1, borderTop: `1px solid ${HAIRLINE}` }}>
              <FormControlLabel control={<Switch size="small" checked={d.settings.aiOn} disabled={busy !== null}
                onChange={(e) => send("ai", { aiOn: e.target.checked }, "PUT")} />}
                label="Ask the AI when the words are not clear" />
              <Typography sx={{ color: MUTED, fontSize: "0.8rem", ml: 5.5, mt: -0.5, mb: 0.75 }}>
                Most Back Office mail contains no word that gives the mood away, so without this about two thirds of
                tickets read &ldquo;nothing to go on&rdquo;. With it, roughly {d.ai.perDay} a day at most are read by the
                AI ({d.ai.usedToday} so far today).
              </Typography>
              <FormControlLabel control={<Switch size="small" checked={d.settings.templateRepliesCount} disabled={busy !== null}
                onChange={(e) => send("tpl", { templateRepliesCount: e.target.checked }, "PUT")} />}
                label="Count a customer's reply to our own automatic mails" />
              <Typography sx={{ color: MUTED, fontSize: "0.8rem", ml: 5.5, mt: -0.5 }}>
                Our order confirmations and shipping notices are not a customer talking, so they are left out. Sometimes a
                customer answers one with &ldquo;perfect, thanks&rdquo;. Off, those answers are left out too and the
                figures stay clean. On, they count - more tickets, but a lot of one-line pleasantries land in
                &ldquo;Pleased&rdquo;.
              </Typography>
            </Box>
          ) : null}
        </Box>
      </GlassCard>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 6 }}>
          <GlassCard sx={{ height: "100%" }}>
            <CardTitle icon={<CompareArrowsIcon />} tint="blue" title="What the answers are"
              note={`${periodLabel} · counted in HubSpot, so any period works`} />
            <Box sx={{ display: "grid", gap: 2, mt: 1.5 }}>
              {d.figures ? (
                <>
                  <Answers caption="How the customer sounds" counts={d.figures.tone} total={d.figures.total} words={TONE_WORD} />
                  <Answers caption="Whether we settled the matter" counts={d.figures.resolution} total={d.figures.total} words={RESOL_WORD} />
                </>
              ) : (
                <Typography sx={{ color: MUTED, fontSize: "0.88rem" }}>HubSpot could not be counted for this period.</Typography>
              )}
            </Box>
          </GlassCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <GlassCard sx={{ height: "100%" }}>
            <CardTitle icon={<BlockIcon />} tint="slate" title="Why a ticket gets no sentiment"
              note={`The last ${d.detailDays} days - the reasons are kept here, not on the ticket`} />
            <Box sx={{ mt: 1.5 }}>
              <BarList rows={s.reasons.map((r) => ({ label: r.label, value: r.n }))}
                emptyMessage="Nothing has been left out yet." labelWidth={260} />
            </Box>
          </GlassCard>
        </Grid>
      </Grid>

      {s.modelChanged.length ? (
        <GlassCard>
          <CardTitle icon={<PsychologyOutlinedIcon />} tint="purple" title="Where the model answered instead of the words"
            note="Already applied - the model's answer is the one written on the ticket. Here to be checked, not to be done" />
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
        <CardTitle icon={<CompareArrowsIcon />} tint="blue" title="The latest tickets"
          note={`The last ${d.detailDays} days - which words fired and what the model said is kept here, not on the ticket`} />
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
            {d.rows.slice(page * perPage, page * perPage + perPage).map((r) => (
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
        {d.rows.length ? (
          <TablePagination component="div" count={d.rows.length} page={page} rowsPerPage={perPage}
            rowsPerPageOptions={[25, 50, 100, 200]}
            onPageChange={(_, p) => setPage(p)}
            onRowsPerPageChange={(e) => { setPerPage(Number(e.target.value)); setPage(0); }}
            sx={{ ".MuiTablePagination-toolbar": { px: 0 } }} />
        ) : <Typography sx={{ color: MUTED, fontSize: "0.88rem", mt: 1 }}>Nothing yet - press &ldquo;Look now&rdquo;.</Typography>}
      </GlassCard>
    </Box>
  );
}
