"use client";
// ADVANCED REPORTING > DIGITAL GROWTH REPORTS > AI VISIBILITY (SARCLA 17.10: "with this data
// can we now build on the advanced reporting"): what ChatGPT, Gemini and Perplexity say about
// us, from the AEO answers the hub keeps - the AI answers overview (shared body, with who the
// assistants cite), then prompt by prompt: HubSpot's visibility score, how often we are named
// and cited, and the move against the 30 days before.

import { useMemo, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import QuestionAnswerOutlinedIcon from "@mui/icons-material/QuestionAnswerOutlined";

import PageHeader from "@/app/PageHeader";
import { GUTTER } from "@/app/analytics/Shell";
import { CardTitle, FAINT, GREEN, GlassCard, HAIRLINE, INK, MUTED, RED } from "@/app/uc/report/ui";
import { useSlow } from "@/app/reporting/marketing-kpis/data";
import { useCanOpen } from "@/app/reporting/useCanOpen";
import { AeoWaiting, Note, day, int, pct } from "@/app/aeo/AeoUi";
import { AeoOverviewBody } from "@/app/aeo/OverviewBody";
import { byPrompt, citeRate, mentionRate, namesIn, shareOfVoice, sumsBetween, type AeoData } from "@/lib/aeo/model";

const DAY = 86_400_000;
type Col = "prompt" | "visibility" | "answers" | "named" | "change" | "voice" | "cited";
const COLS: { key: Col; name: string; right?: boolean }[] = [
  { key: "prompt", name: "Prompt" },
  { key: "visibility", name: "HubSpot visibility", right: true },
  { key: "answers", name: "Answers", right: true },
  { key: "named", name: "Named APSO", right: true },
  { key: "change", name: "Change", right: true },
  { key: "voice", name: "Share of voice", right: true },
  { key: "cited", name: "Cite our pages", right: true },
];
const points = (x: number | null) => (x == null ? "—" : `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x * 100).toFixed(1)} pts`);

function PromptTable({ d }: { d: AeoData }) {
  const [sort, setSort] = useState<{ col: Col; desc: boolean }>({ col: "named", desc: true });
  const { rows, total } = useMemo(() => {
    const now = Date.now();
    const to = new Date(now).toISOString(), from = new Date(now - 30 * DAY).toISOString(), before = new Date(now - 60 * DAY).toISOString();
    const cur = byPrompt(d.runs, from, to), prev = byPrompt(d.runs, before, from);
    const rows = d.prompts.map((p) => {
      const c = cur[p.id], b = prev[p.id];
      const named = c ? mentionRate(c) : null, was = b ? mentionRate(b) : null;
      return {
        id: p.id, prompt: p.prompt, phase: p.phase, visibility: p.visibility, answers: c?.answers ?? 0, named,
        change: named != null && was != null ? named - was : null, voice: c ? shareOfVoice(c) : null, cited: c ? citeRate(c) : null,
      };
    });
    const all = sumsBetween(d.runs, from, to).all, allPrev = sumsBetween(d.runs, before, from).all;
    const tn = mentionRate(all), tw = mentionRate(allPrev);
    const vis = d.prompts.map((p) => p.visibility).filter((v): v is number => v != null);
    return {
      rows,
      total: {
        visibility: vis.length ? vis.reduce((a, b) => a + b, 0) / vis.length : null, answers: all.answers, named: tn,
        change: tn != null && tw != null ? tn - tw : null, voice: shareOfVoice(all), cited: citeRate(all),
      },
    };
  }, [d]);
  const sorted = [...rows].sort((a, b) => {
    const x = a[sort.col], y = b[sort.col];
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    const r = typeof x === "string" ? x.localeCompare(String(y)) : (x as number) - (y as number);
    return sort.desc ? -r : r;
  });
  const cols = "minmax(280px, 3fr) repeat(6, minmax(104px, 1fr))";
  const cell = (right?: boolean) => ({ fontSize: "0.86rem", color: INK, textAlign: right ? "right" : "left", fontVariantNumeric: "tabular-nums", py: 1, px: 0.75 }) as const;
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25 }}>
      <CardTitle icon={<QuestionAnswerOutlinedIcon />} tint="blue" title="Prompt by prompt, last 30 days" note="Against the 30 days before · click a heading to sort" />
      <Box sx={{ overflowX: "auto" }}>
        <Box role="table" sx={{ minWidth: 920, display: "grid", gridTemplateColumns: cols, alignItems: "center" }}>
          {COLS.map((c) => {
            const on = sort.col === c.key;
            return (
              <Box key={c.key} role="columnheader" component="button" type="button" onClick={() => setSort({ col: c.key, desc: on ? !sort.desc : c.key !== "prompt" })}
                sx={{ ...cell(c.right), border: 0, bgcolor: "transparent", font: "inherit", cursor: "pointer", fontSize: "0.72rem", fontWeight: 700, color: on ? INK : FAINT, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: `1px solid ${HAIRLINE}` }}>
                {c.name}{on ? (sort.desc ? " ↓" : " ↑") : ""}
              </Box>
            );
          })}
          {sorted.map((r) => (
            <Box key={r.id} role="row" sx={{ display: "contents", "& > *": { borderBottom: `1px solid ${HAIRLINE}` } }}>
              <Box sx={cell()}>
                <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK, lineHeight: 1.35 }}>{r.prompt}</Typography>
                {r.phase && <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>{r.phase}</Typography>}
              </Box>
              <Typography sx={cell(true)}>{pct(r.visibility)}</Typography>
              <Typography sx={cell(true)}>{int(r.answers)}</Typography>
              <Typography sx={{ ...cell(true), fontWeight: 700, color: r.named ? GREEN : r.named === 0 ? RED : FAINT }}>{pct(r.named)}</Typography>
              <Typography sx={{ ...cell(true), color: r.change == null ? FAINT : r.change > 0 ? GREEN : r.change < 0 ? RED : MUTED }}>{points(r.change)}</Typography>
              <Typography sx={cell(true)}>{pct(r.voice)}</Typography>
              <Typography sx={cell(true)}>{pct(r.cited)}</Typography>
            </Box>
          ))}
          <Box role="row" sx={{ display: "contents", "& > *": { fontWeight: 800, bgcolor: "#f4f7fc" } }}>
            <Typography sx={{ ...cell(), fontWeight: 800 }}>All {int(rows.length)} prompts</Typography>
            <Typography sx={{ ...cell(true), fontWeight: 800 }} title="The average of HubSpot's scores">{pct(total.visibility)}</Typography>
            <Typography sx={{ ...cell(true), fontWeight: 800 }}>{int(total.answers)}</Typography>
            <Typography sx={{ ...cell(true), fontWeight: 800 }}>{pct(total.named)}</Typography>
            <Typography sx={{ ...cell(true), fontWeight: 800, color: total.change == null ? FAINT : total.change > 0 ? GREEN : total.change < 0 ? RED : MUTED }}>{points(total.change)}</Typography>
            <Typography sx={{ ...cell(true), fontWeight: 800 }}>{pct(total.voice)}</Typography>
            <Typography sx={{ ...cell(true), fontWeight: 800 }}>{pct(total.cited)}</Typography>
          </Box>
        </Box>
      </Box>
      <Note>
        Named APSO: the share of the answers that named APSO. Change: that share against the 30 days before, in percentage points.
        Share of voice: APSO&apos;s mentions against everyone&apos;s. Cite our pages: the share of answers (whose sources are read) citing
        apsoparts.com or angst-pfister.com. HubSpot visibility: HubSpot&apos;s own score for the prompt; the total is their average.
      </Note>
    </GlassCard>
  );
}

