"use client";

// APSOassistant Chat > Search bar chat (SARCLA 18.10.2026: "integrate here the search bar chat with toggles", then
// "the UX of the chat should be massively improved"). The search bar's AI assistant is APSOassistant too: the switch for
// its button on the bar (the same one as Search bar > Setup), and its conversations in the page's inbox - the question in
// the list with the start of the answer, the whole exchange on the right. Archiving is the gateway's, as on the search
// bar page. Nothing new is stored.

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import SmartButtonOutlinedIcon from "@mui/icons-material/SmartButtonOutlined";
import { Chip, Choice } from "@/app/connectors/parts";
import { CardTitle, GlassCard, GREEN, INK, MUTED, Notice } from "@/app/uc/report/ui";
import type { AiConversation, Switches } from "@/lib/searchbar/gateway";
import { Loaded, pill, post } from "@/app/website/search-bar/shared";
import { Loaded as ChatLoaded, when } from "./shared";
import { CategoryPick } from "./TopicsTab";
import { Bubbles, Inbox, Tag, type InboxItem } from "./inbox";

type Setup = { switches: Switches; isAdmin: boolean };
/** a bar conversation with its filing (the hub's summary and Enquiry Category, Topics) */
type BarChat = AiConversation & { topic?: string; topic_sub1?: string | null; summary?: string; by?: string; filing_key?: string };
type BarChats = { total: number; conversations: BarChat[]; isAdmin?: boolean };

/** topic: only the bar's conversations filed under that Enquiry Category (a topic tab), without the bar's switch */
export default function SearchBarChatTab({ topic }: { topic?: string } = {}) {
  const [which, setWhich] = useState<"active" | "archived">("active");
  return (
    <>
      {!topic && (
        <Loaded<Setup> url="/api/website/search-bar?part=setup" what="the bar's switches">
          {(s, reload) => <ButtonSwitch s={s} reload={reload} />}
        </Loaded>
      )}
      <ChatLoaded<BarChats> key={`${which}-${topic ?? ""}`} url={`/api/website/chat?part=sb-conversations&archived=${which === "archived" ? 1 : 0}${topic ? "&limit=200" : ""}`} what="the conversations">
        {(d, reload) => <BarInbox d={topic ? { ...d, conversations: (d.conversations ?? []).filter((c) => c.topic === topic) } : d} which={which} setWhich={setWhich} reload={reload} topic={topic} />}
      </ChatLoaded>
    </>
  );
}

const firstQuestion = (c: AiConversation) => c.turns.find((t) => t.role === "user")?.text?.trim() || "(no question)";
const firstAnswer = (c: AiConversation) => c.turns.find((t) => t.role !== "user")?.text?.trim() || null;
const langOf = (locale: string) => (locale || "").split("-")[0] || null;

function BarInbox({ d, which, setWhich, reload, topic }: {
  d: BarChats; which: "active" | "archived"; setWhich: (w: "active" | "archived") => void; reload: () => void; topic?: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (d.conversations ?? []).filter((c) => !q || [c.summary, c.topic, ...c.turns.map((t) => t.text)].some((x) => x?.toLowerCase().includes(q)));
  }, [d.conversations, search]);
  const items: InboxItem[] = list.map((c) => {
    const questions = c.turns.filter((t) => t.role === "user").length;
    return {
      // like the HubSpot chats: what the customer wanted (the filing's summary), then its Enquiry Category
      id: c.query_id, title: c.summary || firstQuestion(c), preview: c.summary ? `"${firstQuestion(c)}"` : firstAnswer(c), at: c.ts, lang: langOf(c.locale),
      badges: (
        <>
          <Chip tint="purple">Search bar</Chip>
          {c.topic && c.topic !== "unreadable" && <Tag tint="amber" title={c.topic_sub1 ? `${c.topic} · ${c.topic_sub1}` : c.topic}>{c.topic}{c.topic_sub1 ? ` · ${c.topic_sub1}` : ""}</Tag>}
          <Box component="span" sx={{ fontSize: "0.7rem", color: "#8b97ac", alignSelf: "center" }}>{questions} {questions === 1 ? "question" : "questions"}</Box>
        </>
      ),
    };
  });
  const open = (d.conversations ?? []).find((c) => c.query_id === selected) ?? null;
  return (
    <Inbox items={items} selected={selected} onSelect={setSelected} search={search} onSearch={setSearch}
      empty={topic ? `No search bar chat on ${topic} among the latest 200.` : which === "archived" ? "Nothing archived." : "No conversations yet."}
      toolbar={<Choice value={which} onChange={(k) => { setWhich(k); setSelected(null); }} options={[{ key: "active", label: "Current" }, { key: "archived", label: "Archived" }]} />}
      detail={open ? <BarChat key={open.query_id} c={open} archived={which === "archived"} isAdmin={!!d.isAdmin} onMoved={() => { setSelected(null); reload(); }} /> : null} />
  );
}

