"use client";
// THE PAGE'S VERSIONS, A / B / C (Content v6, 10.11.2026). SARCLA 09.11.2026, on the A/B test: "it should also allow to
// create another version of the same". A slim row under the page's toolbar: one squared tab per version - the open one
// filled, a click opens another (the preview shows it, the assistant and the page edit it) - and "+ Another version",
// which copies the open one under the next letter to change on its own. The letters are AI testing &
// personalization's: a version that came from there says so (its letter, its revision). The A/B test picks two of them
// (or the page as it is) - its row on the left.

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { nextPageLetter, sideName, versionList, type PageDoc, type PageVersion } from "@/lib/content/studio/kinds/page/model";
import { btn } from "../../parts";

const BLUE = "#2459d1";

/** Where a version came from, in a few words. */
export function versionNote(view: PageDoc, v: PageVersion, docOrigin: PageDoc["origin"]): string {
  const n = v.changes.length;
  const count = `${n} change${n === 1 ? "" : "s"}`;
  const fromConvert = v.origin ? `version ${v.letter} of AI testing & personalization, revision ${v.origin.rev}`
    : docOrigin?.letter && docOrigin.letter === v.letter && (view.letter || "A") === v.letter && !view.versions.length ? `version ${v.letter} of AI testing & personalization, revision ${docOrigin.rev}` : "";
  return [count, v.from ? `made from ${v.from}` : "", fromConvert ? `from ${fromConvert}` : ""].filter(Boolean).join(" · ");
}

export function VersionStrip({ view, docOrigin, canEdit, busy, onOpen, onAdd, onDrop }: {
  /** the store view shown (its versions) */
  view: PageDoc;
  /** the document's origin: the version a page from AI testing & personalization came with */
  docOrigin: PageDoc["origin"];
  canEdit: boolean;
  /** the AI is writing: the versions wait */
  busy: boolean;
  onOpen: (letter: string) => void; onAdd: () => void; onDrop: (letter: string) => void;
}) {
  const list = versionList(view);
  const open = view.letter || "A";
  const cur = list.find((v) => v.letter === open) ?? list[0];
  const next = nextPageLetter(view);
  const ab = view.abTest;
  const inTest = (l: string) => ab.enabled && (ab.a === l || ab.b === l);
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, px: 1.5, py: 0.6, minWidth: 0, borderBottom: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.42)", flexShrink: 0 }}>
      <Typography sx={{ fontSize: "0.66rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: MUTED, flexShrink: 0 }}>Version</Typography>
      <Box role="radiogroup" aria-label="Version of the page" sx={{ display: "inline-flex", flexShrink: 0, border: `1px solid ${HAIRLINE}`, borderRadius: "6px", overflow: "hidden", bgcolor: "rgba(255,255,255,.85)" }}>
        {list.map((v, i) => {
          const on = v.letter === open;
          return (
            <Tooltip key={v.letter} title={`${sideName(v.letter)} · ${versionNote(view, v, docOrigin)}${inTest(v.letter) ? " · in the A/B test" : ""}`}>
              <Box component="button" type="button" role="radio" aria-checked={on} disabled={busy && !on} onClick={() => onOpen(v.letter)} sx={{
                all: "unset", cursor: busy && !on ? "default" : "pointer", position: "relative", minWidth: 30, textAlign: "center", px: 1, py: 0.4,
                fontSize: "0.8rem", fontWeight: 800, borderLeft: i ? `1px solid ${HAIRLINE}` : "none",
                color: on ? "#fff" : INK, bgcolor: on ? BLUE : "transparent", transition: "background-color .12s",
                "&:hover": on ? {} : { bgcolor: "rgba(36,89,209,.07)" }, "&:focus-visible": { outline: `2px solid ${BLUE}`, outlineOffset: -2 },
              }}>
                {v.letter}
                {inTest(v.letter) && <Box component="span" sx={{ position: "absolute", top: 3, right: 3, width: 5, height: 5, borderRadius: "1px", bgcolor: on ? "#fff" : "#c22c6e" }} />}
              </Box>
            </Tooltip>
          );
        })}
      </Box>
      {canEdit && next && (
        <Button size="small" disabled={busy} onClick={onAdd} startIcon={<AddIcon sx={{ fontSize: 16 }} />}
          sx={{ ...btn, color: INK, px: 0.75, py: 0.1, fontSize: "0.78rem", flexShrink: 0, minWidth: 0 }}>
          Another version
        </Button>
      )}
      <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.76rem", color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        <Box component="span" sx={{ color: INK, fontWeight: 650 }}>{sideName(open)}</Box> · {versionNote(view, cur, docOrigin)}
      </Typography>
      {ab.enabled && (
        <Tooltip title="The A/B test - set on the left, under A/B test">
          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, flexShrink: 0, fontSize: "0.72rem", fontWeight: 700, color: "#c22c6e" }}>
            <ScienceOutlinedIcon sx={{ fontSize: 15 }} />{ab.a === "page" ? "As it is" : ab.a} vs {ab.b === "page" ? "as it is" : ab.b}
          </Box>
        </Tooltip>
      )}
      {canEdit && list.length > 1 && (
        <Tooltip title={`Remove version ${open} - its changes stay in the version history`}>
          <IconButton size="small" disabled={busy} onClick={() => onDrop(open)} aria-label={`Remove version ${open}`} sx={{ color: MUTED, p: 0.4, flexShrink: 0 }}>
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}
