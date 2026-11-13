"use client";
// Webyn's tests on the Page tests page (SARCLA 13.11.2026: "connected with the tests in Webyn"). Webyn has no public API:
// the shop's own script reads, on every page Webyn runs on and with the visitor's statistics consent, which Webyn page it
// is, whether the visitor is in Webyn's test group and which changes Webyn applied - and counts who puts something in the
// cart (the DirectUp gateway's /convert/webyn, src/lib/experiments/sync.ts). Webyn's own figures (its dashboard) are typed
// in on the test's page.

import Typography from "@mui/material/Typography";
import { CardTitle, GlassCard, MUTED } from "@/app/uc/report/ui";
import { XpLoaded, XpTable, type ListData } from "./parts";

export default function WebynTests() {
  return (
    <XpLoaded<ListData> url="/api/website/ab-testing/experiments">
      {(d) => {
        const list = d.experiments.filter((e) => e.source === "webyn");
        const w = d.sync?.sources.webyn;
        return (
          <GlassCard sx={{ display: "grid", gap: 1 }}>
            <CardTitle icon={<span style={{ display: "inline-block", width: 12, height: 12, borderRadius: "50%", background: "#eb6834" }} />} tint="amber" title="Webyn's tests, as the shop sees them"
              note="Read on the shop itself: on each page Webyn runs on, whether the visitor is in Webyn's test group or sees the page as it is, which changes Webyn applied, and who then puts something in the cart. Webyn's own result can be added on each test's page." />
            {w?.error && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{w.error}</Typography>}
            <XpTable list={list} empty="No Webyn test seen on the shop yet. Webyn's test pages appear here by themselves as visitors with statistics consent open them."
              cols={["test", "where", "status", "dates", "visitors", "result", "decision"]} />
          </GlassCard>
        );
      }}
    </XpLoaded>
  );
}
