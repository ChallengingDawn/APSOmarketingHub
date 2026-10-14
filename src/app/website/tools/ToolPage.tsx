"use client";

// A SHOP TOOL'S PAGE - O-Ring Expert, shaft-seal expert, compatibility table, vulcanised O-rings, one page each
// under Website > Microservices (SARCLA, 14.10.2026: "a gateway service for each one", "one page per tool"). The
// same component for the four, in the UC apps' kit like DirectUP and 3D files: the hub-wide period on top, the
// tab in the #fragment, glass cards, KPI tiles. Overview = how much it is used, where; Settings = its gateway,
// its page on the shop read live (production or ACC), and the snippet to paste.

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import RefreshIcon from "@mui/icons-material/Refresh";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import ManageSearchOutlinedIcon from "@mui/icons-material/ManageSearchOutlined";
import AdsClickOutlinedIcon from "@mui/icons-material/AdsClickOutlined";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import SearchOffOutlinedIcon from "@mui/icons-material/SearchOffOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import BarChartOutlinedIcon from "@mui/icons-material/BarChartOutlined";
import DnsOutlinedIcon from "@mui/icons-material/DnsOutlined";
import RouterOutlinedIcon from "@mui/icons-material/RouterOutlined";
import CodeOutlinedIcon from "@mui/icons-material/CodeOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, NotConnectedPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { ACCENT, CardTitle, FAINT, GREEN, GlassCard, HAIRLINE, INK, KpiTile, MUTED, Notice, RED, type Tint } from "@/app/uc/report/ui";
import { Chip, Choice } from "@/app/connectors/parts";
import { ReportTabs, useHashTab } from "@/app/uc/report/Tabs";
import { WindowPicker, isoDate, shiftIso, spanDays, useReportingWindow, type ReportingWindow } from "@/app/window/ReportingWindow";
import { Bars, when } from "@/app/website/directup/shared";
import { CURRENT_BRIDGE } from "@/lib/directup/bridge";
import { SHOP_TOOLS, type ShopToolKey, type ToolEvents, type ToolSnippet, type ToolStatus, type ToolUsage } from "@/lib/shopTools/tools";
import type { ToolSetting } from "@/lib/shopTools/gateway";
import type { ShopHost, ToolCheck, ToolStoreCheck } from "@/lib/shopTools/check";

type View = "overview" | "settings";
const VIEW_HASH: Record<View, string> = { overview: "#overview", settings: "#settings" };
type Overview = { setting: ToolSetting; status: ToolStatus; usage: ToolUsage; events: ToolEvents | null; isAdmin: boolean };

const shopOf = (s: string) => (s === "www.apsoparts.com" || s === "apsoparts.com" ? "production" : s.startsWith("acc.") ? "ACC" : s === "direct" ? "outside the shop" : s);
const pill = { borderRadius: "999px", textTransform: "none" as const, fontWeight: 600 };

/** Every day of the period (weekly beyond 90 days): page opens and searches. */
function series(rows: ToolUsage["rows"], win: ReportingWindow) {
  const by = new Map<string, { page: number; search: number; detail: number }>();
  for (const r of rows) {
    const d = by.get(r.day) ?? { page: 0, search: 0, detail: 0 };
    d[r.kind] += r.n; by.set(r.day, d);
  }
  const weekly = spanDays(win.from, win.to) > 90;
  const dm = (iso: string) => iso.slice(5).split("-").reverse().join(".");
  const out: { label: string; page: number; search: number; detail: number }[] = [];
  for (let day = win.from; day <= win.to; day = shiftIso(day, 1)) {
    const v = by.get(day) ?? { page: 0, search: 0, detail: 0 };
    const monday = shiftIso(day, -((new Date(`${day}T12:00:00`).getDay() + 6) % 7));
    const label = weekly ? `week of ${dm(monday < win.from ? win.from : monday)}` : dm(day);
    const last = out[out.length - 1];
    if (weekly && last && last.label === label) { last.page += v.page; last.search += v.search; last.detail += v.detail; }
    else out.push({ label, ...v });
  }
  return out;
}

/** What visitors searched and clicked inside the tool, as the page reported it (the compatibility table, SARCLA
 *  14.10.2026: "should have more KPI as product searched and product clicks"). */
