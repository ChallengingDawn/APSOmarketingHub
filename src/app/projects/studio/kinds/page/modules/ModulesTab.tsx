"use client";
// THE MODULES TAB: the library in the right side bar (Content v7, SARCLA 10.11.2026 points 1 and 3: "more than 100 modules
// subdivided by categories, really high end", "put the modules on the right side bar after the assistant").
//
//   top        where a click puts a module: the place the page asked for (its "+"), else after the element selected (or
//              before it, or in its place - a small squared choice), else at the top of the page's content; a module
//              selected: after it, or in its place (its words and products kept)
//   search     every word must be somewhere in a module's name, line, tags or category
//   the list   the categories in their order, each with its count and three of its pictures; a category open: its
//              modules, each as a picture of itself (a real render with the shop's de-CH data), its name and what it needs
// A click on a module puts it on the page AT ONCE (./useModules.ts add): its skeleton in the page, filling in front of the
// person, its settings open on the left.

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { blockOrder } from "@/lib/content/studio/kinds/page/fields";
import { MAIN_SELECTOR, type PageDoc } from "@/lib/content/studio/kinds/page/model";
import { kindOf, moduleOfChange } from "@/lib/content/studio/kinds/page/modules/model";
import { categoryOf, libraryByCategory, needsLine, searchModules, thumbOf, type CategoryId, type ModuleDef } from "@/lib/content/studio/kinds/page/modules/registry";
import { blocksOf } from "@/lib/content/studio/kinds/page/outline";
import { PINK, field } from "../../../parts";
import type { Picked } from "../Frame";
import { Choice } from "../ui";
import type { ModulesCtl, Place } from "./useModules";

type Rel = "after" | "before" | "replace" | "swap";

/** Where a click puts a module now, and the choices around it (after / before / in its place). */
function placeNow(ctl: ModulesCtl, d: PageDoc, picked: Picked | null, openBlock: string | null, rel: Rel): { place: Place | null; choices: { key: Rel; label: string }[]; why: string } {
  if (ctl.place) return { place: ctl.place, choices: [], why: "" };
  if (d.source === "new") {
    const order = blockOrder(d.fields);
    const after = openBlock && order.includes(openBlock) ? openBlock : order[order.length - 1] ?? "";
    const b = blocksOf(d.fields).find((x) => x.key === after);
    return { place: { how: "block", after, label: b ? `After block ${b.num} · ${b.name}` : "At the top of the page" }, choices: [], why: "" };
  }
  if (!d.path) return { place: null, choices: [], why: "Pick the page first - the library puts its modules on it." };
  if (picked) {
    const c = picked.frag ? d.changes[picked.frag.change] : undefined;
    const m = c ? moduleOfChange(c) : null;
    if (c && m && c.id) {
      const name = kindOf(m.type).name;
      const choices: { key: Rel; label: string }[] = [{ key: "after", label: "After it" }, { key: "swap", label: "In its place" }];
      return rel === "swap"
        ? { place: { how: "swap", key: c.id, label: `In place of the ${name.toLowerCase()} (its words and products kept)` }, choices, why: "" }
        : { place: { how: "insert", selector: `.apx-${m.settings.id}`, where: "after", label: `After the ${name.toLowerCase()}` }, choices, why: "" };
    }
    const sel = picked.box?.selector || picked.selector;
    const tag = picked.box?.tag || picked.tag;
    const words = picked.text.replace(/\s+/g, " ").trim().slice(0, 44);
    const what = `<${tag}>${words ? ` ${words}${picked.text.length > 44 ? "…" : ""}` : ""}`;
    if (sel && !picked.insert) {
      const choices: { key: Rel; label: string }[] = [{ key: "after", label: "After it" }, { key: "before", label: "Before it" }, { key: "replace", label: "In its place" }];
      if (rel === "replace") return { place: { how: "replace", selector: sel, label: `In place of ${what} (it is hidden, kept)` }, choices, why: "" };
      return { place: { how: "insert", selector: sel, where: rel === "before" ? "before" : "after", label: `${rel === "before" ? "Before" : "After"} ${what}` }, choices, why: "" };
    }
  }
  return { place: { how: "insert", selector: MAIN_SELECTOR, where: "prepend", label: "At the top of the page's content" }, choices: [], why: "" };
}

