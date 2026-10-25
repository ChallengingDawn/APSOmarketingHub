"use client";

// MAP ASSIGNMENT - Phone numbers (SARCLA 25.10.2026: "a new tab phone number to integrate the workflow SARCLA | Contact
// phone number correction"). Every contact with the shop's phone and no phone, and the phone the hub gives it - only a
// valid number, in the international form (+41 …) from its country; and, checked once a day, every phone in HubSpot
// that is not valid, with the certain repair where there is one ("numbers it can't make valid are listed on the tab for
// someone to fix"). Reads/writes /api/uc/contact-phone (src/lib/contactPhone); the look of the Domains tab.

import { useState } from "react";
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
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import PhoneDisabledOutlinedIcon from "@mui/icons-material/PhoneDisabledOutlined";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { CardTitle, FAINT, GlassCard, INK, KpiTile, MUTED, RED, bodyCell, clip, headCell } from "@/app/uc/report/ui";
import { Chip, Choice, Info, usePaged, when } from "@/app/connectors/parts";
import { STATUS_TEXT } from "@/lib/contactPhone/rules";
import type { BadRow, Row, RunInfo, Settings } from "@/lib/contactPhone/engine";
import { hsContact } from "./shared";

const API = "/api/uc/contact-phone";
type Bad = { at: string; scanned: number; rows: BadRow[]; counts: Record<BadFilter, number> };
type Data = { settings: Settings; last: RunInfo | null; state: { at: string; rows: Row[] }; bad: Bad | null; workflowOn: boolean | null; writing: boolean; admin: boolean };
type Filter = "all" | "normalized" | "repaired" | "invalid" | "written";
type BadFilter = "all" | "repair" | "person" | "repaired";

const done = (x: Row) => !!x.written && !x.written.error;
const COUNTRY_FROM = { erp: "ERP country", contact: "contact's country", none: "no country known" } as const;
const HOW_TEXT = { nocode: "No country code - from the contact's country", double: "Two country codes - the shop phone already had one", zero: "A 0 after the country code" } as const;

/** What the hub did with a contact. */
function Status({ r, writing }: { r: Row; writing: boolean }) {
  if (r.written?.error) return <Chip tint="pink">not written</Chip>;
  if (r.written) return <Chip tint="green">written</Chip>;
  if (r.v.status === "invalid") return <Chip tint="pink">not valid</Chip>;
  if (!r.v.phone || r.v.status === "same") return <Box component="span" sx={{ color: FAINT, fontSize: "0.8rem" }}>—</Box>;
  return <Chip tint={writing ? "amber" : "slate"}>{writing ? "next run" : "would write"}</Chip>;
}

const linkSx = { color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(260) } as const;

