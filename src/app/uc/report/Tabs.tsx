"use client";

// The UC reports' tab strip - the Erosion one, made reusable: glass pill row,
// arrow keys move between tabs, and the open tab lives in the #fragment so a
// link (or the back button) lands on it.

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { INK, MUTED, glass } from "./ui";

export type TabDef<T extends string> = { id: T; label: string; count: string | null };

/** The open tab, read from and written to the URL's #fragment. */
export function useHashTab<T extends string>(hashes: Record<T, string>, first: T): [T, (t: T) => void] {
  const [tab, setTab] = useState<T>(first);
  useEffect(() => {
    const apply = () => {
      const want = (Object.entries(hashes) as [T, string][]).find(([, h]) => h === window.location.hash)?.[0];
      if (want) setTab(want);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const select = (t: T) => {
    setTab(t);
    window.history.replaceState(null, "", hashes[t]);
  };
  return [tab, select];
}

export function ReportTabs<T extends string>({ name, tab, onSelect, tabs }: {
  /** For the ids and the screen-reader label, e.g. "push". */
  name: string;
  tab: T;
  onSelect: (t: T) => void;
  tabs: TabDef<T>[];
}) {
  const move = (from: T, step: number) => {
    const i = tabs.findIndex((t) => t.id === from);
    const next = tabs[(i + step + tabs.length) % tabs.length].id;
    onSelect(next);
    document.getElementById(`${name}-tab-${next}`)?.focus();
  };
  return (
    <Box
      role="tablist"
      aria-label={`${name} views`}
      sx={{ ...glass, display: "inline-flex", flexWrap: "wrap", gap: 0.5, p: 0.6, borderRadius: "16px", boxShadow: "0 1px 2px rgba(31,45,78,.04)" }}
    >
      {tabs.map(({ id, label, count }) => {
        const on = tab === id;
        return (
          <Box
            key={id}
            id={`${name}-tab-${id}`}
            role="tab"
            aria-selected={on}
            aria-controls={`${name}-panel-${id}`}
            tabIndex={on ? 0 : -1}
            onClick={() => onSelect(id)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") { e.preventDefault(); move(id, 1); }
              if (e.key === "ArrowLeft") { e.preventDefault(); move(id, -1); }
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(id); }
            }}
            sx={{
              display: "flex", alignItems: "center", gap: 0.85, px: 1.75, py: 0.9, borderRadius: "12px",
              cursor: "pointer", userSelect: "none", whiteSpace: "nowrap",
              fontSize: "0.88rem", fontWeight: 600, letterSpacing: "-0.01em",
              color: on ? "#2459d1" : MUTED,
              bgcolor: on ? "#e6edfd" : "transparent",
              transition: "background-color .12s, color .12s",
              "&:hover": { color: on ? "#2459d1" : INK, bgcolor: on ? "#e6edfd" : "rgba(255,255,255,0.75)" },
              "&:focus-visible": { outline: "2px solid #2459d1", outlineOffset: 1 },
            }}
          >
            {label}
            {count !== null && (
              <Typography component="span" sx={{
                fontSize: "0.72rem", fontWeight: 700, lineHeight: 1, px: 0.75, py: 0.4, borderRadius: "7px",
                bgcolor: on ? "#ffffff" : "rgba(21,34,58,.06)", color: on ? "#2459d1" : MUTED,
              }}>{count}</Typography>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
