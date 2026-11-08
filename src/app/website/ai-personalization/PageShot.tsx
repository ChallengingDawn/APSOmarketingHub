"use client";

// A shop page as it looks, small: the page's still picture (the preview route's ?still=1 - the shop's styles, none of
// its scripts) in a frame, scaled to the card, read only when the card comes into view (loading="lazy"). SARCLA
// 08.11.2026 on Problems: "we should really show the pages". Opened at #maincontent (the page's own top), or - with
// `focus`, an AI idea's block - at the anchor the hub put before that block, outlined. Nothing runs in it, so it shares
// the hub's origin and the browser keeps the shop's files once for every picture (src/lib/convert/preview.ts stillPage).

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import type { Env } from "@/lib/convert/model";

const W = 1280;

export function PageShot({ env, path, ratio = 0.62, label, focus }: { env: Env; path: string; ratio?: number; label?: string; focus?: string | null }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const [loaded, setLoaded] = useState(false);
  // the picture is read only once its card is on the screen, and kept after (the hub load balancer counts every file)
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setSeen(true); io.disconnect(); } }, { rootMargin: "100px" });
    io.observe(el);
    return () => { ro.disconnect(); io.disconnect(); };
  }, []);
  const scale = w ? w / W : 0.25;
  const H = Math.round(W * ratio);
  const base = `/api/website/ai-personalization/preview?env=${env}&path=${encodeURIComponent(path)}&still=1`;
  const src = focus ? `${base}&focus=${encodeURIComponent(focus)}#apso-focus` : `${base}#maincontent`;
  return (
    <Box ref={wrap} sx={{ position: "relative", width: "100%", aspectRatio: `${1 / ratio}`, overflow: "hidden", bgcolor: "#f3f5f8", borderBottom: "1px solid rgba(21,34,58,.08)" }}>
      {w > 0 && seen && (
        <iframe key={src} src={src} title={label ?? path} sandbox="allow-same-origin" loading="lazy" scrolling="no" tabIndex={-1} aria-hidden onLoad={() => setLoaded(true)}
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
