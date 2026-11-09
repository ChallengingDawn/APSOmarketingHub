"use client";
// Website > A/B testing (SARCLA 03.11.2026: "contains a copy of the first A/B test on the chat, and then more"). The
// first test is the shop chat's e-mail before the chat: the very tab APSOassistant Chat > A/B test shows, its setting
// and its figures per country, read from and saved to the same place (src/app/website/chat/AbTab.tsx).
// Content v7 (SARCLA 10.11.2026: "Should you update the A/B testing link?"): the A/B tests planned in Content's Page
// builder are listed first, as "Pages" (./PlannedPages.tsx) - read-only, each linking to its to-do; the chat's test below.

import Box from "@mui/material/Box";
import PageHeader from "@/app/PageHeader";
import { GUTTER } from "@/app/analytics/Shell";
import Typography from "@mui/material/Typography";
import { INK, MUTED } from "@/app/uc/report/ui";
import AbTab from "../chat/AbTab";
import PlannedPages from "./PlannedPages";

export default function AbTesting() {
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader title="A/B testing" subtitle="What we test on the site, and what it shows" />
      <PlannedPages />
      <Box sx={{ mt: 1 }}>
        <Typography sx={{ fontSize: "1.15rem", fontWeight: 650, color: INK, letterSpacing: "-0.02em" }}>Chat: e-mail first</Typography>
        <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>The shop chat asks for the e-mail at the start, or during the conversation: per country, do we lose chats, do we gain e-mails</Typography>
      </Box>
      <AbTab />
    </Box>
  );
}
