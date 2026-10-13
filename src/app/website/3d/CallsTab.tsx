"use client";

// 3D files > Calls to AP-Link (SARCLA, 13.10.2026: "the number of calls to AP-Link, and where they came
// from - 3D page, product page, search bar, HubSpot"). The 3D Gateway counts every request and every
// AP-Link call by source and store view; the hub collects them every 15 minutes. The search bar itself
// never calls AP-Link: the catalogue's search reads the search bar's catalogue, counted as searches.

import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import AltRouteOutlinedIcon from "@mui/icons-material/AltRouteOutlined";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { CardTitle, GlassCard, KpiTile, MUTED, bodyCell, headCell } from "@/app/uc/report/ui";
import { Chip, Info } from "@/app/connectors/parts";
import type { CallsReport } from "@/lib/threeD/calls";
import { KIND_LABEL, SOURCE_LABEL } from "@/lib/threeD/counts";
import Bars from "./Bars";

const WHAT: Record<string, string> = { page: "opened the catalogue", script: "loaded the 3D button", check: "checked an article", download: "downloaded a file", search: "searched", request: "sent the form" };
const ago = (iso: string) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 48 * 60 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
};

export default function CallsTab({ from, to }: { from: string; to: string }) {
  const held = useHeld<CallsReport>(`/api/website/3d/calls?from=${from}&to=${to}`, [from, to]);
  const r = held.result;
  if (r === null) return <LoadingPanel label="Reading the 3D Gateway's counts…" />;
  if (r.state === "not-configured") {
    return <Info>The hub has no key for the 3D Gateway yet (THREED_ADMIN_KEY). The counts appear here once it is set on the hub.</Info>;
  }
  if (r.state === "error") return <UpstreamPanel source="3D Gateway counts" error={r.error} status={r.status} onRetry={() => location.reload()} />;
  const d = r.data;

  const sum = (f: (x: CallsReport["rows"][number]) => boolean) => d.rows.filter(f).reduce((a, x) => a + x.n, 0);
  const aplink = sum((x) => x.kind === "aplink");
  const bySource = Object.keys(SOURCE_LABEL)
    .map((s) => ({ label: SOURCE_LABEL[s], n: sum((x) => x.kind === "aplink" && x.source === s) }))
    .filter((x) => x.n > 0);
  const locales = [...new Set(d.rows.filter((x) => x.kind === "aplink").map((x) => x.locale))];
  const byLocale = locales
    .map((l) => ({ label: l ? l.toUpperCase() : "Store view not known", n: sum((x) => x.kind === "aplink" && x.locale === l) }))
    .sort((a, b) => b.n - a.n);
  const byKind = Object.keys(KIND_LABEL).filter((k) => k !== "aplink")
    .map((k) => ({ label: KIND_LABEL[k], n: sum((x) => x.kind === k) }))
    .filter((x) => x.n > 0);
  // the shop's own traffic: the 3D button loaded on a shop page, or the catalogue opened from the CMS page
  const shopSeen = d.callers.some((c) => (c.source === "product-page" && c.what === "script") || (c.source === "catalogue" && c.what === "page"));

  return (
    <>
      {!shopSeen && (
        <Info>
          The shop still loads the 3D catalogue and the product-page 3D button from the Pricing Hub, which counts nothing. The calls appear here
          once the shop points at the 3D Gateway - see Settings for the address and the snippets to paste.
        </Info>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<HubOutlinedIcon />} tint="blue" label="AP-Link calls" value={full(aplink)} note="every query and download sent to AP-Link" /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<FactCheckOutlinedIcon />} tint="purple" label="Availability checks" value={full(sum((x) => x.kind === "check"))} note="is there a 3D, a drawing, a data sheet" /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<DownloadOutlinedIcon />} tint="green" label="Downloads" value={full(sum((x) => x.kind === "download"))} note="STEP models, drawings, data sheets" /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<SearchOutlinedIcon />} tint="amber" label="Searches" value={full(sum((x) => x.kind === "search"))} note="in the 3D catalogue (the search bar's catalogue)" /></Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <GlassCard sx={{ height: "100%" }}>
            <CardTitle icon={<AltRouteOutlinedIcon />} tint="blue" title="AP-Link calls by source" note="Where the request behind each call came from" />
            <Bars rows={bySource} />
          </GlassCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <GlassCard sx={{ height: "100%" }}>
            <CardTitle icon={<PublicOutlinedIcon />} tint="green" title="AP-Link calls by store view" note="The shop's language of the page that asked" />
            <Bars rows={byLocale} />
          </GlassCard>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <GlassCard sx={{ height: "100%" }}>
            <CardTitle icon={<CategoryOutlinedIcon />} tint="purple" title="What was asked" note="Every request the 3D Gateway answered" />
            <Bars rows={byKind} />
          </GlassCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <GlassCard sx={{ height: "100%", p: 0, pt: { xs: 2, md: 2.5 } }}>
            <Box sx={{ px: { xs: 2, md: 2.75 } }}>
              <CardTitle icon={<HistoryOutlinedIcon />} tint="slate" title="Last call from each place" note="Proof by traffic of who uses the 3D Gateway" />
            </Box>
            <Table size="small">
              <TableHead>
                <TableRow>{["Who", "What", "Last", "Since start"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow>
              </TableHead>
              <TableBody>
                {d.callers.length === 0 && (
                  <TableRow><TableCell colSpan={4} sx={{ ...bodyCell, fontSize: "0.84rem", color: MUTED }}>Nobody has called the 3D Gateway yet.</TableCell></TableRow>
                )}
                {d.callers.slice(0, 12).map((c) => (
                  <TableRow key={`${c.source}-${c.locale}-${c.what}`} hover>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.84rem" }}>{SOURCE_LABEL[c.source] ?? c.source}{c.locale ? ` · ${c.locale.toUpperCase()}` : ""}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.84rem" }}>{WHAT[c.what] ?? c.what}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", whiteSpace: "nowrap" }}>{ago(c.lastAt)}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontVariantNumeric: "tabular-nums" }}>{full(c.n)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </GlassCard>
        </Grid>
      </Grid>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
        {d.status && <Chip tint={d.status.aplink.reachable ? "green" : "pink"}>{d.status.aplink.reachable ? `AP-Link reachable · ${d.status.aplink.ms} ms` : "AP-Link not reachable"}</Chip>}
        {d.status && <Chip tint="slate">3D Gateway {d.status.commit}</Chip>}
        <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
          {d.collectedAt ? `Counts collected ${ago(d.collectedAt)} · every 15 minutes` : "No counts collected yet"}
        </Typography>
      </Box>
    </>
  );
}