export function PhoneView() {
  const [n, setN] = useState(0);
  const url = `${API}${n ? `?n=${n}` : ""}`;
  const held = useHeld<Data>(url, [url]);
  const r = held.result;
  const d = r?.state === "ok" ? r.data : null;
  const [filter, setFilter] = useState<Filter>("all");
  const [bf, setBf] = useState<BadFilter>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const rowsAll = d?.state.rows ?? [];
  const test: Record<Filter, (x: Row) => boolean> = {
    all: (x) => !done(x), normalized: (x) => !done(x) && x.v.status === "normalized", repaired: (x) => !done(x) && x.v.status === "repaired",
    invalid: (x) => x.v.status === "invalid", written: done,
  };
  const rows = rowsAll.filter(test[filter]);
  const { slice, pager } = usePaged(rows, 25);
  const fixed = (x: BadRow) => !!x.repaired && !x.repaired.error;
  const bTest: Record<BadFilter, (x: BadRow) => boolean> = {
    all: (x) => !fixed(x), repair: (x) => !!x.repair && !fixed(x), person: (x) => !x.repair && !fixed(x), repaired: fixed,
  };
  const bRows = (d?.bad?.rows ?? []).filter(bTest[bf]);
  const bPaged = usePaged<BadRow>(bRows, 25);

  if (r === null) return <LoadingPanel label="Reading the contacts with a shop phone and no phone…" />;
  if (!d) return <UpstreamPanel source="Phone numbers" error={r.state === "error" ? r.error : "not there yet - this tab fills in once the hub is deployed"} status={r.state === "error" ? r.status : null} onRetry={() => setN((x) => x + 1)} />;

  const call = async (what: string, method: "PUT" | "POST", body: unknown) => {
    setBusy(what); setMsg(null);
    try {
      const res = await fetch(API, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await res.json()) as { ok: boolean; error?: string; data?: { written?: number; left?: number; started?: boolean } };
      setMsg(!j.ok ? j.error ?? `HTTP ${res.status}` : what === "repair" ? `${full(j.data?.written ?? 0)} repaired${j.data?.left ? `, ${full(j.data.left)} still to repair - click again` : ""}.` : what === "scan" ? "Reading every phone - the list fills in within a few minutes." : "Done.");
      setN((x) => x + 1);
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(null); }
  };
  const count = (f: Filter) => rowsAll.filter(test[f]).length;
  const mode = d.settings.mode;
  const bad = d.bad;
  const bc = (f: BadFilter) => bad?.counts?.[f] ?? (bad?.rows ?? []).filter(bTest[f]).length;
  const toWrite = count("normalized") + count("repaired");

  return (
    <>
      {mode !== "live" ? (
        <Info>{mode === "shadow" ? "Paused - the hub works each phone number out and shows it here, but writes nothing to HubSpot. Switch to Live below." : "Off - nothing is looked at."}</Info>
      ) : !d.writing ? (
        <Info><b>Live - waiting:</b> the HubSpot workflow “SARCLA | Contact phone number correction” is {d.workflowOn ? "still switched on" : "not readable"} - the hub writes nothing while it runs. Switch it off in HubSpot (Automation → Workflows) and the hub goes on within 15 minutes.</Info>
      ) : null}
      <Grid container spacing={2}>
        {[
          { label: "Shop phone, no phone", value: full(count("all")), note: d.last ? `Contacts with the shop's phone and an empty phone · looked ${when(d.last.at)}` : "Looked at within minutes", icon: <PhoneDisabledOutlinedIcon />, tint: "slate" as const },
          { label: "A valid number to write", value: full(toWrite), note: `${full(count("repaired"))} of them repaired · ${full(count("invalid"))} not valid - not written`, icon: <PublicOutlinedIcon />, tint: "green" as const },
          { label: "Phones not valid", value: bad ? full(bc("all")) : "—", note: bad ? `In HubSpot · ${full(bc("repair"))} can be repaired · ${full(bc("person"))} for a person · checked ${when(bad.at)}` : "Every phone is checked within minutes of the deploy", icon: <ReportProblemOutlinedIcon />, tint: "pink" as const },
          { label: "Written", value: full(count("written") + bc("repaired")), note: "By the hub, the last 30 days - new phones and repairs", icon: <TaskAltOutlinedIcon />, tint: "blue" as const },
        ].map((k) => <Grid key={k.label} size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={k.icon} tint={k.tint} label={k.label} value={k.value} note={k.note} /></Grid>)}
      </Grid>

      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<PhoneOutlinedIcon />} tint="green" title="Contacts with a shop phone and no phone"
          note="The phone comes from the shop (eyemagine_telephone), in the international form (+41 …) from the contact's ERP country, else its own country - and only when it is a valid phone number. One that is not valid is not written: it waits here for a person." />
        <Box sx={{ mb: 1.5 }}>
          <Choice<Filter> value={filter} onChange={setFilter} options={[
            { key: "all", label: "All", count: count("all") }, { key: "normalized", label: "Valid", count: count("normalized") },
            { key: "repaired", label: "Repaired", count: count("repaired") }, { key: "invalid", label: "Not valid", count: count("invalid") },
            { key: "written", label: "Written", count: count("written") },
          ]} />
        </Box>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>{["Contact", "Country", "Shop phone", "What the hub writes", ""].map((h, i) => <TableCell key={i} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {slice.map((x) => (
                <TableRow key={x.id}>
                  <TableCell sx={bodyCell}>
                    <Box component="a" href={hsContact(x.id)} target="_blank" rel="noopener" sx={linkSx}>{x.name || x.email || x.id}</Box>
                    <Box sx={{ fontSize: "0.74rem", color: MUTED, ...clip(260) }}>{x.email || "no e-mail"} · {when(x.created)}</Box>
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>
                    <Box sx={{ color: x.v.country ? INK : FAINT }}>{x.v.country || "—"}</Box>
                    <Box sx={{ fontSize: "0.74rem", color: MUTED }}>{COUNTRY_FROM[x.v.countryFrom]}</Box>
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{x.shop || "—"}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>
                    {x.written?.phone ?? x.v.phone ? <Box sx={{ fontWeight: 600, color: INK, fontVariantNumeric: "tabular-nums" }}>{x.written?.phone ?? x.v.phone}</Box> : <Box component="span" sx={{ color: FAINT }}>nothing</Box>}
                    <Box sx={{ fontSize: "0.74rem", color: MUTED }}>{x.v.status === "repaired" && x.v.how ? `Repaired - ${HOW_TEXT[x.v.how].charAt(0).toLowerCase()}${HOW_TEXT[x.v.how].slice(1)}` : STATUS_TEXT[x.v.status]}{x.v.status === "invalid" && x.v.asWorkflow ? ` · the old workflow would have written ${x.v.asWorkflow}` : ""}</Box>
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
        <CardTitle icon={<ReportProblemOutlinedIcon />} tint="pink" title="Phone numbers in HubSpot that are not valid"
          note="Every contact's phone, checked once a day. A certain repair is shown and an admin can write it (in Live): no country code (from the contact's country), two country codes (the old workflow put one in front of a shop phone that already had one), a 0 after the country code. The others need a person - usually digits missing in what the customer typed."
          right={d.admin ? (
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <Button size="small" variant="outlined" disabled={!!busy || mode === "off"} onClick={() => void call("scan", "POST", { action: "scan" })} sx={{ textTransform: "none", whiteSpace: "nowrap" }}>Look again</Button>
              <Button size="small" variant="contained" disableElevation disabled={!!busy || !d.writing || !bc("repair")}
                onClick={() => { if (window.confirm(`Repair the ${full(bc("repair"))} phone numbers with a certain repair? Each is read again first and written only while it is still the same. Every change is kept with what was there before.`)) void call("repair", "POST", { action: "repair" }); }}
                sx={{ textTransform: "none", whiteSpace: "nowrap" }}>Repair the certain ones</Button>
            </Box>
          ) : undefined} />
        {!d.writing && d.admin && !!bc("repair") && <Typography sx={{ fontSize: "0.78rem", color: FAINT, mb: 1 }}>Repairing is possible in Live, once the workflow is switched off.</Typography>}
        {bad ? (
          <>
            <Box sx={{ mb: 1.5 }}>
              <Choice<BadFilter> value={bf} onChange={setBf} options={[
                { key: "all", label: "All", count: bc("all") }, { key: "repair", label: "Can be repaired", count: bc("repair") },
                { key: "person", label: "For a person", count: bc("person") }, { key: "repaired", label: "Repaired", count: bc("repaired") },
              ]} />
            </Box>
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead><TableRow>{["Contact", "Country", "Phone now", "Shop phone", "Repair", ""].map((h, i) => <TableCell key={i} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
                <TableBody>
                  {bPaged.slice.map((x) => (
                    <TableRow key={x.id}>
                      <TableCell sx={bodyCell}>
                        <Box component="a" href={hsContact(x.id)} target="_blank" rel="noopener" sx={linkSx}>{x.name || x.email || x.id}</Box>
                        <Box sx={{ fontSize: "0.74rem", color: MUTED, ...clip(260) }}>{x.email || "no e-mail"}</Box>
                      </TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", color: x.country ? INK : FAINT }}>{x.country || "—"}</TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", textDecoration: fixed(x) ? "line-through" : "none" }}>{x.phone}</TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", color: x.shop ? INK : FAINT }}>{x.shop || "—"}</TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>
                        {x.repair ? <Box sx={{ fontWeight: 600, color: INK, fontVariantNumeric: "tabular-nums" }}>{x.repaired?.phone ?? x.repair}</Box> : <Box component="span" sx={{ color: FAINT }}>for a person</Box>}
                        <Box sx={{ fontSize: "0.74rem", color: MUTED }}>{x.how ? HOW_TEXT[x.how] : "Not a valid number - no certain repair"}</Box>
                        {x.repaired?.error && <Box sx={{ fontSize: "0.74rem", color: RED }}>{x.repaired.error}</Box>}
                      </TableCell>
                      <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}>{x.repaired ? (x.repaired.error ? <Chip tint="pink">not written</Chip> : <Chip tint="green">repaired</Chip>) : x.repair ? <Chip tint="amber">can be repaired</Chip> : null}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
            {bPaged.pager}
            {bRows.length < bc(bf) && <Typography sx={{ fontSize: "0.76rem", color: FAINT, mt: 1 }}>The newest {full(bRows.length)} of {full(bc(bf))} are shown.</Typography>}
            <Typography sx={{ fontSize: "0.76rem", color: FAINT, mt: 1 }}>Checked {when(bad.at)} - {full(bad.scanned)} phones read.</Typography>
          </>
        ) : <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Not checked yet - every phone is read within minutes of the deploy.</Typography>}
      </GlassCard>

      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<TuneOutlinedIcon />} tint="blue" title="How it runs" note="Every 15 minutes: every contact with the shop's phone and no phone - a contact changed in the last 2 minutes waits for the next run. Once a day: every phone in HubSpot" />
        <Box sx={{ display: "grid", gap: 1.5 }}>
          <Choice<"off" | "shadow" | "live"> value={mode} onChange={(m) => {
            if (!d.admin || m === mode) return;
            if (m === "live" && !window.confirm("Switch Phone numbers to live? The hub writes the phone of each contact that has the shop's phone and no phone - only valid numbers - once the HubSpot workflow is switched off. Every change is kept with what was there before.")) return;
            void call("mode", "PUT", { mode: m });
          }} options={[{ key: "live", label: "Live - the hub writes" }, { key: "shadow", label: "Paused - works it out, writes nothing" }, { key: "off", label: "Off" }]} />
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>
            {d.writing ? <>Writing{d.settings.liveFrom ? ` since ${when(d.settings.liveFrom)}` : ""}.</> : mode === "live" ? "Waiting for the workflow to be switched off." : mode === "shadow" ? "Paused: phone numbers are worked out, nothing is written." : "Off."}
            {d.last ? ` Last look ${when(d.last.at)}: ${full(d.last.waiting)} with a shop phone and no phone, ${full(d.last.fillable)} to write${d.last.repaired ? ` (${full(d.last.repaired)} repaired)` : ""}, ${full(d.last.invalid)} not valid, ${full(d.last.written)} written${d.last.error ? ` - ${d.last.error}` : ""}.` : ""}
          </Typography>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
            Written: the contact&apos;s <b>phone</b> - only a valid number, and only while it is empty. A phone already there is changed only by &quot;Repair the certain ones&quot;.
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
