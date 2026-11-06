"use client";

// 3D files > Settings (SARCLA, 13.10.2026: "as on DirectUP, put a settings tab for it"). The 3D
// gateway's address, and every place that names it, checked live: green = names this address, red =
// still the old one. Moving the Railway service = set the new address here, paste the snippets the
// rows hand out into Magento, upload the HubSpot card, and wait for every row to turn green.
// Same kit as the UC apps.
// On top: the AP-Link switch (SARCLA, 06.11.2026: "put the switch on settings on the HUB itself") -
// production or the test system, each with how it answers right now.

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RefreshIcon from "@mui/icons-material/Refresh";
import RouterOutlinedIcon from "@mui/icons-material/RouterOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import CloudOutlinedIcon from "@mui/icons-material/CloudOutlined";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import DashboardCustomizeOutlinedIcon from "@mui/icons-material/DashboardCustomizeOutlined";
import SwapHorizOutlinedIcon from "@mui/icons-material/SwapHorizOutlined";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { CardTitle, GREEN, GlassCard, HAIRLINE, INK, MUTED, Notice, RED, type Tint } from "@/app/uc/report/ui";
import { Chip, Choice, Info } from "@/app/connectors/parts";
import type { GatewaySetting, Place } from "@/lib/threeD/gateway";
import type { PlaceState } from "@/lib/threeD/places";
import type { AplinkSetting } from "@/lib/threeD/aplink";
import type { AplinkProbe, AplinkTarget, GatewayStatus } from "@/lib/threeD/gwApi";

type Data = { setting: GatewaySetting; places: Place[]; checkedAt: string; isAdmin: boolean };

const STATE: Record<PlaceState, { label: string; tint: Tint }> = {
  ok: { label: "This address", tint: "green" },
  follows: { label: "Follows its own address", tint: "green" },
  old: { label: "Another address", tint: "pink" },
  missing: { label: "Not found", tint: "slate" },
  error: { label: "Could not read", tint: "amber" },
  manual: { label: "Change by hand", tint: "slate" },
};

const GROUP: Record<Place["group"], { icon: React.ReactNode; tint: Tint; note: string }> = {
  "Shop (Magento)": { icon: <StorefrontOutlinedIcon />, tint: "amber", note: "Read from the live shop pages - paste the snippet where a row is red. The 3D CAD pages take the same snippet in every store view" },
  "Served by the gateway": { icon: <CloudOutlinedIcon />, tint: "blue", note: "The files the gateway serves, and the address written inside them" },
  HubSpot: { icon: <HubOutlinedIcon />, tint: "purple", note: "The hub's own HubSpot app - read from its source, HubSpot cannot be asked" },
  Hub: { icon: <DashboardCustomizeOutlinedIcon />, tint: "slate", note: "This hub's own settings" },
};

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" }) : "-");

function Copy({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <Tooltip title={done ? "Copied" : "Copy the snippet to paste"} arrow>
      <IconButton size="small" aria-label="Copy snippet"
        onClick={() => { void navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }); }}>
        <ContentCopyIcon sx={{ fontSize: 16, color: done ? GREEN : MUTED }} />
      </IconButton>
    </Tooltip>
  );
}

type AplinkData = { aplink: GatewayStatus["aplink"]; setting: AplinkSetting | null; isAdmin: boolean; at: string };

const SYSTEM: Record<AplinkTarget, { label: string; note: string }> = {
  production: { label: "Production", note: "AP-Link itself" },
  test: { label: "Test system", note: "A copy of production - some files can be older" },
};

function answerOf(p: AplinkProbe | undefined): { label: string; tint: Tint } {
  if (!p || !p.configured) return { label: "No login on the gateway", tint: "slate" };
  if (p.ok === null) return { label: "Not asked yet", tint: "slate" };
  return p.ok ? { label: `Answers · ${p.ms} ms`, tint: "green" } : { label: p.status ? `Refused · HTTP ${p.status}` : "Not reachable", tint: "pink" };
}

