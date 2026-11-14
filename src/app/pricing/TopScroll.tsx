"use client";
import React, { useEffect, useRef, useState } from "react";

// Horizontal scrollbar ON TOP of a wide table (in addition to the natural bottom one), so you
// can scroll sideways without first scrolling to the end of the page. Wrap the TableContainer
// with <TopScroll> and give the container `overflow: "visible"` — this wrapper becomes the
// horizontal scroller and mirrors a slim scrollbar above the table.
export default function TopScroll({ children }: { children: React.ReactNode }) {
  const topRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const syncing = useRef(false);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const measure = () => setW(el.scrollWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, []);

  const sync = (src: HTMLDivElement | null, dst: HTMLDivElement | null) => {
    if (!src || !dst || syncing.current) return;
    syncing.current = true;
    dst.scrollLeft = src.scrollLeft;
    syncing.current = false;
  };

  return (
    <div>
      <div ref={topRef} onScroll={() => sync(topRef.current, bodyRef.current)}
        style={{ overflowX: "auto", overflowY: "hidden", height: 14, marginBottom: 2 }}>
        <div style={{ width: w, height: 1 }} />
      </div>
      <div ref={bodyRef} onScroll={() => sync(bodyRef.current, topRef.current)} style={{ overflowX: "auto" }}>
        {children}
      </div>
    </div>
  );
}
