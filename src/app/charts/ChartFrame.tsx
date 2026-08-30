"use client";

// The container every chart mounts in. It owns the title, the caption, the
// table-view twin (the accessibility equivalent of the plot — every value a
// chart shows is reachable here without hovering), and the refetch behaviour:
// while a window switch reloads, the previous render stays at reduced opacity
// instead of collapsing into a skeleton.

import { useState, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { CHROME } from "./palette";

export type TableTwin = {
  columns: string[];
  rows: (string | number)[][];
  /** Column indexes that hold numbers, right-aligned with tabular figures. */
  numeric?: number[];
};

export function ChartFrame({
  title,
  caption,
  table,
  stale = false,
  empty,
  children,
  aside,
}: {
  title: string;
  caption?: ReactNode;
  table?: TableTwin;
  /** A newer request is in flight — hold the last render, dimmed. */
  stale?: boolean;
  /** Shown instead of the plot when there is genuinely nothing to draw. */
  empty?: string | null;
  children: ReactNode;
  aside?: ReactNode;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");

  return (
    <Box component="figure" sx={{ m: 0, minWidth: 0 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 2,
          mb: 1.5,
          flexWrap: "wrap",
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            component="figcaption"
            sx={{ fontSize: "0.95rem", fontWeight: 600, color: CHROME.ink, letterSpacing: "-0.01em" }}
          >
            {title}
          </Typography>
          {caption && (
            <Typography sx={{ fontSize: "0.78rem", color: CHROME.muted, mt: 0.25 }}>{caption}</Typography>
          )}
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {aside}
          {table && (
            <ToggleButtonGroup
              size="small"
              exclusive
              value={view}
              onChange={(_, v: "chart" | "table" | null) => v && setView(v)}
              aria-label="Chart or table view"
              sx={{ "& .MuiToggleButton-root": { px: 1.25, py: 0.35, fontSize: "0.74rem" } }}
            >
              <ToggleButton value="chart">Chart</ToggleButton>
              <ToggleButton value="table">Table</ToggleButton>
            </ToggleButtonGroup>
          )}
        </Box>
      </Box>

      <Box sx={{ opacity: stale ? 0.45 : 1, transition: "opacity 160ms ease", minWidth: 0 }}>
        {empty ? (
          <Box
            sx={{
              border: `1px dashed ${CHROME.axis}`,
              borderRadius: 2,
              p: 4,
              textAlign: "center",
            }}
          >
            <Typography sx={{ fontSize: "0.85rem", color: CHROME.muted }}>{empty}</Typography>
          </Box>
        ) : view === "table" && table ? (
          <Box sx={{ overflowX: "auto", border: `1px solid ${CHROME.grid}`, borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {table.columns.map((c, i) => (
                    <TableCell key={c} align={table.numeric?.includes(i) ? "right" : "left"}>
                      {c}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {table.rows.map((r, ri) => (
                  <TableRow key={ri}>
                    {r.map((cell, ci) => (
                      <TableCell
                        key={ci}
                        align={table.numeric?.includes(ci) ? "right" : "left"}
                        sx={table.numeric?.includes(ci) ? { fontVariantNumeric: "tabular-nums" } : undefined}
                      >
                        {cell}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        ) : (
          children
        )}
      </Box>
    </Box>
  );
}
