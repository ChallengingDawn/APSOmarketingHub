"use client";
// THE PAGE STUDIO'S LEFT PANE (08.11.2026): what the page is and what is in it.
//   Page       a new page: its fields (each with "Write with AI"); a page of the shop: which page, in which language
//   Changes    a page of the shop: its change list (APSOconvert's), each found or not on the page
//   Selected   the element clicked in the preview: its words, picture, link, look - or the AI for it alone
//   A/B test   a page of the shop: the test's plan
//   Magento    what to paste, one language at a time - or, for a test's winner, Publish (./Winner.tsx)
// Banners placed in the page by the banner studio are listed under Page, each with a way to take it out.

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { KIND_LABEL } from "@/lib/convert/model";
import type { Change } from "@/lib/convert/versions";
import {
  INSERT_WHERE_LABEL, SOURCE_LABEL, isLegacyBody, langName, langState, langsOf, mainLang, placeholdersOf, shopUrl, unwritten,
  type PageDoc, type PageSource,
} from "@/lib/content/studio/kinds/page/model";
import type { ChangeHit, InsertOut } from "@/lib/content/studio/kinds/page/shop";
import { Field, Pane, PINK, btn } from "../../parts";
import type { StudioApi } from "../../useStudio";
import { Changes } from "./Changes";
import { ElementPane, type Selection } from "./Element";
import { FieldsEditor, type FillRun } from "./Fields";
import { AbTest, Publish, Texts } from "./Sections";
import { Block, Chip, Choice, Hint } from "./ui";
import { WinnerCard, WinnerPublish, useWinner } from "./Winner";

export type Step = "page" | "changes" | "element" | "texts" | "test" | "publish";

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
  if (!d.inserts.length) return null;
  return (
    <Block title={`Banners in this page · ${d.inserts.length}`}>
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
    </Block>
  );
}

