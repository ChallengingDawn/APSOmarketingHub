"use client";

// MAP ASSIGNMENT - the differences: per country how many companies the saved rules would give someone else, then
// company by company - owner now -> decided, why, how many of its contacts are off, and what live mode wrote.

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import CompareArrowsOutlinedIcon from "@mui/icons-material/CompareArrowsOutlined";
import { full } from "@/app/charts/format";
import { CardTitle, GlassCard, HAIRLINE, INK, MUTED, RED, bodyCell, clip, headCell } from "@/app/uc/report/ui";
import { Chip, Choice, Info, usePaged, when } from "@/app/connectors/parts";
import type { CompanyChange, MapData } from "@/lib/mapAssign/api";
import { FLAG_LABEL, VIA_LABEL, countryName, hsCompany, type Names } from "./shared";

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
const select = { minWidth: 170, "& .MuiInputBase-input": { fontSize: "0.8rem", py: 0.6 } };

function Written({ c, live }: { c: CompanyChange; live: boolean }) {
  if (c.wrote) return c.wrote.ok
    ? <Chip tint="green">written {when(c.wrote.at)}</Chip>
    : <Typography component="span" sx={{ fontSize: "0.76rem", color: RED }} title={c.wrote.error ?? ""}>failed{c.wrote.error ? `: ${c.wrote.error}` : ""}</Typography>;
  return live ? <Chip tint="amber">next scan</Chip> : <Chip tint="slate">shadow</Chip>;
}

