"use client";

// APSOconvert > SHIP (Website > AI testing & personalization). The versions that won their test, each with its three
// ways out (src/lib/convert/ship.ts): (1) keep it on for everyone - a personalisation without an audience limit, at
// once, undone with one press; (2) the code for dotSource - product and category pages are the theme's code: a CSS
// block, a small ES5 script and what changes and why, to copy; (3) for Magento CMS pages only, the write into the page
// - ACC first, a backup before every write, a person pressing each one, and only once the hub has its Magento keys.
// The page's texts go to Content Studio, as from the Preview (src/lib/convert/handoff.ts).

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import RefreshIcon from "@mui/icons-material/Refresh";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import CodeOutlinedIcon from "@mui/icons-material/CodeOutlined";
import WebAssetOutlinedIcon from "@mui/icons-material/WebAssetOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { ACCENT, CardTitle, GREEN, GlassCard, HAIRLINE, INK, MUTED, Notice, RED, clip } from "@/app/uc/report/ui";
import { Chip, ago } from "@/app/connectors/parts";
import { ENVS, KIND_LABEL, type Env } from "@/lib/convert/model";
import { projectForPage } from "@/lib/convert/handoff";
import type { CmsBackup, CmsPlan } from "@/lib/convert/cms";
import { convertPost, previewHref } from "../Flow";
import { ConfirmDialog, GatewayNotice, dayTime, envChip, n, pagesLine, pct, signed, type Confirm, type GatewayView, type TestView } from "../TestParts";

const API = "/api/website/ai-personalization/ship";
type ListData = { tests: (TestView & { shippedAs: { id: string; status: string } | null })[]; gateway: GatewayView; cms: { acc: boolean; prod: boolean; missing: string[] }; canEdit: boolean };
type One = {
  test: TestView;
  code: { css: string; js: string; description: string; changes: number };
  pages: { path: string; name: string; cms: { ok: true; identifier: string } | { ok: false; why: string } }[];
  cms: { acc: boolean; prod: boolean; missing: string[]; off: string | null };
  backups: CmsBackup[];
  shippedAs: { id: string; status: string; startedAt: string | null; startedBy: string | null } | null;
  idea: { title: string; why: string; change: string; expect: string; numbers: Record<string, unknown> | null } | null;
  figures: { rateA: number | null; rateB: number | null; uplift: { mid: number | null; low: number | null; high: number | null }; pB: number | null; visitors: { a: number; b: number }; days: number; verdict: string } | null;
  content: { url: string; path: string; env: Env };
  gateway: GatewayView; canEdit: boolean; canContent: boolean;
};
const since = (iso: string | null) => (iso ? ago(Date.parse(iso) / 1000) : "–");

function copy(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text).then(() => true, () => false);
  return Promise.resolve(false);
}

function CodeBlock({ title, text, empty }: { title: string; text: string; empty: string }) {
  const [done, setDone] = useState(false);
  return (
    <Box sx={{ display: "grid", gap: 0.5, minWidth: 0, alignContent: "start" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, minHeight: 30 }}>
        <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".04em", flex: 1 }}>{title}</Typography>
        {text && <Button size="small" startIcon={<ContentCopyOutlinedIcon sx={{ fontSize: 15 }} />} onClick={async () => { setDone(await copy(text)); setTimeout(() => setDone(false), 1800); }}>{done ? "Copied" : "Copy"}</Button>}
      </Box>
      {text
        ? <Box component="pre" sx={{ m: 0, p: 1.25, borderRadius: "10px", bgcolor: "#f6f8fb", border: `1px solid ${HAIRLINE}`, fontSize: "0.72rem", lineHeight: 1.45, color: INK, fontFamily: "ui-monospace, Consolas, monospace", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 280, overflow: "auto" }}>{text}</Box>
        : <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{empty}</Typography>}
    </Box>
  );
}

