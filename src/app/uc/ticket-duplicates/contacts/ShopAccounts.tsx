"use client";

// DUPLICATES & MERGES > Contacts - Contacts without a company, built in Associations on 19.10 (SARCLA: "build it inside the
// existing app, a separate contact tab ... they should be straightforward") and moved here on 10.11.2026 ("should get out
// of there and be rebuilt as contacts - a new toggle on top - so we have only one place to change and create new
// associations"). Its read and links stay where they were (/api/uc/ticket-associations/shop-accounts). People with a shop login
// whose HubSpot contact has no company - their logins and orders count for no company. Each with the
// companies its orders are booked on, the one its shop account's customer number names and those on its e-mail domain,
// the likeliest first: pick, Link; the clear ones in one go with "Link all". Nothing is linked without a click.
// 10.11.2026 ("develop more the contacts by bringing more data to them"): the shop's own record (registered, store, last
// login, order value, customer number, what they bought, industry), the web visits, and who each offered company is
// (customer number, place, owner, last order, revenue) - one table across the page, filters, an order, a download.

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import CircularProgress from "@mui/material/CircularProgress";
import CheckIcon from "@mui/icons-material/Check";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import AlternateEmailIcon from "@mui/icons-material/AlternateEmail";
import AddLinkIcon from "@mui/icons-material/AddLink";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { CardTitle, FAINT, GlassCard, GREEN, HAIRLINE, INK, KpiTile, MUTED, RED, TINT, bodyCell, headCell } from "@/app/uc/report/ui";
import { Choice, usePaged } from "@/app/connectors/parts";
import type { Candidate, Unlinked, UnlinkedRow } from "@/lib/ticketAssoc/shopAccountRules";
import type { LinkDone } from "@/lib/ticketAssoc/shopAccounts";

type Data = { value?: Unlinked; computing: boolean; progress?: string; error?: string; links: LinkDone[]; linkedCount: number };
const HUBSPOT = "https://app-eu1.hubspot.com/contacts/26492587/record";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (iso: string | null | undefined) => (iso ? `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}` : "—");
const YEAR_AGO = () => new Date(Date.now() - 365 * 86400_000).toISOString().slice(0, 10);
/** The shop's base currency by its store view ("Switzerland CHF DE" -> CHF). */
const money = (r: UnlinkedRow) => (/CHF/.test(r.shop?.store ?? "") ? "CHF" : /EUR/.test(r.shop?.store ?? "") ? "EUR" : "");
const SOURCE: Record<string, string> = {
  ORGANIC_SEARCH: "Search", PAID_SEARCH: "Paid search", DIRECT_TRAFFIC: "Direct", REFERRALS: "Another site", SOCIAL_MEDIA: "Social media",
  PAID_SOCIAL: "Paid social", EMAIL_MARKETING: "E-mail", OTHER_CAMPAIGNS: "Campaign", OFFLINE: "Offline (the shop's sync)", AI_REFERRALS: "An AI",
};
const WHY: Record<NonNullable<Candidate["why"]>, string> = { orders: "their orders", number: "their customer number", domain: "their e-mail domain" };
const LANG: Record<string, string> = { de: "German", fr: "French", it: "Italian", en: "English", nl: "Dutch", pl: "Polish", es: "Spanish" };

type Active = "any" | "login" | "orders" | "never";
type Sort = "sure" | "newest" | "login" | "orders" | "visits" | "name";

const cellText = { fontSize: "0.8rem", color: INK, lineHeight: 1.35 } as const;
const small = { fontSize: "0.74rem", color: MUTED, lineHeight: 1.35 } as const;
const faint = { fontSize: "0.72rem", color: FAINT, lineHeight: 1.35 } as const;
const head = { ...headCell, whiteSpace: "normal" as const, verticalAlign: "bottom" as const };
const body = { ...bodyCell, verticalAlign: "top" as const, py: 1.1, overflowWrap: "anywhere" as const };

