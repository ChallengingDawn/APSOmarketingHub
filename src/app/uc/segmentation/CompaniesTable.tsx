"use client";

// SMART SEGMENTATION - the companies themselves (SARCLA 02.11.2026: "in Portfolio put another table with the list of
// companies"). Live from HubSpot, 25 at a time, in the order of a column; on Portfolio narrowed by segment and priority,
// on Profit center by what a chart picked. Reads /api/uc/segmentation/companies.

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
import CircularProgress from "@mui/material/CircularProgress";
import ListAltIcon from "@mui/icons-material/ListAlt";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { full } from "@/app/charts/format";
import { CardTitle, FAINT, GlassCard, INK, MUTED, RED, bodyCell, clip, headCell } from "@/app/uc/report/ui";
import { Choice } from "@/app/connectors/parts";
import { PAGE, SEARCH_CAP, type CompaniesPage, type SortKey } from "@/lib/segmentation/companies";
import { countryName } from "@/lib/segmentation/newCompanies";

const hsCompany = (id: string) => `https://app-eu1.hubspot.com/contacts/26492587/record/0-2/${id}`;
const eur = (n: number | null) => (n === null ? "—" : `${full(Math.round(n))} €`);
export const PRIO_LABEL: Record<string, string> = { "1": "P1", "2": "P2", "3": "P3", "4": "No priority", "": "No priority yet" };

export type Fixed = { seg?: string; prio?: string; major?: string; split?: string };

