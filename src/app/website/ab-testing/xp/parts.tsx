"use client";
// A/B testing - the pieces every page of the app draws a test with (src/lib/experiments): the record's loader, the chips,
// the versions as bars with their 95% range, a list of tests, the timeline, and the dialog that records a test or a
// person's word on one. One colour per source, everywhere (validated for colour blindness; each bar carries its label).

import { useMemo, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { LoadingPanel, NotConnectedPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { Chip } from "@/app/connectors/parts";
import { FAINT, GREEN, HAIRLINE, INK, MUTED, Notice, bodyCell, headCell, type Tint } from "@/app/uc/report/ui";
import {
  DECISION_LABEL, OUTCOME_LABEL, SERVICES, SOURCE_LABEL, STATUS_LABEL, daysOf, iceScore, readArms,
  type Category, type Decision, type Experiment, type Outcome, type Reading, type Source, type Status,
} from "@/lib/experiments/model";
import type { SyncRun } from "@/lib/experiments/sync";

export type ListData = { experiments: Experiment[]; sync: SyncRun | null; syncing: boolean; canEdit: boolean };
export type OneData = {
  experiment: Experiment; log: { at: string; by: string | null; action: string; detail: string }[]; canEdit: boolean;
  /** every test on the same page or service, oldest first (this one among them) */
  siblings?: { key: string; name: string; status: Status; startedAt: string | null }[];
};
export const API = "/api/website/ab-testing/experiments";

export const SOURCE_COLOR: Record<Source, string> = { apsoconvert: "#2a78d6", webyn: "#eb6834", chat: "#1baf7a", manual: "#6250d6", pagebuilder: "#e87ba4" };
const CONTROL_COLOR = "#9aa5b8";
const STATUS_TINT: Record<Status, Tint> = { idea: "slate", planned: "blue", running: "green", paused: "amber", ended: "purple" };
const OUTCOME_TINT: Record<Outcome, Tint> = { won: "green", lost: "pink", flat: "slate", "too-early": "amber", "no-data": "slate" };

export const keyHref = (key: string) => `/website/ab-testing/test/${encodeURIComponent(key)}`;
export const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "–");
const full = (n: number) => n.toLocaleString("de-CH");
export const pct = (x: number | null, d = 1) => (x === null ? "–" : `${(x * 100).toFixed(d)}%`);
export const liftText = (r: Reading) => {
  if (!r.best || r.best.lift === null) return "–";
  const l = r.best.lift * 100;
  return `${l > 0 ? "+" : l < 0 ? "−" : "±"}${Math.abs(l).toFixed(l !== 0 && Math.abs(l) < 10 ? 1 : 0)}%`;
};

/** The record, loading / not connected / failed, else the page. */
export function XpLoaded<T>({ url, children }: { url: string; children: (d: T, reload: () => void) => React.ReactNode }) {
  const [n, setN] = useState(0);
  const u = `${url}${url.includes("?") ? "&" : "?"}n=${n}`;
  const held = useHeld<T>(u, [u]);
  const reload = () => setN((x) => x + 1);
  const r = held.result;
  if (r === null) return <LoadingPanel label="Reading the tests…" />;
  if (r.state === "not-configured") return <NotConnectedPanel source="A/B testing" missing={r.missing} />;
  if (r.state === "error") return <UpstreamPanel source="A/B testing" error={r.error} status={r.status} onRetry={reload} />;
  return <>{children(r.data, reload)}</>;
}

export async function post<T = unknown>(b: unknown): Promise<{ ok: boolean; error?: string; data?: T }> {
  const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
  return (await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }))) as { ok: boolean; error?: string; data?: T };
}

export const StatusChip = ({ s }: { s: Status }) => <Chip tint={STATUS_TINT[s]}>{STATUS_LABEL[s]}</Chip>;
export const OutcomeChip = ({ o }: { o: Outcome }) => <Chip tint={OUTCOME_TINT[o]}>{OUTCOME_LABEL[o]}</Chip>;
export function SourceTag({ s }: { s: Source }) {
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, fontSize: "0.76rem", fontWeight: 600, color: MUTED, whiteSpace: "nowrap" }}>
      <Box component="span" sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: SOURCE_COLOR[s], flexShrink: 0 }} />{SOURCE_LABEL[s]}
    </Box>
  );
}
export const whereOf = (e: Experiment) => (e.category === "microservice" ? SERVICES.find((s) => s.id === e.service)?.name ?? e.surface : e.surface || "–");

