"use client";

// TICKET/ORDER/ARTICLE ASSOCIATIONS > Contacts without a company (SARCLA 19.10: "build it inside the
// existing app, a separate contact tab ... they should be straightforward"). People with a shop login
// whose HubSpot contact has no company - their logins and orders count for no company. Each with the
// companies its orders are booked on and those on its e-mail domain, the likeliest first: pick, Link;
// the clear ones (all their orders on one company) in one go with "Link all". Nothing is linked
// without a click.

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
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
import { useHeld } from "@/app/analytics/AnalyticsData";
import { LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { CardTitle, GlassCard, GREEN, INK, KpiTile, MUTED, RED, bodyCell, headCell } from "@/app/uc/report/ui";
import { Choice, usePaged } from "@/app/connectors/parts";
import type { Unlinked, UnlinkedRow } from "@/lib/ticketAssoc/shopAccountRules";
import type { LinkDone } from "@/lib/ticketAssoc/shopAccounts";

type Data = { value?: Unlinked; computing: boolean; progress?: string; error?: string; links: LinkDone[]; linkedCount: number };
const HUBSPOT = "https://app-eu1.hubspot.com/contacts/26492587/record";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (iso: string) => (iso ? `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}` : "—");

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
  const computing = r?.state === "ok" && r.data.computing && !r.data.value;
  // a first read takes a few seconds: ask again until it is in
  useEffect(() => { if (!computing) return; const t = setTimeout(() => setN((x) => x + 1), 4000); return () => clearTimeout(t); }, [computing, n]);

  const u = r?.state === "ok" ? r.data.value : undefined;
  const rows = useMemo(() => (u?.rows ?? []).filter((x) => x.kind === kind), [u, kind]);
  const { slice, pager } = usePaged(rows, 20);

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
  const clear = (u.rows ?? []).filter((x) => x.byOrder && !done[x.id]?.ok);
  // the clear ones in one go - after a yes (SARCLA 19.10: "if they have an order we can also link easily")
  const linkAll = async () => {
    if (!window.confirm(`Link ${clear.length} contacts, each to the company all its orders are booked on?`)) return;
    setBusy("all");
    try {
      const res = await fetch("/api/uc/ticket-associations/shop-accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: "orders" }) });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; data?: { linked: number; failed: number; error?: string } };
      setAllDone(j.ok ? `${full(j.data?.linked ?? 0)} linked to the company of their orders${j.data?.failed ? ` - ${full(j.data.failed)} refused by HubSpot${j.data.error ? `: ${j.data.error}` : ""}` : ""}` : j.error ?? `HubSpot answered ${res.status}`);
      setN((x) => x + 1);
    } finally { setBusy(null); }
  };

  return (
    <>
      <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>
        People with a shop login whose HubSpot contact has no company: their logins and orders count for no company, so no report sees them as a known customer.
        Pick the company and Link - the contact gets it as its primary company. Nothing is linked without that click.
      </Typography>
      <Grid container spacing={2}>
        {[
          { icon: <LinkOffIcon />, tint: "amber" as const, label: "Without a company", value: u.total, note: `${full(u.createdThisYear)} opened this year · A+P's own left out` },
          { icon: <BusinessOutlinedIcon />, tint: "green" as const, label: "A company to link", value: u.matched, note: `${full(u.withOrders ?? 0)} by their orders, the rest by their e-mail domain` },
          { icon: <AlternateEmailIcon />, tint: "blue" as const, label: "Business address, no company", value: u.business, note: "find or create it in HubSpot" },
          { icon: <AddLinkIcon />, tint: "purple" as const, label: "Linked here", value: r.data.linkedCount + linkedNow, note: "from this tab, every one" },
        ].map((k) => (
          <Grid key={k.label} size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={k.icon} tint={k.tint} label={k.label} value={full(k.value)} note={k.note} /></Grid>
        ))}
      </Grid>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Choice<UnlinkedRow["kind"]> value={kind} onChange={setKind} options={[
          { key: "match", label: "A company to link", count: u.matched },
          { key: "business", label: "No company yet", count: u.business },
          { key: "free", label: "Free e-mail address", count: u.free },
        ]} />
        {held.stale && <CircularProgress size={14} sx={{ color: MUTED }} />}
      </Box>
      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 } }}>
          <CardTitle icon={<LinkOffIcon />} tint="amber" title={kind === "match" ? "Link each one to its company" : kind === "business" ? "No company with their e-mail domain yet" : "A free e-mail address - only the company they typed says who they are"}
            note={kind === "match" ? "The company their orders are booked on first, then the one named like the company they typed; open the list when there are several" : "The name opens the contact in HubSpot: find the company there, or create it"} />
          {kind === "match" && (clear.length > 0 || allDone) && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", mt: 1.25, mb: 0.5, px: 1.5, py: 1, borderRadius: "12px", bgcolor: "rgba(27,122,85,.07)" }}>
              {clear.length > 0 && (
                <Button size="small" variant="contained" color="success" disableElevation disabled={busy !== null} onClick={linkAll} sx={{ textTransform: "none", fontWeight: 700, borderRadius: "8px" }}>
                  {busy === "all" ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : `Link all ${full(clear.length)} to the company of their orders`}
                </Button>
              )}
              <Typography sx={{ fontSize: "0.8rem", color: allDone ? GREEN : MUTED, fontWeight: allDone ? 700 : 400 }}>
                {allDone ?? "Every order of these contacts is booked on one company (the ERP's customer) - the surest link there is."}
              </Typography>
            </Box>
          )}
        </Box>
        <Table size="small">
          <TableHead><TableRow>{["Company they typed", "E-mail domain", "Country", "Account since", kind === "match" ? "Link to" : ""].filter(Boolean).map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {!rows.length && <TableRow><TableCell colSpan={5} sx={{ ...bodyCell, color: MUTED, fontSize: "0.84rem" }}>None left here.</TableCell></TableRow>}
            {slice.map((row) => {
              const d = done[row.id];
              return (
                <TableRow key={row.id} hover>
                  <TableCell sx={bodyCell}>
                    <Box component="a" href={`${HUBSPOT}/0-1/${row.id}`} target="_blank" rel="noreferrer" title="Open the contact in HubSpot" sx={{ color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>{row.company || "(no company typed)"}</Box>
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, color: MUTED }}>{row.domain || "—"}</TableCell>
                  <TableCell sx={{ ...bodyCell, color: MUTED }}>{row.country || "—"}</TableCell>
                  <TableCell sx={{ ...bodyCell, color: MUTED, whiteSpace: "nowrap" }}>{day(row.created)}</TableCell>
                  {kind === "match" && (
                    <TableCell sx={{ ...bodyCell, minWidth: 340 }}>
                      {d?.ok ? (
                        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color: GREEN, fontWeight: 700, fontSize: "0.84rem" }}><CheckIcon sx={{ fontSize: 18 }} />{d.text}</Box>
                      ) : (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                          {row.candidates.length > 1 ? (
                            <select aria-label={`Company for ${row.company || row.domain}`} value={pick[row.id] ?? row.candidates[0].id} onChange={(e) => setPick((p) => ({ ...p, [row.id]: e.target.value }))}
                              style={{ font: "inherit", fontSize: "0.84rem", padding: "5px 8px", borderRadius: 8, border: "1px solid #d5dbe4", maxWidth: 280, background: "#fff", color: INK }}>
                              {row.candidates.map((c) => <option key={c.id} value={c.id}>{c.name}{c.country ? ` - ${c.country}` : ""}{c.orders ? ` · ${c.orders} of their orders` : ""}</option>)}
                            </select>
                          ) : (
                            <Box component="a" href={`${HUBSPOT}/0-2/${row.candidates[0].id}`} target="_blank" rel="noreferrer" sx={{ color: INK, fontSize: "0.84rem", fontWeight: 600 }}>{row.candidates[0].name}</Box>
                          )}
                          {(() => { const o = (row.candidates.find((c) => c.id === (pick[row.id] ?? row.candidates[0].id)) ?? row.candidates[0]).orders; return o ? (
                            <Box component="span" title="Their orders are booked on this company" sx={{ fontSize: "0.7rem", fontWeight: 700, color: GREEN, bgcolor: "rgba(27,122,85,.1)", px: 0.8, py: 0.2, borderRadius: "6px", whiteSpace: "nowrap" }}>
                              {o} {o === 1 ? "order" : "orders"} on it
                            </Box>
                          ) : null; })()}
                          <Button size="small" variant="contained" disableElevation disabled={busy !== null} onClick={() => link(row)} sx={{ textTransform: "none", fontWeight: 700, borderRadius: "8px", minWidth: 64 }}>
                            {busy === row.id ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : "Link"}
                          </Button>
                          {d && !d.ok && <Typography sx={{ fontSize: "0.76rem", color: RED, width: "100%" }}>{d.text}</Typography>}
                        </Box>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <Box sx={{ px: 2, py: 1 }}>{pager}</Box>
      </GlassCard>
    </>
  );
}
