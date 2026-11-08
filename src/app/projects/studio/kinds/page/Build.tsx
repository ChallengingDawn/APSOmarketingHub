"use client";
// THE PAGE STUDIO'S LEFT PANE (08.11.2026; reworked that evening - SARCLA: "The UX and the Build on the left: can we
// improve it to be more fluid, subdivided"). The way through it, top to bottom:
//   start      only while the page is empty: what it is (a new page | a page of the shop) and, for a new page, "Write the
//              whole page with AI" - gone once the page has words (the choice stays in the menu, top right)
//   outline    the page's parts in one short list, each with its state; a click opens that part alone and selects it in
//              the preview (./Outline.tsx). A page of the shop: its card, the element selected, its changes, its texts,
//              the A/B test. Then the banners in it, its languages, the notes
//   last step  pinned at the bottom: "To Magento" - what to paste, one language at a time - or, for a test's winner,
//              "Publish" (./Winner.tsx), the winner's card first in the outline

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { keyframes } from "@mui/material/styles";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { KIND_LABEL } from "@/lib/convert/model";
import type { Change } from "@/lib/convert/versions";
import { filledCount } from "@/lib/content/studio/kinds/page/fields";
import {
  INSERT_WHERE_LABEL, SOURCE_LABEL, isLegacyBody, langName, langState, langsOf, mainLang, placeholdersOf, shopUrl, unwritten,
  type LangOption, type PageDoc, type PageSource,
} from "@/lib/content/studio/kinds/page/model";
import { partsOf, type PartKey } from "@/lib/content/studio/kinds/page/outline";
import type { ChangeHit, InsertOut } from "@/lib/content/studio/kinds/page/shop";
import { Field, Pane, PINK, btn, mainBtn } from "../../parts";
import type { StudioApi } from "../../useStudio";
import { Changes } from "./Changes";
import { ElementPane, type Selection } from "./Element";
import type { FillRun, PictureCtl } from "./Fields";
import { PartsOutline, Row, RowList } from "./Outline";
import { AbTest, Publish, Texts } from "./Sections";
import { Chip, Choice, Hint } from "./ui";
import { WinnerCard, WinnerPublish, useWinner } from "./Winner";

export type Step = "page" | "publish";

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
        <Chip tint="blue">{d.store}</Chip>
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

