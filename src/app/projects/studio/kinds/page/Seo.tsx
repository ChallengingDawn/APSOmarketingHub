"use client";
// A PAGE OF THE SHOP'S SEARCH ENGINE FIELDS (Content v6, 10.11.2026). SARCLA 09.11.2026: "new SEO tag as the normal page -
// this one should have as well". What a new SEO landing page has - the search engine title, the description and the URL
// key - for a page already on the shop, in its store view:
//   on the shop now   the page's own <title>, meta description and address, read from the live page (its outline), each
//                     with a length guide
//   for Magento       three fields, empty = Magento's stays; "Propose with AI" writes better ones from the page's own
//                     words and the brief (the same ask a new page's search engine fields use); the URL key it proposes is
//                     offered, never put in by itself - a new URL key moves the page
//   where it goes     a CMS page: with the page at the last step (meta title, meta description, URL key); a category, a
//                     product or the home page: the hand-over (Magento's category / product form, by hand)

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import { AMBER, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { classify } from "@/lib/convert/model";
import { LIMIT } from "@/lib/content/studio/kinds/page/fields";
import { viewName, type PageDoc } from "@/lib/content/studio/kinds/page/model";
import { Field, PINK, btn } from "../../parts";
import { Hint, Kicker, mono } from "./ui";

const GREEN = "#1b7a55";
export type SeoProposal = { title: string; description: string; urlKey: string };

/** The length of a search engine text against what Google shows: short, good, too long. */
export function lengthGuide(text: string, max: number, min: number): { n: number; tone: "short" | "good" | "long" | "empty"; say: string } {
  const n = text.trim().length;
  if (!n) return { n, tone: "empty", say: "none" };
  if (n > max) return { n, tone: "long", say: `${n} / ${max} - Google cuts it` };
  if (n < min) return { n, tone: "short", say: `${n} / ${max} - short` };
  return { n, tone: "good", say: `${n} / ${max}` };
}

function Guide({ text, max, min }: { text: string; max: number; min: number }) {
  const g = lengthGuide(text, max, min);
  const color = g.tone === "good" ? GREEN : g.tone === "empty" ? MUTED : AMBER;
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.4 }}>
      <Box sx={{ flex: 1, height: 4, borderRadius: "2px", bgcolor: "rgba(21,34,58,.08)", overflow: "hidden" }}>
        <Box sx={{ width: `${Math.min(100, (g.n / max) * 100)}%`, height: "100%", bgcolor: color, transition: "width .15s" }} />
      </Box>
      <Typography sx={{ fontSize: "0.7rem", color, fontWeight: 650, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{g.say}</Typography>
    </Box>
  );
}

/** A CMS page's URL key from its address ("/de-CH/eur/ueber-uns" -> "ueber-uns"); "" for the home page. */
export const urlKeyOfPath = (path: string) => classify(path).rest.replace(/\.html?$/i, "").replace(/\/+$/, "");

