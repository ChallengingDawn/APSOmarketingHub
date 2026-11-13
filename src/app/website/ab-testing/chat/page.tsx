"use client";
// Website > A/B testing > Microservices > CHAT (SARCLA 03.11.2026: "contains a copy of the first A/B test on the chat").
// The shop chat's e-mail test: the very tab APSOassistant Chat > A/B test shows, its setting and its figures per round
// and country (src/app/website/chat/AbTab.tsx). Moved here from the app's front page on 13.11.2026, when the front page
// became Mission control; each round is also a test in the record (History, the test's own page).

import Box from "@mui/material/Box";
import PageHeader from "@/app/PageHeader";
import { GUTTER } from "@/app/analytics/Shell";
import AbTab from "../../chat/AbTab";

export default function ChatTest() {
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader title="Chat: the e-mail" subtitle="The shop chat asks for the e-mail first, later, or offers the conversation's summary mid-chat: do we lose chats, do we gain e-mails" />
      <AbTab />
    </Box>
  );
}
