"use client";

// DUPLICATES & MERGES > Contacts > Name letters (SARCLA 10.11.2026: "CONTACT NAME UTF-8 this is a small tab on contact
// duplicate"). Replaces the workflow "SARCLA | CONTACT NAME | UTF-8 CORRECT BY CODE": a name with broken letters
// ("MÃ¼ller") is repaired by the hub itself when the repair is sure; the page shows only what needs a person - each with
// the name to type, or "The name is right" (João, O'Reilly: HubSpot's list flags them too). Reads/writes
// /api/uc/contact-names (src/lib/contactNames).

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
import SpellcheckOutlinedIcon from "@mui/icons-material/SpellcheckOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { CardTitle, FAINT, GlassCard, INK, MUTED, RED, bodyCell, clip, headCell } from "@/app/uc/report/ui";
import { Info, usePaged, when } from "@/app/connectors/parts";
import type { RunInfo, Settings } from "@/lib/contactNames/engine";
import type { DoneRow, NameRow } from "@/app/api/uc/contact-names/route";
import { hsContact } from "@/app/uc/map-assignment/shared";

const API = "/api/uc/contact-names";
type Data = {
  settings: Settings; last: RunInfo | null; workflowOn: boolean | null; writing: boolean; admin: boolean;
  person: NameRow[]; done: DoneRow[]; waiting: number; rightCount: number;
};

const post = async (body: unknown) => {
  const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return (await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }))) as { ok: boolean; error?: string };
};

/** The two fields, Save and "The name is right" of one contact. */
function Fix({ r, onDone }: { r: NameRow; onDone: (id: string, text: string) => void }) {
  const [first, setFirst] = useState(r.proposal?.first ?? r.first);
  const [last, setLast] = useState(r.proposal?.last ?? r.last);
  const [busy, setBusy] = useState<"set" | "right" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const act = async (action: "set" | "right") => {
    setBusy(action); setErr(null);
    try {
      const j = await post(action === "set" ? { action, id: r.id, first, last } : { action, id: r.id });
      if (j.ok) onDone(r.id, action === "set" ? `${first} ${last}`.trim() : `${r.first} ${r.last}`.trim());
      else setErr(j.error ?? "Not saved");
    } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };
  const field = { width: 150, "& input": { fontSize: "0.84rem", py: 0.75 } };
  return (
    <Box>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
        <TextField size="small" value={first} onChange={(e) => { setFirst(e.target.value); setErr(null); }} placeholder="First name" inputProps={{ "aria-label": `First name of ${r.email || r.id}` }} sx={field} />
        <TextField size="small" value={last} onChange={(e) => { setLast(e.target.value); setErr(null); }} onKeyDown={(e) => { if (e.key === "Enter") void act("set"); }} placeholder="Last name" inputProps={{ "aria-label": `Last name of ${r.email || r.id}` }} sx={field} />
        <Button size="small" variant="contained" disableElevation disabled={!!busy || (!first.trim() && !last.trim())} onClick={() => void act("set")} sx={{ textTransform: "none", minWidth: 64 }}>
          {busy === "set" ? <CircularProgress size={14} color="inherit" /> : "Save"}
        </Button>
        <Button size="small" variant="text" disabled={!!busy} onClick={() => void act("right")} sx={{ textTransform: "none" }}>
          {busy === "right" ? <CircularProgress size={14} /> : "The name is right"}
        </Button>
      </Box>
      {err && <Box sx={{ fontSize: "0.74rem", color: RED, mt: 0.5, maxWidth: 420 }}>{err}</Box>}
    </Box>
  );
}

