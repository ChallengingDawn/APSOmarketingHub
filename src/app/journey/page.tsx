"use client";

// THE JOURNEY BOARD.
//
// One column per stage, the buyer's steps at the top of it, then lanes of cards:
// the touchpoints that carry the stage, the ways we lose people, the questions
// the business wants answered, the KPIs, the ideas. Cards are editable — add,
// reword, tick off, delete — because a journey is worked on, not read.
//
// Each stage also carries its live numbers, so the board is a working surface
// and a measurement at the same time.

import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import Tooltip from "@mui/material/Tooltip";
import AddIcon from "@mui/icons-material/Add";
import InsightsIcon from "@mui/icons-material/Insights";
import Drawer from "@mui/material/Drawer";
import CloseIcon from "@mui/icons-material/Close";
import { HAIRLINE, INK, MUTED, Section } from "@/app/analytics/Shell";
import { ITEM_KINDS, ITEM_STATUS, statusOf, type JourneyItem, type JourneyItemKind, type JourneyItemStatus, type JourneyModel } from "@/lib/journey/model";
import type { JourneyMetrics } from "@/lib/journey/metrics";
import { full, percent } from "@/app/charts/format";

const LANES = Object.entries(ITEM_KINDS) as [JourneyItemKind, string][];
const LANE_TONE: Partial<Record<JourneyItemKind, string>> = { risk: "#9e1b18", kpi: "#1b4a80" };

/** Not started → on track → needs improvement → done, and round again. */
const STATUS_ORDER: JourneyItemStatus[] = ["open", "ontrack", "attention", "done"];

/** One accent per stage, in the order the buyer moves through them. */
const ACCENTS = ["#0a84ff", "#5e5ce6", "#30b0c7", "#ff9f0a", "#ff375f", "#34c759"];
const tint = (hex: string, alpha: number) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};
const STATUS_STYLE: Record<JourneyItemStatus, { dot: string; bg: string; fg: string }> = {
  open: { dot: "#c7ccd4", bg: "#f3f4f6", fg: "#5b6472" },
  ontrack: { dot: "#34c759", bg: "#e8f6ec", fg: "#155d33" },
  attention: { dot: "#ff9f0a", bg: "#fdf4e3", fg: "#7a5b12" },
  done: { dot: "#0a84ff", bg: "#e8f1fd", fg: "#1b4a80" },
};

