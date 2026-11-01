"use client";
// A BUC VIEW PANEL WITH NO GRAPH YET (SARCLA 01.11.2026: "clear BUC view of all graphs, let the user promote what he wants;
// leave the instruction simplified, with flat icons, not emojis, on the placeholder per topic"). The panel keeps its
// figures; the graphs are the ones people send here from the page - Actions on a graph, BUC View switched on.

import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import AddchartOutlinedIcon from "@mui/icons-material/AddchartOutlined";
import LaunchOutlinedIcon from "@mui/icons-material/LaunchOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import ToggleOnOutlinedIcon from "@mui/icons-material/ToggleOnOutlined";
import { FAINT, HAIRLINE, INK, MUTED, TINT, type Tint } from "@/app/uc/report/ui";

/** Where the graphs come from: the page's name and address. */
export function BucEmpty({ page, href, tint = "blue" }: { page: string; href: string; tint?: Tint }) {
  const steps = [
    { icon: <LaunchOutlinedIcon />, text: <>Open <Box component={Link} href={href} sx={{ color: TINT[tint].fg, fontWeight: 650, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>{page}</Box></> },
    { icon: <TuneOutlinedIcon />, text: <>Click <b>Actions</b> on a graph</> },
    { icon: <ToggleOnOutlinedIcon />, text: <>Switch on <b>BUC View</b></> },
  ];
  return (
    <Box sx={{ border: `1.5px dashed ${HAIRLINE}`, borderRadius: "18px", px: 2.5, py: 2, display: "flex", alignItems: "center", gap: { xs: 1.5, md: 3 }, flexWrap: "wrap" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
        <AddchartOutlinedIcon sx={{ fontSize: 26, color: FAINT }} />
        <Typography sx={{ fontSize: "0.92rem", fontWeight: 650, color: INK }}>Add a graph here</Typography>
      </Box>
      <Box component="ol" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", alignItems: "center", gap: { xs: 1, md: 2.5 }, flexWrap: "wrap" }}>
        {steps.map((s, i) => (
          <Box component="li" key={i} sx={{ display: "flex", alignItems: "center", gap: 0.75, fontSize: "0.86rem", color: MUTED }}>
            <Box sx={{ display: "inline-flex", color: FAINT, "& svg": { fontSize: 18 } }}>{s.icon}</Box>
            <span>{s.text}</span>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
