"use client";
// A MODULE'S SETTINGS, in the Build pane (Content v6, SARCLA 09.11.2026 points 7 and 8; Content v7, 10.11.2026 points 1, 6).
// The module stays in view in the middle; here: what fills it - its products or categories, from the shop's own tree ("by
// hierarchy, like the home page bento"), the most viewed or most bought, pasted product or article numbers, or "Fill with
// AI" (it picks among those, never a product of its own) - then its fields, drawn from the module's own SETTINGS SCHEMA
// in the library (../../../../../lib/content/studio/kinds/page/modules/registry.ts: words, buttons, its picture, its
// points, questions, a table, its own short settings), its layout, and the other looks of its category it can become.
//
// Why here and not in the right side bar's Modules tab: the tab is the LIBRARY (pick, then the next one), this is the
// module ON THE PAGE - the flow standard's left pane is where a part of the page opens with its fields, and both are needed
// at once (the library stays open on the right while a module just added is filled and worded on the left).
//
// Every change is drawn at once into the module's change (./useModules.ts), so the preview shows it; while it fills, its
// skeleton in the page says so (point 6: "added a module didn't appear").
//
// Content v8 (SARCLA 10.11.2026, point 4: "a module should be counted as a block - a normal block with editing options
// there"): the panel is the module's SETTINGS POPUP, beside it in the page (`pop`), as every block's settings are - the
// Build pane keeps only the list of blocks. Its texts are changed by a click on them in the page.

import { useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { ICON_LABEL } from "@/lib/content/studio/kinds/page/modules/kit";
import { ICONS, kindOf, moduleGap, normalizeModule, shopAddress, wordsFor, type Card, type ModuleRef, type ModuleSettings, type Point } from "@/lib/content/studio/kinds/page/modules/model";
import { MODULE_MAX, fitModule, renderModule } from "@/lib/content/studio/kinds/page/modules/render";
import { categoryOf, countFor, modulesIn, thumbOf } from "@/lib/content/studio/kinds/page/modules/registry";
import type { FieldSpec, ModuleDef } from "@/lib/content/studio/kinds/page/modules/types";
import { Field, Label, PINK, btn, field, mainBtn } from "../../../parts";
import { PictureDialog } from "../../../pictures";
import type { StudioApi } from "../../../useStudio";
import { Choice, Hint } from "../ui";
import { PopCard } from "../pops";
import type { ModulesCtl } from "./useModules";

type Way = "category" | "bought" | "viewed" | "numbers" | "ai";
type TreeNode = { name: string; url: string; img: string; children: TreeNode[] };
type Missing = { number: string; why: string };
type CategoryOut = { name: string; url: string; img: string; count: string; subs: Card[]; products: Card[] };

const GREEN = "#1e7d4f";
const AMBER = "#a96a12";
const FILLING = "Filling it from the shop…";

export function ModulePanel({ ctl, api, onBack, pageCategory, pop }: {
  ctl: ModulesCtl; api: StudioApi; onBack: () => void;
  /** the page itself, when it is a category page of the shop - what "Most viewed / bought" and the AI look in first */
  pageCategory: { name: string; url: string } | null;
  /** Content v8: the settings popup beside the module in the page - its number in the list ("Block 3") */
  pop?: { num: number } | null;
}) {
  const cur = ctl.current();
  const [m, setM] = useState<ModuleRef | null>(cur?.module ?? null);
  const mRef = useRef(m);
  mRef.current = m;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ m: ModuleRef; label?: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "warn"; text: string; missing?: Missing[] } | null>(null);
  const [way, setWay] = useState<Way | null>(null);
  const [within, setWithin] = useState<{ name: string; url: string } | null>(pageCategory);
  const [numbers, setNumbers] = useState("");
  const [ask, setAsk] = useState("");
  const [picking, setPicking] = useState<"within" | "picture" | null>(null);
  const [gallery, setGallery] = useState(false);
  const key = ctl.editing ?? "";

  // the module as the document has it (an Undo, another person) when nothing is waiting to be saved
  const docKey = JSON.stringify(cur?.module ?? null);
  useEffect(() => {
    if (pending.current) return;
    setM(cur?.module ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docKey, ctl.editing]);

  const flush = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const p = pending.current;
    pending.current = null;
    if (p) ctl.save(p.m, p.label);
  };
  useEffect(() => () => flush(), []); // eslint-disable-line react-hooks/exhaustive-deps

  /** a change of the settings: shown at once in the panel, drawn into the page a moment later (typing stays smooth) */
  const change = (next: ModuleRef, label?: string, now = false) => {
    setM(next);
    pending.current = { m: next, label: label ?? pending.current?.label };
    if (timer.current) clearTimeout(timer.current);
    if (now) flush();
    else timer.current = setTimeout(flush, 650);
  };
  const set = (patch: Partial<ModuleSettings>, label?: string, now = false) => { const c = mRef.current; if (c) change({ ...c, settings: { ...c.settings, ...patch } }, label, now); };

  /* ── filling ─────────────────────────────────────────────────────────── */

  // what fills it shows in the page too: its skeleton moves with the same words
  const run = async (label: string, f: () => Promise<string | null>) => {
    setBusy(label);
    setMsg(null);
    if (key) ctl.setBusy(key, label);
    try { const e = await f(); if (e) setMsg({ tone: "warn", text: e }); } finally { setBusy(null); if (key) ctl.setBusy(key, null); }
  };

  // a module just added (or switched to one that takes other items) fills itself where it can: the page's own category,
  // else the shop's most bought / its technologies - its skeleton fills in front of the person
  const autoRan = useRef<string | null>(null);
  useEffect(() => {
    if (!ctl.autoFill) { autoRan.current = null; return; }
    if (!m || ctl.autoFill !== ctl.editing || autoRan.current === ctl.autoFill) return;
    autoRan.current = ctl.autoFill;
    ctl.clearAutoFill();
    const k = kindOf(m.type);
    if (k.takes === "products") void (pageCategory ? fillCategory({ name: pageCategory.name, url: pageCategory.url }) : fillTop("bought"));
    else if (k.takes === "categories") void fillBranch(pageCategory ? { name: pageCategory.name, url: pageCategory.url } : null);
    else if (key) ctl.setBusy(key, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctl.autoFill, ctl.editing, m?.type]);

  const s = m?.settings;
  const k = m ? kindOf(m.type) : null;
  const w = wordsFor(ctl.store);
  const html = useMemo(() => (m ? renderModule(m) : ""), [m]);
  if (!m || !s || !k) {
    return (
      <PanelFrame onBack={onBack} title="Module" kicker="" pop={pop}>
        <Hint mt={0}>This module is no longer on the page (an Undo took it out).</Hint>
      </PanelFrame>
    );
  }
  const gap = moduleGap(m);
  const kb = Math.round(html.length / 100) / 10;
  const lost = key ? ctl.lost[key] : "";

  /** items put in, light enough for one element, with where they came from */
  const fillWith = (items: Card[], fill: ModuleSettings["fill"], patch: Partial<ModuleSettings>, label: string, note: string, missing: Missing[] = []) => {
    const c = mRef.current;
    if (!c) return;
    // what is read is the store view shown: the module is its own from then on (its links, its interface words)
    const r = fitModule({ ...c, settings: { ...c.settings, ...patch, items, fill, store: ctl.store } });
    change(normalizeModule(r.m) ?? r.m, label, true);
    setMsg({ tone: missing.length ? "warn" : "ok", text: `${note}${r.dropped ? ` ${r.dropped} left out - one element of the page takes 20 KB.` : ""}`, missing });
  };
  const now = () => new Date().toISOString();
  const want = () => countFor(kindOf(mRef.current!.type), mRef.current!.settings);

  const fillTop = (how: "viewed" | "bought") => run(how === "viewed" ? "Finding the most viewed…" : FILLING, async () => {
    const r = await api.act<{ cards: Card[]; note: string }>("module_top", { store: ctl.store, how, count: want(), url: within?.url ?? "" });
    if (!r.ok) return `It could not be filled from the shop: ${r.error} Pick a category below, or paste product numbers.`;
    if (!r.result.cards.length) return "No product came back - pick a category below, or paste product numbers.";
    fillWith(r.result.cards, { how, category: within?.url ?? "", numbers: "", ask: "", at: now(), missing: [] }, {}, `Filled the ${k.name.toLowerCase()} with the most ${how}`, r.result.note);
    return null;
  });

  /** products of one category (a row, a bento) - the bento's big tile is the category itself */
  const fillCategory = (node: { name: string; url: string }) => run(`Reading ${node.name} on the shop…`, async () => {
    const r = await api.act<{ category: CategoryOut; cleaned?: string }>("module_category", { store: ctl.store, url: node.url, count: want() });
    if (!r.ok) return `${r.error} Pick another category, or paste product numbers.`;
    const c = r.result.category;
    const list = c.products.length ? c.products : c.subs;
    if (!list.length) return `${c.name || node.name} shows no products or subcategories on the shop - pick another one.`;
    const cur0 = mRef.current!;
    const k0 = kindOf(cur0.type);
    const patch: Partial<ModuleSettings> = {
      title: cur0.settings.title || c.name, link: { label: cur0.settings.link.label || w.all, url: c.url },
      ...(k0.fields.some((f) => f.kind === "feature") && !cur0.settings.feature ? { feature: { kind: "category", name: c.name, url: c.url, img: c.img || c.subs[0]?.img || "", meta: c.count, number: "", children: [] } } : {}),
    };
    fillWith(list.slice(0, want()), { how: "category", category: c.url, numbers: "", ask: "", at: now(), missing: [] }, patch,
      `Filled the ${k.name.toLowerCase()} from ${c.name}`, `${c.name}: its first ${Math.min(list.length, want())} ${c.products.length ? "products" : "subcategories"} as the shop lists them.${r.result.cleaned ? ` ${r.result.cleaned}` : ""}`);
    setWithin({ name: c.name, url: c.url });
    return null;
  });

  /** a category's subcategories, each with its products or subcategories (a finder, a mosaic, category cards); none = the
   * shop's technologies */
  const fillBranch = (node: { name: string; url: string } | null) => run(node ? `Reading ${node.name} on the shop…` : FILLING, async () => {
    const cur0 = mRef.current!;
    const r = await api.act<{ cards: Card[]; missing?: string[]; more?: number; note?: string }>("module_branch", {
      store: ctl.store, url: node?.url ?? "", kids: kindOf(cur0.type).kids === "products" ? "products" : "subs", count: want(),
    });
    if (!r.ok) return `It could not be filled from the shop: ${r.error} Pick a category below.`;
    if (!r.result.cards.length) return r.result.note ?? "No category came back - pick another one below.";
    fillWith(r.result.cards, { how: "category", category: node?.url ?? "", numbers: "", ask: "", at: now(), missing: [] },
      { title: cur0.settings.title || (node ? node.name : ""), link: { label: cur0.settings.link.label || w.all, url: node?.url ?? cur0.settings.link.url } },
      `Filled the ${k.name.toLowerCase()} from ${node ? node.name : "the shop's technologies"}`,
      `${node ? `${node.name}'s subcategories` : "The shop's technologies"}${r.result.more ? ` - the first ${r.result.cards.length} (${r.result.more} more on the shop)` : ""}.${r.result.missing?.length ? ` Not read: ${r.result.missing.join("; ")}` : ""}`);
    return null;
  });

  const fillNumbers = () => run("Looking the numbers up on the shop…", async () => {
    const r = await api.act<{ cards: Card[]; missing: Missing[]; flagged?: Missing[] }>("module_numbers", { store: ctl.store, text: numbers, count: k.max || 12 });
    if (!r.ok) return r.error;
    if (!r.result.cards.length) { setMsg({ tone: "warn", text: "None of them was found on the shop.", missing: r.result.missing }); return null; }
    // a product asked for by number stays, on clearance or not - but it is said
    const flagged = r.result.flagged ?? [];
    fillWith(r.result.cards, { how: "numbers", category: "", numbers: numbers.slice(0, 600), ask: "", at: now(), missing: r.result.missing.map((x) => x.number) }, {},
      `Filled the ${k.name.toLowerCase()} by number`, `${r.result.cards.length} found on the shop.${r.result.missing.length ? ` ${r.result.missing.length} not found.` : ""}${flagged.length ? ` ${flagged.length} on clearance or replaced (kept).` : ""}`, [...flagged, ...r.result.missing]);
    return null;
  });

  const fillAi = () => run("The AI is choosing…", async () => {
    const c = await api.act<{ candidates: unknown[] }>("module_candidates", { store: ctl.store, url: within?.url ?? "" });
    if (!c.ok) return c.error;
    if (!c.result.candidates.length) return "There is nothing to choose from yet - the views and orders are not read. Fill it from a category instead.";
    const count = want();
    const r = await api.ai<{ picks: string[]; eyebrow: string; title: string; why: string }>("module_fill", {
      lang: ctl.store, type: mRef.current!.type, count, ask: ask.trim(), category: within?.name ?? "", candidates: c.result.candidates,
    });
    if (!r.ok) return r.error;
    if (!r.result.picks.length) return "The AI found nothing that fits - say more about what it should show, or fill it another way.";
    const p = await api.act<{ cards: Card[] }>("module_picks", { store: ctl.store, numbers: r.result.picks, count });
    if (!p.ok) return p.error;
    const cur0 = mRef.current!;
    fillWith(p.result.cards, { how: "ai", category: within?.url ?? "", numbers: "", ask: ask.trim().slice(0, 400), at: now(), missing: [] },
      { eyebrow: cur0.settings.eyebrow || r.result.eyebrow, title: cur0.settings.title || r.result.title },
      `AI filled the ${k.name.toLowerCase()}`, r.result.why || `The AI chose ${p.result.cards.length} of the shop's products.`);
    return null;
  });

  /** a picture: a category's photo */
  const pictureFrom = (node: { name: string; url: string }) => run(`Reading ${node.name} on the shop…`, async () => {
    const r = await api.act<{ category: CategoryOut }>("module_category", { store: ctl.store, url: node.url });
    if (!r.ok) return r.error;
    const c = r.result.category;
    const img = c.img || c.subs[0]?.img || c.products[0]?.img || "";
    if (!img) return `${c.name} has no photo on the shop.`;
    set({ feature: { kind: c.img || c.subs[0]?.img ? "category" : "product", name: c.name, url: c.url, img, meta: c.count, number: "", children: [] } }, "Changed the picture", true);
    return null;
  });

  /** a module made in another store view (a page copied or translated): the same products, as THIS store view's shop has
   * them (their names in its language, its addresses) - looked up by their numbers */
  const otherStore = s.store !== ctl.store ? s.store : null;
  const refillHere = () => run(`Finding the same products in ${ctl.store}…`, async () => {
    const cur0 = mRef.current!;
    const nums = [cur0.settings.feature, ...cur0.settings.items].filter((c): c is Card => !!c && c.kind === "product" && !!c.number).map((c) => c.number);
    if (!nums.length) return `Its products carry no numbers - fill it again for ${ctl.store}.`;
    const r = await api.act<{ cards: Card[]; missing: Missing[] }>("module_numbers", { store: ctl.store, text: nums.join(" "), count: k.max || 12 });
    if (!r.ok) return r.error;
    const featureIsProduct = cur0.settings.feature?.kind === "product";
    const cards = r.result.cards;
    const feature = featureIsProduct ? cards.shift() ?? null : null;
    fillWith(cards, cur0.settings.fill ? { ...cur0.settings.fill, at: now() } : null,
      { store: ctl.store, feature, link: { label: cur0.settings.link.label, url: "" } },
      `Filled the ${k.name.toLowerCase()} for ${ctl.store}`,
      `The same products as the ${ctl.store} shop has them.${cur0.settings.feature && !featureIsProduct ? " Its picture was a category of " + otherStore + " - pick one of " + ctl.store + "." : ""} Its link at the top goes nowhere until you give it a ${ctl.store} page.`, r.result.missing);
    return null;
  });

  const moveItem = (i: number, by: -1 | 1) => {
    const items = [...s.items];
    const j = i + by;
    if (j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    set({ items, fill: s.fill ? { ...s.fill, how: "hand" } : null }, "Moved an item", true);
  };
  const dropItem = (i: number) => set({ items: s.items.filter((_, k2) => k2 !== i) }, "Took an item out", true);

  /* ── the panel ───────────────────────────────────────────────────────── */

  const ways: { key: Way; label: string }[] = k.takes === "products"
    ? [{ key: "category", label: "From a category" }, { key: "bought", label: "Most bought" }, { key: "viewed", label: "Most viewed" }, { key: "numbers", label: "By number" }, { key: "ai", label: "Fill with AI" }]
    : k.takes === "categories" ? [{ key: "category", label: "From a category" }] : [];
  const shown = way ?? (ways[0]?.key ?? null);
  const status = busy ? { tone: PINK, text: busy } : lost ? { tone: "#c5221f", text: `Not on the page: ${lost.charAt(0).toLowerCase()}${lost.slice(1)}` }
    : gap ? { tone: AMBER, text: `Not on the page yet - ${gap.charAt(0).toLowerCase()}${gap.slice(1)}. It shows as a grey outline until then.` }
    : { tone: GREEN, text: cur?.replace ? "On the page, in place of the element it replaces" : "On the page" };
  const siblings = modulesIn(k.category).filter((d) => d.id !== k.id && d.takes === k.takes && (k.takes !== "categories" || d.kids === k.kids));

  return (
    <PanelFrame onBack={() => { flush(); onBack(); }} title={k.name} kicker={categoryOf(k.category)?.name ?? "Module"} pop={pop}
      right={ctl.canEdit ? <Tooltip title={cur?.replace ? "Take the module out - the page's element shows again" : "Take the module out of the page"}><IconButton size="small" onClick={() => { flush(); ctl.remove(); }}><DeleteOutlineIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton></Tooltip> : null}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 1.5 }}>
        {busy ? <CircularProgress size={12} sx={{ color: PINK, mt: 0.4, flexShrink: 0 }} /> : <Box sx={{ width: 8, height: 8, mt: 0.65, borderRadius: "2px", bgcolor: status.tone, flexShrink: 0 }} />}
        <Typography sx={{ fontSize: "0.8rem", color: status.tone, fontWeight: 600, flex: 1, lineHeight: 1.4 }}>{status.text}</Typography>
        <Typography sx={{ fontSize: "0.72rem", color: html.length > MODULE_MAX ? "#c5221f" : MUTED, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }} title="One element of the page takes 20 KB at most">{kb} of 20 KB</Typography>
      </Box>
      {otherStore && ctl.canEdit && (
        <Box sx={{ mb: 1.5, p: 1.25, borderRadius: "6px", border: `1px solid ${AMBER}55`, bgcolor: "#fdf8ef" }}>
          <Typography sx={{ fontSize: "0.8rem", color: INK, lineHeight: 1.45 }}>
            Made for {otherStore}: its links go to the {otherStore} shop{k.takes !== "none" ? ` and its ${k.takes} carry ${otherStore}'s names` : ""}.
          </Typography>
          {k.takes === "products" ? (
            <Button size="small" disabled={!!busy} onClick={() => void refillHere()} sx={{ ...btn, mt: 0.75, px: 1, color: PINK, border: `1px solid ${HAIRLINE}`, bgcolor: "#fff", borderRadius: "6px" }}>The same products, as {ctl.store} has them</Button>
          ) : (
            <Box sx={{ display: "flex", gap: 1, alignItems: "center", mt: 0.75, flexWrap: "wrap" }}>
              <Typography sx={{ fontSize: "0.76rem", color: MUTED, flex: 1, minWidth: 180 }}>{k.takes === "categories" ? `Pick its categories again from the ${ctl.store} tree below.` : `Give its button a ${ctl.store} page below.`}</Typography>
              <Button size="small" onClick={() => set({ store: ctl.store }, `Made the ${k.name.toLowerCase()} ${ctl.store}'s`, true)} sx={{ ...btn, px: 1, color: PINK, border: `1px solid ${HAIRLINE}`, bgcolor: "#fff", borderRadius: "6px" }}>Use {ctl.store}&apos;s words</Button>
            </Box>
          )}
        </Box>
      )}

      {k.takes !== "none" && (
        <>
          <Label mt={0}>{k.takes === "products" ? `Products · ${s.items.length}` : `Categories · ${s.items.length}`}</Label>
          {ctl.canEdit && (
            <Box sx={{ mb: 1 }}>
              {ways.length > 1 && <Choice value={shown as Way} onChange={(x) => { setWay(x); setMsg(null); setPicking(null); }} options={ways} />}
              <Box sx={{ mt: 1, p: 1.25, border: `1px solid ${HAIRLINE}`, borderRadius: "6px", bgcolor: "#fbfcfd" }}>
                {shown === "category" && (
                  <CategoryPicker api={api} store={ctl.store} busy={!!busy} allowRoot={k.takes === "categories"}
                    hint={k.takes === "products" ? "Pick a category: its products fill the module, the shop's own order." : k.kids === "products" ? "Pick a category: its subcategories become the menu, each with its products." : "Pick a category: its subcategories fill the module, each with its own."}
                    onUse={(n) => (n ? (k.takes === "products" ? fillCategory(n) : fillBranch(n)) : fillBranch(null))} />
                )}
                {(shown === "bought" || shown === "viewed") && (
                  <Box>
                    <Hint mt={0}>{shown === "bought" ? "The products whose articles were bought online most" : "The product pages viewed most"} - the last months, from GA4 (visitors who accepted statistics cookies).</Hint>
                    <WithinLine within={within} onPick={() => setPicking(picking === "within" ? null : "within")} onClear={() => setWithin(null)} />
                    {picking === "within" && <Box sx={{ mt: 1 }}><CategoryPicker api={api} store={ctl.store} busy={!!busy} useLabel="Only in this one" onUse={(n) => { if (n) setWithin(n); setPicking(null); }} /></Box>}
                    <Button size="small" variant="contained" disableElevation disabled={!!busy} onClick={() => void fillTop(shown)} sx={{ ...mainBtn, mt: 1 }}>
                      Fill with the most {shown === "bought" ? "bought" : "viewed"}
                    </Button>
                  </Box>
                )}
                {shown === "numbers" && (
                  <Box>
                    <TextField fullWidth multiline minRows={3} size="small" value={numbers} onChange={(e) => setNumbers(e.target.value)}
                      placeholder={"Paste product numbers (8 digits) or article numbers (10 digits) - one a line, or with commas"} sx={{ ...field, "& textarea": { fontFamily: "ui-monospace, Consolas, monospace", fontSize: "0.8rem" } }} />
                    <Hint>Each is looked up on the shop in {ctl.store}: its name, photo and link - never a price or stock. Those not found are listed.</Hint>
                    <Button size="small" variant="contained" disableElevation disabled={!!busy || !numbers.trim()} onClick={() => void fillNumbers()} sx={{ ...mainBtn, mt: 1 }}>Look them up</Button>
                  </Box>
                )}
                {shown === "ai" && (
                  <Box>
                    <TextField fullWidth size="small" value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="What should it show? (optional - e.g. seals for the food industry)" sx={field} />
                    <WithinLine within={within} onPick={() => setPicking(picking === "within" ? null : "within")} onClear={() => setWithin(null)} />
                    {picking === "within" && <Box sx={{ mt: 1 }}><CategoryPicker api={api} store={ctl.store} busy={!!busy} useLabel="Only in this one" onUse={(n) => { if (n) setWithin(n); setPicking(null); }} /></Box>}
                    <Hint>The AI chooses among the shop&apos;s most bought and most viewed products{within ? ` and ${within.name}'s` : ""} for this page&apos;s subject - never a product of its own.</Hint>
                    <Button size="small" variant="contained" disableElevation disabled={!!busy || !api.data.ai} onClick={() => void fillAi()} startIcon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 16 }} />} sx={{ ...mainBtn, mt: 1 }}>Fill with AI</Button>
                  </Box>
                )}
                {busy && <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}><CircularProgress size={14} sx={{ color: PINK }} /><Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{busy}</Typography></Box>}
              </Box>
              {msg && (
                <Box sx={{ mt: 1, fontSize: "0.78rem", color: msg.tone === "warn" ? AMBER : MUTED, lineHeight: 1.45 }}>
                  {msg.text}
                  {msg.missing?.length ? (
                    <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2 }}>
                      {msg.missing.slice(0, 12).map((x) => <li key={x.number}><Box component="span" sx={{ fontFamily: "ui-monospace, Consolas, monospace" }}>{x.number}</Box> - {x.why}</li>)}
                    </Box>
                  ) : null}
                </Box>
              )}
            </Box>
          )}
          <ItemList items={s.items} canEdit={ctl.canEdit} onMove={moveItem} onDrop={dropItem} />
        </>
      )}

      <Fields def={k} m={m} set={set} canEdit={ctl.canEdit} store={ctl.store}
        onCategoryPhoto={() => setPicking(picking === "picture" ? null : "picture")} onGallery={() => setGallery(true)} />
      {picking === "picture" && <Box sx={{ mt: 1 }}><CategoryPicker api={api} store={ctl.store} busy={!!busy} useLabel="Its photo" onUse={(n) => { if (n) void pictureFrom(n); setPicking(null); }} /></Box>}

      {k.layouts.length > 1 && (
        <>
          <Label>Layout</Label>
          <Choice value={s.layout} onChange={(layout) => {
            const c = mRef.current!;
            const r = fitModule({ ...c, settings: { ...c.settings, layout } });
            change(r.m, "Changed the layout", true);
          }} options={k.layouts.map((l) => ({ key: l.key, label: l.label, disabled: !ctl.canEdit }))} />
        </>
      )}

      {ctl.canEdit && siblings.length > 0 && (
        <>
          <Label>Other looks in {categoryOf(k.category)?.name ?? "its category"}</Label>
          <Hint mt={0}>The same words and {k.takes === "none" ? "picture" : k.takes}, another module.</Hint>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 0.75, mt: 0.75 }}>
            {siblings.slice(0, 9).map((d) => (
              <Tooltip key={d.id} title={d.name}>
                <Box component="button" type="button" onClick={() => { flush(); ctl.swapType(d.id); }} aria-label={`Make it a ${d.name}`} sx={{
                  all: "unset", cursor: "pointer", borderRadius: "6px", overflow: "hidden", border: `1px solid ${HAIRLINE}`, bgcolor: "#fff", aspectRatio: "16 / 10",
                  display: "grid", placeItems: "center", "&:hover": { borderColor: PINK }, "&:focus-visible": { outline: `2px solid ${PINK}`, outlineOffset: 1 },
                }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumbOf(d.id)} alt="" loading="lazy" style={{ display: "block", maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                </Box>
              </Tooltip>
            ))}
          </Box>
        </>
      )}
      <Hint mt={1.5}>{k.from ? `From the ${k.from}. ` : ""}One element of the page with its own style - the shop&apos;s colours, font and width, finished on phones.</Hint>
      <PictureDialog open={gallery} onClose={() => setGallery(false)} title="A picture for the module" projectId={api.data.piece.projectId} pieceId={api.data.piece.id}
        tabs={["upload", "mine", "project", "make"]} start="mine" aspect="16:9"
        onPick={(p) => set({ feature: { kind: "category", name: s.feature?.name || s.title || "Bild", url: s.feature?.url || s.link.url || `https://www.apsoparts.com/${ctl.store.split("/")[0]}/`, img: p.url, meta: "", number: "", children: [] } }, "Changed the picture", true)} />
    </PanelFrame>
  );
}

