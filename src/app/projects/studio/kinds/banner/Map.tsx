"use client";
// THE BANNER'S MAP (09.11.2026, the studio flow standard - SARCLA: "banner also": the editing "very confusing"; "the
// features are there, but the editing and the flow is not logical yet"). The left pane, as in the page studio:
//   start      while nothing is written: "What are you making?" - where it is for (squared) - and ONE pink "Write the
//              whole banner with AI"; or open a part below and write it yourself
//   the banner its parts - headline, small line, line, button, picture, label, background - each with its state and
//              what it holds; a click opens its fields under its row and selects it on the banner in the middle (a click
//              on the banner opens its row here); while the AI writes, the parts it writes shimmer
//   its places every place the banner is used in, with its state (ready, to look at, not yet); a click shows it in the
//              middle; "In a page", "All places", "+ Add a place"
//   last step  pinned at the foot: "Get it" - the paste block for Magento, the PNGs - in its own view, "← The banner"

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";

import { MUTED } from "@/app/uc/report/ui";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import { placeChecks, placeState } from "@/lib/content/studio/kinds/banner/checks";
import { PRESET, THEMES, sizeLabel, sizesOf, togglePlace, wordsFor, type BannerDoc, type PresetKey } from "@/lib/content/studio/kinds/banner/model";
import type { PickPart } from "@/lib/content/studio/kinds/banner/render";
import { PINK, btn, mainBtn } from "../../parts";
import type { StudioApi } from "../../useStudio";
import { Kick, LastStep, MapList, MapPane, MapRow, StartCard, Writing, useClock, type Mark } from "../video/map";
import PartFields, { PART_NAME, inLine, type Set } from "./Editor";
import { CheckLines, GetItView, type BannerAi, type usePng } from "./Output";
import type { Pages } from "./Place";
import { AddPlace, Shape, type View } from "./Preview";

/** Where a new banner is for, the first question (the others are added later in "Its places"). */
const START_PLACES: PresetKey[] = ["band", "cat", "hero", "mail", "card", "story"];

const STATE_TEXT = { ready: "Ready", look: "To look at", stop: "Not yet" } as const;

