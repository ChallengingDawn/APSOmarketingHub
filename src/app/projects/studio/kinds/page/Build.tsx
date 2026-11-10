"use client";
// THE PAGE STUDIO'S LEFT PANE (08.11.2026; reworked that evening - SARCLA: "The UX and the Build on the left: can we
// improve it to be more fluid, subdivided"). The way through it, top to bottom:
//   start      only while the page is empty: what it is (a new page | a page of the shop) and, for a new page, "What page
//              do you want?" - one line saying why it is empty, a box, "Write it with AI" and "Start empty and add
//              blocks" (Content v9, SARCLA 10.11.2026: "new page should be empty and then we start to build, only not
//              when they come from ideas" - an idea's to-do writes itself, the card saying so while it writes:
//              lib/content/studio/kinds/page/appBrief.ts) - gone once the page has anything on it; then "Write it all
//              again" stays small in the map's header (the choice stays in the menu, top right)
//   outline    the page's parts in one short list, each with its state; a click opens that part alone and selects it in
//              the preview (./Outline.tsx). A page of the shop: its card, the element selected, its changes, its texts,
//              the A/B test. Then the banners in it, its languages, the notes
//   last step  pinned at the bottom: "To Magento" - each store view written into ACC and/or production through
//              Magento's API (./Publish.tsx; SARCLA 09.11.2026), the hand-over for what is not a CMS page - or, for a
//              test's winner, "Publish" (./Winner.tsx), the winner's card first in the outline
//
// Content v8 (SARCLA 10.11.2026: "on the left side leave only the blocks"): the page's parts are its BLOCKS, one row each
// (./BlockList.tsx, made by the studio) - no field forms here any more: a text is changed by a click on it in the page, a
// block's look in its settings beside it there. The page-level rows that are not blocks (search engines, store views, notes,
// the last step) stay short below the list.

import { useEffect, useState } from "react";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { keyframes } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { KIND_LABEL } from "@/lib/convert/model";
import type { Change } from "@/lib/convert/versions";
import { LIMIT } from "@/lib/content/studio/kinds/page/fields";
import { pageHasContent, type AppBriefOut, type StartState } from "@/lib/content/studio/kinds/page/appBrief";
import {
  INSERT_WHERE_LABEL, SOURCE_LABEL, isLegacyBody, langName, mainView, pageModesFor, pageSourceFix, placeholdersOf, shopCountries, shopUrl, unwritten, viewName, viewShort, viewState, viewsLine, viewsOf,
  type PageDoc, type PageSource, type StoreGroup,
} from "@/lib/content/studio/kinds/page/model";
import { blocksOf } from "@/lib/content/studio/kinds/page/outline";
import type { ChangeHit, InsertOut, Presence } from "@/lib/content/studio/kinds/page/shop";
import { Field, Pane, PINK, btn, field, mainBtn } from "../../parts";
import type { StudioApi } from "../../useStudio";
import { Changes } from "./Changes";
import { BlockBody, type FillRun, type PictureCtl } from "./Fields";
import { Row, RowList } from "./Outline";
import { ToMagento } from "./Publish";
import { Texts } from "./Sections";
import { SeoPanel, type SeoProposal } from "./Seo";
import { Chip, Choice, Hint } from "./ui";
import { viewNote } from "./Stage";
import { WinnerCard, WinnerPublish, useWinner } from "./Winner";

export type Step = "page" | "publish";
/** Where the project came from (Content v5, v9): an idea's brief writes the page by itself; any other to-do opens empty. */
export type AppBrief = AppBriefOut;
/** The start card's state and its one line (why the page is empty, or why it wrote itself), and "Start empty and add
 * blocks" - the card put away, the blocks' menu open (Content v9, SARCLA 10.11.2026). */
export type StartCard = { state: StartState; line: string; startedEmpty: boolean; onStartEmpty: (el: HTMLElement) => void };

const slideIn = keyframes`from { opacity: 0; transform: translateX(14px); } to { opacity: 1; transform: none; }`;
const fadeIn = keyframes`from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; }`;

