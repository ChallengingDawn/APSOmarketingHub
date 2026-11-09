"use client";

// APSO TRANSLATOR > SETTINGS & HELP - Live, Preview or Off, the inboxes it reads, replies with "!", DeepL's characters,
// and the agents' commands. Its own page in the app's side panel since 09.11.2026 (SARCLA: "the sub apps on the side
// panel"); admins change, everyone with the app reads.

import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Switch from "@mui/material/Switch";
import PowerSettingsNewOutlinedIcon from "@mui/icons-material/PowerSettingsNewOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import DataUsageOutlinedIcon from "@mui/icons-material/DataUsageOutlined";
import { full } from "@/app/charts/format";
import { CardTitle, GlassCard, INK, MUTED, Notice } from "@/app/uc/report/ui";
import { Chip, Choice, when } from "@/app/connectors/parts";
import type { Mode } from "@/lib/translator/engine";
import { Frame, MODE, pct, useTranslator, type Data } from "../shared";
import { CommentCard, SidebarCard } from "../HubSpotPreview";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import type { PreviewMessage } from "@/lib/translator/engine";

type Act = (b: Record<string, unknown>, method?: "PUT" | "POST") => void;
const RULE = "1px solid rgba(21,34,58,.08)";

function Status({ d, act, busy }: { d: Data; act: Act; busy: boolean }) {
  const s = d.settings, m = MODE[s.mode];
  const setMode = (mode: Mode) => {
    if (mode === s.mode) return;
    const ask = mode === "live" ? "Switch APSO Translator to Live? It then posts its comments on the tickets and sends the agents' \"!\" replies to customers."
      : mode === "off" ? "Switch APSO Translator off? Customer messages are no longer translated." : "Back to Preview? It translates and lists, posting nothing.";
    if (confirm(ask)) act({ mode });
  };
  return (
    <GlassCard>
      <CardTitle icon={<PowerSettingsNewOutlinedIcon />} tint={m.tint} title="Live, Preview or Off" note={d.admin ? "Asks before it changes" : "Admins change it"} />
      <Box sx={{ display: "flex", gap: 1.25, alignItems: "center", flexWrap: "wrap", mt: 1 }}>
        <Chip tint={m.tint}>{m.label}</Chip>
        <Typography sx={{ fontSize: "0.86rem", color: INK, flex: 1, minWidth: 220 }}>
          {s.mode === "off" ? "Nothing is translated" : s.mode === "preview" ? "Translates and lists on Conversations, posts nothing" : "Posts the comments and sends the replies"}
          {s.mode !== "off" && (d.last ? ` · last look ${when(d.last.at)}, ${full(d.last.threads)} conversation${d.last.threads === 1 ? "" : "s"} read` : " · first look within a minute")}
        </Typography>
      </Box>
      {d.admin && (
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", mt: 1.5 }}>
          <Choice value={s.mode} onChange={setMode} options={[{ key: "off", label: "Off" }, { key: "preview", label: "Preview" }, { key: "live", label: "Live" }]} />
          <Button size="small" variant="outlined" disabled={busy || s.mode === "off"} onClick={() => act({ action: "run" }, "POST")}>Look now</Button>
        </Box>
      )}
    </GlassCard>
  );
}

function SettingsCard({ d, act }: { d: Data; act: Act }) {
  const s = d.settings;
  const all = Object.keys(d.inboxes);
  const on = (id: string) => !s.inboxes || s.inboxes.includes(id);
  const toggle = (id: string) => {
    const cur = s.inboxes ?? all;
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    act({ inboxes: next.length === all.length ? null : next });
  };
  const line = (label: string, note: string, checked: boolean, onChange: () => void) => (
    <Box key={label} sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 0.75, borderTop: RULE }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: "0.86rem", color: INK, fontWeight: 600 }}>{label}</Typography>
        <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>{note}</Typography>
      </Box>
      <Switch checked={checked} disabled={!d.admin} onChange={onChange} />
    </Box>
  );
  return (
    <GlassCard>
      <CardTitle icon={<TuneOutlinedIcon />} tint="slate" title="What it reads" note={d.admin ? "Saved at once" : "Admins change these"} />
      {all.map((id) => line(d.inboxes[id], "Its customers' messages are translated", on(id), () => toggle(id)))}
      {line("Replies with !", "An agent's \"!<text>\" note is sent to the customer in their language, as that agent", s.replies, () => act({ replies: !s.replies }))}
    </GlassCard>
  );
}

