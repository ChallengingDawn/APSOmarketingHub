"use client";
// PUT THE BANNER IN A PAGE (08.11.2026; SARCLA: "the banner design: we should be able to push it inside a page visually
// as well"). Pick one of the project's page to-dos, the shop place it takes there and where in the page; the banner goes
// into that page's document (an insert - the page studio owns the page and renders it in its preview and its paste
// block), then the page shows here with the banner in it, live: the shop's page read through the page studio's reader,
// the banner's word changing as on the shop.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RefreshIcon from "@mui/icons-material/Refresh";
import WebOutlinedIcon from "@mui/icons-material/WebOutlined";

import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import { PAGE_PLACES, PRESET, sizesOf, type BannerDoc, type PresetKey } from "@/lib/content/studio/kinds/banner/model";
import { WHERES, insertLine, type Where } from "@/lib/content/studio/kinds/banner/place";
import type { PageRow } from "@/lib/content/studio/kinds/banner/server";
import { btn, mainBtn } from "../../parts";
import type { StudioApi } from "../../useStudio";
import { Hint } from "./ui";

const SEL = "#2459d1";

/** The project's page to-dos and where this banner sits in each, read again after every move. */
export function usePages(pieceId: number) {
  const [pages, setPages] = useState<PageRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const j = await fetch(`/api/content/studio/banner/${pieceId}/in-page`).then((r) => r.json()).catch(() => ({ ok: false, error: "The hub did not answer." }));
    if (!j.ok) { setError(j.error ?? "Not read."); setPages([]); return; }
    setError(null); setPages(j.pages);
  }, [pieceId]);
  useEffect(() => { void load(); }, [load]);
  const placed = (pages ?? []).filter((p) => p.mine.length);
  return { pages, error, reload: load, set: setPages, placed };
}
export type Pages = ReturnType<typeof usePages>;

const pageName = (p: PageRow) => (p.isNew ? p.newTitle || p.title : p.title);
const pageWhere = (p: PageRow) => (p.isNew ? "A new page" : p.path || "No shop page picked yet");

