"use client";

// MAP ASSIGNMENT - Phone numbers (SARCLA 25.10.2026: "a new tab phone number to integrate the workflow SARCLA | Contact
// phone number correction"). Every contact with the shop's phone and no phone, and the phone the hub gives it - in the
// international form (+41 …) from its country. Reads/writes /api/uc/contact-phone (src/lib/contactPhone); the look of
// the Domains tab.

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
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { CardTitle, FAINT, GlassCard, INK, KpiTile, MUTED, RED, bodyCell, clip, headCell } from "@/app/uc/report/ui";
import { Chip, Choice, Info, usePaged, when } from "@/app/connectors/parts";
import { STATUS_TEXT } from "@/lib/contactPhone/rules";
import type { Row, RunInfo, Settings } from "@/lib/contactPhone/engine";
import { hsContact } from "./shared";

const API = "/api/uc/contact-phone";
type Data = { settings: Settings; last: RunInfo | null; state: { at: string; rows: Row[] }; workflowOn: boolean | null; writing: boolean; admin: boolean };
type Filter = "all" | "normalized" | "cleaned" | "kept" | "invalid" | "written";

const done = (x: Row) => !!x.written && !x.written.error;
const COUNTRY_FROM = { erp: "ERP country", contact: "contact's country", none: "no country known" } as const;

/** What the hub did with a contact. */
function Status({ r, writing }: { r: Row; writing: boolean }) {
  if (r.written?.error) return <Chip tint="pink">not written</Chip>;
  if (r.written) return <Chip tint="green">written</Chip>;
  if (!r.v.phone || r.v.status === "same") return <Box component="span" sx={{ color: FAINT, fontSize: "0.8rem" }}>—</Box>;
  return <Chip tint={writing ? "amber" : "slate"}>{writing ? "next run" : "would write"}</Chip>;
}

export function PhoneView() {
  const [n, setN] = useState(0);
  const url = `${API}${n ? `?n=${n}` : ""}`;
  const held = useHeld<Data>(url, [url]);
  const r = held.result;
  const d = r?.state === "ok" ? r.data : null;
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const rowsAll = d?.state.rows ?? [];
  const test: Record<Filter, (x: Row) => boolean> = {
    all: (x) => !done(x), normalized: (x) => !done(x) && x.v.status === "normalized", cleaned: (x) => !done(x) && x.v.status === "cleaned",
    kept: (x) => !done(x) && x.v.status === "kept", invalid: (x) => x.v.status === "invalid", written: done,
  };
  const rows = rowsAll.filter(test[filter]);
  const { slice, pager } = usePaged(rows, 25);

  if (r === null) return <LoadingPanel label="Reading the contacts with a shop phone and no phone…" />;
  if (!d) return <UpstreamPanel source="Phone numbers" error={r.state === "error" ? r.error : "not there yet - this tab fills in once the hub is deployed"} status={r.state === "error" ? r.status : null} onRetry={() => setN((x) => x + 1)} />;

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
  const mode = d.settings.mode;
  const fillable = count("normalized") + count("cleaned") + count("kept");

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
          { label: "A phone number to write", value: full(fillable), note: `${full(count("normalized"))} in the international form · ${full(count("cleaned"))} without a country`, icon: <PublicOutlinedIcon />, tint: "green" as const },
          { label: "Not a number", value: full(count("invalid")), note: "Too short to be a phone - nothing written", icon: <PhoneOutlinedIcon />, tint: "amber" as const },
          { label: "Written", value: full(count("written")), note: "By the hub, the last 30 days", icon: <TaskAltOutlinedIcon />, tint: "blue" as const },
        ].map((k) => <Grid key={k.label} size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={k.icon} tint={k.tint} label={k.label} value={k.value} note={k.note} /></Grid>)}
      </Grid>

      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<PhoneOutlinedIcon />} tint="green" title="Contacts with a shop phone and no phone"
          note="The phone comes from the shop (eyemagine_telephone), written in the international form (+41 …) from the contact's ERP country, else its own country. With no country known, the digits are written without the country code." />
        <Box sx={{ mb: 1.5 }}>
          <Choice<Filter> value={filter} onChange={setFilter} options={[
            { key: "all", label: "All", count: count("all") }, { key: "normalized", label: "International form", count: count("normalized") },
            { key: "cleaned", label: "No country", count: count("cleaned") }, { key: "kept", label: "Kept as typed", count: count("kept") },
            { key: "invalid", label: "Not a number", count: count("invalid") }, { key: "written", label: "Written", count: count("written") },
          ]} />
        </Box>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>{["Contact", "Country", "Shop phone", "What the hub writes", ""].map((h, i) => <TableCell key={i} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {slice.map((x) => (
                <TableRow key={x.id}>
                  <TableCell sx={bodyCell}>
                    <Box component="a" href={hsContact(x.id)} target="_blank" rel="noopener" sx={{ color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(260) }}>{x.name || x.email || x.id}</Box>
                    <Box sx={{ fontSize: "0.74rem", color: MUTED, ...clip(260) }}>{x.email || "no e-mail"} · {when(x.created)}</Box>
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>
                    <Box sx={{ color: x.v.country ? INK : FAINT }}>{x.v.country || "—"}</Box>
                    <Box sx={{ fontSize: "0.74rem", color: MUTED }}>{COUNTRY_FROM[x.v.countryFrom]}</Box>
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{x.shop || "—"}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>
                    {x.written?.phone ?? x.v.phone ? <Box sx={{ fontWeight: 600, color: INK, fontVariantNumeric: "tabular-nums" }}>{x.written?.phone ?? x.v.phone}</Box> : <Box component="span" sx={{ color: FAINT }}>nothing</Box>}
                    <Box sx={{ fontSize: "0.74rem", color: MUTED }}>{STATUS_TEXT[x.v.status]}</Box>
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
        <CardTitle icon={<TuneOutlinedIcon />} tint="blue" title="How it runs" note="Every 15 minutes: every contact with the shop's phone and no phone - a contact changed in the last 2 minutes waits for the next run" />
        <Box sx={{ display: "grid", gap: 1.5 }}>
          <Choice<"off" | "shadow" | "live"> value={mode} onChange={(m) => {
            if (!d.admin || m === mode) return;
            if (m === "live" && !window.confirm("Switch Phone numbers to live? The hub writes the phone of each contact that has the shop's phone and no phone, once the HubSpot workflow is switched off. Every change is kept with what was there before.")) return;
            void call("mode", "PUT", { mode: m });
          }} options={[{ key: "live", label: "Live - the hub writes" }, { key: "shadow", label: "Paused - works it out, writes nothing" }, { key: "off", label: "Off" }]} />
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>
            {d.writing ? <>Writing{d.settings.liveFrom ? ` since ${when(d.settings.liveFrom)}` : ""}.</> : mode === "live" ? "Waiting for the workflow to be switched off." : mode === "shadow" ? "Paused: phone numbers are worked out, nothing is written." : "Off."}
            {d.last ? ` Last look ${when(d.last.at)}: ${full(d.last.waiting)} with a shop phone and no phone, ${full(d.last.fillable)} to write, ${full(d.last.invalid)} not a number, ${full(d.last.written)} written${d.last.error ? ` - ${d.last.error}` : ""}.` : ""}
          </Typography>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
            Written: the contact&apos;s <b>phone</b>, only while it is empty - a phone someone typed is never changed.
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
