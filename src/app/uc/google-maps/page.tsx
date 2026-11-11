"use client";

// APSOMAPS > Google Maps link (SARCLA 10.11.2026: "gmaps query - create a complete sub app, for the moment with only GMAPS
// query inside"; named APSOMaps on 11.11.2026: "instead of company data call it APSOMaps"). Replaces the workflow
// "SARCLA | GMAPS QUERY WITH CODE": every company without a Google Maps link gets one made of its name and address, by
// the hub. Reads /api/uc/company-maps (src/lib/companyMaps). The sub app's page (UC_SECTIONS "APSOMaps", slug
// company-data, in hubApps.ts).

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import CircularProgress from "@mui/material/CircularProgress";
import MapOutlinedIcon from "@mui/icons-material/MapOutlined";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import WrongLocationOutlinedIcon from "@mui/icons-material/WrongLocationOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import RuleOutlinedIcon from "@mui/icons-material/RuleOutlined";
import PageHeader from "@/app/PageHeader";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { full } from "@/app/charts/format";
import { CardTitle, FAINT, GlassCard, INK, KpiTile, MUTED, bodyCell, clip, headCell } from "@/app/uc/report/ui";
import { Choice, Info, usePaged, when } from "@/app/connectors/parts";
import type { Row, RunInfo, Settings } from "@/lib/companyMaps/engine";

const API = "/api/uc/company-maps";
const HS_COMPANY = (id: string) => `https://app-eu1.hubspot.com/contacts/26492587/record/0-2/${id}`;
type Data = {
  settings: Settings; last: RunInfo | null; workflowOn: boolean | null; writing: boolean; admin: boolean;
  at: string | null; companies: number | null; withLink: number | null;
  waiting: Row[]; waitingCount: number; done: Row[]; doneCount: number;
};
type View = "waiting" | "done";

