"use client";

// MAP ASSIGNMENT - shadow or live, per country. Shadow: the hub only compares. Live: every scan writes the company's
// owner and region responsibility, and its contacts follow - with the SAVED rules. Before a country goes live the
// HubSpot workflows that do the same there must be off, or the two write over each other.

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import CircularProgress from "@mui/material/CircularProgress";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import ReplayOutlinedIcon from "@mui/icons-material/ReplayOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import { full } from "@/app/charts/format";
import { CardTitle, GlassCard, INK, MUTED, Notice, RED, bodyCell, headCell } from "@/app/uc/report/ui";
import { Chip, when } from "@/app/connectors/parts";
import type { MapData } from "@/lib/mapAssign/api";
import { countryList, countryName, send } from "./shared";

/** The HubSpot workflows the hub replaces, country by country (rules.ts). */
const WORKFLOWS = [
  "“SARCLA | COMPANY/CONTACT OWNER COPY FROM PERFORMIS” (SAE -> owner)",
  "Diana's FEHDIA owner workflows - company and contact (owner by country and postcode)",
  "the company -> contact owner copies, where they run for this country",
];

export function LiveView({ d, dirty, onChanged }: { d: MapData; dirty: boolean; onChanged: () => void }) {
  const [ask, setAsk] = useState<{ cc: string; on: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const capped = d.changes.length >= 3000;
  const figures = (cc: string) => {
    const s = d.countries.find((c) => c.country === cc);
    const ch = d.changes.filter((c) => c.country === cc);
    return { companies: s?.companies ?? 0, change: s?.change ?? ch.length, contacts: ch.reduce((a, c) => a + (c.contactsOff || 0), 0) };
  };
  const list = [...new Set([...countryList(d, d.rules).map((c) => c.cc), ...Object.keys(d.live)])];
  const flip = async (cc: string, on: boolean) => {
    setBusy(cc); setMsg(null);
    const r = await send("PUT", { live: { [cc]: on } }); // merged into the saved switches
    setBusy(null); setAsk(null);
    setMsg(r.ok ? { ok: true, text: `${countryName(cc)} is ${on ? "live" : "back in shadow"}.` } : { ok: false, text: r.error ?? "failed" });
    onChanged();
  };
  const run = async () => {
    setBusy("run"); setMsg(null);
    const r = await send("POST", { action: "run" });
    setBusy(null);
    const got = (r.data ?? {}) as { started?: boolean; why?: string };
    setMsg(!r.ok ? { ok: false, text: r.error ?? "failed" } : got.started === false ? { ok: true, text: `Not started: ${got.why ?? "a run is going already"}.` } : { ok: true, text: "Scan started - read again in a minute for the new figures." });
    onChanged();
  };
  const a = ask ? figures(ask.cc) : null;
  const l = d.last;
  return (
    <>
      {dirty && <Notice tone="warn">You have unsaved rule changes. Live writes with the saved rules - save them first, or undo them.</Notice>}
      {msg && <Typography sx={{ fontSize: "0.82rem", color: msg.ok ? "#1b7a55" : RED }}>{msg.text}</Typography>}
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<BoltOutlinedIcon />} tint="pink" title="Shadow or live, per country"
          note="Shadow: the hub only compares. Live: every scan writes owner and region responsibility, and the contacts follow" />
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>{["Country", "Mode", "Companies", "Would change", "Contacts off"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {list.map((cc) => {
                const f = figures(cc);
                const on = !!d.live[cc];
                return (
                  <TableRow key={cc}>
                    <TableCell sx={{ ...bodyCell, fontWeight: 700, color: INK, whiteSpace: "nowrap" }}>{countryName(cc)}<Typography component="span" sx={{ fontSize: "0.72rem", color: MUTED, ml: 0.75 }}>{d.rules.countries[cc] ? (d.rules.countries[cc].source === "sae" ? "SAE" : "map") : "no rule"}</Typography></TableCell>
                    <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        {busy === cc ? <Box sx={{ width: 58, display: "grid", placeItems: "center" }}><CircularProgress size={14} /></Box> : (
                          <Switch checked={on} disabled={!d.admin || busy !== null} onChange={(e) => setAsk({ cc, on: e.target.checked })}
                            slotProps={{ input: { "aria-label": `${countryName(cc)} live` } }} />
                        )}
                        {on ? <Chip tint="pink">LIVE</Chip> : <Chip tint="slate">shadow</Chip>}
                      </Box>
                    </TableCell>
                    <TableCell sx={bodyCell}>{full(f.companies)}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontWeight: f.change ? 700 : 400 }}>{full(f.change)}</TableCell>
                    <TableCell sx={bodyCell}>{f.contacts ? `${capped ? "at least " : ""}${full(f.contacts)}` : "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
        {!list.length && <Typography sx={{ fontSize: "0.85rem", color: MUTED, mt: 1 }}>No country yet - they appear with the rules and the first scan.</Typography>}
        <Box sx={{ mt: 2, display: "grid", gap: 0.5 }}>
          <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK }}>Before a country goes live, switch off for it in HubSpot</Typography>
          <Box component="ul" sx={{ m: 0, pl: 2.5, display: "grid", gap: 0.25 }}>
            {WORKFLOWS.map((w) => <Typography component="li" key={w} sx={{ fontSize: "0.8rem", color: INK }}>{w}</Typography>)}
          </Box>
          <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>Back: switch the country to shadow here and the workflows on again.</Typography>
        </Box>
      </GlassCard>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<HistoryOutlinedIcon />} tint="slate" title="Scans"
          note={l ? `Last scan ${when(l.at)}: ${l.mode === "full" ? "every company" : "changed companies"}, ${full(l.companies)} companies and ${full(l.contacts)} contacts in ${full(Math.round(l.seconds))} s` : "Not run yet"} />
        {l?.error && <Typography sx={{ fontSize: "0.82rem", color: RED, mb: 1 }}>Last scan failed: {l.error}</Typography>}
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
          <Button variant="outlined" size="small" startIcon={<ReplayOutlinedIcon />} disabled={!d.admin || busy !== null} onClick={() => void run()} sx={{ textTransform: "none" }}>Run now</Button>
          {busy === "run" && <CircularProgress size={14} />}
          {!d.admin && <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>Admins can run a scan and switch countries.</Typography>}
        </Box>
      </GlassCard>
      <Dialog open={!!ask} onClose={() => busy === null && setAsk(null)} maxWidth="sm" fullWidth>
        {ask && a && (
          <>
            <DialogTitle sx={{ fontWeight: 700 }}>{ask.on ? `Switch ${countryName(ask.cc)} live?` : `Back to shadow for ${countryName(ask.cc)}?`}</DialogTitle>
            <DialogContent sx={{ display: "grid", gap: 1.25 }}>
              {ask.on ? (
                <>
                  <Typography sx={{ fontSize: "0.9rem", color: INK }}>
                    From the next scan the hub writes the owner and region responsibility of <b>{full(a.change)} compan{a.change === 1 ? "y" : "ies"}</b> in {countryName(ask.cc)},
                    and <b>{capped ? "at least " : ""}{full(a.contacts)} contact{a.contacts === 1 ? "" : "s"}</b> follow{a.contacts === 1 ? "s" : ""} their company - with the saved rules.
                  </Typography>
                  <Box sx={{ borderLeft: `3px solid ${RED}`, pl: 1.5 }}>
                    <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>First switch off, for {countryName(ask.cc)}, the HubSpot workflows that do the same:</Typography>
                    <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
                      {WORKFLOWS.map((w) => <Typography component="li" key={w} sx={{ fontSize: "0.84rem", color: INK }}>{w}</Typography>)}
                    </Box>
                    <Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: 0.5 }}>Otherwise they write over each other.</Typography>
                  </Box>
                  {dirty && <Typography sx={{ fontSize: "0.84rem", color: RED }}>Your unsaved rule changes are not used - save them first.</Typography>}
                </>
              ) : (
                <Typography sx={{ fontSize: "0.9rem", color: INK }}>The hub stops writing in {countryName(ask.cc)} and only compares. Switch the HubSpot workflows on again if they should take over.</Typography>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setAsk(null)} disabled={busy !== null} sx={{ textTransform: "none" }}>Cancel</Button>
              <Button variant="contained" color={ask.on ? "error" : "primary"} disabled={busy !== null} onClick={() => void flip(ask.cc, ask.on)} sx={{ textTransform: "none" }}>
                {busy ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : ask.on ? "Switch live" : "Back to shadow"}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  );
}
