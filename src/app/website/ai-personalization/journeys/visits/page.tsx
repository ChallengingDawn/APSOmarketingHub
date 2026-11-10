"use client";

// APSOconvert > Journeys > VISITS (SARCLA 09.11.2026: "also next sub on journeys you should allow to see the visits per
// customer really as a play again their visits and based on all of this data you do recommendations").
//
//   the list       every customer seen on the shop in the period, the latest first - how far they got, the strip of their
//                  last visit, where they stopped most - filtered by how far, by store view, by name; the pages where
//                  most customers stopped; the AI's reading of the period (at a click, kept)
//   one customer   ?company=<HubSpot id> (&visit=<id>): their visits as a timeline, one played back step by step
//                  (./Player.tsx), where they stopped and what the other customers did there, and what to do next -
//                  for Sales and Marketing, and on the shop's pages (the AI at a click, kept; "Find optimizations"
//                  opens the page in Preview and asks for optimizations)
//
// Only ids in the address, never a name or an e-mail. The reads: src/lib/convert/visits.ts; the rules: visitRules.ts.

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Recorded } from "./Recorded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import LinearProgress from "@mui/material/LinearProgress";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import SlideshowOutlinedIcon from "@mui/icons-material/SlideshowOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import WrongLocationOutlinedIcon from "@mui/icons-material/WrongLocationOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { ACCENT, CardTitle, FAINT, GlassCard, HAIRLINE, INK, MUTED, Notice } from "@/app/uc/report/ui";
import { WindowPicker, useReportingWindow } from "@/app/window/ReportingWindow";
import { Chip } from "@/app/website/ai-personalization/Tag";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import { convertPost, previewHref } from "@/app/website/ai-personalization/Flow";
import {
  REACHES, REACH_LABEL, durWords, filterRows, reachAtLeast, stopWords, type CustomerRow, type Reach, type Stop, type Visit,
} from "@/lib/convert/visitRules";
import type { CustomerVisits, VisitorsList } from "@/lib/convert/visits";
import type { CustomerReading, PeriodReading } from "@/lib/convert/visitsAi";
import { Player } from "./Player";
import { Kick, KindTag, MiniStrip, ReachTag, SourceTags, VISITS, ddmmyyyy, hhmm, hsCompany, mono, strong, weekday, when } from "./parts";

type ListData = VisitorsList & { reading: PeriodReading | null; canAsk: boolean; ai: boolean };
type CustomerData = CustomerVisits & { reading: CustomerReading | null; canAsk: boolean; ai: boolean };

const btn = { borderRadius: "6px", textTransform: "none", fontWeight: 700 } as const;
const findHref = (path: string) => `${previewHref("prod", path)}&ask=1`;
const plural = (n: number, one: string, many = `${one}s`) => `${full(n)} ${n === 1 ? one : many}`;

/** The AI writes customers as their ids and people as letters (it never sees a name): the names put back, here only. */
function named(text: string, companies: Map<string, string>, people?: Map<string, string>): string {
  let t = text.replace(/\b(?:customer |company )?(\d{5,20})\b/gi, (m, id: string) => companies.get(id) ?? m);
  if (people) t = t.replace(/\b[Cc]ontacts? ([A-Z])\b/g, (m, l: string) => people.get(l) ?? m);
  return t;
}

/* ── asking the AI ────────────────────────────────────────────────────── */

function AskButton({ canAsk, ai, busy, again, onAsk, what }: { canAsk: boolean; ai: boolean; busy: boolean; again: boolean; onAsk: () => void; what: string }) {
  const why = !ai ? "No AI key on this hub" : !canAsk ? "Asking the AI needs the write access of Journeys" : "";
  return (
    <Tooltip title={why} disableHoverListener={!why}>
      <span>
        <Button size="small" variant={again ? "outlined" : "contained"} disableElevation disabled={!ai || !canAsk || busy} onClick={onAsk}
          startIcon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 16 }} />} sx={btn}>
          {busy ? "Reading…" : again ? "Ask again" : what}
        </Button>
      </span>
    </Tooltip>
  );
}

function AskedLine({ by, at, of }: { by: string | null; at: string; of: string }) {
  return <Typography sx={{ fontSize: "0.74rem", color: FAINT, mt: 1.5 }}>Asked by {by ?? "someone"} · {ddmmyyyy(at)} {hhmm(at)} · from {of} only</Typography>;
}

