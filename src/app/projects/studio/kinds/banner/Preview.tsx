"use client";
// THE BANNER'S STAGE (08.11.2026; SARCLA: "the banner can be in multiple places"). Three views, squared choices on top:
//   All places   every place the banner is used in, side by side, grouped (the shop, an e-mail, social, ads), each with
//                where it stands (ready, worth a look, not yet) - a click opens it
//   one place    that place live and large: the shop's places run in a frame exactly as pasted (the word changes, the
//                photos crossfade, desktop or phone), the pictures drawn as their PNG will be - and under it the place's
//                own words, its checks and what it gives
//   In a page    the page to-do it was put in, with the banner in its place (Place.tsx)

import { useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import DownloadIcon from "@mui/icons-material/Download";

import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import { placeChecks, placeState } from "@/lib/content/studio/kinds/banner/checks";
import { GROUPS, PRESET, isBand, sizeLabel, sizesOf, type BannerDoc, type PresetKey } from "@/lib/content/studio/kinds/banner/model";
import { pasteBlock, previewDoc, previewSwap, stillMarkup, stillSheet } from "@/lib/content/studio/kinds/banner/render";
import { Pane, btn, type Device } from "../../parts";
import { PlaceSheet, usePng } from "./Output";
import { InPage, type Pages } from "./Place";
import { Scaled, useWidth } from "./ui";

export type View = "all" | "pages" | PresetKey;

/** The paste block running in its own frame: scripts allowed, nothing else (no access to the hub). */
function LiveFrame({ block, width, font, avail, phone }: { block: string; width: number; font: string; avail: number; phone: boolean }) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const latest = useRef(block);
  latest.current = block;
  const [h, setH] = useState(phone ? 520 : 360);
  // the frame loads once per width and font; after that the banner is swapped in place - no flash while typing
  const src = useMemo(() => previewDoc(latest.current, font), [font, width]);
  const swap = () => frame.current?.contentWindow?.postMessage({ apsoBanner: "swap", html: previewSwap(latest.current) }, "*");
  useEffect(() => { const t = setTimeout(swap, 120); return () => clearTimeout(t); }, [block]);
  useEffect(() => {
    const on = (e: MessageEvent) => {
      const m = e.data as { apsoBanner?: string; h?: number } | null;
      if (e.source === frame.current?.contentWindow && m?.apsoBanner === "height") setH(Math.max(40, Math.min(4000, Number(m.h) || 0)));
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, []);
  const zoom = Math.max(0.1, Math.min(1, (avail - (phone ? 16 : 0)) / width));
  return (
    <Box sx={{
      width: width * zoom + (phone ? 16 : 2), height: h * zoom + (phone ? 16 : 2), flexShrink: 0, overflow: "hidden", bgcolor: "#fff", transition: "width .3s ease",
      borderRadius: phone ? "26px" : "10px", border: phone ? "8px solid #15223a" : `1px solid ${HAIRLINE}`, boxShadow: "0 18px 50px rgba(31,45,78,.18)",
    }}>
      <iframe ref={frame} title="Banner" srcDoc={src} sandbox="allow-scripts" onLoad={swap}
        style={{ width, height: h, border: 0, display: "block", transform: `scale(${zoom})`, transformOrigin: "0 0", background: "#fff" }} />
    </Box>
  );
}

const STATE = {
  ready: { text: "Ready", fg: "#1b7a55", bg: "#e7f6ee" },
  look: { text: "To look at", fg: "#8a5a00", bg: "#fff3d6" },
  stop: { text: "Not yet", fg: "#b3261e", bg: "#fde7e5" },
} as const;

/** A place's state, as a small squared tag. */
export function StateTag({ state, n }: { state: keyof typeof STATE; n?: number }) {
  const s = STATE[state];
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", px: 0.75, py: 0.1, borderRadius: "4px", bgcolor: s.bg, color: s.fg, fontSize: "0.7rem", fontWeight: 700, whiteSpace: "nowrap" }}>
      {s.text}{n && state !== "ready" ? ` · ${n}` : ""}
    </Box>
  );
}

/** Every place side by side, grouped; a click opens one. */
function Overview({ doc, prefix, open, avail, png }: { doc: BannerDoc; prefix: string; open: (k: PresetKey) => void; avail: number; png: ReturnType<typeof usePng> }) {
  const made = sizesOf(doc);
  const sheet = useMemo(() => stillSheet(doc, made, prefix), [doc, prefix, made.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const pictures = made.filter((k) => PRESET[k].h);
  // every card the same frame, two or three a row; a band across the whole row
  const cell = Math.max(240, Math.min(380, (avail - 32) / (avail > 1150 ? 3 : 2)));
  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2.5 }}>
        <Typography sx={{ flex: 1, fontSize: "0.9rem", color: INK }}>
          <b>{made.length} place{made.length === 1 ? "" : "s"}</b>, one banner. <Box component="span" sx={{ color: MUTED }}>Open one to give it shorter words and get its file.</Box>
        </Typography>
        {pictures.length > 1 && (
          <Button size="small" variant="outlined" disabled={!!png.busy} onClick={() => png.run(pictures, 1, "all")}
            startIcon={png.busy === "all" ? <CircularProgress size={14} /> : <DownloadIcon sx={{ fontSize: 17 }} />}
            sx={{ ...btn, color: INK, borderColor: HAIRLINE, bgcolor: "#fff" }}>Every picture · {pictures.length}</Button>
        )}
      </Box>
      {GROUPS.filter((g) => made.some((k) => PRESET[k].group === g.key)).map((g) => (
        <Box key={g.key} sx={{ mb: 3 }}>
          <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: MUTED, mb: 1.25 }}>{g.label}</Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-start" }}>
            {made.filter((k) => PRESET[k].group === g.key).map((k) => {
              const q = PRESET[k];
              const band = isBand(k);
              const w = band ? 1200 : q.w;
              const boxW = band ? Math.max(cell, avail - 8) : cell;
              const boxH = band ? 400 : cell * 0.78;
              const scale = band ? (boxW - 24) / w : Math.min((boxW - 24) / q.w, (boxH - 24) / (q.h ?? 1));
              const checks = placeChecks(doc, k);
              return (
                <Box key={k} component="button" type="button" onClick={() => open(k)} sx={{
                  all: "unset", boxSizing: "border-box", cursor: "pointer", width: boxW, borderRadius: "10px", bgcolor: "rgba(255,255,255,.75)", border: `1px solid ${HAIRLINE}`,
                  transition: "border-color .15s, box-shadow .15s", "&:hover": { borderColor: "#2459d1", boxShadow: "0 10px 30px rgba(31,45,78,.12)" }, "&:focus-visible": { outline: "2px solid #2459d1" },
                }}>
                  <Box sx={{ height: band ? "auto" : boxH, minHeight: band ? 80 : undefined, display: "grid", placeItems: "center", p: 1.5, bgcolor: "#eef1f6", borderRadius: "10px 10px 0 0", backgroundImage: "radial-gradient(rgba(21,34,58,.06) 1px, transparent 1px)", backgroundSize: "14px 14px" }}>
                    <Scaled css={sheet.css} html={sheet.html[k]} w={w} h={q.h} scale={scale} radius={band ? 0 : 3} />
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 1 }}>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography sx={{ fontSize: "0.84rem", fontWeight: 650, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{q.label}</Typography>
                      <Typography sx={{ fontSize: "0.72rem", color: MUTED, fontVariantNumeric: "tabular-nums" }}>{sizeLabel(q)} · {q.out === "html" ? "paste block" : "PNG"}</Typography>
                    </Box>
                    <StateTag state={placeState(checks)} n={checks.length} />
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

export default function Stage({ doc, set, prefix, view, setView, font, fontFailed, title, canEdit, pages, pageId, setPageId, saved, pieceId, projectId }: {
  doc: BannerDoc; set: (fn: (d: BannerDoc) => BannerDoc) => void; prefix: string; view: View; setView: (v: View) => void; font: string | null; fontFailed: boolean; title: string; canEdit: boolean;
  pages: Pages; pageId: number | null; setPageId: (id: number) => void; saved: boolean; pieceId: number; projectId: number;
}) {
  const [box, width] = useWidth<HTMLDivElement>();
  const [device, setDevice] = useState<Device>("desktop");
  const made = sizesOf(doc);
  const k: PresetKey | null = view !== "all" && view !== "pages" && made.includes(view) ? view : null;
  const p = k ? PRESET[k] : null;
  const live = p?.out === "html";
  const block = useMemo(() => (k && live ? pasteBlock(doc, k, prefix, title) : ""), [doc, k, prefix, title, live]);
  const still = useMemo(() => (k && !live ? stillMarkup(doc, k, prefix) : null), [doc, k, prefix, live]);
  const png = usePng(doc, prefix, title, font);
  const avail = Math.max(240, width - 48);
  const phone = live && device === "mobile";
  const frameWidth = phone ? 390 : k && isBand(k) ? 1280 : p?.w ?? 1200;
  const shown: View = k ?? (view === "pages" ? "pages" : "all");
  const placedN = pages.placed.reduce((n, x) => n + x.mine.length, 0);

  const head = (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0, flexWrap: "wrap" }}>
      <SquareChoice<string> value={shown} onChange={(v) => setView(v as View)} options={[
        { key: "all", label: "All places", count: made.length },
        ...made.map((x) => ({ key: x, label: PRESET[x].short })),
        { key: "pages", label: "In a page", count: placedN || undefined },
      ]} />
    </Box>
  );

  return (
    <Pane tone="stage" pad={false}>
      <Box sx={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 1.25, borderBottom: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.55)", flexShrink: 0 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>{head}</Box>
          {live && k && <SquareChoice<Device> value={device} onChange={setDevice} options={[{ key: "desktop", label: "Desktop" }, { key: "mobile", label: "Phone" }]} />}
        </Box>
        <Box sx={{ flex: 1, minHeight: 0 }}>
          {shown === "pages" ? (
            <InPage pieceId={pieceId} projectId={projectId} pages={pages} pageId={pageId} setPageId={setPageId} saved={saved} />
          ) : (
            <Box ref={box} sx={{ height: "100%", overflowY: "auto", p: 3, boxSizing: "border-box" }}>
              {!k || !p ? (
                <Overview doc={doc} prefix={prefix} open={(x) => setView(x)} avail={avail} png={png} />
              ) : (
                <>
                  <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 2, flexWrap: "wrap" }}>
                    <Typography sx={{ fontSize: "1.05rem", fontWeight: 700, color: INK }}>{p.label}</Typography>
                    <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>{sizeLabel(p)} · {p.note}{live && p.motion && (doc.content.rotatingWords.length > 1 || doc.content.photos.length > 1) ? " · it changes every 2.6 s while on screen" : ""}</Typography>
                  </Box>
                  <Box sx={{ display: "flex", justifyContent: "center" }}>
                    {live ? (
                      <LiveFrame key={`${k}-${phone ? "p" : "d"}`} block={block} width={frameWidth} font={font ?? ""} avail={avail} phone={phone} />
                    ) : still && (
                      <Scaled css={still.css} html={still.html} w={p.w} h={p.h} scale={Math.min(1, avail / p.w, k === "story" || k === "portrait" || k === "sky" ? 620 / (p.h ?? 1) : 1)} radius={4} />
                    )}
                  </Box>
                  <PlaceSheet doc={doc} set={set} k={k} canEdit={canEdit} prefix={prefix} title={title} font={font} png={png} />
                </>
              )}
              {fontFailed && (
                <Typography sx={{ mt: 2.5, textAlign: "center", fontSize: "0.74rem", color: MUTED }}>
                  The brand&apos;s type could not be loaded here - drawn in the nearest look-alike. The shop draws in its own.
                </Typography>
              )}
            </Box>
          )}
        </Box>
      </Box>
    </Pane>
  );
}
