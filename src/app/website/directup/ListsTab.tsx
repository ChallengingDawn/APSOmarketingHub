"use client";

// DirectUP > Order lists: the lists customers made, newest first, paged; one click opens its lines with what
// became of each - found, to check, not found, in the cart - and how it was found, in words.

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import RefreshIcon from "@mui/icons-material/Refresh";
import ListAltOutlinedIcon from "@mui/icons-material/ListAltOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { AMBER, CardTitle, FAINT, GREEN, GlassCard, MUTED, RED, bodyCell, clip, headCell, type Tint } from "@/app/uc/report/ui";
import { Chip, Choice, usePaged } from "@/app/connectors/parts";
import type { JobDetail, JobLine, JobSummary } from "@/lib/directup/gateway";
import { when } from "./shared";

type Filter = "all" | "carted" | "open" | "check";

const STATUS: Record<string, { label: string; tint: Tint }> = {
  added: { label: "In the cart", tint: "blue" },
  failed: { label: "Refused by the shop", tint: "pink" },
  matched: { label: "Found", tint: "green" },
  review: { label: "To check", tint: "amber" },
  unmatched: { label: "Not found", tint: "pink" },
  skipped: { label: "Not an article line", tint: "slate" },
};
const VIA: Record<string, string> = {
  exact: "By its number", crossref: "Through a cross-reference", text: "From the description",
  dimensions: "From the dimensions", manual: "Chosen by the customer",
};
const REASON: Record<string, string> = {
  text_clear: "found from the description - to check", text_tie: "several articles fit equally well",
  weak: "nothing close enough", crossref: "through a cross-reference - to confirm", crossref_multi: "several equivalents for this reference",
  multi_exact: "several articles carry this number", none: "not found",
};

const source = (j: { filename: string | null; method: string | null }) =>
  j.filename === "eingabe.csv" || !j.filename ? "Typed in" : j.filename;
const lineState = (l: JobLine) => STATUS[l.state === "added" || l.state === "failed" ? l.state : l.status] ?? { label: l.status, tint: "slate" as Tint };
const num = { ...bodyCell, fontSize: "0.84rem", fontVariantNumeric: "tabular-nums" as const };

