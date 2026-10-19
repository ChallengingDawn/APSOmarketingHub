"use client";
// MONTHLY INPUTS - SARCLA's "Dashboard 2026" month by month, filled by the hub (SARCLA 20.10.2026: "monthly
// input should be prefilled - that is the whole point, that we can take the next month in a row and copy it
// into the shared Excel"): the sheet's fifteen rows in its order, each month from GA4, Google Ads and the
// Search Console where the hub reads them, from what was typed where nothing does; a month copied as a
// column or a row, the year as a file. Below, the rows nothing reads yet - purchases and SEO revenue
// proposed from GA4 (they match the sheet's own figures), cart and check-out abandonment, SEA cost and
// revenue typed - and the year's targets. Rates are typed in percent (29 = 29%). Editing needs edit rights
// on Advanced reporting; everyone else reads.

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";

import PageHeader from "@/app/PageHeader";
import { FAINT, GREEN, GlassCard, HAIRLINE, INK, MUTED, RED } from "@/app/uc/report/ui";
import { MEASURES, TYPED } from "@/lib/marketingKpis/measures";
import type { LiveKpis } from "@/lib/marketingKpis/live";
import type { Inputs } from "@/lib/marketingKpis/seed";
import { MONTHS, useMarketingKpis } from "../data";

const TARGETS = ["F01", "P06", "E01", "E02", "P07", "V01", "P01", "L01"];
/** Dashboard 2026's monthly rows, in the sheet's order - what a month is copied as */
const SHEET = ["V01", "E01", "E02", "K02", "K03", "P01", "R01", "R02", "X01", "P05", "R04", "R05", "R06", "R07", "P07"];
/** a typed row the hub can propose from GA4: the series that matches the sheet's own figures */
const PROPOSE: Record<string, string> = { P01: "P01G", P07: "P07G" };
const SOURCE: Record<string, string> = { GA4: "GA4", "Google Ads": "Google Ads", "Search Console": "Search Console" };

