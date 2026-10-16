"use client";

// Search bar > Stock: every article's stock as the bar knows it (the dashboard's Stock page) - Performis'
// availability in the SALES unit, the partner stock, and whether the shop lists the article (a page lists it;
// the page alone counts only while it has not been read). Pages of 50, read from the gateway.

import { useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TablePagination from "@mui/material/TablePagination";
import TextField from "@mui/material/TextField";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import HandshakeOutlinedIcon from "@mui/icons-material/HandshakeOutlined";
import { full } from "@/app/charts/format";
import { CardTitle, FAINT, GlassCard, HAIRLINE, KpiTile, RED, bodyCell, clip, headCell } from "@/app/uc/report/ui";
import { Chip, Choice } from "@/app/connectors/parts";
import type { Stock, StockRow } from "@/lib/searchbar/gateway";
import { Empty, Loaded, Num, when } from "./shared";

type State = "" | "in" | "out" | "nodata" | "ext";
type Pub = "" | "1" | "0";
const PER = 50;

const qty = (n: number | null) => (n == null ? "–" : Number.isInteger(n) ? full(n) : n.toLocaleString("de-CH", { maximumFractionDigits: 3 }));

function stateChip(r: StockRow) {
  if (r.state === "in") return <Chip tint="green">in stock</Chip>;
  if (r.state === "ext") return <Chip tint="blue">partner stock</Chip>;
  if (r.state === "nodata") return <Chip tint="slate">no data</Chip>;
  return <Chip tint="amber">none</Chip>;
}

function Rows({ d, page, setPage }: { d: Stock; page: number; setPage: (p: number) => void }) {
  return (
    <>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 900 }}>
          <TableHead><TableRow>{["Article", "Product page", "Description", "Stock", "Sales unit", "Partner", "On the shop", "Refreshed"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {d.rows.length === 0 && <TableRow><TableCell colSpan={8} sx={bodyCell}><Empty>No article matches.</Empty></TableCell></TableRow>}
            {d.rows.map((r) => (
              <TableRow key={`${r.sku}-${r.product_number}`} hover>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{r.sku}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: FAINT, fontVariantNumeric: "tabular-nums" }}>{r.product_number}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", ...clip(320) }} title={r.description}>{r.description}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", whiteSpace: "nowrap" }}>
                  <Box sx={{ display: "flex", gap: 0.75, alignItems: "center" }}>{stateChip(r)}<Num>{qty(r.stock_sales ?? r.stock_qty)}</Num></Box>
                </TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem" }}>{r.sales_unit || r.stock_unit || "–"}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem" }}><Num>{r.stock_anyseals ? qty(r.stock_anyseals) : "–"}</Num></TableCell>
                <TableCell sx={bodyCell}>{r.published ? <Chip tint="green">listed</Chip> : <Chip tint="slate">not listed</Chip>}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.78rem", whiteSpace: "nowrap", color: r.stock_synced_at ? FAINT : RED }}>{r.stock_synced_at ? when(r.stock_synced_at) : "never"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      {d.filtered_total > PER && (
        <TablePagination component="div" count={d.filtered_total} page={page} onPageChange={(_, n) => setPage(n)} rowsPerPage={PER} rowsPerPageOptions={[PER]}
          labelDisplayedRows={({ from, to, count }) => `${full(from)}-${full(to)} of ${full(count)}`} sx={{ borderTop: `1px solid ${HAIRLINE}` }} />
      )}
    </>
  );
}

export default function StockTab() {
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [state, setState] = useState<State>("");
  const [pub, setPub] = useState<Pub>("");
  const [page, setPage] = useState(0);
  const set = <T,>(f: (v: T) => void) => (v: T) => { f(v); setPage(0); };
  const url = `/api/website/search-bar?part=stock&limit=${PER}&offset=${page * PER}&state=${state}&published=${pub}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
  return (
    <Loaded<Stock> url={url} what="the stock">
      {(d) => (
        <>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<Inventory2OutlinedIcon />} tint="blue" label="Articles" value={full(d.summary.total)} note={`${full(d.summary.with_stock)} with a stock figure`} /></Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<CheckCircleOutlineIcon />} tint="green" label="In stock" value={full(d.summary.in_stock)} note="Performis, in the sales unit" /></Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<RemoveCircleOutlineIcon />} tint="amber" label="No stock" value={full(d.summary.no_stock)} note={`${full(d.summary.no_data)} without any figure`} /></Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<HandshakeOutlinedIcon />} tint="purple" label="Partner stock only" value={full(d.summary.external)} note="shown as external stock" /></Grid>
          </Grid>
          <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
            <Box sx={{ px: { xs: 2, md: 2.75 } }}>
              <CardTitle icon={<HelpOutlineIcon />} tint="slate" title="Articles" note={`${full(d.filtered_total)} match · "On the shop": a shop page lists the article`}
                right={
                  <Box component="form" onSubmit={(e) => { e.preventDefault(); setQ(text.trim()); setPage(0); }}>
                    <TextField size="small" placeholder="Article or description… (Enter)" value={text} onChange={(e) => setText(e.target.value)} sx={{ width: 260 }} />
                  </Box>
                } />
              <Box sx={{ display: "grid", gap: 1, mb: 1.5 }}>
                <Choice<State> value={state} onChange={set(setState)} options={[{ key: "", label: "Any stock" }, { key: "in", label: "In stock" }, { key: "out", label: "No stock" }, { key: "nodata", label: "No data" }, { key: "ext", label: "Partner stock only" }]} />
                <Choice<Pub> value={pub} onChange={set(setPub)} options={[{ key: "", label: "Listed or not" }, { key: "1", label: "Listed on the shop" }, { key: "0", label: "Not listed" }]} />
              </Box>
            </Box>
            <Rows d={d} page={page} setPage={setPage} />
          </GlassCard>
        </>
      )}
    </Loaded>
  );
}