/** Way 3: one CMS page, read in Magento and written on a person's press. */
function CmsPage({ id, p, cms, canEdit, ask, reload }: { id: string; p: One["pages"][number]; cms: One["cms"]; canEdit: boolean; ask: (c: Confirm) => void; reload: () => void }) {
  const [plan, setPlan] = useState<CmsPlan | null>(null);
  const [busy, setBusy] = useState<Env | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const check = async (env: Env, page?: string) => {
    setBusy(env); setErr(null);
    try {
      const r = await fetch(`${API}?id=${id}&plan=${encodeURIComponent(p.path)}&env=${env}${page ? `&page=${page}` : ""}`);
      const j = (await r.json()) as { ok?: boolean; data?: { plan: CmsPlan }; error?: string };
      if (j.ok && j.data) setPlan(j.data.plan); else setErr(j.error ?? `The hub answered ${r.status}.`);
    } catch { setErr("No answer."); }
    setBusy(null);
  };
  if (!p.cms.ok) {
    return (
      <Box sx={{ py: 1, borderBottom: `1px solid ${HAIRLINE}` }}>
        <Typography sx={{ fontSize: "0.82rem", color: INK, ...clip(900) }}>{p.path}</Typography>
        <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>{p.cms.why}</Typography>
      </Box>
    );
  }
  return (
    <Box sx={{ py: 1, borderBottom: `1px solid ${HAIRLINE}`, display: "grid", gap: 0.75 }}>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
        <Box sx={{ minWidth: 0, flex: "1 1 260px" }}>
          <Typography sx={{ fontSize: "0.82rem", color: INK, ...clip(900) }}>{p.path}</Typography>
          <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>CMS page &quot;{p.cms.identifier}&quot;</Typography>
        </Box>
        <Tooltip title={cms.acc ? "Read the page in Magento on ACC and show what the write would do" : (cms.off ?? "")}>
          <span><Button size="small" disabled={!cms.acc || !canEdit || busy !== null} onClick={() => void check("acc")} startIcon={busy === "acc" ? <CircularProgress size={13} /> : undefined}>Check on ACC</Button></span>
        </Tooltip>
        <Tooltip title={cms.prod ? "Production, after the same page was written on ACC" : (cms.off ?? "The production integration (MAGENTO_CMS_PROD) is not set yet")}>
          <span><Button size="small" disabled={!cms.prod || !canEdit || busy !== null} onClick={() => void check("prod")} startIcon={busy === "prod" ? <CircularProgress size={13} /> : undefined}>Check on production</Button></span>
        </Tooltip>
      </Box>
      {err && <Typography sx={{ fontSize: "0.78rem", color: RED }}>{err}</Typography>}
      {plan && (
        <Box sx={{ p: 1.25, borderRadius: "10px", bgcolor: "rgba(36,89,209,.04)", border: `1px solid ${HAIRLINE}`, display: "grid", gap: 0.75 }}>
          <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: INK }}>{ENVS[plan.env].label}{plan.applied ? ` · ${plan.applied.placed.length} ${plan.applied.placed.length === 1 ? "change" : "changes"} placed${plan.applied.css ? " + the styles" : ""}` : ""}{plan.sizes ? ` · ${n(plan.sizes.before)} → ${n(plan.sizes.after)} characters` : ""}</Typography>
          {plan.why && <Typography sx={{ fontSize: "0.8rem", color: plan.canWrite ? MUTED : RED }}>{plan.why}</Typography>}
          {plan.applied?.placed.some((x) => x.via) && <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>Some changes were placed inside the page&apos;s content without the shop page&apos;s outer frame ({plan.applied.placed.filter((x) => x.via).map((x) => x.via).join(", ")}).</Typography>}
          {plan.candidates.length > 1 && (
            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
              {plan.candidates.map((c) => <Button key={c.id} size="small" variant={plan.chosen === c.id ? "contained" : "outlined"} disableElevation onClick={() => void check(plan.env, c.id)}>#{c.id} · store {c.stores.join(",") || "all"}</Button>)}
            </Box>
          )}
          {plan.canWrite && plan.chosen && (
            <Box>
              <Button size="small" variant="contained" disableElevation onClick={() => ask({
                title: `Write it into Magento on ${ENVS[plan.env].label}?`,
                lines: [<>The CMS page &quot;{p.cms.ok ? p.cms.identifier : ""}&quot; (#{plan.chosen}) gets the version&apos;s changes, as tested.</>, "Its content as it is now is kept as a backup first - it can be put back from this page.", plan.env === "acc" ? "ACC first: check the page there before production." : "Production: the shop's visitors see it as soon as Magento's cache is refreshed."],
                go: `Write on ${ENVS[plan.env].label}`,
                run: async () => {
                  const r = await convertPost<{ backupId: string }>(API, { action: "cms-write", id, env: plan.env, path: p.path, pageId: plan.chosen });
                  if (!r.ok) { setErr(r.error); return true; }
                  setPlan(null); reload(); return true;
                },
              })}>Write on {ENVS[plan.env].label}</Button>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

function ShipOne({ id, onChanged }: { id: string; onChanged: () => void }) {
  const router = useRouter();
  const [tick, setTick] = useState(0);
  const url = `${API}?id=${id}&n=${tick}`;
  const held = useHeld<One>(url, [url]);
  const r = held.result;
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const reload = () => { setTick((x) => x + 1); onChanged(); };
  if (r === null) return <LoadingPanel label="Reading the test, its code and its pages…" />;
  if (r.state !== "ok") return <UpstreamPanel source="Ship" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? (r.status ?? null) : null} onRetry={() => setTick((x) => x + 1)} />;
  const d = r.data;
  const t = d.test;
  const f = d.figures;
  const live = d.shippedAs && (d.shippedAs.status === "running" || d.shippedAs.status === "paused");
  const post = async (body: Record<string, unknown>) => { setErr(null); const x = await convertPost(API, { id, ...body }); if (!x.ok) setErr(x.error); reload(); return true; };
  const toContent = async () => {
    setSending(true); setErr(null);
    const p = projectForPage({
      env: d.content.env, path: d.content.path, url: d.content.url, h1: "", title: t.name,
      numbers: null,
      ideas: d.idea ? [{ title: d.idea.title, why: d.idea.why, change: d.idea.change, expect: d.idea.expect }] : [],
      version: { rev: t.versionRev, summary: `${d.code.changes} changes; it won its test${f ? ` (${pct(f.rateB, 1)} against ${pct(f.rateA, 1)} put something in the cart)` : ""}` },
      previewPath: `${window.location.origin}${previewHref(t.env, t.pages[0], t.ideaId ?? undefined)}`,
    });
    try {
      const res = await fetch("/api/content/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
      const j = (await res.json().catch(() => null)) as { ok?: boolean; project?: { id: number }; error?: string } | null;
      if (!j?.ok || !j.project) { setErr(j?.error ?? `Content Studio answered ${res.status}.`); setSending(false); return; }
      router.push(`/create?project=${j.project.id}&type=${p.contentType}`);
    } catch { setErr("Content Studio did not answer."); setSending(false); }
  };
  return (
    <Box sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>
      <GatewayNotice g={d.gateway} what="the winner" />
      {err && <Notice tone="bad">{err}</Notice>}
      <GlassCard>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", mb: 0.75 }}>
          {envChip(t.env)}<Chip tint="slate">{KIND_LABEL[t.pageKind]}</Chip>
          {t.winner === "b" ? <Chip tint="green">The version won{t.decidedBy ? ` · ${t.decidedBy}` : ""}</Chip> : <Chip tint="amber">The figures say it wins - not decided yet</Chip>}
          {live && <Chip tint="purple">On for everyone</Chip>}
        </Box>
        <Typography sx={{ fontSize: { xs: "1.15rem", md: "1.35rem" }, fontWeight: 700, color: INK, letterSpacing: "-0.02em" }}>{t.name}</Typography>
        {f && <Typography sx={{ fontSize: "0.88rem", color: INK, mt: 0.5 }}>{pct(f.rateB, 2)} of the visitors who saw the version put something in the cart, against {pct(f.rateA, 2)} on the page as it is - <b style={{ color: GREEN }}>{signed(f.uplift.mid)}</b>{f.pB !== null ? `, ${pct(f.pB, 0)} certain` : ""} · {n(f.visitors.a + f.visitors.b)} visitors over {n(f.days)} days.</Typography>}
        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mt: 1.25 }}>
          <Button size="small" component={Link} href={`/website/ab-testing/pages/${t.id}`}>The test</Button>
          <Button size="small" component={Link} href={previewHref(t.env, t.pages[0], t.ideaId ?? undefined)}>See it</Button>
          {d.canContent
            ? <Button size="small" disabled={sending} onClick={() => void toContent()} startIcon={sending ? <CircularProgress size={13} /> : <EditNoteOutlinedIcon sx={{ fontSize: 17 }} />}>Send the texts to Content</Button>
            : <Tooltip title="Content Studio needs the Marketing access"><span><Button size="small" disabled>Send the texts to Content</Button></span></Tooltip>}
          {d.canEdit && t.winner === null && (
            <Button size="small" variant="contained" color="success" disableElevation onClick={() => setConfirm({
              title: "End the test: the version won?", lines: ["The test stops - every visitor sees the page as it is until it is shipped one of the three ways below."], go: "The version won",
              run: () => post({ action: "decide" }),
            })}>Decide: the version won</Button>
          )}
        </Box>
      </GlassCard>

      <GlassCard>
        <CardTitle icon={<PublicOutlinedIcon />} tint="green" title="1 · Keep it on for everyone" note="At once, on the shop's gateway, on the test's pages - undone with one press" />
        {live ? (
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: "0.86rem", color: INK, flex: "1 1 300px" }}>On for everyone on {t.host} since {dayTime(d.shippedAs!.startedAt)}{d.shippedAs!.startedBy ? ` (${d.shippedAs!.startedBy})` : ""} - <Box component={Link} href="/website/ai-personalization/personalise" sx={{ color: ACCENT }}>personalisation #{d.shippedAs!.id}</Box>.</Typography>
            {d.canEdit && <Button size="small" color="error" onClick={() => setConfirm({ title: "Undo: switch it off for everyone?", lines: ["Everyone sees the page as it is again, at once."], go: "Undo", tone: "stop", run: () => post({ action: "undo" }) })}>Undo</Button>}
          </Box>
        ) : (
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: "0.84rem", color: MUTED, flex: "1 1 300px" }}>Until dotSource has built it in, every visitor (with statistics consent) can get the version - exactly the change list that won.</Typography>
            {d.canEdit && (
              <Button size="small" variant="contained" disableElevation disabled={t.winner !== "b" || !d.gateway.configured} onClick={() => setConfirm({
                title: `Keep it on for everyone on ${ENVS[t.env].label}?`,
                lines: [<>The version (rev {t.versionRev}) goes live for <b>everyone</b> on {t.host}:</>, pagesLine(t.host, t.pages), "This is the approval: the shop's gateway runs it within a minute. Undo it here any time."],
                go: "Keep it on for everyone", run: () => post({ action: "everyone" }),
              })}>Keep it on for everyone</Button>
            )}
          </Box>
        )}
        {t.winner !== "b" && <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 0.75 }}>Decide the test first (above).</Typography>}
      </GlassCard>

      <GlassCard>
        <CardTitle icon={<CodeOutlinedIcon />} tint="blue" title="2 · The code for dotSource" note={t.pageKind === "product" || t.pageKind === "category" ? "Product and category pages are the theme's code: this is how the winner gets in for good" : "What the theme needs to keep the change for good"}
          right={d.canEdit ? <Button size="small" onClick={() => setConfirm({ title: "Mark it as sent to dotSource?", lines: ["Written down in the test's history - nothing else changes."], go: "Mark as sent", run: () => post({ action: "handed" }) })}>Mark as sent</Button> : undefined} />
        <Box sx={{ display: "grid", gap: 1.75 }}>
          <CodeBlock title="What changes and why" text={d.code.description} empty="" />
          <Box sx={{ display: "grid", gap: 1.75, alignItems: "start", gridTemplateColumns: { xs: "minmax(0,1fr)", lg: "minmax(0,1fr) minmax(0,1fr)" } }}>
            <CodeBlock title="CSS" text={d.code.css} empty="No style in this version." />
            <CodeBlock title="JavaScript (ES5)" text={d.code.js} empty="No element change - the CSS is all." />
          </Box>
        </Box>
      </GlassCard>

      <GlassCard>
        <CardTitle icon={<WebAssetOutlinedIcon />} tint="amber" title="3 · Write it into Magento" note="CMS pages only - ACC first, a backup before every write, one page and one press at a time" />
        {d.cms.off && <Box sx={{ mb: 1 }}><Notice tone="warn">{d.cms.off}</Notice></Box>}
        {d.pages.map((p) => <CmsPage key={p.path} id={id} p={p} cms={d.cms} canEdit={d.canEdit && t.winner === "b"} ask={setConfirm} reload={reload} />)}
        {d.backups.length > 0 && (
          <Box sx={{ mt: 1.5 }}>
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".04em", mb: 0.5 }}>Backups</Typography>
            {d.backups.map((b) => (
              <Box key={b.id} sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", py: 0.5, borderBottom: `1px solid ${HAIRLINE}` }}>
                <Typography sx={{ fontSize: "0.78rem", color: INK, flex: "1 1 280px" }}>#{b.id} · {ENVS[b.env].label} · &quot;{b.identifier}&quot; · {b.kind === "restore" ? "put back" : "written"} {dayTime(b.at)} by {b.by ?? "–"}{b.error ? ` · failed: ${b.error}` : b.written ? "" : " · not written"}</Typography>
                {d.canEdit && b.written && b.kind === "write" && (
                  <Button size="small" onClick={() => setConfirm({ title: "Put the page back as it was?", lines: [`The CMS page "${b.identifier}" on ${ENVS[b.env].label} gets its content from before backup #${b.id}. Its content now is backed up first.`], go: "Put it back", tone: "stop",
                    run: async () => { const x = await convertPost(API, { action: "cms-restore", backupId: b.id }); if (!x.ok) setErr(x.error); reload(); return true; } })}>Put it back</Button>
                )}
              </Box>
            ))}
          </Box>
        )}
      </GlassCard>
      <ConfirmDialog c={confirm} onClose={() => setConfirm(null)} />
    </Box>
  );
}

