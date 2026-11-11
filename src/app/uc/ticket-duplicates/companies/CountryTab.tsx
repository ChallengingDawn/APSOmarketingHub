"use client";

// DUPLICATES & MERGES > Companies > Country (SARCLA 11.11.2026: "for the country correction it should be a tab here", in
// Companies). Replaces the workflow "SARCLA | REGION TO COUNTRY CUSTOM" - the last ON workflow of the legacy app SARCLA |
// COMPANY SEGMENTATION: every company with a country gets country_custom, HubSpot's country list the regions, phones and
// duplicates read. The hub writes the ones it is sure of; for the rest a person picks the value here. Reads
// /api/uc/company-country (src/lib/companyCountry). Was the page /uc/company-country for a few hours (now a redirect here).

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Autocomplete from "@mui/material/Autocomplete";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import CircularProgress from "@mui/material/CircularProgress";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import PlaylistAddCheckOutlinedIcon from "@mui/icons-material/PlaylistAddCheckOutlined";
import PersonSearchOutlinedIcon from "@mui/icons-material/PersonSearchOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import RuleOutlinedIcon from "@mui/icons-material/RuleOutlined";
import { LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { full } from "@/app/charts/format";
import { CardTitle, FAINT, GlassCard, INK, KpiTile, MUTED, bodyCell, clip, headCell } from "@/app/uc/report/ui";
import { Choice, Info, usePaged, when } from "@/app/connectors/parts";
import type { Row, RunInfo, Settings } from "@/lib/companyCountry/engine";
import { EngineCard } from "../EngineCard";

const API = "/api/uc/company-country";
const RED = "#b4232f";
const HS_COMPANY = (id: string) => `https://app-eu1.hubspot.com/contacts/26492587/record/0-2/${id}`;
type Data = {
  settings: Settings; last: RunInfo | null; workflowOn: boolean | null; writing: boolean; admin: boolean;
  at: string | null; withCountry: number | null; withValue: number | null;
  waiting: Row[]; waitingCount: number; forPerson: number; done: Row[]; doneCount: number; options: string[];
};
type View = "waiting" | "done";

/** A person picks the dropdown's value for one company; the row shows it at once. */
function Pick({ r, options, onDone }: { r: Row; options: string[]; onDone: (id: string, value: string) => void }) {
  const [value, setValue] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    if (!value) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "set", id: r.id, value }) });
      const j = (await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }))) as { ok: boolean; error?: string };
      if (j.ok) onDone(r.id, value); else setErr(j.error ?? "Not saved");
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Box>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
        <Autocomplete<string, false, false>
          size="small" options={options} value={value} onChange={(_, v) => { setValue(v); setErr(null); }}
          sx={{ width: 230 }} renderInput={(p) => <TextField {...p} placeholder="Pick the country" inputProps={{ ...p.inputProps, "aria-label": `Country of ${r.name || r.id}` }} />}
        />
        <Button size="small" variant="contained" disableElevation disabled={busy || !value} onClick={() => void save()} sx={{ textTransform: "none", minWidth: 64 }}>
          {busy ? <CircularProgress size={14} color="inherit" /> : "Save"}
        </Button>
      </Box>
      {err && <Box sx={{ fontSize: "0.74rem", color: RED, mt: 0.5, maxWidth: 380 }}>{err}</Box>}
    </Box>
  );
}

