"use client";
// MONTHLY INPUTS - the marketing KPIs no connector reads yet, typed month by
// month (SEA from Google and Bing Ads, cart and check-out abandonment, the GA4
// figures as the team reports them), and the year's targets. Started from
// SARCLA's "Dashboard 2026". Rates are typed in percent (29 = 29%). Editing
// needs edit rights on Advanced reporting; everyone else reads.

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";

import PageHeader from "@/app/PageHeader";
import { FAINT, GREEN, GlassCard, HAIRLINE, INK, MUTED, RED } from "@/app/uc/report/ui";
import { MEASURES, TYPED } from "@/lib/marketingKpis/measures";
import type { Inputs } from "@/lib/marketingKpis/seed";
import { MONTHS, useMarketingKpis } from "../data";

const TARGETS = ["F01", "P06", "E01", "E02", "P07", "V01", "P01", "L01"];
const isPct = (id: string) => MEASURES[id]?.fmt === "pct";
const show = (id: string, v: number | undefined) => (v == null ? "" : isPct(id) ? String(+(v * 100).toFixed(3)) : String(v));
const parse = (id: string, raw: string): number | null | "bad" => {
  const t = raw.trim().replace(/['’\s]/g, "").replace(/%$/, "");
  if (!t) return null;
  const n = Number(t.replace(/,/g, "."));
  if (!Number.isFinite(n)) return "bad";
  return isPct(id) ? n / 100 : n;
};

function Row({ id, year, inputs, canEdit, onSaved }: { id: string; year: number; inputs: Inputs; canEdit: boolean; onSaved: (i: Inputs) => void }) {
  const keys = MONTHS.map((_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  const initial = useMemo(() => keys.map((k) => show(id, inputs.months[id]?.[k])), [inputs, id, year]); // eslint-disable-line react-hooks/exhaustive-deps
  const [vals, setVals] = useState<string[]>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setVals(initial), [initial]);
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
        <Typography sx={{ fontSize: "0.7rem", color: FAINT }}>{id} · {isPct(id) ? "in %" : m.fmt === "chf" ? "CHF" : m.fmt === "dec1" ? "position" : "count"}</Typography>
      </Box>
      {vals.map((v, i) => (
        <Box key={i} component="input" value={v} disabled={!canEdit} inputMode="decimal" aria-label={`${m.label} ${MONTHS[i]} ${year}`}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVals(vals.map((x, j) => (j === i ? e.target.value : x)))}
          sx={{ width: "100%", minWidth: 0, fontFamily: "inherit", fontSize: "0.8rem", textAlign: "right", px: 0.75, py: 0.6, borderRadius: "8px",
            border: `1px solid ${v !== initial[i] ? "#2459d1" : HAIRLINE}`, bgcolor: canEdit ? "#fff" : "transparent", color: INK, fontVariantNumeric: "tabular-nums" }} />
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

export default function MonthlyInputs() {
  const [state] = useMarketingKpis();
  const [inputs, setInputs] = useState<Inputs | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  useEffect(() => { if (state?.inputs) setInputs(state.inputs); }, [state?.inputs]);
  const canEdit = !!state?.canEdit;
  return (
    <Box sx={{ px: { xs: 2, sm: 2.5, md: 3, lg: 4 }, py: { xs: 2.5, md: 3 }, display: "grid", gap: 2.5, maxWidth: 1500 }}>
      <PageHeader title="Monthly inputs" subtitle="The marketing KPIs no connector reads yet - typed once a month, then everywhere in Marketing KPIs" />
      {!inputs && <GlassCard><Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>{!state?.error && <CircularProgress size={18} />}<Typography sx={{ fontSize: "0.9rem", color: state?.error ? RED : MUTED }}>{state?.error ?? "Loading…"}</Typography></Box></GlassCard>}
      {inputs && (
        <>
          <GlassCard>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, flexWrap: "wrap" }}>
              <Typography sx={{ flex: 1, fontSize: "0.98rem", fontWeight: 700, color: INK }}>Months</Typography>
              {[year - 1, year, year + 1].map((y) => (
                <Box key={y} component="button" onClick={() => setYear(y)} sx={{ border: `1px solid ${y === year ? "#2459d1" : HAIRLINE}`, bgcolor: y === year ? "#e4ecfd" : "#fff", color: y === year ? "#2459d1" : MUTED, borderRadius: "999px", px: 1.3, py: 0.4, cursor: "pointer", fontFamily: "inherit", fontSize: "0.8rem", fontWeight: 600 }}>{y}</Box>
              ))}
            </Box>
            <Typography sx={{ fontSize: "0.78rem", color: MUTED, mb: 1 }}>
              {canEdit ? "Type a month and press Save on its row. Rates in percent (29 = 29%). Empty clears a month. Conversion, CTR and ROAS are worked out from these." : "Read only - typing needs edit rights on Advanced reporting."}
            </Typography>
            <Box sx={{ overflowX: "auto" }}>
              <Box sx={{ minWidth: 1100 }}>
                <Box sx={{ display: "grid", gridTemplateColumns: `minmax(190px, 1.4fr) repeat(12, minmax(62px, 1fr)) 92px`, gap: "4px" }}>
                  <Typography sx={{ fontSize: "0.68rem", color: FAINT, fontWeight: 700, textTransform: "uppercase" }}>KPI</Typography>
                  {MONTHS.map((m) => <Typography key={m} sx={{ fontSize: "0.68rem", color: FAINT, fontWeight: 700, textAlign: "right" }}>{m}</Typography>)}
                  <span />
                </Box>
                {TYPED.map((id) => <Row key={`${id}-${year}`} id={id} year={year} inputs={inputs} canEdit={canEdit} onSaved={setInputs} />)}
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
