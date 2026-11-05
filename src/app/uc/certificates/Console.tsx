"use client";

// CERTIFICATES - the console (SARCLA 05.11.2026: "improve a lot the hub's tabs and steering console"; picked: the
// workflows board, the mail switches, holding a ticket, the timings). One place to steer what the hub does in place of
// the three HubSpot workflows it took over: who does each one now and what it did today; Off / Preview / Live; which
// mails go out; the times and waits; who gets the requests; the tickets on hold; the rules as they run.

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import PauseCircleOutlineIcon from "@mui/icons-material/PauseCircleOutline";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, MUTED, RED, TINT } from "@/app/uc/report/ui";
import { Chip, Choice, when } from "@/app/connectors/parts";
import { full } from "@/app/charts/format";
import type { BoardRow, Mails, Mode, RunInfo } from "@/lib/certificates/engine";
import { DEFAULT_TIMING, TIMING_BOUNDS, stepWords, type StepName, type Timing } from "@/lib/certificates/rules";
import { TicketLink, hh, put, span, type Data } from "./shared";

const GREEN = "#1b7a55";

// ---------------- the workflows board ----------------
function Board({ rows }: { rows: BoardRow[] }) {
  return (
    <GlassCard>
      <CardTitle icon={<HubOutlinedIcon />} tint="green" title="The workflows the hub runs" note="Each HubSpot workflow the hub took over: is it off in HubSpot, who does the work now, and today's figures" />
      <Box sx={{ display: "grid", gap: 1 }}>
        {rows.map((w) => {
          const hub = w.by === "hub";
          return (
            <Box key={w.id} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0, 2.4fr) minmax(0, 1fr) minmax(0, 1.3fr) auto" }, gap: { xs: 0.75, md: 1.5 }, alignItems: "center", p: 1.25, borderRadius: "12px", border: `1px solid ${HAIRLINE}`, bgcolor: hub ? TINT.green.bg + "55" : "rgba(255,255,255,.7)" }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>{w.name}</Typography>
                <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{w.what}</Typography>
              </Box>
              <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", alignItems: "center" }}>
                <Chip tint={w.hubspotOn === false ? "slate" : w.hubspotOn ? "pink" : "amber"}>{w.hubspotOn === false ? "Off in HubSpot" : w.hubspotOn ? "ON in HubSpot" : "HubSpot unreadable"}</Chip>
                <Chip tint={hub ? "green" : w.by === "off" || w.by === "unknown" ? "pink" : "amber"}>{hub ? "Run by the hub" : w.by === "hubspot" ? "Run by HubSpot" : w.by === "preview" ? "Hub in Preview - lists only" : w.by === "off" ? "Nobody runs it - the hub is Off" : "Unknown"}</Chip>
              </Box>
              <Typography sx={{ fontSize: "0.78rem", color: INK }}>
                Today: {full(w.today.written)} written · {full(w.today.mailed)} mails{w.today.failed ? <span style={{ color: RED }}> · {full(w.today.failed)} failed</span> : null}
                <span style={{ display: "block", color: FAINT, fontSize: "0.72rem" }}>
                  {w.since && w.hubspotOn === false ? `hub's since ${when(w.since)}` : ""}{w.last ? ` · last look ${when(w.last)}` : ""}
                </span>
                {w.error && <span style={{ display: "block", color: RED, fontSize: "0.72rem" }}>{w.error}</span>}
              </Typography>
              <Button size="small" variant="text" href={w.where.startsWith("#") ? `/uc/certificates${w.where}` : w.where}>Open</Button>
            </Box>
          );
        })}
      </Box>
      <Typography sx={{ mt: 1, fontSize: "0.74rem", color: FAINT }}>
        A workflow switched back on in HubSpot is the roll-back: the hub sees it within 2 minutes and stops writing what it did.
      </Typography>
    </GlassCard>
  );
}

