"use client";

// APSOconvert > IDEAS (Website > AI testing & personalization). Every idea on every page, by how far it has come:
// waiting for a yes or no, approved, its version being shaped in the preview, its version approved and ready for the
// test. A card opens the page in the preview with that idea (src/lib/convert/studio.ts board); "In Content" = a
// Content Studio project was made of its page (src/lib/convert/handoff.ts).

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import RefreshIcon from "@mui/icons-material/Refresh";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { GlassCard, HAIRLINE, INK, MUTED, glass } from "@/app/uc/report/ui";
import { ago } from "@/app/connectors/parts";
import { Chip } from "@/app/website/ai-personalization/Tag";
import { ENVS, KIND_LABEL } from "@/lib/convert/model";
import type { BoardRow } from "@/lib/convert/studio";
import { iceScore } from "@/lib/convert/ice";
import { markerOf } from "@/lib/convert/handoff";
import { previewHref } from "../Flow";

type Column = "proposed" | "approved" | "building" | "ready";
const COLUMNS: { key: Column; name: string; line: string; tint: "amber" | "green" | "blue" | "purple" }[] = [
  { key: "proposed", name: "Waiting for a yes or no", line: "The AI proposed them", tint: "amber" },
  { key: "approved", name: "Approved", line: "Its version is not written yet", tint: "green" },
  { key: "building", name: "In preview", line: "The version is being shaped", tint: "blue" },
  { key: "ready", name: "Ready to test", line: "The version is approved", tint: "purple" },
];
const columnOf = (r: BoardRow): Column | null =>
  r.status === "dropped" ? null : r.status === "proposed" ? "proposed" : !r.version ? "approved" : r.version.status === "approved" ? "ready" : "building";
const since = (iso: string) => ago(Date.parse(iso) / 1000);

function Card({ r, inContent }: { r: BoardRow; inContent: boolean }) {
  return (
    <Box component={Link} href={previewHref(r.env, r.path, r.id)} sx={{
      display: "grid", gap: 0.5, p: 1.5, borderRadius: "14px", border: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.7)", textDecoration: "none", color: "inherit",
      transition: "border-color .15s, transform .15s", "&:hover": { borderColor: "#2459d1", transform: "translateY(-1px)" },
    }}>
      <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK, lineHeight: 1.3 }}>{r.title}</Typography>
      <Typography sx={{ fontSize: "0.74rem", color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.path}>{r.path}</Typography>
      <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
        <Chip tint={r.env === "prod" ? "green" : "amber"}>{ENVS[r.env].label}</Chip>
        <Chip tint="slate">{KIND_LABEL[r.kind]}</Chip>
        {iceScore(r) !== null && <Chip tint="blue">Score {iceScore(r)}</Chip>}
        {r.version && <Chip tint="blue">rev {r.version.rev}</Chip>}
        {inContent && <Chip tint="purple">In Content</Chip>}
        <Typography sx={{ fontSize: "0.72rem", color: MUTED, ml: "auto" }}>{r.source === "ai" ? "AI" : r.createdBy} · {since(r.version?.updatedAt ?? r.decidedAt ?? r.createdAt)}</Typography>
      </Box>
    </Box>
  );
}

export default function ConvertIdeas() {
  const [tick, setTick] = useState(0);
  const url = `/api/website/ai-personalization/ideas?n=${tick}`;
  const held = useHeld<{ ideas: BoardRow[] }>(url, [url]);
  const r = held.result;
  // the pages a Content Studio project was made of (its marker line), env:path
  const [inContent, setInContent] = useState<Set<string>>(new Set());
  useEffect(() => {
    let live = true;
    fetch("/api/content/projects?scope=visible").then((x) => x.json()).then((j: { ok?: boolean; projects?: { brief: string | null }[] }) => {
      if (!live || !j.ok) return;
      setInContent(new Set((j.projects ?? []).map((p) => markerOf(p.brief)).filter((m): m is NonNullable<typeof m> => !!m).map((m) => `${m.env}:${m.path}`)));
    }).catch(() => { /* no Content access: no chip */ });
    return () => { live = false; };
  }, []);
  const cols = useMemo(() => {
    const m = new Map<Column, BoardRow[]>(COLUMNS.map((c) => [c.key, []]));
    let dropped = 0;
    for (const x of r?.state === "ok" ? r.data.ideas : []) {
      const c = columnOf(x);
      if (c) m.get(c)!.push(x); else dropped++;
    }
    return { m, dropped };
  }, [r]);
  const total = COLUMNS.reduce((s, c) => s + cols.m.get(c.key)!.length, 0);

  let body: React.ReactNode;
  if (r === null) body = <LoadingPanel label="Reading the ideas…" />;
  else if (r.state !== "ok") body = <UpstreamPanel source="Ideas" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? (r.status ?? null) : null} onRetry={() => setTick((n) => n + 1)} />;
  else if (total === 0) {
    body = (
      <GlassCard>
        <Typography sx={{ fontSize: "0.9rem", color: INK, fontWeight: 600 }}>No idea yet.</Typography>
        <Typography sx={{ fontSize: "0.84rem", color: MUTED, mt: 0.5 }}>
          Open a page in the <Box component={Link} href="/website/ai-personalization/preview" sx={{ color: "#2459d1", fontWeight: 600 }}>Preview</Box> - from Problems, or any page of the shop - and ask the AI for ideas.
        </Typography>
      </GlassCard>
    );
  } else {
    body = (
      <>
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "minmax(0,1fr)", md: "repeat(2, minmax(0,1fr))", xl: "repeat(4, minmax(0,1fr))" }, alignItems: "start" }}>
          {COLUMNS.map((c) => {
            const rows = cols.m.get(c.key)!;
            return (
              <Box key={c.key} sx={{ ...glass, borderRadius: "18px", p: 1.5, display: "grid", gap: 1, minWidth: 0 }}>
                <Box sx={{ display: "flex", gap: 1, alignItems: "baseline", px: 0.5 }}>
                  <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: INK }}>{c.name}</Typography>
                  <Chip tint={c.tint}>{rows.length}</Chip>
                </Box>
                <Typography sx={{ fontSize: "0.74rem", color: MUTED, px: 0.5, mt: -0.5 }}>{c.line}</Typography>
                {rows.length === 0 && <Typography sx={{ fontSize: "0.8rem", color: MUTED, px: 0.5, py: 1 }}>None</Typography>}
                {[...rows].sort((a, b) => (iceScore(b) ?? -1) - (iceScore(a) ?? -1)).map((x) => <Card key={x.id} r={x} inContent={inContent.has(`${x.env}:${x.path}`)} />)}
              </Box>
            );
          })}
        </Box>
        {cols.dropped > 0 && <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>{cols.dropped} dropped {cols.dropped === 1 ? "idea stays" : "ideas stay"} on {cols.dropped === 1 ? "its page" : "their pages"} in the preview.</Typography>}
      </>
    );
  }

  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader
        title="Ideas"
        subtitle="What to change on which page: the AI proposes, a person approves, the preview shows the version"
        rightSlot={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {(r === null || held.stale) && <CircularProgress size={14} sx={{ color: MUTED }} />}
            <Tooltip title="Ask again"><IconButton size="small" onClick={() => setTick((n) => n + 1)} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton></Tooltip>
          </Box>
        }
      />
      {body}
    </Box>
  );
}
