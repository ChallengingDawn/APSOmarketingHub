"use client";
// THE SHOP'S PRODUCTS, IN THE PICTURE PANEL (Content v7, 10.11.2026; SARCLA point 11: "on pictures we should have all of our
// products as well"). A source beside "Make one", "Upload" and the galleries, in every studio: find a product by its name,
// its product number (8 digits) or an article number (10 digits) - or browse the shop's technologies and categories - and
// see its real photo, as the shop shows it. A click picks it: its ADDRESS is kept (never its bytes), its name is the alt
// text. A search shows its result at once: grey tiles in place that fill as the shop answers, a plain reason when nothing
// is found. Server: /api/content/products (lib/content/productPictures.ts), read only.

import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import SearchIcon from "@mui/icons-material/Search";

import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import { field } from "./parts";
import type { Picture } from "./pictures";

type Product = { name: string; number: string; url: string; img: string };
type Link = { name: string; url: string; img: string };
type Branch = Link & { children: Link[] };

/** The store views whose catalogue the panel reads (each language's own); another studio language takes its own. */
const STORES = [
  { key: "de-CH", label: "DE" }, { key: "fr-CH", label: "FR" }, { key: "it-CH", label: "IT" },
  { key: "en-INT", label: "EN" }, { key: "nl-NL", label: "NL" }, { key: "pl-PL", label: "PL" },
];
/** A studio's language ("DE", "fr", "de-CH/eur") as the store view whose product names it shows. */
export function storeForLang(lang: string | null | undefined): string {
  const l = String(lang ?? "").slice(0, 2).toLowerCase();
  return STORES.find((s) => s.key.startsWith(`${l}-`))?.key ?? "de-CH";
}

/** A product picked, as the panel hands every picture on: its photo's address, its name as the alt text. */
export function productPicture(p: Product): Picture {
  return {
    id: -(Number(p.number) || Math.floor(Math.random() * 1e6)), kind: "product", url: p.img, width: null, height: null,
    name: p.name, prompt: null, alt: p.name, product: { number: p.number, url: p.url }, projectId: null, by: null, at: "",
  };
}

const sheen = {
  backgroundImage: "linear-gradient(100deg, #eef1f4 30%, #f8f9fb 50%, #eef1f4 70%)", backgroundSize: "260% 100%",
  animation: "apxProdSheen 1.4s linear infinite", "@keyframes apxProdSheen": { from: { backgroundPosition: "140% 0" }, to: { backgroundPosition: "-140% 0" } },
  "@media (prefers-reduced-motion: reduce)": { animation: "none" },
};

function Tiles({ list, busy, onPick, columns }: { list: Product[]; busy: boolean; onPick: (p: Product) => void; columns: number }) {
  const cols = Math.max(2, Math.min(4, columns));
  if (busy) {
    return (
      <Box aria-live="polite" aria-label="Reading the shop" sx={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 0.75 }}>
        {Array.from({ length: cols * 2 }, (_, i) => (
          <Box key={i} sx={{ borderRadius: "6px", border: `1px solid ${HAIRLINE}`, overflow: "hidden" }}>
            <Box sx={{ aspectRatio: "1", ...sheen }} />
            <Box sx={{ m: 0.75, height: 9, borderRadius: 2, width: `${60 + (i % 3) * 12}%`, ...sheen }} />
          </Box>
        ))}
      </Box>
    );
  }
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 0.75 }}>
      {list.map((p) => (
        <Tooltip key={`${p.number}-${p.img}`} title={`${p.name}${p.number ? ` · ${p.number}` : ""}`} placement="top" enterDelay={400}>
          <Box component="button" type="button" onClick={() => onPick(p)} draggable
            onDragStart={(e) => e.dataTransfer.setData("text/uri-list", p.img)}
            sx={{
              all: "unset", cursor: "pointer", display: "flex", flexDirection: "column", minWidth: 0, borderRadius: "6px", overflow: "hidden",
              bgcolor: "#fff", border: `1px solid ${HAIRLINE}`, boxSizing: "border-box",
              "&:hover": { boxShadow: "0 0 0 2px #2459d1" }, "&:focus-visible": { outline: "2px solid #2459d1" },
            }}>
            <Box component="img" src={p.img} alt={p.name} loading="lazy" sx={{ width: "100%", aspectRatio: "1", objectFit: "contain", p: 0.75, boxSizing: "border-box", display: "block", bgcolor: "#fff" }} />
            <Typography sx={{ px: 0.75, pb: 0.75, fontSize: "0.7rem", lineHeight: 1.25, color: INK, fontWeight: 600, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: "1.75rem" }}>
              {p.name}
            </Typography>
          </Box>
        </Tooltip>
      ))}
    </Box>
  );
}

