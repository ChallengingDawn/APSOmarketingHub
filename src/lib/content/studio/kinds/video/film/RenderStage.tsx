"use client";
// THE FILM ON THE RENDER MACHINE (08.11.2026): one film mounted at its full size (or scaled), moved to any frame by the
// render script (scripts/content-video/render.mjs) through window.engine - the same contract as the team's own engine
// (black-friday-2026/video src/engine/entry.tsx): ready() waits for the font and the pictures, seek(n) draws frame n.
// The spec comes from window.__VIDEO_SPEC__ (the script puts it there before the page loads), or as a prop.
import React, { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { fromSpec, type VideoSpec } from "../model";
import { Film } from "./Film";
import { loadFilmFonts } from "./fonts";

type Engine = {
  comp: { id: string; width: number; height: number; fps: number; durationInFrames: number; scale: number };
  ready: () => Promise<void>;
  seek: (frame: number, waitForImages?: boolean) => Promise<void>;
};

declare global {
  interface Window {
    __VIDEO_SPEC__?: unknown;
    __VIDEO_SCALE__?: number;
    engine?: Engine;
  }
}

const imagesReady = () =>
  Promise.all(
    [...document.images].map(async (img) => {
      if (!img.complete) await new Promise((r) => { img.addEventListener("load", r, { once: true }); img.addEventListener("error", r, { once: true }); });
      await img.decode().catch(() => undefined);
    }),
  );

export default function RenderStage({ spec: given, scale: givenScale, base = "" }: { spec?: VideoSpec | null; scale?: number; base?: string }) {
  const [spec] = useState<VideoSpec | null>(() => given ?? (typeof window !== "undefined" ? fromSpec(window.__VIDEO_SPEC__) : null));
  const scale = givenScale ?? (typeof window !== "undefined" && typeof window.__VIDEO_SCALE__ === "number" ? window.__VIDEO_SCALE__ : 1);
  const [frame, setFrame] = useState(0);
  const [, setFonts] = useState(0);
  const set = useRef(setFrame);
  set.current = setFrame;

  useEffect(() => {
    if (!spec) return;
    window.engine = {
      comp: { id: `video-${spec.doc.format}`, width: Math.round(spec.width * scale), height: Math.round(spec.height * scale), fps: spec.fps, durationInFrames: spec.frames, scale },
      ready: async () => {
        await loadFilmFonts(base);
        // the words are measured again with the real font
        flushSync(() => setFonts((n) => n + 1));
        await imagesReady();
      },
      seek: async (n, waitForImages = true) => {
        flushSync(() => set.current(Math.max(0, Math.min(spec.frames - 1, Math.round(n)))));
        if (waitForImages) await imagesReady();
      },
    };
    return () => { delete window.engine; };
  }, [spec, scale, base]);

  if (!spec) return <div style={{ font: "16px system-ui", padding: 24 }}>No film to render: window.__VIDEO_SPEC__ holds no video spec.</div>;
  return (
    <div style={{ position: "fixed", left: 0, top: 0, zIndex: 2147483000, width: spec.width * scale, height: spec.height * scale, overflow: "hidden", background: "#F4F6F8" }}>
      <div style={{ width: spec.width, height: spec.height, transform: scale === 1 ? undefined : `scale(${scale})`, transformOrigin: "0 0" }}>
        <Film doc={spec.doc} frame={frame} base={base} />
      </div>
    </div>
  );
}