function Busy({ text }: { text: string }) {
  return (
    <Box sx={{ display: "grid", gap: 1, p: 1.5, borderRadius: "12px", bgcolor: "rgba(106,70,201,.05)", border: "1px solid rgba(106,70,201,.18)" }}>
      <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK }}>{text}</Typography>
      <LinearProgress sx={{ borderRadius: 2, height: 4, bgcolor: "rgba(106,70,201,.12)", "& .MuiLinearProgress-bar": { bgcolor: "#6a46c9" } }} />
    </Box>
  );
}

/* ── a page where customers stopped ───────────────────────────────────── */

function StopRow({ stop, note, ai }: { stop: Stop & { path: string | null }; note?: string | null; ai?: { why: string; try: string } | null }) {
  return (
    <Box sx={{ p: 1.25, borderRadius: "12px", border: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.85)", display: "grid", gap: 0.6, minWidth: 0 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", minWidth: 0 }}>
        <KindTag kind={stop.kind} />
        <Typography sx={{ ...strong, flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{stop.name}</Typography>
      </Box>
      {stop.path && <Typography sx={mono} title={stop.path}>{stop.path}</Typography>}
      <Typography sx={{ fontSize: "0.8rem", color: INK }}>{note ? `${note} · ` : ""}{stopWords(stop)}</Typography>
      {ai && (
        <Box sx={{ borderLeft: "3px solid #6a46c9", pl: 1.25, display: "grid", gap: 0.4 }}>
          <Typography sx={{ fontSize: "0.8rem", color: INK }}>{ai.why}</Typography>
          <Typography sx={{ fontSize: "0.8rem", color: INK }}><b>Try:</b> {ai.try}</Typography>
        </Box>
      )}
      {stop.path
        ? (
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 0.25 }}>
            <Button component={Link} href={findHref(stop.path)} size="small" variant="contained" disableElevation startIcon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 16 }} />} sx={btn}>Find optimizations</Button>
            <Button component={Link} href={previewHref("prod", stop.path)} size="small" variant="outlined" sx={{ ...btn, fontWeight: 600 }}>Open in Preview</Button>
          </Box>
        )
        : <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>Its page is not in the shop&apos;s page list - no preview</Typography>}
    </Box>
  );
}

/* ── the list ─────────────────────────────────────────────────────────── */

