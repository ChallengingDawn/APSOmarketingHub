"use client";
// A MODULE'S SETTINGS, in the Build pane (Content v6, SARCLA 09.11.2026 points 7 and 8). The module stays in view in the
// middle; here: what fills it - its products or categories, from the shop's own tree ("by hierarchy, like the home page
// bento"), the most viewed or most bought, pasted product or article numbers, or "Fill with AI" (it picks among those,
// never a product of its own) - then its words, its picture, its layout. Every change is drawn at once into the module's
// change (./useModules.ts), so the preview shows it; "Changes made here" on the right has the Undo.

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
import {
  ICONS, kindOf, moduleGap, normalizeModule, shopAddress, wordsFor, type Card, type ModuleRef, type ModuleSettings,
} from "@/lib/content/studio/kinds/page/modules/model";
import { MODULE_MAX, renderModule } from "@/lib/content/studio/kinds/page/modules/render";
import { Field, Label, PINK, btn, field, mainBtn } from "../../../parts";
import type { StudioApi } from "../../../useStudio";
import { Choice, Hint } from "../ui";
import type { ModulesCtl } from "./useModules";

type Way = "category" | "bought" | "viewed" | "numbers" | "ai";
type TreeNode = { name: string; url: string; img: string; children: TreeNode[] };
type Missing = { number: string; why: string };
type CategoryOut = { name: string; url: string; img: string; count: string; subs: Card[]; products: Card[] };

const GREEN = "#1e7d4f";
const AMBER = "#a96a12";

/** How many items a module takes when it is filled (its layout may want fewer or more). */
function countFor(m: ModuleRef): number {
  const s = m.settings;
  switch (m.type) {
    case "row": return s.layout === "grid4" ? 8 : s.layout === "grid" ? 10 : 8;
    case "bento": return (s.layout === "wide" ? 6 : 4) + (s.feature ? 0 : 1); // without a big tile of its own, the first product is it
    case "finder": return 5;
    case "mosaic": return s.layout === "4" ? 8 : s.layout === "2" ? 4 : 6;
    case "cards": return s.layout === "4" ? 4 : s.layout === "2" ? 2 : 3;
    default: return 6;
  }
}

/** The module made light enough for one element of the page (a version takes 20 KB per element): the last items out. */
function fitWeight(m: ModuleRef): { m: ModuleRef; dropped: number } {
  let cur = m;
  let dropped = 0;
  while (renderModule(cur).length > MODULE_MAX && cur.settings.items.length > 1) {
    cur = { ...cur, settings: { ...cur.settings, items: cur.settings.items.slice(0, -1) } };
    dropped++;
  }
  return { m: cur, dropped };
}

