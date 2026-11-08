"use client";
// THE FILM AS A WHOLE (08.11.2026, Content v3; SARCLA: "button is not fit" - the button read "Make the film from No
// surcharge for small order" and its text ran out of it). What the film is about is picked from our features as cards
// (each with its icon and its line of proof, from the brand brain and the shop - never invented), then how long it is
// and its format as squared choices, then ONE button that always says the same short thing: "Make the film".

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";

import { AMBER, MUTED, RED } from "@/app/uc/report/ui";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import { FEATURES, type FeatureKey } from "@/lib/content/studio/kinds/video/features";
import { FORMAT_INFO, FORMATS, LENGTHS, type FilmLength, type Format, type Issue } from "@/lib/content/studio/kinds/video/model";
import { btn, mainBtn } from "../../parts";
import { Head, LineIcon, Tile } from "./ui";

export const MAX_PICK = 3;

export default function FilmPanel({ picked, onPick, confirmed, length, onLength, format, onFormat, disabled, aiReady, busy, hasScenes, onMake, onAdd, issues }: {
  picked: FeatureKey[]; onPick: (keys: FeatureKey[]) => void; confirmed: FeatureKey[] | null;
  length: FilmLength; onLength: (n: FilmLength) => void; format: Format; onFormat: (f: Format) => void;
  disabled: boolean; aiReady: boolean; busy: boolean; hasScenes: boolean; onMake: () => void; onAdd: () => void; issues: Issue[];
}) {
  const toggle = (k: FeatureKey) => onPick(picked.includes(k) ? picked.filter((x) => x !== k) : [...picked, k].slice(0, MAX_PICK));
  return (
    <Box>
      <Head mt={0} right={<Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{picked.length ? `${picked.length} of ${MAX_PICK}` : `Up to ${MAX_PICK}`}</Typography>}>What it is about</Head>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 0.75 }}>
        {FEATURES.map((f) => {
          const at = picked.indexOf(f.key);
          const on = at >= 0;
          const known = !confirmed || confirmed.includes(f.key);
          return (
            <Tile key={f.key} row on={on} badge={on && picked.length > 1 ? at + 1 : undefined} disabled={disabled || (!on && (!known || picked.length >= MAX_PICK))} onClick={() => toggle(f.key)} label={f.name}
              title={known ? f.proof : "The brand brain does not name this one now - check it is still true before using it."}>
              <Box sx={{ display: "flex", alignItems: "center", pl: 0.9, flexShrink: 0 }}>
                <Box sx={{ width: 26, height: 26, borderRadius: "5px", bgcolor: on ? "#d80901" : "#eef2f5", display: "grid", placeItems: "center", flexShrink: 0, transition: "background .15s" }}>
                  <LineIcon name={f.icon} size={16} color={on ? "#fff" : "#274e64"} />
                </Box>
              </Box>
            </Tile>
          );
        })}
      </Box>
      <Typography sx={{ fontSize: "0.72rem", color: MUTED, mt: 0.75, lineHeight: 1.45 }}>
        Each as the shop and the brand brain say it - nothing is added. Picked in the order the film tells them.
      </Typography>

      <Head>How long</Head>
      <SquareChoice<string> value={String(length)} onChange={(v) => onLength(Number(v) as FilmLength)} options={LENGTHS.map((n) => ({ key: String(n), label: `${n} s`, disabled }))} />

      <Head>Format</Head>
      <SquareChoice<Format> value={format} onChange={onFormat} options={FORMATS.map((f) => ({ key: f, label: FORMAT_INFO[f].label, disabled }))} />
      <Typography sx={{ fontSize: "0.72rem", color: MUTED, mt: 0.6 }}>{FORMAT_INFO[format].use}</Typography>

      <Button fullWidth variant="contained" disableElevation disabled={disabled || busy || !aiReady} onClick={onMake}
        startIcon={busy ? <CircularProgress size={14} color="inherit" /> : <AutoAwesomeOutlinedIcon sx={{ fontSize: 17 }} />} sx={{ ...mainBtn, mt: 2.5, py: 1 }}>
        {busy ? "Making the film…" : hasScenes ? "Make it again" : "Make the film"}
      </Button>
      {!aiReady && <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 0.75 }}>The AI is not set up on this hub - add the scenes yourself.</Typography>}
      {picked.length > 0 && (
        <Button fullWidth size="small" disabled={disabled} onClick={onAdd} sx={{ ...btn, mt: 0.75, color: MUTED, whiteSpace: "normal", lineHeight: 1.3 }}>Add them as scenes to write myself</Button>
      )}
      {hasScenes && !busy && <Typography sx={{ fontSize: "0.72rem", color: MUTED, mt: 0.5, textAlign: "center" }}>Making it again replaces the scenes - one click brings them back.</Typography>}

      {issues.length > 0 && (
        <Box sx={{ mt: 2, display: "grid", gap: 0.5 }}>
          {issues.map((x, i) => <Typography key={i} sx={{ fontSize: "0.76rem", lineHeight: 1.4, color: x.level === "stop" ? RED : AMBER }}>{x.text}</Typography>)}
        </Box>
      )}
    </Box>
  );
}
