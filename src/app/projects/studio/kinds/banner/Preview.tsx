"use client";
// THE BANNER'S PREVIEW (08.11.2026). "This size": the shop's sizes run in a frame of their own, exactly as pasted - the
// word changes, the photos crossfade, desktop or phone; the picture sizes are drawn as their PNG will be. "All sizes":
// every size the banner is made in, side by side at one scale, so their proportions read true.

import { useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import DesktopWindowsOutlinedIcon from "@mui/icons-material/DesktopWindowsOutlined";
import PhoneIphoneOutlinedIcon from "@mui/icons-material/PhoneIphoneOutlined";

import { Choice } from "@/app/connectors/parts";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { PRESET, sizeLabel, sizesOf, type BannerDoc, type PresetKey } from "@/lib/content/studio/kinds/banner/model";
import { pasteBlock, previewDoc, previewSwap, stillMarkup, stillSheet } from "@/lib/content/studio/kinds/banner/render";
import { Pane, type Device } from "../../parts";
import { Scaled, useWidth } from "./ui";

export type View = "one" | "all";

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
      borderRadius: phone ? "26px" : "12px", border: phone ? "8px solid #15223a" : `1px solid ${HAIRLINE}`, boxShadow: "0 18px 50px rgba(31,45,78,.18)",
    }}>
      <iframe ref={frame} title="Banner" srcDoc={src} sandbox="allow-scripts" onLoad={swap}
        style={{ width, height: h, border: 0, display: "block", transform: `scale(${zoom})`, transformOrigin: "0 0", background: "#fff" }} />
    </Box>
  );
}

export default function Preview({ doc, prefix, active, setActive, font, view, setView, device, setDevice, title }: {
  doc: BannerDoc; prefix: string; active: PresetKey; setActive: (k: PresetKey) => void; font: string | null;
  view: View; setView: (v: View) => void; device: Device; setDevice: (d: Device) => void; title: string;
}) {
  const [box, width] = useWidth<HTMLDivElement>();
  const made = sizesOf(doc);
  const p = PRESET[active];
  const live = p.out === "html";
  const block = useMemo(() => (live ? pasteBlock(doc, active, prefix, title) : ""), [doc, active, prefix, title, live]);
  const still = useMemo(() => (live ? null : stillMarkup(doc, active, prefix)), [doc, active, prefix, live]);
  const sheet = useMemo(() => (view === "all" ? stillSheet(doc, sizesOf(doc), prefix) : null), [doc, prefix, view]);
  const avail = Math.max(240, width - 48);
  const phone = live && device === "mobile";
  const frameWidth = phone ? 390 : active === "band" ? 1280 : p.w;
  const sheetScale = Math.min(1, (avail - 8) / 1200);

  const controls = (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      {view === "one" && live && (
        <ToggleButtonGroup size="small" exclusive value={device} onChange={(_, v) => v && setDevice(v)} sx={{ bgcolor: "#fff", "& .MuiToggleButton-root": { px: 1.25, py: 0.4, textTransform: "none", fontWeight: 600, fontSize: "0.78rem", gap: 0.5 } }}>
          <ToggleButton value="desktop" aria-label="Desktop"><DesktopWindowsOutlinedIcon sx={{ fontSize: 16 }} />Desktop</ToggleButton>
          <ToggleButton value="mobile" aria-label="Phone"><PhoneIphoneOutlinedIcon sx={{ fontSize: 16 }} />Phone</ToggleButton>
        </ToggleButtonGroup>
      )}
      <Choice value={view} onChange={setView} options={[{ key: "one", label: "This size" }, { key: "all", label: `All sizes · ${made.length}` }]} />
    </Box>
  );

  return (
    <Pane tone="stage" pad={false} title="Preview" right={controls}>
      <Box ref={box} sx={{ p: 3, minHeight: "100%", boxSizing: "border-box" }}>
        {font === null ? (
          <Typography sx={{ color: MUTED, fontSize: "0.9rem" }}>Loading the brand&apos;s type…</Typography>
        ) : view === "one" ? (
          <>
            {made.length > 1 && (
              <Box sx={{ mb: 2.5 }}>
                <Choice value={active} onChange={setActive} options={made.map((k) => ({ key: k, label: PRESET[k].label }))} />
              </Box>
            )}
            <Box sx={{ display: "flex", justifyContent: "center" }}>
              {live ? (
                <LiveFrame key={`${active}-${phone ? "p" : "d"}`} block={block} width={frameWidth} font={font} avail={avail} phone={phone} />
              ) : still && (
                <Scaled css={still.css} html={still.html} w={p.w} h={p.h} scale={Math.min(1, avail / p.w)} />
              )}
            </Box>
            <Typography sx={{ mt: 2, textAlign: "center", fontSize: "0.8rem", color: MUTED }}>
              <Box component="span" sx={{ color: INK, fontWeight: 650 }}>{p.label}</Box> · {sizeLabel(p)} · {p.note}
              {live && p.motion && (doc.content.rotatingWords.length > 1 || doc.content.photos.length > 1) ? " · changes every 2.6 s while on screen" : ""}
            </Typography>
            {!font && <Typography sx={{ mt: 1, textAlign: "center", fontSize: "0.78rem", color: MUTED }}>The brand&apos;s type did not load - drawn in Arial here; the shop uses its own.</Typography>}
          </>
        ) : sheet && (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3, alignItems: "flex-start", justifyContent: "center" }}>
            {made.map((k) => {
              const q = PRESET[k];
              return (
                <Box key={k}>
                  <Typography sx={{ fontSize: "0.76rem", color: MUTED, mb: 0.75 }}>
                    <Box component="span" sx={{ color: INK, fontWeight: 650 }}>{q.label}</Box> · {sizeLabel(q)}
                  </Typography>
                  <Scaled css={sheet.css} html={sheet.html[k]} w={k === "band" ? 1200 : q.w} h={q.h} scale={sheetScale} radius={k === "band" ? 0 : 4}
                    title={`Open ${q.label}`} onClick={() => { setActive(k); setView("one"); }} />
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    </Pane>
  );
}