// ---------------- how it runs ----------------
function RunCard({ d, onChanged }: { d: Data; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = async (body: object) => { setBusy("put"); setMsg(null); const r = await put(body); setMsg(r.ok ? { ok: true, text: "Saved - the next look (within 3 minutes) works this way." } : { ok: false, text: r.error ?? "failed" }); setBusy(null); onChanged(); };
  const look = async () => {
    setBusy("run"); setMsg(null);
    try {
      const r = await fetch("/api/uc/certificates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "run" }) });
      const j = (await r.json()) as { ok: boolean; data?: RunInfo; error?: string };
      setMsg(j.ok ? { ok: true, text: `Looked: ${full(j.data?.tickets ?? 0)} open requests, ${full(j.data?.written ?? 0)} written, ${full(j.data?.mailed ?? 0)} mails, ${full(j.data?.listed ?? 0)} listed.` } : { ok: false, text: j.error ?? `HTTP ${r.status}` });
    } catch (e) { setMsg({ ok: false, text: String((e as Error).message) }); } finally { setBusy(null); onChanged(); }
  };
  const l = d.last;
  return (
    <GlassCard>
      <CardTitle icon={<TuneOutlinedIcon />} tint="blue" title="How it runs" note="Every 3 minutes, on the open Back Office tickets that ask for a certificate" />
      <Box sx={{ display: "grid", gap: 1.25 }}>
        {d.admin ? (
          <Choice<Mode> value={d.settings.mode} onChange={(m) => void save({ mode: m })} options={[
            { key: "off", label: "Off" }, { key: "preview", label: "Preview - writes nothing" }, { key: "live", label: "Live - writes to HubSpot" },
          ]} />
        ) : <Chip tint={d.settings.mode === "live" ? "green" : "slate"}>{d.settings.mode}</Chip>}
        <Typography sx={{ fontSize: "0.82rem", color: d.workflowOn === true ? RED : MUTED }}>
          {d.settings.mode === "off" ? "Off - the hub does not look." : d.settings.mode === "preview" ? "Preview - the hub works out each request's steps and lists them; it writes nothing." : d.writing ? "Live - the hub takes each step when it falls due." : "Live, but not writing: the workflow SARCLA | CERTIFICATES NEW PROCESS is on again."}
          {l ? ` Last look ${when(l.at)}, ${l.seconds} s: ${full(l.tickets)} open, ${full(l.written)} written, ${full(l.mailed ?? 0)} mails${l.failed ? `, ${full(l.failed)} failed` : ""}${l.error ? ` - ${l.error}` : ""}.` : " Not looked yet."}
        </Typography>
        {d.admin && (
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
            <Button size="small" variant="outlined" disabled={!!busy || d.settings.mode === "off"} onClick={() => void look()}>{busy === "run" ? <CircularProgress size={14} /> : "Look now"}</Button>
            {d.settings.by && <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>Last change: {d.settings.by}, {when(d.settings.at)}</Typography>}
          </Box>
        )}
        {msg && <Typography sx={{ fontSize: "0.82rem", color: msg.ok ? GREEN : RED }}>{msg.text}</Typography>}
      </Box>
    </GlassCard>
  );
}

// ---------------- the mails ----------------
const MAILS: { key: keyof Mails; label: string; text: string }[] = [
  { key: "owner", label: "Reminders to the ticket's owner", text: "Certificates: 3 days before delivery, due today, 48 h, 96 h, more than a week - and the hand-over person's mail after the 15 days." },
  { key: "team", label: "Reminder to the Backoffice Team", text: "Every other Back Office ticket that goes to stage Remind Back Office: \"⚠️REMINDER: Back Office Ticket\" - to the people picked below." },
  { key: "created", label: "\"❗Back Office Ticket Created\"", text: "Every new Back Office ticket (the way in, Back Office distribution) - to the people picked below." },
];
/** Queue users: their address is a HubSpot inbox - never a recipient (05.11.2026: 120 tickets in 44 minutes) */
const INBOX_OWNERS = ["76164822", "1202569408"];
function MailsCard({ d, onChanged }: { d: Data; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const saveTo = async (ids: string[]) => { setBusy("to"); setErr(null); const r = await put({ teamTo: ids }); if (!r.ok) setErr(r.error ?? "failed"); setBusy(null); onChanged(); };
  const flip = async (k: keyof Mails, on: boolean) => {
    if (!on && !window.confirm(`Switch off: ${MAILS.find((m) => m.key === k)!.label}?\n\nThe hub still writes the subjects, stages and owners - only the mail stops.`)) return;
    setBusy(k); setErr(null);
    const r = await put({ mails: { [k]: on } });
    if (!r.ok) setErr(r.error ?? "failed");
    setBusy(null); onChanged();
  };
  return (
    <GlassCard>
      <CardTitle icon={<MailOutlineIcon />} tint="purple" title="The mails" note="What the hub mails, switched one by one - the writes in HubSpot go on either way" />
      {!d.mailReady && <Typography sx={{ mb: 1, fontSize: "0.82rem", color: RED }}>The hub cannot send mail here (no SMTP credentials) - nothing below would go out.</Typography>}
      <Box sx={{ display: "grid", gap: 0.75 }}>
        {MAILS.map((m) => (
          <Box key={m.key} sx={{ display: "flex", gap: 1.25, alignItems: "center", p: 1, borderRadius: "10px", border: `1px solid ${HAIRLINE}` }}>
            <Switch size="small" checked={d.settings.mails[m.key]} disabled={!d.admin || !!busy} onChange={(e) => void flip(m.key, e.target.checked)} inputProps={{ "aria-label": m.label }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK }}>{m.label} {busy === m.key && <CircularProgress size={12} />}</Typography>
              <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{m.text}</Typography>
            </Box>
            <Box sx={{ ml: "auto" }}><Chip tint={d.settings.mails[m.key] ? "green" : "slate"}>{d.settings.mails[m.key] ? "on" : "off"}</Chip></Box>
          </Box>
        ))}
      </Box>
      <Box sx={{ mt: 1.25, p: 1, borderRadius: "10px", border: `1px solid ${HAIRLINE}`, display: "grid", gap: 0.5 }}>
        <PeoplePicker label={"Who gets the Backoffice Team's two mails (the reminder and \"Ticket Created\") - one mail to all of them"}
          ids={d.settings.teamTo} allowEmpty choices={d.choices.filter((c) => !INBOX_OWNERS.includes(c.id))} names={d.names} disabled={!d.admin || !!busy} onSave={(ids) => void saveTo(ids)} />
        <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>
          Never the Backoffice Team or TSA Team themselves: their address is a HubSpot inbox, and a mail there comes back as a new ticket (05.11.2026: 120 tickets in 44 minutes). Nobody picked = not sent.
        </Typography>
      </Box>
      {err && <Typography sx={{ mt: 1, fontSize: "0.82rem", color: RED }}>{err}</Typography>}
    </GlassCard>
  );
}

// ---------------- the timings ----------------
const GROUPS: { title: string; fields: { key: keyof Timing; label: string; unit: string }[]; steps: StepName[] }[] = [
  { title: "Back Office", fields: [{ key: "boDaysBefore", label: "Days before delivery", unit: "days" }, { key: "boHour", label: "At (hour)", unit: "h" }, { key: "boEveryH", label: "Then every", unit: "hours" }], steps: ["bo3days", "boToday", "bo48", "bo96", "boWeek"] },
  { title: "Conformity expert", fields: [{ key: "expertHour", label: "Delivery day at (hour)", unit: "h" }, { key: "lateEveryH", label: "Late steps every", unit: "hours" }], steps: ["today", "late", "late96", "lateWeek"] },
  { title: "AVOR", fields: [{ key: "avorEveryH", label: "Reminder every", unit: "hours" }], steps: ["avor48", "avor96", "avorWeek"] },
  { title: "Hand-over", fields: [{ key: "escalationDays", label: "Days after the last reminder", unit: "days" }], steps: ["boRose"] },
];
function TimingCard({ d, onChanged }: { d: Data; onChanged: () => void }) {
  const [t, setT] = useState<Timing>(d.settings.timing);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const changed = (Object.keys(t) as (keyof Timing)[]).some((k) => t[k] !== d.settings.timing[k]);
  const isDefault = (Object.keys(DEFAULT_TIMING) as (keyof Timing)[]).every((k) => d.settings.timing[k] === DEFAULT_TIMING[k]);
  const save = async (body: object) => {
    setBusy(true); setMsg(null);
    const r = await put(body);
    setMsg(r.ok ? { ok: true, text: "Saved - the next look works with these times (a step already done is not done again)." } : { ok: false, text: r.error ?? "failed" });
    setBusy(false); onChanged();
  };
  return (
    <GlassCard>
      <CardTitle icon={<ScheduleOutlinedIcon />} tint="amber" title="The times and waits" note={isDefault ? "The workflows' own times - Swiss time" : "Changed from the workflows' times - Swiss time"} />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 1.5 }}>
        {GROUPS.map((g) => (
          <Box key={g.title} sx={{ p: 1.25, borderRadius: "12px", border: `1px solid ${HAIRLINE}`, display: "grid", gap: 1 }}>
            <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK }}>{g.title}</Typography>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              {g.fields.map((f) => (
                <TextField key={f.key} size="small" type="number" label={f.label} value={t[f.key]} disabled={!d.admin || busy}
                  onChange={(e) => setT((x) => ({ ...x, [f.key]: Number(e.target.value) }))}
                  inputProps={{ min: TIMING_BOUNDS[f.key][0], max: TIMING_BOUNDS[f.key][1], step: 1 }}
                  helperText={`${f.unit}, ${TIMING_BOUNDS[f.key][0]}-${TIMING_BOUNDS[f.key][1]}${t[f.key] !== DEFAULT_TIMING[f.key] ? ` (workflow: ${DEFAULT_TIMING[f.key]})` : ""}`}
                  sx={{ width: 170 }} />
              ))}
            </Box>
            <Box component="ul" sx={{ m: 0, pl: 2.25, display: "grid", gap: 0.25, listStyleType: "disc", "& > li": { display: "list-item" } }}>
              {g.steps.map((s) => <Typography key={s} component="li" sx={{ fontSize: "0.74rem", color: MUTED }}>{stepWords(s, t)}</Typography>)}
            </Box>
          </Box>
        ))}
      </Box>
      {d.admin && (
        <Box sx={{ mt: 1.5, display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
          <Button size="small" variant="contained" disableElevation disabled={!changed || busy} onClick={() => void save({ timing: t })}>Save the times</Button>
          {changed && <Button size="small" variant="text" disabled={busy} onClick={() => setT(d.settings.timing)}>Undo</Button>}
          {!isDefault && <Button size="small" variant="outlined" disabled={busy} onClick={() => { if (window.confirm("Back to the workflows' own times?")) { setT({ ...DEFAULT_TIMING }); void save({ timing: "default" }); } }}>Back to the workflows&apos; times</Button>}
          <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>The subjects keep the workflows&apos; words (&quot;48 hours&quot;, &quot;more than one week&quot;) whatever the waits.</Typography>
        </Box>
      )}
      {msg && <Typography sx={{ mt: 1, fontSize: "0.82rem", color: msg.ok ? GREEN : RED }}>{msg.text}</Typography>}
    </GlassCard>
  );
}

