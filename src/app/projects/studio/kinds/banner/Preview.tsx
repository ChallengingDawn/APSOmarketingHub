"use client";
// THE BANNER'S STAGE (08.11.2026, Content v3; SARCLA tonight: "banner also" - the editing "very confusing"; this
// morning: "the banner can be in multiple places", "we should be able to push it inside a page visually").
// The banner in the middle, at its real size in the place it is for, and nothing else in the way (09.11.2026, the
// flow standard: the places, its parts and "Get it" are on the map, left - Map.tsx):
//   the bar       the place shown and its size; Desktop / Phone and the language top right
//   the banner    the shop's places run live in a frame exactly as pasted (the word changes, the photos crossfade,
//                 desktop or phone); the others drawn as their PNG will be. A click on a part of it - the headline,
//                 the line, the button, the picture, its label, the background - selects it: a pink outline and a small
//                 dark label under it, "<Part> · Ask AI · ×", and its fields open in the map; empty words show greyed
//                 until written; while the AI writes, the banner shimmers with the clock
//   under it      what to look at before it goes out, for this place
//   In a page     the page to-do it was put on, with the banner in its place (Place.tsx InPage; Content v7: put there by the
//                 map's last step "Put it on a page", ToPage.tsx)
//   the shop banner (Content v7) its 1920 x 600 and, with Phone, its 1080 x 900 picture - as the shop's slider shows them
// Gone from the first studio: the build column of fields beside the banner, the sheet of "words here", checks and files
// under every place, the picture's address field, the notes field - each part is changed on the banner itself now.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ListSubheader from "@mui/material/ListSubheader";
import Popover from "@mui/material/Popover";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import CloseIcon from "@mui/icons-material/Close";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CheckIcon from "@mui/icons-material/Check";
import TouchAppOutlinedIcon from "@mui/icons-material/TouchAppOutlined";

import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import { esc, photoLabel } from "@/lib/content/studio/kinds/banner/brand";
import { placeChecks, placeState } from "@/lib/content/studio/kinds/banner/checks";
import { GROUPS, PRESET, PRESETS, hasPhone, isBand, sizeLabel, sizesOf, togglePlace, wordsFor, type BannerDoc, type PresetKey } from "@/lib/content/studio/kinds/banner/model";
import { pasteBlock, pickCss, previewDoc, previewSwap, sizeOf, stillMarkup, stillSheet, type PickPart } from "@/lib/content/studio/kinds/banner/render";
import { Pane, btn, type Device } from "../../parts";
import { PART_NAME, inLine, type Set } from "./Editor";
import { CheckLines, type BannerAi, type BannerBusy, type usePng } from "./Output";
import PartPopup from "./Pops";
import { AI_BOX_ATTR } from "@/lib/content/studio/kinds/page/barAi";
import { isWordPart, readPart, targetOf, writePart, type Target, type WordPartKey } from "@/lib/content/studio/kinds/banner/edit";
import { shimmer, useClock } from "../video/map";
import { InPage, PageBar, type Pages } from "./Place";
import { storeForLang } from "../../productPictures";
import { PhotoPicker, Scaled, useWidth } from "./ui";
import { PicturePanel, makePicture, uploadPicture, type PictureAspect } from "../../pictures";

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
function LiveFrame({ block, width, font, avail, phone, prefix, picked, onHit, frameRef, hold, onEdit }: {
  block: string; width: number; font: string; avail: number; phone: boolean; prefix: string; picked: PickPart | null;
  onHit: (h: Hit | null, kind: "pick" | "where") => void; frameRef: React.MutableRefObject<HTMLIFrameElement | null>;
  /** words being typed in the frame: the banner is not swapped under the person's cursor */
  hold: boolean;
  onEdit: (e: InPlace) => void;
}) {
  const latest = useRef(block);
  latest.current = block;
  const [h, setH] = useState(phone ? 520 : 360);
  // the frame loads once per width and font; after that the banner is swapped in place - no flash while typing
  const src = useMemo(() => previewDoc(latest.current, font, "#ffffff", prefix), [font, width, prefix]); // eslint-disable-line react-hooks/exhaustive-deps
  const swap = () => frameRef.current?.contentWindow?.postMessage({ apsoBanner: "swap", html: previewSwap(latest.current) }, "*");
  useEffect(() => { if (hold) return; const t = setTimeout(swap, 120); return () => clearTimeout(t); }, [block, hold]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { frameRef.current?.contentWindow?.postMessage({ apsoBanner: "mark", part: picked }, "*"); }, [picked, frameRef]);
  const edit = useRef(onEdit);
  edit.current = onEdit;
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source !== frameRef.current?.contentWindow) return;
      const m = e.data as { apsoBanner?: string; h?: number; part?: PickPart | null; rect?: Hit["rect"]; text?: unknown; keep?: unknown } | null;
      if (m?.apsoBanner === "height") setH(Math.max(40, Math.min(4000, Number(m.h) || 0)));
      if (m?.apsoBanner === "pick") onHit(m.part ? { part: m.part, rect: m.rect ?? null } : null, "pick");
      if (m?.apsoBanner === "where" && m.part) onHit({ part: m.part, rect: m.rect ?? null }, "where");
      if (m?.apsoBanner === "dbl" && m.part) { onHit({ part: m.part, rect: m.rect ?? null }, "where"); edit.current({ kind: "dbl", part: m.part }); }
      if ((m?.apsoBanner === "typing" || m?.apsoBanner === "done") && m.part && typeof m.text === "string") {
        edit.current({ kind: m.apsoBanner, part: m.part, text: m.text.slice(0, 400), keep: m.keep !== false });
      }
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

