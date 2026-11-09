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
import WebAssetOutlinedIcon from "@mui/icons-material/WebAssetOutlined";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { ACCENT, CardTitle, GREEN, GlassCard, HAIRLINE, INK, MUTED, Notice, clip } from "@/app/uc/report/ui";
import { ago } from "@/app/connectors/parts";
import { Chip } from "@/app/website/ai-personalization/Tag";
import { ENVS, KIND_LABEL, type Env } from "@/lib/convert/model";
import { markerOf, projectForPage } from "@/lib/convert/handoff";
import type { CmsBackup } from "@/lib/convert/cms";
import { convertPost, previewHref } from "../Flow";
import { PageShot } from "../PageShot";
import { ConfirmDialog, GatewayNotice, dayTime, envChip, n, pct, signed, type Confirm, type GatewayView, type TestView } from "../TestParts";

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
  const [project, setProject] = useState<{ id: number; type: string } | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/content/projects?scope=visible").then((x) => x.json()).then((j: { ok?: boolean; projects?: { id: number; brief: string | null; content_type?: string; contentType?: string }[] }) => {
      if (!live || !j.ok) return;
      const mine = (j.projects ?? []).find((p) => markerOf(p.brief)?.testId === id);
      setProject(mine ? { id: mine.id, type: mine.content_type ?? mine.contentType ?? "page-refresh" } : null);
    }).catch(() => { /* no Content access: no link */ });
    return () => { live = false; };
  }, [id, tick]);
  if (r === null) return <LoadingPanel label="Reading the test, its code and its pages…" />;
  if (r.state !== "ok") return <UpstreamPanel source="Winners" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? (r.status ?? null) : null} onRetry={() => setTick((x) => x + 1)} />;
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
      test: { id: t.id, rateA: f?.rateA ?? null, rateB: f?.rateB ?? null, uplift: f?.uplift.mid ?? null, pB: f?.pB ?? null, visitors: f ? f.visitors.a + f.visitors.b : null, days: f?.days ?? null, decidedBy: t.decidedBy, decidedAt: t.decidedAt },
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
          <Button size="small" component={Link} href={`/website/ai-personalization/tests/${t.id}`}>The test</Button>
          <Button size="small" component={Link} href={previewHref(t.env, t.pages[0], t.ideaId ?? undefined)}>See it</Button>
          {d.canEdit && t.winner === null && (
            <Button size="small" variant="contained" color="success" disableElevation onClick={() => setConfirm({
              title: "End the test: the version won?", lines: ["The test stops - every visitor sees the page as it is until it is published from Content."], go: "The version won",
              run: () => post({ action: "decide" }),
            })}>Decide: the version won</Button>
          )}
        </Box>
      </GlassCard>

      {/* PUBLISHED FROM CONTENT (SARCLA 08.11.2026: "Ship should not come from here; content publish should go to Content,
          where we should be able to visualise, even slightly edit with AI recommendations") - src/lib/convert/winner.ts */}
      <GlassCard sx={{ borderLeft: `3px solid ${GREEN}` }}>
        <CardTitle icon={<EditNoteOutlinedIcon />} tint="green" title="Publish it from Content"
          note="Content shows the winner laid over the page, lets you adjust it with the AI - a change after the test is marked as not tested - and publishes it once approved" />
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", mt: 1.25 }}>
          {project
            ? <Button variant="contained" disableElevation component={Link} href={`/create?project=${project.id}&type=${project.type}`} startIcon={<EditNoteOutlinedIcon sx={{ fontSize: 18 }} />} sx={{ borderRadius: "6px", textTransform: "none", fontWeight: 700 }}>Open it in Content</Button>
            : d.canContent
              ? <Button variant="contained" disableElevation disabled={sending || t.winner !== "b"} onClick={() => void toContent()} startIcon={sending ? <CircularProgress size={14} sx={{ color: "inherit" }} /> : <EditNoteOutlinedIcon sx={{ fontSize: 18 }} />} sx={{ borderRadius: "6px", textTransform: "none", fontWeight: 700 }}>Hand it over to Content</Button>
              : <Tooltip title="Content Studio needs the Marketing access"><span><Button variant="contained" disabled>Hand it over to Content</Button></span></Tooltip>}
          <Typography sx={{ fontSize: "0.8rem", color: MUTED, flex: "1 1 280px" }}>
            {t.winner !== "b" ? "Decide the test first (above) - only a winner goes to Content." : project ? `In Content as project #${project.id}.` : "One project per winner: its figures, its change list and the page come along."}
          </Typography>
        </Box>
      </GlassCard>

      {live && (
        <GlassCard>
          <CardTitle icon={<PublicOutlinedIcon />} tint="purple" title="On for everyone" note="Through the shop's gateway, on the test's pages" />
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: "0.86rem", color: INK, flex: "1 1 300px" }}>On for everyone on {t.host} since {dayTime(d.shippedAs!.startedAt)}{d.shippedAs!.startedBy ? ` (${d.shippedAs!.startedBy})` : ""} - <Box component={Link} href="/website/ai-personalization/personalise" sx={{ color: ACCENT }}>personalisation #{d.shippedAs!.id}</Box>.</Typography>
            {d.canEdit && <Button size="small" color="error" onClick={() => setConfirm({ title: "Switch it off for everyone?", lines: ["Everyone sees the page as it is again, at once."], go: "Switch off", tone: "stop", run: () => post({ action: "undo" }) })}>Switch off</Button>}
          </Box>
        </GlassCard>
      )}

      {d.backups.length > 0 && (
        <GlassCard>
          <CardTitle icon={<WebAssetOutlinedIcon />} tint="amber" title="Written into Magento" note="Every write kept its backup - a page can be put back as it was" />
          {d.backups.map((b) => (
            <Box key={b.id} sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", py: 0.5, borderBottom: `1px solid ${HAIRLINE}` }}>
              <Typography sx={{ fontSize: "0.78rem", color: INK, flex: "1 1 280px" }}>#{b.id} · {ENVS[b.env].label} · &quot;{b.identifier}&quot; · {b.kind === "restore" ? "put back" : "written"} {dayTime(b.at)} by {b.by ?? "–"}{b.error ? ` · failed: ${b.error}` : b.written ? "" : " · not written"}</Typography>
              {d.canEdit && b.written && b.kind === "write" && (
                <Button size="small" onClick={() => setConfirm({ title: "Put the page back as it was?", lines: [`The CMS page "${b.identifier}" on ${ENVS[b.env].label} gets its content from before backup #${b.id}. Its content now is backed up first.`], go: "Put it back", tone: "stop",
                  run: async () => { const x = await convertPost(API, { action: "cms-restore", backupId: b.id }); if (!x.ok) setErr(x.error); reload(); return true; } })}>Put it back</Button>
              )}
            </Box>
          ))}
        </GlassCard>
      )}
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
  else if (r.state !== "ok") body = <UpstreamPanel source="Winners" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? (r.status ?? null) : null} onRetry={() => setTick((x) => x + 1)} />;
  else if (!list.length) {
    body = (
      <>
        <GatewayNotice g={r.data.gateway} />
        <GlassCard>
          <Typography sx={{ fontSize: "0.9rem", color: INK, fontWeight: 600 }}>No winner yet.</Typography>
          <Typography sx={{ fontSize: "0.84rem", color: MUTED, mt: 0.5 }}>
            A version lands here when it wins its test - see the <Box component={Link} href="/website/ai-personalization/tests" sx={{ color: ACCENT, fontWeight: 600 }}>Tests</Box>.
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
                  {t.pages[0] && <Box sx={{ borderRadius: "8px", overflow: "hidden", border: `1px solid ${HAIRLINE}`, mb: 0.5 }}><PageShot env={t.env} path={t.pages[0]} ratio={0.42} /></Box>}
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
        title="Winners"
        subtitle="The versions that won their test - handed to Content, where they are seen on the page, adjusted with the AI and published"
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