/* ── the module's fields, drawn from its settings schema ──────────────── */

function Fields({ def, m, set, canEdit, store, onCategoryPhoto, onGallery }: {
  def: ModuleDef; m: ModuleRef; set: (patch: Partial<ModuleSettings>, label?: string, now?: boolean) => void; canEdit: boolean; store: string;
  onCategoryPhoto: () => void; onGallery: () => void;
}) {
  const s = m.settings;
  const words = def.fields.filter((f) => f.kind === "eyebrow" || f.kind === "title" || f.kind === "text");
  const out: React.ReactNode[] = [];
  if (words.length) {
    out.push(<Label key="wl">Words</Label>);
    for (const f of words) {
      if (f.kind !== "eyebrow" && f.kind !== "title" && f.kind !== "text") continue;
      const value = s[f.kind];
      const max = f.max ?? (f.kind === "eyebrow" ? 40 : f.kind === "title" ? 90 : 240);
      out.push(<Field key={f.kind} label={f.label ?? (f.kind === "eyebrow" ? "Small line above" : f.kind === "title" ? "Title" : "Line under it")} value={value} max={max}
        multiline={(f.rows ?? 1) > 1} rows={f.rows} disabled={!canEdit} onChange={(v) => set({ [f.kind]: v } as Partial<ModuleSettings>, `Changed the ${f.kind === "eyebrow" ? "small line" : f.kind}`)}
        helper={f.hint ?? (f.red ? "==word== shows a word in the shop's red" : undefined)} />);
    }
  }
  for (const f of def.fields) {
    if (f.kind === "link" || f.kind === "link2") {
      out.push(<Label key={`${f.kind}l`}>{f.label ?? (f.kind === "link" ? "Button" : "Second button")}</Label>);
      out.push(<LinkFields key={f.kind} value={s[f.kind]} disabled={!canEdit} second={f.kind === "link2"} onChange={(v) => set({ [f.kind]: v } as Partial<ModuleSettings>, f.kind === "link" ? "Changed the link" : "Changed the second button")} />);
    }
    if (f.kind === "feature") {
      out.push(<Label key="fl">{f.label ?? "Picture"}</Label>);
      out.push(
        <Box key="f" sx={{ display: "flex", gap: 1.25, alignItems: "center" }}>
          <Box sx={{ width: 72, height: 54, borderRadius: "6px", overflow: "hidden", bgcolor: "#eef1f3", border: `1px solid ${HAIRLINE}`, flexShrink: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {s.feature?.img ? <img src={s.feature.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : null}
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: INK }} noWrap>{s.feature?.name || f.hint || "None yet"}</Typography>
            {canEdit && (
              <Box sx={{ display: "flex", gap: 0.5, mt: 0.25, flexWrap: "wrap" }}>
                <Button size="small" onClick={onCategoryPhoto} sx={{ ...btn, px: 0.75, color: PINK }}>A category&apos;s photo</Button>
                <Button size="small" onClick={onGallery} sx={{ ...btn, px: 0.75, color: PINK }}>From the pictures</Button>
                {s.feature && <Button size="small" onClick={() => set({ feature: null }, "Took the picture out", true)} sx={{ ...btn, px: 0.75, color: MUTED }}>Remove</Button>}
              </Box>
            )}
          </Box>
        </Box>,
      );
    }
    if (f.kind === "points") out.push(<PointsEditor key="p" spec={f} points={s.points} canEdit={canEdit} onChange={(points, label) => set({ points }, label)} />);
    if (f.kind === "faq") out.push(<FaqEditor key="q" faq={s.faq} max={f.max ?? 12} label={f.label ?? "Questions"} canEdit={canEdit} onChange={(faq, label) => set({ faq }, label)} />);
    if (f.kind === "table") out.push(<TableEditor key="t" spec={f} table={s.table} canEdit={canEdit} onChange={(table, label) => set({ table }, label)} />);
    if (f.kind === "extra") {
      const v = s.extra[f.key] ?? "";
      const put = (val: string) => set({ extra: { ...s.extra, [f.key]: val } }, `Changed ${f.label.toLowerCase()}`, !!f.options);
      out.push(<Label key={`x${f.key}l`}>{f.label}</Label>);
      out.push(f.options
        ? <Choice key={`x${f.key}`} value={v || f.options[0]?.key || ""} onChange={put} options={f.options.map((o) => ({ ...o, disabled: !canEdit }))} />
        : <Field key={`x${f.key}`} label={f.label} value={v} max={f.max ?? 60} disabled={!canEdit} onChange={put} helper={f.hint} />);
    }
  }
  void store;
  return <>{out}</>;
}

/* ── the pieces ────────────────────────────────────────────────────────── */

function PanelFrame({ onBack, title, kicker, right, children, pop }: { onBack: () => void; title: string; kicker: string; right?: React.ReactNode; children: React.ReactNode; pop?: { num: number } | null }) {
  if (pop) {
    return (
      <PopCard kicker={`Block ${pop.num} · module${kicker ? ` · ${kicker}` : ""}`} title={title} onClose={onBack} right={right} maxBody="min(66vh, 640px)">
        {children}
      </PopCard>
    );
  }
  return (
    <Box sx={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", borderRadius: "18px", overflow: "hidden", bgcolor: "rgba(255,255,255,.82)", border: "1px solid rgba(255,255,255,.9)", boxShadow: "0 1px 2px rgba(31,45,78,.04), 0 12px 32px rgba(31,45,78,.07)" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1, py: 0.75, borderBottom: `1px solid ${HAIRLINE}` }}>
        <Button size="small" onClick={onBack} startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />} sx={{ ...btn, color: INK }}>The page</Button>
        <Box sx={{ flex: 1 }} />
        {right}
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", p: 2 }}>
        <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: MUTED }}>Module{kicker ? ` · ${kicker}` : ""}</Typography>
        <Typography sx={{ fontSize: "1.05rem", fontWeight: 700, color: INK, mb: 1 }}>{title}</Typography>
        {children}
      </Box>
    </Box>
  );
}

