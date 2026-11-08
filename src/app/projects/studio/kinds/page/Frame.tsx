"use client";
// ONE PAGE IN A FRAME (08.11.2026): the HTML the server finished, at the device's real width, zoomed down to the space it
// has, as tall as its content (the pane scrolls, not the frame). No script runs in it (sandbox without allow-scripts);
// same-origin only so its height can be read. Shaped like the shared PreviewFrame, so the studios read as one product.

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import { HAIRLINE } from "@/app/uc/report/ui";

export type Device = "desktop" | "mobile";
export const DEVICE_WIDTH: Record<Device, number> = { desktop: 1280, mobile: 390 };

export function Frame({ html, device, title, maxWidth }: { html: string; device: Device; title: string; maxWidth?: number }) {
  const box = useRef<HTMLDivElement | null>(null);
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [avail, setAvail] = useState(800);
  const [height, setHeight] = useState(900);
  const w = DEVICE_WIDTH[device];

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAvail(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // the page's height, again whenever it changes (pictures arriving, fonts)
  useEffect(() => {
    let ro: ResizeObserver | null = null;
    const measure = () => {
      const d = frame.current?.contentDocument;
      if (!d?.documentElement) return;
      setHeight(Math.min(30_000, Math.max(400, d.documentElement.scrollHeight)));
      if (!ro && d.body) { ro = new ResizeObserver(() => setHeight(Math.min(30_000, Math.max(400, d.documentElement.scrollHeight)))); ro.observe(d.body); }
    };
    const f = frame.current;
    f?.addEventListener("load", measure);
    const t = setTimeout(measure, 300);
    return () => { f?.removeEventListener("load", measure); clearTimeout(t); ro?.disconnect(); };
  }, [html, device]);

  const zoom = Math.min(1, (Math.min(avail, maxWidth ?? avail) - 8) / w);
  const mobile = device === "mobile";
  return (
    <Box ref={box} sx={{ display: "flex", justifyContent: "center", width: "100%", minWidth: 0 }}>
      <Box sx={{
        width: w * zoom + (mobile ? 16 : 2), height: height * zoom + (mobile ? 16 : 2), flexShrink: 0, borderRadius: mobile ? "26px" : "12px", overflow: "hidden",
        boxShadow: "0 18px 50px rgba(31,45,78,.18)", border: mobile ? "8px solid #15223a" : `1px solid ${HAIRLINE}`, bgcolor: "#fff", boxSizing: "border-box",
      }}>
        <iframe ref={frame} title={title} srcDoc={html} sandbox="allow-same-origin"
          style={{ width: w, height, border: 0, transform: `scale(${zoom})`, transformOrigin: "0 0", display: "block", background: "#fff" }} />
      </Box>
    </Box>
  );
}