/** One month's figure as the sheet has it: the hub's live value, else what was typed, else GA4's proposal. */
function sheetValue(id: string, year: number, i: number, inputs: Inputs, live: LiveKpis | undefined): { v: number | null; from: "live" | "typed" | "ga4" | null } {
  const side = live && year === live.year ? "months" : live && year === live.year - 1 ? "py" : null;
  const m = MEASURES[id];
  if (m?.origin === "live" && side) {
    const v = live!.series[id]?.[side][i];
    if (v != null) return { v, from: "live" };
  }
  const typed = inputs.months[id]?.[`${year}-${String(i + 1).padStart(2, "0")}`];
  if (typed != null) return { v: typed, from: "typed" };
  const g = PROPOSE[id] && side ? live!.series[PROPOSE[id]]?.[side][i] : null;
  if (g != null) return { v: g, from: "ga4" };
  return { v: null, from: null };
}
/** a figure for Excel: plain digits and a point, a rate in percent */
const forExcel = (id: string, v: number | null) => (v == null ? "" : isPct(id) ? `${+(v * 100).toFixed(2)}%` : MEASURES[id]?.fmt === "dec1" ? String(+v.toFixed(1)) : String(Math.round(v)));
const forScreen = (id: string, v: number | null) => (v == null ? "" : isPct(id) ? `${(v * 100).toFixed(1)}%` : MEASURES[id]?.fmt === "dec1" ? v.toFixed(1) : Math.round(v).toLocaleString("en"));
const isPct = (id: string) => MEASURES[id]?.fmt === "pct";
const show = (id: string, v: number | undefined) => (v == null ? "" : isPct(id) ? String(+(v * 100).toFixed(3)) : String(v));
const parse = (id: string, raw: string): number | null | "bad" => {
  const t = raw.trim().replace(/['’\s]/g, "").replace(/%$/, "");
  if (!t) return null;
  const n = Number(t.replace(/,/g, "."));
  if (!Number.isFinite(n)) return "bad";
  return isPct(id) ? n / 100 : n;
};

function Row({ id, year, inputs, live, canEdit, onSaved }: { id: string; year: number; inputs: Inputs; live: LiveKpis | undefined; canEdit: boolean; onSaved: (i: Inputs) => void }) {
  const keys = MONTHS.map((_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  const initial = useMemo(() => keys.map((k) => show(id, inputs.months[id]?.[k])), [inputs, id, year]); // eslint-disable-line react-hooks/exhaustive-deps
  // an empty month GA4 can fill starts with GA4's figure, marked - Save keeps it (whole months only)
  const done = live ? (year < live.year ? 12 : year === live.year ? live.monthsDone : 0) : 0;
  const proposed = useMemo(() => keys.map((_, i) => {
    if (initial[i] !== "" || i >= done) return null;
    const f = sheetValue(id, year, i, inputs, live);
    return f.from === "ga4" ? show(id, f.v ?? undefined) : null;
  }), [initial, inputs, live, id, year, done]); // eslint-disable-line react-hooks/exhaustive-deps
  const start = useMemo(() => initial.map((v, i) => proposed[i] ?? v), [initial, proposed]);
  const [vals, setVals] = useState<string[]>(start);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setVals(start), [start]);
  const dirty = vals.some((v, i) => v !== initial[i]);
  const save = async () => {
    const values: Record<string, number | null> = {};
    for (let i = 0; i < 12; i++) {
      if (vals[i] === initial[i]) continue;
      const p = parse(id, vals[i]);
      if (p === "bad") { setMsg({ ok: false, text: `${MONTHS[i]} is not a number` }); return; }
      values[keys[i]] = p;
    }
    setBusy(true); setMsg(null);
    try {
      const j = await fetch("/api/reporting/marketing-kpis", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kpi: id, values }) }).then((r) => r.json());
      if (j.ok) { onSaved(j.inputs); setMsg({ ok: true, text: "Saved" }); } else setMsg({ ok: false, text: j.error ?? "Not saved" });
    } finally { setBusy(false); }
  };
  const m = MEASURES[id];
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: `minmax(190px, 1.4fr) repeat(12, minmax(62px, 1fr)) 92px`, gap: "4px", alignItems: "center", py: 0.5, borderTop: `1px solid ${HAIRLINE}` }}>
      <Box>
        <Typography sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK }}>{m.label}</Typography>
        <Typography sx={{ fontSize: "0.7rem", color: FAINT }}>{id} · {isPct(id) ? "in %" : m.typedCurrency === "CHF" ? "in CHF as the source shows it - shown in € at the month's rate" : m.fmt === "chf" ? "CHF" : m.fmt === "dec1" ? "position" : "count"}{PROPOSE[id] ? " · GA4 fills an empty month" : ""}</Typography>
      </Box>
      {vals.map((v, i) => (
        <Box key={i} component="input" value={v} disabled={!canEdit} inputMode="decimal" aria-label={`${m.label} ${MONTHS[i]} ${year}`}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVals(vals.map((x, j) => (j === i ? e.target.value : x)))}
          title={proposed[i] != null && v === proposed[i] ? "GA4's figure - Save keeps it" : undefined}
          sx={{ width: "100%", minWidth: 0, fontFamily: "inherit", fontSize: "0.8rem", textAlign: "right", px: 0.75, py: 0.6, borderRadius: "8px",
            border: `1px solid ${v !== initial[i] ? "#2459d1" : HAIRLINE}`, bgcolor: proposed[i] != null && v === proposed[i] ? "#eef3fd" : canEdit ? "#fff" : "transparent", color: INK, fontVariantNumeric: "tabular-nums" }} />
      ))}
      <Box sx={{ textAlign: "right" }}>
        {canEdit && <Button size="small" disabled={!dirty || busy} onClick={save} sx={{ textTransform: "none", fontWeight: 600, borderRadius: "8px", minWidth: 0 }}>{busy ? "…" : "Save"}</Button>}
        {msg && <Typography sx={{ fontSize: "0.7rem", color: msg.ok ? GREEN : RED }}>{msg.text}</Typography>}
      </Box>
    </Box>
  );
}

