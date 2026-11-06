"use client";

// THE WAY IN - Back Office distribution > Way in (SARCLA 06.11.2026: "the logic of ticket creation for me should be on
// back office distribution, a new tab that we can steer as well"). "SARCLA | Back Office Ticket Created |
// Notification" in the hub: who writes it now and how close the hub is to the workflow; the mail and who gets it; the
// waits; the Back Office's own people; the sender -> team list; and every ticket that came in. A certificate request
// is handed to Certificates (the requester, then its steps).

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import CircularProgress from "@mui/material/CircularProgress";
import LoginOutlinedIcon from "@mui/icons-material/LoginOutlined";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import AlternateEmailOutlinedIcon from "@mui/icons-material/AlternateEmailOutlined";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import ListAltOutlinedIcon from "@mui/icons-material/ListAltOutlined";
import Grid from "@mui/material/Grid";
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import VerifiedOutlinedIcon from "@mui/icons-material/VerifiedOutlined";
import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, KpiTile, MUTED, RED, bodyCell, clip, headCell, hsTicket } from "@/app/uc/report/ui";
import { Chip, usePaged, when } from "@/app/connectors/parts";
import { full } from "@/app/charts/format";
import { PeoplePicker } from "@/app/uc/PeoplePicker";
import type { IntakeLast, IntakeRow } from "@/lib/boDistribution/intakeRun";
import type { IntakeSettings, Team } from "@/lib/boDistribution/intakeSettings";

type State = {
  workflow: { on: boolean; updatedAt: string | null } | null; workflowName: string; offAt: string | null; last: IntakeLast | null; mailReady: boolean;
  figures: { compared: number; same: number; byBranch: Record<string, { n: number; same: number }>; done: number; failed: number };
  rows: IntakeRow[];
  settings: IntakeSettings; names: Record<string, string>; choices: { id: string; name: string }[]; users: { id: string; name: string }[]; admin: boolean;
  defaults: { teams: Team[]; creators: string[]; waitS: number; emailWaitS: number; maxAgeMin: number };
  bounds: { waitS: readonly [number, number]; emailWaitS: readonly [number, number]; maxAgeMin: readonly [number, number] };
};
const GREEN = "#1b7a55";
const BRANCH: Record<string, string> = {
  "MAIL TO CUSTOMER": "Back Office's own - mail to customer / A+P team", FORM: "Form", "EMAIL TEAM": "E-mail from an A+P team",
  EMAIL: "E-mail", CERTIFICATE: "Certificate request", "BY HAND": "Created by hand",
};
const WRITTEN: Record<string, string> = { subject: "subject", back_office_ticket_requester: "requester", hubspot_owner_id: "owner", hs_pipeline_stage: "stage" };

async function put(body: object): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch("/api/uc/bo-distribution/intake", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = (await r.json()) as { ok: boolean; error?: string };
    return j.ok ? { ok: true } : { ok: false, error: j.error ?? `HTTP ${r.status}` };
  } catch (e) { return { ok: false, error: String((e as Error).message) }; }
}

// ---------------- who writes it ----------------
function StatusCard({ s }: { s: State }) {
  const hub = !!s.offAt;
  const f = s.figures;
  return (
    <GlassCard>
      <CardTitle icon={<LoginOutlinedIcon />} tint={hub ? "green" : "amber"} title={`The way in: ${s.workflowName}`} note="Every ticket that enters Back Office New - written before the distribution gives it a person, in the same minute" />
      <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center", mb: 1 }}>
        <Chip tint={!s.workflow ? "amber" : s.workflow.on ? "pink" : "slate"}>{!s.workflow ? "HubSpot unreadable" : s.workflow.on ? "Workflow ON in HubSpot" : "Workflow off in HubSpot"}</Chip>
        <Chip tint={hub ? "green" : "amber"}>{hub ? `Run by the hub since ${when(s.offAt)}` : "Run by HubSpot - the hub compares"}</Chip>
        {!s.mailReady && <Chip tint="pink">The hub cannot send mail here</Chip>}
      </Box>
      <Typography sx={{ fontSize: "0.82rem", color: INK }}>
        {hub
          ? "The hub writes the way in: subject, requester, owner Backoffice Team (stage Assigned for the Back Office's own mails), the mail - then the distribution assigns. Switching the workflow back on in HubSpot is the roll-back; the hub sees it within 2 minutes."
          : "The workflow still writes it. The hub works out the same for every ticket that enters New and compares, 10 minutes later. Once the workflow is switched off in HubSpot, the hub writes it from that moment."}
      </Typography>
      <Typography sx={{ mt: 0.75, fontSize: "0.8rem", color: MUTED }}>
        {f.compared ? `Compared with the workflow, 7 days: ${full(f.same)} of ${full(f.compared)} the same` : "Nothing compared yet - the first tickets show 10 minutes after they enter New"}
        {Object.keys(f.byBranch).length ? ` (${Object.entries(f.byBranch).map(([k, v]) => `${BRANCH[k] ?? k} ${v.same}/${v.n}`).join(" · ")})` : ""}
        {f.done ? ` · written by the hub: ${full(f.done)}` : ""}{f.failed ? ` · failed: ${full(f.failed)}` : ""}
        {s.last ? ` · last look ${when(s.last.at)}${s.last.error ? ` - ${s.last.error}` : ""}` : ""}
      </Typography>
    </GlassCard>
  );
}