function useEvents(ev: ToolEvents | null, win: ReportingWindow) {
  return useMemo(() => {
    const rows = (ev?.rows ?? []).filter((r) => r.day >= win.from && r.day <= win.to);
    const sum = (k: string) => rows.filter((r) => r.kind === k).reduce((a, r) => a + r.n, 0);
    const top = (kinds: string[], n = 10) => {
      const m = new Map<string, { n: number; nohit: boolean }>();
      for (const r of rows.filter((x) => kinds.includes(x.kind))) {
        const had = m.get(r.label) ?? { n: 0, nohit: false };
        m.set(r.label, { n: had.n + r.n, nohit: had.nohit || r.kind === "nohit" });
      }
      return [...m.entries()].map(([label, v]) => ({ label, ...v })).sort((a, b) => b.n - a.n).slice(0, n);
    };
    return {
      searches: sum("search") + sum("nohit"), nohit: sum("nohit"), products: sum("product"), materials: sum("material"),
      chemicals: sum("chemical"), pins: sum("pin"),
      topSearched: top(["search", "nohit"]), topNohit: top(["nohit"]), topProducts: top(["product"]), topChemicals: top(["chemical", "pin"]),
    };
  }, [ev, win.from, win.to]);
}

function EventLists({ e, label }: { e: ReturnType<typeof useEvents>; label: string }) {
  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 6 }}>
        <GlassCard sx={{ height: "100%" }}>
          <CardTitle icon={<ManageSearchOutlinedIcon />} tint="purple" title="Most searched" note={`What visitors typed · red: nothing matched · ${label}`} />
          <Bars rows={e.topSearched.map((x) => ({ label: x.label, n: x.n, colour: x.nohit ? RED : undefined, note: x.nohit ? "nothing found" : undefined }))} />
        </GlassCard>
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <GlassCard sx={{ height: "100%" }}>
          <CardTitle icon={<AdsClickOutlinedIcon />} tint="green" title="Products clicked" note={`Opened in the shop from the tool · ${label}`} />
          <Bars colour={GREEN} rows={e.topProducts.map((x) => ({ label: x.label, n: x.n }))} />
        </GlassCard>
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <GlassCard sx={{ height: "100%" }}>
          <CardTitle icon={<ScienceOutlinedIcon />} tint="blue" title="Chemicals opened" note={`Clicked for the materials that resist them, or pinned to compare · ${label}`} />
          <Bars rows={e.topChemicals.map((x) => ({ label: x.label, n: x.n }))} />
        </GlassCard>
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <GlassCard sx={{ height: "100%" }}>
          <CardTitle icon={<SearchOffOutlinedIcon />} tint="pink" title="Searched, nothing found" note={`Chemicals the table does not know yet - candidates to add · ${label}`} />
          <Bars colour={RED} rows={e.topNohit.map((x) => ({ label: x.label, n: x.n }))} />
        </GlassCard>
      </Grid>
    </Grid>
  );
}

