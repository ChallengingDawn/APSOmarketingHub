"use client";

// MAP ASSIGNMENT - Wrong Performis Owners (SARCLA 24.10.2026: "allow export of all wrong owners - change it in Performis,
// but create a tab Wrong Performis Owners so we can list the deviation"). Every Performis customer whose SAE does not
// name the person the rules give it: what Performis has, what to write there instead and why, by reason and country,
// and the Excel export (these, and every company whose owner in HubSpot differs from the rules). Reads
// GET ?performisWrong=1 (src/lib/mapAssign/performisWrongDb.ts); writes nothing.

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TablePagination from "@mui/material/TablePagination";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import RuleOutlinedIcon from "@mui/icons-material/RuleOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { CardTitle, GlassCard, HAIRLINE, INK, MUTED, bodyCell, clip, headCell } from "@/app/uc/report/ui";
import { Choice } from "@/app/connectors/parts";
import { WRONG_ORDER, WRONG_TEXT, type PerformisWrongData, type WrongReason } from "@/lib/mapAssign/performisWrong";
import { API, countryName, hsCompany, type Names } from "./shared";

/** A page as the hub reads it (performisWrongDb.ts PAGE). */
const PER_PAGE = 25;

export function WrongPerformisView({ names, n }: { names: Names; n: number }) {
  const [reason, setReason] = useState<WrongReason | "">("");
  const [country, setCountry] = useState("");
  const [q, setQ] = useState("");
  const [qq, setQq] = useState("");
  const [offset, setOffset] = useState(0);
  useEffect(() => { const t = window.setTimeout(() => setQq(q.trim()), 300); return () => window.clearTimeout(t); }, [q]);
  useEffect(() => { setOffset(0); }, [reason, country, qq]);
  const url = `${API}?performisWrong=1${reason ? `&reason=${reason}` : ""}${country ? `&country=${encodeURIComponent(country)}` : ""}${qq ? `&q=${encodeURIComponent(qq)}` : ""}${offset ? `&offset=${offset}` : ""}${n ? `&n=${n}` : ""}`;
  const held = useHeld<PerformisWrongData>(url, [url]);
  const r = held.result;
  const d = r?.state === "ok" && r.data && typeof (r.data as PerformisWrongData).total === "number" ? (r.data as PerformisWrongData) : null;

  if (r === null) return <LoadingPanel label="Comparing Performis with the rules…" />;
  if (!d) return <UpstreamPanel source="Wrong Performis owners" error={r.state === "error" ? r.error : "not there yet - this tab fills in once the hub is deployed"} status={r.state === "error" ? r.status : null} onRetry={() => setOffset((x) => x)} />;

  const countries = Object.entries(d.byCountry).sort((a, b) => b[1] - a[1]);
  return (
    <>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<RuleOutlinedIcon />} tint="amber" title="Wrong Performis owners"
          note="Performis customers whose SAE does not name the person the rules give them - write the SAE on the right in Performis; the ERP sync brings it to HubSpot and rule 1 then gives that person."
          right={
            <Button component="a" href={`${API}?performisWrong=1&format=xlsx`} variant="contained" disableElevation size="small" startIcon={<FileDownloadOutlinedIcon />}
              sx={{ textTransform: "none", fontWeight: 600, borderRadius: "10px", whiteSpace: "nowrap" }}>Export to Excel</Button>
          } />
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap", mb: 0.5 }}>
          <Typography sx={{ fontSize: "1.9rem", fontWeight: 700, color: INK, letterSpacing: "-0.03em", lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{full(d.total)}</Typography>
          <Typography sx={{ fontSize: "0.95rem", color: INK, fontWeight: 600 }}>{d.total === 1 ? "company to correct in Performis" : "companies to correct in Performis"}</Typography>
        </Box>
        <Typography sx={{ fontSize: "0.8rem", color: MUTED, mb: 2 }}>
          The export has these on one sheet and, on another, every company whose owner or region responsibility in HubSpot differs from the rules ({full(d.wrongOwners)}).
        </Typography>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>{["Why", "What it means", "Companies"].map((h, i) => <TableCell key={h} sx={{ ...headCell, textAlign: i === 2 ? "right" : "left" }}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {WRONG_ORDER.filter((k) => d.byReason[k]).map((k) => (
                <TableRow key={k} hover onClick={() => setReason(reason === k ? "" : k)} sx={{ cursor: "pointer", bgcolor: reason === k ? "rgba(36,89,209,.06)" : undefined }}>
                  <TableCell sx={{ ...bodyCell, fontWeight: 600, whiteSpace: "nowrap" }}>{WRONG_TEXT[k].title}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED }}>{WRONG_TEXT[k].why}</TableCell>
                  <TableCell sx={{ ...bodyCell, textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{full(d.byReason[k] ?? 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </GlassCard>

      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <Box sx={{ display: "grid", gap: 1.25, mb: 1.5 }}>
          <Choice<WrongReason | ""> value={reason} onChange={setReason} options={[
            { key: "", label: "Every reason", count: d.total },
            ...WRONG_ORDER.filter((k) => d.byReason[k]).map((k) => ({ key: k, label: WRONG_TEXT[k].title, count: d.byReason[k] ?? 0 })),
          ]} />
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
            <Choice<string> value={country} onChange={setCountry} options={[
              { key: "", label: "All countries" },
              ...countries.slice(0, 10).map(([cc, c]) => ({ key: cc, label: cc === "??" ? "No country" : countryName(cc), count: c })),
            ]} />
            <Box sx={{ flex: 1 }} />
            <TextField size="small" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a company, ERP id or SAE" sx={{ width: { xs: "100%", sm: 280 } }} />
          </Box>
        </Box>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>{["Company", "Country", "SAE in Performis now", "", "Write in Performis", "Owner in HubSpot now", "Why"].map((h, i) => <TableCell key={`${h}${i}`} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {d.rows.map((x) => (
                <TableRow key={x.id}>
                  <TableCell sx={bodyCell}>
                    <Box component="a" href={hsCompany(x.id)} target="_blank" rel="noopener" sx={{ color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(280) }} title={x.name}>{x.name}</Box>
                    <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>ERP {x.erpId}{x.zip ? ` · ${x.zip}` : ""}</Typography>
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", whiteSpace: "nowrap" }}>{x.country ? countryName(x.country) : "—"}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", color: x.sae ? INK : MUTED, whiteSpace: "nowrap" }}>{x.sae || "none"}</TableCell>
                  <TableCell sx={{ ...bodyCell, px: 0 }}><ArrowForwardIcon sx={{ fontSize: 16, color: MUTED, display: "block" }} /></TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontWeight: 700, color: "#1b7a55", whiteSpace: "nowrap" }} title={`the rules give ${names.name(x.decided)}`}>{x.write}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", whiteSpace: "nowrap" }}>{x.ownerNow ? names.name(x.ownerNow) : "nobody"}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.78rem", color: MUTED, whiteSpace: "nowrap" }}>{WRONG_TEXT[x.reason].title}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
        {!d.rows.length && <Typography sx={{ fontSize: "0.85rem", color: MUTED, mt: 1 }}>{d.total ? "Nothing with this filter." : "Performis names the right person for every customer."}</Typography>}
        {/* the hub's pager (usePaged's), the pages read from the hub 50 at a time (SARCLA 24.10.2026: "pagination doesn't respect
            the rest of the hub's pagination") */}
        {d.filtered > PER_PAGE && (
          <TablePagination component="div" count={d.filtered} page={Math.floor(d.offset / PER_PAGE)} onPageChange={(_, p) => setOffset(p * PER_PAGE)}
            rowsPerPage={PER_PAGE} rowsPerPageOptions={[PER_PAGE]} labelDisplayedRows={({ from, to, count }) => `${from}-${to} of ${count}`}
            sx={{ borderTop: `1px solid ${HAIRLINE}` }} />
        )}
      </GlassCard>
    </>
  );
}
