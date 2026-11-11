"use client";
// "A PAGE FROM THE PAGE BUILDER" BESIDE EACH LINK OF THE NEWSLETTER (11.11.2026). SARCLA: "with these new pages (one
// Magento page per store view, same URL key), how do we generate the link for the correct page in the newsletter?"
//
// Under the hero's button, a story's button, each product, the banner and the call to action: a small button that lists
// the Page builder's new pages of the projects this person may open (the server's `pageLinks`, read once per studio).
// A pick writes the page's PRODUCTION address in the newsletter's language store view (the newsletter is sent per
// language - fr -> fr-CH, en -> en-INT ...). A page not on the shop there yet is still offered, said plainly in amber:
// "Not on the shop yet - publish it to production first" (only on ACC: it says so). An ACC address never goes in.
// Under the field the address's state stays said (lib/content/studio/kinds/newsletter/pageLinks.ts linkNote).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import Popover from "@mui/material/Popover";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import WebOutlinedIcon from "@mui/icons-material/WebOutlined";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { langName } from "@/lib/content/studio/kinds/page/model";
import {
  linkFor, linkNote, newsletterStore, pickerOrder, whereLine, type PageLinkRow, type Tone,
} from "@/lib/content/studio/kinds/newsletter/pageLinks";
import { btn } from "../../parts";
import { BLUE } from "../blog/ui";

/** The Page builder's pages, read once per studio (again on "Read again" - after a publish). */
export type PageLinks = { rows: PageLinkRow[] | null; loading: boolean; error: string | null; load: (again?: boolean) => void };

export function usePageLinks(act: (name: string) => Promise<{ ok: true; result: unknown } | { ok: false; error: string }>): PageLinks {
  const [rows, setRows] = useState<PageLinkRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const actRef = useRef(act);
  actRef.current = act;
  const state = useRef<"idle" | "busy" | "done">("idle");
  const load = useCallback((again = false) => {
    if (state.current === "busy" || (state.current === "done" && !again)) return;
    state.current = "busy";
    setLoading(true);
    setError(null);
    void actRef.current("pageLinks").then((r) => {
      if (r.ok) { setRows(((r.result as { pages?: PageLinkRow[] })?.pages) ?? []); state.current = "done"; }
      else { setError(r.error); state.current = "idle"; }
    }).catch(() => { setError("The hub did not answer."); state.current = "idle"; }).finally(() => setLoading(false));
  }, []);
  return useMemo(() => ({ rows, loading, error, load }), [rows, loading, error, load]);
}

const TONE: Record<Tone, { ink: string; dot: string; bg: string }> = {
  ok: { ink: "#1b7a55", dot: "#1b7a55", bg: "transparent" },
  warn: { ink: "#7f4f0b", dot: "#d08a00", bg: "#fff8ec" },
  bad: { ink: "#8f1d1b", dot: "#c5221f", bg: "#fdf0ef" },
  none: { ink: MUTED, dot: "#9aa5b8", bg: "transparent" },
};

/** A state said in a line, with its squared mark. */
export function StateLine({ tone, line, mt = 0.5 }: { tone: Tone; line: string; mt?: number }) {
  const t = TONE[tone];
  return (
    <Box sx={{ display: "flex", gap: 0.75, alignItems: "flex-start", mt, px: t.bg === "transparent" ? 0 : 0.75, py: t.bg === "transparent" ? 0 : 0.4, borderRadius: "4px", bgcolor: t.bg }}>
      <Box component="span" sx={{ width: 8, height: 8, borderRadius: "2px", bgcolor: t.dot, flexShrink: 0, mt: "5px" }} />
      <Typography component="span" sx={{ fontSize: "0.76rem", color: t.ink, lineHeight: 1.4, fontWeight: tone === "ok" || tone === "none" ? 500 : 600 }}>{line}</Typography>
    </Box>
  );
}

const pickBtn = { ...btn, minWidth: 0, px: 0.5, py: 0, height: 24, fontSize: "0.76rem", color: BLUE, borderRadius: "4px", "& .MuiButton-startIcon": { mr: 0.5 }, "&:hover": { bgcolor: "rgba(36,89,209,.06)" } };