export default function Ship() {
  const [tick, setTick] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const url = `${API}?n=${tick}`;
  const held = useHeld<ListData>(url, [url]);
  const r = held.result;
  const list = r?.state === "ok" ? r.data.tests : [];
  useEffect(() => {
    // the address can name one: /website/ai-personalization/ship?test=12
    const q = new URLSearchParams(window.location.search).get("test");
    if (q && /^\d+$/.test(q)) setSel(q);
  }, []);
  useEffect(() => { if (!sel && list.length) setSel(list[0].id); }, [list, sel]);

  let body: React.ReactNode;
  if (r === null) body = <LoadingPanel label="Reading the tests that were won…" />;
  else if (r.state !== "ok") body = <UpstreamPanel source="Ship" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? (r.status ?? null) : null} onRetry={() => setTick((x) => x + 1)} />;
  else if (!list.length) {
    body = (
      <>
        <GatewayNotice g={r.data.gateway} />
        <GlassCard>
          <Typography sx={{ fontSize: "0.9rem", color: INK, fontWeight: 600 }}>Nothing to ship yet.</Typography>
          <Typography sx={{ fontSize: "0.84rem", color: MUTED, mt: 0.5 }}>
            A version lands here when it wins its test - see the <Box component={Link} href="/website/ab-testing/pages" sx={{ color: ACCENT, fontWeight: 600 }}>Page tests</Box>.
          </Typography>
        </GlassCard>
      </>
    );
  } else {
    body = (
      <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "minmax(0,1fr)", lg: "320px minmax(0,1fr)" }, alignItems: "start" }}>
        <GlassCard sx={{ p: 1.5 }}>
          <CardTitle icon={<EmojiEventsOutlinedIcon />} tint="green" title={`Won · ${list.length}`} />
          <Box sx={{ display: "grid", gap: 0.75, mt: -1 }}>
            {list.map((t) => {
              const on = t.id === sel;
              const live = t.shippedAs && (t.shippedAs.status === "running" || t.shippedAs.status === "paused");
              return (
                <Box key={t.id} component="button" type="button" onClick={() => setSel(t.id)} aria-pressed={on} sx={{
                  all: "unset", cursor: "pointer", display: "grid", gap: 0.4, p: 1.25, borderRadius: "12px", minWidth: 0,
                  border: `1px solid ${on ? ACCENT : HAIRLINE}`, bgcolor: on ? "rgba(36,89,209,.05)" : "rgba(255,255,255,.65)",
                  "&:focus-visible": { outline: `2px solid ${ACCENT}`, outlineOffset: 2 },
                }}>
                  <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: on ? ACCENT : INK, ...clip(1000) }}>{t.name}</Typography>
                  <Typography sx={{ fontSize: "0.74rem", color: MUTED, ...clip(1000) }}>{t.pages[0]}</Typography>
                  <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", alignItems: "center" }}>
                    {envChip(t.env)}
                    {live ? <Chip tint="purple">On for everyone</Chip> : t.winner === "b" ? <Chip tint="green">Decided</Chip> : <Chip tint="amber">To decide</Chip>}
                    {t.figures?.counted && <Typography sx={{ fontSize: "0.74rem", color: GREEN, fontWeight: 700 }}>{signed(t.figures.uplift.mid)}</Typography>}
                    <Typography sx={{ fontSize: "0.72rem", color: MUTED, ml: "auto" }}>{since(t.decidedAt ?? t.updatedAt)}</Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </GlassCard>
        {sel ? <ShipOne key={sel} id={sel} onChanged={() => setTick((x) => x + 1)} /> : null}
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader
        title="Ship"
        subtitle="The versions that won their test: on for everyone, as code for dotSource, or written into a Magento CMS page"
        rightSlot={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {(r === null || held.stale) && <CircularProgress size={14} sx={{ color: MUTED }} />}
            <Tooltip title="Ask again"><IconButton size="small" onClick={() => setTick((x) => x + 1)} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton></Tooltip>
          </Box>
        }
      />
      {body}
    </Box>
  );
}
