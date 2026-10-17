"use client";

// Search bar > Dynamic views: every view the bar can show, depending on what a customer types, with what it
// shows and searches that reach it (SARCLA 17.10.2026: "create another tab dynamic views with all dynamic
// views"). A search opens the live shop with the bar already searching it (the widget reads #apss-q=, .169),
// in the store view picked here. The list is the widget's own router, read from smart-search.js (views.ts).

import { useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ViewQuiltOutlinedIcon from "@mui/icons-material/ViewQuiltOutlined";
import { full } from "@/app/charts/format";
import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { Chip, Choice } from "@/app/connectors/parts";
import { GROUPS, VIEWS, tryUrl, type ViewGroup } from "./views";

const STORES = ["de-CH", "fr-CH", "it-CH", "en-CH", "de-DE", "fr-FR", "it-IT", "nl-NL", "pl-PL", "en-INT"] as const;
type Store = (typeof STORES)[number];

export default function ViewsTab() {
  const [group, setGroup] = useState<ViewGroup | "all">("all");
  const [store, setStore] = useState<Store>("de-CH");
  const [find, setFind] = useState("");
  const f = find.trim().toLowerCase();
  const rows = VIEWS.filter((v) => (group === "all" || v.group === group)
    && (!f || [v.name, v.what, ...v.examples].join(" ").toLowerCase().includes(f)));
  const count = (g: ViewGroup) => VIEWS.filter((v) => v.group === g).length;

  return (
    <>
      <GlassCard>
        <CardTitle icon={<ViewQuiltOutlinedIcon />} tint="purple" title="The bar's dynamic views"
          note={`${full(VIEWS.length)} views: what the bar shows depends on what the customer types. A search below opens the shop with the bar searching it.`} />
        <Box sx={{ display: "grid", gap: 1.25 }}>
          <Choice<ViewGroup | "all"> value={group} onChange={setGroup}
            options={[{ key: "all", label: "All", count: VIEWS.length }, ...GROUPS.map((g) => ({ key: g, label: g, count: count(g) }))]} />
          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
            <TextField size="small" placeholder="Find a view or a search…" value={find} onChange={(e) => setFind(e.target.value)} sx={{ width: 280 }} />
            <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", flexWrap: "wrap" }}>
              <Typography sx={{ fontSize: "0.78rem", color: FAINT }}>Open in</Typography>
              <Choice<Store> value={store} onChange={setStore} options={STORES.map((s) => ({ key: s, label: s }))} />
            </Box>
          </Box>
        </Box>
      </GlassCard>

      {rows.length === 0 && <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>No view matches.</Typography>}
      <Grid container spacing={2}>
        {rows.map((v) => (
          <Grid key={v.id} size={{ xs: 12, sm: 6, lg: 4 }}>
            <GlassCard sx={{ height: "100%", display: "flex", flexDirection: "column", gap: 1 }}>
              <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
                <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: INK, lineHeight: 1.3 }}>{v.name}</Typography>
                <Chip tint="slate">{v.group}</Chip>
              </Box>
              <Typography sx={{ fontSize: "0.82rem", color: MUTED, flex: 1 }}>{v.what}</Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, pt: 0.5, borderTop: `1px solid ${HAIRLINE}` }}>
                {v.examples.length === 0 && v.hint && <Typography sx={{ fontSize: "0.78rem", color: FAINT, mt: 0.75 }}>{v.hint}</Typography>}
                {v.examples.map((q) => (
                  <Box key={q} component="a" href={tryUrl(store, q)} target="_blank" rel="noopener noreferrer"
                    title={`Open the shop (${store}) with the bar searching "${q}"`}
                    sx={{
                      display: "inline-flex", alignItems: "center", gap: 0.5, px: 1.1, py: 0.4, mt: 0.75, borderRadius: "999px",
                      border: `1px solid ${HAIRLINE}`, fontSize: "0.78rem", fontWeight: 600, color: "#2459d1", textDecoration: "none",
                      bgcolor: "rgba(36,89,209,.05)", "&:hover": { bgcolor: "rgba(36,89,209,.1)" },
                      "&:focus-visible": { outline: "2px solid #2459d1", outlineOffset: 2 },
                    }}>
                    {q}<OpenInNewIcon sx={{ fontSize: 13 }} />
                  </Box>
                ))}
              </Box>
            </GlassCard>
          </Grid>
        ))}
      </Grid>
    </>
  );
}
