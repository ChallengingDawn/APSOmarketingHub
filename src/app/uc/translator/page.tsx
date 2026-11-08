"use client";

// APSO TRANSLATOR - HubSpot Apps (src/lib/translator). The Railway translator brought into the hub, SARCLA 08.11.2026:
// "migrate to the hub ... kill Railway and bring all to the hub". Every customer message not in English gets a comment in
// English for the agent; an agent's "!" note translates or replies in the customer's language. Replaces apsotranslator.com.

import { useCallback, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Switch from "@mui/material/Switch";
import TranslateOutlinedIcon from "@mui/icons-material/TranslateOutlined";
import ReplyOutlinedIcon from "@mui/icons-material/ReplyOutlined";
import ChatOutlinedIcon from "@mui/icons-material/ChatOutlined";
import DataUsageOutlinedIcon from "@mui/icons-material/DataUsageOutlined";
import BarChartOutlinedIcon from "@mui/icons-material/BarChartOutlined";
import LanguageOutlinedIcon from "@mui/icons-material/LanguageOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { BarList } from "@/app/charts/BarList";
import { CardTitle, GlassCard, INK, KpiTile, MUTED, Notice, bodyCell, headCell, hsTicket } from "@/app/uc/report/ui";
import { Chip, Choice, Info, usePaged, when } from "@/app/connectors/parts";
import type { Tint } from "@/app/uc/report/ui";
import type { Day, Mode, Outcome, Row, RunInfo, Settings } from "@/lib/translator/engine";
import { LANG_NAMES } from "@/lib/translator/text";

type Data = {
  settings: Settings; last: RunInfo | null; rows: Row[]; days: Record<string, Day>; inboxes: Record<string, string>; agents: Record<string, string>;
  usage: { used: number; limit: number | null } | null; configured: boolean; everySeconds: number; admin: boolean;
};

const MODE: Record<Mode, { label: string; tint: Tint }> = { live: { label: "Live", tint: "green" }, preview: { label: "Preview", tint: "amber" }, off: { label: "Off", tint: "slate" } };
const OUTCOME: Record<Outcome, { label: string; tint: Tint }> = {
  posted: { label: "Comment posted", tint: "green" }, sent: { label: "Sent to the customer", tint: "blue" }, would: { label: "Preview - not posted", tint: "amber" },
  skipped: { label: "Nothing to do", tint: "slate" }, failed: { label: "Failed", tint: "pink" },
};
const lang = (code: string | null) => (code ? LANG_NAMES[code.split("-")[0]] ?? code : "—");
const dayKey = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Zurich" });
function lastDays(days: Record<string, Day>, n: number) {
  const out: { key: string; d: Day }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const key = dayKey(new Date(Date.now() - i * 86400_000));
    out.push({ key, d: days[key] ?? { n: 0, chars: 0, replies: 0, langs: {} } });
  }
  return out;
}

function Status({ d, act, busy }: { d: Data; act: (b: Record<string, unknown>, method?: "PUT" | "POST") => void; busy: boolean }) {
  const s = d.settings, m = MODE[s.mode];
  const setMode = (mode: Mode) => {
    if (mode === s.mode) return;
    const ask = mode === "live" ? "Switch APSO Translator to Live? It then posts its comments on the tickets and sends the agents' \"!\" replies to customers."
      : mode === "off" ? "Switch APSO Translator off? Customer messages are no longer translated." : "Back to Preview? It translates and lists, posting nothing.";
    if (confirm(ask)) act({ mode });
  };
  return (
    <GlassCard>
      <Box sx={{ display: "flex", gap: 1.25, alignItems: "center", flexWrap: "wrap" }}>
        <Chip tint={m.tint}>{m.label}</Chip>
        <Typography sx={{ fontSize: "0.86rem", color: INK, flex: 1, minWidth: 220 }}>
          {s.mode === "off" ? "Off - nothing is translated" : d.last ? `Last look ${when(d.last.at)} · ${full(d.last.threads)} conversation${d.last.threads === 1 ? "" : "s"} read` : "First look within a minute"}
          {s.mode === "preview" && " · translates and lists, posts nothing"}
        </Typography>
        {d.admin && (
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
            <Choice value={s.mode} onChange={setMode} options={[{ key: "off", label: "Off" }, { key: "preview", label: "Preview" }, { key: "live", label: "Live" }]} />
            <Button size="small" variant="outlined" disabled={busy || s.mode === "off"} onClick={() => act({ action: "run" }, "POST")}>Look now</Button>
          </Box>
        )}
      </Box>
    </GlassCard>
  );
}

