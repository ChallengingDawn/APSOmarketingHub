"use client";

// E-SHOP ACTIVITY — the Data Tracker's customer table, live.
//
// The desktop tracker has to be exported by hand; these figures reach HubSpot
// every night, so this is the same question answered without the export. Logins
// and views are counted by the shop on an essential-cookie basis, which is why
// they cover every customer and GA4's numbers do not.

import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import PageHeader from "@/app/PageHeader";
import { HAIRLINE, INK, MUTED, Section } from "../Shell";
import { StatTile } from "@/app/charts/StatTile";
import { compact, decimal, full } from "@/app/charts/format";
import { ESHOP_YEARS, type EshopActivity, type EshopYear } from "@/lib/integrations/eshopActivity";

type Options = { countries: string[]; mandants: string[]; apsoCustomers: string[]; representatives: string[] };

const SORTS = [
  { id: "views", label: "Most views" },
  { id: "logins", label: "Most logins" },
  { id: "revenue", label: "Most revenue" },
] as const;

export default function EshopActivityPage() {
  const [data, setData] = useState<EshopActivity | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [year, setYear] = useState<EshopYear>(2026);
  const [country, setCountry] = useState("");
  const [mandant, setMandant] = useState("");
  const [apsoCustomer, setApsoCustomer] = useState("");
  const [representative, setRepresentative] = useState("");
  const [sort, setSort] = useState<(typeof SORTS)[number]["id"]>("views");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const ctrl = new AbortController();
    const q = new URLSearchParams({ year: String(year), sort, limit: "200" });
    if (country) q.set("country", country);
    if (mandant) q.set("mandant", mandant);
    if (apsoCustomer) q.set("apsoCustomer", apsoCustomer);
    if (representative) q.set("representative", representative);
    setData(null);
    setError(null);
    fetch(`/api/analytics/eshop?${q}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok && j.data) { setData(j.data as EshopActivity); setOptions(j.options ?? null); }
        else setError(j?.error ?? j?.detail ?? "HubSpot did not answer.");
      })
      .catch((e) => { if ((e as Error)?.name !== "AbortError") setError(String(e)); });
    return () => ctrl.abort();
  }, [year, country, mandant, apsoCustomer, representative, sort]);

  // Typing filters what is on screen rather than asking HubSpot again: the rows
  // are already here, and a search per keystroke would hit the search throttle.
  const visible = (data?.rows ?? []).filter((r) => {
    if (!search.trim()) return true;
    const needle = search.toLowerCase();
    return [r.name, r.customerNumber, r.representative].some((v) => (v ?? "").toLowerCase().includes(needle));
  });

  const sum = useCallback((pick: (r: (typeof visible)[number]) => number | null) =>
    visible.reduce((acc, r) => acc + (pick(r) ?? 0), 0), [visible]);

  const cell = { borderColor: HAIRLINE, fontSize: "0.8rem" };

  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      <PageHeader
        title="E-shop activity"
        subtitle="Who logs in, how much they look at, and what they are worth — per customer, from the shop's own tracking"
      />

      <Section>
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
          <Select size="small" value={year} onChange={(e) => setYear(Number(e.target.value) as EshopYear)} sx={{ minWidth: 104 }}>
            {ESHOP_YEARS.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
          </Select>
          <Select size="small" displayEmpty value={mandant} onChange={(e) => setMandant(e.target.value)} sx={{ minWidth: 190 }}>
            <MenuItem value="">All mandants</MenuItem>
            {(options?.mandants ?? []).map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
          </Select>
          <Select size="small" displayEmpty value={country} onChange={(e) => setCountry(e.target.value)} sx={{ minWidth: 160 }}>
            <MenuItem value="">All countries</MenuItem>
            {(options?.countries ?? []).map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </Select>
          <Select size="small" displayEmpty value={apsoCustomer} onChange={(e) => setApsoCustomer(e.target.value)} sx={{ minWidth: 180 }}>
            <MenuItem value="">Any selection criterion</MenuItem>
            {(options?.apsoCustomers ?? []).map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
          </Select>
          <Select size="small" displayEmpty value={representative} onChange={(e) => setRepresentative(e.target.value)} sx={{ minWidth: 180 }}>
            <MenuItem value="">Any representative</MenuItem>
            {(options?.representatives ?? []).map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
          </Select>
          <Select size="small" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} sx={{ minWidth: 150 }}>
            {SORTS.map((s) => <MenuItem key={s.id} value={s.id}>{s.label}</MenuItem>)}
          </Select>
          <TextField
            size="small"
            placeholder="Find a customer or number"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 230 }}
          />
          {data?.total != null && (
            <Chip size="small" label={`${full(data.total)} companies active in ${year}`} sx={{ bgcolor: "#e3edf7", color: "#1b4a80", fontWeight: 600 }} />
          )}
          {error && <Typography sx={{ fontSize: "0.78rem", color: "#9e1b18" }}>{error}</Typography>}
        </Box>
      </Section>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" }, gap: 2 }}>
        <StatTile label={`Logins ${year}`} value={full(sum((r) => r.logins))} note="Shown rows only" />
        <StatTile label={`Views ${year}`} value={full(sum((r) => r.views))} note="Shown rows only" />
        <StatTile label="Views per login" value={decimal(sum((r) => r.views) / Math.max(1, sum((r) => r.logins)), 1)} note="How deep a visit goes" />
        <StatTile label="Revenue YTD" value={`€${compact(sum((r) => r.revenueYtd))}`} note="ERP, this year to date" />
      </Box>

      <Section sx={{ p: 0, overflow: "hidden" }}>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ "& td, & th": cell }}>
            <TableHead>
              <TableRow>
                {["Mandant", "Customer no.", "Customer", "Country", "Representative", "Selection criterion"].map((h) => (
                  <TableCell key={h} sx={{ fontWeight: 600, color: MUTED }}>{h}</TableCell>
                ))}
                {["Logins", "Views", "Views / login", "Revenue YTD"].map((h) => (
                  <TableCell key={h} align="right" sx={{ fontWeight: 600, color: MUTED }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell sx={{ color: MUTED, whiteSpace: "nowrap" }}>{r.mandant ?? "—"}</TableCell>
                  <TableCell sx={{ color: MUTED, whiteSpace: "nowrap" }}>{r.customerNumber ?? "—"}</TableCell>
                  <TableCell sx={{ color: INK, fontWeight: 600 }}>{r.name ?? "—"}</TableCell>
                  <TableCell sx={{ color: MUTED }}>{r.country ?? "—"}</TableCell>
                  <TableCell sx={{ color: MUTED }}>{r.representative ?? "—"}</TableCell>
                  <TableCell sx={{ color: MUTED }}>{r.apsoCustomer ?? "—"}</TableCell>
                  <TableCell align="right" sx={{ color: INK }}>{full(r.logins)}</TableCell>
                  <TableCell align="right" sx={{ color: INK, fontWeight: 700 }}>{full(r.views)}</TableCell>
                  <TableCell align="right" sx={{ color: MUTED }}>{r.viewsPerLogin == null ? "—" : decimal(r.viewsPerLogin, 1)}</TableCell>
                  <TableCell align="right" sx={{ color: INK }}>{r.revenueYtd == null ? "—" : `€${compact(r.revenueYtd)}`}</TableCell>
                </TableRow>
              ))}
              {visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} sx={{ color: MUTED, py: 3, textAlign: "center" }}>
                    {data ? "No customer matches these filters." : "Reading the shop's activity…"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>
      </Section>

      <Section>
        <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: INK, mb: 0.75 }}>Where these numbers come from</Typography>
        <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.6 }}>
          Logins and views are the shop&apos;s own counts, loaded onto the company record every night — the same figures the
          desktop E-Shop Data Tracker shows, without the export step. They are collected on an essential-cookie basis, so unlike
          anything from GA4 they cover <strong>every</strong> customer, whatever they chose on the banner. Revenue YTD is the ERP
          figure already on the company, not shop-only turnover.
          {" "}The tracker&apos;s own <strong>Orders</strong> and <strong>Total value</strong> columns count shop orders in the
          selected period; counting those here would mean one query per company, so they are not shown rather than approximated.
          {" "}Rows are the top 200 for the chosen ranking — the chip says how many companies matched in total.
        </Typography>
      </Section>
    </Box>
  );
}