export default function AiVisibilityReport() {
  const { value: d, computing, progress, error } = useSlow<AeoData>("/api/reporting/aeo", "aeo");
  const canOpen = useCanOpen();
  const sub = d
    ? `What ${namesIn(d.runs)} answer to the ${int(d.prompts.length)} prompts in HubSpot's AEO · ${int(d.runs.length)} answers kept in the hub${d.since ? ` since ${day(d.since)}` : ""} · read ${day(d.generatedAt)}`
    : "What the AI assistants answer to the prompts in HubSpot's AEO";
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader title="AI visibility (AEO)" subtitle={sub} />
      {!d ? <AeoWaiting computing={computing} progress={progress} error={error} /> : (
        <>
          <AeoOverviewBody d={d} computing={computing} progress={progress} />
          <PromptTable d={d} />
          {canOpen("/aeo/recommendations") && d.recommendations.length > 0 && (
            <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>
              {int(d.recommendations.length)} recommendation{d.recommendations.length === 1 ? "" : "s"} from HubSpot&apos;s AEO, each ready to become content:{" "}
              <Box component={Link} href="/aeo/recommendations" sx={{ color: "#2459d1", fontWeight: 700 }}>open the recommendations</Box>
            </Typography>
          )}
        </>
      )}
    </Box>
  );
}
