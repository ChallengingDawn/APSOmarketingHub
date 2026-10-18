"use client";

// APSOassistant Chat: the inbox every chat list of the page uses (SARCLA 18.10.2026: "the UX of the chat should be
// massively improved"). The list on the left - what each chat was about in one line, when, in which language, who
// handled it - and the open chat on the right, read like a messenger. On a phone the list comes first and a chat
// opens over it, with a way back. Used by Conversations, Hand-overs and Search bar chat.

import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import SearchIcon from "@mui/icons-material/Search";
import { full } from "@/app/charts/format";
import { FAINT, HAIRLINE, INK, MUTED, TINT, glass } from "@/app/uc/report/ui";
import type { TranscriptItem } from "@/lib/chat/shape";
import { when } from "./shared";

export type InboxItem = {
  id: string;
  /** one line: what the chat was about */
  title: string;
  /** up to two lines under it */
  preview?: string | null;
  at: string;
  lang?: string | null;
  /** the chips under the text: who handled it, its topic, a warning */
  badges?: React.ReactNode;
  /** a red edge: something to look at (a hand-over nobody answered) */
  flag?: boolean;
};

/** "20:42" today, "Yesterday", "Thu" this week, "12.10" before. */
function shortWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86_400_000);
  if (diff === 0) return when(iso).slice(11);
  if (diff === 1) return "Yesterday";
  if (diff < 7) return d.toLocaleDateString("en-GB", { weekday: "short" });
  return when(iso).slice(0, 5);
}

