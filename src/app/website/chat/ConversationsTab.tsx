"use client";

// APSOassistant Chat > Conversations and > Hand-overs, as an inbox (SARCLA 18.10.2026: "the UX of the chat should be
// massively improved"). The list: what the customer wanted (the one-line summary the hub filed after the chat - Topics),
// its topic, who handled it, and a red edge when a chat went to a person and no person wrote in it. The open chat: who
// the customer is, the hand-over in one line (when the AI let go, who took it, after how long, whether a person wrote),
// the topic - put right here if wrong - and the whole conversation as HubSpot holds it. A chat without a ticket falls
// back to the orchestrator's memory (its last 10 messages, while it keeps them).

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { Chip, Choice } from "@/app/connectors/parts";
import { FAINT, HsLink, INK, MUTED, Notice } from "@/app/uc/report/ui";
import { categoryLabel, type Conversation, type ConversationDetail, type Conversations, type Transcript } from "@/lib/chat/shape";
import { HandlerChip, LANGUAGES, Loaded, category, when } from "./shared";
import { Bubbles, Inbox, Tag, type InboxItem } from "./inbox";
import { CategoryPick } from "./TopicsTab";

const PER = 30;

export default function ConversationsTab({ handedOnly }: { handedOnly: boolean }) {
  const [page, setPage] = useState(0);
  const [lang, setLang] = useState<string>("all");
  const [unanswered, setUnanswered] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const url = `/api/website/chat?part=conversations&limit=${PER}&offset=${page * PER}${handedOnly ? "&escalated=1" : ""}${lang !== "all" ? `&language=${lang}` : ""}`;
  const toolbar = (
    <Box sx={{ display: "grid", gap: 0.75 }}>
      <Choice value={lang} onChange={(k) => { setLang(k); setPage(0); setSelected(null); }}
        options={[{ key: "all", label: "All" }, ...LANGUAGES.map((l) => ({ key: l, label: l.toUpperCase() }))]} />
      {handedOnly && (
        <Choice value={unanswered ? "none" : "all"} onChange={(k) => setUnanswered(k === "none")}
          options={[{ key: "all", label: "All hand-overs" }, { key: "none", label: "No person wrote in the chat" }]} />
      )}
    </Box>
  );
  return (
    <Loaded<Conversations> key={url} url={url} what="the conversations">
      {(r, reload) => (
        <>
          {r.unit === "messages" && <Notice tone="warn">One row per message until the orchestrator has its update: a chat appears once for each of its messages.</Notice>}
          <List r={r} search={search} unanswered={unanswered} selected={selected} setSelected={setSelected} toolbar={toolbar}
            page={page} setPage={(p) => { setPage(p); setSelected(null); }} onSearch={setSearch} reload={reload}
            empty={handedOnly ? "No hand-overs here." : "No chats here."} />
        </>
      )}
    </Loaded>
  );
}

function List({ r, search, unanswered, selected, setSelected, toolbar, page, setPage, onSearch, reload, empty }: {
  r: Conversations; search: string; unanswered: boolean; selected: string | null; setSelected: (s: string | null) => void;
  toolbar: React.ReactNode; page: number; setPage: (p: number) => void; onSearch: (s: string) => void; reload: () => void; empty: string;
}) {
  const chats = useMemo(() => {
    const q = search.trim().toLowerCase();
    return r.conversations.filter((c) => (!unanswered || c.agent_wrote === false)
      && (!q || [c.summary, c.category_code, c.sub_l1, c.topic && categoryLabel(c.topic), c.topic_sub1].some((x) => x && x.toLowerCase().includes(q))));
  }, [r.conversations, search, unanswered]);
  const items: InboxItem[] = chats.map((c) => ({
    id: c.session_hash,
    // what the customer wanted (the hub's summary), else the chat's own category - never a promise of a filing to come
    title: c.summary || (c.category_code && c.category_code !== "Others" ? `${category(c.category_code)}${c.sub_l1 ? ` · ${c.sub_l1}` : ""}` : "A chat"),
    preview: null,
    at: c.last_at ?? c.started_at,
    lang: c.language_code,
    flag: c.escalated && c.agent_wrote === false,
    badges: (
      <>
        <HandlerChip c={c} />
        {c.topic && c.topic !== "unreadable" && <Tag tint="amber" title={c.topic_sub1 ? `${c.topic} · ${c.topic_sub1}` : c.topic}>{c.topic}{c.topic_sub1 ? ` · ${c.topic_sub1}` : ""}</Tag>}
        {c.escalated && c.agent_wrote === false && <Chip tint="pink">No person wrote in the chat</Chip>}
        <Box component="span" sx={{ fontSize: "0.7rem", color: FAINT, alignSelf: "center" }}>{c.messages ?? c.turns_count} {(c.messages ?? c.turns_count) === 1 ? "message" : "messages"}</Box>
      </>
    ),
  }));
  const open = r.conversations.find((c) => c.session_hash === selected) ?? null;
  return (
    <Inbox items={items} selected={selected} onSelect={setSelected} toolbar={toolbar} search={search} onSearch={onSearch}
      total={r.total} page={page} per={PER} onPage={setPage} empty={empty}
      detail={open ? <Detail key={open.session_hash} c={open} onMoved={reload} /> : null} />
  );
}

