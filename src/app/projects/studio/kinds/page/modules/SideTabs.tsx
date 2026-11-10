"use client";
// THE RIGHT SIDE BAR'S TWO TABS (Content v7, SARCLA 10.11.2026 point 3: "put the modules on the right side bar after the
// assistant"): "Assistant | Modules" as one squared switch at the top of the column. Both stay mounted - what was typed
// into the assistant, or the category open in the library, is still there after a look at the other tab. The tab chosen
// is kept for next time; the studio switches to Modules when the page asks for a module ("+" between its elements).

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import DashboardCustomizeOutlinedIcon from "@mui/icons-material/DashboardCustomizeOutlined";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { PINK } from "../../../parts";

export type SideTab = "assist" | "modules";
const KEY = "page-studio:side-tab";

export function SideTabs({ assistant, modules, nonce, count }: {
  assistant: React.ReactNode; modules: React.ReactNode;
  /** the studio asks for the Modules tab when this changes */
  nonce: number;
  /** the modules in the library */
  count: number;
}) {
  const [tab, setTabState] = useState<SideTab>("assist");
  useEffect(() => { try { const t = window.localStorage.getItem(KEY); if (t === "modules" || t === "assist") setTabState(t); } catch { /* no storage */ } }, []);
  const setTab = (t: SideTab) => { setTabState(t); try { window.localStorage.setItem(KEY, t); } catch { /* no storage */ } };
  useEffect(() => { if (nonce) setTab("modules"); }, [nonce]);
  const tabs: { key: SideTab; label: string; icon: React.ReactNode; note?: string }[] = [
    { key: "assist", label: "Assistant", icon: <AutoAwesomeOutlinedIcon sx={{ fontSize: 16 }} /> },
    { key: "modules", label: "Modules", icon: <DashboardCustomizeOutlinedIcon sx={{ fontSize: 16 }} />, note: String(count) },
  ];
  return (
    <Box sx={{
      height: "100%", minHeight: 0, display: "flex", flexDirection: "column", borderRadius: "18px", overflow: "hidden",
      bgcolor: "rgba(255,255,255,.82)", border: "1px solid rgba(255,255,255,.9)", boxShadow: "0 1px 2px rgba(31,45,78,.04), 0 12px 32px rgba(31,45,78,.07)",
    }}>
      <Box sx={{ px: 1.25, pt: 1.25, pb: 1, borderBottom: `1px solid ${HAIRLINE}`, flexShrink: 0 }}>
        <Box role="tablist" aria-label="The side bar" sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", p: "3px", gap: "3px", borderRadius: "8px", bgcolor: "#eef1f5", border: `1px solid ${HAIRLINE}` }}>
          {tabs.map((t) => {
            const on = tab === t.key;
            return (
              <Box key={t.key} component="button" type="button" role="tab" aria-selected={on} onClick={() => setTab(t.key)} sx={{
                all: "unset", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 0.75, minWidth: 0, py: 0.7, px: 1,
                borderRadius: "6px", fontSize: "0.82rem", fontWeight: 700, whiteSpace: "nowrap", transition: "background-color .15s, color .15s, box-shadow .15s",
                color: on ? INK : MUTED, bgcolor: on ? "#fff" : "transparent", boxShadow: on ? "0 1px 2px rgba(21,34,58,.12), 0 0 0 1px rgba(21,34,58,.06)" : "none",
                "& svg": { color: on ? PINK : MUTED }, "&:hover": on ? {} : { color: INK },
                "&:focus-visible": { outline: `2px solid ${PINK}`, outlineOffset: 1 },
              }}>
                {t.icon}{t.label}
                {t.note && <Box component="span" sx={{ fontSize: "0.68rem", fontWeight: 700, color: on ? PINK : MUTED, border: `1px solid ${on ? "rgba(194,44,110,.35)" : HAIRLINE}`, borderRadius: "4px", px: 0.5, lineHeight: 1.5 }}>{t.note}</Box>}
              </Box>
            );
          })}
        </Box>
      </Box>
      <Box role="tabpanel" sx={{ flex: 1, minHeight: 0, overflowY: "auto", display: tab === "assist" ? "block" : "none" }}>{assistant}</Box>
      <Box role="tabpanel" sx={{ flex: 1, minHeight: 0, display: tab === "modules" ? "flex" : "none", flexDirection: "column" }}>{modules}</Box>
    </Box>
  );
}
