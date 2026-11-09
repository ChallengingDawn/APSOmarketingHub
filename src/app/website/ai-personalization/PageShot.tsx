"use client";

// A shop page as it looks, small: the page's still picture (the preview route's ?still=1 - the shop's styles, none of
// its scripts) in a frame, scaled to the card, read only when the card comes into view (loading="lazy"). SARCLA
// 08.11.2026 on Problems: "we should really show the pages". Opened at #maincontent (the page's own top), or - with
// `focus`, an optimization's block - at the anchor the hub put before that block, outlined (scrolled from here). Nothing runs in it, so it shares
// the hub's origin and the browser keeps the shop's files once for every picture (src/lib/convert/preview.ts stillPage).

import { useCallback, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import type { Env } from "@/lib/convert/model";

const W = 1280;

export function PageShot({ env, path, ratio = 0.62, label, focus }: { env: Env; path: string; ratio?: number; label?: string; focus?: string | null }) {
  const wrap = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
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
  // a page whose last file never comes (a font, a picture the shop is slow with) would keep the turn on for ever: after
  // 15 s what is drawn is what there is
  useEffect(() => {
    if (!seen || loaded) return;
    const t = setTimeout(() => setLoaded(true), 15_000);
    return () => clearTimeout(t);
  }, [seen, loaded]);
  const scale = w ? w / W : 0.25;
  const H = Math.round(W * ratio);
  const base = `/api/website/ai-personalization/preview?env=${env}&path=${encodeURIComponent(path)}&still=1`;
  // opened at the page's own top (#maincontent) or at the anchor before the block - scrolled from here, never by a
  // #fragment: a same-origin frame's fragment scrolls the hub's page too, and every picture coming in pulled the list down
  const src = focus ? `${base}&focus=${encodeURIComponent(focus)}` : base;
  const anchor = focus ? "apso-focus" : "maincontent";
  /** Scroll the picture to its anchor; true once the page is complete with it (no more to do). */
  const toAnchor = useCallback((): boolean => {
    try {
      const win = frame.current?.contentWindow, doc = frame.current?.contentDocument;
      const a = doc?.getElementById(anchor);
      if (!win || !doc || !a) return false;
      // the box that scrolls: the still page clips html and body (the shop's body is the window's height), so it is
      // usually the body - the nearest box around the anchor that holds more than it shows
      const gap = focus ? 16 : 0;
      let box = a.parentElement, moved = false;
      while (box && box !== doc.documentElement) {
        if (box.scrollHeight > box.clientHeight + 1 && win.getComputedStyle(box).overflowY !== "visible") {
          box.scrollTop += a.getBoundingClientRect().top - box.getBoundingClientRect().top - gap;
          moved = true;
          break;
        }
        box = box.parentElement;
      }
      if (!moved) win.scrollTo(0, Math.max(0, a.getBoundingClientRect().top + win.scrollY - gap));
      return doc.readyState === "complete";
    } catch {
      return true;
    }
  }, [anchor, focus]);
  // while the page draws (its blocks above the anchor grow as their styles come), and once more when it is complete
  useEffect(() => {
    if (!seen || !w) return;
    let n = 0;
    const t = setInterval(() => { n++; if (toAnchor() || n >= 120) clearInterval(t); }, 250);
    return () => clearInterval(t);
  }, [seen, w, src, toAnchor]);
  return (
    <Box ref={wrap} sx={{ position: "relative", width: "100%", aspectRatio: `${1 / ratio}`, overflow: "hidden", bgcolor: "#f3f5f8", borderBottom: "1px solid rgba(21,34,58,.08)" }}>
      {w > 0 && seen && (
        <iframe ref={frame} key={src} src={src} title={label ?? path} sandbox="allow-same-origin" loading="lazy" scrolling="no" tabIndex={-1} aria-hidden onLoad={() => { setLoaded(true); toAnchor(); }}
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
