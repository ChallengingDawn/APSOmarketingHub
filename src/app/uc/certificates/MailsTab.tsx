"use client";

// CERTIFICATES > Mails (SARCLA 07.11.2026: "put another tab mails so we can see each mail and preview the design").
// Every mail the hub sends for the Back Office, one tile each - when it goes, to whom, on or off, how many went out -
// and the one picked shown as it goes out today, on a real ticket (GET ?preview=, nothing sent), with "send it to me".
// Under it: every mail sent, newest first. The mail to AVOR from the ticket card too, switched on its tile (SARCLA
// 08.11.2026: "on the e-mails sent on Certificates put also the one sent to AVOR, with a toggle").

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
import Switch from "@mui/material/Switch";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, MUTED, RED, TINT, bodyCell, headCell } from "@/app/uc/report/ui";
import { Chip, usePaged, when } from "@/app/connectors/parts";
import { full } from "@/app/charts/format";
import type { MailKey, MailPreview } from "@/lib/certificates/engine";
import { stepWords, type MailName } from "@/lib/certificates/rules";
import { TicketLink, put, type Data } from "./shared";

const GREEN = "#1b7a55";
/** toggle: the tile carries its own switch (the mail's own setting) */
type Def = { key: MailKey; title: string; to: string; when: (d: Data) => string; on: (d: Data) => boolean; switchOn: string; toggle?: "avor" };
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
  { key: "declCustomer", title: "Declaration to the customer", to: "the customer, in the issuer's name - the PDF attached", when: () => "Within 3 minutes of the conformity expert's signature on the card, in the language the expert picked", on: (d) => d.settings.makerSend === "live", switchOn: "Settings: Declarations made on the ticket" },
  { key: "declEda", title: "Declaration to EDA", to: "EDA (eda.apch@angst-pfister.com), in the issuer's name", when: () => "Right after the customer's mail - the same PDF", on: (d) => d.settings.makerSend === "live", switchOn: "Settings: Declarations made on the ticket" },
  { key: "avor", title: "Mail to AVOR", to: "AVOR (avor@angst-pfister.com), in the user's name", when: () => "EC 1935/2004: \"Send to AVOR\" on the ticket card - the new article number", on: (d) => d.settings.mails.avor !== false, switchOn: "this tile or Settings: The mails", toggle: "avor" },
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
  const subjectOf = new Map(d.open.map((t) => [t.id, t.subject]));
  // the declarations made on the card: the customer's mail and EDA's
  for (const r of d.makerRows ?? []) {
    if (r.what !== "sent" && r.what !== "failed") continue;
    const subject = subjectOf.get(r.ticketId) ?? null;
    out.push({ at: r.at, key: "declCustomer", ticketId: r.ticketId, subject, text: r.what === "sent" ? `mail to ${r.to}` : `not sent${r.error ? ` - ${r.error}` : ""}`, ok: r.what === "sent" });
    if (r.what === "sent") out.push({ at: r.at, key: "declEda", ticketId: r.ticketId, subject, text: r.eda ? `mail to ${r.eda}` : `not sent${r.error ? ` - ${r.error}` : ""}`, ok: !!r.eda });
  }
  // the mails to AVOR from the ticket card (the declarations' rows hold them too)
  for (const r of d.makerRows ?? []) {
    if (r.what !== "avor" && r.what !== "avorFailed") continue;
    out.push({ at: r.at, key: "avor", ticketId: r.ticketId, subject: subjectOf.get(r.ticketId) ?? r.subject ?? null, text: r.what === "avor" ? `mail to ${r.to}` : `not sent${r.error ? ` - ${r.error}` : ""}`, ok: r.what === "avor" });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

const LANGS: { key: string; label: string }[] = [{ key: "de", label: "Deutsch" }, { key: "fr", label: "Français" }, { key: "it", label: "Italiano" }, { key: "en", label: "English" }, { key: "nl", label: "Nederlands" }, { key: "pl", label: "Polski" }];
function Preview({ k, d }: { k: MailKey; d: Data }) {
  const [lang, setLang] = useState<string>("");
  const [p, setP] = useState<MailPreview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sample, setSample] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    let live = true;
    setP(null); setErr(null); setSample(null);
    fetch(`/api/uc/certificates?preview=${k}${k === "declCustomer" && lang ? `&lang=${lang}` : ""}`).then((r) => r.json()).then((j: { ok: boolean; data?: MailPreview; error?: string }) => {
      if (!live) return;
      if (j.ok && j.data) setP(j.data); else setErr(j.error ?? "could not be built");
    }).catch((e) => live && setErr(String((e as Error).message)));
    return () => { live = false; };
  }, [k, lang]);
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
      {k === "declCustomer" && (
        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mb: 1.25 }}>
          {LANGS.map((l) => (
            <Button key={l.key} size="small" variant={(lang || "de") === l.key ? "contained" : "outlined"} onClick={() => setLang(l.key)} sx={{ textTransform: "none", minWidth: 0, px: 1.25 }}>{l.label}</Button>
          ))}
        </Box>
      )}
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

