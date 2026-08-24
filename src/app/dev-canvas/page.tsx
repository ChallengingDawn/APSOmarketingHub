"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import type { SeedText } from "@/app/editor/EditorCanvas";

// Konva touches `window` at import time — client-only.
const EditorCanvas = dynamic(() => import("@/app/editor/EditorCanvas"), {
  ssr: false,
  loading: () => (
    <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
      <CircularProgress size={30} />
    </Box>
  ),
});

// Inline SVG so the harness never depends on a generated image or the network.
const BG_IMAGE = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="627" viewBox="0 0 1200 627">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#16303f"/><stop offset="1" stop-color="#274e64"/>' +
    "</linearGradient></defs>" +
    '<rect width="1200" height="627" fill="url(#g)"/></svg>',
)}`;

const SAMPLE_TEXTS: SeedText[] = [
  { role: "kicker", text: "APSOPARTS · SEALING TECHNOLOGY" },
  { role: "headline", text: "FFKM seals that survive 300 °C" },
  { role: "body", text: "Certified compounds for aggressive media — from stock in 48 h." },
  { role: "cta", text: "Discover more on apsoparts.com" },
];

export default function DevCanvasPage() {
  // NEXT_PUBLIC_ vars are inlined at build time, so a production build without
  // the flag ships this as a dead branch — the harness page never reaches users.
  if (process.env.NEXT_PUBLIC_E2E !== "1") return <div>Not available</div>;
  return <DevCanvasHarness />;
}

function DevCanvasHarness() {
  const [texts, setTexts] = useState<SeedText[] | undefined>(undefined);
  const [seedSignal, setSeedSignal] = useState(0);
  // ?portal=1 mirrors how the studio mounts the editor (tools portaled into the
  // sidebar) so that path is covered by the suite, not just the inline one.
  const [toolsHost, setToolsHost] = useState<HTMLElement | null>(null);
  const portalMode = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("portal") === "1";

  const seed = () => {
    setTexts(SAMPLE_TEXTS);
    setSeedSignal((n) => n + 1);
  };

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, flexWrap: "wrap", gap: 1 }}>
        <Box>
          <Typography sx={{ fontFamily: "var(--font-outfit)", fontSize: 26, fontWeight: 700, color: "#1a1d21", letterSpacing: "-0.02em" }}>
            Canvas E2E Harness
          </Typography>
          <Typography sx={{ fontSize: 13, color: "#5b6470" }}>
            Renders the editor canvas standalone with a fixed background and seedable text — used by the Playwright suite only.
          </Typography>
        </Box>
        <Button
          data-testid="seed-btn"
          onClick={seed}
          variant="contained"
          startIcon={<AutoAwesomeIcon />}
          sx={{ bgcolor: "#ed1b2f", textTransform: "none", fontWeight: 600, "&:hover": { bgcolor: "#c91528" } }}
        >
          Seed generated text
        </Button>
      </Box>
      {portalMode ? (
        <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
          <Box ref={setToolsHost} data-testid="tools-host" sx={{ width: 300, flexShrink: 0, border: "1px solid #e3e6ea", borderRadius: 2, p: 1.5, bgcolor: "#fff" }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <EditorCanvas initialImage={BG_IMAGE} initialTexts={texts} seedSignal={seedSignal} toolsContainer={toolsHost} />
          </Box>
        </Box>
      ) : (
        <EditorCanvas initialImage={BG_IMAGE} initialTexts={texts} seedSignal={seedSignal} />
      )}
    </Box>
  );
}