function OverviewTab({ o, toolKey, win, label }: { o: Overview; toolKey: ShopToolKey; win: ReportingWindow; label: string }) {
  const tool = SHOP_TOOLS[toolKey];
  const rows = useMemo(() => o.usage.rows.filter((r) => r.day >= win.from && r.day <= win.to), [o.usage.rows, win.from, win.to]);
  const sum = (kind: string, f: (r: ToolUsage["rows"][number]) => boolean = () => true) => rows.filter((r) => r.kind === kind && f(r)).reduce((a, r) => a + r.n, 0);
  const opened = sum("page"), prod = sum("page", (r) => shopOf(r.shop) === "production"), acc = sum("page", (r) => shopOf(r.shop) === "ACC");
  const s = useMemo(() => series(o.usage.rows, win), [o.usage.rows, win]);
  const max = Math.max(1, ...s.map((x) => x.page));
  const where = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows.filter((x) => x.kind === "page")) {
      const k = r.locale ? `${r.locale} · ${shopOf(r.shop)}` : shopOf(r.shop);
      m.set(k, (m.get(k) ?? 0) + r.n);
    }
    return [...m.entries()].map(([lbl, n]) => ({ label: lbl, n })).sort((a, b) => b.n - a.n);
  }, [rows]);
  const st = o.status;
  const e = useEvents(o.events, win);
  const kpi = o.events ? { xs: 12, sm: 6, lg: 2.4 } : { xs: 12, sm: 6, lg: 3 };

  return (
    <>
      <Grid container spacing={2}>
        <Grid size={kpi}><KpiTile icon={<VisibilityOutlinedIcon />} tint="blue" label="Opened" value={full(opened)} note={`${full(prod)} on production · ${full(acc)} on ACC${opened - prod - acc ? ` · ${full(opened - prod - acc)} outside the shop` : ""}`} /></Grid>
        {o.events && <Grid size={kpi}><KpiTile icon={<ManageSearchOutlinedIcon />} tint="purple" label="Searches" value={full(e.searches)} note={e.searches ? `${full(e.nohit)} found nothing` : label} /></Grid>}
        {o.events && <Grid size={kpi}><KpiTile icon={<AdsClickOutlinedIcon />} tint="green" label="Product clicks" value={full(e.products)} note={`and ${full(e.materials)} material ${e.materials === 1 ? "page" : "pages"} opened`} /></Grid>}
        {o.events && <Grid size={kpi}><KpiTile icon={<ScienceOutlinedIcon />} tint="amber" label="Chemicals opened" value={full(e.chemicals)} note={`${full(e.pins)} pinned to compare`} /></Grid>}
        {tool.counts.search && <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<ManageSearchOutlinedIcon />} tint="purple" label={tool.counts.search} value={full(sum("search"))} note={opened ? `${(sum("search") / opened).toFixed(1)} per opening` : label} /></Grid>}
        {tool.counts.detail && <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<FactCheckOutlinedIcon />} tint="green" label={tool.counts.detail} value={full(sum("detail"))} note={label} /></Grid>}
        <Grid size={kpi}><KpiTile icon={<DnsOutlinedIcon />} tint="slate" label="Gateway" value={st.version.replace(/^deploy-/, "")}
          note={`${st.data ? `${full(st.data.articles)} articles, built ${st.data.built ?? "?"} · ` : ""}running for ${Math.round(st.uptimeS / 3600)} h`} /></Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <GlassCard sx={{ height: "100%" }}>
            <CardTitle icon={<BarChartOutlinedIcon />} tint="blue" title={spanDays(win.from, win.to) > 90 ? "Opened per week" : "Opened per day"}
              note={`${label} · counted since 14.10.2026, when the tool moved to its own gateway`} />
            {opened === 0 && <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Not opened in {label.toLowerCase()}.</Typography>}
            {opened > 0 && (
              <>
                <Box sx={{ display: "flex", alignItems: "flex-end", gap: "2px", height: 150 }}>
                  {s.map((x) => (
                    <Tooltip key={x.label} arrow title={`${x.label}: opened ${x.page}${tool.counts.search ? `, ${x.search} searches` : ""}${tool.counts.detail ? `, ${x.detail} opened in full` : ""}`}>
                      <Box sx={{ flex: "1 1 0", minWidth: 0, height: x.page ? `${Math.max(4, (x.page / max) * 100)}%` : "2px", bgcolor: x.page ? ACCENT : "rgba(21,34,58,.10)", borderRadius: "4px 4px 0 0" }} />
                    </Tooltip>
                  ))}
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.75 }}>
                  <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>{s[0]?.label}</Typography>
                  <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>{s[s.length - 1]?.label}</Typography>
                </Box>
              </>
            )}
          </GlassCard>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <GlassCard sx={{ height: "100%" }}>
            <CardTitle icon={<StorefrontOutlinedIcon />} tint="amber" title="Where it was opened" note={`Store view and shop · ${label}`} />
            <Bars rows={where} />
          </GlassCard>
        </Grid>
      </Grid>
      {o.events && <EventLists e={e} label={label} />}
    </>
  );
}

function Copy({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <Tooltip title={done ? "Copied" : "Copy to paste"} arrow>
      <IconButton size="small" aria-label="Copy" onClick={() => { void navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }); }}>
        <ContentCopyIcon sx={{ fontSize: 16, color: done ? GREEN : MUTED }} />
      </IconButton>
    </Tooltip>
  );
}

