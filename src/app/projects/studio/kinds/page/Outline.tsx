"use client";
// THE PAGE'S OUTLINE ON THE LEFT (SARCLA 08.11.2026, evening: "The UX and the Build on the left: can we improve it to be
// more fluid, subdivided"). One short list of the page's parts - each with its state (written, empty, a picture missing,
// being written) and a line of what it says. A click opens that part alone (smoothly; the others close) and selects it in
// the preview, which scrolls to it; a click in the preview opens its part here. While the AI writes, the parts it works
// on shimmer here and in the page - the person sees it working the moment they click.

import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import type { Fields } from "@/lib/content/studio/kinds/page/fields";
import type { Part } from "@/lib/content/studio/kinds/page/fill";
import { busyOf, partsOf, type PartInfo, type PartKey } from "@/lib/content/studio/kinds/page/outline";
import { PINK } from "../../parts";
import type { StudioApi } from "../../useStudio";
import { PartBody, SHEEN_BG, sheen, type FillRun, type PictureCtl } from "./Fields";

export type RowState = PartInfo["state"] | "busy" | "none";

const GREEN = "#1b7a55";
const AMBER = "#b7791f";

export function StateIcon({ state }: { state: RowState }) {
  if (state === "busy") return <CircularProgress size={15} thickness={5} sx={{ color: PINK, m: "1.5px" }} />;
  if (state === "written") return <CheckCircleIcon sx={{ fontSize: 18, color: GREEN }} />;
  if (state === "picture") return <ImageOutlinedIcon sx={{ fontSize: 18, color: AMBER }} />;
  if (state === "partly") return <Box sx={{ width: 14, height: 14, m: "2px", borderRadius: "50%", border: `2px solid ${AMBER}`, background: `linear-gradient(90deg, ${AMBER} 50%, transparent 50%)`, boxSizing: "border-box" }} />;
  if (state === "empty") return <Box sx={{ width: 14, height: 14, m: "2px", borderRadius: "50%", border: "1.5px solid #b9c3cf", boxSizing: "border-box" }} />;
  return <Box sx={{ width: 18 }} />;
}

/** One row of the outline: its state, name and a line of what it says; open, its body below - one open at a time. */
export function Row({ id, title, count, summary, state, open, onToggle, onAi, aiLabel, canAi, busyLabel, children, accent }: {
  id: string; title: string; count?: number | null; summary?: React.ReactNode; state: RowState; open: boolean; onToggle: () => void;
  onAi?: () => void; aiLabel?: string; canAi?: boolean;
  /** shown in place of the summary while the AI works on it */
  busyLabel?: string;
  children?: React.ReactNode;
  /** a row that is not a part of the page (the element selected, the languages) */
  accent?: "pink" | "blue";
}) {
  const busy = state === "busy";
  return (
    <Box data-row={id} sx={{ borderBottom: `1px solid ${HAIRLINE}`, "&:last-of-type": { borderBottom: "none" }, bgcolor: open ? "#fff" : "transparent", transition: "background-color .2s" }}>
      <Box role="button" tabIndex={0} aria-expanded={open} onClick={onToggle} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
        sx={{
          display: "flex", alignItems: "center", gap: 1.1, px: 1.5, py: 1.05, cursor: "pointer", position: "relative", outline: "none",
          "&:hover": { bgcolor: "rgba(21,34,58,.03)" }, "&:focus-visible": { boxShadow: `inset 0 0 0 2px ${PINK}` },
          "&:hover .ai": { opacity: 1 },
          ...(open ? { boxShadow: `inset 3px 0 0 ${accent === "blue" ? "#2459d1" : PINK}` } : {}),
          ...(busy ? { backgroundImage: SHEEN_BG, backgroundSize: "260% 100%", animation: `${sheen} 1.5s linear infinite` } : {}),
        }}>
        <StateIcon state={state} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.88rem", fontWeight: 700, color: INK, lineHeight: 1.3 }}>
            {title}{count ? <Box component="span" sx={{ color: MUTED, fontWeight: 600 }}> · {count}</Box> : null}
          </Typography>
          {(busy && busyLabel) ? <Typography sx={{ fontSize: "0.76rem", color: PINK, fontWeight: 600, lineHeight: 1.35 }}>{busyLabel}</Typography>
            : summary ? <Typography component="div" sx={{ fontSize: "0.76rem", color: MUTED, lineHeight: 1.35, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{summary}</Typography> : null}
        </Box>
        {onAi && (
          <Tooltip title={aiLabel ?? "Write it with AI"}>
            <span>
              <IconButton className="ai" size="small" disabled={!canAi || busy} onClick={(e) => { e.stopPropagation(); onAi(); }} aria-label={aiLabel ?? "Write it with AI"}
                sx={{ color: PINK, opacity: { xs: 1, md: open ? 1 : 0.55 }, transition: "opacity .15s" }}>
                <AutoAwesomeOutlinedIcon sx={{ fontSize: 17 }} />
              </IconButton>
            </span>
          </Tooltip>
        )}
        <ExpandMoreIcon sx={{ fontSize: 20, color: MUTED, transform: open ? "rotate(180deg)" : "none", transition: "transform .22s ease" }} />
      </Box>
      <Collapse in={open} timeout={240} unmountOnExit>
        <Box sx={{ px: 1.75, pb: 1.75, pt: 0.5 }}>{children}</Box>
      </Collapse>
    </Box>
  );
}

/** The rows in one quiet card. */
export function RowList({ children }: { children: React.ReactNode }) {
  return <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "10px", overflow: "hidden", bgcolor: "rgba(250,251,253,.9)" }}>{children}</Box>;
}

