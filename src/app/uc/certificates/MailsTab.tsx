"use client";

// CERTIFICATES > Mails (SARCLA 07.11.2026: "put another tab mails so we can see each mail and preview the design").
// Every mail the hub sends for the Back Office, one tile each - when it goes, to whom, on or off, how many went out -
// and the one picked shown as it goes out today, on a real ticket (GET ?preview=, nothing sent), with "send it to me".
// Under it: every mail sent, newest first.

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import CircularProgress from "@mui/material/CircularProgress";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, MUTED, RED, TINT, bodyCell, headCell } from "@/app/uc/report/ui";
import { Chip, usePaged, when } from "@/app/connectors/parts";
import { full } from "@/app/charts/format";
import type { MailKey, MailPreview } from "@/lib/certificates/engine";
import { stepWords, type MailName } from "@/lib/certificates/rules";
import { TicketLink, type Data } from "./shared";

const GREEN = "#1b7a55";
type Def = { key: MailKey; title: string; to: string; when: (d: Data) => string; on: (d: Data) => boolean; switchOn: string };
const OWNER_STEP = (k: MailName) => (d: Data) => stepWords(k, d.settings.timing).split(" (")[0];
const DEFS: Def[] = [
  { key: "bo3days", title: "3 days before delivery", to: "the ticket's owner", when: OWNER_STEP("bo3days"), on: (d) => d.settings.mails.owner && d.settings.steps.bo, switchOn: "Settings: Reminders to the ticket's owner, Back Office reminders" },
  { key: "boToday", title: "Due today", to: "the ticket's owner", when: OWNER_STEP("boToday"), on: (d) => d.settings.mails.owner && d.settings.steps.bo, switchOn: "Settings: Reminders to the ticket's owner, Back Office reminders" },
  { key: "bo48", title: "Late - first reminder", to: "the ticket's owner", when: OWNER_STEP("bo48"), on: (d) => d.settings.mails.owner && d.settings.steps.bo, switchOn: "Settings: Reminders to the ticket's owner, Back Office reminders" },
  { key: "bo96", title: "Late - second reminder", to: "the ticket's owner", when: OWNER_STEP("bo96"), on: (d) => d.settings.mails.owner && d.settings.steps.bo, switchOn: "Settings: Reminders to the ticket's owner, Back Office reminders" },
  { key: "boWeek", title: "More than a week late", to: "the ticket's owner", when: OWNER_STEP("boWeek"), on: (d) => d.settings.mails.owner && d.settings.steps.bo, switchOn: "Settings: Reminders to the ticket's owner, Back Office reminders" },
  { key: "boRose", title: "The hand-over", to: "the hand-over person", when: OWNER_STEP("boRose"), on: (d) => d.settings.mails.owner && d.settings.steps.handover, switchOn: "Settings: Reminders to the ticket's owner, The hand-over" },
  { key: "team", title: "⚠️REMINDER: Back Office Ticket", to: "the ticket's owner (and the people picked)", when: () => "Every other Back Office ticket that goes to stage Remind Back Office", on: (d) => d.settings.mails.team, switchOn: "Settings: Reminder on every other ticket in Remind" },
  { key: "created", title: "❗Back Office Ticket Created", to: "the people picked on the Way in tab", when: () => "Every new Back Office ticket: e-mail, form, created by hand", on: () => true, switchOn: "Back Office distribution > Way in" },
];

