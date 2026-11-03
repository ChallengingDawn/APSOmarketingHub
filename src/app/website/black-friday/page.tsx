"use client";

// BLACK FRIDAY 2026 - Website > Black Friday (SARCLA 03.11.2026: "deploy on website subapp"; 16.11-06.12.2026,
// new customers 20 % only when sure, Bronze 10 %, Silver / Gold / Platinum 5 %, every code used once). The shop's
// Black Friday page asks the Ads Gateway after login and gets its company's own code; this page works the controls
// there (on/off, dates, rate per group, Magento's generated codes per rate) and reads from HubSpot who holds a code
// and which web orders used one (src/lib/promo/blackFriday.ts). Same UC kit as the other Website pages.

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import RefreshIcon from "@mui/icons-material/Refresh";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import ShoppingCartCheckoutOutlinedIcon from "@mui/icons-material/ShoppingCartCheckoutOutlined";
import SavingsOutlinedIcon from "@mui/icons-material/SavingsOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import PageHeader from "@/app/PageHeader";
import { GUTTER, LoadingPanel, NotConnectedPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { full } from "@/app/charts/format";
import { CardTitle, FAINT, GREEN, GlassCard, INK, KpiTile, MUTED, Notice, RED, bodyCell, eur, headCell } from "@/app/uc/report/ui";
import { ReportTabs, useHashTab } from "@/app/uc/report/Tabs";
import { Chip } from "@/app/connectors/parts";
import { when } from "@/app/website/directup/shared";
import type { PromoStatus } from "@/lib/promo/blackFriday";
import { GROUP_LABEL, GROUP_ORDER, codesFromText, endAfter, lastDayOf, zurichDay, zurichMidnight, type BfReport } from "@/lib/promo/report";

type Data = { status: PromoStatus; report: BfReport | null; reportError: string | null; testers: string[]; isAdmin: boolean };
type View = "overview" | "companies" | "codes" | "settings";
const VIEW_HASH: Record<View, string> = { overview: "#overview", companies: "#companies", codes: "#codes", settings: "#settings" };
const pill = { borderRadius: "999px", textTransform: "none" as const, fontWeight: 600 };
const API = "/api/website/black-friday";
const CHUNK = 300;                                         // codes per call - the 8 KB request limit in front of the hub
const swiss = (iso: string) => new Date(iso).toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" });
const hsCompany = (id: string) => `https://app-eu1.hubspot.com/contacts/26492587/record/0-2/${id}`;

async function post(body: unknown): Promise<{ ok: boolean; error?: string; data?: Record<string, number> }> {
  const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return (await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }))) as { ok: boolean; error?: string; data?: Record<string, number> };
}

/** What the shop page was told, in words (the gateway's states). */
const ANSWERS: [string, string, string?][] = [
  ["ok", "A code handed out", GREEN],
  ["again", "The same code shown again"],
  ["pending", "Buyer not placed yet (new account or restart) - asked again"],
  ["soon", "Before the start"],
  ["ended", "After the end"],
  ["off", "Switched off"],
  ["sold_out", "No code left at that rate", RED],
  ["refused", "Refused (two different people, or not from the shop)"],
  ["none", "Group set to 0 %"],
  ["error", "HubSpot or the database did not answer", RED],
];

function PhaseLine({ s }: { s: PromoStatus }) {
  const dates = `${swiss(s.settings.start)} - ${lastDayOf(s.settings.end).split("-").reverse().join(".")}`;
  const text = s.phase === "off" ? `Switched off: the shop page shows the locked voucher and hands out no code (${dates}).`
    : s.phase === "soon" ? `Starts ${swiss(s.settings.start)}: until then the page shows the countdown and no code.`
    : s.phase === "live" ? `Live, ${dates}: signed-in customers get their company's code.`
    : `Ended (${dates}): no more codes are handed out.`;
  return s.phase === "off" ? <Notice tone="warn">{text}</Notice>
    : <Typography sx={{ fontSize: "0.86rem", color: s.phase === "live" ? GREEN : MUTED, fontWeight: 600 }}>{text}</Typography>;
}