export default function JourneyBoardPage() {
  const [model, setModel] = useState<JourneyModel | null>(null);
  const [metrics, setMetrics] = useState<JourneyMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState<string | null>(null);   // `${stageId}|${kind}`
  const [kpiStage, setKpiStage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/journey")
      .then((r) => r.json())
      .then((j) => setModel(j?.model ?? null))
      .catch(() => setError("The journey could not be read."));
    fetch("/api/journey/metrics")
      .then((r) => r.json())
      .then((j) => { if (j?.ok && j.data) setMetrics(j.data as JourneyMetrics); })
      .catch(() => {});
  }, []);

  const act = useCallback(async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/journey/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json?.ok && json.model) setModel(json.model as JourneyModel);
      else setError(json?.error ?? "The change was not saved.");
    } catch (err) {
      setError(String((err as Error)?.message ?? err));
    } finally {
      setBusy(false);
    }
  }, []);

  if (!model) return <Typography sx={{ color: MUTED }}>{error ?? "Reading the journey…"}</Typography>;

  const stages = [...model.stages].sort((a, b) => a.position - b.position);

  return (
    <Box>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", mb: 2 }}>
        <Chip
          size="small"
          label={`${stages.length} stages · ${model.steps.length} steps · ${model.items.length} cards`}
          sx={{ bgcolor: "#e3edf7", color: "#1b4a80", fontWeight: 600 }}
        />
        {metrics && (
          <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>Numbers cover {metrics.from} to {metrics.to}</Typography>
        )}
        {model.source.lastEditedBy && (
          <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>· last edited by {model.source.lastEditedBy}</Typography>
        )}
        {error && <Typography sx={{ fontSize: "0.78rem", color: "#9e1b18" }}>{error}</Typography>}
      </Box>

      <Box
        sx={{
          display: "grid",
          // Wide screens share the width between the stages; narrow ones scroll.
          gridAutoFlow: { xs: "column", xl: "row" },
          gridAutoColumns: { xs: "minmax(300px, 340px)", xl: "unset" },
          gridTemplateColumns: { xs: "none", xl: `repeat(${stages.length}, minmax(0, 1fr))` },
          gap: 2,
          overflowX: { xs: "auto", xl: "visible" },
          pb: 2,
          alignItems: "start",
        }}
      >
        {stages.map((stage, stageIndex) => {
          const accent = ACCENTS[stageIndex % ACCENTS.length];
          const steps = model.steps.filter((s) => s.stageId === stage.id);
          const measured = steps
            .map((s) => ({ step: s, metric: metrics?.steps.find((m) => m.stepIndex === s.index) }))
            .filter((x) => x.metric?.value != null);
          return (
            <Box key={stage.id} sx={{ minWidth: 0 }}>
              <Section sx={{ p: 0, overflow: "hidden", borderTop: `3px solid ${accent}` }}>
                <Box sx={{ p: 2, bgcolor: tint(accent, 0.06) }}>
                  <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: 0.6 }}>
                        Stage {stageIndex + 1}
                      </Typography>
                      <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: INK, lineHeight: 1.25, mt: 0.25 }}>
                        {stage.name.split("–")[0].trim()}
                      </Typography>
                      {stage.description && (
                        <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 0.5, lineHeight: 1.4 }}>{stage.description}</Typography>
                      )}
                    </Box>
                    <Tooltip title="The KPIs for this stage, with what we can measure" describeChild>
                      <Box
                        component="button"
                        onClick={() => setKpiStage(stage.id)}
                        aria-label={`KPIs for ${stage.name}`}
                        sx={{
                          flex: "0 0 auto",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 0.5,
                          px: 1.1,
                          py: 0.6,
                          border: "none",
                          cursor: "pointer",
                          borderRadius: 99,
                          bgcolor: accent,
                          color: "#fff",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          fontFamily: "inherit",
                          "&:hover": { filter: "brightness(0.94)" },
                        }}
                      >
                        <InsightsIcon sx={{ fontSize: 14 }} />
                        KPIs
                      </Box>
                    </Tooltip>
                  </Box>
                  {stage.objective && (
                    <Typography sx={{ fontSize: "0.78rem", color: INK, mt: 1.25, fontWeight: 600 }}>{stage.objective}</Typography>
                  )}
                  {stage.mindset && (
                    <Typography sx={{ fontSize: "0.78rem", color: MUTED, mt: 0.5, fontStyle: "italic" }}>“{stage.mindset}”</Typography>
                  )}
                </Box>
                <Box sx={{ p: 2, pt: 1.5 }}>

                <Box sx={{ mt: 1.5, display: "grid", gap: 0.5 }}>
                  {steps.map((step) => {
                    const metric = metrics?.steps.find((m) => m.stepIndex === step.index);
                    return (
                      <Box key={step.index} sx={{ display: "flex", gap: 1, alignItems: "baseline" }}>
                        <Typography sx={{ fontSize: "0.7rem", color: MUTED, minWidth: 16 }}>{step.index}</Typography>
                        <Typography sx={{ fontSize: "0.78rem", color: INK, flexGrow: 1, lineHeight: 1.35 }}>{step.label}</Typography>
                        {metric?.value != null ? (
                          <Tooltip title={`${metric.unit}${metric.note ? ` — ${metric.note}` : ""}`} describeChild>
                            <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: INK, whiteSpace: "nowrap" }}>
                              {full(metric.value)}
                            </Typography>
                          </Tooltip>
                        ) : (
                          <Tooltip title={metric?.gap ?? "nothing measures this yet"} describeChild>
                            <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>—</Typography>
                          </Tooltip>
                        )}
                      </Box>
                    );
                  })}
                  {measured.length >= 2 && (
                    <Typography sx={{ fontSize: "0.7rem", color: MUTED, mt: 0.5 }}>
                      {percent((measured[measured.length - 1].metric!.value as number) / (measured[0].metric!.value as number))} of
                      step {measured[0].step.index} reach step {measured[measured.length - 1].step.index}
                    </Typography>
                  )}
                </Box>
                </Box>
              </Section>

              {LANES.map(([kind, label]) => {
                const cards = model.items
                  .filter((i) => i.stageId === stage.id && i.kind === kind)
                  .sort((a, b) => a.order - b.order);
                const addKey = `${stage.id}|${kind}`;
                return (
                  <Box key={kind} sx={{ mt: 1.5 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
                      <Typography
                        sx={{ fontSize: "0.68rem", fontWeight: 700, color: LANE_TONE[kind] ?? MUTED, textTransform: "uppercase", letterSpacing: 0.4 }}
                      >
                        {label}
                      </Typography>
                      <Typography sx={{ fontSize: "0.68rem", color: MUTED }}>{cards.length}</Typography>
                      <Box sx={{ flexGrow: 1 }} />
                      <IconButton size="small" aria-label={`Add to ${label} in ${stage.name}`} onClick={() => { setAdding(addKey); setDraft(""); }}>
                        <AddIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Box>

                    <Box sx={{ display: "grid", gap: 0.5 }}>
                      {cards.map((card) => (
                        <Card
                          key={card.id}
                          card={card}
                          editing={editing === card.id}
                          draft={draft}
                          busy={busy}
                          onDraft={setDraft}
                          onStartEdit={() => { setEditing(card.id); setDraft(card.text); }}
                          onCancel={() => setEditing(null)}
                          onSave={async () => { await act({ action: "edit", id: card.id, text: draft }); setEditing(null); }}
                          onCycleStatus={() => {
                            const now = statusOf(card);
                            const next = STATUS_ORDER[(STATUS_ORDER.indexOf(now) + 1) % STATUS_ORDER.length];
                            return act({ action: "status", id: card.id, status: next });
                          }}
                          onDelete={() => act({ action: "delete", id: card.id })}
                        />
                      ))}

                      {adding === addKey && (
                        <Box sx={{ display: "flex", gap: 0.5, p: 0.75, borderRadius: 1.5, border: `1px dashed ${HAIRLINE}`, bgcolor: "#fff" }}>
                          <InputBase
                            autoFocus
                            multiline
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={async (e) => {
                              if (e.key === "Escape") setAdding(null);
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                if (draft.trim()) await act({ action: "add", stageId: stage.id, kind, text: draft });
                                setAdding(null);
                              }
                            }}
                            placeholder="Add a card, Enter to save"
                            sx={{ fontSize: "0.78rem", flexGrow: 1 }}
                          />
                          <IconButton size="small" aria-label="Cancel" onClick={() => setAdding(null)}>
                            <CloseIcon sx={{ fontSize: 15 }} />
                          </IconButton>
                        </Box>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          );
        })}
      </Box>

      <KpiPanel
        model={model}
        metrics={metrics}
        stageId={kpiStage}
        accentOf={(id) => ACCENTS[model.stages.findIndex((s) => s.id === id) % ACCENTS.length]}
        onClose={() => setKpiStage(null)}
      />
    </Box>
  );
}

/** What this stage is supposed to be judged on, and what of it we can actually see. */
function KpiPanel({
  model, metrics, stageId, accentOf, onClose,
}: {
  model: JourneyModel;
  metrics: JourneyMetrics | null;
  stageId: string | null;
  accentOf: (id: string) => string;
  onClose: () => void;
}) {
  const stage = model.stages.find((s) => s.id === stageId) ?? null;
  const accent = stage ? accentOf(stage.id) : "#0a84ff";
  const kpis = stage ? model.items.filter((i) => i.stageId === stage.id && i.kind === "kpi") : [];
  const steps = stage ? model.steps.filter((s) => s.stageId === stage.id) : [];

  return (
    <Drawer anchor="right" open={Boolean(stage)} onClose={onClose} PaperProps={{ sx: { width: { xs: "100%", sm: 460 } } }}>
      {stage && (
        <Box sx={{ p: 3 }}>
          <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: 0.6 }}>
            KPIs for this stage
          </Typography>
          <Typography sx={{ fontSize: "1.15rem", fontWeight: 700, color: INK, mt: 0.5 }}>{stage.name}</Typography>
          {stage.objective && <Typography sx={{ fontSize: "0.82rem", color: MUTED, mt: 0.5 }}>{stage.objective}</Typography>}

          <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4, mt: 3, mb: 1 }}>
            What we can measure today
          </Typography>
          {steps.map((step) => {
            const metric = metrics?.steps.find((m) => m.stepIndex === step.index);
            return (
              <Box key={step.index} sx={{ display: "flex", gap: 1.5, py: 1, borderBottom: `1px solid ${HAIRLINE}`, alignItems: "baseline" }}>
                <Typography sx={{ fontSize: "0.72rem", color: MUTED, minWidth: 18 }}>{step.index}</Typography>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.82rem", color: INK }}>{step.label}</Typography>
                  <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>
                    {metric?.value != null ? `${metric.unit}${metric.note ? ` · ${metric.note}` : ""}` : metric?.gap ?? "nothing measures this yet"}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: metric?.value != null ? INK : MUTED, whiteSpace: "nowrap" }}>
                  {metric?.value != null ? full(metric.value) : "—"}
                </Typography>
              </Box>
            );
          })}

          <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4, mt: 3, mb: 1 }}>
            KPIs the business asked for ({kpis.length})
          </Typography>
          {kpis.length === 0 ? (
            <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>None listed for this stage yet. Add them on the board.</Typography>
          ) : (
            <Box sx={{ display: "grid", gap: 0.75 }}>
              {kpis.map((kpi) => {
                const status = statusOf(kpi);
                return (
                  <Box key={kpi.id} sx={{ display: "flex", gap: 1, alignItems: "flex-start", p: 1, borderRadius: 1.5, bgcolor: STATUS_STYLE[status].bg }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: STATUS_STYLE[status].dot, mt: 0.75, flex: "0 0 auto" }} />
                    <Box>
                      <Typography sx={{ fontSize: "0.82rem", color: INK }}>{kpi.text}</Typography>
                      <Typography sx={{ fontSize: "0.7rem", color: STATUS_STYLE[status].fg, fontWeight: 600 }}>{ITEM_STATUS[status]}</Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}

          {metrics && (
            <Typography sx={{ fontSize: "0.72rem", color: MUTED, mt: 3 }}>
              Figures cover {metrics.from} to {metrics.to}, from GA4 and HubSpot. A KPI with no figure has no source yet — that is
              the gap to close, not a number to invent.
            </Typography>
          )}
        </Box>
      )}
    </Drawer>
  );
}

