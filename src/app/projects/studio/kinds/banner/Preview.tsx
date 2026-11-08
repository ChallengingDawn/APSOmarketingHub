"use client";
// THE BANNER'S STAGE (08.11.2026, Content v3; SARCLA tonight: "banner also" - the editing "very confusing"; this
// morning: "the banner can be in multiple places", "we should be able to push it inside a page visually").
// The banner in the middle, at its real size in the place it is for, and nothing else in the way:
//   the places    a row of squared choices on top - each place the banner is used in, "In a page", "All places";
//                 "+ Place" adds one (the shop's bands and slot, a newsletter header, LinkedIn, Instagram, ads)
//   the banner    the shop's places run live in a frame exactly as pasted (the word changes, the photos crossfade,
//                 desktop or phone); the others drawn as their PNG will be. A click on a part of it - the headline,
//                 the line, the button, the picture, its label, the background - opens that part's card right under
//                 the banner, pointing at it (Editor.tsx), so the banner stays whole and every part clickable; empty
//                 words show greyed until written
//   under it      what to look at before it goes out, for this place
//   In a page     the page to-do it was put in, with the banner in its place (Place.tsx)
// Gone from the first studio: the build column of fields beside the banner, the sheet of "words here", checks and files
// under every place, the picture's address field, the notes field - each part is changed on the banner itself now.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ListSubheader from "@mui/material/ListSubheader";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CheckIcon from "@mui/icons-material/Check";
import TouchAppOutlinedIcon from "@mui/icons-material/TouchAppOutlined";

import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import { esc } from "@/lib/content/studio/kinds/banner/brand";
import { placeChecks, placeState } from "@/lib/content/studio/kinds/banner/checks";
import { GROUPS, PRESET, PRESETS, isBand, sizeLabel, sizesOf, togglePlace, wordsFor, type BannerDoc, type PresetKey } from "@/lib/content/studio/kinds/banner/model";
import { pasteBlock, pickCss, previewDoc, previewSwap, stillMarkup, stillSheet, type PickPart } from "@/lib/content/studio/kinds/banner/render";
import { Pane, btn, type Device } from "../../parts";
import Editor, { type Set } from "./Editor";
import { CheckLines, GetIt, usePng } from "./Output";
import { InPage, PageBar, type Pages } from "./Place";
import { Scaled, useWidth } from "./ui";

export type View = "all" | "pages" | PresetKey;
const SEL = "#2459d1";

/* ── words not written yet: shown greyed on the banner, so every part can be clicked ── */

const PH = { eyebrow: "Small line", headline: "Your headline", line: "One line of substance - what the reader gets.", button: "Button" } as const;

/** The banner as the stage draws it: each empty part this place has room for holds its placeholder. */
export function staged(doc: BannerDoc, k: PresetKey): { doc: BannerDoc; ph: string[] } {
  const w = wordsFor(doc, k);
  const L = PRESET[k].limits;
  const ph: string[] = [];
  const content = { ...doc.content, button: { ...doc.content.button } };
  if (L.eyebrow && !w.eyebrow) { content.eyebrow = PH.eyebrow; ph.push(PH.eyebrow); }
  if (!w.headline) { content.headline = PH.headline; ph.push(PH.headline); }
  if (L.line && !w.line) { content.line = PH.line; ph.push(PH.line); }
  if (L.button && !w.button) { content.button.label = PH.button; ph.push(PH.button); }
  return { doc: ph.length ? { ...doc, content } : doc, ph };
}
/** The placeholders greyed. */
const fade = (html: string, ph: string[]) => ph.reduce((h, p) => h.split(`>${esc(p)}<`).join(`><span style="opacity:.4">${esc(p)}</span><`), html);

/* ── a place's shape, drawn small ── */

export function Shape({ k, on, box = 26 }: { k: PresetKey; on: boolean; box?: number }) {
  const p = PRESET[k];
  const h = p.h ?? Math.round(p.w * (k === "cat" ? 0.2 : 0.32));
  const s = Math.min(box / p.w, (box - 4) / h);
  return (
    <Box sx={{ width: box + 4, height: box, display: "grid", placeItems: "center", flexShrink: 0 }}>
      <Box sx={{ width: Math.max(4, p.w * s), height: Math.max(4, h * s), borderRadius: "2px", bgcolor: on ? "#274e64" : "#c9d3dc" }} />
    </Box>
  );
}

