"use client";
// AI ANSWERS (AEO) - RECOMMENDATIONS: what HubSpot's AEO suggests doing so the
// assistants name and cite us more - by priority, each with its reason, the pages the
// assistants cite today (the ones to beat), and a button that makes it a Content Studio
// project with the brief already written (SARCLA 17.10: "create the advised point directly").

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import FolderOpenOutlinedIcon from "@mui/icons-material/FolderOpenOutlined";
import TipsAndUpdatesOutlinedIcon from "@mui/icons-material/TipsAndUpdatesOutlined";

import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, MUTED, RED } from "@/app/uc/report/ui";
import { assistantName, hostOf, projectFor, type AeoPrompt, type AeoRecommendation } from "@/lib/aeo/model";
import { AeoHeader, AeoWaiting, Note, day, int, useAeo } from "../AeoUi";

const PRIORITY = [
  { key: "HIGH", name: "High priority", color: "#c62828", bg: "#fdecea" },
  { key: "MEDIUM", name: "Medium priority", color: "#a96a12", bg: "#fdf3e1" },
  { key: "LOW", name: "Low priority", color: "#5d6b85", bg: "#eef1f5" },
];
const words = (v: string | null) => (v ? v.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : null);

/** The projects already made from a recommendation, recommendation id -> project id. */
function useMadeProjects(): Record<string, number> {
  const [made, setMade] = useState<Record<string, number>>({});
  useEffect(() => {
    let live = true;
    fetch("/api/content/projects?scope=visible").then((r) => r.json()).then((j: { ok?: boolean; projects?: { id: number; brief: string | null }[] }) => {
      if (!live || !j.ok) return;
      const out: Record<string, number> = {};
      for (const p of j.projects ?? []) {
        const m = /\[AEO recommendation ([^\]]+)\]/.exec(p.brief ?? "");
        if (m && !out[m[1]]) out[m[1]] = p.id;
      }
      setMade(out);
    }).catch(() => { /* the button still makes one */ });
    return () => { live = false; };
  }, []);
  return made;
}

function Rec({ r, prompts, madeId }: { r: AeoRecommendation; prompts: AeoPrompt[]; madeId?: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const chips = [words(r.type), words(r.action), words(r.channel), r.engine ? assistantName(r.engine) : null, words(r.status)].filter(Boolean) as string[];
  const p = projectFor(r, prompts);
  const beat = [...new Set(r.influencing.map(hostOf).filter((x): x is string => !!x))];
  const create = async () => {
    setBusy(true); setErr(null);
    try {
      const j = await fetch("/api/content/projects", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: p.title, brief: p.brief, contentType: p.contentType ?? undefined }),
      }).then((x) => x.json());
      if (!j.ok) { setErr(j.error ?? "The project could not be made."); setBusy(false); return; }
      router.push(`/create?project=${j.project.id}${p.contentType ? `&type=${p.contentType}` : ""}`);
    } catch {
      setErr("The project could not be made."); setBusy(false);
    }
  };
  return (
    <Box data-rec={r.id} sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "14px", p: 1.5, bgcolor: "#fff", display: "grid", gap: 0.75, minWidth: 0, alignContent: "start" }}>
      <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: INK, lineHeight: 1.35 }}>{r.topic ?? r.summary ?? words(r.action) ?? "Recommendation"}</Typography>
      {r.topic && r.summary && <Typography sx={{ fontSize: "0.86rem", color: INK, lineHeight: 1.45 }}>{r.summary}</Typography>}
      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
        {chips.map((c) => <Box key={c} sx={{ fontSize: "0.72rem", fontWeight: 600, color: MUTED, px: 0.9, py: 0.25, borderRadius: "8px", bgcolor: "#eef1f5" }}>{c}</Box>)}
      </Box>
      {r.justification && <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.5 }}>{r.justification}</Typography>}
      {beat.length > 0 && (
        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", alignItems: "center" }}>
          <Typography component="span" sx={{ fontSize: "0.74rem", fontWeight: 700, color: MUTED, mr: 0.25 }}>Pages to beat:</Typography>
          {beat.slice(0, 8).map((h) => {
            const url = r.influencing.find((u) => hostOf(u) === h)!;
            return <Box key={h} component="a" href={url} target="_blank" rel="noreferrer" sx={{ fontSize: "0.72rem", fontWeight: 600, color: "#2459d1", px: 0.8, py: 0.2, borderRadius: "8px", bgcolor: "#eef3fd", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>{h}</Box>;
          })}
          {beat.length > 8 && <Typography component="span" sx={{ fontSize: "0.72rem", color: FAINT }}>+{beat.length - 8}</Typography>}
        </Box>
      )}
      <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>
        {r.url ? <Box component="a" href={r.url} target="_blank" rel="noreferrer" sx={{ color: "#2459d1" }}>{r.url}</Box> : r.domain ?? ""}
        {[r.url || r.domain ? "" : null, r.promptIds.length ? `${r.promptIds.length} prompt${r.promptIds.length === 1 ? "" : "s"}` : null,
          r.startDate ? `${day(r.startDate)}${r.endDate ? ` – ${day(r.endDate)}` : ""}` : null].filter((x) => x !== null).join(" · ")}
      </Typography>
      {p.contentType && (
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", mt: 0.25 }}>
          {madeId ? (
            <Button component={Link} href={`/projects/${madeId}`} size="small" variant="outlined" startIcon={<FolderOpenOutlinedIcon />}
              sx={{ textTransform: "none", fontWeight: 700, borderRadius: "10px" }}>Open the project</Button>
          ) : (
            <Button onClick={create} disabled={busy} size="small" variant="contained" disableElevation startIcon={<AutoAwesomeOutlinedIcon />}
              sx={{ textTransform: "none", fontWeight: 700, borderRadius: "10px" }}>{busy ? "Making the project…" : "Create this content"}</Button>
          )}
          {err && <Typography sx={{ fontSize: "0.78rem", color: RED }}>{err}</Typography>}
        </Box>
      )}
    </Box>
  );
}

export default function AeoRecommendations() {
  const { value: d, computing, progress, error } = useAeo();
  const made = useMadeProjects();
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
              {g.list.map((r) => <Rec key={r.id} r={r} prompts={d.prompts} madeId={made[r.id]} />)}
            </Box>
          </GlassCard>
        ))}
      <Note>
        From HubSpot&apos;s AEO (beta). &quot;Create this content&quot; makes a Content Studio project with the brief written from the
        recommendation - the topic, the questions it must answer and the pages to beat - and opens it to write. Nothing changes in HubSpot.
      </Note>
    </>
  );
}
