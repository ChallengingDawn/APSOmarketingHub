"use client";

// Search bar > Featured: the products the bar features when it opens (the dashboard's "Features today"),
// with their tag line in each language. Editing stays on the old dashboard until the switches move.

import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import StarOutlineIcon from "@mui/icons-material/StarOutline";
import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { Chip } from "@/app/connectors/parts";
import type { Feature } from "@/lib/searchbar/gateway";
import { Empty, Loaded } from "./shared";

function Card({ f }: { f: Feature }) {
  const langs = Object.keys(f.i18n ?? {});
  return (
    <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "14px", p: 1.5, display: "flex", gap: 1.5, height: "100%", bgcolor: "rgba(255,255,255,.6)" }}>
      {f.photo_url && <Box component="img" src={f.photo_url} alt="" loading="lazy" onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.visibility = "hidden"; }} sx={{ width: 72, height: 72, objectFit: "contain", flexShrink: 0, borderRadius: "10px", bgcolor: "#fff" }} />}
      <Box sx={{ minWidth: 0, display: "grid", gap: 0.4, alignContent: "start" }}>
        <Typography sx={{ fontSize: "0.9rem", fontWeight: 600, color: INK }}>{f.title}</Typography>
        <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>{f.sku} · {f.hf}{f.code ? ` · ${f.code}` : ""}</Typography>
        {f.tag && <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED, letterSpacing: "0.04em" }}>{f.tag}</Typography>}
        {f.copy && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{f.copy}</Typography>}
        {langs.length > 0 && <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.25 }}>{langs.map((l) => <Chip key={l} tint="slate">{l}</Chip>)}</Box>}
      </Box>
    </Box>
  );
}

export default function FeaturesTab() {
  return (
    <Loaded<{ features: Feature[] }> url="/api/website/search-bar?part=features" what="the featured products">
      {(d) => (
        <GlassCard>
          <CardTitle icon={<StarOutlineIcon />} tint="amber" title="Featured when the bar opens" note="Each with its tag line in the shop's languages. Editing stays on the old dashboard for now." />
          {!d.features?.length ? <Empty>No featured product.</Empty> : (
            <Grid container spacing={1.5}>
              {d.features.map((f) => <Grid key={f.id} size={{ xs: 12, md: 6, xl: 4 }}><Card f={f} /></Grid>)}
            </Grid>
          )}
        </GlassCard>
      )}
    </Loaded>
  );
}
