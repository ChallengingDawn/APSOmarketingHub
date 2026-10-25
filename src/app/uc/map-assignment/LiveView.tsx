"use client";

// MAP ASSIGNMENT - shadow or live, per country. Shadow: the hub only compares. Live (25.10.2026, like the workflows it
// replaces - SARCLA: "it will really copy as per today after the ERP load? we will not have crazy stuff?"): the hub writes
// owner + region responsibility, and the contacts follow, for a company whose SAE, postcode or country changes (the ERP
// load) or that is new, that has no owner, or whose owner has left (to their successor) - every other difference stays
// as it is (Differences: Fix, or Performis). The HubSpot workflows that did it are off since 25.10.2026. All countries
// at once too (SARCLA 20.10.2026: "on LIVE you should be able to toggle for all") - one request.

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
    return { companies: s?.companies ?? 0, change: s?.change ?? 0, contacts: contactsIn.get(cc) ?? 0, atOnce: s?.writeAtOnce ?? 0 };
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
  const a = ask ? ask.ccs.map(figures).reduce((x, f) => ({ change: x.change + f.change, contacts: x.contacts + f.contacts, atOnce: x.atOnce + f.atOnce }), { change: 0, contacts: 0, atOnce: 0 }) : null;
  const one = ask && ask.ccs.length === 1 ? countryName(ask.ccs[0]) : null;
  const named = ask ? (one ?? `${ask.ccs.slice(0, 12).map(countryName).join(", ")}${ask.ccs.length > 12 ? ` and ${ask.ccs.length - 12} more` : ""}`) : "";
  const l = d.last;
  return (
    <>
      {dirty && <Notice tone="warn">You have unsaved rule changes. Live writes with the saved rules - save them first, or undo them.</Notice>}
      {msg && <Typography sx={{ fontSize: "0.82rem", color: msg.ok ? "#1b7a55" : RED }}>{msg.text}</Typography>}
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<BoltOutlinedIcon />} tint="pink" title="Shadow or live, per country"
          note="Shadow: the hub only compares. Live: like the Performis copy - a company whose SAE, zip code or country changes (the ERP load) or that is new, that has no owner, or whose owner has left gets the owner and region responsibility the rules give, and its contacts follow. Every other difference stays as it is (Differences: Fix, or Performis)." />
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
            <TableHead><TableRow>{["Country", "Mode", "Companies", "Written when it goes live", "Differ from the rules", "Contacts off"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
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
                    <TableCell sx={{ ...bodyCell, fontWeight: f.atOnce ? 700 : 400 }}>{full(f.atOnce)}</TableCell>
                    <TableCell sx={{ ...bodyCell, color: MUTED }}>{full(f.change)}</TableCell>
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
          <Typography sx={{ fontSize: "0.8rem", color: INK }}>When the hub gives a company a new owner, its contacts, its open ESO / TSA tickets and its open tasks of the old owner follow; the open tickets and tasks of someone who has left go to who takes over (SAE table). New contacts follow their company with Automatic on the Contacts tab.</Typography>
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
                    At the next scan the hub writes <b>{full(a.atOnce)} compan{a.atOnce === 1 ? "y" : "ies"}</b> in {one ?? `these ${full(ask.ccs.length)} countries`} - those with no owner or whose owner has left (to who takes over) - at most 500 every 15 minutes, their contacts following. From then on: every company whose SAE, zip code or country changes, and every new one, as the Performis copy did.
                  </Typography>
                  <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>
                    The other {full(Math.max(0, a.change - a.atOnce))} differences stay as they are in HubSpot - the Differences tab shows them: Fix in HubSpot, or correct the SAE in Performis.
                  </Typography>
                  {dirty && <Typography sx={{ fontSize: "0.84rem", color: RED }}>Your unsaved rule changes are not used - save them first.</Typography>}
                </>
              ) : (
                <Typography sx={{ fontSize: "0.9rem", color: INK }}>The hub stops writing in {one ?? `these ${full(ask.ccs.length)} countries`} and only compares - nothing assigns their owners until they are live again.</Typography>
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