export function ModulePanel({ ctl, api, onBack, pageCategory }: {
  ctl: ModulesCtl; api: StudioApi; onBack: () => void;
  /** the page itself, when it is a category page of the shop - what "Most viewed / bought" and the AI look in first */
  pageCategory: { name: string; url: string } | null;
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
  const [picking, setPicking] = useState<"fill" | "within" | "picture" | null>(null);

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

  // a module just added fills itself where it can (the page's own category, else the shop's most bought / its technologies)
  const autoRan = useRef<string | null>(null);
  useEffect(() => {
    if (!m || !ctl.autoFill || ctl.autoFill !== ctl.editing || autoRan.current === ctl.autoFill) return;
    autoRan.current = ctl.autoFill;
    ctl.clearAutoFill();
    const k = kindOf(m.type);
    if (k.takes === "products") void (pageCategory ? fillCategory({ name: pageCategory.name, url: pageCategory.url }) : fillTop("bought"));
    else if (k.takes === "categories") void fillBranch(pageCategory ? { name: pageCategory.name, url: pageCategory.url } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctl.autoFill, ctl.editing, m?.type]);

  const s = m?.settings;
  const k = m ? kindOf(m.type) : null;
  const w = wordsFor(ctl.store);
  const html = useMemo(() => (m ? renderModule(m) : ""), [m]);
  if (!m || !s || !k) {
    return (
      <PanelFrame onBack={onBack} title="Module">
        <Hint mt={0}>This module is no longer on the page (an Undo took it out).</Hint>
      </PanelFrame>
    );
  }
  const gap = moduleGap(m);
  const kb = Math.round(html.length / 100) / 10;

  /* ── filling ─────────────────────────────────────────────────────────── */

  const run = async (label: string, f: () => Promise<string | null>) => {
    setBusy(label);
    setMsg(null);
    try { const e = await f(); if (e) setMsg({ tone: "warn", text: e }); } finally { setBusy(null); }
  };
  /** items put in, light enough for one element, with where they came from */
  const fillWith = (items: Card[], fill: ModuleSettings["fill"], patch: Partial<ModuleSettings>, label: string, note: string, missing: Missing[] = []) => {
    const c = mRef.current;
    if (!c) return;
    const r = fitWeight({ ...c, settings: { ...c.settings, ...patch, items, fill } });
    change(normalizeModule(r.m) ?? r.m, label, true);
    setMsg({ tone: missing.length ? "warn" : "ok", text: `${note}${r.dropped ? ` ${r.dropped} left out - one element of the page takes 20 KB.` : ""}`, missing });
  };
  const now = () => new Date().toISOString();

  const fillTop = (how: "viewed" | "bought") => run(how === "viewed" ? "Finding the most viewed…" : "Finding the most bought…", async () => {
    const r = await api.act<{ cards: Card[]; note: string }>("module_top", { store: ctl.store, how, count: countFor(mRef.current!), url: within?.url ?? "" });
    if (!r.ok) return r.error;
    if (!r.result.cards.length) return "No product came back - try another category, or fill it another way.";
    fillWith(r.result.cards, { how, category: within?.url ?? "", numbers: "", ask: "", at: now(), missing: [] }, {}, `Filled the ${k.name.toLowerCase()} with the most ${how}`, r.result.note);
    return null;
  });

  /** products of one category (a row, a bento) - the bento's big tile is the category itself */
  const fillCategory = (node: { name: string; url: string }) => run(`Reading ${node.name} on the shop…`, async () => {
    const r = await api.act<{ category: CategoryOut }>("module_category", { store: ctl.store, url: node.url });
    if (!r.ok) return r.error;
    const c = r.result.category;
    const list = c.products.length ? c.products : c.subs;
    if (!list.length) return `${c.name || node.name} shows no products or subcategories on the shop.`;
    const cur0 = mRef.current!;
    const patch: Partial<ModuleSettings> = {
      title: cur0.settings.title || c.name, link: { label: cur0.settings.link.label || w.all, url: c.url },
      ...(cur0.type === "bento" ? { feature: { kind: "category", name: c.name, url: c.url, img: c.img || c.subs[0]?.img || "", meta: c.count, number: "", children: [] } } : {}),
    };
    fillWith(list.slice(0, countFor(cur0)), { how: "category", category: c.url, numbers: "", ask: "", at: now(), missing: [] }, patch,
      `Filled the ${k.name.toLowerCase()} from ${c.name}`, `${c.name}: its first ${Math.min(list.length, countFor(cur0))} ${c.products.length ? "products" : "subcategories"} as the shop lists them.`);
    setWithin({ name: c.name, url: c.url });
    return null;
  });

  /** a category's subcategories, each with its products or subcategories (a finder, a mosaic, category cards); none = the
   * shop's technologies */
  const fillBranch = (node: { name: string; url: string } | null) => run(`Reading ${node ? node.name : "the shop's technologies"} on the shop…`, async () => {
    const cur0 = mRef.current!;
    const r = await api.act<{ cards: Card[]; missing?: string[]; more?: number; note?: string }>("module_branch", {
      store: ctl.store, url: node?.url ?? "", kids: cur0.type === "finder" ? "products" : "subs", count: countFor(cur0),
    });
    if (!r.ok) return r.error;
    if (!r.result.cards.length) return r.result.note ?? "No category came back.";
    fillWith(r.result.cards, { how: "category", category: node?.url ?? "", numbers: "", ask: "", at: now(), missing: [] },
      { title: cur0.settings.title || (node ? node.name : ""), link: { label: cur0.settings.link.label || w.all, url: node?.url ?? cur0.settings.link.url } },
      `Filled the ${k.name.toLowerCase()} from ${node ? node.name : "the shop's technologies"}`,
      `${node ? `${node.name}'s subcategories` : "The shop's technologies"}${r.result.more ? ` - the first ${r.result.cards.length} (${r.result.more} more on the shop)` : ""}.${r.result.missing?.length ? ` Not read: ${r.result.missing.join("; ")}` : ""}`);
    return null;
  });

  const fillNumbers = () => run("Looking the numbers up on the shop…", async () => {
    const r = await api.act<{ cards: Card[]; missing: Missing[] }>("module_numbers", { store: ctl.store, text: numbers, count: k.max || 12 });
    if (!r.ok) return r.error;
    if (!r.result.cards.length) { setMsg({ tone: "warn", text: "None of them was found on the shop.", missing: r.result.missing }); return null; }
    fillWith(r.result.cards, { how: "numbers", category: "", numbers: numbers.slice(0, 600), ask: "", at: now(), missing: r.result.missing.map((x) => x.number) }, {},
      `Filled the ${k.name.toLowerCase()} by number`, `${r.result.cards.length} found on the shop.${r.result.missing.length ? ` ${r.result.missing.length} not:` : ""}`, r.result.missing);
    return null;
  });

  const fillAi = () => run("The AI is choosing…", async () => {
    const c = await api.act<{ candidates: unknown[] }>("module_candidates", { store: ctl.store, url: within?.url ?? "" });
    if (!c.ok) return c.error;
    if (!c.result.candidates.length) return "There is nothing to choose from yet - the views and orders are not read. Fill it from a category instead.";
    const count = countFor(mRef.current!);
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

  /** a picture for the big tile / the banner: a category's photo */
  const pictureFrom = (node: { name: string; url: string }) => run(`Reading ${node.name} on the shop…`, async () => {
    const r = await api.act<{ category: CategoryOut }>("module_category", { store: ctl.store, url: node.url });
    if (!r.ok) return r.error;
    const c = r.result.category;
    const img = c.img || c.subs[0]?.img || c.products[0]?.img || "";
    if (!img) return `${c.name} has no photo on the shop.`;
    set({ feature: { kind: c.img || c.subs[0]?.img ? "category" : "product", name: c.name, url: c.url, img, meta: c.count, number: "", children: [] } }, "Changed the picture", true);
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

  return (
    <PanelFrame onBack={() => { flush(); onBack(); }} title={k.name}
      right={ctl.canEdit ? <Tooltip title={cur?.replace ? "Take the module out - the page's element shows again" : "Take the module out of the page"}><IconButton size="small" onClick={() => { flush(); ctl.remove(); }}><DeleteOutlineIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton></Tooltip> : null}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
        <Box sx={{ width: 8, height: 8, borderRadius: "2px", bgcolor: gap ? AMBER : GREEN, flexShrink: 0 }} />
        <Typography sx={{ fontSize: "0.8rem", color: gap ? AMBER : GREEN, fontWeight: 600, flex: 1 }}>
          {gap ? `Not on the page yet - ${gap.toLowerCase()}` : cur?.replace ? "On the page, in place of the element it replaces" : "On the page"}
        </Typography>
        <Typography sx={{ fontSize: "0.72rem", color: html.length > MODULE_MAX ? "#c5221f" : MUTED, fontVariantNumeric: "tabular-nums" }} title="One element of the page takes 20 KB at most">{kb} of 20 KB</Typography>
      </Box>

      {k.takes !== "none" && (
        <>
          <Label mt={0}>{k.takes === "products" ? `Products · ${s.items.length}` : `Categories · ${s.items.length}`}</Label>
          {ctl.canEdit && (
            <Box sx={{ mb: 1 }}>
              {ways.length > 1 && <Choice value={shown as Way} onChange={(x) => { setWay(x); setMsg(null); setPicking(null); }} options={ways} />}
              <Box sx={{ mt: 1, p: 1.25, border: `1px solid ${HAIRLINE}`, borderRadius: "6px", bgcolor: "#fbfcfd" }}>
                {shown === "category" && (
                  <CategoryPicker api={api} store={ctl.store} busy={!!busy} allowRoot={k.takes === "categories"}
                    hint={k.takes === "products" ? "Pick a category: its products fill the module, the shop's own order." : m.type === "finder" ? "Pick a category: its subcategories become the menu, each with its products." : "Pick a category: its subcategories fill the module, each with its own."}
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

      {(k.fields.includes("eyebrow") || k.fields.includes("title") || k.fields.includes("text")) && (
        <>
          <Label>Words</Label>
          {k.fields.includes("eyebrow") && <Field label="Small line above" value={s.eyebrow} max={40} onChange={(v) => set({ eyebrow: v }, "Changed the small line")} disabled={!ctl.canEdit} />}
          {k.fields.includes("title") && <Field label={m.type === "banner" || m.type === "textpic" || m.type === "cta" ? "Headline" : "Title"} value={s.title} max={90} onChange={(v) => set({ title: v }, "Changed the title")} disabled={!ctl.canEdit}
            helper={m.type === "banner" || m.type === "textpic" || m.type === "cta" ? "==word== shows a word in the shop's red" : undefined} />}
          {k.fields.includes("text") && <Field label={m.type === "textpic" ? "Text (a blank line = a new paragraph, - a list)" : "Line under it"} value={s.text} multiline rows={m.type === "textpic" ? 5 : 2} max={m.type === "textpic" ? 900 : 240} onChange={(v) => set({ text: v }, "Changed the text")} disabled={!ctl.canEdit} />}
        </>
      )}
      {k.fields.includes("link") && (
        <>
          <Label>{m.type === "banner" || m.type === "textpic" || m.type === "cta" ? "Button" : "Link at the top right"}</Label>
          <LinkFields value={s.link} onChange={(link) => set({ link }, "Changed the link")} disabled={!ctl.canEdit} />
          {k.fields.includes("link2") && <LinkFields value={s.link2} onChange={(link2) => set({ link2 }, "Changed the second button")} disabled={!ctl.canEdit} second />}
        </>
      )}
      {k.fields.includes("feature") && (
        <>
          <Label>{m.type === "bento" ? "The big tile" : "Picture"}</Label>
          <Box sx={{ display: "flex", gap: 1.25, alignItems: "center" }}>
            <Box sx={{ width: 72, height: 54, borderRadius: "6px", overflow: "hidden", bgcolor: "#eef1f3", border: `1px solid ${HAIRLINE}`, flexShrink: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {s.feature?.img ? <img src={s.feature.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : null}
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: INK }} noWrap>{s.feature?.name || (m.type === "bento" ? "Its first product, until you pick one" : "None yet")}</Typography>
              {ctl.canEdit && (
                <Box sx={{ display: "flex", gap: 0.5, mt: 0.25 }}>
                  <Button size="small" onClick={() => setPicking(picking === "picture" ? null : "picture")} sx={{ ...btn, px: 0.75, color: PINK }}>A category&apos;s photo</Button>
                  {s.feature && <Button size="small" onClick={() => set({ feature: null }, "Took the picture out", true)} sx={{ ...btn, px: 0.75, color: MUTED }}>Remove</Button>}
                </Box>
              )}
            </Box>
          </Box>
          {picking === "picture" && <Box sx={{ mt: 1 }}><CategoryPicker api={api} store={ctl.store} busy={!!busy} useLabel="Its photo" onUse={(n) => { if (n) void pictureFrom(n); setPicking(null); }} /></Box>}
        </>
      )}
      {k.fields.includes("points") && <PointsEditor points={s.points} canEdit={ctl.canEdit} onChange={(points, label) => set({ points }, label)} />}
      {k.fields.includes("faq") && <FaqEditor faq={s.faq} canEdit={ctl.canEdit} onChange={(faq, label) => set({ faq }, label)} />}

      <Label>Layout</Label>
      <Choice value={s.layout} onChange={(layout) => {
        const c = mRef.current!;
        const r = fitWeight({ ...c, settings: { ...c.settings, layout } });
        change(r.m, "Changed the layout", true);
      }} options={k.layouts.map((l) => ({ key: l.key, label: l.label, disabled: !ctl.canEdit }))} />
      <Hint mt={1.5}>From the {k.from}. One element of the page with its own style - the shop&apos;s colours, font and width, finished on phones.</Hint>
    </PanelFrame>
  );
}

/* ── the pieces ────────────────────────────────────────────────────────── */

function PanelFrame({ onBack, title, right, children }: { onBack: () => void; title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Box sx={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", borderRadius: "18px", overflow: "hidden", bgcolor: "rgba(255,255,255,.82)", border: "1px solid rgba(255,255,255,.9)", boxShadow: "0 1px 2px rgba(31,45,78,.04), 0 12px 32px rgba(31,45,78,.07)" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1, py: 0.75, borderBottom: `1px solid ${HAIRLINE}` }}>
        <Button size="small" onClick={onBack} startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />} sx={{ ...btn, color: INK }}>The page</Button>
        <Box sx={{ flex: 1 }} />
        {right}
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", p: 2 }}>
        <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: MUTED }}>Module</Typography>
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

const ICON_LABEL: Record<string, string> = { box: "Box", clock: "Clock", cut: "Cut", quick: "Fast", truck: "Delivery", check: "Check", upload: "Upload", cube: "3D", flask: "Lab", book: "Guide", expert: "Expert", star: "Star" };

function PointsEditor({ points, canEdit, onChange }: { points: ModuleSettings["points"]; canEdit: boolean; onChange: (p: ModuleSettings["points"], label: string) => void }) {
  return (
    <>
      <Label>Promises</Label>
      <Hint mt={0}>The shop&apos;s own promises - a promise the shop does not make is never written here.</Hint>
      {points.map((p, i) => (
        <Box key={i} sx={{ mt: 1, p: 1, border: `1px solid ${HAIRLINE}`, borderRadius: "6px", bgcolor: "#fff" }}>
          <Box sx={{ display: "flex", gap: 1 }}>
            <TextField size="small" label="Bold words" value={p.title} disabled={!canEdit} onChange={(e) => onChange(points.map((x, k) => (k === i ? { ...x, title: e.target.value.slice(0, 40) } : x)), "Changed a promise")} sx={{ ...field, flex: 1 }} />
            {canEdit && <IconButton size="small" onClick={() => onChange(points.filter((_, k) => k !== i), "Took a promise out")} aria-label="Take it out"><CloseIcon sx={{ fontSize: 16 }} /></IconButton>}
          </Box>
          <TextField fullWidth size="small" label="The rest" value={p.text} disabled={!canEdit} onChange={(e) => onChange(points.map((x, k) => (k === i ? { ...x, text: e.target.value.slice(0, 80) } : x)), "Changed a promise")} sx={{ ...field, mt: 1 }} />
          <Box sx={{ mt: 1 }}>
            <Choice value={p.icon} onChange={(icon) => onChange(points.map((x, k) => (k === i ? { ...x, icon } : x)), "Changed an icon")}
              options={ICONS.map((ic) => ({ key: ic, label: ICON_LABEL[ic] ?? ic, disabled: !canEdit }))} />
          </Box>
        </Box>
      ))}
      {canEdit && points.length < 6 && <Button size="small" onClick={() => onChange([...points, { title: "", text: "", icon: "check" }], "Added a promise")} sx={{ ...btn, mt: 1, color: PINK }}>+ A promise</Button>}
    </>
  );
}

function FaqEditor({ faq, canEdit, onChange }: { faq: ModuleSettings["faq"]; canEdit: boolean; onChange: (f: ModuleSettings["faq"], label: string) => void }) {
  return (
    <>
      <Label>Questions</Label>
      {faq.map((x, i) => (
        <Box key={i} sx={{ mt: i ? 1 : 0, p: 1, border: `1px solid ${HAIRLINE}`, borderRadius: "6px", bgcolor: "#fff" }}>
          <Box sx={{ display: "flex", gap: 1 }}>
            <TextField size="small" fullWidth label={`Question ${i + 1}`} value={x.q} disabled={!canEdit} onChange={(e) => onChange(faq.map((y, k) => (k === i ? { ...y, q: e.target.value.slice(0, 200) } : y)), "Changed a question")} sx={field} />
            {canEdit && <IconButton size="small" onClick={() => onChange(faq.filter((_, k) => k !== i), "Took a question out")} aria-label="Take it out"><CloseIcon sx={{ fontSize: 16 }} /></IconButton>}
          </Box>
          <TextField size="small" fullWidth multiline minRows={2} label="Answer" value={x.a} disabled={!canEdit} onChange={(e) => onChange(faq.map((y, k) => (k === i ? { ...y, a: e.target.value.slice(0, 1200) } : y)), "Changed an answer")} sx={{ ...field, mt: 1 }} />
        </Box>
      ))}
      {canEdit && faq.length < 12 && <Button size="small" onClick={() => onChange([...faq, { q: "", a: "" }], "Added a question")} sx={{ ...btn, mt: 1, color: PINK }}>+ A question</Button>}
    </>
  );
}
