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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
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
import { PINK, btn, mainBtn } from "../../parts";
import type { StudioApi } from "../../useStudio";
import { Publish as HandOver } from "./Sections";
import { Hint, mono } from "./ui";

export type EnvState = {
  env: Env; label: string; base: string; key: boolean; waiting: string | null; why: string | null; restoreWhy: string | null;
  /** where its key for pages comes from, the connection in plain words, the last check (Content v6) */
  from?: "cms" | "order" | "none"; connection?: string; check?: Check | null;
};
/** A version as the last step reads it (Content v10): its language's label and the store views it goes to. */
export type StatusView = Omit<MagentoView, "want"> & { label?: string; stores?: { view: string; open: boolean; id: number | null }[] };
export type Status = { views: StatusView[]; envs: EnvState[]; gate: { canEdit: boolean; approved: boolean; grant: boolean; why: string | null }; backups: PageBackup[] };
export type PlanOut = PagePlan | SharedPlan | { view: string; env: Env; action: "none"; why: string; error: true };
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
          <Box key={k} component="span" title={t?.why ?? (st === "out" ? `${k} is no longer ticked - the page leaves it` : s?.id ? `Magento store id ${s.id}` : "Magento has it; the hub does not know its id")}
            sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: 0.6, py: 0.15, borderRadius: "3px", border: `1px solid ${look ? `${look.c}44` : HAIRLINE}`, bgcolor: look ? `${look.c}0d` : "#fff",
              fontSize: "0.7rem", fontWeight: 700, color: INK, whiteSpace: "nowrap", textDecoration: st === "out" ? "line-through" : "none" }}>
            {k.split("/")[0].toUpperCase()}{k.includes("/") && <Box component="span" sx={{ fontSize: "0.58rem", color: BLUE }}>{k.split("/")[1].toUpperCase()}</Box>}
            <Box component="span" sx={{ fontWeight: 500, color: MUTED, fontVariantNumeric: "tabular-nums" }}>{s?.id ? `#${s.id}` : ""}</Box>
            {look && <Box component="span" sx={{ fontWeight: 700, color: look.c }}>{look.w}</Box>}
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
      {s.pictures.length > 0 && (
        <Typography sx={{ mt: 0.75, fontSize: "0.76rem", color: AMBER }}>
          {s.pictures.length} picture{s.pictures.length === 1 ? "" : "s"} must be in Magento&apos;s media first (wysiwyg/content: {s.pictures.map((p) => p.file).join(", ")}) - Magento&apos;s API takes no pictures. The hand-over below lists them.
        </Typography>
      )}
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

