"use client";

// MAP ASSIGNMENT - Domains (SARCLA 25.10.2026: "a new tab to replace the workflow SARCLA | COMPANY SETS DOMAIN").
// Every company without a domain and the domain the hub gives it - from its contacts' work e-mails or its website,
// never a guess from the name; "private or micro" companies (only private e-mail addresses, no legal form, never
// bought) go to Smart Segmentation as APSOmicro. The old name guesses the workflow wrote: found, looked up on the
// internet, and the ones that do not exist cleared (admins, in Live). Reads/writes /api/uc/company-domain
// (src/lib/companyDomain).

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
import LanguageOutlinedIcon from "@mui/icons-material/LanguageOutlined";
import TravelExploreOutlinedIcon from "@mui/icons-material/TravelExploreOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import DomainDisabledOutlinedIcon from "@mui/icons-material/DomainDisabledOutlined";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { CardTitle, FAINT, GlassCard, INK, KpiTile, MUTED, RED, bodyCell, clip, headCell } from "@/app/uc/report/ui";
import { Chip, Choice, Info, usePaged, when } from "@/app/connectors/parts";
import { KIND_TEXT, type Kind } from "@/lib/companyDomain/rules";
import type { Clearing, Guess, Guesses, Row, RunInfo, Settings } from "@/lib/companyDomain/engine";
import { hsCompany } from "./shared";

const API = "/api/uc/company-domain";
type Data = {
  settings: Settings; last: RunInfo | null; state: { at: string; rows: Row[] }; clearing: Clearing | null; workflowOn: boolean | null; writing: boolean; admin: boolean;
  guesses: (Guesses & { counts: { total: number; dead: number; alive: number; unsure: number; deadWithReal: number; cleared: number } }) | null;
};
type Filter = "all" | "found" | "micro" | Kind | "written";
type GuessFilter = "dead" | "alive" | "unsure";

/** What the hub did with a company. */
function Status({ r, writing }: { r: Row; writing: boolean }) {
  if (r.written?.error) return <Chip tint="pink">not written</Chip>;
  if (r.written) return <Chip tint="green">written</Chip>;
  if (!r.v.domain && !r.v.micro) return <Box component="span" sx={{ color: FAINT, fontSize: "0.8rem" }}>—</Box>;
  return <Chip tint={writing ? "amber" : "slate"}>{writing ? "next run" : "would write"}</Chip>;
}