/** The card beside the banner: which page, which place, where - and the pages it is in already. */
export function PutInPage({ api, doc, set, pages, onShow }: {
  api: StudioApi; doc: BannerDoc; set: (fn: (d: BannerDoc) => BannerDoc) => void; pages: Pages; onShow: (pageId: number) => void;
}) {
  const canEdit = api.data.access.canEdit;
  const list = pages.pages;
  const firstShop = sizesOf(doc).find((k) => PAGE_PLACES.includes(k)) ?? "band";
  const [pageId, setPageId] = useState<number | null>(null);
  const [place, setPlace] = useState<PresetKey>(firstShop);
  const [where, setWhere] = useState<Where>("top");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const picked = list?.find((p) => p.id === pageId) ?? list?.[0] ?? null;

  const put = async () => {
    if (!picked) return;
    setBusy("put"); setMsg(null);
    const r = await api.act<{ pages: PageRow[]; existed: boolean }>("place", { pageId: picked.id, preset: place, where });
    setBusy(null);
    if (!r.ok) { setMsg(r.error); return; }
    pages.set(r.result.pages);
    // the place it takes in the page is one of the banner's places from now on
    if (!sizesOf(doc).includes(place)) set((d) => ({ ...d, sizes: [...d.sizes, place] }));
    if (r.result.existed) setMsg("It was there already - showing it.");
    onShow(picked.id);
  };
  const out = async (page: PageRow, insertId: string) => {
    setBusy(insertId); setMsg(null);
    const r = await api.act<{ pages: PageRow[] }>("unplace", { pageId: page.id, insertId });
    setBusy(null);
    if (!r.ok) { setMsg(r.error); return; }
    pages.set(r.result.pages);
  };

  return (
    <Box sx={{ bgcolor: "rgba(255,255,255,.82)", border: "1px solid rgba(255,255,255,.9)", boxShadow: "0 1px 2px rgba(31,45,78,.04), 0 12px 32px rgba(31,45,78,.07)", borderRadius: "18px", p: 2, minHeight: 0, overflowY: "auto" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 1.25 }}>
        <WebOutlinedIcon sx={{ fontSize: 17, color: "#274e64" }} />
        <Typography sx={{ flex: 1, fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: MUTED }}>Put it in a page</Typography>
      </Box>
      {list === null ? (
        <Box sx={{ py: 2, display: "grid", placeItems: "center" }}><CircularProgress size={18} /></Box>
      ) : !list.length ? (
        <Hint>This project has no page to-do yet. Add a Page to the project, then put the banner in it here.</Hint>
      ) : (
        <>
          <Box sx={{ display: "grid", gap: 0.5, mb: 1.25, maxHeight: 156, overflowY: "auto" }}>
            {list.map((p) => {
              const on = picked?.id === p.id;
              return (
                <Box key={p.id} component="button" type="button" onClick={() => setPageId(p.id)} aria-pressed={on} sx={{
                  all: "unset", boxSizing: "border-box", cursor: "pointer", display: "flex", alignItems: "center", gap: 1, px: 1.1, py: 0.75, borderRadius: "6px",
                  border: `1px solid ${on ? "rgba(36,89,209,.55)" : HAIRLINE}`, bgcolor: on ? "rgba(36,89,209,.06)" : "#fff",
                  "&:hover": { borderColor: on ? SEL : "#9fb3c0" }, "&:focus-visible": { outline: `2px solid ${SEL}` },
                }}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontSize: "0.84rem", fontWeight: 650, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pageName(p)}</Typography>
                    <Typography sx={{ fontSize: "0.72rem", color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pageWhere(p)}</Typography>
                  </Box>
                  {p.mine.length > 0 && <Box sx={{ px: 0.7, py: 0.15, borderRadius: "4px", bgcolor: "#e7f6ee", color: "#1b7a55", fontSize: "0.7rem", fontWeight: 700, flexShrink: 0 }}>In it</Box>}
                </Box>
              );
            })}
          </Box>
          <Typography sx={{ fontSize: "0.7rem", fontWeight: 650, color: MUTED, mb: 0.5 }}>As</Typography>
          <Box sx={{ mb: 1 }}>
            <SquareChoice value={place} onChange={setPlace} options={PAGE_PLACES.map((k) => ({ key: k, label: PRESET[k].short }))} />
          </Box>
          <Typography sx={{ fontSize: "0.7rem", fontWeight: 650, color: MUTED, mb: 0.5 }}>Where</Typography>
          <Box sx={{ mb: 1.5 }}>
            <SquareChoice value={where} onChange={setWhere} options={WHERES.map((w) => ({ key: w.key, label: w.label }))} />
          </Box>
          <Button fullWidth variant="contained" disableElevation disabled={!canEdit || !picked || !!busy} onClick={put}
            startIcon={busy === "put" ? <CircularProgress size={14} color="inherit" /> : undefined} sx={mainBtn}>
            Put it in {picked ? `“${pageName(picked).slice(0, 28)}${pageName(picked).length > 28 ? "…" : ""}”` : "the page"}
          </Button>
          {!canEdit && <Hint sx={{ mt: 0.75 }}>You can comment on this project, not change its pages.</Hint>}
          {pages.placed.length > 0 && (
            <Box sx={{ mt: 1.75, pt: 1.25, borderTop: `1px solid ${HAIRLINE}`, display: "grid", gap: 0.75 }}>
              <Typography sx={{ fontSize: "0.7rem", fontWeight: 650, color: MUTED }}>In these pages</Typography>
              {pages.placed.flatMap((p) => p.mine.map((m) => (
                <Box key={m.id} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Box component="button" type="button" onClick={() => onShow(p.id)} sx={{ all: "unset", cursor: "pointer", flex: 1, minWidth: 0, "&:hover .t": { color: SEL } }}>
                    <Typography className="t" sx={{ fontSize: "0.82rem", fontWeight: 650, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pageName(p)}</Typography>
                    <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{insertLine({ preset: m.preset, where: m.where as Where })}</Typography>
                  </Box>
                  <Tooltip title="Take it out of this page">
                    <span>
                      <IconButton size="small" disabled={!canEdit || !!busy} onClick={() => out(p, m.id)} aria-label="Take it out of this page">
                        {busy === m.id ? <CircularProgress size={14} /> : <CloseIcon sx={{ fontSize: 16 }} />}
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              )))}
            </Box>
          )}
        </>
      )}
      {(msg || pages.error) && <Typography sx={{ mt: 1, fontSize: "0.8rem", color: "#7f4f0b" }}>{msg ?? pages.error}</Typography>}
    </Box>
  );
}

type Shown = { ok: true; html: string; url: string; notes: string[]; page: { id: number; title: string; isNew: boolean; path: string } } | { ok: false; error: string };

/** The page with the banner in it, as a picture of the shop's page - scrolled to the banner. */
export function InPage({ pieceId, projectId, pages, pageId, setPageId, saved }: {
  pieceId: number; projectId: number; pages: Pages; pageId: number | null; setPageId: (id: number) => void; saved: boolean;
}) {
  const placed = pages.placed;
  const id = pageId && (pages.pages ?? []).some((p) => p.id === pageId) ? pageId : placed[0]?.id ?? null;
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [shown, setShown] = useState<Shown | null>(null);
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState(0);
  const frame = useRef<HTMLIFrameElement | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  const [avail, setAvail] = useState(800);
  const [size, setSize] = useState({ h: 900, top: -1 });
  const stamp = useMemo(() => JSON.stringify(pages.pages?.find((p) => p.id === id)?.mine ?? []), [pages.pages, id]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAvail(el.clientWidth - 48));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // the page again when the banner was saved, or put somewhere else
  useEffect(() => {
    if (!id || !saved) return;
    let live = true;
    setBusy(true);
    const t = setTimeout(async () => {
      const j = (await fetch(`/api/content/studio/banner/${pieceId}/in-page?page=${id}${fresh ? "&fresh=1" : ""}`).then((r) => r.json()).catch(() => ({ ok: false, error: "The hub did not answer." }))) as Shown;
      if (!live) return;
      setShown(j); setBusy(false); setSize({ h: 900, top: -1 });
    }, 300);
    return () => { live = false; clearTimeout(t); };
  }, [id, saved, pieceId, fresh, stamp]);
  useEffect(() => {
    const on = (e: MessageEvent) => {
      const m = e.data as { apsoInPage?: string; h?: number; top?: number } | null;
      if (e.source !== frame.current?.contentWindow || m?.apsoInPage !== "size") return;
      setSize({ h: Math.max(400, Math.min(30000, Number(m.h) || 900)), top: Number(m.top) });
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, []);
  const w = device === "mobile" ? 390 : 1280;
  const zoom = Math.min(1, avail / w);
  // to the banner, once the page has told where it is
  useEffect(() => {
    if (size.top < 0 || !scroller.current) return;
    scroller.current.scrollTo({ top: Math.max(0, size.top * zoom - 60), behavior: "smooth" });
  }, [size.top, zoom]);

  const row = (pages.pages ?? []).find((p) => p.id === id) ?? null;
  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", px: 3, pt: 2, pb: 1.25 }}>
        {placed.length > 1 ? (
          <SquareChoice value={String(id)} onChange={(v) => setPageId(Number(v))} options={placed.map((p) => ({ key: String(p.id), label: pageName(p).slice(0, 30) }))} />
        ) : row ? (
          <Typography sx={{ fontSize: "0.9rem", fontWeight: 650, color: INK }}>{pageName(row)} <Box component="span" sx={{ color: MUTED, fontWeight: 500 }}>· {pageWhere(row)}</Box></Typography>
        ) : null}
        <Box sx={{ flex: 1 }} />
        <SquareChoice value={device} onChange={setDevice} options={[{ key: "desktop", label: "Desktop" }, { key: "mobile", label: "Phone" }]} />
        <Tooltip title="Read the shop's page again"><span><IconButton size="small" disabled={!id || busy} onClick={() => setFresh((n) => n + 1)} aria-label="Read again"><RefreshIcon sx={{ fontSize: 18 }} /></IconButton></span></Tooltip>
        {row && (
          <Button size="small" component={Link} href={`/projects/${projectId}/pieces/${row.id}`} endIcon={<OpenInNewIcon sx={{ fontSize: 15 }} />} sx={{ ...btn, color: INK }}>
            The page&apos;s studio
          </Button>
        )}
      </Box>
      <Box ref={scroller} sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 3, pb: 3 }}>
        {!id ? (
          <Box sx={{ textAlign: "center", color: MUTED, py: 12 }}>
            <Typography sx={{ fontSize: "1.05rem", fontWeight: 600, color: INK, mb: 0.75 }}>Not in a page yet</Typography>
            <Typography sx={{ fontSize: "0.88rem" }}>Pick a page to-do on the right, the place it takes and where - it shows here, inside the page.</Typography>
          </Box>
        ) : !shown ? (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1.25, color: MUTED, py: 10 }}><CircularProgress size={16} /> Reading the page…</Box>
        ) : !shown.ok ? (
          <Box sx={{ maxWidth: 460, mx: "auto", my: 6, p: 2, borderRadius: "14px", bgcolor: "#fff", color: INK, fontSize: "0.88rem", textAlign: "center", boxShadow: "0 8px 24px rgba(31,45,78,.08)" }}>
            {shown.error}{/Pick a page|store's page/.test(shown.error) ? " Open the page's studio and pick its page first." : ""}
          </Box>
        ) : (
          <>
            <Box sx={{ display: "flex", justifyContent: "center", opacity: busy ? 0.55 : 1, transition: "opacity .2s" }}>
              <Box sx={{
                width: w * zoom + (device === "mobile" ? 16 : 2), height: size.h * zoom + (device === "mobile" ? 16 : 2), flexShrink: 0, borderRadius: device === "mobile" ? "26px" : "12px", overflow: "hidden",
                boxShadow: "0 18px 50px rgba(31,45,78,.18)", border: device === "mobile" ? "8px solid #15223a" : `1px solid ${HAIRLINE}`, bgcolor: "#fff", boxSizing: "border-box",
              }}>
                <iframe ref={frame} title="The page with the banner" srcDoc={shown.html} sandbox="allow-scripts"
                  style={{ width: w, height: size.h, border: 0, transform: `scale(${zoom})`, transformOrigin: "0 0", display: "block", background: "#fff" }} />
              </Box>
            </Box>
            {shown.notes.length > 0 && (
              <Box sx={{ maxWidth: 720, mx: "auto", mt: 2 }}>
                {shown.notes.map((n) => <Typography key={n} sx={{ fontSize: "0.78rem", color: MUTED, textAlign: "center" }}>{n}</Typography>)}
              </Box>
            )}
          </>
        )}
      </Box>
    </Box>
  );
}