/* ── one topic's chats (the topic tabs, SARCLA 27.10.2026: "conversations should appear on each tab for each topic") ── */

/** a chat as the hub filed it (src/lib/chat/topics.ts) */
type FiledChat = {
  key: string; ref: string; ticket_id: string | null; started_at: string | null; last_at: string | null; language: string | null;
  handed: boolean; team: string | null; agent_wrote: boolean | null; category: string; sub1: string | null; sub2: string | null; summary: string; by: string;
};
/** the filed chat in the shape the open-chat view reads */
const asConversation = (f: FiledChat): Conversation => ({
  id: 0, session_hash: f.ref, hubspot_contact_id: null, language_code: f.language, category_code: f.category, sub_l1: f.sub1, sub_l2: f.sub2,
  routing_team: f.team, escalated: f.handed, escalation_reason: null, hubspot_ticket_id: f.ticket_id, turns_count: 0,
  started_at: f.started_at ?? "", last_at: f.last_at ?? undefined, topic: f.category, topic_sub1: f.sub1, summary: f.summary,
  agent_wrote: f.agent_wrote, by: f.by, filing_key: f.key,
});

/** HubSpot's chats of one Enquiry Category in the period - all, or only the ones handed to a person. */
export function TopicConversations({ topic, days }: { topic: string; days: number }) {
  const [page, setPage] = useState(0);
  const [handed, setHanded] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const url = `/api/website/chat?part=topic-chats&channel=hs&topic=${encodeURIComponent(topic)}&days=${days}&limit=${PER}&offset=${page * PER}${handed ? "&handed=1" : ""}`;
  return (
    <Loaded<{ chats: FiledChat[]; total: number }> key={url} url={url} what="the conversations">
      {(r, reload) => {
        const q = search.trim().toLowerCase();
        const list = r.chats.map(asConversation).filter((c) => !q || [c.summary, c.topic_sub1, c.sub_l2].some((x) => x && x.toLowerCase().includes(q)));
        const items: InboxItem[] = list.map((c) => ({
          id: c.session_hash, title: c.summary || categoryLabel(c.topic), at: c.last_at ?? c.started_at, lang: c.language_code,
          flag: c.escalated && c.agent_wrote === false,
          badges: (
            <>
              <HandlerChip c={c} />
              {c.topic_sub1 && <Tag tint="amber" title={c.sub_l2 ? `${c.topic_sub1} · ${c.sub_l2}` : c.topic_sub1}>{c.topic_sub1}</Tag>}
              {c.escalated && c.agent_wrote === false && <Chip tint="pink">No person wrote in the chat</Chip>}
            </>
          ),
        }));
        const open = list.find((c) => c.session_hash === selected) ?? null;
        return (
          <Inbox items={items} selected={selected} onSelect={setSelected} search={search} onSearch={setSearch}
            total={r.total} page={page} per={PER} onPage={(p) => { setPage(p); setSelected(null); }}
            empty={handed ? "No hand-over on this topic in the period." : "No chat on this topic in the period."}
            toolbar={<Choice value={handed ? "handed" : "all"} onChange={(k) => { setHanded(k === "handed"); setPage(0); setSelected(null); }}
              options={[{ key: "all", label: "All chats" }, { key: "handed", label: "Handed to a person" }]} />}
            detail={open ? <Detail key={open.session_hash} c={open} onMoved={reload} /> : null} />
        );
      }}
    </Loaded>
  );
}

/* ── the open chat ──────────────────────────────────────────────────────────────────────────────── */

