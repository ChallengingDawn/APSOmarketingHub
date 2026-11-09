"use client";
// THE FILM'S SETTINGS (08.11.2026, Content v3; 09.11.2026 the flow standard). What the film is about - our features as
// cards, each with its icon and its line of proof, from the brand brain and the shop, never invented - and how long it
// is. In the empty studio they are the start card ("What are you making?") over ONE pink "Make the whole film with AI";
// once the film is made they are the map's first row, "What it is about". The format sits over the film itself (16:9 /
// 9:16 / 1:1, top right of the middle), the button that ran out of its text is gone (SARCLA 08.11.2026: "button is not
// fit").

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { AMBER, MUTED, RED } from "@/app/uc/report/ui";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import { FEATURE, FEATURES, type FeatureKey } from "@/lib/content/studio/kinds/video/features";
import { LENGTHS, type FilmLength, type Issue } from "@/lib/content/studio/kinds/video/model";
import { Head, LineIcon, Tile } from "./ui";

export const MAX_PICK = 3;

/** The film's settings in a line: its features and its length. */
export const filmLine = (picked: FeatureKey[], length: FilmLength) =>
  `${picked.length ? picked.map((k) => FEATURE[k].name).join(" · ") : "No feature picked"} · ${length} s`;

export default function FilmPanel({ picked, onPick, confirmed, length, onLength, disabled, issues }: {
  picked: FeatureKey[]; onPick: (keys: FeatureKey[]) => void; confirmed: FeatureKey[] | null;
  length: FilmLength; onLength: (n: FilmLength) => void; disabled: boolean; issues?: Issue[];
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

      {!!issues?.length && (
        <Box sx={{ mt: 2, display: "grid", gap: 0.5 }}>
          {issues.map((x, i) => <Typography key={i} sx={{ fontSize: "0.76rem", lineHeight: 1.4, color: x.level === "stop" ? RED : AMBER }}>{x.text}</Typography>)}
        </Box>
      )}
    </Box>
  );
}
