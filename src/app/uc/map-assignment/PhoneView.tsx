"use client";

// MAP ASSIGNMENT - Phone numbers (SARCLA 25.10.2026: "a new tab phone number to integrate the workflow SARCLA | Contact
// phone number correction"). Automatic (the same evening: "this should be correct once and then automatic", "no KPI"):
// a contact with the shop's phone and no phone gets it as a valid number, and the certain repairs are written, by the
// hub itself. The page shows only what needs a person - each with a field to type the right number ("for a person
// should allow to correct here manually the number"). Reads/writes /api/uc/contact-phone (src/lib/contactPhone).

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import CircularProgress from "@mui/material/CircularProgress";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { CardTitle, FAINT, GlassCard, INK, MUTED, RED, bodyCell, clip, headCell } from "@/app/uc/report/ui";
import { Info, usePaged, when } from "@/app/connectors/parts";
import type { RunInfo, Settings } from "@/lib/contactPhone/engine";
import type { PersonRow } from "@/app/api/uc/contact-phone/route";
import { hsContact } from "./shared";

const API = "/api/uc/contact-phone";
type Data = {
  settings: Settings; last: RunInfo | null; workflowOn: boolean | null; writing: boolean; admin: boolean;
  checked: { at: string; scanned: number } | null; person: PersonRow[]; done: { filled: number; repaired: number; byHand: number };
};

/** The field and Save of one contact: the number is checked on the hub (in the contact's country), then written. */
function Fix({ r, onDone }: { r: PersonRow; onDone: (id: string, phone: string) => void }) {
  const [v, setV] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    if (!v.trim()) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "set", id: r.id, phone: v.trim() }) });
      const j = (await res.json()) as { ok: boolean; error?: string; data?: { phone?: string } };
      if (j.ok && j.data?.phone) onDone(r.id, j.data.phone);
      else setErr(j.error ?? `HTTP ${res.status}`);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Box>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
        <TextField size="small" value={v} onChange={(e) => { setV(e.target.value); setErr(null); }} onKeyDown={(e) => { if (e.key === "Enter") void save(); }}
          placeholder="+41 79 123 45 67" inputProps={{ "aria-label": `Correct number for ${r.name || r.email || r.id}` }} sx={{ width: 190, "& input": { fontSize: "0.84rem", py: 0.75 } }} />
        <Button size="small" variant="contained" disableElevation disabled={busy || !v.trim()} onClick={() => void save()} sx={{ textTransform: "none", minWidth: 64 }}>
          {busy ? <CircularProgress size={14} color="inherit" /> : "Save"}
        </Button>
      </Box>
      {err && <Box sx={{ fontSize: "0.74rem", color: RED, mt: 0.5, maxWidth: 320 }}>{err}</Box>}
    </Box>
  );
}

