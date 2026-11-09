"use client";
// THE MAP OF THE POST (night of 09.11.2026, flow standard §1, §3, §5). The left pane is the post's map: its pages, and
// under the open page its elements - the words, the pictures, the logo, the shapes - each with its state (written ●,
// empty ○, picture missing ▣, being written = shimmer). A click on an element selects it on the canvas and opens its
// fields under its row: a picture's slot (Make it / Upload, or Make another · Upload · Gallery · Remove) and the
// element's own properties (font, colour, effects, arrange - the editor's sections, here instead of a floating window:
// SARCLA 08.11, "the window needs to be movable, so it doesn't appear in front of the design"). A new post starts with
// "Write the whole post with AI"; at the foot, always in reach, the LAST STEP · Publish and the Export.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import LockOpenOutlinedIcon from "@mui/icons-material/LockOpenOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import { DesignThumb } from "@/app/editor/designRender";
import type { DesignNode } from "@/lib/design-document";
import { plainText } from "@/lib/editor/richText";
import { STATUS_LABEL } from "@/lib/content/pieceRules";
import { MAX_PAGES, clonePage, insertPage, movePage, pageId, pageIn, pageWords, removePage, sizeOf } from "@/lib/content/studio/kinds/social/design";
import { templateByKey } from "@/lib/content/studio/kinds/social/templates";
import { enabled } from "@/lib/content/studio/kinds/social/model";
import { hasOwnWords, isPlaceholder } from "@/lib/content/studio/kinds/social/start";
import { dayLabel } from "../../../work/ui";
import { LastStep, MapRow, PictureSlot, shimmerSx, useClock, type PartState } from "../../standard";
import { PINK } from "../../parts";
import { T } from "./look";
import { templatePage } from "./actions";
import { headlineNode, headlineOf, isEmptyFrame, isLogoNode, isPictureNode } from "./useDesignAi";
import ExportMenu from "./ExportMenu";
import type { StudioCtx } from "./Studio";

/* ── the elements ── */