// ---------------- who gets the requests ----------------
function PeoplePicker({ label, ids, choices, names, single, onSave, disabled, allowEmpty }: {
  label: string; ids: string[]; choices: { id: string; name: string }[]; names: Record<string, string>; single?: boolean;
  onSave: (ids: string[]) => void; disabled: boolean; allowEmpty?: boolean;
}) {
  const [add, setAdd] = useState("");
  return (
    <Box>
      <Typography sx={{ fontSize: "0.8rem", color: MUTED, mb: 0.5 }}>{label}</Typography>
      <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
        {!ids.length && allowEmpty && <Typography sx={{ fontSize: "0.8rem", color: RED }}>nobody - not sent</Typography>}
        {ids.map((id, i) => (
          <Box key={id} sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: 1, py: 0.25, borderRadius: "999px", border: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.8)", fontSize: "0.8rem" }}>
            {single ? "" : `${i + 1}. `}{names[id] ?? `Owner ${id}`}
            {!single && (ids.length > 1 || allowEmpty) && !disabled && (
              <Box component="button" type="button" aria-label={`Take ${names[id] ?? id} out`} onClick={() => onSave(ids.filter((x) => x !== id))} sx={{ all: "unset", cursor: "pointer", color: FAINT, px: 0.25, "&:hover": { color: RED } }}>×</Box>
            )}
          </Box>
        ))}
        {!disabled && (
          <Box component="select" value={add} aria-label={`${label}: add`} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { const v = e.target.value; setAdd(""); if (v) onSave(single ? [v] : [...ids.filter((x) => x !== v), v]); }}
            sx={{ fontSize: "0.8rem", px: 1, py: 0.4, borderRadius: "999px", border: `1px solid ${HAIRLINE}`, bgcolor: "#fff", color: MUTED, maxWidth: 220 }}>
            <option value="">{single ? "Change…" : "Add…"}</option>
            {choices.filter((c) => !ids.includes(c.id)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Box>
        )}
      </Box>
    </Box>
  );
}
function PeopleCard({ d, onChanged }: { d: Data; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const p = d.settings.people;
  const save = async (people: object) => { setBusy(true); setErr(null); const r = await put({ people }); if (!r.ok) setErr(r.error ?? "failed"); setBusy(false); onChanged(); };
  return (
    <GlassCard>
      <CardTitle icon={<GroupsOutlinedIcon />} tint="purple" title="Who gets the requests" note="Each rotation hands the next request to the next person; people who left HubSpot are skipped" />
      <Box sx={{ display: "grid", gap: 1.75 }}>
        <PeoplePicker label="Back Office rotation - owner when a request starts or the article is received" ids={p.backOffice} choices={d.choices} names={d.names} disabled={!d.admin || busy} onSave={(ids) => void save({ backOffice: ids })} />
        <PeoplePicker label="Conformity experts - expert and owner on Assign to Conformity Expert" ids={p.experts} choices={d.choices} names={d.names} disabled={!d.admin || busy} onSave={(ids) => void save({ experts: ids })} />
        <PeoplePicker label={`Hand-over - owner after ${d.settings.timing.escalationDays} days without the certificate, with the note`} ids={[p.escalation]} single choices={d.choices} names={d.names} disabled={!d.admin || busy} onSave={(ids) => void save({ escalation: ids[0] })} />
      </Box>
      {err && <Typography sx={{ mt: 1, fontSize: "0.82rem", color: RED }}>{err}</Typography>}
    </GlassCard>
  );
}

// ---------------- on hold ----------------
function HeldCard({ d, onChanged }: { d: Data; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const held = Object.entries(d.settings.held).sort((a, b) => b[1].at.localeCompare(a[1].at));
  const release = async (id: string) => { setBusy(id); await put({ release: id }); setBusy(null); onChanged(); };
  return (
    <GlassCard>
      <CardTitle icon={<PauseCircleOutlineIcon />} tint="slate" title={`On hold${held.length ? `: ${full(held.length)}` : ""}`} note="The hub leaves these alone - no stage, subject, owner or mail - until released; what fell due meanwhile is taken then. Put a ticket on hold from the Tickets tab." />
      {!held.length && <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>No ticket on hold.</Typography>}
      <Box sx={{ display: "grid", gap: 0.5 }}>
        {held.map(([id, h]) => {
          const t = d.open.find((x) => x.id === id);
          return (
            <Box key={id} sx={{ display: "flex", gap: 1, alignItems: "center", minWidth: 0 }}>
              <Box sx={{ minWidth: 0, flex: 1 }}><TicketLink id={id} subject={t?.subject ?? null} max={560} /></Box>
              <Typography sx={{ fontSize: "0.74rem", color: FAINT, whiteSpace: "nowrap" }}>{h.by}, {when(h.at)}{t ? "" : " · no longer open"}</Typography>
              {d.admin && <Button size="small" variant="outlined" disabled={!!busy} onClick={() => void release(id)}>{busy === id ? <CircularProgress size={12} /> : "Release"}</Button>}
            </Box>
          );
        })}
      </Box>
    </GlassCard>
  );
}

// ---------------- the rules ----------------
const RULES: { lane: string; steps: StepName[]; then?: string }[] = [
  { lane: "New request", steps: ["start-avor", "start-bo"], then: "EC 1935/2004 → AVOR, else → Back Office" },
  { lane: "AVOR", steps: ["avor48", "avor96", "avorWeek", "avorRose"], then: "Article received → Back Office" },
  { lane: "Back Office", steps: ["bo-entry", "bo3days", "boToday", "bo48", "bo96", "boWeek", "boRose"], then: "Assign to Conformity Expert → the expert" },
  { lane: "Conformity expert", steps: ["expert-entry", "today", "late", "late96", "lateWeek", "lateRose"], then: "Sent out to customer and EDA → done" },
  { lane: "Done and merged", steps: ["close", "merge-clear"] },
];
const BETTER = [
  "The 96 h AVOR subject named the certificates twice.",
  "After the AVOR \"over a week\" wait the workflow sent the ticket to Rose even when the article had come - the hub moves it on to the Back Office.",
  "The expert's last wait waited for \"Article received\" in place of \"Sent out\".",
  "\"Sent out\" before the delivery date was missed and the ticket called late - the hub resolves it at once.",
  "A merged ticket lost every later \"Assign to Conformity Expert\".",
  "The company in the subject is the ticket's primary company - the workflow took the last-modified one, often A+P.",
  "The Back Office's reminders come on the delivery date and after - the workflow counted 72 h from the moment the ticket went to Remind.",
  "The expert no longer gets the Back Office's \"please create it\" mails, and the expert's subjects are no longer written over.",
  "The last reminder mails no longer say \"96 hours ago\" after a week.",
  "The way in always comes before the assignment - the old workflow fired up to 6 minutes late and put Backoffice Team back over people the hub had assigned.",
];
function RulesCard({ d }: { d: Data }) {
  const t = d.settings.timing;
  return (
    <GlassCard>
      <CardTitle icon={<MenuBookOutlinedIcon />} tint="blue" title="The rules, as they run now" note="Step for step, with the times above - every subject, stage, owner and rotation as the HubSpot workflows had them" />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 1.25 }}>
        {RULES.map((r) => (
          <Box key={r.lane} sx={{ p: 1.25, borderRadius: "12px", border: `1px solid ${HAIRLINE}` }}>
            <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK, mb: 0.5 }}>{r.lane}</Typography>
            <Box component="ol" sx={{ m: 0, pl: 2.25, display: "grid", gap: 0.25, listStyleType: "decimal", "& > li": { display: "list-item" } }}>
              {r.steps.map((s) => <Typography key={s} component="li" sx={{ fontSize: "0.76rem", color: INK }}>{stepWords(s, t)}{d.settings.mails.owner || !["bo3days", "boToday", "bo48", "bo96", "boWeek", "boRose"].includes(s) ? "" : " - mail off"}</Typography>)}
            </Box>
            {r.then && <Typography sx={{ mt: 0.5, fontSize: "0.74rem", fontWeight: 600, color: MUTED }}>→ {r.then}</Typography>}
          </Box>
        ))}
      </Box>
      <Box component="details" sx={{ mt: 1.5, "& summary": { cursor: "pointer", fontSize: "0.82rem", fontWeight: 600, color: INK } }}>
        <summary>What the hub does better than the workflows ({BETTER.length})</summary>
        <Box component="ul" sx={{ m: 0, mt: 0.75, pl: 2.5, display: "grid", gap: 0.4, listStyleType: "disc", "& > li": { display: "list-item" } }}>
          {BETTER.map((b) => <Typography key={b} component="li" sx={{ fontSize: "0.78rem", color: INK }}>{b}</Typography>)}
        </Box>
      </Box>
      <Typography sx={{ mt: 1, fontSize: "0.74rem", color: FAINT }}>
        Steps that fell due before the hub took a workflow over were that workflow&apos;s; the hub takes every step after, once ({hh(t.boHour)} / {hh(t.expertHour)}, reminders every {span(t.boEveryH)}).
      </Typography>
    </GlassCard>
  );
}

export function Console({ d, onChanged }: { d: Data; onChanged: () => void }) {
  return (
    <>
      <Board rows={d.board} />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, gap: 2.5, alignItems: "start" }}>
        <RunCard d={d} onChanged={onChanged} />
        <MailsCard d={d} onChanged={onChanged} />
      </Box>
      <TimingCard key={d.settings.at ?? "t"} d={d} onChanged={onChanged} />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, gap: 2.5, alignItems: "start" }}>
        <PeopleCard d={d} onChanged={onChanged} />
        <HeldCard d={d} onChanged={onChanged} />
      </Box>
      <RulesCard d={d} />
    </>
  );
}
