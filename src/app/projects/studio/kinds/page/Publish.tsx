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
import type { PagePlan } from "@/lib/convert/cmsPage";
import type { Env } from "@/lib/convert/model";
import type { PageBackup } from "@/lib/convert/cms";
import type { Check } from "@/lib/content/studio/kinds/page/magentoCheck";
import { versionList, viewName, viewsOf, type MagentoRecord, type PageDoc } from "@/lib/content/studio/kinds/page/model";
import type { MagentoView } from "@/lib/content/studio/kinds/page/shop";
import { PINK, btn, mainBtn } from "../../parts";
import type { StudioApi } from "../../useStudio";
import { Publish as HandOver } from "./Sections";
import { Hint, mono } from "./ui";

type EnvState = {
  env: Env; label: string; base: string; key: boolean; waiting: string | null; why: string | null; restoreWhy: string | null;
  /** where its key for pages comes from, the connection in plain words, the last check (Content v6) */
  from?: "cms" | "order" | "none"; connection?: string; check?: Check | null;
};
type Status = { views: Omit<MagentoView, "want">[]; envs: EnvState[]; gate: { canEdit: boolean; approved: boolean; grant: boolean; why: string | null }; backups: PageBackup[] };
type PlanOut = PagePlan | { view: string; env: Env; action: "none"; why: string; error: true };
type Result = { view: string; ok: boolean; action?: string; pageId?: string; error?: string };

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
  if (p.action === "create") return { text: "creates a new page", tone: "ok" };
  if (p.action === "update") {
    const shared = "shared" in p && p.shared.length ? ` - also serves ${p.shared.join(", ")}` : "";
    return { text: `updates page #${p.pageId}${shared}`, tone: "ok" };
  }
  return { text: `not written: ${p.why ?? "-"}`, tone: "off" };
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

/** The connection to Magento, per environment, in plain words (Content v6 - SARCLA 09.11.2026: "the Magento connection is
 * not working yet"): no key on the hub yet, a key not checked yet, connected, refused - and "Check the connection", ONE
 * read of Magento's CMS pages with that key, nothing written. */