function MapsLink() {
  const [n, setN] = useState(0);
  const url = `${API}${n ? `?n=${n}` : ""}`;
  const held = useHeld<Data>(url, [url]);
  const r = held.result;
  const d = r?.state === "ok" ? r.data : null;
  const [view, setView] = useState<View>("waiting");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return ((view === "waiting" ? d?.waiting : d?.done) ?? []).filter((x) => !t || `${x.name} ${x.query}`.toLowerCase().includes(t));
  }, [d, q, view]);
  const { slice, pager } = usePaged(rows, 25);

  if (r === null) return <LoadingPanel label="Reading the companies without a Google Maps link…" />;
  if (!d) return <UpstreamPanel source="Google Maps link" error={r.state === "error" ? r.error : "not there yet - this page fills in once the hub is deployed"} status={r.state === "error" ? r.status : null} onRetry={() => setN((x) => x + 1)} />;

  const call = async (what: string, method: "PUT" | "POST", body: unknown) => {
    setBusy(what); setMsg(null);
    try {
      const res = await fetch(API, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await res.json()) as { ok: boolean; error?: string };
      setMsg(j.ok ? (what === "run" ? "Looking now - the lists are new within a minute." : "Done.") : j.error ?? `HTTP ${res.status}`);
      setN((x) => x + 1);
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(null); }
  };
  const mode = d.settings.mode;
  const share = d.companies && d.withLink !== null ? Math.round((d.withLink / d.companies) * 1000) / 10 : null;

  return (
    <>
      {mode !== "live" ? (
        <Info>{mode === "shadow" ? "Paused - no link is written until it is switched back on below." : "Off - nothing is looked at."}</Info>
      ) : !d.writing ? (
        <Info><b>Waiting:</b> the HubSpot workflow “SARCLA | GMAPS QUERY WITH CODE” is {d.workflowOn ? "still switched on" : "not readable"} - the hub writes nothing while it runs. {full(d.waitingCount)} compan{d.waitingCount === 1 ? "y gets its" : "ies get their"} link once it is off.</Info>
      ) : (
        <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Automatic: every 15 minutes each company without a Google Maps link gets one, made of its name and address - 1,000 a run.</Typography>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<BusinessOutlinedIcon />} tint="slate" label="Companies" value={d.companies !== null ? full(d.companies) : "—"} note={d.at ? `read ${when(d.at)}` : "read within minutes of the deploy"} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<MapOutlinedIcon />} tint="green" label="With a Google Maps link" value={d.withLink !== null ? full(d.withLink) : "—"} note={share !== null ? `${share.toLocaleString("de-CH")} % of the companies` : undefined} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<WrongLocationOutlinedIcon />} tint="amber" label="Without a link" value={d.at ? full(d.waitingCount) : "—"} note="each gets its link at the next run" /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<TaskAltOutlinedIcon />} tint="blue" label="Written by the hub" value={full(d.doneCount)} note="last 30 days" /></Grid>
      </Grid>

      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<RuleOutlinedIcon />} tint="purple" title="How the link is made"
          note="Google Maps' own search link with the company's name, street, second address line, postcode, city, state and country, joined by commas - without an address, the name alone. A company created or changed in the last 3 minutes waits for the next run, so its address can arrive first. A link once written is kept: the hub never writes over a link, its own or a person's." />
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap", mb: 1.5 }}>
          <Choice<View> value={view} onChange={setView} options={[{ key: "waiting", label: "Without a link", count: d.waitingCount }, { key: "done", label: "Written by the hub", count: d.doneCount }]} />
          <TextField size="small" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a company or an address" sx={{ width: { xs: "100%", sm: 320 } }} />
        </Box>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 760, tableLayout: "fixed" }}>
            <colgroup><col style={{ width: "26%" }} /><col style={{ width: "50%" }} /><col style={{ width: "24%" }} /></colgroup>
            <TableHead><TableRow>{["Company", "The link searches for", view === "waiting" ? "Created" : "Written"].map((h, i) => <TableCell key={i} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {slice.map((x) => (
                <TableRow key={x.id}>
                  <TableCell sx={bodyCell}>
                    <Box component="a" href={HS_COMPANY(x.id)} target="_blank" rel="noopener" sx={{ color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(320) }}>{x.name || x.id}</Box>
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", overflowWrap: "anywhere" }}>
                    {x.link ? <Box component="a" href={x.link} target="_blank" rel="noopener" sx={{ color: "#2459d1", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>{x.query}</Box> : <span style={{ color: FAINT }}>no name and no address - nothing to link</span>}
                    {x.written?.error && <Box sx={{ fontSize: "0.74rem", color: "#b4232f" }}>{x.written.error}</Box>}
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED, whiteSpace: "nowrap" }}>{view === "done" && x.written ? when(x.written.at) : x.created ? when(x.created) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
        {pager}
        {!rows.length && <Typography sx={{ fontSize: "0.85rem", color: MUTED, mt: 1 }}>{q ? "Nothing matches." : view === "waiting" ? "Every company has its link." : "Nothing written yet."}</Typography>}
        {d.last?.error && <Typography sx={{ fontSize: "0.78rem", color: "#b4232f", mt: 1 }}>Last run {when(d.last.at)}: {d.last.error}</Typography>}
      </GlassCard>

      {d.admin && (
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
          <Typography sx={{ fontSize: "0.78rem", color: FAINT }}>Admin:</Typography>
          <Button size="small" variant="text" disabled={!!busy} onClick={() => void call("mode", "PUT", { mode: mode === "live" ? "shadow" : "live" })} sx={{ textTransform: "none" }}>{mode === "live" ? "Pause" : "Switch on"}</Button>
          <Button size="small" variant="text" disabled={!!busy || mode === "off"} onClick={() => void call("run", "POST", { action: "run" })} sx={{ textTransform: "none" }}>Run now</Button>
          {busy && <CircularProgress size={14} />}
          {msg && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{msg}</Typography>}
        </Box>
      )}
    </>
  );
}

export default function GoogleMapsPage() {
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader title="APSOMaps" subtitle="Google Maps link: each company's address as a link to Google Maps, written by the hub" />
      <MapsLink />
    </Box>
  );
}