/** What happens to words typed right on the banner: a double-click on a part, a key, the end (kept or dropped). */
export type InPlace = { kind: "dbl" | "typing" | "done"; part: PickPart; text?: string; keep?: boolean };

/**
 * A part of a picture place made a field right where it is (the frame's script does the same in the live places): the
 * words in a span of their own, typed in place - Enter or a click outside keeps them, Esc drops them.
 */
function editInDom(root: HTMLElement, P: string, part: PickPart, text: string, on: (e: InPlace) => void) {
  const el = root.querySelector<HTMLElement>(PART_CLASS[part].map((c) => `.${P}-${c}`).join(","));
  if (!el) return;
  // the headline's (and the line's) own words, its red word with them, are one field (Content v7)
  const own = el.querySelector<HTMLElement>(`.${P}-ht`);
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement?.closest(`.${P}-w`) ? NodeFilter.FILTER_REJECT : n.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP) });
  const tn = own ? null : walk.nextNode();
  const span = document.createElement("span");
  span.className = "is-editing";
  span.contentEditable = "plaintext-only";
  if (span.contentEditable !== "plaintext-only") span.contentEditable = "true";
  span.textContent = text;
  const faded = own ?? (tn?.parentElement && tn.parentElement !== el && /opacity/.test(tn.parentElement.getAttribute("style") ?? "") ? tn.parentElement : tn);
  if (faded?.parentNode) faded.parentNode.replaceChild(span, faded); else el.insertBefore(span, el.firstChild);
  let open = true;
  const finish = (keep: boolean) => {
    if (!open) return;
    open = false;
    span.removeAttribute("contenteditable");
    on({ kind: "done", part, text: (span.textContent ?? "").slice(0, 400), keep });
  };
  span.addEventListener("input", () => on({ kind: "typing", part, text: (span.textContent ?? "").slice(0, 400) }));
  span.addEventListener("keydown", (k) => {
    if (k.key === "Enter") { k.preventDefault(); finish(true); } else if (k.key === "Escape") { k.preventDefault(); k.stopPropagation(); finish(false); }
  });
  span.addEventListener("blur", () => finish(true));
  span.addEventListener("paste", (k) => { k.preventDefault(); document.execCommand("insertText", false, (k.clipboardData?.getData("text/plain") ?? "").replace(/\s+/g, " ")); });
  span.focus();
  const r = document.createRange();
  r.selectNodeContents(span);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(r);
}