function Figures({ d }: { d: Data }) {
  const week = lastDays(d.days, 7), month = lastDays(d.days, 30);
  const today = week[week.length - 1].d;
  const sum = (xs: { d: Day }[], f: (x: Day) => number) => xs.reduce((a, x) => a + f(x.d), 0);
  const langs = useMemo(() => {
    const m: Record<string, number> = {};
    for (const x of month) for (const [k, v] of Object.entries(x.d.langs)) m[k] = (m[k] ?? 0) + v;
    return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: lang(k), value: v }));
  }, [month]);
  const u = d.usage;
  return (
    <>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<TranslateOutlinedIcon />} tint="blue" label="Translated today" value={full(today.n - today.replies)} note="customer messages and ! translations" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<ChatOutlinedIcon />} tint="purple" label="Translated, last 7 days" value={full(sum(week, (x) => x.n - x.replies))} note={`${full(sum(month, (x) => x.n - x.replies))} in 30 days`} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<ReplyOutlinedIcon />} tint="green" label="Replies in the customer's language" value={full(sum(week, (x) => x.replies))} note="last 7 days, sent with !" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<DataUsageOutlinedIcon />} tint="amber" label="DeepL characters" value={u ? full(u.used) : "—"} note={u ? (u.limit ? `of ${full(u.limit)} this period` : "this period") : d.configured ? "DeepL did not answer" : "no DeepL key yet"} />
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <GlassCard>
            <CardTitle icon={<BarChartOutlinedIcon />} tint="blue" title="Translations per day" note="Last 30 days" />
            <StackedColumns
              data={month.map((x) => ({ x: x.key, translated: x.d.n - x.d.replies, replies: x.d.replies }))}
              parts={[{ key: "translated", label: "Translated for the agent" }, { key: "replies", label: "Replies sent" }]}
              height={220} xFormat={(x) => `${x.slice(8, 10)}.${x.slice(5, 7)}`}
            />
          </GlassCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <GlassCard>
            <CardTitle icon={<LanguageOutlinedIcon />} tint="purple" title="Languages" note="Last 30 days" />
            <BarList rows={langs} labelWidth={110} format={(v) => full(v ?? 0)} emptyMessage="Nothing translated yet." />
          </GlassCard>
        </Grid>
      </Grid>
    </>
  );
}

