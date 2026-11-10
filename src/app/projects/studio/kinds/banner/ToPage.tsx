"use client";
// PUT IT ON A PAGE - THE BANNER'S LAST STEP (Content v7, 10.11.2026; SARCLA point 11: "allow to push the banner directly on a
// page after editing"). In the left pane, as every studio's last step ("← The banner"):
//   1. Which page   the shop's pages from the page index, as the Page builder's picker: a search, the store view, the kind
//   2. Where on it  read off the page itself: the home page's slider (first), the top of its content, after one of its
//                   blocks (each named by its heading)
//   3. The banner   its shop size drawn small (1920 x 600, and 1080 x 900 for phones), where it links, its alt text
//   4. "Put it on the page" - the two pictures drawn here and kept in the hub (never as data in a document), then that
//      page's Page builder to-do (made in this project when there is none) gets the banner as the module library's
//      campaign banner. Each stage shows as it runs; the page with the banner in it opens in the middle at the end.
// Nothing is written to Magento: the page goes out through the Page builder's own last step.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import InputAdornment from "@mui/material/InputAdornment";
import LinearProgress from "@mui/material/LinearProgress";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SearchIcon from "@mui/icons-material/Search";
import WebOutlinedIcon from "@mui/icons-material/WebOutlined";

import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import { placeChecks } from "@/lib/content/studio/kinds/banner/checks";
import { ON_PAGE, wordsFor, type BannerDoc } from "@/lib/content/studio/kinds/banner/model";
import { WHERE_LABEL, type PageWhere } from "@/lib/content/studio/kinds/banner/topage";
import { stillMarkup } from "@/lib/content/studio/kinds/banner/render";
import { PINK, btn, field, mainBtn } from "../../parts";
import { uploadPicture } from "../../pictures";
import { storeForLang } from "../../productPictures";
import type { StudioApi } from "../../useStudio";
import { StepView } from "../video/map";
import { CheckLines } from "./Output";
import type { Pages } from "./Place";
import { fileName, htmlToPng } from "./png";
import { Scaled } from "./ui";

type Row = { store: string; kind: string; name: string; path: string; env: "prod" | "acc"; convert: { status: string } | null };
type Places = { slider: boolean; blocks: { selector: string; name: string; text: string }[]; kind: string; url: string; todo: { id: number; title: string } | null };
type Done = { pieceId: number; title: string; created: boolean; moved: boolean; href: string };