/** The list of the Page builder's pages, for one newsletter language - in the popover (and in the harness, as it is). */
export function PageList({ pages, language, onPick, onClose }: { pages: PageLinks; language: string; onPick: (url: string) => void; onClose?: () => void }) {
  const [q, setQ] = useState("");
  const store = newsletterStore(language);
  const all = useMemo(() => pickerOrder(pages.rows ?? [], language), [pages.rows, language]);
  const words = q.trim().toLowerCase();
  const rows = words ? all.filter((r) => `${r.title} ${r.project} ${r.todo} ${Object.values(r.views).map((v) => `${v.title} ${v.key}`).join(" ")}`.toLowerCase().includes(words)) : all;
  return (
    <Box sx={{ width: 420, maxWidth: "calc(100vw - 32px)", display: "flex", flexDirection: "column", maxHeight: "min(640px, calc(100vh - 32px))" }}>
      <Box sx={{ px: 1.75, pt: 1.5, pb: 1.25, borderBottom: `1px solid ${HAIRLINE}` }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Typography sx={{ flex: 1, fontSize: "0.92rem", fontWeight: 700, color: INK }}>A page from the Page builder</Typography>
          <Tooltip title="Read the pages again (after a publish)">
            <span><IconButton size="small" aria-label="Read the pages again" disabled={pages.loading} onClick={() => pages.load(true)}><RefreshOutlinedIcon sx={{ fontSize: 17 }} /></IconButton></span>
          </Tooltip>
          {onClose && <IconButton size="small" aria-label="Close" onClick={onClose}><CloseIcon sx={{ fontSize: 17 }} /></IconButton>}
        </Box>
        <Typography sx={{ fontSize: "0.78rem", color: MUTED, lineHeight: 1.45 }}>
          The {langName(store)} newsletter links each page in <b>{store}</b>, at the shop&apos;s address.
        </Typography>
        {all.length > 5 && (
          <InputBase value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a page" inputProps={{ "aria-label": "Find a page" }}
            sx={{ mt: 1, width: "100%", fontSize: "0.84rem", px: 1, py: 0.25, border: `1px solid ${HAIRLINE}`, borderRadius: "4px", bgcolor: "#fff", "&.Mui-focused": { borderColor: BLUE } }} />
        )}
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {pages.loading && !pages.rows && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 2, color: MUTED, fontSize: "0.82rem" }}><CircularProgress size={14} /> Reading the Page builder&apos;s pages…</Box>
        )}
        {pages.error && <Box sx={{ p: 1.75 }}><StateLine tone="bad" line={pages.error} mt={0} /></Box>}
        {pages.rows && !all.length && (
          <Typography sx={{ p: 2, fontSize: "0.82rem", color: MUTED }}>No new page of the Page builder has a URL key yet, in the projects you can open.</Typography>
        )}
        {all.length > 0 && !rows.length && <Typography sx={{ p: 2, fontSize: "0.82rem", color: MUTED }}>No page matches “{q.trim()}”.</Typography>}
        {rows.map((r) => {
          const l = linkFor(r, language);
          const v = r.views[store];
          return (
            <Box key={r.pieceId} component="button" type="button" disabled={!l.address} onClick={() => { if (l.address) onPick(l.address); }}
              aria-label={l.address ? `Link ${v?.title || r.title}` : undefined}
              sx={{
                all: "unset", boxSizing: "border-box", display: "block", width: "100%", px: 1.75, py: 1.25, borderTop: `1px solid ${HAIRLINE}`, "&:first-of-type": { borderTop: 0 },
                cursor: l.address ? "pointer" : "default", "&:hover": l.address ? { bgcolor: "rgba(36,89,209,.04)" } : {}, "&:focus-visible": { outline: `2px solid ${BLUE}`, outlineOffset: -2 },
              }}>
              <Typography sx={{ fontSize: "0.88rem", fontWeight: 700, color: l.address ? INK : MUTED, lineHeight: 1.3 }}>{v?.title || r.title}</Typography>
              <Typography sx={{ fontSize: "0.74rem", color: MUTED, lineHeight: 1.35, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.project}{r.todo && r.todo !== r.project ? ` · ${r.todo}` : ""}</Typography>
              {l.address && (
                <Typography sx={{ fontSize: "0.76rem", color: BLUE, mt: 0.4, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", wordBreak: "break-all" }}>
                  www.apsoparts.com/{l.store}/{v?.key}
                </Typography>
              )}
              <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 0.4 }}>{whereLine(r.last)}</Typography>
              <StateLine tone={l.tone} line={l.line} />
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

/** Reads the Page builder's pages once it is shown (the last step's "Before it goes out" says which links are not on the
 * shop yet). */
export function ReadPagesOnShow({ load }: { load: () => void }) {
  useEffect(() => { load(); }, [load]);
  return null;
}

/** The button under a link field, its list, and what is said of the address the field holds. */
export function PagePick({ pages, language, value, onPick }: { pages: PageLinks; language: string; value: string; onPick: (url: string) => void }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  // an address of the shop in the field: the pages are read, to say whether a page picked before is on the shop yet
  const shop = /apsoparts\.com\//i.test(value);
  const { load } = pages;
  useEffect(() => { if (shop) load(); }, [shop, load]);
  const note = linkNote(value, language, pages.rows);
  return (
    <Box ref={boxRef} sx={{ mt: -0.75, mb: 1.25 }}>
      <Button size="small" startIcon={<WebOutlinedIcon sx={{ fontSize: "16px !important" }} />} aria-haspopup="dialog" onClick={(e) => { setEl(boxRef.current ?? e.currentTarget); load(); }} sx={pickBtn}>
        A page from the Page builder
      </Button>
      {note && <StateLine tone={note.tone} line={note.line} />}
      {/* beside the build column, over the e-mail: the field it fills stays in view */}
      <Popover open={!!el} anchorEl={el} onClose={() => setEl(null)} anchorOrigin={{ vertical: "center", horizontal: "right" }} transformOrigin={{ vertical: "center", horizontal: "left" }}
        slotProps={{ paper: { sx: { borderRadius: "8px", overflow: "hidden", ml: 3, boxShadow: "0 4px 10px rgba(26,58,76,.08), 0 16px 40px rgba(26,58,76,.16)" } } }}>
        <PageList pages={pages} language={language} onClose={() => setEl(null)} onPick={(url) => { onPick(url); setEl(null); }} />
      </Popover>
    </Box>
  );
}