function Activity({ d }: { d: Data }) {
  const [view, setView] = useState<"all" | "customer" | "replies" | "problems">("all");
  const [open, setOpen] = useState<string | null>(null);
  const rows = d.rows.filter((r) => view === "all" ? r.outcome !== "skipped" : view === "customer" ? r.kind === "incoming" && r.outcome !== "skipped"
    : view === "replies" ? r.kind === "reply" || r.kind === "lang" : r.outcome === "failed" || r.outcome === "skipped");
  const n = (f: (r: Row) => boolean) => d.rows.filter(f).length;
  const { slice, pager } = usePaged(rows, 15);
  const what = (r: Row) => r.kind === "incoming" ? `${lang(r.from)} → English` : r.kind === "lang" ? `!${r.to ?? ""} - the customer's message in ${lang(r.to)}`
    : r.kind === "reply" ? `Reply in ${lang(r.to)}` : "!help";
  return (
    <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
      <Box sx={{ px: { xs: 2, md: 2.75 }, pb: 1.5, display: "grid", gap: 1.25 }}>
        <CardTitle icon={<ChatOutlinedIcon />} tint="blue" title="Every translation" note="Newest first - click a row for the whole text" />
        <Choice value={view} onChange={setView} options={[
          { key: "all", label: `All ${full(n((r) => r.outcome !== "skipped"))}` },
          { key: "customer", label: `Customer messages ${full(n((r) => r.kind === "incoming" && r.outcome !== "skipped"))}` },
          { key: "replies", label: `! notes ${full(n((r) => r.kind === "reply" || r.kind === "lang"))}` },
          { key: "problems", label: `Not done ${full(n((r) => r.outcome === "failed" || r.outcome === "skipped"))}` },
        ]} />
      </Box>
      {rows.length ? (
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 760, tableLayout: "fixed" }}>
            <TableHead><TableRow>
              <TableCell sx={{ ...headCell, width: 120 }}>When</TableCell>
              <TableCell sx={{ ...headCell, width: 190 }}>Ticket</TableCell>
              <TableCell sx={{ ...headCell, width: 210 }}>What</TableCell>
              <TableCell sx={headCell}>Text</TableCell>
              <TableCell sx={{ ...headCell, width: 170 }}>Outcome</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {slice.map((r) => {
                const key = `${r.thread}-${r.msgAt}-${r.kind}`, isOpen = open === key, o = OUTCOME[r.outcome];
                return (
                  <TableRow key={key} hover onClick={() => setOpen(isOpen ? null : key)} sx={{ cursor: "pointer", verticalAlign: "top" }}>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED }}>{when(r.msgAt)}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>
                      {r.ticket ? <a href={hsTicket(r.ticket)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "#2459d1", textDecoration: "none" }}>Ticket {r.ticket}</a> : <span style={{ color: MUTED }}>No ticket</span>}
                      <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{r.channel === "chat" ? "Chat" : r.channel === "email" ? "E-mail" : "Message"}{r.inbox && d.inboxes[r.inbox] ? ` · ${d.inboxes[r.inbox]}` : ""}</Typography>
                    </TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", color: INK }}>
                      {what(r)}
                      {r.agent && <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{d.agents[r.agent] ?? "an agent"}</Typography>}
                    </TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.8rem" }}>
                      <Typography sx={{ fontSize: "0.8rem", color: MUTED, whiteSpace: isOpen ? "pre-wrap" : "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.original}</Typography>
                      {r.translated && <Typography sx={{ fontSize: "0.8rem", color: INK, whiteSpace: isOpen ? "pre-wrap" : "nowrap", overflow: "hidden", textOverflow: "ellipsis", mt: 0.25 }}>{r.translated}</Typography>}
                    </TableCell>
                    <TableCell sx={bodyCell}>
                      <Chip tint={o.tint}>{o.label}</Chip>
                      {r.why && <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 0.5 }}>{r.why}</Typography>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      ) : <Box sx={{ px: { xs: 2, md: 2.75 }, pb: 2 }}><Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Nothing here yet - the first customer message in another language shows up within a minute.</Typography></Box>}
      {pager}
    </GlassCard>
  );
}

function SettingsCard({ d, act }: { d: Data; act: (b: Record<string, unknown>) => void }) {
  const s = d.settings;
  const all = Object.keys(d.inboxes);
  const on = (id: string) => !s.inboxes || s.inboxes.includes(id);
  const toggle = (id: string) => {
    const cur = s.inboxes ?? all;
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    act({ inboxes: next.length === all.length ? null : next });
  };
  const line = (label: string, note: string, checked: boolean, onChange: () => void) => (
    <Box key={label} sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 0.75, borderTop: "1px solid rgba(21,34,58,.08)" }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: "0.86rem", color: INK, fontWeight: 600 }}>{label}</Typography>
        <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>{note}</Typography>
      </Box>
      <Switch checked={checked} disabled={!d.admin} onChange={onChange} />
    </Box>
  );
  return (
    <GlassCard>
      <CardTitle icon={<TuneOutlinedIcon />} tint="slate" title="Settings" note={d.admin ? "Saved at once" : "Admins change these"} />
      {all.map((id) => line(d.inboxes[id], "Its customers' messages are translated", on(id), () => toggle(id)))}
      {line("Replies with !", "An agent's \"!<text>\" note is sent to the customer in their language, as that agent", s.replies, () => act({ replies: !s.replies }))}
    </GlassCard>
  );
}

