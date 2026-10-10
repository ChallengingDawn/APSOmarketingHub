"use client";

/**
 * DID IT WORK — the half the SEO area never had.
 *
 * Everything else here says what to do. This says what happened after somebody
 * did it: the page's clicks when the work started, its clicks now, and whether
 * the estimate was anywhere near right.
 *
 * The one thing it refuses to claim is cause. Search moves on its own — a
 * competitor publishes, an algorithm updates, February is not November — so
 * every verdict is worded as what happened AFTER the work, never because of it.
 * A measurement loop that overclaims gets believed once.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import RemoveIcon from "@mui/icons-material/Remove";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import BlockIcon from "@mui/icons-material/Block";

import { useSeoData } from "./SeoData";
import { SubAppFrame } from "./Shell";
import {
  WAIT_DAYS, daysSince, isDue, outcomeOf, verdictOf,
  type SeoAction, type Verdict,
} from "@/lib/seo/actionModel";

const INK = "#15223a";
const MUTED = "#5d6b85";
const FAINT = "#8b97ac";
const HAIRLINE = "rgba(21,34,58,.10)";

const VERDICT: Record<Verdict, { label: string; bg: string; fg: string; icon: React.ReactNode }> = {
  better: { label: "More clicks after", bg: "#e7f6ee", fg: "#1b7a55", icon: <CheckCircleIcon /> },
  flat: { label: "No real change", bg: "#eef1f5", fg: "#5d6b85", icon: <RemoveIcon /> },
  worse: { label: "Fewer clicks after", bg: "#fdecea", fg: "#9e1b18", icon: <TrendingDownIcon /> },
  waiting: { label: "Too early to tell", bg: "#fdf0e3", fg: "#a96a12", icon: <HourglassEmptyIcon /> },
  dropped: { label: "Dropped", bg: "#eef1f5", fg: "#8b97ac", icon: <BlockIcon /> },
  unmeasurable: { label: "Too small to call", bg: "#eef1f5", fg: "#5d6b85", icon: <HelpOutlineIcon /> },
};

const eur = (n: number | null) =>
  n === null ? "—" : `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(Math.round(n))} EUR`;

const when = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default function Impact() {
  const { data, windowDays } = useSeoData();
  const [actions, setActions] = useState<SeoAction[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [drop, setDrop] = useState<{ action: SeoAction; reason: string } | null>(null);

  const load = useCallback(() => {
    fetch("/api/seo/actions")
      .then(async (r) => {
        const text = await r.text();
        const j = text ? JSON.parse(text) : null;
        if (!j?.ok) { setError(j?.error ?? `Could not read the actions (HTTP ${r.status}).`); return; }
        setActions(j.actions as SeoAction[]);
      })
      .catch((e) => setError(String(e)));
  }, []);
  useEffect(load, [load]);

  /**
   * Today's reading for a subject, from the window already loaded for every
   * other page here. Queries and pages are separate reports in Search Console,
   * so which one to look in follows the kind of finding, not a guess.
   */
  const readingFor = useCallback((a: SeoAction) => {
    if (!data) return null;
    const rows = a.source === "decay" ? data.pages : data.queries;
    const row = rows.find((r) => r.key === a.subject);
    if (!row) return null;
    return { clicks: row.clicks, impressions: row.impressions, position: row.position };
  }, [data]);

  const post = useCallback(async (body: object) => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/seo/actions", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const text = await r.text();
      const j = text ? JSON.parse(text) : null;
      if (!j?.ok) { setError(j?.error ?? `That did not work (HTTP ${r.status}).`); return false; }
      load();
      return true;
    } catch (e) {
      setError(String(e));
      return false;
    } finally {
      setBusy(false);
    }
  }, [load]);

  const due = useMemo(() => (actions ?? []).filter((a) => isDue(a)), [actions]);
  const graded = useMemo(
    () => (actions ?? []).filter((a) => a.measuredAt || a.droppedAt),
    [actions],
  );
  const waiting = useMemo(
    () => (actions ?? []).filter((a) => !a.measuredAt && !a.droppedAt && !isDue(a)),
    [actions],
  );

  // How the advice is doing overall — the only number that says whether this
  // queue is worth following.
  const record = useMemo(() => {
    const measured = graded.filter((a) => a.measuredAt);
    const tally = { better: 0, flat: 0, worse: 0, unmeasurable: 0 };
    for (const a of measured) {
      const v = verdictOf(a);
      if (v in tally) tally[v as keyof typeof tally]++;
    }
    return { measured: measured.length, ...tally };
  }, [graded]);

  return (
    <SubAppFrame
      title="Did it work"
      purpose={`Every SEO action somebody started, and what happened to the page afterwards. Search is given ${WAIT_DAYS} days to react before anything is judged — and what is shown is what happened after the work, never proof the work caused it.`}
      willShow="the clicks each page had when its work started, against the clicks it has now"
    >
      {error && (
        <Box sx={{ p: 1.75, mb: 2, borderRadius: "14px", border: `1px solid ${HAIRLINE}`, borderLeft: "3px solid #9e1b18" }}>
          <Typography sx={{ fontSize: "0.86rem", color: "#9e1b18" }}>{error}</Typography>
        </Box>
      )}

      {actions === null && !error && (
        <Typography sx={{ fontSize: "0.9rem", color: MUTED }}>Reading what has been started…</Typography>
      )}

      {actions?.length === 0 && (
        <Box sx={{ p: 3, borderRadius: "16px", border: `1px dashed ${HAIRLINE}`, textAlign: "center" }}>
          <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, color: INK }}>Nothing started yet</Typography>
          <Typography sx={{ fontSize: "0.86rem", color: MUTED, mt: 0.75, maxWidth: "52ch", mx: "auto", lineHeight: 1.6 }}>
            Open the work queue and press <strong>Start</strong> on something. The page&rsquo;s clicks are written
            down at that moment, and {WAIT_DAYS} days later this page asks Search Console what happened.
          </Typography>
        </Box>
      )}

      {record.measured > 0 && (
        <Box sx={{
          display: "flex", gap: 2, flexWrap: "wrap", alignItems: "baseline",
          p: 2, mb: 2.5, borderRadius: "16px", border: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.55)",
        }}>
          <Typography sx={{ fontSize: "0.9rem", fontWeight: 600, color: INK }}>
            {record.better} of {record.measured} gained clicks
          </Typography>
          <Typography sx={{ fontSize: "0.84rem", color: MUTED, flex: 1, minWidth: 220 }}>
            {record.flat} unchanged, {record.worse} fell, {record.unmeasurable} too small to call. This is what
            happened after the work, not proof the work caused it.
          </Typography>
        </Box>
      )}

      {due.length > 0 && (
        <Section title={`Ready to check (${due.length})`} note={`Started more than ${WAIT_DAYS} days ago. The reading comes from the ${windowDays}-day window above.`}>
          {due.map((a) => {
            const reading = readingFor(a);
            return (
              <Row key={a.id} action={a}>
                {reading ? (
                  <Button size="small" variant="contained" disabled={busy}
                    onClick={() => post({ kind: "measure", id: a.id, ...reading })}
                    sx={{ textTransform: "none", borderRadius: "10px" }}>
                    Check it now
                  </Button>
                ) : (
                  <Typography sx={{ fontSize: "0.78rem", color: FAINT, maxWidth: 260, textAlign: "right" }}>
                    Search Console returned no row for this in the current window — it may have fallen out of
                    the top results entirely.
                  </Typography>
                )}
                <Button size="small" disabled={busy} onClick={() => setDrop({ action: a, reason: "" })}
                  sx={{ textTransform: "none", color: MUTED }}>Drop</Button>
              </Row>
            );
          })}
        </Section>
      )}

      {waiting.length > 0 && (
        <Section title={`Still settling (${waiting.length})`} note="Started too recently to judge.">
          {waiting.map((a) => (
            <Row key={a.id} action={a}>
              <Typography sx={{ fontSize: "0.8rem", color: FAINT, whiteSpace: "nowrap" }}>
                {WAIT_DAYS - daysSince(a.startedAt)} days to go
              </Typography>
              <Button size="small" disabled={busy} onClick={() => setDrop({ action: a, reason: "" })}
                sx={{ textTransform: "none", color: MUTED }}>Drop</Button>
            </Row>
          ))}
        </Section>
      )}

      {graded.length > 0 && (
        <Section title={`Finished (${graded.length})`} note="What the numbers did afterwards.">
          {graded.map((a) => <Row key={a.id} action={a} />)}
        </Section>
      )}

      <Dialog open={!!drop} onClose={() => { if (!busy) setDrop(null); }} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: "1.05rem", fontWeight: 600 }}>Drop this one?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: "0.86rem", color: MUTED, mb: 2, lineHeight: 1.55 }}>
            The reason is kept. Without it the same idea comes back next quarter and somebody spends an
            afternoon deciding against it again.
          </Typography>
          <TextField size="small" fullWidth autoFocus label="Why it is not being done"
            value={drop?.reason ?? ""}
            onChange={(e) => setDrop((cur) => (cur ? { ...cur, reason: e.target.value } : cur))} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDrop(null)} sx={{ textTransform: "none", color: MUTED }}>Cancel</Button>
          <Button variant="contained" disabled={busy || (drop?.reason.trim().length ?? 0) < 3}
            onClick={async () => {
              if (!drop) return;
              if (await post({ kind: "drop", id: drop.action.id, reason: drop.reason.trim() })) setDrop(null);
            }}
            sx={{ textTransform: "none" }}>Drop it</Button>
        </DialogActions>
      </Dialog>
    </SubAppFrame>
  );
}

