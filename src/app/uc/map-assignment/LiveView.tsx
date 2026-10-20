"use client";

// MAP ASSIGNMENT - shadow or live, per country. Shadow: the hub only compares. Live: every scan writes the company's
// owner and region responsibility, and its contacts follow - with the SAVED rules. Before a country goes live the
// HubSpot workflows that do the same there must be off, or the two write over each other. All countries at once too
// (SARCLA 20.10.2026: "on LIVE you should be able to toggle for all") - one request, the same warnings.

import { useMemo, useState } from "react";
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
import { CardTitle, GlassCard, HAIRLINE, INK, MUTED, Notice, RED, bodyCell, headCell } from "@/app/uc/report/ui";
import { Chip, Choice, usePaged, when } from "@/app/connectors/parts";
import type { MapData } from "@/lib/mapAssign/api";
import { countryList, countryName, send } from "./shared";

/** The HubSpot workflows the hub replaces, country by country (rules.ts). */
const WORKFLOWS = [
  "“SARCLA | COMPANY/CONTACT OWNER COPY FROM PERFORMIS” (SAE -> owner)",
  "Diana's FEHDIA owner workflows - company and contact (owner by country and postcode)",
  "the company -> contact owner copies, where they run for this country",
];

/** A switch asked for: the countries it changes (the figures), and the switches the one request sends. */
type Ask = { ccs: string[]; on: boolean; send: string[]; bulk: boolean };

