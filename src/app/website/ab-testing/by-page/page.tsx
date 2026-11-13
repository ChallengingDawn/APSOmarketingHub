"use client";
// Website > A/B testing > Pages > BY PAGE - what each shop page went through, test after test, whichever tool ran it
// (APSOconvert, Webyn, typed in): a page that keeps losing buyers shows its whole story in one place.

import { useMemo, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import PageHeader from "@/app/PageHeader";
import { GUTTER } from "@/app/analytics/Shell";
import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { readArms, type Experiment } from "@/lib/experiments/model";
import { OutcomeChip, SourceTag, StatusChip, XpLoaded, day, keyHref, liftText, type ListData } from "../xp/parts";

export default function ByPage() {
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader title="By page" subtitle="Every shop page that was tested, with all its tests in order - whichever tool ran them" />
      <XpLoaded<ListData> url="/api/website/ab-testing/experiments">{(d) => <Body d={d} />}</XpLoaded>
    </Box>
  );
}

function Body({ d }: { d: ListData }) {
  const [q, setQ] = useState("");
  const pages = useMemo(() => {
    const by = new Map<string, Experiment[]>();
    for (const e of d.experiments) if (e.category === "page" && e.surface) by.set(`${e.host ?? ""}${e.surface}`, [...(by.get(`${e.host ?? ""}${e.surface}`) ?? []), e]);
    return [...by].map(([k, list]) => ({ k, host: list[0].host, path: list[0].surface,
      list: list.sort((a, b) => Date.parse(b.startedAt ?? b.createdAt) - Date.parse(a.startedAt ?? a.createdAt)) }))
      .sort((a, b) => (b.list.some((e) => e.status === "running") ? 1 : 0) - (a.list.some((e) => e.status === "running") ? 1 : 0) || b.list.length - a.list.length);
  }, [d.experiments]);
  const shown = pages.filter((p) => !q || p.path.toLowerCase().includes(q.toLowerCase()));
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25 }}>
      <CardTitle icon={<LayersOutlinedIcon />} tint="blue" title={`${pages.length} page${pages.length === 1 ? "" : "s"} tested`} note="Pages with a test running come first, then the most tested." />
      <TextField size="small" label="Find a page" value={q} onChange={(x) => setQ(x.target.value)} sx={{ maxWidth: 360 }} />
      {!shown.length && <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{pages.length ? "No page matches." : "No page tested yet."}</Typography>}
      {shown.map((p) => (
        <Box key={p.k} sx={{ borderTop: `1px solid ${HAIRLINE}`, pt: 1.25, display: "grid", gap: 0.75 }}>
          <Box sx={{ display: "flex", gap: 1, alignItems: "baseline", flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: INK, wordBreak: "break-all" }}>{p.path}</Typography>
            {p.host && <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>{p.host}</Typography>}
            <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>· {p.list.length} test{p.list.length === 1 ? "" : "s"}</Typography>
          </Box>
          {p.list.map((e) => {
            const r = readArms(e.arms);
            return (
              <Box key={e.key} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "110px minmax(0, 1fr) 120px 90px 150px" }, gap: 1, alignItems: "center", pl: { md: 1 } }}>
                <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{day(e.startedAt)}</Typography>
                <Box sx={{ minWidth: 0 }}>
                  <Box component={Link} href={keyHref(e.key)} sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>{e.name}</Box>
                  {e.learning && <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>Learned: {e.learning}</Typography>}
                </Box>
                <SourceTag s={e.source} />
                <StatusChip s={e.status} />
                <Box sx={{ display: "flex", gap: 0.75, alignItems: "center" }}>
                  {r.best && <Typography sx={{ fontSize: "0.82rem", fontWeight: 700 }}>{liftText(r)}</Typography>}
                  <OutcomeChip o={r.outcome} />
                </Box>
              </Box>
            );
          })}
        </Box>
      ))}
    </GlassCard>
  );
}