/** Each version: its rate as a bar, the 95% range as a whisker, "x of n" beside it - the control in grey. */
export function ArmBars({ e, arms = e.arms, metric = e.metric, compact = false }: { e: Experiment; arms?: Experiment["arms"]; metric?: string; compact?: boolean }) {
  const r = readArms(arms);
  if (!r.visitors) return <Typography sx={{ fontSize: "0.8rem", color: FAINT }}>No visitor counted yet.</Typography>;
  const max = Math.max(0.0001, ...r.arms.map((a) => a.rate.hi ?? a.rate.rate ?? 0)) * 1.08;
  return (
    <Box sx={{ display: "grid", gap: compact ? 0.6 : 0.9 }} role="img" aria-label={`${metric}: ${r.arms.map((a) => `${a.name} ${pct(a.rate.rate)}`).join(", ")}`}>
      {!compact && <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{metric} - bar = the rate, whisker = its 95% range</Typography>}
      {r.arms.map((a) => {
        const w = ((a.rate.rate ?? 0) / max) * 100, lo = ((a.rate.lo ?? 0) / max) * 100, hi = ((a.rate.hi ?? 0) / max) * 100;
        return (
          <Box key={a.key} sx={{ display: "grid", gridTemplateColumns: compact ? "minmax(90px, 30%) 1fr auto" : "minmax(140px, 26%) 1fr auto", alignItems: "center", gap: 1 }}>
            <Typography sx={{ fontSize: compact ? "0.76rem" : "0.82rem", color: INK, fontWeight: a.control ? 500 : 650, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={a.name}>{a.name}</Typography>
            <Box sx={{ position: "relative", height: compact ? 10 : 14 }}>
              <Box sx={{ position: "absolute", inset: 0, bgcolor: "#edf0f5", borderRadius: 2 }} />
              <Box sx={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${w}%`, bgcolor: a.control ? CONTROL_COLOR : SOURCE_COLOR[e.source], borderRadius: "0 4px 4px 0" }} />
              {a.rate.lo !== null && <Box sx={{ position: "absolute", left: `${lo}%`, width: `${Math.max(0.5, hi - lo)}%`, top: "50%", height: "1.5px", bgcolor: INK }} />}
              {a.rate.lo !== null && <Box sx={{ position: "absolute", left: `${lo}%`, top: "15%", bottom: "15%", width: "1.5px", bgcolor: INK }} />}
              {a.rate.hi !== null && <Box sx={{ position: "absolute", left: `calc(${hi}% - 1.5px)`, top: "15%", bottom: "15%", width: "1.5px", bgcolor: INK }} />}
            </Box>
            <Typography sx={{ fontSize: compact ? "0.74rem" : "0.8rem", color: INK, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
              <b>{pct(a.rate.rate)}</b>{!compact && <Box component="span" sx={{ color: FAINT }}> ({pct(a.rate.lo, 0)}–{pct(a.rate.hi, 0)})</Box>}
              <Box component="span" sx={{ color: MUTED }}> · {full(a.conversions)} of {full(a.visitors)}</Box>
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

/** A list of tests: what, where, source, status, dates, visitors, the best version against the control, decision. */
export function XpTable({ list, empty, cols = ["test", "where", "status", "dates", "visitors", "result", "decision"] }: {
  list: Experiment[]; empty: string; cols?: ("test" | "where" | "status" | "dates" | "visitors" | "result" | "decision" | "score" | "learning")[];
}) {
  if (!list.length) return <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{empty}</Typography>;
  const H: Record<string, string> = { test: "Test", where: "Where", status: "Status", dates: "When", visitors: "Visitors", result: "Best version vs control", decision: "Decision", score: "Score", learning: "What we learned" };
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Table size="small" sx={{ minWidth: 860 }}>
        <TableHead><TableRow>{cols.map((c) => <TableCell key={c} sx={{ ...headCell, textAlign: c === "visitors" || c === "score" ? "right" : "left" }}>{H[c]}</TableCell>)}</TableRow></TableHead>
        <TableBody>
          {list.map((e) => {
            const r = readArms(e.arms);
            const days = daysOf(e);
            return (
              <TableRow key={e.key} hover>
                {cols.map((c) => {
                  switch (c) {
                    case "test": return (
                      <TableCell key={c} sx={{ ...bodyCell, maxWidth: 340 }}>
                        <Box component={Link} href={keyHref(e.key)} sx={{ fontSize: "0.86rem", fontWeight: 650, color: INK, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>{e.name}</Box>
                        <Box sx={{ mt: 0.25 }}><SourceTag s={e.source} /></Box>
                      </TableCell>);
                    case "where": return <TableCell key={c} sx={{ ...bodyCell, fontSize: "0.78rem", color: MUTED, maxWidth: 240, wordBreak: "break-all" }}>{whereOf(e)}{e.host && e.host !== "www.apsoparts.com" ? <Box component="span" sx={{ color: FAINT }}> · {e.host.split(".")[0]}</Box> : null}</TableCell>;
                    case "status": return <TableCell key={c} sx={bodyCell}><StatusChip s={e.status} /></TableCell>;
                    case "dates": return <TableCell key={c} sx={{ ...bodyCell, fontSize: "0.78rem", color: MUTED, whiteSpace: "nowrap" }}>{e.startedAt ? `${day(e.startedAt)} – ${e.endedAt ? day(e.endedAt) : "now"}` : "–"}{days !== null ? <Box component="span" sx={{ color: FAINT }}> · {days} d</Box> : null}</TableCell>;
                    case "visitors": return <TableCell key={c} sx={{ ...bodyCell, textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: "0.84rem" }}>{r.visitors ? full(r.visitors) : "–"}</TableCell>;
                    case "result": return (
                      <TableCell key={c} sx={{ ...bodyCell, whiteSpace: "nowrap" }}>
                        {r.best ? <Typography component="span" sx={{ fontSize: "0.86rem", fontWeight: 700, color: r.outcome === "won" ? GREEN : INK, mr: 1 }}>{liftText(r)}</Typography> : null}
                        <OutcomeChip o={r.outcome} />
                      </TableCell>);
                    case "decision": return <TableCell key={c} sx={{ ...bodyCell, fontSize: "0.8rem", color: e.decision ? INK : FAINT }}>{e.decision ? DECISION_LABEL[e.decision] : r.outcome === "too-early" || e.status === "running" ? "–" : "To decide"}</TableCell>;
                    case "score": return <TableCell key={c} sx={{ ...bodyCell, textAlign: "right", fontWeight: 700, fontSize: "0.9rem" }}>{iceScore(e.ice) ?? "–"}</TableCell>;
                    case "learning": return <TableCell key={c} sx={{ ...bodyCell, fontSize: "0.78rem", color: e.learning ? INK : FAINT, maxWidth: 320 }}>{e.learning || "–"}</TableCell>;
                  }
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
}

/** Every test on one line from its start to its end (or today), the last N days - grouped by pages / microservices. */
export function Timeline({ list, days = 120 }: { list: Experiment[]; days?: number }) {
  const now = Date.now(), from = now - days * 86_400_000;
  const shown = list.filter((e) => e.startedAt && (!e.endedAt || Date.parse(e.endedAt) >= from))
    .sort((a, b) => Date.parse(a.startedAt!) - Date.parse(b.startedAt!));
  const x = (t: number) => Math.min(100, Math.max(0, ((t - from) / (now - from)) * 100));
  const months = useMemo(() => {
    const out: { label: string; at: number }[] = [];
    const d = new Date(from); d.setDate(1); d.setHours(0, 0, 0, 0);
    while (d.getTime() <= now) { if (d.getTime() >= from) out.push({ label: d.toLocaleDateString("en-GB", { month: "short" }), at: d.getTime() }); d.setMonth(d.getMonth() + 1); }
    return out;
  }, [from, now]);
  if (!shown.length) return <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>No test ran in the last {days} days.</Typography>;
  const groups: { name: string; items: Experiment[] }[] = [
    { name: "Pages", items: shown.filter((e) => e.category === "page") },
    { name: "Microservices", items: shown.filter((e) => e.category === "microservice") },
  ].filter((g) => g.items.length);
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <Box sx={{ position: "relative", height: 16, ml: { xs: 0, md: "30%" } }}>
        {months.map((m) => <Typography key={m.at} sx={{ position: "absolute", left: `${x(m.at)}%`, fontSize: "0.7rem", color: FAINT, transform: "translateX(-2px)" }}>{m.label}</Typography>)}
      </Box>
      {groups.map((g) => (
        <Box key={g.name} sx={{ display: "grid", gap: 0.5 }}>
          <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em" }}>{g.name}</Typography>
          {g.items.map((e) => {
            const a = x(Date.parse(e.startedAt!)), b = x(e.endedAt ? Date.parse(e.endedAt) : now);
            return (
              <Box key={e.key} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "30% 1fr" }, alignItems: "center", gap: { xs: 0.25, md: 1 } }}>
                <Box component={Link} href={keyHref(e.key)} sx={{ fontSize: "0.78rem", color: INK, textDecoration: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", "&:hover": { textDecoration: "underline" } }} title={e.name}>{e.name}</Box>
                <Box sx={{ position: "relative", height: 14, bgcolor: "#f3f5f9", borderRadius: 2, backgroundImage: months.map((m) => `linear-gradient(to right, transparent calc(${x(m.at)}% - 0.5px), ${HAIRLINE} calc(${x(m.at)}% - 0.5px), ${HAIRLINE} calc(${x(m.at)}% + 0.5px), transparent calc(${x(m.at)}% + 0.5px))`).join(",") }}
                  title={`${e.name} - ${STATUS_LABEL[e.status]}, ${day(e.startedAt)} – ${e.endedAt ? day(e.endedAt) : "now"}`}>
                  <Box sx={{ position: "absolute", left: `${a}%`, width: `${Math.max(0.8, b - a)}%`, top: 2, bottom: 2, borderRadius: 3, bgcolor: SOURCE_COLOR[e.source], opacity: e.status === "ended" ? 0.55 : 1,
                    ...(e.status === "running" ? { boxShadow: `0 0 0 2px #fff, 0 0 0 3px ${SOURCE_COLOR[e.source]}` } : {}) }} />
                </Box>
              </Box>
            );
          })}
        </Box>
      ))}
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mt: 0.5 }}>
        {(Object.keys(SOURCE_COLOR) as Source[]).filter((s) => shown.some((e) => e.source === s)).map((s) => <SourceTag key={s} s={s} />)}
        <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>Ringed: running · faded: ended</Typography>
      </Box>
    </Box>
  );
}

