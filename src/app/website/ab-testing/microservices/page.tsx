"use client";
// Website > A/B testing > MICROSERVICES (SARCLA 13.11.2026: "completely different categories: pages that are sent to test,
// and microservices"; 14.11.2026: "on microservices only hardcoded"). Every service the hub lists under Website >
// Microservices (hubApps.ts - one added there is one here): those with a test first, each with its tests, then the others
// with a way to record an idea for them. The chat's rounds come from its gateway by themselves; a test of another service
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
import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { SERVICES } from "@/lib/experiments/model";
import { SyncLine, XpDialog, XpLoaded, XpTable, keyHref, type ListData } from "../xp/parts";

/** a service whose test is set and read on a page of its own */
const OWN_TEST: Record<string, string> = { chat: "/website/ab-testing/chat" };
const ORDER = ["running", "paused", "planned", "idea", "ended"];

export default function Microservices() {
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader title="Microservices" subtitle={`The shop's own services - ${SERVICES.length} of them, as Website > Microservices lists them - and their tests`} />
      <XpLoaded<ListData> url="/api/website/ab-testing/experiments">{(d, reload) => <Body d={d} reload={reload} />}</XpLoaded>
    </Box>
  );
}

function Body({ d, reload }: { d: ListData; reload: () => void }) {
  const router = useRouter();
  const [adding, setAdding] = useState<string | null>(null);
  const of = (id: string) => d.experiments.filter((e) => e.category === "microservice" && e.service === id)
    .sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || Date.parse(b.startedAt ?? b.createdAt) - Date.parse(a.startedAt ?? a.createdAt));
  const tested = SERVICES.filter((s) => of(s.id).length);
  const rest = SERVICES.filter((s) => !of(s.id).length);
  // a test recorded for a service no longer listed stays visible
  const orphans = d.experiments.filter((e) => e.category === "microservice" && !SERVICES.some((s) => s.id === e.service));
  return (
    <>
      <SyncLine d={d} reload={reload} />
      {tested.map((s) => {
        const list = of(s.id);
        return (
          <GlassCard key={s.id} sx={{ display: "grid", gap: 1 }}>
            <CardTitle icon={<HubOutlinedIcon />} tint={list.some((e) => e.status === "running") ? "green" : "slate"} title={s.name} note={s.what}
              right={
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                  {OWN_TEST[s.id] && <Button component={Link} href={OWN_TEST[s.id]} size="small" variant="outlined" sx={{ textTransform: "none", borderRadius: "999px" }}>Its test and setting</Button>}
                  <Button component={Link} href={s.href} size="small" sx={{ textTransform: "none" }}>The service</Button>
                  {d.canEdit && <Button size="small" sx={{ textTransform: "none" }} onClick={() => setAdding(s.id)}>+ Idea or test</Button>}
                </Box>
              } />
            <XpTable list={list} empty="" cols={["test", "status", "dates", "visitors", "result", "decision"]} />
          </GlassCard>
        );
      })}
      {orphans.length > 0 && (
        <GlassCard sx={{ display: "grid", gap: 1 }}>
          <CardTitle icon={<HubOutlinedIcon />} tint="slate" title="Other services" note="Tests recorded for a service Website > Microservices no longer lists." />
          <XpTable list={orphans} empty="" cols={["test", "where", "status", "dates", "result", "decision"]} />
        </GlassCard>
      )}
      <GlassCard sx={{ display: "grid", gap: 1.25 }}>
        <CardTitle icon={<HubOutlinedIcon />} tint="slate" title={`No test yet · ${rest.length}`} note="Each service as the hub lists it - record an idea for one, and it gets its own block above." />
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "1fr 1fr 1fr" }, gap: 1.25 }}>
          {rest.map((s) => (
            <Box key={s.id} sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "12px", p: 1.5, display: "grid", gap: 0.5, alignContent: "start", bgcolor: "rgba(255,255,255,.6)" }}>
              <Box component={Link} href={s.href} sx={{ fontSize: "0.88rem", fontWeight: 700, color: INK, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>{s.name}</Box>
              <Typography sx={{ fontSize: "0.76rem", color: MUTED, lineHeight: 1.4 }}>{s.what}</Typography>
              {d.canEdit
                ? <Button size="small" sx={{ justifySelf: "start", textTransform: "none", px: 0, minWidth: 0 }} onClick={() => setAdding(s.id)}>+ Idea or test</Button>
                : <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>No test yet</Typography>}
            </Box>
          ))}
        </Box>
      </GlassCard>
      {adding && <XpDialog open preset={{ category: "microservice", service: adding, status: "idea", arms: [{ name: "As it is", visitors: "", conversions: "" }, { name: "Version B", visitors: "", conversions: "" }] }}
        onClose={() => setAdding(null)} onSaved={(k) => router.push(keyHref(k))} />}
    </>
  );
}
