"use client";

// CHAT - the hub's page on the shop chat (SARCLA 18.10.2026: "start building under Website > Microservices just
// after DirectCut, without switching off the old one"). Read from the orchestrator (src/lib/chat/orchestrator.ts) and
// the hub's own filing of every chat (src/lib/chat/topics.ts). Since 27.10.2026 the tabs steer: one tab per Enquiry
// Category with the route its hand-overs take (SteeringTab.tsx); Overview leads with the routes by topic;
// Conversations holds all chats, the hand-overs and the search bar's chat; Setup holds how it runs and the filing.
// Same kit as the search bar: the UC tab strip with the tab in the #fragment, glass cards, KPI tiles, pages of rows.

import { useState } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import RefreshIcon from "@mui/icons-material/Refresh";
import PageHeader from "@/app/PageHeader";
import { GUTTER } from "@/app/analytics/Shell";
import { Choice } from "@/app/connectors/parts";
import { MUTED } from "@/app/uc/report/ui";
import { ReportTabs, useHashTab } from "@/app/uc/report/Tabs";
import { WindowPicker, isoDate, spanDays, useReportingWindow } from "@/app/window/ReportingWindow";
import { STEERING_TOPICS, topicSlug } from "@/lib/chat/steeringRules";
import { Loaded } from "./shared";
import OverviewTab, { type OverviewData } from "./OverviewTab";
import ConversationsTab from "./ConversationsTab";
import TestTab from "./TestTab";
import SetupTab from "./SetupTab";
import SearchBarChatTab from "./SearchBarChatTab";
import TopicsTab from "./TopicsTab";
import { RoutesCard, TopicTab, type SteeringPage } from "./SteeringTab";

const TOPIC_VIEWS = STEERING_TOPICS.map((t) => `t-${topicSlug(t)}`);
type View = string;
const VIEW_HASH: Record<View, string> = {
  overview: "#overview", ...Object.fromEntries(TOPIC_VIEWS.map((v) => [v, `#${v}`])),
  conversations: "#conversations", handovers: "#handovers", searchbar: "#searchbar", test: "#test", setup: "#setup", topics: "#topics",
};
const topicOfView = (v: View) => STEERING_TOPICS.find((t) => `t-${topicSlug(t)}` === v) ?? null;
/** the tab a view belongs to: the hand-overs and the search bar's chat are in Conversations, the filing in Setup */
const tabOf = (v: View): View => (v === "handovers" || v === "searchbar" ? "conversations" : v === "topics" ? "setup" : v);

export default function ChatPage() {
  const [view, setView] = useHashTab<View>(VIEW_HASH, "overview");
  const { window: win, label } = useReportingWindow();
  // the orchestrator counts back from today, so it is asked back to the period's first day
  const days = Math.min(365, Math.max(1, spanDays(win.from, isoDate(new Date()))));
  const [n, setN] = useState(0);
  const topic = topicOfView(view);
  const steeringUrl = `/api/website/chat?part=steering&days=${days}&r=${n}`;

  // every loader in this slot has its own key: a held answer must never be drawn by another tab (search bar, 17.10)
  const panel =
    topic ? (
      <Loaded<SteeringPage> key={`steer-${view}-${days}-${n}`} url={steeringUrl} what="the routes">
        {(d, reload) => <TopicTab d={d} topic={topic} label={label} reload={reload} />}
      </Loaded>
    )
    : view === "conversations" || view === "handovers" || view === "searchbar" ? (
      <>
        <Choice<View> value={view} onChange={setView} options={[{ key: "conversations", label: "All chats" }, { key: "handovers", label: "Hand-overs" }, { key: "searchbar", label: "Search bar chat" }]} />
        {view === "searchbar" ? <SearchBarChatTab key={`searchbar-${n}`} /> : <ConversationsTab key={`${view}-${n}`} handedOnly={view === "handovers"} />}
      </>
    )
    : view === "test" ? <TestTab key="test" />
    : view === "setup" || view === "topics" ? (
      <>
        <Choice<View> value={view} onChange={setView} options={[{ key: "setup", label: "How it runs" }, { key: "topics", label: "Filing" }]} />
        {view === "topics" ? <TopicsTab key={`topics-${n}`} days={days} label={label} /> : <SetupTab key={`setup-${n}`} />}
      </>
    )
    : (
      <>
        <Loaded<SteeringPage> key={`routes-${days}-${n}`} url={steeringUrl} what="the routes">
          {(d, reload) => <RoutesCard d={d} reload={reload} onOpen={(t) => setView(`t-${topicSlug(t)}`)} />}
        </Loaded>
        <Loaded<OverviewData> key={`overview-${days}-${n}`} url={`/api/website/chat?part=overview&days=${days}&r=${n}`} what="the overview">
          {(d) => <OverviewTab d={d} label={label} onOpenConversations={() => setView("conversations")} />}
        </Loaded>
      </>
    );

  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader
        title="APSOassistant Chat"
        subtitle="APSOassistant on the shop: per topic, what the AI solved alone and where it hands a chat over when a person is needed - TSA for sales, the Back Office call-back for the rest"
        rightSlot={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {(view === "overview" || view === "topics" || !!topic) && <WindowPicker />}
            <Tooltip title="Read again"><IconButton size="small" onClick={() => setN((x) => x + 1)} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton></Tooltip>
          </Box>
        }
      />
      <Box>
        <ReportTabs name="chat" tab={tabOf(view)} onSelect={setView} tabs={[
          { id: "overview", label: "Overview", count: null },
          ...STEERING_TOPICS.map((t) => ({ id: `t-${topicSlug(t)}`, label: t, count: null })),
          { id: "conversations", label: "Conversations", count: null },
          { id: "test", label: "Test", count: null },
          { id: "setup", label: "Setup", count: null },
        ]} />
      </Box>
      <Box id={`chat-panel-${tabOf(view)}`} role="tabpanel" sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>
        {panel}
      </Box>
    </Box>
  );
}
