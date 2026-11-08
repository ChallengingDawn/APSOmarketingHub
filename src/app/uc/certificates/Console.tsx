"use client";

// CERTIFICATES - the Console and the Settings tabs (SARCLA 05.11.2026: "improve a lot the hub's tabs and steering
// console"; 07.11.2026: "split the console in 2 tabs, there is too much in only one tab"; "I want to do it only via the
// hub"). Console = what the hub runs and did today, Off / Preview / Live, who has what, the tickets on hold. Settings =
// which mails go out and to whom, the ERP's dates, the tickets from the shop, the step switches, the times and waits,
// who gets the requests, the rules as they run.

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
import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, MUTED, RED, TINT, hsTicket } from "@/app/uc/report/ui";
import { Chip, Choice, when } from "@/app/connectors/parts";
import { full } from "@/app/charts/format";
import type { BoardRow, Mails, Mode, RunInfo } from "@/lib/certificates/engine";
import type { DateMode } from "@/lib/certificates/erpData";
import type { ShopMode } from "@/lib/certificates/shopIntake";
import EventRepeatOutlinedIcon from "@mui/icons-material/EventRepeatOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import Grid from "@mui/material/Grid";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import ToggleOnOutlinedIcon from "@mui/icons-material/ToggleOnOutlined";
import { KpiTile } from "@/app/uc/report/ui";
import { isLate } from "./shared";
import type { StepGroup } from "@/lib/certificates/rules";
import { DEFAULT_TIMING, TIMING_BOUNDS, stepWords, type StepName, type Timing } from "@/lib/certificates/rules";
import { TicketLink, put, type Data } from "./shared";
import { PeoplePicker } from "@/app/uc/PeoplePicker";

const GREEN = "#1b7a55";

// ---------------- the figures (SARCLA 06.11.2026: "develop more the console KPI and steering") ----------------
const isToday = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Europe/Zurich" }) === new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Zurich" });
function KpiBand({ d }: { d: Data }) {
  const late = d.open.filter(isLate).length;
  const week = d.open.filter((t) => t.due && Date.parse(`${t.due}T23:59:59`) >= Date.now() && Date.parse(`${t.due}T00:00:00`) <= Date.now() + 7 * 86400_000).length;
  const on = d.stats?.onTime90;
  const today = d.rows.filter((r) => isToday(r.at));
  const written = today.filter((r) => r.what === "done").length;
  const mails = today.filter((r) => r.what === "done" && r.mail && !r.mailFailed).length;
  const failed = today.filter((r) => r.what === "failed" || r.mailFailed).length + d.board.reduce((a, w) => a + w.today.failed, 0);
  const left = d.open.filter((t) => t.erp?.shipped).length;
  const hand = d.shop.filter((r) => r.state === "by-hand").length;
  const hub = d.shop.filter((r) => r.state === "created").length;
  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 6, md: 4, lg: 2 }}><KpiTile icon={<ConfirmationNumberOutlinedIcon />} tint="blue" label="Open requests" value={full(d.open.length)} note={`${full(late)} late · ${full(week)} due in 7 days`} /></Grid>
      <Grid size={{ xs: 6, md: 4, lg: 2 }}><KpiTile icon={<TaskAltOutlinedIcon />} tint="green" label="Sent on time" value={on?.n ? `${Math.round((on.onTime / on.n) * 100)}%` : "—"} note={on?.n ? `${full(on.onTime)} of ${full(on.n)} resolved by the delivery date, 90 days${on.medianAfter != null ? ` · median ${on.medianAfter > 0 ? `${on.medianAfter} days after it` : "on time"}` : ""}` : "read every 30 min"} /></Grid>
      <Grid size={{ xs: 6, md: 4, lg: 2 }}><KpiTile icon={<TimerOutlinedIcon />} tint="slate" label="Days to send" value={d.stats?.medianDays != null ? String(d.stats.medianDays) : "—"} note="median, request to Resolved" /></Grid>
      <Grid size={{ xs: 6, md: 4, lg: 2 }}><KpiTile icon={<BoltOutlinedIcon />} tint="purple" label="The hub today" value={full(written)} note={`steps written · ${full(mails)} mails${failed ? ` · ${full(failed)} failed` : ""}`} /></Grid>
      <Grid size={{ xs: 6, md: 4, lg: 2 }}><KpiTile icon={<LocalShippingOutlinedIcon />} tint="pink" label="Goods already left" value={full(left)} note="open requests whose ERP delivery has gone" /></Grid>
      <Grid size={{ xs: 6, md: 4, lg: 2 }}><KpiTile icon={<StorefrontOutlinedIcon />} tint="amber" label="From the shop" value={full(d.shop.length)} note={`30 days · ${full(hand)} by hand · ${full(hub)} by the hub`} /></Grid>
    </Grid>
  );
}

