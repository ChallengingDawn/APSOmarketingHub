"use client";

// APSO TRANSLATOR - what the agent sees in HubSpot (SARCLA 10.11.2026: "develop more tabs to see it better, with for
// example a card preview in HS"): a conversation as the Help Desk shows it, the translator's comments in it as the yellow
// comment cards they are (in Preview, the one it would post, dashed), and the APSO Translator card of the Help Desk
// sidebar for the same ticket. Drawn in HubSpot's own colours so it reads as HubSpot, not as the hub; read only.

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { Choice, when } from "@/app/connectors/parts";
import { MUTED } from "@/app/uc/report/ui";
import type { PreviewMessage, Row } from "@/lib/translator/engine";
import { CHANNEL, lang } from "./shared";

// HubSpot's palette (Canvas): obsidian text, slinky secondary, battleship borders, the comment card's yellow
const HS = {
  font: '"Lexend Deca", Helvetica, Arial, sans-serif', ink: "#33475b", soft: "#516f90", line: "#cbd6e2", wash: "#f5f8fa",
  agent: "#e5f5f8", agentLine: "#7fd1de", note: "#fef8f0", noteLine: "#f5c26b", primary: "#ff7a59", tagBg: "#e5f5f8", tagLine: "#7fd1de",
};
const initials = (s: string | null) => (s ?? "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";

function Avatar({ who, tint }: { who: string | null; tint: string }) {
  return <Box sx={{ width: 28, height: 28, borderRadius: "50%", bgcolor: tint, color: "#fff", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 600, flexShrink: 0 }}>{initials(who)}</Box>;
}

/** A comment, as HubSpot draws an internal note: yellow, "Comment", only agents see it. */
export function CommentCard({ who, at, text, preview = false }: { who: string | null; at: string | null; text: string; preview?: boolean }) {
  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
      <Avatar who={who} tint={preview ? "#b0c1d4" : "#f5a623"} />
      <Box sx={{ flex: 1, minWidth: 0, bgcolor: HS.note, border: `1px ${preview ? "dashed" : "solid"} ${HS.noteLine}`, borderRadius: "4px", px: 1.5, py: 1 }}>
        <Box sx={{ display: "flex", gap: 1, alignItems: "baseline", flexWrap: "wrap" }}>
          <Typography sx={{ fontFamily: HS.font, fontSize: 13, fontWeight: 600, color: HS.ink }}>{who ?? "Someone"}</Typography>
          <Typography sx={{ fontFamily: HS.font, fontSize: 12, color: HS.soft }}>left a comment{at ? ` · ${when(at)}` : ""}</Typography>
          {preview && <Typography sx={{ fontFamily: HS.font, fontSize: 11, fontWeight: 600, color: "#b36b00", ml: "auto" }}>PREVIEW - NOT POSTED</Typography>}
        </Box>
        <Typography sx={{ fontFamily: HS.font, fontSize: 13, color: HS.ink, whiteSpace: "pre-wrap", mt: 0.5, overflowWrap: "anywhere" }}>{text}</Typography>
      </Box>
    </Box>
  );
}

