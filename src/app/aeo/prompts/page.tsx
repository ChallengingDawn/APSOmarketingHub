"use client";
// AI ANSWERS (AEO) - PROMPTS AND ANSWERS: every prompt in HubSpot's AEO, and what each
// assistant answered last - named APSO or not, named competitors, cited our pages. A
// prompt opens to the answers themselves, read from HubSpot when opened.

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import InputBase from "@mui/material/InputBase";
import CircularProgress from "@mui/material/CircularProgress";
import SearchIcon from "@mui/icons-material/Search";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import QuestionAnswerOutlinedIcon from "@mui/icons-material/QuestionAnswerOutlined";

import { CardTitle, FAINT, GREEN, GlassCard, HAIRLINE, INK, MUTED, RED } from "@/app/uc/report/ui";
import { assistantName, assistantsIn, isOwnUrl, latestByPrompt, type AeoRun } from "@/lib/aeo/model";
import { AeoHeader, AeoWaiting, Note, day, int, pct, useAeo } from "../AeoUi";

type Detail = { responseText: string | null; citations: { url: string; title: string | null }[]; searchQueries: string[] };

/** One assistant's latest answer, read when the prompt is opened. */
function Answer({ run }: { run: AeoRun }) {
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/aeo/runs/${encodeURIComponent(run.id)}`).then((r) => r.json()).then((j) => {
      if (!alive) return;
      if (j?.ok) setD(j.run); else setErr(j?.error ?? "could not be read");
    }).catch((e) => alive && setErr(String(e)));
    return () => { alive = false; };
  }, [run.id]);
  return (
    <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "14px", p: 1.5, bgcolor: "#fff", minWidth: 0 }}>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 0.75, flexWrap: "wrap" }}>
        <Typography sx={{ fontSize: "0.9rem", fontWeight: 800, color: INK }}>{assistantName(run.model)}</Typography>
        <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>{day(run.at)} · {run.owned ? `named APSO ${run.owned}×` : "did not name APSO"} · competitors {run.competitor}× · {run.citations} sources</Typography>
      </Box>
      {!d && !err && <CircularProgress size={16} />}
      {err && <Typography sx={{ fontSize: "0.8rem", color: RED }}>{err}</Typography>}
      {d && (
        <>
          <Typography sx={{ fontSize: "0.84rem", color: INK, whiteSpace: "pre-wrap", lineHeight: 1.55, maxHeight: 260, overflowY: "auto", pr: 1 }}>{d.responseText ?? "—"}</Typography>
          {d.citations.length > 0 && (
            <Box sx={{ mt: 1, display: "grid", gap: 0.35 }}>
              <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.04em" }}>Sources</Typography>
              {d.citations.map((c, i) => (
                <Box key={`${c.url}-${i}`} component="a" href={c.url} target="_blank" rel="noreferrer" sx={{ fontSize: "0.78rem", color: isOwnUrl(c.url) ? GREEN : MUTED, fontWeight: isOwnUrl(c.url) ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {isOwnUrl(c.url) ? "● " : ""}{c.title || c.url}
                </Box>
              ))}
            </Box>
          )}
        </>
      )}
    </Box>
  );
}

export default function AeoPrompts() {
  const { value: d, computing, progress, error } = useAeo();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const latest = useMemo(() => (d ? latestByPrompt(d.runs) : new Map<string, Map<string, AeoRun>>()), [d]);
  if (!d) return (<><AeoHeader title="Prompts and answers" data={null} /><AeoWaiting computing={computing} progress={progress} error={error} /></>);
  const used = assistantsIn(d.runs);
  const rows = d.prompts.filter((p) => !q || p.prompt.toLowerCase().includes(q.toLowerCase()));
  const cols = `minmax(260px, 2.4fr) 96px repeat(${used.length}, minmax(130px, 1fr)) 28px`;
  return (
    <>
      <AeoHeader title="Prompts and answers" data={d} />
      <GlassCard sx={{ display: "grid", gap: 1.25 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          <Box sx={{ flex: 1, minWidth: 240 }}><CardTitle icon={<QuestionAnswerOutlinedIcon />} tint="blue" title={`${int(rows.length)} prompts`} note="Each assistant's latest answer - open a prompt to read them" /></Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 1.25, height: 36, minWidth: 260, borderRadius: "10px", bgcolor: "#fff", border: "1px solid rgba(21,34,58,.14)" }}>
            <SearchIcon sx={{ fontSize: 18, color: MUTED }} />
            <InputBase value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a prompt…" inputProps={{ "aria-label": "Find a prompt" }} sx={{ fontSize: "0.86rem", flex: 1 }} />
          </Box>
        </Box>
        <Box sx={{ overflowX: "auto" }}>
          <Box sx={{ minWidth: 370 + used.length * 140, display: "grid", gridTemplateColumns: cols, columnGap: 1.5, alignItems: "center" }}>
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.04em", pb: 0.75 }}>Prompt</Typography>
            <Typography title="HubSpot's own visibility score for the prompt" sx={{ fontSize: "0.72rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.04em", pb: 0.75 }}>Visibility</Typography>
            {used.map((a) => <Typography key={a} sx={{ fontSize: "0.72rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.04em", pb: 0.75 }}>{assistantName(a)}</Typography>)}
            <Box />
            {rows.map((p) => {
              const l = latest.get(p.id);
              const on = open === p.id;
              return (
                <Box key={p.id} sx={{ display: "contents" }}>
                  <Box component="button" type="button" onClick={() => setOpen(on ? null : p.id)} aria-expanded={on}
                    sx={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: cols, columnGap: 1.5, alignItems: "center", textAlign: "left", border: 0, borderTop: `1px solid ${HAIRLINE}`, bgcolor: on ? "#f4f7fc" : "transparent", font: "inherit", cursor: "pointer", py: 1, px: 0.5, borderRadius: on ? "10px 10px 0 0" : 0, "&:hover": { bgcolor: "#f7f9fc" } }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: "0.88rem", fontWeight: 600, color: INK, lineHeight: 1.35 }}>{p.prompt}</Typography>
                      <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>{[p.phase, p.language].filter(Boolean).join(" · ")}</Typography>
                    </Box>
                    <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: p.visibility ? INK : FAINT, fontVariantNumeric: "tabular-nums" }}>{p.visibility == null ? "—" : pct(p.visibility)}</Typography>
                    {used.map((a) => {
                      const r = l?.get(a);
                      return (
                        <Box key={a}>
                          {!r ? <Typography sx={{ fontSize: "0.8rem", color: FAINT }}>—</Typography> : (
                            <>
                              <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: r.owned ? GREEN : RED }}>{r.owned ? `✓ named ${r.owned}×` : "✗ not named"}</Typography>
                              <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>competitors {r.competitor}× · {r.ownCited == null ? "sources not read yet" : r.ownCited ? "cites us" : "does not cite us"}</Typography>
                            </>
                          )}
                        </Box>
                      );
                    })}
                    <ExpandMoreIcon sx={{ fontSize: 20, color: FAINT, transform: on ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
                  </Box>
                  {on && (
                    <Box sx={{ gridColumn: "1 / -1", display: "grid", gap: 1, gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: `repeat(${Math.max(1, l?.size ?? 1)}, minmax(0, 1fr))` }, p: 1.25, bgcolor: "#f4f7fc", borderRadius: "0 0 10px 10px" }}>
                      {l && l.size ? [...l.values()].map((r) => <Answer key={r.id} run={r} />) : <Typography sx={{ fontSize: "0.84rem", color: FAINT }}>No answer yet.</Typography>}
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
      </GlassCard>
      <Note>The latest answer per assistant. Visibility is HubSpot&apos;s own score for the prompt. Our own pages (apsoparts.com, angst-pfister.com) are marked green among the sources.</Note>
    </>
  );
}