function csv(rows: UnlinkedRow[]) {
  const q = (s: string | number | null | undefined) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const headLine = ["Contact id", "Name", "E-mail", "Job title", "Phone", "Language", "Company they typed", "Address", "Postcode", "City", "Country", "Industry",
    "Registered in the shop", "Store", "Last login", "Orders", "Last order", "Order value", "Currency", "Customer number in the shop", "Products bought",
    "Visits", "Pages seen", "Last visit", "First came from", "Contact owner", "Company offered", "Company id", "Why", "Its customer number", "Its Mandant", "Its city"];
  const lines = [headLine.map(q).join(";")];
  for (const r of rows) {
    const c = r.candidates[0];
    lines.push([r.id, r.person?.name, r.person?.email, r.person?.jobtitle, r.person?.phone, r.person?.language, r.company, r.person?.address, r.person?.zip, r.person?.city, r.country, r.shop?.industry,
      r.shop?.since, r.shop?.store, r.shop?.lastLogin, r.orders?.n ?? 0, r.orders?.last, r.shop?.value || "", money(r), r.shop?.number, r.shop?.products,
      r.web?.visits ?? 0, r.web?.views ?? 0, r.web?.lastVisit, r.web?.source ? SOURCE[r.web.source] ?? r.web.source : "", r.person?.owner,
      c?.name, c?.id, c?.why ? WHY[c.why] : "", c?.erp, c?.mandant, [c?.zip, c?.city].filter(Boolean).join(" ")].map(q).join(";"));
  }
  return `﻿${lines.join("\r\n")}`;
}

/** Who an offered company is, in one line under its name. */
function about(c: Candidate) {
  return [c.erp ? `${c.erp}${c.mandant ? ` · ${c.mandant}` : ""}` : "no customer number", [c.zip, c.city].filter(Boolean).join(" ") || c.country, c.owner ? `owner ${c.owner}` : null,
    c.lastOrder ? `last order ${day(c.lastOrder)}` : null, c.revenue ? `${full(c.revenue)} this year` : null].filter(Boolean).join(" · ");
}

