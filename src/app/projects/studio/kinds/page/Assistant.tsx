"use client";
// THE PAGE STUDIO'S ASSISTANT (08.11.2026). SARCLA: "translate in the assistant should also be an option: translate the
// complete page into another language". The quick asks for a page (write it, more convincing, shorter, translate into
// each language, the search engine fields), a free ask, and - when an element is selected in the preview - the same
// for that element alone. Every change it makes is listed with an Undo (it puts the page back as it was before that
// change, and before every later one).

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import UndoIcon from "@mui/icons-material/Undo";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import type { PageDoc } from "@/lib/content/studio/kinds/page/model";
import { AssistantPanel, PINK, btn, type QuickAsk } from "../../parts";
import { Chip, useCopy } from "./ui";

export type Entry = { id: number; label: string; note?: string; at: number; lang: string; before: PageDoc; undone: boolean; by: "ai" | "you" };
export type Idea = { title: string; why: string; change: string };
export type SeoCard = { title: string; description: string; urlKey: string };

const ago = (t: number) => { const s = Math.round((Date.now() - t) / 1000); return s < 60 ? "just now" : s < 3600 ? `${Math.round(s / 60)} min ago` : `${Math.round(s / 3600)} h ago`; };

export function Assistant({ quick, onAsk, enabled, context, onClearContext, history, onUndo, ideas, onIdea, seo, onUseSeo, inputRef, placeholder, lang }: {
  quick: QuickAsk[]; onAsk: (text: string) => Promise<string | null>; enabled: boolean;
  context: string | null; onClearContext: () => void;
  history: Entry[]; onUndo: (e: Entry) => void;
  ideas: Idea[]; onIdea: (i: Idea) => void;
  seo: SeoCard | null; onUseSeo: (s: SeoCard) => void;
  inputRef: React.Ref<HTMLTextAreaElement>; placeholder: string; lang: string;
}) {
  const { done, copy } = useCopy();
  const top = (
    <Box sx={{ mb: 1.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: context ? 1 : 0 }}>
        <Typography sx={{ fontSize: "0.76rem", color: MUTED, flex: 1 }}>Works on</Typography>
        <Chip tint="blue">{lang.toUpperCase()}</Chip>
      </Box>
      {context ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1, pl: 1.25, borderRadius: "8px", bgcolor: "rgba(194,44,110,.07)", border: "1px solid rgba(194,44,110,.25)" }}>
          <Box sx={{ width: 3, alignSelf: "stretch", borderRadius: 2, bgcolor: PINK }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: PINK }}>This element only</Typography>
            <Typography sx={{ fontSize: "0.84rem", color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{context}</Typography>
          </Box>
          <Tooltip title="The whole page again"><IconButton size="small" onClick={onClearContext}><CloseIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
        </Box>
      ) : (
        <Typography sx={{ fontSize: "0.84rem", color: INK, fontWeight: 600 }}>The whole page <Box component="span" sx={{ color: MUTED, fontWeight: 400 }}>· select an element in the preview to work on it alone</Box></Typography>
      )}
    </Box>
  );
  return (
    <AssistantPanel quick={quick} enabled={enabled} onAsk={onAsk} placeholder={placeholder} top={top} inputRef={inputRef}>
      {seo && (
        <Box sx={{ mt: 2, p: 1.5, borderRadius: "10px", bgcolor: "#fff", border: `1px solid ${HAIRLINE}` }}>
          <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: MUTED, mb: 0.75 }}>Search engine fields</Typography>
          {([["Meta title", seo.title], ["Meta description", seo.description], ["URL key", seo.urlKey]] as const).map(([k, v]) => (
            <Box key={k} sx={{ mb: 0.75 }}>
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <Typography sx={{ fontSize: "0.74rem", color: MUTED, flex: 1 }}>{k} · {v.length}</Typography>
                <IconButton size="small" onClick={() => void copy(k, v)} aria-label={`Copy the ${k}`}><ContentCopyIcon sx={{ fontSize: 14, color: done === k ? "#1b7a55" : MUTED }} /></IconButton>
              </Box>
              <Typography sx={{ fontSize: "0.84rem", color: INK }}>{v}</Typography>
            </Box>
          ))}
          <Button size="small" onClick={() => onUseSeo(seo)} sx={{ ...btn, color: PINK, px: 0 }}>Keep them for Magento</Button>
        </Box>
      )}
      {ideas.length > 0 && (
        <Box sx={{ mt: 2 }}>
          {ideas.map((i) => (
            <Box key={i.title} sx={{ p: 1.5, mb: 1, borderRadius: "10px", bgcolor: "#fff", border: `1px solid ${HAIRLINE}` }}>
              <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>{i.title}</Typography>
              <Typography sx={{ fontSize: "0.8rem", color: INK, mt: 0.5 }}>{i.change}</Typography>
              <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 0.5 }}>{i.why}</Typography>
              <Button size="small" disabled={!enabled} onClick={() => onIdea(i)} sx={{ ...btn, mt: 0.5, px: 0, color: PINK }}>Make it</Button>
            </Box>
          ))}
        </Box>
      )}
      {history.length > 0 && (
        <Box sx={{ mt: 2.5 }}>
          <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: MUTED, mb: 0.75 }}>Changes made here</Typography>
          {history.map((e) => (
            <Box key={e.id} sx={{ display: "flex", gap: 1, alignItems: "flex-start", py: 0.9, borderTop: `1px solid ${HAIRLINE}`, opacity: e.undone ? 0.45 : 1 }}>
              <Box sx={{ mt: 0.6, width: 7, height: 7, borderRadius: "2px", bgcolor: e.by === "ai" ? PINK : "#2459d1", flexShrink: 0 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.83rem", color: INK, fontWeight: 600, textDecoration: e.undone ? "line-through" : "none" }}>{e.label}</Typography>
                {e.note && <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{e.note}</Typography>}
                <Typography sx={{ fontSize: "0.7rem", color: MUTED }}>{e.lang.toUpperCase()} · {ago(e.at)}{e.undone ? " · undone" : ""}</Typography>
              </Box>
              {!e.undone && (
                <Tooltip title="Put the page back as it was before this (and every later change)">
                  <Button size="small" onClick={() => onUndo(e)} startIcon={<UndoIcon sx={{ fontSize: 15 }} />} sx={{ ...btn, color: INK, minWidth: 0, px: 1 }}>Undo</Button>
                </Tooltip>
              )}
            </Box>
          ))}
        </Box>
      )}
    </AssistantPanel>
  );
}
