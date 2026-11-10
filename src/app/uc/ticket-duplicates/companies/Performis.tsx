"use client";

// DUPLICATES & MERGES > Companies > Left alone > Performis (SARCLA 10.11.2026: "Left alone should stay as it is, then a
// main toggle - switch to Performis: the companies that are true ERP duplicates, two or more ERP numbers; export a table
// Company unique number | company name | new company name ... MAIN ACCOUNT, SIDE ACCOUNT, DUPLICATE DON'T USE - the
// title is the only thing we can change in Performis to help the colleagues find the companies"). The rule is in
// src/lib/companyDuplicates/performis.ts; nothing is written anywhere - the file goes to Performis by hand.

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import StarOutlineIcon from "@mui/icons-material/StarOutline";
import CallSplitOutlinedIcon from "@mui/icons-material/CallSplitOutlined";
import DoNotDisturbOnOutlinedIcon from "@mui/icons-material/DoNotDisturbOnOutlined";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, KpiTile, MUTED, TINT, bodyCell, headCell } from "@/app/uc/report/ui";
import { Chip, Info } from "@/app/connectors/parts";
import { dayTime } from "@/app/uc/segmentation/lists";
import { ROLE_TAG, performisCsv, type PerfFamily, type Role } from "@/lib/companyDuplicates/performis";
import { cap, dmy, link } from "./parts";