export function ShopAccountsTab() {
  const [n, setN] = useState(0);
  const held = useHeld<Data>(`/api/uc/ticket-associations/shop-accounts?n=${n}`, [n]);
  const r = held.result;
  const [kind, setKind] = useState<UnlinkedRow["kind"]>("match");
  // the company picked per contact, and what each Link click did
  const [pick, setPick] = useState<Record<string, string>>({});
  const [done, setDone] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [allDone, setAllDone] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("all");
  const [store, setStore] = useState("all");
  const [owner, setOwner] = useState("all");
  const [active, setActive] = useState<Active>("any");
  const [sort, setSort] = useState<Sort>("sure");
  const computing = r?.state === "ok" && r.data.computing && !r.data.value;
  // a first read takes a few seconds: ask again until it is in
  useEffect(() => { if (!computing) return; const t = setTimeout(() => setN((x) => x + 1), 4000); return () => clearTimeout(t); }, [computing, n]);

  const u = r?.state === "ok" ? r.data.value : undefined;
  const all = useMemo(() => u?.rows ?? [], [u]);
  const countries = useMemo(() => [...new Set(all.map((x) => x.country).filter(Boolean))].sort(), [all]);
  const stores = useMemo(() => [...new Set(all.map((x) => x.shop?.store ?? "").filter(Boolean))].sort(), [all]);
  const owners = useMemo(() => [...new Set(all.map((x) => x.person?.owner ?? "").filter(Boolean))].sort(), [all]);
  // a search over who they are: name, e-mail, phone, the company they typed, the place, the shop's number, the companies offered
  const rows = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const yearAgo = YEAR_AGO();
    const text = (x: UnlinkedRow) => [x.person?.name, x.person?.email, x.person?.phone, x.person?.jobtitle, x.company, x.domain, x.person?.address, x.person?.city, x.person?.zip, x.country,
      x.person?.owner, x.shop?.number, x.shop?.store, x.shop?.industry, ...x.candidates.map((c) => `${c.name} ${c.erp ?? ""}`)].join(" ").toLowerCase();
    const out = all.filter((x) => {
      if (x.kind !== kind) return false;
      if (country !== "all" && x.country !== country) return false;
      if (store !== "all" && x.shop?.store !== store) return false;
      if (owner !== "all" && x.person?.owner !== owner) return false;
      if (active === "login" && !((x.shop?.lastLogin ?? "") >= yearAgo)) return false;
      if (active === "orders" && !x.orders?.n) return false;
      if (active === "never" && x.shop?.lastLogin) return false;
      return words.every((w) => text(x).includes(w));
    });
    const sure = (x: UnlinkedRow) => (x.candidates[0]?.orders ? 2 : x.byNumber ? 1 : 0);
    const by: Record<Sort, (a: UnlinkedRow, b: UnlinkedRow) => number> = {
      sure: (a, b) => sure(b) - sure(a) || (b.shop?.since ?? b.created).localeCompare(a.shop?.since ?? a.created),
      newest: (a, b) => (b.shop?.since ?? b.created).localeCompare(a.shop?.since ?? a.created),
      login: (a, b) => (b.shop?.lastLogin ?? "").localeCompare(a.shop?.lastLogin ?? ""),
      orders: (a, b) => (b.orders?.n ?? 0) - (a.orders?.n ?? 0) || (b.shop?.value ?? 0) - (a.shop?.value ?? 0),
      visits: (a, b) => (b.web?.visits ?? 0) - (a.web?.visits ?? 0) || (b.web?.views ?? 0) - (a.web?.views ?? 0),
      name: (a, b) => (a.person?.name || a.person?.email || "").localeCompare(b.person?.name || b.person?.email || ""),
    };
    return [...out].sort(by[sort]);
  }, [all, kind, q, country, store, owner, active, sort]);
  const { slice, pager, setPage } = usePaged(rows, 25);
  // a filter changed: back to the first page
  useEffect(() => { setPage(0); }, [kind, q, country, store, owner, active, sort, setPage]);

  if (r === null) return <LoadingPanel label="Reading the shop accounts without a company…" />;
  if (r.state !== "ok") return <UpstreamPanel source="HubSpot contacts" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? r.status : null} onRetry={() => setN((x) => x + 1)} />;
  if (!u) return <LoadingPanel label={`Reading the shop accounts without a company${r.data.progress ? ` - ${r.data.progress}` : ""}…`} />;

  const link = async (row: UnlinkedRow) => {
    const company = pick[row.id] ?? row.candidates[0]?.id;
    if (!company) return;
    setBusy(row.id);
    try {
      const res = await fetch("/api/uc/ticket-associations/shop-accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contact: row.id, company }) });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; data?: LinkDone };
      setDone((d) => ({ ...d, [row.id]: j.ok ? { ok: true, text: `Linked to ${j.data?.companyName ?? "the company"}` } : { ok: false, text: j.error ?? `HubSpot answered ${res.status}` } }));
    } finally { setBusy(null); }
  };
  const linkedNow = Object.values(done).filter((x) => x.ok).length;
  const clear = all.filter((x) => (x.byOrder || x.byNumber) && !done[x.id]?.ok);
  const clearOrders = clear.filter((x) => x.byOrder).length;
  // the clear ones in one go - after a yes (SARCLA 19.10: "if they have an order we can also link easily")
  const linkAll = async () => {
    if (!window.confirm(`Link ${clear.length} contacts, each to the one company ${clearOrders === clear.length ? "all its orders are booked on" : "all its orders are booked on, or its shop account's customer number names"}?`)) return;
    setBusy("all");
    try {
      const res = await fetch("/api/uc/ticket-associations/shop-accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: "orders" }) });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; data?: { linked: number; failed: number; error?: string } };
      setAllDone(j.ok ? `${full(j.data?.linked ?? 0)} linked${j.data?.failed ? ` - ${full(j.data.failed)} refused by HubSpot${j.data.error ? `: ${j.data.error}` : ""}` : ""}` : j.error ?? `HubSpot answered ${res.status}`);
      setN((x) => x + 1);
    } finally { setBusy(null); }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([csv(rows)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `contacts-without-a-company-${kind}-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const sel = (label: string, value: string, onChange: (v: string) => void, options: { v: string; l: string }[], width = 160) => (
    <TextField select size="small" label={label} value={value} onChange={(e) => onChange(e.target.value)} sx={{ minWidth: width }}
      slotProps={{ select: { MenuProps: { slotProps: { paper: { sx: { maxHeight: 360 } } } } } }}>
      {options.map((o) => <MenuItem key={o.v} value={o.v}>{o.l}</MenuItem>)}
    </TextField>
  );
  const match = kind === "match";
  // the widths across the page - the table never runs past the card (SARCLA 10.11.2026: "tables are still broken")
  const widths = match ? ["19%", "15%", "16%", "10%", "8%", "32%"] : ["24%", "22%", "22%", "17%", "15%"];
  const loginYear = all.filter((x) => (x.shop?.lastLogin ?? "") >= YEAR_AGO()).length;

  return (
    <>
      <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>
        Here you link a <b>person</b> - a HubSpot contact with a shop login - to the <b>company</b> they work for. No company is merged or changed: the person only gets the company as theirs.
        Without it, their logins and orders count for no company, so no report sees them as a known customer. Nothing is linked without your click.
      </Typography>
      <Grid container spacing={2}>
        {[
          { icon: <LinkOffIcon />, tint: "amber" as const, label: "Without a company", value: u.total, note: `${full(loginYear)} logged in the last 12 months · A+P's own left out` },
          { icon: <BusinessOutlinedIcon />, tint: "green" as const, label: "A company to link", value: u.matched, note: `${full(u.withOrders ?? 0)} by their orders · ${full(u.withNumber ?? 0)} by their customer number · the rest by their e-mail domain` },
          { icon: <AlternateEmailIcon />, tint: "blue" as const, label: "Business address, no company", value: u.business, note: "find or create it in HubSpot" },
          { icon: <AddLinkIcon />, tint: "purple" as const, label: "Linked here", value: r.data.linkedCount + linkedNow, note: "from this page, every one" },
        ].map((k) => (
          <Grid key={k.label} size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={k.icon} tint={k.tint} label={k.label} value={full(k.value)} note={k.note} /></Grid>
        ))}
      </Grid>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<LinkOffIcon />} tint="amber" title={match ? "Link each person to their company" : kind === "business" ? "No company with their e-mail domain yet" : "A free e-mail address - only the company they typed says who they are"}
          note={match ? "Offered: the company their shop orders are booked on, then the one their shop account's customer number names, then those on their e-mail domain. Several? Pick one." : "The name opens the person in HubSpot: find their company there, or create it"}
          right={<Button size="small" variant="outlined" startIcon={<FileDownloadOutlinedIcon />} disabled={!rows.length} onClick={download} sx={{ textTransform: "none" }}>Download</Button>} />
        <Box sx={{ mb: 1.5 }}>
          <Choice<UnlinkedRow["kind"]> value={kind} onChange={setKind} options={[
            { key: "match", label: "A company to link", count: u.matched },
            { key: "business", label: "No company yet", count: u.business },
            { key: "free", label: "Free e-mail address", count: u.free },
          ]} />
        </Box>
        {match && (clear.length > 0 || allDone) && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", mb: 1.5, px: 1.5, py: 1, borderRadius: "12px", bgcolor: "rgba(27,122,85,.07)" }}>
            {clear.length > 0 && (
              <Button size="small" variant="contained" color="success" disableElevation disabled={busy !== null} onClick={linkAll} sx={{ textTransform: "none", fontWeight: 700, borderRadius: "8px" }}>
                {busy === "all" ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : `Link all ${full(clear.length)} sure ones`}
              </Button>
            )}
            <Typography sx={{ fontSize: "0.8rem", color: allDone ? GREEN : MUTED, fontWeight: allDone ? 700 : 400 }}>
              {allDone ?? `${full(clearOrders)} with every order booked on one company, ${full(clear.length - clearOrders)} whose shop account carries the customer number of one company - the surest links there are.`}
            </Typography>
          </Box>
        )}
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center", mb: 1.5 }}>
          <TextField size="small" label="Search" placeholder="A person, an e-mail, a company, a number, a town…" value={q} onChange={(e) => setQ(e.target.value)} sx={{ minWidth: 280, flex: "1 1 280px" }} />
          {sel("Country", country, setCountry, [{ v: "all", l: "Every country" }, ...countries.map((c) => ({ v: c, l: c }))], 140)}
          {sel("Shop", store, setStore, [{ v: "all", l: "Every store" }, ...stores.map((s) => ({ v: s, l: s }))], 190)}
          {sel("Contact owner", owner, setOwner, [{ v: "all", l: "Every owner" }, ...owners.map((o) => ({ v: o, l: o }))], 170)}
          {sel("In the shop", active, (v) => setActive(v as Active), [{ v: "any", l: "Anyone" }, { v: "login", l: "Logged in, last 12 months" }, { v: "orders", l: "Ordered" }, { v: "never", l: "Never logged in" }], 200)}
          {sel("Order", sort, (v) => setSort(v as Sort), [{ v: "sure", l: "The surest first" }, { v: "newest", l: "Newest account first" }, { v: "login", l: "Last login first" }, { v: "orders", l: "Most orders" }, { v: "visits", l: "Most visits" }, { v: "name", l: "By name" }], 180)}
          {held.stale && <CircularProgress size={14} sx={{ color: MUTED }} />}
        </Box>
        <Typography sx={{ fontSize: "0.78rem", color: MUTED, mb: 1 }}>{full(rows.length)} of {full(all.filter((x) => x.kind === kind).length)} people</Typography>
        <Box sx={{ overflowX: "auto", border: `1px solid ${HAIRLINE}`, borderRadius: "12px" }}>
          <Table size="small" sx={{ tableLayout: "fixed", width: "100%", minWidth: 900 }}>
            <colgroup>{widths.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
            <TableHead>
              <TableRow>
                {["Person", "Company they typed, where", "In the shop", "On the website", "Contact owner", ...(match ? ["Their company"] : [])].map((h) => <TableCell key={h} sx={head}>{h}</TableCell>)}
              </TableRow>
            </TableHead>
            <TableBody>
              {!rows.length && <TableRow><TableCell colSpan={widths.length} sx={{ ...body, color: MUTED, fontSize: "0.84rem" }}>{q ? "Nobody here matches the search." : "None left here."}</TableCell></TableRow>}
              {slice.map((row) => {
                const d = done[row.id];
                const chosen = row.candidates.find((c) => c.id === (pick[row.id] ?? row.candidates[0]?.id)) ?? row.candidates[0];
                const cur = money(row);
                return (
                  <TableRow key={row.id} hover>
                    {/* who the person is (SARCLA 19.10: "it should have more contact information to do the match") */}
                    <TableCell sx={body}>
                      <Box component="a" href={`${HUBSPOT}/0-1/${row.id}`} target="_blank" rel="noreferrer" title="Open the person in HubSpot" sx={{ color: INK, fontWeight: 700, fontSize: "0.84rem", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>{row.person?.name || row.person?.email || "(no name)"}</Box>
                      <Typography sx={small}>{row.person?.email || row.domain || "—"}</Typography>
                      {(row.person?.jobtitle || row.person?.phone) && <Typography sx={faint}>{[row.person?.jobtitle, row.person?.phone].filter(Boolean).join(" · ")}</Typography>}
                      {row.person?.language && <Typography sx={faint}>{LANG[row.person.language] ?? row.person.language}</Typography>}
                    </TableCell>
                    <TableCell sx={body}>
                      <Typography sx={{ ...cellText, fontWeight: 600 }}>{row.company || "(no company typed)"}</Typography>
                      <Typography sx={small}>{[row.person?.address, [row.person?.zip, row.person?.city].filter(Boolean).join(" "), row.country].filter(Boolean).join(", ") || "—"}</Typography>
                      {row.shop?.industry && <Typography sx={faint}>{row.shop.industry}</Typography>}
                    </TableCell>
                    <TableCell sx={body}>
                      <Typography sx={cellText}>Registered {day(row.shop?.since ?? row.created)}</Typography>
                      {row.shop?.store && <Typography sx={faint}>{row.shop.store}</Typography>}
                      <Typography sx={small}>{row.shop?.lastLogin ? `Last login ${day(row.shop.lastLogin)}` : "Never logged in"}</Typography>
                      <Typography sx={{ ...small, color: row.orders?.n ? TINT.green.fg : MUTED, fontWeight: row.orders?.n ? 700 : 400 }}>
                        {row.orders?.n ? `${row.orders.n} ${row.orders.n === 1 ? "order" : "orders"}${row.orders.last ? `, the last ${day(row.orders.last)}` : ""}` : "No order yet"}
                        {row.shop?.value ? ` · ${full(row.shop.value)}${cur ? ` ${cur}` : ""}` : ""}
                      </Typography>
                      {row.shop?.number && <Typography sx={small}>Customer number <b>{row.shop.number}</b></Typography>}
                      {row.shop?.products && <Typography title={row.shop.products} sx={{ ...faint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Bought: {row.shop.products}</Typography>}
                    </TableCell>
                    <TableCell sx={body}>
                      <Typography sx={cellText}>{full(row.web?.visits ?? 0)} {row.web?.visits === 1 ? "visit" : "visits"}</Typography>
                      <Typography sx={small}>{full(row.web?.views ?? 0)} pages{row.web?.lastVisit ? `, last ${day(row.web.lastVisit)}` : ""}</Typography>
                      {row.web?.source && <Typography sx={faint}>{SOURCE[row.web.source] ?? row.web.source}</Typography>}
                    </TableCell>
                    <TableCell sx={{ ...body, ...small }}>{row.person?.owner || "—"}</TableCell>
                    {match && (
                      <TableCell sx={body}>
                        {d?.ok ? (
                          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color: GREEN, fontWeight: 700, fontSize: "0.84rem" }}><CheckIcon sx={{ fontSize: 18 }} />{d.text}</Box>
                        ) : chosen ? (
                          <Box sx={{ display: "grid", gap: 0.6 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                              {row.candidates.length > 1 ? (
                                <select aria-label={`Company for ${row.company || row.domain}`} value={chosen.id} onChange={(e) => setPick((p) => ({ ...p, [row.id]: e.target.value }))}
                                  style={{ font: "inherit", fontSize: "0.82rem", padding: "5px 8px", borderRadius: 8, border: "1px solid #d5dbe4", flex: "1 1 auto", minWidth: 0, background: "#fff", color: INK }}>
                                  {row.candidates.map((c) => <option key={c.id} value={c.id}>{c.name}{c.erp ? ` · ${c.erp}` : ""}{c.city ? ` - ${c.city}` : c.country ? ` - ${c.country}` : ""}</option>)}
                                </select>
                              ) : (
                                <Box component="a" href={`${HUBSPOT}/0-2/${chosen.id}`} target="_blank" rel="noreferrer" sx={{ color: INK, fontSize: "0.84rem", fontWeight: 700, flex: "1 1 auto", minWidth: 0 }}>{chosen.name}</Box>
                              )}
                              <Button size="small" variant="contained" disableElevation disabled={busy !== null} onClick={() => link(row)} sx={{ textTransform: "none", fontWeight: 700, borderRadius: "8px", minWidth: 64, flexShrink: 0 }}>
                                {busy === row.id ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : "Link"}
                              </Button>
                            </Box>
                            <Typography sx={small}>{about(chosen)}</Typography>
                            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
                              {chosen.why && (
                                <Box component="span" title="Why it is offered" sx={{ fontSize: "0.7rem", fontWeight: 700, color: chosen.why === "domain" ? MUTED : GREEN, bgcolor: chosen.why === "domain" ? "rgba(21,34,58,.06)" : "rgba(27,122,85,.1)", px: 0.8, py: 0.2, borderRadius: "6px", whiteSpace: "nowrap" }}>
                                  {chosen.why === "orders" && chosen.orders ? `${chosen.orders} ${chosen.orders === 1 ? "order" : "orders"} on it` : `by ${WHY[chosen.why]}`}
                                </Box>
                              )}
                              {row.candidates.length > 1 && <Typography component="span" sx={faint}>{row.candidates.length - 1} more offered</Typography>}
                            </Box>
                            {d && !d.ok && <Typography sx={{ fontSize: "0.76rem", color: RED }}>{d.text}</Typography>}
                          </Box>
                        ) : "—"}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
        {pager}
      </GlassCard>
    </>
  );
}