function DeepL({ d }: { d: Data }) {
  const u = d.usage;
  const share = u?.limit ? Math.min(1, u.used / u.limit) : null;
  return (
    <GlassCard>
      <CardTitle icon={<DataUsageOutlinedIcon />} tint="amber" title="DeepL" note="Characters this DeepL period" />
      {!d.configured ? <Notice tone="warn">No DeepL key on the hub - nothing can be translated.</Notice> : !u ? (
        <Typography sx={{ fontSize: "0.86rem", color: MUTED, mt: 1 }}>DeepL did not answer.</Typography>
      ) : (
        <Box sx={{ mt: 1, display: "grid", gap: 1 }}>
          <Typography sx={{ fontSize: "1.6rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{full(u.used)}</Typography>
          {u.limit ? (
            <>
              <Box sx={{ height: 8, borderRadius: 4, bgcolor: "rgba(21,34,58,.08)", overflow: "hidden" }}>
                <Box sx={{ width: `${(share ?? 0) * 100}%`, height: "100%", bgcolor: (share ?? 0) > 0.85 ? "#c2410c" : "#3461c9" }} />
              </Box>
              <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{pct(u.used, u.limit)} of {full(u.limit)}</Typography>
            </>
          ) : <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>No limit on this DeepL account</Typography>}
        </Box>
      )}
    </GlassCard>
  );
}

function HowTo() {
  const row = (cmd: string, text: string) => (
    <Box key={cmd} sx={{ display: "grid", gridTemplateColumns: "150px minmax(0,1fr)", gap: 1.5, py: 0.6, borderTop: RULE }}>
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

// an example conversation - what an agent sees in HubSpot, drawn with the cards of the Conversations page's preview
const EXAMPLE_AT = "2026-11-10T08:14:00.000Z";
const EXAMPLE: PreviewMessage[] = [
  { id: "x1", at: EXAMPLE_AT, kind: "customer", who: "Example customer", text: "Guten Tag, können Sie mir bitte die Konformitätserklärung für die Bestellung senden? Vielen Dank", channel: "email", ours: false },
  { id: "x2", at: "2026-11-10T08:15:00.000Z", kind: "comment", who: "APSO Translator", text: "🌐 Auto-translation (DE → EN):\n\nGood day, could you please send me the declaration of conformity for the order? Thank you very much", channel: "email", ours: true },
];
function WhatAgentsSee() {
  return (
    <GlassCard>
      <CardTitle icon={<VisibilityOutlinedIcon />} tint="purple" title="What the agents see in HubSpot" note="An example - Conversations shows each real one" />
      <Grid container spacing={2} sx={{ mt: 0.5 }}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: MUTED, mb: 1 }}>THE CONVERSATION: A COMMENT ONLY AGENTS SEE</Typography>
          <Box sx={{ bgcolor: "#fff", border: "1px solid #cbd6e2", borderRadius: "4px", p: 2, display: "grid", gap: 1.5 }}>
            <Box sx={{ bgcolor: "#f5f8fa", border: "1px solid #cbd6e2", borderRadius: "8px", px: 1.5, py: 1, maxWidth: "82%" }}>
              <Typography sx={{ fontSize: 13, color: "#33475b" }}>{EXAMPLE[0].text}</Typography>
            </Box>
            <CommentCard who="APSO Translator" at={EXAMPLE[1].at} text={EXAMPLE[1].text} />
          </Box>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: MUTED, mb: 1 }}>THE CARD IN THE HELP DESK SIDEBAR</Typography>
          <SidebarCard messages={EXAMPLE} customerLang="DE" />
        </Grid>
      </Grid>
    </GlassCard>
  );
}

export default function TranslatorSettings() {
  const { d, wait, act, busy, note } = useTranslator("overview");
  return (
    <Frame title="Settings & help" subtitle="Live or Preview, the inboxes it reads, replies with !, and the agents' commands" d={d} note={note}>
      {d ? (
        <>
          {d.last?.error && d.settings.mode !== "off" && <Notice tone="bad">Last look: {d.last.error}</Notice>}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, lg: 8 }}><Status d={d} act={act} busy={busy} /></Grid>
            <Grid size={{ xs: 12, lg: 4 }}><DeepL d={d} /></Grid>
          </Grid>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, lg: 6 }}><SettingsCard d={d} act={act} /></Grid>
            <Grid size={{ xs: 12, lg: 6 }}><HowTo /></Grid>
          </Grid>
          <WhatAgentsSee />
        </>
      ) : wait}
    </Frame>
  );
}