function WithinLine({ within, onPick, onClear }: { within: { name: string; url: string } | null; onPick: () => void; onClear: () => void }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 1, flexWrap: "wrap" }}>
      <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>In:</Typography>
      <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: INK }}>{within ? within.name : "the whole shop"}</Typography>
      <Button size="small" onClick={onPick} sx={{ ...btn, px: 0.75, minWidth: 0, color: PINK }}>{within ? "Another category" : "Only one category"}</Button>
      {within && <Button size="small" onClick={onClear} sx={{ ...btn, px: 0.75, minWidth: 0, color: MUTED }}>The whole shop</Button>}
    </Box>
  );
}

/** The shop's category tree, a level at a time (technologies > categories > subcategories), each with "Use". */
function CategoryPicker({ api, store, busy, onUse, useLabel = "Use it", allowRoot = false, hint }: {
  api: StudioApi; store: string; busy: boolean; onUse: (n: { name: string; url: string } | null) => void; useLabel?: string; allowRoot?: boolean; hint?: string;
}) {
  const [tree, setTree] = useState<TreeNode[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [path, setPath] = useState<TreeNode[]>([]);
  useEffect(() => {
    let gone = false;
    setTree(null); setErr(null); setPath([]);
    void api.act<{ tree: TreeNode[] }>("module_tree", { store }).then((r) => { if (gone) return; if (r.ok) setTree(r.result.tree); else setErr(r.error); });
    return () => { gone = true; };
  }, [api, store]);
  if (err) return <Typography sx={{ fontSize: "0.8rem", color: AMBER }}>{err}</Typography>;
  if (!tree) return <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}><CircularProgress size={14} sx={{ color: PINK }} /><Typography sx={{ fontSize: "0.8rem", color: MUTED }}>Reading the shop&apos;s categories…</Typography></Box>;
  const here = path.length ? path[path.length - 1].children : tree;
  return (
    <Box>
      {hint && <Hint mt={0}>{hint}</Hint>}
      <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 0.25, my: 0.75, fontSize: "0.78rem" }}>
        <Box component="button" type="button" onClick={() => setPath([])} sx={{ all: "unset", cursor: "pointer", color: path.length ? PINK : INK, fontWeight: 600 }}>{store} · all</Box>
        {path.map((p, i) => (
          <Box key={p.url} component="span" sx={{ display: "inline-flex", alignItems: "center" }}>
            <ChevronRightIcon sx={{ fontSize: 14, color: MUTED }} />
            <Box component="button" type="button" onClick={() => setPath(path.slice(0, i + 1))} sx={{ all: "unset", cursor: "pointer", color: i === path.length - 1 ? INK : PINK, fontWeight: 600 }}>{p.name}</Box>
          </Box>
        ))}
      </Box>
      {allowRoot && !path.length && (
        <PickRow name="The shop's technologies" note={`${tree.length} - each with its own`} img="" onUse={() => onUse(null)} useLabel={useLabel} busy={busy} />
      )}
      {path.length > 0 && <PickRow name={path[path.length - 1].name} note="this category itself" img={path[path.length - 1].img} onUse={() => onUse(path[path.length - 1])} useLabel={useLabel} busy={busy} strong />}
      <Box sx={{ maxHeight: 260, overflowY: "auto", mx: -0.5, px: 0.5 }}>
        {here.map((n) => (
          <PickRow key={n.url} name={n.name} note={n.children.length ? `${n.children.length} inside` : ""} img={n.img} busy={busy} useLabel={useLabel}
            onOpen={n.children.length ? () => setPath([...path, n]) : undefined} onUse={() => onUse(n)} />
        ))}
      </Box>
    </Box>
  );
}