/** The switch on a tile - the mail's own setting (Settings > The mails shows the same). */
function TileSwitch({ d, def, onChanged }: { d: Data; def: Def; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const on = def.on(d);
  const flip = async (next: boolean) => {
    if (!next && !window.confirm(`Switch off: ${def.title}?\n\nThe card no longer sends it: the Back Office writes to AVOR from the ticket, as before.`)) return;
    setBusy(true); setErr(null);
    const r = await put({ mails: { [def.toggle!]: next } });
    if (!r.ok) setErr(r.error ?? "failed");
    setBusy(false); onChanged();
  };
  return (
    <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
      {busy && <CircularProgress size={12} />}
      {err && <Typography sx={{ fontSize: "0.7rem", color: RED }}>{err}</Typography>}
      <Switch size="small" checked={on} disabled={!d.admin || busy} onChange={(e) => void flip(e.target.checked)} inputProps={{ "aria-label": `${def.title}: ${on ? "on" : "off"}` }} />
      <Chip tint={on ? "green" : "slate"}>{on ? "on" : "off"}</Chip>
    </Box>
  );
}

export function MailsTab({ d, onChanged }: { d: Data; onChanged: () => void }) {
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
              <Box key={x.key} role="button" tabIndex={0} aria-pressed={sel} onClick={() => setK(x.key)}
                onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setK(x.key); } }} sx={{
                cursor: "pointer", display: "grid", gap: 0.4, p: 1.25, borderRadius: "12px", minWidth: 0, textAlign: "left",
                border: `1px solid ${sel ? TINT.purple.fg : HAIRLINE}`, bgcolor: sel ? TINT.purple.bg : "rgba(255,255,255,.75)",
                "&:hover": { borderColor: TINT.purple.fg }, "&:focus-visible": { outline: `2px solid ${INK}`, outlineOffset: 2 },
              }}>
                <Box sx={{ display: "flex", gap: 1, alignItems: "center", minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.title}</Typography>
                  {x.toggle ? <TileSwitch d={d} def={x} onChanged={onChanged} /> : <Chip tint={on ? "green" : "slate"}>{on ? "on" : "off"}</Chip>}
                </Box>
                <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{x.when(d)}</Typography>
                <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>To {x.to}{x.key !== "created" ? ` · ${full(count(x.key))} sent in 7 days` : ""}</Typography>
                {x.key === "avor" && !on && <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>Off: the card shows the mail to write from the ticket (a DEMO still goes to the demo user)</Typography>}
                {!on && !x.toggle && <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>Switched on at {x.switchOn}</Typography>}
              </Box>
            );
          })}
        </Box>
        <Preview k={k} d={d} />
      </Box>
      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 } }}>
          <CardTitle icon={<HistoryOutlinedIcon />} tint="blue" title={`Every mail sent: ${full(sent.length)}`} note={'Newest first - the owners\' reminders, "⚠️REMINDER: Back Office Ticket", the declarations to the customer and EDA, and the mails to AVOR; the way in\'s mails are on Back Office distribution > Way in'} />
        </Box>
        <SentTable rows={sent} />
      </GlassCard>
    </>
  );
}
