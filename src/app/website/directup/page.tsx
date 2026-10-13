"use client";

// DIRECTUP - the hub's page on the shop's order tool (SARCLA, 13.10.2026: DirectUP on its own Railway service,
// "DirectUp Gateway"; "the rest goes to the marketing under Website > Microservices", with usage, the client
// log, the order lists, status & settings, and the footer, head and page HTML to install it - which can be
// made again). The tool runs on Railway because the shop frames it; this page reads the gateway's admin API.

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Button from "@mui/material/Button";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import RefreshIcon from "@mui/icons-material/Refresh";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, HAIRLINE, INK, LoadingPanel, MUTED, NotConnectedPanel, Section, UpstreamPanel } from "@/app/analytics/Shell";
import { StatTile } from "@/app/charts/StatTile";
import { SERIES } from "@/app/charts/palette";
import { full } from "@/app/charts/format";
import type { GatewaySetting, JobDetail, JobSummary, Log, Snippets, Status, Usage } from "@/lib/directup/gateway";

const BLUE = SERIES[0];
const GREEN = "#1e7e45";
const RED = "#c5221f";
const AMBER = "#b26a00";
const GREY = "#8a929c";
/** The bridge every store view should run; anything older has to be replaced in the footer. */
const CURRENT_BRIDGE = "v9-tools";

type Overview = { setting: GatewaySetting; status: Status; usage: Usage; isAdmin: boolean };
type TabKey = "usage" | "lists" | "log" | "status" | "settings";

const when = (iso: string | null | undefined) => {
  if (!iso) return "–";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : "–");
const th = { fontSize: "0.72rem", fontWeight: 700, color: MUTED, textTransform: "uppercase" as const, letterSpacing: ".04em" };
const td = { fontSize: "0.8rem" };

function Notice({ tone, children }: { tone: "warn" | "info"; children: React.ReactNode }) {
  const c = tone === "warn" ? { bg: "#fff7e6", bd: "#f0d199", fg: "#7a4b00" } : { bg: "#eef4fb", bd: "#c9dbef", fg: "#24507c" };
  return (
    <Box sx={{ mb: 2, px: 2, py: 1.25, borderRadius: 2, border: `1px solid ${c.bd}`, bgcolor: c.bg }}>
      <Typography sx={{ fontSize: "0.82rem", color: c.fg, lineHeight: 1.5 }}>{children}</Typography>
    </Box>
  );
}
const Title = ({ children }: { children: React.ReactNode }) => (
  <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK, mb: 1.25 }}>{children}</Typography>
);

