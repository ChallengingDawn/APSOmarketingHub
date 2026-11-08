"use client";
// READY TO POST (08.11.2026): posting to the networks is not connected, so the studio hands the post over - each network's
// text to copy, LinkedIn's first comment, the brand card or the slides as PNGs, the carousel as LinkedIn's PDF, the whole
// post as one text - with what to check first. And the assistant beside it.

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import DownloadIcon from "@mui/icons-material/Download";
import UndoIcon from "@mui/icons-material/Undo";

import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { cleanPostText, type WriteAnswer } from "@/lib/content/studio/kinds/social/ai";
import {
  CARD_SIZE, NETWORK, SLIDE_SIZE, checks, composed, composedComment, enabled, exportPack, slidesOf, type Network, type Slide, type SocialDoc,
} from "@/lib/content/studio/kinds/social/model";
import { AssistantPanel, PINK, btn, newId } from "../../parts";
import type { StudioApi } from "../../useStudio";
import { Checks, CopyButton, Hint } from "../banner/ui";
import { NET_COLOR, NET_ICON } from "./BuildPane";
import { downloadPdf, downloadSlides } from "./exports";

const outlined = { ...btn, color: INK, borderColor: HAIRLINE, bgcolor: "#fff" };
const filled = { ...btn, bgcolor: PINK, color: "#fff", "&:hover": { bgcolor: "#a3245c" } };

export function ReadyCard({ doc, title, prefix, font, slide }: { doc: SocialDoc; title: string; prefix: string; font: string | null; slide: number }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const nets = enabled(doc);
  const list = useMemo(() => checks(doc).map((c) => c.text), [doc]);
  const slides = slidesOf(doc);
  const linkLabel = doc.link.label.replace(/:\s*$/, "") || undefined;
  const run = async (tag: string, fn: () => Promise<number>) => {
    setBusy(tag); setNote(null);
    try {
      const missed = await fn();
      if (missed) setNote("A photo did not come from the shop - drawn without it.");
    } catch (e) { setNote(e instanceof Error ? e.message : String(e)); }
    setBusy(null);
  };
  const dl = (tag: string, label: string, fn: () => Promise<number>, main = false) => (
    <Button size="small" variant={main ? "contained" : "outlined"} disableElevation disabled={!!busy || font === null} onClick={() => run(tag, fn)}
      startIcon={busy === tag ? <CircularProgress size={14} color="inherit" /> : <DownloadIcon sx={{ fontSize: 17 }} />} sx={main ? filled : outlined}>{label}</Button>
  );
  const first = nets[0];
  return (
    <Box sx={{ bgcolor: "rgba(255,255,255,.82)", border: "1px solid rgba(255,255,255,.9)", boxShadow: "0 1px 2px rgba(31,45,78,.04), 0 12px 32px rgba(31,45,78,.07)", borderRadius: "18px", p: 2, overflowY: "auto", minHeight: 0 }}>
      <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: MUTED, mb: 1 }}>Ready to post</Typography>
      <Box sx={{ p: 1.25, mb: 1.5, borderRadius: "12px", bgcolor: "#f4f6fa", borderLeft: `3px solid ${NET_COLOR[first]}` }}>
        <Typography sx={{ fontSize: "0.82rem", color: INK, lineHeight: 1.45 }}>
          Post it from {nets.map((n) => NETWORK[n].label).join(", ").replace(/, ([^,]*)$/, " and $1")} - the text{slides.length ? (slides.length > 1 ? " and slides are" : " and the card are") : doc.media.kind === "image" ? " and the photo are" : " is"} ready to copy. Posting from the hub is not connected.
        </Typography>
      </Box>
      <Box sx={{ display: "grid", gap: 0.75 }}>
        {nets.map((n: Network) => (
          <Box key={n} sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, color: NET_COLOR[n], fontSize: "0.84rem", fontWeight: 650, minWidth: 96 }}>{NET_ICON[n]}{NETWORK[n].label}</Box>
            <CopyButton text={() => composed(doc, n)} label="Copy text" disabled={!doc.networks[n].text.trim()} main={n === first} />
            {n === "linkedin" && composedComment(doc) && <CopyButton text={() => composedComment(doc)} label="Comment" />}
          </Box>
        ))}
      </Box>
      {doc.media.kind !== "none" && (
        <Box sx={{ mt: 1.75, pt: 1.5, borderTop: `1px solid ${HAIRLINE}`, display: "flex", gap: 1, flexWrap: "wrap" }}>
          {doc.media.kind === "image" && doc.media.image.url && <CopyButton text={doc.media.image.url} label="Copy the photo's address" />}
          {doc.media.kind === "card" && (
            <>
              {(doc.networks.linkedin.on || doc.networks.facebook.on) && dl("card-wide", "Card PNG · 1200 × 627", () => downloadSlides([doc.media.card], { prefix, ...CARD_SIZE.linkedin, linkLabel }, font ?? "", title), true)}
              {doc.networks.instagram.on && dl("card-sq", "Card PNG · square", () => downloadSlides([doc.media.card], { prefix, ...CARD_SIZE.instagram, linkLabel }, font ?? "", title))}
            </>
          )}
          {doc.media.kind === "carousel" && slides.length > 0 && (
            <>
              {doc.networks.linkedin.on && dl("pdf", "PDF for LinkedIn", () => downloadPdf(slides, { prefix, ...SLIDE_SIZE[doc.media.size], linkLabel }, font ?? "", title), true)}
              {dl("all", `Every slide as PNG · ${slides.length}`, () => downloadSlides(slides, { prefix, ...SLIDE_SIZE[doc.media.size], linkLabel }, font ?? "", title), !doc.networks.linkedin.on)}
              {slides.length > 1 && dl("one", `Slide ${Math.min(slide, slides.length - 1) + 1} as PNG`, () => downloadSlides(slides, { prefix, ...SLIDE_SIZE[doc.media.size], linkLabel }, font ?? "", title, Math.min(slide, slides.length - 1)))}
            </>
          )}
        </Box>
      )}
      {doc.media.kind === "carousel" && doc.networks.linkedin.on && <Hint sx={{ mt: 0.75 }}>LinkedIn shows a carousel as a document: add the PDF to the post.</Hint>}
      {note && <Typography sx={{ mt: 1, fontSize: "0.8rem", color: "#7f4f0b" }}>{note}</Typography>}
      <Box sx={{ mt: 1.5 }}><CopyButton text={() => exportPack(doc, title)} label="Copy everything as one text" /></Box>
      <Box sx={{ mt: 2, pt: 1.5, borderTop: `1px solid ${HAIRLINE}` }}>
        <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: MUTED, mb: 1 }}>Before it goes out</Typography>
        <Checks items={list} ok="Every network's text fits, and the brand's rules are kept." />
      </Box>
    </Box>
  );
}

