"use client";
// ONE PIECE OF THE CONTENT LIBRARY (SARCLA 11.11.2026: "content should really display, and in one click back to edit").
// Its picture large (a page: its hero picture; a banner: its picture), its title, its languages, how far it is, and WHERE
// IT IS: a link per store view on production and on ACC, when and by whom - "Official" on what is live on production.
// The picture and the title open the piece in its studio (the content board's address; the page studio opens at Build).

import { useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import MovieOutlinedIcon from "@mui/icons-material/MovieOutlined";
import NorthEastIcon from "@mui/icons-material/NorthEast";
import ShareOutlinedIcon from "@mui/icons-material/ShareOutlined";
import VerifiedIcon from "@mui/icons-material/Verified";
import ViewDayOutlinedIcon from "@mui/icons-material/ViewDayOutlined";
import WebOutlinedIcon from "@mui/icons-material/WebOutlined";

import { AMBER, ACCENT, GREEN, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { stateWord, type LibraryItem, type Where } from "@/lib/content/library";
import type { StudioKind } from "@/lib/content/studio/kinds";

const PINK = "#c22c6e";

export const KIND_ICON: Record<StudioKind, React.ReactNode> = {
  page: <WebOutlinedIcon />, banner: <ViewDayOutlinedIcon />, blog: <ArticleOutlinedIcon />,
  newsletter: <MailOutlineIcon />, social: <ShareOutlinedIcon />, video: <MovieOutlinedIcon />,
};

/** "11 Nov, 13:40" - the year too when it is not this one. */
export function when(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const year = d.getFullYear() !== new Date().getFullYear();
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}), hour: "2-digit", minute: "2-digit" });
}

const STATE_TONE: Record<LibraryItem["state"], { fg: string; bg: string }> = {
  official: { fg: "#fff", bg: GREEN },
  published: { fg: "#7a4b0c", bg: "#fdf0e3" },
  approved: { fg: GREEN, bg: "#e7f6ee" },
  review: { fg: "#6a46c9", bg: "#efe8fd" },
  draft: { fg: "#4a5a70", bg: "#e9eef5" },
};
const WHERE_DOT: Record<Where["kind"], string> = { prod: GREEN, acc: AMBER, hubspot: "#ff5c35", page: ACCENT, marked: GREEN };

const square = { display: "inline-flex", alignItems: "center", gap: 0.4, height: 22, px: 0.8, borderRadius: "5px", fontSize: "0.72rem", fontWeight: 650, lineHeight: 1, whiteSpace: "nowrap" } as const;

/** No picture yet: the kind's glyph and the title on its tint - a banner on the shop's petrol. */
function Placeholder({ item }: { item: LibraryItem }) {
  const dark = item.kind === "banner" || item.kind === "video";
  return (
    <Box sx={{
      position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 0.75, p: 2,
      background: dark ? "linear-gradient(135deg,#274e64 0%,#183344 100%)" : "linear-gradient(135deg,#f6f7fb 0%,#e9edf5 100%)",
      color: dark ? "#fff" : INK, "& svg": { fontSize: 26, opacity: dark ? 0.85 : 0.45 },
    }}>
      {KIND_ICON[item.kind]}
      <Typography sx={{ fontSize: "1rem", fontWeight: 700, lineHeight: 1.25, letterSpacing: "-0.01em", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {item.title}
      </Typography>
      <Typography sx={{ fontSize: "0.72rem", opacity: 0.7 }}>No picture yet</Typography>
    </Box>
  );
}

/** The piece's picture, filling the frame - a small or tall one (a product cut out on white, from the shop) whole on
 * white instead of blown up. */
function Picture({ src }: { src: string }) {
  const [whole, setWhole] = useState(false);
  return (
    <Box component="img" src={src} alt="" loading="lazy"
      onLoad={(e: React.SyntheticEvent<HTMLImageElement>) => { const i = e.currentTarget; setWhole(i.naturalWidth < 700 || i.naturalHeight > i.naturalWidth); }}
      sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: whole ? "contain" : "cover", display: "block", boxSizing: "border-box", ...(whole ? { p: 2, bgcolor: "#fff" } : {}) }} />
  );
}