export function ToMagento({ api, doc, d, setView, canEdit, lang, initial }: {
  api: StudioApi; doc: PageDoc; d: PageDoc; setView: (next: PageDoc) => void; canEdit: boolean; lang: string;
  /** what Magento was read to say (a static check draws the step with it) */
  initial?: { status: Status; plans: Record<string, PlanOut[]> };
}) {
  const [status, setStatus] = useState<Status | null>(initial?.status ?? null);
  const [err, setErr] = useState<string | null>(null);
  const [on, setOn] = useState<Env[]>(["acc"]);
  const [picked, setPicked] = useState<string[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [plans, setPlans] = useState<Record<string, PlanOut[]>>(initial?.plans ?? {});
  const [reading, setReading] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [said, setSaid] = useState<{ env: Env; results: Result[] } | null>(null);
  const [handOver, setHandOver] = useState(false);
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
    const r = await apiRef.current.act<{ env: Env; plans: PlanOut[]; waiting: string | null }>("magento_plan", { env, views });
    setReading((x) => ({ ...x, [env]: false }));
    if (r.ok) setPlans((p) => ({ ...p, [env]: r.result.plans }));
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
    const r = await api.act<{ env: Env; results: Result[] }>("magento_publish", { env: env.env, views });
    setBusy(null);
    if (!r.ok) { setSaid({ env: env.env, results: [{ view: "", ok: false, error: r.error }] }); return; }
    setSaid(r.result);
    await api.reload();
    await load();
    void read(env.env, sel);
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
  return (
    <Box>
      {gateWhy && (
        <Box sx={{ p: 1.25, mb: 1.5, borderRadius: "8px", bgcolor: "#fff8ec", border: "1px solid #f1d9ad" }}>
          <Typography sx={{ fontSize: "0.82rem", color: INK }}>{gateWhy}</Typography>
        </Box>
      )}

      <Kick>Where to</Kick>
      <Targets envs={envs} on={on} onToggle={toggleEnv} />
      {/* a page of ACC is written to ACC (Content v8, point 7 - the server offers ACC alone for it) */}
      {doc.source !== "new" && doc.env === "acc" && <Typography sx={{ mt: 0.75, fontSize: "0.78rem", color: MUTED }}>This to-do works on ACC&apos;s page - it is written to ACC.</Typography>}
      <Connection api={api} envs={envs} />
      {multi && <Typography sx={{ mt: 1, fontSize: "0.78rem", color: INK }}>Version <b>{d.letter || "A"}</b> of the page goes to Magento - the one open above the page. Open another there to send it instead.</Typography>}

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
          const isOpen = open === v.view;
          return (
            <Box key={v.view} sx={{ borderTop: i ? `1px solid ${HAIRLINE}` : "none", px: 1.25, py: 1 }}>
              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                <Box component="button" type="button" disabled={!can} aria-pressed={chosen} aria-label={`Write ${v.view}`} onClick={() => toggleView(v.view)} sx={{
                  all: "unset", cursor: can ? "pointer" : "default", mt: 0.25, width: 15, height: 15, borderRadius: "3px", boxSizing: "border-box", flexShrink: 0,
                  border: `1.5px solid ${chosen ? BLUE : "#9aa5b8"}`, bgcolor: chosen ? BLUE : "#fff", display: "grid", placeItems: "center", opacity: can ? 1 : 0.4,
                  "&:focus-visible": { outline: `2px solid ${BLUE}`, outlineOffset: 2 },
                }}>{chosen && <CheckIcon sx={{ fontSize: 12, color: "#fff" }} />}</Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box component="button" type="button" onClick={() => setOpen(isOpen ? null : v.view)} sx={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 0.75, width: "100%" }}>
                    <Typography sx={{ fontSize: "0.82rem", fontWeight: 800, color: INK, letterSpacing: ".02em", whiteSpace: "nowrap" }}>{v.label ?? v.view}</Typography>
                    <Typography sx={{ ...mono, flex: 1, minWidth: 0, fontSize: "0.76rem", color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.sent?.identifier ?? v.path ?? ""}</Typography>
                    {v.sent && <KeyboardArrowDownIcon sx={{ fontSize: 18, color: MUTED, transform: isOpen ? "none" : "rotate(-90deg)", transition: "transform .15s" }} />}
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
                  {envs.map((e) => {
                    const rec = latest.get(`${e.env}|${v.view}`);
                    if (!rec) return null;
                    const busyHere = busy === `restore:${e.env}:${v.view}`;
                    const live = rec.action === "created" || rec.action === "updated";
                    return (
                      <Box key={e.env} sx={{ mt: 0.5, display: "flex", alignItems: "center", flexWrap: "wrap", columnGap: 0.75, rowGap: 0.25, fontSize: "0.76rem" }}>
                        <Typography component="span" sx={{ fontSize: "0.76rem", color: live ? GREEN : MUTED, fontWeight: 700 }}>{DONE[rec.action]} {e.label} · {rec.store} · {when(rec.at)}</Typography>
                        <Box component="a" href={rec.url} target="_blank" rel="noopener noreferrer" sx={{ color: BLUE, display: "inline-flex", alignItems: "center", gap: 0.25, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
                          open it<OpenInNewIcon sx={{ fontSize: 12 }} />
                        </Box>
                        {live && !e.restoreWhy && (
                          <Box component="button" type="button" disabled={!!busy} onClick={() => void restore(rec)} sx={{ all: "unset", cursor: busy ? "default" : "pointer", color: INK, display: "inline-flex", alignItems: "center", gap: 0.25, "&:hover": { textDecoration: "underline" } }}>
                            {busyHere ? <CircularProgress size={11} /> : <UndoIcon sx={{ fontSize: 13 }} />}Bring the page back as it was
                          </Box>
                        )}
                      </Box>
                    );
                  })}
                  <Collapse in={isOpen} unmountOnExit><WhatIsSent api={api} v={v} envs={envs} plans={plans} on={on} /></Collapse>
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
          const why = e.why ?? (!sel.length ? "Pick at least one store view." : !reading[e.env] && plans[e.env] && !writable.length ? "Nothing to write here - see each store view above." : null);
          const blocked = cmsViews.filter((v) => sel.includes(v.view) && v.blocked).length;
          const off = !!why || !!busy || !!reading[e.env] || !!blocked;
          // the review or the grant is said once, at the top; the key, per target
          const say = why && why !== gateWhy && why !== e.waiting ? why : null;
          return (
            <Box key={e.env}>
              <Button fullWidth variant={i === 0 ? "contained" : "outlined"} disableElevation disabled={off} onClick={() => void publish(e)}
                startIcon={busy === `publish:${e.env}` ? <CircularProgress size={14} color="inherit" /> : undefined}
                sx={i === 0 ? { ...mainBtn, height: 42, borderRadius: "8px" } : { ...btn, height: 42, borderRadius: "8px", borderColor: HAIRLINE, color: INK }}>
                {busy === `publish:${e.env}` ? `Writing into ${e.label}…` : `Publish to ${e.env === "acc" ? "ACC" : "production"}${writable.length && !why ? ` · ${writable.length === 1 ? "1 page" : `${writable.length} pages`} for ${writable.reduce((n, v) => { const p = plans[e.env]?.find((x) => x.view === v && isShared(x)); return n + (isShared(p) ? p.storeIds.length : status.views.find((x) => x.view === v)?.stores?.length ?? 1); }, 0)} store views` : ""}`}
              </Button>
              {(say || blocked > 0) && <Typography sx={{ mt: 0.5, fontSize: "0.76rem", color: MUTED }}>{say ?? `${blocked} store view${blocked === 1 ? " has" : "s have"} words to finish first.`}</Typography>}
            </Box>
          );
        })}
        {!on.length && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>Pick ACC, production or both above.</Typography>}
      </Box>

      {said && (
        <Box sx={{ mt: 1.25, p: 1.25, borderRadius: "8px", bgcolor: "#f6f8fb", border: `1px solid ${HAIRLINE}` }}>
          {said.results.map((r) => (
            <Typography key={r.view || "all"} sx={{ fontSize: "0.8rem", color: r.ok ? GREEN : "#c5221f" }}>
              {r.view ? `${r.view}: ` : ""}{r.ok ? `${r.action === "created" ? "created" : "updated"} (page #${r.pageId})${r.stores?.length ? ` for ${r.stores.join(", ")}` : ""}${r.note ? ` - ${r.note}` : ""}` : r.error}
            </Typography>
          ))}
        </Box>
      )}

      <Box sx={{ mt: 2.5, borderTop: `1px solid ${HAIRLINE}`, pt: 1.25 }}>
        <Button size="small" onClick={() => setHandOver(!handOver)} endIcon={<KeyboardArrowDownIcon sx={{ transform: handOver ? "none" : "rotate(-90deg)", transition: "transform .15s" }} />}
          sx={{ ...btn, color: INK, px: 0.5 }}>The hand-over · {lang}</Button>
        <Hint mt={0}>What to copy in by hand, the pictures to upload, and the notes for whoever puts it live.</Hint>
        <Collapse in={handOver} unmountOnExit>
          <Box sx={{ mt: 1.25 }}><HandOver api={api} d={d} set={setView} canEdit={canEdit} lang={lang} /></Box>
        </Collapse>
      </Box>
    </Box>
  );
}