export function SyncLine({ d, reload }: { d: ListData; reload: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = async () => { setBusy(true); setErr(null); const r = await post({ action: "sync" }); setBusy(false); if (!r.ok) setErr(r.error ?? "Did not work."); else reload(); };
  const s = d.sync;
  const bad = s ? Object.entries(s.sources).filter(([, x]) => !x.ok || x.error) : [];
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
      <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>
        {s ? `Refreshed ${new Date(s.at).toLocaleString("de-CH", { dateStyle: "short", timeStyle: "short" })} from APSOconvert ${s.sources.apsoconvert.n}, the shop chat ${s.sources.chat.n}, Webyn ${s.sources.webyn.n}${s.sources.pagebuilder ? `, the Page builder ${s.sources.pagebuilder.n}` : ""}` : "Never refreshed yet"}
        {d.syncing ? " · refreshing now…" : ""}
      </Typography>
      {d.canEdit && <Button size="small" variant="text" onClick={() => void run()} disabled={busy} startIcon={busy ? <CircularProgress size={12} /> : <RefreshIcon sx={{ fontSize: 16 }} />} sx={{ textTransform: "none", fontSize: "0.76rem" }}>Refresh now</Button>}
      {bad.map(([k, x]) => <Typography key={k} sx={{ fontSize: "0.74rem", color: FAINT }}>{SOURCE_LABEL[k as Source]}: {x.error}</Typography>)}
      {err && <Notice tone="bad">{err}</Notice>}
    </Box>
  );
}