export type SocialAi = {
  adapt: (from: Network, to: Network) => Promise<void>;
  adapting: boolean;
  panel: React.ReactNode;
};

/** The AI beside the post: the whole post, a carousel from it, its hashtags, a change in your words; and one undo. */
export function useSocialAi({ api, doc, set, net, setSlide }: {
  api: StudioApi; doc: SocialDoc; set: (fn: (d: SocialDoc) => SocialDoc) => void; net: Network; setSlide: (i: number) => void;
}): SocialAi {
  const [undo, setUndo] = useState<SocialDoc | null>(null);
  const [adapting, setAdapting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const enabledAi = api.data.ai && api.data.access.canEdit;
  const keep = () => setUndo(doc);
  const nets = enabled(doc);
  const putText = (n: Network, raw: string, tags: string[]) => set((d) => ({
    ...d,
    networks: { ...d.networks, [n]: { ...d.networks[n], text: cleanPostText(raw, n).text } },
    hashtags: d.hashtags.length ? d.hashtags : tags.slice(0, 5),
  }));

  const write = async (ask?: string): Promise<string | null> => {
    const r = await api.ai<WriteAnswer>("write", { networks: nets, ...(ask ? { ask } : {}) });
    if (!r.ok) return r.error;
    keep();
    set((d) => {
      const networks = { ...d.networks };
      for (const n of enabled(d)) { const t = r.result.texts[n]; if (t) networks[n] = { ...networks[n], text: t }; }
      return {
        ...d, networks,
        firstComment: d.networks.linkedin.on && r.result.firstComment ? r.result.firstComment : d.firstComment,
        hashtags: d.hashtags.length ? d.hashtags : r.result.hashtags,
      };
    });
    return Object.keys(r.result.texts).length ? null : "No text came back - try again.";
  };

  const adapt = async (from: Network, to: Network) => {
    setAdapting(true); setMsg(null);
    const r = await api.ai<{ text: string; hashtags: string[] }>("adapt", { from, to });
    setAdapting(false);
    if (!r.ok) { setMsg(r.error); return; }
    keep();
    putText(to, r.result.text, r.result.hashtags);
  };

  const panel = (
    <AssistantPanel enabled={enabledAi} placeholder={`Change the ${NETWORK[net].label} text - shorter, a sharper hook…`}
      onAsk={async (ask) => {
        const r = await api.ai<{ text: string; hashtags: string[] }>("ask", { network: net, ask });
        if (!r.ok) return r.error;
        keep();
        putText(net, r.result.text, r.result.hashtags);
        return null;
      }}
      quick={[
        { label: nets.some((n) => doc.networks[n].text.trim()) ? "Rewrite the post" : "Write the post", run: () => write() },
        {
          label: "Make a carousel", run: async () => {
            const r = await api.ai<{ slides: Slide[] }>("carousel");
            if (!r.ok) return r.error;
            if (!r.result.slides.length) return "No slide came back - try again.";
            keep();
            set((d) => ({ ...d, media: { ...d.media, kind: "carousel", slides: r.result.slides.map((s) => ({ ...s, id: newId() })) } }));
            setSlide(0);
            return null;
          },
        },
        {
          label: "Suggest hashtags", run: async () => {
            const r = await api.ai<{ hashtags: string[] }>("hashtags");
            if (!r.ok) return r.error;
            if (!r.result.hashtags.length) return "No hashtag came back - try again.";
            keep();
            set((d) => ({ ...d, hashtags: r.result.hashtags }));
            return null;
          },
        },
      ]}>
      {msg && <Typography sx={{ mt: 1.5, fontSize: "0.84rem", color: "#7f4f0b", bgcolor: "#fff8ec", p: 1.25, borderRadius: "10px" }}>{msg}</Typography>}
      {undo && (
        <Button size="small" startIcon={<UndoIcon sx={{ fontSize: 17 }} />} onClick={() => { const u = undo; setUndo(null); set(() => u); }} sx={{ ...btn, mt: 1.5, color: MUTED }}>
          Undo the AI&apos;s change
        </Button>
      )}
      <Hint sx={{ mt: 2 }}>The AI writes in the brand&apos;s voice from the project&apos;s brief - each network in its own manner, hashtags apart.</Hint>
    </AssistantPanel>
  );
  return { adapt, adapting, panel };
}