// ---------------- who has what ----------------
function LoadCard({ d }: { d: Data }) {
  const by = new Map<string, { n: number; late: number; bo: number; expert: number; avor: number }>();
  for (const t of d.open) {
    const k = t.owner ?? "-";
    const x = by.get(k) ?? { n: 0, late: 0, bo: 0, expert: 0, avor: 0 };
    x.n++; if (isLate(t)) x.late++;
    if (t.phase === "expert") x.expert++; else if (t.phase === "avor") x.avor++; else x.bo++;
    by.set(k, x);
  }
  const rows = [...by.entries()].sort((a, b) => b[1].n - a[1].n);
  const max = Math.max(1, ...rows.map(([, x]) => x.n));
  const p = d.settings.people;
  return (
    <GlassCard>
      <CardTitle icon={<PersonOutlineIcon />} tint="purple" title="Who has what" note="Open requests per owner - Back Office, conformity expert, AVOR - and how many are late" />
      <Box sx={{ display: "grid", gap: 0.75 }}>
        {!rows.length && <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>No open request.</Typography>}
        {rows.map(([id, x]) => (
          <Box key={id} sx={{ display: "grid", gridTemplateColumns: "minmax(110px, 170px) minmax(0, 1fr) auto", gap: 1, alignItems: "center" }}>
            <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{id === "-" ? "nobody" : d.names[id] ?? `Owner ${id}`}</Typography>
            <Box sx={{ display: "flex", height: 12, borderRadius: "6px", overflow: "hidden", bgcolor: "rgba(31,45,78,.06)" }}>
              {(["bo", "expert", "avor"] as const).map((k) => x[k] ? <Box key={k} title={`${k === "bo" ? "Back Office" : k === "expert" ? "Conformity expert" : "AVOR"}: ${x[k]}`} sx={{ width: `${(x[k] / max) * 100}%`, bgcolor: k === "bo" ? TINT.blue.fg : k === "expert" ? TINT.purple.fg : TINT.amber.fg }} /> : null)}
            </Box>
            <Typography sx={{ fontSize: "0.78rem", color: x.late ? RED : MUTED, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{full(x.n)}{x.late ? ` · ${full(x.late)} late` : ""}</Typography>
          </Box>
        ))}
      </Box>
      <Box sx={{ mt: 1, display: "flex", gap: 1.5, flexWrap: "wrap" }}>
        {[["Back Office", TINT.blue.fg], ["Conformity expert", TINT.purple.fg], ["AVOR", TINT.amber.fg]].map(([l, c]) => (
          <Box key={l} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}><Box sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: c }} /><Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{l}</Typography></Box>
        ))}
      </Box>
      <Typography sx={{ mt: 0.75, fontSize: "0.74rem", color: FAINT }}>
        The rotations, in order: {[p.backOffice, p.experts].map((list, i) => `${i ? "experts" : "Back Office"} - ${list.map((id) => d.names[id] ?? id).join(" → ")}`).join(" · ")}
      </Typography>
    </GlassCard>
  );
}