export function CompaniesTable({ title, note, fixed = {}, segments, priorities, icon }: {
  title: string; note: string; fixed?: Fixed;
  /** the chips to narrow by: segment and priority, each with its count (Portfolio) */
  segments?: { key: string; label: string; n: number }[];
  priorities?: { key: string; label: string; n: number }[];
  icon?: React.ReactNode;
}) {
  const [seg, setSeg] = useState("all"), [prio, setPrio] = useState("all");
  const [q, setQ] = useState(""), [asked, setAsked] = useState("");
  const [sort, setSort] = useState<SortKey>("basis"), [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const key = JSON.stringify(fixed);
  useEffect(() => setPage(0), [seg, prio, asked, sort, dir, key]);
  const params = new URLSearchParams({
    ...Object.fromEntries(Object.entries(fixed).filter(([, v]) => v !== undefined)) as Record<string, string>,
    ...(seg !== "all" ? { seg } : {}), ...(prio !== "all" ? { prio } : {}), ...(asked ? { q: asked } : {}),
    sort, dir, page: String(page),
  });
  const url = `/api/uc/segmentation/companies?${params}`;
  const r = useHeld<CompaniesPage>(url, [url]).result;
  const d = r?.state === "ok" ? r.data : null;
  const total = d?.total ?? 0, reach = Math.min(total, SEARCH_CAP), pages = Math.max(1, Math.ceil(reach / PAGE));
  const head = (label: string, k?: SortKey, right = false) => (
    <TableCell key={label} sx={{ ...headCell, textAlign: right ? "right" : "left", cursor: k ? "pointer" : "default", whiteSpace: "nowrap", color: k === sort ? INK : undefined }}
      onClick={k ? () => { if (k === sort) setDir(dir === "desc" ? "asc" : "desc"); else { setSort(k); setDir(k === "name" ? "asc" : "desc"); } } : undefined}>
      {label}{k === sort && (dir === "desc" ? <ArrowDownwardIcon sx={{ fontSize: 12, ml: 0.3, verticalAlign: "middle" }} /> : <ArrowUpwardIcon sx={{ fontSize: 12, ml: 0.3, verticalAlign: "middle" }} />)}
    </TableCell>
  );
  const num = { ...bodyCell, fontSize: "0.8rem", textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" } as const;
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
      <CardTitle icon={icon ?? <ListAltIcon />} tint="slate" title={title} note={note} />
      <Box sx={{ display: "grid", gap: 1.25, mb: 1.5 }}>
        {segments && <Choice<string> value={seg} onChange={setSeg} options={[{ key: "all", label: "Every segment" }, ...segments.map((s) => ({ key: s.key, label: `${s.label} · ${full(s.n)}` }))]} />}
        {priorities && <Choice<string> value={prio} onChange={setPrio} options={[{ key: "all", label: "Every priority" }, ...priorities.map((s) => ({ key: s.key, label: `${s.label} · ${full(s.n)}` }))]} />}
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); setAsked(q.trim()); }} sx={{ display: "flex", gap: 0.75, alignItems: "center", flexWrap: "wrap" }}>
          <TextField size="small" placeholder="a name, a domain or a company id" value={q} onChange={(e) => setQ(e.target.value)} sx={{ width: 280 }} />
          <Button type="submit" size="small" variant="outlined" sx={{ textTransform: "none" }}>Find</Button>
          {asked && <Button size="small" onClick={() => { setQ(""); setAsked(""); }} sx={{ textTransform: "none" }}>Clear</Button>}
          {r === null && <CircularProgress size={14} />}
          {d && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{full(total)} {total === 1 ? "company" : "companies"}{total > SEARCH_CAP ? ` - HubSpot lists the first ${full(SEARCH_CAP)} in this order; a narrower choice or a name finds the rest` : ""}</Typography>}
        </Box>
      </Box>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead><TableRow>
            {head("Company", "name")}{head("APSO segment")}{head("Priority")}{head("Profit centre")}
            {head("Potential", "potential", true)}{head("Basis", "basis", true)}{head("Best year", "best", true)}{head(`Revenue ${d?.year ?? ""}`.trim(), "revenue", true)}
          </TableRow></TableHead>
          <TableBody>
            {(d?.rows ?? []).map((x) => (
              <TableRow key={x.id} hover>
                <TableCell sx={bodyCell}>
                  <Box component="a" href={hsCompany(x.id)} target="_blank" rel="noopener" sx={{ color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(220) }}>{x.name || x.id}</Box>
                  <Typography sx={{ fontSize: "0.7rem", color: FAINT, ...clip(220) }}>{x.owner || "no owner"}{x.country ? ` · ${countryName(x.country)}` : ""}</Typography>
                </TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap", color: x.segment ? INK : FAINT }}>{x.segment || "none"}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap", fontWeight: x.prio && x.prio < "4" ? 700 : 400 }}>{PRIO_LABEL[x.prio] ?? x.prio}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                  {x.major || <Box component="span" sx={{ color: FAINT }}>—</Box>}
                  {x.split && x.split !== x.major && <Typography sx={{ fontSize: "0.7rem", color: MUTED, ...clip(170) }}>{x.split}</Typography>}
                </TableCell>
                <TableCell sx={num}>{eur(x.potential)}</TableCell>
                <TableCell sx={{ ...num, fontWeight: 700 }}>{eur(x.basis)}</TableCell>
                <TableCell sx={num}>{eur(x.best)}</TableCell>
                <TableCell sx={num}>{eur(x.revenue)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      {d && total > PAGE && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, justifyContent: "flex-end", mt: 1 }}>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{full(page * PAGE + 1)}–{full(Math.min(reach, (page + 1) * PAGE))} of {full(total)}</Typography>
          <Button size="small" disabled={page === 0} onClick={() => setPage(page - 1)} sx={{ minWidth: 32 }}>‹</Button>
          <Button size="small" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)} sx={{ minWidth: 32 }}>›</Button>
        </Box>
      )}
      {d && !d.rows.length && <Typography sx={{ fontSize: "0.85rem", color: MUTED, mt: 1 }}>No company.</Typography>}
      {r?.state === "error" && <Typography sx={{ fontSize: "0.85rem", color: RED, mt: 1 }}>{r.error}</Typography>}
      <Typography sx={{ fontSize: "0.74rem", color: FAINT, mt: 1 }}>
        Basis = the higher of the yearly potential and the best revenue year since 2015 - what the priority is taken from. A click on a column header orders by it.
      </Typography>
    </GlassCard>
  );
}