function PickRow({ name, note, img, onOpen, onUse, useLabel, busy, strong }: { name: string; note: string; img: string; onOpen?: () => void; onUse: () => void; useLabel: string; busy: boolean; strong?: boolean }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.5, borderBottom: `1px solid ${HAIRLINE}`, ...(strong ? { bgcolor: "rgba(194,44,110,.04)", mx: -0.5, px: 0.5, borderRadius: "4px" } : {}) }}>
      <Box sx={{ width: 30, height: 30, borderRadius: "5px", overflow: "hidden", bgcolor: "#eef1f3", flexShrink: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {img ? <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : null}
      </Box>
      <Box component={onOpen ? "button" : "div"} type={onOpen ? "button" : undefined} onClick={onOpen} sx={{ all: "unset", cursor: onOpen ? "pointer" : "default", flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: INK, lineHeight: 1.25 }} noWrap>{name}</Typography>
        {note && <Typography sx={{ fontSize: "0.7rem", color: MUTED }}>{note}</Typography>}
      </Box>
      <Button size="small" disabled={busy} onClick={onUse} sx={{ ...btn, px: 1, minWidth: 0, color: PINK, border: `1px solid ${HAIRLINE}`, borderRadius: "6px" }}>{useLabel}</Button>
      {onOpen && <IconButton size="small" onClick={onOpen} aria-label={`Open ${name}`}><ChevronRightIcon sx={{ fontSize: 18 }} /></IconButton>}
    </Box>
  );
}