// ---------------- the steps, switched ----------------
const GROUPS_ON: { key: StepGroup; label: string; text: string; steps: StepName[] }[] = [
  { key: "bo", label: "Back Office reminders", text: "3 days before delivery, due today, 48 h, 96 h, more than a week - subject, stage and the owner's mail", steps: ["bo3days", "boToday", "bo48", "bo96", "boWeek"] },
  { key: "expert", label: "Conformity expert's steps", text: "Delivery date is today, late, 96 h, over a week", steps: ["today", "late", "late96", "lateWeek"] },
  { key: "avor", label: "Reminders to AVOR", text: "48 h, 96 h and over a week without the new EC 1935/2004 article", steps: ["avor48", "avor96", "avorWeek"] },
  { key: "handover", label: "The hand-over", text: "After the last reminder and the days set below: owner = the hand-over person, with the note", steps: ["avorRose", "boRose", "lateRose"] },
];
function StepsCard({ d, onChanged }: { d: Data; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const flip = async (k: StepGroup, on: boolean) => {
    const g = GROUPS_ON.find((x) => x.key === k)!;
    if (!on && !window.confirm(`Switch off: ${g.label}?\n\nWhat falls due while it is off is skipped - it is not caught up when you switch it on again.`)) return;
    setBusy(k); setErr(null); const r = await put({ steps: { [k]: on } }); if (!r.ok) setErr(r.error ?? "failed"); setBusy(null); onChanged();
  };
  const next7 = (steps: StepName[]) => d.open.filter((t) => !t.held).reduce((a, t) => a + (t.upcoming ?? []).filter((u) => steps.includes(u.name)).length, 0);
  const skippedToday = d.rows.filter((r) => r.what === "skipped" && isToday(r.at)).length;
  return (
    <GlassCard>
      <CardTitle icon={<ToggleOnOutlinedIcon />} tint="green" title="The steps, switched" note="Each group of timed steps on or off - the starts, the entries, Sent out and the merges always run" />
      <Box sx={{ display: "grid", gap: 0.75 }}>
        {GROUPS_ON.map((g) => {
          const on = d.settings.steps[g.key];
          return (
            <Box key={g.key} sx={{ display: "flex", gap: 1.25, alignItems: "center", p: 1, borderRadius: "10px", border: `1px solid ${HAIRLINE}`, bgcolor: on ? "transparent" : "rgba(120,130,150,.06)" }}>
              <Switch size="small" checked={on} disabled={!d.admin || !!busy} onChange={(e) => void flip(g.key, e.target.checked)} inputProps={{ "aria-label": g.label }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK }}>{g.label} {busy === g.key && <CircularProgress size={12} />}</Typography>
                <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{g.text}</Typography>
              </Box>
              <Box sx={{ ml: "auto", textAlign: "right" }}>
                <Chip tint={on ? "green" : "slate"}>{on ? "on" : "off - skipped"}</Chip>
                <Typography sx={{ fontSize: "0.7rem", color: FAINT, mt: 0.25, whiteSpace: "nowrap" }}>{full(next7(g.steps))} in the next 7 days</Typography>
              </Box>
            </Box>
          );
        })}
      </Box>
      {skippedToday > 0 && <Typography sx={{ mt: 1, fontSize: "0.76rem", color: MUTED }}>{full(skippedToday)} skipped today - on the Activity tab.</Typography>}
      {err && <Typography sx={{ mt: 1, fontSize: "0.82rem", color: RED }}>{err}</Typography>}
    </GlassCard>
  );
}

