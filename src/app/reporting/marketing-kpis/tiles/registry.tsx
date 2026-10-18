"use client";
// HOW A PROMOTED CARD IS DRAWN IN THE NUTSHELL - a page registers a renderer for its cards (their
// tab and filters are in the spec); a page that has none yet shows the card as a way to it.

import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

import { FAINT, INK, MUTED, glass } from "@/app/uc/report/ui";
import type { TileSpec } from "@/lib/reporting/kpiActions";

export type { TileSpec };
const renderers = new Map<string, (spec: TileSpec) => React.ReactNode>();

/** A page's cards, drawn from their spec when promoted: registerTileRenderer("reach", (s) => <ReachCard spec={s} />). */
export function registerTileRenderer(page: string, render: (spec: TileSpec) => React.ReactNode): void {
  renderers.set(page, render);
}

export function rendererOf(page: string): ((spec: TileSpec) => React.ReactNode) | undefined {
  return renderers.get(page);
}

/** Until its page draws it: the card's name, what it is filtered on, and the way to it. */
export function LinkCard({ spec, actions }: { spec: TileSpec; actions?: React.ReactNode }) {
  const filters = Object.entries(spec.filters ?? {}).filter(([, v]) => v.length).map(([k, v]) => `${k}: ${v.join(", ")}`);
  if (spec.from || spec.to) filters.unshift([spec.from, spec.to].filter(Boolean).join(" to "));
  return (
    <Box sx={{ ...glass, borderRadius: "20px", p: 2.25, display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
      <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.72rem", color: FAINT, fontWeight: 600 }}>{[spec.page, spec.tab].filter(Boolean).join(" · ")}</Typography>
          <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: INK }}>{spec.title}</Typography>
        </Box>
        {actions}
      </Box>
      {filters.length > 0 && <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>{filters.join(" · ")}</Typography>}
      {spec.href && (
        <Box component={Link} href={spec.href} sx={{ mt: "auto", display: "inline-flex", alignItems: "center", gap: 0.25, color: INK, fontSize: "0.84rem", fontWeight: 650, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
          Open it <ChevronRightIcon sx={{ fontSize: 18 }} />
        </Box>
      )}
    </Box>
  );
}
