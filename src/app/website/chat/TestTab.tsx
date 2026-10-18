"use client";

// Chat > Test: the old dashboard's Test Sandbox, made safe. A message goes to the same AI the shop chat uses and
// the answer comes back with what the AI decided (category, hand-over, team) and how long it took - nothing is
// written: no ticket, no contact, no statistics (the orchestrator's /dashboard/test-dry, 18.10.2026; the old
// sandbox made real tickets). The conversation carries on until "New conversation", so the AI's way of talking
// before handing over can be tried turn by turn.

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import { Choice, Chip } from "@/app/connectors/parts";
import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, MUTED, Notice } from "@/app/uc/report/ui";
import type { TestAnswer } from "@/lib/chat/orchestrator";
import { COUNTRIES, LANGUAGES, pill, post } from "./shared";

type Line = { me: boolean; text: string; a?: TestAnswer };

export default function TestTab() {
  const [lang, setLang] = useState<string>("en");
  const [country, setCountry] = useState<string>("CH");
  const [text, setText] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [conv, setConv] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const send = async () => {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true); setErr(null); setText("");
    setLines((l) => [...l, { me: true, text: message }]);
    const r = await post<TestAnswer>({ action: "test", message, language: lang, country, conversationId: conv });
    setBusy(false);
    if (!r.ok || !r.data) { setErr(r.error ?? "The orchestrator did not answer."); return; }
    setConv(r.data._conversationId);
    setLines((l) => [...l, { me: false, text: r.data?.reply ?? "(no reply)", a: r.data }]);
  };
  const reset = () => { setLines([]); setConv(undefined); setErr(null); };

  return (
    <GlassCard sx={{ display: "grid", gap: 1.5 }}>
      <CardTitle icon={<ScienceOutlinedIcon />} tint="purple" title="Try the chat's AI"
        note="Write as a customer would. The answer comes from the same AI as the shop chat, with what it decided and how long it took. Nothing is written: no ticket, no contact, no statistics." />
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
        <Choice value={lang} onChange={(k) => { setLang(k); reset(); }} options={LANGUAGES.map((l) => ({ key: l, label: l.toUpperCase() }))} />
        <Choice value={country} onChange={(k) => { setCountry(k); reset(); }} options={COUNTRIES.map((c) => ({ key: c, label: c }))} />
      </Box>

      <Box sx={{ display: "grid", gap: 1, minHeight: 120, maxHeight: 520, overflow: "auto", p: 1.5, borderRadius: "14px", border: `1px solid ${HAIRLINE}`, bgcolor: "rgba(106,70,201,.03)" }}>
        {!lines.length && <Typography sx={{ fontSize: "0.84rem", color: FAINT }}>For example: "Where is my order A26.123456.000?" or "Which O-ring for hot water at 120 °C?"</Typography>}
        {lines.map((l, i) => (
          <Box key={i} sx={{ justifySelf: l.me ? "end" : "start", maxWidth: "80%", display: "grid", gap: 0.5 }}>
            <Box sx={{ px: 1.5, py: 1, borderRadius: "14px", fontSize: "0.86rem", lineHeight: 1.5, whiteSpace: "pre-wrap",
              color: l.me ? "#fff" : INK, bgcolor: l.me ? "#2459d1" : "#fff", border: l.me ? "none" : `1px solid ${HAIRLINE}` }}>{l.text}</Box>
            {l.a && <Decided a={l.a} />}
          </Box>
        ))}
        {busy && <Box sx={{ display: "flex", gap: 1, alignItems: "center", color: MUTED, fontSize: "0.8rem" }}><CircularProgress size={14} /> The AI is answering…</Box>}
      </Box>
      {err && <Notice tone="bad">{err}</Notice>}

      <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
        <TextField fullWidth size="small" multiline maxRows={5} placeholder="A customer's message…" value={text} disabled={busy}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
          slotProps={{ htmlInput: { "aria-label": "Test message", maxLength: 2000 } }} />
        <Button variant="contained" sx={pill} disabled={busy || !text.trim()} onClick={() => void send()}>Send</Button>
        <Button variant="outlined" sx={pill} disabled={busy || !lines.length} onClick={reset}>New conversation</Button>
      </Box>
    </GlassCard>
  );
}

/** What the AI decided on this turn, under its answer. */
function Decided({ a }: { a: TestAnswer }) {
  const team = a.routing_team ? a.routing_team.replace(/_/g, " ") : null;
  const ms = a._ms ?? a.duration_ms;
  return (
    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", alignItems: "center" }}>
      {a.escalate ? <Chip tint="green">Hands over{team ? ` to ${team}` : ""}</Chip> : <Chip tint="slate">AI keeps talking</Chip>}
      {a.enquiry_category && <Chip tint="amber">{a.enquiry_category}{a.sub_l1 ? ` · ${a.sub_l1}` : ""}</Chip>}
      {a.order_number && <Chip tint="blue">Order {a.order_number}</Chip>}
      {ms != null && <Chip tint={ms > 8000 ? "pink" : "slate"}>{(ms / 1000).toFixed(1)} s</Chip>}
    </Box>
  );
}
