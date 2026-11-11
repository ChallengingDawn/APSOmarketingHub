"use client";
// THE CONTENT LIBRARY, ONE KIND (SARCLA 11.11.2026: "one page per type of content, and content should really display, and
// in one click back to edit, for all that we publish from the one [hub]"). At the top, every kind with its count - a link
// to its own page ("Pages · 1 official"); then this kind's pieces, official first: squared filters (how far, language,
// project) and a search; a card per piece (./LibraryCard.tsx). Read once from /api/content/library - only the projects
// this person may open (lib/content/libraryRead.ts).

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import InputBase from "@mui/material/InputBase";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";

import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import { GlassCard, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import {
  LIBRARY_KINDS, LIB_STATE_LABEL, NO_FILTER, countLine, filterChoices, filterItems, kindCounts, libraryHref, libraryKindBySlug,
  type LibState, type LibraryFilter, type LibraryItem,
} from "@/lib/content/library";
import LibraryCard, { KIND_ICON } from "./LibraryCard";

const PINK = "#c22c6e";

type Data = { items: LibraryItem[]; people: Record<string, string> };

/** Every kind, its count - each its own page; the one open is lit. */
function KindStrip({ data, current }: { data: Data | null; current: string }) {
  const counts = useMemo(() => kindCounts(data?.items ?? []), [data]);
  return (
    <Box component="nav" aria-label="Content library" sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(3, minmax(0, 1fr))", lg: "repeat(6, minmax(0, 1fr))" }, gap: 1.25 }}>
      {LIBRARY_KINDS.map((k) => {
        const c = counts.find((x) => x.slug === k.slug)!;
        const on = k.slug === current;
        return (
          <Box key={k.slug} component={Link} href={libraryHref(k.slug)} aria-current={on ? "page" : undefined} sx={{
            display: "flex", alignItems: "center", gap: 1.25, minWidth: 0, p: 1.25, borderRadius: "12px", textDecoration: "none",
            bgcolor: on ? "#fff" : "rgba(255,255,255,.6)", border: `1px solid ${on ? PINK : HAIRLINE}`, boxShadow: on ? "0 6px 18px -12px rgba(194,44,110,.6)" : "none",
            transition: "border-color .15s, background-color .15s", "&:hover": { borderColor: on ? PINK : "rgba(21,34,58,.25)", bgcolor: "#fff" },
          }}>
            <Box sx={{ width: 34, height: 34, borderRadius: "10px", display: "grid", placeItems: "center", flexShrink: 0, bgcolor: on ? PINK : "#fde8f1", color: on ? "#fff" : "#b63a76", "& svg": { fontSize: 19 } }}>
              {KIND_ICON[k.kind]}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{k.label}</Typography>
              <Typography sx={{ fontSize: "0.74rem", color: c.official ? "#1b7a55" : MUTED, fontWeight: c.official ? 700 : 500, lineHeight: 1.3 }}>
                {data ? countLine(c) : "…"}
              </Typography>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

export default function Library({ slug, initial }: { slug: string; initial?: Data }) {
  const kind = libraryKindBySlug(slug) ?? LIBRARY_KINDS[0];
  const [data, setData] = useState<Data | null>(initial ?? null);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState<LibraryFilter>(NO_FILTER);
  useEffect(() => {
    if (initial) return;
    let live = true;
    void fetch("/api/content/library").then((r) => r.json()).then((j) => {
      if (!live) return;
      if (j.ok) { setData({ items: j.items ?? [], people: j.people ?? {} }); setError(null); }
      else { setData({ items: [], people: {} }); setError(j.error ?? "The library was not read."); }
    }).catch(() => { if (live) { setData({ items: [], people: {} }); setError("The hub did not answer."); } });
    return () => { live = false; };
  }, [initial]);

  const people = data?.people ?? {};
  const mine = useMemo(() => (data?.items ?? []).filter((i) => i.kind === kind.kind), [data, kind.kind]);
  const choices = useMemo(() => filterChoices(mine), [mine]);
  const shown = useMemo(() => filterItems(mine, f, people), [mine, f, people]);
  const set = (patch: Partial<LibraryFilter>) => setF((x) => ({ ...x, ...patch }));
  const filtered = f.state !== "all" || f.language !== "all" || f.project !== "all" || !!f.q.trim();

  return (
    <Box sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>
      <KindStrip data={data} current={kind.slug} />
      <GlassCard>
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5, mb: 2 }}>
          <SquareChoice<LibState | "all"> value={f.state} onChange={(state) => set({ state })} label="Show"
            options={[{ key: "all", label: "All", count: mine.length }, ...choices.states.map((s) => ({ key: s.key, label: LIB_STATE_LABEL[s.key], count: s.count }))]} />
          {choices.languages.length > 1 && (
            <SquareChoice value={f.language} onChange={(language) => set({ language })} label="Language"
              options={[{ key: "all", label: "All" }, ...choices.languages.map((l) => ({ key: l, label: l }))]} />
          )}
          {choices.projects.length > 1 && (
            <TextField select size="small" label="Project" value={f.project === "all" ? "all" : String(f.project)}
              onChange={(e) => set({ project: e.target.value === "all" ? "all" : Number(e.target.value) })}
              sx={{ minWidth: 190, maxWidth: "100%", "& .MuiInputBase-root": { height: 34, fontSize: "0.84rem", borderRadius: "6px", bgcolor: "rgba(255,255,255,.75)" }, "& .MuiInputLabel-root": { fontSize: "0.84rem" } }}>
              <MenuItem value="all">Every project</MenuItem>
              {choices.projects.map((p) => <MenuItem key={p.id} value={String(p.id)}>{p.title}</MenuItem>)}
            </TextField>
          )}
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, height: 34, px: 1.25, borderRadius: "6px", border: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.75)", flex: "1 1 200px", minWidth: 0, maxWidth: 320 }}>
            <SearchIcon sx={{ fontSize: 17, color: MUTED }} />
            <InputBase value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder={`Search the ${kind.label.toLowerCase()}`} sx={{ fontSize: "0.84rem", flex: 1, minWidth: 0 }} inputProps={{ "aria-label": `Search the ${kind.label.toLowerCase()}` }} />
          </Box>
          <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 1.25 }}>
            <Typography sx={{ fontSize: "0.8rem", color: MUTED, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
              {data ? `${shown.length} ${shown.length === 1 ? kind.one : kind.label.toLowerCase()}` : ""}
            </Typography>
            <Box component={Link} href={kind.make} sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, height: 34, px: 1.5, borderRadius: "8px", bgcolor: PINK, color: "#fff", fontSize: "0.84rem", fontWeight: 650, textDecoration: "none", whiteSpace: "nowrap", "&:hover": { bgcolor: "#a3245c" }, "& svg": { fontSize: 18 } }}>
              <AddIcon />Make one
            </Box>
          </Box>
        </Box>

        {!data && <Box sx={{ py: 6, display: "grid", placeItems: "center" }}><CircularProgress size={22} /></Box>}
        {error && <Typography sx={{ fontSize: "0.84rem", color: "#b42318", mb: 1.5 }}>{error}</Typography>}
        {data && !shown.length && (
          <Box sx={{ py: 6, textAlign: "center" }}>
            <Typography sx={{ fontSize: "0.95rem", fontWeight: 650, color: INK }}>
              {filtered ? `No ${kind.one} shows that.` : `No ${kind.one} made in the hub yet - or none in a project you are in.`}
            </Typography>
            <Typography sx={{ fontSize: "0.84rem", color: MUTED, mt: 0.5 }}>
              {filtered ? "Try another filter, or clear the search." : `Make one, or open a project's ${kind.one} in its studio - it shows here from then on.`}
            </Typography>
          </Box>
        )}
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))", gap: 2 }}>
          {shown.map((i) => <LibraryCard key={i.pieceId} item={i} people={people} />)}
        </Box>
      </GlassCard>
    </Box>
  );
}
