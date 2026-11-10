"use client";

// DUPLICATES & MERGES > Performis - one company, several customer numbers: the new title of each account (SARCLA 10.11.2026,
// first a toggle inside Companies > Left alone; then "where is the logic on company from Performis?" - a topic of the main
// toggle of its own, the rule written out above the list). The rule is src/lib/companyDuplicates/performis.ts; nothing is
// written to HubSpot or Performis - the download goes to Performis by hand.

import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import RuleOutlinedIcon from "@mui/icons-material/RuleOutlined";
import PageHeader from "@/app/PageHeader";
import { GUTTER } from "@/app/analytics/Shell";
import { CardTitle, GlassCard, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { Chip } from "@/app/connectors/parts";
import { ROLE_TAG } from "@/lib/companyDuplicates/performis";
import { DupToggle } from "../DupToggle";
import { PerformisView } from "./Performis";

const STEPS: { title: string; text: React.ReactNode }[] = [
  { title: "1. One company", text: <>Two customer numbers or more with <b>the same name at the same postcode</b>, or <b>the same name and the same website</b>. A website shared under other names is a group&apos;s companies (sister firms, brands) and stays out. The hub never merges these companies: in Performis they stay separate accounts, only their title changes.</> },
  { title: "2. One Mandant at a time", text: <>AG (M100) and GmbH (M110) are two ledgers. An account is only compared with the accounts of its own Mandant, and only where that Mandant holds two customer numbers or more.</> },
  { title: "3. Buying", text: <>An order in the <b>last 12 months</b> (the company&apos;s Last order date; without one, its last order year is this year).</> },
  { title: "4. The new title", text: <>The company&apos;s name and the tag in brackets, e.g. <i>Sika Schweiz AG ({ROLE_TAG.main})</i>. A tag given before is replaced, never doubled, so the list can be downloaded again at any time.</> },
];
const TAGS: { tag: string; tint: "green" | "blue" | "slate"; text: string }[] = [
  { tag: ROLE_TAG.main, tint: "green", text: "The account that buys: of the accounts buying, the one with the most revenue this year (then last year's, then the latest order). If none buys: the one that ordered last." },
  { tag: ROLE_TAG.side, tint: "blue", text: "Every other account that buys - several accounts in use, the main one gets MAIN, these get SIDE." },
  { tag: ROLE_TAG.duplicate, tint: "slate", text: "No order in the last 12 months - the colleagues should no longer book on it." },
];

export default function PerformisPage() {
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader title="Duplicates & merges"
        subtitle="Performis: one company with several customer numbers - the title is the only thing we can change in Performis, so each account gets one that says which to use" />
      <DupToggle on="performis" />
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<RuleOutlinedIcon />} tint="purple" title="How the new title is chosen"
          note="Made again with every hourly read of all companies. The Company unique number comes from HubSpot; where it is missing it is made from the Mandant and the customer number (100-715700) and marked (made)." />
        <Grid container spacing={2}>
          {STEPS.map((s) => (
            <Grid key={s.title} size={{ xs: 12, md: 6, xl: 3 }}>
              <Box sx={{ height: "100%", p: 1.5, borderRadius: "12px", border: `1px solid ${HAIRLINE}`, bgcolor: "rgba(21,34,58,.02)" }}>
                <Typography sx={{ fontSize: "0.86rem", fontWeight: 800, color: INK, mb: 0.5 }}>{s.title}</Typography>
                <Typography sx={{ fontSize: "0.8rem", color: MUTED, lineHeight: 1.45 }}>{s.text}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" }, gap: 1.5, mt: 2 }}>
          {TAGS.map((t) => (
            <Box key={t.tag} sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
              <Box sx={{ flexShrink: 0 }}><Chip tint={t.tint}>{t.tag}</Chip></Box>
              <Typography sx={{ fontSize: "0.8rem", color: MUTED, lineHeight: 1.45 }}>{t.text}</Typography>
            </Box>
          ))}
        </Box>
      </GlassCard>
      <Box sx={{ display: "grid", gap: 2.5, minWidth: 0 }}><PerformisView /></Box>
    </Box>
  );
}