export function PhoneView() {
  const [n, setN] = useState(0);
  const url = `${API}${n ? `?n=${n}` : ""}`;
  const held = useHeld<Data>(url, [url]);
  const r = held.result;
  const d = r?.state === "ok" ? r.data : null;
  const [q, setQ] = useState("");
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (d?.person ?? []).filter((x) => !saved[x.id] && (!t || `${x.name} ${x.email} ${x.country} ${x.phone} ${x.shop}`.toLowerCase().includes(t)));
  }, [d, q, saved]);
  const { slice, pager } = usePaged(rows, 25);

  if (r === null) return <LoadingPanel label="Reading the phone numbers that need a person…" />;
  if (!d) return <UpstreamPanel source="Phone numbers" error={r.state === "error" ? r.error : "not there yet - this tab fills in once the hub is deployed"} status={r.state === "error" ? r.status : null} onRetry={() => setN((x) => x + 1)} />;

  const call = async (what: string, method: "PUT" | "POST", body: unknown) => {
    setBusy(what); setMsg(null);
    try {
      const res = await fetch(API, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await res.json()) as { ok: boolean; error?: string };
      setMsg(j.ok ? (what === "scan" ? "Reading every phone - the list is new within a few minutes." : "Done.") : j.error ?? `HTTP ${res.status}`);
      setN((x) => x + 1);
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(null); }
  };
  const mode = d.settings.mode;
  const fixedNow = Object.keys(saved).length;

  return (
    <>
      {mode !== "live" ? (
        <Info>{mode === "shadow" ? "Paused - nothing is written to HubSpot until it is switched back on below." : "Off - nothing is looked at."}</Info>
      ) : !d.writing ? (
        <Info><b>Waiting:</b> the HubSpot workflow “SARCLA | Contact phone number correction” is {d.workflowOn ? "switched on again" : "not readable"} - the hub writes nothing while it runs.</Info>
      ) : (
        <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>
          Automatic: every 15 minutes a contact with the shop&apos;s phone and no phone gets it as a valid number (+41 …), and every phone in HubSpot is checked once a day - the certain repairs are written by themselves.
          {` Last 30 days: ${full(d.done.filled)} filled, ${full(d.done.repaired)} repaired, ${full(d.done.byHand + fixedNow)} corrected by hand.`}
        </Typography>
      )}

      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<PhoneOutlinedIcon />} tint="pink" title={`Phone numbers for a person · ${full(Math.max(0, d.person.length - fixedNow))}`}
          note="No valid number could be made from these - usually digits missing in what the customer typed. Type the right number (+41 79 … or as dialled in the contact's country) and Save: it is checked and written to HubSpot." />
        <TextField size="small" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a name, e-mail, country or number" sx={{ mb: 1.5, width: { xs: "100%", sm: 340 } }} />
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>{["Contact", "Country", "Phone now", "Shop phone", "The right number"].map((h, i) => <TableCell key={i} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {slice.map((x) => (
                <TableRow key={x.id}>
                  <TableCell sx={bodyCell}>
                    <Box component="a" href={hsContact(x.id)} target="_blank" rel="noopener" sx={{ color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(240) }}>{x.name || x.email || x.id}</Box>
                    <Box sx={{ fontSize: "0.74rem", color: MUTED, ...clip(240) }}>{x.email || "no e-mail"}</Box>
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", color: x.country ? INK : FAINT }}>{x.country || "—"}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", color: x.phone ? INK : FAINT }}>{x.phone || "empty"}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", color: x.shop ? INK : FAINT }}>{x.shop || "—"}</TableCell>
                  <TableCell sx={bodyCell}><Fix r={x} onDone={(id, phone) => setSaved((s) => ({ ...s, [id]: phone }))} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
        {pager}
        {!rows.length && <Typography sx={{ fontSize: "0.85rem", color: MUTED, mt: 1 }}>{d.checked ? (q ? "Nothing matches." : "Nothing needs a person.") : "Every phone is checked within minutes of the deploy."}</Typography>}
        {fixedNow > 0 && <Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: 1 }}>{full(fixedNow)} corrected just now: {Object.values(saved).slice(-3).join(", ")}{fixedNow > 3 ? " …" : ""}</Typography>}
        {d.checked && <Typography sx={{ fontSize: "0.76rem", color: FAINT, mt: 1 }}>Every phone checked {when(d.checked.at)} ({full(d.checked.scanned)} read){d.last ? ` · last run ${when(d.last.at)}` : ""}.</Typography>}
      </GlassCard>

      {d.admin && (
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
          <Typography sx={{ fontSize: "0.78rem", color: FAINT }}>Admin:</Typography>
          <Button size="small" variant="text" disabled={!!busy} onClick={() => void call("mode", "PUT", { mode: mode === "live" ? "shadow" : "live" })} sx={{ textTransform: "none" }}>{mode === "live" ? "Pause" : "Switch on"}</Button>
          <Button size="small" variant="text" disabled={!!busy || mode === "off"} onClick={() => void call("run", "POST", { action: "run" })} sx={{ textTransform: "none" }}>Run now</Button>
          <Button size="small" variant="text" disabled={!!busy || mode === "off"} onClick={() => void call("scan", "POST", { action: "scan" })} sx={{ textTransform: "none" }}>Check every phone now</Button>
          {busy && <CircularProgress size={14} />}
          {msg && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{msg}</Typography>}
        </Box>
      )}
    </>
  );
}
