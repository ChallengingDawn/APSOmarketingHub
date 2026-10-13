"use client";

// 3D files > Settings (SARCLA, 13.10.2026: "as on DirectUP, put a settings tab for it"). The 3D
// gateway's address, and every place that names it, checked live: green = names this address, red =
// still the old one. Moving the Railway service = set the new address here, paste the snippets the
// rows hand out into Magento, upload the HubSpot card, and wait for every row to turn green.

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { HAIRLINE, INK, LoadingPanel, MUTED, Section, UpstreamPanel } from "@/app/analytics/Shell";
import type { GatewaySetting, Place } from "@/lib/threeD/gateway";
import type { PlaceState } from "@/lib/threeD/places";

type Data = { setting: GatewaySetting; places: Place[]; checkedAt: string; isAdmin: boolean };

const STATE: Record<PlaceState, { label: string; bg: string; fg: string }> = {
  ok: { label: "This address", bg: "#1e7e45", fg: "#fff" },
  follows: { label: "Follows its own address", bg: "#1e7e45", fg: "#fff" },
  old: { label: "Another address", bg: "#c5221f", fg: "#fff" },
  missing: { label: "Not found", bg: "#8a929c", fg: "#fff" },
  error: { label: "Could not read", bg: "#b26a00", fg: "#fff" },
  manual: { label: "Change by hand", bg: "#eef1f4", fg: INK },
};

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" }) : "-");

function Copy({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <Tooltip title={done ? "Copied" : "Copy the snippet to paste"} arrow>
      <IconButton size="small" aria-label="Copy snippet"
        onClick={() => { void navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }); }}>
        <ContentCopyIcon sx={{ fontSize: 16, color: done ? "#1e7e45" : MUTED }} />
      </IconButton>
    </Tooltip>
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

  if (r === null) return <LoadingPanel label="Reading the shop's pages and the gateway's files…" />;
  if (r.state !== "ok") return <UpstreamPanel source="3D settings" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? r.status : null} onRetry={() => setN((x) => x + 1)} />;
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
      <Section sx={{ mb: 2.5 }}>
        <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK, mb: 0.5 }}>Gateway address</Typography>
        <Typography sx={{ fontSize: "0.78rem", color: MUTED, mb: 1.5, lineHeight: 1.5 }}>
          Where the public 3D service runs (Railway today). The hub reads it here; the shop and the HubSpot card name it in the places below.
        </Typography>
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); if (isAdmin && !saving) void save(); }}
          sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
          <TextField size="small" value={value} onChange={(e) => setDraft(e.target.value)} disabled={!isAdmin}
            inputProps={{ "aria-label": "Gateway address", spellCheck: false }} sx={{ flex: "1 1 420px", maxWidth: 560 }} />
          {isAdmin && (
            <Button type="submit" variant="contained" disableElevation disabled={saving || value.trim() === setting.url}>
              {saving ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : "Save"}
            </Button>
          )}
        </Box>
        <Typography sx={{ fontSize: "0.75rem", color: MUTED, mt: 1 }}>
          {setting.fromDefault ? "Not set yet - the DoC backend's address is used." : `Set by ${setting.by ?? "-"} on ${when(setting.at)}.`}
          {!isAdmin && " Only an admin can change it."}
        </Typography>
        {msg && <Typography sx={{ fontSize: "0.8rem", mt: 1, color: msg.ok ? "#1e7e45" : "#c5221f" }}>{msg.text}</Typography>}
      </Section>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5, flexWrap: "wrap" }}>
        <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>Where the address is written</Typography>
        <Typography sx={{ fontSize: "0.78rem", color: pending ? "#c5221f" : "#1e7e45" }}>
          {pending ? `${pending} place${pending === 1 ? "" : "s"} still name${pending === 1 ? "s" : ""} another address` : "Every place it can check names this address"}
        </Typography>
        <Typography sx={{ fontSize: "0.75rem", color: MUTED, ml: "auto" }}>checked {when(checkedAt)}</Typography>
        <Tooltip title="Read the pages and files again">
          <IconButton size="small" onClick={() => setN((x) => x + 1)} aria-label="Check again">
            {held.stale ? <CircularProgress size={14} sx={{ color: MUTED }} /> : <RefreshIcon sx={{ fontSize: 18, color: MUTED }} />}
          </IconButton>
        </Tooltip>
      </Box>

      {groups.map((g) => (
        <Section key={g} sx={{ mb: 2, p: 0, overflow: "hidden" }}>
          <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".04em", px: 2, pt: 1.5, pb: 0.5 }}>{g}</Typography>
          {places.filter((p) => p.group === g).map((p) => (
            <Box key={p.key} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0,1.3fr) minmax(0,1.2fr) auto" }, gap: 1, alignItems: "center", px: 2, py: 1.25, borderTop: `1px solid ${HAIRLINE}` }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: INK }}>{p.label}</Typography>
                <Typography sx={{ fontSize: "0.74rem", color: MUTED, overflowWrap: "anywhere" }}>{p.where}</Typography>
                {p.note && <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 0.25 }}>{p.note}</Typography>}
              </Box>
              <Typography sx={{ fontSize: "0.76rem", color: INK, fontFamily: "ui-monospace, Menlo, Consolas, monospace", overflowWrap: "anywhere" }}>
                {p.found ?? (p.state === "manual" ? "" : "-")}
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, justifySelf: { md: "end" } }}>
                <Chip size="small" label={STATE[p.state].label} sx={{ fontWeight: 700, bgcolor: STATE[p.state].bg, color: STATE[p.state].fg }} />
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
        </Section>
      ))}
    </>
  );
}