async function post(body: unknown): Promise<{ ok: boolean; error?: string; data?: unknown }> {
  const r = await fetch("/api/website/directup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return (await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }))) as { ok: boolean; error?: string; data?: unknown };
}

// ── Usage ───────────────────────────────────────────────────────────────────
function UsageTab({ o, days, setDays }: { o: Overview; days: number; setDays: (n: number) => void }) {
  const u = o.usage;
  const t = useMemo(() => {
    const sum = (k: keyof Usage["perDay"][number]) => u.perDay.reduce((a, d) => a + (Number(d[k]) || 0), 0);
    return {
      lists: sum("lists"), files: sum("files"), claude: sum("read_by_claude"), lines: sum("lines"),
      byNumber: sum("by_number"), byText: sum("by_text"), notFound: sum("not_found"),
      carts: u.carts.reduce((a, c) => a + c.carts, 0), cartLines: u.carts.reduce((a, c) => a + c.cart_lines, 0),
    };
  }, [u]);
  const max = Math.max(1, ...u.perDay.map((d) => d.lists));
  return (
    <>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 2 }}>
        {[30, 90, 365].map((n) => (
          <Chip key={n} label={n === 365 ? "12 months" : `${n} days`} onClick={() => setDays(n)} variant={days === n ? "filled" : "outlined"}
            sx={{ fontWeight: 600, ...(days === n ? { bgcolor: INK, color: "#fff" } : { color: MUTED, borderColor: HAIRLINE }) }} />
        ))}
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 2, mb: 2.5 }}>
        <StatTile label="Order lists" value={full(t.lists)} note={`${full(t.files)} from a file · ${full(t.lists - t.files)} typed in`} />
        <StatTile label="Lines read" value={full(t.lines)} note={`${full(t.claude)} lists read by Claude (PDF, photo)`} />
        <StatTile label="Matched by number" value={pct(t.byNumber, t.lines)} note={`${full(t.byNumber)} lines · ${full(t.byText)} found from the description`} />
        <StatTile label="Sent to the cart" value={full(t.cartLines)} note={`lines, in ${full(t.carts)} cart${t.carts === 1 ? "" : "s"} · ${full(t.notFound)} lines not found`} />
      </Box>
      <Section>
        <Title>Order lists per day</Title>
        {u.perDay.length === 0 && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>No order lists in this period.</Typography>}
        <Box sx={{ display: "flex", alignItems: "flex-end", gap: "3px", height: 140, overflowX: "auto" }}>
          {u.perDay.map((d) => (
            <Tooltip key={d.day} arrow title={`${d.day}: ${d.lists} list${d.lists === 1 ? "" : "s"}, ${d.lines} lines, ${d.by_number} by number, ${d.not_found} not found`}>
              <Box sx={{ flex: "1 0 8px", maxWidth: 28, height: `${Math.max(4, (d.lists / max) * 100)}%`, bgcolor: BLUE, borderRadius: "3px 3px 0 0" }} />
            </Tooltip>
          ))}
        </Box>
        {u.perDay.length > 0 && (
          <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.75 }}>
            <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{u.perDay[0].day}</Typography>
            <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{u.perDay[u.perDay.length - 1].day}</Typography>
          </Box>
        )}
      </Section>
    </>
  );
}

