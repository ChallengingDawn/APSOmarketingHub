"use client";

// THE CUT KANBAN — one board instead of an "Open work" tab and a "Cut done" tab.
//
// SARCLA, 17.10.2026: "Open work and cut done should be only one TAB Cut Kanban and where we should see
// the dates."
//
// The columns are what the WORKSHOP HAS TO DO, not where the line sits in the ledger. That distinction was
// settled on the dashboard board on 15.10, the hard way: columns-by-stage was tried and called "even more
// confusing", because a man at the saw does not care whether a line is `ordered` or `to-cut` — he cares
// whether it needs the saw at all. So: three columns of work to do, a fourth for what is finished, and the
// stage as a pill on the card for anyone who does want it.
//
// THE DATE IS THE POINT OF A BOARD. Every card leads with the day the customer was promised, and a card
// whose day has passed while it is still waiting says so in red. Without that the board tells you what
// there is to do but not what is late, which is the only question worth asking of a queue.

import { useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import ContentCutOutlinedIcon from "@mui/icons-material/ContentCutOutlined";
import { CardTitle, FAINT, GREEN, GlassCard, HAIRLINE, INK, MUTED, RED, clip } from "@/app/uc/report/ui";
import { full } from "@/app/charts/format";
import { OrderRef, Pill, STAGE_LABEL, WORK_LABEL, WORK_TONE, day, when, workOf, type Line, type Work } from "./shared";

type ColKey = Work | "done";

const COLS: { key: ColKey; label: string; note: string }[] = [
  { key: "saw", label: WORK_LABEL.saw, note: "a piece has to be cut from a plate" },
  { key: "pick", label: WORK_LABEL.pick, note: "a whole piece off the shelf, no cutting" },
  { key: "unknown", label: WORK_LABEL.unknown, note: "no basis article or no size — the plate ledger has no opinion" },
  { key: "done", label: "Cut done", note: "finished, newest first" },
];

const TONE: Record<ColKey, { bg: string; fg: string }> = {
  ...WORK_TONE,
  done: { bg: "#e9f4ed", fg: "#1e7e45" },
};

const STAGE_TONE: Record<string, { bg: string; fg: string }> = {
  reserved: { bg: "#eef2fb", fg: "#2459d1" },
  ordered: { bg: "#f4f1e8", fg: "#8a6d1f" },
  "to-cut": { bg: "#e8f0f6", fg: "#274e64" },
  "cut-done": { bg: "#e9f4ed", fg: "#1e7e45" },
  closed: { bg: "#f2f2f4", fg: "#5d6b85" },
  lapsed: { bg: "#f2f2f4", fg: "#5d6b85" },
};

const today = () => new Date().toISOString().slice(0, 10);

function Card({ l, done }: { l: Line; done: boolean }) {
  const d = l.date ? String(l.date).slice(0, 10) : null;
  // late only means something for work still waiting — a finished line's date is history
  const late = !done && !!d && d < today();
  const st = STAGE_TONE[l.stage] ?? STAGE_TONE.closed;

  return (
    <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: 2, bgcolor: "#fff", p: 1.25, mb: 1,
      ...(late ? { borderLeft: `3px solid ${RED}` } : {}) }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "baseline" }}>
        <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: late ? RED : INK, whiteSpace: "nowrap" }}>
          {d ? day(d) : "no date"}
        </Typography>
        <Pill text={STAGE_LABEL[l.stage] ?? l.stage} bg={st.bg} fg={st.fg}
          title={l.at ? `since ${when(l.at)}` : undefined} />
      </Box>

      <Typography sx={{ fontSize: "0.84rem", color: INK, mt: 0.5, fontVariantNumeric: "tabular-nums" }}>
        {l.qty > 0 ? `${full(l.qty)} × ` : ""}{l.l > 0 && l.w > 0 ? `${l.l} × ${l.w} mm` : "no size"}
      </Typography>
      {l.produced > 0 && (
        <Typography sx={{ fontSize: "0.72rem", color: MUTED }} title="Pieces stock can serve, and pieces that have to be produced">
          {l.held} from stock · {l.produced} to make
        </Typography>
      )}

      <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 0.5, ...clip(240) }} title={l.name || undefined}>
        {l.basis ? `${l.basis}${l.name ? ` · ${l.name}` : ""}` : "not a woodStore article"}
      </Typography>

      <Box sx={{ display: "flex", gap: 1, alignItems: "baseline", mt: 0.5, flexWrap: "wrap" }}>
        <OrderRef l={l} />
        {l.customer && (
          <Typography sx={{ fontSize: "0.74rem", color: FAINT, ...clip(170) }} title={l.customer}>{l.customer}</Typography>
        )}
      </Box>
    </Box>
  );
}