function ItemList({ items, canEdit, onMove, onDrop }: { items: Card[]; canEdit: boolean; onMove: (i: number, by: -1 | 1) => void; onDrop: (i: number) => void }) {
  if (!items.length) return <Hint mt={0.5}>Nothing in it yet - fill it above.</Hint>;
  return (
    <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "6px", overflow: "hidden" }}>
      {items.map((c, i) => (
        <Box key={`${c.url}-${i}`} sx={{ display: "flex", alignItems: "center", gap: 1, px: 1, py: 0.6, borderTop: i ? `1px solid ${HAIRLINE}` : "none", bgcolor: "#fff" }}>
          <Typography sx={{ width: 16, fontSize: "0.72rem", color: MUTED, fontVariantNumeric: "tabular-nums" }}>{i + 1}</Typography>
          <Box sx={{ width: 34, height: 34, borderRadius: "5px", overflow: "hidden", bgcolor: c.kind === "category" ? "#eef1f3" : "#fff", border: `1px solid ${HAIRLINE}`, flexShrink: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {c.img ? <img src={c.img} alt="" style={{ width: "100%", height: "100%", objectFit: c.kind === "category" ? "cover" : "contain", display: "block" }} /> : null}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography component="a" href={c.url} target="_blank" rel="noreferrer" sx={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: INK, textDecoration: "none", "&:hover": { color: PINK } }} noWrap title={c.name}>{c.name}</Typography>
            <Typography sx={{ fontSize: "0.7rem", color: MUTED }} noWrap>
              {[c.number, c.meta, c.children.length ? `${c.children.length} ${c.children[0].kind === "product" ? "products" : "subcategories"} inside` : ""].filter(Boolean).join(" · ") || (c.kind === "category" ? "category" : "product")}
            </Typography>
          </Box>
          {canEdit && (
            <Box sx={{ display: "flex", flexShrink: 0 }}>
              <IconButton size="small" disabled={!i} onClick={() => onMove(i, -1)} aria-label="Up"><ArrowUpwardIcon sx={{ fontSize: 15 }} /></IconButton>
              <IconButton size="small" disabled={i === items.length - 1} onClick={() => onMove(i, 1)} aria-label="Down"><ArrowDownwardIcon sx={{ fontSize: 15 }} /></IconButton>
              <IconButton size="small" onClick={() => onDrop(i)} aria-label="Take it out"><CloseIcon sx={{ fontSize: 15 }} /></IconButton>
            </Box>
          )}
        </Box>
      ))}
    </Box>
  );
}

