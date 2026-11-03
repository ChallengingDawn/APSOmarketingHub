"use client";

// MAP ASSIGNMENT - Regions (SARCLA 03.11.2026: "SARCLA | REGIONS SET can we then proceed to this migration? also I think
// data is not entirely correct - on map assignment new tab"). Each company of the workflow's eight countries and the
// region its postcode gives - the official one (GeoNames' postal codes), else the map's; "Check all" lists the companies
// whose "regions" is wrong, "Correct them" writes them (admins, in Live). Reads/writes /api/uc/company-regions
// (src/lib/companyRegions).

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import CircularProgress from "@mui/material/CircularProgress";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import EditLocationAltOutlinedIcon from "@mui/icons-material/EditLocationAltOutlined";
import LocationOffOutlinedIcon from "@mui/icons-material/LocationOffOutlined";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { CardTitle, FAINT, GlassCard, INK, KpiTile, MUTED, RED, bodyCell, clip, headCell } from "@/app/uc/report/ui";
import { Chip, Choice, Info, usePaged, when } from "@/app/connectors/parts";
import type { Check, CountryCount, Correcting, Fix, RunInfo, Settings } from "@/lib/companyRegions/engine";
import { countryName, hsCompany } from "./shared";

const API = "/api/uc/company-regions";
type Data = {
  settings: Settings; last: RunInfo | null; state: { at: string; recent: Fix[] }; correcting: Correcting | null;
  check: (Check & { counts: { fix: number; written: number; failed: number; skipped: number; byCountry: Record<string, number> } }) | null;
  workflowOn: boolean | null; writing: boolean; admin: boolean;
};
const VIA: Record<Fix["via"], string> = { postcode: "official postcode", map: "the map (postcode not in the official list)", none: "no postcode region" };
const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 1000) / 10}%` : "—");

/** What the hub did with a company. */
function Status({ f, writing }: { f: Fix; writing: boolean }) {
  if (f.written?.error) return <Chip tint="pink">not written</Chip>;
  if (f.written?.skipped) return <Chip tint="slate">changed since</Chip>;
  if (f.written) return <Chip tint="green">written</Chip>;
  return <Chip tint={writing ? "amber" : "slate"}>{writing ? "to write" : "would write"}</Chip>;
}

function FixTable({ rows, writing }: { rows: Fix[]; writing: boolean }) {
  const { slice, pager } = usePaged(rows, 15);
  return (
    <>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead><TableRow>{["Company", "Postcode", "Region now", "Becomes", ""].map((h, i) => <TableCell key={i} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {slice.map((f) => (
              <TableRow key={f.id}>
                <TableCell sx={bodyCell}>
                  <Box component="a" href={hsCompany(f.id)} target="_blank" rel="noopener" sx={{ color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(280) }}>{f.name || f.id}</Box>
                  <Box sx={{ fontSize: "0.74rem", color: MUTED }}>{countryName(f.cc)}</Box>
                </TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", whiteSpace: "nowrap" }}>
                  {f.zip || <Box component="span" sx={{ color: FAINT }}>none</Box>}
                  {f.city && <Box sx={{ fontSize: "0.74rem", color: MUTED, ...clip(160) }}>{f.city}</Box>}
                </TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", color: f.now ? INK : FAINT }}>{f.now ?? "empty"}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>
                  <Box sx={{ fontWeight: 600, color: INK }}>{f.to}</Box>
                  <Box sx={{ fontSize: "0.74rem", color: MUTED }}>{VIA[f.via]}</Box>
                  {f.written?.error && <Box sx={{ fontSize: "0.74rem", color: RED }}>{f.written.error}</Box>}
                </TableCell>
                <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}><Status f={f} writing={writing} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      {pager}
    </>
  );
}

export function RegionsView() {
  const [n, setN] = useState(0);
  const url = `${API}${n ? `?n=${n}` : ""}`;
  const held = useHeld<Data>(url, [url]);
  const r = held.result;
  const d = r?.state === "ok" ? r.data : null;
  const busyJob = !!(d?.check?.running || d?.correcting?.running);
  useEffect(() => {
    if (!busyJob) return;
    const t = setTimeout(() => setN((x) => x + 1), 10_000);
    return () => clearTimeout(t);
  }, [busyJob, n]);
  const [cc, setCc] = useState<string>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  if (r === null) return <LoadingPanel label="Reading the regions…" />;
  if (!d) return <UpstreamPanel source="Regions" error={r.state === "error" ? r.error : "not there yet - this tab fills in once the hub is deployed"} status={r.state === "error" ? r.status : null} onRetry={() => setN((x) => x + 1)} />;

  const call = async (what: string, method: "PUT" | "POST", body: unknown) => {
    setBusy(what); setMsg(null);
    try {
      const res = await fetch(API, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await res.json()) as { ok: boolean; error?: string };
      setMsg(j.ok ? "Done." : j.error ?? `HTTP ${res.status}`);
      setN((x) => x + 1);
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(null); }
  };
  const mode = d.settings.mode;
  const c = d.check;
  const tot = Object.values(c?.byCountry ?? {}).reduce<CountryCount>((a, x) => ({ companies: a.companies + x.companies, right: a.right + x.right, fix: a.fix + x.fix, none: a.none + x.none }), { companies: 0, right: 0, fix: 0, none: 0 });
  const countries = Object.entries(c?.byCountry ?? {}).sort((a, b) => b[1].companies - a[1].companies);
  const todo = c ? c.counts.fix - c.counts.written - c.counts.skipped : 0;
  const rows = (c?.fixes ?? []).filter((f) => cc === "all" || f.cc === cc);

  return (
    <>
      {mode !== "live" ? (
        <Info>{mode === "shadow" ? "Paused - the hub works each company's region out and shows it here, but writes nothing to HubSpot. Switch to Live below." : "Off - nothing is looked at."}</Info>
      ) : !d.writing ? (
        <Info><b>Live - waiting:</b> the HubSpot workflow “SARCLA | REGIONS SET” is {d.workflowOn ? "still switched on" : "not readable"} - the hub writes nothing while it runs. Switch it off in HubSpot (Automation → Workflows) and the hub goes on within 15 minutes.</Info>
      ) : null}

      <Grid container spacing={2}>
        {[
          { label: "Companies", value: c?.at ? full(tot.companies) : "—", note: c?.at ? `Austria, France, Germany, Italy, Liechtenstein, Netherlands, Poland, Switzerland · checked ${when(c.at)}` : "Not checked yet", icon: <PublicOutlinedIcon />, tint: "slate" as const },
          { label: "Region right", value: c?.at ? full(tot.right) : "—", note: c?.at ? `${pct(tot.right, tot.companies)} - the region of their postcode` : "", icon: <FactCheckOutlinedIcon />, tint: "green" as const },
          { label: "To correct", value: c?.at ? full(Math.max(0, todo)) : "—", note: c?.at ? `${full(c.counts.written)} corrected · wrong region, another country's, or none` : "", icon: <EditLocationAltOutlinedIcon />, tint: "pink" as const },
          { label: "No postcode region", value: c?.at ? full(tot.none) : "—", note: "No postcode, or not one of the country's - their value is kept", icon: <LocationOffOutlinedIcon />, tint: "amber" as const },
        ].map((k) => <Grid key={k.label} size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={k.icon} tint={k.tint} label={k.label} value={k.value} note={k.note} /></Grid>)}
      </Grid>

      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<EditLocationAltOutlinedIcon />} tint="pink" title="Companies to correct"
          note="The region of the postcode: the official one (each postcode's canton, Land, département, province - GeoNames), else the map's. A postcode shared by two regions keeps the company's value when it is one of them; a value is never taken away."
          right={d.admin ? (
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <Button size="small" variant="outlined" disabled={!!busy || busyJob} onClick={() => void call("check", "POST", { action: "check" })} sx={{ textTransform: "none", whiteSpace: "nowrap" }}>{c?.at ? "Check all again" : "Check all"}</Button>
              <Button size="small" variant="contained" disableElevation disabled={!!busy || busyJob || !d.writing || todo <= 0}
                onClick={() => { if (window.confirm(`Correct the region of ${full(todo)} companies? Each one is read again first; every change is kept with what was there before.`)) void call("correct", "POST", { action: "correct" }); }}
                sx={{ textTransform: "none", whiteSpace: "nowrap" }}>Correct them</Button>
            </Box>
          ) : undefined} />
        {c?.running && <Typography sx={{ fontSize: "0.82rem", color: MUTED, mb: 1, display: "flex", gap: 1, alignItems: "center" }}><CircularProgress size={12} /> Checking - {c.progress}</Typography>}
        {d.correcting?.running && <Typography sx={{ fontSize: "0.82rem", color: MUTED, mb: 1, display: "flex", gap: 1, alignItems: "center" }}><CircularProgress size={12} /> Correcting - {full(d.correcting.done)} of {full(d.correcting.of)}{d.correcting.errors ? `, ${full(d.correcting.errors)} not written` : ""}</Typography>}
        {!d.correcting?.running && d.correcting?.at && <Typography sx={{ fontSize: "0.8rem", color: MUTED, mb: 1 }}>Corrected {when(d.correcting.at)}: {full(d.correcting.done)} of {full(d.correcting.of)}{d.correcting.skipped ? `, ${full(d.correcting.skipped)} changed since` : ""}{d.correcting.errors ? `, ${full(d.correcting.errors)} not written` : ""}.</Typography>}
        {c?.error && <Typography sx={{ fontSize: "0.82rem", color: RED, mb: 1 }}>The last check stopped: {c.error}</Typography>}
        {!d.writing && d.admin && c?.at && todo > 0 && <Typography sx={{ fontSize: "0.78rem", color: FAINT, mb: 1 }}>Correcting is possible in Live, once the workflow is switched off.</Typography>}
        {c?.at ? (
          <>
            <Box sx={{ overflowX: "auto", mb: 2 }}>
              <Table size="small">
                <TableHead><TableRow>{["Country", "Companies", "Right", "To correct", "No postcode region"].map((h, i) => <TableCell key={i} sx={{ ...headCell, textAlign: i ? "right" : "left" }}>{h}</TableCell>)}</TableRow></TableHead>
                <TableBody>
                  {countries.map(([k, x]) => (
                    <TableRow key={k} hover onClick={() => setCc(k)} sx={{ cursor: "pointer" }}>
                      <TableCell sx={{ ...bodyCell, fontWeight: cc === k ? 700 : 500 }}>{countryName(k)}</TableCell>
                      <TableCell sx={{ ...bodyCell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{full(x.companies)}</TableCell>
                      <TableCell sx={{ ...bodyCell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{full(x.right)} <Box component="span" sx={{ color: MUTED, fontSize: "0.76rem" }}>{pct(x.right, x.companies)}</Box></TableCell>
                      <TableCell sx={{ ...bodyCell, textAlign: "right", fontVariantNumeric: "tabular-nums", color: x.fix ? INK : FAINT, fontWeight: x.fix ? 700 : 400 }}>{full(x.fix)}</TableCell>
                      <TableCell sx={{ ...bodyCell, textAlign: "right", fontVariantNumeric: "tabular-nums", color: MUTED }}>{full(x.none)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
            <Box sx={{ mb: 1.5 }}>
              <Choice<string> value={cc} onChange={setCc} options={[
                { key: "all", label: "All", count: c.counts.fix },
                ...countries.filter(([, x]) => x.fix).map(([k, x]) => ({ key: k, label: countryName(k), count: x.fix })),
              ]} />
            </Box>
            <FixTable key={cc} rows={rows} writing={d.writing} />
            {rows.length < (cc === "all" ? c.counts.fix : c.byCountry[cc]?.fix ?? 0) && <Typography sx={{ fontSize: "0.76rem", color: FAINT, mt: 1 }}>{full(rows.length)} of {full(cc === "all" ? c.counts.fix : c.byCountry[cc]?.fix ?? 0)} are listed - the ones still to write first; each one is written with “Correct them”.</Typography>}
            {!rows.length && <Typography sx={{ fontSize: "0.85rem", color: MUTED, mt: 1 }}>Every region is right.</Typography>}
          </>
        ) : !c?.running && <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Not checked yet{d.admin ? " - “Check all” reads every company of the eight countries (a few minutes) and writes nothing." : "."}</Typography>}
      </GlassCard>

      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<HistoryOutlinedIcon />} tint="blue" title="Changed lately" note="New companies and changed postcodes, every 15 minutes - the ones whose region the hub gives (or would give) another value" />
        {d.state.recent.length ? <FixTable rows={d.state.recent} writing={d.writing} /> : <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{d.last ? "Nothing to change since the hub started looking." : "The first look comes within minutes of the deploy."}</Typography>}
      </GlassCard>

      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<TuneOutlinedIcon />} tint="blue" title="How it runs" note="Every 15 minutes: the companies of the eight countries created or changed since the last look" />
        <Box sx={{ display: "grid", gap: 1.5 }}>
          <Choice<"off" | "shadow" | "live"> value={mode} onChange={(m) => {
            if (!d.admin || m === mode) return;
            if (m === "live" && !window.confirm("Switch Regions to live? The hub writes each new or changed company's region once the HubSpot workflow is switched off. Every change is kept with what was there before.")) return;
            void call("mode", "PUT", { mode: m });
          }} options={[{ key: "live", label: "Live - the hub writes" }, { key: "shadow", label: "Paused - works it out, writes nothing" }, { key: "off", label: "Off" }]} />
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>
            {d.writing ? <>Writing{d.settings.liveFrom ? ` since ${when(d.settings.liveFrom)}` : ""}.</> : mode === "live" ? "Waiting for the workflow to be switched off." : mode === "shadow" ? "Paused: regions are worked out, nothing is written." : "Off."}
            {d.last ? ` Last look ${when(d.last.at)}: ${full(d.last.looked)} companies changed, ${full(d.last.fix)} to correct, ${full(d.last.written)} written${d.last.error ? ` - ${d.last.error}` : ""}.` : ""}
          </Typography>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
            Written: the company&apos;s <b>Regions</b> (&quot;BY - Bayern&quot;, &quot;ZH - Zürich&quot;, &quot;12 - Lazio&quot;) - and &quot;ZIP CODE UNKOWN&quot; only on an empty one whose postcode gives no region, as the workflow did.
          </Typography>
          {d.admin && (
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <Button variant="outlined" size="small" disabled={!!busy || mode === "off"} onClick={() => void call("run", "POST", { action: "run" })} sx={{ textTransform: "none" }}>Look now</Button>
              {busy && <CircularProgress size={14} />}
            </Box>
          )}
          {msg && <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>{msg}</Typography>}
          <Typography sx={{ fontSize: "0.74rem", color: FAINT, display: "flex", alignItems: "center", gap: 0.5 }}><PlaceOutlinedIcon sx={{ fontSize: 14 }} /> Postcodes: GeoNames (CC BY 4.0), read 03.11.2026.</Typography>
        </Box>
      </GlassCard>
    </>
  );
}