/** The Products source: a search, the shop's categories, the photos. */
export function ProductPictures({ onPick, columns = 3, store: initialStore }: { onPick: (p: Picture) => void; columns?: number; store?: string }) {
  const [store, setStore] = useState(storeForLang(initialStore ?? "de"));
  const [q, setQ] = useState("");
  const [asked, setAsked] = useState("");
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState<Product[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [tree, setTree] = useState<Branch[] | null>(null);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [tech, setTech] = useState<string>("");
  const [trail, setTrail] = useState<Link[]>([]);
  const [subs, setSubs] = useState<Link[]>([]);

  const get = useCallback(async (params: Record<string, string>) => {
    const r = await fetch(`/api/content/products?${new URLSearchParams({ store, ...params })}`).catch(() => null);
    if (!r) return { ok: false, error: "The hub did not answer - try again." } as const;
    const j = await r.json().catch(() => null);
    if (!j) return { ok: false, error: r.status === 403 ? "The hub refused the request - try again in a minute." : "The hub sent nothing back - try again." } as const;
    return j as { ok: boolean; error?: string; [k: string]: unknown };
  }, [store]);

  // the shop's technologies, once per store view (from its menu)
  useEffect(() => {
    let live = true;
    setTree(null); setTreeError(null); setTech(""); setTrail([]); setSubs([]);
    void get({ tree: "1" }).then((j) => { if (!live) return; if (j.ok) setTree(j.tree as Branch[]); else setTreeError(j.error ?? "The shop's categories could not be read."); });
    return () => { live = false; };
  }, [get]);

  const search = async (text = q) => {
    const t = text.trim();
    if (!t) return;
    setAsked(t); setBusy(true); setNote(null); setTrail([]); setSubs([]); setTech("");
    const j = await get({ q: t });
    setBusy(false);
    if (!j.ok) { setList([]); setNote(j.error ?? "Nothing came back."); return; }
    setList(j.products as Product[]);
    setNote((j.note as string) || null);
  };
  const open = async (c: Link, path: Link[]) => {
    setTrail(path); setBusy(true); setNote(null); setAsked("");
    const j = await get({ category: c.url });
    setBusy(false);
    if (!j.ok) { setList([]); setSubs([]); setNote(j.error ?? "Nothing came back."); return; }
    const prods = j.products as Product[];
    setList(prods); setSubs(j.subs as Link[]);
    setNote(prods.length ? null : (j.subs as Link[]).length ? `${c.name} lists its products one level down - pick one of its categories.` : `${c.name} shows no product photos.`);
  };
  const branch = tree?.find((b) => b.url === tech) ?? null;
  const lbl = { fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" as const, color: MUTED, mb: 0.5 };

  return (
    <Box sx={{ display: "grid", gap: 1.1, minWidth: 0 }}>
      <Box sx={{ display: "flex", gap: 0.75, alignItems: "center" }}>
        <TextField size="small" fullWidth value={q} onChange={(e) => setQ(e.target.value)} sx={field}
          placeholder="A name, product or article number"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void search(); } }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: MUTED }} /></InputAdornment> } }} />
        <Button size="small" variant="outlined" disabled={!q.trim() || busy} onClick={() => void search()} sx={{ flexShrink: 0, textTransform: "none", fontWeight: 650, borderColor: HAIRLINE, color: INK }}>Find</Button>
      </Box>
      <SquareChoice value={store} onChange={setStore} options={STORES.map((s) => ({ key: s.key, label: s.label }))} />
      <Box>
        <Typography sx={lbl}>Or by the shop&apos;s categories</Typography>
        {treeError ? <Typography sx={{ fontSize: "0.76rem", color: "#7f4f0b" }}>{treeError}</Typography>
          : !tree ? <Box sx={{ height: 26, borderRadius: "4px", ...sheen }} />
            : <SquareChoice value={tech} onChange={(k) => { setTech(k); setTrail([]); setSubs([]); setList(null); setNote(null); }} options={tree.map((b) => ({ key: b.url, label: b.name }))} />}
        {branch && (
          <Box sx={{ mt: 0.75 }}>
            <SquareChoice value={trail[0]?.url ?? ""} onChange={(k) => { const c = branch.children.find((x) => x.url === k); if (c) void open(c, [c]); }}
              options={branch.children.map((c) => ({ key: c.url, label: c.name }))} />
          </Box>
        )}
        {trail.length > 0 && subs.length > 0 && (
          <Box sx={{ mt: 0.75 }}>
            <Typography sx={{ ...lbl, display: "flex", alignItems: "center", gap: 0.25, textTransform: "none", letterSpacing: 0, fontWeight: 600 }}>
              {trail.map((t, i) => <Box component="span" key={t.url} sx={{ display: "inline-flex", alignItems: "center" }}>{i > 0 && <ChevronRightIcon sx={{ fontSize: 14 }} />}{t.name}</Box>)}
            </Typography>
            <SquareChoice value="" onChange={(k) => { const c = subs.find((x) => x.url === k); if (c) void open(c, [...trail, c]); }} options={subs.map((c) => ({ key: c.url, label: c.name }))} />
          </Box>
        )}
      </Box>
      {(busy || list) && (
        <Box>
          {!busy && list && list.length > 0 && (
            <Typography sx={{ fontSize: "0.74rem", color: MUTED, mb: 0.5 }}>
              {asked ? `${list.length} product${list.length === 1 ? "" : "s"} for "${asked}"` : `${list.length} product${list.length === 1 ? "" : "s"} in ${trail[trail.length - 1]?.name ?? "this category"}`} · a click puts its photo in
            </Typography>
          )}
          <Tiles list={list ?? []} busy={busy} onPick={(p) => onPick(productPicture(p))} columns={columns} />
        </Box>
      )}
      {note && <Typography sx={{ fontSize: "0.78rem", color: "#7f4f0b" }}>{note}</Typography>}
      {!busy && !list && !note && (
        <Typography sx={{ fontSize: "0.74rem", color: MUTED, lineHeight: 1.45 }}>The shop&apos;s own product photos. The photo&apos;s address is kept, and the product&apos;s name becomes its alt text.</Typography>
      )}
    </Box>
  );
}