function RowLine({ r }: { r: CustomerRow }) {
  const names = r.contacts.map((c) => c.name);
  return (
    <Box component={Link} href={`${VISITS}?company=${r.id}`} sx={{
      display: "grid", alignItems: "center", gap: { xs: 0.75, md: 2 }, px: { xs: 1.25, md: 1.75 }, py: 1.25, textDecoration: "none", color: "inherit",
      gridTemplateColumns: { xs: "minmax(0,1fr) auto", md: "minmax(0,2.2fr) minmax(0,1.5fr) 150px 120px 24px" },
      borderTop: `1px solid ${HAIRLINE}`, position: "relative", minWidth: 0,
      "&:hover": { bgcolor: "rgba(36,89,209,.04)" }, "&:focus-visible": { outline: `2px solid ${ACCENT}`, outlineOffset: -2 },
    }}>
      <Box sx={{ minWidth: 0, display: "grid", gap: 0.35 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
          <Typography sx={{ ...strong, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name ?? `Company ${r.id}`}</Typography>
          {r.segment && <Chip tint="slate">{r.segment}</Chip>}
        </Box>
        {[r.number, r.country, r.store, r.owner].some(Boolean) && (
          <Typography sx={{ fontSize: "0.76rem", color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {[r.number && `#${r.number}`, r.country, r.store, r.owner].filter(Boolean).join(" · ")}
          </Typography>
        )}
        {r.stop && (
          <Typography sx={{ fontSize: "0.76rem", color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={`${r.stop.name}: ${r.stop.words}`}>
            <Box component="span" sx={{ color: FAINT }}>Stopped at </Box>{r.stop.name} <Box component="span" sx={{ color: MUTED }}>· {r.stop.words}</Box>
          </Typography>
        )}
      </Box>
      <Box sx={{ display: { xs: "grid", md: "none" }, justifyItems: "end", gap: 0.5 }}>
        <ReachTag reach={r.reach} />
        <Typography sx={{ fontSize: "0.72rem", color: MUTED, whiteSpace: "nowrap" }}>{when(r.lastAt)}</Typography>
      </Box>
      <Box sx={{ minWidth: 0, display: "grid", gap: 0.5, gridColumn: { xs: "1 / -1", md: "auto" } }}>
        <MiniStrip kinds={r.strip} />
        <Typography sx={{ fontSize: "0.76rem", color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {plural(r.visits, "visit")} · {plural(r.articles, "article")}{names.length ? ` · ${names.slice(0, 2).join(", ")}${names.length > 2 ? ` +${names.length - 2}` : ""}` : ""}
        </Typography>
      </Box>
      <Box sx={{ display: { xs: "none", md: "block" } }}><ReachTag reach={r.reach} /></Box>
      <Typography sx={{ display: { xs: "none", md: "block" }, fontSize: "0.78rem", color: MUTED, whiteSpace: "nowrap" }}>{when(r.lastAt)}</Typography>
      <ChevronRightRoundedIcon sx={{ display: { xs: "none", md: "block" }, color: FAINT }} />
    </Box>
  );
}

function PeriodCard({ d, from, to }: { d: ListData; from: string; to: string }) {
  const [reading, setReading] = useState<PeriodReading | null>(d.reading);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => setReading(d.reading), [d.reading]);
  const byId = useMemo(() => new Map(d.rows.map((r) => [r.id, r])), [d.rows]);
  const coNames = useMemo(() => new Map(d.rows.filter((r) => r.name).map((r) => [r.id, r.name!])), [d.rows]);
  const stopByPath = useMemo(() => new Map(d.stops.filter((s) => s.path).map((s) => [s.path!, s])), [d.stops]);
  const ask = async () => {
    setBusy(true); setErr(null);
    const r = await convertPost<PeriodReading>("/api/website/ai-personalization/visits/reading", { scope: "period", from, to });
    setBusy(false);
    if (r.ok) setReading(r.data); else setErr(r.error);
  };
  return (
    <GlassCard>
      <CardTitle icon={<AutoAwesomeOutlinedIcon />} tint="purple" title="What the visits show"
        note={reading ? undefined : `The AI reads the ${plural(d.rows.length, "customer")} of the period and where they stopped`}
        right={<AskButton canAsk={d.canAsk} ai={d.ai} busy={busy} again={!!reading} onAsk={() => void ask()} what="Read the visits" />} />
      {err && <Notice tone="warn">{err}</Notice>}
      <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "minmax(0,1fr)", lg: "minmax(0,1.25fr) minmax(0,1fr)" }, alignItems: "start" }}>
        <Box sx={{ display: "grid", gap: 1.25, minWidth: 0 }}>
          {busy && <Busy text={`The AI is reading ${plural(d.rows.length, "customer")}'s visits… about half a minute`} />}
          {reading ? (
            <>
              <Typography sx={{ fontSize: "1.02rem", fontWeight: 700, color: INK, lineHeight: 1.4 }}>{named(reading.headline, coNames)}</Typography>
              {reading.findings.map((f, k) => (
                <Box key={k} sx={{ p: 1.5, borderRadius: "12px", border: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.85)", display: "grid", gap: 0.6 }}>
                  <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                    <Box sx={{ width: 22, height: 22, flex: "none", borderRadius: "4px", bgcolor: "#6a46c9", color: "#fff", fontSize: "0.76rem", fontWeight: 700, display: "grid", placeItems: "center" }}>{k + 1}</Box>
                    <Typography sx={{ ...strong }}>{named(f.title, coNames)}</Typography>
                  </Box>
                  <Typography sx={{ fontSize: "0.82rem", color: INK, lineHeight: 1.45 }}>{named(f.why, coNames)}</Typography>
                  <Typography sx={{ fontSize: "0.82rem", color: INK, lineHeight: 1.45 }}><b>Do:</b> {named(f.action, coNames)}</Typography>
                  {f.paths.length > 0 && (
                    <Box sx={{ display: "flex", gap: 0.6, flexWrap: "wrap", alignItems: "center", mt: 0.25 }}>
                      <Typography component="span" sx={{ fontSize: "0.72rem", fontWeight: 700, color: FAINT }}>Find optimizations on</Typography>
                      {f.paths.map((p) => (
                        <Box key={p} component={Link} href={findHref(p)} title={p} sx={{
                          display: "inline-flex", alignItems: "center", gap: 0.4, maxWidth: 260, px: 0.85, py: "2px", borderRadius: "3px", textDecoration: "none",
                          fontSize: "0.74rem", fontWeight: 700, color: "#6a46c9", bgcolor: "#efe8fd", boxShadow: "inset 0 0 0 1px rgba(106,70,201,.2)", "&:hover": { bgcolor: "#e2d6fb" },
                        }}>
                          <AutoAwesomeOutlinedIcon sx={{ fontSize: 13, flex: "none" }} />
                          <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stopByPath.get(p)?.name ?? p}</Box>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              ))}
              {reading.call.length > 0 && (
                <Box sx={{ mt: 0.5 }}>
                  <Kick>Call first</Kick>
                  <Box sx={{ display: "grid", gap: 0.75 }}>
                    {reading.call.map((c) => {
                      const r = byId.get(c.id);
                      return (
                        <Box key={c.id} component={Link} href={`${VISITS}?company=${c.id}`} sx={{ display: "flex", gap: 1, alignItems: "center", p: 1, borderRadius: "10px", border: `1px solid ${HAIRLINE}`, textDecoration: "none", bgcolor: "rgba(255,255,255,.85)", "&:hover": { borderColor: ACCENT } }}>
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", flexWrap: "wrap" }}>
                              <Typography sx={{ ...strong, fontSize: "0.86rem" }}>{r?.name ?? `Company ${c.id}`}</Typography>
                              {r && <ReachTag reach={r.reach} />}
                            </Box>
                            <Typography sx={{ fontSize: "0.78rem", color: MUTED, lineHeight: 1.4 }}>{named(c.why, coNames)}</Typography>
                          </Box>
                          <ChevronRightRoundedIcon sx={{ color: FAINT }} />
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              )}
              <AskedLine by={reading.by} at={reading.at} of={`the ${plural(reading.customers, "customer")}' visits`} />
            </>
          ) : !busy && (
            <Box sx={{ p: 1.75, borderRadius: "12px", border: "1px dashed rgba(106,70,201,.35)", bgcolor: "rgba(106,70,201,.04)" }}>
              <Typography sx={{ fontSize: "0.88rem", fontWeight: 700, color: INK }}>Not read yet for this period</Typography>
              <Typography sx={{ fontSize: "0.82rem", color: MUTED, mt: 0.4 }}>One click: the patterns that cost orders, what to do about each, and who to call first.</Typography>
            </Box>
          )}
        </Box>
        <Box sx={{ display: "grid", gap: 1, minWidth: 0 }}>
          <Kick>Where customers stopped most</Kick>
          {d.stops.length === 0
            ? <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>No page where customers stopped short of an order in this period.</Typography>
            : d.stops.slice(0, 4).map((s) => <StopRow key={s.product ?? s.path ?? s.name} stop={s} note={plural(s.companies, "customer")} />)}
        </Box>
      </Box>
    </GlassCard>
  );
}

function ListView() {
  const { window: win } = useReportingWindow();
  const [tick, setTick] = useState(0);
  const url = `/api/website/ai-personalization/visits?from=${win.from}&to=${win.to}&n=${tick}`;
  const held = useHeld<ListData>(url, [url]);
  const [reach, setReach] = useState<Reach | "all">("all");
  const [store, setStore] = useState<string>("all");
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(40);
  const r = held.result;
  const d = r?.state === "ok" ? r.data : null;
  const rows = useMemo(() => (d ? filterRows(d.rows, { reach, store, q }) : []), [d, reach, store, q]);
  useEffect(() => setShown(40), [reach, store, q, d]);

  let body: React.ReactNode;
  if (!r) body = <LoadingPanel label="Reading the visits: the shop's own record and HubSpot…" />;
  else if (r.state !== "ok") body = <UpstreamPanel source="The visits" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? (r.status ?? null) : null} onRetry={() => setTick((n) => n + 1)} />;
  else if (d && d.rows.length === 0) {
    body = (
      <GlassCard sx={{ textAlign: "center", py: { xs: 4, md: 6 } }}>
        <Box sx={{ display: "grid", justifyItems: "center", gap: 1.25 }}>
          <Box sx={{ width: 56, height: 56, borderRadius: "14px", bgcolor: "#e6edfd", color: ACCENT, display: "grid", placeItems: "center" }}><SlideshowOutlinedIcon sx={{ fontSize: 30 }} /></Box>
          <Typography sx={{ fontSize: "1.1rem", fontWeight: 700, color: INK }}>No visit in this period</Typography>
          <Typography sx={{ fontSize: "0.86rem", color: MUTED, maxWidth: 520 }}>
            Visits come from the shop&apos;s own record (signed-in customers, from {ddmmyyyy(`${d.shopFrom}T12:00:00Z`)}) and from HubSpot. Nothing is shown that they did not record.
          </Typography>
          <SourceTags sources={d.sources} />
        </Box>
      </GlassCard>
    );
  } else if (d) {
    const stores = [...new Set(d.rows.map((x) => x.store).filter((x): x is string => !!x))].sort();
    const count = (k: Reach) => d.rows.filter((x) => x.reach === k).length;
    const visits = d.rows.reduce((n, x) => n + x.visits, 0);
    body = (
      <>
        {/* simpler (SARCLA 09.11.2026: "improve also the visit navigation, I like it more but still more simple"): the
            customers first, their figures in one line, the AI's reading of the period under them */}
        <GlassCard sx={{ p: { xs: 1.5, md: 2.5 } }}>
          <CardTitle icon={<StorefrontOutlinedIcon />} tint="blue" title={`${full(d.rows.length)} customers · ${full(visits)} visits`}
            note={`${full(count("cart"))} filled a cart and did not order · ${full(count("order"))} ordered · open one to play their visits back`}
            right={<SourceTags sources={d.sources} />} />
          <Box sx={{ display: "grid", gap: 1.25, mb: 1.5 }}>
            <SquareChoice<Reach | "all"> label="Got to" value={reach} onChange={setReach}
              options={[{ key: "all", label: "All", count: d.rows.length }, ...[...REACHES].reverse().map((k) => ({ key: k, label: REACH_LABEL[k], count: count(k), disabled: count(k) === 0 }))]} />
            <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
              {stores.length > 1 && (
                <TextField select size="small" label="Store view" value={store} onChange={(e) => setStore(e.target.value)}
                  sx={{ minWidth: 170, "& .MuiOutlinedInput-root": { borderRadius: "6px", bgcolor: "rgba(255,255,255,.8)", fontSize: "0.86rem" } }}>
                  <MenuItem value="all">All store views</MenuItem>
                  {stores.map((x) => <MenuItem key={x} value={x}>{x} · {d.rows.filter((r) => r.store === x).length}</MenuItem>)}
                </TextField>
              )}
              <TextField size="small" placeholder="Company, number or person" value={q} onChange={(e) => setQ(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: FAINT }} /></InputAdornment> }}
                sx={{ width: { xs: "100%", sm: 300 }, "& .MuiOutlinedInput-root": { borderRadius: "6px", bgcolor: "rgba(255,255,255,.8)", fontSize: "0.86rem" } }} />
            </Box>
          </Box>
          <Box sx={{ borderRadius: "12px", border: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.7)", overflow: "hidden", "& > a:first-of-type": { borderTop: "none" } }}>
            {rows.length === 0
              ? <Typography sx={{ p: 2, fontSize: "0.86rem", color: MUTED }}>No customer matches these choices.</Typography>
              : rows.slice(0, shown).map((x) => <RowLine key={x.id} r={x} />)}
          </Box>
          {rows.length > shown && (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 1.5 }}>
              <Button size="small" variant="outlined" onClick={() => setShown((n) => n + 60)} sx={{ ...btn, fontWeight: 600 }}>Show {Math.min(60, rows.length - shown)} more of {full(rows.length - shown)}</Button>
            </Box>
          )}
        </GlassCard>

        <PeriodCard d={d} from={win.from} to={win.to} />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Visits" subtitle="Each customer's visits on the shop, played back step by step - and what to do next"
        rightSlot={<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}><WindowPicker /><Tooltip title="Read again"><IconButton size="small" onClick={() => setTick((n) => n + 1)} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton></Tooltip></Box>} />
      {body}
    </>
  );
}

/* ── one customer ─────────────────────────────────────────────────────── */

function VisitRow({ v, on, names, onPick, onPlay }: { v: Visit; on: boolean; names: Map<string, string>; onPick: () => void; onPlay: () => void }) {
  const who = [...new Set(v.contacts.map((c) => names.get(c) ?? `Contact ${c}`))];
  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "stretch", p: 1, borderRadius: "12px", border: `1px solid ${on ? ACCENT : HAIRLINE}`, bgcolor: on ? "rgba(36,89,209,.06)" : "rgba(255,255,255,.85)", minWidth: 0 }}>
      <Box component="button" type="button" onClick={onPick} aria-pressed={on} sx={{ all: "unset", cursor: "pointer", flex: 1, minWidth: 0, display: "flex", gap: 1.25, alignItems: "center", "&:focus-visible": { outline: `2px solid ${ACCENT}`, borderRadius: "8px" } }}>
        <Box sx={{ width: 46, flex: "none", textAlign: "center", borderRadius: "8px", bgcolor: on ? ACCENT : "#eef2f8", color: on ? "#fff" : INK, py: 0.5 }}>
          <Typography sx={{ fontSize: "0.66rem", fontWeight: 700, textTransform: "uppercase", lineHeight: 1.2, opacity: 0.85 }}>{weekday(v.start)}</Typography>
          <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, lineHeight: 1.2 }}>{new Date(v.start).toLocaleDateString("de-CH", { timeZone: "Europe/Zurich", day: "2-digit", month: "2-digit" })}</Typography>
        </Box>
        <Box sx={{ minWidth: 0, flex: 1, display: "grid", gap: 0.4 }}>
          <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{hhmm(v.start)}{v.end !== v.start ? `-${hhmm(v.end)}` : ""}</Typography>
            <ReachTag reach={v.reach} />
          </Box>
          <MiniStrip kinds={v.steps.map((s) => s.kind)} size={9} max={14} />
          <Typography sx={{ fontSize: "0.72rem", color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {plural(v.steps.length, "step")}{v.steps.length > 1 ? ` · ${durWords(v.secs)}` : ""}{v.articles ? ` · ${plural(v.articles, "article")}` : ""}{who.length ? ` · ${who.join(", ")}` : ""}
          </Typography>
        </Box>
      </Box>
      <Tooltip title="Play this visit">
        <IconButton onClick={onPlay} aria-label="Play this visit" sx={{ alignSelf: "center", borderRadius: "8px", bgcolor: on ? ACCENT : "#eef2f8", color: on ? "#fff" : ACCENT, "&:hover": { bgcolor: ACCENT, color: "#fff" } }}>
          <PlayArrowRoundedIcon />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

function NextCard({ d, from, to, visits }: { d: CustomerData; from: string; to: string; visits: Visit[] }) {
  const [reading, setReading] = useState<CustomerReading | null>(d.reading);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => setReading(d.reading), [d.reading]);
  const ask = async () => {
    setBusy(true); setErr(null);
    const r = await convertPost<CustomerReading>("/api/website/ai-personalization/visits/reading", { scope: "customer", id: d.id, from, to });
    setBusy(false);
    if (r.ok) setReading(r.data); else setErr(r.error);
  };
  const people = new Map(Object.entries(reading?.letters ?? {}).map(([l, id]) => [l, d.contacts.find((c) => c.id === id)?.name ?? `contact ${l}`]));
  const co = new Map([[d.id, d.company.name ?? `Company ${d.id}`]]);
  const say = (t: string) => named(t, co, people);
  const fixes = new Map((reading?.shop ?? []).map((x) => [x.path, { why: say(x.why), try: say(x.try) }]));
  // the AI's pages first, in its order; then the rest of where they stopped
  const stops = [...d.stops].sort((a, b) => (fixes.has(b.path ?? "") ? 1 : 0) - (fixes.has(a.path ?? "") ? 1 : 0));
  return (
    <GlassCard>
      <CardTitle icon={<AutoAwesomeOutlinedIcon />} tint="purple" title="What to do next"
        note={reading ? undefined : `The AI reads the ${plural(visits.length, "visit")} above - their facts only`}
        right={<AskButton canAsk={d.canAsk} ai={d.ai} busy={busy} again={!!reading} onAsk={() => void ask()} what="Ask the AI" />} />
      {err && <Notice tone="warn">{err}</Notice>}
      {reading && <Typography sx={{ fontSize: "1.02rem", fontWeight: 700, color: INK, lineHeight: 1.4, mb: 2 }}>{say(reading.headline)}</Typography>}
      <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "minmax(0,1fr)", lg: "minmax(0,1fr) minmax(0,1fr)" }, alignItems: "start" }}>
        <Box sx={{ display: "grid", gap: 1, minWidth: 0 }}>
          <Kick>For this customer</Kick>
          {busy && <Busy text={`The AI is reading ${plural(visits.length, "visit")}… about half a minute`} />}
          {reading ? reading.next.map((n, k) => (
            <Box key={k} sx={{ p: 1.25, borderRadius: "12px", border: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.85)", display: "grid", gap: 0.5 }}>
              <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                <Chip tint={n.who === "Sales" ? "blue" : "purple"}>{n.who}</Chip>
                <Typography sx={{ ...strong, fontSize: "0.88rem" }}>{say(n.action)}</Typography>
              </Box>
              <Typography sx={{ fontSize: "0.8rem", color: MUTED, lineHeight: 1.45 }}>{say(n.why)}</Typography>
            </Box>
          )) : !busy && (
            <Box sx={{ p: 1.75, borderRadius: "12px", border: "1px dashed rgba(106,70,201,.35)", bgcolor: "rgba(106,70,201,.04)" }}>
              <Typography sx={{ fontSize: "0.88rem", fontWeight: 700, color: INK }}>Not asked yet</Typography>
              <Typography sx={{ fontSize: "0.82rem", color: MUTED, mt: 0.4 }}>What Sales and Marketing should do next, from what this customer did on the shop.</Typography>
            </Box>
          )}
          {reading && <AskedLine by={reading.by} at={reading.at} of={`these ${plural(reading.visits, "visit")}`} />}
        </Box>
        <Box sx={{ display: "grid", gap: 1, minWidth: 0 }}>
          <Kick>For the shop - where they stopped</Kick>
          {stops.length === 0
            ? <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>No shop page where this customer stopped short of an order.</Typography>
            : stops.slice(0, 4).map((s) => (
              <StopRow key={s.product ?? s.path ?? s.name} stop={s} ai={s.path ? fixes.get(s.path) ?? null : null}
                note={s.others ? `${plural(s.others.companies, "customer")} opened it, ${full(s.others.ordered)} ordered` : null} />
            ))}
        </Box>
      </Box>
    </GlassCard>
  );
}

function CustomerView({ id, visitId }: { id: string; visitId: string | null }) {
  const router = useRouter();
  const { window: win } = useReportingWindow();
  const [tick, setTick] = useState(0);
  const url = `/api/website/ai-personalization/visits/customer?id=${id}&from=${win.from}&to=${win.to}&n=${tick}`;
  const held = useHeld<CustomerData>(url, [url]);
  const [who, setWho] = useState<string>("all");
  const [playReq, setPlayReq] = useState(0);
  const r = held.result;
  const d = r?.state === "ok" ? r.data : null;
  const names = useMemo(() => new Map((d?.contacts ?? []).map((c) => [c.id, c.name])), [d]);
  const visits = useMemo(() => (d ? (who === "all" ? d.visits : d.visits.filter((v) => v.contacts.includes(who))) : []), [d, who]);
  const current = visits.find((v) => v.id === visitId) ?? visits[0] ?? null;
  const pick = (v: Visit, play: boolean) => {
    if (play) setPlayReq((n) => n + 1);
    router.replace(`${VISITS}?company=${id}&visit=${v.id}`, { scroll: false });
  };

  const back = (
    <Button component={Link} href={VISITS} size="small" startIcon={<ArrowBackRoundedIcon />} sx={{ ...btn, fontWeight: 600, color: MUTED, justifySelf: "start", px: 1, mb: -1.5 }}>All customers</Button>
  );
  let body: React.ReactNode;
  if (!r) body = <LoadingPanel label="Reading this customer's visits: the shop's record and HubSpot, page by page…" />;
  else if (r.state !== "ok") body = <UpstreamPanel source="The visits" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? (r.status ?? null) : null} onRetry={() => setTick((n) => n + 1)} />;
  else if (d) {
    const c = d.company;
    const carts = d.visits.filter((v) => reachAtLeast(v.reach, "cart")).length;
    const orders = d.visits.filter((v) => v.reach === "order").length;
    const time = d.visits.reduce((n, v) => n + v.secs, 0);
    const articles = new Set(d.visits.flatMap((v) => v.steps.flatMap((s) => s.looks.map((l) => l.article || `p${l.product}`)))).size;
    const withVisits = d.contacts.filter((x) => d.visits.some((v) => v.contacts.includes(x.id)));
    body = (
      <>
        <GlassCard>
          <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", flexWrap: "wrap" }}>
            <Box sx={{ width: 40, height: 40, borderRadius: "11px", bgcolor: "#e6edfd", color: ACCENT, display: "grid", placeItems: "center", flex: "none" }}><StorefrontOutlinedIcon /></Box>
            <Box sx={{ flex: 1, minWidth: 200, display: "grid", gap: 0.9 }}>
              <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
                {c.number && <Chip tint="slate">#{c.number}</Chip>}
                {c.country && <Chip tint="slate">{c.country}</Chip>}
                {d.store && <Chip tint="slate">{d.store}</Chip>}
                {c.segment && <Chip tint="blue">{c.segment}</Chip>}
                {c.priority && <Chip tint="purple">Priority {c.priority}</Chip>}
                {c.owner && <Chip tint="green">{c.owner}</Chip>}
                {d.logins !== null && <Chip tint="slate">{plural(d.logins, "sign-in")} in the period</Chip>}
              </Box>
              <Typography sx={{ fontSize: "0.86rem", color: INK, fontWeight: 600 }}>
                {plural(d.visits.length, "visit")}{d.visits[0] ? ` (last ${when(d.visits[0].start)})` : ""} · {durWords(time)} on the shop · {plural(articles, "article")} opened · {plural(carts, "visit")} to the cart · {plural(orders, "order")}
              </Typography>
              <SourceTags sources={d.sources} />
            </Box>
            <Button component="a" href={hsCompany(d.id)} target="_blank" rel="noreferrer" size="small" variant="outlined" endIcon={<OpenInNewRoundedIcon sx={{ fontSize: 15 }} />} sx={{ ...btn, fontWeight: 600 }}>Open in HubSpot</Button>
          </Box>
          {withVisits.length > 0 && (
            <Box component="details" sx={{ mt: 1.5, "& summary": { cursor: "pointer", fontSize: "0.82rem", fontWeight: 700, color: ACCENT } }}>
            <summary>{withVisits.length} {withVisits.length === 1 ? "person" : "people"} who visited</summary>
            <Box sx={{ mt: 1, display: "grid", gap: 1, gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "repeat(2, minmax(0,1fr))", lg: "repeat(4, minmax(0,1fr))" } }}>
              {withVisits.slice(0, 8).map((x) => (
                <Box key={x.id} sx={{ p: 1, borderRadius: "10px", border: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.8)", minWidth: 0 }}>
                  <Typography sx={{ ...strong, fontSize: "0.84rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.name}</Typography>
                  <Typography sx={{ fontSize: "0.74rem", color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {[x.job, `${plural(d.visits.filter((v) => v.contacts.includes(x.id)).length, "visit")} here`, x.lastAt ? `last seen ${when(x.lastAt)}` : null].filter(Boolean).join(" · ")}
                  </Typography>
                </Box>
              ))}
            </Box>
            </Box>
          )}
        </GlassCard>

        {d.visits.length === 0 ? (
          <GlassCard sx={{ textAlign: "center", py: 5 }}>
            <Box sx={{ display: "grid", justifyItems: "center", gap: 1 }}>
              <WrongLocationOutlinedIcon sx={{ fontSize: 36, color: FAINT }} />
              <Typography sx={{ fontSize: "1.05rem", fontWeight: 700, color: INK }}>No visit of this customer in this period</Typography>
              <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Choose a longer period at the top.</Typography>
            </Box>
          </GlassCard>
        ) : (
          <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "minmax(0,1fr)", xl: "minmax(0,2.4fr) minmax(300px,1fr)" }, alignItems: "start" }}>
            <GlassCard sx={{ p: { xs: 1.5, md: 2.5 } }}>
              <CardTitle icon={<SlideshowOutlinedIcon />} tint="blue" title="The visit, played back" />
              {current && <Player visit={current} names={names} start={playReq} />}
            </GlassCard>
            <GlassCard sx={{ p: { xs: 1.5, md: 2 } }}>
              <CardTitle icon={<ScheduleOutlinedIcon />} tint="slate" title={`${plural(visits.length, "visit")}`} note="The latest first" />
              {withVisits.length > 1 && (
                <Box sx={{ mb: 1.5 }}>
                  <SquareChoice<string> label="Who" value={who} onChange={setWho}
                    options={[{ key: "all", label: "Everyone" }, ...withVisits.map((x) => ({ key: x.id, label: x.name.split(" ")[0] || x.name, count: d.visits.filter((v) => v.contacts.includes(x.id)).length }))]} />
                </Box>
              )}
              <Box sx={{ display: "grid", gap: 0.75, maxHeight: { xl: 780 }, overflowY: { xl: "auto" }, pr: { xl: 0.5 } }}>
                {visits.map((v) => <VisitRow key={v.id} v={v} on={current?.id === v.id} names={names} onPick={() => pick(v, false)} onPlay={() => pick(v, true)} />)}
              </Box>
            </GlassCard>
          </Box>
        )}

        {/* the page views the shop recorded - the pointer, the scroll, the clicks (SARCLA 10.11.2026: "don't see the
            mouse and behaviour on the shop") */}
        <Recorded company={d.id} from={win.from} to={win.to} />

        {d.visits.length > 0 && <NextCard d={d} from={win.from} to={win.to} visits={d.visits} />}
      </>
    );
  }

  return (
    <>
      {back}
      <PageHeader title={d ? (d.company.name ?? `Company ${d.id}`) : "Visits"} subtitle="Their visits on the shop, played back step by step - and what to do next"
        rightSlot={<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}><WindowPicker /><Tooltip title="Read again"><IconButton size="small" onClick={() => setTick((n) => n + 1)} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton></Tooltip></Box>} />
      {body}
    </>
  );
}

function Pick() {
  const sp = useSearchParams();
  const company = sp.get("company");
  const id = company && /^\d{1,20}$/.test(company) ? company : null;
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      {id ? <CustomerView key={id} id={id} visitId={sp.get("visit")} /> : <ListView />}
    </Box>
  );
}

export default function VisitsPage() {
  return <Suspense fallback={null}><Pick /></Suspense>;
}