/** One sent (or failed) mail, from the steps and the reminders. */
type Sent = { at: string; key: MailKey | null; ticketId: string; subject: string | null; text: string; ok: boolean };
const MAIL_OF_STEP: Record<string, MailName> = { bo3days: "bo3days", boToday: "boToday", bo48: "bo48", bo96: "bo96", boWeek: "boWeek", boRose: "boRose" };
function sentMails(d: Data): Sent[] {
  const out: Sent[] = [];
  for (const r of d.rows) {
    if (!r.mail || r.what !== "done") continue;
    const k = r.steps.map((s) => MAIL_OF_STEP[s]).find(Boolean) ?? null;
    out.push({ at: r.at, key: k, ticketId: r.ticketId, subject: r.props.subject ?? r.subject, text: r.mail, ok: !r.mailFailed });
  }
  for (const r of d.others.rows) if (r.what !== "would") out.push({ at: r.at, key: "team", ticketId: r.ticketId, subject: r.subject, text: r.mail, ok: r.what === "done" });
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

function Preview({ k, d }: { k: MailKey; d: Data }) {
  const [p, setP] = useState<MailPreview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sample, setSample] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    let live = true;
    setP(null); setErr(null); setSample(null);
    fetch(`/api/uc/certificates?preview=${k}`).then((r) => r.json()).then((j: { ok: boolean; data?: MailPreview; error?: string }) => {
      if (!live) return;
      if (j.ok && j.data) setP(j.data); else setErr(j.error ?? "could not be built");
    }).catch((e) => live && setErr(String((e as Error).message)));
    return () => { live = false; };
  }, [k]);
  const send = async () => {
    setBusy(true); setSample(null);
    try {
      const r = await fetch("/api/uc/certificates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sample", mail: k }) });
      const j = (await r.json()) as { ok: boolean; data?: { text: string }; error?: string };
      setSample(j.ok ? { ok: true, text: `Sent: ${j.data?.text ?? ""}` } : { ok: false, text: j.error ?? `HTTP ${r.status}` });
    } catch (e) { setSample({ ok: false, text: String((e as Error).message) }); } finally { setBusy(false); }
  };
  const def = DEFS.find((x) => x.key === k)!;
  return (
    <GlassCard>
      <CardTitle icon={<MailOutlineIcon />} tint="purple" title={def.title} note="As it goes out today, on a real ticket - nothing is sent from this view" />
      {err && <Typography sx={{ fontSize: "0.84rem", color: RED }}>{err}</Typography>}
      {!p && !err && <Box sx={{ display: "flex", gap: 1, alignItems: "center", py: 2 }}><CircularProgress size={14} /><Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Building the mail…</Typography></Box>}
      {p && (
        <>
          <Box sx={{ display: "grid", gridTemplateColumns: "84px minmax(0, 1fr)", rowGap: 0.5, columnGap: 1, mb: 1.25, fontSize: "0.82rem" }}>
            <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>Subject</Typography><Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK, overflowWrap: "anywhere" }}>{p.subject}</Typography>
            <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>To</Typography><Typography sx={{ fontSize: "0.82rem", color: INK, overflowWrap: "anywhere" }}>{p.to || def.to}</Typography>
            <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>Goes out</Typography><Typography sx={{ fontSize: "0.82rem", color: INK }}>{def.when(d)}</Typography>
            {p.ticket && <><Typography sx={{ fontSize: "0.78rem", color: MUTED }}>Shown on</Typography><Box sx={{ minWidth: 0 }}><TicketLink id={p.ticket.id} subject={p.ticket.subject} max={520} /></Box></>}
          </Box>
          {p.html ? (
            <Box sx={{ borderRadius: "12px", border: `1px solid ${HAIRLINE}`, overflow: "hidden", bgcolor: "#f4f6fa" }}>
              <Box component="iframe" title={`${def.title} - preview`} srcDoc={p.html} sandbox="" sx={{ display: "block", width: "100%", height: { xs: 560, md: 640 }, border: 0, bgcolor: "#fff" }} />
            </Box>
          ) : <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{p.note ?? "Nothing to show it on yet."}</Typography>}
          {d.admin && p.html && (
            <Box sx={{ mt: 1.25, display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
              <Button size="small" variant="outlined" disabled={busy || !d.mailReady} onClick={() => void send()}>{busy ? <CircularProgress size={12} /> : "Send it to me"}</Button>
              <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>this mail, &quot;[Sample]&quot; in front, to your own address only</Typography>
            </Box>
          )}
          {sample && <Typography sx={{ mt: 0.75, fontSize: "0.8rem", color: sample.ok ? GREEN : RED }}>{sample.text}</Typography>}
        </>
      )}
    </GlassCard>
  );
}

function SentTable({ rows }: { rows: Sent[] }) {
  const { slice, pager } = usePaged(rows, 20);
  return (
    <>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead><TableRow>{["When", "Mail", "Ticket", "To"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {!rows.length && <TableRow><TableCell colSpan={4} sx={{ ...bodyCell, color: MUTED, fontSize: "0.84rem" }}>No mail sent yet.</TableCell></TableRow>}
            {slice.map((r) => (
              <TableRow key={`${r.ticketId}-${r.at}-${r.key}`} hover>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED, whiteSpace: "nowrap" }}>{when(r.at)}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap" }}>{DEFS.find((x) => x.key === r.key)?.title ?? "Reminder"}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}><TicketLink id={r.ticketId} subject={r.subject} max={420} /></TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: r.ok ? INK : RED }}>{r.text}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      <Box sx={{ px: 2, py: 1 }}>{pager}</Box>
    </>
  );
}

export function MailsTab({ d }: { d: Data }) {
  const [k, setK] = useState<MailKey>("boToday");
  const sent = useMemo(() => sentMails(d), [d]);
  const week = Date.now() - 7 * 86400_000;
  const count = (key: MailKey) => sent.filter((r) => r.key === key && r.ok && Date.parse(r.at) >= week).length;
  return (
    <>
      {!d.mailReady && <Typography sx={{ fontSize: "0.84rem", color: RED }}>The hub cannot send mail here (no SMTP credentials) - nothing would go out.</Typography>}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(0, 360px) minmax(0, 1fr)" }, gap: 2.5, alignItems: "start" }}>
        <Box sx={{ display: "grid", gap: 1 }}>
          {DEFS.map((x) => {
            const sel = x.key === k;
            const on = x.on(d);
            return (
              <Box key={x.key} component="button" type="button" onClick={() => setK(x.key)} sx={{
                all: "unset", cursor: "pointer", display: "grid", gap: 0.4, p: 1.25, borderRadius: "12px", minWidth: 0,
                border: `1px solid ${sel ? TINT.purple.fg : HAIRLINE}`, bgcolor: sel ? TINT.purple.bg : "rgba(255,255,255,.75)",
                "&:hover": { borderColor: TINT.purple.fg }, "&:focus-visible": { outline: `2px solid ${INK}`, outlineOffset: 2 },
              }}>
                <Box sx={{ display: "flex", gap: 1, alignItems: "center", minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.title}</Typography>
                  <Chip tint={on ? "green" : "slate"}>{on ? "on" : "off"}</Chip>
                </Box>
                <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{x.when(d)}</Typography>
                <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>To {x.to}{x.key !== "created" ? ` · ${full(count(x.key))} sent in 7 days` : ""}</Typography>
                {!on && <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>Switched on at {x.switchOn}</Typography>}
              </Box>
            );
          })}
        </Box>
        <Preview k={k} d={d} />
      </Box>
      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 } }}>
          <CardTitle icon={<HistoryOutlinedIcon />} tint="blue" title={`Every mail sent: ${full(sent.length)}`} note={'Newest first - the owners\' reminders and "⚠️REMINDER: Back Office Ticket"; the way in\'s mails are on Back Office distribution > Way in'} />
        </Box>
        <SentTable rows={sent} />
      </GlassCard>
    </>
  );
}
