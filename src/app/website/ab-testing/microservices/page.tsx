"use client";
// Website > A/B testing > MICROSERVICES (SARCLA 13.11.2026: "completely different categories: pages that are sent to test,
// and microservices"). The shop's own services - the chat, the search bar, DirectUP, the 3D gateway - each with its tests:
// running, ended and the ideas for it. The chat's rounds come from its gateway by themselves; a test of another service
// is recorded by hand until that service runs its own.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import PageHeader from "@/app/PageHeader";
import { GUTTER } from "@/app/analytics/Shell";
import { CardTitle, GlassCard, MUTED } from "@/app/uc/report/ui";
import { SERVICES } from "@/lib/experiments/model";
import { SyncLine, XpDialog, XpLoaded, XpTable, keyHref, type ListData } from "../xp/parts";

const OWN_PAGE: Record<string, string> = { chat: "/website/ab-testing/chat" };

export default function Microservices() {
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader title="Microservices" subtitle="The shop's own services and their tests: the chat, the search bar, DirectUP, the 3D gateway" />
      <XpLoaded<ListData> url="/api/website/ab-testing/experiments">{(d, reload) => <Body d={d} reload={reload} />}</XpLoaded>
    </Box>
  );
}

function Body({ d, reload }: { d: ListData; reload: () => void }) {
  const router = useRouter();
  const [adding, setAdding] = useState<string | null>(null);
  return (
    <>
      <SyncLine d={d} reload={reload} />
      {SERVICES.map((s) => {
        const list = d.experiments.filter((e) => e.category === "microservice" && e.service === s.id)
          .sort((a, b) => ["running", "paused", "planned", "idea", "ended"].indexOf(a.status) - ["running", "paused", "planned", "idea", "ended"].indexOf(b.status)
            || Date.parse(b.startedAt ?? b.createdAt) - Date.parse(a.startedAt ?? a.createdAt));
        return (
          <GlassCard key={s.id} sx={{ display: "grid", gap: 1 }}>
            <CardTitle icon={<HubOutlinedIcon />} tint={list.some((e) => e.status === "running") ? "green" : "slate"} title={s.name} note={s.what}
              right={
                <Box sx={{ display: "flex", gap: 1 }}>
                  {OWN_PAGE[s.id] && <Button component={Link} href={OWN_PAGE[s.id]} size="small" variant="outlined" sx={{ textTransform: "none", borderRadius: "999px" }}>Its test and setting</Button>}
                  {d.canEdit && <Button size="small" sx={{ textTransform: "none" }} onClick={() => setAdding(s.id)}>+ Idea or test</Button>}
                </Box>
              } />
            {list.length
              ? <XpTable list={list} empty="" cols={["test", "status", "dates", "visitors", "result", "decision"]} />
              : <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>No test yet on the {s.name.toLowerCase()} - record an idea for it.</Typography>}
          </GlassCard>
        );
      })}
      {adding && <XpDialog open preset={{ category: "microservice", service: adding, status: "idea", arms: [{ name: "As it is", visitors: "", conversions: "" }, { name: "Version B", visitors: "", conversions: "" }] }}
        onClose={() => setAdding(null)} onSaved={(k) => router.push(keyHref(k))} />}
    </>
  );
}