const mins = (a: string | null, b: string | null) => (a && b ? (Date.parse(b) - Date.parse(a)) / 60_000 : null);
function span(m: number | null): string {
  if (m == null) return "–";
  if (m < 1) return `${Math.max(1, Math.round(m * 60))} s`;
  if (m < 60) return `${Math.round(m)} min`;
  const h = Math.floor(m / 60);
  return h < 48 ? `${h} h ${Math.round(m % 60)} min` : `${Math.round(h / 24)} days`;
}

function Detail({ c, onMoved }: { c: Conversation; onMoved: () => void }) {
  return (
    <Box sx={{ display: "grid", gap: 1.5 }}>
      {c.hubspot_ticket_id ? (
        <Loaded<{ transcript: Transcript | null }> url={`/api/website/chat?part=transcript&ticket=${c.hubspot_ticket_id}`} what="the chat from HubSpot">
          {(d) => d.transcript ? <WholeChat t={d.transcript} c={c} onMoved={onMoved} /> : <FromMemory c={c} note="HubSpot no longer holds this chat - its ticket was deleted or merged." />}
        </Loaded>
      ) : <FromMemory c={c} note="This chat has no ticket, so HubSpot cannot be asked." />}
      <AiNotes raw={c.debug_log} />
    </Box>
  );
}

function WholeChat({ t, c, onMoved }: { t: Transcript; c: Conversation; onMoved: () => void }) {
  const customer = t.items.find((m) => m.who === "customer")?.name;
  const handed = !!t.handedAt;
  return (
    <>
      {/* who, when, where */}
      <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", flexWrap: "wrap" }}>
        <Box sx={{ flex: "1 1 260px", minWidth: 0 }}>
          <Typography sx={{ fontSize: "1.02rem", fontWeight: 700, color: INK, lineHeight: 1.3 }}>{c.summary || customer || "A customer"}</Typography>
          <Typography sx={{ fontSize: "0.78rem", color: MUTED, mt: 0.25 }}>
            {customer ?? "Customer"} · {(c.language_code || "?").toUpperCase()} · {when(t.openedAt ?? c.started_at)}{t.closedAt ? ` - closed ${when(t.closedAt).slice(11)}` : " - open"}{t.inbox ? ` · ${t.inbox}` : ""}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1.25, alignItems: "center" }}>
          {c.hubspot_ticket_id && <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, fontSize: "0.78rem", color: MUTED }}>Ticket <HsLink id={c.hubspot_ticket_id} /></Box>}
          <Box component="a" href={t.link} target="_blank" rel="noreferrer"
            sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, fontSize: "0.8rem", fontWeight: 600, color: "#2459d1", textDecoration: "none" }}>
            Open in HubSpot <OpenInNewIcon sx={{ fontSize: 14 }} />
          </Box>
        </Box>
      </Box>

      {/* the hand-over in one line, and the topic */}
      <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center", p: 1.25, borderRadius: "14px", bgcolor: handed ? "rgba(169,106,18,.06)" : "rgba(21,34,58,.03)" }}>
        {handed ? (
          <>
            <Chip tint="amber">AI let go {when(t.handedAt!).slice(11)}{c.routing_team ? ` · ${c.routing_team.replace(/_/g, " ")}` : ""}</Chip>
            {t.agent ? <Chip tint="blue">Taken by {t.agent.name ?? "an agent"} after {span(mins(t.handedAt, t.agent.at))}</Chip> : <Chip tint="pink">Nobody took it</Chip>}
            {t.agentMessages
              ? <Chip tint="green">A person wrote {t.agentMessages}×, first after {span(mins(t.handedAt, t.agentFirstReplyAt))}</Chip>
              : <Chip tint="pink">No person wrote in the chat</Chip>}
          </>
        ) : t.agentMessages ? <Chip tint="green">A person joined ({t.agentMessages} messages)</Chip> : <Chip tint="slate">The AI alone</Chip>}
        <Box sx={{ ml: "auto", minWidth: 200 }}>
          {c.topic && c.filing_key
            ? <CategoryPick c={{ key: c.filing_key, category: c.topic, sub1: c.topic_sub1 ?? null, by: c.by ?? "ai" }} onMoved={onMoved} />
            : <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>Enquiry Category: not filed yet</Typography>}
        </Box>
      </Box>

      <Bubbles items={t.items} />
    </>
  );
}