/* ── record a test (an idea, a planned or a past one), or change one ── */
type Draft = {
  name: string; category: Category; service: string; surface: string; host: string; status: Status; hypothesis: string; metric: string;
  startedAt: string; endedAt: string; owner: string; impact: string; confidence: string; ease: string;
  arms: { name: string; visitors: string; conversions: string }[];
  decision: Decision | ""; learning: string; reported: string; notes: string;
};
const blank = (over: Partial<Draft> = {}): Draft => ({
  name: "", category: "page", service: "chat", surface: "", host: "www.apsoparts.com", status: "idea", hypothesis: "", metric: "", startedAt: "", endedAt: "", owner: "",
  impact: "", confidence: "", ease: "", arms: [{ name: "The page as it is", visitors: "", conversions: "" }, { name: "Version B", visitors: "", conversions: "" }],
  decision: "", learning: "", reported: "", notes: "", ...over,
});
const fromExp = (e: Experiment): Draft => ({
  name: e.name, category: e.category, service: e.service ?? "chat", surface: e.surface, host: e.host ?? "", status: e.status, hypothesis: e.hypothesis, metric: e.metric,
  startedAt: e.startedAt?.slice(0, 10) ?? "", endedAt: e.endedAt?.slice(0, 10) ?? "", owner: e.owner ?? "",
  impact: e.ice ? String(e.ice.impact) : "", confidence: e.ice ? String(e.ice.confidence) : "", ease: e.ice ? String(e.ice.ease) : "",
  arms: e.arms.length ? e.arms.map((a) => ({ name: a.name, visitors: String(a.visitors), conversions: String(a.conversions) })) : blank().arms,
  decision: e.decision ?? "", learning: e.learning, reported: e.reported, notes: e.notes,
});