const PART_RUN: Record<PartKey, Part> = { hero: "hero", intro: "intro", benefits: "benefits", sections: "sections", links: "links", faq: "faq", cta: "cta", seo: "seo" };
const AI_LABEL: Record<PartKey, string> = {
  hero: "Write the hero with AI", intro: "Write the intro with AI", benefits: "Write the benefits with AI", sections: "Write the sections with AI",
  links: "Find the shop's pages with AI", faq: "Write the questions with AI", cta: "Write the call to action with AI", seo: "Write the search engine fields with AI",
};

/** The summary under a part: what it says, or what it still needs. */
function summaryOf(p: PartInfo, making: number): React.ReactNode {
  if (making) return <Box component="span" sx={{ color: PINK, fontWeight: 600 }}>Making {making === 1 ? "the picture" : `${making} pictures`}…</Box>;
  if (p.state === "empty") return "Not written yet";
  const miss = p.missing ? <Box component="span" sx={{ color: AMBER, fontWeight: 600 }}>{p.missing === 1 ? "picture missing" : `${p.missing} pictures missing`}{p.summary ? " · " : ""}</Box> : null;
  return <>{miss}{p.summary}</>;
}

/** A new page's parts: Hero, Intro, Benefits, Sections, Links, Questions, Call to action, Search engines. */
export function PartsOutline({ api, f, set, store, canEdit, canAi, fill, busy, open, onOpen, focusPath, selBlock, onFocusPath, pictures, makingIn }: {
  api: StudioApi; f: Fields; set: (next: Fields, label?: string) => void; store: string; canEdit: boolean; canAi: boolean; fill: FillRun; busy: string | null;
  open: string | null; onOpen: (part: PartKey | null) => void; focusPath: string | null; selBlock: string | null; onFocusPath: (p: string) => void;
  pictures: PictureCtl;
  /** how many pictures of a part are being made */
  makingIn: (part: PartKey) => number;
}) {
  const parts = partsOf(f);
  const writing = busyOf(busy, f).parts;
  return (
    <RowList>
      {parts.map((p) => {
        const isBusy = writing.includes(p.key);
        return (
          <Row key={p.key} id={p.key} title={p.name} count={p.count} state={isBusy ? "busy" : p.state} summary={summaryOf(p, makingIn(p.key))}
            busyLabel={busy === "all" ? "Writing with the whole page…" : "Writing…"} open={open === p.key} onToggle={() => onOpen(open === p.key ? null : p.key)}
            onAi={canEdit ? () => void fill(PART_RUN[p.key]) : undefined} aiLabel={AI_LABEL[p.key]} canAi={canAi && !busy}>
            <PartBody api={api} part={p.key} f={f} set={set} store={store} canEdit={canEdit} canAi={canAi} fill={fill} busy={busy}
              focusPath={focusPath} selBlock={selBlock} onFocusPath={onFocusPath} pictures={pictures} />
          </Row>
        );
      })}
    </RowList>
  );
}
