"use client";

// The front page's Connectors panel - in the place What's new had (SARCLA,
// 06.10.2026): is the data flowing, and how far the Compass connector has
// moved into the hub. Only drawn for someone who may open the app.

import { useEffect, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { chainVerdict, type Snapshot } from "@/lib/connectors/snapshot";
import { progress } from "@/lib/connectors/compass";

const INK = "#15223a";
const MUTED = "#5d6b85";
const FAINT = "#8b97ac";
const DOT = { good: "#2ec29a", warn: "#f0a63c", bad: "#e5484d", unknown: "#b9c0c9" } as const;

function ago(t: number | null | undefined): string {
  if (!t) return "never";
  const s = Math.max(0, Date.now() / 1000 - t);
  if (s < 90) return "just now";
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  if (s < 36 * 3600) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
}

function Line({ dot, text, when }: { dot: string; text: string; when: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.25 }}>
      <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: dot, mt: 0.65, flexShrink: 0 }} />
      <Typography sx={{ fontSize: "0.85rem", color: INK, flex: 1, lineHeight: 1.4 }}>{text}</Typography>
      <Typography sx={{ fontSize: "0.76rem", color: FAINT, whiteSpace: "nowrap", mt: 0.1 }}>{when}</Typography>
    </Box>
  );
}

export default function ConnectorsPanel({ glass }: { glass: object }) {
  const [s, setS] = useState<Snapshot | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/connectors", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j?.ok ? setS(j.data as Snapshot) : setFailed(true)))
      .catch(() => { if (!ctrl.signal.aborted) setFailed(true); });
    return () => ctrl.abort();
  }, []);
  const moved = progress();
  const v = s ? chainVerdict(s) : null;
  const delivered = s?.state?.sftp?.last_processing;
  return (
    <Box sx={{ ...glass, borderRadius: "22px", p: { xs: 2, md: 2.25 }, display: "flex", flexDirection: "column" }}>
      <Typography sx={{ fontSize: "1.02rem", fontWeight: 600, color: INK, letterSpacing: "-0.02em", mb: 1.75 }}>
        Connectors
      </Typography>
      <Box sx={{ display: "grid", gap: 1.15, flex: 1 }}>
        {!s && !failed && <Typography sx={{ fontSize: "0.85rem", color: MUTED }}>Asking the Compass connector…</Typography>}
        {failed && <Line dot={DOT.unknown} text="The Compass connector did not answer" when="" />}
        {s && v && <Line dot={DOT[v.tone]} text={`Compass chain: ${v.label.toLowerCase()}`} when={ago(v.at)} />}
        {s && (
          <Line dot={delivered?.pulled?.length ? DOT.good : DOT.unknown}
            text={delivered?.pulled?.length ? `${delivered.pulled.length} ERP files in the last delivery` : "ERP files: none recorded yet"}
            when={ago(delivered?.ts ?? null)} />
        )}
        <Line dot="#9a7bf0" text={`${moved.hub} of ${moved.total} connector steps run in the hub`} when="" />
        {s?.review && s.review.pending > 0 && <Line dot={DOT.warn} text={`${s.review.pending} ERP customers wait for a company`} when="" />}
      </Box>
      <Box component={Link} href="/connectors" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, mt: 1.75, fontSize: "0.82rem", fontWeight: 600, color: "#2459d1", textDecoration: "none" }}>
        Open Connectors &amp; Integration <ArrowForwardIcon sx={{ fontSize: 15 }} />
      </Box>
    </Box>
  );
}