function LinkFields({ value, onChange, disabled, second }: { value: { label: string; url: string }; onChange: (v: { label: string; url: string }) => void; disabled: boolean; second?: boolean }) {
  const [url, setUrl] = useState(value.url);
  useEffect(() => { setUrl(value.url); }, [value.url]);
  const bad = !!url.trim() && !shopAddress(url);
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 1 }}>
      <TextField size="small" label={second ? "Second button" : "Words"} value={value.label} disabled={disabled} onChange={(e) => onChange({ ...value, label: e.target.value.slice(0, 60) })} sx={field} />
      <TextField size="small" label="A page of the shop" value={url} disabled={disabled} error={bad}
        helperText={bad ? "An address on www.apsoparts.com, or a path (/de-CH/...)" : undefined}
        onChange={(e) => { setUrl(e.target.value); const u = shopAddress(e.target.value); if (u || !e.target.value.trim()) onChange({ ...value, url: u }); }} sx={field} />
    </Box>
  );
}

function PointsEditor({ spec, points, canEdit, onChange }: { spec: Extract<FieldSpec, { kind: "points" }>; points: Point[]; canEdit: boolean; onChange: (p: Point[], label: string) => void }) {
  const max = spec.max ?? 6;
  const t = spec.item?.title ?? "Bold words";
  const x = spec.item?.text ?? "The rest";
  const put = (i: number, patch: Partial<Point>, label: string) => onChange(points.map((p, k) => (k === i ? { ...p, ...patch } : p)), label);
  return (
    <>
      <Label>{spec.label ?? "Points"}</Label>
      {spec.hint && <Hint mt={0}>{spec.hint}</Hint>}
      {points.map((p, i) => (
        <Box key={i} sx={{ mt: 1, p: 1, border: `1px solid ${HAIRLINE}`, borderRadius: "6px", bgcolor: "#fff" }}>
          <Box sx={{ display: "flex", gap: 1 }}>
            <TextField size="small" label={t} value={p.title} disabled={!canEdit} onChange={(e) => put(i, { title: e.target.value.slice(0, 80) }, "Changed a point")} sx={{ ...field, flex: 1 }} />
            {canEdit && <IconButton size="small" onClick={() => onChange(points.filter((_, k) => k !== i), "Took a point out")} aria-label="Take it out"><CloseIcon sx={{ fontSize: 16 }} /></IconButton>}
          </Box>
          {x && <TextField fullWidth size="small" label={x} value={p.text} disabled={!canEdit} multiline={p.text.length > 50} onChange={(e) => put(i, { text: e.target.value.slice(0, 240) }, "Changed a point")} sx={{ ...field, mt: 1 }} />}
          {spec.links && <TextField fullWidth size="small" label="A page of the shop" value={p.url ?? ""} disabled={!canEdit} onChange={(e) => { const u = shopAddress(e.target.value); if (u || !e.target.value.trim()) put(i, { url: u }, "Changed a point's link"); }} sx={{ ...field, mt: 1 }} />}
          {spec.icons && (
            <Box sx={{ mt: 1 }}>
              <Choice value={p.icon} onChange={(icon) => put(i, { icon }, "Changed an icon")} options={ICONS.map((ic) => ({ key: ic, label: ICON_LABEL[ic] ?? ic, disabled: !canEdit }))} />
            </Box>
          )}
        </Box>
      ))}
      {canEdit && points.length < max && <Button size="small" onClick={() => onChange([...points, { title: "", text: "", icon: "check" }], "Added a point")} sx={{ ...btn, mt: 1, color: PINK }}>+ {t}</Button>}
    </>
  );
}