export function CountryTab() {
  const [n, setN] = useState(0);
  const url = `${API}${n ? `?n=${n}` : ""}`;
  const held = useHeld<Data>(url, [url]);
  const r = held.result;
  const d = r?.state === "ok" ? r.data : null;
  const [view, setView] = useState<View>("waiting");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Record<string, string>>({});
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return ((view === "waiting" ? d?.waiting : d?.done) ?? []).filter((x) => !t || `${x.name} ${x.country} ${x.city} ${x.value ?? ""}`.toLowerCase().includes(t));
  }, [d, q, view]);
  const { slice, pager } = usePaged(rows, 25);

  if (r === null) return <LoadingPanel label="Reading the companies without a country value…" />;
  if (!d) return <UpstreamPanel source="Country" error={r.state === "error" ? r.error : "not there yet - this page fills in once the hub is deployed"} status={r.state === "error" ? r.status : null} onRetry={() => setN((x) => x + 1)} />;

  const mode = d.settings.mode;
  const sure = d.waitingCount - d.forPerson;
  const share = d.withCountry && d.withValue !== null ? Math.round((Math.min(d.withValue, d.withCountry) / d.withCountry) * 1000) / 10 : null;

  return (
    <>
      {mode !== "live" ? (
        <Info>{mode === "shadow" ? "Paused - no value is written until it is switched back on below." : "Off - nothing is looked at."}</Info>
      ) : !d.writing ? (
        <Info><b>Waiting:</b> the HubSpot workflow “SARCLA | REGION TO COUNTRY CUSTOM” is {d.workflowOn ? "still switched on" : "not readable"} - the hub writes nothing while it runs. {full(sure)} compan{sure === 1 ? "y gets its" : "ies get their"} value once it is off.</Info>
      ) : (
        <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Automatic: every 15 minutes each company with a country and no value in HubSpot&apos;s country list gets one, when the hub is sure of it.</Typography>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<BusinessOutlinedIcon />} tint="slate" label="With a country" value={d.withCountry !== null ? full(d.withCountry) : "—"} note={d.at ? `read ${when(d.at)}` : "read within minutes of the deploy"} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<PublicOutlinedIcon />} tint="green" label="In the country list" value={d.withValue !== null ? full(d.withValue) : "—"} note={share !== null ? `${share.toLocaleString("de-CH")} % of those with a country` : undefined} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<PlaylistAddCheckOutlinedIcon />} tint="blue" label="The hub writes" value={d.at ? full(sure) : "—"} note="at the next run" /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<PersonSearchOutlinedIcon />} tint="amber" label="For a person" value={d.at ? full(d.forPerson) : "—"} note="a country the hub does not know: pick it below" /></Grid>
      </Grid>

      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<RuleOutlinedIcon />} tint="purple" title="How the country is found"
          note="The company's country is compared, without case, accents or dots, with HubSpot's country list, the workflow's own table, the two- and three-letter country codes (CH, CHE) and the countries' names in German, French, Italian and the other languages of our customers (Schweiz, Suisse, Svizzera). Exactly one match: the hub writes it. None, or two: a person picks it here. A value once set is kept - the hub never writes over the list, its own value or a person's." />
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap", mb: 1.5 }}>
          <Choice<View> value={view} onChange={setView} options={[{ key: "waiting", label: "Without a value", count: d.waitingCount }, { key: "done", label: "Written", count: d.doneCount }]} />
          <TextField size="small" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a company, country or city" sx={{ width: { xs: "100%", sm: 320 } }} />
        </Box>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 820, tableLayout: "fixed" }}>
            <colgroup><col style={{ width: "30%" }} /><col style={{ width: "22%" }} /><col style={{ width: "33%" }} /><col style={{ width: "15%" }} /></colgroup>
            <TableHead><TableRow>{["Company", "Its country", "In the country list", view === "waiting" ? "Created" : "Written"].map((h, i) => <TableCell key={i} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {slice.map((x) => {
                const mine = picked[x.id];
                return (
                  <TableRow key={x.id}>
                    <TableCell sx={bodyCell}>
                      <Box component="a" href={HS_COMPANY(x.id)} target="_blank" rel="noopener" sx={{ color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(320) }}>{x.name || x.id}</Box>
                      {x.city && <Box sx={{ fontSize: "0.74rem", color: FAINT }}>{x.city}</Box>}
                    </TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", color: INK }}>“{x.country}”</TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.84rem" }}>
                      {mine ? <Box sx={{ color: INK, fontWeight: 600 }}>{mine} <span style={{ color: MUTED, fontWeight: 400 }}>· saved</span></Box>
                        : view === "done" ? <Box sx={{ color: INK, fontWeight: 600 }}>{x.written?.value ?? x.value} <span style={{ color: MUTED, fontWeight: 400 }}>· {x.written?.by === "the hub" ? "the hub" : "by hand"}</span></Box>
                        : x.value ? <Box sx={{ color: INK }}>{x.value} <span style={{ color: MUTED }}>· the hub writes it</span></Box>
                        : <Pick r={x} options={d.options} onDone={(id, v) => setPicked((s) => ({ ...s, [id]: v }))} />}
                      {!mine && view === "waiting" && !x.value && <Box sx={{ fontSize: "0.72rem", color: FAINT, mt: 0.25 }}>{x.reason === "two" ? "matches two countries" : "a country the hub does not know"}</Box>}
                      {x.written?.error && <Box sx={{ fontSize: "0.74rem", color: RED }}>{x.written.error}</Box>}
                    </TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED, whiteSpace: "nowrap" }}>{view === "done" && x.written ? when(x.written.at) : x.created ? when(x.created) : "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
        {pager}
        {!rows.length && <Typography sx={{ fontSize: "0.85rem", color: MUTED, mt: 1 }}>{q ? "Nothing matches." : view === "waiting" ? (d.at ? "Every company with a country has its value." : "The companies are read within minutes of the deploy.") : "Nothing written yet."}</Typography>}
        {d.last?.error && <Typography sx={{ fontSize: "0.78rem", color: RED, mt: 1 }}>Last run {when(d.last.at)}: {d.last.error}</Typography>}
      </GlassCard>
    </>
  );
}

/** Companies > Settings: how Country runs (the engine's switches, never on the Country tab itself). */
export function CountrySettings() {
  const n = (v: unknown) => full(Number(v ?? 0));
  return (
    <EngineCard api={API} title="Country" tint="green" workflow="SARCLA | REGION TO COUNTRY CUSTOM" every="Every 15 minutes, up to 1,000 companies a run"
      look={{ title: "Look for companies without a country value", on: "Every company with a country and nothing in HubSpot's country list is read and its country matched.", off: "Off: nothing is looked at." }}
      live={{ title: "Live - write by itself", on: "A country the hub is sure of is written into HubSpot's country list, read again first - never over a value already there.", shadow: "Shadow: found and listed on the Country tab, nothing written.",
        ask: "Switch Country LIVE?\n\nEvery 15 minutes the hub writes the country list value of each company whose country it is sure of, read again first. A value already there is never changed." }}
      lastLine={(l) => `${n(l.without)} without a value, ${n(l.sure)} sure, ${n(l.written)} written`} />
  );
}