// ---------------- the figures, 7 days ----------------
function KpiBand({ s }: { s: State }) {
  const week = s.rows.filter((r) => Date.now() - Date.parse(r.enteredAt) < 7 * 86400_000);
  const today = s.rows.filter((r) => new Date(r.enteredAt).toLocaleDateString("en-CA", { timeZone: "Europe/Zurich" }) === new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Zurich" }));
  const f = s.figures;
  const mails = week.filter((r) => (r.mailText ?? "").startsWith("mail to")).length;
  const certs = week.filter((r) => r.what === "certificates" || r.branch === "CERTIFICATE").length;
  const branches = Object.entries(week.reduce<Record<string, number>>((a, r) => { if (r.branch) a[r.branch] = (a[r.branch] ?? 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]);
  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 6, md: 4, lg: 2.4 }}><KpiTile icon={<InboxOutlinedIcon />} tint="blue" label="Tickets in" value={full(week.length)} note={`7 days · ${full(today.length)} today`} /></Grid>
      <Grid size={{ xs: 6, md: 4, lg: 2.4 }}><KpiTile icon={<FactCheckOutlinedIcon />} tint="green" label="Same as the workflow" value={f.compared ? `${Math.round((f.same / f.compared) * 100)}%` : "—"} note={f.compared ? `${full(f.same)} of ${full(f.compared)} compared` : "compared while the workflow runs"} /></Grid>
      <Grid size={{ xs: 6, md: 4, lg: 2.4 }}><KpiTile icon={<EditNoteOutlinedIcon />} tint="purple" label="Written by the hub" value={full(f.done)} note={f.failed ? `${full(f.failed)} failed` : s.offAt ? "7 days" : "once the workflow is off"} /></Grid>
      <Grid size={{ xs: 6, md: 4, lg: 2.4 }}><KpiTile icon={<MailOutlineIcon />} tint="amber" label="Mails sent" value={full(mails)} note={s.settings.mail ? `to ${s.settings.to.length ? s.settings.to.map((id) => s.names[id] ?? id).join(", ") : "nobody yet"}` : "switched off"} /></Grid>
      <Grid size={{ xs: 6, md: 4, lg: 2.4 }}><KpiTile icon={<VerifiedOutlinedIcon />} tint="pink" label="To Certificates" value={full(certs)} note={branches.length ? `most: ${BRANCH[branches[0][0]] ?? branches[0][0]} ${full(branches[0][1])}` : "7 days"} /></Grid>
    </Grid>
  );
}

// ---------------- the rules ----------------
function RulesCard({ s }: { s: State }) {
  return (
    <GlassCard>
      <CardTitle icon={<MenuBookOutlinedIcon />} tint="blue" title="What the way in writes" note="Branch by branch, as the workflow had it - the first that fits" />
      <Box component="ol" sx={{ m: 0, pl: 2.5, display: "grid", gap: 0.5, fontSize: "0.8rem", color: INK, listStyleType: "decimal", "& > li": { display: "list-item" } }}>
        <li><b>Created by the Back Office itself</b> ({full(s.settings.creators.length)} people, below): &quot;BO | MAIL TO CUSTOMER or A+P TEAMS&quot;, stage Assigned, owner = the e-mail&apos;s owner. No mail.</li>
        <li><b>A form</b>: the mail only (the form&apos;s own workflow wrote subject and owner).</li>
        <li><b>An e-mail</b>: the sender names the A+P team ({full(s.settings.teams.length)} teams, below) - &quot;BO | EMAIL | team | e-mail subject |&quot;; any other sender &quot;BO | requirement category Email | e-mail subject |&quot;. Requester = the owner, owner = Backoffice Team, the mail.</li>
        <li><b>A certificate request</b> (a certificate named): handed to <Box component="a" href="/uc/certificates#console" sx={{ color: INK, fontWeight: 700 }}>Certificates</Box> - it sets the requester and takes the ticket on (AVOR, the Back Office, the experts).</li>
        <li><b>Created by hand</b> (anything else): &quot;BO | requirement category | owner&quot;, requester = the owner, owner = Backoffice Team, the mail.</li>
      </Box>
      <Typography sx={{ mt: 1, fontSize: "0.74rem", color: FAINT }}>
        Never taken in: a ticket made from a mail of the hub&apos;s own (it would loop), a ticket already out of New, one older than {s.settings.maxAgeMin} minutes (the hub was not running).
      </Typography>
    </GlassCard>
  );
}