function FromMemory({ c, note }: { c: Conversation; note: string }) {
  return (
    <Loaded<ConversationDetail> url={`/api/website/chat?part=conversation&hash=${c.session_hash}`} what="the messages">
      {(d) => {
        const turns = d.session?.turns ?? [];
        if (!turns.length) return <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>{note} The AI&apos;s memory no longer holds it either (it keeps a chat&apos;s last 10 messages for a while).</Typography>;
        return (
          <>
            <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>{note} From the AI&apos;s memory - the last {turns.length} messages:</Typography>
            <Bubbles noTimes items={turns.map((t) => ({ at: c.last_at ?? c.started_at, who: t.role === "user" ? "customer" : "ai", name: null, text: t.content ?? t.text ?? "" }))} />
          </>
        );
      }}
    </Loaded>
  );
}

/** What the AI noted on the chat's last turn (its debug log): folded away, for checking a decision. */
/** No customer data on screen: e-mail addresses, phone numbers and contact ids are hidden in the AI's notes
 *  (the review of 26.10.2026 found e-mails in the raw log). */
const scrub = (s: string) => s
  .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[e-mail]")
  .replace(/\+\d[\d\s/-]{7,}\d/g, "[phone]").replace(/\b0\d{2}[ /]\d{3} ?\d{2} ?\d{2}\b/g, "[phone]")
  .replace(/\bContact \d+/g, "A contact").replace(/\bcontact \d+/g, "a contact");

const ROUTE_WORD: Record<string, string> = { tsa: "TSA", bo: "Back Office", ecom: "E-Commerce", none: "no topic", TSA: "TSA", BO: "Back Office", AI: "the AI alone" };
/** What the AI's notes say about where the chat went and why, in a few words. */
function why(notes: string[]): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  const upd = [...notes].reverse().find((n) => /^Updating ticket .*handler=/.test(n));
  const field = (n: string | undefined, k: string) => n?.match(new RegExp(`${k}=([^|]*)`))?.[1]?.trim() || null;
  const cat = field(upd, "category"), sub = field(upd, "sub_l1"), handler = field(upd, "handler");
  if (cat) out.push({ label: "Filed as", value: sub ? `${cat} · ${sub}` : cat });
  if (handler) out.push({ label: "Went to", value: ROUTE_WORD[handler] ?? handler });
  const order = notes.find((n) => /^Handler: BO \(order number present/.test(n));
  if (order) out.push({ label: "Why", value: "an order number in the chat - always the Back Office" });
  else if (handler && handler !== "AI" && field(upd, "routing_team")) out.push({ label: "Why", value: `the AI's team: ${field(upd, "routing_team")!.replace(/_/g, " ")}` });
  const steer = notes.find((n) => /^Steering \(shadow/.test(n))?.match(/routes v(\d+)\): (\w+)/);
  if (steer) out.push({ label: "With the topic routes", value: `${ROUTE_WORD[steer[2]] ?? steer[2]} (routes v${steer[1]}, trial)` });
  if (notes.some((n) => /^Hand-over held: no category/.test(n))) out.push({ label: "Before handing over", value: "asked what it is about" });
  if (notes.some((n) => /^Email check: NONE \| escalate=true/.test(n))) out.push({ label: "Before handing over", value: "asked for an e-mail address" });
  return out;
}

function AiNotes({ raw }: { raw: string | null | undefined }) {
  const [open, setOpen] = useState(false);
  const notes = debugNotes(raw).map(scrub);
  if (!notes.length) return null;
  const facts = why(notes);
  return (
    <Box sx={{ borderTop: "1px dashed rgba(21,34,58,.12)", pt: 1, display: "grid", gap: 0.75 }}>
      {facts.length > 0 && (
        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
          <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.05em", mr: 0.5 }}>Why it went there</Typography>
          {facts.map((f, i) => <Chip key={i} tint={f.label === "Went to" ? "blue" : f.label.startsWith("With") ? "amber" : "slate"}>{f.label}: {f.value}</Chip>)}
        </Box>
      )}
      <Typography component="button" onClick={() => setOpen((o) => !o)}
        sx={{ border: 0, bgcolor: "transparent", p: 0, cursor: "pointer", fontSize: "0.72rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.05em", justifySelf: "start" }}>
        {open ? "▾" : "▸"} The AI&apos;s own notes on the last turn ({notes.length})
      </Typography>
      {open && (
        <Box component="ul" sx={{ m: 0, pl: 2.5, fontSize: "0.78rem", color: MUTED, display: "grid", gap: 0.25 }}>
          {notes.slice(0, 40).map((n, i) => <li key={i}>{n}</li>)}
        </Box>
      )}
    </Box>
  );
}

/** The orchestrator keeps its turn notes as a JSON list of strings (or objects); anything else reads as one line. */
function debugNotes(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : JSON.stringify(x))) : [String(raw)];
  } catch { return [String(raw)]; }
}
