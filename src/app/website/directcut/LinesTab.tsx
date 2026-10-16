"use client";

// DirectCut: the cut lines themselves — the open work, and what has been cut.
//
// SARCLA, 15.10.2026 on the dashboard's board: "we need to know exactly what is to cut and what it can
// handle", and "we need another column for what has been cutted already". So the open tab leads with the
// workshop's question — saw or pick — and the quantity column shows the split the ledger actually holds:
// how many pieces stock can serve, and how many have to be produced. Those are different numbers and the
// board used to show only the total.

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import ContentCutOutlinedIcon from "@mui/icons-material/ContentCutOutlined";
import DoneAllOutlinedIcon from "@mui/icons-material/DoneAllOutlined";
import { Choice, usePaged } from "@/app/connectors/parts";
import { CardTitle, FAINT, GlassCard, INK, MUTED, bodyCell, headCell, clip } from "@/app/uc/report/ui";
import { OrderRef, Pill, STAGE_LABEL, Size, WORK_LABEL, WORK_TONE, day, when, workOf, type Line, type Work } from "./shared";

type Filter = "all" | Work;

const STAGE_TONE: Record<string, { bg: string; fg: string }> = {
  reserved: { bg: "#eef2fb", fg: "#2459d1" },
  ordered: { bg: "#f4f1e8", fg: "#8a6d1f" },
  "to-cut": { bg: "#e8f0f6", fg: "#274e64" },
  "cut-done": { bg: "#e9f4ed", fg: "#1e7e45" },
  lapsed: { bg: "#f2f2f4", fg: "#5d6b85" },
  closed: { bg: "#f2f2f4", fg: "#5d6b85" },
};

function Rows({ lines, showStage }: { lines: Line[]; showStage: boolean }) {
  const { slice, pager } = usePaged(lines, 25);
  if (!lines.length) return <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Nothing here.</Typography>;
  return (
    <>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 860 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={headCell}>Article</TableCell>
              <TableCell sx={headCell}>Size</TableCell>
              <TableCell sx={headCell}>What it needs</TableCell>
              <TableCell sx={{ ...headCell, textAlign: "right" }}>Pieces</TableCell>
              <TableCell sx={headCell}>Order</TableCell>
              <TableCell sx={headCell}>Customer</TableCell>
              <TableCell sx={headCell}>Promised</TableCell>
              {showStage && <TableCell sx={headCell}>Where</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {slice.map((l) => {
              const w = workOf(l);
              const t = WORK_TONE[w];
              return (
                <TableRow key={l.key} hover>
                  <TableCell sx={bodyCell}>
                    <Typography sx={{ fontSize: "0.84rem", color: INK, fontWeight: 600 }}>{l.basis ?? "–"}</Typography>
                    <Typography sx={{ fontSize: "0.74rem", color: MUTED, ...clip(260) }} title={l.name}>{l.name || "not a woodStore article"}</Typography>
                  </TableCell>
                  <TableCell sx={bodyCell}><Size l={l.l} w={l.w} /></TableCell>
                  <TableCell sx={bodyCell}><Pill text={WORK_LABEL[w]} bg={t.bg} fg={t.fg} /></TableCell>
                  <TableCell sx={{ ...bodyCell, textAlign: "right" }}>
                    <Typography sx={{ fontSize: "0.84rem", color: INK, fontVariantNumeric: "tabular-nums" }}>{l.qty}</Typography>
                    {/* the split the ledger holds: served from stock, and to be produced */}
                    {l.produced > 0 && (
                      <Typography sx={{ fontSize: "0.72rem", color: MUTED, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}
                        title="Pieces stock could not serve — these have to be produced">
                        {l.held} from stock · {l.produced} to make
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={bodyCell}><OrderRef l={l} /></TableCell>
                  <TableCell sx={bodyCell}>
                    <Typography sx={{ fontSize: "0.8rem", color: MUTED, ...clip(190) }} title={l.customer ?? ""}>{l.customer || "–"}</Typography>
                  </TableCell>
                  <TableCell sx={bodyCell}>
                    <Typography sx={{ fontSize: "0.82rem", color: INK, whiteSpace: "nowrap" }}>{day(l.date)}</Typography>
                  </TableCell>
                  {showStage && (
                    <TableCell sx={bodyCell}>
                      <Pill text={STAGE_LABEL[l.stage] ?? l.stage} bg={(STAGE_TONE[l.stage] ?? STAGE_TONE.closed).bg} fg={(STAGE_TONE[l.stage] ?? STAGE_TONE.closed).fg}
                        title={l.at ? `since ${when(l.at)}` : undefined} />
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>
      {pager}
    </>
  );
}

export function OpenTab({ open }: { open: Line[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const counted = useMemo(() => {
    const n: Record<Work, number> = { saw: 0, pick: 0, unknown: 0 };
    for (const l of open) n[workOf(l)]++;
    return n;
  }, [open]);
  const shown = useMemo(() => (filter === "all" ? open : open.filter((l) => workOf(l) === filter)), [open, filter]);

  return (
    <GlassCard>
      <CardTitle
        icon={<ContentCutOutlinedIcon fontSize="small" />}
        tint="blue"
        title="Open work"
        note={`${open.length} line(s) the workshop still has in front of it — in a cart, ordered, or waiting at the saw`}
      />
      <Box sx={{ mt: 1.5, mb: 2 }}>
        <Choice<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { key: "all", label: "All", count: open.length },
            { key: "saw", label: WORK_LABEL.saw, count: counted.saw },
            { key: "pick", label: WORK_LABEL.pick, count: counted.pick },
            { key: "unknown", label: WORK_LABEL.unknown, count: counted.unknown },
          ]}
        />
      </Box>
      {counted.unknown > 0 && filter !== "unknown" && (
        <Typography sx={{ fontSize: "0.78rem", color: FAINT, mb: 1.5 }}>
          {counted.unknown} line(s) say &ldquo;{WORK_LABEL.unknown}&rdquo;: they carry no basis article or no size, so the
          plate ledger has no opinion about them and does not invent one.
        </Typography>
      )}
      <Rows lines={shown} showStage />
    </GlassCard>
  );
}

export function DoneTab({ done, total }: { done: Line[]; total: number }) {
  return (
    <GlassCard>
      <CardTitle
        icon={<DoneAllOutlinedIcon fontSize="small" />}
        tint="green"
        title="Cut done"
        note={total > done.length
          ? `The ${done.length} most recent of ${total} finished lines — newest first`
          : `${total} finished line(s)`}
      />
      <Box sx={{ mt: 2 }}>
        <Rows lines={done} showStage={false} />
      </Box>
      {total > done.length && (
        <Typography sx={{ fontSize: "0.78rem", color: FAINT, mt: 2 }}>
          Older lines are not fetched: the whole history is 531 KB of the gateway&rsquo;s 967 KB answer, and this page
          asks for a slim projection instead. The Railway dashboard still has the full board.
        </Typography>
      )}
    </GlassCard>
  );
}
