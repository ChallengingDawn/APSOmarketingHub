"use client";

// CONNECTORS & INTEGRATION's square on the front page - the app's way in, in
// place of a tile (SARCLA, 07.10.2026: "take the connector from the main menu
// and bring it to the square"). Whether the data is flowing, then the app's
// pages. Only drawn for someone who may open the app.

import { useEffect, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CableIcon from "@mui/icons-material/Cable";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { chainVerdict, lastDelivery, type Snapshot } from "@/lib/connectors/snapshot";
import { progress } from "@/lib/connectors/compass";
import { APPS } from "./hubApps";

const INK = "#15223a";
const MUTED = "#5d6b85";
const FAINT = "#8b97ac";
const DOT = { good: "#2ec29a", warn: "#f0a63c", bad: "#e5484d", unknown: "#b9c0c9" } as const;
const APP = APPS.find((a) => a.key === "connectors");

function ago(t: number | null | undefined): string {
  if (!t) return "";
  const s = Math.max(0, Date.now() / 1000 - t);
  if (s < 90) return "just now";
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  if (s < 36 * 3600) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
}

function Line({ dot, text, when }: { dot: string; text: string; when?: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
      <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: dot, flexShrink: 0 }} />
      <Typography sx={{ fontSize: "0.86rem", color: INK, flex: 1, lineHeight: 1.35 }}>{text}</Typography>
      {when ? <Typography sx={{ fontSize: "0.76rem", color: FAINT, whiteSpace: "nowrap" }}>{when}</Typography> : null}
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
  const d = s ? lastDelivery(s) : null;
  return (
    <Box sx={{
      ...glass, borderRadius: "22px", p: { xs: 2, md: 2.25 }, display: "flex", flexDirection: "column", gap: 1.5,
      background: `linear-gradient(160deg, ${APP?.wash ?? "rgba(47,179,165,.10)"}, rgba(255,255,255,.7) 60%)`,
    }}>
      <Box component={Link} href="/connectors" sx={{ display: "flex", alignItems: "center", gap: 1.25, textDecoration: "none", "&:hover .go": { transform: "translateX(3px)" } }}>
        <Box sx={{ width: 38, height: 38, borderRadius: "11px", display: "grid", placeItems: "center", color: "#fff", flexShrink: 0,
          background: `linear-gradient(135deg, ${APP?.from ?? "#2fb3a5"}, ${APP?.to ?? "#13866a"})` }}>
          <CableIcon sx={{ fontSize: 21 }} />
        </Box>
        <Typography sx={{ fontSize: "1.02rem", fontWeight: 600, color: INK, letterSpacing: "-0.02em", flex: 1 }}>Connectors &amp; Integration</Typography>
        <ChevronRightIcon className="go" sx={{ color: APP?.to ?? "#13866a", transition: "transform .2s" }} />
      </Box>

      <Box sx={{ display: "grid", gap: 1 }}>
        {!s && !failed && <Typography sx={{ fontSize: "0.85rem", color: MUTED }}>Asking the Compass connector…</Typography>}
        {failed && <Line dot={DOT.unknown} text="The Compass connector did not answer" />}
        {s && v && <Line dot={DOT[v.tone]} text={`Compass chain: ${v.label.toLowerCase()}`} when={ago(v.at)} />}
        {s && d && <Line dot={d.at ? DOT.good : DOT.unknown} text={d.at ? `${d.files} ERP files in the last delivery` : "No ERP files received yet"} when={ago(d.at)} />}
        <Line dot="#9a7bf0" text={`${moved.hub} of ${moved.total} connector steps run in the hub`} />
        {s?.review && s.review.pending > 0 && <Line dot={DOT.warn} text={`${s.review.pending} ERP customers wait for a company`} />}
      </Box>

      <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mt: "auto" }}>
        {(APP?.subs ?? []).filter((x) => x.href !== "/connectors").map((x) => (
          <Box key={x.href} component={Link} href={x.href} sx={{
            px: 1.25, py: 0.5, borderRadius: "999px", fontSize: "0.8rem", fontWeight: 600, textDecoration: "none",
            color: APP?.to ?? "#13866a", bgcolor: "rgba(255,255,255,.8)", border: "1px solid rgba(19,134,106,.18)",
            "&:hover": { bgcolor: "#fff" },
          }}>
            {x.name}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