export function NameLetters() {
  const [n, setN] = useState(0);
  const url = `${API}${n ? `?n=${n}` : ""}`;
  const held = useHeld<Data>(url, [url]);
  const r = held.result;
  const d = r?.state === "ok" ? r.data : null;
  const [q, setQ] = useState("");
  const [handled, setHandled] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (d?.person ?? []).filter((x) => !handled[x.id] && (!t || `${x.first} ${x.last} ${x.email}`.toLowerCase().includes(t)));
  }, [d, q, handled]);
  const { slice, pager } = usePaged(rows, 25);
  const doneList = usePaged(d?.done ?? [], 10);

  if (r === null) return <LoadingPanel label="Reading the names with broken letters…" />;
  if (!d) return <UpstreamPanel source="Name letters" error={r.state === "error" ? r.error : "not there yet - this tab fills in once the hub is deployed"} status={r.state === "error" ? r.status : null} onRetry={() => setN((x) => x + 1)} />;

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
  const byHub = d.done.filter((x) => !x.by).length, byHand = d.done.filter((x) => x.by).length;

  return (
    <>
      {mode !== "live" ? (
        <Info>{mode === "shadow" ? "Paused - nothing is written to HubSpot until it is switched back on below." : "Off - nothing is looked at."}</Info>
      ) : !d.writing ? (
        <Info><b>Waiting:</b> the HubSpot workflow “SARCLA | CONTACT NAME | UTF-8 CORRECT BY CODE” is {d.workflowOn ? "still switched on" : "not readable"} - the hub writes nothing while it runs. {full(d.waiting)} name(s) will be repaired once it is off.</Info>
      ) : (
        <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>
          Automatic: every 15 minutes the names HubSpot flags with a broken letter (MÃ¼ller for Müller, RenÃ© for René, an invisible hyphen in Jirí) are repaired by themselves when the repair is sure.
          {` Last 30 days: ${full(byHub)} repaired, ${full(byHand)} by hand.`}
        </Typography>
      )}

      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<SpellcheckOutlinedIcon />} tint="pink" title={`Names for a person · ${full(rows.length)}`}
          note="HubSpot flags these, but no sure repair could be made - a letter lost on its way (R�gie), or a name that is right as it is (João, O'Reilly, a company in the last name). Type the right name and Save, or say the name is right: it leaves the list while it stays that name." />
        <TextField size="small" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a name or e-mail" sx={{ mb: 1.5, width: { xs: "100%", sm: 340 } }} />
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 820 }}>
            <TableHead><TableRow>{["Contact", "In HubSpot", "The right name"].map((h, i) => <TableCell key={i} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {slice.map((x) => (
                <TableRow key={x.id}>
                  <TableCell sx={bodyCell}>
                    <Box component="a" href={hsContact(x.id)} target="_blank" rel="noopener" sx={{ color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(220) }}>{x.email || x.id}</Box>
                    <Box sx={{ fontSize: "0.74rem", color: FAINT }}>{x.created ? `created ${when(x.created)}` : ""}</Box>
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", color: INK }}>
                    <Box>{x.first || <span style={{ color: FAINT }}>no first name</span>} · {x.last || <span style={{ color: FAINT }}>no last name</span>}</Box>
                    {x.proposal && <Box sx={{ fontSize: "0.74rem", color: MUTED, mt: 0.25 }}>The repair found “{`${x.proposal.first} ${x.proposal.last}`.trim()}” - not sure, check it</Box>}
                  </TableCell>
                  <TableCell sx={bodyCell}><Fix r={x} onDone={(id, text) => setHandled((s) => ({ ...s, [id]: text }))} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
        {pager}
        {!rows.length && <Typography sx={{ fontSize: "0.85rem", color: MUTED, mt: 1 }}>{d.last ? (q ? "Nothing matches." : "Nothing needs a person.") : "The names are read within minutes of the deploy."}</Typography>}
        {d.last && <Typography sx={{ fontSize: "0.76rem", color: FAINT, mt: 1 }}>Last look {when(d.last.at)}: {full(d.last.listed)} name(s) flagged in HubSpot{d.rightCount ? ` · ${full(d.rightCount)} said right` : ""}{d.last.error ? ` · ${d.last.error}` : ""}.</Typography>}
      </GlassCard>

      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<TaskAltOutlinedIcon />} tint="green" title={`Repaired · ${full(d.done.length)}`} note="The last 30 days: the name before and after, by the hub or by hand." />
        {d.done.length ? (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 640 }}>
              <TableHead><TableRow>{["Contact", "Before", "After", "When", "By"].map((h, i) => <TableCell key={i} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
              <TableBody>
                {doneList.slice.map((x) => (
                  <TableRow key={`${x.id}-${x.at}`}>
                    <TableCell sx={bodyCell}><Box component="a" href={hsContact(x.id)} target="_blank" rel="noopener" sx={{ color: INK, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(220) }}>{x.email || x.id}</Box></TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", color: MUTED }}>{x.before || "—"}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", color: INK, fontWeight: 600 }}>{x.after || "—"}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED, whiteSpace: "nowrap" }}>{when(x.at)}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED }}>{x.by ? "by hand" : "the hub"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        ) : <Typography sx={{ fontSize: "0.85rem", color: MUTED }}>Nothing repaired yet.</Typography>}
        {doneList.pager}
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
