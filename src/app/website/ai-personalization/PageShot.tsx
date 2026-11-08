"use client";

// A shop page as it looks, small: the page's still picture (the preview route's ?still=1 - the shop's styles, no script)
// in a frame that may run nothing (sandbox=""), opened at #maincontent so it shows the page's own top, scaled to the
// card. Read only when the card comes into view (loading="lazy"). SARCLA 08.11.2026 on Problems: "we should really
// show the pages".

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import type { Env } from "@/lib/convert/model";

const W = 1280;

export function PageShot({ env, path, ratio = 0.62, label }: { env: Env; path: string; ratio?: number; label?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const scale = w ? w / W : 0.25;
  const H = Math.round(W * ratio);
  const src = `/api/website/ai-personalization/preview?env=${env}&path=${encodeURIComponent(path)}&still=1#maincontent`;
  return (
    <Box ref={wrap} sx={{ position: "relative", width: "100%", aspectRatio: `${1 / ratio}`, overflow: "hidden", bgcolor: "#f3f5f8", borderBottom: "1px solid rgba(21,34,58,.08)" }}>
      {w > 0 && (
        <iframe src={src} title={label ?? path} sandbox="" loading="lazy" scrolling="no" tabIndex={-1} aria-hidden onLoad={() => setLoaded(true)}
          style={{ width: W, height: H, border: 0, transform: `scale(${scale})`, transformOrigin: "0 0", pointerEvents: "none", background: "#fff", display: "block" }} />
      )}
      {/* the page shows as it draws; a small turn in the corner until its last picture is in */}
      {!loaded && (
        <Box sx={{ position: "absolute", right: 8, bottom: 8, width: 26, height: 26, borderRadius: "6px", display: "grid", placeItems: "center", bgcolor: "rgba(255,255,255,.85)" }}>
          <CircularProgress size={14} sx={{ color: "rgba(21,34,58,.45)" }} />
        </Box>
      )}
    </Box>
  );
}