function Languages({ doc, lang, onLang }: { doc: PageDoc; lang: string; onLang: (l: string) => void }) {
  const LABEL = { main: "Main language", done: "Made", stale: "Out of date", empty: "Not made yet" } as const;
  const TINT = { main: "pink", done: "green", stale: "amber", empty: "slate" } as const;
  return (
    <Block title="Languages">
      {langsOf(doc).map((l) => {
        const st = langState(doc, l);
        const v = doc.langs[l];
        return (
          <Box key={l} component="button" type="button" onClick={() => onLang(l)} sx={{
            all: "unset", boxSizing: "border-box", display: "flex", alignItems: "center", gap: 1, width: "100%", cursor: "pointer", px: 1, py: 0.75, borderRadius: "6px",
            bgcolor: l === lang ? "rgba(36,89,209,.07)" : "transparent", "&:hover": { bgcolor: "rgba(36,89,209,.05)" },
          }}>
            <Typography sx={{ fontSize: "0.8rem", fontWeight: 800, color: INK, width: 26 }}>{l.toUpperCase()}</Typography>
            <Typography sx={{ fontSize: "0.82rem", color: INK, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {langName(l)}{doc.source !== "new" && st !== "main" && v?.path ? <Box component="span" sx={{ color: MUTED }}> · {v.path}</Box> : null}
            </Typography>
            <Chip tint={TINT[st]}>{LABEL[st]}</Chip>
          </Box>
        );
      })}
      <Hint>Each language is its own page on the shop. The assistant translates the whole page into one.</Hint>
    </Block>
  );
}

export function Build({ api, doc, d, lang, onLang, set, setView, hits, step, onStep, sel, setSel, fill, busy, canAi, onEditInPage, onAskAi, inserts, record, onPickPage, removeInsert }: {
  api: StudioApi; doc: PageDoc; d: PageDoc; lang: string; onLang: (l: string) => void;
  /** the whole document (source, shared parts) */
  set: (next: PageDoc, label?: string) => void;
  /** this language's view */
  setView: (next: PageDoc, label?: string) => void;
  hits: ChangeHit[] | null; step: Step; onStep: (s: Step) => void;
  sel: Selection | null; setSel: (s: Selection | null) => void;
  fill: FillRun; busy: string | null; canAi: boolean; onEditInPage: () => void; onAskAi: () => void;
  inserts: InsertOut[] | null; record: (label: string) => void; onPickPage: () => void; removeInsert: (id: string) => void;
}) {
  const canEdit = api.data.access.canEdit;
  const isNew = d.source === "new";
  const holders = placeholdersOf(d).length;
  const open = unwritten(d).length;
  const main = mainLang(doc);
  // a test's winner from APSOconvert is published from here (SARCLA 08.11.2026)
  const isWinner = !!doc.origin?.test;
  const won = useWinner(api, isWinner);
  const steps: { key: Step; label: string }[] = [
    { key: "page", label: isNew ? "Page" : "Page" },
    ...(!isNew ? [{ key: "changes" as Step, label: d.changes.length ? `Changes · ${d.changes.length}` : "Changes" }] : []),
    ...(sel ? [{ key: "element" as Step, label: "Element" }] : []),
    ...(holders ? [{ key: "texts" as Step, label: `Texts · ${holders - open}/${holders}` }] : []),
    ...(!isNew ? [{ key: "test" as Step, label: d.abTest.enabled ? "A/B · on" : "A/B" }] : []),
    { key: "publish", label: isWinner ? (doc.published ? "Published" : "Publish") : "Magento" },
  ];
  const shown: Step = steps.some((s) => s.key === step) ? step : "page";
  const sources: { key: PageSource; label: string }[] = [
    { key: "new", label: "A new page" }, { key: "pick", label: "A page of the shop" },
    ...(doc.origin || doc.source === "convert" ? [{ key: "convert" as PageSource, label: "From AI testing" }] : []),
  ];
  const changeSource = (source: PageSource) => {
    if (!canEdit || source === doc.source) return;
    const across = (source === "new") !== (doc.source === "new");
    if (across && !window.confirm(source === "new" ? "Start a new page here? The page of the shop and its changes stay in the version history." : "Work on a page of the shop instead? The new page's fields stay in the version history.")) return;
    set({ ...doc, source, path: across ? "" : doc.path, changes: across ? [] : doc.changes, langs: across ? {} : doc.langs }, across ? `Switched to ${SOURCE_LABEL[source].toLowerCase()}` : undefined);
    if (across && source !== "new") onPickPage();
  };

  return (
    <Pane title={<Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>Build{lang !== main && <Chip tint="blue">{lang.toUpperCase()}</Chip>}</Box>}>
      <Box sx={{ mb: 2 }}><Choice value={shown} onChange={onStep} options={steps} /></Box>

      {shown === "element" && sel && (
        <ElementPane api={api} view={d} setView={setView} sel={sel} onClose={() => setSel(null)} fill={fill} busy={busy} canAi={canAi}
          onEditInPage={onEditInPage} onAskAi={onAskAi} inserts={inserts} record={record} />
      )}

      {shown === "page" && (
        <Box>
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: MUTED, mb: 0.75 }}>The page</Typography>
            <Choice value={doc.source} onChange={changeSource} options={sources} />
          </Box>
          {isNew ? (
            <>
              {isLegacyBody(d) && (
                <Box sx={{ p: 1.5, mb: 1.5, borderRadius: "8px", bgcolor: "#fff8ec", border: "1px solid #f1d9ad" }}>
                  <Typography sx={{ fontSize: "0.84rem", color: INK, fontWeight: 600 }}>An earlier draft of this page is one block of HTML.</Typography>
                  <Hint>It still shows in the preview. &quot;Write the whole page with AI&quot; moves its good parts into the fields below - final words, no placeholders.</Hint>
                </Box>
              )}
              <FieldsEditor api={api} f={d.fields} set={(fields) => setView({ ...d, fields })} store={d.store} canEdit={canEdit} canAi={canAi} fill={fill} busy={busy}
                focusPath={sel?.key.startsWith("f:") ? sel.key.slice(2) : null} onFocusPath={(p) => setSel({ key: `f:${p}`, picked: null })} />
            </>
          ) : (
            <>
              {d.path ? <PageCard d={d} canEdit={canEdit} onAnother={onPickPage} /> : (
                <Box sx={{ p: 2, borderRadius: "10px", border: `1.5px dashed ${HAIRLINE}`, textAlign: "center", mb: 1.25 }}>
                  <Typography sx={{ fontSize: "0.88rem", color: INK, fontWeight: 600 }}>{lang === main ? "Pick the page in the middle" : `The ${langName(lang)} page is not set yet`}</Typography>
                  <Hint>{lang === main ? "Search the shop's pages there, or paste its address." : "Translate the page into this language, or pick its page."}</Hint>
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
              <Languages doc={doc} lang={lang} onLang={onLang} />
            </>
          )}
          <Inserts d={d} list={inserts} remove={removeInsert} canEdit={canEdit} />
          {isNew && <Languages doc={doc} lang={lang} onLang={onLang} />}
          <Block title="Notes">
            <Field label="For the team" value={d.notes} multiline rows={3} disabled={!canEdit} onChange={(v) => setView({ ...d, notes: v })} />
          </Block>
        </Box>
      )}

      {shown === "changes" && (
        <Block first title={lang === main ? "The changes" : `The changes in ${langName(lang)}`}>
          <Changes changes={d.changes} set={(changes: Change[]) => setView({ ...d, changes }, undefined)} hits={hits} canEdit={canEdit} />
        </Block>
      )}
      {shown === "texts" && <Block first title="The texts"><Texts d={d} set={(v) => setView(v)} canEdit={canEdit} /></Block>}
      {shown === "test" && <Block first title="The A/B test"><AbTest d={d} set={(v) => setView(v)} canEdit={canEdit} /></Block>}
      {shown === "publish" && isWinner && <Block first title="Publish on the shop"><WinnerPublish api={api} doc={doc} {...won} /></Block>}
      {shown === "publish" && !isWinner && <Block first title={`To Magento · ${langName(lang)}`}><Publish api={api} d={d} set={(v) => setView(v)} canEdit={canEdit} lang={lang} /></Block>}
    </Pane>
  );
}