// ---------------- the mail ----------------
function MailCard({ s, onChanged }: { s: State; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async (body: object) => { setBusy(true); setErr(null); const r = await put(body); if (!r.ok) setErr(r.error ?? "failed"); setBusy(false); onChanged(); };
  const flip = (on: boolean) => { if (!on && !window.confirm("Switch off \"❗Back Office Ticket Created\"?\n\nThe hub still writes subject, requester and owner - only the mail stops.")) return; void save({ mail: on }); };
  return (
    <GlassCard>
      <CardTitle icon={<MailOutlineIcon />} tint="purple" title={"\"❗Back Office Ticket Created\""} note="The mail on each new ticket, with its information - one mail to everyone picked" />
      <Box sx={{ display: "flex", gap: 1.25, alignItems: "center", p: 1, borderRadius: "10px", border: `1px solid ${HAIRLINE}`, mb: 1 }}>
        <Switch size="small" checked={s.settings.mail} disabled={!s.admin || busy} onChange={(e) => flip(e.target.checked)} inputProps={{ "aria-label": "The mail" }} />
        <Typography sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK }}>{s.settings.mail ? "On" : "Off"} {busy && <CircularProgress size={12} />}</Typography>
        <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>e-mails, forms and tickets created by hand get it</Typography>
      </Box>
      <PeoplePicker label="Who gets it" ids={s.settings.to} allowEmpty choices={s.choices} names={s.names} disabled={!s.admin || busy} onSave={(ids) => void save({ to: ids })} />
      <Typography sx={{ mt: 0.75, fontSize: "0.72rem", color: FAINT }}>
        Never the Backoffice Team or TSA Team themselves: their address is a HubSpot inbox, and a mail there comes back as a new ticket (05.11.2026: 120 tickets in 44 minutes). Nobody picked = not sent.
        {!s.settings.own.to ? " Until changed here: the people picked on Certificates > Console." : ""}
      </Typography>
      {err && <Typography sx={{ mt: 1, fontSize: "0.82rem", color: RED }}>{err}</Typography>}
    </GlassCard>
  );
}

