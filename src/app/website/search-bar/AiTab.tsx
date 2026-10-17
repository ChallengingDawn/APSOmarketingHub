"use client";

// Search bar > AI chat: the conversations customers had with the bar's AI assistant (the dashboard's "AI
// search bar" page), newest first; a click opens the questions and answers. Archiving stays on the old
// dashboard until the switches move.

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import ButtonBase from "@mui/material/ButtonBase";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, MUTED, GREEN, Notice } from "@/app/uc/report/ui";
import { Chip, Choice, usePaged } from "@/app/connectors/parts";
import type { AiConversation, AiConversations } from "@/lib/searchbar/gateway";
import { Empty, Loaded, when, pill, post } from "./shared";

function Conversation({ c, archived, isAdmin, onMoved }: { c: AiConversation; archived: boolean; isAdmin: boolean; onMoved: (text: string, ok: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const move = async () => {
    setBusy(true);
    const r = await post({ action: "ai-archive", conversation_id: c.query_id, archived: !archived });
    setBusy(false);
    onMoved(r.ok ? (archived ? "Brought back to the current conversations." : "Archived.") : r.error ?? "Did not work.", r.ok);
  };
  const first = c.turns.find((t) => t.role === "user")?.text ?? "(no question)";
  const questions = c.turns.filter((t) => t.role === "user").length;
  return (
    <Box sx={{ borderTop: `1px solid ${HAIRLINE}` }}>
      <ButtonBase onClick={() => setOpen((o) => !o)} sx={{ width: "100%", justifyContent: "flex-start", textAlign: "left", py: 1.25, gap: 1.25 }}>
        <ExpandMoreIcon sx={{ fontSize: 18, color: FAINT, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{first}</Typography>
          <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>{when(c.ts)} · {c.locale} · {questions} {questions === 1 ? "question" : "questions"}</Typography>
        </Box>
      </ButtonBase>
      {open && (
        <Box sx={{ display: "grid", gap: 1, pb: 1.5, pl: 4 }}>
          {isAdmin && <Box><Button size="small" variant="outlined" sx={pill} disabled={busy} onClick={() => void move()}>{busy ? <CircularProgress size={14} /> : archived ? "Bring back" : "Archive"}</Button></Box>}
          {c.turns.map((t, i) => (
            <Box key={i} sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
              <Chip tint={t.role === "user" ? "blue" : "purple"}>{t.role === "user" ? "Customer" : "Assistant"}</Chip>
              <Typography sx={{ fontSize: "0.84rem", color: t.role === "user" ? INK : MUTED, whiteSpace: "pre-wrap", wordBreak: "break-word", flex: 1 }}>{t.text}</Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

function List({ d, archived, reload }: { d: AiConversations & { isAdmin?: boolean }; archived: boolean; reload: () => void }) {
  const { slice, pager } = usePaged(d.conversations ?? [], 15);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (!d.conversations?.length) return <Empty>No conversations here.</Empty>;
  return (
    <>
      {msg && (msg.ok ? <Typography sx={{ fontSize: "0.82rem", color: GREEN, mb: 1 }}>{msg.text}</Typography> : <Notice tone="bad">{msg.text}</Notice>)}
      {slice.map((c) => <Conversation key={c.query_id} c={c} archived={archived} isAdmin={!!d.isAdmin} onMoved={(text, ok) => { setMsg({ ok, text }); if (ok) reload(); }} />)}
      {pager}
    </>
  );
}

export default function AiTab() {
  const [which, setWhich] = useState<"active" | "archived">("active");
  return (
    <GlassCard>
      <CardTitle icon={<SmartToyOutlinedIcon />} tint="purple" title="Conversations with the AI assistant"
        note="The last 100, newest first - click one to read it; an admin can archive it there."
        right={<Choice value={which} onChange={setWhich} options={[{ key: "active", label: "Current" }, { key: "archived", label: "Archived" }]} />} />
      <Loaded<AiConversations> url={`/api/website/search-bar?part=ai&archived=${which === "archived" ? 1 : 0}`} what="the conversations">
        {(d, reload) => <List d={d} archived={which === "archived"} reload={reload} />}
      </Loaded>
    </GlassCard>
  );
}