/** A picture place, drawn as its PNG will be; a click on a part opens it, a double-click types in it. */
function StillView({ css, html, w, h, scale, prefix, picked, onHit, boxRef, onDbl }: {
  css: string; html: string; w: number; h: number | null; scale: number; prefix: string; picked: PickPart | null;
  onHit: (h: Hit | null) => void; boxRef: React.MutableRefObject<HTMLDivElement | null>; onDbl: (part: PickPart) => void;
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
  const partAt = (t: HTMLElement): PickPart | null => {
    for (const [part, cls] of Object.entries(PART_CLASS) as [PickPart, string[]][]) {
      if (cls.length && t.closest(cls.map((c) => `.${P}-${c}`).join(","))) return part;
    }
    if (t.closest(`.${P}-w`)) return "headline";
    return t.closest(`.${P}`) ? "background" : null;
  };
  const click = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest(".is-editing")) return;
    const part = partAt(t);
    onHit(part ? { part, rect: null } : null);
  };
  return (
    <Box ref={boxRef} className="bnstage" onClick={click} onDoubleClick={(e) => { const t = e.target as HTMLElement; if (t.closest(".is-editing")) return; const part = partAt(t); if (part) onDbl(part); }}>
      {/* what can be clicked, apart from the banner's own markup: a new zoom never redraws the banner (nor the words
          being typed on it) */}
      <style>{pickCss(P, ".bnstage ", scale)}</style>
      <Scaled css={css} html={html} w={w} h={h} scale={scale} radius={4} />
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

export function AddPlace({ doc, set, canEdit, onAdded }: { doc: BannerDoc; set: Set; canEdit: boolean; onAdded: (k: PresetKey) => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const made = sizesOf(doc);
  return (
    <>
      <Button size="small" disabled={!canEdit} onClick={(e) => setAnchor(e.currentTarget)} startIcon={<AddRoundedIcon sx={{ fontSize: 17 }} />}
        sx={{ ...btn, color: INK, py: 0.35, flexShrink: 0 }}>Add a place</Button>
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

/* ── the picture's actions on the banner itself ── */

/**
 * The picture selected on the banner (09.11.2026, the flow standard's picture slot - the same as its row on the left):
 * Make another · Upload · Gallery · Remove, in the selection's label. Making or uploading shows on the banner (`onWork`).
 */
function PictureActions({ doc, set, projectId, pieceId, me, onWork }: {
  doc: BannerDoc; set: Set; projectId: number; pieceId: number; me: string; onWork: (w: { label: string; since: number; share?: number } | null) => void;
}) {
  const c = doc.content;
  const many = c.photos.length >= 2;
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const file = useRef<HTMLInputElement | null>(null);
  const lang = doc.language;
  const words = [`${c.headline} ${c.rotatingWords[0] ?? ""}`.trim(), c.line].filter((x) => x && x.trim()).join(" ");
  const idea = words ? `A photo for a banner that says: "${words}". Industrial components in use, real, calm light.` : "Industrial components in use, real, calm light, for APSOparts.";
  const places = sizesOf(doc);
  const aspect: PictureAspect = places.some((x) => x === "story" || x === "portrait") && !places.some((x) => PRESET[x].group === "shop") ? "4:5" : places.every((x) => x === "square") ? "1:1" : "3:2";
  const put = (url: string, label = "", product?: { alt: string }) => set((d) => {
    const pic = { url, alt: product?.alt ?? "", label: product ? "" : label, ...(product ? { fit: "product" as const } : {}) };
    return d.content.photos.length >= 2
      ? { ...d, content: { ...d.content, photos: d.content.photos.some((x) => x.url === url) ? d.content.photos : [...d.content.photos, pic] } }
      : { ...d, content: { ...d.content, image: product ? pic : { ...pic, label: label || (d.content.image.fit === "product" ? "" : d.content.image.label) } } };
  });
  const make = async () => {
    setErr(null); onWork({ label: "Making the picture", since: Date.now() });
    const r = await makePicture(idea, aspect, { projectId, pieceId });
    onWork(null);
    if (!r.ok) { setErr(r.error); return; }
    put(r.picture.url);
  };
  const upload = async (list: FileList | null) => {
    const f = Array.from(list ?? []).find((x) => x.type.startsWith("image/"));
    if (!f) return;
    setErr(null); const since = Date.now(); onWork({ label: "Uploading", since, share: 0 });
    const r = await uploadPicture(f, { projectId, pieceId }, (share) => onWork({ label: "Uploading", since, share }));
    onWork(null);
    if (!r.ok) { setErr(r.error); return; }
    put(r.picture.url);
  };
  const act = { ...btn, color: "#fff", fontSize: "0.74rem", py: 0, px: 0.75, minWidth: 0, "&:hover": { bgcolor: "rgba(255,255,255,.12)" } };
  return (
    <>
      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} />
      <Button size="small" onClick={() => void make()} startIcon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 14 }} />} sx={{ ...act, color: "#f7b6cf" }}>{many ? "Make one more" : "Make another"}</Button>
      <Button size="small" onClick={() => file.current?.click()} sx={act}>Upload</Button>
      <Button size="small" onClick={(e) => setAnchor(e.currentTarget)} sx={act}>Gallery</Button>
      {!many && c.image.url && <Button size="small" onClick={() => set((d) => ({ ...d, content: { ...d.content, image: { url: "", alt: "", label: "" } } }))} sx={{ ...act, color: "rgba(255,255,255,.75)" }}>Remove</Button>}
      {err && <Typography sx={{ fontSize: "0.72rem", color: "#ffb4ae", ml: 0.5, maxWidth: 220, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={err}>{err}</Typography>}
      <Popover open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: "bottom", horizontal: "left" }} slotProps={{ paper: { sx: { width: 420, p: 1.5, borderRadius: "10px" } } }}>
        <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: MUTED, mb: 0.75 }}>The shop&apos;s products, ours</Typography>
        <PicturePanel onPick={(pic) => { put(pic.url, "", pic.kind === "product" ? { alt: pic.alt ?? "" } : undefined); setAnchor(null); }} projectId={projectId} pieceId={pieceId} me={me} aspect={aspect}
          tabs={["mine", "project"]} start="products" columns={3} store={storeForLang(lang)} />
        <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: MUTED, mt: 1.5, mb: 0.75 }}>The shop&apos;s technology photos</Typography>
        <PhotoPicker lang={lang} selected={many ? c.photos.map((x) => x.url) : [c.image.url]} onPick={(ph) => { put(ph.url, photoLabel(ph, lang)); setAnchor(null); }} />
      </Popover>
    </>
  );
}