// ---------------- the waits ----------------
const WAITS: { key: "waitS" | "emailWaitS" | "maxAgeMin"; label: string; unit: string; text: string }[] = [
  { key: "waitS", label: "After entry", unit: "seconds", text: "how long after a ticket enters New the hub writes it (the form or the e-mail first fill it)" },
  { key: "emailWaitS", label: "An e-mail ticket waits", unit: "seconds", text: "for its e-mail at most - the sender names the team" },
  { key: "maxAgeMin", label: "Left alone after", unit: "minutes", text: "a ticket not taken in by then (the hub was not running) - a person may have it already" },
];
function WaitsCard({ s, onChanged }: { s: State; onChanged: () => void }) {
  const [v, setV] = useState({ waitS: s.settings.waitS, emailWaitS: s.settings.emailWaitS, maxAgeMin: s.settings.maxAgeMin });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const changed = WAITS.some((w) => v[w.key] !== s.settings[w.key]);
  const isDefault = WAITS.every((w) => s.settings[w.key] === s.defaults[w.key]);
  const save = async (body: object) => { setBusy(true); setMsg(null); const r = await put(body); setMsg(r.ok ? { ok: true, text: "Saved - the next minute works this way." } : { ok: false, text: r.error ?? "failed" }); setBusy(false); onChanged(); };
  return (
    <GlassCard>
      <CardTitle icon={<ScheduleOutlinedIcon />} tint="amber" title="The waits" note={isDefault ? "The workflow's" : "Changed from the workflow's"} />
      <Box sx={{ display: "grid", gap: 1 }}>
        {WAITS.map((w) => (
          <Box key={w.key} sx={{ display: "flex", gap: 1.25, alignItems: "center", flexWrap: "wrap" }}>
            <TextField size="small" type="number" label={w.label} value={v[w.key]} disabled={!s.admin || busy} sx={{ width: 170 }}
              onChange={(e) => setV((x) => ({ ...x, [w.key]: Number(e.target.value) }))}
              inputProps={{ min: s.bounds[w.key][0], max: s.bounds[w.key][1], step: 1 }}
              helperText={`${w.unit}, ${s.bounds[w.key][0]}-${s.bounds[w.key][1]}${s.settings[w.key] !== s.defaults[w.key] ? ` (workflow: ${s.defaults[w.key]})` : ""}`} />
            <Typography sx={{ fontSize: "0.76rem", color: MUTED, flex: 1, minWidth: 180 }}>{w.text}</Typography>
          </Box>
        ))}
      </Box>
      {s.admin && (
        <Box sx={{ mt: 1, display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
          <Button size="small" variant="contained" disableElevation disabled={!changed || busy} onClick={() => void save(v)}>Save the waits</Button>
          {!isDefault && <Button size="small" variant="outlined" disabled={busy} onClick={() => { setV({ waitS: s.defaults.waitS, emailWaitS: s.defaults.emailWaitS, maxAgeMin: s.defaults.maxAgeMin }); void save({ reset: "waits" }); }}>Back to the workflow&apos;s</Button>}
        </Box>
      )}
      {msg && <Typography sx={{ mt: 1, fontSize: "0.82rem", color: msg.ok ? GREEN : RED }}>{msg.text}</Typography>}
    </GlassCard>
  );
}

// ---------------- the Back Office's own people ----------------
function CreatorsCard({ s, onChanged }: { s: State; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const names: Record<string, string> = Object.fromEntries(s.users.map((u) => [u.id, u.name]));
  for (const id of s.settings.creators) names[id] ??= s.names[`u${id}`] ?? s.names[id] ?? `User ${id}`;
  const isDefault = s.settings.creators.join() === s.defaults.creators.join();
  const save = async (body: object) => { setBusy(true); setErr(null); const r = await put(body); if (!r.ok) setErr(r.error ?? "failed"); setBusy(false); onChanged(); };
  return (
    <GlassCard>
      <CardTitle icon={<GroupsOutlinedIcon />} tint="blue" title="The Back Office's own people" note="A ticket one of them creates is their mail to a customer or an A+P team (branch 1) - not a request to hand out" />
      <PeoplePicker label="HubSpot users" ids={s.settings.creators} choices={s.users} names={names} disabled={!s.admin || busy} onSave={(ids) => void save({ creators: ids })} />
      {s.admin && !isDefault && <Button sx={{ mt: 1 }} size="small" variant="outlined" disabled={busy} onClick={() => void save({ reset: "creators" })}>Back to the workflow&apos;s {full(s.defaults.creators.length)}</Button>}
      {err && <Typography sx={{ mt: 1, fontSize: "0.82rem", color: RED }}>{err}</Typography>}
    </GlassCard>
  );
}

// ---------------- the senders -> teams ----------------
function TeamsCard({ s, onChanged }: { s: State; onChanged: () => void }) {
  const toRows = (t: Team[]) => t.map((x) => ({ team: x.team, from: x.from.join(", ") }));
  const [rows, setRows] = useState(toRows(s.settings.teams));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const parsed: Team[] = rows.map((r) => ({ team: r.team.trim(), from: r.from.split(/[\s,;]+/).map((a) => a.trim()).filter(Boolean) })).filter((r) => r.team || r.from.length);
  const changed = JSON.stringify(parsed) !== JSON.stringify(s.settings.teams);
  const isDefault = JSON.stringify(s.settings.teams) === JSON.stringify(s.defaults.teams);
  const save = async (body: object) => { setBusy(true); setMsg(null); const r = await put(body); setMsg(r.ok ? { ok: true, text: "Saved - the next e-mail ticket is read with it." } : { ok: false, text: r.error ?? "failed" }); setBusy(false); onChanged(); };
  const addresses = s.settings.teams.reduce((a, t) => a + t.from.length, 0);
  return (
    <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
      <Box sx={{ px: { xs: 2, md: 2.75 } }}>
        <CardTitle icon={<AlternateEmailOutlinedIcon />} tint="green" title={`The A+P teams: ${full(s.settings.teams.length)} teams, ${full(addresses)} sender addresses`} note={'An e-mail from one of these addresses gets "BO | EMAIL | team | subject |" - the first team that has the sender wins'} />
      </Box>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead><TableRow>{["Team (in the subject)", "Sender addresses", ""].map((h, i) => <TableCell key={`${h}${i}`} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell sx={{ ...bodyCell, width: 230 }}>
                  {s.admin ? <TextField size="small" value={r.team} disabled={busy} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, team: e.target.value } : y)))} inputProps={{ "aria-label": `Team ${i + 1}` }} sx={{ width: 210 }} />
                    : <Typography sx={{ fontSize: "0.82rem", fontWeight: 600 }}>{r.team}</Typography>}
                </TableCell>
                <TableCell sx={bodyCell}>
                  {s.admin ? <TextField size="small" fullWidth value={r.from} disabled={busy} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, from: e.target.value } : y)))} inputProps={{ "aria-label": `${r.team} senders` }} />
                    : <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{r.from}</Typography>}
                </TableCell>
                <TableCell sx={{ ...bodyCell, width: 50 }}>
                  {s.admin && <Button size="small" variant="text" disabled={busy} onClick={() => setRows((x) => x.filter((_, j) => j !== i))} aria-label={`Take ${r.team} out`}>×</Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      {s.admin && (
        <Box sx={{ px: 2, py: 1.25, display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
          <Button size="small" variant="text" disabled={busy} onClick={() => setRows((x) => [...x, { team: "", from: "" }])}>Add a team</Button>
          <Button size="small" variant="contained" disableElevation disabled={!changed || busy} onClick={() => void save({ teams: parsed })}>Save the teams</Button>
          {changed && <Button size="small" variant="text" disabled={busy} onClick={() => setRows(toRows(s.settings.teams))}>Undo</Button>}
          {!isDefault && <Button size="small" variant="outlined" disabled={busy} onClick={() => { if (window.confirm(`Back to the workflow's ${s.defaults.teams.length} teams and ${s.defaults.teams.reduce((a, t) => a + t.from.length, 0)} addresses?`)) { setRows(toRows(s.defaults.teams)); void save({ reset: "teams" }); } }}>Back to the workflow&apos;s</Button>}
          <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>Addresses separated by commas; team names are written in capitals.</Typography>
        </Box>
      )}
      {msg && <Typography sx={{ px: 2, pb: 1.25, fontSize: "0.82rem", color: msg.ok ? GREEN : RED }}>{msg.text}</Typography>}
    </GlassCard>
  );
}

// ---------------- the tickets ----------------
function TicketsCard({ s }: { s: State }) {
  const [f, setF] = useState<"all" | "written" | "compared" | "differs" | "certificates" | "skipped">("all");
  const tests: Record<typeof f, (r: IntakeRow) => boolean> = {
    all: () => true, written: (r) => r.what === "done" || r.what === "failed", compared: (r) => r.what === "shadow",
    differs: (r) => r.what === "shadow" && !!r.actual && !r.actual.same, certificates: (r) => r.what === "certificates" || r.branch === "CERTIFICATE", skipped: (r) => r.what === "skipped",
  };
  const rows = s.rows.filter(tests[f]);
  const { slice, pager } = usePaged(rows, 20);
  const chips: { key: typeof f; label: string }[] = [
    { key: "all", label: "All" }, { key: "written", label: "Written by the hub" }, { key: "compared", label: "Compared" }, { key: "differs", label: "Differs" },
    { key: "certificates", label: "To Certificates" }, { key: "skipped", label: "Left alone" },
  ];
  return (
    <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
      <Box sx={{ px: { xs: 2, md: 2.75 }, display: "grid", gap: 1 }}>
        <CardTitle icon={<ListAltOutlinedIcon />} tint="slate" title="The tickets that came in" note="Newest first: the branch, what the hub writes (or would), and the result" />
        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
          {chips.map((c) => {
            const on = c.key === f;
            return (
              <Box key={c.key} component="button" type="button" onClick={() => setF(c.key)} sx={{
                all: "unset", cursor: "pointer", px: 1.25, py: 0.4, borderRadius: "999px", fontSize: "0.8rem", fontWeight: on ? 700 : 500,
                color: on ? "#fff" : INK, bgcolor: on ? INK : "rgba(255,255,255,.85)", border: `1px solid ${on ? INK : HAIRLINE}`, "&:focus-visible": { outline: `2px solid ${INK}`, outlineOffset: 2 },
              }}>{c.label} <span style={{ opacity: 0.7 }}>{full(s.rows.filter(tests[c.key]).length)}</span></Box>
            );
          })}
        </Box>
      </Box>
      <Box sx={{ overflowX: "auto", mt: 1 }}>
        <Table size="small">
          <TableHead><TableRow>{["Entered New", "Ticket", "Way in", "The hub writes", "Result"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {!rows.length && <TableRow><TableCell colSpan={5} sx={{ ...bodyCell, color: MUTED, fontSize: "0.84rem" }}>None.</TableCell></TableRow>}
            {slice.map((r) => (
              <TableRow key={`${r.ticketId}-${r.at}`} hover>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED, whiteSpace: "nowrap" }}>{when(r.enteredAt)}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>
                  <Box component="a" href={hsTicket(r.ticketId)} target="_blank" rel="noopener" sx={{ color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(300) }}>
                    {r.subjectBefore || `Ticket ${r.ticketId}`}
                  </Box>
                </TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.78rem" }}>{r.branch ? BRANCH[r.branch] ?? r.branch : "-"}{r.team ? <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{r.team}</Typography> : null}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.76rem", color: MUTED }}>
                  {r.props.subject ? <Typography sx={{ fontSize: "0.76rem", color: INK, ...clip(320) }}>{r.props.subject}</Typography> : null}
                  {Object.keys(r.props).filter((k) => k !== "subject").map((k) => WRITTEN[k] ?? k).join(" · ")}{r.mail ? `${Object.keys(r.props).length > 1 ? " · " : ""}mail` : ""}
                  {!Object.keys(r.props).length && !r.mail ? (r.what === "certificates" ? "nothing - Certificates" : "nothing") : ""}
                </TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.78rem" }}>
                  {r.what === "shadow" && r.actual ? (
                    <>
                      <Chip tint={r.actual.same ? "green" : "pink"}>{r.actual.same ? "same as the workflow" : r.actual.wrote ? "differs" : "the workflow wrote nothing"}</Chip>
                      {r.actual.diffs.map((x) => <Typography key={x} sx={{ fontSize: "0.7rem", color: FAINT, ...clip(360) }}>{x}</Typography>)}
                    </>
                  ) : (
                    <>
                      <Chip tint={r.what === "done" ? "green" : r.what === "failed" ? "pink" : r.what === "certificates" ? "purple" : "slate"}>{r.what === "done" ? "written" : r.what === "certificates" ? "to Certificates" : r.what === "skipped" ? "left alone" : r.what}</Chip>
                      {(r.error || r.why || r.mailText) && <Typography sx={{ fontSize: "0.72rem", color: r.error ? RED : MUTED }}>{r.error ?? r.mailText ?? r.why}</Typography>}
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      <Box sx={{ px: 2, py: 1 }}>{pager}</Box>
    </GlassCard>
  );
}

export function WayInTab() {
  const [s, setS] = useState<State | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    let live = true;
    fetch(`/api/uc/bo-distribution/intake${n ? `?n=${n}` : ""}`).then((r) => r.json()).then((j: { ok: boolean; data?: State; error?: string }) => {
      if (!live) return;
      if (j.ok && j.data) { setS(j.data); setErr(null); } else setErr(j.error ?? "could not be read");
    }).catch((e) => live && setErr(String((e as Error).message)));
    return () => { live = false; };
  }, [n]);
  const reload = () => setN((x) => x + 1);
  if (err && !s) return <GlassCard><Typography sx={{ fontSize: "0.84rem", color: RED }}>The way in could not be read: {err}</Typography></GlassCard>;
  if (!s) return <GlassCard><Box sx={{ display: "flex", gap: 1, alignItems: "center" }}><CircularProgress size={14} /><Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Reading the way in…</Typography></Box></GlassCard>;
  return (
    <>
      <KpiBand s={s} />
      <StatusCard s={s} />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, gap: 2.5, alignItems: "start" }}>
        <RulesCard s={s} />
        <MailCard key={`m${s.settings.at ?? ""}`} s={s} onChanged={reload} />
        <WaitsCard key={`w${s.settings.at ?? ""}`} s={s} onChanged={reload} />
        <CreatorsCard key={`c${s.settings.at ?? ""}`} s={s} onChanged={reload} />
      </Box>
      <TeamsCard key={`t${s.settings.at ?? ""}`} s={s} onChanged={reload} />
      <TicketsCard s={s} />
      {s.settings.by && <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>Last change here: {s.settings.by}, {when(s.settings.at ?? null)}</Typography>}
    </>
  );
}