export function ModulesTab({ ctl, d, picked, openBlock }: { ctl: ModulesCtl; d: PageDoc; picked: Picked | null; openBlock: string | null }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<CategoryId | null>(null);
  const [rel, setRel] = useState<Rel>("after");
  const lib = useMemo(() => libraryByCategory(), []);
  const found = useMemo(() => (q.trim() ? searchModules(q) : null), [q]);
  const at = placeNow(ctl, d, picked, openBlock, rel);
  const validRel = at.choices.some((c) => c.key === rel) ? rel : "after";
  const place = validRel === rel ? at.place : placeNow(ctl, d, picked, openBlock, validRel).place;
  const can = ctl.canEdit && !!place;
  const pick = (def: ModuleDef) => { if (place && ctl.canEdit) ctl.add(def.id, place); };
  const open = cat ? lib.find((x) => x.category.id === cat) ?? null : null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
      <Box sx={{ px: 1.5, pt: 1.25, pb: 1.25, borderBottom: `1px solid ${HAIRLINE}`, flexShrink: 0, bgcolor: "rgba(255,255,255,.6)" }}>
        <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: MUTED }}>A click puts it</Typography>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.75, mt: 0.25 }}>
          <Box sx={{ width: 3, alignSelf: "stretch", borderRadius: 2, bgcolor: place ? PINK : HAIRLINE, flexShrink: 0 }} />
          <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: place ? INK : MUTED, flex: 1, minWidth: 0, lineHeight: 1.35, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", wordBreak: "break-word" }}>
            {place ? place.label : at.why}
          </Typography>
          {ctl.place && <Tooltip title="Not there - back to the selection"><IconButton size="small" onClick={() => ctl.setPlace(null)} sx={{ mt: -0.5 }}><CloseIcon sx={{ fontSize: 15 }} /></IconButton></Tooltip>}
        </Box>
        {at.choices.length > 0 && <Box sx={{ mt: 0.75 }}><Choice value={validRel} onChange={(k) => setRel(k)} options={at.choices} /></Box>}
        {!picked && !ctl.place && d.source !== "new" && d.path && <Typography sx={{ fontSize: "0.72rem", color: MUTED, mt: 0.5 }}>Click an element of the page, or a + between two, to put it there.</Typography>}
        <TextField fullWidth size="small" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the modules - bento, carousel, hero…"
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 17, color: MUTED }} /></InputAdornment>,
            endAdornment: q ? <InputAdornment position="end"><IconButton size="small" onClick={() => setQ("")} aria-label="Clear the search"><CloseIcon sx={{ fontSize: 15 }} /></IconButton></InputAdornment> : undefined } }}
          sx={{ ...field, mt: 1.25, "& input": { fontSize: "0.84rem" } }} />
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 1.5, py: 1.25 }}>
        {found ? (
          <>
            <Typography sx={{ fontSize: "0.74rem", color: MUTED, mb: 1 }}>{found.length ? `${found.length} module${found.length === 1 ? "" : "s"}` : "No module has these words - try another, or open a category."}</Typography>
            <ModuleList list={found} can={can} onPick={pick} withCategory />
          </>
        ) : open ? (
          <>
            <Box component="button" type="button" onClick={() => setCat(null)} sx={{ all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 0.5, color: PINK, fontSize: "0.8rem", fontWeight: 700, mb: 0.75, "&:hover": { textDecoration: "underline" } }}>
              <ArrowBackIcon sx={{ fontSize: 15 }} />All categories
            </Box>
            <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: INK, lineHeight: 1.25 }}>{open.category.name}</Typography>
            <Typography sx={{ fontSize: "0.76rem", color: MUTED, mb: 1.25 }}>{open.category.note}</Typography>
            <ModuleList list={open.modules} can={can} onPick={pick} />
          </>
        ) : (
          <Box sx={{ display: "grid", gap: 0.75 }}>
            {lib.map(({ category, modules }) => (
              <Box key={category.id} component="button" type="button" onClick={() => setCat(category.id)} sx={{
                all: "unset", cursor: "pointer", display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", alignItems: "center", gap: 1, p: 1, pl: 1.25, borderRadius: "8px",
                bgcolor: "#fff", border: `1px solid ${HAIRLINE}`, transition: "border-color .12s, box-shadow .15s",
                "&:hover": { borderColor: PINK, boxShadow: "0 8px 20px -14px rgba(21,34,58,.35)" }, "&:focus-visible": { outline: `2px solid ${PINK}`, outlineOffset: 1 },
              }}>
                <Box sx={{ minWidth: 0 }}>
                  <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75 }}>
                    <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }} noWrap>{category.name}</Typography>
                    <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED, fontVariantNumeric: "tabular-nums" }}>{modules.length}</Typography>
                  </Box>
                  <Typography sx={{ fontSize: "0.72rem", color: MUTED, lineHeight: 1.35 }} noWrap>{category.note}</Typography>
                  <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 0.5, mt: 0.75 }}>
                    {modules.slice(0, 3).map((m) => (
                      <Box key={m.id} sx={{ height: 34, borderRadius: "4px", overflow: "hidden", bgcolor: "#f3f5f7", border: `1px solid ${HAIRLINE}`, display: "grid", placeItems: "center" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={thumbOf(m.id)} alt="" loading="lazy" style={{ display: "block", width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
                      </Box>
                    ))}
                  </Box>
                </Box>
                <ChevronRightIcon sx={{ fontSize: 18, color: MUTED }} />
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}

function ModuleList({ list, can, onPick, withCategory }: { list: ModuleDef[]; can: boolean; onPick: (d: ModuleDef) => void; withCategory?: boolean }) {
  return (
    <Box sx={{ display: "grid", gap: 1.25 }}>
      {list.map((m) => (
        <Box key={m.id} component="button" type="button" data-module={m.id} disabled={!can} onClick={() => onPick(m)}
          aria-label={`${can ? "Put on the page: " : ""}${m.name}`} sx={{
            all: "unset", boxSizing: "border-box", cursor: can ? "pointer" : "default", display: "flex", flexDirection: "column", borderRadius: "8px", overflow: "hidden",
            bgcolor: "#fff", border: `1px solid ${HAIRLINE}`, transition: "border-color .12s, box-shadow .15s, transform .15s",
            "&:hover": can ? { borderColor: PINK, boxShadow: "0 12px 26px -16px rgba(21,34,58,.4)", transform: "translateY(-1px)" } : {},
            "&:hover .mt-add, &:focus-visible .mt-add": { opacity: 1, transform: "none" },
            "&:focus-visible": { outline: `2px solid ${PINK}`, outlineOffset: 1 },
          }}>
          <Box sx={{ position: "relative", bgcolor: "#f6f7f9", borderBottom: `1px solid ${HAIRLINE}`, display: "grid", placeItems: "center", px: 0.75, py: 0.75, minHeight: 64, maxHeight: 190, overflow: "hidden" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumbOf(m.id)} alt={`${m.name}, as it looks on the shop`} loading="lazy" style={{ display: "block", maxWidth: "100%", maxHeight: 176, objectFit: "contain", borderRadius: 3 }} />
            {can && (
              <Box className="mt-add" sx={{ position: "absolute", right: 8, bottom: 8, px: 1, py: 0.4, borderRadius: "5px", bgcolor: PINK, color: "#fff", fontSize: "0.74rem", fontWeight: 700,
                opacity: 0, transform: "translateY(3px)", transition: "opacity .15s, transform .15s", boxShadow: "0 6px 14px rgba(194,44,110,.35)" }}>Put it here</Box>
            )}
          </Box>
          <Box sx={{ px: 1.1, pt: 0.8, pb: 0.9 }}>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75 }}>
              <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK, flex: 1, minWidth: 0, lineHeight: 1.3 }}>{m.name}</Typography>
              <Typography component="span" sx={{ fontSize: "0.64rem", fontWeight: 700, color: MUTED, whiteSpace: "nowrap", border: `1px solid ${HAIRLINE}`, borderRadius: "4px", px: 0.5, py: 0.05 }}>{needsLine(m)}</Typography>
            </Box>
            <Typography sx={{ fontSize: "0.74rem", color: MUTED, lineHeight: 1.38, mt: 0.25 }}>{m.note}</Typography>
            {withCategory && <Typography sx={{ fontSize: "0.68rem", color: "#8a95a3", mt: 0.4 }}>{categoryOf(m.category)?.name}</Typography>}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