export function LiveView({ d, dirty, onChanged }: { d: MapData; dirty: boolean; onChanged: () => void }) {
  const [ask, setAsk] = useState<Ask | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // contacts off per country, complete (d.changes stops at 3,000)
  const contactsIn = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of d.moves ?? []) m.set(x.country, (m.get(x.country) ?? 0) + x.contacts);
    return m;
  }, [d.moves]);
  const figures = (cc: string) => {
    const s = d.countries.find((c) => c.country === cc);
    return { companies: s?.companies ?? 0, change: s?.change ?? 0, contacts: contactsIn.get(cc) ?? 0 };
  };
  // live countries first, then the biggest; paged as the other views (SARCLA 19.10.2026: "paginate live")
  const all = [...new Set([...countryList(d, d.rules).map((c) => c.cc), ...Object.keys(d.live)])]
    .map((cc, i) => ({ cc, i })).sort((a, b) => Number(!!d.live[b.cc]) - Number(!!d.live[a.cc]) || a.i - b.i).map((x) => x.cc);
  const [show, setShow] = useState<"all" | "live" | "rule" | "shadow">("all");
  const list = all.filter((cc) => show === "all" || (show === "live" ? !!d.live[cc] : show === "rule" ? !!d.rules.countries[cc] : !d.live[cc]));
  const { slice, pager } = usePaged(list, 20);
  const liveNow = all.filter((cc) => !!d.live[cc]);
  const shadowNow = all.filter((cc) => !d.live[cc]);
  const flip = async (a: Ask) => {
    setBusy(a.bulk ? "all" : a.ccs[0]); setMsg(null);
    const r = await send("PUT", { live: Object.fromEntries(a.send.map((cc) => [cc, a.on])) }); // merged into the saved switches
    setBusy(null); setAsk(null);
    const text = !a.bulk ? `${countryName(a.ccs[0])} is ${a.on ? "live" : "back in shadow"}.`
      : a.on ? `${full(a.send.length)} countr${a.send.length === 1 ? "y is" : "ies are"} live.` : "All countries are back in shadow.";
    setMsg(r.ok ? { ok: true, text } : { ok: false, text: r.error ?? "failed" });
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
  const a = ask ? ask.ccs.map(figures).reduce((x, f) => ({ change: x.change + f.change, contacts: x.contacts + f.contacts }), { change: 0, contacts: 0 }) : null;
  const one = ask && ask.ccs.length === 1 ? countryName(ask.ccs[0]) : null;
  const named = ask ? (one ?? `${ask.ccs.slice(0, 12).map(countryName).join(", ")}${ask.ccs.length > 12 ? ` and ${ask.ccs.length - 12} more` : ""}`) : "";
  const l = d.last;
  return (
    <>
      {dirty && <Notice tone="warn">You have unsaved rule changes. Live writes with the saved rules - save them first, or undo them.</Notice>}
      {msg && <Typography sx={{ fontSize: "0.82rem", color: msg.ok ? "#1b7a55" : RED }}>{msg.text}</Typography>}
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<BoltOutlinedIcon />} tint="pink" title="Shadow or live, per country"
          note="Shadow: the hub only compares. Live: every scan writes owner and region responsibility, and the contacts follow" />
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 1.5, pb: 1.5, borderBottom: `1px solid ${HAIRLINE}` }}>
          <Box sx={{ mr: "auto", minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: INK }}>All countries</Typography>
            <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{liveNow.length ? `${full(liveNow.length)} of ${full(all.length)} live` : `All ${full(all.length)} in shadow`}</Typography>
          </Box>
          {busy === "all" && <CircularProgress size={14} />}
          <Button variant="outlined" color="error" size="small" disabled={!d.admin || busy !== null || !shadowNow.length}
            onClick={() => setAsk({ ccs: shadowNow, on: true, send: all, bulk: true })} sx={{ textTransform: "none" }}>Switch all live</Button>
          <Button variant="outlined" size="small" disabled={!d.admin || busy !== null || !liveNow.length}
            onClick={() => setAsk({ ccs: liveNow, on: false, send: liveNow, bulk: true })} sx={{ textTransform: "none" }}>All back to shadow</Button>
        </Box>
        <Box sx={{ mb: 1.5 }}>
          <Choice<"all" | "live" | "rule" | "shadow"> value={show} onChange={setShow} options={[
            { key: "all", label: "All countries", count: all.length },
            { key: "live", label: "Live", count: all.filter((cc) => !!d.live[cc]).length },
            { key: "rule", label: "With a rule", count: all.filter((cc) => !!d.rules.countries[cc]).length },
            { key: "shadow", label: "Shadow", count: all.filter((cc) => !d.live[cc]).length },
          ]} />
        </Box>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>{["Country", "Mode", "Companies", "Would change", "Contacts off"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {slice.map((cc) => {
                const f = figures(cc);
                const on = !!d.live[cc];
                return (
                  <TableRow key={cc}>
                    <TableCell sx={{ ...bodyCell, fontWeight: 700, color: INK, whiteSpace: "nowrap" }}>{countryName(cc)}<Typography component="span" sx={{ fontSize: "0.72rem", color: MUTED, ml: 0.75 }}>{d.rules.countries[cc] ? (d.rules.countries[cc].source === "sae" ? "SAE" : "map") : "no rule"}</Typography></TableCell>
                    <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        {busy === cc ? <Box sx={{ width: 58, display: "grid", placeItems: "center" }}><CircularProgress size={14} /></Box> : (
                          <Switch checked={on} disabled={!d.admin || busy !== null} onChange={(e) => setAsk({ ccs: [cc], on: e.target.checked, send: [cc], bulk: false })}
                            slotProps={{ input: { "aria-label": `${countryName(cc)} live` } }} />
                        )}
                        {on ? <Chip tint="pink">LIVE</Chip> : <Chip tint="slate">shadow</Chip>}
                      </Box>
                    </TableCell>
                    <TableCell sx={bodyCell}>{full(f.companies)}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontWeight: f.change ? 700 : 400 }}>{full(f.change)}</TableCell>
                    <TableCell sx={bodyCell}>{f.contacts ? full(f.contacts) : "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
        {pager}
        {!list.length && <Typography sx={{ fontSize: "0.85rem", color: MUTED, mt: 1 }}>{all.length ? "No country with this filter." : "No country yet - they appear with the rules and the first scan."}</Typography>}
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
            <DialogTitle sx={{ fontWeight: 700 }}>
              {ask.on ? (one ? `Switch ${one} live?` : `Switch ${full(ask.ccs.length)} countries live?`) : (one ? `Back to shadow for ${one}?` : `All ${full(ask.ccs.length)} live countries back to shadow?`)}
            </DialogTitle>
            <DialogContent sx={{ display: "grid", gap: 1.25 }}>
              {!one && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{named}</Typography>}
              {ask.on ? (
                <>
                  <Typography sx={{ fontSize: "0.9rem", color: INK }}>
                    From the next scan the hub writes the owner and region responsibility of <b>{full(a.change)} compan{a.change === 1 ? "y" : "ies"}</b> in {one ?? `these ${full(ask.ccs.length)} countries`},
                    and <b>{full(a.contacts)} contact{a.contacts === 1 ? "" : "s"}</b> follow{a.contacts === 1 ? "s" : ""} their company - with the saved rules.
                  </Typography>
                  <Box sx={{ borderLeft: `3px solid ${RED}`, pl: 1.5 }}>
                    <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>First switch off, for {one ?? "these countries"}, the HubSpot workflows that do the same:</Typography>
                    <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
                      {WORKFLOWS.map((w) => <Typography component="li" key={w} sx={{ fontSize: "0.84rem", color: INK }}>{w}</Typography>)}
                      {ask.ccs.includes("FR") && (
                        <Typography component="li" sx={{ fontSize: "0.84rem", color: INK }}>
                          and on <Box component="a" href="/uc/owner-redirection" sx={{ color: "#2459d1", textDecoration: "none" }}>Owner redirection</Box>, the old France rule (France → Jeremy Borey): it gives him all of France whatever the SAE
                        </Typography>
                      )}
                    </Box>
                    <Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: 0.5 }}>Otherwise they write over each other.</Typography>
                  </Box>
                  {dirty && <Typography sx={{ fontSize: "0.84rem", color: RED }}>Your unsaved rule changes are not used - save them first.</Typography>}
                </>
              ) : (
                <Typography sx={{ fontSize: "0.9rem", color: INK }}>The hub stops writing in {one ?? `these ${full(ask.ccs.length)} countries`} and only compares. Switch the HubSpot workflows on again if they should take over.</Typography>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setAsk(null)} disabled={busy !== null} sx={{ textTransform: "none" }}>Cancel</Button>
              <Button variant="contained" color={ask.on ? "error" : "primary"} disabled={busy !== null} onClick={() => void flip(ask)} sx={{ textTransform: "none" }}>
                {busy ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : ask.on ? (one ? "Switch live" : "Switch all live") : (one ? "Back to shadow" : "All back to shadow")}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  );
}