/** New (manual) or an existing test: on a source's test only a person's fields are open. */
export function XpDialog({ open, onClose, onSaved, e, preset }: { open: boolean; onClose: () => void; onSaved: (key: string) => void; e?: Experiment | null; preset?: Partial<Draft> }) {
  const manual = !e || e.source === "manual";
  const [d, setD] = useState<Draft>(() => (e ? fromExp(e) : blank(preset)));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const past = d.status === "ended" || d.status === "running" || d.status === "paused";
  const ice = d.impact && d.confidence && d.ease ? { impact: Number(d.impact), confidence: Number(d.confidence), ease: Number(d.ease) } : null;
  const arms = d.arms.filter((a) => a.name.trim()).map((a) => ({ name: a.name.trim(), visitors: Number(a.visitors) || 0, conversions: Number(a.conversions) || 0 }));
  const save = async () => {
    setBusy(true); setErr(null);
    const person = { hypothesis: d.hypothesis, owner: d.owner, ice, learning: d.learning, reported: d.reported, notes: d.notes, decision: d.decision || null };
    const own = { name: d.name, category: d.category, service: d.category === "microservice" ? d.service : null, surface: d.category === "microservice" ? SERVICES.find((s) => s.id === d.service)?.name ?? d.service : d.surface,
      host: d.category === "page" ? d.host : null, status: d.status, metric: d.metric, startedAt: d.startedAt || null, endedAt: d.endedAt || null, arms: past ? arms : [] };
    const r = e
      ? await post<Experiment>({ action: "save", key: e.key, patch: manual ? { ...own, ...person } : person })
      : await post<Experiment>({ action: "create", experiment: { ...own, ...person } }).then(async (c) => {
        // the decision and what was learned go on in a second step (the record exists first)
        if (c.ok && c.data && (person.decision || person.learning || person.reported || person.notes)) return post<Experiment>({ action: "save", key: c.data.key, patch: { decision: person.decision, learning: person.learning, reported: person.reported, notes: person.notes } });
        return c;
      });
    setBusy(false);
    if (!r.ok || !r.data) { setErr(r.error ?? "Did not work."); return; }
    onSaved(r.data.key);
  };
  const f = { size: "small" as const, fullWidth: true };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontSize: "1.05rem", fontWeight: 700 }}>{e ? (manual ? "Change this test" : "Your word on this test") : "Record a test"}</DialogTitle>
      <DialogContent sx={{ display: "grid", gap: 1.5, pt: "8px !important" }}>
        {!manual && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>The figures, dates and status come from {SOURCE_LABEL[e!.source]} and are refreshed by themselves. Here: what we decided, what we learned, the hypothesis{e!.source === "webyn" ? ", and the result Webyn's own dashboard reports" : ""}.</Typography>}
        {manual && (
          <>
            <TextField {...f} label="Name" value={d.name} onChange={(x) => set("name", x.target.value)} placeholder="e.g. Bigger add-to-cart button on O-ring pages" />
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" }, gap: 1.5 }}>
              <TextField {...f} select label="Kind" value={d.category} onChange={(x) => set("category", x.target.value as Category)}>
                <MenuItem value="page">A shop page</MenuItem><MenuItem value="microservice">A microservice</MenuItem>
              </TextField>
              {d.category === "page"
                ? <TextField {...f} label="Page (path)" value={d.surface} onChange={(x) => set("surface", x.target.value)} placeholder="/de-ch/o-ringe.html" />
                : <TextField {...f} select label="Service" value={d.service} onChange={(x) => set("service", x.target.value)}>{SERVICES.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}</TextField>}
              <TextField {...f} select label="Status" value={d.status} onChange={(x) => set("status", x.target.value as Status)}>
                {(["idea", "planned", "running", "paused", "ended"] as Status[]).map((s) => <MenuItem key={s} value={s}>{STATUS_LABEL[s]}</MenuItem>)}
              </TextField>
            </Box>
            <TextField {...f} label="What it measures" value={d.metric} onChange={(x) => set("metric", x.target.value)} placeholder={d.category === "page" ? "Put something in the cart, per visitor of the page" : "e.g. Gave an e-mail, per visitor who opened the chat"} />
          </>
        )}
        <TextField {...f} multiline minRows={2} label="Hypothesis - if we change …, then … because …" value={d.hypothesis} onChange={(x) => set("hypothesis", x.target.value)} />
        {manual && (d.status === "idea" || d.status === "planned") && (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "1fr 1fr 1fr 1.4fr" }, gap: 1.5 }}>
            {(["impact", "confidence", "ease"] as const).map((k) => <TextField key={k} {...f} type="number" label={`${k[0].toUpperCase()}${k.slice(1)} (1-10)`} value={d[k]} onChange={(x) => set(k, x.target.value)} slotProps={{ htmlInput: { min: 1, max: 10 } }} />)}
            <TextField {...f} label="Owner" value={d.owner} onChange={(x) => set("owner", x.target.value)} />
          </Box>
        )}
        {manual && past && (
          <>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
              <TextField {...f} type="date" label="Started" value={d.startedAt} onChange={(x) => set("startedAt", x.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
              <TextField {...f} type="date" label="Ended" value={d.endedAt} onChange={(x) => set("endedAt", x.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            </Box>
            <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>The versions - the first one is the control. Visitors and how many of them converted, when you have them.</Typography>
            {d.arms.map((a, i) => (
              <Box key={i} sx={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 1 }}>
                <TextField {...f} label={i ? `Version ${String.fromCharCode(65 + i)}` : "Control"} value={a.name} onChange={(x) => set("arms", d.arms.map((y, j) => (j === i ? { ...y, name: x.target.value } : y)))} />
                <TextField {...f} type="number" label="Visitors" value={a.visitors} onChange={(x) => set("arms", d.arms.map((y, j) => (j === i ? { ...y, visitors: x.target.value } : y)))} />
                <TextField {...f} type="number" label="Converted" value={a.conversions} onChange={(x) => set("arms", d.arms.map((y, j) => (j === i ? { ...y, conversions: x.target.value } : y)))} />
              </Box>
            ))}
            {d.arms.length < 4 && <Button size="small" sx={{ justifySelf: "start", textTransform: "none" }} onClick={() => set("arms", [...d.arms, { name: `Version ${String.fromCharCode(65 + d.arms.length)}`, visitors: "", conversions: "" }])}>+ A version</Button>}
          </>
        )}
        {(!!e || past) && (
          <>
            <TextField {...f} select label="Decision" value={d.decision} onChange={(x) => set("decision", x.target.value as Decision | "")}>
              <MenuItem value="">Not decided</MenuItem>
              {(Object.keys(DECISION_LABEL) as Decision[]).map((k) => <MenuItem key={k} value={k}>{DECISION_LABEL[k]}</MenuItem>)}
            </TextField>
            <TextField {...f} multiline minRows={2} label="What we learned" value={d.learning} onChange={(x) => set("learning", x.target.value)} />
            {(e?.source === "webyn" || manual) && <TextField {...f} label="Result the tool reported (e.g. Webyn: +8.3% conversions, 96% probability)" value={d.reported} onChange={(x) => set("reported", x.target.value)} />}
          </>
        )}
        <TextField {...f} multiline minRows={1} label="Notes" value={d.notes} onChange={(x) => set("notes", x.target.value)} />
        {err && <Notice tone="bad">{err}</Notice>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>Cancel</Button>
        <Button variant="contained" disableElevation onClick={() => void save()} disabled={busy || (manual && !d.name.trim())} sx={{ textTransform: "none" }}
          startIcon={busy ? <CircularProgress size={14} color="inherit" /> : undefined}>{busy ? "Saving…" : "Save"}</Button>
      </DialogActions>
    </Dialog>
  );
}
