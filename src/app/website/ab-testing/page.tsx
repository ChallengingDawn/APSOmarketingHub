"use client";
// Website > A/B testing (SARCLA 03.11.2026: "contains a copy of the first A/B test on the chat, and then more"). The
// first test is the shop chat's e-mail before the chat: the very tab APSOassistant Chat > A/B test shows, its setting
// and its figures per country, read from and saved to the same place (src/app/website/chat/AbTab.tsx).

import Box from "@mui/material/Box";
import PageHeader from "@/app/PageHeader";
import { GUTTER } from "@/app/analytics/Shell";
import AbTab from "../chat/AbTab";

export default function AbTesting() {
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader
        title="Chat: e-mail first"
        subtitle="The shop chat asks for the e-mail at the start, or during the conversation: per country, do we lose chats, do we gain e-mails"
      />
      <AbTab />
    </Box>
  );
}
