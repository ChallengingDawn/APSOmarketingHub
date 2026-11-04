"use client";
// THE KPIS, TEAM BY TEAM - a tab of the action plan beside From Scroll to Sale (SARCLA 04.11.2026: "this KPI like this is
// a bad idea, it will create a lot of confusion - create another tab in the header like From Scroll to Sale: KPIs; here
// subdivide by Digital Growth, ESO, TSA, Product, Website KPIs with the placeholder like in BUC View per team ... the KPI
// design and everything should be the same, you're duplicating a lot"). Each team's BUC View, the very one of its
// reports - its tiles, their Actions (a task or a sub-action made from a KPI, its ticket), their targets - one team at a
// time; nothing drawn again here. A team whose reports have no BUC View yet says so, in a BUC View's own panel.
// Back-Office has one too, so it is here with the others.

import { useEffect, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { HomeBar } from "@/app/HomeBar";
import { FAINT, GlassCard, HAIRLINE, INK, MUTED, TINT } from "@/app/uc/report/ui";
import { GUTTER } from "@/app/analytics/Shell";
import MarketingKpisMacro from "@/app/reporting/marketing-kpis/page";
import EsoBucView from "@/app/reporting/eso-benchmark/page";
import TsaBucView from "@/app/reporting/tsa-benchmark/page";
import { BoBucView } from "@/app/reporting/back-office/BackOffice";
import { categoryBySlug, categoryEntry } from "@/lib/reporting/categories";

/** A team, its BUC View when its reports have one, and its reports - by their category in Advanced reporting. */
type Team = { id: string; name: string; view?: () => React.ReactElement; slug: string };
const TEAMS: Team[] = [
  { id: "digital-growth", name: "Digital Growth", view: () => <MarketingKpisMacro />, slug: "marketing" },
  { id: "eso", name: "ESO", view: () => <EsoBucView />, slug: "eso" },
  { id: "tsa", name: "TSA", view: () => <TsaBucView />, slug: "tsa" },
  { id: "back-office", name: "Back-Office", view: () => <BoBucView />, slug: "back-office" },
  { id: "products", name: "Products", slug: "products" },
  { id: "website", name: "Website", slug: "website" },
];

/** A team whose reports have no BUC View yet: the BUC View's own panel, its KPIs' places to come. */
function Placeholder({ t }: { t: Team }) {
  const c = categoryBySlug(t.slug);
  const reports = c?.name ?? `${t.name} Reports`;
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 } }}>
      <GlassCard sx={{ display: "grid", gap: 1.5 }}>
        <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: FAINT }}>{t.name} KPIs</Typography>
        <Typography sx={{ fontSize: "0.95rem", color: INK }}>
          {reports} have no BUC View yet - its KPIs come here as Digital Growth&apos;s, ESO&apos;s and TSA&apos;s do, each tile with its Actions and its target.
        </Typography>
        <Box sx={{ display: "grid", gap: 1.25, gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" } }}>
          {[0, 1, 2].map((k) => (
            <Box key={k} sx={{ height: 120, borderRadius: "14px", border: `1.5px dashed ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.5)", display: "grid", placeItems: "center" }}>
              <Typography sx={{ fontSize: "0.8rem", color: FAINT }}>A KPI of {t.name}</Typography>
            </Box>
          ))}
        </Box>
        <Box component={Link} href={c ? categoryEntry(c) : "/reporting"} sx={{ justifySelf: "start", fontSize: "0.86rem", fontWeight: 650, color: TINT.blue.fg, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
          Open {reports}
        </Box>
      </GlassCard>
    </Box>
  );
}

export default function PlanKpisPage() {
  const [team, setTeam] = useState(TEAMS[0].id);
  // the team in the address, so a link opens on it
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("team");
    if (t && TEAMS.some((x) => x.id === t)) setTeam(t);
  }, []);
  const pick = (id: string) => {
    setTeam(id);
    const u = new URL(window.location.href);
    u.searchParams.set("team", id);
    window.history.replaceState(null, "", u.toString());
  };
  const t = TEAMS.find((x) => x.id === team) ?? TEAMS[0];
  return (
    <Box sx={{ width: "100%", minWidth: 0 }}>
      <Box sx={{ px: { xs: 2, md: 3 }, pt: { xs: 2, md: 2.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2 }}>
        <HomeBar on="KPIs" plan />
        <GlassCard sx={{ display: "grid", gap: 1.5 }}>
          <Box>
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: FAINT }}>KPIs</Typography>
            <Typography component="h1" sx={{ fontFamily: "var(--font-outfit), var(--font-inter), sans-serif", fontSize: { xs: "1.35rem", md: "1.55rem" }, fontWeight: 650, letterSpacing: "-0.02em", color: INK, mt: 0.5, textWrap: "balance" }}>
              Each team&apos;s KPIs, as their BUC View has them - a target and an action from any of them
            </Typography>
          </Box>
          {/* one team at a time, square choices as the plan's */}
          <Box role="tablist" aria-label="Team" sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
            {TEAMS.map((x) => {
              const on = x.id === t.id;
              return (
                <Box key={x.id} component="button" type="button" role="tab" aria-selected={on} onClick={() => pick(x.id)}
                  sx={{ border: `1px solid ${on ? TINT.blue.fg : HAIRLINE}`, bgcolor: on ? TINT.blue.bg : "#fff", color: on ? TINT.blue.fg : MUTED, font: "inherit",
                    fontSize: "0.88rem", fontWeight: on ? 800 : 650, px: 1.5, py: 0.6, borderRadius: "6px", cursor: "pointer", whiteSpace: "nowrap" }}>
                  {x.name}{!x.view && <Box component="span" sx={{ ml: 0.75, fontSize: "0.7rem", fontWeight: 700, color: FAINT }}>soon</Box>}
                </Box>
              );
            })}
          </Box>
        </GlassCard>
      </Box>
      {t.view ? <t.view key={t.id} /> : <Placeholder t={t} />}
    </Box>
  );
}