const STORES = ["de-CH", "fr-CH", "it-CH", "en-INT", "de-DE", "fr-FR", "it-IT", "nl-NL", "pl-PL"];
const KINDS = [{ key: "", label: "All" }, { key: "home", label: "Home" }, { key: "cms", label: "CMS pages" }, { key: "category", label: "Categories" }];
const nice = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const label = { fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" as const, color: MUTED, mb: 0.75 };
const sheen = { backgroundImage: "linear-gradient(100deg,#eef1f4 30%,#f8f9fb 50%,#eef1f4 70%)", backgroundSize: "260% 100%", animation: "apxTpSheen 1.4s linear infinite", "@keyframes apxTpSheen": { from: { backgroundPosition: "140% 0" }, to: { backgroundPosition: "-140% 0" } } };

/** A choice as a full-width row (squared, like the studio's quick asks). */
function RowChoice({ on, title, sub, onClick, disabled }: { on: boolean; title: string; sub?: string; onClick: () => void; disabled?: boolean }) {
  return (
    <Box component="button" type="button" disabled={disabled} onClick={onClick} aria-pressed={on} sx={{
      all: "unset", boxSizing: "border-box", display: "block", width: "100%", cursor: disabled ? "default" : "pointer", px: 1.25, py: 0.8, borderRadius: "6px",
      border: `1px solid ${on ? PINK : HAIRLINE}`, bgcolor: on ? "rgba(194,44,110,.06)" : "#fff", "&:hover": { borderColor: on ? PINK : "#9fb3c0" }, "&:focus-visible": { outline: `2px solid ${PINK}` },
    }}>
      <Typography sx={{ fontSize: "0.82rem", fontWeight: 650, color: INK, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</Typography>
      {sub && <Typography sx={{ fontSize: "0.72rem", color: MUTED, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</Typography>}
    </Box>
  );
}

export default function ToPageView({ api, doc, prefix, title, font, pages, onBack, onShowPage }: {
  api: StudioApi; doc: BannerDoc; prefix: string; title: string; font: string | null; pages: Pages;
  onBack: () => void;
  /** the page to-do with the banner in it, shown in the middle */
  onShowPage: (pageId: number) => void;
}) {
  const piece = api.data.piece;
  const canEdit = api.data.access.canEdit;
  const [store, setStore] = useState(() => storeForLang(doc.language));
  const [kind, setKind] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [rowsError, setRowsError] = useState<string | null>(null);
  const [page, setPage] = useState<Row | null>(null);
  const [places, setPlaces] = useState<Places | null>(null);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const [where, setWhere] = useState<PageWhere>("top");
  const [after, setAfter] = useState("");
  const words = wordsFor(doc, ON_PAGE);
  const [alt, setAlt] = useState(() => [words.headline, words.words[0] ?? ""].join(" ").trim());
  const [stage, setStage] = useState<{ label: string; share: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  // the two pictures kept in the hub for this look of the banner (drawn and sent again only when the banner changed)
  const kept = useRef<{ key: string; desktop: string; phone: string } | null>(null);
  // the studio's api is a new object on each draw: its call is kept, so a read runs when its own inputs change only
  const act = useRef(api.act);
  act.current = api.act;

  // the pages: the page index, as the Page builder's picker (the home page first, then the CMS pages)
  useEffect(() => {
    let live = true;
    setRows(null); setRowsError(null);
    const t = setTimeout(async () => {
      const r = await act.current<{ rows: Row[] }>("shop_pages", { q, store, kind: kind || undefined });
      if (!live) return;
      if (r.ok) setRows(r.result.rows); else { setRows([]); setRowsError(r.error); }
    }, q ? 300 : 0);
    return () => { live = false; clearTimeout(t); };
  }, [q, store, kind]);

  // where on the picked page: read off the page itself
  useEffect(() => {
    if (!page) return;
    let live = true;
    setPlaces(null); setPlacesError(null); setDone(null);
    void act.current<Places>("page_places", { path: page.path, env: page.env }).then((r) => {
      if (!live) return;
      if (!r.ok) { setPlacesError(r.error); return; }
      setPlaces(r.result);
      setWhere(r.result.slider && r.result.kind === "home" ? "slider" : "top");
      setAfter(r.result.blocks[0]?.selector ?? "");
    });
    return () => { live = false; };
  }, [page]);

  const checks = useMemo(() => placeChecks(doc, ON_PAGE), [doc]);
  const stop = checks.some((c) => c.level === "stop");
  const desk = useMemo(() => stillMarkup(doc, ON_PAGE, `${prefix}d`), [doc, prefix]);
  const phone = useMemo(() => stillMarkup(doc, ON_PAGE, `${prefix}m`, { phone: true }), [doc, prefix]);
  const link = doc.content.button.url.trim();

  const put = async () => {
    if (!page || !canEdit) return;
    setError(null); setDone(null);
    try {
      const key = `${desk.css.length}:${desk.html}|${phone.html}`;
      let pics = kept.current?.key === key ? kept.current : null;
      if (!pics) {
        setStage({ label: "Drawing the banner, 1920 × 600", share: 0.05 });
        const a = await htmlToPng({ html: desk.html, css: desk.css, width: 1920, height: 600, fontCss: font ?? "", type: "image/jpeg", quality: 0.9 });
        setStage({ label: "Drawing it for phones, 1080 × 900", share: 0.15 });
        const b = await htmlToPng({ html: phone.html, css: phone.css, width: 1080, height: 900, fontCss: font ?? "", type: "image/jpeg", quality: 0.9 });
        if (a.missing.length || b.missing.length) throw new Error("The banner's photo could not be fetched - the picture would be drawn without it. Try again.");
        setStage({ label: "Keeping the pictures in the hub", share: 0.25 });
        const where0 = { projectId: piece.projectId, pieceId: piece.id };
        const up1 = await uploadPicture(new File([a.blob], fileName(title, "-1920x600.jpg"), { type: "image/jpeg" }), where0, (s) => setStage({ label: "Keeping the pictures in the hub", share: 0.25 + s * 0.35 }));
        if (!up1.ok) throw new Error(up1.error);
        const up2 = await uploadPicture(new File([b.blob], fileName(title, "-1080x900.jpg"), { type: "image/jpeg" }), where0, (s) => setStage({ label: "Keeping the pictures in the hub", share: 0.6 + s * 0.25 }));
        if (!up2.ok) throw new Error(up2.error);
        pics = { key, desktop: up1.picture.url, phone: up2.picture.url };
        kept.current = pics;
      }
      setStage({ label: places?.todo ? "Placing it on the page's to-do" : "Making the page's Page builder to-do", share: 0.9 });
      const r = await api.act<Done & { pages: unknown }>("to_page", {
        path: page.path, env: page.env, where, selector: where === "after" ? after : undefined,
        desktop: pics.desktop, phone: pics.phone, alt: alt.trim(), link,
      });
      if (!r.ok) throw new Error(r.error);
      setStage(null);
      setDone(r.result);
      await pages.reload();
      onShowPage(r.result.pieceId);
    } catch (e) {
      setStage(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const busy = !!stage;
  return (
    <StepView back="The banner" onBack={onBack} name="Put it on a page">
      {/* 1. which page */}
      <Typography sx={label}>1 · Which page</Typography>
      {page ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1, pl: 1.25, mb: 1.75, borderRadius: "8px", border: `1px solid ${HAIRLINE}`, bgcolor: "#fff" }}>
          <WebOutlinedIcon sx={{ fontSize: 18, color: MUTED }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nice(page.name)}</Typography>
            <Typography sx={{ fontSize: "0.72rem", color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "ui-monospace, Consolas, monospace" }}>{page.path}</Typography>
          </Box>
          <Button size="small" disabled={busy} onClick={() => { setPage(null); setPlaces(null); setDone(null); }} sx={{ ...btn, color: PINK, px: 0.75, minWidth: 0 }}>Change</Button>
        </Box>
      ) : (
        <Box sx={{ mb: 1.75 }}>
          <TextField size="small" fullWidth value={q} onChange={(e) => setQ(e.target.value)} sx={field} placeholder="Find a page - words of its address"
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: MUTED }} /></InputAdornment> } }} />
          <Box sx={{ mt: 0.75 }}><SquareChoice value={store} onChange={setStore} options={STORES.map((s) => ({ key: s, label: s }))} /></Box>
          <Box sx={{ mt: 0.75 }}><SquareChoice value={kind} onChange={setKind} options={KINDS} /></Box>
          <Box sx={{ mt: 1, maxHeight: 260, overflowY: "auto", display: "grid", gap: 0.5 }}>
            {rows === null ? Array.from({ length: 4 }, (_, i) => <Box key={i} sx={{ height: 40, borderRadius: "6px", ...sheen }} />)
              : rows.length ? rows.map((r) => <RowChoice key={`${r.env}${r.path}`} on={false} title={nice(r.name)} sub={`${r.path}${r.env === "acc" ? " · only on ACC" : ""}`} onClick={() => setPage(r)} />)
                : <Typography sx={{ fontSize: "0.8rem", color: rowsError ? "#7f4f0b" : MUTED }}>{rowsError ?? "No page of the shop matches - try other words or another store view."}</Typography>}
          </Box>
        </Box>
      )}

      {/* 2. where on it */}
      {page && (
        <>
          <Typography sx={label}>2 · Where on it</Typography>
          {placesError ? <Typography sx={{ fontSize: "0.8rem", color: "#7f4f0b", mb: 1.75 }}>{placesError}</Typography> : !places ? (
            <Box sx={{ display: "grid", gap: 0.5, mb: 1.75 }} aria-label="Reading the page">
              <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>Reading the page…</Typography>
              {Array.from({ length: 3 }, (_, i) => <Box key={i} sx={{ height: 36, borderRadius: "6px", ...sheen }} />)}
            </Box>
          ) : (
            <Box sx={{ display: "grid", gap: 0.5, mb: 1.75 }}>
              {places.slider && <RowChoice on={where === "slider"} title={WHERE_LABEL.slider} sub="The banner becomes the slider's first slide" onClick={() => setWhere("slider")} disabled={busy} />}
              <RowChoice on={where === "top"} title={WHERE_LABEL.top} sub="Before the page's own content" onClick={() => setWhere("top")} disabled={busy} />
              {places.blocks.filter((b) => b.name !== "The slider").map((b) => (
                <RowChoice key={b.selector} on={where === "after" && after === b.selector} title={`After "${b.name}"`} sub={b.text || undefined}
                  onClick={() => { setWhere("after"); setAfter(b.selector); }} disabled={busy} />
              ))}
              <Typography sx={{ fontSize: "0.72rem", color: MUTED, mt: 0.5, lineHeight: 1.45 }}>
                {places.todo ? <>It goes into this project&apos;s to-do for the page: <b>{places.todo.title}</b>.</> : "A Page builder to-do for this page is made in this project."}
              </Typography>
            </Box>
          )}
        </>
      )}

      {/* 3. the banner as it goes there */}
      <Typography sx={label}>{page ? "3" : "2"} · The banner on the page</Typography>
      <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end", mb: 1 }}>
        <Box sx={{ flex: "0 0 auto" }}><Scaled css={desk.css} html={desk.html} w={1920} h={600} scale={210 / 1920} radius={3} shadow={false} /><Typography sx={{ fontSize: "0.66rem", color: MUTED, mt: 0.25 }}>1920 × 600</Typography></Box>
        <Box sx={{ flex: "0 0 auto" }}><Scaled css={phone.css} html={phone.html} w={1080} h={900} scale={78 / 1080} radius={3} shadow={false} /><Typography sx={{ fontSize: "0.66rem", color: MUTED, mt: 0.25 }}>Phones</Typography></Box>
      </Box>
      <Typography sx={{ fontSize: "0.76rem", color: link ? INK : "#7f4f0b", mb: 1 }}>{link ? <>A click on it goes to <b>{link}</b>.</> : "It links nowhere yet - say where its button goes (the Button part)."}</Typography>
      <TextField size="small" fullWidth label="What it shows (alt text)" value={alt} disabled={!canEdit || busy} onChange={(e) => setAlt(e.target.value.slice(0, 140))} sx={{ ...field, mb: 1.25 }} />
      {stop && <Box sx={{ mb: 1.25, p: 1, borderRadius: "8px", border: `1px solid ${HAIRLINE}`, bgcolor: "#fff" }}><CheckLines items={checks.filter((c) => c.level === "stop")} ok="" /></Box>}

      {/* 4. put it there */}
      {!done && (
        <Button fullWidth variant="contained" disableElevation disabled={!canEdit || !page || !places || busy || stop || (where === "after" && !after)} onClick={() => void put()}
          startIcon={busy ? <CircularProgress size={14} color="inherit" /> : undefined} sx={{ ...mainBtn, borderRadius: "8px", minHeight: 42 }}>
          {busy ? stage!.label : "Put it on the page"}
        </Button>
      )}
      {busy && <LinearProgress variant="determinate" value={Math.round(stage!.share * 100)} sx={{ mt: 0.75, height: 4, borderRadius: 2 }} />}
      {!page && !busy && <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 0.75 }}>Pick a page first.</Typography>}
      {error && <Typography sx={{ mt: 1, fontSize: "0.8rem", color: "#c5221f" }}>{error}</Typography>}
      {done && (
        <Box sx={{ p: 1.25, borderRadius: "8px", border: "1px solid #bfe3cf", bgcolor: "#f1faf5" }}>
          <Typography sx={{ display: "flex", alignItems: "center", gap: 0.75, fontSize: "0.86rem", fontWeight: 700, color: "#1b7a55" }}>
            <CheckCircleRoundedIcon sx={{ fontSize: 18 }} />{done.moved ? "Moved on the page" : "On the page"}
          </Typography>
          <Typography sx={{ fontSize: "0.8rem", color: INK, mt: 0.5, lineHeight: 1.45 }}>
            {done.created ? "A new Page builder to-do was made for it: " : "In its Page builder to-do: "}<b>{done.title}</b> - {where === "after" ? `after "${places?.blocks.find((b) => b.selector === after)?.name ?? "a block"}"` : WHERE_LABEL[where].toLowerCase()}.
          </Typography>
          <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mt: 1 }}>
            <Button size="small" variant="outlined" onClick={() => onShowPage(done.pieceId)} sx={{ ...btn, borderColor: HAIRLINE, color: INK, bgcolor: "#fff" }}>Show it in the page</Button>
            <Button size="small" component={Link} href={done.href} endIcon={<OpenInNewIcon sx={{ fontSize: 15 }} />} sx={{ ...btn, color: PINK }}>Open the page&apos;s to-do</Button>
            <Button size="small" onClick={() => { setDone(null); }} sx={{ ...btn, color: MUTED }}>Put it again</Button>
          </Box>
        </Box>
      )}
      <Typography sx={{ mt: 1.5, fontSize: "0.72rem", color: MUTED, lineHeight: 1.5 }}>
        It stands on the page as the module library&apos;s campaign banner. Nothing is written to Magento from here: the page goes out through the Page builder&apos;s own last step, which names the banner&apos;s two pictures for the shop&apos;s media.
      </Typography>
    </StepView>
  );
}