function FaqEditor({ faq, max, label, canEdit, onChange }: { faq: ModuleSettings["faq"]; max: number; label: string; canEdit: boolean; onChange: (f: ModuleSettings["faq"], label: string) => void }) {
  return (
    <>
      <Label>{label}</Label>
      {faq.map((x, i) => (
        <Box key={i} sx={{ mt: i ? 1 : 0, p: 1, border: `1px solid ${HAIRLINE}`, borderRadius: "6px", bgcolor: "#fff" }}>
          <Box sx={{ display: "flex", gap: 1 }}>
            <TextField size="small" fullWidth label={`Question ${i + 1}`} value={x.q} disabled={!canEdit} onChange={(e) => onChange(faq.map((y, k) => (k === i ? { ...y, q: e.target.value.slice(0, 200) } : y)), "Changed a question")} sx={field} />
            {canEdit && <IconButton size="small" onClick={() => onChange(faq.filter((_, k) => k !== i), "Took a question out")} aria-label="Take it out"><CloseIcon sx={{ fontSize: 16 }} /></IconButton>}
          </Box>
          <TextField size="small" fullWidth multiline minRows={2} label="Answer" value={x.a} disabled={!canEdit} onChange={(e) => onChange(faq.map((y, k) => (k === i ? { ...y, a: e.target.value.slice(0, 1200) } : y)), "Changed an answer")} sx={{ ...field, mt: 1 }} />
        </Box>
      ))}
      {canEdit && faq.length < max && <Button size="small" onClick={() => onChange([...faq, { q: "", a: "" }], "Added a question")} sx={{ ...btn, mt: 1, color: PINK }}>+ A question</Button>}
    </>
  );
}

function TableEditor({ spec, table, canEdit, onChange }: { spec: Extract<FieldSpec, { kind: "table" }>; table: string[][]; canEdit: boolean; onChange: (t: string[][], label: string) => void }) {
  const cols = Math.max(2, Math.min(8, spec.cols ?? (table[0]?.length || 3)));
  const rows = table.length ? table : [Array.from({ length: cols }, () => "")];
  const put = (r: number, c: number, v: string) => onChange(rows.map((row, i) => (i === r ? Array.from({ length: cols }, (_, j) => (j === c ? v.slice(0, 200) : row[j] ?? "")) : row)), "Changed the table");
  return (
    <>
      <Label>{spec.label ?? "Table"}</Label>
      <Hint mt={0}>The first row is the head.</Hint>
      <Box sx={{ mt: 0.75, display: "grid", gap: 0.5 }}>
        {rows.map((row, r) => (
          <Box key={r} sx={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr)) 28px`, gap: 0.5, alignItems: "center" }}>
            {Array.from({ length: cols }, (_, c) => (
              <TextField key={c} size="small" value={row[c] ?? ""} disabled={!canEdit} onChange={(e) => put(r, c, e.target.value)}
                sx={{ ...field, "& input": { fontSize: "0.78rem", fontWeight: r === 0 ? 700 : 400, py: 0.6, px: 0.75 } }} />
            ))}
            {canEdit && r > 0 ? <IconButton size="small" onClick={() => onChange(rows.filter((_, i) => i !== r), "Took a row out")} aria-label="Take the row out"><CloseIcon sx={{ fontSize: 14 }} /></IconButton> : <span />}
          </Box>
        ))}
      </Box>
      {canEdit && rows.length < (spec.maxRows ?? 20) && <Button size="small" onClick={() => onChange([...rows, Array.from({ length: cols }, () => "")], "Added a row")} sx={{ ...btn, mt: 1, color: PINK }}>+ A row</Button>}
    </>
  );
}