export function DiffView({ d, names }: { d: MapData; names: Names }) {
  const [country, setCountry] = useState<string>("all");
  const [via, setVia] = useState<string>("all");
  const [flag, setFlag] = useState<string>("all");
  const [person, setPerson] = useState<string>("all");
  const [q, setQ] = useState("");
  const summaries = [...d.countries].sort((a, b) => b.companies - a.companies);
  const inCountry = country === "all" ? d.changes : d.changes.filter((c) => (c.country ?? "") === country);
  const people = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of inCountry) for (const o of new Set([c.ownerNow, c.decided.owner].filter((x): x is string => !!x).map(String))) m.set(o, (m.get(o) ?? 0) + 1);
    return [...m].sort((a, b) => names.name(a[0]).localeCompare(names.name(b[0])));
  }, [inCountry, names]);
  const flags = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of inCountry) for (const f of c.decided.flags) m.set(f, (m.get(f) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [inCountry]);
  const needle = q.trim().toLowerCase();
  const rows = inCountry.filter((c) =>
    (via === "all" || c.decided.via === via)
    && (flag === "all" || (flag === "none" ? !c.decided.flags.length : c.decided.flags.includes(flag)))
    && (person === "all" || String(c.ownerNow) === person || String(c.decided.owner) === person)
    && (!needle || c.name.toLowerCase().includes(needle) || (c.zip ?? "").toLowerCase().startsWith(needle) || (c.sae ?? "").toLowerCase().includes(needle)));
  const { slice, pager } = usePaged(rows, 20);
  const countries = [...new Set(d.changes.map((c) => c.country ?? ""))];
  const countOf = (cc: string) => d.changes.filter((c) => (c.country ?? "") === cc).length;
  return (
    <>
      <Grid container spacing={2}>
        {summaries.map((s) => {
          const on = country === s.country;
          const flagged = Object.entries(s.flags).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
          return (
            <Grid key={s.country} size={{ xs: 12, sm: 6, lg: 4, xl: 3 }}>
              <Box component="button" type="button" onClick={() => setCountry(on ? "all" : s.country)} aria-pressed={on}
                sx={{
                  all: "unset", boxSizing: "border-box", cursor: "pointer", display: "block", width: "100%", height: "100%",
                  bgcolor: "rgba(255,255,255,.78)", border: `1px solid ${on ? "#2459d1" : "rgba(255,255,255,.8)"}`, borderRadius: "18px", p: 2,
                  boxShadow: "0 1px 2px rgba(31,45,78,.04), 0 12px 32px rgba(31,45,78,.07)", "&:focus-visible": { outline: "2px solid #2459d1" },
                }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
                  <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: INK }}>{countryName(s.country)}</Typography>
                  {s.live ? <Chip tint="pink">LIVE</Chip> : <Chip tint="slate">shadow</Chip>}
                </Box>
                <Box sx={{ display: "flex", gap: 2.5, mt: 1 }}>
                  <Box>
                    <Typography sx={{ fontSize: "1.35rem", fontWeight: 700, color: INK, lineHeight: 1.1 }}>{full(s.companies)}</Typography>
                    <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>companies</Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: "1.35rem", fontWeight: 700, color: s.change ? "#a96a12" : INK, lineHeight: 1.1 }}>{full(s.change)}</Typography>
                    <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>would change · {pct(s.change, s.companies)}</Typography>
                  </Box>
                </Box>
                {flagged.length > 0 && (
                  <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 1 }}>
                    {flagged.map(([f, n]) => <Chip key={f} tint={f === "owner-deactivated" ? "pink" : "amber"}>{FLAG_LABEL[f] ?? f} · {full(n)}</Chip>)}
                  </Box>
                )}
              </Box>
            </Grid>
          );
        })}
        {!summaries.length && <Grid size={{ xs: 12 }}><Info>No scan yet - the countries appear after the first one.</Info></Grid>}
      </Grid>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<CompareArrowsOutlinedIcon />} tint="amber" title={`Company by company · ${full(rows.length)}`}
          note="Companies whose owner or region responsibility differs from what the saved rules decide. Their contacts follow the company" />
        {d.changes.length >= 3000 && <Box sx={{ mb: 1.5 }}><Info>The first 3,000 differences, biggest countries first - the counts above are complete.</Info></Box>}
        <Box sx={{ display: "flex", gap: 1.25, flexWrap: "wrap", alignItems: "center", mb: 1.5 }}>
          <TextField select size="small" value={country} onChange={(e) => { setCountry(e.target.value); setPerson("all"); setFlag("all"); }} sx={select} aria-label="Country">
            <MenuItem value="all">{`All countries · ${full(d.changes.length)}`}</MenuItem>
            {countries.map((cc) => <MenuItem key={cc || "none"} value={cc}>{`${cc ? countryName(cc) : "No country"} · ${full(countOf(cc))}`}</MenuItem>)}
          </TextField>
          <TextField select size="small" value={person} onChange={(e) => setPerson(e.target.value)} sx={select} aria-label="Person">
            <MenuItem value="all">Everyone</MenuItem>
            {people.map(([o, n]) => <MenuItem key={o} value={o}>{`${names.name(o)} · ${full(n)}`}</MenuItem>)}
          </TextField>
          <TextField size="small" placeholder="company, postcode or SAE" value={q} onChange={(e) => setQ(e.target.value)} sx={{ minWidth: 200, "& .MuiInputBase-input": { fontSize: "0.8rem", py: 0.6 } }} />
        </Box>
        <Box sx={{ display: "grid", gap: 1, mb: 1.5 }}>
          <Choice<string> value={via} onChange={setVia} options={[
            { key: "all", label: "Any reason", count: inCountry.length },
            ...(["key", "sae", "zone", "default"] as const).map((v) => ({ key: v, label: `By ${VIA_LABEL[v]}`, count: inCountry.filter((c) => c.decided.via === v).length })),
          ]} />
          {flags.length > 0 && (
            <Choice<string> value={flag} onChange={setFlag} options={[
              { key: "all", label: "Any flag" },
              ...flags.map(([f, n]) => ({ key: f, label: FLAG_LABEL[f] ?? f, count: n })),
              { key: "none", label: "No flag", count: inCountry.filter((c) => !c.decided.flags.length).length },
            ]} />
          )}
        </Box>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>{["Company", "Where · SAE", "Owner now → decided, and why", "Contacts off", "Written"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {slice.map((c) => {
                const regionOff = c.regionNow !== null && String(c.regionNow) !== String(c.ownerNow);
                return (
                  <TableRow key={c.id}>
                    <TableCell sx={bodyCell}>
                      <Box component="a" href={hsCompany(c.id)} target="_blank" rel="noopener" sx={{ color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(230) }} title={c.name}>{c.name || c.id}</Box>
                      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.25 }}>
                        <Chip tint="slate">{VIA_LABEL[c.decided.via] ?? c.decided.via}</Chip>
                        {c.decided.flags.map((f) => <Chip key={f} tint={f === "owner-deactivated" ? "pink" : "amber"}>{FLAG_LABEL[f] ?? f}</Chip>)}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.8rem" }}>
                      <Box sx={{ whiteSpace: "nowrap" }}>{c.country ?? "—"} · {c.zip || "no postcode"}</Box>
                      <Box sx={{ fontSize: "0.74rem", color: MUTED, ...clip(150) }} title={c.sae ?? ""}>{c.sae ? `SAE ${c.sae}` : "no SAE"}</Box>
                    </TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", whiteSpace: "nowrap" }}>
                      <span style={{ color: MUTED }}>{c.ownerNow ? names.name(c.ownerNow) : "nobody"}</span> → <b>{names.name(c.decided.owner)}</b>
                      {regionOff && <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>region now: {names.name(c.regionNow)}</Typography>}
                      <Typography sx={{ fontSize: "0.74rem", color: MUTED, whiteSpace: "normal", maxWidth: 300 }} title={c.decided.detail}>{c.decided.detail}</Typography>
                    </TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", textAlign: "right" }}>{c.contactsOff ? full(c.contactsOff) : ""}</TableCell>
                    <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}><Written c={c} live={!!d.live[c.country ?? ""]} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
        {pager}
        {!rows.length && <Typography sx={{ fontSize: "0.85rem", color: MUTED, mt: 1, borderTop: `1px solid ${HAIRLINE}`, pt: 1 }}>{d.changes.length ? "Nothing with these filters." : "No differences: every company has the owner the rules decide."}</Typography>}
      </GlassCard>
    </>
  );
}