export function Inbox({ items, selected, onSelect, toolbar, total, page, per, onPage, detail, empty, search, onSearch }: {
  items: InboxItem[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  toolbar?: React.ReactNode;
  /** server-side pages: the whole count, this page, its size */
  total?: number; page?: number; per?: number; onPage?: (p: number) => void;
  detail: React.ReactNode;
  empty?: string;
  search?: string; onSearch?: (s: string) => void;
}) {
  const pages = total != null && per ? Math.max(1, Math.ceil(total / per)) : 1;
  return (
    <Box sx={{ ...glass, borderRadius: "22px", overflow: "hidden", minWidth: 0,
      display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(300px, 380px) minmax(0, 1fr)" }, height: { md: "min(78vh, 900px)" } }}>
      {/* the list */}
      <Box sx={{ display: { xs: selected ? "none" : "flex", md: "flex" }, flexDirection: "column", minHeight: 0, borderRight: { md: `1px solid ${HAIRLINE}` } }}>
        <Box sx={{ p: 1.5, display: "grid", gap: 1, borderBottom: `1px solid ${HAIRLINE}` }}>
          {onSearch && (
            <TextField size="small" placeholder="Search this page…" value={search ?? ""} onChange={(e) => onSearch(e.target.value)}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: FAINT }} /></InputAdornment> },
                htmlInput: { "aria-label": "Search the chats" } }} />
          )}
          {toolbar}
        </Box>
        <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", maxHeight: { xs: "70vh", md: "none" } }} role="list">
          {!items.length && <Typography sx={{ p: 2, fontSize: "0.84rem", color: MUTED }}>{empty ?? "No chats here."}</Typography>}
          {items.map((it) => {
            const on = it.id === selected;
            return (
              <ButtonBase key={it.id} role="listitem" onClick={() => onSelect(on ? null : it.id)} aria-current={on || undefined}
                sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 0.4, width: "100%", minWidth: 0, textAlign: "left", px: 1.75, py: 1.25, borderBottom: `1px solid ${HAIRLINE}`,
                  borderLeft: `3px solid ${on ? "#2459d1" : it.flag ? "#e8a3b8" : "transparent"}`, bgcolor: on ? "rgba(36,89,209,.07)" : "transparent",
                  "&:hover": { bgcolor: on ? "rgba(36,89,209,.09)" : "rgba(21,34,58,.03)" } }}>
                <Box sx={{ display: "flex", gap: 1, alignItems: "baseline", minWidth: 0 }}>
                  {it.lang && <Box component="span" sx={{ flexShrink: 0, fontSize: "0.66rem", fontWeight: 800, color: MUTED, border: `1px solid ${HAIRLINE}`, borderRadius: "6px", px: 0.5, lineHeight: 1.5 }}>{it.lang.toUpperCase()}</Box>}
                  <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.86rem", fontWeight: 650, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.title}</Typography>
                  <Typography sx={{ flexShrink: 0, fontSize: "0.72rem", color: FAINT }}>{shortWhen(it.at)}</Typography>
                </Box>
                {it.preview && (
                  <Typography sx={{ fontSize: "0.79rem", color: MUTED, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{it.preview}</Typography>
                )}
                {it.badges && <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.25, minWidth: 0 }}>{it.badges}</Box>}
              </ButtonBase>
            );
          })}
        </Box>
        {onPage && total != null && total > (per ?? 0) && (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 1.5, py: 0.75, borderTop: `1px solid ${HAIRLINE}` }}>
            <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{full((page ?? 0) * (per ?? 0) + 1)}-{full(Math.min(total, ((page ?? 0) + 1) * (per ?? 0)))} of {full(total)}</Typography>
            <Box>
              <IconButton size="small" aria-label="Newer" disabled={(page ?? 0) <= 0} onClick={() => onPage((page ?? 0) - 1)}><ChevronLeftIcon fontSize="small" /></IconButton>
              <IconButton size="small" aria-label="Older" disabled={(page ?? 0) >= pages - 1} onClick={() => onPage((page ?? 0) + 1)}><ChevronRightIcon fontSize="small" /></IconButton>
            </Box>
          </Box>
        )}
      </Box>

      {/* the open chat */}
      <Box sx={{ display: { xs: selected ? "block" : "none", md: "block" }, minHeight: 0, overflowY: "auto", p: { xs: 1.5, md: 2.25 } }}>
        {selected && (
          <ButtonBase onClick={() => onSelect(null)} sx={{ display: { xs: "inline-flex", md: "none" }, gap: 0.5, mb: 1, fontSize: "0.82rem", fontWeight: 600, color: "#2459d1" }}>
            <ArrowBackIcon sx={{ fontSize: 16 }} /> All chats
          </ButtonBase>
        )}
        {selected ? detail : (
          <Box sx={{ height: "100%", minHeight: 240, display: "grid", placeItems: "center", textAlign: "center", color: FAINT }}>
            <Box>
              <ForumOutlinedIcon sx={{ fontSize: 40, opacity: 0.5 }} />
              <Typography sx={{ fontSize: "0.86rem", mt: 1 }}>Pick a chat on the left to read it.</Typography>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}

/* ── a chat, read like a messenger ──────────────────────────────────────────────────────────────── */

export const clock = (iso: string) => when(iso).slice(11);
const dayOf = (iso: string) => when(iso).slice(0, 10);

const STYLE: Record<TranscriptItem["who"], { bg: string; fg: string; label: string; right: boolean }> = {
  customer: { bg: "#ffffff", fg: MUTED, label: "Customer", right: false },
  ai: { bg: "#f1ecfd", fg: "#6a46c9", label: "APSOassistant", right: true },
  agent: { bg: "#e7f6ee", fg: "#1b7a55", label: "Agent", right: true },
  system: { bg: "transparent", fg: FAINT, label: "", right: false },
};

/** Messages in order: the customer on the left, APSOassistant and the agents on the right, events in between. */
export function Bubbles({ items, noTimes }: { items: TranscriptItem[]; noTimes?: boolean }) {
  if (!items.length) return <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>No messages in this chat.</Typography>;
  return (
    <Box sx={{ display: "grid", gap: 0.9, pr: 0.5 }}>
      {items.map((m, i) => {
        const newDay = !noTimes && (i === 0 || dayOf(items[i - 1].at) !== dayOf(m.at));
        const st = STYLE[m.who];
        const sameAsBefore = i > 0 && items[i - 1].who === m.who && items[i - 1].name === m.name;
        return (
          <Box key={i} sx={{ display: "contents" }}>
            {newDay && <Typography sx={{ justifySelf: "center", fontSize: "0.7rem", fontWeight: 700, color: FAINT, letterSpacing: "0.04em", mt: i ? 0.5 : 0 }}>{dayOf(m.at)}</Typography>}
            {m.who === "system" ? (
              <Typography sx={{ justifySelf: "center", fontSize: "0.74rem", color: MUTED, bgcolor: "rgba(21,34,58,.04)", px: 1.25, py: 0.3, borderRadius: "999px" }}>
                {m.text}{noTimes ? "" : ` · ${clock(m.at)}`}
              </Typography>
            ) : (
              <Box sx={{ justifySelf: st.right ? "end" : "start", maxWidth: { xs: "92%", md: "78%" }, display: "grid", gap: 0.25 }}>
                {!sameAsBefore && (
                  <Typography sx={{ justifySelf: st.right ? "end" : "start", fontSize: "0.68rem", fontWeight: 700, color: st.fg, px: 0.5 }}>
                    {m.who === "agent" ? m.name ?? st.label : m.who === "customer" ? m.name ?? st.label : st.label}
                  </Typography>
                )}
                <Box sx={{ px: 1.4, py: 0.85, borderRadius: st.right ? "16px 16px 4px 16px" : "16px 16px 16px 4px", bgcolor: st.bg,
                  border: `1px solid ${m.who === "customer" ? HAIRLINE : "transparent"}`, boxShadow: m.who === "customer" ? "0 1px 2px rgba(31,45,78,.05)" : "none",
                  color: INK, fontSize: "0.85rem", lineHeight: 1.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                  {m.text}
                  {!noTimes && <Box component="span" sx={{ display: "block", textAlign: "right", fontSize: "0.66rem", color: FAINT, mt: 0.25 }}>{clock(m.at)}</Box>}
                </Box>
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

/** A chip for the list that shortens with "…" instead of widening the column (a sub-category can be 60 characters). */
export function Tag({ tint, children, title }: { tint: keyof typeof TINT; children: React.ReactNode; title?: string }) {
  const t = TINT[tint];
  return (
    <Box component="span" title={title} sx={{ display: "inline-block", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      verticalAlign: "bottom", px: 1, py: 0.2, borderRadius: "8px", bgcolor: t.bg, color: t.fg, fontSize: "0.72rem", fontWeight: 700 }}>
      {children}
    </Box>
  );
}