function Card({
  card, editing, draft, busy, onDraft, onStartEdit, onCancel, onSave, onCycleStatus, onDelete,
}: {
  card: JourneyItem;
  editing: boolean;
  draft: string;
  busy: boolean;
  onDraft: (value: string) => void;
  onStartEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onCycleStatus: () => void;
  onDelete: () => void;
}) {
  const status = statusOf(card);
  if (editing) {
    return (
      <Box sx={{ display: "flex", gap: 0.5, p: 0.75, borderRadius: 1.5, border: `1px solid ${HAIRLINE}`, bgcolor: "#fff" }}>
        <InputBase
          autoFocus
          multiline
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onCancel();
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSave(); }
          }}
          sx={{ fontSize: "0.78rem", flexGrow: 1 }}
        />
        <IconButton size="small" aria-label="Cancel" onClick={onCancel}><CloseIcon sx={{ fontSize: 15 }} /></IconButton>
      </Box>
    );
  }
  return (
    <Box
      sx={{
        display: "flex",
        gap: 0.5,
        alignItems: "flex-start",
        p: 0.75,
        borderRadius: 1.5,
        border: `1px solid ${HAIRLINE}`,
        bgcolor: status === "done" ? "#fbfcfe" : "#fff",
        opacity: busy ? 0.7 : 1,
        "&:hover .card-actions": { opacity: 1 },
      }}
    >
      <Tooltip title={`${ITEM_STATUS[status]} — click to change`} describeChild>
        <IconButton size="small" aria-label={`Status: ${ITEM_STATUS[status]}`} onClick={onCycleStatus} sx={{ p: 0.4 }}>
          <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: STATUS_STYLE[status].dot, boxShadow: status === "open" ? "inset 0 0 0 1.5px #b9bfc9" : "none" }} />
        </IconButton>
      </Tooltip>
      <Typography
        onClick={onStartEdit}
        sx={{
          fontSize: "0.78rem",
          color: status === "done" ? MUTED : INK,
          lineHeight: 1.35,
          flexGrow: 1,
          cursor: "text",
        }}
      >
        {card.text}
      </Typography>
      <Box className="card-actions" sx={{ opacity: 0, transition: "opacity 120ms" }}>
        <IconButton size="small" aria-label="Delete card" onClick={onDelete} sx={{ p: 0.25 }}>
          <CloseIcon sx={{ fontSize: 14, color: MUTED }} />
        </IconButton>
      </Box>
    </Box>
  );
}