// ── Order lists ─────────────────────────────────────────────────────────────
function ListsTab() {
  const [n, setN] = useState(0);
  const held = useHeld<{ jobs: JobSummary[] }>(`/api/website/directup?part=jobs&n=${n}`, [n]);
  const [open, setOpen] = useState<string | null>(null);
  const detail = useHeld<JobDetail>(open ? `/api/website/directup?part=job&id=${open}` : null, [open]);
  const r = held.result;
  if (r === null) return <LoadingPanel label="Reading the order lists…" />;
  if (r.state !== "ok") return <UpstreamPanel source="DirectUp Gateway" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? r.status : null} onRetry={() => setN((x) => x + 1)} />;
  const d = detail.result;
  return (
    <>
      <Section sx={{ mb: 2.5, p: 0, overflow: "hidden" }}>
        <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK, px: 2, pt: 1.75, pb: 1 }}>
          The latest order lists <span style={{ color: MUTED, fontWeight: 400 }}>· newest first · click one to see its lines</span>
        </Typography>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 760 }}>
            <TableHead><TableRow>{["Made", "Store view", "File", "Lines", "By number", "To check", "Not found", "In the cart"].map((h) => <TableCell key={h} sx={th}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {r.data.jobs.length === 0 && <TableRow><TableCell colSpan={8} sx={{ ...td, color: MUTED }}>No order lists yet.</TableCell></TableRow>}
              {r.data.jobs.map((j) => (
                <TableRow key={j.id} hover selected={open === j.id} onClick={() => setOpen(open === j.id ? null : j.id)} sx={{ cursor: "pointer" }}>
                  <TableCell sx={{ ...td, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{when(j.createdAt)}</TableCell>
                  <TableCell sx={td}>{j.locale || "–"}</TableCell>
                  <TableCell sx={{ ...td, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={j.filename || ""}>
                    {j.filename === "eingabe.csv" ? <span style={{ color: MUTED }}>typed in</span> : j.filename || "–"}{j.method === "vision" ? <span style={{ color: MUTED }}> · read by Claude</span> : null}
                  </TableCell>
                  <TableCell sx={{ ...td, fontVariantNumeric: "tabular-nums" }}>{full(j.counts.total)}</TableCell>
                  <TableCell sx={{ ...td, fontVariantNumeric: "tabular-nums", color: GREEN }}>{full(j.counts.matched)}</TableCell>
                  <TableCell sx={{ ...td, fontVariantNumeric: "tabular-nums", color: j.counts.review ? AMBER : MUTED }}>{full(j.counts.review)}</TableCell>
                  <TableCell sx={{ ...td, fontVariantNumeric: "tabular-nums", color: j.counts.unmatched ? RED : MUTED }}>{full(j.counts.unmatched)}</TableCell>
                  <TableCell sx={{ ...td, fontVariantNumeric: "tabular-nums" }}>{full(j.counts.added)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Section>
      {open && (
        <Section sx={{ p: 0, overflow: "hidden" }}>
          {d === null && <Box sx={{ p: 2 }}><CircularProgress size={16} /></Box>}
          {d && d.state !== "ok" && <Box sx={{ p: 2 }}><Typography sx={{ ...td, color: RED }}>{d.state === "error" ? d.error : "not configured"}</Typography></Box>}
          {d && d.state === "ok" && (
            <>
              <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK, px: 2, pt: 1.75, pb: 1 }}>
                {d.data.filename === "eingabe.csv" ? "Typed in" : d.data.filename || "Order list"} <span style={{ color: MUTED, fontWeight: 400 }}>· {when(d.data.createdAt)} · {d.data.locale || ""} · {full(d.data.lines.length)} lines</span>
              </Typography>
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small" sx={{ minWidth: 900 }}>
                  <TableHead><TableRow>{["#", "As the customer wrote it", "Qty", "Status", "Our article", "Found by", "Suggestions"].map((h) => <TableCell key={h} sx={th}>{h}</TableCell>)}</TableRow></TableHead>
                  <TableBody>
                    {d.data.lines.map((l) => (
                      <TableRow key={l.idx}>
                        <TableCell sx={{ ...td, color: MUTED }}>{l.idx + 1}</TableCell>
                        <TableCell sx={{ ...td, maxWidth: 320 }}>{[l.ref, l.description].filter(Boolean).join(" · ") || "–"}</TableCell>
                        <TableCell sx={{ ...td, fontVariantNumeric: "tabular-nums" }}>{l.qty}{l.unit ? ` ${l.unit}` : ""}</TableCell>
                        <TableCell sx={td}>
                          <Chip size="small" label={l.state === "added" ? "in the cart" : l.status} sx={{ fontWeight: 600, color: "#fff",
                            bgcolor: l.state === "added" ? BLUE : l.status === "matched" ? GREEN : l.status === "review" ? AMBER : l.status === "skipped" ? GREY : RED }} />
                        </TableCell>
                        <TableCell sx={{ ...td, fontVariantNumeric: "tabular-nums" }}>{l.chosen || "–"}</TableCell>
                        <TableCell sx={{ ...td, color: MUTED }}>{l.via || l.reason || "–"}</TableCell>
                        <TableCell sx={{ ...td, color: MUTED, maxWidth: 360 }}>{l.candidates.map((c) => `${c.articleNumber} ${c.description}`.slice(0, 70)).join(" · ") || "–"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </>
          )}
        </Section>
      )}
    </>
  );
}

// ── Client log ──────────────────────────────────────────────────────────────
function LogTab() {
  const [ev, setEv] = useState("");
  const [n, setN] = useState(0);
  const held = useHeld<Log>(`/api/website/directup?part=log&ev=${encodeURIComponent(ev)}&n=${n}`, [ev, n]);
  const r = held.result;
  if (r === null) return <LoadingPanel label="Reading the tool's log…" />;
  if (r.state !== "ok") return <UpstreamPanel source="DirectUp Gateway" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? r.status : null} onRetry={() => setN((x) => x + 1)} />;
  const L = r.data;
  return (
    <>
      <Notice tone="info">What the tool and the shop&apos;s bridge report from customers&apos; pages - counts, states, the shop&apos;s own messages - never who the customer is. The last 30 days by kind; click one to see only it.</Notice>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 2 }}>
        <Chip label="All" onClick={() => setEv("")} variant={ev === "" ? "filled" : "outlined"} sx={{ fontWeight: 600, ...(ev === "" ? { bgcolor: INK, color: "#fff" } : { color: MUTED, borderColor: HAIRLINE }) }} />
        {L.kinds.map((k) => (
          <Chip key={k.ev} label={`${k.ev} · ${full(k.n)}`} onClick={() => setEv(k.ev)} variant={ev === k.ev ? "filled" : "outlined"}
            sx={{ fontWeight: 600, ...(ev === k.ev ? { bgcolor: INK, color: "#fff" } : { color: MUTED, borderColor: HAIRLINE }) }} />
        ))}
      </Box>
      <Section sx={{ p: 0, overflow: "hidden" }}>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 760 }}>
            <TableHead><TableRow>{["When", "Event", "What it said"].map((h) => <TableCell key={h} sx={th}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {L.entries.length === 0 && <TableRow><TableCell colSpan={3} sx={{ ...td, color: MUTED }}>Nothing logged.</TableCell></TableRow>}
              {L.entries.map((e, i) => (
                <TableRow key={`${e.at}-${i}`}>
                  <TableCell sx={{ ...td, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{when(e.at)}</TableCell>
                  <TableCell sx={{ ...td, fontWeight: 600, whiteSpace: "nowrap" }}>{e.ev}</TableCell>
                  <TableCell sx={{ ...td, color: MUTED, fontFamily: "ui-monospace, monospace", fontSize: "0.74rem", wordBreak: "break-all" }}>{e.data == null ? "" : JSON.stringify(e.data)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Section>
    </>
  );
}

// ── Status ──────────────────────────────────────────────────────────────────
function StatusTab({ o, reload }: { o: Overview; reload: () => void }) {
  const s = o.status;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const pull = async () => {
    setBusy(true); setMsg(null);
    const r = await post({ action: "sync" });
    setBusy(false);
    setMsg(r.ok ? "Pulling the catalogue from PricingHub - it takes about a minute; refresh to see it." : r.error ?? "Did not work.");
  };
  const ok = (b: boolean, yes: string, no: string) => <Chip size="small" label={b ? yes : no} sx={{ fontWeight: 700, color: "#fff", bgcolor: b ? GREEN : RED }} />;
  const old = s.bridges.filter((b) => b.bridge && b.bridge !== CURRENT_BRIDGE);
  return (
    <>
      {old.length > 0 && <Notice tone="warn">{old.length} store view{old.length === 1 ? " still runs" : "s still run"} an older bridge. Paste the footer from Settings in those store views.</Notice>}
      {s.catalogue.error && <Notice tone="warn">The last catalogue pull failed: {s.catalogue.error}</Notice>}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 2, mb: 2.5 }}>
        <StatTile label="Gateway" value={s.version} note={`up ${Math.round(s.uptimeS / 3600)} h · ${o.setting.url.replace(/^https:\/\//, "")}`} />
        <StatTile label="Catalogue copy" value={full(s.catalogue.articles)} note={`articles, ${full(s.catalogue.crossrefs)} cross-references · no prices`} />
        <StatTile label="Copied" value={when(s.catalogue.syncedAt)} note="from PricingHub, nightly at 02:30 UTC" />
        <StatTile label="Order lists kept" value={full(s.jobs)} note={`the last on ${when(s.lastJobAt)}`} />
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
        <Section>
          <Title>What the gateway can reach</Title>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 1.5 }}>
            {ok(s.keys.hubspot, "HubSpot: pictures, type, status", "No HubSpot token")}
            {ok(s.keys.claude, "Claude: PDFs and photos", "No Claude key")}
            {ok(s.keys.sync, "PricingHub catalogue", "No catalogue key")}
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            {o.isAdmin && <Button size="small" variant="outlined" disabled={busy || s.catalogue.running} onClick={() => void pull()}>{s.catalogue.running ? "Pulling…" : "Pull the catalogue now"}</Button>}
            <Button size="small" endIcon={<OpenInNewIcon sx={{ fontSize: 15 }} />} href={`${o.setting.url}/landing/tools/directup?embed=1`} target="_blank" rel="noopener">Open the tool</Button>
            <Button size="small" onClick={reload}>Refresh</Button>
          </Box>
          {msg && <Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: 1 }}>{msg}</Typography>}
        </Section>
        <Section sx={{ p: 0, overflow: "hidden" }}>
          <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK, px: 2, pt: 1.75, pb: 1 }}>Bridge per store view <span style={{ color: MUTED, fontWeight: 400 }}>· last 30 days</span></Typography>
          <Table size="small">
            <TableHead><TableRow>{["Store view", "Bridge", "Seen", "Last"].map((h) => <TableCell key={h} sx={th}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {s.bridges.length === 0 && <TableRow><TableCell colSpan={4} sx={{ ...td, color: MUTED }}>No shop page has opened the tool yet.</TableCell></TableRow>}
              {s.bridges.map((b, i) => (
                <TableRow key={i}>
                  <TableCell sx={td}>{b.locale || "–"}</TableCell>
                  <TableCell sx={td}><Chip size="small" label={b.bridge || "?"} sx={{ fontWeight: 700, color: "#fff", bgcolor: b.bridge === CURRENT_BRIDGE ? GREEN : AMBER }} /></TableCell>
                  <TableCell sx={{ ...td, fontVariantNumeric: "tabular-nums" }}>{full(b.n)}</TableCell>
                  <TableCell sx={{ ...td, whiteSpace: "nowrap" }}>{when(b.last)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>
      </Box>
    </>
  );
}

// ── Settings ────────────────────────────────────────────────────────────────
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
  { key: "footer", label: "Footer HTML - the bridge", need: "Required", where: "Magento: Content > Design > Configuration > [each store view] > Footer > Miscellaneous HTML. Replace any older DirectUP bridge block; leave the rest of the field as it is." },
  { key: "page", label: "Page HTML - the DirectUP page", need: "Required", where: "Magento: Content > Pages > DirectUP (URL key direct-up), editor OFF or a PageBuilder \"HTML Code\" element. The same block for every store view." },
  { key: "head", label: "Head HTML - faster start", need: "Optional", where: "Magento: Content > Design > Configuration > [each store view] > HTML Head > Scripts and Style Sheets. Lets the browser connect to the gateway while the page loads." },
];

function SettingsTab({ o, reload }: { o: Overview; reload: () => void }) {
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
      {msg && <Notice tone={msg.ok ? "info" : "warn"}>{msg.text}</Notice>}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2, mb: 2.5 }}>
        <Section>
          <Title>Gateway address</Title>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED, mb: 1.25 }}>
            Where the tool runs. {o.setting.fromDefault ? "The Railway default." : `Set by ${o.setting.by} on ${when(o.setting.at)}.`} After a move, set the new address, regenerate, and paste the footer and the page again.
          </Typography>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <TextField size="small" value={url} onChange={(e) => setUrl(e.target.value)} disabled={!o.isAdmin} sx={{ flex: "1 1 280px" }} inputProps={{ "aria-label": "Gateway address" }} />
            {o.isAdmin && <Button variant="contained" disableElevation disabled={busy !== null || url.trim() === o.setting.url} onClick={() => void act("url", { action: "gateway", url }, "Address saved. Regenerate the snippets for it.")}>Save</Button>}
          </Box>
        </Section>
        <Section>
          <Title>Lines per cart</Title>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED, mb: 1.25 }}>A long order goes into the cart in batches of this many lines, each its own cart. The old tool stopped at 60.</Typography>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <TextField size="small" type="number" value={batch} onChange={(e) => setBatch(e.target.value)} disabled={!o.isAdmin} sx={{ width: 120 }} inputProps={{ min: 1, max: 500, "aria-label": "Lines per cart" }} />
            {o.isAdmin && <Button variant="contained" disableElevation disabled={busy !== null || Number(batch) === o.status.settings.batchSize} onClick={() => void act("batch", { action: "settings", batchSize: Number(batch) }, `Lines per cart: ${batch}. The tool uses it from the next list.`)}>Save</Button>}
          </Box>
        </Section>
      </Box>

      <Section>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 1.5 }}>
          <Title>Installation on the shop</Title>
          {r?.state === "ok" && <Typography sx={{ fontSize: "0.78rem", color: MUTED, mb: 1.25 }}>made {when(r.data.snippets.generatedAt)} for {r.data.snippets.url.replace(/^https:\/\//, "")} · gateway {r.data.snippets.version}</Typography>}
          {o.isAdmin && <Button size="small" variant="outlined" sx={{ ml: "auto", mb: 1.25 }} disabled={busy !== null} onClick={() => void act("regen", { action: "regenerate" }, "The snippets were made again for the gateway's address.")}>
            {busy === "regen" ? <CircularProgress size={14} /> : "Regenerate"}
          </Button>}
        </Box>
        {r === null && <CircularProgress size={16} />}
        {r && r.state !== "ok" && <Typography sx={{ ...td, color: RED }}>{r.state === "error" ? r.error : "not configured"}</Typography>}
        {r?.state === "ok" && r.data.snippets.url !== o.setting.url && (
          <Notice tone="warn">These snippets were made for {r.data.snippets.url}, not for the address set above. Regenerate.</Notice>
        )}
        {r?.state === "ok" && SNIPPETS.map((s) => (
          <Box key={s.key} sx={{ borderTop: `1px solid ${HAIRLINE}`, pt: 1.5, mt: 1.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK }}>{s.label}</Typography>
              <Chip size="small" label={s.need} sx={{ fontWeight: 700, ...(s.need === "Required" ? { bgcolor: INK, color: "#fff" } : { bgcolor: "#eef1f4", color: INK }) }} />
              <Box sx={{ ml: "auto" }}><Copy text={r.data.snippets[s.key]} /></Box>
            </Box>
            <Typography sx={{ fontSize: "0.78rem", color: MUTED, my: 0.75 }}>{s.where}</Typography>
            <Box component="pre" sx={{ m: 0, p: 1.25, maxHeight: 160, overflow: "auto", bgcolor: "#f6f8fa", border: `1px solid ${HAIRLINE}`, borderRadius: 1.5, fontSize: "0.72rem", lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
              {r.data.snippets[s.key]}
            </Box>
          </Box>
        ))}
      </Section>
    </>
  );
}

// ── the page ────────────────────────────────────────────────────────────────
export default function DirectUpPage() {
  const [tab, setTab] = useState<TabKey>("usage");
  const [days, setDays] = useState(30);
  const [forced, setForced] = useState(0);
  const url = `/api/website/directup?part=overview&days=${days}&n=${forced}`;
  const held = useHeld<Overview>(url, [url]);
  const r = held.result;
  const reload = () => setForced((n) => n + 1);

  const header = (
    <PageHeader
      title="DirectUP"
      subtitle="The shop's order tool: an order file in, the lines checked, the whole list into the cart"
      rightSlot={
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {(r === null || held.stale) && <CircularProgress size={14} sx={{ color: MUTED }} />}
          <Tooltip title="Ask the gateway again"><IconButton size="small" onClick={reload} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton></Tooltip>
        </Box>
      }
    />
  );
  const shell = (children: React.ReactNode) => (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 } }}>
      {header}
      <Tabs value={tab} onChange={(_, t: TabKey) => setTab(t)} variant="scrollable" sx={{ mb: 2.5, minHeight: 36, borderBottom: `1px solid ${HAIRLINE}` }}>
        {([["usage", "Usage"], ["lists", "Order lists"], ["log", "Client log"], ["status", "Status"], ["settings", "Settings"]] as const).map(([k, l]) => (
          <Tab key={k} value={k} label={l} sx={{ textTransform: "none", fontWeight: 600, minHeight: 36 }} />
        ))}
      </Tabs>
      {children}
    </Box>
  );

  if (r === null) return shell(<LoadingPanel label="Reading the DirectUp Gateway…" />);
  if (r.state === "not-configured") return shell(<NotConnectedPanel source="DirectUp Gateway" missing={r.missing} />);
  if (r.state === "error") return shell(<UpstreamPanel source="DirectUp Gateway" error={r.error} status={r.status} onRetry={reload} />);
  const o = r.data;
  if (tab === "lists") return shell(<ListsTab />);
  if (tab === "log") return shell(<LogTab />);
  if (tab === "status") return shell(<StatusTab o={o} reload={reload} />);
  if (tab === "settings") return shell(<SettingsTab o={o} reload={reload} />);
  return shell(<UsageTab o={o} days={days} setDays={setDays} />);
}
