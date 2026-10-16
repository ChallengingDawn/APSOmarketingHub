"use client";

// Search bar > AI chat: the conversations customers had with the bar's AI assistant (the dashboard's "AI
// search bar" page), newest first; a click opens the questions and answers. Archiving stays on the old
// dashboard until the switches move.

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ButtonBase from "@mui/material/ButtonBase";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { Chip, Choice, usePaged } from "@/app/connectors/parts";
import type { AiConversation, AiConversations } from "@/lib/searchbar/gateway";
import { Empty, Loaded, when } from "./shared";

function Conversation({ c }: { c: AiConversation }) {
  const [open, setOpen] = useState(false);
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

function List({ d }: { d: AiConversations }) {
  const { slice, pager } = usePaged(d.conversations ?? [], 15);
  if (!d.conversations?.length) return <Empty>No conversations here.</Empty>;
  return <>{slice.map((c) => <Conversation key={c.query_id} c={c} />)}{pager}</>;
}

export default function AiTab() {
  const [which, setWhich] = useState<"active" | "archived">("active");
  return (
    <GlassCard>
      <CardTitle icon={<SmartToyOutlinedIcon />} tint="purple" title="Conversations with the AI assistant"
        note="The last 100, newest first - click one to read it. Archiving stays on the old dashboard for now."
        right={<Choice value={which} onChange={setWhich} options={[{ key: "active", label: "Current" }, { key: "archived", label: "Archived" }]} />} />
      <Loaded<AiConversations> url={`/api/website/search-bar?part=ai&archived=${which === "archived" ? 1 : 0}`} what="the conversations">
        {(d) => <List d={d} />}
      </Loaded>
    </GlassCard>
  );
}
