"use client";
// THE PAGE STUDIO'S LAST STEP: TO MAGENTO (09.11.2026). SARCLA: "The Magento publish should occur via the API ... also be
// able to update ACC and/or PROD" - and "we select by store view". The way through it, top to bottom:
//   where to      two squared targets, ACC and Production, either or both - a target without its key says so plainly
//   store views   the page's store views, each with what Magento does there: creates a new page, updates page #42, or
//                 why not (a page somebody else made under the URL key, a page set for All Store Views ...) - read from
//                 Magento, nothing written; a click shows "What will be sent": the exact page Magento gets, readable
//   the button    "Publish to ACC" / "Publish to production": once the to-do is approved, by someone with Edit on AI
//                 testing & personalization > Winners; each page is backed up first (src/lib/convert/cms.ts)
//   afterwards    "On ACC · de-CH · 09.11 10:12 · open it" and "Bring the page back as it was"
// A category, a product or the home page is not a CMS page: the last step stays the hand-over for dotSource.
// Content v10 (SARCLA 10.11.2026, point 6): a row is a LANGUAGE - "English · 11 store views" - with its store views as
// Magento's Store View lists them, each saying what the write does there (put in, already in, left out and why, "id ?"
// where the hub does not know Magento's id). Content v11: Magento's API takes no store views in a page ("StoreId" is not
// supported), so the same page is written into each ticked store view - one Magento page each, kept together here.
// Content v14 (SARCLA 11.11.2026, after the first official page with the picture storage: "see the current links in one
// tab, and in one click update them all"; "we should see the setup as today"; "pictures should be a new tab"; the A/B test
// "controlled from here"): the step is a publishing view - the studio gives it about twice the width, the assistant folded
// to a rail (parts.tsx StudioPanes `wide`) - in four sections, a squared switch: Pages (each language's links on ACC and
// production, changed since or as published, and "Update all on ACC" / "on production" - ACC first), Pictures (a grid),
// A/B test (./PublishAb.tsx) and Setup (the step as it was: the ticks, the targets, the rights, the calendar, the hand-over).
// Content v14b (SARCLA 11.11.2026, 15:35: "Setup and Pages do the same as a tab"): three sections - Setup is in Pages: its
// rights one line on top, its targets and ticks folded under "Where it goes", the calendar and the hand-over at the foot. A
// refused write says Magento's HTML page by its title and status, and "Try again" writes the failed pages only.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CheckIcon from "@mui/icons-material/Check";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RefreshIcon from "@mui/icons-material/Refresh";
import UndoIcon from "@mui/icons-material/Undo";
import { AMBER, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import type { PagePlan, SharedPlan } from "@/lib/convert/cmsPage";
import type { Env } from "@/lib/convert/model";
import type { PageBackup } from "@/lib/convert/cms";
import { noKeySteps, type Check } from "@/lib/content/studio/kinds/page/magentoCheck";
import { versionList, viewName, viewsOf, type MagentoRecord, type PageDoc } from "@/lib/content/studio/kinds/page/model";
import type { MagentoView } from "@/lib/content/studio/kinds/page/shop";
import { mediaGallerySteps, picturesHold, type PictureCheck } from "@/lib/content/studio/kinds/page/media";
import { SHOP_LABEL, liveOn, type LivePage, type Since } from "@/lib/content/studio/kinds/page/published";
import { ENVS_SHOWN, PUB_SECTIONS, pageRows, progressLine, readableError, retryViews, stateLine, updateAllOf, type PubSection, type RowState, type UpdateAll } from "@/lib/content/studio/kinds/page/publishView";
import { h1ModuleOf } from "@/lib/content/studio/kinds/page/blocklist";
import { moduleGap } from "@/lib/content/studio/kinds/page/modules/model";
import { blockOrder } from "@/lib/content/studio/kinds/page/fields";
import { PINK, btn, mainBtn } from "../../parts";
import { fileStem, saveFiles, type FileOut } from "../../frame";
import type { StudioApi } from "../../useStudio";
import { Publish as HandOver } from "./Sections";
import { AbSection, useAbLit } from "./PublishAb";
import { Choice, Hint, mono } from "./ui";

export type EnvState = {
  env: Env; label: string; base: string; key: boolean; waiting: string | null; why: string | null; restoreWhy: string | null;
  /** where its key for pages comes from, the connection in plain words, the last check (Content v6) */
  from?: "cms" | "order" | "none"; connection?: string; check?: Check | null;
};
/** A version as the last step reads it (Content v10): its language's label and the store views it goes to. */
export type StatusView = Omit<MagentoView, "want"> & { label?: string; stores?: { view: string; open: boolean; id: number | null }[]; since?: Partial<Record<Env, Since>> };
export type Status = { views: StatusView[]; envs: EnvState[]; gate: { canEdit: boolean; approved: boolean; grant: boolean; why: string | null }; backups: PageBackup[] };
export type PlanOut = PagePlan | SharedPlan | { view: string; env: Env; action: "none"; why: string; error: true };
/** A new page's own pictures in one target's media (10.11.2026), read with the plan: each there or not, and what holds.
 * `storage: "hub"` (11.11.2026): they go to the hub's picture storage instead - stored, or stored by Publish, nothing
 * holds; `note`: why the storage is off where it was set up (a laptop). */
export type PicturesOut = { list: (PictureCheck & { views: string[] })[]; hold: string | null; storage?: "hub"; note?: string | null };
type Result = { view: string; ok: boolean; action?: string; pageId?: string; error?: string; stores?: string[]; note?: string };
const isShared = (p: PlanOut | undefined): p is SharedPlan => !!p && "targets" in p;

const BLUE = "#2459d1";
const GREEN = "#1b7a55";
const kb = (n: number) => (n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} bytes`);
const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const DONE: Record<MagentoRecord["action"], string> = { created: "On", updated: "On", restored: "Brought back on", "switched-off": "Switched off on" };

const Kick = ({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 2, mb: 0.75 }}>
    <Typography component="div" sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: MUTED, flex: 1 }}>{children}</Typography>
    {right}
  </Box>
);

/** Two squared targets, either or both (not a single choice: SARCLA "ACC and/or PROD"). */
function Targets({ envs, on, onToggle }: { envs: EnvState[]; on: Env[]; onToggle: (e: Env) => void }) {
  return (
    <Box role="group" aria-label="Where to" sx={{ display: "inline-flex", border: `1px solid ${HAIRLINE}`, borderRadius: "6px", overflow: "hidden", bgcolor: "#fff" }}>
      {envs.map((e, i) => {
        const sel = on.includes(e.env);
        return (
          <Box key={e.env} component="button" type="button" aria-pressed={sel} onClick={() => onToggle(e.env)} sx={{
            all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 0.6, px: 1.4, py: 0.6, fontSize: "0.82rem", fontWeight: 700,
            borderLeft: i ? `1px solid ${HAIRLINE}` : "none", color: sel ? "#fff" : INK, bgcolor: sel ? BLUE : "transparent", transition: "background-color .12s",
            "&:hover": sel ? {} : { bgcolor: "rgba(36,89,209,.07)" }, "&:focus-visible": { outline: `2px solid ${BLUE}`, outlineOffset: -2 },
          }}>
            <Box component="span" sx={{ width: 11, height: 11, borderRadius: "2px", border: `1.5px solid ${sel ? "#fff" : "#9aa5b8"}`, display: "grid", placeItems: "center", boxSizing: "border-box" }}>
              {sel && <CheckIcon sx={{ fontSize: 10, color: "#fff" }} />}
            </Box>
            {e.label}
          </Box>
        );
      })}
    </Box>
  );
}

/** What Magento does with one store view in one target, in a few words. */
function planLine(p: PlanOut | undefined, e: EnvState): { text: string; tone: "ok" | "off" | "wait" } {
  if (!e.key) return { text: "waiting for its key", tone: "wait" };
  if (!p) return { text: "reading Magento…", tone: "wait" };
  if (isShared(p) && p.action !== "none") {
    // the same page in each of the version's store views (Content v11)
    const n = p.storeIds.length;
    const put = p.targets.filter((t) => t.state === "new").map((t) => t.view);
    const upd = p.targets.filter((t) => t.state === "has").length;
    const more = [put.length && upd ? `creates it in ${put.join(", ")}` : "", p.out.length ? `switches it off in ${p.out.join(", ")}` : ""].filter(Boolean).join(" · ");
    return { text: `${upd ? `updates the page in ${upd} store view${upd === 1 ? "" : "s"}` : `creates the page in ${n} store view${n === 1 ? "" : "s"} - one Magento page each`}${more ? ` - ${more}` : ""}`, tone: "ok" };
  }
  if (p.action === "create") return { text: "creates a new page", tone: "ok" };
  if (p.action === "update") {
    const shared = "shared" in p && p.shared.length ? ` - also serves ${p.shared.join(", ")}` : "";
    return { text: `updates page #${p.pageId}${shared}`, tone: "ok" };
  }
  return { text: `not written: ${p.why ?? "-"}`, tone: "off" };
}

