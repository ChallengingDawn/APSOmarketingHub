"use client";
// THE ACTIONS TAB ON A CARD THAT HAS NO PLACE FOR IT (SARCLA 18.10.2026: "some graphs don't have
// actions") - a card drawn by another module (the AEO cards, Customers from search, the movements,
// the nutshell's graphs) gets the tab pinned on its right edge, level with its title, without
// touching the card itself.

import Box from "@mui/material/Box";
import { TileActions, type TileInfo } from "./TileActions";
import type { Placement } from "@/lib/reporting/kpiActions";

export function WithActions({ tile, start = "tab", where, top = { xs: 16, md: 22 }, children }: {
  tile: TileInfo; start?: Placement; where?: "nutshell" | "tab";
  /** how far down the card's title sits - the tab is level with it */
  top?: number | { xs?: number; md?: number };
  children: React.ReactNode;
}) {
  return (
    <Box sx={{ position: "relative", minWidth: 0 }}>
      {children}
      <Box sx={{ position: "absolute", top, right: 0, zIndex: 1 }}>
        <TileActions tile={tile} start={start} where={where} edge={0} />
      </Box>
    </Box>
  );
}