/* ── the banner, clickable ── */

type Hit = { part: PickPart; rect: { x: number; y: number; w: number; h: number } | null };

/** The paste block running in its own frame (scripts allowed, nothing else - no access to the hub); a click on a part is told to the studio. */
function LiveFrame({ block, width, font, avail, phone, prefix, picked, onHit, frameRef }: {
  block: string; width: number; font: string; avail: number; phone: boolean; prefix: string; picked: PickPart | null;
  onHit: (h: Hit | null, kind: "pick" | "where") => void; frameRef: React.MutableRefObject<HTMLIFrameElement | null>;
}) {
  const latest = useRef(block);
  latest.current = block;
  const [h, setH] = useState(phone ? 520 : 360);
  // the frame loads once per width and font; after that the banner is swapped in place - no flash while typing
  const src = useMemo(() => previewDoc(latest.current, font, "#ffffff", prefix), [font, width, prefix]); // eslint-disable-line react-hooks/exhaustive-deps
  const swap = () => frameRef.current?.contentWindow?.postMessage({ apsoBanner: "swap", html: previewSwap(latest.current) }, "*");
  useEffect(() => { const t = setTimeout(swap, 120); return () => clearTimeout(t); }, [block]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { frameRef.current?.contentWindow?.postMessage({ apsoBanner: "mark", part: picked }, "*"); }, [picked, frameRef]);
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source !== frameRef.current?.contentWindow) return;
      const m = e.data as { apsoBanner?: string; h?: number; part?: PickPart | null; rect?: Hit["rect"] } | null;
      if (m?.apsoBanner === "height") setH(Math.max(40, Math.min(4000, Number(m.h) || 0)));
      if (m?.apsoBanner === "pick") onHit(m.part ? { part: m.part, rect: m.rect ?? null } : null, "pick");
      if (m?.apsoBanner === "where" && m.part) onHit({ part: m.part, rect: m.rect ?? null }, "where");
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [onHit, frameRef]);
  const zoom = Math.max(0.1, Math.min(1, (avail - (phone ? 16 : 0)) / width));
  return (
    <Box sx={{
      width: width * zoom + (phone ? 16 : 2), height: h * zoom + (phone ? 16 : 2), flexShrink: 0, overflow: "hidden", bgcolor: "#fff", transition: "width .3s ease",
      borderRadius: phone ? "26px" : "10px", border: phone ? "8px solid #15223a" : `1px solid ${HAIRLINE}`, boxShadow: "0 18px 50px rgba(31,45,78,.18)",
    }}>
      <iframe ref={frameRef} title="The banner" srcDoc={src} sandbox="allow-scripts" onLoad={() => { swap(); setTimeout(() => frameRef.current?.contentWindow?.postMessage({ apsoBanner: "mark", part: picked }, "*"), 200); }}
        style={{ width, height: h, border: 0, display: "block", transform: `scale(${zoom})`, transformOrigin: "0 0", background: "#fff" }} />
    </Box>
  );
}

const PART_CLASS: Record<PickPart, string[]> = { eyebrow: ["eb"], headline: ["q", "h"], line: ["p"], button: ["b"], picture: ["c"], label: ["t"], background: [] };

