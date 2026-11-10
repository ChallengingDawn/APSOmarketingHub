"use client";
// THE AI'S PLAN IN THE ASSISTANT (Content v7, 10.11.2026). More than one step is shown before anything changes - a short
// list ("Add a product row after "Top-Produkte"" · "Replace the slider with a finder bento"), each with Apply and Skip,
// and Apply all; one step was applied at once. Each step says where it is, in plain words: waiting, filling from the
// shop, being checked, on the page, held back (why), not on the page (why).

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { PINK, btn } from "../../../parts";
import type { PlanCtl, StepState } from "./usePlan";

const RED = "#c5221f";
const GREEN = "#1b7a55";

function StateLine({ st }: { st: StepState | undefined }) {
  if (!st || st.state === "waiting") return null;
  const row = (icon: React.ReactNode, text: string, color: string) => (
    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.6, mt: 0.4 }}>
      <Box sx={{ mt: "2px", flexShrink: 0, display: "flex" }}>{icon}</Box>
      <Typography sx={{ fontSize: "0.75rem", lineHeight: 1.35, color, fontWeight: 600 }}>{text}</Typography>
    </Box>
  );
  if (st.state === "filling") return row(<CircularProgress size={11} sx={{ color: PINK }} />, "Filling it from the shop…", MUTED);
  if (st.state === "placing") return row(<CircularProgress size={11} sx={{ color: PINK }} />, "Putting it in its place…", MUTED);
  if (st.state === "checking") return row(<CircularProgress size={11} sx={{ color: PINK }} />, "Checking that it reads well…", MUTED);
  if (st.state === "done") return row(<CheckIcon sx={{ fontSize: 14, color: GREEN }} />, st.note ? `On the page · ${st.note}` : "On the page", GREEN);
  if (st.state === "skipped") return row(<CloseIcon sx={{ fontSize: 14, color: MUTED }} />, "Skipped", MUTED);
  return row(<WarningAmberIcon sx={{ fontSize: 14, color: RED }} />, st.why, RED);
}

export function PlanCard({ ctl, enabled, onSay }: { ctl: PlanCtl; enabled: boolean; onSay?: (msg: string) => void }) {
  const r = ctl.run;
  if (!r) return null;
  const steps = r.plan.steps;
  const open = steps.filter((s) => { const st = r.states[s.id]?.state; return st === "waiting" || st === "failed"; });
  const say = (m: string | null) => { if (m && onSay) onSay(m); };
  return (
    <Box data-plan sx={{ mt: 2, borderRadius: "10px", bgcolor: "#fff", border: `1px solid ${HAIRLINE}`, boxShadow: "0 6px 18px rgba(31,45,78,.07)", overflow: "hidden" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 1.5, py: 0.9, bgcolor: "rgba(194,44,110,.05)", borderBottom: `1px solid ${HAIRLINE}` }}>
        <AutoAwesomeOutlinedIcon sx={{ fontSize: 16, color: PINK }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: PINK }}>
            The plan · {steps.length} step{steps.length === 1 ? "" : "s"}
          </Typography>
          <Typography sx={{ fontSize: "0.8rem", color: INK, lineHeight: 1.35 }}>{r.plan.note}</Typography>
        </Box>
        <Tooltip title="Close the plan (what is on the page stays, with its Undo)"><IconButton size="small" onClick={ctl.drop} aria-label="Close the plan"><CloseIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
      </Box>
      <Box sx={{ px: 1.5, py: 0.5 }}>
        {steps.map((s, i) => {
          const st = r.states[s.id];
          const can = enabled && !ctl.busy && (st?.state === "waiting" || st?.state === "failed");
          return (
            <Box key={s.id} data-plan-step={s.id} sx={{ display: "flex", gap: 1, py: 1, borderTop: i ? `1px solid ${HAIRLINE}` : "none", opacity: st?.state === "skipped" ? 0.5 : 1 }}>
              <Box sx={{ width: 20, height: 20, flexShrink: 0, mt: "1px", borderRadius: "5px", display: "grid", placeItems: "center", fontSize: "0.72rem", fontWeight: 700,
                bgcolor: st?.state === "done" ? "rgba(27,122,85,.12)" : "rgba(194,44,110,.09)", color: st?.state === "done" ? GREEN : PINK }}>{i + 1}</Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK, lineHeight: 1.35, wordBreak: "break-word" }}>{s.line}</Typography>
                {s.why && <Typography sx={{ fontSize: "0.74rem", color: MUTED, lineHeight: 1.35 }}>{s.why}</Typography>}
                {s.problems.length > 0 && <Typography sx={{ fontSize: "0.72rem", color: "#8a5a00", lineHeight: 1.35, mt: 0.25 }}>{s.problems.slice(0, 2).join(" · ")}</Typography>}
                <StateLine st={st} />
              </Box>
              {can && (
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0.25, flexShrink: 0 }}>
                  <Button size="small" onClick={async () => say(await ctl.applyOne(s.id))} sx={{ ...btn, color: PINK, minWidth: 0, px: 1, py: 0.1 }}>{st?.state === "failed" ? "Try again" : "Apply"}</Button>
                  <Button size="small" onClick={() => ctl.skip(s.id)} sx={{ ...btn, color: MUTED, minWidth: 0, px: 1, py: 0.1 }}>Skip</Button>
                </Box>
              )}
            </Box>
          );
        })}
        {r.plan.problems.length > 0 && <Typography sx={{ fontSize: "0.72rem", color: "#8a5a00", lineHeight: 1.35, pb: 1 }}>Left out: {r.plan.problems.slice(0, 3).join(" ")}</Typography>}
      </Box>
      {open.length > 1 && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 1, borderTop: `1px solid ${HAIRLINE}`, bgcolor: "#fafbfc" }}>
          <Button size="small" variant="contained" disableElevation disabled={!enabled || ctl.busy} onClick={async () => say(await ctl.applyAll())}
            startIcon={ctl.busy ? <CircularProgress size={13} sx={{ color: "#fff" }} /> : <AutoAwesomeOutlinedIcon sx={{ fontSize: 16 }} />}
            sx={{ ...btn, bgcolor: PINK, borderRadius: "6px", "&:hover": { bgcolor: "#a3245c" } }}>Apply all {open.length}</Button>
          <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>or one by one above</Typography>
        </Box>
      )}
    </Box>
  );
}