// ---------------- what the hub runs ----------------
function Board({ rows }: { rows: BoardRow[] }) {
  return (
    <GlassCard>
      <CardTitle icon={<HubOutlinedIcon />} tint="green" title="What the hub runs" note="Each part of the process: does the hub write it, and today's figures" />
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
                <Chip tint={hub ? "green" : w.by === "off" ? "pink" : "amber"}>{hub ? "Live - the hub writes it" : w.by === "preview" ? "Preview - lists only" : "Off - nobody runs it"}</Chip>
              </Box>
              <Typography sx={{ fontSize: "0.78rem", color: INK }}>
                Today: {full(w.today.written)} written · {full(w.today.mailed)} mails{w.today.failed ? <span style={{ color: RED }}> · {full(w.today.failed)} failed</span> : null}
                {w.last && <span style={{ display: "block", color: FAINT, fontSize: "0.72rem" }}>last look {when(w.last)}</span>}
                {w.error && <span style={{ display: "block", color: RED, fontSize: "0.72rem" }}>{w.error}</span>}
              </Typography>
              <Button size="small" variant="text" href={w.where.startsWith("#") ? `/uc/certificates${w.where}` : w.where}>Open</Button>
            </Box>
          );
        })}
      </Box>
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
        <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>
          {d.settings.mode === "off" ? "Off - the hub does not look." : d.settings.mode === "preview" ? "Preview - the hub works out each request's steps and lists them; it writes nothing." : "Live - the hub takes each step when it falls due."}
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
  { key: "team", label: "Reminder on every other ticket in Remind", text: "Every other Back Office ticket that goes to stage Remind Back Office: \"⚠️REMINDER: Back Office Ticket\" to its owner, straight to the person." },
];
/** Queue users: their address is a HubSpot inbox - never a recipient (05.11.2026: 120 tickets in 44 minutes) */
const INBOX_OWNERS = ["76164822", "1202569408"];
function MailsCard({ d, onChanged }: { d: Data; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sample, setSample] = useState<{ ok: boolean; text: string } | null>(null);
  const sendSample = async () => {
    setBusy("sample"); setSample(null);
    try {
      const r = await fetch("/api/uc/certificates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sample" }) });
      const j = (await r.json()) as { ok: boolean; data?: { text: string }; error?: string };
      setSample(j.ok ? { ok: true, text: `Sent: ${j.data?.text ?? ""}` } : { ok: false, text: j.error ?? `HTTP ${r.status}` });
    } catch (e) { setSample({ ok: false, text: String((e as Error).message) }); } finally { setBusy(null); }
  };
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
        <PeoplePicker label={"The reminder also goes to - one mail to the owner and them"}
          ids={d.settings.teamTo} allowEmpty emptyText="nobody else - the owner only" choices={d.choices.filter((c) => !INBOX_OWNERS.includes(c.id))} names={d.names} disabled={!d.admin || !!busy} onSave={(ids) => void saveTo(ids)} />
        <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>
          The ticket&apos;s owner always gets it, at their own address. A ticket whose owner is not a person (the Backoffice Team, a queue): the people picked here, else the Back Office rotation{d.settings.people.backOffice.length ? ` (${d.settings.people.backOffice.map((id) => d.names[id] ?? id).join(", ")})` : ""}. Never the Backoffice Team or TSA Team themselves: their address is a HubSpot inbox, and a mail there comes back as a new ticket.
        </Typography>
      </Box>
      <Typography sx={{ mt: 1, fontSize: "0.76rem", color: MUTED }}>
        &quot;❗Back Office Ticket Created&quot; belongs to the way in: switched, and its people picked, on <Box component="a" href="/uc/bo-distribution#way-in" sx={{ color: INK, fontWeight: 700 }}>Back Office distribution &gt; Way in</Box>.
      </Typography>
      {d.admin && (
        <Box sx={{ mt: 1, display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
          <Button size="small" variant="outlined" disabled={!!busy || !d.mailReady} onClick={() => void sendSample()}>{busy === "sample" ? <CircularProgress size={12} /> : "Send me a sample"}</Button>
          <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>the owner&apos;s &quot;due today&quot; mail for an open request, to your own address</Typography>
        </Box>
      )}
      {sample && <Typography sx={{ mt: 0.75, fontSize: "0.8rem", color: sample.ok ? GREEN : RED }}>{sample.text}</Typography>}
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
      <CardTitle icon={<ScheduleOutlinedIcon />} tint="amber" title="The times and waits" note={isDefault ? "The default times - Swiss time" : "Changed from the default times - Swiss time"} />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 1.5 }}>
        {GROUPS.map((g) => (
          <Box key={g.title} sx={{ p: 1.25, borderRadius: "12px", border: `1px solid ${HAIRLINE}`, display: "grid", gap: 1 }}>
            <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK }}>{g.title}</Typography>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              {g.fields.map((f) => (
                <TextField key={f.key} size="small" type="number" label={f.label} value={t[f.key]} disabled={!d.admin || busy}
                  onChange={(e) => setT((x) => ({ ...x, [f.key]: Number(e.target.value) }))}
                  inputProps={{ min: TIMING_BOUNDS[f.key][0], max: TIMING_BOUNDS[f.key][1], step: 1 }}
                  helperText={`${f.unit}, ${TIMING_BOUNDS[f.key][0]}-${TIMING_BOUNDS[f.key][1]}${t[f.key] !== DEFAULT_TIMING[f.key] ? ` (default: ${DEFAULT_TIMING[f.key]})` : ""}`}
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
          {!isDefault && <Button size="small" variant="outlined" disabled={busy} onClick={() => { if (window.confirm("Back to the default times?")) { setT({ ...DEFAULT_TIMING }); void save({ timing: "default" }); } }}>Back to the defaults</Button>}
          <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>The subjects keep their words (&quot;48 hours&quot;, &quot;more than one week&quot;) whatever the waits.</Typography>
        </Box>
      )}
      {msg && <Typography sx={{ mt: 1, fontSize: "0.82rem", color: msg.ok ? GREEN : RED }}>{msg.text}</Typography>}
    </GlassCard>
  );
}