/** A picture place, drawn as its PNG will be; a click on a part opens it. */
function StillView({ css, html, w, h, scale, prefix, picked, onHit, boxRef }: {
  css: string; html: string; w: number; h: number | null; scale: number; prefix: string; picked: PickPart | null;
  onHit: (h: Hit | null) => void; boxRef: React.MutableRefObject<HTMLDivElement | null>;
}) {
  const P = prefix;
  useLayoutEffect(() => {
    const root = boxRef.current;
    if (!root) return;
    root.querySelectorAll(".is-picked").forEach((n) => n.classList.remove("is-picked"));
    if (!picked) return;
    const el = picked === "background" ? root.querySelector(`.${P}`) : root.querySelector(PART_CLASS[picked].map((c) => `.${P}-${c}`).join(","));
    el?.classList.add("is-picked");
  });
  const click = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    for (const [part, cls] of Object.entries(PART_CLASS) as [PickPart, string[]][]) {
      if (cls.length && t.closest(cls.map((c) => `.${P}-${c}`).join(","))) { onHit({ part, rect: null }); return; }
    }
    if (t.closest(`.${P}-w`)) { onHit({ part: "headline", rect: null }); return; }
    onHit(t.closest(`.${P}`) ? { part: "background", rect: null } : null);
  };
  return (
    <Box ref={boxRef} className="bnstage" onClick={click}>
      <Scaled css={`${css}\n${pickCss(P, ".bnstage ", scale)}`} html={html} w={w} h={h} scale={scale} radius={4} />
    </Box>
  );
}

/* ── every place at once ── */

const STATE = {
  ready: { text: "Ready", fg: "#1b7a55", bg: "#e7f6ee" },
  look: { text: "To look at", fg: "#8a5a00", bg: "#fff3d6" },
  stop: { text: "Not yet", fg: "#b3261e", bg: "#fde7e5" },
} as const;

export function StateTag({ state, n }: { state: keyof typeof STATE; n?: number }) {
  const s = STATE[state];
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", px: 0.75, py: 0.1, borderRadius: "4px", bgcolor: s.bg, color: s.fg, fontSize: "0.7rem", fontWeight: 700, whiteSpace: "nowrap" }}>
      {s.text}{n && state !== "ready" ? ` · ${n}` : ""}
    </Box>
  );
}

