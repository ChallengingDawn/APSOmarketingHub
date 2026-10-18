"use client";

// CHAT - the hub's page on the shop chat (SARCLA 18.10.2026: "start building under Website > Microservices just
// after DirectCut, without switching off the old one"). The chat itself is unchanged - HubSpot's chat on the
// shop, the orchestrator on Railway answering through the chatflow, hand-overs in the CHAT inbox, HubSpot's
// own survey - and the APSOAssistant dashboard stays up. This page takes over that dashboard's chat pages, read
// from the orchestrator (src/lib/chat/orchestrator.ts): Overview (Mission Control + Analytics), Conversations,
// Hand-overs (Escalation Debug), Test (the sandbox, now writing nothing) and Setup. Same kit as the search bar:
// the UC tab strip with the tab in the #fragment, glass cards, KPI tiles, pages of rows.

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
import { Loaded } from "./shared";
import OverviewTab, { type OverviewData } from "./OverviewTab";
import ConversationsTab from "./ConversationsTab";
import TestTab from "./TestTab";
import SetupTab from "./SetupTab";

type View = "overview" | "conversations" | "handovers" | "test" | "setup";
const VIEW_HASH: Record<View, string> = {
  overview: "#overview", conversations: "#conversations", handovers: "#handovers", test: "#test", setup: "#setup",
};

export default function ChatPage() {
  const [view, setView] = useHashTab<View>(VIEW_HASH, "overview");
  const { window: win, label } = useReportingWindow();
  // the orchestrator counts back from today, so it is asked back to the period's first day
  const days = Math.min(365, Math.max(1, spanDays(win.from, isoDate(new Date()))));
  const [n, setN] = useState(0);

  // every loader in this slot has its own key: a held answer must never be drawn by another tab (search bar, 17.10)
  const panel =
    view === "conversations" ? <ConversationsTab key={`all-${n}`} handedOnly={false} />
    : view === "handovers" ? <ConversationsTab key={`handed-${n}`} handedOnly />
    : view === "test" ? <TestTab key="test" />
    : view === "setup" ? <SetupTab key={`setup-${n}`} />
    : <Loaded<OverviewData> key="overview" url={`/api/website/chat?part=overview&days=${days}&r=${n}`} what="the overview">
        {(d) => <OverviewTab d={d} label={label} onOpenConversations={() => setView("conversations")} />}
      </Loaded>;

  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader
        title="Chat"
        subtitle="The shop chat: how many chats, what the AI answered alone and what it handed to TSA or Back Office - and a test bench for its AI"
        rightSlot={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {view === "overview" && <WindowPicker />}
            <Tooltip title="Ask the orchestrator again"><IconButton size="small" onClick={() => setN((x) => x + 1)} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton></Tooltip>
          </Box>
        }
      />
      <Box>
        <ReportTabs name="chat" tab={view} onSelect={setView} tabs={[
          { id: "overview", label: "Overview", count: null },
          { id: "conversations", label: "Conversations", count: null },
          { id: "handovers", label: "Hand-overs", count: null },
          { id: "test", label: "Test", count: null },
          { id: "setup", label: "Setup", count: null },
        ]} />
      </Box>
      <Box id={`chat-panel-${view}`} role="tabpanel" sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>
        {panel}
      </Box>
    </Box>
  );
}