/** Production or test AP-Link: the shop's downloads, the product pages' 3D button and the HubSpot card follow. */
function AplinkCard() {
  const [n, setN] = useState(0);
  const url = n ? `/api/website/3d/aplink?refresh=1&n=${n}` : "/api/website/3d/aplink";
  const held = useHeld<AplinkData>(url, [url]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const r = held.result;
  const title = <CardTitle icon={<SwapHorizOutlinedIcon />} tint="purple" title="AP-Link source"
    note="Where the 3D files, drawings and data sheets come from"
    right={r?.state === "ok" ? (
      <Tooltip title="Ask both systems again">
        <IconButton size="small" onClick={() => setN((x) => x + 1)} aria-label="Ask both systems again">
          {held.stale ? <CircularProgress size={14} sx={{ color: MUTED }} /> : <RefreshIcon sx={{ fontSize: 18, color: MUTED }} />}
        </IconButton>
      </Tooltip>
    ) : undefined} />;

  if (r === null) return <GlassCard>{title}<Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Asking both AP-Link systems…</Typography></GlassCard>;
  if (r.state !== "ok") return <UpstreamPanel source="AP-Link source" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? r.status : null} onRetry={() => setN((x) => x + 1)} />;
  const { aplink, setting, isAdmin } = r.data;
  // a gateway from before the switch (06.11.2026) names no system: say so, offer nothing to click
  if (!aplink.target || !aplink.targets) return (
    <GlassCard>{title}<Notice tone="warn">This 3D Gateway has no AP-Link switch yet - its new version must be deployed first.</Notice></GlassCard>
  );
  const active: AplinkTarget = aplink.target;

  const choose = async (target: AplinkTarget) => {
    if (!isAdmin || busy || target === active) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/website/3d/aplink", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target }) });
      const j = (await res.json()) as { ok: boolean; error?: string };
      setMsg(j.ok ? { ok: true, text: `Switched. The 3D files now come from ${SYSTEM[target].label.toLowerCase()}.` } : { ok: false, text: j.error ?? `HTTP ${res.status}` });
      if (j.ok) setN((x) => x + 1);
    } catch (e) {
      setMsg({ ok: false, text: String((e as Error)?.message ?? e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
      <Box sx={{ px: { xs: 2, md: 2.75 } }}>
        {title}
        {active === "test" && <Notice tone="warn">The 3D files come from the test system - a copy of production, some files can be older. Switch back once production answers.</Notice>}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 1.5 }}>
          <Choice<AplinkTarget> value={active} onChange={(t) => void choose(t)}
            options={[{ key: "production", label: SYSTEM.production.label }, { key: "test", label: SYSTEM.test.label }]} />
          {busy && <CircularProgress size={16} sx={{ color: MUTED }} />}
        </Box>
        <Typography sx={{ fontSize: "0.8rem", color: MUTED, mb: 1.5 }}>
          {setting ? `Switched to ${SYSTEM[setting.target].label.toLowerCase()} by ${setting.by} on ${when(setting.at)}.` : "Not switched in the hub yet - the gateway runs on the system it started with."}
          {!isAdmin && " Only an admin can switch."}
        </Typography>
        {msg && <Typography sx={{ fontSize: "0.84rem", mb: 1.5, color: msg.ok ? GREEN : RED }}>{msg.text}</Typography>}
      </Box>
      {(["production", "test"] as const).map((t) => {
        const p = aplink.targets?.[t];
        const a = answerOf(p);
        return (
          <Box key={t} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0,1.3fr) minmax(0,1.2fr) auto" }, gap: 1, alignItems: "center", px: { xs: 2, md: 2.75 }, py: 1.5, borderTop: `1px solid ${HAIRLINE}` }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.88rem", fontWeight: 600, color: INK }}>{SYSTEM[t].label}</Typography>
              <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>{SYSTEM[t].note}</Typography>
              {p?.error && <Typography sx={{ fontSize: "0.78rem", color: MUTED, mt: 0.25 }}>{p.error}</Typography>}
            </Box>
            <Typography sx={{ fontSize: "0.78rem", color: INK, fontFamily: "ui-monospace, Menlo, Consolas, monospace", overflowWrap: "anywhere" }}>
              {p?.host ?? "-"}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, justifySelf: { md: "end" } }}>
              {t === active && <Chip tint="blue">In use</Chip>}
              <Chip tint={a.tint}>{a.label}</Chip>
            </Box>
          </Box>
        );
      })}
    </GlassCard>
  );
}