function Overview({ doc, prefix, open, avail }: { doc: BannerDoc; prefix: string; open: (k: PresetKey) => void; avail: number }) {
  const made = sizesOf(doc);
  const sheet = useMemo(() => stillSheet(doc, made, prefix), [doc, prefix, made.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const cell = Math.max(240, Math.min(380, (avail - 32) / (avail > 1150 ? 3 : 2)));
  return (
    <Box>
      <Typography sx={{ fontSize: "0.9rem", color: INK, mb: 2.5 }}>
        <b>{made.length} place{made.length === 1 ? "" : "s"}</b>, one banner. <Box component="span" sx={{ color: MUTED }}>Open one to change it there.</Box>
      </Typography>
      {GROUPS.filter((g) => made.some((k) => PRESET[k].group === g.key)).map((g) => (
        <Box key={g.key} sx={{ mb: 3 }}>
          <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: MUTED, mb: 1.25 }}>{g.label}</Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-start" }}>
            {made.filter((k) => PRESET[k].group === g.key).map((k) => {
              const q = PRESET[k];
              const band = isBand(k);
              const w = band ? 1200 : q.w;
              const boxW = band ? Math.max(cell, avail - 8) : cell;
              const boxH = band ? 400 : cell * 0.78;
              const scale = band ? (boxW - 24) / w : Math.min((boxW - 24) / q.w, (boxH - 24) / (q.h ?? 1));
              const checks = placeChecks(doc, k);
              return (
                <Box key={k} component="button" type="button" onClick={() => open(k)} sx={{
                  all: "unset", boxSizing: "border-box", cursor: "pointer", width: boxW, borderRadius: "8px", bgcolor: "rgba(255,255,255,.75)", border: `1px solid ${HAIRLINE}`,
                  transition: "border-color .15s, box-shadow .15s", "&:hover": { borderColor: SEL, boxShadow: "0 10px 30px rgba(31,45,78,.12)" }, "&:focus-visible": { outline: `2px solid ${SEL}` },
                }}>
                  <Box sx={{ height: band ? "auto" : boxH, minHeight: band ? 80 : undefined, display: "grid", placeItems: "center", p: 1.5, bgcolor: "#eef1f6", borderRadius: "8px 8px 0 0" }}>
                    <Scaled css={sheet.css} html={sheet.html[k]} w={w} h={q.h} scale={scale} radius={band ? 0 : 3} />
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 1 }}>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography sx={{ fontSize: "0.84rem", fontWeight: 650, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{q.label}</Typography>
                      <Typography sx={{ fontSize: "0.72rem", color: MUTED, fontVariantNumeric: "tabular-nums" }}>{sizeLabel(q)} · {q.out === "html" ? "paste block" : "PNG"}</Typography>
                    </Box>
                    <StateTag state={placeState(checks)} n={checks.length} />
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

/* ── the places: the row on top, "+ Place" ── */

function AddPlace({ doc, set, canEdit, onAdded }: { doc: BannerDoc; set: Set; canEdit: boolean; onAdded: (k: PresetKey) => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const made = sizesOf(doc);
  return (
    <>
      <Button size="small" disabled={!canEdit} onClick={(e) => setAnchor(e.currentTarget)} startIcon={<AddRoundedIcon sx={{ fontSize: 17 }} />}
        sx={{ ...btn, color: INK, border: `1px solid ${HAIRLINE}`, bgcolor: "#fff", borderRadius: "6px", py: 0.35, flexShrink: 0 }}>Place</Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} slotProps={{ paper: { sx: { width: 300, borderRadius: "10px", maxHeight: 520 } } }}>
        {GROUPS.flatMap((g) => [
          <ListSubheader key={`h-${g.key}`} sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: MUTED, lineHeight: "30px" }}>{g.label}</ListSubheader>,
          ...PRESETS.filter((p) => p.group === g.key).map((p) => {
            const on = made.includes(p.key);
            const last = on && made.length === 1;
            return (
              <MenuItem key={p.key} disabled={last} onClick={() => { set((d) => togglePlace(d, p.key)); if (!on) { onAdded(p.key); setAnchor(null); } }} sx={{ gap: 1, py: 0.75, whiteSpace: "normal" }}>
                <Shape k={p.key} on={on} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.84rem", fontWeight: 650, color: INK }}>{p.label}</Typography>
                  <Typography sx={{ fontSize: "0.72rem", color: MUTED, whiteSpace: "normal" }}>{sizeLabel(p)} · {p.out === "html" ? "paste block for the shop" : "a picture"}</Typography>
                </Box>
                <Box sx={{ width: 18, height: 18, borderRadius: "3px", display: "grid", placeItems: "center", bgcolor: on ? SEL : "transparent", border: on ? "none" : "1.5px solid #b9c6d1", color: "#fff", flexShrink: 0 }}>{on && <CheckIcon sx={{ fontSize: 14 }} />}</Box>
              </MenuItem>
            );
          }),
        ])}
        <Typography sx={{ px: 2, pt: 1, pb: 0.5, fontSize: "0.72rem", color: MUTED, whiteSpace: "normal" }}>A tick puts the banner there, a second click takes it out.</Typography>
      </Menu>
    </>
  );
}

/* ── the stage ── */

export default function Stage({ doc, set, prefix, view, setView, font, fontFailed, title, canEdit, pages, pageId, setPageId, saved, pieceId, projectId, me, api, pick, setPick, language }: {
  doc: BannerDoc; set: Set; prefix: string; view: View; setView: (v: View) => void; font: string | null; fontFailed: boolean; title: string; canEdit: boolean;
  pages: Pages; pageId: number | null; setPageId: (id: number) => void; saved: boolean; pieceId: number; projectId: number; me: string;
  api: Parameters<typeof PageBar>[0]["api"]; pick: PickPart | null; setPick: (p: PickPart | null) => void; language: React.ReactNode;
}) {
  const [box, width] = useWidth<HTMLDivElement>();
  const [device, setDevice] = useState<Device>("desktop");
  const made = sizesOf(doc);
  const k: PresetKey | null = view !== "all" && view !== "pages" && made.includes(view) ? view : null;
  const p = k ? PRESET[k] : null;
  const live = p?.out === "html";
  const shown = useMemo(() => (k ? staged(doc, k) : null), [doc, k]);
  const block = useMemo(() => (k && live && shown ? fade(pasteBlock(shown.doc, k, prefix, title), shown.ph) : ""), [shown, k, prefix, title, live]);
  const still = useMemo(() => {
    if (!k || live || !shown) return null;
    const m = stillMarkup(shown.doc, k, prefix);
    return { css: m.css, html: fade(m.html, shown.ph) };
  }, [shown, k, prefix, live]);
  const png = usePng(doc, prefix, title, font);
  const avail = Math.max(240, width - 48);
  const phone = live && device === "mobile";
  const frameWidth = phone ? 390 : k && isBand(k) ? 1280 : p?.w ?? 1200;
  const current: View = k ?? (view === "pages" ? "pages" : "all");
  const placedN = pages.placed.reduce((n, x) => n + x.mine.length, 0);
  const checks = useMemo(() => (k ? placeChecks(doc, k) : []), [doc, k]);

  // where the part that is open sits, so its card opens right under the banner below it - never over the banner, so
  // every other part stays in view and can be clicked
  const frame = useRef<HTMLIFrameElement | null>(null);
  const stillBox = useRef<HTMLDivElement | null>(null);
  const col = useRef<HTMLDivElement | null>(null);
  const dock = useRef<HTMLDivElement | null>(null);
  const rect = useRef<Hit["rect"]>(null);
  const [notch, setNotch] = useState({ left: 0, arrow: 40 });
  const edW = pick === "picture" ? 440 : 360;
  const partRect = useCallback((): DOMRect | null => {
    if (live && frame.current && rect.current) {
      const f = frame.current.getBoundingClientRect();
      const z = Math.max(0.1, Math.min(1, (phone ? avail - 16 : avail) / frameWidth));
      const r = rect.current;
      return new DOMRect(f.left + r.x * z, f.top + r.y * z, r.w * z, r.h * z);
    }
    const root = stillBox.current;
    if (root && pick) {
      const el = pick === "background" ? root.querySelector(`.${prefix}`) : root.querySelector(PART_CLASS[pick].map((c) => `.${prefix}-${c}`).join(","));
      if (el) return el.getBoundingClientRect();
    }
    return null;
  }, [live, phone, avail, frameWidth, pick, prefix]);
  const place = useCallback(() => {
    const r = partRect();
    const c = col.current?.getBoundingClientRect();
    if (!r || !c) return;
    const center = Math.max(r.left, Math.min(r.right, r.left + Math.min(r.width / 2, 120))) - c.left;
    const left = Math.max(0, Math.min(c.width - edW, center - 48));
    setNotch({ left, arrow: Math.max(18, Math.min(edW - 18, center - left)) });
  }, [partRect, edW]);
  useLayoutEffect(() => { if (pick) place(); }, [pick, doc, width, place]);
  useEffect(() => { if (pick) requestAnimationFrame(() => dock.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })); }, [pick]);
  const onHit = useCallback((h: Hit | null, kind: "pick" | "where" = "pick") => {
    if (h?.rect) rect.current = h.rect;
    if (kind === "pick") setPick(h?.part ?? null);
    requestAnimationFrame(place);
  }, [setPick, place]);
  // a new place, a new view: nothing open
  useEffect(() => { setPick(null); }, [current]); // eslint-disable-line react-hooks/exhaustive-deps

  const places = (
    <SquareChoice<string> value={current} onChange={(v) => setView(v as View)} options={[
      ...made.map((x) => ({ key: x, label: PRESET[x].short })),
      { key: "pages", label: "In a page", count: placedN || undefined },
      ...(made.length > 1 ? [{ key: "all", label: "All places", count: made.length }] : []),
    ]} />
  );

  return (
    <Pane tone="stage" pad={false}>
      <Box sx={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 1.1, borderBottom: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.6)", flexShrink: 0, flexWrap: "wrap" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: "1 1 auto", minWidth: 0, flexWrap: "wrap" }}>
            {places}
            <AddPlace doc={doc} set={set} canEdit={canEdit} onAdded={(x) => setView(x)} />
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
            {live && k && <SquareChoice<Device> value={device} onChange={setDevice} options={[{ key: "desktop", label: "Desktop" }, { key: "mobile", label: "Phone" }]} />}
            {language}
            <GetIt doc={doc} k={k} prefix={prefix} title={title} png={png} />
          </Box>
        </Box>
        <Box sx={{ flex: 1, minHeight: 0 }}>
          {current === "pages" ? (
            <Box sx={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
              <PageBar api={api} doc={doc} set={set} pages={pages} onShow={setPageId} />
              <Box sx={{ flex: 1, minHeight: 0 }}>
                <InPage pieceId={pieceId} projectId={projectId} pages={pages} pageId={pageId} setPageId={setPageId} saved={saved} />
              </Box>
            </Box>
          ) : (
            <Box ref={box} sx={{ height: "100%", overflowY: "auto", p: 3, boxSizing: "border-box" }}
              onMouseDown={(e) => {
                // a click beside the banner closes the part that is open; a click on the banner opens another
                const t = e.target as Node;
                if (!stillBox.current?.contains(t) && !frame.current?.contains(t) && !dock.current?.contains(t)) setPick(null);
              }}>
              {!k || !p ? (
                <Overview doc={doc} prefix={prefix} open={(x) => setView(x)} avail={avail} />
              ) : (
                <>
                  <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 2, flexWrap: "wrap" }}>
                    <Typography sx={{ fontSize: "1.02rem", fontWeight: 700, color: INK }}>{p.label}</Typography>
                    <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{sizeLabel(p)} · {p.note}{live && p.motion && (doc.content.rotatingWords.length > 1 || doc.content.photos.length > 1) ? " · it changes every 2.6 s while on screen" : ""}</Typography>
                  </Box>
                  <Box ref={col}>
                    <Box sx={{ display: "flex", justifyContent: "center" }}>
                      {live ? (
                        <LiveFrame key={`${k}-${phone ? "p" : "d"}`} block={block} width={frameWidth} font={font ?? ""} avail={avail} phone={phone} prefix={prefix} picked={pick} onHit={onHit} frameRef={frame} />
                      ) : still && (
                        <StillView css={still.css} html={still.html} w={p.w} h={p.h} scale={Math.min(1, avail / p.w, k === "story" || k === "portrait" || k === "sky" ? 620 / (p.h ?? 1) : 1)} prefix={prefix} picked={pick} onHit={(h) => onHit(h)} boxRef={stillBox} />
                      )}
                    </Box>
                    {pick && (
                      <Box ref={dock} sx={{ position: "relative", mt: 1.5, ml: `${notch.left}px`, width: edW, maxWidth: "100%", scrollMarginBottom: "24px" }}>
                        <Box sx={{ position: "absolute", top: -6, left: notch.arrow - 6, width: 12, height: 12, bgcolor: "#fff", borderLeft: `1px solid ${HAIRLINE}`, borderTop: `1px solid ${HAIRLINE}`, transform: "rotate(45deg)", zIndex: 1 }} />
                        <Editor key={`${k}-${pick}`} doc={doc} set={set} k={k} part={pick} canEdit={canEdit} projectId={projectId} pieceId={pieceId} me={me} onClose={() => setPick(null)} />
                      </Box>
                    )}
                  </Box>
                  <Box sx={{ maxWidth: 720, mx: "auto", mt: 2.5 }}>
                    {!pick && (
                      <Typography sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.75, fontSize: "0.8rem", color: MUTED, mb: 1.5 }}>
                        <TouchAppOutlinedIcon sx={{ fontSize: 17 }} />Click the words, the button, the picture or the background on the banner to change them.
                      </Typography>
                    )}
                    <Box sx={{ bgcolor: "rgba(255,255,255,.8)", border: `1px solid ${HAIRLINE}`, borderRadius: "8px", px: 2, py: 1.25 }}>
                      <CheckLines items={checks} ok={`Ready for the ${p.short.toLowerCase()}: it fits, and the brand's rules are kept.`} />
                    </Box>
                    {png.note && <Typography sx={{ mt: 1, fontSize: "0.8rem", color: "#7f4f0b", textAlign: "center" }}>{png.note}</Typography>}
                  </Box>
                </>
              )}
              {fontFailed && (
                <Typography sx={{ mt: 2.5, textAlign: "center", fontSize: "0.74rem", color: MUTED }}>
                  The brand&apos;s type could not be loaded here - drawn in the nearest look-alike. The shop draws in its own.
                </Typography>
              )}
            </Box>
          )}
        </Box>
      </Box>
    </Pane>
  );
}