/** One place it is: the environment, when and who, then a link per store view (a few, then "+ N more"). */
function WhereRow({ w, people }: { w: Where; people: Readonly<Record<string, string>> }) {
  const [all, setAll] = useState(false);
  const MAX = 5;
  const links = all ? w.links : w.links.slice(0, MAX);
  const by = w.by ? people[w.by] ?? w.by : "";
  return (
    <Box sx={{ display: "grid", gap: 0.6 }}>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75, flexWrap: "wrap", minWidth: 0 }}>
        <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: WHERE_DOT[w.kind], flexShrink: 0, alignSelf: "center" }} />
        <Typography component="span" sx={{ fontSize: "0.78rem", fontWeight: 750, color: INK }}>{w.label}</Typography>
        {w.sub && <Typography component="span" sx={{ fontSize: "0.76rem", color: MUTED, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{w.sub}</Typography>}
        {(w.at || by) && (
          <Typography component="span" sx={{ fontSize: "0.74rem", color: MUTED, ml: "auto", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
            {[when(w.at), by].filter(Boolean).join(" · ")}
          </Typography>
        )}
      </Box>
      {w.links.length > 0 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, pl: 1.6 }}>
          {links.map((l) => (
            <Box key={l.url} component={l.internal ? Link : "a"} href={l.url} {...(l.internal ? {} : { target: "_blank", rel: "noopener noreferrer" })}
              title={l.url} sx={{
                ...square, color: INK, bgcolor: "#fff", border: `1px solid ${HAIRLINE}`, textDecoration: "none",
                "&:hover": { borderColor: WHERE_DOT[w.kind], color: WHERE_DOT[w.kind] }, "& svg": { fontSize: 11 },
              }}>
              {l.label}{!l.internal && <NorthEastIcon />}
            </Box>
          ))}
          {w.links.length > MAX && (
            <Box component="button" type="button" onClick={() => setAll((x) => !x)} sx={{ all: "unset", ...square, cursor: "pointer", color: ACCENT, fontWeight: 700, px: 0.5 }}>
              {all ? "Fewer" : `+ ${w.links.length - MAX} more`}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

export default function LibraryCard({ item, people }: { item: LibraryItem; people: Readonly<Record<string, string>> }) {
  const tone = STATE_TONE[item.state];
  const writer = item.writer ? people[item.writer] ?? item.writer : "";
  return (
    <Box component="article" data-piece={item.pieceId} sx={{
      display: "flex", flexDirection: "column", minWidth: 0, borderRadius: "14px", overflow: "hidden", bgcolor: "#fff",
      border: `1px solid ${item.official ? "rgba(27,122,85,.35)" : HAIRLINE}`, boxShadow: "0 1px 2px rgba(16,24,40,.04)",
      transition: "box-shadow .15s, transform .15s", "&:hover": { boxShadow: "0 12px 30px -16px rgba(16,24,40,.35)" },
    }}>
      {/* the picture: one click into the studio */}
      <Box component={Link} href={item.href} aria-label={`Edit ${item.title}`} sx={{
        position: "relative", display: "block", aspectRatio: "16 / 9", bgcolor: "#eef1f6", overflow: "hidden",
        "&:hover .lib-edit, &:focus-visible .lib-edit": { opacity: 1, transform: "none" }, "&:focus-visible": { outline: `2px solid ${ACCENT}`, outlineOffset: -2 },
      }}>
        {item.picture
          ? <Picture src={item.picture} />
          : <Placeholder item={item} />}
        {item.official && (
          <Box sx={{ position: "absolute", top: 10, left: 10, display: "inline-flex", alignItems: "center", gap: 0.5, height: 26, px: 1, borderRadius: "6px", bgcolor: GREEN, color: "#fff", fontSize: "0.76rem", fontWeight: 800, letterSpacing: ".02em", boxShadow: "0 4px 12px -4px rgba(0,0,0,.35)", "& svg": { fontSize: 15 } }}>
            <VerifiedIcon />Official
          </Box>
        )}
        <Box className="lib-edit" sx={{ position: "absolute", right: 10, bottom: 10, alignItems: "center", gap: 0.5, height: 30, px: 1.25, borderRadius: "8px", bgcolor: PINK, color: "#fff", fontSize: "0.8rem", fontWeight: 700, display: { xs: "none", md: "inline-flex" }, opacity: 0, transform: "translateY(4px)", transition: "opacity .15s, transform .15s", "& svg": { fontSize: 16 } }}>
          <EditOutlinedIcon />Edit
        </Box>
      </Box>

      <Box sx={{ p: 1.75, display: "flex", flexDirection: "column", gap: 1.1, flex: 1, minWidth: 0 }}>
        <Box sx={{ minWidth: 0 }}>
          <Box component={Link} href={item.href} sx={{ textDecoration: "none", color: INK, "&:hover": { color: PINK } }}>
            <Typography sx={{ fontSize: "0.98rem", fontWeight: 700, lineHeight: 1.3, letterSpacing: "-0.01em", color: "inherit", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere" }}>
              {item.title}
            </Typography>
          </Box>
          {item.line && <Typography sx={{ fontSize: "0.78rem", color: MUTED, mt: 0.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={item.line}>{item.line}</Typography>}
        </Box>

        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.5 }}>
          <Box component="span" sx={{ ...square, color: tone.fg, bgcolor: tone.bg }}>{stateWord(item)}</Box>
          {item.languages.map((l) => <Box key={l} component="span" sx={{ ...square, color: INK, bgcolor: "#f1f3f7" }}>{l}</Box>)}
          {item.kind === "page" && item.storeViews > 1 && (
            <Typography component="span" sx={{ fontSize: "0.74rem", color: MUTED, ml: 0.25 }}>{item.storeViews} store views</Typography>
          )}
        </Box>

        {item.where.length > 0 && (
          <Box sx={{ display: "grid", gap: 1, pt: 1.1, borderTop: `1px solid ${HAIRLINE}` }}>
            {item.where.map((w, k) => <WhereRow key={`${w.kind}-${k}`} w={w} people={people} />)}
          </Box>
        )}

        <Box sx={{ flex: 1 }} />
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, pt: 1.1, borderTop: `1px solid ${HAIRLINE}`, minWidth: 0 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box component={Link} href={`/projects/${item.projectId}`} sx={{ display: "block", fontSize: "0.76rem", fontWeight: 650, color: INK, textDecoration: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", "&:hover": { color: PINK } }}>
              {item.project || `Project ${item.projectId}`}
            </Box>
            <Typography sx={{ fontSize: "0.72rem", color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {[writer, item.updatedAt ? `changed ${when(item.updatedAt)}` : ""].filter(Boolean).join(" · ")}
            </Typography>
          </Box>
          <Box component={Link} href={item.href} sx={{
            display: "inline-flex", alignItems: "center", gap: 0.5, height: 32, px: 1.25, borderRadius: "8px", flexShrink: 0,
            bgcolor: PINK, color: "#fff", fontSize: "0.8rem", fontWeight: 700, textDecoration: "none", "&:hover": { bgcolor: "#a3245c" }, "& svg": { fontSize: 16 },
          }}>
            <EditOutlinedIcon />Edit
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