function Bubble({ m }: { m: PreviewMessage }) {
  if (m.kind === "comment") return <CommentCard who={m.who} at={m.at} text={m.text} />;
  const mine = m.kind === "agent" || m.kind === "bot";
  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", flexDirection: mine ? "row-reverse" : "row" }}>
      <Avatar who={m.who} tint={mine ? "#516f90" : "#00a4bd"} />
      <Box sx={{ maxWidth: "82%", minWidth: 0 }}>
        <Typography sx={{ fontFamily: HS.font, fontSize: 12, color: HS.soft, textAlign: mine ? "right" : "left", mb: 0.25 }}>
          {m.who ?? (mine ? "Agent" : "Customer")} · {when(m.at)} · {CHANNEL[m.channel]}
        </Typography>
        <Box sx={{ bgcolor: mine ? HS.agent : HS.wash, border: `1px solid ${mine ? HS.agentLine : HS.line}`, borderRadius: "8px", px: 1.5, py: 1 }}>
          <Typography sx={{ fontFamily: HS.font, fontSize: 13, color: HS.ink, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{m.text || "(no text)"}</Typography>
        </Box>
      </Box>
    </Box>
  );
}

/** The APSO Translator card of the Help Desk sidebar, as it shows this ticket (TranslatorCard.jsx's layout). */
export function SidebarCard({ messages, customerLang }: { messages: PreviewMessage[]; customerLang: string | null }) {
  const shown = messages.filter((m) => m.kind !== "comment" && (m.who ?? "").length > 1).slice(-8).reverse();
  const btn = (label: string, primary = false) => (
    <Box component="span" sx={{ fontFamily: HS.font, fontSize: 12, fontWeight: 600, px: 1.25, py: 0.5, borderRadius: "3px", border: `1px solid ${primary ? HS.primary : HS.line}`,
      bgcolor: primary ? HS.primary : "#eaf0f6", color: primary ? "#fff" : "#506e91", display: "inline-block" }}>{label}</Box>
  );
  const field = (label: string, value: string, tall = false) => (
    <Box>
      <Typography sx={{ fontFamily: HS.font, fontSize: 13, fontWeight: 600, color: HS.ink, mb: 0.5 }}>{label}</Typography>
      <Box sx={{ border: `1px solid ${HS.line}`, borderRadius: "3px", bgcolor: HS.wash, px: 1.25, py: tall ? 2.5 : 0.75, fontFamily: HS.font, fontSize: 13, color: value ? HS.ink : "#99afc4" }}>{value || "Write your reply…"}</Box>
    </Box>
  );
  return (
    <Box sx={{ width: 320, maxWidth: "100%", border: `1px solid ${HS.line}`, borderRadius: "4px", bgcolor: "#fff", fontFamily: HS.font }}>
      <Box sx={{ px: 2, py: 1.25, borderBottom: `1px solid ${HS.line}`, display: "flex", alignItems: "center", gap: 1 }}>
        <Typography sx={{ fontFamily: HS.font, fontSize: 14, fontWeight: 600, color: HS.ink, flex: 1 }}>APSO Translator</Typography>
        <Typography sx={{ fontFamily: HS.font, fontSize: 12, color: HS.soft }}>⌃</Typography>
      </Box>
      <Box sx={{ p: 2, display: "grid", gap: 1.25 }}>
        {customerLang && (
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Box component="span" sx={{ fontFamily: HS.font, fontSize: 11, fontWeight: 600, textTransform: "uppercase", px: 0.75, py: 0.25, borderRadius: "3px", bgcolor: HS.tagBg, border: `1px solid ${HS.tagLine}`, color: HS.ink }}>{lang(customerLang)}</Box>
            <Typography sx={{ fontFamily: HS.font, fontSize: 12, color: HS.soft }}>the customer&apos;s language</Typography>
          </Box>
        )}
        <Typography sx={{ fontFamily: HS.font, fontSize: 12, color: HS.soft }}>Messages: {shown.length}</Typography>
        <Box sx={{ display: "grid", gap: 0.75, justifyItems: "start" }}>{shown.map((m) => <span key={m.id}>{btn(`▶ ${m.who}`)}</span>)}</Box>
        <Box sx={{ borderTop: `1px solid ${HS.line}` }} />
        {field("Reply", "", true)}
        {field("Translate to", customerLang ? lang(customerLang) : "")}
        <Box sx={{ display: "flex", gap: 1 }}>{btn(messages.some((m) => m.channel === "chat") ? "Preview" : "Translate")}{messages.some((m) => m.channel === "chat") && btn("Send", true)}</Box>
      </Box>
    </Box>
  );
}

type Thread = { thread: string; ticket: string | null; inbox: string | null; messages: PreviewMessage[] };

/** One conversation, loaded from HubSpot when opened: the Help Desk view and the sidebar card, a switch between them. */
export function ConversationPreview({ row, preview }: { row: Row; preview: boolean }) {
  const [view, setView] = useState<"thread" | "card">("thread");
  const [t, setT] = useState<Thread | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setT(null); setErr(null);
    fetch(`/api/uc/translator?thread=${encodeURIComponent(row.thread)}`).then((x) => x.json())
      .then((j) => { if (!live) return; if (j?.ok) setT(j.data); else setErr(j?.message ?? j?.error ?? "HubSpot did not answer"); })
      .catch(() => live && setErr("HubSpot did not answer"));
    return () => { live = false; };
  }, [row.thread]);
  // in Preview the comment is not in HubSpot: shown where it would be, dashed
  const would = preview && row.outcome === "would" && row.translated
    ? { at: row.at, text: row.kind === "incoming" ? `🌐 Auto-translation (${row.from ?? "?"} → EN):\n\n${row.translated}` : row.kind === "lang" ? `🌐 Translation (${row.from ?? "?"} → ${row.to ?? "?"}):\n\n${row.translated}` : `${row.translated}` }
    : null;
  const items: ({ m: PreviewMessage } | { would: NonNullable<typeof would> })[] = t ? t.messages.map((m) => ({ m })) : [];
  if (would && t) {
    const i = t.messages.findIndex((m) => Date.parse(m.at) > Date.parse(row.msgAt));
    items.splice(i < 0 ? items.length : i, 0, { would });
  }
  const customerLang = row.kind === "incoming" ? row.from : row.to;
  return (
    <Box sx={{ display: "grid", gap: 1.5 }}>
      <Choice value={view} onChange={setView} options={[{ key: "thread", label: "The conversation in the Help Desk" }, { key: "card", label: "The sidebar card" }]} />
      {err ? <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>{err}</Typography>
        : !t ? <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>Reading the conversation in HubSpot…</Typography>
        : view === "thread" ? (
          <Box sx={{ bgcolor: "#fff", border: `1px solid ${HS.line}`, borderRadius: "4px", p: 2, display: "grid", gap: 1.5 }}>
            <Typography sx={{ fontFamily: HS.font, fontSize: 12, color: HS.soft }}>{t.inbox ?? "Inbox"}{t.ticket ? ` · Ticket ${t.ticket}` : ""} · the last {t.messages.length} messages</Typography>
            {items.map((x, i) => ("m" in x ? <Bubble key={x.m.id} m={x.m} /> : <CommentCard key={`would-${i}`} who="APSO Translator" at={x.would.at} text={x.would.text} preview />))}
          </Box>
        ) : <SidebarCard messages={t.messages} customerLang={customerLang} />}
    </Box>
  );
}