function TargetRow({ id, year, inputs, canEdit, onSaved }: { id: string; year: number; inputs: Inputs; canEdit: boolean; onSaved: (i: Inputs) => void }) {
  const initial = show(id, inputs.targets[id]?.[String(year)]);
  const [v, setV] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => setV(initial), [initial]);
  const save = async () => {
    const p = parse(id, v);
    if (p === "bad") { setMsg({ ok: false, text: "Not a number" }); return; }
    const j = await fetch("/api/reporting/marketing-kpis", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target: { kpi: id, year: String(year), value: p } }) }).then((r) => r.json());
    if (j.ok) { onSaved(j.inputs); setMsg({ ok: true, text: "Saved" }); } else setMsg({ ok: false, text: j.error ?? "Not saved" });
  };
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "minmax(220px, 1fr) 140px 80px", gap: 1, alignItems: "center", py: 0.5, borderTop: `1px solid ${HAIRLINE}` }}>
      <Typography sx={{ fontSize: "0.84rem", color: INK }}>{MEASURES[id].label} <span style={{ color: FAINT }}>· {id}{isPct(id) ? " · in %" : ""}{MEASURES[id].goodWhenUp === false ? " · a maximum" : ""}</span></Typography>
      <Box component="input" value={v} disabled={!canEdit} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setV(e.target.value)} aria-label={`Target ${MEASURES[id].label}`}
        sx={{ fontFamily: "inherit", fontSize: "0.82rem", textAlign: "right", px: 0.75, py: 0.6, borderRadius: "8px", border: `1px solid ${v !== initial ? "#2459d1" : HAIRLINE}`, bgcolor: canEdit ? "#fff" : "transparent" }} />
      <Box>
        {canEdit && <Button size="small" disabled={v === initial} onClick={save} sx={{ textTransform: "none", fontWeight: 600, borderRadius: "8px" }}>Save</Button>}
        {msg && <Typography sx={{ fontSize: "0.7rem", color: msg.ok ? GREEN : RED }}>{msg.text}</Typography>}
      </Box>
    </Box>
  );
}

/**
 * Dashboard 2026 as the hub has it: the sheet's rows in its order, every month filled where the hub reads the
 * figure (or it was typed); a month copied as a column - one figure a line, to paste into the sheet's month -
 * or as a row, and the year as a file.
 */
