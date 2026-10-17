"use client";

// Search bar > Setup: how the bar is installed on the shop, its switches, and its database (the dashboard's
// "Install", "Maintenance" and "Data model" pages; customer feedback left the hub, SARCLA 17.10.2026). The switches work from here (SARCLA 17.10.2026: "the
// maintenance button doesn't really work" - it was only a state): the maintenance switch, same-tab links and
// the bar's two buttons, admins only; each answer is the gateway's database, read back after the change.

import { useState } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Switch from "@mui/material/Switch";
import Grid from "@mui/material/Grid";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import CodeOutlinedIcon from "@mui/icons-material/CodeOutlined";
import PowerSettingsNewOutlinedIcon from "@mui/icons-material/PowerSettingsNewOutlined";
import StorageOutlinedIcon from "@mui/icons-material/StorageOutlined";
import { full } from "@/app/charts/format";
import { CardTitle, FAINT, GREEN, GlassCard, HAIRLINE, INK, MUTED, Notice, bodyCell, headCell } from "@/app/uc/report/ui";
import { Chip, usePaged } from "@/app/connectors/parts";
import type { GatewaySetting, Health, Migration, Switches } from "@/lib/searchbar/gateway";
import { Empty, Loaded, pill, post, when } from "./shared";
import Button from "@mui/material/Button";

type Setup = { migrations: (Migration & { creates_table?: string; row_count?: number })[]; switches: Switches; health: Health | null; setting: GatewaySetting; isAdmin: boolean };

type Key = "bar" | "sameTab" | "ai" | "feedback";
/** The four switches, in words. `on` is what the switch shows; `body` is the change it asks for. */
const SWITCHES: { key: Key; label: string; note: string; on: (s: Switches) => boolean; body: (next: boolean) => Record<string, unknown>; confirmOff?: string }[] = [
  {
    key: "bar", label: "Search bar on the shop",
    note: "Off = maintenance: the shop's own search box comes back on every page opened from then on (within about 15 seconds). If the bar's server cannot be reached, the bar stays on.",
    on: (s) => !s.killSwitch, body: (next) => ({ action: "kill-switch", on: !next }),
    confirmOff: "Switch the search bar OFF on apsoparts.com?\n\nCustomers get the shop's own search box until you switch it back on.",
  },
  { key: "sameTab", label: "Product links open in the same tab", note: "Off: a click on a result opens the product in a new tab.", on: (s) => s.sameTab, body: (next) => ({ action: "same-tab", on: next }) },
  { key: "ai", label: "CHAT AI button", note: "The pill on the right of the bar that opens the AI assistant.", on: (s) => s.buttons.ai, body: (next) => ({ action: "buttons", ai: next }) },
  { key: "feedback", label: "Feedback button", note: "The speech bubble that opens the feedback form.", on: (s) => s.buttons.feedback, body: (next) => ({ action: "buttons", feedback: next }) },
];

function Maintenance({ initial, isAdmin, health }: { initial: Switches; isAdmin: boolean; health: boolean }) {
  const [sw, setSw] = useState(initial);
  const [busy, setBusy] = useState<Key | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const flip = async (k: (typeof SWITCHES)[number], next: boolean) => {
    if (!next && k.confirmOff && !confirm(k.confirmOff)) return;
    setBusy(k.key); setMsg(null);
    const r = await post<Switches>(k.body(next));
    setBusy(null);
    if (r.ok && r.data) {
      setSw(r.data);
      const now = k.on(r.data);
      setMsg(now === next
        ? { ok: true, text: k.key === "bar" ? (next ? "The search bar is back on the shop." : "The search bar is OFF on the shop - the shop's own search box shows.") : `${k.label}: ${next ? "on" : "off"}.` }
        : { ok: false, text: "The gateway did not keep the change - try again." });
    } else setMsg({ ok: false, text: r.error ?? "Did not work." });
  };
  return (
    <GlassCard sx={{ height: "100%" }}>
      <CardTitle icon={<PowerSettingsNewOutlinedIcon />} tint={sw.killSwitch ? "pink" : "green"} title="Maintenance"
        note={sw.killSwitch ? `The bar is OFF on the shop${sw.killSwitchAt ? ` since ${when(sw.killSwitchAt)}` : ""}` : "The bar is live on the shop"} />
      {sw.killSwitch && <Box sx={{ mb: 1.25 }}><Notice tone="warn">Customers see the shop's own search box. Switch the bar back on when the maintenance is done.</Notice></Box>}
      <Box sx={{ display: "grid", gap: 1.25 }}>
        {SWITCHES.map((k) => (
          <Box key={k.key} sx={{ display: "flex", alignItems: "flex-start", gap: 1.25, justifyContent: "space-between" }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK }}>{k.label}</Typography>
              <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{k.note}</Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
              {busy === k.key && <CircularProgress size={14} />}
              <Switch checked={k.on(sw)} disabled={!isAdmin || busy !== null} onChange={(e) => void flip(k, e.target.checked)}
                color={k.key === "bar" ? "success" : "primary"} slotProps={{ input: { "aria-label": k.label } }} />
            </Box>
          </Box>
        ))}
      </Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 1.5, alignItems: "center" }}>
        <Chip tint={health ? "green" : "pink"}>{health ? "Gateway answering" : "Gateway not answering"}</Chip>
        {!isAdmin && <Typography sx={{ fontSize: "0.78rem", color: FAINT }}>Only an admin can change these.</Typography>}
        {msg && (msg.ok ? <Typography sx={{ fontSize: "0.8rem", color: GREEN }}>{msg.text}</Typography> : <Notice tone="bad">{msg.text}</Notice>)}
      </Box>
    </GlassCard>
  );
}