/** Every language the shop publishes in: made, out of date or still to make - and the store views it goes in. */
function Languages({ doc, lang, onLang, offered }: { doc: PageDoc; lang: string; onLang: (l: string) => void; offered: LangOption[] }) {
  const LABEL = { main: "Main language", done: "Made", stale: "Out of date", empty: "Not made yet" } as const;
  const TINT = { main: "pink", done: "green", stale: "amber", empty: "slate" } as const;
  return (
    <Box>
      {offered.map((o) => {
        const st = langState(doc, o.lang);
        const v = doc.langs[o.lang];
        const store = st === "main" ? doc.store : v?.store || o.store;
        const others = o.stores.filter((s) => s !== store);
        return (
          <Box key={o.lang} component="button" type="button" onClick={() => onLang(o.lang)} sx={{
            all: "unset", boxSizing: "border-box", display: "flex", alignItems: "center", gap: 1, width: "100%", cursor: "pointer", px: 1, py: 0.7, borderRadius: "6px",
            bgcolor: o.lang === lang ? "rgba(36,89,209,.07)" : "transparent", "&:hover": { bgcolor: "rgba(36,89,209,.05)" },
          }}>
            <Typography sx={{ fontSize: "0.8rem", fontWeight: 800, color: INK, width: 24 }}>{o.lang.toUpperCase()}</Typography>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.83rem", color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.name}</Typography>
              <Typography sx={{ fontSize: "0.7rem", color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {doc.source !== "new" && st !== "main" && v?.path ? v.path : `${store}${others.length ? ` · also ${others.join(", ")}` : ""}`}
              </Typography>
            </Box>
            <Chip tint={TINT[st]}>{LABEL[st]}</Chip>
          </Box>
        );
      })}
      <Hint>Each language is its own page on the shop, in every store view of that language. Pick a language above the page; the assistant translates the whole page into it.</Hint>
    </Box>
  );
}

export function Build({ api, doc, d, lang, onLang, set, setView, hits, step, onStep, sel, setSel, fill, busy, canAi, onEditInPage, onAskAi, inserts, record, onPickPage, removeInsert,
  offered, open, onOpen, onOpenPart, onFocusPath, pictures, makingIn, since }: {
  api: StudioApi; doc: PageDoc; d: PageDoc; lang: string; onLang: (l: string) => void;
  /** the whole document (source, shared parts) */
  set: (next: PageDoc, label?: string) => void;
  /** this language's view */
  setView: (next: PageDoc, label?: string) => void;
  hits: ChangeHit[] | null; step: Step; onStep: (s: Step) => void;
  sel: Selection | null; setSel: (s: Selection | null) => void;
  fill: FillRun; busy: string | null; canAi: boolean; onEditInPage: () => void; onAskAi: () => void;
  inserts: InsertOut[] | null; record: (label: string) => void; onPickPage: () => void; removeInsert: (id: string) => void;
  /** every language the shop publishes in */
  offered: LangOption[];
  /** the row open in the outline (a part of a new page, or "selected", "changes", "texts", "test", "banners", "languages", "notes") */
  open: string | null; onOpen: (row: string | null) => void;
  /** a part opened from here: selected in the preview, which scrolls to it */
  onOpenPart: (part: PartKey | null) => void;
  /** a field in focus here: selected in the preview */
  onFocusPath: (path: string) => void;
  pictures: PictureCtl; makingIn: (part: PartKey) => number;
  /** when the AI started on what it is doing now */
  since: number | null;
}) {
  const canEdit = api.data.access.canEdit;
  const isNew = d.source === "new";
  const holders = placeholdersOf(d).length;
  const openTexts = unwritten(d).length;
  const main = mainLang(doc);
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  // a test's winner from APSOconvert is published from here (SARCLA 08.11.2026)
  const isWinner = !!doc.origin?.test;
  const won = useWinner(api, isWinner);
  const sources: { key: PageSource; label: string }[] = [
    { key: "new", label: "A new page" }, { key: "pick", label: "A page of the shop" },
    ...(doc.origin || doc.source === "convert" ? [{ key: "convert" as PageSource, label: "From AI testing & personalization" }] : []),
  ];
  const changeSource = (source: PageSource) => {
    if (!canEdit || source === doc.source) return;
    const across = (source === "new") !== (doc.source === "new");
    if (across && !window.confirm(source === "new" ? "Start a new page here? The page of the shop and its changes stay in the version history." : "Work on a page of the shop instead? The new page's fields stay in the version history.")) return;
    set({ ...doc, source, path: across ? "" : doc.path, changes: across ? [] : doc.changes, langs: across ? {} : doc.langs }, across ? `Switched to ${SOURCE_LABEL[source].toLowerCase()}` : undefined);
    if (across && source !== "new") onPickPage();
  };

  const empty = isNew ? filledCount(d.fields) === 0 && !isLegacyBody(d) : !d.path;
  const atStart = lang === main && empty && busy !== "all";
  const writingAll = busy === "all";
  const [, setTick] = useState(0);
  // the clock while the whole page is written (about a minute)
  useEffect(() => {
    if (!since) return;
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [since]);
  const secs = since ? Math.max(0, Math.round((Date.now() - since) / 1000)) : 0;
  const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

  const parts = isNew ? partsOf(d.fields) : [];
  const writtenParts = parts.filter((p) => p.state === "written" || p.state === "picture").length;
  const missing = parts.reduce((n, p) => n + p.missing, 0);
  const madeLangs = langsOf(doc);

  /* ── the last step, as its own view ─────────────────────────────────── */
  if (step === "publish") {
    return (
      <Pane pad={false} title={<Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>Build{lang !== main && <Chip tint="blue">{lang.toUpperCase()}</Chip>}</Box>}>
        <Box sx={{ p: 2, animation: `${slideIn} .22s ease-out` }}>
          <Button size="small" startIcon={<ArrowBackIcon sx={{ fontSize: 17 }} />} onClick={() => onStep("page")} sx={{ ...btn, color: INK, px: 0.5, ml: -0.5, mb: 1.25 }}>The page</Button>
          <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: PINK }}>Last step</Typography>
          <Typography sx={{ fontSize: "1.05rem", fontWeight: 750, color: INK, mb: 1.5, letterSpacing: "-0.01em" }}>
            {isWinner ? (doc.published ? "Published on the shop" : "Publish on the shop") : `To Magento · ${langName(lang)}`}
          </Typography>
          {isWinner ? <WinnerPublish api={api} doc={doc} {...won} /> : <Publish api={api} d={d} set={(v) => setView(v)} canEdit={canEdit} lang={lang} />}
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
  const shopRows = !isNew && d.path ? (
    <>
      {sel && (
        <Row id="selected" title="Selected" accent="pink" state="none" open={open === "selected"} onToggle={() => onOpen(open === "selected" ? null : "selected")}
          summary={sel.picked ? `<${sel.picked.tag}> ${sel.picked.text.slice(0, 60)}` : sel.key.startsWith("i:") ? "A banner" : ""}>
          <ElementPane api={api} view={d} setView={setView} sel={sel} onClose={() => setSel(null)} fill={fill} busy={busy} canAi={canAi}
            onEditInPage={onEditInPage} onAskAi={onAskAi} inserts={inserts} record={record} />
        </Row>
      )}
      <Row id="changes" title="Changes" count={d.changes.length || null} state={busy === "rewrite" ? "busy" : d.changes.length ? "written" : "empty"} busyLabel="The AI is changing the page…"
        summary={hitLine} open={open === "changes"} onToggle={() => onOpen(open === "changes" ? null : "changes")}>
        <Changes changes={d.changes} set={(changes: Change[]) => setView({ ...d, changes }, undefined)} hits={hits} canEdit={canEdit} />
      </Row>
      {holders > 0 && (
        <Row id="texts" title="Texts" state={openTexts ? "partly" : "written"} summary={`${holders - openTexts} of ${holders} written`} open={open === "texts"} onToggle={() => onOpen(open === "texts" ? null : "texts")}>
          <Texts d={d} set={(v) => setView(v)} canEdit={canEdit} />
        </Row>
      )}
      <Row id="test" title="A/B test" state="none" summary={d.abTest.enabled ? `On · ${d.abTest.split}% see the new version` : "Off"} open={open === "test"} onToggle={() => onOpen(open === "test" ? null : "test")}>
        <AbTest d={d} set={(v) => setView(v)} canEdit={canEdit} />
      </Row>
    </>
  ) : null;

  /* ── the rows every page has ────────────────────────────────────────── */
  const madeLine = madeLangs.length > 1 ? madeLangs.map((l) => langName(l)).join(" · ") : `Only ${langName(main)} so far · ${offered.length} languages on the shop`;
  const moreRows = (
    <>
      {d.inserts.length > 0 && (
        <Row id="banners" title="Banners in this page" count={d.inserts.length} state="none" summary={inserts?.map((x) => x.title).join(" · ") ?? ""} open={open === "banners"} onToggle={() => onOpen(open === "banners" ? null : "banners")}>
          <Inserts d={d} list={inserts} remove={removeInsert} canEdit={canEdit} />
        </Row>
      )}
      <Row id="languages" title="Languages" count={madeLangs.length > 1 ? madeLangs.length : null} state="none" accent="blue" summary={madeLine} open={open === "languages"} onToggle={() => onOpen(open === "languages" ? null : "languages")}>
        <Languages doc={doc} lang={lang} onLang={onLang} offered={offered} />
      </Row>
      <Row id="notes" title="Notes for the team" state="none" summary={d.notes.trim() ? d.notes.trim().slice(0, 80) : "None"} open={open === "notes"} onToggle={() => onOpen(open === "notes" ? null : "notes")}>
        <Field label="For the team" value={d.notes} multiline rows={3} disabled={!canEdit} onChange={(v) => setView({ ...d, notes: v })} />
      </Row>
    </>
  );

  // the line over the last step: how far the page is
  const ready = isWinner ? (doc.published ? "Published" : api.data.piece.status === "approved" ? "Approved - ready to publish" : "Published once its reviewer approves it")
    : isNew ? `${writtenParts} of ${parts.length} parts written${missing ? ` · ${missing} picture${missing === 1 ? "" : "s"} missing` : ""}`
      : d.changes.length ? `${d.changes.length} change${d.changes.length === 1 ? "" : "s"} on the ${langName(lang)} page` : "No change yet";

  const menuItems = canEdit && !atStart ? sources.filter((s) => (s.key === "new") !== isNew && s.key !== "convert") : [];

  return (
    <Pane pad={false}
      title={<Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>Build{lang !== main && <Chip tint="blue">{lang.toUpperCase()}</Chip>}</Box>}
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
              <Typography sx={{ fontSize: "0.95rem", fontWeight: 750, color: INK, mb: 1 }}>What are you making?</Typography>
              <Box sx={{ mb: 1.5 }}><Choice value={doc.source} onChange={changeSource} options={sources} /></Box>
              {isNew ? (
                <>
                  <Button fullWidth variant="contained" disableElevation disabled={!canAi || !canEdit || !!busy} onClick={() => void fill("all")}
                    startIcon={<AutoAwesomeOutlinedIcon />} sx={{ ...mainBtn, borderRadius: "8px", height: 42 }}>
                    Write the whole page with AI
                  </Button>
                  <Hint mt={0.75}>From the brief and the brand&apos;s facts, in {langName(lang)} - final words, and its pictures made. Or open a part below and write it yourself.</Hint>
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
              <Typography sx={{ fontSize: "0.88rem", color: INK, fontWeight: 600 }}>The {langName(lang)} page is not set yet</Typography>
              <Hint>Translate the page into this language, or pick its page.</Hint>
              {canEdit && <Button size="small" onClick={onPickPage} sx={{ ...btn, color: PINK, mt: 0.75 }}>Pick the page</Button>}
            </Box>
          )}
          {isWinner && lang === main && <WinnerCard doc={doc} info={won.info} />}
          {!isWinner && doc.source === "convert" && doc.origin && lang === main && (
            <Box sx={{ mb: 1.25 }}>
              <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", mb: 0.5 }}>
                <Chip tint={doc.origin.status === "approved" ? "green" : "amber"}>{doc.origin.status === "approved" ? "Approved version" : "Draft version"}</Chip>
                <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>revision {doc.origin.rev}</Typography>
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
              <Kick right={writingAll ? (
                <Typography sx={{ fontSize: "0.76rem", color: PINK, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 0.75, fontVariantNumeric: "tabular-nums" }}>
                  <CircularProgress size={12} thickness={6} sx={{ color: PINK }} />Writing the page · {clock}
                </Typography>
              ) : !atStart && canEdit ? (
                <Button size="small" disabled={!canAi || !!busy} onClick={() => void fill("all")} startIcon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 15 }} />}
                  sx={{ ...btn, color: PINK, px: 0.75, py: 0.1, fontSize: "0.76rem", minWidth: 0 }}>{isLegacyBody(d) ? "Move the draft in with AI" : empty ? "Write it all with AI" : "Write it all again"}</Button>
              ) : undefined}>
                The page{writingAll ? "" : ` · ${writtenParts} of ${parts.length} written`}
              </Kick>
              <PartsOutline api={api} f={d.fields} set={(fields, label) => setView({ ...d, fields }, label)} store={d.store} canEdit={canEdit} canAi={canAi} fill={fill} busy={busy}
                open={open} onOpen={onOpenPart} focusPath={sel?.key.startsWith("f:") ? sel.key.slice(2) : null} selBlock={sel?.key.startsWith("b:") ? sel.key.slice(2) : null}
                onFocusPath={onFocusPath} pictures={pictures} makingIn={makingIn} />
              {sel?.key.startsWith("i:") && (
                <Box sx={{ mt: 1.5 }}>
                  <RowList>
                    <Row id="selected" title="Selected banner" accent="pink" state="none" open onToggle={() => setSel(null)}>
                      <ElementPane api={api} view={d} setView={setView} sel={sel} onClose={() => setSel(null)} fill={fill} busy={busy} canAi={canAi}
                        onEditInPage={onEditInPage} onAskAi={onAskAi} inserts={inserts} record={record} />
                    </Row>
                  </RowList>
                </Box>
              )}
            </>
          )}

          {shopRows && <RowList>{shopRows}</RowList>}

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
                {isWinner ? (doc.published ? "Published" : "Publish") : `To Magento · ${lang.toUpperCase()}`}
              </Box>
            </Button>
          </Box>
        )}
      </Box>
    </Pane>
  );
}