function OnTheShop({ toolKey, setting, isAdmin, reload }: { toolKey: ShopToolKey; setting: ToolSetting; isAdmin: boolean; reload: () => void }) {
  const [host, setHost] = useState<ShopHost>("www");
  const [n, setN] = useState(0);
  const [path, setPath] = useState(setting.shopPath ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const held = useHeld<ToolCheck | null>(`/api/website/tools/${toolKey}?part=check&shop=${host}${n ? `&refresh=1&n=${n}` : ""}&p=${encodeURIComponent(setting.shopPath ?? "")}`, [host, n, setting.shopPath]);
  const r = held.result;
  const savePath = async () => {
    setMsg(null);
    const res = await fetch(`/api/website/tools/${toolKey}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "path", path }) });
    const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; data?: { path: string } };
    setMsg(j.ok ? { ok: true, text: `Saved: /<store view>/${j.data?.path}` } : { ok: false, text: j.error ?? `HTTP ${res.status}` });
    if (j.ok) reload();
  };
  const foot = (s: ToolStoreCheck): { label: string; tint: Tint } =>
    !s.footer ? { label: "No bridge", tint: "pink" } : s.footer === CURRENT_BRIDGE ? { label: s.footer, tint: "green" } : { label: `${s.footer} · older`, tint: "amber" };
  const page = (s: ToolStoreCheck): { label: string; tint: Tint } =>
    s.page === "this" ? { label: "This gateway", tint: "green" } : s.page === "pricinghub" ? { label: "Still PricingHub", tint: "amber" } : s.page === "other" ? { label: "Another address", tint: "amber" } : { label: "Not on the page", tint: "slate" };
  const data = r?.state === "ok" ? r.data : null;
  const good = (s: ToolStoreCheck) => !s.error && s.footer === CURRENT_BRIDGE && s.page === "this";
  return (
    <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
      <Box sx={{ px: { xs: 2, md: 2.75 } }}>
        <CardTitle icon={<StorefrontOutlinedIcon />} tint="green" title="On the shop"
          note="Its page in every store view, read live - what customers get. The footer bridge gives the frame its height."
          right={
            <Tooltip title="Read the shop's pages again">
              <IconButton size="small" onClick={() => setN((x) => x + 1)} aria-label="Check again">
                {r === null || held.stale ? <CircularProgress size={14} sx={{ color: MUTED }} /> : <RefreshIcon sx={{ fontSize: 18, color: MUTED }} />}
              </IconButton>
            </Tooltip>
          } />
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); if (isAdmin) void savePath(); }}
          sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center", mb: 1.5 }}>
          <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>apsoparts.com/&lt;store view&gt;/</Typography>
          <TextField size="small" value={path} onChange={(e) => setPath(e.target.value)} disabled={!isAdmin} placeholder="the page's address, e.g. vulcanised-o-rings"
            inputProps={{ "aria-label": "The page's address on the shop", spellCheck: false }} sx={{ flex: "1 1 260px", maxWidth: 420 }} />
          {isAdmin && <Button type="submit" variant="contained" disableElevation disabled={path.trim() === (setting.shopPath ?? "")} sx={pill}>Save</Button>}
          <Box sx={{ ml: { md: "auto" } }}>
            <Choice value={host} onChange={setHost} options={[{ key: "www", label: "Production" }, { key: "acc", label: "ACC" }]} />
          </Box>
        </Box>
        {msg && <Typography sx={{ fontSize: "0.84rem", color: msg.ok ? GREEN : RED, mb: 1 }}>{msg.text}</Typography>}
        {!setting.shopPath && <Typography sx={{ fontSize: "0.84rem", color: MUTED, pb: 2 }}>No page on the shop yet. When there is one, give its address above and the check reads it in every store view.</Typography>}
        {setting.shopPath && r === null && <Typography sx={{ fontSize: "0.84rem", color: MUTED, pb: 2 }}>Reading the shop&apos;s pages - about ten seconds…</Typography>}
        {r && r.state !== "ok" && <Typography sx={{ fontSize: "0.84rem", color: RED, pb: 2 }}>{r.state === "error" ? r.error : "not configured"}</Typography>}
        {data && (
          <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: data.stores.every(good) ? GREEN : "#a96a12", pb: 1.25 }}>
            {data.stores.every(good)
              ? `All ${data.stores.length} store views frame this gateway under the current footer (${host === "www" ? "production" : "ACC"}, read ${when(data.checkedAt)}).`
              : `${data.stores.filter((x) => !good(x)).length} of ${data.stores.length} store views need the page snippet or the footer (${host === "www" ? "production" : "ACC"}, read ${when(data.checkedAt)}).`}
          </Typography>
        )}
      </Box>
      {data?.stores.map((s) => (
        <Box key={s.locale} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0,0.7fr) minmax(0,1fr) minmax(0,1.2fr) auto" }, gap: 1, alignItems: "center", px: { xs: 2, md: 2.75 }, py: 1.1, borderTop: `1px solid ${HAIRLINE}` }}>
          <Typography sx={{ fontSize: "0.88rem", fontWeight: 600, color: INK }}>{s.locale}</Typography>
          {s.error
            ? <Typography sx={{ gridColumn: { md: "span 2" }, fontSize: "0.8rem", color: s.error.includes("404") ? MUTED : RED }}>{s.error.includes("404") ? "No such page in this store view" : `Could not read: ${s.error}`}</Typography>
            : (
              <>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}><Typography component="span" sx={{ fontSize: "0.74rem", color: FAINT, width: 44 }}>Footer</Typography><Chip tint={foot(s).tint}>{foot(s).label}</Chip></Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }} title={s.pageOrigin ?? ""}><Typography component="span" sx={{ fontSize: "0.74rem", color: FAINT, width: 36 }}>Page</Typography><Chip tint={page(s).tint}>{page(s).label}</Chip></Box>
              </>
            )}
          <Tooltip title="Open this store view's page" arrow>
            <IconButton size="small" component="a" href={s.url} target="_blank" rel="noopener" aria-label={`Open the ${s.locale} page`} sx={{ justifySelf: { md: "end" } }}>
              <OpenInNewIcon sx={{ fontSize: 16, color: MUTED }} />
            </IconButton>
          </Tooltip>
        </Box>
      ))}
    </GlassCard>
  );
}

function SettingsTab({ toolKey, o, reload }: { toolKey: ShopToolKey; o: Overview; reload: () => void }) {
  const tool = SHOP_TOOLS[toolKey];
  const [url, setUrl] = useState(o.setting.url);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const held = useHeld<{ setting: ToolSetting; snippet: ToolSnippet; isAdmin: boolean }>(`/api/website/tools/${toolKey}?part=snippet&u=${encodeURIComponent(o.setting.url)}`, [o.setting.url]);
  const r = held.result;
  const saveUrl = async () => {
    setMsg(null);
    const res = await fetch(`/api/website/tools/${toolKey}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "gateway", url }) });
    const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    setMsg(j.ok ? { ok: true, text: "Saved. The hub reads the tool there; paste the page snippet again." } : { ok: false, text: j.error ?? `HTTP ${res.status}` });
    if (j.ok) reload();
  };
  return (
    <>
      <GlassCard>
        <CardTitle icon={<RouterOutlinedIcon />} tint="blue" title="Gateway address" note={`Where ${tool.name} runs - its own Railway service`} />
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); if (o.isAdmin) void saveUrl(); }} sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
          <TextField size="small" value={url} onChange={(e) => setUrl(e.target.value)} disabled={!o.isAdmin} sx={{ flex: "1 1 320px", maxWidth: 560 }} inputProps={{ "aria-label": "Gateway address", spellCheck: false }} />
          {o.isAdmin && <Button type="submit" variant="contained" disableElevation disabled={url.trim() === o.setting.url} sx={pill}>Save</Button>}
          <Button size="small" endIcon={<OpenInNewIcon sx={{ fontSize: 15 }} />} href={`${o.setting.url}/landing/tools/${tool.page}`} target="_blank" rel="noopener" sx={{ textTransform: "none", fontWeight: 600 }}>Open the tool</Button>
        </Box>
        <Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: 1.25 }}>
          {o.setting.fromDefault ? "The Railway default." : `Set by ${o.setting.by} on ${when(o.setting.at)}.`} After a move: set the new address, paste the page snippet again{o.isAdmin ? "" : " (an admin changes it)"}.
        </Typography>
        {msg && <Typography sx={{ fontSize: "0.84rem", color: msg.ok ? GREEN : RED, mt: 1 }}>{msg.text}</Typography>}
      </GlassCard>

      <OnTheShop toolKey={toolKey} setting={o.setting} isAdmin={o.isAdmin} reload={reload} />

      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 } }}>
          <CardTitle icon={<CodeOutlinedIcon />} tint="amber" title="Page snippet"
            note={r?.state === "ok" ? `Made for ${r.data.snippet.url.replace(/^https:\/\//, "")} · gateway ${r.data.snippet.version}` : "What to paste into the tool's CMS page"}
            right={r?.state === "ok" ? <Copy text={r.data.snippet.page} /> : undefined} />
          <Typography sx={{ fontSize: "0.8rem", color: MUTED, mb: 1 }}>
            Magento: Content &gt; Pages &gt; the tool&apos;s page, editor OFF or a PageBuilder &quot;HTML Code&quot; element - the same block for every store view.
            The frame takes its height from the footer bridge {CURRENT_BRIDGE} (Website &gt; Microservices &gt; DirectUP &gt; Settings): paste that footer first.
          </Typography>
          {r === null && <Box sx={{ pb: 2 }}><CircularProgress size={16} /></Box>}
          {r && r.state !== "ok" && <Typography sx={{ fontSize: "0.84rem", color: RED, pb: 2 }}>{r.state === "error" ? r.error : "not configured"}</Typography>}
          {r?.state === "ok" && (
            <Box component="pre" sx={{ m: 0, mb: 2.5, p: 1.25, maxHeight: 220, overflow: "auto", bgcolor: "#f6f8fa", border: `1px solid ${HAIRLINE}`, borderRadius: "12px", fontSize: "0.72rem", lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
              {r.data.snippet.page}
            </Box>
          )}
        </Box>
      </GlassCard>
    </>
  );
}