function BarChat({ c, archived, isAdmin, onMoved }: { c: BarChat; archived: boolean; isAdmin: boolean; onMoved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const move = async () => {
    setBusy(true); setErr(null);
    const r = await post({ action: "ai-archive", conversation_id: c.query_id, archived: !archived });
    setBusy(false);
    if (r.ok) onMoved(); else setErr(r.error ?? "Did not work.");
  };
  const questions = c.turns.filter((t) => t.role === "user").length;
  return (
    <Box sx={{ display: "grid", gap: 1.5 }}>
      <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", flexWrap: "wrap" }}>
        <Box sx={{ flex: "1 1 260px", minWidth: 0 }}>
          <Typography sx={{ fontSize: "1.02rem", fontWeight: 700, color: INK, lineHeight: 1.3 }}>{c.summary || firstQuestion(c)}</Typography>
          <Typography sx={{ fontSize: "0.78rem", color: MUTED, mt: 0.25 }}>On the search bar · {c.locale} · {when(c.ts)} · {questions} {questions === 1 ? "question" : "questions"}</Typography>
        </Box>
        {isAdmin && (
          <Button size="small" variant="outlined" sx={pill} disabled={busy} onClick={() => void move()}>
            {busy ? <CircularProgress size={14} /> : archived ? "Bring back" : "Archive"}
          </Button>
        )}
      </Box>
      {err && <Notice tone="bad">{err}</Notice>}
      <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center", p: 1.25, borderRadius: "14px", bgcolor: "rgba(21,34,58,.03)" }}>
        <Chip tint="purple">APSOassistant on the search bar</Chip>
        <Box sx={{ ml: "auto", minWidth: 200 }}>
          {c.topic && c.filing_key
            ? <CategoryPick c={{ key: c.filing_key, category: c.topic, sub1: c.topic_sub1 ?? null, by: c.by ?? "ai" }} onMoved={onMoved} />
            : <Typography sx={{ fontSize: "0.74rem", color: "#8b97ac" }}>Enquiry Category: filed within the hour</Typography>}
        </Box>
      </Box>
      <Bubbles items={c.turns.map((t) => ({ at: t.ts || c.ts, who: t.role === "user" ? "customer" : "ai", name: null, text: t.text }))} />
    </Box>
  );
}

function ButtonSwitch({ s, reload }: { s: Setup; reload: () => void }) {
  const on = s.switches.buttons.ai;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const flip = async (next: boolean) => {
    if (!next && !confirm("Hide the AI button on the search bar?\n\nCustomers can no longer open APSOassistant from the bar; the bar's search itself stays.")) return;
    setBusy(true); setMsg(null);
    const r = await post({ action: "buttons", ai: next });
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: next ? "The AI button is on the bar." : "The AI button is hidden." } : { ok: false, text: r.error ?? "Did not work." });
    if (r.ok) reload();
  };
  return (
    <GlassCard sx={{ display: "grid", gap: 1, py: { xs: 1.5, md: 1.75 } }}>
      <CardTitle icon={<SmartButtonOutlinedIcon />} tint={on ? "green" : "slate"} title="APSOassistant on the search bar"
        note={on ? "The AI button at the right of the shop's search bar opens APSOassistant." : "The AI button is hidden: customers cannot open APSOassistant from the bar."}
        right={
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            {busy && <CircularProgress size={14} />}
            <Chip tint={on ? "green" : "slate"}>{on ? "On the bar" : "Hidden"}</Chip>
            <Switch checked={on} disabled={!s.isAdmin || busy || s.switches.killSwitch} onChange={(e) => void flip(e.target.checked)}
              slotProps={{ input: { "aria-label": "AI button on the search bar" } }} />
          </Box>
        } />
      {s.switches.killSwitch && <Notice tone="warn">The whole search bar is switched off (Search bar &gt; Setup), so the AI button is not on the shop either.</Notice>}
      {!s.isAdmin && <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>Only an admin can switch it.</Typography>}
      {msg && (msg.ok ? <Typography sx={{ fontSize: "0.8rem", color: GREEN }}>{msg.text}</Typography> : <Notice tone="bad">{msg.text}</Notice>)}
    </GlassCard>
  );
}