// ---------------- who gets the requests ----------------
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

// ---------------- the ERP's delivery dates ----------------
function DatesCard({ d, onChanged }: { d: Data; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async (m: DateMode) => {
    if (m === "write" && !window.confirm("Write the ERP's delivery dates on the tickets?\n\nEach open request whose date differs from its ERP delivery gets the ERP's date, the date in the subject and a note - and its reminders go by the new date (a date already past brings the reminder due now, with its mail).")) return;
    setBusy(true); setErr(null); const r = await put({ erpDates: m }); if (!r.ok) setErr(r.error ?? "failed"); setBusy(false); onChanged();
  };
  const withErp = d.open.filter((t) => t.erp);
  const differ = withErp.filter((t) => t.erp!.state === "would").length;
  const left = d.open.filter((t) => t.erp?.shipped && t.phase !== "sent").length;
  const moved = d.dates.filter((r) => r.what === "done").length;
  return (
    <GlassCard>
      <CardTitle icon={<EventRepeatOutlinedIcon />} tint="amber" title="Delivery dates from the ERP" note="The ticket's date is typed once, from the ERP's first planned date; the ERP's moves - the hub follows it" />
      <Box sx={{ display: "grid", gap: 1 }}>
        {d.admin ? <Choice<DateMode> value={d.settings.erpDates} onChange={(m) => void save(m)} options={[{ key: "off", label: "Off" }, { key: "show", label: "Show only" }, { key: "write", label: "Write on the ticket" }]} />
          : <Chip tint={d.settings.erpDates === "write" ? "green" : "slate"}>{d.settings.erpDates}</Chip>}
        <Typography sx={{ fontSize: "0.8rem", color: INK }}>
          {full(withErp.length)} of {full(d.open.length)} open requests have an ERP delivery date: {full(differ)} differ from the ticket{left ? `, ${full(left)} with the goods already gone` : ""}{moved ? ` · ${full(moved)} dates written` : ""}. The Tickets tab shows both.
        </Typography>
        <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>
          Which delivery: the one carrying the ticket&apos;s article, else the only one, else the one whose date the ticket was given, else the first that has not left. A date changed by hand after the hub wrote it stands until the ERP&apos;s moves again. The ERP&apos;s dates come with each ERP file (about every two days); before a delivery exists the ERP has none and the ticket&apos;s date stays.
        </Typography>
      </Box>
      {err && <Typography sx={{ mt: 1, fontSize: "0.82rem", color: RED }}>{err}</Typography>}
    </GlassCard>
  );
}

// ---------------- tickets from the shop ----------------
function ShopCard({ d, onChanged }: { d: Data; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async (m: ShopMode) => {
    if (m === "live" && !window.confirm("Create the certificate tickets from the shop's orders?\n\nFrom now on, each new shop order with the plastics declaration gets its ticket from the hub once the ERP's number and the certificate are known - already started (AVOR or the Back Office rotation). The Back Office no longer needs to make those by hand; one made by hand first is kept and the hub makes none.")) return;
    setBusy(true); setErr(null); const r = await put({ shop: m }); if (!r.ok) setErr(r.error ?? "failed"); setBusy(false); onChanged();
  };
  const hand = d.shop.filter((r) => r.state === "by-hand").length;
  return (
    <GlassCard>
      <CardTitle icon={<StorefrontOutlinedIcon />} tint="blue" title="Tickets from the shop" note="A shop order with the plastics declaration (8001133004) gets its certificate ticket" />
      <Box sx={{ display: "grid", gap: 1 }}>
        {d.admin ? <Choice<ShopMode> value={d.settings.shop} onChange={(m) => void save(m)} options={[{ key: "off", label: "Off" }, { key: "preview", label: "Preview - lists only" }, { key: "live", label: "Live - creates the tickets" }]} />
          : <Chip tint={d.settings.shop === "live" ? "green" : "slate"}>{d.settings.shop}</Chip>}
        <Typography sx={{ fontSize: "0.8rem", color: INK }}>
          {d.settings.shop === "live" ? `Live since ${when(d.settings.shopFrom)} - orders the shop sync saw before stay the Back Office's.` : d.settings.shop === "preview" ? "Preview: the hub lists the ticket it would create, next to the one the Back Office makes - the From the shop tab compares them." : "Off."}
          {` Last 30 days: ${full(d.shop.length)} orders, ${full(hand)} tickets by the Back Office.`}
        </Typography>
        <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>
          The ERP&apos;s number: from the web order, else asked of the shop. Which certificate: the shop&apos;s order if its options name it, else the ERP&apos;s comment (&quot;Bitte Konformitätserklärung erstellen: FDA.&quot;), which comes with the ERP&apos;s order file{d.erpRead ? ` - last read ${when(d.erpRead.at)}, ${full(d.erpRead.found)} orders asking for one` : " - not read since this was switched on"}. No certificate named after 6 days = left to the Back Office. Seals (DT) are the DoC app&apos;s, which mails the declaration itself - no ticket.
        </Typography>
      </Box>
      {err && <Typography sx={{ mt: 1, fontSize: "0.82rem", color: RED }}>{err}</Typography>}
    </GlassCard>
  );
}

// ---------------- the declarations made on the ticket ----------------
// The certificate maker on the ticket card "Certificate request" (SARCLA 07.11.2026): the issuer signs, the conformity
// expert signs - then the hub mails the declaration to the customer and, separately, to EDA. Off until switched on here.
function MakerCard({ d, onChanged }: { d: Data; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async (m: "off" | "live") => {
    if (m === "live" && !window.confirm("Send the declarations signed on the ticket card?\n\nFrom now on, once the conformity expert has signed a declaration on a ticket, the hub mails it to the customer the expert named (in his language, the PDF attached) and, on a separate mail, to EDA (eda.apch@angst-pfister.com) - then sets \"Sent out to customer and EDA\". Never a test (a ticket on hold).")) return;
    setBusy(true); setErr(null); const r = await put({ makerSend: m }); if (!r.ok) setErr(r.error ?? "failed"); setBusy(false); onChanged();
  };
  const rows = d.makerRows ?? [];
  return (
    <GlassCard>
      <CardTitle icon={<TaskAltOutlinedIcon />} tint="green" title="Declarations made on the ticket" note="Signed by the issuer and the conformity expert on the card - then to the customer and EDA" />
      <Box sx={{ display: "grid", gap: 1 }}>
        {d.admin ? <Choice<"off" | "live"> value={d.settings.makerSend ?? "off"} onChange={(m) => void save(m)} options={[{ key: "off", label: "Off - the Back Office sends it" }, { key: "live", label: "Live - the hub sends it" }]} />
          : <Chip tint={d.settings.makerSend === "live" ? "green" : "slate"}>{d.settings.makerSend ?? "off"}</Chip>}
        <Typography sx={{ fontSize: "0.8rem", color: INK }}>
          {d.settings.makerSend === "live" ? "Live: within 3 minutes of the expert's signature, the customer gets the declaration (the DoC mail, in his language) and EDA its own mail; the ticket is set to \"Sent out to customer and EDA\" and closes." : "Off: the declaration signed on the card stays on the ticket - the Back Office sends it and sets \"Sent out to customer and EDA\"."}
          {busy ? " Saving…" : ""}
        </Typography>
        {rows.length > 0 && (
          <Box sx={{ display: "grid", gap: 0.25 }}>
            {rows.slice(0, 8).map((r) => (
              <Typography key={`${r.ticketId}-${r.at}-${r.what}`} sx={{ fontSize: "0.76rem", color: r.what === "failed" || r.what === "avorFailed" ? RED : INK }}>
                {when(r.at)} · <a href={hsTicket(r.ticketId)} target="_blank" rel="noopener" style={{ color: INK, fontWeight: 600 }}>{r.ticketId}</a> · {r.what === "sent" ? `sent to ${r.to}${r.eda ? " and EDA" : ""}`
                  : r.what === "avor" ? `mail to AVOR sent (${r.to})` : r.what === "avorFailed" ? "mail to AVOR not sent"
                  : r.what === "avorAnswer" ? `AVOR answered${r.from ? ` (${r.from})` : ""} - merged into the request` : "not sent"}{r.error ? ` - ${r.error}` : ""}
              </Typography>
            ))}
          </Box>
        )}
        <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>
          Made from the newest declaration we sent for the A+P material code (or that FDA text), with the customer, dates, signatures and positions taken out. Only from 3 days before the delivery. Each signer picks his own signature and accepts signing; the expert is never the issuer. An article Products &amp; Pricing marks as not certified stops it. A ticket on hold makes a TEST that never goes out. EC 1935/2004: &quot;Send to AVOR&quot; on the card sends AVOR&apos;s mail within 3 minutes, in the sender&apos;s name (answers to support@) - this switch is for the declarations only; AVOR&apos;s answer comes in as a new support@ ticket and the way in merges it into the request before the rotation sees it.
        </Typography>
      </Box>
      {err && <Typography sx={{ mt: 1, fontSize: "0.82rem", color: RED }}>{err}</Typography>}
    </GlassCard>
  );
}

// ---------------- the rules ----------------
const RULES: { lane: string; steps: StepName[]; then?: string }[] = [
  { lane: "New request", steps: ["wayin", "start-avor", "start-bo"], then: "EC 1935/2004 → AVOR, else → Back Office" },
  { lane: "AVOR", steps: ["avor48", "avor96", "avorWeek", "avorRose"], then: "Article received → Back Office" },
  { lane: "Back Office", steps: ["bo-entry", "bo3days", "boToday", "bo48", "bo96", "boWeek", "boRose"], then: "Assign to Conformity Expert → the expert" },
  { lane: "Conformity expert", steps: ["expert-entry", "today", "late", "late96", "lateWeek", "lateRose"], then: "Sent out to customer and EDA → done" },
  { lane: "Done and merged", steps: ["close", "merge-clear"] },
];
function RulesCard({ d }: { d: Data }) {
  const t = d.settings.timing;
  return (
    <GlassCard>
      <CardTitle icon={<MenuBookOutlinedIcon />} tint="blue" title="The rules, as they run now" note="Step for step, with the times above - every subject, stage, owner and rotation" />
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
    </GlassCard>
  );
}

/** Console: what the hub runs and did, the run itself, who has what, the tickets on hold. */
export function Console({ d, onChanged }: { d: Data; onChanged: () => void }) {
  return (
    <>
      <KpiBand d={d} />
      <Board rows={d.board} />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, gap: 2.5, alignItems: "start" }}>
        <RunCard d={d} onChanged={onChanged} />
        <LoadCard d={d} />
      </Box>
      <HeldCard d={d} onChanged={onChanged} />
    </>
  );
}

/** Settings: the mails and who gets them, the ERP's dates, the shop's tickets, the steps, the times, the people, the rules. */
export function SettingsTab({ d, onChanged }: { d: Data; onChanged: () => void }) {
  return (
    <>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, gap: 2.5, alignItems: "start" }}>
        <MailsCard d={d} onChanged={onChanged} />
        <PeopleCard d={d} onChanged={onChanged} />
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, gap: 2.5, alignItems: "start" }}>
        <ShopCard d={d} onChanged={onChanged} />
        <DatesCard d={d} onChanged={onChanged} />
      </Box>
      <MakerCard d={d} onChanged={onChanged} />
      <StepsCard d={d} onChanged={onChanged} />
      <TimingCard key={d.settings.at ?? "t"} d={d} onChanged={onChanged} />
      <RulesCard d={d} />
    </>
  );
}