export default function ToolPage({ tool: toolKey }: { tool: ShopToolKey }) {
  const tool = SHOP_TOOLS[toolKey];
  const [view, setView] = useHashTab<View>(VIEW_HASH, "overview");
  const { window: win, label } = useReportingWindow();
  const back = Math.min(400, spanDays(win.from, isoDate(new Date())));
  const [forced, setForced] = useState(0);
  const url = `/api/website/tools/${toolKey}?part=overview&days=${back}&n=${forced}`;
  const held = useHeld<Overview>(url, [url]);
  const r = held.result;
  const reload = () => setForced((n) => n + 1);

  let body: React.ReactNode;
  if (r === null) body = <LoadingPanel label={`Reading the ${tool.name} gateway…`} />;
  else if (r.state === "not-configured") body = <NotConnectedPanel source={`${tool.name} gateway`} missing={r.missing} />;
  else if (r.state === "error") body = <UpstreamPanel source={`${tool.name} gateway`} error={r.error} status={r.status} onRetry={reload} />;
  else body = (
    <Box id={`${toolKey}-panel-${view}`} role="tabpanel" sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>
      {view === "settings" ? <SettingsTab toolKey={toolKey} o={r.data} reload={reload} /> : <OverviewTab o={r.data} toolKey={toolKey} win={win} label={label} />}
    </Box>
  );

  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader
        title={tool.name}
        subtitle={tool.what}
        rightSlot={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {(r === null || held.stale) && <CircularProgress size={14} sx={{ color: MUTED }} />}
            {view === "overview" && <WindowPicker />}
            <Tooltip title="Ask the gateway again"><IconButton size="small" onClick={reload} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton></Tooltip>
          </Box>
        }
      />
      <Box>
        <ReportTabs name={toolKey} tab={view} onSelect={setView} tabs={[
          { id: "overview", label: "Overview", count: null },
          { id: "settings", label: "Settings", count: null },
        ]} />
      </Box>
      {r?.state === "ok" && r.data.setting.fromDefault === false && r.data.setting.url !== tool.gateway && (
        <Notice tone="warn">This page reads the tool at {r.data.setting.url}, not at its Railway default {tool.gateway}.</Notice>
      )}
      {body}
    </Box>
  );
}
