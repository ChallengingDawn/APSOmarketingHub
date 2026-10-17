"use client";
// AI ANSWERS (AEO) - RECOMMENDATIONS: what HubSpot's AEO suggests doing so the
// assistants name and cite us more - by priority, each with its reason and its page.

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TipsAndUpdatesOutlinedIcon from "@mui/icons-material/TipsAndUpdatesOutlined";

import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { assistantName, type AeoRecommendation } from "@/lib/aeo/model";
import { AeoHeader, AeoWaiting, Note, day, int, useAeo } from "../AeoUi";

const PRIORITY = [
  { key: "HIGH", name: "High priority", color: "#c62828", bg: "#fdecea" },
  { key: "MEDIUM", name: "Medium priority", color: "#a96a12", bg: "#fdf3e1" },
  { key: "LOW", name: "Low priority", color: "#5d6b85", bg: "#eef1f5" },
];
const words = (v: string | null) => (v ? v.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : null);

function Rec({ r }: { r: AeoRecommendation }) {
  const chips = [words(r.type), words(r.action), words(r.channel), r.engine ? assistantName(r.engine) : null, words(r.status)].filter(Boolean) as string[];
  return (
    <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "14px", p: 1.5, bgcolor: "#fff", display: "grid", gap: 0.75, minWidth: 0 }}>
      <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK, lineHeight: 1.35 }}>{r.summary ?? words(r.action) ?? "Recommendation"}</Typography>
      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
        {chips.map((c) => <Box key={c} sx={{ fontSize: "0.72rem", fontWeight: 600, color: MUTED, px: 0.9, py: 0.25, borderRadius: "8px", bgcolor: "#eef1f5" }}>{c}</Box>)}
      </Box>
      {r.justification && <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.5 }}>{r.justification}</Typography>}
      <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>
        {r.url ? <Box component="a" href={r.url} target="_blank" rel="noreferrer" sx={{ color: "#2459d1" }}>{r.url}</Box> : r.domain ?? ""}
        {r.promptIds.length ? ` · ${r.promptIds.length} prompt${r.promptIds.length === 1 ? "" : "s"}` : ""}
        {r.startDate ? ` · ${day(r.startDate)}${r.endDate ? ` – ${day(r.endDate)}` : ""}` : ""}
      </Typography>
    </Box>
  );
}

export default function AeoRecommendations() {
  const { value: d, computing, progress, error } = useAeo();
  if (!d) return (<><AeoHeader title="Recommendations" data={null} /><AeoWaiting computing={computing} progress={progress} error={error} /></>);
  const other = d.recommendations.filter((r) => !PRIORITY.some((p) => p.key === r.priority));
  return (
    <>
      <AeoHeader title="Recommendations" data={d} />
      {d.recommendations.length === 0 && <GlassCard><Typography sx={{ fontSize: "0.9rem", color: MUTED }}>HubSpot&apos;s AEO has no recommendations yet.</Typography></GlassCard>}
      {[...PRIORITY.map((p) => ({ ...p, list: d.recommendations.filter((r) => r.priority === p.key) })), { key: "OTHER", name: "Other", color: MUTED, bg: "#eef1f5", list: other }]
        .filter((g) => g.list.length)
        .map((g) => (
          <GlassCard key={g.key} sx={{ display: "grid", gap: 1.25 }}>
            <CardTitle icon={<TipsAndUpdatesOutlinedIcon />} tint={g.key === "HIGH" ? "pink" : g.key === "MEDIUM" ? "amber" : "slate"} title={`${g.name} · ${int(g.list.length)}`} />
            <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" } }}>
              {g.list.map((r) => <Rec key={r.id} r={r} />)}
            </Box>
          </GlassCard>
        ))}
      <Note>From HubSpot&apos;s AEO (beta). Act on them in HubSpot or in the shop&apos;s content; this page reads, it does not change anything.</Note>
    </>
  );
}
