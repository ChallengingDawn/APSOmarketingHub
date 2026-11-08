// The render harness (08.11.2026): the page render.mjs bundles and serves on 127.0.0.1 - the film's own stage with no
// hub around it, so a film renders on any machine with Chromium and ffmpeg, without the hub running.
import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import RenderStage from "../../src/lib/content/studio/kinds/video/film/RenderStage";

const el = document.getElementById("stage");
if (el) {
  const root = createRoot(el);
  flushSync(() => root.render(<RenderStage />));
}