function Overview({ d }: { d: Data }) {
  const s = d.status, r = d.report;
  const rates = [...new Set(Object.values(s.settings.discount).filter((x) => x > 0))].sort((a, b) => b - a);
  const stockOf = (rate: number) => s.stock?.find((x) => x.discount === rate) ?? null;
  const asked = Object.values(s.answers).reduce((x, y) => x + y, 0);
  return (
    <>
      <PhaseLine s={s} />
      {d.reportError && (
        <Notice tone="bad">
          {/bf26_/.test(d.reportError)
            ? "HubSpot has no Black Friday properties yet: create the company properties bf26_code (text), bf26_discount (number) and bf26_group (text) - the gateway writes each code there."
            : `HubSpot could not be read: ${d.reportError}`}
        </Notice>
      )}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<LocalOfferOutlinedIcon />} tint="blue" label="Codes handed out" value={r ? full(r.totals.handedOut) : "-"} note="one per company" /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<ShoppingCartCheckoutOutlinedIcon />} tint="green" label="Used on an order" value={r ? full(r.totals.used) : "-"} note={r ? `${full(r.totals.orders)} web orders` : ""} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<SavingsOutlinedIcon />} tint="purple" label="Order value" value={r ? eur(r.totals.revenue) : "-"} note="order totals, each in its own currency" /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<SavingsOutlinedIcon />} tint="amber" label="Discount given" value={r ? eur(r.totals.discountGiven) : "-"} note="from the orders' discount" /></Grid>
      </Grid>

      <GlassCard>
        <CardTitle icon={<LocalOfferOutlinedIcon />} tint="blue" title="By group" note="The group decides the rate: the price class in HubSpot, or New when the organisation never ordered" />
        <Table size="small">
          <TableHead><TableRow>
            {["Group", "Rate", "Handed out", "Used", "Orders", "Order value", "Discount given"].map((h, i) => <TableCell key={h} sx={{ ...headCell, textAlign: i ? "right" : "left" }}>{h}</TableCell>)}
          </TableRow></TableHead>
          <TableBody>
            {(r?.groups ?? GROUP_ORDER.map((g) => ({ group: g, label: GROUP_LABEL[g], rate: s.settings.discount[g] ?? null, handedOut: 0, used: 0, orders: 0, revenue: 0, discountGiven: 0 }))).map((g) => (
              <TableRow key={g.group}>
                <TableCell sx={{ ...bodyCell, fontWeight: 600, color: INK }}>{g.label}</TableCell>
                {[`${s.settings.discount[g.group] ?? g.rate ?? 0} %`, full(g.handedOut), full(g.used), full(g.orders), eur(g.revenue), eur(g.discountGiven)].map((v, i) => (
                  <TableCell key={i} sx={{ ...bodyCell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{v}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </GlassCard>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <GlassCard sx={{ height: "100%", display: "grid", gap: 1, alignContent: "start" }}>
            <CardTitle icon={<Inventory2OutlinedIcon />} tint="amber" title="Codes left per rate" note="Magento's generated codes, loaded on the Codes tab" />
            {s.stock_error && <Notice tone="bad">{s.stock_error}</Notice>}
            {rates.map((rate) => {
              const st = stockOf(rate);
              const low = !st || st.free < Math.max(20, st.loaded * 0.1);
              return (
                <Box key={rate} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
                  <Typography sx={{ fontSize: "0.86rem", color: INK, fontWeight: 600 }}>{rate} %</Typography>
                  <Typography sx={{ fontSize: "0.84rem", color: low ? RED : MUTED, fontVariantNumeric: "tabular-nums" }}>
                    {st ? `${full(st.free)} left of ${full(st.loaded)} · ${full(st.taken)} handed out` : "no codes loaded"}
                  </Typography>
                </Box>
              );
            })}
          </GlassCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <GlassCard sx={{ height: "100%" }}>
            <CardTitle icon={<ShoppingCartCheckoutOutlinedIcon />} tint="blue" title="What the shop page was told" note={`${full(asked)} asks since the gateway started ${when(s.since)}`} />
            <Table size="small"><TableBody>
              {ANSWERS.filter(([k]) => (s.answers[k] ?? 0) > 0 || ["ok", "again", "pending"].includes(k)).map(([k, label, colour]) => (
                <TableRow key={k}>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", color: MUTED, pl: 0 }}>{label}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontWeight: 600, color: colour ?? INK, textAlign: "right", pr: 0 }}>{full(s.answers[k] ?? 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody></Table>
            {s.last_error && <Notice tone="warn">Last error {when(s.last_error.at)}: {s.last_error.message}</Notice>}
          </GlassCard>
        </Grid>
      </Grid>

      <GlassCard sx={{ display: "grid", gap: 1 }}>
        <CardTitle icon={<FactCheckOutlinedIcon />} tint="pink" title="Checks" note="A code used on another company's order, or used twice - for Back Office before the order is confirmed" />
        {!r ? <Typography sx={{ fontSize: "0.84rem", color: FAINT }}>Waiting for HubSpot.</Typography>
          : !r.checks.length ? <Typography sx={{ fontSize: "0.84rem", color: GREEN, fontWeight: 600 }}>Every code was used by the company it was given to.</Typography>
          : (
            <Table size="small">
              <TableHead><TableRow>{["Order", "Code", "Given to", "Problem", "When"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
              <TableBody>
                {r.checks.map((c) => (
                  <TableRow key={`${c.orderId}-${c.code}`}>
                    <TableCell sx={bodyCell}>{c.name ?? c.orderId}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontFamily: "monospace" }}>{c.code}</TableCell>
                    <TableCell sx={bodyCell}><a href={hsCompany(c.holderId)} target="_blank" rel="noreferrer">{c.holderName}</a></TableCell>
                    <TableCell sx={{ ...bodyCell, color: RED, fontWeight: 600 }}>{c.reason === "other company" ? "used by another company" : "used a second time"}</TableCell>
                    <TableCell sx={bodyCell}>{c.at ? when(c.at) : "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
      </GlassCard>
    </>
  );
}

function Companies({ d }: { d: Data }) {
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    const all = d.report?.holders ?? [];
    return (t ? all.filter((h) => h.name.toLowerCase().includes(t) || h.code.toLowerCase().includes(t)) : all).slice(0, 300);
  }, [q, d.report]);
  if (!d.report) return <Notice tone="warn">{d.reportError ?? "Waiting for HubSpot."}</Notice>;
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25 }}>
      <CardTitle icon={<LocalOfferOutlinedIcon />} tint="blue" title="Who holds a code" note={`${full(d.report.holders.length)} companies · the code is on the company in HubSpot (bf26_code)`}
        right={<TextField size="small" placeholder="Company or code" value={q} onChange={(e) => setQ(e.target.value)} />} />
      <Table size="small">
        <TableHead><TableRow>{["Company", "Group", "Rate", "Code", "Used"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
        <TableBody>
          {rows.map((h) => (
            <TableRow key={h.companyId}>
              <TableCell sx={bodyCell}><a href={hsCompany(h.companyId)} target="_blank" rel="noreferrer">{h.name}</a></TableCell>
              <TableCell sx={bodyCell}>{GROUP_LABEL[h.group] ?? h.group}</TableCell>
              <TableCell sx={{ ...bodyCell, fontVariantNumeric: "tabular-nums" }}>{h.discount != null ? `${h.discount} %` : "-"}</TableCell>
              <TableCell sx={{ ...bodyCell, fontFamily: "monospace" }}>{h.code}</TableCell>
              <TableCell sx={bodyCell}>{h.uses.length ? h.uses.map((u) => `${u.name ?? u.orderId}${u.at ? ` (${when(u.at)})` : ""}`).join(", ") : <span style={{ color: FAINT }}>not yet</span>}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {d.report.holders.length > rows.length && <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>First {rows.length} shown - search to narrow.</Typography>}
    </GlassCard>
  );
}

function LoadCodes({ rate, d, reload }: { rate: number; d: Data; reload: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const st = d.status.stock?.find((x) => x.discount === rate);
  const found = codesFromText(text);
  const load = async () => {
    if (!found.length) return;
    if (!confirm(`Load ${full(found.length)} codes for ${rate} %? Use only codes Magento generated for the ${rate} % rule.`)) return;
    let added = 0, already = 0;
    setMsg(null);
    for (let i = 0; i < found.length; i += CHUNK) {
      setBusy(`${full(Math.min(i + CHUNK, found.length))} / ${full(found.length)}`);
      const r = await post({ action: "codes", discount: rate, codes: found.slice(i, i + CHUNK) });
      if (!r.ok) { setBusy(null); setMsg({ ok: false, text: `Stopped after ${full(added)} new codes: ${r.error ?? "did not work"}` }); reload(); return; }
      added += r.data?.added ?? 0; already += r.data?.already ?? 0;
    }
    setBusy(null); setText("");
    setMsg({ ok: true, text: `${full(added)} new codes loaded${already ? `, ${full(already)} were already there` : ""}.` });
    reload();
  };
  const readFile = (f: File | undefined) => { if (f) void f.text().then(setText); };
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25 }}>
      <CardTitle icon={<UploadFileOutlinedIcon />} tint="amber" title={`Codes for ${rate} %`}
        note={st ? `${full(st.free)} left of ${full(st.loaded)} loaded · ${full(st.taken)} handed out` : "None loaded yet"} />
      {d.isAdmin ? (
        <>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
            <Button component="label" size="small" variant="outlined" sx={pill}>
              Magento export (.csv)
              <input hidden type="file" accept=".csv,.txt" onChange={(e) => readFile(e.target.files?.[0])} />
            </Button>
            <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>or paste the codes, one per line</Typography>
          </Box>
          <TextField multiline minRows={3} maxRows={8} size="small" value={text} onChange={(e) => setText(e.target.value)} placeholder="BF26-…" />
          <Box sx={{ display: "flex", gap: 1.25, alignItems: "center", flexWrap: "wrap" }}>
            <Button size="small" variant="contained" sx={pill} disabled={!found.length || busy !== null} onClick={() => void load()}>
              {busy ? <><CircularProgress size={14} sx={{ mr: 1, color: "inherit" }} />{busy}</> : `Load ${full(found.length)} codes`}
            </Button>
            {msg && (msg.ok ? <Typography sx={{ fontSize: "0.8rem", color: GREEN }}>{msg.text}</Typography> : <Notice tone="bad">{msg.text}</Notice>)}
          </Box>
        </>
      ) : <Typography sx={{ fontSize: "0.8rem", color: FAINT }}>Admins load codes.</Typography>}
    </GlassCard>
  );
}

function Codes({ d, reload }: { d: Data; reload: () => void }) {
  const rates = [...new Set(Object.values(d.status.settings.discount).filter((x) => x > 0))].sort((a, b) => b - a);
  return (
    <>
      <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>
        One Magento cart rule per rate - {rates.map((r) => `${r} %`).join(", ")} - each with auto-generated codes, Uses per Coupon 1, from {swiss(d.status.settings.start)}.
        Generate them in the rule, export the list, load it here. A code is never handed out at another rate than its own.
      </Typography>
      <Grid container spacing={2}>
        {rates.map((rate) => <Grid key={rate} size={{ xs: 12, md: 6, lg: 4 }}><LoadCodes rate={rate} d={d} reload={reload} /></Grid>)}
      </Grid>
    </>
  );
}

function Settings({ d, reload }: { d: Data; reload: () => void }) {
  const s = d.status.settings;
  const [on, setOn] = useState(s.on);
  const [from, setFrom] = useState(zurichDay(s.start));
  const [to, setTo] = useState(lastDayOf(s.end));
  const [rates, setRates] = useState<Record<string, string>>(Object.fromEntries(GROUP_ORDER.map((g) => [g, String(s.discount[g] ?? 0)])));
  const [testers, setTesters] = useState((d.testers ?? []).join("\n"));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = async () => {
    if (on !== s.on && !confirm(on ? "Switch the promotion on? Signed-in customers then get their code between the start and the end." : "Switch it off? The page then hands out no code; codes already given still work in Magento.")) return;
    setBusy(true); setMsg(null);
    let body: Record<string, unknown>;
    try {
      body = { action: "settings", on, start: zurichMidnight(from), end: endAfter(to), discount: Object.fromEntries(Object.entries(rates).map(([g, v]) => [g, Number(v)])),
        testers: testers.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean) };
    } catch (e) { setBusy(false); setMsg({ ok: false, text: String((e as Error).message) }); return; }
    const r = await post(body);
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: "Saved." } : { ok: false, text: r.error ?? "Did not work." });
    if (r.ok) reload();
  };
  const ro = !d.isAdmin;
  return (
    <GlassCard sx={{ display: "grid", gap: 1.75, maxWidth: 760 }}>
      <CardTitle icon={<TuneOutlinedIcon />} tint="purple" title="Settings" note={s.set_at ? `Last saved ${when(s.set_at)}` : "Not saved yet - the defaults below, switched off"} />
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Switch checked={on} disabled={ro || busy} onChange={(e) => setOn(e.target.checked)} slotProps={{ input: { "aria-label": "Promotion on" } }} />
        <Typography sx={{ fontSize: "0.88rem", fontWeight: 600, color: on ? GREEN : MUTED }}>{on ? "On" : "Off"}</Typography>
      </Box>
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        <TextField type="date" size="small" label="First day" value={from} disabled={ro} onChange={(e) => setFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField type="date" size="small" label="Last day" value={to} disabled={ro} onChange={(e) => setTo(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <Typography sx={{ fontSize: "0.78rem", color: FAINT, alignSelf: "center" }}>Swiss time: from 00:00 on the first day to 24:00 on the last.</Typography>
      </Box>
      <Grid container spacing={1.5}>
        {GROUP_ORDER.map((g) => (
          <Grid key={g} size={{ xs: 6, sm: 4, md: 3 }}>
            <TextField size="small" type="number" label={GROUP_LABEL[g]} value={rates[g]} disabled={ro}
              onChange={(e) => setRates((x) => ({ ...x, [g]: e.target.value }))} slotProps={{ htmlInput: { min: 0, max: 50, step: 1 }, input: { endAdornment: <span style={{ color: MUTED }}>%</span> } }} />
          </Grid>
        ))}
      </Grid>
      <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
        New: the organisation never ordered (the Google Ads list's strict rule) and has no price class above List price. No price class: has ordered, but HubSpot gives it no class - the lowest rate, never a guess upwards.
        Each rate needs its own Magento rule and codes.
      </Typography>
      <TextField multiline minRows={2} maxRows={6} size="small" label="Test accounts (e-mail, one per line)" value={testers} disabled={ro}
        onChange={(e) => setTesters(e.target.value)} placeholder="name@company.ch"
        helperText="These shop accounts get their real code before the start, even while it is switched off - to try the page and the cart. Up to 20; nobody else sees a code before the first day." />
      {!ro && (
        <Box sx={{ display: "flex", gap: 1.25, alignItems: "center" }}>
          <Button size="small" variant="contained" sx={pill} disabled={busy} onClick={() => void save()}>{busy ? <CircularProgress size={14} sx={{ color: "inherit" }} /> : "Save"}</Button>
          {msg && (msg.ok ? <Typography sx={{ fontSize: "0.8rem", color: GREEN }}>{msg.text}</Typography> : <Notice tone="bad">{msg.text}</Notice>)}
        </Box>
      )}
    </GlassCard>
  );
}

export default function BlackFridayPage() {
  const [view, setView] = useHashTab<View>(VIEW_HASH, "overview");
  const [n, setN] = useState(0);
  const [fresh, setFresh] = useState(false);
  const held = useHeld<Data>(`${API}?n=${n}${fresh ? "&fresh=1" : ""}`, [n]);
  const reload = (again = false) => { setFresh(again); setN((x) => x + 1); };
  const r = held.result;
  const d = r && r.state !== "not-configured" && r.state !== "error" ? r.data : null;
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader title="Black Friday"
        subtitle="Each company's own code and rate on the shop's Black Friday page, 16 November - 6 December 2026: who got one, who used it"
        rightSlot={<Tooltip title="Read again from HubSpot"><IconButton size="small" onClick={() => reload(true)} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton></Tooltip>} />
      {d && (
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
          <ReportTabs name="black-friday" tab={view} onSelect={setView} tabs={[
            { id: "overview", label: "Overview", count: null },
            { id: "companies", label: "Companies", count: d.report ? full(d.report.holders.length) : null },
            { id: "codes", label: "Codes", count: null },
            { id: "settings", label: "Settings", count: null },
          ]} />
          <Chip tint={d.status.phase === "live" ? "green" : d.status.phase === "off" ? "slate" : "amber"}>
            {d.status.phase === "live" ? "Live" : d.status.phase === "off" ? "Off" : d.status.phase === "soon" ? "Not started" : "Ended"}
          </Chip>
        </Box>
      )}
      {r === null ? <LoadingPanel label="Reading the Ads Gateway and HubSpot…" />
        : r.state === "not-configured" ? <NotConnectedPanel source="Ads Gateway" missing={r.missing} />
        : r.state === "error" ? <UpstreamPanel source="Ads Gateway" error={r.error} status={r.status} onRetry={() => reload()} />
        : view === "companies" ? <Companies d={r.data} />
        : view === "codes" ? <Codes d={r.data} reload={() => reload()} />
        : view === "settings" ? <Settings key={r.data.status.settings.set_at ?? "default"} d={r.data} reload={() => reload()} />
        : <Overview d={r.data} />}
    </Box>
  );
}