const Kick = ({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75, minHeight: 28 }}>
    <Typography component="div" sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: MUTED, flex: 1 }}>{children}</Typography>
    {right}
  </Box>
);

function PageCard({ d, onAnother, canEdit }: { d: PageDoc; onAnother: () => void; canEdit: boolean }) {
  const o = d.outline && d.outline.path === d.path ? d.outline : null;
  return (
    <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "10px", p: 1.5, bgcolor: "#fff", mb: 1.25 }}>
      <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", mb: 0.75, flexWrap: "wrap" }}>
        {d.pageKind && <Chip tint="slate">{KIND_LABEL[d.pageKind]}</Chip>}
        <Chip tint="blue">{viewShort(d.store)}</Chip>
        {d.env === "acc" && <Chip tint="amber">ACC</Chip>}
      </Box>
      {o?.h1[0] && <Typography sx={{ fontSize: "0.95rem", fontWeight: 650, color: INK, mb: 0.25 }}>{o.h1[0]}</Typography>}
      <Typography component="a" href={shopUrl(d.env, d.path)} target="_blank" rel="noopener noreferrer"
        sx={{ fontSize: "0.78rem", color: MUTED, wordBreak: "break-all", textDecoration: "none", fontFamily: "ui-monospace, Consolas, monospace", "&:hover": { textDecoration: "underline" } }}>{d.path}</Typography>
      {canEdit && <Box><Button size="small" onClick={onAnother} sx={{ ...btn, px: 0, mt: 0.75, color: PINK }}>Another page</Button></Box>}
    </Box>
  );
}

function Inserts({ d, list, remove, canEdit }: { d: PageDoc; list: InsertOut[] | null; remove: (id: string) => void; canEdit: boolean }) {
  return (
    <Box>
      {d.inserts.map((ins) => {
        const out = list?.find((x) => x.id === ins.id);
        return (
          <Box key={ins.id} sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.9, borderBottom: `1px solid ${HAIRLINE}` }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{out?.title ?? "A banner"}</Typography>
              <Typography sx={{ fontSize: "0.74rem", color: out && !out.ok ? "#a96a12" : MUTED }}>{out && !out.ok ? out.error : `${INSERT_WHERE_LABEL[ins.where]} · ${ins.preset}`}</Typography>
            </Box>
            {!list && <CircularProgress size={13} />}
            {canEdit && <Tooltip title="Take it out of the page"><IconButton size="small" onClick={() => remove(ins.id)} aria-label="Take it out of the page"><DeleteOutlineIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>}
          </Box>
        );
      })}
      <Hint>A banner is put in a page from its own to-do (Banner &gt; Put it in a page).</Hint>
    </Box>
  );
}

/** Every store view of the shop, by language: made, out of date or still to make - and, for a page of the shop, whether
 * the page is there at all (SARCLA 09.11.2026: "the locales are not all complete in Magento - we select by store view"). */