function HowTo() {
  const row = (cmd: string, text: string) => (
    <Box key={cmd} sx={{ display: "grid", gridTemplateColumns: "150px minmax(0,1fr)", gap: 1.5, py: 0.6, borderTop: "1px solid rgba(21,34,58,.08)" }}>
      <Typography sx={{ fontSize: "0.84rem", fontFamily: "monospace", color: "#2459d1" }}>{cmd}</Typography>
      <Typography sx={{ fontSize: "0.84rem", color: INK }}>{text}</Typography>
    </Box>
  );
  return (
    <GlassCard>
      <CardTitle icon={<HelpOutlineOutlinedIcon />} tint="blue" title="For the agents" note="A comment on the conversation, starting with !" />
      {row("(nothing)", "Every customer message not in English gets a comment in English")}
      {row("!help", "This list, as a comment")}
      {row("!FR  !DE  !IT …", "The customer's last message in that language, as a comment")}
      {row("!Your text", "Your text in the customer's language, sent to the customer as you")}
    </GlassCard>
  );
}

function Board({ d, act, busy, note }: { d: Data; act: (b: Record<string, unknown>, method?: "PUT" | "POST") => void; busy: boolean; note: string | null }) {
  const [view, setView] = useState<"activity" | "settings">("activity");
  return (
    <>
      {note && <Info>{note}</Info>}
      {!d.configured && <Notice tone="warn">No DeepL key on the hub yet - nothing can be translated until it is added (with the release).</Notice>}
      {d.last?.error && d.settings.mode !== "off" && <Notice tone="bad">Last look: {d.last.error}</Notice>}
      <Status d={d} act={act} busy={busy} />
      <Figures d={d} />
      <Box sx={{ display: "grid", gap: 1.25 }}>
        <Choice value={view} onChange={setView} options={[{ key: "activity", label: "Activity" }, { key: "settings", label: "Settings & help" }]} />
        {view === "activity" ? <Activity d={d} /> : (
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, lg: 6 }}><SettingsCard d={d} act={act} /></Grid>
            <Grid size={{ xs: 12, lg: 6 }}><HowTo /></Grid>
          </Grid>
        )}
      </Box>
    </>
  );
}

export default function Translator() {
  const [tick, setTick] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const url = `/api/uc/translator?n=${tick}`;
  const held = useHeld<Data>(url, [url]);
  const r = held.result;
  const act = useCallback(async (body: Record<string, unknown>, method: "PUT" | "POST" = "PUT") => {
    setNote(null); setBusy(true);
    const j = await fetch("/api/uc/translator", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((x) => x.json()).catch(() => null);
    setBusy(false);
    if (!j?.ok) setNote(j?.error ?? "Could not save.");
    else if (method === "POST") setNote(j.data?.skipped ? `Not run: ${j.data.skipped}.` : `Looked: ${full(j.data.threads ?? 0)} conversations, ${full(j.data.translated ?? 0)} translated${j.data.error ? ` - ${j.data.error}` : ""}.`);
    setTick((n) => n + 1);
  }, []);
  let body: React.ReactNode;
  if (r === null) body = <LoadingPanel label="Reading the translations…" />;
  else if (r.state === "error") body = <UpstreamPanel source="APSO Translator" error={r.error} status={r.status} onRetry={() => setTick((n) => n + 1)} />;
  else if (r.state !== "ok") body = <UpstreamPanel source="APSO Translator" error="Not available" status={null} onRetry={() => setTick((n) => n + 1)} />;
  else body = <Board d={r.data} act={act} busy={busy} note={note} />;
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader title="APSO Translator" subtitle="Customers' chats and e-mails in English for the agent, replies in their language - every minute, with DeepL" />
      {body}
    </Box>
  );
}
