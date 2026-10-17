"use client";

// SEARCH BAR - the hub's page on the shop's search bar (SARCLA, 16.10.2026: the search bar's dashboard moves
// from the APSOAssistant dashboard on Railway to the hub, under Website, "follow the pattern already on the HUB
// by tabs"; read-only first, the on/off switches at the end). The bar itself stays on Railway - every customer's
// browser calls it, and the hub has no public address; this page reads the gateway's admin API
// (src/lib/searchbar/gateway.ts). Same kit as DirectUP: the UC tab strip with the tab in the #fragment, glass
// cards, KPI tiles, pill choices, pages of rows.

import { useState } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import RefreshIcon from "@mui/icons-material/Refresh";
import PageHeader from "@/app/PageHeader";
import { GUTTER } from "@/app/analytics/Shell";
import { MUTED } from "@/app/uc/report/ui";
import { ReportTabs, useHashTab } from "@/app/uc/report/Tabs";
import { WindowPicker, isoDate, spanDays, useReportingWindow } from "@/app/window/ReportingWindow";
import type { Report } from "@/lib/searchbar/gateway";
import { Loaded } from "./shared";
import OverviewTab, { Problems, type OverviewData } from "./OverviewTab";
import ReportTab from "./ReportTab";
import SearchesTab from "./SearchesTab";
import GapsTab from "./GapsTab";
import ViewsTab from "./ViewsTab";
import AiTab from "./AiTab";
import StockTab from "./StockTab";
import JobsTab from "./JobsTab";
import BrandsTab from "./BrandsTab";
import FeaturesTab from "./FeaturesTab";
import SetupTab from "./SetupTab";

type View = "overview" | "report" | "searches" | "gaps" | "views" | "ai" | "stock" | "jobs" | "brands" | "featured" | "setup";
/** The open tab lives in the #fragment, as on the UC reports, so a link lands on it. */
const VIEW_HASH: Record<View, string> = {
  overview: "#overview", report: "#report", searches: "#searches", gaps: "#gaps", views: "#views", ai: "#ai",
  stock: "#stock", jobs: "#jobs", brands: "#brands", featured: "#featured", setup: "#setup",
};
/** The tabs the hub-wide period applies to - it sits in the header, as on the UC reports. */
const DATED: View[] = ["overview", "report"];

export default function SearchBarPage() {
  const [view, setView] = useHashTab<View>(VIEW_HASH, "overview");
  const { window: win, label } = useReportingWindow();
  // the gateway counts back from today, so it is asked back to the period's first day
  const days = Math.min(365, Math.max(1, spanDays(win.from, isoDate(new Date()))));
  const [n, setN] = useState(0);

  // Overview and Report both read through <Loaded>, and a loader keeps its last answer on screen while it asks
  // again: without a key of their own the Report tab drew the Overview's answer on the first click and the page
  // crashed (SARCLA 17.10.2026: "Application error" on the first click on Report, fine after a reload).
  const panel =
    view === "report" ? <Loaded<Report> key="report" url={`/api/website/search-bar?part=report&days=${days}&r=${n}`} what="the report">{(r) => <ReportTab r={r} label={label} />}</Loaded>
    : view === "searches" ? <SearchesTab key={n} />
    : view === "gaps" ? <GapsTab key={n} />
    : view === "views" ? <ViewsTab key={n} />
    : view === "ai" ? <AiTab key={n} />
    : view === "stock" ? <StockTab key={n} />
    : view === "jobs" ? <JobsTab key={n} />
    : view === "brands" ? <BrandsTab key={n} />
    : view === "featured" ? <FeaturesTab key={n} />
    : view === "setup" ? <SetupTab key={n} />
    : <Loaded<OverviewData> key="overview" url={`/api/website/search-bar?part=overview&days=${days}&r=${n}`} what="the overview">
        {(d) => <><Problems d={d} /><OverviewTab d={d} label={label} /></>}
      </Loaded>;

  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader
        title="Search bar"
        subtitle="The shop's search bar: what customers search, what they find, the gaps, the views it shows, its stock and brands"
        rightSlot={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {DATED.includes(view) && <WindowPicker />}
            <Tooltip title="Ask the gateway again"><IconButton size="small" onClick={() => setN((x) => x + 1)} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton></Tooltip>
          </Box>
        }
      />
      <Box>
        <ReportTabs name="searchbar" tab={view} onSelect={setView} tabs={[
          { id: "overview", label: "Overview", count: null },
          { id: "report", label: "Report", count: null },
          { id: "searches", label: "Searches", count: null },
          { id: "gaps", label: "Gaps", count: null },
          { id: "views", label: "Dynamic views", count: null },
          { id: "ai", label: "AI chat", count: null },
          { id: "stock", label: "Stock", count: null },
          { id: "jobs", label: "Stock jobs", count: null },
          { id: "brands", label: "Brands", count: null },
          { id: "featured", label: "Featured", count: null },
          { id: "setup", label: "Setup", count: null },
        ]} />
      </Box>
      <Box id={`searchbar-panel-${view}`} role="tabpanel" sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>
        {panel}
      </Box>
    </Box>
  );
}