/** A page of the shop's version: its page in each store view it goes to, in a few words. */
function pickLine(plans: PlanOut[], stores: string[], e: EnvState): { text: string; tone: "ok" | "off" | "wait" } {
  if (!e.key) return { text: "waiting for its key", tone: "wait" };
  const mine = stores.map((v) => plans.find((p) => p.view === v));
  if (mine.some((p) => !p)) return { text: "reading Magento…", tone: "wait" };
  const go = mine.filter((p) => p!.action !== "none");
  const pages = [...new Set(go.map((p) => ("pageId" in p! && p!.pageId) || "").filter(Boolean))];
  if (!go.length) return { text: `not written: ${mine[0]?.why ?? "-"}`, tone: "off" };
  const off = mine.filter((p) => p!.action === "none").map((p) => p!.view);
  return { text: `updates ${pages.length} page${pages.length === 1 ? "" : "s"} (#${pages.join(", #")}) for ${go.length} store view${go.length === 1 ? "" : "s"}${off.length ? ` - not in ${off.join(", ")}` : ""}`, tone: "ok" };
}

const CHIP: Record<string, { c: string; w: string }> = {
  new: { c: GREEN, w: "created" }, has: { c: GREEN, w: "updated" }, other: { c: BLUE, w: "updated" }, taken: { c: "#a14b12", w: "left out" }, unknown: { c: AMBER, w: "id ?" }, out: { c: MUTED, w: "switched off" },
};

/** The version's store views as Magento's Store View lists them, each with what the write does there (one target). */
function StoreChips({ v, plan }: { v: StatusView; plan: PlanOut | undefined }) {
  const stores = v.stores ?? [{ view: v.view, open: true, id: null }];
  const shared = isShared(plan) ? plan : null;
  const extra = shared?.out ?? [];
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.6 }}>
      {[...stores.map((x) => x.view), ...extra].map((k) => {
        const s = stores.find((x) => x.view === k);
        const t = shared?.targets.find((x) => x.view === k);
        const st = extra.includes(k) ? "out" : t?.state ?? (s && !s.id ? "unknown" : "");
        const look = st ? CHIP[st] : null;
        return (
          <Box key={k} component="span" title={t?.why ?? (st === "out" ? `${k} is no longer ticked - the page leaves it` : t?.pageId ? `Magento page #${t.pageId} · store id ${s?.id ?? "?"}` : s?.id ? `Magento store id ${s.id}` : "Magento has it; the hub does not know its id")}
            sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: 0.6, py: 0.15, borderRadius: "3px", border: `1px solid ${look ? `${look.c}44` : HAIRLINE}`, bgcolor: look ? `${look.c}0d` : "#fff",
              fontSize: "0.7rem", fontWeight: 700, color: INK, whiteSpace: "nowrap", textDecoration: st === "out" ? "line-through" : "none" }}>
            {k.split("/")[0].toUpperCase()}{k.includes("/") && <Box component="span" sx={{ fontSize: "0.58rem", color: BLUE }}>{k.split("/")[1].toUpperCase()}</Box>}
            {look && <Box component="span" sx={{ fontWeight: 700, color: look.c }}>{look.w}</Box>}
            {/* the Magento page it updates (Content v12: "each store view row says updated, its page #") */}
            {t?.pageId && st === "has" && <Box component="span" sx={{ fontWeight: 500, color: MUTED, fontVariantNumeric: "tabular-nums" }}>#{t.pageId}</Box>}
          </Box>
        );
      })}
    </Box>
  );
}