export default function SettingsTab() {
  const [n, setN] = useState(0);
  const url = n ? `/api/website/3d/settings?refresh=1&n=${n}` : "/api/website/3d/settings";
  const held = useHeld<Data>(url, [url]);
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const r = held.result;

  // the AP-Link switch first, at once: the checks below read six shop pages and take a while
  if (r === null) return <><AplinkCard /><LoadingPanel label="Reading the shop's pages and the gateway's files…" /></>;
  if (r.state !== "ok") return <><AplinkCard /><UpstreamPanel source="3D settings" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? r.status : null} onRetry={() => setN((x) => x + 1)} /></>;
  const { setting, places, checkedAt, isAdmin } = r.data;
  const value = draft ?? setting.url;
  const pending = places.filter((p) => p.state === "old" || p.state === "missing").length;

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/website/3d/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: value }) });
      const j = (await res.json()) as { ok: boolean; error?: string };
      setMsg(j.ok ? { ok: true, text: "Saved. The hub now reads the 3D service at this address; the checks below run again." } : { ok: false, text: j.error ?? `HTTP ${res.status}` });
      if (j.ok) { setDraft(null); setN((x) => x + 1); }
    } catch (e) {
      setMsg({ ok: false, text: String((e as Error)?.message ?? e) });
    } finally {
      setSaving(false);
    }
  };

  const groups = [...new Set(places.map((p) => p.group))];

  return (
    <>
      <AplinkCard />

      <GlassCard>
        <CardTitle icon={<RouterOutlinedIcon />} tint="blue" title="Gateway address"
          note="Where the public 3D service runs - Railway today. The hub reads it here; the places below name it too." />
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); if (isAdmin && !saving) void save(); }}
          sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
          <TextField size="small" value={value} onChange={(e) => setDraft(e.target.value)} disabled={!isAdmin}
            inputProps={{ "aria-label": "Gateway address", spellCheck: false }} sx={{ flex: "1 1 420px", maxWidth: 560 }} />
          {isAdmin && (
            <Button type="submit" variant="contained" disableElevation disabled={saving || value.trim() === setting.url} sx={{ borderRadius: "999px", textTransform: "none", fontWeight: 600 }}>
              {saving ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : "Save"}
            </Button>
          )}
        </Box>
        <Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: 1.25 }}>
          {setting.fromDefault ? "Not set yet - the 3D Gateway's address is used (Railway, APSOAssistant)." : `Set by ${setting.by ?? "-"} on ${when(setting.at)}.`}
          {!isAdmin && " Only an admin can change it."}
        </Typography>
        {msg && <Typography sx={{ fontSize: "0.84rem", mt: 1, color: msg.ok ? GREEN : RED }}>{msg.text}</Typography>}
      </GlassCard>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Chip tint={pending ? "pink" : "green"}>
          {pending ? `${pending} place${pending === 1 ? "" : "s"} still name${pending === 1 ? "s" : ""} another address` : "Every place it can check names this address"}
        </Chip>
        <Typography sx={{ fontSize: "0.8rem", color: MUTED, ml: "auto" }}>checked {when(checkedAt)}</Typography>
        <Tooltip title="Read the pages and files again">
          <IconButton size="small" onClick={() => setN((x) => x + 1)} aria-label="Check again">
            {held.stale ? <CircularProgress size={14} sx={{ color: MUTED }} /> : <RefreshIcon sx={{ fontSize: 18, color: MUTED }} />}
          </IconButton>
        </Tooltip>
      </Box>

      {pending > 0 && <Info>To move the service: save the new address above, paste each red row&apos;s snippet into Magento, upload the HubSpot card - the rows turn green as each place follows.</Info>}

      {groups.map((g) => (
        <GlassCard key={g} sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
          <Box sx={{ px: { xs: 2, md: 2.75 } }}>
            <CardTitle icon={GROUP[g].icon} tint={GROUP[g].tint} title={g} note={GROUP[g].note} />
          </Box>
          {places.filter((p) => p.group === g).map((p) => (
            <Box key={p.key} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0,1.3fr) minmax(0,1.2fr) auto" }, gap: 1, alignItems: "center", px: { xs: 2, md: 2.75 }, py: 1.5, borderTop: `1px solid ${HAIRLINE}` }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.88rem", fontWeight: 600, color: INK }}>{p.label}</Typography>
                <Typography sx={{ fontSize: "0.78rem", color: MUTED, overflowWrap: "anywhere" }}>{p.where}</Typography>
                {p.note && <Typography sx={{ fontSize: "0.78rem", color: MUTED, mt: 0.25 }}>{p.note}</Typography>}
              </Box>
              <Typography sx={{ fontSize: "0.78rem", color: INK, fontFamily: "ui-monospace, Menlo, Consolas, monospace", overflowWrap: "anywhere" }}>
                {p.found ?? (p.state === "manual" ? "" : "-")}
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, justifySelf: { md: "end" } }}>
                <Chip tint={STATE[p.state].tint}>{STATE[p.state].label}</Chip>
                {p.snippet && <Copy text={p.snippet} />}
                {p.url && (
                  <Tooltip title="Open what was checked" arrow>
                    <IconButton size="small" component="a" href={p.url} target="_blank" rel="noopener" aria-label={`Open ${p.label}`}>
                      <OpenInNewIcon sx={{ fontSize: 16, color: MUTED }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </Box>
          ))}
        </GlassCard>
      ))}
    </>
  );
}
