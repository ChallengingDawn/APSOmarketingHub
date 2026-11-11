"use client";
// THE PAGES THE BANNER IS ON, BROUGHT UP TO DATE AT ONCE (cv16, 11.11.2026; SARCLA: "compare the evolution of this page [the
// Page builder] to the other content types' generators, and improve them" - the Page builder's last step is a publishing
// view: one "Update all" with its progress, a refusal said plainly with "Try again" for the failed ones, links to what went
// out). A banner goes onto a shop page as ONE picture (its 1920 x 600 and 1080 x 900, ./ToPage.tsx); changed afterwards,
// every page it is on still carries the older picture. Here, at the top of "Put it on a page":
//   each page it is on    its to-do, where on it, whether it carries the banner as it is now ("Up to date") or an older look
//   Update all (n)        the two pictures drawn and kept in the hub ONCE, then the banner's change on each page to-do
//                         replaced at the same place (server action re_place) - a stage and a share for each step
//   after                 each page: Updated (with "Open the page's to-do"), or why not with "Try again" for those
// The banner remembers the look it last drew for pages (doc.shot: its print and pictures) - the library's card shows it.
// Nothing goes to Magento from here: each page goes out through its Page builder's own last step, as before.

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SyncRoundedIcon from "@mui/icons-material/SyncRounded";

import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { ON_PAGE, wordsFor, type BannerDoc, type Shot } from "@/lib/content/studio/kinds/banner/model";
import { stillMarkup } from "@/lib/content/studio/kinds/banner/render";
import { lookPrint } from "@/lib/content/studio/kinds/banner/topage";
import { PINK, btn, mainBtn } from "../../parts";
import { uploadPicture } from "../../pictures";
import type { StudioApi } from "../../useStudio";
import type { Pages } from "./Place";
import { fileName, htmlToPng } from "./png";

/** The banner as it is drawn for a shop page - desktop and phone - and its print. */
export function drawnForPages(doc: BannerDoc, prefix: string) {
  const desk = stillMarkup(doc, ON_PAGE, `${prefix}d`);
  const phone = stillMarkup(doc, ON_PAGE, `${prefix}m`, { phone: true });
  return { desk, phone, print: lookPrint(desk.css, desk.html, phone.css, phone.html) };
}

/** The two pictures drawn and kept in the hub (never as data in a document); `stage` says each step with its share. */
export async function keepPictures(a: ReturnType<typeof drawnForPages>, o: { title: string; font: string | null; where: { projectId: number; pieceId: number }; stage: (label: string, share: number) => void; span?: [number, number] }): Promise<{ desktop: string; phone: string }> {
  const [lo, hi] = o.span ?? [0, 1];
  const at = (x: number) => lo + (hi - lo) * x;
  o.stage("Drawing the banner, 1920 × 600", at(0.05));
  const d = await htmlToPng({ html: a.desk.html, css: a.desk.css, width: 1920, height: 600, fontCss: o.font ?? "", type: "image/jpeg", quality: 0.9 });
  o.stage("Drawing it for phones, 1080 × 900", at(0.2));
  const m = await htmlToPng({ html: a.phone.html, css: a.phone.css, width: 1080, height: 900, fontCss: o.font ?? "", type: "image/jpeg", quality: 0.9 });
  if (d.missing.length || m.missing.length) throw new Error("The banner's photo could not be fetched - the picture would be drawn without it. Try again.");
  o.stage("Keeping the pictures in the hub", at(0.35));
  const up1 = await uploadPicture(new File([d.blob], fileName(o.title, "-1920x600.jpg"), { type: "image/jpeg" }), o.where, (s) => o.stage("Keeping the pictures in the hub", at(0.35 + s * 0.3)));
  if (!up1.ok) throw new Error(up1.error);
  const up2 = await uploadPicture(new File([m.blob], fileName(o.title, "-1080x900.jpg"), { type: "image/jpeg" }), o.where, (s) => o.stage("Keeping the pictures in the hub", at(0.65 + s * 0.3)));
  if (!up2.ok) throw new Error(up2.error);
  return { desktop: up1.picture.url, phone: up2.picture.url };
}

type Row = { id: number; title: string; path: string };
type Result = { state: "ok"; href: string } | { state: "failed"; why: string };