/** What the bar reads, in words: the database tables and the files shipped with the gateway. */
const MODEL: { name: string; kind: string; what: string }[] = [
  { name: "hubspot_articles", kind: "table", what: "Every article with its product page (ERP number), description, material, stock and units - copied from HubSpot, stock refreshed by the nightly check and the order refresh." },
  { name: "published_registry / published_products", kind: "tables", what: "The shop's product pages from its six sitemaps, with each page's name and address in every language; refreshed every 6 hours." },
  { name: "shop_page_articles / shop_page_scan", kind: "tables", what: "Which articles each product page lists, read from the pages at night, each once a week - an article is on the shop when a page lists it." },
  { name: "smart_bar_search_logs", kind: "table", what: "Every search (personal data removed), what answered and how many results - the Report, Searches and Gaps tabs." },
  { name: "smart_bar_feedback", kind: "table", what: "What customers wrote with the feedback button." },
  { name: "data/*-families.json, *-articles.json", kind: "files", what: "The product lists behind the bar's views (plates, rods, hoses …), June snapshots kept current against the shop's pages." },
];

/** The database changes, a page at a time. */
function Migrations({ rows, isAdmin, reload }: { rows: Setup["migrations"]; isAdmin: boolean; reload: () => void }) {
  const { slice, pager } = usePaged(rows, 8);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const apply = async (num: string, name: string) => {
    if (!confirm(`Apply database change ${num} (${name}) to the search bar's database now?`)) return;
    setBusy(num); setMsg(null);
    const r = await post({ action: "migration-run", num });
    setBusy(null);
    setMsg(r.ok ? { ok: true, text: `Change ${num} applied.` } : { ok: false, text: r.error ?? "Did not work." });
    if (r.ok) reload();
  };
  return (
    <>
      <Table size="small">
        <TableHead><TableRow>{["#", "Change", "What for", "Applied", "Rows"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
        <TableBody>
          {rows.length === 0 && <TableRow><TableCell colSpan={5} sx={bodyCell}><Empty>None recorded.</Empty></TableCell></TableRow>}
          {slice.map((m) => (
            <TableRow key={m.num}>
              <TableCell sx={{ ...bodyCell, fontSize: "0.8rem" }}>{m.num}</TableCell>
              <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", fontFamily: "monospace" }}>{m.name}</TableCell>
              <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED }}>{m.description}</TableCell>
              <TableCell sx={bodyCell}>
                {m.applied || !isAdmin ? <Chip tint={m.applied ? "green" : "amber"}>{m.applied ? "yes" : "no"}</Chip>
                  : <Button size="small" variant="outlined" sx={pill} disabled={busy !== null} onClick={() => void apply(m.num, m.name)}>{busy === m.num ? <CircularProgress size={14} /> : "Apply"}</Button>}
              </TableCell>
              <TableCell sx={{ ...bodyCell, fontSize: "0.8rem" }}>{m.row_count != null ? full(m.row_count) : "–"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {pager}
      {msg && <Box sx={{ px: { xs: 2, md: 2.75 }, py: 1 }}>{msg.ok ? <Typography sx={{ fontSize: "0.82rem", color: GREEN }}>{msg.text}</Typography> : <Notice tone="bad">{msg.text}</Notice>}</Box>}
    </>
  );
}

export default function SetupTab() {
  return (
    <Loaded<Setup> url="/api/website/search-bar?part=setup" what="the setup">
      {(d, reload) => {
        const base = d.setting.url;
        const snippet = `<link rel="stylesheet" href="${base}/demo/smart-search.css">\n<script src="${base}/demo/smart-search.js" defer></script>`;
        return (
          <>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 7 }}>
                <GlassCard sx={{ height: "100%" }}>
                  <CardTitle icon={<CodeOutlinedIcon />} tint="blue" title="Installed on the shop" note="These two lines sit in the shop's page head (Magento: Content › Design › Configuration › HTML Head), production and ACC alike. The bar replaces the shop's own search box." />
                  <Box component="pre" sx={{ m: 0, p: 1.5, borderRadius: "10px", bgcolor: "#f5f7fb", border: `1px solid ${HAIRLINE}`, fontSize: "0.76rem", color: INK, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{snippet}</Box>
                  <Typography sx={{ fontSize: "0.76rem", color: FAINT, mt: 1 }}>Gateway: {base.replace(/^https:\/\//, "")}{d.setting.fromDefault ? " (the Railway address)" : ` · set by ${d.setting.by} on ${d.setting.at?.slice(0, 10)}`}</Typography>
                </GlassCard>
              </Grid>
              <Grid size={{ xs: 12, md: 5 }}>
                <Maintenance initial={d.switches} isAdmin={d.isAdmin} health={!!d.health} />
              </Grid>
            </Grid>

            <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
              <Box sx={{ px: { xs: 2, md: 2.75 } }}>
                <CardTitle icon={<StorageOutlinedIcon />} tint="slate" title="What the bar reads" note="Its database tables and files, in words" />
              </Box>
              <Table size="small">
                <TableHead><TableRow>{["Name", "", "What it holds"].map((h, i) => <TableCell key={i} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
                <TableBody>
                  {MODEL.map((m) => (
                    <TableRow key={m.name}>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", fontWeight: 600, fontFamily: "monospace", whiteSpace: "nowrap" }}>{m.name}</TableCell>
                      <TableCell sx={bodyCell}><Chip tint="slate">{m.kind}</Chip></TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", color: MUTED }}>{m.what}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Box sx={{ px: { xs: 2, md: 2.75 }, pt: 2 }}>
                <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK, mb: 1 }}>Database changes applied</Typography>
              </Box>
              <Migrations rows={d.migrations} isAdmin={d.isAdmin} reload={reload} />
            </GlassCard>
          </>
        );
      }}
    </Loaded>
  );
}