/* ── the stage ── */

export default function Stage({ doc, set, prefix, view, setView, font, fontFailed, title, canEdit, pages, pageId, setPageId, saved, pieceId, projectId, api, pick, setPick, language, busy, onAskAi, png, onTyped, onTyping, me, ai, fromBanner = false }: {
  doc: BannerDoc; set: Set; prefix: string; view: View; setView: (v: View) => void; font: string | null; fontFailed: boolean; title: string; canEdit: boolean;
  pages: Pages; pageId: number | null; setPageId: (id: number) => void; saved: boolean; pieceId: number; projectId: number; me: string;
  api: Parameters<typeof PageBar>[0]["api"]; pick: PickPart | null; setPick: (p: PickPart | null) => void; language: React.ReactNode;
  /** the AI at work on the banner (its words shimmer, with the clock) */
  busy: BannerBusy | null;
  /** "Ask AI" on the selection's label: the cursor into the assistant */
  onAskAi: () => void;
  png: ReturnType<typeof usePng>;
  /** words typed on the banner and kept: listed under "Changes made here" with its Undo */
  onTyped?: (label: string, before: BannerDoc) => void;
  /** words being typed on the banner now (the left card does not take the cursor) */
  onTyping?: (on: boolean) => void;
  /** cv16: the banner's AI - a part's popup has its own "Ask AI" box */
  ai?: BannerAi;
  /** cv16: the part was selected on the banner (not from its row on the left): its popup opens under it */
  fromBanner?: boolean;
}) {
  const [box, width] = useWidth<HTMLDivElement>(820);
  const [device, setDevice] = useState<Device>("desktop");
  const made = sizesOf(doc);
  const k: PresetKey | null = view !== "all" && view !== "pages" && made.includes(view) ? view : null;
  const p = k ? PRESET[k] : null;
  const live = p?.out === "html";
  // the shop banner: its 1920 x 600, and with Phone its 1080 x 900 picture (Content v7)
  const phonePic = !!k && !live && hasPhone(k) && device === "mobile";
  const size = k ? sizeOf(k, phonePic) : null;
  const shown = useMemo(() => (k ? staged(doc, k) : null), [doc, k]);
  const block = useMemo(() => (k && live && shown ? fade(pasteBlock(shown.doc, k, prefix, title), shown.ph) : ""), [shown, k, prefix, title, live]);
  const drawn = useMemo(() => {
    if (!k || live || !shown) return null;
    const m = stillMarkup(shown.doc, k, prefix, { phone: phonePic });
    return { css: m.css, html: fade(m.html, shown.ph) };
  }, [shown, k, prefix, live, phonePic]);

  // words typed right on the banner (09.11.2026, the flow standard): a double-click on a part makes it a field in
  // place; every key writes the same field as the left card (which follows); Enter or a click outside keeps it, Esc
  // puts the banner back as it was. While it is typed, the banner is not redrawn under the cursor.
  const [typing, setTyping] = useState<{ part: WordPartKey; k: PresetKey; target: Target; before: BannerDoc } | null>(null);
  const typingRef = useRef(typing);
  typingRef.current = typing;
  const frozen = useRef<{ css: string; html: string } | null>(null);
  const [stillKey, setStillKey] = useState(0);
  const still = typing && frozen.current ? frozen.current : drawn;
  const onEdit = useCallback((e: InPlace) => {
    const t = typingRef.current;
    if (e.kind === "dbl") {
      // the live frame opens its field at once; where the words cannot be typed here, it is closed again
      const no = () => { if (live) frame.current?.contentWindow?.postMessage({ apsoBanner: "end", keep: false }, "*"); };
      if (!canEdit || !k || !isWordPart(e.part) || t) { if (!t) no(); return; }
      if (e.part === "label" && !doc.content.image.url && doc.content.photos.length < 2) { no(); return; }
      const text = readPart(doc, k, e.part);
      const next = { part: e.part, k, target: targetOf(doc, k, e.part), before: doc };
      typingRef.current = next;
      setTyping(next);
      onTyping?.(true);
      setPick(e.part);
      // (the frame has its field open already, with the words it shows; "edit" only opens one it has not)
      if (live) frame.current?.contentWindow?.postMessage({ apsoBanner: "edit", part: e.part, text }, "*");
      else if (stillBox.current) { frozen.current = drawn; editInDom(stillBox.current, prefix, e.part, text, (x) => onEditRef.current(x)); }
      return;
    }
    if (!t || e.part !== t.part) return;
    if (e.kind === "typing") { set((d) => writePart(d, t.k, t.part, e.text ?? "", t.target)); return; }
    // done: kept, or the banner as it was
    typingRef.current = null;
    setTyping(null);
    onTyping?.(false);
    frozen.current = null;
    setStillKey((x) => x + 1);
    if (e.keep) {
      set((d) => writePart(d, t.k, t.part, e.text ?? "", t.target));
      if ((e.text ?? "") !== readPart(t.before, t.k, t.part)) onTyped?.(`${PART_NAME[t.part]}: typed on the banner`, t.before);
    } else set(() => t.before);
  }, [canEdit, k, doc, live, drawn, prefix, set, setPick, onTyped, onTyping]);
  const onEditRef = useRef(onEdit);
  onEditRef.current = onEdit;
  // another place, another view: the words being typed are kept (they are in the banner already)
  useEffect(() => () => {
    const t = typingRef.current;
    if (!t) return;
    typingRef.current = null;
    setTyping(null);
    onTyping?.(false);
    frozen.current = null;
  }, [k, live, device]); // eslint-disable-line react-hooks/exhaustive-deps
  const [picWork, setPicWork] = useState<{ label: string; since: number; share?: number } | null>(null);
  const work = busy ? { label: busy.part === "all" && !busy.label.startsWith("Shorter words") ? "Writing the banner" : busy.label, since: busy.since } : picWork;
  const clock = useClock(work?.since ?? null);
  const avail = Math.max(240, width - 48);
  const phone = live && device === "mobile";
  const frameWidth = phone ? 390 : k && isBand(k) ? 1280 : p?.w ?? 1200;
  const current: View = k ?? (view === "pages" ? "pages" : "all");
  const checks = useMemo(() => (k ? placeChecks(doc, k) : []), [doc, k]);

  // where the part that is open sits, so its card opens right under the banner below it - never over the banner, so
  // every other part stays in view and can be clicked
  const frame = useRef<HTMLIFrameElement | null>(null);
  const stillBox = useRef<HTMLDivElement | null>(null);
  const col = useRef<HTMLDivElement | null>(null);
  const dock = useRef<HTMLDivElement | null>(null);
  const rect = useRef<Hit["rect"]>(null);
  const [notch, setNotch] = useState({ left: 0, arrow: 40 });
  // cv16 (the Page builder's element popups): a part selected on the banner opens its popup under it - words, its page,
  // look, its own "Ask AI" box, Take it out; selected from its row on the left, the small label (its fields are there),
  // whose "Ask AI" opens the popup with the cursor in its AI box (page/barAi.ts)
  const [askPop, setAskPop] = useState(false);
  useEffect(() => { setAskPop(false); }, [pick]);
  // Esc lets go of the part, wherever the cursor is (a menu or a gallery of the popup closes itself first)
  useEffect(() => {
    if (!pick) return;
    const on = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented && !typingRef.current && !document.querySelector(".MuiPopover-root, .MuiMenu-root, .MuiDialog-root")) setPick(null); };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [pick, setPick]);
  const popup = !!pick && !!ai && canEdit && (fromBanner || askPop);
  // the label under the part: its words and actions - the picture carries four of them
  const edW = popup ? (pick === "picture" || pick === "background" ? 440 : 400) : pick === "picture" ? 440 : 310;
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

  return (
    <Pane tone="stage" pad={false}>
      <Box sx={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 1.1, borderBottom: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.6)", flexShrink: 0, minHeight: 50, boxSizing: "border-box" }}>
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flex: "1 1 0", minWidth: 0, overflow: "hidden" }}>
            <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK, whiteSpace: "nowrap" }}>{p ? p.label : current === "pages" ? "In a page" : "All places"}</Typography>
            {p && <Typography sx={{ fontSize: "0.78rem", color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{size ? `${size.w} × ${size.h}` : sizeLabel(p)} · {p.note}</Typography>}
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
            {k && (live || hasPhone(k)) && <SquareChoice<Device> value={device} onChange={setDevice} options={[{ key: "desktop", label: "Desktop" }, { key: "mobile", label: "Phone" }]} />}
            {language}
          </Box>
        </Box>
        <Box sx={{ flex: 1, minHeight: 0 }}>
          {current === "pages" ? (
            <Box sx={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
              <Box sx={{ flex: 1, minHeight: 0 }}>
                <InPage pieceId={pieceId} projectId={projectId} pages={pages} pageId={pageId} setPageId={setPageId} saved={saved} />
              </Box>
            </Box>
          ) : (
            <Box ref={box} sx={{ height: "100%", overflowY: "auto", overflowX: "hidden", scrollbarGutter: "stable", p: 3, boxSizing: "border-box" }}
              onMouseDown={(e) => {
                // a click beside the banner closes the part that is open; a click on the banner opens another
                const t = e.target as Node;
                // a menu or a gallery opened from the label lives in a layer of its own: a click there is not beside it
                if (!e.currentTarget.contains(t)) return;
                if (!stillBox.current?.contains(t) && !frame.current?.contains(t) && !dock.current?.contains(t)) setPick(null);
              }}>
              {!k || !p ? (
                <Overview doc={doc} prefix={prefix} open={(x) => setView(x)} avail={avail} />
              ) : (
                <>
                  {live && p.motion && (doc.content.rotatingWords.length > 1 || doc.content.photos.length > 1) && (
                    <Typography sx={{ fontSize: "0.76rem", color: MUTED, mb: 1.25, textAlign: "center" }}>On the shop it changes every 2.6 s while on screen.</Typography>
                  )}
                  <Box ref={col}>
                    <Box sx={{ display: "flex", justifyContent: "center", position: "relative" }}>
                      {work && (
                        // the AI at work on the banner: its words shimmer, with what it does and the clock
                        <Box aria-live="polite" sx={{ position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none", borderRadius: "10px", ...shimmer, display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
                          <Box sx={{ mt: -1.5, px: 1.5, py: 0.6, borderRadius: "6px", bgcolor: "rgba(21,34,58,.88)", color: "#fff", fontSize: "0.8rem", fontWeight: 650, display: "inline-flex", alignItems: "center", gap: 1, fontVariantNumeric: "tabular-nums", boxShadow: "0 8px 24px rgba(21,34,58,.25)" }}>
                            <CircularProgress size={13} sx={{ color: "#fff" }} />{work.label}{picWork?.share !== undefined && !busy ? ` · ${Math.round(picWork.share * 100)} %` : ` · ${clock}`}
                          </Box>
                        </Box>
                      )}
                      {live ? (
                        <LiveFrame key={`${k}-${phone ? "p" : "d"}`} block={block} width={frameWidth} font={font ?? ""} avail={avail} phone={phone} prefix={prefix} picked={pick} onHit={onHit} frameRef={frame} hold={!!typing} onEdit={onEdit} />
                      ) : still && (
                        <StillView key={`${stillKey}${phonePic ? "m" : ""}`} onDbl={(part) => onEdit({ kind: "dbl", part })} css={still.css} html={still.html} w={size?.w ?? p.w} h={size?.h ?? p.h} scale={Math.min(1, avail / (size?.w ?? p.w), k === "story" || k === "portrait" || k === "sky" || phonePic ? 620 / (size?.h ?? p.h ?? 1) : 1)} prefix={prefix} picked={pick} onHit={(h) => onHit(h)} boxRef={stillBox} />
                      )}
                    </Box>
                    {pick && popup && !typing && k && (
                      <Box ref={dock} data-banner-pop={pick} sx={{ position: "relative", mt: 1.5, ml: `${notch.left}px`, width: edW, maxWidth: "100%", scrollMarginBottom: "24px" }}>
                        <Box sx={{ position: "absolute", top: -6, left: Math.min(notch.arrow, edW - 24) - 6, width: 12, height: 12, bgcolor: "#fff", borderLeft: "1px solid rgba(21,34,58,.10)", borderTop: "1px solid rgba(21,34,58,.10)", transform: "rotate(45deg)", zIndex: 1 }} />
                        <PartPopup key={`${pick}-${k}`} api={api} doc={doc} set={set} k={k} part={pick} canEdit={canEdit} ai={ai!} onClose={() => setPick(null)} onTyped={onTyped} onWork={setPicWork} />
                      </Box>
                    )}
                    {pick && (!popup || typing) && (
                      <Box ref={dock} sx={{ position: "relative", mt: 1.25, ml: `${notch.left}px`, width: "fit-content", maxWidth: "100%", scrollMarginBottom: "24px" }}>
                        <Box sx={{ position: "absolute", top: -5, left: Math.min(notch.arrow, 30) - 5, width: 10, height: 10, bgcolor: "#15223a", transform: "rotate(45deg)" }} />
                        <Box sx={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 0.25, pl: 1.25, pr: 0.25, py: 0.25, borderRadius: "6px", bgcolor: "#15223a", color: "#fff", boxShadow: "0 6px 18px rgba(21,34,58,.25)" }}>
                          <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: "#fff", mr: 0.5, whiteSpace: "nowrap" }}>{PART_NAME[pick]}{typing ? <Box component="span" sx={{ fontWeight: 500, color: "rgba(255,255,255,.7)" }}> · typing - Enter keeps it, Esc drops it</Box> : null}</Typography>
                          {pick === "picture" && canEdit && !typing && <PictureActions doc={doc} set={set} projectId={projectId} pieceId={pieceId} me={me} onWork={setPicWork} />}
                          {["eyebrow", "headline", "line", "button"].includes(pick) && canEdit && !typing && (
                            <Button size="small" onClick={() => {
                              // the bar's "Ask AI" acts on what is selected: its own popup, the cursor in its AI box (page/barAi.ts)
                              if (!ai) { onAskAi(); return; }
                              setAskPop(true);
                              setTimeout(() => dock.current?.querySelector<HTMLElement>(`[${AI_BOX_ATTR}]`)?.focus(), 120);
                            }} startIcon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 14 }} />} sx={{ ...btn, color: "#f7b6cf", fontSize: "0.74rem", py: 0, px: 0.75, minWidth: 0 }}>Ask AI</Button>
                          )}
                          <IconButton size="small" onClick={() => setPick(null)} aria-label="Let go of it" sx={{ color: "rgba(255,255,255,.75)", p: 0.4 }}><CloseIcon sx={{ fontSize: 15 }} /></IconButton>
                        </Box>
                      </Box>
                    )}
                  </Box>
                  <Box sx={{ maxWidth: 720, mx: "auto", mt: 2.5 }}>
                    {!pick && (
                      <Typography sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.75, fontSize: "0.8rem", color: MUTED, mb: 1.5 }}>
                        <TouchAppOutlinedIcon sx={{ fontSize: 17 }} />Click a part of the banner - or its row on the left - to change it.
                      </Typography>
                    )}
                    <Box sx={{ bgcolor: "rgba(255,255,255,.8)", border: `1px solid ${HAIRLINE}`, borderRadius: "8px", px: 2, py: 1.25 }}>
                      <CheckLines items={checks} ok={`Ready for the ${inLine(p.short)}: it fits, and the brand's rules are kept.`} />
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