export function SeoPanel({ d, setView, canEdit, canAi, onPropose }: {
  d: PageDoc; setView: (next: PageDoc, label?: string) => void; canEdit: boolean; canAi: boolean;
  /** the AI's search engine fields for this store view (the `seo` ask), or why not */
  onPropose: () => Promise<SeoProposal | string>;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const o = d.outline && d.outline.path === d.path ? d.outline : null;
  const seo = d.fields.seo;
  const kind = d.path ? classify(d.path).kind : null;
  const cms = kind === "cms";
  const nowKey = d.path ? urlKeyOfPath(d.path) : "";
  const set = (p: Partial<typeof seo>, label?: string) => setView({ ...d, fields: { ...d.fields, seo: { ...seo, ...p } } }, label);
  const propose = async () => {
    setBusy(true); setErr(null); setKey(null);
    const r = await onPropose();
    setBusy(false);
    if (typeof r === "string") { setErr(r); return; }
    // the title and the description go in; the URL key is offered - a new one moves the page
    set({ title: r.title, description: r.description }, "AI wrote the search engine fields");
    if (r.urlKey && r.urlKey !== nowKey && kind !== "home") setKey(r.urlKey);
  };
  const keyMoves = !!seo.urlKey.trim() && seo.urlKey.trim() !== nowKey;
  return (
    <Box>
      <Kicker mt={0}>On the shop now · {viewName(d.store)}</Kicker>
      {!o ? (
        <Typography sx={{ fontSize: "0.8rem", color: MUTED, display: "flex", alignItems: "center", gap: 1, mb: 1 }}><CircularProgress size={12} /> Reading the page…</Typography>
      ) : (
        <Box sx={{ p: 1.25, mb: 1.5, borderRadius: "8px", border: `1px solid ${HAIRLINE}`, bgcolor: "#f8fafc" }}>
          {/* as Google would show it: the title, the address, the description */}
          <Typography sx={{ fontSize: "0.92rem", color: "#1a0dab", lineHeight: 1.3, overflowWrap: "anywhere" }}>{o.title || "(no title tag)"}</Typography>
          <Guide text={o.title} max={LIMIT.seoTitle} min={30} />
          <Typography sx={{ ...mono, fontSize: "0.72rem", color: GREEN, mt: 0.75, overflowWrap: "anywhere" }}>www.apsoparts.com{d.path}</Typography>
          <Typography sx={{ fontSize: "0.8rem", color: INK, mt: 0.5, lineHeight: 1.45 }}>{o.description || "(no meta description)"}</Typography>
          <Guide text={o.description} max={LIMIT.seoDescription} min={70} />
        </Box>
      )}

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
        <Typography sx={{ flex: 1, fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED }}>
          {cms ? "For Magento" : "New fields"} · {d.store}
        </Typography>
        {canEdit && (
          <Button size="small" disabled={!canAi || busy || !d.path} onClick={() => void propose()}
            startIcon={busy ? <CircularProgress size={13} sx={{ color: PINK }} /> : <AutoAwesomeOutlinedIcon sx={{ fontSize: 15 }} />}
            sx={{ ...btn, color: PINK, px: 0.75, py: 0.1, fontSize: "0.78rem", minWidth: 0 }}>
            {busy ? "Writing…" : "Propose with AI"}
          </Button>
        )}
      </Box>
      {err && <Typography sx={{ fontSize: "0.78rem", color: "#c5221f", mb: 1 }}>{err}</Typography>}
      <Field label="Search engine title" value={seo.title} max={LIMIT.seoTitle} disabled={!canEdit}
        helper={seo.title.trim() ? undefined : "Empty: the page's own stays"} onChange={(v) => set({ title: v })} />
      <Field label="Description" value={seo.description} max={LIMIT.seoDescription} multiline rows={3} disabled={!canEdit}
        helper={seo.description.trim() ? undefined : "Empty: the page's own stays"} onChange={(v) => set({ description: v })} />
      {kind !== "home" && (
        <Field label="URL key" value={seo.urlKey} disabled={!canEdit}
          helper={keyMoves ? "A new URL key moves the page: its old address stops working (Magento makes no redirect for a CMS page)" : `Empty: it stays ${nowKey || "as it is"}`}
          onChange={(v) => set({ urlKey: v })} />
      )}
      {key && canEdit && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: -0.5, mb: 1.25, p: 1, borderRadius: "6px", bgcolor: "rgba(194,44,110,.06)" }}>
          <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.78rem", color: INK }}>The AI proposes the URL key <Box component="span" sx={{ ...mono, fontSize: "0.76rem" }}>{key}</Box></Typography>
          <Button size="small" onClick={() => { set({ urlKey: key }, "Took the AI's URL key"); setKey(null); }} sx={{ ...btn, color: PINK, px: 0.75, minWidth: 0 }}>Use it</Button>
          <Button size="small" onClick={() => setKey(null)} sx={{ ...btn, color: MUTED, px: 0.5, minWidth: 0 }}>No</Button>
        </Box>
      )}
      <Hint mt={0}>
        {cms ? "They go to Magento with the page at the last step - its meta title, meta description and URL key. An empty field leaves Magento's as it is."
          : kind === "home" ? "The home page's fields are set in Magento's configuration by hand - they are in the hand-over at the last step."
            : `A ${kind ?? "page"} page's fields are set in Magento's ${kind === "product" ? "product" : "category"} form by hand - they are in the hand-over at the last step.`}
      </Hint>
    </Box>
  );
}
