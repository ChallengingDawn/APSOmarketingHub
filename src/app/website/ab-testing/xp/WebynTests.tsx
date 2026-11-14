"use client";
// The external tool's tests on the Page tests page (SARCLA 13.11.2026: "connected with the tests in Webyn"; 14.11.2026:
// "don't call Webyn" - the tool is never named in the hub, and the block shows only once one of its tests was seen). It
// has no public API: the shop's own script reads, on every page the tool runs on and with the visitor's statistics consent,
// whether the visitor is in the tool's test group, which changes it applied, and who then puts something in the cart (the
// DirectUp gateway's /convert/webyn, src/lib/experiments/sync.ts). The tool's own figures are typed in on the test's page.

import { CardTitle, GlassCard } from "@/app/uc/report/ui";
import { SOURCE_COLOR, XpLoaded, XpTable, type ListData } from "./parts";

export default function WebynTests() {
  return (
    <XpLoaded<ListData> url="/api/website/ab-testing/experiments">
      {(d) => {
        const list = d.experiments.filter((e) => e.source === "webyn");
        if (!list.length) return null;
        return (
          <GlassCard sx={{ display: "grid", gap: 1 }}>
            <CardTitle icon={<span style={{ display: "inline-block", width: 12, height: 12, borderRadius: "50%", background: SOURCE_COLOR.webyn }} />} tint="amber" title="Tests of the external tool"
              note="Read on the shop itself: on each page the tool runs on, whether the visitor is in its test group or sees the page as it is, which changes it applied, and who then puts something in the cart. The tool's own result can be added on each test's page." />
            <XpTable list={list} empty="" cols={["test", "where", "status", "dates", "visitors", "result", "decision"]} />
          </GlassCard>
        );
      }}
    </XpLoaded>
  );
}