/** The exact page Magento gets, readable (not raw JSON). */
function WhatIsSent({ api, v, envs, plans, on }: { api: StudioApi; v: Status["views"][number]; envs: EnvState[]; plans: Record<string, PlanOut[]>; on: Env[] }) {
  const [html, setHtml] = useState(false);
  const s = v.sent;
  if (!s) return null;
  const isNew = s.kind === "page";
  const rows: [string, React.ReactNode][] = [
    ["Store view", `${v.view} · ${viewName(v.view)}`],
    ...(s.letter ? [["Version", `Version ${s.letter} - the one open in the studio`] as [string, React.ReactNode]] : []),
    ...(s.title ? [["Title", s.title] as [string, React.ReactNode]] : []),
    ["URL key", <Box key="u" component="span" sx={{ ...mono, fontSize: "0.76rem" }}>{s.identifier}</Box>],
    ...(isNew ? [["Meta title", s.metaTitle || "-"], ["Meta description", s.metaDescription || "-"]] as [string, React.ReactNode][] : []),
    // a page of the shop's search engine fields (Content v6): only those set here change in Magento
    ...(!isNew && s.metaTitle ? [["Meta title", s.metaTitle] as [string, React.ReactNode]] : []),
    ...(!isNew && s.metaDescription ? [["Meta description", s.metaDescription] as [string, React.ReactNode]] : []),
    ...(!isNew && s.newIdentifier ? [["New URL key", <Box key="n" component="span"><Box component="span" sx={{ ...mono, fontSize: "0.76rem" }}>{s.newIdentifier}</Box> - the page moves; its old address stops working</Box>] as [string, React.ReactNode]] : []),
    ["Content", isNew
      ? `${kb(s.size)} of HTML - the page as the preview draws it${s.banners ? `, ${s.banners} banner${s.banners === 1 ? "" : "s"} in it` : ""}`
      : `Magento's content of the page, with ${s.changes} change${s.changes === 1 ? "" : "s"}${s.banners ? ` and ${s.banners} banner${s.banners === 1 ? "" : "s"}` : ""} put in place`],
    ...(isNew ? [["Shown", "On - visible on the shop at its address"] as [string, React.ReactNode]] : []),
    // the home page kit's frame (10.11.2026): one column, one Full Width row with one HTML Code element
    ...(isNew && s.layout ? [["Layout", "1 column - the content in one Full Width row, one HTML Code element, in line with the shop's breadcrumb"] as [string, React.ReactNode]] : []),
  ];
  return (
    <Box sx={{ mt: 0.75, mb: 0.5, p: 1.25, borderRadius: "8px", bgcolor: "#f6f8fb", border: `1px solid ${HAIRLINE}` }}>
      <Typography sx={{ fontSize: "0.68rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: MUTED, mb: 0.75 }}>What will be sent</Typography>
      {rows.map(([k, val]) => (
        <Box key={k} sx={{ display: "grid", gridTemplateColumns: "104px minmax(0,1fr)", gap: 1, py: 0.3 }}>
          <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{k}</Typography>
          <Typography component="div" sx={{ fontSize: "0.8rem", color: INK, overflowWrap: "anywhere" }}>{val}</Typography>
        </Box>
      ))}
      {envs.filter((e) => on.includes(e.env)).map((e) => {
        const p = plans[e.env]?.find((x) => x.view === v.view);
        const store = p && "store" in p && p.store ? ` · store ${p.store.code} (#${p.store.id})` : "";
        const now = p && "now" in p && p.now ? ` · now "${p.now.title}", ${kb(p.now.size)}${p.now.active ? "" : ", switched off"}` : "";
        const size = p && p.action === "update" && "size" in p ? ` → ${kb(p.size)}` : "";
        return (
          <Box key={e.env} sx={{ display: "grid", gridTemplateColumns: "104px minmax(0,1fr)", gap: 1, py: 0.3 }}>
            <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{e.label}</Typography>
            <Typography sx={{ fontSize: "0.8rem", color: INK, overflowWrap: "anywhere" }}>
              {e.base.replace(/^https:\/\//, "")}{v.path ?? ""}{e.key ? `${store}${now}${size}` : ""}
            </Typography>
          </Box>
        );
      })}
      {s.pictures.length > 0 && (s.pictures.every((p) => p.address) ? (
        <Typography sx={{ mt: 0.75, fontSize: "0.76rem", color: MUTED }}>
          {s.pictures.length} picture{s.pictures.length === 1 ? "" : "s"} of the hub, at {s.pictures.length === 1 ? "its" : "their"} address in the hub&apos;s picture storage ({s.pictures.map((p) => p.file).join(", ")}) - stored on Publish when {s.pictures.length === 1 ? "it is" : "they are"} not yet.
        </Typography>
      ) : (
        <Typography sx={{ mt: 0.75, fontSize: "0.76rem", color: MUTED }}>
          {s.pictures.length} picture{s.pictures.length === 1 ? "" : "s"} of the hub, at {s.pictures.length === 1 ? "its" : "their"} address in the shop&apos;s media (wysiwyg/content: {s.pictures.map((p) => p.file).join(", ")}) - Pictures, below, says whether Magento has {s.pictures.length === 1 ? "it" : "them"}.
        </Typography>
      ))}
      {isNew && <Button size="small" onClick={() => setHtml(!html)} sx={{ ...btn, px: 0, mt: 0.5, color: PINK, fontSize: "0.76rem" }}>{html ? "Hide the content's HTML" : "Show the content's HTML"}</Button>}
      {html && <HtmlOf api={api} view={v.view} />}
    </Box>
  );
}

/** The content's HTML, read on demand (it is the paste's "The page's content" block). */
function HtmlOf({ api, view }: { api: StudioApi; view: string }) {
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    let gone = false;
    void api.act<{ ok: boolean; blocks?: { key: string; code: string }[]; error?: string }>("paste", { lang: view }).then((r) => {
      if (gone) return;
      setCode(r.ok && r.result.ok ? r.result.blocks?.find((b) => b.key === "content")?.code ?? "" : "It could not be read.");
    });
    return () => { gone = true; };
    // once per store view (the studio's api is a new object at each render)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);
  return (
    <Box component="pre" sx={{ ...mono, fontSize: "0.7rem", m: 0, mt: 0.5, p: 1, maxHeight: 220, overflow: "auto", bgcolor: "#fff", border: `1px solid ${HAIRLINE}`, borderRadius: "6px", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
      {code === null ? "Reading…" : code.slice(0, 6000)}{code && code.length > 6000 ? "\n…" : ""}
    </Box>
  );
}

/** The connection to Magento (Content v6/v7: Connected / Refused / No key and "Check the connection") is gone - Content v11,
 * SARCLA 10.11.2026 on that box: "take out the connector check here - it makes no sense" (a check could only prove READ;
 * both shops have their key). Only a shop WITHOUT a key still says what an admin does, in three steps. */
export function Connection({ envs }: { api?: StudioApi; envs: EnvState[] }) {
  const noKey = envs.filter((e) => !e.key).map((e) => e.env);
  return noKey.length ? <NoKeySteps envs={noKey} /> : null;
}

/** The three steps an admin takes to give the hub its key - the Magento menu path as its own short steps. */
function NoKeySteps({ envs }: { envs: Env[] }) {
  const s = noKeySteps(envs);
  return (
    <Box sx={{ mx: 1.25, mb: 1, mt: 0.25, p: 1.25, borderRadius: "6px", bgcolor: "#f6f8fb", border: `1px solid ${HAIRLINE}` }}>
      <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: INK }}>{s.title}</Typography>
      <Box component="ol" sx={{ m: 0, mt: 0.5, pl: 2.25, display: "grid", gap: 0.5 }}>
        <Typography component="li" sx={{ fontSize: "0.78rem", color: INK, lineHeight: 1.45 }}>
          {s.steps[0]}
          <Box sx={{ mt: 0.4, display: "grid", gap: 0.2 }}>
            {s.path.map((x, i) => (
              <Box key={x} sx={{ display: "flex", gap: 0.75, alignItems: "baseline" }}>
                <Box component="span" sx={{ width: 14, flexShrink: 0, fontSize: "0.7rem", fontWeight: 700, color: MUTED, textAlign: "right" }}>{String.fromCharCode(97 + i)}</Box>
                <Box component="span" sx={{ ...mono, fontSize: "0.72rem", color: INK, overflowWrap: "anywhere" }}>{x}</Box>
              </Box>
            ))}
          </Box>
        </Typography>
        {s.steps.slice(1).map((x) => <Typography key={x} component="li" sx={{ fontSize: "0.78rem", color: INK, lineHeight: 1.45 }}>{x}</Typography>)}
      </Box>
      <Typography sx={{ mt: 0.6, fontSize: "0.76rem", color: MUTED }}>{s.ask}</Typography>
    </Box>
  );
}

const PIC_STATE: Record<PictureCheck["state"], { c: string; w: (target: string) => string }> = {
  there: { c: GREEN, w: () => "in Magento" },
  missing: { c: "#c5221f", w: (t) => `not in ${t}'s media` },
  unknown: { c: AMBER, w: () => "could not be read" },
};
/** The same in the hub's picture storage (11.11.2026): nothing to do by hand - Publish stores what is not stored yet. */
const HUB_STATE: Record<PictureCheck["state"], { c: string; w: string }> = {
  there: { c: GREEN, w: "stored" },
  missing: { c: BLUE, w: "goes to the hub's picture storage on Publish" },
  unknown: { c: AMBER, w: "could not be read - Publish stores it if it is missing" },
};

/** A new page's own pictures in the hub's picture storage (11.11.2026, SARCLA: "I can't copy-paste each new picture to
 * Magento"): ACC and production show the same files, so one box - each picture stored or to be stored, its address. */
function HubPictures({ envs, p, reading, onRead }: { envs: EnvState[]; p: PicturesOut; reading: Record<string, boolean>; onRead: (env: Env) => void }) {
  const left = p.list.filter((x) => x.state !== "there").length;
  const n = p.list.length;
  const busy = envs.some((e) => reading[e.env]);
  return (
    <>
      <Kick>Pictures</Kick>
      <Box sx={{ mb: 1, p: 1.25, borderRadius: "10px", border: `1px solid ${HAIRLINE}`, bgcolor: "#fff" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography sx={{ flex: 1, fontSize: "0.8rem", fontWeight: 700, color: INK }}>
            {!left ? `${n === 1 ? "Its picture is" : `All ${n} pictures are`} stored in the hub's picture storage.`
              : `${left === n ? (n === 1 ? "Its picture goes" : `Its ${n} pictures go`) : `${left} of ${n} pictures go`} to the hub's picture storage on Publish - nothing to upload by hand.`}
          </Typography>
          <Button size="small" onClick={() => { for (const e of envs) onRead(e.env); }} disabled={busy} startIcon={busy ? <CircularProgress size={12} /> : <RefreshIcon sx={{ fontSize: 15 }} />}
            sx={{ ...btn, color: MUTED, px: 0.5, py: 0, fontSize: "0.74rem", minWidth: 0, flexShrink: 0 }}>Read again</Button>
        </Box>
        <Box sx={{ mt: 0.75, display: "grid", gap: 0.4 }}>
          {p.list.map((x) => (
            <Box key={x.file} sx={{ display: "flex", alignItems: "baseline", gap: 1, minWidth: 0, flexWrap: "wrap" }}>
              <Box component="span" sx={{ ...mono, fontSize: "0.74rem", color: INK, minWidth: 0, overflowWrap: "anywhere" }}>{x.file}</Box>
              <Box component="span" sx={{ fontSize: "0.72rem", fontWeight: 700, color: HUB_STATE[x.state].c, flexShrink: 0 }}>{HUB_STATE[x.state].w}</Box>
              {x.address && <Box component="a" href={x.address} target="_blank" rel="noopener noreferrer" sx={{ ...mono, fontSize: "0.68rem", color: MUTED, minWidth: 0, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>{x.address.replace(/^https:\/\//, "")}</Box>}
            </Box>
          ))}
        </Box>
      </Box>
    </>
  );
}

/**
 * A new page's own pictures in each target's media (10.11.2026 - SARCLA's Kalrez page showed Magento's grey placeholder
 * in its hero: its picture was never uploaded, and one line said so). Read with the plan, each by its address on the
 * shop; a missing one holds Publish, with the pictures to download (one zip), the Media Gallery's steps and "Read Magento
 * again".
 */
function Pictures({ envs, pics, reading, onRead, title }: {
  envs: EnvState[]; pics: Record<string, PicturesOut | undefined>; reading: Record<string, boolean>; onRead: (env: Env) => void; title: string;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const shown = envs.filter((e) => e.key && (pics[e.env]?.list.length ?? 0) > 0);
  // the hub's picture storage (11.11.2026): one box for every target - the same files, nothing held
  const hub = shown.find((e) => pics[e.env]?.storage === "hub");
  if (!shown.length) return null;
  if (hub) return <HubPictures envs={shown} p={pics[hub.env]!} reading={reading} onRead={onRead} />;
  const download = async (e: EnvState, list: PictureCheck[]) => {
    setBusy(e.env); setSaid(null);
    const files: FileOut[] = [];
    const lost: string[] = [];
    for (const p of list) {
      try {
        const r = await fetch(p.url);
        if (!r.ok) throw new Error(String(r.status));
        const b = await r.blob();
        files.push({ name: p.file, data: b, type: b.type || "image/jpeg" });
      } catch { lost.push(p.file); }
    }
    const saved = await saveFiles(files, `${fileStem(title)}-pictures-${e.env}.zip`);
    setBusy(null);
    setSaid(lost.length ? `The hub could not hand over ${lost.join(", ")}.` : saved ? `${saved.files === 1 ? files[0].name : `${saved.name} (${saved.files} pictures)`} - in your downloads.` : null);
  };
  return (
    <>
      <Kick>Pictures</Kick>
      {shown.map((e) => {
        const p = pics[e.env]!;
        const missing = p.list.filter((x) => x.state === "missing");
        return (
          <Box key={e.env} sx={{ mb: 1, p: 1.25, borderRadius: "10px", border: `1px solid ${p.hold ? "#f1c4c0" : HAIRLINE}`, bgcolor: p.hold ? "#fff6f5" : "#fff" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography component="div" sx={{ flex: 1, fontSize: "0.8rem", fontWeight: 700, color: INK }}>{e.label}: {p.hold ?? picturesHold(p.list, e.label) ?? `${p.list.length === 1 ? "its picture is" : `all ${p.list.length} pictures are`} in Magento's media.`}
                {p.note && <Box component="span" sx={{ display: "block", fontWeight: 500, fontSize: "0.74rem", color: MUTED }}>{p.note} Here they go to Magento&apos;s media as before.</Box>}
              </Typography>
              <Button size="small" onClick={() => onRead(e.env)} disabled={!!reading[e.env]} startIcon={reading[e.env] ? <CircularProgress size={12} /> : <RefreshIcon sx={{ fontSize: 15 }} />}
                sx={{ ...btn, color: MUTED, px: 0.5, py: 0, fontSize: "0.74rem", minWidth: 0, flexShrink: 0 }}>Read Magento again</Button>
            </Box>
            <Box sx={{ mt: 0.75, display: "grid", gap: 0.4 }}>
              {p.list.map((x) => (
                <Box key={x.file} sx={{ display: "flex", alignItems: "baseline", gap: 1, minWidth: 0 }}>
                  <Box component="span" sx={{ ...mono, fontSize: "0.74rem", color: INK, flexShrink: 0 }}>{x.file}</Box>
                  <Box component="span" sx={{ fontSize: "0.72rem", fontWeight: 700, color: PIC_STATE[x.state].c, flexShrink: 0 }}>{PIC_STATE[x.state].w(e.label)}</Box>
                  {x.address && <Box component="a" href={x.address} target="_blank" rel="noopener noreferrer" sx={{ ...mono, fontSize: "0.68rem", color: MUTED, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>{x.address.replace(/^https:\/\//, "")}</Box>}
                </Box>
              ))}
            </Box>
            {missing.length > 0 && (
              <>
                <Box component="ol" sx={{ m: 0, mt: 1, pl: 2.25, display: "grid", gap: 0.35 }}>
                  {mediaGallerySteps(e.label, missing.map((x) => x.file)).map((s) => <Typography key={s} component="li" sx={{ fontSize: "0.78rem", color: INK, lineHeight: 1.45 }}>{s}</Typography>)}
                </Box>
                <Button size="small" variant="outlined" disabled={busy === e.env} onClick={() => void download(e, missing)}
                  startIcon={busy === e.env ? <CircularProgress size={12} color="inherit" /> : undefined}
                  sx={{ ...btn, mt: 1, height: 34, borderRadius: "8px", borderColor: HAIRLINE, color: INK }}>
                  {missing.length === 1 ? "Download the picture" : `Download the pictures (one zip, ${missing.length})`}
                </Button>
              </>
            )}
          </Box>
        );
      })}
      {said && <Typography sx={{ fontSize: "0.76rem", color: MUTED, mb: 0.5 }}>{said}</Typography>}
    </>
  );
}

const dayWords = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Publish now - or only put it on the content calendar (SARCLA 10.11.2026: "you should be able to publish or only send to
 * the content calendar"): its day on the calendar and nothing written to Magento; its ticket goes to Ready to roll
 * (lib/content/ticketMoves.ts). On its day it is published from here. */
function OrCalendar({ api }: { api: StudioApi }) {
  const due = api.data.piece.dueDate ?? "";
  const [day, setDay] = useState(due);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { setDay(due); }, [due]);
  const put = async () => {
    if (!day) return;
    setBusy(true);
    setSaid(null);
    const r = await api.edit({ dueDate: day });
    setBusy(false);
    setSaid(r.ok ? { ok: true, text: `On the content calendar for ${dayWords(day)} - nothing written to Magento. Its ticket goes to Ready to roll.` } : { ok: false, text: r.error ?? "Not put on the calendar." });
  };
  return (
    <Box sx={{ mt: 1.5, p: 1.25, borderRadius: "8px", border: `1px dashed ${HAIRLINE}`, bgcolor: "#fff" }}>
      <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: INK }}>Or only put it on the content calendar</Typography>
      <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 0.25 }}>
        {due ? `It is on the calendar for ${dayWords(due)}. ` : ""}Nothing goes to Magento - it waits for its day, and is published from here then.
      </Typography>
      <Box sx={{ display: "flex", gap: 1, mt: 1, alignItems: "center", flexWrap: "wrap" }}>
        <TextField type="date" size="small" value={day} onChange={(e) => setDay(e.target.value)} label="Its day"
          slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 180, "& .MuiInputBase-input": { fontSize: "0.84rem" } }} />
        <Button size="small" variant="outlined" disabled={!day || busy || day === due} onClick={() => void put()}
          startIcon={busy ? <CircularProgress size={12} color="inherit" /> : undefined}
          sx={{ ...btn, height: 38, borderRadius: "8px", borderColor: HAIRLINE, color: INK }}>
          {due && day === due ? "On the calendar" : due ? "Move it to this day" : "Put it on the calendar"}
        </Button>
      </Box>
      {said && <Typography sx={{ mt: 0.75, fontSize: "0.78rem", color: said.ok ? GREEN : "#c5221f" }}>{said.text}</Typography>}
    </Box>
  );
}


/** A page's addresses on a shop as links, each its store view (a new tab). */
function PageLinks({ pages }: { pages: LivePage[] }) {
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: 0.25, rowGap: 0.25 }}>
      {pages.map((p, i) => (
        <Box key={p.store} component="span" sx={{ display: "inline-flex", alignItems: "center" }}>
          {i > 0 && <Box component="span" sx={{ color: MUTED, px: 0.5 }}>·</Box>}
          <Box component="a" href={p.url} target="_blank" rel="noopener noreferrer" title={`${p.url}${p.pageId ? ` · Magento page #${p.pageId}` : ""}`}
            sx={{ color: BLUE, fontWeight: 700, fontSize: "0.8rem", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 0.25, "&:hover": { textDecoration: "underline" } }}>
            {p.store}<OpenInNewIcon sx={{ fontSize: 11 }} />
          </Box>
        </Box>
      ))}
    </Box>
  );
}

/** What a write said, each store view's page on that shop a link (Content v12, SARCLA: "if already created I should have the link"). */
function ResultList({ env, results, records, retry }: {
  env: Env; results: Result[]; records?: MagentoRecord[];
  /** Content v14b (SARCLA 11.11.2026, 15:35): the pages that failed, written again - those only, never all */
  retry?: { views: string[]; label: string; busy: boolean; onRetry: () => void } | null;
}) {
  return (
    <>
      {results.map((r, i) => {
        const mine = (records ?? []).filter((x) => x.env === env && (r.stores?.length ? r.stores.includes(x.store) : x.store === r.view));
        const pages = liveOn(mine, env);
        return (
          <Box key={`${r.view || "all"}-${i}`} sx={{ py: 0.25 }}>
            <Typography sx={{ fontSize: "0.8rem", color: r.ok ? GREEN : "#c5221f" }}>
              {r.view ? `${r.view}: ` : ""}{r.ok ? `${r.action === "created" ? "created" : "updated"} on ${SHOP_LABEL[env]} (page #${r.pageId})${pages.length > 1 ? ` in ${pages.length} store views` : ""}${r.note ? ` - ${r.note}` : ""}` : readableError(r.error).text}
            </Typography>
            {r.ok && pages.length > 0 && <Box sx={{ mt: 0.25 }}><PageLinks pages={pages} /></Box>}
          </Box>
        );
      })}
      {retry && retry.views.length > 0 && (
        <Box sx={{ mt: 0.75, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Button size="small" variant="outlined" disabled={retry.busy} onClick={retry.onRetry}
            startIcon={retry.busy ? <CircularProgress size={12} color="inherit" /> : <RefreshIcon sx={{ fontSize: 15 }} />}
            sx={{ ...btn, height: 32, borderRadius: "8px", borderColor: HAIRLINE, color: INK, bgcolor: "#fff" }}>
            Try again - {retry.views.length === 1 ? "the page that failed" : `the ${retry.views.length} pages that failed`}
          </Button>
          <Typography component="span" sx={{ fontSize: "0.74rem", color: MUTED }}>{retry.label} - the pages written stay as they are.</Typography>
        </Box>
      )}
    </>
  );
}

const STATE_TONE: Record<RowState, string> = { changed: AMBER, same: GREEN, on: GREEN, none: MUTED };

/** A small squared tick with its words. */
function Tick({ on, onClick, children, disabled }: { on: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <Box component="button" type="button" aria-pressed={on} disabled={disabled} onClick={onClick}
      sx={{ all: "unset", cursor: disabled ? "default" : "pointer", display: "inline-flex", alignItems: "center", gap: 0.6, fontSize: "0.76rem", color: disabled ? "#b3bccb" : INK, "&:focus-visible": { outline: `2px solid ${BLUE}`, outlineOffset: 2 } }}>
      <Box component="span" sx={{ width: 14, height: 14, borderRadius: "3px", border: `1.5px solid ${on ? BLUE : "#9aa5b8"}`, bgcolor: on ? BLUE : "#fff", display: "grid", placeItems: "center", boxSizing: "border-box", flexShrink: 0 }}>
        {on && <CheckIcon sx={{ fontSize: 11, color: "#fff" }} />}
      </Box>
      {children}
    </Box>
  );
}

/** The page's pictures as a compact grid (Content v14, SARCLA 11.11.2026: "pictures should be a new tab"): each its
 * thumbnail, its file, stored or stored on Publish, its address - the hub's picture storage, the same for ACC and production. */
function PictureGrid({ envs, p, reading, onRead }: { envs: EnvState[]; p: PicturesOut; reading: Record<string, boolean>; onRead: (env: Env) => void }) {
  const left = p.list.filter((x) => x.state !== "there").length;
  const n = p.list.length;
  const busy = envs.some((e) => reading[e.env]);
  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <Typography sx={{ flex: 1, fontSize: "0.82rem", fontWeight: 700, color: INK }}>
          {!left ? `${n === 1 ? "Its picture is" : `All ${n} pictures are`} stored in the hub's picture storage.`
            : `${left === n ? (n === 1 ? "Its picture goes" : `Its ${n} pictures go`) : `${left} of ${n} pictures go`} to the hub's picture storage on Publish - nothing to upload by hand.`}
        </Typography>
        <Button size="small" onClick={() => { for (const e of envs) onRead(e.env); }} disabled={busy} startIcon={busy ? <CircularProgress size={12} /> : <RefreshIcon sx={{ fontSize: 15 }} />}
          sx={{ ...btn, color: MUTED, px: 0.5, py: 0, fontSize: "0.74rem", minWidth: 0, flexShrink: 0 }}>Read again</Button>
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(176px, 1fr))", gap: 1 }}>
        {p.list.map((x) => (
          <Box key={x.file} sx={{ borderRadius: "8px", border: `1px solid ${HAIRLINE}`, bgcolor: "#fff", overflow: "hidden", minWidth: 0 }}>
            <Box sx={{ aspectRatio: "16 / 9", bgcolor: "#eef1f6", display: "grid", placeItems: "center", overflow: "hidden" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={x.url} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </Box>
            <Box sx={{ p: 0.75 }}>
              <Typography title={x.file} sx={{ ...mono, fontSize: "0.7rem", color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.file}</Typography>
              <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: HUB_STATE[x.state].c, lineHeight: 1.35, mt: 0.25 }}>{HUB_STATE[x.state].w}</Typography>
              {x.views.length > 0 && <Typography sx={{ fontSize: "0.68rem", color: MUTED, mt: 0.25 }}>{x.views.join(", ")}</Typography>}
              {x.address && (
                <Box component="a" href={x.address} target="_blank" rel="noopener noreferrer" title={x.address}
                  sx={{ display: "flex", alignItems: "center", gap: 0.25, mt: 0.25, color: BLUE, fontSize: "0.68rem", fontWeight: 700, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
                  Its address<OpenInNewIcon sx={{ fontSize: 11 }} />
                </Box>
              )}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export function ToMagento({ api, doc, d, setView, canEdit, lang, initial, abPart, section: start }: {
  api: StudioApi; doc: PageDoc; d: PageDoc; setView: (next: PageDoc) => void; canEdit: boolean; lang: string;
  /** what Magento was read to say (a static check draws the step with it) */
  initial?: { status: Status; plans: Record<string, PlanOut[]>; pictures?: Record<string, PicturesOut> };
  /** the A/B test's plan (Sections.tsx AbLastStep, from the top bar): in the A/B test section */
  abPart?: React.ReactNode;
  /** the section first shown (a static check opens each) */
  section?: PubSection;
}) {
  const [status, setStatus] = useState<Status | null>(initial?.status ?? null);
  const [pics, setPics] = useState<Record<string, PicturesOut>>(initial?.pictures ?? {});
  const [err, setErr] = useState<string | null>(null);
  const [on, setOn] = useState<Env[]>(["acc"]);
  const [picked, setPicked] = useState<string[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [plans, setPlans] = useState<Record<string, PlanOut[]>>(initial?.plans ?? {});
  const [reading, setReading] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [said, setSaid] = useState<{ env: Env; results: Result[]; records?: MagentoRecord[] } | null>(null);
  const [handOver, setHandOver] = useState(false);
  // Content v14b: "Where it goes" (Setup's ticks and targets) folded under Pages
  const [where, setWhere] = useState(false);
  // Content v14: the publishing view's sections - the A/B test first when the top bar opened the step on it
  const abFirst = useAbLit(abPart, () => setSection("ab"));
  const [section, setSection] = useState<PubSection>(start ?? (abFirst ? "ab" : "pages"));
  const [all, setAll] = useState<Record<Env, boolean>>({ acc: false, prod: false });
  const [run, setRun] = useState<{ env: Env; line: string; results: Result[]; records: MagentoRecord[]; done: boolean } | null>(null);
  const madeKey = viewsOf(doc).join(",");
  // the studio's api is a new object at each render: the reads below hold the latest one
  const apiRef = useRef(api);
  apiRef.current = api;

  const load = useCallback(async () => {
    setErr(null);
    const r = await apiRef.current.act<Status>("magento");
    if (!r.ok) { setErr(r.error); return; }
    setStatus(r.result);
  }, []);
  // the store views each version goes to: a tick changed in the panel reads Magento again
  const storesKey = (status?.views ?? []).map((v) => (v.stores ?? []).map((x) => x.view).join("+")).join(",");
  useEffect(() => { void load(); }, [load, madeKey]);

  const cmsViews = useMemo(() => (status?.views ?? []).filter((v) => v.cms && !v.why), [status]);
  // a page with versions (A, B ...): the one open is the one written - said once, above the store views
  const multi = versionList(d).length > 1;
  const sel = picked ?? cmsViews.map((v) => v.view);
  const envs = status?.envs ?? [];

  const read = useCallback(async (env: Env, views: string[]) => {
    if (!views.length) return;
    setReading((x) => ({ ...x, [env]: true }));
    const r = await apiRef.current.act<{ env: Env; plans: PlanOut[]; waiting: string | null; pictures?: PicturesOut }>("magento_plan", { env, views });
    setReading((x) => ({ ...x, [env]: false }));
    if (r.ok) {
      setPlans((p) => ({ ...p, [env]: r.result.plans }));
      setPics((p) => ({ ...p, [env]: r.result.pictures ?? { list: [], hold: null } }));
    }
  }, []);
  // Magento read for each target that has its key - what a write would do, nothing written
  const selKey = sel.join(",");
  useEffect(() => {
    for (const e of envs) if (on.includes(e.env) && e.key) void read(e.env, sel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on.join(), selKey, storesKey, envs.map((e) => e.key).join()]);

  const toggleEnv = (e: Env) => setOn((cur) => (cur.includes(e) ? cur.filter((x) => x !== e) : [...cur, e].sort()));
  const toggleView = (v: string) => setPicked((cur) => { const base = cur ?? cmsViews.map((x) => x.view); return base.includes(v) ? base.filter((x) => x !== v) : [...base, v]; });

  const publish = async (env: EnvState) => {
    const views = sel.filter((v) => {
      const p = plans[env.env]?.find((x) => x.view === v);
      return !p || p.action !== "none" || doc.source !== "new";
    });
    if (!views.length) return;
    const said0 = views.map((v) => status?.views.find((x) => x.view === v)?.label ?? v).join(", ");
    if (!window.confirm(`Write ${said0} into Magento ${env.label}? Each page is backed up first, and can be brought back as it was.`)) return;
    setBusy(`publish:${env.env}`); setSaid(null);
    const r = await api.act<{ env: Env; results: Result[]; records: MagentoRecord[] }>("magento_publish", { env: env.env, views });
    setBusy(null);
    if (!r.ok) { setSaid({ env: env.env, results: [{ view: "", ok: false, error: r.error }] }); return; }
    setSaid(r.result);
    await api.reload();
    await load();
    void read(env.env, sel);
  };
  /** Write pages into one shop, each in turn - one progress line, then each one's result; a refusal of the first (the
   * review, the key, ACC first) stops the rest. "Update all" (Content v14) and "Try again" (v14b) both. */
  const writeEach = async (env: EnvState, views: string[]) => {
    const label = (v: string) => status?.views.find((x) => x.view === v)?.label ?? v;
    setBusy(`all:${env.env}`); setSaid(null);
    const results: Result[] = [];
    const records: MagentoRecord[] = [];
    for (let i = 0; i < views.length; i++) {
      const v = views[i];
      setRun({ env: env.env, line: progressLine(label(v), env.label, i + 1, views.length), results: [...results], records: [...records], done: false });
      const r = await api.act<{ env: Env; results: Result[]; records: MagentoRecord[] }>("magento_publish", { env: env.env, views: [v] });
      if (!r.ok) { results.push({ view: v, ok: false, error: r.error }); if (i === 0) break; continue; }
      results.push(...r.result.results);
      records.push(...r.result.records);
    }
    const okN = results.filter((r) => r.ok).length;
    setRun({ env: env.env, line: `${okN} of ${results.length} written into ${env.label}${okN < results.length ? ` - ${results.length - okN} not` : ""}.`, results, records, done: true });
    setBusy(null);
    await api.reload();
    await load();
    if (on.includes(env.env)) void read(env.env, sel);
  };
  /** "Update all on ACC (n pages)" (Content v14, SARCLA 11.11.2026: "in one click update them all"). */
  const updateAll = async (env: EnvState, plan: UpdateAll) => {
    if (!plan.views.length || plan.why) return;
    const label = (v: string) => status?.views.find((x) => x.view === v)?.label ?? v;
    if (!window.confirm(`${plan.verb} ${plan.views.map(label).join(", ")} on Magento ${env.label} - ${plan.storeViews} store view${plan.storeViews === 1 ? "" : "s"}? Each page is backed up first, and can be brought back as it was.`)) return;
    await writeEach(env, plan.views);
  };
  /** "Try again" (Content v14b, SARCLA 11.11.2026, 15:35): only the pages that failed, written again the same way. */
  const retryFailed = async (envKey: Env, views: string[]) => {
    const env = envs.find((e) => e.env === envKey);
    if (!env || !views.length) return;
    const label = (v: string) => status?.views.find((x) => x.view === v)?.label ?? v;
    if (!window.confirm(`Write ${views.map(label).join(", ")} into Magento ${env.label} again? Only these - the pages written stay as they are. Each is backed up first.`)) return;
    await writeEach(env, views);
  };
  const restore = async (rec: MagentoRecord) => {
    const env = envs.find((e) => e.env === rec.env);
    if (!env || !window.confirm(`Bring the ${rec.store} page on ${env.label} back as it was before this to-do wrote it? ${rec.action === "created" ? "It was made by this to-do: it is switched off (not deleted)." : "Its content before the write is put back."}`)) return;
    setBusy(`restore:${rec.env}:${rec.store}`);
    const r = await api.act("magento_restore", { env: rec.env, view: rec.store });
    setBusy(null);
    if (!r.ok) { window.alert(r.error); return; }
    await api.reload();
    await load();
  };

  // the newest record per environment and store view
  const latest = useMemo(() => {
    const m = new Map<string, MagentoRecord>();
    for (const r of doc.magento) if (!m.has(`${r.env}|${r.store}`)) m.set(`${r.env}|${r.store}`, r);
    return m;
  }, [doc.magento]);
  const rows = useMemo(() => pageRows(status?.views ?? [], doc.magento), [status, doc.magento]);

  if (err) return <Typography sx={{ fontSize: "0.84rem", color: "#c5221f" }}>{err} <Button size="small" onClick={() => void load()} sx={{ ...btn, color: INK }}>Try again</Button></Typography>;
  if (!status) return <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: MUTED, fontSize: "0.84rem", py: 2 }}><CircularProgress size={14} /> Reading the page&apos;s store views…</Box>;

  // not a CMS page at all (a category, a product, the home page): the hand-over, said in one line
  const notCms = status.views.find((v) => !v.cms);
  if (!cmsViews.length && notCms) {
    return (
      <Box>
        <Typography sx={{ fontSize: "0.86rem", color: INK, mb: 1.25 }}>{notCms.why ?? "This page is not a CMS page."} The hub does not write it into Magento - its change list is the hand-over for dotSource, below.</Typography>
        <HandOver api={api} d={d} set={setView} canEdit={canEdit} lang={lang} />
        <Connection api={api} envs={envs} />
      </Box>
    );
  }

  const gateWhy = status.gate.why;
  const accLive = liveOn(doc.magento, "acc").length > 0;
  // a new page's own pictures not in a shop's media yet (the picture storage off): every write there waits
  const picHoldOf = (env: Env) => (doc.source === "new" && pics[env]?.storage !== "hub" ? pics[env]?.hold ?? null : null);
  const picsShown = envs.filter((e) => e.key && on.includes(e.env) && (pics[e.env]?.list.length ?? 0) > 0);
  const picHub = picsShown.find((e) => pics[e.env]?.storage === "hub");
  const picCount = picsShown.length ? pics[picsShown[0].env]!.list.length : 0;
  const prefer = [lang, d.store, ...viewsOf(doc)];
  /** "Try again" for a run's failed pages only (Content v14b): which, said by their language */
  const retryOf = (env: Env, results: Result[]) => {
    const views = retryViews(results, rows);
    return { views, label: `${env === "acc" ? "ACC" : "Production"}: ${views.map((v) => rows.find((r) => r.view === v)?.label.split(" · ")[0] ?? v).join(", ")}`, busy: !!busy, onRetry: () => void retryFailed(env, views) };
  };

  /* ── Pages: the current links, and "Update all" on each shop ── */
  /* ── Pictures ── */
  const picturesPart = doc.source !== "new" ? (
    <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>A page of the shop keeps its own pictures - the hub adds none to it.</Typography>
  ) : picHub ? (
    <PictureGrid envs={picsShown} p={pics[picHub.env]!} reading={reading} onRead={(env) => void read(env, sel)} />
  ) : picsShown.length ? (
    <Pictures envs={envs.filter((e) => on.includes(e.env))} pics={pics} reading={reading} onRead={(env) => void read(env, sel)} title={api.data.piece.title} />
  ) : (
    <Typography sx={{ fontSize: "0.82rem", color: MUTED, display: "flex", alignItems: "center", gap: 1 }}>
      {Object.values(reading).some(Boolean) ? <><CircularProgress size={12} /> Reading the pictures…</> : "The page has no pictures of its own."}
    </Typography>
  );

  /* ── Where it goes (Content v14b, Setup folded into Pages): the shops to write, the store views ticked per language with
   *    what Magento does in each, and the publish buttons for the ticked ones ── */
  const whereItGoes = (
    <Box sx={{ mt: 2, borderTop: `1px solid ${HAIRLINE}`, pt: 1 }}>
      <Button size="small" onClick={() => setWhere(!where)} aria-expanded={where}
        endIcon={<KeyboardArrowDownIcon sx={{ transform: where ? "none" : "rotate(-90deg)", transition: "transform .15s" }} />}
        sx={{ ...btn, color: INK, px: 0.5 }}>Where it goes</Button>
      <Hint mt={0}>The shops to write, the store views ticked per language with what Magento does in each, and Publish for the ticked ones.</Hint>
      <Collapse in={where} unmountOnExit>
        <Kick>Where to</Kick>
        <Targets envs={envs} on={on} onToggle={toggleEnv} />
        {/* a page of ACC is written to ACC (Content v8, point 7 - the server offers ACC alone for it) */}
        {doc.source !== "new" && doc.env === "acc" && <Typography sx={{ mt: 0.75, fontSize: "0.78rem", color: MUTED }}>This to-do works on ACC&apos;s page - it is written to ACC.</Typography>}

        <Kick right={envs.some((e) => on.includes(e.env) && e.key) ? (
          <Button size="small" onClick={() => { for (const e of envs) if (on.includes(e.env) && e.key) void read(e.env, sel); }} startIcon={<RefreshIcon sx={{ fontSize: 15 }} />}
            sx={{ ...btn, color: MUTED, px: 0.5, py: 0, fontSize: "0.74rem", minWidth: 0 }}>Read Magento again</Button>
        ) : undefined}>
          {doc.source === "new" ? "Pages" : "Languages"} · {sel.length} of {cmsViews.length} · {cmsViews.filter((v) => sel.includes(v.view)).reduce((n, v) => n + (v.stores?.length ?? 1), 0)} store views
        </Kick>
        <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "10px", bgcolor: "#fff", overflow: "hidden" }}>
          {status.views.map((v, i) => {
            const can = v.cms && !v.why;
            const chosen = can && sel.includes(v.view);
            const isOpenRow = open === v.view;
            return (
              <Box key={v.view} sx={{ borderTop: i ? `1px solid ${HAIRLINE}` : "none", px: 1.25, py: 1 }}>
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                  <Box component="button" type="button" disabled={!can} aria-pressed={chosen} aria-label={`Write ${v.view}`} onClick={() => toggleView(v.view)} sx={{
                    all: "unset", cursor: can ? "pointer" : "default", mt: 0.25, width: 15, height: 15, borderRadius: "3px", boxSizing: "border-box", flexShrink: 0,
                    border: `1.5px solid ${chosen ? BLUE : "#9aa5b8"}`, bgcolor: chosen ? BLUE : "#fff", display: "grid", placeItems: "center", opacity: can ? 1 : 0.4,
                    "&:focus-visible": { outline: `2px solid ${BLUE}`, outlineOffset: 2 },
                  }}>{chosen && <CheckIcon sx={{ fontSize: 12, color: "#fff" }} />}</Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box component="button" type="button" onClick={() => setOpen(isOpenRow ? null : v.view)} sx={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 0.75, width: "100%" }}>
                      <Typography sx={{ fontSize: "0.82rem", fontWeight: 800, color: INK, letterSpacing: ".02em", whiteSpace: "nowrap" }}>{v.label ?? v.view}</Typography>
                      <Typography sx={{ ...mono, flex: 1, minWidth: 0, fontSize: "0.76rem", color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.sent?.identifier ?? v.path ?? ""}</Typography>
                      {v.sent && <KeyboardArrowDownIcon sx={{ fontSize: 18, color: MUTED, transform: isOpenRow ? "none" : "rotate(-90deg)", transition: "transform .15s" }} />}
                    </Box>
                    {v.why && <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 0.25 }}>{v.why}</Typography>}
                    {can && v.blocked && <Typography sx={{ fontSize: "0.76rem", color: AMBER, mt: 0.25 }}>{v.blocked}</Typography>}
                    {/* its store views, as Magento's Store View lists them - what the write does in each (the first target's) */}
                    {(v.stores?.length ?? 0) > 0 && <StoreChips v={v} plan={plans[envs.find((e) => on.includes(e.env) && e.key)?.env ?? "acc"]?.find((x) => x.view === v.view && isShared(x))} />}
                    {can && envs.filter((e) => on.includes(e.env)).map((e) => {
                      const line = doc.source === "new" || !v.stores ? planLine(plans[e.env]?.find((x) => x.view === v.view), e) : pickLine(plans[e.env] ?? [], v.stores.map((x) => x.view), e);
                      return (
                        <Typography key={e.env} sx={{ fontSize: "0.76rem", mt: 0.25, color: line.tone === "ok" ? GREEN : line.tone === "off" ? "#a14b12" : MUTED, display: "flex", gap: 0.5 }}>
                          <Box component="span" sx={{ fontWeight: 700, color: INK, flexShrink: 0 }}>{e.label}:</Box>
                          <Box component="span" sx={{ minWidth: 0 }}>{reading[e.env] && e.key ? "reading Magento…" : line.text}</Box>
                        </Typography>
                      );
                    })}
                    <Collapse in={isOpenRow} unmountOnExit><WhatIsSent api={api} v={v} envs={envs} plans={plans} on={on} /></Collapse>
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Box>
        <Hint mt={0.75}>{doc.source === "new" ? "One page per language, written into every store view ticked - Magento keeps one copy of it in each. A click on a row shows the exact page Magento gets; nothing is written until you press Publish." : "The changes go into the page of each store view the language goes to. A click on a row shows what Magento gets; nothing is written until you press Publish."}</Hint>

        <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 1 }}>
          {envs.filter((e) => on.includes(e.env)).map((e, i) => {
            const writable = sel.filter((v) => { const p = plans[e.env]?.find((x) => x.view === v); return doc.source !== "new" ? true : p && p.action !== "none"; });
            // a new page's own pictures not in this shop's media yet: Publish waits (the Pictures section)
            const picHold = picHoldOf(e.env);
            const why = e.why ?? (!sel.length ? "Pick at least one store view." : !reading[e.env] && plans[e.env] && !writable.length ? "Nothing to write here - see each store view above." : picHold ? "Its pictures first - upload them to Magento's media (Pictures), then Read Magento again." : null);
            const blocked = cmsViews.filter((v) => sel.includes(v.view) && v.blocked).length;
            const off = !!why || !!busy || !!reading[e.env] || !!blocked;
            // the review or the grant is said once, at the top; the key, per target
            const say = why && why !== gateWhy && why !== e.waiting ? why : null;
            // already on this shop (Content v12, SARCLA 10.11.2026: "update current pages after changes here"): changed since?
            const since = cmsViews.filter((v) => sel.includes(v.view)).map((v) => v.since?.[e.env]).filter((x): x is Since => !!x);
            const changed = since.some((x) => x.changed);
            const sinceAt = since.map((x) => x.at).sort().at(-1) ?? null;
            const sincePages = since.reduce((n, x) => n + x.pages, 0);
            const shopPages = writable.reduce((n, v) => { const p = plans[e.env]?.find((x) => x.view === v && isShared(x)); return n + (isShared(p) ? p.storeIds.length : status.views.find((x) => x.view === v)?.stores?.length ?? 1); }, 0);
            const verb = since.length ? `Update on ${e.env === "acc" ? "ACC" : "production"}` : `Publish to ${e.env === "acc" ? "ACC" : "production"}`;
            return (
              <Box key={e.env}>
                {since.length > 0 && (
                  <Typography sx={{ mb: 0.6, fontSize: "0.78rem", fontWeight: changed ? 700 : 500, color: changed ? AMBER : GREEN }}>
                    {changed
                      ? `Changed since the publish on ${e.label}${sinceAt ? ` (${when(sinceAt)})` : ""} - update the ${sincePages} page${sincePages === 1 ? "" : "s"}.`
                      : `On ${e.label} as it is here (${sinceAt ? when(sinceAt) : "published"}) - nothing changed since.`}
                  </Typography>
                )}
                <Button fullWidth variant={i === 0 ? "contained" : "outlined"} disableElevation disabled={off} onClick={() => void publish(e)}
                  startIcon={busy === `publish:${e.env}` ? <CircularProgress size={14} color="inherit" /> : undefined}
                  sx={i === 0 ? { ...mainBtn, height: 42, borderRadius: "8px" } : { ...btn, height: 42, borderRadius: "8px", borderColor: HAIRLINE, color: INK }}>
                  {busy === `publish:${e.env}` ? `Writing into ${e.label}…` : `${verb}${writable.length && !why ? ` · ${writable.length === 1 ? "1 page" : `${writable.length} pages`} for ${shopPages} store views` : ""}`}
                </Button>
                {(say || blocked > 0) && <Typography sx={{ mt: 0.5, fontSize: "0.76rem", color: MUTED }}>{say ?? `${blocked} store view${blocked === 1 ? " has" : "s have"} words to finish first.`}</Typography>}
              </Box>
            );
          })}
          {!on.length && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>Pick ACC, production or both above.</Typography>}
        </Box>
        {said && (
          <Box sx={{ mt: 1.25, p: 1.25, borderRadius: "8px", bgcolor: "#f6f8fb", border: `1px solid ${HAIRLINE}` }}>
            <ResultList env={said.env} results={said.results} records={said.records}
              retry={retryOf(said.env, said.results)} />
          </Box>
        )}
      </Collapse>
    </Box>
  );

  /* ── the hand-over (what to copy by hand, the notes), at the foot of Pages ── */
  const handOverPart = (
    <>
      <Box sx={{ mt: 2.5, borderTop: `1px solid ${HAIRLINE}`, pt: 1.25 }}>
        <Button size="small" onClick={() => setHandOver(!handOver)} endIcon={<KeyboardArrowDownIcon sx={{ transform: handOver ? "none" : "rotate(-90deg)", transition: "transform .15s" }} />}
          sx={{ ...btn, color: INK, px: 0.5 }}>The hand-over · {lang}</Button>
        <Hint mt={0}>What to copy in by hand, the pictures to upload, and the notes for whoever puts it live.</Hint>
        <Collapse in={handOver} unmountOnExit>
          <Box sx={{ mt: 1.25 }}><HandOver api={api} d={d} set={setView} canEdit={canEdit} lang={lang} /></Box>
        </Collapse>
      </Box>
    </>
  );

  const rights: [boolean, string][] = [
    [status.gate.approved, status.gate.approved ? "approved by its reviewer" : "waits for its reviewer's approval"],
    [status.gate.grant, status.gate.grant ? "you may write to the shop" : "writing needs Edit on AI testing & personalization > Winners"],
    [status.gate.canEdit, status.gate.canEdit ? "you can edit it" : "you can only comment"],
  ];
  const pagesPart = (
    <Box>
      {/* the publish rights, one line (they were Setup's box) */}
      <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", columnGap: 1, rowGap: 0.25, mb: 1.25, fontSize: "0.76rem" }}>
        <Typography component="span" sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: MUTED }}>Publish rights</Typography>
        {rights.map(([ok, text]) => (
          <Typography key={text} component="span" sx={{ fontSize: "0.76rem", fontWeight: 600, color: ok ? GREEN : AMBER, display: "inline-flex", alignItems: "center", gap: 0.3 }}>
            {ok ? <CheckIcon sx={{ fontSize: 13 }} /> : "·"}{text}
          </Typography>
        ))}
      </Box>
      <Connection api={api} envs={envs} />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", sm: `repeat(${Math.max(1, envs.length)}, minmax(0,1fr))` }, gap: 1 }}>
        {envs.map((e) => {
          // what holds every write there: the target's own (its key, the review, the grant - said once at the top) or its pictures
          const held0 = e.why ?? picHoldOf(e.env);
          const plan = updateAllOf(rows, e.env, { all: all[e.env], accLive, held: held0 && held0 === gateWhy ? "Held - see the line above." : held0 });
          const onShop = rows.filter((r) => r.envs[e.env].state !== "none");
          const changed = rows.filter((r) => r.envs[e.env].state === "changed").length;
          const lastAt = rows.map((r) => r.envs[e.env].at).filter((x): x is string => !!x).sort().at(-1) ?? null;
          const busyHere = busy === `all:${e.env}`;
          const first = e.env === "acc";
          return (
            <Box key={e.env} sx={{ p: 1.25, borderRadius: "10px", border: `1px solid ${HAIRLINE}`, bgcolor: "#fff", display: "flex", flexDirection: "column", gap: 0.75, minWidth: 0 }}>
              <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                <Typography sx={{ fontSize: "0.86rem", fontWeight: 800, color: INK, flex: 1 }}>{e.label}</Typography>
                <Typography sx={{ ...mono, fontSize: "0.7rem", color: MUTED }}>{e.base.replace(/^https:\/\//, "")}</Typography>
              </Box>
              <Typography sx={{ fontSize: "0.76rem", color: changed ? AMBER : onShop.length ? GREEN : MUTED, fontWeight: 700 }}>
                {!onShop.length ? "Not published here yet" : `${onShop.length} of ${rows.length} page${rows.length === 1 ? "" : "s"} here${changed ? ` · ${changed} changed since the publish` : " · all as published"}${lastAt ? ` · ${when(lastAt)}` : ""}`}
              </Typography>
              <Button fullWidth variant={first ? "contained" : "outlined"} disableElevation disabled={!!plan.why || !!busy || !!reading[e.env]} onClick={() => void updateAll(e, plan)}
                startIcon={busyHere ? <CircularProgress size={14} color="inherit" /> : undefined}
                sx={first ? { ...mainBtn, height: 40, borderRadius: "8px" } : { ...btn, height: 40, borderRadius: "8px", borderColor: HAIRLINE, color: INK }}>
                {busyHere ? `Writing into ${e.label}…` : plan.label}
              </Button>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                <Tick on={all[e.env]} onClick={() => setAll((x) => ({ ...x, [e.env]: !x[e.env] }))} disabled={!!busy}>all, changed or not</Tick>
                <Typography component="span" sx={{ fontSize: "0.72rem", color: MUTED }}>{plan.storeViews ? `${plan.storeViews} store view${plan.storeViews === 1 ? "" : "s"}` : ""}</Typography>
              </Box>
              {plan.why && <Typography sx={{ fontSize: "0.74rem", color: MUTED, lineHeight: 1.4 }}>{plan.why}</Typography>}
            </Box>
          );
        })}
      </Box>
      {run && (
        <Box sx={{ mt: 1, p: 1.25, borderRadius: "8px", bgcolor: "#f6f8fb", border: `1px solid ${HAIRLINE}` }}>
          <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: INK, display: "flex", alignItems: "center", gap: 0.75 }}>
            {!run.done && <CircularProgress size={12} />}{run.line}
          </Typography>
          {run.results.length > 0 && <Box sx={{ mt: 0.5 }}><ResultList env={run.env} results={run.results} records={run.records}
            retry={run.done ? retryOf(run.env, run.results) : null} /></Box>}
        </Box>
      )}
      {multi && <Typography sx={{ mt: 1, fontSize: "0.78rem", color: INK }}>Version <b>{d.letter || "A"}</b> of the page goes to Magento - the one open above the page. Open another there to send it instead.</Typography>}

      <Kick>{doc.source === "new" ? "Pages" : "Languages"} · {rows.length} · {rows.reduce((n, r) => n + r.stores.length, 0)} store views</Kick>
      <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "10px", bgcolor: "#fff", overflow: "hidden" }}>
        {rows.map((r, i) => {
          const v = status.views.find((x) => x.view === r.view)!;
          const isOpenRow = open === `pages:${r.view}`;
          return (
            <Box key={r.view} sx={{ borderTop: i ? `1px solid ${HAIRLINE}` : "none", px: 1.25, py: 1 }}>
              <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75, flexWrap: "wrap" }}>
                <Typography sx={{ fontSize: "0.84rem", fontWeight: 800, color: INK, whiteSpace: "nowrap" }}>{r.label}</Typography>
                <Typography sx={{ ...mono, flex: "1 1 160px", minWidth: 0, fontSize: "0.74rem", color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.sent?.identifier ?? v.path ?? ""}</Typography>
                {v.sent && (
                  <Box component="button" type="button" onClick={() => setOpen(isOpenRow ? null : `pages:${r.view}`)} sx={{ all: "unset", cursor: "pointer", fontSize: "0.74rem", color: PINK, fontWeight: 600, display: "inline-flex", alignItems: "center" }}>
                    What is sent<KeyboardArrowDownIcon sx={{ fontSize: 16, transform: isOpenRow ? "none" : "rotate(-90deg)", transition: "transform .15s" }} />
                  </Box>
                )}
              </Box>
              {!r.writable && <Typography sx={{ fontSize: "0.74rem", color: v.why ? MUTED : AMBER, mt: 0.25 }}>{v.why ?? v.blocked}</Typography>}
              {/* its store views by name while no shop has it yet (once there, its links name them) */}
              {ENVS_SHOWN.every((x) => !r.envs[x].pages.length) && <Typography sx={{ fontSize: "0.7rem", color: MUTED, mt: 0.25 }}>{r.stores.join(" · ")}</Typography>}
              <Box sx={{ mt: 0.6, display: "grid", gap: 0.5 }}>
                {envs.map((e) => {
                  const x = r.envs[e.env];
                  const rec = latest.get(`${e.env}|${r.view}`);
                  const live = !!rec && (rec.action === "created" || rec.action === "updated");
                  const busyHere = busy === `restore:${e.env}:${r.view}`;
                  return (
                    <Box key={e.env} sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "92px minmax(0,1fr)" }, columnGap: 1, rowGap: 0.25, alignItems: "baseline" }}>
                      <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: INK }}>{e.label}</Typography>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography component="div" sx={{ fontSize: "0.76rem", fontWeight: 700, color: STATE_TONE[x.state] }}>{stateLine(x, when)}</Typography>
                        {x.pages.length > 0 && <Box sx={{ mt: 0.25 }}><PageLinks pages={x.pages} /></Box>}
                        {live && !e.restoreWhy && (
                          <Box component="button" type="button" disabled={!!busy} onClick={() => void restore(rec!)} sx={{ all: "unset", mt: 0.25, cursor: busy ? "default" : "pointer", color: MUTED, fontSize: "0.72rem", display: "inline-flex", alignItems: "center", gap: 0.25, "&:hover": { textDecoration: "underline", color: INK } }}>
                            {busyHere ? <CircularProgress size={11} /> : <UndoIcon sx={{ fontSize: 13 }} />}Bring the {rec!.store} page back as it was
                          </Box>
                        )}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
              <Collapse in={isOpenRow} unmountOnExit><WhatIsSent api={api} v={v} envs={envs} plans={plans} on={on} /></Collapse>
            </Box>
          );
        })}
      </Box>
      <Hint mt={0.75}>Each address opens the page on that shop, in its store view. &quot;Update all&quot; writes every page changed since its publish - one Magento page per store view, each backed up first.</Hint>
      {whereItGoes}
      {canEdit && <OrCalendar api={api} />}
      {handOverPart}
    </Box>
  );

  return (
    <Box>
      {/* Content v12: the page's hero taken out and no module in its place - the page would go without its H1 */}
      {d.source === "new" && !blockOrder(d.fields).includes("hero") && (() => { const id = h1ModuleOf(d.fields); const pm = (d.fields.modules ?? []).find((x) => x.id === id); return !pm || !!moduleGap(pm.module); })() && (
        <Box sx={{ p: 1.25, mb: 1.5, borderRadius: "8px", bgcolor: "#fff8ec", border: "1px solid #f1d9ad" }}>
          <Typography sx={{ fontSize: "0.82rem", color: INK }}>This page has no H1: its hero was taken out and no finished module stands in its place - the first module carries the H1 once it is filled. Fill it, or put the page&apos;s hero back (the &quot;+&quot; between two blocks).</Typography>
        </Box>
      )}
      {gateWhy && (
        <Box sx={{ p: 1.25, mb: 1.5, borderRadius: "8px", bgcolor: "#fff8ec", border: "1px solid #f1d9ad" }}>
          <Typography sx={{ fontSize: "0.82rem", color: INK }}>{gateWhy}</Typography>
        </Box>
      )}

      {/* the publishing view's sections (Content v14): one at a time, squared - never MUI Tabs */}
      <Box sx={{ mb: 1.75 }}>
        <Choice value={section} onChange={(k: PubSection) => setSection(k)}
          options={PUB_SECTIONS.map((s) => ({ ...s, count: s.key === "pages" ? rows.length : s.key === "pictures" && doc.source === "new" && picCount ? picCount : undefined }))} />
      </Box>

      {section === "pages" && pagesPart}
      {section === "pictures" && picturesPart}
      {section === "ab" && (
        <AbSection doc={doc} d={d} pieceId={api.data.piece.id} title={api.data.piece.title} abPart={abPart} prefer={prefer}
          stores={status.views.find((v) => v.view === lang)?.stores?.map((x) => x.view) ?? viewsOf(doc)} />
      )}
    </Box>
  );
}