function Connection({ api, envs }: { api: StudioApi; envs: EnvState[] }) {
  const [checks, setChecks] = useState<Partial<Record<Env, Check>>>({});
  const [busy, setBusy] = useState<Env | null>(null);
  const check = async (env: Env) => {
    setBusy(env);
    const r = await api.act<{ check: Check }>("magento_check", { env });
    setBusy(null);
    setChecks((c) => ({ ...c, [env]: r.ok ? r.result.check : { env, state: "unreachable", line: r.error, detail: null, pages: null, at: new Date().toISOString() } }));
  };
  const DOT: Record<string, string> = { "no-key": "#9aa5b8", key: BLUE, connected: GREEN, refused: "#c5221f", "no-right": "#c5221f", unreachable: AMBER };
  return (
    <Box sx={{ mt: 1.25, border: `1px solid ${HAIRLINE}`, borderRadius: "8px", bgcolor: "#fff", overflow: "hidden" }}>
      <Typography sx={{ px: 1.25, pt: 0.9, pb: 0.25, fontSize: "0.66rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: MUTED }}>Connection</Typography>
      {envs.map((e) => {
        const c = checks[e.env] ?? e.check ?? null;
        const state = c?.state ?? (e.key ? "key" : "no-key");
        const line = c?.line ?? e.connection ?? (e.key ? "Key set - not checked yet" : "No key on the hub yet");
        return (
          <Box key={e.env} sx={{ px: 1.25, py: 0.75, borderTop: `1px solid ${HAIRLINE}`, "&:first-of-type": { borderTop: "none" } }}>
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
              <Box sx={{ mt: 0.65, width: 8, height: 8, borderRadius: "2px", bgcolor: DOT[state] ?? MUTED, flexShrink: 0 }} />
              <Typography sx={{ width: 76, flexShrink: 0, fontSize: "0.8rem", fontWeight: 700, color: INK }}>{e.label}</Typography>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.8rem", color: state === "connected" ? GREEN : state === "refused" || state === "no-right" ? "#c5221f" : INK }}>{line}</Typography>
                {c?.detail && <Typography sx={{ fontSize: "0.74rem", color: MUTED, overflowWrap: "anywhere" }}>{c.detail}</Typography>}
                {e.from === "order" && <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>The order connector&apos;s Magento integration, used for pages too (switched on for the hub).</Typography>}
                {e.key && (
                  <Button size="small" disabled={busy === e.env} onClick={() => void check(e.env)} startIcon={busy === e.env ? <CircularProgress size={12} /> : undefined}
                    sx={{ ...btn, px: 0, minWidth: 0, mt: 0.25, color: BLUE, fontSize: "0.76rem" }}>
                    {busy === e.env ? "Asking Magento…" : c ? "Check again" : "Check the connection"}
                  </Button>
                )}
              </Box>
            </Box>
          </Box>
        );
      })}
      <Typography sx={{ px: 1.25, pb: 0.9, pt: 0.25, fontSize: "0.72rem", color: MUTED }}>A check reads one page list from Magento - nothing is written.</Typography>
    </Box>
  );
}

export function ToMagento({ api, doc, d, setView, canEdit, lang }: { api: StudioApi; doc: PageDoc; d: PageDoc; setView: (next: PageDoc) => void; canEdit: boolean; lang: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [on, setOn] = useState<Env[]>(["acc"]);
  const [picked, setPicked] = useState<string[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [plans, setPlans] = useState<Record<string, PlanOut[]>>({});
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
  }, [on.join(), selKey, envs.map((e) => e.key).join()]);

  const toggleEnv = (e: Env) => setOn((cur) => (cur.includes(e) ? cur.filter((x) => x !== e) : [...cur, e].sort()));
  const toggleView = (v: string) => setPicked((cur) => { const base = cur ?? cmsViews.map((x) => x.view); return base.includes(v) ? base.filter((x) => x !== v) : [...base, v]; });

  const publish = async (env: EnvState) => {
    const views = sel.filter((v) => {
      const p = plans[env.env]?.find((x) => x.view === v);
      return !p || p.action !== "none";
    });
    if (!views.length) return;
    if (!window.confirm(`Write ${views.join(", ")} into Magento ${env.label}? Each page is backed up first, and can be brought back as it was.`)) return;
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
      <Connection api={api} envs={envs} />
      {multi && <Typography sx={{ mt: 1, fontSize: "0.78rem", color: INK }}>Version <b>{d.letter || "A"}</b> of the page goes to Magento - the one open above the page. Open another there to send it instead.</Typography>}

      <Kick right={envs.some((e) => on.includes(e.env) && e.key) ? (
        <Button size="small" onClick={() => { for (const e of envs) if (on.includes(e.env) && e.key) void read(e.env, sel); }} startIcon={<RefreshIcon sx={{ fontSize: 15 }} />}
          sx={{ ...btn, color: MUTED, px: 0.5, py: 0, fontSize: "0.74rem", minWidth: 0 }}>Read Magento again</Button>
      ) : undefined}>
        Store views · {sel.length} of {cmsViews.length}
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
                    <Typography sx={{ fontSize: "0.82rem", fontWeight: 800, color: INK, letterSpacing: ".02em" }}>{v.view}</Typography>
                    <Typography sx={{ ...mono, flex: 1, minWidth: 0, fontSize: "0.76rem", color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.sent?.identifier ?? v.path ?? ""}</Typography>
                    {v.sent && <KeyboardArrowDownIcon sx={{ fontSize: 18, color: MUTED, transform: isOpen ? "none" : "rotate(-90deg)", transition: "transform .15s" }} />}
                  </Box>
                  {v.why && <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 0.25 }}>{v.why}</Typography>}
                  {can && v.blocked && <Typography sx={{ fontSize: "0.76rem", color: AMBER, mt: 0.25 }}>{v.blocked}</Typography>}
                  {can && envs.filter((e) => on.includes(e.env)).map((e) => {
                    const line = planLine(plans[e.env]?.find((x) => x.view === v.view), e);
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
      <Hint mt={0.75}>A click on a store view shows the exact page Magento gets. Each store view is its own page in Magento; nothing is written until you press Publish.</Hint>

      <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 1 }}>
        {envs.filter((e) => on.includes(e.env)).map((e, i) => {
          const writable = sel.filter((v) => { const p = plans[e.env]?.find((x) => x.view === v); return p && p.action !== "none"; });
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
                {busy === `publish:${e.env}` ? `Writing into ${e.label}…` : `Publish to ${e.env === "acc" ? "ACC" : "production"}${writable.length && !why ? ` · ${writable.length} store view${writable.length === 1 ? "" : "s"}` : ""}`}
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
              {r.view ? `${r.view}: ` : ""}{r.ok ? `${r.action === "created" ? "created" : "updated"} (page #${r.pageId})` : r.error}
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