function SheetMonths({ year, inputs, live }: { year: number; inputs: Inputs; live: LiveKpis | undefined }) {
  const done = live ? (year < live.year ? 12 : year === live.year ? live.monthsDone : 0) : 0;
  const [month, setMonth] = useState(Math.max(0, done - 1));
  useEffect(() => setMonth(Math.max(0, done - 1)), [done]);
  const [copied, setCopied] = useState<string | null>(null);
  const cell = (id: string, i: number) => sheetValue(id, year, i, inputs, live);
  const copy = async (how: "column" | "row") => {
    const vals = SHEET.map((id) => forExcel(id, cell(id, month).v));
    const text = how === "column" ? vals.join("\n") : vals.join("\t");
    try { await navigator.clipboard.writeText(text); setCopied(`${MONTHS[month]} copied as a ${how} - ${SHEET.length} figures`); }
    catch { setCopied("The browser did not allow the copy - use the file"); }
  };
  const download = () => {
    const rows = [["KPI", "Id", ...MONTHS.map((m) => `${m} ${year}`)], ...SHEET.map((id) => [MEASURES[id].label, id, ...MONTHS.map((_, i) => forExcel(id, cell(id, i).v))])];
    const csv = "\ufeff" + rows.map((r) => r.map((x) => (/[",;\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x)).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `dashboard-${year}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const sourceOf = (id: string) => (MEASURES[id]?.origin === "live" ? SOURCE[MEASURES[id].liveSource ?? ""] ?? MEASURES[id].liveSource ?? "the hub" : PROPOSE[id] ? "GA4, or typed" : "typed");
  return (
    <GlassCard>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5, flexWrap: "wrap" }}>
        <Typography sx={{ flex: 1, minWidth: 220, fontSize: "0.98rem", fontWeight: 700, color: INK }}>Dashboard {year} - the month for the shared sheet</Typography>
        <Box component="select" value={month} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setMonth(Number(e.target.value))} aria-label="The month to copy"
          sx={{ fontFamily: "inherit", fontSize: "0.82rem", fontWeight: 600, px: 1, py: 0.6, borderRadius: "10px", border: `1px solid ${HAIRLINE}`, bgcolor: "#fff", color: INK }}>
          {MONTHS.map((m, i) => <option key={m} value={i}>{m} {year}{i >= done ? " (not over)" : ""}</option>)}
        </Box>
        <Button size="small" variant="contained" disableElevation onClick={() => copy("column")} sx={{ textTransform: "none", fontWeight: 700, borderRadius: "10px" }}>Copy {MONTHS[month]} - a column</Button>
        <Button size="small" variant="outlined" onClick={() => copy("row")} sx={{ textTransform: "none", fontWeight: 700, borderRadius: "10px", bgcolor: "#fff" }}>As a row</Button>
        <Button size="small" variant="outlined" onClick={download} sx={{ textTransform: "none", fontWeight: 700, borderRadius: "10px", bgcolor: "#fff" }}>Download {year}</Button>
      </Box>
      <Typography sx={{ fontSize: "0.78rem", color: copied ? GREEN : MUTED, mb: 1 }}>
        {copied ?? "The sheet's fifteen rows in its order. A column pastes into the sheet's month (one figure a line); a row pastes across. Rates as 29.5%, money in francs as the sheet has it, no thousands separators."}
      </Typography>
      <Box sx={{ overflowX: "auto" }}>
        <Box sx={{ minWidth: 1100, display: "grid", gridTemplateColumns: `minmax(210px, 1.6fr) repeat(12, minmax(62px, 1fr))`, columnGap: "4px" }}>
          <Typography sx={{ fontSize: "0.68rem", color: FAINT, fontWeight: 700, textTransform: "uppercase", pb: 0.5 }}>KPI · where it comes from</Typography>
          {MONTHS.map((m, i) => (
            <Box key={m} component="button" type="button" onClick={() => setMonth(i)} aria-pressed={i === month}
              sx={{ border: 0, font: "inherit", cursor: "pointer", fontSize: "0.68rem", fontWeight: 700, textAlign: "right", pb: 0.5, borderRadius: "6px 6px 0 0", bgcolor: i === month ? "#e4ecfd" : "transparent", color: i === month ? "#2459d1" : FAINT }}>{m}</Box>
          ))}
          {SHEET.map((id) => (
            <Box key={id} sx={{ display: "contents" }}>
              <Box sx={{ py: 0.55, borderTop: `1px solid ${HAIRLINE}`, minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: "0.82rem", fontWeight: 600, color: INK }}>{MEASURES[id].label}</Typography>
                <Typography sx={{ fontSize: "0.68rem", color: FAINT }}>{id} · {sourceOf(id)}</Typography>
              </Box>
              {MONTHS.map((_, i) => {
                const f = cell(id, i);
                return (
                  <Typography key={i} title={f.from === "ga4" ? "GA4's figure - not saved yet" : f.from === "typed" ? "typed" : f.from === "live" ? `read by the hub (${sourceOf(id)})` : undefined}
                    sx={{ py: 0.55, px: 0.5, borderTop: `1px solid ${HAIRLINE}`, fontSize: "0.8rem", textAlign: "right", fontVariantNumeric: "tabular-nums", display: "flex", alignItems: "center", justifyContent: "flex-end",
                      bgcolor: i === month ? "#f3f7fe" : "transparent", color: f.from === "ga4" ? "#2459d1" : i >= done ? FAINT : INK, fontStyle: f.from === "ga4" ? "italic" : "normal" }}>
                    {forScreen(id, f.v)}
                  </Typography>
                );
              })}
            </Box>
          ))}
        </Box>
      </Box>
      <Typography sx={{ fontSize: "0.74rem", color: FAINT, mt: 1 }}>In blue italics: GA4&apos;s figure for a row the hub does not read yet (purchases, SEO revenue) - Save it below to keep it. Cart and check-out abandonment, SEA cost and revenue are typed: GA4 does not give the sheet&apos;s figures for them.</Typography>
    </GlassCard>
  );
}

export default function MonthlyInputs() {
  const [state] = useMarketingKpis();
  const [inputs, setInputs] = useState<Inputs | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  useEffect(() => { if (state?.inputs) setInputs(state.inputs); }, [state?.inputs]);
  const canEdit = !!state?.canEdit;
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: { xs: 2, sm: 2.5, md: 3, lg: 4 }, py: { xs: 2.5, md: 3 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader title="Monthly inputs" subtitle="Dashboard 2026 filled by the hub - copy the month into the shared sheet; type only what nothing reads" />
      {!inputs && <GlassCard><Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>{!state?.error && <CircularProgress size={18} />}<Typography sx={{ fontSize: "0.9rem", color: state?.error ? RED : MUTED }}>{state?.error ?? "Loading…"}</Typography></Box></GlassCard>}
      {inputs && (
        <>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: MUTED }}>Year</Typography>
            {[year - 1, year, year + 1].map((y) => (
              <Box key={y} component="button" onClick={() => setYear(y)} sx={{ border: `1px solid ${y === year ? "#2459d1" : HAIRLINE}`, bgcolor: y === year ? "#e4ecfd" : "#fff", color: y === year ? "#2459d1" : MUTED, borderRadius: "999px", px: 1.3, py: 0.4, cursor: "pointer", fontFamily: "inherit", fontSize: "0.8rem", fontWeight: 600 }}>{y}</Box>
            ))}
          </Box>
          <SheetMonths year={year} inputs={inputs} live={state?.live?.value} />
          <GlassCard>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, flexWrap: "wrap" }}>
              <Typography sx={{ flex: 1, fontSize: "0.98rem", fontWeight: 700, color: INK }}>Typed - the rows nothing reads yet</Typography>
            </Box>
            <Typography sx={{ fontSize: "0.78rem", color: MUTED, mb: 1 }}>
              {canEdit ? "Type a month and press Save on its row. Purchases and SEO revenue come in from GA4 (blue) - Save keeps them. Rates in percent (29 = 29%). Empty clears a month." : "Read only - typing needs edit rights on Advanced reporting."}
            </Typography>
            <Box sx={{ overflowX: "auto" }}>
              <Box sx={{ minWidth: 1100 }}>
                <Box sx={{ display: "grid", gridTemplateColumns: `minmax(190px, 1.4fr) repeat(12, minmax(62px, 1fr)) 92px`, gap: "4px" }}>
                  <Typography sx={{ fontSize: "0.68rem", color: FAINT, fontWeight: 700, textTransform: "uppercase" }}>KPI</Typography>
                  {MONTHS.map((m) => <Typography key={m} sx={{ fontSize: "0.68rem", color: FAINT, fontWeight: 700, textAlign: "right" }}>{m}</Typography>)}
                  <span />
                </Box>
                {TYPED.map((id) => <Row key={`${id}-${year}`} id={id} year={year} inputs={inputs} live={state?.live?.value} canEdit={canEdit} onSaved={setInputs} />)}
              </Box>
            </Box>
          </GlassCard>
          <GlassCard>
            <Typography sx={{ fontSize: "0.98rem", fontWeight: 700, color: INK }}>Targets {year}</Typography>
            <Typography sx={{ fontSize: "0.78rem", color: MUTED, mb: 1 }}>For the whole year. Bounce rate is a maximum. Started from the SMEC targets and the sheet&apos;s benchmarks; the SEO revenue target was not legible in the sheet.</Typography>
            {TARGETS.map((id) => <TargetRow key={`${id}-${year}`} id={id} year={year} inputs={inputs} canEdit={canEdit} onSaved={setInputs} />)}
          </GlassCard>
          <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>
            {inputs.updatedAt ? `Last saved ${new Date(inputs.updatedAt).toLocaleString("en-GB")} by ${inputs.updatedBy}.` : "Not changed since the import from Dashboard 2026."}
          </Typography>
        </>
      )}
    </Box>
  );
}
