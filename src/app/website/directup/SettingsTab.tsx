"use client";

// DirectUP > Settings: the gateway's address, how many lines go to the shop in one request, and the three
// snippets to install it on the shop (footer, page, head) - copied from here, made again on demand.

import { useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import RouterOutlinedIcon from "@mui/icons-material/RouterOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import CodeOutlinedIcon from "@mui/icons-material/CodeOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { CardTitle, FAINT, GREEN, GlassCard, HAIRLINE, INK, MUTED, Notice, RED, type Tint } from "@/app/uc/report/ui";
import { Chip } from "@/app/connectors/parts";
import type { GatewaySetting, Snippets } from "@/lib/directup/gateway";
import type { ShopCheck, StoreCheck } from "@/lib/directup/check";
import { isCurrentBridge, post, when, type Overview } from "./shared";

const pill = { borderRadius: "999px", textTransform: "none" as const, fontWeight: 600 };

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

const SNIPPETS: { key: "footer" | "page" | "head"; label: string; need: "Required" | "Optional"; where: string }[] = [
  { key: "footer", label: "Footer HTML - the bridge", need: "Required", where: "Magento: Content > Design > Configuration > [each store view] > Footer > Miscellaneous HTML. Replace any older DirectUP bridge block; leave the rest of the field as it is. Check \"Use Default Value\" is not hiding it, then flush the cache." },
  { key: "page", label: "Page HTML - the DirectUP page", need: "Required", where: "Magento: Content > Pages > DirectUP, editor OFF or a PageBuilder \"HTML Code\" element. The same block for every store view." },
  { key: "head", label: "Head HTML - a faster start", need: "Optional", where: "Magento: Content > Design > Configuration > [each store view] > HTML Head > Scripts and Style Sheets. Lets the browser connect to the gateway while the page loads." },
];

/** Each store view's DirectUP page read live: the footer bridge, the head and the page snippet - what customers get,
 *  after the cache. (The shop's APIs cannot give the configured HTML: GraphQL is off, REST has no endpoint.) */
function Installed() {
  const [n, setN] = useState(0);
  const held = useHeld<ShopCheck>(`/api/website/directup?part=check${n ? `&refresh=1&n=${n}` : ""}`, [n]);
  const r = held.result;
  const footer = (s: StoreCheck): { label: string; tint: Tint } =>
    !s.footer ? { label: "No bridge", tint: "pink" } : isCurrentBridge(s.footer) ? { label: s.footer, tint: "green" } : { label: `${s.footer} · older`, tint: "amber" };
  const page = (s: StoreCheck): { label: string; tint: Tint } =>
    s.page === "this" ? { label: "This gateway", tint: "green" } : s.page === "other" ? { label: "Another address", tint: "amber" } : { label: "Not found", tint: "pink" };
  const good = (s: StoreCheck) => !s.error && isCurrentBridge(s.footer) && s.page === "this";
  return (
    <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
      <Box sx={{ px: { xs: 2, md: 2.75 } }}>
        <CardTitle icon={<StorefrontOutlinedIcon />} tint="green" title="Installed on the shop"
          note={r?.state === "ok" ? `Production's DirectUP page in every store view, read live ${when(r.data.checkedAt)} - what customers get, after the cache` : "Production's DirectUP page in every store view, read live"}
          right={
            <Tooltip title="Read the shop's pages again">
              <IconButton size="small" onClick={() => setN((x) => x + 1)} aria-label="Check again">
                {r === null || held.stale ? <CircularProgress size={14} sx={{ color: MUTED }} /> : <RefreshIcon sx={{ fontSize: 18, color: MUTED }} />}
              </IconButton>
            </Tooltip>
          } />
        {r === null && <Typography sx={{ fontSize: "0.84rem", color: MUTED, pb: 2 }}>Reading the shop&apos;s pages - about ten seconds…</Typography>}
        {r && r.state !== "ok" && <Typography sx={{ fontSize: "0.84rem", color: RED, pb: 2 }}>{r.state === "error" ? r.error : "not configured"}</Typography>}
        {r?.state === "ok" && (
          <Box sx={{ pb: 1.5 }}>
            {/* a sentence, not a chip: chips do not wrap, and this one is long on a phone */}
            <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: r.data.stores.every(good) ? GREEN : "#a96a12" }}>
              {r.data.stores.every(good)
                ? `All ${r.data.stores.length} store views run the current footer and frame this gateway.`
                : `${r.data.stores.filter((s) => !good(s)).length} of ${r.data.stores.length} store views need the footer or the page.`}
            </Typography>
          </Box>
        )}
      </Box>
      {r?.state === "ok" && r.data.stores.map((s) => (
        <Box key={s.locale} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0,0.8fr) minmax(0,1fr) minmax(0,0.9fr) minmax(0,1fr) auto" }, gap: 1, alignItems: "center", px: { xs: 2, md: 2.75 }, py: 1.1, borderTop: `1px solid ${HAIRLINE}` }}>
          <Typography sx={{ fontSize: "0.88rem", fontWeight: 600, color: INK }}>{s.locale}</Typography>
          {s.error
            ? <Typography sx={{ gridColumn: { md: "span 3" }, fontSize: "0.8rem", color: RED }}>Could not read: {s.error}</Typography>
            : (
              <>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}><Typography component="span" sx={{ fontSize: "0.74rem", color: FAINT, width: 44 }}>Footer</Typography><Chip tint={footer(s).tint}>{footer(s).label}</Chip></Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}><Typography component="span" sx={{ fontSize: "0.74rem", color: FAINT, width: 36 }}>Head</Typography><Chip tint={s.head ? "green" : "slate"}>{s.head ? "Faster start" : "Not set (optional)"}</Chip></Box>
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

export default function SettingsTab({ o, reload }: { o: Overview; reload: () => void }) {
  const [n, setN] = useState(0);
  const held = useHeld<{ setting: GatewaySetting; snippets: Snippets; isAdmin: boolean }>(`/api/website/directup?part=snippets&n=${n}`, [n]);
  const [batch, setBatch] = useState(String(o.status.settings.batchSize));
  const [url, setUrl] = useState(o.setting.url);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const act = async (name: string, body: unknown, done: string) => {
    setBusy(name); setMsg(null);
    const r = await post(body);
    setBusy(null);
    setMsg(r.ok ? { ok: true, text: done } : { ok: false, text: r.error ?? "Did not work." });
    if (r.ok) { setN((x) => x + 1); reload(); }
  };
  const r = held.result;

  return (
    <>
      {msg && (msg.ok
        ? <Typography sx={{ fontSize: "0.84rem", color: GREEN }}>{msg.text}</Typography>
        : <Notice tone="bad">{msg.text}</Notice>)}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <GlassCard sx={{ height: "100%" }}>
            <CardTitle icon={<RouterOutlinedIcon />} tint="blue" title="Gateway address"
              note="Where DirectUP runs - Railway. The hub reads it here and the snippets below name it." />
            <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); if (o.isAdmin && busy === null) void act("url", { action: "gateway", url }, "Address saved. Regenerate the snippets for it."); }}
              sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
              <TextField size="small" value={url} onChange={(e) => setUrl(e.target.value)} disabled={!o.isAdmin} sx={{ flex: "1 1 320px" }} inputProps={{ "aria-label": "Gateway address", spellCheck: false }} />
              {o.isAdmin && <Button type="submit" variant="contained" disableElevation disabled={busy !== null || url.trim() === o.setting.url} sx={pill}>Save</Button>}
            </Box>
            <Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: 1.25 }}>
              {o.setting.fromDefault ? "The Railway default." : `Set by ${o.setting.by} on ${when(o.setting.at)}.`} After a move: set the new address, regenerate, paste the footer and the page again.
              {!o.isAdmin && " Only an admin can change it."}
            </Typography>
          </GlassCard>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <GlassCard sx={{ height: "100%" }}>
            <CardTitle icon={<TuneOutlinedIcon />} tint="purple" title="Lines per request"
              note="One click puts the whole list into one cart, sent to the shop in requests of this many lines" />
            <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); if (o.isAdmin && busy === null) void act("batch", { action: "settings", batchSize: Number(batch) }, `Lines per request: ${batch}. The tool uses it from the next click.`); }}
              sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
              <TextField size="small" type="number" value={batch} onChange={(e) => setBatch(e.target.value)} disabled={!o.isAdmin} sx={{ width: 120 }} inputProps={{ min: 1, max: 100, "aria-label": "Lines per request" }} />
              {o.isAdmin && <Button type="submit" variant="contained" disableElevation disabled={busy !== null || Number(batch) === o.status.settings.batchSize} sx={pill}>Save</Button>}
            </Box>
            <Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: 1.25 }}>At most 100: the shop refuses longer requests (128 lines went through, 192 did not).</Typography>
          </GlassCard>
        </Grid>
      </Grid>

      <Installed />

      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 } }}>
          <CardTitle icon={<CodeOutlinedIcon />} tint="amber" title="Installation on the shop"
            note={r?.state === "ok" ? `Made ${when(r.data.snippets.generatedAt)} for ${r.data.snippets.url.replace(/^https:\/\//, "")} · gateway ${r.data.snippets.version}` : "The snippets to paste into Magento"}
            right={o.isAdmin ? (
              <Button size="small" variant="outlined" sx={pill} disabled={busy !== null} onClick={() => void act("regen", { action: "regenerate" }, "The snippets were made again for the gateway's address.")}>
                {busy === "regen" ? <CircularProgress size={14} /> : "Regenerate"}
              </Button>
            ) : undefined} />
          {r === null && <Box sx={{ pb: 2 }}><CircularProgress size={16} /></Box>}
          {r && r.state !== "ok" && <Typography sx={{ fontSize: "0.84rem", color: RED, pb: 2 }}>{r.state === "error" ? r.error : "not configured"}</Typography>}
          {r?.state === "ok" && r.data.snippets.url !== o.setting.url && (
            <Notice tone="warn">These snippets were made for {r.data.snippets.url}, not for the address set above. Regenerate.</Notice>
          )}
        </Box>
        {r?.state === "ok" && SNIPPETS.map((s) => (
          <Box key={s.key} sx={{ px: { xs: 2, md: 2.75 }, py: 1.75, borderTop: `1px solid ${HAIRLINE}` }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Typography sx={{ fontSize: "0.9rem", fontWeight: 600, color: INK }}>{s.label}</Typography>
              <Chip tint={s.need === "Required" ? "blue" : "slate"}>{s.need}</Chip>
              <Box sx={{ ml: "auto" }}><Copy text={r.data.snippets[s.key]} /></Box>
            </Box>
            <Typography sx={{ fontSize: "0.8rem", color: MUTED, my: 0.75 }}>{s.where}</Typography>
            <Box component="pre" sx={{ m: 0, p: 1.25, maxHeight: 160, overflow: "auto", bgcolor: "#f6f8fa", border: `1px solid ${HAIRLINE}`, borderRadius: "12px", fontSize: "0.72rem", lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
              {r.data.snippets[s.key]}
            </Box>
          </Box>
        ))}
      </GlassCard>
    </>
  );
}
