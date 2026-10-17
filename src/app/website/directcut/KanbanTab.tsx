"use client";

// THE CUT KANBAN. One board, not an "Open work" tab and a "Cut done" tab.
//
// Columns are what the WORKSHOP HAS TO DO, not where the line sits in the ledger — settled on the dashboard
// board on 15.10, where columns-by-stage was tried and called "even more confusing". The ledger stage rides
// on the card as a pill. Every card leads with the day the customer was promised, and a day that has passed
// while the line still waits is red.
//
// 17.10: cards open a detail panel on click, and the board can be searched by article, order, A-number or
// customer.

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import ContentCutOutlinedIcon from "@mui/icons-material/ContentCutOutlined";
import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, MUTED, RED, clip } from "@/app/uc/report/ui";
import { full } from "@/app/charts/format";
import { Pill, STAGE_LABEL, WORK_LABEL, WORK_TONE, day, when, workOf, type Line, type Work } from "./shared";

type ColKey = Work | "done";

const COLS: { key: ColKey; label: string; note: string }[] = [
  { key: "saw", label: WORK_LABEL.saw, note: "a piece has to be cut from a plate" },
  { key: "pick", label: WORK_LABEL.pick, note: "a whole piece off the shelf, no cutting" },
  { key: "unknown", label: WORK_LABEL.unknown, note: "ordered by number only — our ledger never minted this cut article, so its basis and size are unknown" },
  { key: "done", label: "Cut done", note: "finished, newest first" },
];

const TONE: Record<ColKey, { bg: string; fg: string }> = { ...WORK_TONE, done: { bg: "#e9f4ed", fg: "#1e7e45" } };

const STAGE_TONE: Record<string, { bg: string; fg: string }> = {
  reserved: { bg: "#eef2fb", fg: "#2459d1" },
  ordered: { bg: "#f4f1e8", fg: "#8a6d1f" },
  "to-cut": { bg: "#e8f0f6", fg: "#274e64" },
  "cut-done": { bg: "#e9f4ed", fg: "#1e7e45" },
  closed: { bg: "#f2f2f4", fg: "#5d6b85" },
  lapsed: { bg: "#f2f2f4", fg: "#5d6b85" },
};

const today = () => new Date().toISOString().slice(0, 10);
const isLate = (l: Line, done: boolean) => !done && !!l.date && String(l.date).slice(0, 10) < today();

function Row({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "150px minmax(0,1fr)", gap: 1.5, py: 0.7, borderBottom: `1px solid ${HAIRLINE}` }}>
      <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{label}</Typography>
      <Typography sx={{ fontSize: "0.84rem", color: tone ?? INK, wordBreak: "break-word" }}>{value}</Typography>
    </Box>
  );
}

/** Everything the ledger holds about one line. */
function Detail({ l, onClose }: { l: Line | null; onClose: () => void }) {
  const open = !!l;
  const done = l?.stage === "cut-done" || l?.stage === "closed";
  const work = l ? workOf(l) : "unknown";
  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: "min(92vw, 560px)", p: 3 } }}>
      {l && (
        <>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
            <Box>
              <Typography sx={{ fontSize: "1.05rem", fontWeight: 600, color: INK }}>
                {l.l > 0 && l.w > 0 ? `${full(l.qty)} × ${l.l} × ${l.w} mm` : "ordered by number only"}
              </Typography>
              <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{l.basis ? `${l.basis} · ${l.name}` : l.cutArticle || l.key}</Typography>
            </Box>
            <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
          </Box>

          <Box sx={{ display: "flex", gap: 0.75, mb: 2, flexWrap: "wrap" }}>
            <Pill text={WORK_LABEL[work]} bg={WORK_TONE[work].bg} fg={WORK_TONE[work].fg} />
            <Pill text={STAGE_LABEL[l.stage] ?? l.stage} bg={(STAGE_TONE[l.stage] ?? STAGE_TONE.closed).bg} fg={(STAGE_TONE[l.stage] ?? STAGE_TONE.closed).fg} />
            {isLate(l, done) && <Pill text="past its promised day" bg="#fdeaea" fg="#c5221f" />}
          </Box>

          <Row label="Promised for" value={l.date ? day(l.date) : "no date"} tone={isLate(l, done) ? RED : undefined} />
          <Row label="Pieces" value={l.produced > 0 ? `${full(l.qty)} — ${l.held} from stock, ${l.produced} to make` : full(l.qty)} />
          <Row label="Basis article" value={l.basis || "not recorded"} />
          <Row label="Cut article" value={l.cutArticle || l.key} />
          <Row label="A-number" value={l.erpNo || (l.orderNo ? "not reconciled yet" : "—")} />
          <Row label="Shop order" value={l.orderNo || "—"} />
          <Row label="Customer" value={l.customer || "—"} />
          <Row label="In this stage since" value={l.at ? when(l.at, true) : "—"} />
          <Row label="Booked by" value={l.fromShop ? "the widget" : "the ERP / order feed"} />

          {work === "unknown" && (
            <Typography sx={{ fontSize: "0.82rem", color: MUTED, mt: 2, lineHeight: 1.7 }}>
              This line came in on a real order carrying only a cut-article number. Our registry never minted
              that number — the piece was configured before this ledger existed, or ordered outside the
              widget — so nobody ever told us its basis article, its size or its quantity. The plate ledger
              has no opinion about it rather than a guessed one.
            </Typography>
          )}
        </>
      )}
    </Drawer>
  );
}