export default function BannerMap({ api, doc, set, view, setView, pick, setPick, pages, ai, png, prefix, title, focusLeft = true }: {
  api: StudioApi; doc: BannerDoc; set: Set; view: View; setView: (v: View) => void; pick: PickPart | null; setPick: (p: PickPart | null) => void;
  pages: Pages; ai: BannerAi; png: ReturnType<typeof usePng>; prefix: string; title: string;
  /** the part opened from the map takes the cursor; one selected on the banner does not */
  focusLeft?: boolean;
}) {
  const [step, setStep] = useState<"map" | "get">("map");
  const [placeOpen, setPlaceOpen] = useState<PresetKey | null>(null);
  const [fitMsg, setFitMsg] = useState<string | null>(null);
  const piece = api.data.piece;
  const canEdit = api.data.access.canEdit;
  const canAi = api.data.ai && canEdit;
  const made = sizesOf(doc);
  const shown: PresetKey = view !== "all" && view !== "pages" && made.includes(view) ? view : made[0];
  const c = doc.content;
  const w = wordsFor(doc, shown);
  const empty = !c.headline.trim() && !c.line.trim() && !c.eyebrow.trim();
  const busy = ai.busy;
  const clock = useClock(busy?.since ?? null);

  if (step === "get") {
    return (
      <Box sx={{ height: "100%", overflowY: "auto" }}>
        <GetItView doc={doc} k={shown} prefix={prefix} title={title} png={png} onBack={() => setStep("map")} onPlace={(x) => setView(x)} />
      </Box>
    );
  }

  // the parts the banner has room for somewhere
  const room = (f: "eyebrow" | "line" | "button") => made.some((k) => PRESET[k].limits[f] > 0);
  const pic = c.photos.length >= 2 ? c.photos[0] : c.image;
  const parts: PickPart[] = ["headline", ...(room("eyebrow") ? ["eyebrow" as const] : []), ...(room("line") ? ["line" as const] : []), ...(room("button") ? ["button" as const] : []), "picture", ...(pic.url ? ["label" as const] : []), "background"];
  const summary = (p: PickPart): string => {
    if (p === "headline") return [w.headline, w.words.length ? `/ ${w.words.join(" / ")}` : ""].filter(Boolean).join(" ") || "Not written yet";
    if (p === "eyebrow") return w.eyebrow || (PRESET[shown].limits.eyebrow ? "Not written yet" : "Not in this place");
    if (p === "line") return w.line || (PRESET[shown].limits.line ? "Not written yet" : "Not in this place");
    if (p === "button") return w.button ? `${w.button}${c.button.url ? ` → ${c.button.url}` : " · goes nowhere yet"}` : PRESET[shown].limits.button ? "Not written yet" : "Not in this place";
    if (p === "picture") return c.photos.length >= 2 ? `${c.photos.length} pictures in turn` : pic.url ? (pic.label || "A picture") : "No picture yet";
    if (p === "label") return pic.label || "No label";
    return THEMES[doc.theme].name;
  };
  const mark = (p: PickPart): Mark => {
    if (busy && (busy.part === "all" ? ["headline", "eyebrow", "line", "button"].includes(p) : busy.part === p)) return "busy";
    if (p === "headline") return w.headline ? "written" : "empty";
    if (p === "eyebrow" || p === "line") return w[p] ? "written" : PRESET[shown].limits[p] ? "empty" : "none";
    if (p === "button") return w.button ? "written" : PRESET[shown].limits.button ? "empty" : "none";
    if (p === "picture") return pic.url ? "written" : "picture";
    return "none";
  };
  const writtenN = parts.filter((p) => mark(p) === "written").length;
  const openPart = (p: PickPart) => {
    if (pick === p) { setPick(null); return; }
    // from the overview or a page, the banner comes back first (a new view lets go of what was selected), then the part
    if (view === "all" || view === "pages") { setView(shown); setTimeout(() => setPick(p), 60); } else setPick(p);
    setTimeout(() => document.querySelector(`[data-row="b-${p}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 260);
  };
  const writeAll = () => void ai.copy(null, empty ? "Every word written" : "Every word written again");

  const checks = placeChecks(doc, shown);
  const st = placeState(checks);
  const line = st === "ready" ? `${PRESET[shown].label} · ready to go out`
    : <><Box component="span" sx={{ color: st === "stop" ? "#c5221f" : "#8a5a00", fontWeight: 600 }}>{STATE_TEXT[st]}</Box>{` · ${PRESET[shown].label} · ${checks.length} thing${checks.length === 1 ? "" : "s"}`}</>;
  const placedN = pages.placed.reduce((n, x) => n + x.mine.length, 0);

  return (
    <MapPane foot={!empty ? <LastStep name="Get it" line={line} onClick={() => { setPick(null); setStep("get"); }} /> : undefined}>
      {empty && (
        <StartCard>
          <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: MUTED, mb: 0.75 }}>Where it is for</Typography>
          <SquareChoice<string> value={START_PLACES.includes(doc.format) ? doc.format : ""} onChange={(v) => {
            if (!canEdit) return;
            const k = v as PresetKey;
            set((d) => ({ ...d, format: k, sizes: d.sizes.filter((x) => x !== k).concat(d.format !== k && !START_PLACES.includes(d.format) ? [d.format] : []) }));
            setView(k);
          }} options={START_PLACES.map((k) => ({ key: k, label: PRESET[k].short, disabled: !canEdit }))} />
          <Typography sx={{ fontSize: "0.72rem", color: MUTED, mt: 0.6, mb: 1.75 }}>{PRESET[shown].note}. More places below, once it is written.</Typography>
          <Button fullWidth variant="contained" disableElevation disabled={!canAi || !!busy} onClick={writeAll}
            startIcon={busy ? <CircularProgress size={14} color="inherit" /> : <AutoAwesomeOutlinedIcon />} sx={{ ...mainBtn, borderRadius: "8px", height: 42 }}>
            {busy ? `Writing the banner · ${clock}` : "Write the whole banner with AI"}
          </Button>
          <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 0.75, lineHeight: 1.45 }}>
            {api.data.ai ? "From the brief, in the banner's language, within each place's room. Or open a part below and write it yourself." : "The AI is not set up on this hub - open a part below and write it yourself."}
          </Typography>
        </StartCard>
      )}

      <Kick right={busy?.part === "all" ? <Writing label="Writing the banner" since={busy.since} /> : !empty && canEdit ? (
        <Button size="small" disabled={!canAi || !!busy} onClick={writeAll} startIcon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 15 }} />}
          sx={{ ...btn, color: PINK, px: 0.75, py: 0.1, fontSize: "0.76rem", minWidth: 0 }}>Write it all again</Button>
      ) : undefined}>
        The banner{busy?.part === "all" ? "" : ` · ${writtenN} of ${parts.filter((p) => mark(p) !== "none").length} done`}
      </Kick>
      <MapList>
        {parts.map((p) => (
          <MapRow key={p} id={`b-${p}`} title={PART_NAME[p]} summary={summary(p)} state={mark(p)} busyLabel={busy?.part === "all" ? "Writing…" : `${busy?.label ?? "Writing"}…`}
            open={pick === p} onToggle={() => openPart(p)}>
            <PartFields doc={doc} set={set} k={shown} part={p} canEdit={canEdit} projectId={piece.projectId} pieceId={piece.id} me={api.data.me} autoFocus={focusLeft} />
          </MapRow>
        ))}
      </MapList>

      <Kick mt={2.25}>Its places · {made.length}</Kick>
      <MapList>
        {made.map((k) => {
          const ch = placeChecks(doc, k);
          const s = placeState(ch);
          const on = view === k;
          return (
            <MapRow key={k} id={`p-${k}`} title={PRESET[k].label} summary={`${sizeLabel(PRESET[k])} · ${STATE_TEXT[s]}${ch.length ? ` · ${ch.length}` : ""}`} state={s === "ready" ? "written" : s === "stop" ? "stop" : "warn"}
              accent="blue" thumb={<Shape k={k} on={on} box={22} />} open={placeOpen === k}
              onToggle={() => { setView(k); setFitMsg(null); setPlaceOpen(placeOpen === k ? null : k); }}>
              <CheckLines items={ch} ok={`Ready for the ${inLine(PRESET[k].short)}: it fits, and the brand's rules are kept.`} />
              {ch.some((x) => x.text.includes("too long")) && canAi && (
                <Button size="small" disabled={!!busy} onClick={async () => setFitMsg(await ai.fitPlace(k))} startIcon={busy?.label.startsWith("Shorter words") ? <CircularProgress size={12} color="inherit" /> : <AutoAwesomeOutlinedIcon sx={{ fontSize: 15 }} />}
                  sx={{ ...btn, color: PINK, px: 0.5, mt: 0.75, whiteSpace: "normal", textAlign: "left", lineHeight: 1.3 }}>
                  Shorter words for the {inLine(PRESET[k].short)}, with AI
                </Button>
              )}
              {fitMsg && <Typography sx={{ fontSize: "0.76rem", color: "#7f4f0b", mt: 0.5 }}>{fitMsg}</Typography>}
              <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 1 }}>{PRESET[k].note}.</Typography>
              {made.length > 1 && canEdit && (
                <Button size="small" onClick={() => { set((d) => togglePlace(d, k)); setPlaceOpen(null); setView(made.find((x) => x !== k) ?? made[0]); }} sx={{ ...btn, color: MUTED, px: 0.5, mt: 0.75 }}>
                  Take it out of this place
                </Button>
              )}
            </MapRow>
          );
        })}
        <MapRow id="p-pages" title="In a page" summary={placedN ? `In ${pages.placed.length} page${pages.placed.length === 1 ? "" : "s"} of the project` : "Put it in a page of the project and see it there"} state="none"
          accent="blue" open={false} onToggle={() => { setPick(null); setPlaceOpen(null); setView("pages"); }} />
        {made.length > 1 && (
          <MapRow id="p-all" title="All places" summary={`${made.length} places side by side`} state="none" accent="blue" open={false} onToggle={() => { setPick(null); setPlaceOpen(null); setView("all"); }} />
        )}
      </MapList>
      <Box sx={{ mt: 1 }}>
        <AddPlace doc={doc} set={set} canEdit={canEdit} onAdded={(x) => setView(x)} />
      </Box>
    </MapPane>
  );
}
