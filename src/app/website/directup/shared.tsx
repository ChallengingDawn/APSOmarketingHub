"use client";

// DirectUP's page: the pieces its tabs share. The look is the UC apps' kit (glass cards with badges, KPI tiles,
// pill choices, the UC table head), as on 3D files and DoC.

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { full } from "@/app/charts/format";
import { ACCENT, INK, MUTED, TRACK } from "@/app/uc/report/ui";
import type { GatewaySetting, Status, Usage } from "@/lib/directup/gateway";

/** The bridge every store view should run; anything older has to be replaced in the footer. */
export const CURRENT_BRIDGE = "v9-tools";

export type Overview = { setting: GatewaySetting; status: Status; usage: Usage; isAdmin: boolean };

/** "13.10.2026 16:46" in local time; `seconds` for the activity log, where steps come seconds apart. */
export function when(iso: string | null | undefined, seconds = false): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}${seconds ? `:${p(d.getSeconds())}` : ""}`;
}

export const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–");

export async function post(body: unknown): Promise<{ ok: boolean; error?: string; data?: unknown }> {
  const r = await fetch("/api/website/directup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return (await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }))) as { ok: boolean; error?: string; data?: unknown };
}

/** Rows of label, bar and figure - the UC apps' horizontal bars, with a note under each label when given. */
export function Bars({ rows, colour = ACCENT }: { rows: { label: string; n: number; note?: string; colour?: string }[]; colour?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  if (!rows.some((r) => r.n > 0)) return <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>None in this period.</Typography>;
  return (
    <Box sx={{ display: "grid", gap: 1.25 }}>
      {rows.map((r) => (
        <Box key={r.label} sx={{ display: "grid", gridTemplateColumns: "minmax(0,1.4fr) minmax(0,2fr) 64px", alignItems: "center", gap: 1.25 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.84rem", color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.label}>{r.label}</Typography>
            {r.note && <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{r.note}</Typography>}
          </Box>
          <Box sx={{ height: 10, borderRadius: 5, bgcolor: TRACK }}>
            <Box sx={{ height: 10, borderRadius: 5, width: `${(r.n / max) * 100}%`, bgcolor: r.colour ?? colour }} />
          </Box>
          <Typography sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{full(r.n)}</Typography>
        </Box>
      ))}
    </Box>
  );
}

export type { Status, Usage };