/** "Already on" - the pages the banner stands on, and "Update all" when they carry an older look. */
export function OnPages({ api, doc, set, prefix, title, font, pages, onShowPage }: {
  api: StudioApi; doc: BannerDoc; set: (fn: (d: BannerDoc) => BannerDoc) => void; prefix: string; title: string; font: string | null; pages: Pages;
  onShowPage: (pageId: number) => void;
}) {
  const canEdit = api.data.access.canEdit;
  const on: Row[] = (pages.pages ?? []).filter((p) => p.onPage).map((p) => ({ id: p.id, title: p.title, path: p.path }));
  const drawn = useMemo(() => drawnForPages(doc, prefix), [doc, prefix]);
  const fresh = !!doc.shot && doc.shot.print === drawn.print;
  const [stage, setStage] = useState<{ label: string; share: number } | null>(null);
  const [done, setDone] = useState<Record<number, Result>>({});
  const [error, setError] = useState<string | null>(null);
  // the pictures kept for this look this visit (a "Try again" does not draw and send them again)
  const kept = useRef<{ print: string; desktop: string; phone: string } | null>(null);
  if (!on.length) return null;
  const words = wordsFor(doc, ON_PAGE);
  const alt = [words.headline, words.words[0] ?? ""].join(" ").trim();
  const failed = on.filter((p) => done[p.id]?.state === "failed");

  const run = async (list: Row[]) => {
    if (!canEdit || !list.length) return;
    setError(null);
    setDone((x) => { const n = { ...x }; for (const p of list) delete n[p.id]; return n; });
    try {
      let pics = kept.current?.print === drawn.print ? kept.current : null;
      if (!pics) {
        const p = await keepPictures(drawn, { title, font, where: { projectId: api.data.piece.projectId, pieceId: api.data.piece.id }, stage: (label, share) => setStage({ label, share }), span: [0, 0.5] });
        pics = { print: drawn.print, ...p };
        kept.current = pics;
      }
      let i = 0;
      for (const p of list) {
        setStage({ label: `Updating page ${i + 1} of ${list.length}: ${p.path || p.title}`, share: 0.5 + (0.5 * i) / list.length });
        const r = await api.act<{ href: string }>("re_place", { pageId: p.id, desktop: pics.desktop, phone: pics.phone, alt, link: doc.content.button.url.trim() });
        setDone((x) => ({ ...x, [p.id]: r.ok ? { state: "ok", href: r.result.href } : { state: "failed", why: r.error } }));
        i++;
      }
      const shot: Shot = { print: pics.print, desktop: pics.desktop, phone: pics.phone, at: new Date().toISOString() };
      set((d) => ({ ...d, shot }));
      await pages.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setStage(null);
  };

  const busy = !!stage;
  const chip = (p: Row) => {
    const r = done[p.id];
    if (r?.state === "ok") return { text: "Updated", fg: "#1b7a55", bg: "#e7f6ee" };
    if (r?.state === "failed") return { text: "Not updated", fg: "#b3261e", bg: "#fde7e5" };
    return fresh ? { text: "Up to date", fg: "#1b7a55", bg: "#e7f6ee" } : { text: doc.shot ? "An older look" : "Not checked", fg: "#8a5a00", bg: "#fff3d6" };
  };
  return (
    <Box data-on-pages sx={{ mb: 2, p: 1.25, borderRadius: "10px", border: `1px solid ${HAIRLINE}`, bgcolor: "#fff" }}>
      <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: MUTED, mb: 0.75 }}>Already on · {on.length} page{on.length === 1 ? "" : "s"}</Typography>
      <Box sx={{ display: "grid", gap: 0.5 }}>
        {on.map((p) => {
          const c = chip(p);
          const r = done[p.id];
          return (
            <Box key={p.id} sx={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 0.75, alignItems: "center", px: 1, py: 0.6, borderRadius: "7px", bgcolor: "#f7f8fa" }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography component="button" type="button" onClick={() => onShowPage(p.id)} sx={{ all: "unset", cursor: "pointer", display: "block", fontSize: "0.82rem", fontWeight: 650, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%", "&:hover": { color: PINK } }}>{p.path || p.title}</Typography>
                {r?.state === "failed" && <Typography sx={{ fontSize: "0.74rem", color: "#b3261e", lineHeight: 1.35 }}>{r.why}</Typography>}
                {r?.state === "ok" && (
                  <Typography component={Link} href={r.href} sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, fontSize: "0.74rem", color: PINK, textDecoration: "none" }}>Open the page&apos;s to-do<OpenInNewIcon sx={{ fontSize: 13 }} /></Typography>
                )}
              </Box>
              <Box component="span" sx={{ px: 0.75, py: 0.1, borderRadius: "4px", bgcolor: c.bg, color: c.fg, fontSize: "0.7rem", fontWeight: 700, whiteSpace: "nowrap" }}>{c.text}</Box>
            </Box>
          );
        })}
      </Box>
      {canEdit && (
        <Box sx={{ mt: 1 }}>
          {failed.length > 0 && !busy ? (
            <Button fullWidth variant="outlined" onClick={() => void run(failed)} startIcon={<ErrorOutlineRoundedIcon sx={{ fontSize: 17 }} />}
              sx={{ ...btn, borderColor: "#f3c2bd", color: "#b3261e", borderRadius: "8px", minHeight: 38 }}>Try again for {failed.length === 1 ? "the page that failed" : `the ${failed.length} that failed`}</Button>
          ) : (
            <Button fullWidth variant={fresh ? "outlined" : "contained"} disableElevation disabled={busy} onClick={() => void run(on)}
              startIcon={busy ? <CircularProgress size={14} color="inherit" /> : fresh ? <CheckCircleRoundedIcon sx={{ fontSize: 17 }} /> : <SyncRoundedIcon sx={{ fontSize: 17 }} />}
              sx={fresh ? { ...btn, borderColor: HAIRLINE, color: INK, borderRadius: "8px", minHeight: 38 } : { ...mainBtn, borderRadius: "8px", minHeight: 40 }}>
              {busy ? stage!.label : fresh ? `Every page shows the banner as it is - update again` : `Update all (${on.length}) - the banner as it is now`}
            </Button>
          )}
          {busy && <LinearProgress variant="determinate" value={Math.round(stage!.share * 100)} sx={{ mt: 0.75, height: 4, borderRadius: 2 }} />}
          {error && <Typography sx={{ mt: 0.75, fontSize: "0.78rem", color: "#b3261e" }}>{error} <Box component="button" type="button" onClick={() => void run(on)} sx={{ all: "unset", cursor: "pointer", color: PINK, fontWeight: 700 }}>Try again</Box></Typography>}
          <Typography sx={{ mt: 0.75, fontSize: "0.72rem", color: MUTED, lineHeight: 1.45 }}>
            Each page keeps the banner where it stands; its to-do goes out through the Page builder&apos;s own last step.
          </Typography>
        </Box>
      )}
    </Box>
  );
}
