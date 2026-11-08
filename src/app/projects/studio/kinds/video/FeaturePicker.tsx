"use client";
// THE FILM'S FEATURES (08.11.2026; SARCLA: "the video should also play with our features: you should be able to select a
// feature or key winning point of APSO, much better"). APSOparts' own features and winning points (lib/.../video/
// features.ts - each from the brand brain or the shop's home page, never invented), as squared tiles with the shop's own
// icon and a line of proof. Pick one or more, in the order the film tells them; then the assistant makes the film around
// them (a scene per feature: claim, proof, visual, end card), or they go in as scenes to write yourself.

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import PlaylistAddRoundedIcon from "@mui/icons-material/PlaylistAddRounded";

import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { FEATURES, FEATURE, type FeatureKey, type IconKey } from "@/lib/content/studio/kinds/video/features";
import { ICON_PATHS } from "@/lib/content/studio/kinds/video/film/iconPaths";
import { btn, mainBtn } from "../../parts";

const SEL = "#2459d1";

/** One of the shop's line icons, small. */
export function LineIcon({ name, size = 22, color = "#274e64" }: { name: IconKey; size?: number; color?: string }) {
  return (
    <Box component="svg" viewBox="0 0 24 24" sx={{ width: size, height: size, flexShrink: 0, display: "block" }} fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }} />
  );
}

export default function FeaturePicker({ picked, onChange, confirmed, disabled, busy, aiReady, onMake, onAdd, hasScenes }: {
  picked: FeatureKey[]; onChange: (keys: FeatureKey[]) => void; confirmed: FeatureKey[] | null; disabled: boolean; busy: boolean; aiReady: boolean;
  onMake: () => void; onAdd: () => void; hasScenes: boolean;
}) {
  const toggle = (k: FeatureKey) => onChange(picked.includes(k) ? picked.filter((x) => x !== k) : [...picked, k].slice(0, 6));
  return (
    <Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 0.75 }}>
        {FEATURES.map((f) => {
          const at = picked.indexOf(f.key);
          const on = at >= 0;
          const known = !confirmed || confirmed.includes(f.key);
          return (
            <Tooltip key={f.key} title={known ? f.proof : "The brand brain does not name this one now - check it is still true before using it."} enterDelay={400}>
              <Box component="button" type="button" disabled={disabled || (!known && !on)} aria-pressed={on} aria-label={f.name} onClick={() => toggle(f.key)} sx={{
                all: "unset", boxSizing: "border-box", position: "relative", cursor: disabled ? "default" : "pointer", display: "flex", gap: 1, alignItems: "flex-start",
                p: 1, pr: 3, borderRadius: "6px", minWidth: 0, opacity: known ? 1 : 0.5,
                border: `1px solid ${on ? "rgba(36,89,209,.6)" : HAIRLINE}`, bgcolor: on ? "rgba(36,89,209,.06)" : "rgba(255,255,255,.7)",
                transition: "border-color .15s, background .15s", "&:hover": disabled ? {} : { borderColor: on ? SEL : "#9fb3c0" }, "&:focus-visible": { outline: `2px solid ${SEL}` },
              }}>
                <Box sx={{ width: 30, height: 30, borderRadius: "6px", bgcolor: on ? "#d80901" : "#eef2f5", display: "grid", placeItems: "center", flexShrink: 0, transition: "background .15s" }}>
                  <LineIcon name={f.icon} size={19} color={on ? "#fff" : "#274e64"} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.8rem", fontWeight: 650, color: INK, lineHeight: 1.25 }}>{f.name}</Typography>
                  <Typography sx={{ fontSize: "0.7rem", color: MUTED, lineHeight: 1.3, mt: 0.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{f.proof}</Typography>
                </Box>
                {on && (
                  <Box sx={{ position: "absolute", top: 6, right: 6, minWidth: 17, height: 17, px: 0.3, borderRadius: "3px", bgcolor: SEL, color: "#fff", fontSize: "0.68rem", fontWeight: 700, display: "grid", placeItems: "center" }}>{at + 1}</Box>
                )}
              </Box>
            </Tooltip>
          );
        })}
      </Box>
      <Box sx={{ display: "flex", gap: 1, mt: 1.25, flexWrap: "wrap" }}>
        <Button variant="contained" disableElevation disabled={disabled || !picked.length || busy || !aiReady} onClick={onMake}
          startIcon={busy ? <CircularProgress size={14} color="inherit" /> : <AutoAwesomeOutlinedIcon sx={{ fontSize: 17 }} />} sx={{ ...mainBtn, flex: "1 1 auto" }}>
          {busy ? "Making the film…" : picked.length ? `${hasScenes ? "Make it again" : "Make the film"} from ${picked.length === 1 ? FEATURE[picked[0]].name : `these ${picked.length}`}` : "Pick a feature or more"}
        </Button>
        <Tooltip title="A scene for each, from its own claim and proof - to write yourself">
          <span>
            <Button variant="outlined" disabled={disabled || !picked.length} onClick={onAdd} startIcon={<PlaylistAddRoundedIcon sx={{ fontSize: 18 }} />}
              sx={{ ...btn, borderColor: HAIRLINE, color: INK, bgcolor: "#fff" }}>As scenes</Button>
          </span>
        </Tooltip>
      </Box>
      <Typography sx={{ fontSize: "0.72rem", color: MUTED, mt: 1, lineHeight: 1.45 }}>
        Each one as the shop and the brand brain say it - nothing is added. Picked in the order the film tells them.
      </Typography>
    </Box>
  );
}