function Section({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, color: INK }}>{title}</Typography>
      <Typography sx={{ fontSize: "0.82rem", color: MUTED, mb: 1.25 }}>{note}</Typography>
      <Box sx={{ display: "grid", gap: 1 }}>{children}</Box>
    </Box>
  );
}

function Row({ action, children }: { action: SeoAction; children?: React.ReactNode }) {
  const v = verdictOf(action);
  const look = VERDICT[v];
  const { deltaClicks, deltaPct } = outcomeOf(action);
  return (
    <Box sx={{
      display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap",
      p: 1.6, borderRadius: "14px", border: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.55)",
    }}>
      <Chip size="small" icon={look.icon as React.ReactElement} label={look.label}
        sx={{
          height: 24, fontSize: "0.72rem", fontWeight: 600, bgcolor: look.bg, color: look.fg, flexShrink: 0,
          "& .MuiChip-icon": { fontSize: 15, color: "inherit" },
        }} />
      <Box sx={{ minWidth: 0, flex: "1 1 280px" }}>
        <Typography sx={{
          fontSize: "0.88rem", fontWeight: 600, color: INK,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }} title={action.subject}>{action.subject}</Typography>
        <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
          {action.startedBy} started this on {when(action.startedAt)}
          {action.eurosEstimated !== null && ` · estimated ${eur(action.eurosEstimated)} a year`}
          {action.droppedReason && ` · ${action.droppedReason}`}
        </Typography>
      </Box>
      {action.measuredAt && (
        <Box sx={{ textAlign: "right", flexShrink: 0 }}>
          <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK, fontVariantNumeric: "tabular-nums" }}>
            {action.baselineClicks ?? "—"} → {action.afterClicks ?? "—"} clicks
          </Typography>
          <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
            {deltaClicks === null ? "no comparison" :
              `${deltaClicks >= 0 ? "+" : ""}${deltaClicks}${deltaPct === null ? "" : ` (${Math.round(deltaPct * 100)}%)`}`}
          </Typography>
        </Box>
      )}
      {children}
    </Box>
  );
}