export default function KanbanTab({ open, done, doneTotal }: { open: Line[]; done: Line[]; doneTotal: number }) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Line | null>(null);

  const match = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return null;
    return (l: Line) => [l.basis, l.name, l.cutArticle, l.key, l.orderNo, l.erpNo, l.customer]
      .some((v) => v && String(v).toLowerCase().includes(t));
  }, [q]);

  const cols = useMemo(() => {
    const o = match ? open.filter(match) : open;
    const d = match ? done.filter(match) : done;
    const by: Record<ColKey, Line[]> = { saw: [], pick: [], unknown: [], done: d };
    for (const l of o) by[workOf(l)].push(l);
    // the promised day drives the queue: oldest promise first, undated last
    for (const k of ["saw", "pick", "unknown"] as Work[]) {
      by[k].sort((a, b) => String(a.date ?? "9999").localeCompare(String(b.date ?? "9999")));
    }
    return by;
  }, [open, done, match]);

  const shownOpen = cols.saw.length + cols.pick.length + cols.unknown.length;
  const late = useMemo(() => {
    const t = today();
    return (match ? open.filter(match) : open).filter((l) => l.date && String(l.date).slice(0, 10) < t).length;
  }, [open, match]);

  return (
    <GlassCard>
      <CardTitle
        icon={<ContentCutOutlinedIcon fontSize="small" />}
        tint={late ? "amber" : "blue"}
        title="Cut Kanban"
        note={`${full(shownOpen)} line(s) still to do · ${full(doneTotal)} finished` +
          (late ? ` · ${full(late)} past the promised day` : "")}
        right={
          <TextField
            size="small" value={q} onChange={(e) => setQ(e.target.value)} placeholder="article, order, A-number, customer"
            sx={{ minWidth: 280 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" sx={{ color: FAINT }} /></InputAdornment> }}
          />
        }
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
                    {c.key === "done" && !match ? full(doneTotal) : full(rows.length)}
                  </Typography>
                </Box>
              </Tooltip>

              {/* clamped, not grown with its content — the dashboard's table broke on a full screen */}
              <Box sx={{ bgcolor: t.bg, borderRadius: 2, p: 1, maxHeight: "clamp(320px, calc(100vh - 340px), 1400px)", overflowY: "auto" }}>
                {rows.length === 0
                  ? <Typography sx={{ fontSize: "0.8rem", color: MUTED, p: 0.5 }}>{match ? "No match." : "Nothing here."}</Typography>
                  : rows.map((l) => {
                      const d = l.date ? String(l.date).slice(0, 10) : null;
                      const late1 = isLate(l, c.key === "done");
                      const st = STAGE_TONE[l.stage] ?? STAGE_TONE.closed;
                      return (
                        <Box key={`${c.key}-${l.key}`} onClick={() => setPicked(l)} role="button" tabIndex={0}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setPicked(l); }}
                          sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: 2, bgcolor: "#fff", p: 1.25, mb: 1, cursor: "pointer",
                            ...(late1 ? { borderLeft: `3px solid ${RED}` } : {}),
                            "&:hover": { borderColor: "#2459d1" },
                            "&:focus-visible": { outline: "2px solid #2459d1", outlineOffset: 2 } }}>
                          <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "baseline" }}>
                            <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: late1 ? RED : INK, whiteSpace: "nowrap" }}>
                              {d ? day(d) : "no date"}
                            </Typography>
                            <Pill text={STAGE_LABEL[l.stage] ?? l.stage} bg={st.bg} fg={st.fg} />
                          </Box>
                          <Typography sx={{ fontSize: "0.84rem", color: INK, mt: 0.5, fontVariantNumeric: "tabular-nums" }}>
                            {l.qty > 0 ? `${full(l.qty)} × ` : ""}{l.l > 0 && l.w > 0 ? `${l.l} × ${l.w} mm` : "by number only"}
                          </Typography>
                          {l.produced > 0 && (
                            <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{l.held} from stock · {l.produced} to make</Typography>
                          )}
                          <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 0.5, ...clip(240) }} title={l.name || undefined}>
                            {l.basis ? `${l.basis}${l.name ? ` · ${l.name}` : ""}` : l.cutArticle || l.key}
                          </Typography>
                          <Typography sx={{ fontSize: "0.76rem", color: FAINT, mt: 0.25, ...clip(240) }}>
                            {l.erpNo || l.orderNo || "—"}{l.customer ? ` · ${l.customer}` : ""}
                          </Typography>
                        </Box>
                      );
                    })}
                {c.key === "done" && !match && doneTotal > done.length && (
                  <Typography sx={{ fontSize: "0.74rem", color: FAINT, p: 0.5 }}>
                    the {done.length} most recent of {full(doneTotal)}
                  </Typography>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>

      <Detail l={picked} onClose={() => setPicked(null)} />
    </GlassCard>
  );
}