const COLOUR_NAMES: Record<string, string> = { "#D80901": "APSOparts red", "#274E64": "Petrol", "#16303F": "Dark petrol", "#FFFFFF": "White", "#000000": "Black", "#16202A": "Ink", "#F4F6F8": "Light grey", "#DDE5EB": "Mist" };
function colourName(c: string | undefined): string {
  if (!c) return "";
  const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/i.exec(c.replace(/\s+/g, ""));
  if (m) {
    const hex = `#${[m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
    const soft = m[4] !== undefined && Number(m[4]) < 1;
    return `${COLOUR_NAMES[hex] ?? hex}${soft ? ", see-through" : ""}`;
  }
  return COLOUR_NAMES[c.toUpperCase()] ?? c;
}

export function elementName(n: DesignNode, headlineId: string | null): string {
  if (n.kind === "text") return n.id === headlineId ? "Headline" : "Text";
  if (isLogoNode(n)) return "Logo";
  if (n.kind === "image") return "Picture";
  if (isEmptyFrame(n)) return "Picture frame";
  if (n.kind === "scrim") return "Shade";
  if (n.kind === "rect" || n.kind === "ellipse") return "Shape";
  if (n.kind === "arrow") return "Arrow";
  return n.kind.charAt(0).toUpperCase() + n.kind.slice(1);
}
function elementLine(n: DesignNode): string {
  if (n.kind === "text") return isPlaceholder(n.text) ? "Not written yet - double-click it on the post" : plainText(n.text).replace(/\s+/g, " ").trim();
  if (isLogoNode(n)) return "APSOparts";
  if (n.kind === "image") return "The picture is in";
  if (isEmptyFrame(n)) return "No picture yet - make or upload one";
  if (n.kind === "rect" || n.kind === "ellipse") return colourName(n.fill);
  return "";
}
/** The id of the page's headline (its biggest words). */
export function headlineIdOf(nodes: DesignNode[]): string | null {
  return headlineNode(nodes)?.id ?? null;
}

/** The editor's properties of the selection, moved into the open row (one host element, carried where it is needed). */
function HostSlot({ host }: { host: HTMLElement | null }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !host) return;
    el.appendChild(host);
    return () => { if (host.parentNode === el) el.removeChild(host); };
  }, [host]);
  return (
    <Box ref={ref} sx={{
      mt: 1, mx: -1, borderTop: `1px solid ${T.line}`,
      // the editor's selection card, made part of the row: no frame of its own, its controls in full
      "& .MuiCard-root": { border: "0 !important", borderRadius: "0 !important", m: "0 !important", boxShadow: "none !important", bgcolor: "transparent !important", position: "static !important", width: "auto !important", maxWidth: "none !important", transform: "none !important" },
      "& .MuiCard-root > .MuiBox-root": { maxHeight: "none !important" },
      "& .MuiButton-root": { textTransform: "none", borderRadius: "6px" },
      // the words themselves are edited on the post (double-click, the key words red) - not again here in raw form
      "& .MuiTextField-root:has([data-testid=edit-text-field])": { display: "none" },
      "& .MuiCard-root > .MuiBox-root:first-of-type > .MuiTypography-root:first-of-type": { flex: "1 1 calc(100% - 32px)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
    }} />
  );
}

const FRESH_HEADLINE = (templateByKey("spotlight")?.words.headline ?? "").replace(/\*/g, "");

export default function PostMap({ ctx, host, onPublish, onGallery }: {
  ctx: StudioCtx; host: HTMLElement | null; onPublish: () => void; onGallery: (nodeId: string) => void;
}) {
  const d = ctx.doc.design;
  const ai = ctx.ai;
  const [menu, setMenu] = useState<{ el: HTMLElement; i: number } | null>(null);
  const [shape, setShape] = useState<"one" | "carousel">(d.pages.length > 1 ? "carousel" : "one");
  const nodes = ctx.live?.nodes ?? [];
  const headlineId = headlineIdOf(nodes);
  // a group (a text and its red dash) opens at its words, as the canvas's label and the assistant name it
  const openId = ctx.selection.find((id) => nodes.some((n) => n.id === id && n.kind === "text")) ?? ctx.selection.find((id) => nodes.some((n) => n.id === id)) ?? null;
  const rows = useRef<Record<string, HTMLDivElement | null>>({});
  const scroller = useRef<HTMLDivElement>(null);
  const page = d.pages[ctx.pageIx];
  const working = ai.working && ai.working.pageId === page?.id ? ai.working : null;
  const clock = useClock(!!ai.working);

  // a click on the canvas opens that element here, and brings its row into view
  useEffect(() => {
    if (!openId) return;
    const el = rows.current[openId];
    if (el) setTimeout(() => el.scrollIntoView({ block: "nearest", behavior: "smooth" }), 60);
  }, [openId]);

  const words = page ? (ctx.live ? pageWords(ctx.live) : pageWords(pageIn(d, page, ctx.fmt))) : [];
  // the start card stays until the post has words of its own (placeholders are not words); an older post that still
  // shows the spotlight template's own words counts as new too, until its first change
  const pagesNodes = d.pages.map((pg, i) => (i === ctx.pageIx && ctx.live ? ctx.live : pageIn(d, pg, ctx.fmt)).nodes);
  const fresh = !hasOwnWords(pagesNodes) || (d.pages.length <= 1 && !!FRESH_HEADLINE && words.join(" | ").includes(FRESH_HEADLINE) && !ctx.doc.log.length);

  const writeAll = (kind: "one" | "carousel") => ai.ask(kind === "carousel"
    ? "Make a carousel of 5 pages from the project's brief: a cover, then one idea per page, the last page points to the shop. Keep the shop's own photos where they fit; no new pictures."
    : "Write this post from the project's brief: lay this page out again with the spotlight template (op template), with real words in our manner for its small line, headline, sentence and button - none of the placeholders stay - and a prompt for a fitting photo for its picture.",
  null, kind === "carousel" ? "Wrote the whole post as a carousel" : "Wrote the whole post");

  const stateOf = (n: DesignNode): PartState => {
    if (ai.making[n.id]) return "working";
    if (working && (working.ids === "all" ? n.kind === "text" : working.ids.includes(n.id))) return "working";
    if (isEmptyFrame(n)) return "picture";
    if (n.kind === "text") return isPlaceholder(n.text) ? "empty" : "written";
    return "written";
  };
  const patch = (id: string, p: Partial<DesignNode>) => ctx.canvas.current?.commit((all) => all.map((n) => (n.id === id ? { ...n, ...p } : n)));
  const s = sizeOf(ctx.fmt, d);
  const thumbW = Math.max(22, Math.round((34 * s.w) / s.h));
  const addPage = () => {
    const t = templateByKey("slide")!;
    const at = ctx.pageIx + 1;
    ctx.set((x) => ({ ...x, design: insertPage(x.design, at, { id: pageId(), by: templatePage(x.design, t, { ...t.words, number: String(at + 1).padStart(2, "0") }, ctx.mf) }) }));
    ctx.goPage(at);
  };
  const act = (fn: () => void) => { setMenu(null); fn(); };
  // the elements in reading order: top to bottom, left to right
  const ordered = [...nodes].sort((a, b) => a.y - b.y || a.x - b.x);
  const p = ctx.api.data.piece;
  // the last step in one line: the approval, the day, the captions written
  const nets = enabled(ctx.doc);
  const captions = nets.filter((n) => ctx.doc.networks[n].text.trim()).length;
  const approval = STATUS_LABEL[p.status] ?? "To do"; // the bar's own words ("In review"), never a second name for the same state
  const lastSub = `${approval} · ${p.dueDate ? dayLabel(p.dueDate) : "no day yet"} · ${nets.length ? `${captions} of ${nets.length} captions` : "no network yet"}`;

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* the map's head */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, pt: 1.75, pb: 1, flexShrink: 0 }}>
        <Typography component="h2" sx={{ flex: 1, fontSize: "0.72rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: T.ink3 }}>Build</Typography>
        {!fresh && ctx.canEdit && ctx.api.data.ai && (
          <Box component="button" type="button" disabled={!!ai.working} onClick={() => void writeAll(d.pages.length > 1 ? "carousel" : "one")} sx={{ all: "unset", cursor: ai.working ? "default" : "pointer", fontSize: "0.76rem", fontWeight: 650, color: ai.working ? T.ink3 : PINK, "&:hover": { textDecoration: ai.working ? "none" : "underline" } }}>
            Write it all again
          </Box>
        )}
      </Box>

      <Box ref={scroller} sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 1.25, pb: 2, "&::-webkit-scrollbar": { width: 8 }, "&::-webkit-scrollbar-thumb": { bgcolor: "rgba(17,24,39,.12)", borderRadius: 4 } }}>
        {/* the start: what are you making, and one button that writes it */}
        {fresh && ctx.canEdit && (
          <Box sx={{ mx: 0.75, mb: 1.5, p: 1.75, borderRadius: "10px", border: `1px solid ${T.line}`, bgcolor: "#fff", boxShadow: "0 1px 2px rgba(16,24,40,.04)", ...(ai.working ? shimmerSx : {}) }}>
            <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: T.ink, mb: 1 }}>What are you making?</Typography>
            <SquareChoice value={shape} onChange={setShape} options={[{ key: "one", label: "One picture" }, { key: "carousel", label: "A carousel" }]} />
            <Box component="button" type="button" disabled={!ctx.api.data.ai || !!ai.working} onClick={() => void writeAll(shape)} sx={{
              all: "unset", boxSizing: "border-box", cursor: !ctx.api.data.ai || ai.working ? "default" : "pointer", mt: 1.5, width: "100%", height: 40, borderRadius: "8px",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 0.75, px: 1.5, bgcolor: !ctx.api.data.ai ? "#d9a8bf" : PINK, color: "#fff", fontSize: "0.86rem", fontWeight: 700,
              whiteSpace: "nowrap", overflow: "hidden", "&:hover": { bgcolor: !ctx.api.data.ai || ai.working ? undefined : "#a3245c" }, "&:focus-visible": { outline: `2px solid ${T.focus}`, outlineOffset: 2 }, "& svg": { fontSize: 18 },
            }}>
              <AutoAwesomeOutlinedIcon />{ai.working ? `Writing the post · ${clock}` : "Write the whole post with AI"}
            </Box>
            <Typography sx={{ mt: 1, fontSize: "0.76rem", color: T.ink3, lineHeight: 1.45 }}>
              {ctx.api.data.ai ? "or open a part below and write it yourself - double-click the words on the canvas." : "The AI is not set up on this hub - open a part below and write it yourself."}
            </Typography>
          </Box>
        )}

        {/* the pages; under the open one, its elements */}
        {d.pages.map((pg, i) => {
          const on = i === ctx.pageIx;
          const pw = on && ctx.live ? pageWords(ctx.live) : pageWords(pageIn(d, pg, ctx.fmt));
          const pageWorking = working && on && working.ids === "all";
          return (
            <MapRow key={pg.id} open={on} depth={0}
              state={pageWorking ? "working" : pw.length ? "written" : "empty"}
              name={d.pages.length > 1 ? (i === 0 ? "Page 1 · cover" : `Page ${i + 1}`) : "The post"}
              line={pw[0] ? (headlineOf((on && ctx.live ? ctx.live : pageIn(d, pg, ctx.fmt)).nodes) || pw[0]) : "Empty page"}
              thumb={<Box sx={{ flexShrink: 0, borderRadius: "4px", overflow: "hidden", boxShadow: `0 0 0 1px ${T.line}`, lineHeight: 0 }}><DesignThumb doc={on && ctx.live ? ctx.live : pageIn(d, pg, ctx.fmt)} width={thumbW} radius={4} /></Box>}
              actions={ctx.canEdit ? (
                <Tooltip title="Page: duplicate, move, delete"><Box component="button" type="button" aria-label={`Page ${i + 1}: more`} onClick={(e) => setMenu({ el: e.currentTarget, i })} sx={{ all: "unset", cursor: "pointer", width: 26, height: 26, display: "grid", placeItems: "center", borderRadius: "6px", color: T.ink3, "&:hover": { bgcolor: "#fff", color: T.ink } }}><MoreVertIcon sx={{ fontSize: 17 }} /></Box></Tooltip>
              ) : undefined}
              onClick={() => { if (on) ctx.canvas.current?.select([]); else ctx.goPage(i); }}>
              <Box sx={{ mt: 0.25 }}>
                {!ordered.length && <Typography sx={{ px: 1, py: 1, fontSize: "0.78rem", color: T.ink3 }}>The page is empty - take a template, or add words or a picture from the tools on the left.</Typography>}
                {ordered.map((n) => {
                  const open = openId === n.id;
                  const frame = isEmptyFrame(n);
                  const pic = isPictureNode(n);
                  return (
                    <MapRow key={n.id} open={open} depth={0} dim={n.hidden}
                      rowRef={(el) => { rows.current[n.id] = el; }}
                      state={stateOf(n)} name={elementName(n, headlineId)} line={elementLine(n)}
                      actions={ctx.canEdit ? (
                        <Box sx={{ display: "flex", "& button": { all: "unset", cursor: "pointer", width: 24, height: 24, display: "grid", placeItems: "center", borderRadius: "6px", color: T.ink3, "&:hover": { bgcolor: "#fff", color: T.ink } }, "& svg": { fontSize: 15 } }}>
                          <Tooltip title={n.hidden ? "Show" : "Hide"}><button type="button" onClick={() => patch(n.id, { hidden: !n.hidden })}>{n.hidden ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}</button></Tooltip>
                          <Tooltip title={n.locked ? "Unlock" : "Lock"}><button type="button" onClick={() => patch(n.id, { locked: !n.locked })}>{n.locked ? <LockOutlinedIcon /> : <LockOpenOutlinedIcon />}</button></Tooltip>
                          <Tooltip title="Delete"><button type="button" onClick={() => ctx.canvas.current?.commit((all) => all.filter((x) => x.id !== n.id))}><DeleteOutlineIcon /></button></Tooltip>
                        </Box>
                      ) : undefined}
                      onClick={() => ctx.canvas.current?.select(open ? [] : [n.id])}>
                      {(frame || pic) && (
                        <Box sx={{ pt: 0.5 }}>
                          <PictureSlot url={pic ? (n.src ?? null) : null} idea={ai.ideaFor(n.id)} onIdea={(v) => ai.setIdea(n.id, v)} making={!!ai.making[n.id]} uploading={!!ai.uploading[n.id]} error={ai.slotError[n.id]}
                            canEdit={ctx.canEdit && !n.locked} canMake={ctx.api.data.ai} height={pic ? 120 : 96} circle={n.kind === "ellipse" || n.mask === "circle"}
                            onMake={() => void ai.makeFor(n.id)} onUpload={(f) => void ai.uploadFor(n.id, f)} onGallery={() => onGallery(n.id)} onRemove={() => ai.removeFrom(n.id)} />
                        </Box>
                      )}
                      {open && <HostSlot host={host} />}
                    </MapRow>
                  );
                })}
              </Box>
            </MapRow>
          );
        })}
        {ctx.canEdit && d.pages.length < MAX_PAGES && (
          <Box component="button" type="button" onClick={addPage} sx={{
            all: "unset", boxSizing: "border-box", cursor: "pointer", display: "flex", alignItems: "center", gap: 1, width: "100%", mt: 0.5, px: 1, py: 0.8, borderRadius: "8px",
            fontSize: "0.82rem", fontWeight: 650, color: T.ink2, "&:hover": { bgcolor: T.hover, color: T.ink }, "& svg": { fontSize: 18 },
          }}>
            <AddIcon />{d.pages.length > 1 ? "Add a page" : "Add a page - it becomes a carousel"}
          </Box>
        )}
      </Box>

      {/* the last step, always in reach */}
      <Box sx={{ flexShrink: 0, borderTop: `1px solid ${T.line}`, p: 1.25, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 1, bgcolor: "#fff" }}>
        <LastStep name="Publish" onClick={onPublish} sub={lastSub} />
        <ExportMenu ctx={ctx} />
      </Box>

      <Menu anchorEl={menu?.el ?? null} open={!!menu} onClose={() => setMenu(null)} slotProps={{ paper: { sx: { borderRadius: "10px", minWidth: 190 } } }}>
        <MenuItem onClick={() => act(() => { const i = menu!.i; ctx.set((x) => ({ ...x, design: insertPage(x.design, i + 1, clonePage(x.design.pages[i])) })); ctx.goPage(i + 1); })}>Duplicate</MenuItem>
        <MenuItem disabled={!menu || menu.i === 0} onClick={() => act(() => { const i = menu!.i; ctx.set((x) => ({ ...x, design: movePage(x.design, i, i - 1) })); ctx.goPage(i - 1); })}>Move up</MenuItem>
        <MenuItem disabled={!menu || menu.i >= d.pages.length - 1} onClick={() => act(() => { const i = menu!.i; ctx.set((x) => ({ ...x, design: movePage(x.design, i, i + 1) })); ctx.goPage(i + 1); })}>Move down</MenuItem>
        <MenuItem disabled={d.pages.length < 2} onClick={() => act(() => {
          const i = menu!.i;
          ctx.set((x) => ({ ...x, design: removePage(x.design, i) }));
          ctx.goPage(Math.max(0, i <= ctx.pageIx ? ctx.pageIx - 1 : ctx.pageIx));
          ctx.reload();
        })} sx={{ color: "#b42318" }}>Delete the page</MenuItem>
      </Menu>
    </Box>
  );
}