function StoreViews({ doc, lang, onLang, groups, presence }: { doc: PageDoc; lang: string; onLang: (k: string) => void; groups: StoreGroup[]; presence: Record<string, Presence> }) {
  const LABEL = { main: "The page's own", done: "Made", stale: "Out of date", empty: "Not made" } as const;
  const TINT = { main: "pink", done: "green", stale: "amber", empty: "slate" } as const;
  // as Magento groups them (Content v6): a country in a currency - the Swiss shop in CHF and in EUR, the international one
  const countries = shopCountries(groups.flatMap((g) => g.stores), doc);
  return (
    <Box>
      {countries.map((g) => (
        <Box key={g.key} sx={{ mb: 0.75 }}>
          <Typography sx={{ fontSize: "0.68rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: MUTED, px: 1, pt: 0.5, pb: 0.25 }}>{g.label}</Typography>
          {g.stores.map((k) => {
            const st = viewState(doc, k);
            const off = doc.source !== "new" && presence[k]?.exists === false && st === "empty";
            return (
              <Box key={k} component="button" type="button" onClick={() => onLang(k)} sx={{
                all: "unset", boxSizing: "border-box", display: "flex", alignItems: "center", gap: 1, width: "100%", cursor: "pointer", px: 1, py: 0.55, borderRadius: "6px",
                bgcolor: k === lang ? "rgba(36,89,209,.07)" : "transparent", "&:hover": { bgcolor: "rgba(36,89,209,.05)" },
              }}>
                <Typography title={viewName(k)} sx={{ fontSize: "0.78rem", fontWeight: 800, color: off ? "#9aa5b8" : INK, width: 50, flexShrink: 0, letterSpacing: ".02em" }}>{k.split("/")[0]}</Typography>
                <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.72rem", color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {doc.source !== "new" && st !== "main" && st !== "empty" && doc.langs[k]?.path ? `${doc.langs[k].path} · ${viewNote(doc, k)}` : viewNote(doc, k, presence)}
                </Typography>
                <Chip tint={TINT[st]}>{LABEL[st]}</Chip>
              </Box>
            );
          })}
        </Box>
      ))}
      <Hint>Each store view is its own page in Magento. A store view of a language the page has starts as a copy (no AI); another language is translated by the assistant. Then change each as it needs.</Hint>
    </Box>
  );
}

export function Build({ api, doc, d, lang, onLang, groups, presence, set, setView, hits, step, onStep, fill, busy, canAi, inserts, onPickPage, removeInsert,
  open, onOpen, pictures, since, appBrief, start, onSeoPropose, blocks, blocksTitle, blocksRight, readyLine, abPart }: {
  api: StudioApi; doc: PageDoc; d: PageDoc;
  /** Content v8: the page's blocks (./BlockList.tsx) - its title and what stands right of it ("Write it all again") */
  blocks: React.ReactNode; blocksTitle: string; blocksRight?: React.ReactNode;
  /** how far the page is, over the last step (the list's own count, modules with it) */
  readyLine?: string;
  /** the A/B test's setup, shown in the last step (Content v8, SARCLA 10.11.2026 point 6 - the bar activates it) */
  abPart?: React.ReactNode;
  /** the store view shown, and opening one (made at once as a copy when it is of a language the page has) */
  lang: string; onLang: (l: string) => void;
  /** every store view of the shop by language; for a page of the shop, whether it is there */
  groups: StoreGroup[]; presence: Record<string, Presence>;
  /** the whole document (source, shared parts) */
  set: (next: PageDoc, label?: string) => void;
  /** this language's view */
  setView: (next: PageDoc, label?: string) => void;
  hits: ChangeHit[] | null; step: Step; onStep: (s: Step) => void;
  fill: FillRun; busy: string | null; canAi: boolean;
  inserts: InsertOut[] | null; onPickPage: () => void; removeInsert: (id: string) => void;
  /** the page-level row open ("changes", "texts", "seo", "test", "banners", "languages", "notes") */
  open: string | null; onOpen: (row: string | null) => void;
  /** where the project came from - its idea, its app and brief (null while asked) */
  appBrief: AppBrief | null;
  /** a new page's start card: its state and line, "Start empty and add blocks" (Content v9) */
  start?: StartCard;
  /** a page of the shop: the AI's search engine fields for the store view shown (Content v6) */
  onSeoPropose: () => Promise<SeoProposal | string>;
  pictures: PictureCtl;
  /** when the AI started on what it is doing now */
  since: number | null;
}) {
  const canEdit = api.data.access.canEdit;
  const isNew = d.source === "new";
  const holders = placeholdersOf(d).length;
  const openTexts = unwritten(d).length;
  const main = mainView(doc);
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  // a test's winner from APSOconvert is published from here (SARCLA 08.11.2026)
  const isWinner = !!doc.origin?.test;
  const won = useWinner(api, isWinner);
  // only the ways its type offers (SARCLA 09.11.2026): an SEO landing page is a new page, the Page builder a page of the shop
  const modes = pageModesFor(api.data.piece.contentType);
  const sources: { key: PageSource; label: string }[] = [
    { key: "new" as PageSource, label: "A new page" }, { key: "pick" as PageSource, label: "A page of the shop" },
    ...(doc.origin || doc.source === "convert" ? [{ key: "convert" as PageSource, label: "From AI testing & personalization" }] : []),
  ].filter((s) => s.key === "convert" || s.key === doc.source || modes.includes(s.key));
  const fix = pageSourceFix(api.data.piece.contentType, doc);
  useEffect(() => { if (fix && canEdit) set({ ...doc, source: fix }); }, [fix, canEdit]); // eslint-disable-line react-hooks/exhaustive-deps
  const changeSource = (source: PageSource) => {
    if (!canEdit || source === doc.source) return;
    const across = (source === "new") !== (doc.source === "new");
    if (across && !window.confirm(source === "new" ? "Start a new page here? The page of the shop and its changes stay in the version history." : "Work on a page of the shop instead? The new page's fields stay in the version history.")) return;
    set({ ...doc, source, path: across ? "" : doc.path, changes: across ? [] : doc.changes, langs: across ? {} : doc.langs }, across ? `Switched to ${SOURCE_LABEL[source].toLowerCase()}` : undefined);
    if (across && source !== "new") onPickPage();
  };

  // a new page is empty while nothing is on it (Content v9: a module, a picture, a banner count too)
  const empty = isNew ? !pageHasContent(d) : !d.path;
  const writingAll = busy === "all";
  // an idea's to-do writing itself: the card says so from the first moment and stays while it writes (Content v9)
  const autoWriting = isNew && start?.state === "writing";
  const atStart = lang === main && empty && (busy !== "all" || autoWriting) && !(isNew && start?.startedEmpty);
  const [, setTick] = useState(0);
  // the clock while the whole page is written (about a minute)
  useEffect(() => {
    if (!since) return;
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [since]);
  const secs = since ? Math.max(0, Math.round((Date.now() - since) / 1000)) : 0;
  const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

  // the page's blocks (the search engine fields are not one of them)
  const parts = isNew ? blocksOf(d.fields).filter((b) => b.num) : [];
  const writtenParts = parts.filter((p) => p.state === "written" || p.state === "picture").length;
  const missing = parts.reduce((n, p) => n + p.missing, 0);
  // what the person wants, typed in the start card (SARCLA 09.11.2026: "the user should prompt each page he wants")
  const [want, setWant] = useState("");
  const fromApp = !!appBrief?.app;
  const canStart = !!want.trim() || !!appBrief?.text.trim();
  const madeViews = viewsOf(doc);

  /* ── the last step, as its own view ─────────────────────────────────── */
  if (step === "publish") {
    return (
      <Pane pad={false} title={<Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>Build{lang !== main && <Chip tint="blue">{viewShort(lang)}</Chip>}</Box>}>
        <Box sx={{ p: 2, animation: `${slideIn} .22s ease-out` }}>
          <Button size="small" startIcon={<ArrowBackIcon sx={{ fontSize: 17 }} />} onClick={() => onStep("page")} sx={{ ...btn, color: INK, px: 0.5, ml: -0.5, mb: 1.25 }}>The page</Button>
          <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: PINK }}>Last step</Typography>
          <Typography sx={{ fontSize: "1.05rem", fontWeight: 750, color: INK, mb: 1.5, letterSpacing: "-0.01em" }}>
            {isWinner ? (doc.published ? "Published on the shop" : "Publish on the shop") : "To Magento"}
          </Typography>
          {abPart}
          {isWinner ? <WinnerPublish api={api} doc={doc} {...won} /> : <ToMagento api={api} doc={doc} d={d} setView={(v) => setView(v)} canEdit={canEdit} lang={lang} />}
        </Box>
      </Pane>
    );
  }

  /* ── the rows of a page of the shop ─────────────────────────────────── */
  const hitLine = (() => {
    if (!d.changes.length) return "None yet - ask the assistant, or click an element in the page";
    if (!hits) return `${d.changes.length} change${d.changes.length === 1 ? "" : "s"}`;
    const lost = hits.filter((h) => h.state === "missing").length;
    return lost ? `${d.changes.length - lost} found on the page · ${lost} not found` : `All ${d.changes.length} found on the page`;
  })();
  // the search engine fields (Content v6): set here for Magento, else what the page has on the shop
  const seoSet = !!(d.fields.seo.title.trim() || d.fields.seo.description.trim() || d.fields.seo.urlKey.trim());
  const seoNow = d.outline && d.outline.path === d.path ? d.outline : null;
  const seoLine = seoSet ? `New for Magento · title ${d.fields.seo.title.trim().length || "as it is"}${d.fields.seo.title.trim() ? ` / ${LIMIT.seoTitle}` : ""}`
    : seoNow ? `On the shop: title ${seoNow.title.length} / ${LIMIT.seoTitle} · description ${seoNow.description.length} / ${LIMIT.seoDescription}` : "Title, description, URL key";
  // the page's blocks (Content v8): the list the studio made, under its title
  const blockSection = (isNew || d.path) ? (
    <Box sx={{ mb: 2 }}>
      <Kick right={busy === "rewrite" && !isNew ? (
        <Typography sx={{ fontSize: "0.76rem", color: PINK, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 0.75, fontVariantNumeric: "tabular-nums" }}>
          <CircularProgress size={12} thickness={6} sx={{ color: PINK }} />Changing the page · {clock}
        </Typography>
      ) : blocksRight}>
        {blocksTitle}
      </Kick>
      {blocks}
    </Box>
  ) : null;
  const shopRows = !isNew && d.path ? (
    <>
      <Row id="changes" title="All changes" count={d.changes.length || null} state={busy === "rewrite" ? "busy" : d.changes.length ? "written" : "empty"} busyLabel="The AI is changing the page…"
        summary={hitLine} open={open === "changes"} onToggle={() => onOpen(open === "changes" ? null : "changes")}>
        <Changes changes={d.changes} set={(changes: Change[]) => setView({ ...d, changes }, undefined)} hits={hits} canEdit={canEdit} />
      </Row>
      {holders > 0 && (
        <Row id="texts" title="Texts" state={openTexts ? "partly" : "written"} summary={`${holders - openTexts} of ${holders} written`} open={open === "texts"} onToggle={() => onOpen(open === "texts" ? null : "texts")}>
          <Texts d={d} set={(v) => setView(v)} canEdit={canEdit} />
        </Row>
      )}
      <Row id="seo" title="Search engines" state={seoSet ? "written" : "none"} summary={seoLine} open={open === "seo"} onToggle={() => onOpen(open === "seo" ? null : "seo")}>
        <SeoPanel d={d} setView={setView} canEdit={canEdit} canAi={canAi} onPropose={onSeoPropose} />
      </Row>
      {/* the A/B test: in the top bar, its setup in the last step (Content v8, point 6 - Studio hands it as `abPart`) */}
    </>
  ) : null;

  /* ── the rows every page has ────────────────────────────────────────── */
  const madeLine = viewsLine(doc, groups);
  const moreRows = (
    <>
      {d.inserts.length > 0 && (
        <Row id="banners" title="Banners in this page" count={d.inserts.length} state="none" summary={inserts?.map((x) => x.title).join(" · ") ?? ""} open={open === "banners"} onToggle={() => onOpen(open === "banners" ? null : "banners")}>
          <Inserts d={d} list={inserts} remove={removeInsert} canEdit={canEdit} />
        </Row>
      )}
      <Row id="languages" title="Store views" count={madeViews.length > 1 ? madeViews.length : null} state="none" accent="blue" summary={madeLine} open={open === "languages"} onToggle={() => onOpen(open === "languages" ? null : "languages")}>
        <StoreViews doc={doc} lang={lang} onLang={onLang} groups={groups} presence={presence} />
      </Row>
      <Row id="notes" title="Notes for the team" state="none" summary={d.notes.trim() ? d.notes.trim().slice(0, 80) : "None"} open={open === "notes"} onToggle={() => onOpen(open === "notes" ? null : "notes")}>
        <Field label="For the team" value={d.notes} multiline rows={3} disabled={!canEdit} onChange={(v) => setView({ ...d, notes: v })} />
      </Row>
    </>
  );

  // the line over the last step: how far the page is - or where it went in Magento
  const lastWrite = doc.magento.find((r) => r.action === "created" || r.action === "updated");
  const onMagento = lastWrite ? `On ${lastWrite.env === "acc" ? "ACC" : "production"} · ${[...new Set(doc.magento.filter((r) => r.env === lastWrite.env && (r.action === "created" || r.action === "updated")).map((r) => r.store))].join(", ")}` : null;
  const ready = !isWinner && onMagento ? onMagento : isWinner ? (doc.published ? "Published" : api.data.piece.status === "approved" ? "Approved - ready to publish" : "Published once its reviewer approves it")
    : isNew ? readyLine ?? `${writtenParts} of ${parts.length} blocks written${missing ? ` · ${missing} picture${missing === 1 ? "" : "s"} missing` : ""}`
      : d.changes.length ? `${d.changes.length} change${d.changes.length === 1 ? "" : "s"} on the ${lang} page` : "No change yet";

  const menuItems = canEdit && !atStart ? sources.filter((s) => (s.key === "new") !== isNew && s.key !== "convert") : [];

  return (
    <Pane pad={false}
      title={<Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>Build{lang !== main && <Chip tint="blue">{viewShort(lang)}</Chip>}</Box>}
      right={menuItems.length ? (
        <>
          <Tooltip title="More"><IconButton size="small" onClick={(e) => setMenu(e.currentTarget)} aria-label="More" sx={{ my: -0.5 }}><MoreHorizIcon sx={{ fontSize: 19 }} /></IconButton></Tooltip>
          <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
            slotProps={{ paper: { sx: { borderRadius: "8px", minWidth: 240 } } }}>
            {menuItems.map((s) => (
              <MenuItem key={s.key} dense onClick={() => { setMenu(null); changeSource(s.key); }} sx={{ fontSize: "0.86rem" }}>
                {s.key === "new" ? "Make a new page instead" : "Work on a page of the shop instead"}
              </MenuItem>
            ))}
          </Menu>
        </>
      ) : undefined}>
      <Box sx={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", p: 2 }}>

          {/* the start: what the page is - only while it is empty */}
          {atStart && (
            <Box sx={{ mb: 2, p: 1.75, borderRadius: "12px", border: "1px solid rgba(194,44,110,.22)", background: "linear-gradient(135deg, rgba(194,44,110,.06), rgba(36,89,209,.05))", animation: `${fadeIn} .25s ease-out` }}>
              <Typography sx={{ fontSize: "0.95rem", fontWeight: 750, color: INK, mb: isNew && start ? 0.25 : 1 }}>{isNew ? (autoWriting ? "The page writes itself" : "What page do you want?") : sources.length > 1 ? "What are you making?" : SOURCE_LABEL[doc.source]}</Typography>
              {/* why it is empty, or why it writes itself - one short line (Content v9, SARCLA 10.11.2026) */}
              {isNew && start && <Typography data-start-line={start.state} sx={{ fontSize: "0.8rem", color: MUTED, lineHeight: 1.4, mb: 1.25 }}>{start.line}</Typography>}
              {sources.length > 1 && !autoWriting && <Box sx={{ mb: 1.5 }}><Choice value={doc.source} onChange={changeSource} options={sources} /></Box>}
              {isNew ? (
                <>
                  {/* an idea's brief: the page is written from it (by itself, at the first open); no idea: say what page */}
                  {fromApp && appBrief && (
                    <Box sx={{ mb: 1.25, p: 1.25, borderRadius: "8px", bgcolor: "rgba(255,255,255,.75)", border: `1px solid ${HAIRLINE}` }}>
                      <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: MUTED }}>{appBrief.idea ? `The idea's brief · ${appBrief.app}` : `The brief from ${appBrief.app}`}</Typography>
                      <Typography sx={{ fontSize: "0.82rem", color: INK, mt: 0.25, display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden", whiteSpace: "pre-line" }}>{appBrief.text}</Typography>
                    </Box>
                  )}
                  {autoWriting ? (
                    <>
                      <Typography sx={{ fontSize: "0.8rem", color: PINK, fontWeight: 700, display: "flex", alignItems: "center", gap: 0.75, fontVariantNumeric: "tabular-nums" }}>
                        <CircularProgress size={13} thickness={6} sx={{ color: PINK }} />{clock} · about a minute
                      </Typography>
                      <Hint mt={0.5}>The blocks fill in the page as it writes; its pictures and modules come after.</Hint>
                    </>
                  ) : (
                    <>
                      <TextField fullWidth multiline minRows={fromApp ? 2 : 3} maxRows={8} size="small" value={want} disabled={!canEdit} onChange={(e) => setWant(e.target.value)}
                        placeholder={fromApp ? "Anything to add? (optional)" : "What it is about, for whom, and the words people search - e.g. O-rings for food machines, for maintenance buyers; \"fda o-ring\", \"food grade seal\""}
                        sx={{ ...field, mb: 1, "& .MuiInputBase-root": { bgcolor: "#fff" } }}
                        onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && canStart && canAi && !busy) void fill("all", want.trim() ? { request: `THE PAGE THE PERSON WANTS: ${want.trim()}` } : undefined); }} />
                      <Button fullWidth variant="contained" disableElevation disabled={!canAi || !canEdit || !!busy || !canStart} onClick={() => void fill("all", want.trim() ? { request: `THE PAGE THE PERSON WANTS: ${want.trim()}` } : undefined)}
                        startIcon={<AutoAwesomeOutlinedIcon />} sx={{ ...mainBtn, borderRadius: "8px", height: 42 }}>
                        Write it with AI
                      </Button>
                      {start && (
                        <Button fullWidth variant="outlined" disabled={!canEdit || !!busy} onClick={(e) => start.onStartEmpty(e.currentTarget)}
                          startIcon={<AddIcon />} sx={{ ...btn, mt: 0.75, height: 38, borderRadius: "8px", color: INK, borderColor: HAIRLINE, bgcolor: "#fff", "&:hover": { borderColor: PINK, bgcolor: "#fff" } }}>
                          Start empty and add blocks
                        </Button>
                      )}
                      <Hint mt={0.75}>{canStart ? `With AI: in ${langName(lang)}, final words, its pictures and modules made.` : "With AI: say what the page is for first."} Empty: you add the blocks and write them on the page.</Hint>
                    </>
                  )}
                </>
              ) : (
                <Hint mt={0}>Pick the page in the middle: search the shop&apos;s pages, or paste its address. It opens there as the shop shows it, ready to change.</Hint>
              )}
            </Box>
          )}

          {/* a page of the shop: which one */}
          {!isNew && d.path && <PageCard d={d} canEdit={canEdit} onAnother={onPickPage} />}
          {!isNew && !d.path && lang !== main && (
            <Box sx={{ p: 2, borderRadius: "10px", border: `1.5px dashed ${HAIRLINE}`, textAlign: "center", mb: 1.25 }}>
              <Typography sx={{ fontSize: "0.88rem", color: INK, fontWeight: 600 }}>The {lang} page is not set yet</Typography>
              <Hint>{presence[lang]?.exists === false ? `The shop's index has no such page in ${lang}. Pick its page if it has another address.` : "Copy or translate the page into this store view, or pick its page."}</Hint>
              {canEdit && <Button size="small" onClick={onPickPage} sx={{ ...btn, color: PINK, mt: 0.75 }}>Pick the page</Button>}
            </Box>
          )}
          {isWinner && lang === main && <WinnerCard doc={doc} info={won.info} />}
          {!isWinner && doc.source === "convert" && doc.origin && lang === main && (
            <Box sx={{ mb: 1.25 }}>
              <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", mb: 0.5 }}>
                <Chip tint={doc.origin.status === "approved" ? "green" : "amber"}>{doc.origin.letter ? `Version ${doc.origin.letter}` : doc.origin.status === "approved" ? "Approved version" : "Draft version"}</Chip>
                <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{doc.origin.letter ? `of AI testing & personalization · ${doc.origin.status === "approved" ? "approved" : "draft"} · ` : ""}revision {doc.origin.rev}</Typography>
              </Box>
              {doc.origin.idea && <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK }}>{doc.origin.idea}</Typography>}
              {doc.origin.summary && <Typography sx={{ fontSize: "0.82rem", color: MUTED, mt: 0.25 }}>{doc.origin.summary}</Typography>}
            </Box>
          )}

          {/* a new page: its parts */}
          {isNew && (
            <>
              {isLegacyBody(d) && (
                <Box sx={{ p: 1.5, mb: 1.5, borderRadius: "8px", bgcolor: "#fff8ec", border: "1px solid #f1d9ad" }}>
                  <Typography sx={{ fontSize: "0.84rem", color: INK, fontWeight: 600 }}>An earlier draft of this page is one block of HTML.</Typography>
                  <Hint>It still shows in the preview. &quot;Write it all with AI&quot; moves its good parts into the parts below - final words, no placeholders.</Hint>
                </Box>
              )}
              {writingAll && !(atStart && autoWriting) && (
                <Typography sx={{ fontSize: "0.76rem", color: PINK, fontWeight: 700, display: "flex", alignItems: "center", gap: 0.75, fontVariantNumeric: "tabular-nums", mb: 0.75 }}>
                  <CircularProgress size={12} thickness={6} sx={{ color: PINK }} />Writing the page · {clock}
                </Typography>
              )}
              {/* written by itself from its idea in this open: said once, quietly, over the blocks (Content v9) */}
              {!atStart && lang === main && start?.state === "wrote" && (
                <Typography data-start-line="wrote" sx={{ fontSize: "0.78rem", color: MUTED, display: "flex", alignItems: "center", gap: 0.75, mb: 1 }}>
                  <AutoAwesomeOutlinedIcon sx={{ fontSize: 15, color: PINK }} />{start.line}
                </Typography>
              )}
            </>
          )}

          {blockSection}
          {shopRows && <RowList>{shopRows}</RowList>}
          {isNew && (
            <RowList>
              <Row id="seo" title="Search engines" state={d.fields.seo.title.trim() && d.fields.seo.description.trim() ? "written" : d.fields.seo.title.trim() || d.fields.seo.description.trim() ? "partly" : "empty"}
                summary={d.fields.seo.title.trim() || "Title, description, URL key"} open={open === "seo"} onToggle={() => onOpen(open === "seo" ? null : "seo")}>
                <BlockBody api={api} block="seo" f={d.fields} set={(fields, label) => setView({ ...d, fields }, label)} store={d.store} canEdit={canEdit} canAi={canAi} fill={fill} busy={busy}
                  focusPath={null} selKey={null} onFocusPath={() => undefined} onSelect={() => undefined} pictures={pictures} />
              </Row>
            </RowList>
          )}

          <Box sx={{ mt: 2 }}>
            <Kick>Around it</Kick>
            <RowList>{moreRows}</RowList>
          </Box>
        </Box>

        {/* the last step, always in view */}
        {!atStart && (
          <Box sx={{ flexShrink: 0, px: 2, py: 1.25, borderTop: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.92)", backdropFilter: "blur(6px)" }}>
            <Typography sx={{ fontSize: "0.74rem", color: MUTED, mb: 0.75, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ready}</Typography>
            <Button fullWidth variant="contained" disableElevation onClick={() => onStep("publish")} endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />}
              sx={{ ...btn, height: 40, borderRadius: "8px", bgcolor: "#15223a", color: "#fff", justifyContent: "space-between", px: 1.75, "&:hover": { bgcolor: "#24344f" } }}>
              <Box component="span" sx={{ display: "inline-flex", alignItems: "baseline", gap: 1 }}>
                <Box component="span" sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(255,255,255,.6)" }}>Last step</Box>
                {isWinner ? (doc.published ? "Published" : "Publish") : "To Magento"}
              </Box>
            </Button>
          </Box>
        )}
      </Box>
    </Pane>
  );
}
