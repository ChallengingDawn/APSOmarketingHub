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
import CloseIcon from "@mui/icons-material/Close";
import { HAIRLINE, INK, MUTED, Section } from "@/app/analytics/Shell";
import { ITEM_KINDS, ITEM_STATUS, statusOf, type JourneyItem, type JourneyItemKind, type JourneyItemStatus, type JourneyModel } from "@/lib/journey/model";
import type { JourneyMetrics } from "@/lib/journey/metrics";
import { full, percent } from "@/app/charts/format";

const LANES = Object.entries(ITEM_KINDS) as [JourneyItemKind, string][];
const LANE_TONE: Partial<Record<JourneyItemKind, string>> = { risk: "#9e1b18", kpi: "#1b4a80" };

/** Not started → on track → needs improvement → done, and round again. */
const STATUS_ORDER: JourneyItemStatus[] = ["open", "ontrack", "attention", "done"];
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

      <Box sx={{ display: "flex", gap: 2, overflowX: "auto", pb: 2, alignItems: "flex-start" }}>
        {stages.map((stage) => {
          const steps = model.steps.filter((s) => s.stageId === stage.id);
          const measured = steps
            .map((s) => ({ step: s, metric: metrics?.steps.find((m) => m.stepIndex === s.index) }))
            .filter((x) => x.metric?.value != null);
          return (
            <Box key={stage.id} sx={{ minWidth: 320, maxWidth: 360, flex: "0 0 auto" }}>
              <Section sx={{ p: 2 }}>
                <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: INK, lineHeight: 1.3 }}>{stage.name}</Typography>
                {stage.objective && <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 0.25 }}>{stage.objective}</Typography>}
                {stage.mindset && <Typography sx={{ fontSize: "0.8rem", color: INK, mt: 1, fontStyle: "italic" }}>“{stage.mindset}”</Typography>}

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
    </Box>
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