function Detail({ id, onClose }: { id: string; onClose: () => void }) {
  const held = useHeld<JobDetail>(`/api/website/directup?part=job&id=${id}`, [id]);
  const d = held.result;
  const lines = d?.state === "ok" ? d.data.lines : [];
  const { slice, pager } = usePaged(lines, 20);
  if (d === null) return <GlassCard><CircularProgress size={16} /></GlassCard>;
  if (d.state !== "ok") return <GlassCard><Typography sx={{ fontSize: "0.84rem", color: RED }}>{d.state === "error" ? d.error : "not configured"}</Typography></GlassCard>;
  const j = d.data;
  return (
    <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
      <Box sx={{ px: { xs: 2, md: 2.75 } }}>
        <CardTitle icon={<FactCheckOutlinedIcon />} tint="purple" title={`${source(j)} · ${full(j.lines.length)} lines`}
          note={`${when(j.createdAt)} on ${j.locale || "an unknown store view"}${j.method === "vision" ? " · read by Claude from a PDF or photo" : ""} · ${full(j.counts.added)} in the cart`}
          right={<Box component="button" type="button" onClick={onClose} sx={{ all: "unset", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600, color: MUTED, "&:hover": { color: "#2459d1" } }}>Close</Box>} />
      </Box>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 960 }}>
          <TableHead>
            <TableRow>{["#", "As the customer wrote it", "Qty", "What became of it", "Our article", "How it was found", "Other suggestions"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow>
          </TableHead>
          <TableBody>
            {slice.map((l) => {
              const s = lineState(l);
              const how = l.status === "review" || l.status === "unmatched" ? REASON[l.reason ?? ""] ?? l.reason ?? "" : "";
              return (
                <TableRow key={l.idx} hover>
                  <TableCell sx={{ ...num, color: FAINT }}>{l.idx + 1}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", maxWidth: 300 }}>{[l.ref, l.description].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(" · ") || "–"}</TableCell>
                  <TableCell sx={num}>{full(l.qty)}{l.unit ? ` ${l.unit}` : ""}</TableCell>
                  <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}><Chip tint={s.tint}>{s.label}</Chip></TableCell>
                  <TableCell sx={num}>{l.chosen || "–"}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED }}>
                    {l.chosen ? VIA[l.via ?? ""] ?? l.via ?? "–" : "–"}{how ? <Box component="span" sx={{ display: "block", color: AMBER }}>{how}</Box> : null}
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.78rem", color: MUTED, maxWidth: 340 }}>
                    {l.candidates.filter((c) => c.articleNumber !== l.chosen).slice(0, 3).map((c) => (
                      <Box key={c.articleNumber} sx={{ ...clip(340) }} title={`${c.articleNumber} ${c.description}`}>{c.articleNumber} <span style={{ color: FAINT }}>{c.description}</span></Box>
                    ))}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>
      <Box sx={{ px: { xs: 2, md: 2.75 }, pb: pager ? 1 : 2 }}>{pager}</Box>
    </GlassCard>
  );
}

export default function ListsTab({ total }: { total: number }) {
  const [n, setN] = useState(0);
  const held = useHeld<{ jobs: JobSummary[] }>(`/api/website/directup?part=jobs&n=${n}`, [n]);
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);
  const r = held.result;
  const jobs = useMemo(() => (r?.state === "ok" ? r.data.jobs : []), [r]);
  const pick = (f: Filter) => (j: JobSummary) =>
    f === "all" ? true : f === "carted" ? j.counts.added > 0 : f === "open" ? j.counts.added === 0 : j.counts.review > 0 || j.counts.unmatched > 0;
  const shown = useMemo(() => jobs.filter(pick(filter)), [jobs, filter]);
  const { slice, pager, setPage } = usePaged(shown, 15);
  useEffect(() => { setPage(0); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  if (r === null) return <LoadingPanel label="Reading the order lists…" />;
  if (r.state !== "ok") return <UpstreamPanel source="DirectUp Gateway" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? r.status : null} onRetry={() => setN((x) => x + 1)} />;

  return (
    <>
      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 } }}>
          <CardTitle icon={<ListAltOutlinedIcon />} tint="blue" title={`The latest ${full(jobs.length)} order lists`}
            note={`Of ${full(total)} kept, newest first. Click one to see its lines.`}
            right={
              <Tooltip title="Read again">
                <IconButton size="small" onClick={() => setN((x) => x + 1)} aria-label="Read the order lists again">
                  {held.stale ? <CircularProgress size={14} sx={{ color: MUTED }} /> : <RefreshIcon sx={{ fontSize: 18, color: MUTED }} />}
                </IconButton>
              </Tooltip>
            } />
          <Box sx={{ mb: 1.5 }}>
            <Choice value={filter} onChange={setFilter} options={[
              { key: "all", label: "All", count: jobs.length },
              { key: "carted", label: "Sent to the cart", count: jobs.filter(pick("carted")).length },
              { key: "open", label: "Not sent yet", count: jobs.filter(pick("open")).length },
              { key: "check", label: "With lines to check", count: jobs.filter(pick("check")).length },
            ]} />
          </Box>
        </Box>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 820 }}>
            <TableHead>
              <TableRow>{["Made", "Store view", "From", "Lines", "Found", "To check", "Not found", "In the cart"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow>
            </TableHead>
            <TableBody>
              {slice.length === 0 && <TableRow><TableCell colSpan={8} sx={{ ...bodyCell, fontSize: "0.84rem", color: MUTED }}>No order lists here.</TableCell></TableRow>}
              {slice.map((j) => (
                <TableRow key={j.id} hover selected={open === j.id} onClick={() => setOpen(open === j.id ? null : j.id)} sx={{ cursor: "pointer" }}>
                  <TableCell sx={{ ...num, whiteSpace: "nowrap" }}>{when(j.createdAt)}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.84rem" }}>{j.locale || "–"}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", ...clip(280) }} title={source(j)}>
                    {source(j)}{j.method === "vision" && <Box component="span" sx={{ ml: 0.75 }}><Chip tint="purple">read by Claude</Chip></Box>}
                  </TableCell>
                  <TableCell sx={num}>{full(j.counts.total)}</TableCell>
                  <TableCell sx={{ ...num, color: GREEN }}>{full(j.counts.matched)}</TableCell>
                  <TableCell sx={{ ...num, color: j.counts.review ? AMBER : FAINT }}>{full(j.counts.review)}</TableCell>
                  <TableCell sx={{ ...num, color: j.counts.unmatched ? RED : FAINT }}>{full(j.counts.unmatched)}</TableCell>
                  <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}>
                    {j.counts.added ? <Chip tint="blue">{full(j.counts.added)} lines</Chip> : <Typography component="span" sx={{ fontSize: "0.8rem", color: FAINT }}>not yet</Typography>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
        <Box sx={{ px: { xs: 2, md: 2.75 }, pb: pager ? 1 : 2 }}>{pager}</Box>
      </GlassCard>
      {open && <Detail key={open} id={open} onClose={() => setOpen(null)} />}
    </>
  );
}