export default function KanbanTab({ open, done, doneTotal }: { open: Line[]; done: Line[]; doneTotal: number }) {
  const cols = useMemo(() => {
    const by: Record<ColKey, Line[]> = { saw: [], pick: [], unknown: [], done };
    for (const l of open) by[workOf(l)].push(l);
    // the promised day drives the queue: oldest promise first, undated last
    for (const k of ["saw", "pick", "unknown"] as Work[]) {
      by[k].sort((a, b) => String(a.date ?? "9999").localeCompare(String(b.date ?? "9999")));
    }
    return by;
  }, [open, done]);

  const late = useMemo(() => {
    const t = today();
    return open.filter((l) => l.date && String(l.date).slice(0, 10) < t).length;
  }, [open]);

  return (
    <GlassCard>
      <CardTitle
        icon={<ContentCutOutlinedIcon fontSize="small" />}
        tint={late ? "amber" : "blue"}
        title="Cut Kanban"
        note={`${full(open.length)} line(s) still to do · ${full(doneTotal)} finished` +
          (late ? ` · ${full(late)} past the day the customer was promised` : "")}
      />

      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0,1fr))", lg: "repeat(4, minmax(0,1fr))" } }}>
        {COLS.map((c) => {
          const rows = cols[c.key];
          const t = TONE[c.key];
          return (
            <Box key={c.key} sx={{ minWidth: 0 }}>
              <Tooltip title={c.note} placement="top">
                <Box sx={{ display: "flex", gap: 0.75, alignItems: "baseline", mb: 1 }}>
                  <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: t.fg }}>{c.label}</Typography>
                  <Typography sx={{ fontSize: "0.78rem", color: FAINT, fontVariantNumeric: "tabular-nums" }}>
                    {c.key === "done" ? full(doneTotal) : full(rows.length)}
                  </Typography>
                </Box>
              </Tooltip>

              {/* clamped, not unbounded: the dashboard's table broke on a full screen when a column was
                  allowed to grow with its content (15.10) */}
              <Box sx={{ bgcolor: t.bg, borderRadius: 2, p: 1, maxHeight: "clamp(320px, calc(100vh - 340px), 1400px)", overflowY: "auto" }}>
                {rows.length === 0
                  ? <Typography sx={{ fontSize: "0.8rem", color: MUTED, p: 0.5 }}>Nothing here.</Typography>
                  : rows.map((l) => <Card key={`${c.key}-${l.key}`} l={l} done={c.key === "done"} />)}
                {c.key === "done" && doneTotal > done.length && (
                  <Typography sx={{ fontSize: "0.74rem", color: FAINT, p: 0.5 }}>
                    the {done.length} most recent of {full(doneTotal)} — the rest stay on the gateway
                  </Typography>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>

      <Typography sx={{ fontSize: "0.76rem", color: FAINT, mt: 2 }}>
        Each card leads with the day the customer was promised; a red edge means that day has passed and the
        line is still waiting. The columns are what the workshop has to do with a line — the pill says where
        it sits in the ledger. <Box component="span" sx={{ color: GREEN }}>Cut done</Box> is finished work.
      </Typography>
    </GlassCard>
  );
}