type Data = { at: string; families: PerfFamily[] } | null;
const PAGE = 25;
const ROLE_TINT: Record<Role, "green" | "blue" | "slate"> = { main: "green", side: "blue", duplicate: "slate" };
const ROLE_NOTE: Record<Role, string> = { main: "the account that buys - the most revenue this year", side: "buys too", duplicate: "no order in 12 months" };

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function PerformisView() {
  const held = useHeld<Data>("/api/uc/company-duplicates?part=performis", []);
  const r = held.result;
  const [q, setQ] = useState("");
  const [mandant, setMandant] = useState("all");
  const [country, setCountry] = useState("all");
  const [role, setRole] = useState<"all" | Role>("all");
  const [page, setPage] = useState(0);
  const d = r?.state === "ok" ? r.data : null;
  const all = useMemo(() => d?.families ?? [], [d]);
  const mandants = useMemo(() => [...new Set(all.flatMap((f) => f.accounts.map((a) => a.mandant ?? "")))].filter(Boolean).sort(), [all]);
  const countries = useMemo(() => [...new Set(all.flatMap((f) => f.accounts.map((a) => cap(a.country))))].filter((x) => x !== "—").sort(), [all]);
  const shown = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return all.filter((f) => {
      if (mandant !== "all" && !f.accounts.some((a) => a.mandant === mandant)) return false;
      if (country !== "all" && !f.accounts.some((a) => cap(a.country) === country)) return false;
      if (role !== "all" && !f.accounts.some((a) => a.role === role)) return false;
      if (words.length) {
        const hay = [f.why, ...f.accounts.flatMap((a) => [a.name, a.erp, a.uniqueNumber, a.city, a.zip, a.ownerName])].filter(Boolean).join(" ").toLowerCase();
        if (!words.every((w) => hay.includes(w))) return false;
      }
      return true;
    });
  }, [all, q, mandant, country, role]);
  if (r === null) return <LoadingPanel label="Reading the companies with several customer numbers…" />;
  if (r.state !== "ok") return <UpstreamPanel source="Performis" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? r.status : null} onRetry={() => location.reload()} />;
  if (!d) return <Info>The list is made with the next read of every company (every hour, or Settings &gt; Read again now).</Info>;
  const accounts = all.flatMap((f) => f.accounts);
  const count = (x: Role) => accounts.filter((a) => a.role === x).length;
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const at = Math.min(page, pages - 1);
  const sel = (label: string, value: string, onChange: (v: string) => void, options: { v: string; l: string }[], width = 160) => (
    <TextField select size="small" label={label} value={value} onChange={(e) => { onChange(e.target.value); setPage(0); }} sx={{ minWidth: width }}>
      {options.map((o) => <MenuItem key={o.v} value={o.v}>{o.l}</MenuItem>)}
    </TextField>
  );
  return (
    <>
      <Grid container spacing={2}>
        {[
          { label: "Companies with several numbers", value: all.length, icon: <AccountTreeOutlinedIcon />, tint: "purple" as const, note: `${full(accounts.length)} accounts in Performis · one Mandant at a time` },
          { label: ROLE_TAG.main, value: count("main"), icon: <StarOutlineIcon />, tint: "green" as const, note: "the account that buys - the most revenue this year" },
          { label: ROLE_TAG.side, value: count("side"), icon: <CallSplitOutlinedIcon />, tint: "blue" as const, note: "buys too - an order in the last 12 months" },
          { label: ROLE_TAG.duplicate, value: count("duplicate"), icon: <DoNotDisturbOnOutlinedIcon />, tint: "slate" as const, note: "no order in the last 12 months" },
        ].map((k) => <Grid key={k.label} size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={k.icon} tint={k.tint} label={k.label} value={full(k.value)} note={k.note} /></Grid>)}
      </Grid>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<AccountTreeOutlinedIcon />} tint="purple" title="One company, several customer numbers"
          note={`The same name at the same postcode, or the same name and website - the new title for each account in Performis. Read ${dayTime(d.at)}`}
          right={
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              <Button size="small" variant="contained" disableElevation startIcon={<FileDownloadOutlinedIcon />} disabled={!shown.length} onClick={() => download("performis-new-names", performisCsv(shown))} sx={{ textTransform: "none" }}>
                Download for Performis
              </Button>
            </Box>
          } />
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center", mb: 1.5 }}>
          <TextField size="small" label="Search" placeholder="Name, number, place, owner…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} sx={{ minWidth: 260, flex: "1 1 260px" }} />
          {sel("Mandant", mandant, setMandant, [{ v: "all", l: "Every Mandant" }, ...mandants.map((m) => ({ v: m, l: m }))], 140)}
          {sel("Country", country, setCountry, [{ v: "all", l: "Every country" }, ...countries.map((c) => ({ v: c, l: c }))])}
          {sel("Tag", role, (v) => setRole(v as "all" | Role), [{ v: "all", l: "Every tag" }, ...(["main", "side", "duplicate"] as Role[]).map((x) => ({ v: x, l: ROLE_TAG[x] }))], 200)}
        </Box>
        <Typography sx={{ fontSize: "0.78rem", color: MUTED, mb: 1 }}>
          {full(shown.length)} of {full(all.length)} companies · the download has the three columns Performis needs: Company unique number, Company name, New company name{shown.length > PAGE ? ` · page ${at + 1} of ${pages}` : ""}
        </Typography>
        <Box sx={{ overflowX: "auto", border: `1px solid ${HAIRLINE}`, borderRadius: "12px" }}>
          <Table size="small" sx={{ minWidth: 1050 }}>
            <TableHead>
              <TableRow>
                {["Company unique number", "Company name", "New company name", "Customer number", "Place", "Last order", "Revenue this year (EUR)", "Owner"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}
              </TableRow>
            </TableHead>
            <TableBody>
              {!shown.length && <TableRow><TableCell colSpan={8} sx={{ ...bodyCell, color: FAINT, fontSize: "0.82rem" }}>Nothing with these filters.</TableCell></TableRow>}
              {shown.slice(at * PAGE, at * PAGE + PAGE).map((f, i) => [
                <TableRow key={`${f.key}-h`} sx={{ bgcolor: "rgba(21,34,58,.035)" }}>
                  <TableCell colSpan={8} sx={{ ...bodyCell, py: 0.8 }}>
                    <Typography component="span" sx={{ fontSize: "0.76rem", fontWeight: 800, color: FAINT, mr: 1 }}>#{at * PAGE + i + 1}</Typography>
                    <Typography component="span" sx={{ fontSize: "0.82rem", fontWeight: 600, color: INK }}>{f.why}</Typography>
                    <Typography component="span" sx={{ fontSize: "0.76rem", color: MUTED }}> · {f.accounts.length} accounts</Typography>
                  </TableCell>
                </TableRow>,
                ...f.accounts.map((a) => (
                  <TableRow key={a.id} sx={{ bgcolor: a.role === "main" ? "rgba(27,122,85,.05)" : undefined }}>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                      {a.uniqueNumber ?? "—"}{a.derived && <Box component="span" title="Not in HubSpot - made from the Mandant and the customer number" sx={{ color: FAINT, fontSize: "0.7rem" }}> (made)</Box>}
                    </TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{link(a.id, a.name)}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>
                      <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", flexWrap: "wrap" }}>
                        <Chip tint={ROLE_TINT[a.role]}>{ROLE_TAG[a.role]}</Chip>
                        <Typography component="span" sx={{ fontSize: "0.8rem", color: INK }} title={ROLE_NOTE[a.role]}>{a.newName}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap" }}><b>{a.erp}</b> · {a.mandant}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.8rem" }}>{[a.address, [a.zip, a.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || cap(a.country)}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap", color: a.buying ? TINT.green.fg : MUTED, fontWeight: a.buying ? 700 : 400 }}>{a.lastOrder ? dmy(a.lastOrder) : a.lastYear ? String(a.lastYear) : "never"}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{a.revenue ? full(a.revenue) : "—"}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.8rem" }}>{a.ownerName ?? "—"}</TableCell>
                  </TableRow>
                )),
              ])}
            </TableBody>
          </Table>
        </Box>
        {pages > 1 && (
          <Box sx={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 1, mt: 1 }}>
            <Button size="small" startIcon={<ChevronLeftIcon />} disabled={at === 0} onClick={() => setPage(at - 1)} sx={{ textTransform: "none" }}>Previous</Button>
            <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{at + 1} / {pages}</Typography>
            <Button size="small" endIcon={<ChevronRightIcon />} disabled={at >= pages - 1} onClick={() => setPage(at + 1)} sx={{ textTransform: "none" }}>Next</Button>
          </Box>
        )}
      </GlassCard>
    </>
  );
}