export function DomainsView() {
  const [n, setN] = useState(0);
  const url = `${API}${n ? `?n=${n}` : ""}`;
  const held = useHeld<Data>(url, [url]);
  const r = held.result;
  const d = r?.state === "ok" ? r.data : null;
  const busyJob = !!(d?.guesses?.running || d?.clearing?.running);
  useEffect(() => {
    if (!busyJob) return;
    const t = setTimeout(() => setN((x) => x + 1), 10_000);
    return () => clearTimeout(t);
  }, [busyJob, n]);
  const [filter, setFilter] = useState<Filter>("all");
  const [gf, setGf] = useState<GuessFilter>("dead");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const rowsAll = d?.state.rows ?? [];
  const test: Record<Filter, (x: Row) => boolean> = {
    all: () => true, found: (x) => !!x.v.domain, micro: (x) => x.v.micro, written: (x) => !!x.written && !x.written.error,
    contacts: (x) => x.v.kind === "contacts", website: (x) => x.v.kind === "website", generic: (x) => x.v.kind === "generic", noemail: (x) => x.v.kind === "noemail", nocontacts: (x) => x.v.kind === "nocontacts",
  };
  const rows = rowsAll.filter(test[filter]).sort((a, b) => b.created.localeCompare(a.created));
  const { slice, pager } = usePaged(rows, 15);
  const g = d?.guesses ?? null;
  const gRows = (g?.rows ?? []).filter((x) => (gf === "dead" ? x.exists === false : gf === "alive" ? x.exists === true : x.exists === null));
  const gPaged = usePaged<Guess>(gRows, 15);

  if (r === null) return <LoadingPanel label="Reading the companies without a domain…" />;
  if (!d) return <UpstreamPanel source="Domains" error={r.state === "error" ? r.error : "not there yet - this tab fills in once the hub is deployed"} status={r.state === "error" ? r.status : null} onRetry={() => setN((x) => x + 1)} />;

  const call = async (what: string, method: "PUT" | "POST", body: unknown) => {
    setBusy(what); setMsg(null);
    try {
      const res = await fetch(API, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await res.json()) as { ok: boolean; error?: string };
      setMsg(j.ok ? "Done." : j.error ?? `HTTP ${res.status}`);
      setN((x) => x + 1);
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(null); }
  };
  const count = (f: Filter) => rowsAll.filter(test[f]).length;
  const without = rowsAll.filter((x) => !x.written || x.written.error).length;
  const fromContacts = count("contacts"), fromSite = count("website");
  const mode = d.settings.mode;

  return (
    <>
      {mode !== "live" ? (
        <Info>{mode === "shadow" ? "Paused - the hub works each domain out and shows it here, but writes nothing to HubSpot. Switch to Live below." : "Off - nothing is looked at."}</Info>
      ) : !d.writing ? (
        <Info><b>Live - waiting:</b> the HubSpot workflow “SARCLA | COMPANY SETS DOMAIN” is {d.workflowOn ? "still switched on" : "not readable"} - the hub writes nothing while it runs. Switch it off in HubSpot (Automation → Workflows) and the hub goes on within 15 minutes.</Info>
      ) : null}
      <Grid container spacing={2}>
        {[
          { label: "Without a domain", value: full(without), note: d.last ? `Every company in HubSpot with no domain · looked ${when(d.last.at)}` : "Looked at within minutes", icon: <DomainDisabledOutlinedIcon />, tint: "slate" as const },
          { label: "A real domain found", value: full(fromContacts + fromSite), note: `${full(fromContacts)} from contacts' work e-mails · ${full(fromSite)} from the website`, icon: <LanguageOutlinedIcon />, tint: "green" as const },
          { label: "Private or micro", value: full(count("micro")), note: "Only private e-mails, no legal form, never bought → APSOmicro", icon: <PersonOutlineIcon />, tint: "amber" as const },
          { label: "Old name guesses", value: g?.at ? full(g.counts.dead) : "—", note: g?.at ? `don't exist · ${full(g.counts.alive)} exist (may be another firm's) · of ${full(g.counts.total)}` : "Not looked for yet", icon: <TravelExploreOutlinedIcon />, tint: "pink" as const },
        ].map((k) => <Grid key={k.label} size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={k.icon} tint={k.tint} label={k.label} value={k.value} note={k.note} /></Grid>)}
      </Grid>

      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<LanguageOutlinedIcon />} tint="green" title="Companies without a domain"
          note="The domain comes from the contacts' work e-mails (the best-known ending first: .com, then .ch/.de/.fr/.it…) or the company's website - never guessed from the name. A company with none stays here until one turns up." />
        <Box sx={{ mb: 1.5 }}>
          <Choice<Filter> value={filter} onChange={setFilter} options={[
            { key: "all", label: "All", count: rowsAll.length }, { key: "found", label: "Domain found", count: count("found") },
            { key: "micro", label: "Private or micro", count: count("micro") }, { key: "generic", label: "Only private e-mails", count: count("generic") },
            { key: "noemail", label: "Contacts without e-mail", count: count("noemail") }, { key: "nocontacts", label: "No contact", count: count("nocontacts") },
            { key: "written", label: "Written", count: count("written") },
          ]} />
        </Box>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>{["Company", "Created", "Contacts", "What the hub gives it", ""].map((h, i) => <TableCell key={i} sx={{ ...headCell, textAlign: i === 2 ? "right" : "left" }}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {slice.map((x) => (
                <TableRow key={x.id}>
                  <TableCell sx={bodyCell}>
                    <Box component="a" href={hsCompany(x.id)} target="_blank" rel="noopener" sx={{ color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(300) }}>{x.name || x.id}</Box>
                    <Box sx={{ fontSize: "0.74rem", color: MUTED }}>{x.country || "no country"}</Box>
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED, whiteSpace: "nowrap" }}>{when(x.created)}</TableCell>
                  <TableCell sx={{ ...bodyCell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{full(x.contacts)}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>
                    {x.v.domain ? <Box sx={{ fontWeight: 600, color: INK }}>{x.v.domain}</Box> : x.v.micro ? <Box sx={{ fontWeight: 600, color: INK }}>APSOmicro</Box> : <Box component="span" sx={{ color: FAINT }}>no domain</Box>}
                    <Box sx={{ fontSize: "0.74rem", color: MUTED }}>{KIND_TEXT[x.v.kind]}{x.v.from.length ? ` · ${x.v.from.join(", ")}` : ""}{x.v.micro && x.v.domain === null ? " · private or micro" : ""}</Box>
                    {x.written?.error && <Box sx={{ fontSize: "0.74rem", color: RED }}>{x.written.error}</Box>}
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}><Status r={x} writing={d.writing} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
        {pager}
        {!rows.length && <Typography sx={{ fontSize: "0.85rem", color: MUTED, mt: 1 }}>{d.state.at ? "Nothing here." : "The first look comes within minutes of the deploy."}</Typography>}
      </GlassCard>

      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<TravelExploreOutlinedIcon />} tint="pink" title="Old name guesses"
          note="Domains the workflow made up from the name (“name.de”) - looked up on the internet. One that does not exist is cleared (the contacts' real domain goes in its place when there is one); one that exists may be another firm's: look before keeping it."
          right={d.admin ? (
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <Button size="small" variant="outlined" disabled={!!busy || busyJob} onClick={() => void call("scan", "POST", { action: "scan" })} sx={{ textTransform: "none", whiteSpace: "nowrap" }}>{g?.at ? "Look again" : "Find old guesses"}</Button>
              <Button size="small" variant="contained" disableElevation disabled={!!busy || busyJob || !d.writing || !g?.counts.dead || g.counts.dead === g.counts.cleared}
                onClick={() => { if (window.confirm(`Clear the ${full(g!.counts.dead - g!.counts.cleared)} guessed domains that do not exist? ${full(g!.counts.deadWithReal)} get their contacts' real domain instead. Every change is kept with what was there before.`)) void call("clear", "POST", { action: "clear" }); }}
                sx={{ textTransform: "none", whiteSpace: "nowrap" }}>Clear the ones that don&apos;t exist</Button>
            </Box>
          ) : undefined} />
        {g?.running && <Typography sx={{ fontSize: "0.82rem", color: MUTED, mb: 1, display: "flex", gap: 1, alignItems: "center" }}><CircularProgress size={12} /> {g.progress}</Typography>}
        {d.clearing?.running && <Typography sx={{ fontSize: "0.82rem", color: MUTED, mb: 1, display: "flex", gap: 1, alignItems: "center" }}><CircularProgress size={12} /> Clearing - {full(d.clearing.done)} of {full(d.clearing.of)}{d.clearing.errors ? `, ${full(d.clearing.errors)} not written` : ""}</Typography>}
        {!d.clearing?.running && d.clearing?.at && <Typography sx={{ fontSize: "0.8rem", color: MUTED, mb: 1 }}>Cleared {when(d.clearing.at)}: {full(d.clearing.done)} of {full(d.clearing.of)}{d.clearing.errors ? `, ${full(d.clearing.errors)} not written` : ""}.</Typography>}
        {g?.error && <Typography sx={{ fontSize: "0.82rem", color: RED, mb: 1 }}>The last look stopped: {g.error}</Typography>}
        {!d.writing && d.admin && g?.at && <Typography sx={{ fontSize: "0.78rem", color: FAINT, mb: 1 }}>Clearing is possible in Live, once the workflow is switched off.</Typography>}
        {g?.at ? (
          <>
            <Box sx={{ mb: 1.5 }}>
              <Choice<GuessFilter> value={gf} onChange={setGf} options={[
                { key: "dead", label: "Don't exist", count: g.counts.dead }, { key: "alive", label: "Exist - look at them", count: g.counts.alive }, { key: "unsure", label: "Could not tell", count: g.counts.unsure },
              ]} />
            </Box>
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead><TableRow>{["Company", "The guessed domain", "The contacts' real domain", ""].map((h, i) => <TableCell key={i} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
                <TableBody>
                  {gPaged.slice.map((x) => (
                    <TableRow key={x.id}>
                      <TableCell sx={bodyCell}>
                        <Box component="a" href={hsCompany(x.id)} target="_blank" rel="noopener" sx={{ color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(300) }}>{x.name || x.id}</Box>
                        <Box sx={{ fontSize: "0.74rem", color: MUTED }}>{full(x.contacts)} contacts</Box>
                      </TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>
                        {x.exists ? <Box component="a" href={`https://${x.domain}`} target="_blank" rel="noopener noreferrer" sx={{ color: INK }}>{x.domain}</Box> : <Box component="span" sx={{ textDecoration: x.cleared && !x.cleared.error ? "line-through" : "none" }}>{x.domain}</Box>}
                      </TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", color: x.real ? INK : FAINT }}>{x.real ?? "none"}</TableCell>
                      <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}>
                        {x.cleared ? (x.cleared.error ? <Chip tint="pink">not written</Chip> : <Chip tint="green">{x.cleared.domain ? `→ ${x.cleared.domain}` : "cleared"}</Chip>) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
            {gPaged.pager}
            <Typography sx={{ fontSize: "0.76rem", color: FAINT, mt: 1 }}>Looked up {when(g.at)} - {full(g.scanned)} companies with a domain read, {full(g.counts.total)} are a guess from the name.</Typography>
          </>
        ) : !g?.running && <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Not looked for yet{d.admin ? " - “Find old guesses” reads every company's domain (a few minutes) and writes nothing." : "."}</Typography>}
      </GlassCard>

      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<TuneOutlinedIcon />} tint="blue" title="How it runs" note="Every 15 minutes: the new and changed companies without a domain, and each one again after a week" />
        <Box sx={{ display: "grid", gap: 1.5 }}>
          <Choice<"off" | "shadow" | "live"> value={mode} onChange={(m) => {
            if (!d.admin || m === mode) return;
            if (m === "live" && !window.confirm("Switch Domains to live? The hub writes each company's domain (and APSOmicro for private or micro companies) once the HubSpot workflow is switched off. Every change is kept with what was there before.")) return;
            void call("mode", "PUT", { mode: m });
          }} options={[{ key: "live", label: "Live - the hub writes" }, { key: "shadow", label: "Paused - works it out, writes nothing" }, { key: "off", label: "Off" }]} />
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>
            {d.writing ? <>Writing{d.settings.liveFrom ? ` since ${when(d.settings.liveFrom)}` : ""}.</> : mode === "live" ? "Waiting for the workflow to be switched off." : mode === "shadow" ? "Paused: domains are worked out, nothing is written." : "Off."}
            {d.last ? ` Last look ${when(d.last.at)}: ${full(d.last.without)} without a domain, ${full(d.last.looked)} looked at, ${full(d.last.found)} found, ${full(d.last.written)} written${d.last.error ? ` - ${d.last.error}` : ""}.` : ""}
          </Typography>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
            Written: the company&apos;s <b>domain</b>, and <b>APSO customer = APSOmicro</b> for a private or micro company that is still APSOprospect (never one that bought).
          </Typography>
          {d.admin && (
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <Button variant="outlined" size="small" disabled={!!busy || mode === "off"} onClick={() => void call("run", "POST", { action: "run" })} sx={{ textTransform: "none" }}>Look now</Button>
              {busy && <CircularProgress size={14} />}
            </Box>
          )}
          {msg && <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>{msg}</Typography>}
        </Box>
      </GlassCard>
    </>
  );
}
