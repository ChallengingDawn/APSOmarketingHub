"use client";
// THE BUILD PANE'S LINE TO THE LIBRARY (Content v7, SARCLA 10.11.2026 point 3: the modules moved into the right side bar's
// "Modules" tab). What was v6's "Modules" box is one small line: how many modules the page holds (each opens with a click
// on it in the page), and the way to the library on the right.

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import DashboardCustomizeOutlinedIcon from "@mui/icons-material/DashboardCustomizeOutlined";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import type { PageDoc } from "@/lib/content/studio/kinds/page/model";
import { moduleOfChange } from "@/lib/content/studio/kinds/page/modules/model";
import { MODULES } from "@/lib/content/studio/kinds/page/modules/registry";
import { PINK } from "../../../parts";
import type { Picked } from "../Frame";
import type { ModulesCtl } from "./useModules";

export function ModuleActions({ ctl, d, picked }: { ctl: ModulesCtl; d: PageDoc; picked: Picked | null }) {
  if (!ctl.canEdit || picked) return null;
  const n = d.source === "new" ? (d.fields.modules ?? []).length : d.changes.filter((c) => moduleOfChange(c)).length;
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 1.25, px: 1, py: 0.6, border: `1px solid ${HAIRLINE}`, borderRadius: "6px", bgcolor: "rgba(255,255,255,.7)" }}>
      <DashboardCustomizeOutlinedIcon sx={{ fontSize: 16, color: PINK }} />
      <Typography sx={{ fontSize: "0.78rem", color: n ? INK : MUTED, flex: 1, minWidth: 0 }} noWrap>
        {n ? `${n} module${n === 1 ? "" : "s"} on this page - a click on one opens it` : "No module on this page yet"}
      </Typography>
      <Box component="button" type="button" onClick={ctl.showTab} sx={{ all: "unset", cursor: "pointer", fontSize: "0.78rem", fontWeight: 700, color: PINK, whiteSpace: "nowrap", "&:hover": { textDecoration: "underline" } }}>
        {MODULES.length} in the library
      </Box>
    </Box>
  );
}
