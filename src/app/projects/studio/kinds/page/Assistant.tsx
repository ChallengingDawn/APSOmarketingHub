"use client";
// THE PAGE STUDIO'S ASSISTANT (08.11.2026). SARCLA: "translate in the assistant should also be an option: translate the
// complete page into another language" - into every language the shop has (that evening: "all locales: NL, PL"), as one
// row of languages, not a button each. The quick asks for a page (write it, more convincing, shorter, the search engine
// fields), a free ask, and - when an element is selected in the preview - the same
// for that element alone. Every change it makes is listed with an Undo (it puts the page back as it was before that
// change, and before every later one) - since Content v7 in the bar's timeline, not here (SARCLA 10.11.2026: "bring it
// inside a small icon on top" - ../../frame.tsx).

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import TranslateOutlinedIcon from "@mui/icons-material/TranslateOutlined";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import type { PageDoc, StoreGroup } from "@/lib/content/studio/kinds/page/model";
import { AssistantPanel, PINK, btn, type QuickAsk } from "../../parts";
import { Chip, useCopy } from "./ui";
import { TranslateMany } from "./MakeViews";

export type Entry = { id: number; label: string; note?: string; at: number; lang: string; before: PageDoc; undone: boolean; by: "ai" | "you";
  /** the check after applying (Content v6): "Looks wrong - not applied: ..." */
  warn?: string;
  /** the change the AI made (Content v7): its line says when the page does not show it */
  change?: string };
export type Idea = { title: string; why: string; change: string };
export type SeoCard = { title: string; description: string; urlKey: string };
/** What a part of the page says, in English - to read it (Content v5), never a change */
export type Said = { scope: string; items: { label: string; text: string }[] };

/** "What does it say? (in English)": the English words in a card to read - copy, close. The page does not change. */
function SaidCard({ said, onClose }: { said: Said; onClose: () => void }) {
  const { done, copy } = useCopy();
  const all = said.items.map((x) => (x.label ? `${x.label}: ${x.text}` : x.text)).join("\n\n");
  return (
    <Box data-said sx={{ mt: 2, borderRadius: "10px", bgcolor: "#fff", border: "1px solid rgba(36,89,209,.28)", boxShadow: "0 6px 18px rgba(31,45,78,.07)", overflow: "hidden" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 1.5, py: 0.9, bgcolor: "rgba(36,89,209,.05)", borderBottom: `1px solid ${HAIRLINE}` }}>
        <TranslateOutlinedIcon sx={{ fontSize: 16, color: "#2459d1" }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#2459d1" }}>In English · to read</Typography>
          <Typography sx={{ fontSize: "0.78rem", color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{said.scope} · the page is not changed</Typography>
        </Box>
        <Tooltip title={done === "said" ? "Copied" : "Copy the English words"}><IconButton size="small" onClick={() => void copy("said", all)} aria-label="Copy the English words"><ContentCopyIcon sx={{ fontSize: 15, color: done === "said" ? "#1b7a55" : MUTED }} /></IconButton></Tooltip>
        <Tooltip title="Close"><IconButton size="small" onClick={onClose} aria-label="Close the English words"><CloseIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
      </Box>
      <Box sx={{ px: 1.5, py: 1.1, maxHeight: 340, overflowY: "auto" }}>
        {said.items.map((x, i) => (
          <Box key={i} sx={{ mb: i < said.items.length - 1 ? 1 : 0 }}>
            {x.label && <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: MUTED }}>{x.label}</Typography>}
            <Typography sx={{ fontSize: "0.84rem", color: INK, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{x.text}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export function Assistant({ quick, onAsk, enabled, context, contextKind, onClearContext, ideas, onIdea, seo, onUseSeo, inputRef, placeholder, lang, translate, said, onCloseSaid, plan, bare }: {
  quick: QuickAsk[]; onAsk: (text: string) => Promise<string | null>; enabled: boolean;
  context: string | null; onClearContext: () => void;
  /** what the selection is: "This element only" (the default), "This part only" */
  contextKind?: string;
  ideas: Idea[]; onIdea: (i: Idea) => void;
  seo: SeoCard | null; onUseSeo: (s: SeoCard) => void;
  inputRef: React.Ref<HTMLTextAreaElement>; placeholder: string; lang: string;
  /** the main store view shown: translating the whole page into the store views of the shop's other languages */
  translate: { doc: PageDoc; groups: StoreGroup[]; busy: string | null; onTranslate: (l: string) => Promise<string | null> } | null;
  /** what the selection says in English, to read (Content v5) */
  said?: Said | null; onCloseSaid?: () => void;
  /** the AI's plan of modules (Content v7, ./plan/PlanCard.tsx) */
  plan?: React.ReactNode;
  /** inside the side bar's tabs (Content v7, builder B: "Assistant | Modules") - no frame of its own */
  bare?: boolean;
}) {
  const { done, copy } = useCopy();
  const top = (
    <Box sx={{ mb: 1.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: context ? 1 : 0 }}>
        <Typography sx={{ fontSize: "0.76rem", color: MUTED, flex: 1 }}>Working on</Typography>
        <Chip tint="blue">{lang}</Chip>
      </Box>
      {context ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1, pl: 1.25, borderRadius: "8px", bgcolor: "rgba(194,44,110,.07)", border: "1px solid rgba(194,44,110,.25)" }}>
          <Box sx={{ width: 3, alignSelf: "stretch", borderRadius: 2, bgcolor: PINK }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: PINK }}>{contextKind ?? "This element only"}</Typography>
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
    <AssistantPanel quick={quick} enabled={enabled} onAsk={onAsk} placeholder={placeholder} top={top} inputRef={inputRef} bare={bare}>
      {plan}
      {said && <SaidCard said={said} onClose={() => onCloseSaid?.()} />}
      {/* tick several (Content v7, SARCLA 10.11.2026: "multiselect store view") - ./MakeViews.tsx */}
      {translate && !context && <TranslateMany doc={translate.doc} groups={translate.groups} enabled={enabled} />}
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
    </AssistantPanel>
  );
}
