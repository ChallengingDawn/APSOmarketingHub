"use client";

// Search bar > Setup: how the bar is installed on the shop, the maintenance switch's state, and its database
// (the dashboard's "Install" and "Data model" pages). The switches move here last (SARCLA 16.10.2026).

import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import CodeOutlinedIcon from "@mui/icons-material/CodeOutlined";
import PowerSettingsNewOutlinedIcon from "@mui/icons-material/PowerSettingsNewOutlined";
import StorageOutlinedIcon from "@mui/icons-material/StorageOutlined";
import { full } from "@/app/charts/format";
import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, MUTED, bodyCell, headCell } from "@/app/uc/report/ui";
import { Chip } from "@/app/connectors/parts";
import type { GatewaySetting, Health, Migration } from "@/lib/searchbar/gateway";
import { Empty, Loaded } from "./shared";

type Setup = { migrations: (Migration & { creates_table?: string; row_count?: number })[]; config: { killSwitch: boolean; sameTab: boolean }; health: Health | null; setting: GatewaySetting };

/** What the bar reads, in words: the database tables and the files shipped with the gateway. */
const MODEL: { name: string; kind: string; what: string }[] = [
  { name: "hubspot_articles", kind: "table", what: "Every article with its product page (ERP number), description, material, stock and units - copied from HubSpot, stock refreshed by the nightly check and the order refresh." },
  { name: "published_registry / published_products", kind: "tables", what: "The shop's product pages from its six sitemaps, with each page's name and address in every language; refreshed every 6 hours." },
  { name: "shop_page_articles / shop_page_scan", kind: "tables", what: "Which articles each product page lists, read from the pages at night, each once a week - an article is on the shop when a page lists it." },
  { name: "smart_bar_search_logs", kind: "table", what: "Every search (personal data removed), what answered and how many results - the Report, Searches and Gaps tabs." },
  { name: "smart_bar_feedback", kind: "table", what: "What customers wrote with the feedback button." },
  { name: "data/*-families.json, *-articles.json", kind: "files", what: "The product lists behind the bar's views (plates, rods, hoses …), June snapshots kept current against the shop's pages." },
];

export default function SetupTab() {
  return (
    <Loaded<Setup> url="/api/website/search-bar?part=setup" what="the setup">
      {(d) => {
        const base = d.setting.url;
        const snippet = `<link rel="stylesheet" href="${base}/demo/smart-search.css">\n<script src="${base}/demo/smart-search.js" defer></script>`;
        return (
          <>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 7 }}>
                <GlassCard sx={{ height: "100%" }}>
                  <CardTitle icon={<CodeOutlinedIcon />} tint="blue" title="Installed on the shop" note="These two lines sit in the shop's page head (Magento: Content › Design › Configuration › HTML Head), production and ACC alike. The bar replaces the shop's own search box." />
                  <Box component="pre" sx={{ m: 0, p: 1.5, borderRadius: "10px", bgcolor: "#f5f7fb", border: `1px solid ${HAIRLINE}`, fontSize: "0.76rem", color: INK, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{snippet}</Box>
                  <Typography sx={{ fontSize: "0.76rem", color: FAINT, mt: 1 }}>Gateway: {base.replace(/^https:\/\//, "")}{d.setting.fromDefault ? " (the Railway address)" : ` · set by ${d.setting.by} on ${d.setting.at?.slice(0, 10)}`}</Typography>
                </GlassCard>
              </Grid>
              <Grid size={{ xs: 12, md: 5 }}>
                <GlassCard sx={{ height: "100%" }}>
                  <CardTitle icon={<PowerSettingsNewOutlinedIcon />} tint={d.config.killSwitch ? "pink" : "green"} title="Maintenance" note="The kill switch hides the bar on the shop and brings back the shop's own search box" />
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                    <Chip tint={d.config.killSwitch ? "pink" : "green"}>{d.config.killSwitch ? "Bar switched OFF on the shop" : "Bar live on the shop"}</Chip>
                    <Chip tint="slate">{d.config.sameTab ? "Product links open in the same tab" : "Product links open a new tab"}</Chip>
                    <Chip tint={d.health ? "green" : "pink"}>{d.health ? "Gateway answering" : "Gateway not answering"}</Chip>
                  </Box>
                  <Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: 1.25 }}>The switch itself moves here last; until then it is on the old dashboard.</Typography>
                </GlassCard>
              </Grid>
            </Grid>

            <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
              <Box sx={{ px: { xs: 2, md: 2.75 } }}>
                <CardTitle icon={<StorageOutlinedIcon />} tint="slate" title="What the bar reads" note="Its database tables and files, in words" />
              </Box>
              <Table size="small">
                <TableHead><TableRow>{["Name", "", "What it holds"].map((h, i) => <TableCell key={i} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
                <TableBody>
                  {MODEL.map((m) => (
                    <TableRow key={m.name}>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", fontWeight: 600, fontFamily: "monospace", whiteSpace: "nowrap" }}>{m.name}</TableCell>
                      <TableCell sx={bodyCell}><Chip tint="slate">{m.kind}</Chip></TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", color: MUTED }}>{m.what}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Box sx={{ px: { xs: 2, md: 2.75 }, pt: 2 }}>
                <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK, mb: 1 }}>Database changes applied</Typography>
              </Box>
              <Table size="small">
                <TableHead><TableRow>{["#", "Change", "What for", "Applied", "Rows"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
                <TableBody>
                  {d.migrations.length === 0 && <TableRow><TableCell colSpan={5} sx={bodyCell}><Empty>None recorded.</Empty></TableCell></TableRow>}
                  {d.migrations.map((m) => (
                    <TableRow key={m.num}>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.8rem" }}>{m.num}</TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", fontFamily: "monospace" }}>{m.name}</TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED }}>{m.description}</TableCell>
                      <TableCell sx={bodyCell}><Chip tint={m.applied ? "green" : "amber"}>{m.applied ? "yes" : "no"}</Chip></TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.8rem" }}>{m.row_count != null ? full(m.row_count) : "–"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </GlassCard>
          </>
        );
      }}
    </Loaded>
  );
}
